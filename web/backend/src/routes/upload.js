/**
 * upload.js — Route: POST /api/upload
 * Nhận files + albumName từ frontend, upload lên Cloudflare R2.
 * Sau upload xong → tạo manifest.json + index.html (trang album tĩnh) → đẩy lên R2.
 * QR code trỏ đến URL công khai R2 — điện thoại quét QR mở được ngay!
 */

const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

const { uploadFile, uploadRawBuffer, PUBLIC_BASE_URL, fixVideoFastStart } = require('../services/r2-storage');
const { generateQRDataUrl } = require('../services/qr-service');
const { validateFile, guessMimeType, MAX_VIDEO_SIZE } = require('../utils/file-utils');
const { generateManifest, generateAlbumHtml } = require('../services/album-page-generator');

// Lưu file trong memory (buffer), tối đa 500MB mỗi request
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_VIDEO_SIZE,
    files: 200,
  },
});

/**
 * POST /api/upload
 * Body: multipart/form-data
 *   - files[]: danh sách file
 *   - albumName: (optional) tên album tùy chỉnh
 */
router.post('/', upload.array('files', 200), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có file nào được gửi lên.' });
    }

    // Sinh Album ID
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const shortId = uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();
    const albumId = req.body.albumName
      ? req.body.albumName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
      : `ALBUM_${timestamp}_${shortId}`;

    const results = [];
    const errors = [];

    // Upload từng file lên R2
    for (const file of req.files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        errors.push({ fileName: file.originalname, error: validation.error });
        continue;
      }

      try {
        let mimeType = file.mimetype;
        if (!mimeType || mimeType === 'application/octet-stream') {
          mimeType = guessMimeType(file.originalname);
        }
        const result = await uploadFile(file.buffer, file.originalname, mimeType, albumId);
        results.push({
          ...result,
          mediaType: validation.mediaType,
        });
        console.log(`[Upload] ✅ ${file.originalname} → R2/${albumId}/`);
      } catch (err) {
        console.error(`[Upload] ❌ ${file.originalname}:`, err.message);
        errors.push({ fileName: file.originalname, error: `Lỗi upload: ${err.message}` });
      }
    }

    if (results.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Tất cả file đều upload thất bại.',
        errors,
      });
    }

    // ═══ TẠO TRANG ALBUM CÔNG KHAI TRÊN R2 ═══
    // URL album công khai (trên R2, ai cũng mở được!)
    const publicAlbumUrl = `${PUBLIC_BASE_URL}/${albumId}/index.html`;

    // 1. Sinh QR code trỏ đến URL công khai R2
    const qrDataUrl = await generateQRDataUrl(publicAlbumUrl);
    console.log(`[Upload] 📱 QR → ${publicAlbumUrl}`);

    // 2. Upload manifest.json lên R2
    const manifestJson = generateManifest(albumId, results);
    await uploadRawBuffer(
      Buffer.from(manifestJson, 'utf-8'),
      `${albumId}/manifest.json`,
      'application/json'
    );
    console.log(`[Upload] 📄 manifest.json → R2/${albumId}/`);

    // 3. Sinh trang album HTML tĩnh (tự chứa CSS+JS) và upload lên R2
    const albumHtml = generateAlbumHtml(albumId, results, qrDataUrl);
    await uploadRawBuffer(
      Buffer.from(albumHtml, 'utf-8'),
      `${albumId}/index.html`,
      'text/html; charset=utf-8'
    );
    console.log(`[Upload] 🌐 index.html → R2/${albumId}/`);

    const imagesCount = results.filter(r => r.mediaType === 'image').length;
    const videosCount = results.filter(r => r.mediaType === 'video').length;

    res.json({
      success: true,
      albumId,
      albumUrl: publicAlbumUrl,
      qrDataUrl,
      totalUploaded: results.length,
      imagesCount,
      videosCount,
      files: results,
      errors: errors.length > 0 ? errors : undefined,
      message: `Đã upload thành công ${results.length} file${errors.length > 0 ? `, ${errors.length} file thất bại` : ''}.`,
    });
  } catch (err) {
    console.error('[Upload] Lỗi không mong đợi:', err);
    res.status(500).json({ success: false, error: `Lỗi server: ${err.message}` });
  }
});

// ==========================================
// CHUNKED UPLOAD APIS (Bypass Server)
// ==========================================
const {
  getPresignedUrl,
  initMultipartUpload,
  getPresignedUrlForPart,
  completeMultipartUpload
} = require('../services/r2-storage');

/**
 * POST /api/upload/init
 * Body: { albumName?: string, files: [{ id, name, size, type }] }
 */
router.post('/init', async (req, res) => {
  try {
    const { albumName, files } = req.body;
    if (!files || files.length === 0) return res.status(400).json({ success: false, error: 'No files' });

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const shortId = uuidv4().replace(/-/g, '').slice(0, 6).toUpperCase();
    const albumId = albumName ? albumName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) : `ALBUM_${timestamp}_${shortId}`;

    const results = [];
    for (const f of files) {
      let mimeType = f.type;
      if (!mimeType || mimeType === 'application/octet-stream' || mimeType === 'video' || mimeType === 'image') {
        mimeType = guessMimeType(f.name);
      }
      const safeName = f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/__+/g, '_');
      const key = `${albumId}/${safeName}`;

      let uploadId = null;
      let url = null;

      if (f.size > 5 * 1024 * 1024) { // > 5MB -> Multipart
        uploadId = await initMultipartUpload(key, mimeType);
      } else { // <= 5MB -> Simple Presigned URL
        url = await getPresignedUrl(key, mimeType);
      }

      results.push({ id: f.id, key, uploadId, url, safeName, originalName: f.name });
    }
    res.json({ success: true, albumId, files: results });
  } catch (err) {
    console.error('[Init Upload] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/upload/presign
 * Body: { key, uploadId, partNumber }
 */
router.post('/presign', async (req, res) => {
  try {
    const { key, uploadId, partNumber } = req.body;
    const url = await getPresignedUrlForPart(key, uploadId, partNumber);
    res.json({ success: true, url });
  } catch (err) {
    console.error('[Presign] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/upload/complete
 * Body: { albumId, files: [{ id, key, uploadId, parts: [{ETag, PartNumber}], size, name, mediaType }] }
 */
router.post('/complete', express.json(), async (req, res) => {
  try {
    const { albumId, files } = req.body;
    
    // Hoàn thành multipart cho các file lớn
    for (const f of files) {
      if (f.uploadId && f.parts) {
        // Đảm bảo sort parts tăng dần theo PartNumber
        f.parts.sort((a, b) => a.PartNumber - b.PartNumber);
        await completeMultipartUpload(f.key, f.uploadId, f.parts);
      }
      // Fix moov atom cho video để iOS Safari xem được
      if (f.mediaType === 'video' && f.key.toLowerCase().endsWith('.mp4')) {
        await fixVideoFastStart(f.key);
      }
    }

    // Format kết quả giống route cũ để sinh trang album
    const results = files.map(f => ({
      key: f.key,
      url: `${PUBLIC_BASE_URL}/${f.key}`,
      fileName: f.key.split('/').pop(),
      originalName: f.name,
      size: f.size,
      mediaType: f.mediaType
    }));

    const publicAlbumUrl = `${PUBLIC_BASE_URL}/${albumId}/index.html`;
    const qrDataUrl = await generateQRDataUrl(publicAlbumUrl);

    // Upload manifest.json và index.html
    const manifestJson = generateManifest(albumId, results);
    await uploadRawBuffer(Buffer.from(manifestJson, 'utf-8'), `${albumId}/manifest.json`, 'application/json');

    const albumHtml = generateAlbumHtml(albumId, results, qrDataUrl);
    await uploadRawBuffer(Buffer.from(albumHtml, 'utf-8'), `${albumId}/index.html`, 'text/html; charset=utf-8');

    const imagesCount = results.filter(r => r.mediaType === 'image').length;
    const videosCount = results.filter(r => r.mediaType === 'video').length;

    res.json({
      success: true,
      albumId,
      albumUrl: publicAlbumUrl,
      qrDataUrl,
      totalUploaded: results.length,
      imagesCount,
      videosCount,
      files: results
    });
  } catch (err) {
    console.error('[Complete Upload] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

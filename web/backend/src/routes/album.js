/**
 * album.js — Route: GET /api/album/:albumId
 * Trả về danh sách tất cả file trong album từ Cloudflare R2.
 */

const express = require('express');
const router = express.Router();

const { listAlbumFiles, checkAlbumExists } = require('../services/r2-storage');
const { generateQRDataUrl } = require('../services/qr-service');

/**
 * GET /api/album/:albumId
 * Trả về danh sách ảnh/video trong album
 */
router.get('/:albumId', async (req, res) => {
  try {
    const { albumId } = req.params;

    if (!albumId || albumId.length < 3) {
      return res.status(400).json({ success: false, error: 'Album ID không hợp lệ.' });
    }

    const exists = await checkAlbumExists(albumId);
    if (!exists) {
      return res.status(404).json({ success: false, error: `Album "${albumId}" không tồn tại.` });
    }

    const files = await listAlbumFiles(albumId);

    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
    const albumUrl = `${protocol}://${host}/album.html?id=${albumId}`;
    const qrDataUrl = await generateQRDataUrl(albumUrl);

    res.json({
      success: true,
      albumId,
      albumUrl,
      qrDataUrl,
      totalFiles: files.length,
      imagesCount: files.filter(f => f.mediaType === 'image').length,
      videosCount: files.filter(f => f.mediaType === 'video').length,
      files,
    });
  } catch (err) {
    console.error('[Album] Lỗi lấy danh sách album:', err);
    res.status(500).json({ success: false, error: `Lỗi server: ${err.message}` });
  }
});

module.exports = router;

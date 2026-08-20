/**
 * r2-storage.js — Cloudflare R2 Service (AWS SDK v3 S3-compatible)
 * Upload files và list album files từ Cloudflare R2 bucket.
 */

const { S3Client, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

// Load .env từ thư mục root (../../.env so với web/backend/)
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const BUCKET_NAME = 'my-storge-tool';
const PUBLIC_BASE_URL = 'https://pub-72836303fa9d470b9d3f50d0b0a2ebff.r2.dev';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'heic', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'wmv', 'flv', 'webm', 'm4v', '3gp']);

// Khởi tạo R2 client
const r2Client = new S3Client({
  region: 'auto',
  endpoint: (process.env.Endpoint_URL || '').trim(),
  credentials: {
    accessKeyId: (process.env.Access_Key_ID || '').trim(),
    secretAccessKey: (process.env.Secret_Access_Key || '').trim(),
  },
  forcePathStyle: true, // Bắt buộc với Cloudflare R2
});

/**
 * Upload một file lên R2 dưới prefix albumId/
 * @param {Buffer} fileBuffer - Nội dung file
 * @param {string} fileName - Tên file gốc
 * @param {string} mimeType - MIME type của file
 * @param {string} albumId - ID của album
 * @returns {{ key, url, fileName, size }}
 */
async function uploadFile(fileBuffer, fileName, mimeType, albumId) {
  // Sanitize tên file: bỏ ký tự đặc biệt, giữ extension
  const safeName = fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/__+/g, '_');

  const key = `${albumId}/${safeName}`;

  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    },
    queueSize: 4,      // parallel uploads
    partSize: 5 * 1024 * 1024, // 5MB per part
    leavePartsOnError: false,
  });

  await upload.done();

  return {
    key,
    url: `${PUBLIC_BASE_URL}/${key}`,
    fileName: safeName,
    originalName: fileName,
    size: fileBuffer.length,
  };
}

/**
 * Upload raw buffer (JSON, HTML) lên R2 với Content-Type tùy chỉnh
 */
async function uploadRawBuffer(buffer, key, contentType) {
  const upload = new Upload({
    client: r2Client,
    params: {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    },
  });
  await upload.done();
  return `${PUBLIC_BASE_URL}/${key}`;
}

/**
 * Lấy danh sách tất cả file trong album từ R2
 * @param {string} albumId
 * @returns {Array} mảng file objects
 */
async function listAlbumFiles(albumId) {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: `${albumId}/`,
    MaxKeys: 1000,
  });

  const response = await r2Client.send(command);
  const contents = response.Contents || [];

  // File hệ thống cần bỏ qua (manifest, index.html album)
  const SYSTEM_FILES = new Set(['manifest.json', 'index.html']);

  return contents
    .filter(obj => {
      const name = obj.Key.split('/').pop();
      return name && name.length > 0 && !SYSTEM_FILES.has(name);
    })
    .map(obj => {
      const fileName = obj.Key.split('/').pop();
      const ext = (fileName.split('.').pop() || '').toLowerCase();

      let mediaType = 'image';
      if (VIDEO_EXTS.has(ext)) mediaType = 'video';

      return {
        key: obj.Key,
        fileName,
        url: `${PUBLIC_BASE_URL}/${obj.Key}`,
        size: obj.Size,
        sizeStr: formatSize(obj.Size),
        lastModified: obj.LastModified,
        mediaType,
        ext,
      };
    })
    .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

/**
 * Kiểm tra album có tồn tại không (có ít nhất 1 file)
 */
async function checkAlbumExists(albumId) {
  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: `${albumId}/`,
      MaxKeys: 1,
    });
    const response = await r2Client.send(command);
    return (response.Contents || []).length > 0;
  } catch {
    return false;
  }
}

// ==========================================
// MỚI: PRESIGNED URL & MULTIPART UPLOAD
// ==========================================

/**
 * Lấy một Presigned URL đơn giản (Cho file nhỏ < 5MB)
 */
async function getPresignedUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

/**
 * Bắt đầu quá trình Multipart Upload (Cho file lớn >= 5MB)
 */
async function initMultipartUpload(key, contentType) {
  const command = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });
  const res = await r2Client.send(command);
  return res.UploadId;
}

/**
 * Sinh Presigned URL cho 1 cục (Part) của Multipart Upload
 */
async function getPresignedUrlForPart(key, uploadId, partNumber) {
  const command = new UploadPartCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
  });
  return await getSignedUrl(r2Client, command, { expiresIn: 3600 });
}

/**
 * Hoàn tất Multipart Upload sau khi client đã upload xong tất cả các phần
 * parts = [{ ETag, PartNumber }, ...]
 */
async function completeMultipartUpload(key, uploadId, parts) {
  const command = new CompleteMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts },
  });
  await r2Client.send(command);
  return `${PUBLIC_BASE_URL}/${key}`;
}

/**
 * Tải video từ R2, dùng ffmpeg chuyển moov atom lên đầu file (faststart),
 * rồi upload lại lên R2. Giúp iOS Safari phát được video ngay lập tức.
 * Lệnh ffmpeg chỉ copy stream (không encode lại), nên rất nhanh.
 */
async function fixVideoFastStart(key) {
  let ffmpegPath;
  try {
    ffmpegPath = require('ffmpeg-static');
  } catch (e) {
    console.warn('[FastStart] ffmpeg-static không khả dụng, bỏ qua fix faststart.');
    return;
  }

  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `input_${Date.now()}.mp4`);
  const outputPath = path.join(tmpDir, `output_${Date.now()}.mp4`);

  try {
    // 1. Tải video từ R2 về file tạm
    console.log(`[FastStart] Đang tải ${key} từ R2...`);
    const getCmd = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const response = await r2Client.send(getCmd);
    const writeStream = fs.createWriteStream(inputPath);
    await new Promise((resolve, reject) => {
      response.Body.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    console.log(`[FastStart] Đã tải xong (${formatSize(fs.statSync(inputPath).size)})`);

    // 2. Chạy ffmpeg: copy stream + di chuyển moov atom lên đầu
    await new Promise((resolve, reject) => {
      execFile(ffmpegPath, [
        '-i', inputPath,
        '-c', 'copy',           // Không encode lại, chỉ copy
        '-movflags', '+faststart', // Di chuyển moov atom lên đầu
        '-y',                   // Ghi đè nếu file tồn tại
        outputPath
      ], { timeout: 120000 }, (err, stdout, stderr) => {
        if (err) {
          console.error('[FastStart] ffmpeg lỗi:', stderr);
          return reject(err);
        }
        resolve();
      });
    });
    console.log(`[FastStart] ffmpeg xử lý xong (${formatSize(fs.statSync(outputPath).size)})`);

    // 3. Upload file đã fix lại lên R2 (ghi đè file cũ)
    const fixedBuffer = fs.readFileSync(outputPath);
    const upload = new Upload({
      client: r2Client,
      params: {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fixedBuffer,
        ContentType: 'video/mp4',
      },
    });
    await upload.done();
    console.log(`[FastStart] ✅ Đã upload lại ${key} với moov atom ở đầu file!`);
  } catch (err) {
    console.error(`[FastStart] ❌ Lỗi xử lý ${key}:`, err.message);
  } finally {
    // 4. Dọn rác file tạm
    try { fs.unlinkSync(inputPath); } catch (e) {}
    try { fs.unlinkSync(outputPath); } catch (e) {}
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

module.exports = { 
  uploadFile, 
  uploadRawBuffer, 
  listAlbumFiles, 
  checkAlbumExists, 
  PUBLIC_BASE_URL,
  getPresignedUrl,
  initMultipartUpload,
  getPresignedUrlForPart,
  completeMultipartUpload,
  fixVideoFastStart
};

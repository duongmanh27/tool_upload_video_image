/**
 * file-utils.js — Validate loại file và kích thước
 */

const IMAGE_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/bmp', 'image/tiff', 'image/heic', 'image/avif',
]);

const VIDEO_MIMES = new Set([
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'video/x-ms-wmv', 'video/x-flv', 'video/webm', 'video/3gpp',
  'video/mpeg',
]);

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.heic', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp']);

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;  // 50 MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500 MB

/**
 * Kiểm tra file có hợp lệ không (theo mime type + extension)
 * @param {object} file - multer file object
 * @returns {{ valid: boolean, mediaType: string, error: string }}
 */
function validateFile(file) {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = getExtension(file.originalname);

  const isImage = IMAGE_MIMES.has(mime) || IMAGE_EXTS.has(ext);
  const isVideo = VIDEO_MIMES.has(mime) || VIDEO_EXTS.has(ext);

  if (!isImage && !isVideo) {
    return {
      valid: false,
      mediaType: null,
      error: `Định dạng không hỗ trợ: ${file.originalname} (${mime})`,
    };
  }

  const mediaType = isImage ? 'image' : 'video';
  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;

  if (file.size > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    return {
      valid: false,
      mediaType,
      error: `File quá lớn: ${file.originalname} (giới hạn ${limitMB} MB)`,
    };
  }

  return { valid: true, mediaType, error: null };
}

/**
 * Lấy extension thường (lowercase) của tên file
 */
function getExtension(filename) {
  const parts = (filename || '').split('.');
  if (parts.length < 2) return '';
  return '.' + parts.pop().toLowerCase();
}

/**
 * Guess MIME type từ tên file (fallback khi browser không gửi đúng)
 */
function guessMimeType(filename) {
  const ext = getExtension(filename);
  const mimeMap = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif', '.bmp': 'image/bmp',
    '.heic': 'image/heic', '.avif': 'image/avif',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
    '.webm': 'video/webm', '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv', '.m4v': 'video/mp4',
    '.3gp': 'video/3gpp',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

module.exports = { validateFile, getExtension, guessMimeType, MAX_IMAGE_SIZE, MAX_VIDEO_SIZE };

/**
 * qr-service.js — Tạo QR Code PNG dạng base64 hoặc buffer
 * FIX: Dùng màu đen đậm (#000000) thay vì xám nhạt để điện thoại quét được
 */

const QRCode = require('qrcode');

/**
 * Sinh QR code từ URL/text, trả về data URL (base64 PNG) để nhúng trực tiếp vào HTML
 * @param {string} text - Nội dung QR (thường là URL album)
 * @returns {Promise<string>} data URL base64
 */
async function generateQRDataUrl(text) {
  const dataUrl = await QRCode.toDataURL(text, {
    type: 'image/png',
    width: 400,
    margin: 3,
    color: {
      dark: '#000000',    // ĐEN ĐẬM — dễ quét bằng điện thoại
      light: '#ffffff',   // NỀN TRẮNG
    },
    errorCorrectionLevel: 'H',  // Mức sửa lỗi cao nhất (30%)
  });
  return dataUrl;
}

/**
 * Sinh QR code dạng Buffer PNG
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
async function generateQRBuffer(text) {
  return QRCode.toBuffer(text, {
    type: 'png',
    width: 500,
    margin: 3,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  });
}

module.exports = { generateQRDataUrl, generateQRBuffer };

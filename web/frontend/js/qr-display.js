/**
 * qr-display.js — Hiển thị modal QR Code sau khi upload thành công
 */

'use strict';

const qrModal       = document.getElementById('qrModal');
const qrImage       = document.getElementById('qrImage');
const albumIdDisplay= document.getElementById('albumIdDisplay');
const modalImages   = document.getElementById('modalImages');
const modalVideos   = document.getElementById('modalVideos');
const modalTotal    = document.getElementById('modalTotal');
const modalSub      = document.getElementById('modalSub');
const btnCopyId     = document.getElementById('btnCopyId');
const btnViewAlbum  = document.getElementById('btnViewAlbum');
const btnCloseModal = document.getElementById('btnCloseModal');

/**
 * Hiện modal QR sau khi upload xong
 * @param {{ albumId, qrDataUrl, albumUrl, imagesCount, videosCount, totalUploaded }} result
 */
function showQRModal(result) {
  if (!qrModal) return;

  // Fill data
  qrImage.src      = result.qrDataUrl || '';
  albumIdDisplay.textContent = result.albumId || '—';
  modalImages.textContent    = result.imagesCount ?? 0;
  modalVideos.textContent    = result.videosCount ?? 0;
  modalTotal.textContent     = result.totalUploaded ?? 0;
  modalSub.textContent       = result.message || 'Album đã được lưu trên Pro Media Vault';

  btnViewAlbum.href = result.albumUrl || `/album.html?id=${result.albumId}`;

  // Reset copy button
  btnCopyId.textContent = '📋 Copy';
  btnCopyId.classList.remove('copied');

  // Open modal
  qrModal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

// Copy album ID
btnCopyId.addEventListener('click', async () => {
  const id = albumIdDisplay.textContent;
  if (!id || id === '—') return;
  try {
    await navigator.clipboard.writeText(id);
    btnCopyId.textContent = '✅ Đã copy!';
    btnCopyId.classList.add('copied');
    setTimeout(() => {
      btnCopyId.textContent = '📋 Copy';
      btnCopyId.classList.remove('copied');
    }, 2000);
  } catch {
    // Fallback
    const el = document.createElement('textarea');
    el.value = id;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    btnCopyId.textContent = '✅ Đã copy!';
    setTimeout(() => { btnCopyId.textContent = '📋 Copy'; }, 2000);
  }
});

// Close modal
function closeQRModal() {
  qrModal.classList.remove('open');
  document.body.style.overflow = '';
}

btnCloseModal.addEventListener('click', closeQRModal);

// Close on overlay click
qrModal.addEventListener('click', e => {
  if (e.target === qrModal) closeQRModal();
});

// ESC key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && qrModal.classList.contains('open')) {
    closeQRModal();
  }
});

// Expose globally so uploader.js can call it
window.showQRModal = showQRModal;

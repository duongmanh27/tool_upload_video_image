/**
 * album-viewer.js — Logic trang xem album
 * - Đọc albumId từ URL params
 * - Gọi GET /api/album/:albumId
 * - Render grid ảnh/video
 * - Lightbox với phím tắt ← →, ESC
 * - Filter ảnh / video / tất cả
 * - QR modal
 */

'use strict';
// ── DOM Refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const albumGrid = $('albumGrid');
const loadingState = $('loadingState');
const errorState = $('errorState');
const emptyState = $('emptyState');
const filterBar = $('filterBar');
const errorMsg = $('errorMsg');
const loadingAlbumId = $('loadingAlbumId');
const albumIdChip = $('albumIdChip');
const albumHeaderCount = $('albumHeaderCount');
const countAll = $('countAll');
const countImages = $('countImages');
const countVideos = $('countVideos');

// Lightbox
const lightbox = $('lightbox');
const lbContent = $('lbContent');
const lbClose = $('lbClose');
const lbPrev = $('lbPrev');
const lbNext = $('lbNext');

// QR Modal
const qrModal = $('qrModal');
const qrModalImg = $('qrModalImg');
const qrModalId = $('qrModalId');
const btnShowQR = $('btnShowQR');
const btnCloseQR = $('btnCloseQR');

// ── State ──────────────────────────────────────────────────────────────────
let allFiles = [];
let filteredFiles = [];
let currentIdx = 0;
let currentFilter = 'all';
let albumData = null;

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  const params = new URLSearchParams(window.location.search);
  const albumId = params.get('id');

  if (!albumId) {
    showError('Không tìm thấy Album ID trong URL. Vui lòng kiểm tra lại đường dẫn.');
    return;
  }

  document.title = `Album ${albumId} — Media Upload Tool`;
  albumIdChip.textContent = albumId;
  loadingAlbumId.textContent = albumId;

  try {
    const res = await fetch(`/api/album/${encodeURIComponent(albumId)}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || `Lỗi HTTP ${res.status}`);
    }

    albumData = data;
    allFiles = data.files || [];

    // Update header
    albumHeaderCount.textContent =
      `${data.totalFiles} file · ${data.imagesCount} ảnh · ${data.videosCount} video`;

    // Counts
    countAll.textContent = allFiles.length;
    countImages.textContent = data.imagesCount;
    countVideos.textContent = data.videosCount;

    if (allFiles.length === 0) {
      showState('empty');
    } else {
      showState('grid');
      renderGrid('all');
    }

    // QR modal
    if (data.qrDataUrl) {
      qrModalImg.src = data.qrDataUrl;
      qrModalId.textContent = albumId;
    }

  } catch (err) {
    console.error('[Album]', err);
    showError(err.message);
  }
}

// ── Render Grid ────────────────────────────────────────────────────────────
function renderGrid(filter) {
  currentFilter = filter;
  filteredFiles = filter === 'all' ? allFiles : allFiles.filter(f => f.mediaType === filter);
  albumGrid.innerHTML = '';

  filteredFiles.forEach((file, idx) => {
    const card = document.createElement('div');
    card.className = 'album-card';
    card.setAttribute('role', 'listitem');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${file.mediaType === 'image' ? 'Ảnh' : 'Video'}: ${file.fileName}`);

    const thumbHtml = file.mediaType === 'image'
      ? `<img src="${file.url}" alt="${escapeHtml(file.fileName)}" loading="lazy" />`
      : `<div class="card-video-thumb">🎬<span style="font-size:13px;color:#94a3b8">${escapeHtml(file.fileName.split('.').pop().toUpperCase())}</span></div>`;

    const playOverlay = file.mediaType === 'video'
      ? `<div class="card-play-overlay"><span>▶</span></div>`
      : '';

    card.innerHTML = `
      <div class="album-card-wrap" data-action="preview">
        ${thumbHtml}
        ${playOverlay}
        <span class="album-card-type ${file.mediaType}">${file.mediaType === 'image' ? 'ẢNH' : 'VIDEO'}</span>
      </div>
      <div class="album-card-footer">
        <div class="album-card-name" title="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</div>
        <div class="album-card-size">${file.sizeStr || ''}</div>
        <div class="album-card-actions">
          <button class="btn-card-view" data-idx="${idx}" type="button" title="Xem trước">👁 Xem</button>
          <button class="btn-card-download" data-url="${file.url}" data-name="${escapeHtml(file.fileName)}" type="button" title="Tải xuống">⬇️ Tải</button>
        </div>
      </div>
    `;

    // Stagger animation
    card.style.animationDelay = `${idx * 40}ms`;

    // Click on thumbnail area → preview (lightbox)
    card.querySelector('.album-card-wrap').addEventListener('click', () => openLightbox(idx));

    // View button → preview
    card.querySelector('.btn-card-view').addEventListener('click', (e) => {
      e.stopPropagation();
      openLightbox(idx);
    });

    // Download button
    card.querySelector('.btn-card-download').addEventListener('click', (e) => {
      e.stopPropagation();
      downloadFile(file.url, file.fileName);
    });

    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(idx); }
    });

    albumGrid.appendChild(card);
  });
}

/**
 * Tải file xuống — xử lý cả cross-origin URL (Cloudflare R2 public)
 */
function downloadFile(url, fileName) {
  // Thử tải bằng fetch + blob (hoạt động tốt với cross-origin)
  fetch(url, { mode: 'cors' })
    .then(res => {
      if (!res.ok) throw new Error('Network error');
      return res.blob();
    })
    .then(blob => {
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    })
    .catch(() => {
      // Fallback: mở link mới
      window.open(url, '_blank');
    });
}

// ── Lightbox ───────────────────────────────────────────────────────────────
function openLightbox(idx) {
  currentIdx = idx;
  renderLightboxItem();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  // Stop video if playing
  const video = lbContent.querySelector('video');
  if (video) video.pause();
}

function renderLightboxItem() {
  const file = filteredFiles[currentIdx];
  if (!file) return;

  // Stop any existing video
  const oldVideo = lbContent.querySelector('video');
  if (oldVideo) oldVideo.pause();

  lbContent.innerHTML = '';

  if (file.mediaType === 'image') {
    const img = document.createElement('img');
    img.src = file.url;
    img.alt = file.fileName;
    lbContent.appendChild(img);
  } else {
    const video = document.createElement('video');
    video.src = file.url;
    video.setAttribute('controls', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('x5-playsinline', '');
    video.setAttribute('preload', 'auto');
    video.style.outline = 'none';
    lbContent.appendChild(video);
    video.load();
  }

  // Caption
  const caption = document.createElement('div');
  caption.className = 'lightbox-caption';
  caption.innerHTML = `
    <span class="lb-name">${escapeHtml(file.fileName)}</span>
    <span class="lb-counter">${currentIdx + 1} / ${filteredFiles.length}</span>
    <a class="btn-lb-download" href="${file.url}" download="${file.fileName}" target="_blank">
      ⬇️ Tải
    </a>
  `;
  lbContent.appendChild(caption);

  // Nav buttons visibility
  lbPrev.style.opacity = currentIdx > 0 ? '1' : '0.3';
  lbNext.style.opacity = currentIdx < filteredFiles.length - 1 ? '1' : '0.3';
}

function navLightbox(dir) {
  const newIdx = currentIdx + dir;
  if (newIdx < 0 || newIdx >= filteredFiles.length) return;
  currentIdx = newIdx;
  renderLightboxItem();
}

lbClose.addEventListener('click', closeLightbox);
lbPrev.addEventListener('click', () => navLightbox(-1));
lbNext.addEventListener('click', () => navLightbox(1));

lightbox.addEventListener('click', e => {
  if (e.target === lightbox) closeLightbox();
});

// ── Filter Buttons ─────────────────────────────────────────────────────────
['filterAll', 'filterImages', 'filterVideos'].forEach(btnId => {
  const btn = $(btnId);
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderGrid(btn.dataset.filter);
  });
});

// ── QR Modal ───────────────────────────────────────────────────────────────
btnShowQR.addEventListener('click', () => {
  qrModal.classList.add('open');
  document.body.style.overflow = 'hidden';
});

btnCloseQR.addEventListener('click', () => {
  qrModal.classList.remove('open');
  document.body.style.overflow = '';
});

qrModal.addEventListener('click', e => {
  if (e.target === qrModal) {
    qrModal.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Keyboard Navigation ────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (lightbox.classList.contains('open')) {
    if (e.key === 'ArrowLeft') navLightbox(-1);
    if (e.key === 'ArrowRight') navLightbox(1);
    if (e.key === 'Escape') closeLightbox();
  }
  if (qrModal.classList.contains('open') && e.key === 'Escape') {
    qrModal.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── State Helpers ──────────────────────────────────────────────────────────
function showState(state) {
  loadingState.style.display = 'none';
  errorState.style.display = 'none';
  emptyState.style.display = 'none';
  albumGrid.style.display = 'none';
  filterBar.style.display = 'none';

  if (state === 'loading') {
    loadingState.style.display = 'flex';
  } else if (state === 'error') {
    errorState.style.display = 'flex';
  } else if (state === 'empty') {
    emptyState.style.display = 'flex';
  } else if (state === 'grid') {
    albumGrid.style.display = 'grid';
    filterBar.style.display = 'flex';
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  showState('error');
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Start ──────────────────────────────────────────────────────────────────
init();

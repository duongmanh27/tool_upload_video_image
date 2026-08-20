/**
 * uploader.js — Logic chọn file, preview grid, upload lên backend API
 */

'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  files: [],        // [{ id, file, mediaType, previewUrl, selected }]
  isUploading: false,
};

// ── DOM Refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const dropZone      = $('dropZone');
const fileInput     = $('fileInput');
const btnBrowse     = $('btnBrowse');
const mediaGrid     = $('mediaGrid');
const toolbar       = $('toolbar');
const uploadBar     = $('uploadBar');
const emptyState    = $('emptyState');
const btnUpload     = $('btnUpload');
const btnSelectAll  = $('btnSelectAll');
const btnDeselectAll= $('btnDeselectAll');
const btnClearAll   = $('btnClearAll');
const albumNameInput= $('albumNameInput');
const progressWrap  = $('progressWrap');
const progressFill  = $('progressFill');
const progressFile  = $('progressFile');
const progressPct   = $('progressPct');
const uploadBarText = $('uploadBarText');
const uploadBarSub  = $('uploadBarSub');
const selectedCount = $('selectedCount');
const totalCount    = $('totalCount');
const totalSizeEl   = $('totalSize');

// ── File Type Helpers ──────────────────────────────────────────────────────
const IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp','image/gif','image/bmp','image/tiff','image/heic','image/avif']);
const VIDEO_TYPES = new Set(['video/mp4','video/quicktime','video/x-msvideo','video/x-matroska','video/webm','video/x-flv','video/x-ms-wmv','video/3gpp','video/mpeg']);

function getMediaType(file) {
  if (IMAGE_TYPES.has(file.type)) return 'image';
  if (VIDEO_TYPES.has(file.type)) return 'video';
  const ext = file.name.split('.').pop().toLowerCase();
  const videoExts = new Set(['mp4','mov','avi','mkv','webm','flv','wmv','m4v','3gp','mpeg']);
  return videoExts.has(ext) ? 'video' : 'image';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function uniqueId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ── Add Files to State ─────────────────────────────────────────────────────
function addFiles(fileList) {
  const newFiles = Array.from(fileList).filter(f => {
    const mt = getMediaType(f);
    return mt === 'image' || mt === 'video';
  });

  newFiles.forEach(file => {
    const id = uniqueId();
    const mediaType = getMediaType(file);
    const previewUrl = mediaType === 'image' ? URL.createObjectURL(file) : null;

    state.files.push({ id, file, mediaType, previewUrl, selected: true });
    renderCard({ id, file, mediaType, previewUrl, selected: true });
  });

  updateUI();
  if (newFiles.length > 0) showToast(`✅ Đã thêm ${newFiles.length} file`, 'success');
}

// ── Render a Single Card ───────────────────────────────────────────────────
function renderCard({ id, file, mediaType, previewUrl, selected }) {
  const card = document.createElement('div');
  card.className = `media-card${selected ? ' selected' : ''}`;
  card.dataset.id = id;
  card.setAttribute('role', 'listitem');

  const thumbHtml = mediaType === 'image' && previewUrl
    ? `<img class="card-thumb" src="${previewUrl}" alt="${escapeHtml(file.name)}" loading="lazy" />`
    : `<div class="card-thumb-placeholder">${mediaType === 'video' ? '🎬' : '🖼️'}</div>`;

  const playHtml = mediaType === 'video' ? `<div class="card-play">▶️</div>` : '';

  card.innerHTML = `
    <input type="checkbox" class="card-checkbox" id="chk_${id}" ${selected ? 'checked' : ''} aria-label="Chọn ${escapeHtml(file.name)}" />
    <span class="card-type ${mediaType}">${mediaType === 'image' ? 'ẢNH' : 'VIDEO'}</span>
    ${thumbHtml}
    ${playHtml}
    <div class="card-footer">
      <div class="card-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
      <div class="card-size">${formatSize(file.size)}</div>
    </div>
    <button class="card-remove" type="button" data-id="${id}" aria-label="Xóa ${escapeHtml(file.name)}">✕</button>
  `;

  // Checkbox toggle
  const checkbox = card.querySelector('.card-checkbox');
  checkbox.addEventListener('change', () => {
    const item = state.files.find(f => f.id === id);
    if (item) {
      item.selected = checkbox.checked;
      card.classList.toggle('selected', checkbox.checked);
      updateUI();
    }
  });

  // Remove button
  card.querySelector('.card-remove').addEventListener('click', (e) => {
    e.stopPropagation();
    removeFile(id);
  });

  mediaGrid.appendChild(card);
}

// ── Remove File ────────────────────────────────────────────────────────────
function removeFile(id) {
  const idx = state.files.findIndex(f => f.id === id);
  if (idx !== -1) {
    const item = state.files[idx];
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    state.files.splice(idx, 1);
  }
  const card = mediaGrid.querySelector(`[data-id="${id}"]`);
  if (card) {
    card.style.animation = 'none';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.8)';
    card.style.transition = 'all 200ms ease';
    setTimeout(() => card.remove(), 200);
  }
  updateUI();
}

// ── Select / Deselect All ──────────────────────────────────────────────────
function setAllSelected(val) {
  state.files.forEach(item => { item.selected = val; });
  mediaGrid.querySelectorAll('.card-checkbox').forEach(chk => { chk.checked = val; });
  mediaGrid.querySelectorAll('.media-card').forEach(card => { card.classList.toggle('selected', val); });
  updateUI();
}

// ── Clear All ──────────────────────────────────────────────────────────────
function clearAll() {
  state.files.forEach(item => { if (item.previewUrl) URL.revokeObjectURL(item.previewUrl); });
  state.files = [];
  mediaGrid.innerHTML = '';
  updateUI();
}

// ── Update UI Counters & Visibility ───────────────────────────────────────
function updateUI() {
  const total = state.files.length;
  const sel   = state.files.filter(f => f.selected).length;
  const selSize = state.files.filter(f => f.selected).reduce((acc, f) => acc + f.file.size, 0);

  totalCount.textContent    = total;
  selectedCount.textContent = sel;
  totalSizeEl.textContent   = formatSize(selSize);

  // Toolbar & Upload bar
  toolbar.style.display    = total > 0 ? 'flex' : 'none';
  uploadBar.classList.toggle('visible', total > 0);
  emptyState.classList.toggle('visible', total === 0);

  btnUpload.disabled = sel === 0 || state.isUploading;
  uploadBarText.textContent = sel > 0
    ? `${sel} file được chọn`
    : 'Không có file nào được chọn';
  uploadBarSub.textContent = sel > 0
    ? `Tổng: ${formatSize(selSize)}`
    : 'Chọn ít nhất 1 file để upload';
}

// ── Upload ─────────────────────────────────────────────────────────────────
async function doUpload() {
  const selectedItems = state.files.filter(f => f.selected);
  if (selectedItems.length === 0 || state.isUploading) return;

  state.isUploading = true;
  btnUpload.disabled = true;
  btnUpload.classList.add('loading');
  progressWrap.style.display = 'flex';
  setProgress(0, `Chuẩn bị upload ${selectedItems.length} file...`);

  const formData = new FormData();
  const albumName = albumNameInput.value.trim();
  if (albumName) formData.append('albumName', albumName);

  selectedItems.forEach(item => {
    formData.append('files', item.file, item.file.name);
  });

  try {
    // Simulate per-file progress via XHR
    const result = await uploadWithProgress(formData, (pct, loaded, total) => {
      const fileIdx = Math.ceil((pct / 100) * selectedItems.length);
      const currentFile = selectedItems[Math.min(fileIdx, selectedItems.length - 1)];
      setProgress(pct, currentFile ? currentFile.file.name : '');
    });

    if (!result.success) throw new Error(result.error || 'Upload thất bại');

    setProgress(100, 'Hoàn tất!');

    // Show QR result modal
    setTimeout(() => {
      showQRModal(result);
    }, 500);

  } catch (err) {
    showToast(`❌ Lỗi: ${err.message}`, 'error');
    console.error('[Upload]', err);
  } finally {
    state.isUploading = false;
    btnUpload.classList.remove('loading');
    updateUI();
    setTimeout(() => {
      progressWrap.style.display = 'none';
      setProgress(0, '');
    }, 1500);
  }
}

function uploadWithProgress(formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct, e.loaded, e.total);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error('Phản hồi server không hợp lệ'));
        }
      } else {
        let msg = `HTTP ${xhr.status}`;
        try {
          const data = JSON.parse(xhr.responseText);
          msg = data.error || msg;
        } catch {}
        reject(new Error(msg));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Lỗi kết nối mạng')));
    xhr.addEventListener('timeout', () => reject(new Error('Timeout kết nối')));
    xhr.timeout = 300000; // 5 phút

    xhr.send(formData);
  });
}

function setProgress(pct, fileName) {
  progressFill.style.width = `${pct}%`;
  progressFile.textContent = fileName || '';
  progressPct.textContent = `${Math.round(pct)}%`;
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 300ms ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Helper ─────────────────────────────────────────────────────────────────
function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Event Listeners ────────────────────────────────────────────────────────
btnBrowse.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', e => {
  if (e.target === dropZone || e.target.classList.contains('drop-zone-icon') ||
      e.target.classList.contains('drop-zone-title') || e.target.classList.contains('drop-zone-sub') ||
      e.target.classList.contains('drop-zone-formats') || e.target.classList.contains('format-badge')) {
    fileInput.click();
  }
});
dropZone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); });

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) {
    addFiles(fileInput.files);
    fileInput.value = ''; // Reset để chọn lại được
  }
});

// Drag & Drop
dropZone.addEventListener('dragenter', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragover',  e => { e.preventDefault(); });
dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
});

// Drag over whole page
document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => e.preventDefault());

btnSelectAll.addEventListener('click', () => setAllSelected(true));
btnDeselectAll.addEventListener('click', () => setAllSelected(false));
btnClearAll.addEventListener('click', () => {
  if (state.files.length > 0 && confirm(`Xóa tất cả ${state.files.length} file khỏi danh sách?`)) clearAll();
});

btnUpload.addEventListener('click', doUpload);

// Expose for qr-display.js
window.showToast = showToast;

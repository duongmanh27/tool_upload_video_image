/**
 * album-page-generator.js
 * Tạo trang album HTML tĩnh tự chứa (all-in-one: CSS + JS inline)
 * để upload lên R2 và mở bằng URL công khai — KHÔNG CẦN BACKEND!
 *
 * Khi điện thoại quét QR → mở https://pub-xxx.r2.dev/ALBUM_ID/index.html
 * → Trang này tự fetch manifest.json cùng thư mục và render gallery.
 */

const PUBLIC_BASE_URL = 'https://pub-72836303fa9d470b9d3f50d0b0a2ebff.r2.dev';

/**
 * Tạo manifest.json chứa metadata album
 */
function generateManifest(albumId, files) {
  return JSON.stringify({
    albumId,
    createdAt: new Date().toISOString(),
    totalFiles: files.length,
    imagesCount: files.filter(f => f.mediaType === 'image').length,
    videosCount: files.filter(f => f.mediaType === 'video').length,
    files: files.map(f => ({
      fileName: f.fileName,
      originalName: f.originalName || f.fileName,
      url: f.url,
      size: f.size,
      mediaType: f.mediaType,
    })),
  }, null, 2);
}

/**
 * Tạo trang album HTML tĩnh hoàn chỉnh (CSS + JS inline)
 */
function generateAlbumHtml(albumId, files, qrDataUrl) {
  const manifestUrl = `${PUBLIC_BASE_URL}/${albumId}/manifest.json`;
  const filesJson = JSON.stringify(files.map(f => ({
    fileName: f.fileName,
    originalName: f.originalName || f.fileName,
    url: f.url,
    size: f.size,
    sizeStr: formatFileSize(f.size),
    mediaType: f.mediaType,
  })));

  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Album ${escHtml(albumId)}</title>
<meta name="description" content="Xem và tải ảnh/video trong album ${escHtml(albumId)}"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#080c14;--surface:#0e1420;--elevated:#141b2d;--glass:rgba(255,255,255,0.04);--glass-b:rgba(255,255,255,0.09);--accent:#6366f1;--accent2:#8b5cf6;--success:#10b981;--txt:#f1f5f9;--txt2:#94a3b8;--txt3:#475569;--r:12px}
body{font-family:'Plus Jakarta Sans',sans-serif;background:var(--bg);color:var(--txt);min-height:100vh;line-height:1.6}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 80% 60% at 20% 0%,rgba(99,102,241,.1) 0%,transparent 60%),radial-gradient(ellipse 60% 50% at 80% 100%,rgba(139,92,246,.08) 0%,transparent 60%);pointer-events:none;z-index:0}

.header{position:sticky;top:0;z-index:100;background:rgba(8,12,20,.88);backdrop-filter:blur(20px);border-bottom:1px solid var(--glass-b);padding:0 20px;height:60px;display:flex;align-items:center;gap:12px}
.header-title{flex:1;font-size:15px;font-weight:700}
.header-title .chip{font-family:'Courier New',monospace;font-size:12px;background:rgba(99,102,241,.15);color:var(--accent);border:1px solid rgba(99,102,241,.3);border-radius:6px;padding:2px 8px;margin-left:8px}
.header-count{font-size:12px;color:var(--txt3)}
.btn-qr{display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border:none;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer}

.main{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:24px 16px 60px}

.filters{display:flex;gap:8px;margin-bottom:20px;flex-wrap:wrap}
.fbtn{display:flex;align-items:center;gap:5px;background:var(--glass);border:1px solid var(--glass-b);border-radius:999px;padding:6px 14px;font-size:12px;font-weight:500;font-family:inherit;color:var(--txt2);cursor:pointer;transition:.15s}
.fbtn:hover,.fbtn.active{background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.4);color:var(--accent)}
.fbtn .cnt{background:rgba(99,102,241,.2);color:var(--accent);border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px}
.card{border-radius:var(--r);background:var(--glass);border:1px solid var(--glass-b);overflow:hidden;transition:.25s;animation:fadeUp .4s both}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.card:hover{border-color:rgba(99,102,241,.4);box-shadow:0 8px 28px rgba(0,0,0,.3);transform:translateY(-3px)}
.card-wrap{position:relative;overflow:hidden;cursor:pointer}
.card-wrap img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;background:var(--elevated);transition:transform .3s}
.card:hover .card-wrap img{transform:scale(1.04)}
.card-wrap .vid-ph{width:100%;aspect-ratio:1/1;background:var(--elevated);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;font-size:38px}
.card-wrap .play-ov{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
.card-wrap .play-ov span{width:44px;height:44px;background:rgba(99,102,241,.85);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 14px rgba(99,102,241,.5)}
.badge{position:absolute;top:7px;right:7px;padding:2px 7px;border-radius:999px;font-size:10px;font-weight:700;backdrop-filter:blur(6px)}
.badge.image{background:rgba(16,185,129,.25);color:#34d399;border:1px solid rgba(52,211,153,.3)}
.badge.video{background:rgba(99,102,241,.25);color:#a5b4fc;border:1px solid rgba(165,180,252,.3)}
.card-footer{padding:9px 11px}
.card-name{font-size:11px;font-weight:500;color:var(--txt2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.card-size{font-size:10px;color:var(--txt3)}
.card-actions{display:flex;gap:5px;margin-top:7px}
.card-actions button{flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:5px 6px;border-radius:8px;font-size:11px;font-weight:600;font-family:inherit;cursor:pointer;transition:.15s;border:1px solid var(--glass-b)}
.btn-v{background:rgba(99,102,241,.15);color:#a5b4fc;border-color:rgba(99,102,241,.3)}
.btn-v:hover{background:rgba(99,102,241,.3);color:#c7d2fe}
.btn-d{background:rgba(16,185,129,.15);color:#6ee7b7;border-color:rgba(16,185,129,.3)}
.btn-d:hover{background:rgba(16,185,129,.3);color:#a7f3d0}

/* Lightbox */
.lb{position:fixed;inset:0;background:rgba(0,0,0,.92);backdrop-filter:blur(10px);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:.25s}
.lb.open{opacity:1;pointer-events:all}
.lb-inner{position:relative;max-width:92vw;max-height:92vh;display:flex;flex-direction:column;align-items:center;gap:12px}
.lb-inner img{max-width:90vw;max-height:80vh;object-fit:contain;border-radius:var(--r);box-shadow:0 30px 60px rgba(0,0,0,.5)}
.lb-inner video{max-width:90vw;max-height:80vh;border-radius:var(--r);outline:none}
.lb-close{position:fixed;top:16px;right:16px;width:40px;height:40px;background:var(--glass);border:1px solid var(--glass-b);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;color:var(--txt2);backdrop-filter:blur(6px);transition:.15s;z-index:501}
.lb-close:hover{background:rgba(239,68,68,.2);color:#f87171}
.lb-nav{position:fixed;top:50%;transform:translateY(-50%);width:44px;height:44px;background:var(--glass);border:1px solid var(--glass-b);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;color:var(--txt2);backdrop-filter:blur(6px);transition:.15s;z-index:501}
.lb-nav:hover{background:rgba(99,102,241,.2);color:var(--txt)}
.lb-nav.prev{left:12px}
.lb-nav.next{right:12px}
.lb-cap{background:rgba(8,12,20,.8);border:1px solid var(--glass-b);border-radius:var(--r);padding:8px 16px;font-size:12px;color:var(--txt2);display:flex;align-items:center;gap:14px;backdrop-filter:blur(6px)}
.lb-cap .name{color:var(--txt);font-weight:500}
.lb-cap .counter{color:var(--txt3);font-size:11px}
.lb-cap .dl{display:flex;align-items:center;gap:4px;background:var(--glass);border:1px solid var(--glass-b);border-radius:8px;padding:5px 10px;font-size:11px;color:var(--txt2);text-decoration:none;transition:.15s}
.lb-cap .dl:hover{color:var(--accent);border-color:rgba(99,102,241,.4)}

/* QR Modal */
.qm{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);z-index:400;display:flex;align-items:center;justify-content:center;padding:16px;opacity:0;pointer-events:none;transition:.25s}
.qm.open{opacity:1;pointer-events:all}
.qm-box{background:var(--elevated);border:1px solid var(--glass-b);border-radius:20px;padding:30px;max-width:340px;width:100%;text-align:center;box-shadow:0 30px 60px rgba(0,0,0,.5);transform:scale(.92);transition:.25s}
.qm.open .qm-box{transform:scale(1)}
.qm-title{font-size:17px;font-weight:700;margin-bottom:4px}
.qm-sub{font-size:12px;color:var(--txt2);margin-bottom:18px}
.qm-img{background:#fff;border-radius:var(--r);padding:14px;display:inline-block;margin-bottom:16px}
.qm-img img{display:block;width:180px;height:180px}
.qm-id{font-family:'Courier New',monospace;font-size:12px;color:var(--accent);background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.2);border-radius:8px;padding:7px 14px;margin-bottom:16px;word-break:break-all}
.qm-close{background:var(--glass);border:1px solid var(--glass-b);border-radius:var(--r);padding:9px 20px;font-size:13px;font-weight:600;font-family:inherit;color:var(--txt2);cursor:pointer;width:100%;transition:.15s}
.qm-close:hover{background:rgba(255,255,255,.07);color:var(--txt)}

/* States */
.state{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;gap:12px;color:var(--txt3);text-align:center}
.state-icon{font-size:48px}
.state-title{font-size:18px;font-weight:700;color:var(--txt2)}
.spinner{width:40px;height:40px;border:3px solid var(--glass-b);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

@media(max-width:600px){
  .grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}
  .lb-nav{display:none}
  .header{padding:0 12px}
}
::-webkit-scrollbar{width:5px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:rgba(99,102,241,.3);border-radius:999px}
</style>
</head>
<body>

<header class="header">
  <div class="header-title">📁 Album <span class="chip" id="hAlbumId">${escHtml(albumId)}</span></div>
  <button class="btn-qr" id="btnQR">📱 QR</button>
</header>

<main class="main">
  <div class="filters" id="filters"></div>
  <div class="grid" id="grid"></div>
  <div class="state" id="emptyState" style="display:none">
    <div class="state-icon">📭</div>
    <div class="state-title">Album trống</div>
  </div>
</main>

<!-- Lightbox -->
<div class="lb" id="lb">
  <button class="lb-close" id="lbClose">✕</button>
  <button class="lb-nav prev" id="lbPrev">‹</button>
  <button class="lb-nav next" id="lbNext">›</button>
  <div class="lb-inner" id="lbInner"></div>
</div>

<!-- QR Modal -->
<div class="qm" id="qm">
  <div class="qm-box">
    <div class="qm-title">📱 QR Code Album</div>
    <div class="qm-sub">Quét mã để mở album trên điện thoại</div>
    <div class="qm-img"><img id="qmImg" src="${qrDataUrl || ''}" width="180" height="180" alt="QR"/></div>
    <div class="qm-id">${escHtml(albumId)}</div>
    <button class="qm-close" id="qmClose">Đóng</button>
  </div>
</div>

<script>
'use strict';
const FILES=${filesJson};
let filtered=FILES,curIdx=0,curFilter='all';
const $=id=>document.getElementById(id);

// Filters
(function(){
  const f=$('filters');
  const ic=FILES.filter(x=>x.mediaType==='image').length;
  const vc=FILES.filter(x=>x.mediaType==='video').length;
  f.innerHTML=\`
    <button class="fbtn active" data-f="all">🗂️ Tất cả <span class="cnt">\${FILES.length}</span></button>
    <button class="fbtn" data-f="image">🖼️ Ảnh <span class="cnt">\${ic}</span></button>
    <button class="fbtn" data-f="video">🎬 Video <span class="cnt">\${vc}</span></button>
  \`;
  f.addEventListener('click',e=>{
    const btn=e.target.closest('.fbtn');
    if(!btn)return;
    f.querySelectorAll('.fbtn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    render(btn.dataset.f);
  });
})();

function render(filter){
  curFilter=filter;
  filtered=filter==='all'?FILES:FILES.filter(f=>f.mediaType===filter);
  const g=$('grid');g.innerHTML='';
  if(filtered.length===0){$('emptyState').style.display='flex';g.style.display='none';return;}
  $('emptyState').style.display='none';g.style.display='grid';

  filtered.forEach((file,i)=>{
    const c=document.createElement('div');c.className='card';c.style.animationDelay=i*30+'ms';
    const isVid=file.mediaType==='video';
    const thumb=isVid
      ?'<div class="vid-ph">🎬<span style="font-size:12px;color:#94a3b8">'+file.fileName.split('.').pop().toUpperCase()+'</span></div>'
      :'<img src="'+file.url+'" alt="'+esc(file.fileName)+'" loading="lazy"/>';
    const play=isVid?'<div class="play-ov"><span>▶</span></div>':'';
    c.innerHTML='<div class="card-wrap">'+thumb+play+'<span class="badge '+file.mediaType+'">'+(isVid?'VIDEO':'ẢNH')+'</span></div>'
      +'<div class="card-footer"><div class="card-name" title="'+esc(file.fileName)+'">'+esc(file.fileName)+'</div>'
      +'<div class="card-size">'+(file.sizeStr||'')+'</div>'
      +'<div class="card-actions"><button class="btn-v" data-i="'+i+'">👁 Xem</button><button class="btn-d" data-u="'+file.url+'" data-n="'+esc(file.fileName)+'">⬇️ Tải</button></div></div>';
    c.querySelector('.card-wrap').addEventListener('click',()=>openLb(i));
    c.querySelector('.btn-v').addEventListener('click',e=>{e.stopPropagation();openLb(i);});
    c.querySelector('.btn-d').addEventListener('click',e=>{e.stopPropagation();dlFile(file.url,file.fileName);});
    g.appendChild(c);
  });
}

// Lightbox
function openLb(i){curIdx=i;renderLb();$('lb').classList.add('open');document.body.style.overflow='hidden';}
function closeLb(){$('lb').classList.remove('open');document.body.style.overflow='';const v=$('lbInner').querySelector('video');if(v)v.pause();}
function renderLb(){
  const f=filtered[curIdx];if(!f)return;
  const v=$('lbInner').querySelector('video');if(v)v.pause();
  const inner=$('lbInner');inner.innerHTML='';
  if(f.mediaType==='image'){const img=document.createElement('img');img.src=f.url;img.alt=f.fileName;inner.appendChild(img);}
  else{const vid=document.createElement('video');vid.src=f.url;vid.controls=true;vid.autoplay=true;inner.appendChild(vid);}
  const cap=document.createElement('div');cap.className='lb-cap';
  cap.innerHTML='<span class="name">'+esc(f.fileName)+'</span><span class="counter">'+(curIdx+1)+'/'+filtered.length+'</span><a class="dl" href="'+f.url+'" download="'+f.fileName+'" target="_blank">⬇️ Tải</a>';
  inner.appendChild(cap);
  $('lbPrev').style.opacity=curIdx>0?'1':'.3';
  $('lbNext').style.opacity=curIdx<filtered.length-1?'1':'.3';
}
function nav(d){const n=curIdx+d;if(n<0||n>=filtered.length)return;curIdx=n;renderLb();}
$('lbClose').addEventListener('click',closeLb);
$('lbPrev').addEventListener('click',()=>nav(-1));
$('lbNext').addEventListener('click',()=>nav(1));
$('lb').addEventListener('click',e=>{if(e.target===$('lb'))closeLb();});

// Download
function dlFile(url,name){
  fetch(url,{mode:'cors'}).then(r=>{if(!r.ok)throw 0;return r.blob();}).then(b=>{
    const u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(u),1e3);
  }).catch(()=>window.open(url,'_blank'));
}

// QR Modal
$('btnQR').addEventListener('click',()=>{$('qm').classList.add('open');document.body.style.overflow='hidden';});
$('qmClose').addEventListener('click',()=>{$('qm').classList.remove('open');document.body.style.overflow='';});
$('qm').addEventListener('click',e=>{if(e.target===$('qm')){$('qm').classList.remove('open');document.body.style.overflow='';}});

// Keyboard
document.addEventListener('keydown',e=>{
  if($('lb').classList.contains('open')){if(e.key==='ArrowLeft')nav(-1);if(e.key==='ArrowRight')nav(1);if(e.key==='Escape')closeLb();}
  if($('qm').classList.contains('open')&&e.key==='Escape'){$('qm').classList.remove('open');document.body.style.overflow='';}
});

function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

render('all');
</script>
</body>
</html>`;
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { generateManifest, generateAlbumHtml };

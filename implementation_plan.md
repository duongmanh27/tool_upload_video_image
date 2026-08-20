# Kế hoạch Triển khai Web App Upload Ảnh/Video lên Cloudflare R2

## Mô tả Tổng quan

Chuyển đổi công cụ quản lý & upload media từ ứng dụng Desktop (Python PyQt) thành **Web Application** hiện đại, sẵn sàng cho việc POC (Proof of Concept) và demo cho khách hàng.

- **Frontend**: HTML5, Vanilla CSS (Dark Glassmorphism Design System), Vanilla JS (không dùng framework để tối ưu tốc độ và đơn giản khi POC).
- **Backend**: Node.js với Express framework.
- **Lưu trữ Object Storage**: Cloudflare R2 (S3-Compatible API với `@aws-sdk/client-s3` & `@aws-sdk/lib-storage`).
- **Tính năng nổi bật**: Kéo thả media, xem preview ô vuông, upload theo tiến trình real-time, tự động tạo mã Album và hình ảnh mã QR code để quét/chia sẻ album tức thì.

---

## Cấu trúc Thư mục Dự án (Project Architecture)

```
tool_upload_video_image/
├── .env                           ← Keys R2 (giữ nguyên)
│
├── web/
│   ├── frontend/                  ← Giao diện web
│   │   ├── index.html             ← Trang upload
│   │   ├── album.html             ← Trang xem album
│   │   ├── css/
│   │   │   ├── main.css           ← Dark glassmorphism design
│   │   │   └── album.css          ← Album viewer styles
│   │   └── js/
│   │       ├── uploader.js        ← Drag-drop, grid, XHR upload
│   │       ├── qr-display.js      ← Popup QR sau upload
│   │       └── album-viewer.js    ← Lightbox, filter, QR modal
│   │
│   └── backend/
│       ├── server.js              ← Express server (port 3000)
│       ├── package.json
│       └── src/
│           ├── routes/
│           │   ├── upload.js      ← POST /api/upload
│           │   └── album.js       ← GET /api/album/:id
│           ├── services/
│           │   ├── r2-storage.js  ← Cloudflare R2 AWS SDK v3
│           │   └── qr-service.js  ← Sinh QR code
│           └── utils/
│               └── file-utils.js  ← Validate file type/size
│
└── python/                        ← Code Python cũ (giữ nguyên)
    ├── main.py
    ├── model_main.py
    ├── processor.py
    ├── ui.py
    └── requirements.txt
```

---

## Chi tiết Triển khai

### 1. Backend Service (`web/backend/`)
- **`server.js`**: Khởi tạo Express app, cấu hình Middleware (CORS, JSON, URL-encoded), phục vụ các file tĩnh ở `web/frontend/` và tích hợp các API routes.
- **`src/services/r2-storage.js`**: 
  - Khởi tạo S3 Client kết nối đến Cloudflare R2 Endpoint (`my-storge-tool`).
  - Hỗ trợ Upload file dung lượng lớn bằng Multipart Upload.
  - Hàm `listAlbumFiles(albumId)` để truy vấn danh sách file trong album.
- **`src/services/qr-service.js`**: Tạo hình ảnh QR Code dạng Data URL (base64) để nhúng trực tiếp vào giao diện HTML.
- **`src/routes/upload.js`**: Endpoint `POST /api/upload` tiếp nhận file multipart/form-data từ client, xử lý upload lên R2 và trả về thông tin Album + QR Code.
- **`src/routes/album.js`**: Endpoint `GET /api/album/:id` trả về thông tin và danh sách tệp của album để giao diện viewer hiển thị.
- **`src/utils/file-utils.js`**: Kiểm tra định dạng (Ảnh: JPG, PNG, WEBP, GIF... | Video: MP4, MOV, MKV, WEBM...) và giới hạn dung lượng file.

### 2. Frontend Interface (`web/frontend/`)
- **`index.html` & `main.css` & `uploader.js`**:
  - Giao diện Dark Glassmorphism cao cấp, hiệu ứng chuyển động mượt mà.
  - Vùng Kéo & Thả (Drag & Drop) thông minh.
  - Grid card hiển thị preview ô vuông cho ảnh và video kèm badge phân loại.
  - Nút Chọn tất cả / Bỏ chọn / Xóa tất cả và ô nhập Tên Album tùy chỉnh.
  - Sticky Upload Bar ở dưới màn hình kèm thanh tiến trình upload (Progress Bar).
- **`qr-display.js`**: Pop-up Dialog hiển thị thành công kèm Mã Album, nút Copy nhanh và hình ảnh Mã QR chất lượng cao.
- **`album.html` & `album.css` & `album-viewer.js`**:
  - Trang hiển thị Album media theo đường dẫn `/album.html?id=ALBUM_ID`.
  - Bộ lọc media: Tất cả, Chỉ Ảnh, Chỉ Video.
  - Trình xem ảnh/video phóng to (Lightbox) hỗ trợ phím điều hướng (Trái/Phải/ESC) và tải file.

### 3. Lưu trữ Python Cũ (`python/`)
- Tách biệt toàn bộ mã nguồn Python desktop cũ (`processor.py`, `ui.py`, `model_main.py`, `main.py`) vào thư mục `python/` để phục vụ tham khảo hoặc sử dụng khi cần.

---

## Hướng dẫn Vận hành

### Khởi động Web App
```bash
cd web/backend
npm install
npm start
```
Truy cập trình duyệt tại địa chỉ: `http://localhost:3000`

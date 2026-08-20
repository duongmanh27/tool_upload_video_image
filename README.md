# Tool Upload Ảnh & Video lên Cloudflare R2 (Web Application)

Ứng dụng Web giúp chọn/kéo thả nhiều file Ảnh và Video từ máy local, tự động tải lên server lưu trữ **Cloudflare R2 Object Storage**, tạo mã Album tra cứu và sinh mã QR Code để quét/xem album ngay trên điện thoại hoặc trình duyệt.

---

## 📁 Cấu trúc Thư mục (Directory Structure)

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
    ├── processor.py, ui.py, ...
```

---

## ⚡ Tính năng Chính

### 1. Trang Upload (`index.html`)
- 📥 **Vùng Kéo & Thả (Drag & Drop)**: Hỗ trợ chọn nhanh tệp hoặc thư mục ảnh/video.
- 🖼️ **Preview Ô vuông (Grid View)**: Hiển thị thumbnail xem trước cho ảnh và icon định dạng cho video.
- 🎯 **Quản lý danh sách file**: Checkbox chọn/bỏ chọn từng file, nút *Chọn tất cả*, *Bỏ chọn*, *Xóa tất cả*.
- 🏷️ **Tên Album tùy biến**: Tự động sinh mã album ngẫu nhiên hoặc cho phép người dùng nhập tên tùy chỉnh.
- 📊 **Thanh Tiến trình (Progress Bar)**: Hiển thị phần trăm và tên file đang tải lên theo thời gian thực.
- 📱 **Mã QR & Link chia sẻ**: Tự động sinh mã QR Code và đường dẫn xem Album sau khi tải lên thành công.

### 2. Trang Xem Album (`album.html`)
- 🔍 **Tra cứu Album**: Mở album thông qua URL query `?id=MÃ_ALBUM`.
- 🗂️ **Bộ lọc Media**: Phân loại theo *Tất cả*, *Chỉ Ảnh*, *Chỉ Video*.
- 🔍 **Trình xem phóng to (Lightbox)**: Hỗ trợ xem ảnh sắc nét, phát video inline, điều hướng phím mũi tên `←` `→` và phím `ESC`.
- ⬇️ **Tải xuống**: Nút tải file trực tiếp từ Cloudflare R2.
- 📲 **Hiển thị lại QR Code**: Nút bật popup QR Code mọi lúc để chia sẻ cho người khác.

---

## 🛠️ Công nghệ Sử dụng

- **Frontend**: HTML5, Vanilla CSS (Dark Glassmorphism UI), Vanilla JavaScript (ES6+).
- **Backend**: Node.js, Express.js.
- **Object Storage**: Cloudflare R2 (`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`).
- **Mã QR**: Thư viện `qrcode` sinh ảnh QR base64.

---

## 🚀 Hướng dẫn Cài đặt & Khởi chạy

### Bước 1: Kiểm tra file cấu hình `.env`
Đảm bảo file `.env` ở thư mục gốc chứa thông tin Cloudflare R2:
```env
Access_Key_ID = <YOUR_ACCESS_KEY>
Secret_Access_Key = <YOUR_SECRET_KEY>
Endpoint_URL = https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

### Bước 2: Cài đặt và Chạy Server
```bash
# Di chuyển vào thư mục backend
cd web/backend

# Cài đặt các gói phụ thuộc
npm install

# Khởi chạy server
npm start
```

### Bước 3: Truy cập Ứng dụng
- Trang Upload chính: [http://localhost:3000](http://localhost:3000)
- Trang Xem Album: [http://localhost:3000/album.html?id=TÊN_ALBUM](http://localhost:3000/album.html?id=TÊN_ALBUM)

---

## 🌐 Danh sách REST API

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/upload` | Tải danh sách file media lên Cloudflare R2 & trả về mã QR, Album ID |
| `GET` | `/api/album/:albumId` | Lấy danh sách tệp thuộc album từ Cloudflare R2 |
| `GET` | `/api/health` | Kiểm tra trạng thái hoạt động của Server & kết nối R2 |

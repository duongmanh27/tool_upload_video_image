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

---

## [Phase 2] Nâng cấp Giao diện & Upload Chia nhỏ (Chunked Upload)

### 1. Cập nhật Giao diện (Beautification)
- Sửa lại các text kỹ thuật như "Cloudflare R2 Storage" thành tên thương hiệu chuyên nghiệp hơn (ví dụ: "Pro Media Vault" hoặc "Secure Cloud Storage") trong `index.html` và `qr-display.js`.

### 2. Kiến trúc Chunked Upload (Direct to R2)
Hiện tại, Frontend gửi toàn bộ file tới Backend (Express) để xử lý. Điều này gây tốn RAM cho server Render và dễ đứt gãy nếu mạng yếu.
Giải pháp: Sử dụng **AWS S3 Multipart Upload** kết hợp **Presigned URLs**.

#### Luồng hoạt động mới:
1. **Khởi tạo Upload (Backend)**: 
   Frontend gửi danh sách file. Backend gọi R2 tạo một `UploadId` cho mỗi file (qua `CreateMultipartUploadCommand`).
2. **Lấy URL cho từng phần (Backend)**: 
   Frontend chia file thành các cục nhỏ (ví dụ 5MB/chunk). Với mỗi cục, Frontend gọi Backend xin một đường link an toàn (Presigned URL) thông qua `UploadPartCommand`.
3. **Upload Trực tiếp (Frontend -> R2)**: 
   Frontend gửi trực tiếp cục dữ liệu 5MB lên R2 qua link vừa lấy. Nếu mạng đứt, chỉ cần upload lại đúng cục 5MB đó! Bỏ qua hoàn toàn gánh nặng cho server Render.
4. **Hoàn tất Upload (Backend)**: 
   Khi tất cả các cục đã lên R2, Frontend gửi danh sách mã xác nhận (ETag) cho Backend để ghép lại thành file hoàn chỉnh (`CompleteMultipartUploadCommand`).

#### Các file cần sửa:
- **[MODIFY]** `web/backend/src/routes/upload.js`: Chuyển từ việc nhận file qua `multer` sang cung cấp API `/init`, `/presign`, `/complete`.
- **[MODIFY]** `web/backend/src/services/r2-storage.js`: Thêm các hàm `initMultipartUpload`, `getPresignedUrlForPart`, `completeMultipartUpload`.
- **[MODIFY]** `web/frontend/js/uploader.js`: Viết lại logic vòng lặp chia nhỏ file bằng `File.slice()` và gửi trực tiếp lên presigned URL.

> [!IMPORTANT]
> **User Review Required:** Việc thay đổi sang kiến trúc upload trực tiếp này rất tối ưu và chống đứt mạng cực tốt, nhưng sẽ làm thay đổi toàn bộ luồng hoạt động cũ. Bạn có đồng ý triển khai tính năng Chunked Upload này theo cách chuyên nghiệp nhất (Bypass server) không? Trang Album và chia sẻ QR vẫn hoạt động hoàn toàn bình thường.

---

## [Phase 3] Tối ưu Phát Video Lớn trên iPhone (iOS Safari)

### Vấn đề
Video dưới 2 phút xem được trên iPhone, nhưng video trên 5 phút không phát được (chỉ tải xuống được) hoặc tải rất lâu, dẫn đến lỗi timeout. 

### Nguyên nhân
1. iOS Safari bắt buộc sử dụng **HTTP Range Requests** (`bytes=0-1`) để stream video. Do thiếu expose headers CORS, iOS Safari không đọc được dung lượng file và không thể seek, dẫn đến từ chối phát video lớn.
2. Thiếu các attributes bắt buộc trên thẻ `<video>` (`playsinline`, `crossorigin`, `preload="auto"`) và việc sử dụng thuộc tính `src` trực tiếp thay vì thẻ `<source>` không tối ưu cho iOS.
3. Timeout của lệnh ffmpeg khi dùng để fix `moov atom` (chuyển meta data của video lên đầu file) quá ngắn (120 giây) đối với video dung lượng lớn (>100MB).

### Giải pháp & Các file đã sửa

- **[MODIFY]** `web/backend/setup-cors.js`: Thêm `Content-Range`, `Accept-Ranges`, `Content-Length`, `Content-Type` vào thuộc tính `ExposeHeaders` cho R2 Bucket để hỗ trợ HTTP Range Requests.
- **[MODIFY]** `web/backend/src/services/album-page-generator.js`: Thay đổi thẻ `<video>` trong trang HTML tĩnh được lưu trên R2, thêm `playsinline`, `x5-playsinline`, `crossorigin="anonymous"`, `preload="auto"` và chuyển sang sử dụng thẻ `<source>`.
- **[MODIFY]** `web/frontend/js/album-viewer.js`: Sửa đổi tương tự cho trình xem video cục bộ (lightbox), bổ sung các thuộc tính iOS cần thiết và thẻ `<source>`.
- **[MODIFY]** `web/backend/src/services/r2-storage.js`: Tăng `timeout` cho quá trình chạy ffmpeg từ 120s lên 600s (10 phút) để đảm bảo các file video lớn được xử lý `faststart` (moov atom) thành công.
- **[MODIFY]** `.env`: Chuẩn hóa lại định dạng file biến môi trường (xóa các khoảng trắng quanh dấu `=`) để thư viện `dotenv` có thể đọc thông tin xác thực một cách chính xác.

> [!NOTE]
> Các cấu hình CORS đã được áp dụng global lên toàn bộ R2 bucket. Tuy nhiên, đối với tính năng xem video qua QR trên các **Album đã upload trước đó**, bạn cần upload lại các file này vì trang `index.html` tĩnh của chúng trên R2 đang mang thẻ `<video>` cũ. Mọi album mới từ nay sẽ hoạt động mượt mà trên iOS.

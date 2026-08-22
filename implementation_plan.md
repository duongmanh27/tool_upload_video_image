# Implementation Plan: Media Upload Tool (POC)

Ứng dụng **Media Upload Tool** đã được nâng cấp qua nhiều giai đoạn để đảm bảo khả năng mở rộng, tiết kiệm băng thông và tương thích tối đa với các thiết bị di động (đặc biệt là iOS). Dưới đây là kế hoạch kiến trúc và tính năng hiện tại.

## 1. Kiến trúc hệ thống (Direct-to-R2 & Background Processing)

Hệ thống sử dụng mô hình **Presigned URL & Multipart Upload** kết hợp với **Cloudflare R2** làm kho lưu trữ chính.

*   **Frontend (Browser):**
    *   Tải trực tiếp ảnh/video từ trình duyệt lên Cloudflare R2 thông qua các Presigned URLs do Backend cấp.
    *   Hỗ trợ **Multipart Upload** (chia nhỏ file) cho các video nặng > 5MB.
    *   Giảm tải 100% băng thông upload cho server backend.
*   **Backend (Node.js/Express):**
    *   Đóng vai trò điều phối, sinh Presigned URLs.
    *   Chạy tiến trình nền (FFmpeg) để tối ưu video sau khi upload.
    *   Sinh trang Album tĩnh (HTML) và mã QR, sau đó đẩy lên Cloudflare R2.
*   **Cloudflare R2:**
    *   Lưu trữ toàn bộ media (ảnh/video).
    *   Host trang Album tĩnh (`index.html`) để người dùng xem trực tiếp bằng mã QR cực nhanh mà không cần đi qua Backend.
    *   Băng thông tải về (Egress) **hoàn toàn miễn phí**.

## 2. Quy trình Upload & Xử lý (Cập nhật mới nhất)

Để đảm bảo người dùng luôn quét mã QR và xem được video ngay lập tức mà không bị lỗi đệm (cache), quy trình được thiết kế lại theo hướng **Đồng bộ (Synchronous processing)**:

1.  **Frontend gửi yêu cầu tải lên:** Server cấp quyền upload lên R2.
2.  **Frontend đẩy file lên R2:** Trình duyệt bơm data thẳng lên bucket.
3.  **Hoàn tất Upload (Complete):**
    *   Frontend gọi API `/api/upload/complete`.
    *   **Thanh tiến trình kẹt ở 99%**, giao diện báo *"Đang xử lý Video..."*.
4.  **Xử lý FFmpeg (Trên Server):**
    *   Backend tải file video thô từ R2 về.
    *   Dùng \`ffmpeg\` nén lại sang chuẩn **H.264 (Constrained Baseline)** để tương thích 100% với iOS Safari.
    *   Gắn cờ \`moov atom\` lên đầu file (FastStart) giúp phát video ngay không cần tải hết.
    *   Convert âm thanh sang chuẩn AAC (tránh lỗi câm tiếng).
    *   Ghi đè bản H.264 chuẩn mực lên lại Cloudflare R2.
5.  **Sinh Album & Mã QR:** 
    *   Backend sinh file \`index.html\` tĩnh và \`manifest.json\` đẩy lên R2.
    *   Trả kết quả về cho Frontend để hiển thị 100% và bật Modal chứa mã QR.

## 3. Các tính năng Giao diện (UI/UX)

*   **Trang chủ (Upload):** Kéo thả nhiều file, tự động đếm file, sinh ID Album, hiển thị trạng thái xử lý 99% rõ ràng.
*   **Tìm kiếm Album:**
    *   Thanh tìm kiếm trên Header cho phép nhập mã Album (VD: \`ALBUM_...\`).
    *   Nếu tồn tại, điều hướng sang trang Quản lý Album cục bộ.
*   **Trang Quản lý Album (Viewer):**
    *   Liệt kê toàn bộ file ảnh/video trong một album.
    *   Cho phép Xem trước (Lightbox) và Tải xuống từng file.
    *   Cung cấp nút bấm "QR Code" để lấy link truy cập siêu tốc thông qua Cloudflare R2 cho toàn bộ Album.
*   **Fix lỗi iOS Safari:**
    *   Sử dụng gán trực tiếp \`video.src\` thay vì thẻ \`<source>\`.
    *   Loại bỏ các cờ \`crossorigin="anonymous"\` gây xung đột cơ chế byte-range caching của Apple.

## 4. Kiểm thử

*   **Samsung / Android / PC:** Test khả năng xem và tải mọi định dạng (MP4, WebM, AV1).
*   **iPhone / iPad (iOS Safari):** Test quét mã QR để xem ngay lập tức các video nặng tải từ YouTube (AV1) sau khi đã được FFmpeg convert ngầm.

## 5. Hướng phát triển tiếp theo (Tuỳ chọn)
*   Thêm mật khẩu bảo vệ (Password-protected Albums).
*   Tự động xóa Album sau 24h hoặc 7 ngày (Lifecycle Rules trên R2).
*   Giới hạn dung lượng tối đa cho mỗi Album.

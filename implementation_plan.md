# Kế hoạch Triển khai Tool Quản lý & Upload Ảnh/Video Local lên Server

Cập nhật kiến trúc phân tách rõ ràng với tầng điều phối `model_main.py`:
- **File 1 (`processor.py`)**: Xử lý logic nghiệp vụ (quét file ảnh/video, tạo thumbnail, mở Picasa viewer, upload server, sinh mã QR & album).
- **File 2 (`ui.py`)**: Các thành phần giao diện (Grid Card ô vuông, Gallery Scroll, Checkbox, Dialog QR & Album, Thanh trạng thái).
- **File 3 (`model_main.py`)**: Class ứng dụng tổng (`MediaUploadApp` / `AppController`) nạp và kết nối tất cả các class/model từ `processor.py` và `ui.py`, quản lý trạng thái, điều phối dữ liệu giữa UI và Processor.
- **File 4 (`main.py`)**: Điểm chạy chính siêu gọn, chỉ khởi tạo class tổng từ `model_main.py` và thực thi `app.run()`.

---

## User Review Required

> [!NOTE]
> - Cấu trúc 4 file theo chuẩn tách lớp (Separation of Concerns / MVC):
>   - `processor.py` = Model & Services
>   - `ui.py` = View Components
>   - `model_main.py` = Controller / Master Application Class
>   - `main.py` = Launcher Script
> - Giữ nguyên đầy đủ các tính năng: Grid ô vuông có nút chọn, nút xem bằng Picasa, nút upload server, popup mã QR + Tên Album tra cứu.

---

## Proposed Architecture & File Structure

```
upload_video_tooler/
├── processor.py       # [NEW] File 1: Xử lý logic, quét folder, thumbnail, Picasa, upload, QR
├── ui.py              # [NEW] File 2: Thành phần UI (MediaCardWidget, MainWindowUI, QRResultDialog, SettingsDialog)
├── model_main.py      # [NEW] File 3: Class tổng hợp kết nối Processor & UI (MediaUploadApp)
├── main.py            # [MODIFY] File 4: File chạy chính, chỉ gọi class tổng rồi chạy
└── requirements.txt   # [NEW] Danh sách thư viện phụ thuộc
```

---

## Proposed Changes

### File 1: `processor.py` (Xử lý yêu cầu)
- **`MediaScanner`**: Quét folder, phân loại danh sách đường dẫn ảnh và video, kiểm tra định dạng và dung lượng.
- **`ThumbnailGenerator`**: Tạo thumbnail tối ưu với cache cho ảnh (Pillow) và video (OpenCV lấy frame đầu).
- **`ViewerManager`**: Kích hoạt mở file bằng Picasa Photo Viewer (`PicasaPhotoViewer.exe` hoặc tuỳ biến path, fallback default system viewer).
- **`UploaderService`**: Xử lý tải ảnh/video đã chọn lên server với tiến trình theo thời gian thực (hỗ trợ cả real server API lẫn mock server tiện test offline).
- **`QRAlbumGenerator`**: Sinh mã album và tạo hình ảnh mã QR (dùng `qrcode` + PIL).

---

### File 2: `ui.py` (UI cơ bản & nâng cao)
- **`MediaCardWidget`**: Widget từng ô vuông (ảnh thumbnail tỉ lệ vuông, badge phân loại ẢNH/VIDEO, tên file, checkbox chọn, nút "👁 Xem ảnh" qua Picasa).
- **`MainWindowUI`**: Khung cửa sổ chính (thanh chọn thư mục, bộ lọc, thanh công cụ Chọn tất cả/Bỏ chọn, khu vực Grid cuộn mượt mà, thanh tiến trình & nút Upload nổi bật).
- **`QRResultDialog`**: Hộp thoại hiển thị sau khi upload thành công với Tên Album (mã tra cứu) + Hình ảnh Mã QR lớn, rõ nét để quét trực tiếp + nút copy link/mở web.
- **`SettingsDialog`**: Cửa sổ cấu hình Server URL và đường dẫn Picasa Viewer.

---

### File 3: `model_main.py` (Class tổng hợp điều phối)
- Import tất cả các class liên quan từ `processor.py` và `ui.py`.
- **`MediaUploadApp`**: Class tổng quản lý toàn bộ vòng đời ứng dụng:
  - Khởi tạo `QApplication` và nạp theme/style.
  - Khởi tạo các services từ `processor.py` (`MediaScanner`, `ThumbnailGenerator`, `UploaderService`, `ViewerManager`, `QRAlbumGenerator`).
  - Khởi tạo cửa sổ giao diện từ `ui.py`.
  - Kết nối toàn bộ signals & slots: khi user chọn thư mục -> quét file -> tải thumbnail -> chọn/bỏ chọn file -> bấm xem ảnh Picasa -> bấm upload -> hiển thị QR popup.
  - Cung cấp hàm `run()` đơn giản để `main.py` chỉ cần gọi và chạy.

---

### File 4: `main.py` (Main Launcher)
- File launcher tối giản:
```python
import sys
from model_main import MediaUploadApp

def main():
    app = MediaUploadApp()
    sys.exit(app.run())

if __name__ == "__main__":
    main()
```

---

## Verification Plan

### Automated & Unit Verification
1. Kiểm tra tính hợp lệ cú pháp Python của cả 4 file:
   ```bash
   /home/manh/miniconda3/envs/py311/bin/python -m py_compile processor.py ui.py model_main.py main.py
   ```
2. Kiểm tra khởi tạo class tổng trong môi trường headless/unit test:
   ```bash
   /home/manh/miniconda3/envs/py311/bin/python -c "from model_main import MediaUploadApp; print('Master App Class imported successfully')"
   ```

### Manual / Visual Verification
1. Chạy thử nghiệm công cụ trên thư mục mẫu chứa cả ảnh và video:
   - Hiển thị danh sách ô vuông kèm thumbnail.
   - Thử nghiệm chức năng chọn ảnh, xem ảnh qua Picasa.
   - Thử nghiệm Upload và kiểm tra hiển thị Mã QR + Tên Album.

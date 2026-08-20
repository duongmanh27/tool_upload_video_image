"""
processor.py - File 1: Xử lý nghiệp vụ & Dịch vụ (Model & Services)
Bao gồm:
- MediaItem: Mô hình dữ liệu cho ảnh & video
- MediaScanner: Quét thư mục, phân loại ảnh và video
- ThumbnailGenerator: Tạo thumbnail tối ưu (PIL cho ảnh, OpenCV cho video) có caching
- ViewerManager: Mở ảnh/video bằng tool Picasa hoặc trình xem mặc định
- UploaderService: Tải ảnh & video đã chọn lên server với tiến trình
- QRAlbumGenerator: Sinh mã Album và tạo mã QR (qrcode + PIL)
"""

import os
import sys
import time
import uuid
import hashlib
import tempfile
import subprocess
from pathlib import Path
from dataclasses import dataclass
from typing import List, Tuple, Optional, Callable, Dict, Any

from PIL import Image, ImageOps
import cv2
import qrcode
import requests


@dataclass
class MediaItem:
    """Đại diện cho 1 tệp tin ảnh hoặc video."""
    file_path: str
    file_name: str
    media_type: str  # 'image' hoặc 'video'
    file_size_bytes: int
    file_size_str: str
    thumbnail_path: Optional[str] = None
    is_selected: bool = True  # Mặc định được chọn


class MediaScanner:
    """Quét thư mục và phân loại các tệp ảnh và video."""
    
    IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tiff', '.heic'}
    VIDEO_EXTENSIONS = {'.mp4', '.mov', '.avi', '.mkv', '.wmv', '.flv', '.webm', '.m4v', '.3gp'}

    @staticmethod
    def format_file_size(size_in_bytes: int) -> str:
        """Chuyển đổi số byte thành chuỗi dung lượng dễ đọc."""
        if size_in_bytes < 1024:
            return f"{size_in_bytes} B"
        elif size_in_bytes < 1024 * 1024:
            return f"{size_in_bytes / 1024:.1f} KB"
        elif size_in_bytes < 1024 * 1024 * 1024:
            return f"{size_in_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_in_bytes / (1024 * 1024 * 1024):.2f} GB"

    @classmethod
    def scan_folder(cls, folder_path: str) -> Tuple[List[MediaItem], List[MediaItem]]:
        """
        Quét thư mục và trả về (danh_sách_ảnh, danh_sách_video).
        """
        images: List[MediaItem] = []
        videos: List[MediaItem] = []

        if not os.path.isdir(folder_path):
            return images, videos

        try:
            # Sắp xếp theo tên tự nhiên
            entries = sorted(os.listdir(folder_path), key=lambda s: s.lower())
            for entry in entries:
                full_path = os.path.join(folder_path, entry)
                if not os.path.isfile(full_path):
                    continue

                ext = os.path.splitext(entry)[1].lower()
                size_bytes = os.path.getsize(full_path)
                size_str = cls.format_file_size(size_bytes)

                if ext in cls.IMAGE_EXTENSIONS:
                    item = MediaItem(
                        file_path=full_path,
                        file_name=entry,
                        media_type='image',
                        file_size_bytes=size_bytes,
                        file_size_str=size_str
                    )
                    images.append(item)
                elif ext in cls.VIDEO_EXTENSIONS:
                    item = MediaItem(
                        file_path=full_path,
                        file_name=entry,
                        media_type='video',
                        file_size_bytes=size_bytes,
                        file_size_str=size_str
                    )
                    videos.append(item)
        except Exception as e:
            print(f"[MediaScanner] Lỗi quét thư mục: {e}")

        return images, videos


class ThumbnailGenerator:
    """Tạo ảnh thumbnail tỉ lệ vuông cho ảnh & video có cơ chế caching tốc độ cao."""

    def __init__(self, cache_dir: Optional[str] = None):
        if cache_dir:
            self.cache_dir = cache_dir
        else:
            self.cache_dir = os.path.join(tempfile.gettempdir(), "upload_tool_thumbnails")
        os.makedirs(self.cache_dir, exist_ok=True)

    def _get_cache_key(self, file_path: str) -> str:
        """Tạo key hash theo đường dẫn và thời gian sửa đổi file."""
        try:
            mtime = os.path.getmtime(file_path)
        except Exception:
            mtime = 0
        raw_key = f"{file_path}_{mtime}"
        return hashlib.md5(raw_key.encode('utf-8')).hexdigest()

    def generate_thumbnail(self, item: MediaItem, thumb_size: Tuple[int, int] = (200, 200)) -> str:
        """
        Tạo thumbnail cho MediaItem và trả về đường dẫn file ảnh thumbnail.
        """
        cache_key = self._get_cache_key(item.file_path)
        thumb_path = os.path.join(self.cache_dir, f"{cache_key}.jpg")

        if os.path.exists(thumb_path) and os.path.getsize(thumb_path) > 0:
            item.thumbnail_path = thumb_path
            return thumb_path

        try:
            if item.media_type == 'image':
                self._generate_image_thumbnail(item.file_path, thumb_path, thumb_size)
            else:
                self._generate_video_thumbnail(item.file_path, thumb_path, thumb_size)
            
            item.thumbnail_path = thumb_path
            return thumb_path
        except Exception as e:
            print(f"[ThumbnailGenerator] Không tạo được thumbnail cho {item.file_name}: {e}")
            # Fallback tạo ảnh thumbnail trống
            self._generate_placeholder(thumb_path, item.media_type, thumb_size)
            item.thumbnail_path = thumb_path
            return thumb_path

    def _generate_image_thumbnail(self, image_path: str, output_path: str, thumb_size: Tuple[int, int]):
        """Dùng Pillow tạo thumbnail cho ảnh."""
        with Image.open(image_path) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert('RGB')
            # Fit vào hình vuông tâm (center crop & resize)
            img = ImageOps.fit(img, thumb_size, Image.Resampling.LANCZOS)
            img.save(output_path, "JPEG", quality=85)

    def _generate_video_thumbnail(self, video_path: str, output_path: str, thumb_size: Tuple[int, int]):
        """Dùng OpenCV trích xuất frame đầu tiên của video."""
        cap = cv2.VideoCapture(video_path)
        success, frame = cap.read()
        cap.release()

        if success and frame is not None:
            # Chuyển từ BGR sang RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = Image.fromarray(rgb_frame)
            img = ImageOps.fit(img, thumb_size, Image.Resampling.LANCZOS)
            img.save(output_path, "JPEG", quality=85)
        else:
            self._generate_placeholder(output_path, 'video', thumb_size)

    def _generate_placeholder(self, output_path: str, media_type: str, thumb_size: Tuple[int, int]):
        """Tạo ảnh placeholder khi không đọc được file."""
        color = (50, 50, 60) if media_type == 'video' else (60, 50, 50)
        img = Image.new('RGB', thumb_size, color=color)
        img.save(output_path, "JPEG", quality=80)


class ViewerManager:
    """Quản lý việc mở ảnh/video bằng tool Picasa hoặc trình xem mặc định."""

    DEFAULT_PICASA_PATHS_WIN = [
        r"C:\Program Files (x86)\Google\Picasa3\PicasaPhotoViewer.exe",
        r"C:\Program Files\Google\Picasa3\PicasaPhotoViewer.exe",
        r"C:\Users\{username}\AppData\Local\Google\Picasa3\PicasaPhotoViewer.exe",
    ]

    @classmethod
    def find_picasa_executable(cls, custom_path: Optional[str] = None) -> Optional[str]:
        """Tìm file thực thi Picasa trên hệ thống."""
        if custom_path and os.path.isfile(custom_path):
            return custom_path

        if sys.platform.startswith('win'):
            for p in cls.DEFAULT_PICASA_PATHS_WIN:
                p_formatted = os.path.expandvars(p)
                if os.path.isfile(p_formatted):
                    return p_formatted
        return None

    @classmethod
    def open_media(cls, file_path: str, picasa_path: Optional[str] = None) -> bool:
        """
        Mở file ảnh/video. Ưu tiên Picasa Photo Viewer nếu có, nếu không mở bằng app mặc định của hệ thống.
        """
        if not os.path.exists(file_path):
            print(f"[ViewerManager] File không tồn tại: {file_path}")
            return False

        picasa_exe = cls.find_picasa_executable(picasa_path)

        try:
            if picasa_exe and os.path.isfile(picasa_exe):
                subprocess.Popen([picasa_exe, file_path])
                return True
            else:
                # Fallback sang app mặc định của hệ điều hành
                if sys.platform.startswith('win'):
                    os.startfile(file_path)
                elif sys.platform.startswith('darwin'):
                    subprocess.Popen(['open', file_path])
                else:
                    # Linux
                    subprocess.Popen(['xdg-open', file_path])
                return True
        except Exception as e:
            print(f"[ViewerManager] Lỗi khi mở media {file_path}: {e}")
            return False


class QRAlbumGenerator:
    """Tạo mã Album định danh và hình ảnh mã QR Code."""

    @staticmethod
    def generate_album_id(prefix: str = "ALBUM") -> str:
        """Sinh tên / mã album duy nhất: ALBUM_YYYYMMDD_XXXX."""
        timestamp = time.strftime("%Y%m%d_%H%M")
        short_id = uuid.uuid4().hex[:4].upper()
        return f"{prefix}_{timestamp}_{short_id}"

    @staticmethod
    def generate_qr_image(data_text: str, output_path: Optional[str] = None) -> str:
        """
        Tạo ảnh QR Code từ chuỗi dữ liệu (URL hoặc mã Album), trả về đường dẫn file ảnh QR.
        """
        if not output_path:
            qr_dir = os.path.join(tempfile.gettempdir(), "upload_tool_qr")
            os.makedirs(qr_dir, exist_ok=True)
            output_path = os.path.join(qr_dir, f"qr_{uuid.uuid4().hex[:8]}.png")

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=3,
        )
        qr.add_data(data_text)
        qr.make(fit=True)

        qr_img = qr.make_image(fill_color="#1E293B", back_color="white")
        qr_img.save(output_path)
        return output_path


class UploaderService:
    """Xử lý tải lên server với theo dõi tiến trình và hỗ trợ chế độ Demo/Mock."""

    def __init__(self, server_url: str = "", web_view_base_url: str = ""):
        self.server_url = server_url.strip()
        self.web_view_base_url = web_view_base_url.strip() or "https://photos.cloudviewer.app/album/"

    def upload_files(
        self,
        items: List[MediaItem],
        album_name: Optional[str] = None,
        progress_callback: Optional[Callable[[int, int, str, float], None]] = None,
        is_cancelled_callback: Optional[Callable[[], bool]] = None
    ) -> Dict[str, Any]:
        """
        Upload danh sách MediaItem.
        Gọi progress_callback(current_idx, total_count, current_file_name, percent).
        """
        if not items:
            return {"success": False, "error": "Không có tệp tin nào được chọn"}

        total_files = len(items)
        if not album_name:
            album_name = QRAlbumGenerator.generate_album_id()

        # Kiểm tra xem có cấu hình server thật không
        if self.server_url and self.server_url.startswith("http"):
            return self._upload_to_real_server(
                items, album_name, progress_callback, is_cancelled_callback
            )
        else:
            return self._upload_mock_simulation(
                items, album_name, progress_callback, is_cancelled_callback
            )

    def _upload_mock_simulation(
        self,
        items: List[MediaItem],
        album_name: str,
        progress_callback: Optional[Callable[[int, int, str, float], None]],
        is_cancelled_callback: Optional[Callable[[], bool]]
    ) -> Dict[str, Any]:
        """Mô phỏng quá trình upload mượt mà (dùng khi chạy test/offline)."""
        total = len(items)
        for idx, item in enumerate(items, start=1):
            if is_cancelled_callback and is_cancelled_callback():
                return {"success": False, "error": "Quá trình tải lên đã bị hủy"}

            # Giả lập thời gian truyền file nhỏ
            time.sleep(0.08)
            percent = (idx / total) * 100.0

            if progress_callback:
                progress_callback(idx, total, item.file_name, percent)

        web_url = f"{self.web_view_base_url.rstrip('/')}/{album_name}"
        qr_path = QRAlbumGenerator.generate_qr_image(web_url)

        return {
            "success": True,
            "album_name": album_name,
            "web_url": web_url,
            "qr_image_path": qr_path,
            "total_uploaded": total,
            "images_count": sum(1 for i in items if i.media_type == 'image'),
            "videos_count": sum(1 for i in items if i.media_type == 'video'),
            "message": "Đã tải lên thành công toàn bộ ảnh và video!"
        }

    def _upload_to_real_server(
        self,
        items: List[MediaItem],
        album_name: str,
        progress_callback: Optional[Callable[[int, int, str, float], None]],
        is_cancelled_callback: Optional[Callable[[], bool]]
    ) -> Dict[str, Any]:
        """Tải lên server thật qua HTTP POST Multipart."""
        total = len(items)
        uploaded_files = []

        try:
            for idx, item in enumerate(items, start=1):
                if is_cancelled_callback and is_cancelled_callback():
                    return {"success": False, "error": "Quá trình tải lên đã bị hủy"}

                if progress_callback:
                    percent = ((idx - 1) / total) * 100.0
                    progress_callback(idx, total, f"Đang gửi: {item.file_name}", percent)

                with open(item.file_path, 'rb') as f:
                    files = {'file': (item.file_name, f)}
                    data = {'album_name': album_name, 'media_type': item.media_type}
                    response = requests.post(self.server_url, files=files, data=data, timeout=60)
                    response.raise_for_status()

                uploaded_files.append(item.file_name)
                if progress_callback:
                    percent = (idx / total) * 100.0
                    progress_callback(idx, total, f"Đã gửi: {item.file_name}", percent)

            web_url = f"{self.web_view_base_url.rstrip('/')}/{album_name}"
            qr_path = QRAlbumGenerator.generate_qr_image(web_url)

            return {
                "success": True,
                "album_name": album_name,
                "web_url": web_url,
                "qr_image_path": qr_path,
                "total_uploaded": len(uploaded_files),
                "images_count": sum(1 for i in items if i.media_type == 'image'),
                "videos_count": sum(1 for i in items if i.media_type == 'video'),
                "message": "Đã tải lên server thành công!"
            }
        except Exception as e:
            return {"success": False, "error": f"Lỗi tải lên server: {str(e)}"}

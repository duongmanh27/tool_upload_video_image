"""
model_main.py - File 3: File Tổng Hợp & Điều Phối Ứng Dụng (App Controller)
Bao gồm:
- Import tất cả các class từ processor.py và ui.py
- Background Threads cho Thumbnail Loading và Upload Server
- Class tổng `MediaUploadApp`: Quản lý toàn bộ dữ liệu, sự kiện và giao diện
"""

import os
import sys
import json
from typing import List, Optional
from PyQt6.QtWidgets import QApplication, QFileDialog, QMessageBox
from PyQt6.QtCore import QObject, QThread, pyqtSignal, Qt

# 1. Import tất cả các class từ processor.py (Model & Business Services)
from processor import (
    MediaItem,
    MediaScanner,
    ThumbnailGenerator,
    ViewerManager,
    QRAlbumGenerator,
    UploaderService
)

# 2. Import tất cả các class từ ui.py (View & UI Widgets)
from ui import (
    MediaCardWidget,
    MainWindowUI,
    QRResultDialog,
    SettingsDialog
)


CONFIG_FILE = "config.json"


class ThumbnailWorker(QThread):
    """Luồng nền tạo thumbnail ảnh/video để không làm đơ giao diện."""
    thumbnail_ready = pyqtSignal(object, str)  # (MediaItem, thumb_path)
    finished_all = pyqtSignal()

    def __init__(self, items: List[MediaItem], generator: ThumbnailGenerator):
        super().__init__()
        self.items = items
        self.generator = generator
        self._is_running = True

    def run(self):
        for item in self.items:
            if not self._is_running:
                break
            thumb_path = self.generator.generate_thumbnail(item)
            self.thumbnail_ready.emit(item, thumb_path)
        self.finished_all.emit()

    def stop(self):
        self._is_running = False


class UploadWorker(QThread):
    """Luồng nền thực hiện upload server với báo cáo tiến trình thời gian thực."""
    progress = pyqtSignal(int, int, str, float)  # (current, total, file_name, percent)
    upload_finished = pyqtSignal(dict)           # result_data

    def __init__(self, uploader: UploaderService, items: List[MediaItem]):
        super().__init__()
        self.uploader = uploader
        self.items = items
        self._is_cancelled = False

    def run(self):
        def progress_cb(cur, tot, fname, pct):
            self.progress.emit(cur, tot, fname, pct)

        def is_cancelled_cb():
            return self._is_cancelled

        result = self.uploader.upload_files(
            items=self.items,
            progress_callback=progress_cb,
            is_cancelled_callback=is_cancelled_cb
        )
        self.upload_finished.emit(result)

    def cancel(self):
        self._is_cancelled = True


class MediaUploadApp(QObject):
    """
    Class Tổng Hợp (Master Controller):
    - Khởi tạo toàn bộ các module và dịch vụ
    - Quản lý trạng thái và dữ liệu ứng dụng
    - Điều phối các sự kiện giữa Giao diện (UI) và Xử lý nghiệp vụ (Processor)
    """

    def __init__(self, argv: Optional[List[str]] = None):
        super().__init__()
        self.argv = argv or sys.argv
        self.app = QApplication(self.argv)
        self.app.setApplicationName("Fast Media Uploader")

        # Nạp cấu hình
        self.config = self._load_config()

        # Khởi tạo các Service xử lý nghiệp vụ từ processor.py
        self.scanner = MediaScanner()
        self.thumbnail_gen = ThumbnailGenerator()
        self.viewer_manager = ViewerManager()
        self.qr_gen = QRAlbumGenerator()
        self.uploader = UploaderService(
            server_url=self.config.get("server_url", ""),
            web_view_base_url=self.config.get("web_view_base_url", "https://photos.cloudviewer.app/album/")
        )

        # Trạng thái dữ liệu
        self.current_folder: str = ""
        self.images: List[MediaItem] = []
        self.videos: List[MediaItem] = []
        self.all_items: List[MediaItem] = []
        self.card_widgets: List[MediaCardWidget] = []

        # Các worker luồng nền
        self.thumb_worker: Optional[ThumbnailWorker] = None
        self.upload_worker: Optional[UploadWorker] = None

        # Khởi tạo Giao diện chính từ ui.py
        self.main_window = MainWindowUI()
        self._connect_signals()

        # Nạp lại thư mục gần nhất nếu có
        last_folder = self.config.get("last_folder", "")
        if last_folder and os.path.isdir(last_folder):
            self._load_folder(last_folder)

    def _load_config(self) -> dict:
        """Đọc file cấu hình config.json."""
        default_config = {
            "server_url": "",
            "web_view_base_url": "https://photos.cloudviewer.app/album/",
            "picasa_path": "",
            "last_folder": ""
        }
        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    default_config.update(data)
            except Exception as e:
                print(f"[Config] Lỗi đọc cấu hình: {e}")
        return default_config

    def _save_config(self):
        """Lưu file cấu hình config.json."""
        try:
            with open(CONFIG_FILE, "w", encoding="utf-8") as f:
                json.dump(self.config, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Config] Lỗi lưu cấu hình: {e}")

    def _connect_signals(self):
        """Kết nối toàn bộ sự kiện giữa UI và Controller."""
        ui = self.main_window

        # Nút chọn thư mục & quét lại
        ui.btn_select_folder.clicked.connect(self._on_choose_folder)
        ui.btn_reload.clicked.connect(self._on_reload)

        # Nút cài đặt
        ui.btn_settings.clicked.connect(self._on_open_settings)

        # Chọn tất cả / Bỏ chọn / Lọc
        ui.btn_select_all.clicked.connect(self._on_select_all)
        ui.btn_deselect_all.clicked.connect(self._on_deselect_all)
        ui.combo_filter.currentIndexChanged.connect(self._on_filter_changed)

        # Nút Upload Server
        ui.btn_upload.clicked.connect(self._on_start_upload)

    def _on_choose_folder(self):
        """Mở hộp thoại chọn thư mục ảnh & video."""
        initial_dir = self.config.get("last_folder", "") or os.path.expanduser("~")
        folder = QFileDialog.getExistingDirectory(
            self.main_window, "Chọn Thư Mục Chứa Ảnh & Video", initial_dir
        )
        if folder:
            self.config["last_folder"] = folder
            self._save_config()
            self._load_folder(folder)

    def _on_reload(self):
        """Quét lại thư mục hiện tại."""
        if self.current_folder and os.path.isdir(self.current_folder):
            self._load_folder(self.current_folder)

    def _load_folder(self, folder_path: str):
        """Quét thư mục, tạo thẻ ô vuông và khởi động luồng tạo thumbnail."""
        self.current_folder = folder_path
        self.main_window.folder_path_edit.setText(folder_path)

        # Dừng luồng thumbnail cũ nếu đang chạy
        if self.thumb_worker and self.thumb_worker.isRunning():
            self.thumb_worker.stop()
            self.thumb_worker.wait()

        # Quét phân loại ảnh và video
        self.main_window.status_label.setText("Đang quét thư mục...")
        self.images, self.videos = self.scanner.scan_folder(folder_path)
        self.all_items = self.images + self.videos

        # Xóa các card cũ trong Grid
        self._clear_grid()

        if not self.all_items:
            self.main_window.empty_label.setText("Không tìm thấy tệp ảnh hoặc video nào trong thư mục này.")
            self.main_window.empty_label.setVisible(True)
            self.main_window.status_label.setText("Thư mục trống.")
            self._update_counter_and_upload_btn()
            return

        self.main_window.empty_label.setVisible(False)

        # Tạo Card Widgets cho từng ô vuông
        for item in self.all_items:
            card = MediaCardWidget(item)
            card.selection_changed.connect(self._on_card_selection_changed)
            card.view_requested.connect(self._on_card_view_requested)
            self.card_widgets.append(card)

        # Sắp xếp vào Grid
        self._relayout_grid()
        self._update_counter_and_upload_btn()

        # Khởi chạy luồng sinh thumbnail nền
        self.main_window.progress_bar.setVisible(True)
        self.main_window.progress_bar.setMaximum(len(self.all_items))
        self.main_window.progress_bar.setValue(0)
        self.main_window.status_label.setText(f"Đang tải {len(self.all_items)} tệp...")

        self.thumb_worker = ThumbnailWorker(self.all_items, self.thumbnail_gen)
        self.thumb_worker.thumbnail_ready.connect(self._on_single_thumbnail_ready)
        self.thumb_worker.finished_all.connect(self._on_thumbnails_finished)
        self.thumb_worker.start()

    def _clear_grid(self):
        """Xóa sạch các ô vuông trong Grid."""
        for card in self.card_widgets:
            card.deleteLater()
        self.card_widgets.clear()

    def _relayout_grid(self):
        """Sắp xếp các card ô vuông vào Grid đa cột."""
        filter_mode = self.main_window.combo_filter.currentIndex()
        visible_cards = []

        for card in self.card_widgets:
            if filter_mode == 1 and card.item.media_type != 'image':
                card.setVisible(False)
            elif filter_mode == 2 and card.item.media_type != 'video':
                card.setVisible(False)
            else:
                card.setVisible(True)
                visible_cards.append(card)

        # Tính số cột dựa vào chiều rộng vùng xem (mỗi card 185px + gap 12px = ~200px)
        width = max(self.main_window.scroll_area.viewport().width(), 600)
        cols = max(3, width // 205)

        for idx, card in enumerate(visible_cards):
            row = idx // cols
            col = idx % cols
            self.main_window.grid_layout.addWidget(card, row, col)

    def _on_filter_changed(self):
        self._relayout_grid()
        self._update_counter_and_upload_btn()

    def _on_single_thumbnail_ready(self, item: MediaItem, thumb_path: str):
        """Cập nhật ảnh thumbnail cho từng card khi render xong."""
        for card in self.card_widgets:
            if card.item == item:
                card.load_thumbnail()
                break
        val = self.main_window.progress_bar.value() + 1
        self.main_window.progress_bar.setValue(val)

    def _on_thumbnails_finished(self):
        """Hoàn thành tạo thumbnail."""
        self.main_window.progress_bar.setVisible(False)
        self.main_window.status_label.setText(
            f"Đã nạp sẵn sàng: {len(self.images)} ảnh, {len(self.videos)} video."
        )

    def _on_card_selection_changed(self, item: MediaItem, is_selected: bool):
        """Khi 1 card được click chọn hoặc bỏ chọn."""
        self._update_counter_and_upload_btn()

    def _on_card_view_requested(self, item: MediaItem):
        """Mở ảnh bằng Picasa Viewer (hoặc default viewer)."""
        picasa_path = self.config.get("picasa_path", "")
        self.main_window.status_label.setText(f"Đang mở: {item.file_name}...")
        success = self.viewer_manager.open_media(item.file_path, picasa_path)
        if not success:
            QMessageBox.warning(
                self.main_window, "Thông báo",
                f"Không thể mở file:\n{item.file_path}"
            )

    def _on_select_all(self):
        """Chọn tất cả các tệp đang hiển thị."""
        filter_mode = self.main_window.combo_filter.currentIndex()
        for card in self.card_widgets:
            if filter_mode == 1 and card.item.media_type != 'image':
                continue
            if filter_mode == 2 and card.item.media_type != 'video':
                continue
            card.set_selected(True)
        self._update_counter_and_upload_btn()

    def _on_deselect_all(self):
        """Bỏ chọn tất cả các tệp đang hiển thị."""
        filter_mode = self.main_window.combo_filter.currentIndex()
        for card in self.card_widgets:
            if filter_mode == 1 and card.item.media_type != 'image':
                continue
            if filter_mode == 2 and card.item.media_type != 'video':
                continue
            card.set_selected(False)
        self._update_counter_and_upload_btn()

    def _update_counter_and_upload_btn(self):
        """Cập nhật nhãn thống kê và trạng thái nút Upload."""
        selected_items = [c.item for c in self.card_widgets if c.item.is_selected]
        sel_images = sum(1 for i in selected_items if i.media_type == 'image')
        sel_videos = sum(1 for i in selected_items if i.media_type == 'video')
        total_selected = len(selected_items)
        total_items = len(self.all_items)

        self.main_window.counter_label.setText(
            f"Đã chọn: {total_selected} / {total_items} mục ({sel_images} ảnh, {sel_videos} video)"
        )

        if total_selected > 0:
            self.main_window.btn_upload.setEnabled(True)
            self.main_window.btn_upload.setText(f"🚀 TẢI LÊN SERVER ({total_selected} MỤC)")
        else:
            self.main_window.btn_upload.setEnabled(False)
            self.main_window.btn_upload.setText("🚀 TẢI LÊN SERVER (CHƯA CHỌN)")

    def _on_open_settings(self):
        """Mở hộp thoại cài đặt."""
        dialog = SettingsDialog(self.config, self.main_window)
        if dialog.exec():
            self.config = dialog.get_config()
            self._save_config()
            # Cập nhật lại cấu hình cho Uploader
            self.uploader.server_url = self.config.get("server_url", "")
            self.uploader.web_view_base_url = self.config.get("web_view_base_url", "https://photos.cloudviewer.app/album/")
            QMessageBox.information(self.main_window, "Cài đặt", "Đã lưu cài đặt thành công!")

    def _on_start_upload(self):
        """Bắt đầu quá trình tải lên server."""
        selected_items = [c.item for c in self.card_widgets if c.item.is_selected]
        if not selected_items:
            QMessageBox.warning(self.main_window, "Chưa chọn file", "Vui lòng chọn ít nhất 1 ảnh hoặc video để tải lên!")
            return

        # Khóa nút bấm trong khi upload
        self.main_window.btn_upload.setEnabled(False)
        self.main_window.btn_select_folder.setEnabled(False)
        self.main_window.progress_bar.setVisible(True)
        self.main_window.progress_bar.setMaximum(100)
        self.main_window.progress_bar.setValue(0)
        self.main_window.status_label.setText("Đang chuẩn bị tải lên server...")

        self.upload_worker = UploadWorker(self.uploader, selected_items)
        self.upload_worker.progress.connect(self._on_upload_progress)
        self.upload_worker.upload_finished.connect(self._on_upload_finished)
        self.upload_worker.start()

    def _on_upload_progress(self, current: int, total: int, file_name: str, percent: float):
        """Cập nhật tiến trình upload."""
        self.main_window.progress_bar.setValue(int(percent))
        self.main_window.status_label.setText(f"Đang tải lên [{current}/{total}]: {file_name} ({percent:.1f}%)")

    def _on_upload_finished(self, result: dict):
        """Xử lý kết quả sau khi upload hoàn tất và mở Dialog Mã QR."""
        self.main_window.btn_upload.setEnabled(True)
        self.main_window.btn_select_folder.setEnabled(True)
        self.main_window.progress_bar.setVisible(False)

        if result.get("success"):
            self.main_window.status_label.setText(f"🎉 Tải lên thành công Album: {result.get('album_name')}")
            # Hiển thị Popup mã QR + Tên Album
            dialog = QRResultDialog(result, self.main_window)
            dialog.exec()
        else:
            self.main_window.status_label.setText(f"❌ Upload thất bại: {result.get('error')}")
            QMessageBox.critical(
                self.main_window, "Lỗi Tải Lên",
                f"Không thể tải lên server:\n{result.get('error')}"
            )

    def run(self) -> int:
        """Hiển thị cửa sổ chính và khởi chạy vòng lặp ứng dụng."""
        self.main_window.show()
        return self.app.exec()

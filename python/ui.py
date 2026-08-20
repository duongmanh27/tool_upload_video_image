"""
ui.py - File 2: Thành phần Giao diện Đồ họa (UI Widgets & Windows)
Bao gồm:
- MediaCardWidget: Ô vuông hiển thị thumbnail, badge ảnh/video, checkbox chọn, nút xem ảnh qua Picasa
- MainWindowUI: Cửa sổ chính với Toolbar, bộ lọc, vùng cuộn Grid ô vuông, thanh tiến trình, nút Upload
- QRResultDialog: Hộp thoại popup hiển thị Tên Album và Mã QR kích thước lớn để quét sau khi upload
- SettingsDialog: Cửa sổ cài đặt cấu hình Server URL và đường dẫn Picasa
"""

import os
from typing import Optional, List
from PyQt6.QtWidgets import (
    QWidget, QMainWindow, QDialog, QVBoxLayout, QHBoxLayout,
    QGridLayout, QScrollArea, QLabel, QPushButton, QCheckBox,
    QLineEdit, QProgressBar, QComboBox, QFileDialog, QMessageBox,
    QFrame, QSizePolicy, QApplication
)
from PyQt6.QtCore import Qt, pyqtSignal, QSize
from PyQt6.QtGui import QPixmap, QIcon, QFont, QColor, QDesktopServices, QCursor
from PyQt6.QtCore import QUrl

from processor import MediaItem


# Bảng màu giao diện hiện đại (Modern Dark Theme)
STYLESHEET = """
QMainWindow, QDialog {
    background-color: #0F172A;
    color: #F8FAFC;
    font-family: 'Segoe UI', 'SF Pro Display', Roboto, Helvetica, sans-serif;
}

QFrame#topBar, QFrame#filterBar, QFrame#bottomBar {
    background-color: #1E293B;
    border-radius: 10px;
    padding: 6px;
}

QLabel {
    color: #F1F5F9;
    font-size: 13px;
}

QLabel#appTitle {
    font-size: 18px;
    font-weight: bold;
    color: #38BDF8;
}

QLabel#counterLabel {
    font-size: 14px;
    font-weight: 600;
    color: #38BDF8;
}

QLineEdit {
    background-color: #0F172A;
    color: #F8FAFC;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
}

QLineEdit:focus {
    border: 1px solid #38BDF8;
}

QPushButton {
    background-color: #334155;
    color: #F8FAFC;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
}

QPushButton:hover {
    background-color: #475569;
}

QPushButton:pressed {
    background-color: #1E293B;
}

QPushButton#btnPrimary {
    background-color: #0284C7;
    color: #FFFFFF;
    font-size: 14px;
    font-weight: bold;
    padding: 10px 24px;
    border-radius: 8px;
}

QPushButton#btnPrimary:hover {
    background-color: #0369A1;
}

QPushButton#btnPrimary:disabled {
    background-color: #334155;
    color: #64748B;
}

QPushButton#btnSuccess {
    background-color: #10B981;
    color: #FFFFFF;
    font-weight: bold;
}

QPushButton#btnSuccess:hover {
    background-color: #059669;
}

QComboBox {
    background-color: #0F172A;
    color: #F8FAFC;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 13px;
}

QComboBox::drop-down {
    border: none;
}

QScrollBar:vertical {
    border: none;
    background: #0F172A;
    width: 10px;
    margin: 0px;
}

QScrollBar::handle:vertical {
    background: #334155;
    min-height: 20px;
    border-radius: 5px;
}

QScrollBar::handle:vertical:hover {
    background: #475569;
}

QScrollBar::add-line:vertical, QScrollBar::sub-line:vertical {
    height: 0px;
}

QProgressBar {
    background-color: #0F172A;
    border: 1px solid #334155;
    border-radius: 6px;
    text-align: center;
    color: #F8FAFC;
    font-weight: bold;
    font-size: 11px;
}

QProgressBar::chunk {
    background-color: #0284C7;
    border-radius: 5px;
}
"""


class MediaCardWidget(QFrame):
    """Widget hiển thị từng ô vuông ảnh hoặc video (Grid Card)."""

    selection_changed = pyqtSignal(object, bool)  # (MediaItem, is_selected)
    view_requested = pyqtSignal(object)           # (MediaItem)

    def __init__(self, item: MediaItem, parent=None):
        super().__init__(parent)
        self.item = item
        self.setFixedSize(185, 235)
        self.setCursor(QCursor(Qt.CursorShape.PointingHandCursor))
        self._init_ui()
        self.update_selection_style()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(6, 6, 6, 6)
        layout.setSpacing(4)

        # 1. Khung Thumbnail + Badge Overlay
        self.thumb_container = QWidget(self)
        self.thumb_container.setFixedSize(173, 135)
        thumb_layout = QVBoxLayout(self.thumb_container)
        thumb_layout.setContentsMargins(0, 0, 0, 0)

        self.thumb_label = QLabel(self.thumb_container)
        self.thumb_label.setFixedSize(173, 135)
        self.thumb_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.thumb_label.setStyleSheet("background-color: #1E293B; border-radius: 6px;")
        thumb_layout.addWidget(self.thumb_label)

        # Header overlay: Checkbox + Badge loại tệp
        overlay_layout = QHBoxLayout(self.thumb_label)
        overlay_layout.setContentsMargins(6, 6, 6, 6)

        self.checkbox = QCheckBox(self.thumb_label)
        self.checkbox.setChecked(self.item.is_selected)
        self.checkbox.setStyleSheet("""
            QCheckBox::indicator {
                width: 20px;
                height: 20px;
                border-radius: 4px;
                border: 2px solid #FFFFFF;
                background-color: rgba(15, 23, 42, 0.7);
            }
            QCheckBox::indicator:checked {
                background-color: #0284C7;
                border-color: #38BDF8;
            }
        """)
        self.checkbox.stateChanged.connect(self._on_checkbox_changed)
        overlay_layout.addWidget(self.checkbox, alignment=Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)

        overlay_layout.addStretch()

        # Badge Loại tệp
        self.badge_label = QLabel(self.thumb_label)
        if self.item.media_type == 'image':
            self.badge_label.setText("📷 ẢNH")
            self.badge_label.setStyleSheet("background-color: rgba(2, 132, 199, 0.85); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;")
        else:
            self.badge_label.setText("🎥 VIDEO")
            self.badge_label.setStyleSheet("background-color: rgba(168, 85, 247, 0.85); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold;")
        overlay_layout.addWidget(self.badge_label, alignment=Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignRight)

        layout.addWidget(self.thumb_container)

        # 2. Tên file & Dung lượng
        self.name_label = QLabel(self.item.file_name, self)
        self.name_label.setWordWrap(False)
        self.name_label.setStyleSheet("color: #F1F5F9; font-size: 12px; font-weight: 500;")
        self.name_label.setToolTip(f"{self.item.file_name}\nĐường dẫn: {self.item.file_path}\nDung lượng: {self.item.file_size_str}")
        
        # Cắt ngắn nếu tên quá dài
        metrics = self.name_label.fontMetrics()
        elided = metrics.elidedText(self.item.file_name, Qt.TextElideMode.ElideMiddle, 165)
        self.name_label.setText(elided)
        layout.addWidget(self.name_label)

        self.size_label = QLabel(self.item.file_size_str, self)
        self.size_label.setStyleSheet("color: #94A3B8; font-size: 11px;")
        layout.addWidget(self.size_label)

        # 3. Nút "Xem ảnh" / "Xem video" qua Picasa
        btn_text = "👁 Xem ảnh (Picasa)" if self.item.media_type == 'image' else "▶ Xem video"
        self.btn_view = QPushButton(btn_text, self)
        self.btn_view.setFixedHeight(26)
        self.btn_view.setStyleSheet("""
            QPushButton {
                background-color: #334155;
                color: #38BDF8;
                font-size: 11px;
                font-weight: 600;
                border-radius: 4px;
                padding: 2px 8px;
            }
            QPushButton:hover {
                background-color: #0284C7;
                color: #FFFFFF;
            }
        """)
        self.btn_view.clicked.connect(self._on_view_clicked)
        layout.addWidget(self.btn_view)

        self.load_thumbnail()

    def load_thumbnail(self):
        """Tải hình thumbnail lên label."""
        if self.item.thumbnail_path and os.path.exists(self.item.thumbnail_path):
            pixmap = QPixmap(self.item.thumbnail_path)
            scaled = pixmap.scaled(173, 135, Qt.AspectRatioMode.KeepAspectRatioByExpanding, Qt.TransformationMode.SmoothTransformation)
            self.thumb_label.setPixmap(scaled)
        else:
            self.thumb_label.setText("📷 Đang tải...")

    def update_selection_style(self):
        """Đổi viền khi được chọn hoặc bỏ chọn."""
        if self.item.is_selected:
            self.setStyleSheet("""
                MediaCardWidget {
                    background-color: #1E293B;
                    border: 2px solid #0284C7;
                    border-radius: 8px;
                }
            """)
        else:
            self.setStyleSheet("""
                MediaCardWidget {
                    background-color: #162032;
                    border: 1px solid #334155;
                    border-radius: 8px;
                }
            """)

    def set_selected(self, selected: bool):
        """Đặt trạng thái chọn từ bên ngoài."""
        self.item.is_selected = selected
        self.checkbox.blockSignals(True)
        self.checkbox.setChecked(selected)
        self.checkbox.blockSignals(False)
        self.update_selection_style()

    def mousePressEvent(self, event):
        """Click vào card để toggle chọn."""
        if event.button() == Qt.MouseButton.LeftButton:
            new_state = not self.item.is_selected
            self.set_selected(new_state)
            self.selection_changed.emit(self.item, new_state)
        super().mousePressEvent(event)

    def _on_checkbox_changed(self, state):
        is_checked = (state == Qt.CheckState.Checked.value or state == 2)
        self.item.is_selected = is_checked
        self.update_selection_style()
        self.selection_changed.emit(self.item, is_checked)

    def _on_view_clicked(self):
        self.view_requested.emit(self.item)


class QRResultDialog(QDialog):
    """Hộp thoại popup kết quả upload: Hiển thị Tên Album + Mã QR lớn."""

    def __init__(self, result_data: dict, parent=None):
        super().__init__(parent)
        self.result_data = result_data
        self.setWindowTitle("🎉 Tải lên Server Thành Công")
        self.setFixedSize(480, 580)
        self.setStyleSheet(STYLESHEET)
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(24, 20, 24, 20)
        layout.setSpacing(14)

        # Tiêu đề
        title = QLabel("🎉 TẢI LÊN SERVER HOÀN TẤT!", self)
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet("font-size: 18px; font-weight: bold; color: #10B981;")
        layout.addWidget(title)

        subtitle = QLabel(
            f"Đã tải lên {self.result_data.get('total_uploaded', 0)} mục "
            f"({self.result_data.get('images_count', 0)} ảnh, {self.result_data.get('videos_count', 0)} video)",
            self
        )
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        subtitle.setStyleSheet("color: #94A3B8; font-size: 13px;")
        layout.addWidget(subtitle)

        # Khung chứa Mã QR
        qr_frame = QFrame(self)
        qr_frame.setStyleSheet("background-color: #FFFFFF; border-radius: 12px; padding: 12px;")
        qr_layout = QVBoxLayout(qr_frame)
        qr_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        self.qr_label = QLabel(qr_frame)
        self.qr_label.setFixedSize(220, 220)
        self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

        qr_path = self.result_data.get("qr_image_path", "")
        if qr_path and os.path.exists(qr_path):
            pix = QPixmap(qr_path).scaled(220, 220, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
            self.qr_label.setPixmap(pix)
        qr_layout.addWidget(self.qr_label)

        qr_tip = QLabel("📱 Quét mã QR bằng camera điện thoại để xem trực tiếp", qr_frame)
        qr_tip.setAlignment(Qt.AlignmentFlag.AlignCenter)
        qr_tip.setStyleSheet("color: #475569; font-size: 11px; font-weight: bold;")
        qr_layout.addWidget(qr_tip)

        layout.addWidget(qr_frame, alignment=Qt.AlignmentFlag.AlignCenter)

        # Khung Tên Album & Mã tra cứu
        album_box = QFrame(self)
        album_box.setStyleSheet("background-color: #1E293B; border-radius: 8px; padding: 8px;")
        ab_layout = QVBoxLayout(album_box)
        ab_layout.setSpacing(6)

        ab_title = QLabel("🏷️ TÊN ALBUM / MÃ TRA CỨU TRÊN WEB:", album_box)
        ab_title.setStyleSheet("font-size: 11px; color: #94A3B8; font-weight: bold;")
        ab_layout.addWidget(ab_title)

        album_row = QHBoxLayout()
        self.album_name_edit = QLineEdit(self.result_data.get("album_name", ""), album_box)
        self.album_name_edit.setReadOnly(True)
        self.album_name_edit.setStyleSheet("font-size: 14px; font-weight: bold; color: #38BDF8;")
        album_row.addWidget(self.album_name_edit)

        btn_copy_album = QPushButton("📋 Sao chép", album_box)
        btn_copy_album.clicked.connect(self._copy_album_name)
        album_row.addWidget(btn_copy_album)
        ab_layout.addLayout(album_row)

        layout.addWidget(album_box)

        # Khung Web Link
        link_row = QHBoxLayout()
        self.link_edit = QLineEdit(self.result_data.get("web_url", ""), self)
        self.link_edit.setReadOnly(True)
        link_row.addWidget(self.link_edit)

        btn_open_web = QPushButton("🌐 Mở Web", self)
        btn_open_web.clicked.connect(self._open_web_url)
        link_row.addWidget(btn_open_web)
        layout.addLayout(link_row)

        # Nút hành động cuối
        btn_row = QHBoxLayout()
        btn_save_qr = QPushButton("💾 Lưu ảnh QR", self)
        btn_save_qr.clicked.connect(self._save_qr_image)
        btn_row.addWidget(btn_save_qr)

        btn_close = QPushButton("Đóng", self)
        btn_close.setObjectName("btnPrimary")
        btn_close.clicked.connect(self.accept)
        btn_row.addWidget(btn_close)

        layout.addLayout(btn_row)

    def _copy_album_name(self):
        QApplication.clipboard().setText(self.album_name_edit.text())
        QMessageBox.information(self, "Đã sao chép", "Đã sao chép Tên Album vào bộ nhớ tạm!")

    def _open_web_url(self):
        url = self.link_edit.text()
        if url:
            QDesktopServices.openUrl(QUrl(url))

    def _save_qr_image(self):
        qr_path = self.result_data.get("qr_image_path", "")
        if not qr_path or not os.path.exists(qr_path):
            QMessageBox.warning(self, "Lỗi", "Không tìm thấy file ảnh QR!")
            return

        save_path, _ = QFileDialog.getSaveFileName(
            self, "Lưu ảnh mã QR", f"QR_{self.result_data.get('album_name', 'album')}.png", "Images (*.png *.jpg)"
        )
        if save_path:
            import shutil
            shutil.copyfile(qr_path, save_path)
            QMessageBox.information(self, "Thành công", f"Đã lưu mã QR tại:\n{save_path}")


class SettingsDialog(QDialog):
    """Cửa sổ cấu hình đường dẫn Server và Picasa Viewer."""

    def __init__(self, current_config: dict, parent=None):
        super().__init__(parent)
        self.config = current_config.copy()
        self.setWindowTitle("⚙️ Cài Đặt Hệ Thống")
        self.setFixedSize(520, 320)
        self.setStyleSheet(STYLESHEET)
        self._init_ui()

    def _init_ui(self):
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(14)

        title = QLabel("⚙️ CÀI ĐẶT SERVER & CÔNG CỤ PICASA", self)
        title.setStyleSheet("font-size: 16px; font-weight: bold; color: #38BDF8;")
        layout.addWidget(title)

        # 1. Server Upload URL
        lbl_server = QLabel("🌐 Đường dẫn Server Upload API (POST multipart):", self)
        layout.addWidget(lbl_server)
        self.edit_server = QLineEdit(self.config.get("server_url", ""), self)
        self.edit_server.setPlaceholderText("https://your-server.com/api/upload (để trống để dùng Mock Demo)")
        layout.addWidget(self.edit_server)

        # 2. Web View Base URL
        lbl_web = QLabel("🔗 Đường dẫn trang Web xem Album (để tạo QR):", self)
        layout.addWidget(lbl_web)
        self.edit_web = QLineEdit(self.config.get("web_view_base_url", "https://photos.cloudviewer.app/album/"), self)
        layout.addWidget(self.edit_web)

        # 3. Picasa Viewer Path
        lbl_picasa = QLabel("🖼️ Đường dẫn công cụ Picasa Photo Viewer:", self)
        layout.addWidget(lbl_picasa)
        picasa_row = QHBoxLayout()
        self.edit_picasa = QLineEdit(self.config.get("picasa_path", ""), self)
        self.edit_picasa.setPlaceholderText("Tự động tìm kiếm PicasaPhotoViewer.exe hoặc trình xem mặc định")
        picasa_row.addWidget(self.edit_picasa)

        btn_browse_picasa = QPushButton("Duyệt...", self)
        btn_browse_picasa.clicked.connect(self._browse_picasa)
        picasa_row.addWidget(btn_browse_picasa)
        layout.addLayout(picasa_row)

        layout.addStretch()

        # Nút Lưu / Hủy
        btn_row = QHBoxLayout()
        btn_row.addStretch()
        btn_cancel = QPushButton("Hủy", self)
        btn_cancel.clicked.connect(self.reject)
        btn_row.addWidget(btn_cancel)

        btn_save = QPushButton("Lưu Cài Đặt", self)
        btn_save.setObjectName("btnPrimary")
        btn_save.clicked.connect(self._save)
        btn_row.addWidget(btn_save)

        layout.addLayout(btn_row)

    def _browse_picasa(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Chọn file Picasa Photo Viewer", "", "Executable (*.exe);;All Files (*)"
        )
        if file_path:
            self.edit_picasa.setText(file_path)

    def _save(self):
        self.config["server_url"] = self.edit_server.text().strip()
        self.config["web_view_base_url"] = self.edit_web.text().strip()
        self.config["picasa_path"] = self.edit_picasa.text().strip()
        self.accept()

    def get_config(self) -> dict:
        return self.config


class MainWindowUI(QMainWindow):
    """Cửa sổ chính của ứng dụng."""

    def __init__(self):
        super().__init__()
        self.setWindowTitle("⚡ Fast Media Uploader - Trình Chọn & Upload Ảnh/Video")
        self.resize(1100, 750)
        self.setMinimumSize(850, 550)
        self.setStyleSheet(STYLESHEET)

        self._build_ui()

    def _build_ui(self):
        central_widget = QWidget(self)
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(16, 16, 16, 16)
        main_layout.setSpacing(12)

        # -------------------------------------------------------------
        # 1. TOP BAR: Tiêu đề, Chọn thư mục, Cài đặt
        # -------------------------------------------------------------
        top_bar = QFrame(self)
        top_bar.setObjectName("topBar")
        top_layout = QHBoxLayout(top_bar)
        top_layout.setContentsMargins(10, 8, 10, 8)
        top_layout.setSpacing(10)

        app_title = QLabel("📸 Fast Media Uploader", top_bar)
        app_title.setObjectName("appTitle")
        top_layout.addWidget(app_title)

        top_layout.addSpacing(15)

        self.btn_select_folder = QPushButton("📂 Chọn Thư Mục Ảnh & Video", top_bar)
        self.btn_select_folder.setObjectName("btnPrimary")
        top_layout.addWidget(self.btn_select_folder)

        self.folder_path_edit = QLineEdit(top_bar)
        self.folder_path_edit.setPlaceholderText("Chưa chọn thư mục nào...")
        self.folder_path_edit.setReadOnly(True)
        top_layout.addWidget(self.folder_path_edit)

        self.btn_reload = QPushButton("🔄 Quét lại", top_bar)
        top_layout.addWidget(self.btn_reload)

        self.btn_settings = QPushButton("⚙️ Cài đặt", top_bar)
        top_layout.addWidget(self.btn_settings)

        main_layout.addWidget(top_bar)

        # -------------------------------------------------------------
        # 2. FILTER & TOOLBAR: Chọn tất cả / Bỏ chọn, Lọc ảnh/video, Đếm
        # -------------------------------------------------------------
        filter_bar = QFrame(self)
        filter_bar.setObjectName("filterBar")
        filter_layout = QHBoxLayout(filter_bar)
        filter_layout.setContentsMargins(10, 6, 10, 6)
        filter_layout.setSpacing(10)

        self.btn_select_all = QPushButton("☑ Chọn tất cả", filter_bar)
        filter_layout.addWidget(self.btn_select_all)

        self.btn_deselect_all = QPushButton("☐ Bỏ chọn tất cả", filter_bar)
        filter_layout.addWidget(self.btn_deselect_all)

        filter_layout.addSpacing(10)
        lbl_filter = QLabel("Bộ lọc:", filter_bar)
        filter_layout.addWidget(lbl_filter)

        self.combo_filter = QComboBox(filter_bar)
        self.combo_filter.addItems(["Tất cả", "Chỉ Ảnh", "Chỉ Video"])
        filter_layout.addWidget(self.combo_filter)

        filter_layout.addStretch()

        self.counter_label = QLabel("Đã chọn: 0 / 0 mục (0 ảnh, 0 video)", filter_bar)
        self.counter_label.setObjectName("counterLabel")
        filter_layout.addWidget(self.counter_label)

        main_layout.addWidget(filter_bar)

        # -------------------------------------------------------------
        # 3. GRID GALLERY AREA: Khu vực cuộn hiển thị ô vuông
        # -------------------------------------------------------------
        self.scroll_area = QScrollArea(self)
        self.scroll_area.setWidgetResizable(True)
        self.scroll_area.setStyleSheet("QScrollArea { border: 1px solid #1E293B; background-color: #0B1120; border-radius: 8px; }")

        self.grid_container = QWidget()
        self.grid_container.setStyleSheet("background-color: #0B1120;")
        self.grid_layout = QGridLayout(self.grid_container)
        self.grid_layout.setContentsMargins(12, 12, 12, 12)
        self.grid_layout.setSpacing(12)
        self.grid_layout.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)

        # Empty state placeholder
        self.empty_label = QLabel("Vui lòng nhấn 'Chọn Thư Mục Ảnh & Video' để bắt đầu tải danh sách.", self.grid_container)
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.empty_label.setStyleSheet("color: #64748B; font-size: 15px; font-weight: 500; padding: 60px;")
        self.grid_layout.addWidget(self.empty_label, 0, 0)

        self.scroll_area.setWidget(self.grid_container)
        main_layout.addWidget(self.scroll_area)

        # -------------------------------------------------------------
        # 4. BOTTOM BAR: Tiến trình, Trạng thái & Nút Upload Server
        # -------------------------------------------------------------
        bottom_bar = QFrame(self)
        bottom_bar.setObjectName("bottomBar")
        bottom_layout = QHBoxLayout(bottom_bar)
        bottom_layout.setContentsMargins(12, 8, 12, 8)
        bottom_layout.setSpacing(12)

        # Trạng thái và Progress bar
        status_box = QVBoxLayout()
        status_box.setSpacing(4)

        self.status_label = QLabel("Sẵn sàng", bottom_bar)
        self.status_label.setStyleSheet("color: #94A3B8; font-size: 12px;")
        status_box.addWidget(self.status_label)

        self.progress_bar = QProgressBar(bottom_bar)
        self.progress_bar.setFixedHeight(12)
        self.progress_bar.setValue(0)
        self.progress_bar.setVisible(False)
        status_box.addWidget(self.progress_bar)

        bottom_layout.addLayout(status_box)

        # Nút Upload nổi bật
        self.btn_upload = QPushButton("🚀 TẢI LÊN SERVER (UPLOAD)", bottom_bar)
        self.btn_upload.setObjectName("btnPrimary")
        self.btn_upload.setMinimumWidth(240)
        self.btn_upload.setFixedHeight(45)
        bottom_layout.addWidget(self.btn_upload)

        main_layout.addWidget(bottom_bar)

    def resizeEvent(self, event):
        """Tự động tính toán lại số cột trong Grid khi thay đổi kích thước cửa sổ."""
        super().resizeEvent(event)
        # Sẽ được điều phối bởi model_main khi có cards

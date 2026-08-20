"""
main.py - File 4: File Khởi Chạy Chính (Entry Point)
Chỉ nạp và gọi class tổng `MediaUploadApp` từ model_main.py
"""

import sys
from model_main import MediaUploadApp


def main():
    # Khởi tạo class tổng quản lý toàn bộ ứng dụng
    app = MediaUploadApp()
    
    # Chạy vòng lặp ứng dụng
    sys.exit(app.run())


if __name__ == "__main__":
    main()
# Robot 2027 • Phiên bản V2.3 (Song Ngữ Chủ Động & Siêu Nhẹ Android)

## Điểm mới đột phá trong V2.3
1. **Model AI Siêu Nhẹ & Tương thích Chuẩn Android (`llama.cpp`):**
   - Loại bỏ định dạng `Q4_0_4_8` gây lỗi nạp trên một số máy Android; thay thế bằng bộ preset chuẩn:
     - **SmolLM2-135M Q4_0 (85 MB):** Tương thích 100% mọi chip ARM Android và nhanh hơn Q4_K_M ~25%.
     - **SmolLM2-135M IQ3_XS (68 MB):** Siêu nhẹ cho máy RAM thấp.
   - Tối ưu C++ `llama_jni.cpp`: `n_ctx = 384`, `n_batch = 128`, `n_threads = 4`, dừng ngay sau 1 câu ngắn giúp giảm thời gian phản hồi xuống dưới 1 giây.
2. **Hội thoại Chia Nhỏ Đa Nhịp (Multi-Bubble Dialog):**
   - Robot trả lời từng câu, từng nhịp qua lại kèm hiệu ứng đang nói tiếp (`...`) thay vì dồn một cục văn bản dài.
3. **Bộ não Chủ Động 3 Mốc & Cứu Nguy Song Ngữ (`proactive_engine.js`):**
   - **Mốc 8 giây im lặng:** Tự động dịch câu tiếng Anh vừa nói sang tiếng Việt và gợi ý cách trả lời để bé/người học không bao giờ bị đứng hình.
   - **Mốc 19 giây im lặng:** Chủ động khơi gợi chủ đề mới hoặc câu đố vui để giữ kết nối liền mạch.
   - Có nút bật/tắt nhanh **`🤖 Chủ động: BẬT/TẮT`** ngay trên thanh trạng thái.
4. **Nút Dịch Tiếng Việt (`🇻🇳 Dịch`) trên MỌI Bong Bóng Chat:**
   - Bấm `🇻🇳 Dịch` để xem ngay nghĩa tiếng Việt + từ vựng chính và bấm `🔊` để nghe phát âm tiếng Việt.
5. **Bộ nhớ Ngữ cảnh Đa Thành Viên Gia Đình (`memory_engine.js`):**
   - Chặn lưu nhầm tên rác (như `Me`, `Hundred`), lưu riêng lịch sử hội thoại của **Bi**, **Dad**, **Mom**... và cho phép phụ huynh hỏi *"What did Bi learn today?"* để nghe báo cáo học tập của con.

## Cách Build File APK trên GitHub Actions
1. Giải nén `robot2027-app-v2.3.zip` và chép đè toàn bộ file vào repository GitHub của bạn (giữ nguyên `.github/workflows/build-apk.yml`).
2. Vào thẻ **Actions** -> chọn **Build Robot2027 V2.3 APK** -> tải artifact **`Robot2027-v2.3-apk`** cài đặt lên điện thoại.

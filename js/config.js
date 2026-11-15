/* Cấu hình chung. Đổi MODE từ 'local' sang 'server' là đủ để chuyển toàn bộ website sang backend
   (xem mục 7 trong ke_hoach_website_thi_trac_nghiem.md). */
const CONFIG = {
  APP_NAME: 'QuizHub',

  // 'local'  : đọc đề/đáp án từ thư mục data/, chấm điểm trên trình duyệt (bản đồ án).
  // 'server' : gọi backend qua js/adapters/server.js.
  MODE: 'local',
  API_BASE_URL: '',            // VD: 'https://script.google.com/macros/s/xxx/exec' hoặc 'https://api.example.com'

  // Thời gian làm bài (phút). null = dùng thời gian ghi trong từng đề.
  // Đặt 1 khi muốn thử nhanh tính năng tự nộp bài khi hết giờ.
  DURATION_OVERRIDE_MIN: null,

  SHOW_ANSWERS_AFTER_SUBMIT: true, // cho sinh viên xem đáp án đúng sau khi nộp
  SCORE_STEP: 0.25,                // làm tròn điểm thang 10
  WARN_MINUTES: 5,                 // đồng hồ chuyển màu cam
  DANGER_MINUTES: 1,               // đồng hồ chuyển màu đỏ

  // Trang giảng viên (admin.html). ⚠ Bản tĩnh: mật khẩu nằm lộ trong mã nguồn — chỉ để demo.
  // KHI LÊN SERVER: xóa dòng này, server kiểm tra mật khẩu và trả token.
  ADMIN_PASSWORD: 'admin123',
  ADMIN_AUTO_REFRESH_SEC: 15,      // tự làm mới bảng kết quả (0 = tắt)

  // Giám sát phòng thi (js/proctor.js)
  REQUIRE_FULLSCREEN: true,        // bắt buộc toàn màn hình (bỏ qua trên trình duyệt không hỗ trợ, VD iPhone Safari)
  MAX_VIOLATIONS: 3,               // đủ số lần này → tự nộp bài
  BLOCK_SHORTCUTS: true,           // chặn chuột phải, copy/paste, F12, Ctrl+U…

  // Gửi email kết quả qua EmailJS (chỉ dùng ở MODE 'local'; bản server sẽ tự gửi mail).
  // Để trống 3 khóa → không gửi email, trang kết quả báo "chưa cấu hình". Cách lấy khóa: xem README.
  EMAIL: {
    PUBLIC_KEY: '',
    SERVICE_ID: '',
    TEMPLATE_ID: '',
    TEACHER_EMAIL: 'giangvien@example.com', // người nhận kết quả
    CC_STUDENT: false,                      // gửi bản sao cho sinh viên (cần cột email trong data/students.js)
    TIMEOUT_MS: 10000
  }
};

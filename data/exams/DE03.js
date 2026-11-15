/* Đề DE03 — KHÔNG chứa đáp án (đáp án ở data/answers/DE03.js). */
window.QUIZ_DATA = window.QUIZ_DATA || { exams: {}, answers: {} };

QUIZ_DATA.exams.DE03 = {
  maDe: 'DE03',
  tieuDe: 'Kiểm tra giữa kỳ — Thiết kế Web & Đồ họa',
  thoiGian: 15,
  cauHoi: [
    { id: 'q1',  noiDung: 'Media query trong CSS chủ yếu dùng để làm gì?',
      luaChon: ['Phát video', 'Thiết kế responsive theo kích thước màn hình', 'Tải ảnh nhanh hơn', 'Gửi dữ liệu form'] },
    { id: 'q2',  noiDung: 'Thẻ <meta name="viewport"> giúp ích gì?',
      luaChon: ['Tăng thứ hạng SEO', 'Hiển thị đúng tỉ lệ trên thiết bị di động', 'Bảo mật trang web', 'Khai báo bảng mã ký tự'] },
    { id: 'q3',  noiDung: 'Đơn vị nào tính theo cỡ chữ của phần tử gốc <html>?',
      luaChon: ['em', 'px', 'rem', 'vh'] },
    { id: 'q4',  noiDung: 'Định dạng ảnh nào là ảnh vector?',
      luaChon: ['JPG', 'PNG', 'SVG', 'GIF'] },
    { id: 'q5',  noiDung: 'Theo WCAG mức AA, tỉ lệ tương phản tối thiểu cho chữ cỡ thường là bao nhiêu?',
      luaChon: ['2:1', '3:1', '4.5:1', '7:1'] },
    { id: 'q6',  noiDung: 'Thuộc tính alt của ảnh dùng để làm gì?',
      luaChon: ['Hiện chú thích khi rê chuột', 'Mô tả thay thế cho trình đọc màn hình và khi ảnh lỗi', 'Đặt kích thước ảnh', 'Gắn liên kết cho ảnh'] },
    { id: 'q7',  noiDung: 'Khai báo CSS Grid nào chia 3 cột bằng nhau?',
      luaChon: ['grid-template-columns: 1fr 1fr 1fr', 'columns: 3', 'grid-rows: 3', 'flex: 3'] },
    { id: 'q8',  noiDung: 'Nguyên tắc thiết kế nào khuyên đặt các phần tử liên quan ở gần nhau?',
      luaChon: ['Tương phản (Contrast)', 'Lặp lại (Repetition)', 'Gần nhau (Proximity)', 'Căn lề (Alignment)'] },
    { id: 'q9',  noiDung: '"Mobile-first" trong thiết kế web nghĩa là gì?',
      luaChon: ['Chỉ làm giao diện cho điện thoại', 'Thiết kế cho màn hình nhỏ trước rồi mở rộng dần', 'Ưu tiên làm ứng dụng di động', 'Chỉ dùng max-width trong media query'] },
    { id: 'q10', noiDung: 'Công cụ nào thường dùng để vẽ wireframe và prototype giao diện?',
      luaChon: ['Figma', 'Excel', 'Word', 'Notepad'] }
  ]
};

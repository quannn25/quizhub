/* Đề DE01 — KHÔNG chứa đáp án (đáp án ở data/answers/DE01.js). */
window.QUIZ_DATA = window.QUIZ_DATA || { exams: {}, answers: {} };

QUIZ_DATA.exams.DE01 = {
  maDe: 'DE01',
  tieuDe: 'Kiểm tra giữa kỳ — Thiết kế Web & Đồ họa',
  thoiGian: 15, // phút
  cauHoi: [
    { id: 'q1',  noiDung: 'HTML là viết tắt của cụm từ nào?',
      luaChon: ['HyperText Markup Language', 'High Text Machine Language', 'Hyperlink Tool Markup Language', 'Home Tool Markup Language'] },
    { id: 'q2',  noiDung: 'Thẻ nào dùng để tạo liên kết (hyperlink)?',
      luaChon: ['<link>', '<a>', '<href>', '<url>'] },
    { id: 'q3',  noiDung: 'Trong thẻ <img>, thuộc tính nào chỉ đường dẫn tới ảnh?',
      luaChon: ['href', 'link', 'src', 'alt'] },
    { id: 'q4',  noiDung: 'Thuộc tính CSS nào dùng để đổi màu chữ?',
      luaChon: ['font-color', 'text-color', 'color', 'foreground'] },
    { id: 'q5',  noiDung: 'Thẻ tiêu đề nào có cấp cao nhất (mặc định lớn nhất)?',
      luaChon: ['<h6>', '<head>', '<header>', '<h1>'] },
    { id: 'q6',  noiDung: 'Bộ chọn CSS nào chọn phần tử có id="menu"?',
      luaChon: ['.menu', '#menu', 'menu', '*menu'] },
    { id: 'q7',  noiDung: 'Thẻ nào tạo danh sách có đánh số thứ tự?',
      luaChon: ['<ul>', '<li>', '<ol>', '<dl>'] },
    { id: 'q8',  noiDung: 'Thuộc tính nào tạo khoảng cách giữa nội dung và đường viền của phần tử?',
      luaChon: ['margin', 'padding', 'border', 'spacing'] },
    { id: 'q9',  noiDung: 'Giá trị display nào sắp xếp các phần tử con linh hoạt theo hàng hoặc cột?',
      luaChon: ['block', 'inline', 'flex', 'none'] },
    { id: 'q10', noiDung: 'Nội dung hiển thị của trang web được đặt trong thẻ nào?',
      luaChon: ['<head>', '<body>', '<meta>', '<title>'] }
  ]
};

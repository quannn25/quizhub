/* Đề DE02 — KHÔNG chứa đáp án (đáp án ở data/answers/DE02.js). */
window.QUIZ_DATA = window.QUIZ_DATA || { exams: {}, answers: {} };

QUIZ_DATA.exams.DE02 = {
  maDe: 'DE02',
  tieuDe: 'Kiểm tra giữa kỳ — Thiết kế Web & Đồ họa',
  thoiGian: 15,
  cauHoi: [
    { id: 'q1',  noiDung: 'Từ khóa nào dùng để khai báo hằng số trong JavaScript?',
      luaChon: ['var', 'let', 'const', 'static'] },
    { id: 'q2',  noiDung: 'Lệnh nào in thông tin ra cửa sổ Console của trình duyệt?',
      luaChon: ['print()', 'console.log()', 'echo()', 'alert.log()'] },
    { id: 'q3',  noiDung: 'Biểu thức typeof [] trả về giá trị nào?',
      luaChon: ['"array"', '"object"', '"list"', '"undefined"'] },
    { id: 'q4',  noiDung: 'Toán tử nào so sánh bằng cả về giá trị lẫn kiểu dữ liệu?',
      luaChon: ['=', '==', '===', '!='] },
    { id: 'q5',  noiDung: 'Phương thức nào lấy một phần tử theo id?',
      luaChon: ['document.getElementById()', 'document.query()', 'window.getId()', 'document.getElement()'] },
    { id: 'q6',  noiDung: 'Sự kiện nào xảy ra khi người dùng nhấp chuột vào phần tử?',
      luaChon: ['onhover', 'onchange', 'onclick', 'onload'] },
    { id: 'q7',  noiDung: 'Cách nào lưu dữ liệu trên trình duyệt và vẫn còn sau khi đóng tab?',
      luaChon: ['sessionStorage', 'localStorage', 'Biến toàn cục', 'Thuộc tính data-*'] },
    { id: 'q8',  noiDung: 'Kết quả của biểu thức "5" + 3 là gì?',
      luaChon: ['8', '"53"', 'Số 53', 'Báo lỗi'] },
    { id: 'q9',  noiDung: 'Hàm nào lặp lại một đoạn mã sau mỗi khoảng thời gian cố định?',
      luaChon: ['setTimeout()', 'setInterval()', 'requestAnimationFrame()', 'repeat()'] },
    { id: 'q10', noiDung: 'Phương thức nào thêm phần tử vào cuối mảng?',
      luaChon: ['push()', 'pop()', 'shift()', 'unshift()'] }
  ]
};

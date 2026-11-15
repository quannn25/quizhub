/* Danh sách sinh viên dự thi + mã đề tương ứng.
   Chỉ js/adapters/local.js đọc file này.
   KHI LÊN SERVER: chuyển dữ liệu vào CSDL / Google Sheet và xóa file này khỏi bản deploy. */
window.QUIZ_DATA = window.QUIZ_DATA || { exams: {}, answers: {} };

// email: dùng khi bật CONFIG.EMAIL.CC_STUDENT (gửi bản sao kết quả cho sinh viên). Đây là địa chỉ giả để demo.
QUIZ_DATA.students = [
  { mssv: '22110001', hoTen: 'Nguyễn Văn An',  lop: 'TINV205DV01', maDe: 'DE01', email: '22110001@sv.example.edu.vn' },
  { mssv: '22110002', hoTen: 'Trần Thị Bình',  lop: 'TINV205DV01', maDe: 'DE02', email: '22110002@sv.example.edu.vn' },
  { mssv: '22110003', hoTen: 'Lê Hoàng Cường', lop: 'TINV205DV01', maDe: 'DE03', email: '22110003@sv.example.edu.vn' },
  { mssv: '22110004', hoTen: 'Phạm Minh Dũng', lop: 'TINV205DV01', maDe: 'DE01', email: '22110004@sv.example.edu.vn' },
  { mssv: '22110005', hoTen: 'Hoàng Ngọc Hà',  lop: 'TINV205DV01', maDe: 'DE02', email: '22110005@sv.example.edu.vn' },
  { mssv: '22110006', hoTen: 'Võ Quốc Huy',    lop: 'TINV205DV01', maDe: 'DE03', email: '22110006@sv.example.edu.vn' },
  { mssv: '22110007', hoTen: 'Đặng Thu Lan',   lop: 'TINV205DV01', maDe: 'DE01', email: '22110007@sv.example.edu.vn' },
  { mssv: '22110008', hoTen: 'Bùi Gia Minh',   lop: 'TINV205DV01', maDe: 'DE02', email: '22110008@sv.example.edu.vn' },
  { mssv: '22110009', hoTen: 'Đỗ Khánh Ngọc',  lop: 'TINV205DV01', maDe: 'DE03', email: '22110009@sv.example.edu.vn' },
  { mssv: '22110010', hoTen: 'Ngô Thanh Phúc', lop: 'TINV205DV01', maDe: 'DE01', email: '22110010@sv.example.edu.vn' }
];

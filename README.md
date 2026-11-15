# QuizHub — Website thi trắc nghiệm online

Đề án môn Thiết kế Web & Đồ họa (ĐH Hoa Sen). Website tĩnh viết bằng **HTML + CSS + JavaScript**, không cần backend. Kế hoạch đầy đủ, gồm cả cách chuyển lên server, nằm trong [ke_hoach_website_thi_trac_nghiem.md](ke_hoach_website_thi_trac_nghiem.md).

## Trạng thái

- [x] Đăng nhập bằng MSSV, nhận đúng mã đề, đồng ý quy chế
- [x] Phòng thi: đồng hồ đếm ngược, số câu đã làm / còn lại, bảng câu hỏi, quay lại câu bất kỳ, đánh dấu xem lại, phím tắt
- [x] Tự lưu bài: tải lại trang không mất đáp án, không reset giờ
- [x] Nộp bài có xác nhận; hết giờ tự nộp
- [x] Tự chấm điểm, trang kết quả kèm xem lại từng câu
- [x] Giao diện sáng/tối, responsive
- [x] Giám sát: bắt buộc toàn màn hình, phát hiện chuyển tab/cửa sổ, cảnh báo, vi phạm 3 lần tự nộp (`js/proctor.js`)
- [x] Gửi email kết quả qua EmailJS, có nút gửi lại khi lỗi mạng (`js/adapters/emailjs-mailer.js`)
- [x] Trang giảng viên (`admin.html`): thống kê, phân bố xếp loại, điểm theo mã đề, tìm/lọc/sắp xếp, xem chi tiết và nhật ký vi phạm, chấm bài bỏ dở, cho thi lại, xuất CSV
- [x] Trang giới thiệu (`about.html`): mục tiêu, tính năng, công nghệ, sơ đồ kiến trúc, sơ đồ website, giới hạn, nhóm thực hiện
- [x] Nhập dữ liệu (`import.html`): danh sách sinh viên và đề thi từ Excel/CSV, kiểm tra lỗi theo từng dòng, dùng thử ngay, tạo gói file dữ liệu `.zip`

## Nhập danh sách sinh viên & đề thi

Vào **Giảng viên → Nhập dữ liệu**:
1. Tải **File mẫu Excel** (hoặc **Xuất dữ liệu hiện có** để sửa dữ liệu đang dùng), rồi điền sheet `SinhVien` và/hoặc `DeThi`.
2. Kéo thả file `.xlsx / .xls / .csv` vào trang. Trang báo lỗi theo dạng "tên file · số dòng" (MSSV trùng, mã đề chưa có đề, câu thiếu đáp án…) và cho xem trước.
3. Hết lỗi thì chọn một trong hai:
   - **Dùng thử dữ liệu này:** áp dụng ngay trên trình duyệt đang dùng, hợp để thi thử hoặc demo. Bấm **Quay về dữ liệu gốc** để hủy.
   - **Tải gói dữ liệu (.zip):** giải nén, chép thư mục `data` vào `exam_online` (chọn Thay thế). Cách này áp dụng cho mọi máy.

Quy định từng cột, quy tắc kiểm tra và hướng dẫn chi tiết (viết sẵn cho báo cáo) nằm ở **mục 11** của [ke_hoach_website_thi_trac_nghiem.md](ke_hoach_website_thi_trac_nghiem.md).

- Đọc Excel và tạo `.zip` cần Internet ở lần đầu (để tải thư viện SheetJS, JSZip). File CSV đọc được không cần mạng.
- **Giảng viên:** bản tĩnh có một tài khoản, gồm mật khẩu và email nhận kết quả trong `js/config.js`. Trang Nhập dữ liệu tạo sẵn đoạn cấu hình để chép vào đó.

## Trang giảng viên

- Mở `admin.html` (menu **Giảng viên**). Mật khẩu demo là `admin123`, đổi ở `ADMIN_PASSWORD` trong `js/config.js`.
- ⚠ **Bản tĩnh chỉ thấy bài làm trên cùng trình duyệt** (dữ liệu nằm trong localStorage của máy đó). Kết quả của sinh viên thi trên máy khác được gửi về email. Khi chuyển lên server, trang này sẽ thấy cả lớp mà không phải sửa giao diện.
- **Chấm bài:** dùng cho sinh viên đã hết giờ nhưng chưa nộp (đóng trình duyệt giữa chừng). Hệ thống chấm các câu đã lưu.
- **Cho thi lại:** xóa lượt thi để sinh viên làm lại từ đầu (VD máy hỏng). Không thể hoàn tác.
- **Xuất CSV:** mở được bằng Excel, đủ dấu tiếng Việt.
- Bảng tự làm mới mỗi 15 giây (`ADMIN_AUTO_REFRESH_SEC`). Nếu sinh viên thi ở tab khác trên cùng máy thì bảng cập nhật ngay.

## Còn phải tự điền

- `about.html`: tên giảng viên hướng dẫn, tên và MSSV các thành viên, email liên hệ.
- `js/config.js`: khóa EmailJS, `TEACHER_EMAIL`, `ADMIN_PASSWORD`.

## Giám sát phòng thi: làm được gì, không làm được gì

| Phát hiện được (tính vi phạm) | Chặn được | Không làm được (giới hạn của trình duyệt) |
|---|---|---|
| Chuyển tab, thu nhỏ trình duyệt | Chuột phải, copy / cut / paste, kéo thả, bôi đen chữ | Chặn Alt+Tab, phím Windows |
| Chuyển sang cửa sổ / ứng dụng khác | F12, Ctrl+Shift+I/J/C, Ctrl+U, Ctrl+S, Ctrl+P | Phát hiện điện thoại, máy thứ hai, người nhắc bài |
| Thoát toàn màn hình (Esc) | | Phần mềm trên màn hình phụ khi trang vẫn giữ focus |

- Alt+Tab có thể kích hoạt nhiều sự kiện cùng lúc; trong vòng 1,5 giây chúng chỉ tính là **1 lần** vi phạm.
- Tải lại trang **không** tính là vi phạm (trang hỏi xác nhận trước khi rời đi).
- Cấu hình nằm trong `js/config.js`: `REQUIRE_FULLSCREEN`, `MAX_VIOLATIONS`, `BLOCK_SHORTCUTS`.
- iPhone Safari không hỗ trợ Fullscreen API, nên trên iPhone chỉ phát hiện được chuyển tab.
- Khóa máy thật sự cần phần mềm chuyên dụng như **Safe Exam Browser**; website này vẫn chạy được bên trong nó.

## Cấu hình gửi email (EmailJS, miễn phí 200 email/tháng)

1. Đăng ký tại https://www.emailjs.com.
2. **Email Services → Add New Service →** chọn Gmail và kết nối tài khoản dùng để gửi. Ghi lại **Service ID**.
3. **Email Templates → Create New Template**:
   - **To Email:** `{{to_email}}` · **CC:** `{{cc_email}}` · **Subject:** `{{subject}}`
   - **Content:**

```
KẾT QUẢ BÀI THI

Họ tên: {{ho_ten}}        MSSV: {{mssv}}        Lớp: {{lop}}
Bài thi: {{tieu_de}}      Mã đề: {{ma_de}}
Bắt đầu: {{started_at}}   Nộp lúc: {{submitted_at}}
Thời gian làm: {{duration}}
Hình thức nộp: {{reason}}
Số lần vi phạm: {{violations}}

ĐIỂM: {{score}}/10   (Đúng {{correct}}/{{total}} câu, đã làm {{answered}} câu)

Chi tiết:
{{detail}}
```

   Ghi lại **Template ID**.
4. **Account → General:** lấy **Public Key**. Nên vào **Account → Security** và giới hạn domain được phép gửi (VD domain GitHub Pages của bạn).
5. Điền 3 khóa và `TEACHER_EMAIL` vào `CONFIG.EMAIL` trong `js/config.js`. Muốn gửi thêm bản sao cho sinh viên thì đặt `CC_STUDENT: true` và điền cột `email` trong `data/students.js`.

Khi chưa điền khóa, website vẫn chạy bình thường; trang kết quả chỉ báo "chưa cấu hình gửi email". Điểm luôn được lưu **trước** khi gửi email, nên lỗi mạng không làm mất bài; trang kết quả có nút **Gửi lại email**.

> ⚠ Public Key của EmailJS nằm trong mã nguồn nên người khác có thể dùng để gửi email giả. Mức này chấp nhận được với đồ án; bản thật nên để server gửi mail (xem mục 7 file kế hoạch).

## Cấu trúc

```
index.html  login.html  exam.html  result.html  admin.html  import.html  about.html
css/style.css
js/config.js          Cấu hình: MODE ('local' | 'server'), thời gian, cách làm tròn điểm…
js/common.js          Tiện ích dùng chung, header/footer, hộp thoại, thông báo
js/api.js             ★ Lớp dữ liệu duy nhất: các trang chỉ gọi API.xxx()
js/adapters/local.js  Bản đồ án: đọc data/, chấm điểm trên trình duyệt, lưu localStorage
js/adapters/server.js Khung sẵn cho bản có backend (fetch tới API_BASE_URL)
js/adapters/emailjs-mailer.js  Gửi email kết quả qua EmailJS (chỉ bản local dùng)
js/timer.js           Đồng hồ tính theo deadline
js/proctor.js         Giám sát: toàn màn hình, phát hiện chuyển tab, chặn phím tắt
js/data-importer.js   Đọc Excel/CSV, kiểm tra lỗi, tạo file dữ liệu (không phụ thuộc giao diện)
js/login.js  js/exam.js  js/result.js  js/admin.js  js/import.js
data/students.js      Danh sách SV + mã đề
data/exams/*.js       Đề thi (không có đáp án)
data/answers/*.js     Đáp án (tách riêng để sau này đưa lên server)
```

> Dữ liệu viết dưới dạng file `.js` thay vì `.json` để mở trực tiếp bằng `file://` (nhấp đúp vào `index.html`) vẫn chạy được, không cần Live Server.

## Chạy thử

- Nhấp đúp vào `index.html`, hoặc dùng **Live Server** trong VS Code.
- MSSV demo: `22110001` đến `22110010`.
- **Thử nhanh tính năng tự nộp khi hết giờ:** đặt `DURATION_OVERRIDE_MIN: 1` trong `js/config.js`.
- **Thử giám sát:** khi đang thi, bấm Esc hoặc Alt+Tab. Lần 1 và 2 hiện cảnh báo, lần 3 bài tự nộp.
- **Thi lại từ đầu với một MSSV:** vào trang Giảng viên và bấm **Cho thi lại**.

## Thêm sinh viên / đề thi

Nên dùng trang **Nhập dữ liệu** (xem mục ở trên). Nếu muốn sửa tay:
1. Thêm dòng vào `data/students.js`, ghi `maDe` cho sinh viên đó.
2. Tạo `data/exams/DE04.js` (chép từ `DE01.js`) và `data/answers/DE04.js`. Đáp án ghi theo chỉ số: 0 = A, 1 = B, 2 = C, 3 = D.

## Chuyển lên server

Xem mục 7 trong file kế hoạch. Tóm tắt:
1. Viết backend có các endpoint như ghi chú trong `js/adapters/server.js`.
2. Trong `js/config.js`, đặt `MODE: 'server'` và điền `API_BASE_URL`.
3. Xóa `data/`, `js/adapters/local.js` và `js/adapters/emailjs-mailer.js` khỏi bản deploy, đồng thời gỡ khóa EmailJS khỏi `config.js`.

Các trang HTML, CSS, `login.js`, `exam.js`, `result.js`, `admin.js`, `timer.js` và `proctor.js` không phải sửa. Khi đó cũng xóa `ADMIN_PASSWORD` khỏi `config.js`, vì server sẽ tự kiểm tra mật khẩu và trả token.

## Đưa lên GitHub Pages

Tải thư mục lên một repository, vào **Settings → Pages**, chọn nhánh `main`, thư mục `/ (root)` rồi bấm **Save**.

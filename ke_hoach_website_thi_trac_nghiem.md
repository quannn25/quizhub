# Website Thi Trắc Nghiệm Online — Kế hoạch đề án

Đề án môn **Thiết kế Web & Đồ họa** (ĐH Hoa Sen). Cùng khuôn với đề án SkyCast: website tĩnh **HTML + CSS + JavaScript**, deploy lên GitHub Pages, báo cáo 5 chương.

Tên gợi ý: **QuizHub**, **ExamNow**, **HSU Quiz** (logo tự vẽ bằng Photoshop/Figma → chương 3 của báo cáo).

> **Nguyên tắc xuyên suốt:** mọi chỗ cần "server" (lấy đề, chấm điểm, gửi email, giờ bắt đầu) đều đi qua **một file duy nhất `js/api.js`**. Giao diện không bao giờ đọc dữ liệu trực tiếp. Sau này chuyển lên server chỉ cần viết lại file đó — xem mục 7.

---

## 1. Mục tiêu & phạm vi

| Có trong bản đồ án | Không làm (ghi vào "Hướng phát triển") |
|---|---|
| Đăng nhập bằng MSSV → nhận đúng mã đề | Tài khoản/mật khẩu thật |
| Làm bài: đồng hồ, đếm câu, quay lại, nộp, tự nộp | Ngân hàng câu hỏi trộn ngẫu nhiên từ CSDL |
| Phát hiện chuyển tab / thoát toàn màn hình | Khóa máy thật (cần Safe Exam Browser) |
| Tự chấm điểm, xem kết quả | Chấm phía server (bảo mật đáp án) |
| Gửi kết quả về email (EmailJS) | Gửi email từ server |
| Trang giảng viên xem danh sách & kết quả (localStorage) | Thống kê nhiều lớp, nhiều kỳ |
| Nhập danh sách SV & đề thi từ Excel/CSV, kiểm tra lỗi, tạo file dữ liệu | Nhiều tài khoản giảng viên, phân quyền |

**Đối tượng:** sinh viên làm bài, giảng viên ra đề và xem kết quả.

---

## 2. Sơ đồ trang (sitemap)

```
index.html        Trang chủ: giới thiệu, nút "Vào thi", hướng dẫn quy chế
login.html        Nhập MSSV (+ họ tên) → kiểm tra trong danh sách → hiện mã đề, số câu, thời gian
exam.html         Phòng thi (trang chính)
result.html       Kết quả: điểm, số câu đúng/sai, xem lại đáp án (tùy cấu hình), trạng thái gửi email
admin.html        Giảng viên: danh sách SV + mã đề, bảng kết quả đã nộp, xuất CSV  (có mật khẩu demo)
  └ import.html   Nhập dữ liệu: Excel/CSV → kiểm tra lỗi → dùng thử / tải file dữ liệu (chỉ giảng viên)
about.html        Giới thiệu đề án, công nghệ, nhóm thực hiện, sơ đồ website
```

Nếu giới hạn số trang: gộp `index` + `login` thành một.

---

## 3. Chức năng chi tiết

### 3.1 Danh sách sinh viên ↔ mã đề
- File `data/students.js`: `{ mssv, hoTen, lop, maDe, email? }`.
- File `data/exams/<maDe>.js`: tiêu đề, thời gian (phút), danh sách câu hỏi `{ id, noiDung, luaChon[2..6] }`.
- File `data/answers/<maDe>.js`: đáp án **tách riêng** khỏi đề → khi lên server chỉ việc không gửi file này về trình duyệt nữa.
- Các file này được **tạo tự động** từ Excel/CSV bằng trang Nhập dữ liệu (mục 3.7), không cần sửa tay.
- Login: MSSV không có trong danh sách → báo lỗi; đã nộp rồi → chặn thi lại.

### 3.2 Chống chuyển màn hình (phát hiện, không chặn tuyệt đối)
- Bắt buộc bấm "Bắt đầu" → `requestFullscreen()`.
- Theo dõi `visibilitychange`, `blur`, `fullscreenchange` → mỗi lần vi phạm: hiện cảnh báo đỏ, tăng bộ đếm, ghi thời điểm.
- Vượt `MAX_VIOLATIONS` (mặc định 3) → **tự nộp bài**, ghi lý do "Vi phạm quy chế".
- Chặn chuột phải, copy/paste, chọn chữ, phím F12 / Ctrl+U / Ctrl+Shift+I (chỉ cản người không rành — ghi rõ trong báo cáo).
- Số lần vi phạm + thời điểm được gửi kèm bài nộp.

### 3.3 Phòng thi
- **Thanh trạng thái cố định:** thời gian còn lại (mm:ss, đổi màu cam < 5 phút, đỏ < 1 phút), đã làm X / còn lại Y, số lần vi phạm.
- **Bảng câu hỏi (navigator):** lưới ô số 1…N; màu: chưa làm / đã làm / đang xem / đánh dấu xem lại (🚩).
- Nút **Câu trước / Câu sau**, nhấn ô số để nhảy câu.
- **Lưu tạm vào localStorage** sau mỗi lần chọn → lỡ tải lại trang vẫn giữ bài và giữ đúng giờ (tính theo `startedAt`, không theo bộ đếm).
- **Nộp bài:** hộp xác nhận ("Còn 3 câu chưa làm, vẫn nộp?").
- **Hết giờ:** tự nộp, không hỏi.
- Chống nộp 2 lần (khóa nút, cờ `submitted`).

### 3.4 Chấm điểm
- So từng câu với đáp án → số câu đúng, điểm thang 10 (làm tròn 0.25), thời gian làm bài.
- Cấu hình `SHOW_ANSWERS_AFTER_SUBMIT` (giảng viên quyết định có cho xem đáp án không).

### 3.5 Gửi email theo format
- Dùng **EmailJS** (miễn phí 200 email/tháng, không cần server).
- Một template email, gửi cho giảng viên (và tùy chọn bản sao cho SV):

```
Tiêu đề: [KẾT QUẢ THI] {{ma_de}} - {{mssv}} - {{ho_ten}}

Họ tên: {{ho_ten}}        MSSV: {{mssv}}        Lớp: {{lop}}
Mã đề: {{ma_de}}          Nộp lúc: {{submitted_at}}
Thời gian làm: {{duration}}   Lý do nộp: {{reason}}  (Tự nộp / Hết giờ / Vi phạm)
Điểm: {{score}}/10        Đúng: {{correct}}/{{total}}
Số lần vi phạm: {{violations}}

Chi tiết:
{{detail}}   (Câu 1: B ✔ | Câu 2: A ✘ (đáp án C) | ...)
```

- Gửi thất bại (mất mạng) → lưu vào hàng đợi localStorage, trang kết quả có nút "Gửi lại".

### 3.6 Trang giảng viên (admin)
- Mật khẩu demo trong `config.js` (ghi rõ: chỉ để demo).
- Bảng sinh viên: MSSV, họ tên, mã đề, trạng thái (chưa thi / đã nộp), điểm.
- Xuất CSV bảng điểm.
- Lưu ý: ở bản tĩnh, admin chỉ thấy kết quả **làm trên cùng máy** (localStorage) — kết quả của cả lớp thì xem qua email. Đây chính là lý do cần server (nêu trong báo cáo).

### 3.7 Nhập dữ liệu (import.html)
- Giảng viên tải **file mẫu** (Excel 3 sheet `SinhVien` / `DeThi` / `HuongDan`, hoặc 2 file CSV) hoặc **xuất dữ liệu đang có** ra Excel để sửa.
- Kéo thả một hoặc nhiều file `.xlsx / .xls / .csv`; loại bảng được nhận diện theo tên cột (có dấu/không dấu, hoa/thường đều được; CSV dùng `,` hoặc `;`, UTF-8 hoặc Windows-1258).
- **Kiểm tra trước khi áp dụng**, báo lỗi theo "tên file · dòng": MSSV trùng/thiếu/sai định dạng, mã đề chưa có đề, câu thiếu đáp án, lựa chọn trống giữa, đáp án trỏ vào ô trống, đề thiếu thời gian… Còn lỗi thì không cho áp dụng.
- Xem trước danh sách SV và từng đề (đáp án đúng tô xanh).
- Áp dụng — bản tĩnh: **Dùng thử trên trình duyệt này** (lưu localStorage, có nút "Quay về dữ liệu gốc") và **Tải gói dữ liệu (.zip)** gồm `data/students.js`, `data/exams/*.js`, `data/answers/*.js` để chép đè vào website. Bản server: **Lưu dữ liệu** thẳng vào CSDL.
- Thông tin giảng viên (email nhận kết quả, mật khẩu): bản tĩnh chỉ có 1 tài khoản trong `config.js`; trang tạo sẵn đoạn cấu hình để chép.
- Chi tiết để viết báo cáo: **mục 11**.

---

## 4. Cấu trúc thư mục

```
exam_online/
├── index.html  login.html  exam.html  result.html  admin.html  import.html  about.html
├── css/
│   └── style.css            Biến màu, card, nút, navigator, responsive, chế độ sáng/tối
├── js/
│   ├── config.js            Cấu hình: MODE ('local' | 'server'), API_BASE_URL, EmailJS keys, MAX_VIOLATIONS…
│   ├── api.js               ★ LỚP DỮ LIỆU — chỗ DUY NHẤT biết dữ liệu nằm ở đâu
│   ├── adapters/
│   │   ├── local.js         Bản hiện tại: đọc data/, chấm điểm, localStorage, dữ liệu nhập thử
│   │   ├── emailjs-mailer.js Gửi email kết quả qua EmailJS (chỉ bản local)
│   │   └── server.js        Bản sau này: gọi fetch() tới backend (khung đủ endpoint)
│   ├── common.js            Header/footer, tiện ích (format giờ, toast, modal, tải file)
│   ├── proctor.js           Fullscreen, phát hiện chuyển tab, chặn phím — độc lập với dữ liệu
│   ├── timer.js             Đồng hồ tính theo deadline
│   ├── data-importer.js     Đọc Excel/CSV, kiểm tra lỗi, tạo file dữ liệu — độc lập với giao diện
│   ├── login.js  exam.js  result.js  admin.js  import.js
├── data/
│   ├── students.js
│   ├── exams/DE01.js  DE02.js  DE03.js
│   └── answers/DE01.js  DE02.js  DE03.js
├── assets/                  logo.svg
└── README.md
```

---

## 5. Hợp đồng API (giữ nguyên khi chuyển lên server)

Toàn bộ trang chỉ gọi các hàm sau, tất cả trả về **Promise** (dùng `async/await`) — kể cả khi bản local không cần chờ. Nhờ vậy đổi sang `fetch()` không phải sửa giao diện.

| Hàm trong `api.js` | Bản local làm gì | Bản server sẽ gọi |
|---|---|---|
| `login(mssv)` → `{ student, exam: {maDe, title, duration, total} }` | Tìm trong `students.json` | `POST /api/login` |
| `startExam(mssv)` → `{ attemptId, startedAt, deadline, answers, flagged, violations, serverNow }` — đã có lượt chưa nộp thì **trả lại lượt đó** | Ghi `startedAt` vào localStorage | `POST /api/attempts` (server ghi giờ) |
| `getQuestions(attemptId)` → `{ maDe, tieuDe, cauHoi: [{id, noiDung, luaChon}] }` **(không có đáp án)** | Đọc `data/exams/<maDe>.js` | `GET /api/attempts/:id/questions` |
| `saveProgress(attemptId, {answers, flagged})` → `{ savedAt }` | Ghi localStorage | `PUT /api/attempts/:id/progress` |
| `reportViolation(attemptId, {type, at})` → `{ count }` | Ghi localStorage | `POST /api/attempts/:id/violations` |
| `submitExam(attemptId, answers, reason)` → `{ score, correct, total, …, detail[] }` | Đọc `data/answers/<maDe>.js`, **chấm tại client**, gửi EmailJS | `POST /api/attempts/:id/submit` (server chấm + gửi mail) |
| `getResult(attemptId)` → như trên, kèm `email: { status }` | Đọc localStorage | `GET /api/attempts/:id/result` |
| `resendResultEmail(attemptId)` → `{ status, at, to?, error? }` | Gửi lại qua EmailJS (`js/adapters/emailjs-mailer.js`) | `POST /api/attempts/:id/email` |
| `admin.login(password)` → `{ token, name }` | So với `CONFIG.ADMIN_PASSWORD` (lộ — chỉ demo) | `POST /api/admin/login` |
| `admin.getResults()` → `{ generatedAt, scope, rows[] }` | Đọc localStorage **của trình duyệt này** | `GET /api/admin/results` (cả lớp) |
| `admin.getAttemptDetail(mssv)` | Đọc localStorage | `GET /api/admin/students/:mssv` |
| `admin.resetAttempt(mssv)` (cho thi lại) | Xóa khóa localStorage | `DELETE /api/admin/students/:mssv/attempt` |
| `admin.forceSubmit(mssv)` (chấm bài bỏ dở) | Chấm với đáp án đã lưu | `POST /api/admin/students/:mssv/submit` |
| `admin.exportData()` → `{ students, exams, answers }` | Đọc `data/` (+ dữ liệu nhập thử) | `GET /api/admin/data` |
| `admin.checkExams([maDe])` → `{ DE01: true, … }` | Thử nạp `data/exams/<maDe>.js` | `POST /api/admin/exams/check` |
| `admin.importData({ students?, exams?, answers? })` → `{ scope }` | Lưu localStorage (**chỉ trình duyệt này**) | `PUT /api/admin/data` (lưu CSDL, áp dụng mọi máy) |
| `admin.clearImportedData()` | Xóa dữ liệu nhập thử | `DELETE /api/admin/data/import` (tùy chọn) |
| `admin.getDataSource()` → `{ source: 'files' \| 'imported', … }` | Đọc localStorage | `GET /api/admin/data/source` |

> Các API giảng viên gửi kèm `Authorization: Bearer <token>`; token lưu trong sessionStorage do `api.js` quản lý.

> Dữ liệu trong bản tĩnh viết dạng file `.js` (gán vào `window.QUIZ_DATA`) thay vì `.json` để mở trực tiếp bằng `file://` vẫn chạy. `serverNow` giúp đồng hồ căn theo giờ server.

Quy tắc khi code:
1. **Không** trang nào được `fetch('data/...')` hay đọc `localStorage` trực tiếp — chỉ qua `api.js`.
2. **Không** trang nào tự chấm điểm — `exam.js` chỉ gửi đáp án và nhận điểm về.
3. `exam.js` không bao giờ thấy file `answers/` (chỉ `adapters/local.js` đọc).
4. Đồng hồ tính theo `deadline` do `startExam()` trả về, không tự đặt giờ.
5. `config.js` có `MODE`; `api.js` chọn adapter theo `MODE` → chuyển đổi bằng **1 dòng**.

```js
// js/config.js
const CONFIG = { MODE: 'local', API_BASE_URL: '', MAX_VIOLATIONS: 3, /* … */ };

// js/api.js
const API = CONFIG.MODE === 'server' ? ServerAdapter : LocalAdapter;
```

---

## 6. Thiết kế giao diện

- **Màu chủ đạo:** xanh dương đậm (tin cậy, học thuật) + nền trắng/xám nhạt; xanh lá = đã làm, cam = đánh dấu, đỏ = cảnh báo/hết giờ.
- **Font:** Be Vietnam Pro hoặc Inter (hỗ trợ tiếng Việt tốt).
- **Phòng thi:** desktop 2 cột (câu hỏi bên trái, navigator bên phải); mobile 1 cột, navigator thu gọn thành ngăn kéo ở dưới.
- **Trạng thái:** loading, lỗi MSSV, mất mạng, đã nộp, gửi email thất bại.
- **Chế độ sáng/tối**, hiệu ứng hover/transition nhẹ.
- Wireframe vẽ trước bằng Figma (đưa vào báo cáo chương 2).

---

## 7. ★ Ghi chú chuyển lên server sau này

### Vì sao phải chuyển
Bản tĩnh để **demo đồ án**: đáp án nằm trong `data/answers/` → ai mở DevTools cũng xem được; khóa EmailJS lộ trong mã; giờ bắt đầu lưu ở máy SV nên có thể sửa; giảng viên không xem được kết quả tập trung.

### Những gì chuyển lên server

| Thành phần | Bản tĩnh (hiện tại) | Bản server |
|---|---|---|
| `data/students.js` | file tĩnh | bảng `students` trong CSDL / Google Sheet |
| `data/exams/*.js` | file tĩnh | bảng `questions`, server trả đề **không kèm đáp án** |
| `data/answers/*.js` | file tĩnh (lộ) | **chỉ ở server**, xóa khỏi thư mục web |
| Nhập dữ liệu | tạo file `.js` để chép tay + dùng thử trên 1 trình duyệt | `PUT /api/admin/data` lưu thẳng CSDL; cùng file mẫu Excel, cùng bước kiểm tra lỗi |
| Giờ bắt đầu | localStorage | server ghi `started_at`, từ chối bài nộp sau `deadline + 30s` |
| Chấm điểm | `adapters/local.js` | server |
| Gửi email | EmailJS | server (MailApp / Nodemailer / SMTP) |
| Vi phạm | localStorage | lưu theo `attempt_id` |
| Admin | localStorage + mật khẩu demo trong `config.js` | server kiểm tra mật khẩu, trả token; xem kết quả cả lớp |

### Các bước chuyển (theo thứ tự)
1. Dựng backend, làm đúng các endpoint ở **bảng mục 5** (cùng tên trường, cùng định dạng JSON).
2. Nhập dữ liệu: ở trang Nhập dữ liệu bấm **Xuất dữ liệu hiện có (.xlsx)** → sau khi bật server, nhập lại chính file đó (bấm **Lưu dữ liệu**). Server nên kiểm tra lại các quy tắc ở mục 11.3 thay vì tin trình duyệt.
3. Viết `js/adapters/server.js`: mỗi hàm là một `fetch()` tới `CONFIG.API_BASE_URL` (khung đã có sẵn).
4. Sửa `config.js`: `MODE: 'server'`, điền `API_BASE_URL`.
5. **Xóa** thư mục `data/`, `adapters/local.js` và `adapters/emailjs-mailer.js` khỏi bản deploy; gỡ khóa EmailJS. Server gửi mail theo đúng mẫu ở mục 3.5 (dùng lại chuỗi `detail` dạng "Câu 1: B ✔").
   Server nên tự nộp bài khi số vi phạm (`POST …/violations`) đạt `MAX_VIOLATIONS`, không chỉ dựa vào trình duyệt.
6. Bật CORS trên server cho domain GitHub Pages (nếu frontend và backend khác domain).
7. Test lại toàn bộ luồng: login → thi → tải lại trang giữa chừng → nộp / hết giờ → nhận email.

→ Các file **không phải sửa:** toàn bộ `*.html`, `style.css`, `exam.js`, `login.js`, `result.js`, `admin.js`, `import.js`, `data-importer.js`, `proctor.js`, `timer.js`.

### Lựa chọn backend

| Phương án | Ưu | Nhược | Hợp khi |
|---|---|---|---|
| **Google Apps Script + Google Sheets** ⭐ | Miễn phí, không quản lý server, giảng viên sửa đề trên Sheet, gửi mail bằng `MailApp` | ~100 email/ngày (Gmail thường), chậm hơn chút; CORS: gửi `Content-Type: text/plain` để tránh preflight | Một lớp / một môn |
| Firebase (Firestore + Cloud Functions) | Realtime, có Auth | Chấm điểm cần Functions (gói trả phí Blaze) | Muốn có đăng nhập Google |
| Supabase (Postgres + Edge Functions) | SQL thật, gói free rộng | Học thêm SQL/RLS | Nhiều lớp, nhiều kỳ |
| Node.js/Express hoặc Spring Boot | Toàn quyền | Phải thuê host, tự lo bảo mật | Đồ án môn backend sau này |

Bổ sung bảo mật khi lên server: kiểm tra 1 MSSV chỉ 1 lượt thi, giới hạn số request, xáo thứ tự câu/đáp án theo từng SV ở server, log IP.

---

## 8. Thứ tự thực hiện

1. **Chốt yêu cầu & dữ liệu mẫu:** 10 SV, 3 mã đề × 10–20 câu.
2. **Sitemap + wireframe** (Figma): login, phòng thi (desktop + mobile), kết quả.
3. **Khung chung:** `style.css`, header/footer, `config.js`, `api.js` + `adapters/local.js` (+ khung `server.js`).
4. **Login → phòng thi:** hiển thị câu hỏi, chọn đáp án, navigator, câu trước/sau.
5. **Đồng hồ + tự nộp + lưu tạm** (thử tải lại trang giữa chừng).
6. **Chấm điểm + trang kết quả.**
7. **Proctor:** fullscreen, chuyển tab, chặn phím, tự nộp khi vi phạm.
8. **EmailJS + hàng đợi gửi lại.**
9. **Admin + about.**
10. **Nhập dữ liệu** từ Excel/CSV (file mẫu, kiểm tra lỗi, dùng thử, tạo gói `.zip`).
11. **Responsive, sáng/tối, kiểm thử, deploy GitHub Pages, chụp màn hình, viết báo cáo.**

**MVP tối thiểu:** bước 3–6 (login, làm bài, đồng hồ, chấm điểm). Sau đó thêm proctor, email, admin.

---

## 9. Kiểm thử

Đã kiểm thử trên trình duyệt nhúng (Chromium) và giả lập điện thoại 375px. Các mục chưa tích là chưa kiểm được trong môi trường đó.

- [x] MSSV sai / để trống / đã nộp rồi.
- [x] Hết giờ khi đang làm → tự nộp đúng.
- [x] Tải lại trang giữa chừng → giữ đáp án, giờ không bị reset; tải lại không tính vi phạm.
- [x] Chuyển cửa sổ (giả lập sự kiện) → cảnh báo; lần thứ 3 → tự nộp; nhiều sự kiện cùng lúc chỉ tính 1 lần.
- [ ] Alt+Tab / Esc thật trên Chrome ở chế độ toàn màn hình (trình duyệt nhúng không cho toàn màn hình).
- [x] Nộp khi còn câu trống → hộp xác nhận đúng số câu.
- [x] Bấm nộp 2 lần → chỉ tính lần đầu.
- [x] Gửi email lỗi (giả lập) → điểm vẫn lưu, có nút gửi lại; gửi lại thành công không gửi trùng.
- [ ] Gửi email thật qua EmailJS (chưa có khóa).
- [x] Điểm khớp tính tay với các bài mẫu (10, 6, 3, 6, 0 → TB 5).
- [x] Trang giảng viên: thống kê, lọc không dấu, sắp xếp, chấm bài bỏ dở, cho thi lại, CSV có BOM.
- [x] Nhập dữ liệu: xuất → nhập lại Excel và CSV khớp 100%; file lỗi báo đúng 8 lỗi kèm số dòng; dùng thử → SV mới vào đúng đề mới; quay về dữ liệu gốc.
- [ ] Mở file mẫu .xlsx / .csv bằng Microsoft Excel thật.
- [ ] Edge, Firefox, điện thoại thật (Fullscreen API trên iPhone Safari không có — đã có phương án dự phòng).

---

## 10. Dàn ý báo cáo (theo khuôn SkyCast)

| Mục | Nội dung |
|---|---|
| Bìa, Trích yếu, Mục lục, Lời cảm ơn | Như mẫu |
| **1. Nhập đề** | Thực trạng thi trên giấy / thi online dễ gian lận; mục tiêu; đối tượng; phạm vi |
| **2. Kỹ thuật thiết kế website** | 2.1 Bố cục & điều hướng · 2.2 CSS (biến màu, Grid/Flex) · 2.3 Tương tác & trạng thái (navigator, đồng hồ, modal) · 2.4 Kiến trúc lớp dữ liệu `api.js` (adapter) · 2.5 Chống gian lận phía trình duyệt & giới hạn · 2.6 Responsive |
| **3. Công cụ đồ họa đã sử dụng** | Photoshop/Figma (logo, banner, wireframe), bộ icon, VS Code, EmailJS, GitHub Pages |
| **4. Nội dung website** | Từng trang: Trang chủ, Đăng nhập, Phòng thi, Kết quả, Giảng viên, **Nhập dữ liệu** (mục 11.1–11.3), Giới thiệu |
| **5. Hướng dẫn sử dụng** | 5.1 Sinh viên vào thi · 5.2 Làm bài & quay lại câu · 5.3 Nộp bài / hết giờ · 5.4 Giảng viên xem kết quả · **5.5 Giảng viên nhập danh sách sinh viên & đề thi** (mục 11.4) |
| **Hạn chế & hướng phát triển** | Nội dung mục 7 (vì sao cần server, kế hoạch chuyển) — điểm cộng khi bảo vệ |
| Tài liệu tham khảo, Phụ lục | MDN (Fullscreen, Page Visibility, File API), EmailJS docs, SheetJS docs, JSZip docs; sitemap, ảnh chụp màn hình, file mẫu Excel (mục 11.2), bảng kiểm thử (mục 9, 11.5) |

---

## 11. Tài liệu cho báo cáo — chức năng Nhập dữ liệu

Phần này viết sẵn để đưa vào **chương 4 (Nội dung website)** và **chương 5 (Hướng dẫn sử dụng)**.

### 11.1 Mục đích
Trước đây, muốn đổi danh sách sinh viên hay đề thi phải sửa trực tiếp các file mã nguồn trong thư mục `data/`, dễ sai cú pháp (thiếu dấu phẩy, dấu nháy) làm website không tải được đề. Trang **Nhập dữ liệu** cho phép giảng viên soạn dữ liệu bằng Excel quen thuộc, website tự kiểm tra lỗi và tự tạo các file dữ liệu đúng định dạng.

### 11.2 Định dạng file mẫu
File mẫu Excel gồm 3 sheet: **SinhVien**, **DeThi**, **HuongDan**. Có thể dùng từng file CSV thay cho từng sheet.

**Sheet SinhVien** — mỗi dòng một sinh viên

| Cột | Bắt buộc | Quy định |
|---|---|---|
| MSSV | Có | Chữ và số, 3–20 ký tự, không trùng. Nên định dạng cột là Text. |
| Họ tên | Có | |
| Lớp | Không | |
| Mã đề | Có | Phải có đề tương ứng (trong sheet DeThi hoặc đã có trên website). |
| Email | Không | Dùng khi gửi bản sao kết quả cho sinh viên. |

**Sheet DeThi** — mỗi dòng một câu hỏi

| Cột | Bắt buộc | Quy định |
|---|---|---|
| Mã đề | Dòng đầu của mỗi đề | Chữ, số, "-", "_" (tối đa 20 ký tự). Các dòng sau để trống = cùng đề. |
| Tiêu đề | Dòng đầu của mỗi đề | |
| Thời gian (phút) | Dòng đầu của mỗi đề | Số từ 1 đến 600. |
| STT | Không | Chỉ để dễ đọc; thứ tự câu theo thứ tự dòng. |
| Nội dung câu hỏi | Có | |
| A, B, C, D (E, F) | Ít nhất 2 | Không bỏ trống ở giữa. |
| Đáp án | Có | Một chữ A–F (viết hoa hay thường đều được). |

Tên cột không phân biệt hoa/thường, có dấu hay không dấu ("Họ và tên", "ho ten" đều nhận). CSV có thể phân cách bằng dấu phẩy hoặc chấm phẩy, mã hóa UTF-8 hoặc Windows-1258.

### 11.3 Quy trình xử lý & quy tắc kiểm tra

```
Chọn file (.xlsx/.xls/.csv) ─► Đọc file (SheetJS cho Excel, bộ đọc CSV tự viết)
   ─► Nhận diện bảng theo tên cột ─► Kiểm tra từng dòng ─► Kiểm tra mã đề (qua API)
   ─► Hiện lỗi / cảnh báo + xem trước
   ─► (không còn lỗi) Áp dụng: Dùng thử trên trình duyệt này  |  Tải gói .zip  |  (bản server) Lưu CSDL
```

| Loại | Quy tắc | Mức |
|---|---|---|
| Sinh viên | Thiếu MSSV / họ tên / mã đề | Lỗi |
| | MSSV không phải chữ-số (VD Excel đổi thành `2.31E+07`) | Lỗi |
| | MSSV trùng (báo kèm dòng bị trùng) | Lỗi |
| | Mã đề chưa có đề thi | Lỗi |
| | Email sai định dạng (bỏ trống email) | Cảnh báo |
| Đề thi | Thiếu mã đề / mã đề có ký tự lạ | Lỗi |
| | Đề thiếu thời gian, thời gian ngoài 1–600 phút | Lỗi |
| | Câu thiếu nội dung, dưới 2 lựa chọn, lựa chọn trống ở giữa | Lỗi |
| | Thiếu đáp án, đáp án không phải A–F, đáp án trỏ vào ô trống | Lỗi |
| | Đề không có câu hợp lệ nào | Lỗi |
| | Thiếu tiêu đề (tự đặt "Bài thi <mã đề>"), hai lựa chọn giống nhau, câu trùng, đề chưa gán cho SV | Cảnh báo |

Mọi lỗi đều chỉ rõ **tên file · số dòng** như trong Excel. Còn lỗi thì nút Áp dụng bị ẩn — dữ liệu đang dùng không bị thay đổi.

Về kỹ thuật: module `data-importer.js` không phụ thuộc giao diện và trả về đúng đối tượng `{ students, exams, answers }` mà hàm `API.admin.importData()` nhận, nên khi chuyển lên server chỉ việc gửi đối tượng đó lên (mục 7). Các file `.js` sinh ra dùng `JSON.stringify` nên mọi dấu nháy, dấu phẩy trong nội dung câu hỏi đều được xử lý an toàn.

### 11.4 Hướng dẫn sử dụng (chương 5.5)
1. Vào **Giảng viên**, đăng nhập, bấm **Nhập dữ liệu**.
2. **Bước 1 — Chuẩn bị file:** bấm **File mẫu Excel (.xlsx)** (hoặc **Xuất dữ liệu hiện có** để sửa dữ liệu đang dùng). Điền sheet SinhVien và/hoặc DeThi theo bảng ở mục 11.2. Có thể chỉ nhập một trong hai.
3. **Bước 2 — Chọn file:** kéo thả file vào khung hoặc bấm để chọn (chọn được nhiều file cùng lúc).
4. **Bước 3 — Kiểm tra:** đọc bảng lỗi/cảnh báo. Nếu có lỗi, sửa đúng dòng được chỉ ra trong Excel, lưu lại và chọn lại file. Mở phần xem trước để soát danh sách và đáp án đúng (tô xanh).
5. **Bước 4 — Áp dụng:**
   - **Dùng thử dữ liệu này:** áp dụng ngay trên máy đang dùng — hợp để thi thử, demo trên lớp. Trang giảng viên hiện thông báo "Đang dùng dữ liệu nhập thử"; bấm **Quay về dữ liệu gốc** để hủy.
   - **Tải gói dữ liệu (.zip):** giải nén, chép thư mục `data` vào thư mục website (chọn Thay thế), tải lại trang; nếu website trên GitHub Pages thì tải các file mới lên repository. Cách này áp dụng cho mọi máy.
6. **Thông tin giảng viên:** nhập email nhận kết quả và mật khẩu mới, bấm **Sao chép đoạn cấu hình**, dán vào `js/config.js`.

Lưu ý: nhập danh sách sinh viên mới sẽ **thay toàn bộ** danh sách cũ; nhập đề sẽ **thêm hoặc thay** đúng các mã đề trong file. Bài làm đã có của sinh viên vẫn được giữ; muốn sinh viên làm lại đề mới thì dùng **Cho thi lại**.

### 11.5 Kết quả kiểm thử chức năng

| # | Trường hợp | Kết quả mong đợi | Kết quả |
|---|---|---|---|
| 1 | Xuất dữ liệu hiện có ra Excel rồi nhập lại | 10 SV, 3 đề, đáp án giống hệt; 0 lỗi | Đạt |
| 2 | Như trên với 2 file CSV | Giống hệt; 0 lỗi | Đạt |
| 3 | CSV dấu `;`, có MSSV trùng, thiếu MSSV, MSSV dạng `2.31E+07`, mã đề không tồn tại, email sai | Báo đúng từng lỗi kèm số dòng; email sai là cảnh báo | Đạt |
| 4 | Đề có câu thiếu đáp án, lựa chọn trống giữa, đáp án trỏ ô trống, đề thiếu thời gian | Báo đúng 4 lỗi; ẩn bước Áp dụng | Đạt |
| 5 | Mã đề viết thường (`de04`), đáp án viết thường (`a`), câu 5 lựa chọn (đáp án E), câu 2 lựa chọn | Tự chuẩn hóa, nhận đúng | Đạt |
| 6 | Nội dung có dấu phẩy, nháy đơn, nháy kép | File `.js` sinh ra chạy được, nội dung giữ nguyên | Đạt |
| 7 | Dùng thử → SV mới đăng nhập | Vào đúng đề mới; SV cũ không còn trong danh sách; chấm điểm đúng (2/3 câu → 6,75) | Đạt |
| 8 | Quay về dữ liệu gốc | SV cũ vào lại được, SV mới bị từ chối | Đạt |
| 9 | Gói .zip | Gồm `data/students.js` (+ `data/exams`, `data/answers` khi có đề) và `HUONG_DAN.txt` | Đạt |
| 10 | Giao diện điện thoại 375px | Không tràn ngang | Đạt |

### 11.6 Giới hạn
- Bản tĩnh không tự ghi file lên website được, nên "áp dụng cho mọi máy" cần chép gói `.zip` thủ công; "Dùng thử" chỉ có tác dụng trên một trình duyệt.
- Đọc file Excel và tạo `.zip` cần Internet để tải thư viện SheetJS / JSZip (lần đầu); file CSV đọc được không cần mạng.
- Chỉ có một tài khoản giảng viên. Nhiều tài khoản và phân quyền cần server.

/* =========================================================
   ServerAdapter — KHUNG SẴN cho bản có backend (chưa dùng trong đồ án)
   Bật bằng: CONFIG.MODE = 'server' và CONFIG.API_BASE_URL = '<địa chỉ backend>'.

   Backend phải trả JSON đúng định dạng như LocalAdapter trả về
   (xem bảng "Hợp đồng API" trong ke_hoach_website_thi_trac_nghiem.md, mục 5).
   Khi lỗi: HTTP status ≠ 2xx và body { code: 'NOT_FOUND', message: '...' }.

   Việc backend phải tự làm (không tin trình duyệt):
   - startExam: ghi startedAt/deadline bằng giờ server; đã có lượt chưa nộp → trả lại lượt đó.
   - getQuestions: KHÔNG gửi đáp án.
   - submitExam: tự chấm điểm, từ chối bài nộp sau deadline + ~30 giây, chỉ nhận lần nộp đầu, gửi email.
   - Trả về serverNow (ms) để đồng hồ trên máy sinh viên tự căn theo giờ server.

   Ghi chú Google Apps Script: Web App chỉ có doGet/doPost một địa chỉ, nên thay vì nhiều đường dẫn,
   hãy gửi { action: 'login', ... } bằng POST với 'Content-Type: text/plain' (tránh lỗi CORS preflight)
   — sửa hàm call() bên dưới cho phù hợp.
   ========================================================= */
window.ServerAdapter = (() => {
  async function call(method, path, body, token) {
    let res;
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;   // các API giảng viên
    try {
      res = await fetch(CONFIG.API_BASE_URL.replace(/\/$/, '') + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (e) {
      throw new ApiError('NETWORK', 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.');
    }
    let data = null;
    try { data = await res.json(); } catch (e) { /* body rỗng */ }
    if (!res.ok) throw new ApiError(data?.code || 'HTTP_' + res.status, data?.message || `Máy chủ báo lỗi (${res.status}).`);
    return data;
  }
  const id = attemptId => encodeURIComponent(attemptId);

  return {
    login:           mssv                       => call('POST', '/api/login', { mssv }),
    startExam:       mssv                       => call('POST', '/api/attempts', { mssv }),
    getQuestions:    attemptId                  => call('GET',  `/api/attempts/${id(attemptId)}/questions`),
    saveProgress:    (attemptId, progress)      => call('PUT',  `/api/attempts/${id(attemptId)}/progress`, progress),
    reportViolation: (attemptId, violation)     => call('POST', `/api/attempts/${id(attemptId)}/violations`, violation),
    submitExam:      (attemptId, answers, reason) => call('POST', `/api/attempts/${id(attemptId)}/submit`, { answers, reason }),
    getResult:       attemptId                  => call('GET',  `/api/attempts/${id(attemptId)}/result`),
    resendResultEmail: attemptId                => call('POST', `/api/attempts/${id(attemptId)}/email`),

    // Giảng viên — server kiểm tra token ở mọi request
    adminLogin:       password                  => call('POST', '/api/admin/login', { password }),
    getResults:       token                     => call('GET',  '/api/admin/results', null, token),
    getAttemptDetail: (token, mssv)             => call('GET',  `/api/admin/students/${encodeURIComponent(mssv)}`, null, token),
    resetAttempt:     (token, mssv)             => call('DELETE', `/api/admin/students/${encodeURIComponent(mssv)}/attempt`, null, token),
    forceSubmit:      (token, mssv)             => call('POST', `/api/admin/students/${encodeURIComponent(mssv)}/submit`, null, token),

    // Nhập / xuất dữ liệu: server lưu thẳng vào CSDL / Google Sheet (không cần tải file .js)
    exportData:        token                    => call('GET',  '/api/admin/data', null, token),
    checkExams:        (token, codes)           => call('POST', '/api/admin/exams/check', { codes }, token),
    importData:        (token, payload)         => call('PUT',  '/api/admin/data', payload, token),     // → { scope: 'server', importedAt }
    clearImportedData: token                    => call('DELETE', '/api/admin/data/import', null, token), // tùy chọn: khôi phục bản trước
    getDataSource:     token                    => call('GET',  '/api/admin/data/source', null, token)
  };
})();

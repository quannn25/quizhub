/* =========================================================
   API — LỚP DỮ LIỆU DUY NHẤT
   Mọi trang chỉ gọi API.xxx(). Không trang nào đọc thư mục data/, localStorage bài làm,
   hay tự chấm điểm. Đổi CONFIG.MODE là đổi nơi xử lý, giao diện giữ nguyên.

   API.login(mssv)                              → { student, exam, attempt|null, serverNow }
   API.startExam(mssv)                          → { attemptId, startedAt, deadline, answers, flagged, violations, serverNow }
   API.getQuestions(attemptId)                  → { maDe, tieuDe, cauHoi: [{ id, noiDung, luaChon[] }] }   (không có đáp án)
   API.saveProgress(attemptId, {answers, flagged}) → { savedAt }
   API.reportViolation(attemptId, {type, at})   → { count }
   API.submitExam(attemptId, answers, reason)   → kết quả (score, correct, total, …, detail[])
   API.getResult(attemptId)                     → kết quả như trên (có email: { status: 'sent'|'failed'|'disabled', … })
   API.resendResultEmail(attemptId)             → { status, at, to?, error? }

   Giảng viên (token lưu trong sessionStorage, tự gắn vào mỗi lời gọi):
   API.admin.login(password)                    → { token, name }
   API.admin.getResults()                       → { generatedAt, scope, rows: [{ mssv, hoTen, maDe, status, score, … }] }
   API.admin.getAttemptDetail(mssv)             → { student, status, startedAt, deadline, violationLog, result|null }
   API.admin.resetAttempt(mssv)                 → { ok }      (cho thi lại)
   API.admin.forceSubmit(mssv)                  → kết quả     (chấm bài hết giờ chưa nộp)
   status = 'not_started' | 'in_progress' | 'expired' | 'submitted'

   Nhập dữ liệu (import.html):
   API.admin.exportData()                       → { students[], exams{maDe: đề}, answers{maDe: đáp án} }
   API.admin.checkExams(['DE01', …])            → { DE01: true, … }
   API.admin.importData({ students?, exams?, answers? }) → { scope: 'this_browser' | 'server', importedAt }
   API.admin.clearImportedData()                → { ok }
   API.admin.getDataSource()                    → { source: 'files' | 'imported', importedAt?, students?, exams? }

   answers = { [idCâu]: chỉSốLựaChọn }   ví dụ { q1: 0, q2: 3 }
   reason  = 'manual' | 'timeout' | 'violation'
   ========================================================= */
const API = (() => {
  const adapter = CONFIG.MODE === 'server' ? window.ServerAdapter : window.LocalAdapter;
  if (!adapter) throw new Error(`Chưa nạp adapter cho chế độ "${CONFIG.MODE}". Kiểm tra thẻ <script> trong trang.`);

  // Phiên đăng nhập của tab hiện tại (ai đang thi, lượt thi nào) — dùng chung cho cả 2 chế độ.
  const SESSION_KEY = 'quiz.session';
  const session = {
    get() {
      try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
    },
    set(value) {
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch (e) { /* bỏ qua */ }
    },
    clear() {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* bỏ qua */ }
    }
  };

  // Phiên giảng viên (token) — lưu theo tab
  const ADMIN_KEY = 'quiz.admin';
  const adminSession = {
    get() { try { return JSON.parse(sessionStorage.getItem(ADMIN_KEY)); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(ADMIN_KEY, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } },
    clear() { try { sessionStorage.removeItem(ADMIN_KEY); } catch (e) { /* bỏ qua */ } }
  };
  function adminToken() {
    const s = adminSession.get();
    if (!s?.token) throw new ApiError('UNAUTHORIZED', 'Vui lòng đăng nhập giảng viên.');
    return s.token;
  }
  const admin = {
    async login(password) {
      const r = await adapter.adminLogin(password);
      adminSession.set(r);
      return r;
    },
    logout: () => adminSession.clear(),
    isLoggedIn: () => !!adminSession.get()?.token,
    getResults: () => adapter.getResults(adminToken()),
    getAttemptDetail: mssv => adapter.getAttemptDetail(adminToken(), mssv),
    resetAttempt: mssv => adapter.resetAttempt(adminToken(), mssv),
    forceSubmit: mssv => adapter.forceSubmit(adminToken(), mssv),
    exportData: () => adapter.exportData(adminToken()),
    checkExams: codes => adapter.checkExams(adminToken(), codes),
    importData: payload => adapter.importData(adminToken(), payload),
    clearImportedData: () => adapter.clearImportedData(adminToken()),
    getDataSource: () => adapter.getDataSource(adminToken())
  };

  return {
    admin,
    login: (...a) => adapter.login(...a),
    startExam: (...a) => adapter.startExam(...a),
    getQuestions: (...a) => adapter.getQuestions(...a),
    saveProgress: (...a) => adapter.saveProgress(...a),
    reportViolation: (...a) => adapter.reportViolation(...a),
    submitExam: (...a) => adapter.submitExam(...a),
    getResult: (...a) => adapter.getResult(...a),
    resendResultEmail: (...a) => adapter.resendResultEmail(...a),
    session
  };
})();

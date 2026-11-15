/* =========================================================
   LocalAdapter — bản ĐỒ ÁN (không có server)
   - Đọc danh sách SV / đề / đáp án từ thư mục data/ (nạp bằng thẻ <script>
     nên chạy được cả khi mở file trực tiếp, không cần Live Server).
   - Lưu lượt thi vào localStorage của trình duyệt.
   - Chấm điểm ngay trên trình duyệt.
   Mọi hàm trả về Promise và có cùng "hợp đồng" với ServerAdapter.
   KHI LÊN SERVER: file này cùng thư mục data/ không còn được dùng — xóa khỏi bản deploy.
   ========================================================= */
window.LocalAdapter = (() => {
  window.QUIZ_DATA = window.QUIZ_DATA || { exams: {}, answers: {} };
  const NS = 'quiz.local.';

  /* ---- lưu trữ (localStorage, bọc try/catch vì có thể bị chặn) ---- */
  const store = {
    get(key) {
      try { return JSON.parse(localStorage.getItem(NS + key)); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(NS + key, JSON.stringify(value)); }
      catch (e) { throw new ApiError('STORAGE_FAILED', 'Trình duyệt không cho lưu dữ liệu (chế độ ẩn danh?). Bài làm có thể bị mất khi tải lại trang.'); }
    },
    remove(key) {
      try { localStorage.removeItem(NS + key); } catch (e) { /* bỏ qua */ }
    }
  };

  const ADMIN_TOKEN = 'local-admin';
  function requireAdmin(token) {
    if (token !== ADMIN_TOKEN) throw new ApiError('UNAUTHORIZED', 'Phiên đăng nhập giảng viên đã hết. Vui lòng đăng nhập lại.');
  }
  // Trạng thái lượt thi cho trang giảng viên
  function statusOf(a, now) {
    if (!a) return 'not_started';
    if (a.submitted) return 'submitted';
    return a.deadline <= now ? 'expired' : 'in_progress';
  }

  /* ---- nạp file dữ liệu ---- */
  const loading = {};
  function loadScript(src) {
    if (!loading[src]) {
      loading[src] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => { delete loading[src]; s.remove(); reject(new ApiError('LOAD_FAILED', `Không tải được dữ liệu (${src}).`)); };
        document.head.appendChild(s);
      });
    }
    return loading[src];
  }
  // Dữ liệu "nhập thử" từ trang Nhập dữ liệu (chỉ trên trình duyệt này) — ưu tiên hơn file trong data/
  const imported = () => store.get('imported');

  async function getStudents() {
    const o = imported();
    if (o?.students) return o.students;
    if (!QUIZ_DATA.students) await loadScript('data/students.js');
    return QUIZ_DATA.students || [];
  }
  async function findStudent(mssv) {
    const st = (await getStudents()).find(s => s.mssv === mssv);
    if (!st) throw new ApiError('NOT_FOUND', 'Không tìm thấy MSSV trong danh sách dự thi. Vui lòng kiểm tra lại.');
    return st;
  }
  async function getExam(maDe) {
    const o = imported();
    if (o?.exams?.[maDe]) return o.exams[maDe];
    if (!QUIZ_DATA.exams[maDe]) await loadScript(`data/exams/${encodeURIComponent(maDe)}.js`);
    const exam = QUIZ_DATA.exams[maDe];
    if (!exam) throw new ApiError('EXAM_NOT_FOUND', `Không tìm thấy đề ${maDe}.`);
    return exam;
  }
  // Chỉ gọi lúc chấm điểm → đáp án không được nạp trong lúc sinh viên đang làm bài.
  async function getAnswerKey(maDe) {
    const o = imported();
    if (o?.answers?.[maDe]) return o.answers[maDe];
    if (!QUIZ_DATA.answers[maDe]) await loadScript(`data/answers/${encodeURIComponent(maDe)}.js`);
    const key = QUIZ_DATA.answers[maDe];
    if (!key) throw new ApiError('KEY_NOT_FOUND', `Không tìm thấy đáp án đề ${maDe}.`);
    return key;
  }

  const normalizeMssv = v => String(v ?? '').trim().toUpperCase();
  const durationMin = exam => CONFIG.DURATION_OVERRIDE_MIN || exam.thoiGian;
  const attemptIdOf = mssv => 'A-' + mssv;

  function loadAttempt(attemptId) {
    const a = store.get('attempt.' + String(attemptId).replace(/^A-/, ''));
    if (!a) throw new ApiError('NO_ATTEMPT', 'Không tìm thấy lượt thi. Vui lòng đăng nhập lại.');
    return a;
  }
  const saveAttempt = a => store.set('attempt.' + a.mssv, a);

  // Thông tin lượt thi gửi cho giao diện (không lộ kết quả, không lộ đáp án)
  const publicAttempt = a => ({
    attemptId: a.attemptId, mssv: a.mssv, maDe: a.maDe,
    startedAt: a.startedAt, deadline: a.deadline,
    answers: { ...a.answers }, flagged: [...a.flagged],
    violations: a.violations.length,
    serverNow: Date.now()
  });

  // Gửi email kết quả, ghi trạng thái vào lượt thi. Không bao giờ làm hỏng việc nộp bài.
  async function emailResult(a, st) {
    a.result.email = { status: 'sending', at: Date.now() };
    a.result.email = window.EmailJsMailer
      ? await window.EmailJsMailer.send(a.result, st.email)
      : { status: 'disabled', at: Date.now() };
    saveAttempt(a);
    return a.result.email;
  }

  // Ẩn đáp án nếu giảng viên không cho xem
  function publicResult(r) {
    if (CONFIG.SHOW_ANSWERS_AFTER_SUBMIT) return r;
    return { ...r, detail: r.detail.map(({ id, noiDung, luaChon, chon }) => ({ id, noiDung, luaChon, chon })) };
  }

  return {
    async login(mssvInput) {
      const mssv = normalizeMssv(mssvInput);
      if (!mssv) throw new ApiError('EMPTY', 'Vui lòng nhập mã số sinh viên.');
      const st = await findStudent(mssv);
      const exam = await getExam(st.maDe);
      const a = store.get('attempt.' + mssv);
      return {
        student: { mssv: st.mssv, hoTen: st.hoTen, lop: st.lop },
        exam: { maDe: exam.maDe, tieuDe: exam.tieuDe, thoiGian: durationMin(exam), soCau: exam.cauHoi.length },
        attempt: a ? {
          attemptId: a.attemptId,
          status: a.submitted ? 'submitted' : 'in_progress',
          deadline: a.deadline,
          submittedAt: a.result?.submittedAt ?? null
        } : null,
        serverNow: Date.now()
      };
    },

    // Bắt đầu thi. Nếu đã có lượt chưa nộp thì trả lại lượt đó (tải lại trang không mất bài, không reset giờ).
    async startExam(mssvInput) {
      const mssv = normalizeMssv(mssvInput);
      const st = await findStudent(mssv);
      const existing = store.get('attempt.' + mssv);
      if (existing) {
        if (existing.submitted) throw new ApiError('ALREADY_SUBMITTED', 'Bạn đã nộp bài, không thể thi lại.');
        return publicAttempt(existing);
      }
      const exam = await getExam(st.maDe);
      const now = Date.now();
      const a = {
        attemptId: attemptIdOf(mssv), mssv, maDe: st.maDe,
        startedAt: now, deadline: now + durationMin(exam) * 60000,
        answers: {}, flagged: [], violations: [],
        submitted: false, result: null
      };
      saveAttempt(a);
      return publicAttempt(a);
    },

    // Đề thi KHÔNG kèm đáp án
    async getQuestions(attemptId) {
      const a = loadAttempt(attemptId);
      const exam = await getExam(a.maDe);
      return {
        maDe: exam.maDe,
        tieuDe: exam.tieuDe,
        cauHoi: exam.cauHoi.map(q => ({ id: q.id, noiDung: q.noiDung, luaChon: [...q.luaChon] }))
      };
    },

    async saveProgress(attemptId, { answers, flagged }) {
      const a = loadAttempt(attemptId);
      if (a.submitted) throw new ApiError('ALREADY_SUBMITTED', 'Bài đã được nộp.');
      a.answers = { ...answers };
      a.flagged = [...flagged];
      a.updatedAt = Date.now();
      saveAttempt(a);
      return { savedAt: a.updatedAt };
    },

    async reportViolation(attemptId, violation) {
      const a = loadAttempt(attemptId);
      if (!a.submitted) {
        a.violations.push({ type: violation.type, at: violation.at ?? Date.now() });
        saveAttempt(a);
      }
      return { count: a.violations.length };
    },

    // Chấm điểm. Gọi lại nhiều lần vẫn chỉ tính lần nộp đầu tiên.
    async submitExam(attemptId, answers, reason = 'manual') {
      const a = loadAttempt(attemptId);
      if (a.submitted) return publicResult(a.result);

      const [exam, key, st] = await Promise.all([getExam(a.maDe), getAnswerKey(a.maDe), findStudent(a.mssv)]);
      const now = Date.now();
      let correct = 0, answered = 0;
      const detail = exam.cauHoi.map(q => {
        const chon = Number.isInteger(answers[q.id]) ? answers[q.id] : null;
        const dapAn = key[q.id];
        const dung = chon !== null && chon === dapAn;
        if (chon !== null) answered++;
        if (dung) correct++;
        return { id: q.id, noiDung: q.noiDung, luaChon: [...q.luaChon], chon, dapAn, dung };
      });
      const total = exam.cauHoi.length;
      const step = CONFIG.SCORE_STEP || 0.01;
      const score = Math.round((correct / total) * 10 / step) * step;

      a.answers = { ...answers };
      a.submitted = true;
      a.result = {
        attemptId: a.attemptId, mssv: a.mssv, hoTen: st.hoTen, lop: st.lop,
        maDe: exam.maDe, tieuDe: exam.tieuDe,
        score, correct, total, answered,
        reason, startedAt: a.startedAt, submittedAt: now,
        durationMs: Math.min(now, a.deadline) - a.startedAt,
        violations: a.violations.length,
        violationLog: a.violations,
        detail,
        email: { status: 'pending' }
      };
      saveAttempt(a);            // lưu điểm TRƯỚC, rồi mới gửi email → mất mạng cũng không mất bài
      await emailResult(a, st);
      return publicResult(a.result);
    },

    // Gửi lại email (khi lần trước lỗi mạng). Đã gửi thành công thì không gửi trùng.
    async resendResultEmail(attemptId) {
      const a = loadAttempt(attemptId);
      if (!a.submitted) throw new ApiError('NOT_SUBMITTED', 'Bài thi chưa được nộp.');
      if (a.result.email?.status === 'sent') return a.result.email;
      return emailResult(a, await findStudent(a.mssv));
    },

    async getResult(attemptId) {
      const a = loadAttempt(attemptId);
      if (!a.submitted) throw new ApiError('NOT_SUBMITTED', 'Bài thi chưa được nộp.');
      return publicResult(a.result);
    },

    /* ================= GIẢNG VIÊN ================= */

    async adminLogin(password) {
      if (!CONFIG.ADMIN_PASSWORD || String(password) !== CONFIG.ADMIN_PASSWORD) {
        throw new ApiError('WRONG_PASSWORD', 'Mật khẩu không đúng.');
      }
      return { token: ADMIN_TOKEN, name: 'Giảng viên' };
    },

    // Bảng tổng hợp cả lớp. Bản tĩnh chỉ thấy các lượt thi làm trên TRÌNH DUYỆT NÀY.
    async getResults(token) {
      requireAdmin(token);
      const students = await getStudents();
      const exams = {};
      for (const maDe of new Set(students.map(s => s.maDe))) {
        try { exams[maDe] = await getExam(maDe); } catch (e) { exams[maDe] = null; }
      }
      const now = Date.now();
      return {
        generatedAt: now,
        scope: 'this_browser',
        rows: students.map(st => {
          const a = store.get('attempt.' + st.mssv);
          const r = a?.result;
          return {
            mssv: st.mssv, hoTen: st.hoTen, lop: st.lop, maDe: st.maDe,
            status: statusOf(a, now),
            total: exams[st.maDe]?.cauHoi.length ?? null,
            answered: r ? r.answered : a ? Object.keys(a.answers).length : 0,
            violations: a ? a.violations.length : 0,
            startedAt: a?.startedAt ?? null,
            deadline: a?.deadline ?? null,
            score: r?.score ?? null,
            correct: r?.correct ?? null,
            submittedAt: r?.submittedAt ?? null,
            durationMs: r?.durationMs ?? null,
            reason: r?.reason ?? null,
            emailStatus: r?.email?.status ?? null
          };
        })
      };
    },

    // Chi tiết một sinh viên — giảng viên luôn thấy đáp án đúng
    async getAttemptDetail(token, mssv) {
      requireAdmin(token);
      const st = await findStudent(normalizeMssv(mssv));
      const a = store.get('attempt.' + st.mssv);
      const now = Date.now();
      const base = { student: { mssv: st.mssv, hoTen: st.hoTen, lop: st.lop, maDe: st.maDe }, status: statusOf(a, now), serverNow: now };
      if (!a) return base;
      return {
        ...base,
        startedAt: a.startedAt,
        deadline: a.deadline,
        violationLog: [...a.violations],
        answered: Object.keys(a.answers).length,
        result: a.result   // null nếu chưa nộp
      };
    },

    // Cho thi lại: xóa lượt thi hiện tại (VD sinh viên bị mất điện, máy hỏng)
    async resetAttempt(token, mssv) {
      requireAdmin(token);
      const st = await findStudent(normalizeMssv(mssv));
      store.remove('attempt.' + st.mssv);
      return { ok: true };
    },

    /* ---- Nhập / xuất dữ liệu (trang import.html) ---- */

    // Toàn bộ dữ liệu đang dùng: danh sách SV + các đề mà SV được gán (+ đề đã nhập thử)
    async exportData(token) {
      requireAdmin(token);
      const students = await getStudents();
      const codes = new Set([...students.map(s => s.maDe), ...Object.keys(imported()?.exams || {})]);
      const exams = {}, answers = {};
      for (const code of codes) {
        try {
          exams[code] = await getExam(code);
          answers[code] = await getAnswerKey(code);
        } catch (e) { /* đề chưa có file → bỏ qua */ }
      }
      return { students, exams, answers };
    },

    // { DE01: true, DE09: false } — mã đề nào đã có đề
    async checkExams(token, codes) {
      requireAdmin(token);
      const out = {};
      for (const code of codes) {
        try { await getExam(code); out[code] = true; } catch (e) { out[code] = false; }
      }
      return out;
    },

    // Bản tĩnh: lưu vào localStorage của trình duyệt này để dùng thử ngay.
    // Muốn áp dụng cho mọi máy: tải các file .js do trang Nhập dữ liệu tạo và chép vào thư mục data/.
    async importData(token, { students, exams, answers }) {
      requireAdmin(token);
      const o = imported() || { exams: {}, answers: {} };
      if (students) o.students = students;
      Object.assign(o.exams, exams || {});
      Object.assign(o.answers, answers || {});
      o.importedAt = Date.now();
      store.set('imported', o);
      return { scope: 'this_browser', importedAt: o.importedAt };
    },

    async clearImportedData(token) {
      requireAdmin(token);
      store.remove('imported');
      return { ok: true };
    },

    async getDataSource(token) {
      requireAdmin(token);
      const o = imported();
      if (!o) return { source: 'files' };
      return {
        source: 'imported',
        importedAt: o.importedAt,
        students: o.students ? o.students.length : null,
        exams: Object.keys(o.exams || {})
      };
    },

    // Chấm bài đã hết giờ nhưng chưa nộp (sinh viên đóng trình duyệt giữa chừng)
    async forceSubmit(token, mssv) {
      requireAdmin(token);
      const id = attemptIdOf(normalizeMssv(mssv));
      const a = loadAttempt(id);
      if (a.submitted) return publicResult(a.result);
      return this.submitExam(id, a.answers, 'timeout');
    }
  };
})();

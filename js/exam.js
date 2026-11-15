/* =========================================================
   Phòng thi
   - Lấy lượt thi + đề qua API (không bao giờ thấy đáp án).
   - Chọn đáp án, đánh dấu, chuyển câu; lưu tạm sau mỗi thay đổi.
   - Đồng hồ theo deadline; hết giờ tự nộp.
   - Nộp bài qua API.submitExam → sang trang kết quả.
   ========================================================= */
(() => {
  const state = {
    attemptId: null,
    questions: [],
    answers: {},          // { idCâu: chỉSố }
    flagged: new Set(),   // id câu đánh dấu xem lại
    current: 0,
    submitting: false,
    submitted: false,
    timer: null,
    proctor: null,
    warned: { warn: false, danger: false }
  };

  const el = {
    root: $('#exam-root'),
    title: $('#exam-title'),
    student: $('#exam-student'),
    done: $('#stat-done'),
    left: $('#stat-left'),
    violation: $('#stat-violation'),
    violationBox: $('#stat-violation-box'),
    proctorOverlay: $('#proctor-overlay'),
    timer: $('#timer'),
    timerValue: $('#timer-value'),
    progress: $('#progress-bar'),
    qIndex: $('#q-index'),
    qText: $('#q-text'),
    options: $('#options'),
    flagBtn: $('#flag-btn'),
    prevBtn: $('#prev-btn'),
    nextBtn: $('#next-btn'),
    clearBtn: $('#clear-btn'),
    navGrid: $('#nav-grid'),
    saveStatus: $('#save-status'),
    submitBtn: $('#submit-btn'),
    overlay: $('#overlay'),
    overlaySpinner: $('#overlay-spinner'),
    overlayTitle: $('#overlay-title'),
    overlayText: $('#overlay-text'),
    overlayActions: $('#overlay-actions')
  };

  /* ---------- Lớp phủ ---------- */
  function showOverlay(title, text = '', { spinner = true, actions = [] } = {}) {
    el.overlayTitle.textContent = title;
    el.overlayText.textContent = text;
    el.overlaySpinner.hidden = !spinner;
    el.overlayActions.innerHTML = '';
    actions.forEach(({ label, primary, onClick }) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (primary ? 'btn-primary' : 'btn-outline');
      b.textContent = label;
      b.addEventListener('click', onClick);
      el.overlayActions.appendChild(b);
    });
    el.overlay.hidden = false;
    el.overlayActions.querySelector('button')?.focus();
  }
  const hideOverlay = () => { el.overlay.hidden = true; };

  /* ---------- Khởi động ---------- */
  async function init() {
    const sess = API.session.get();
    if (!sess?.mssv) { location.replace('login.html'); return; }

    try {
      // startExam trả lại lượt đang làm dở nếu có → tải lại trang không mất bài, không reset giờ.
      const attempt = await API.startExam(sess.mssv);
      const exam = await API.getQuestions(attempt.attemptId);
      API.session.set({ ...sess, attemptId: attempt.attemptId });

      state.attemptId = attempt.attemptId;
      state.questions = exam.cauHoi;
      state.answers = { ...attempt.answers };
      state.flagged = new Set(attempt.flagged);

      el.title.textContent = `${exam.tieuDe} · Mã đề ${exam.maDe}`;
      el.student.textContent = `MSSV ${attempt.mssv}`;
      document.title = `Phòng thi ${exam.maDe} — ${CONFIG.APP_NAME}`;

      buildNavigator();
      const firstUnanswered = state.questions.findIndex(q => !(q.id in state.answers));
      goTo(firstUnanswered === -1 ? 0 : firstUnanswered, false);
      updateStats();

      el.root.hidden = false;
      hideOverlay();

      state.timer = new ExamTimer({
        deadline: attempt.deadline,
        serverNow: attempt.serverNow,
        onTick: renderTimer,
        onExpire: () => {
          toast('Đã hết giờ làm bài. Hệ thống đang tự nộp bài.', 'warn', 5000);
          submit('timeout');
        }
      });
      state.timer.start();
      if (!state.submitting) startProctor(attempt.violations || 0);
    } catch (err) {
      if (err.code === 'ALREADY_SUBMITTED') { state.submitted = true; location.replace('result.html'); return; }
      showOverlay('Không vào được phòng thi', err.message, {
        spinner: false,
        actions: [{ label: 'Về trang đăng nhập', primary: true, onClick: () => location.replace('login.html') }]
      });
    }
  }

  /* ---------- Giám sát (chuyển tab, toàn màn hình) ---------- */
  function startProctor(initialCount) {
    const max = CONFIG.MAX_VIOLATIONS;
    state.proctor = new Proctor({
      maxViolations: max,
      initialCount,
      requireFullscreen: CONFIG.REQUIRE_FULLSCREEN,
      blockShortcuts: CONFIG.BLOCK_SHORTCUTS,
      onViolation: async v => (await API.reportViolation(state.attemptId, v)).count,
      onCountChange: n => {
        el.violation.textContent = `${n}/${max}`;
        el.violationBox.classList.toggle('has', n > 0);
      },
      onLimit: () => {
        toast('Vi phạm quy chế quá số lần cho phép. Hệ thống tự nộp bài.', 'error', 6000);
        submit('violation');
      }
    });
    state.proctor.start();
  }

  /* ---------- Hiển thị câu hỏi ---------- */
  function goTo(index, focus = true) {
    const n = state.questions.length;
    state.current = Math.max(0, Math.min(n - 1, index));
    renderQuestion();
    renderNavigator();
    if (focus) el.options.querySelector('input:checked, input')?.focus({ preventScroll: true });
    if (matchMedia('(max-width: 960px)').matches) el.qIndex.scrollIntoView({ block: 'nearest' });
  }

  function renderQuestion() {
    const q = state.questions[state.current];
    const n = state.questions.length;
    const chosen = state.answers[q.id];

    el.qIndex.textContent = `Câu ${state.current + 1} / ${n}`;
    el.qText.textContent = q.noiDung;
    el.options.innerHTML = q.luaChon.map((text, i) => `
      <label class="option${chosen === i ? ' selected' : ''}">
        <input type="radio" name="answer" value="${i}" ${chosen === i ? 'checked' : ''}>
        <span class="letter">${LETTERS[i]}</span>
        <span class="text">${escapeHtml(text)}</span>
      </label>`).join('');

    const flagged = state.flagged.has(q.id);
    el.flagBtn.setAttribute('aria-pressed', String(flagged));
    el.flagBtn.innerHTML = `${ICONS.flag} ${flagged ? 'Bỏ đánh dấu' : 'Đánh dấu xem lại'}`;
    el.prevBtn.disabled = state.current === 0;
    el.nextBtn.disabled = state.current === n - 1;
    el.clearBtn.hidden = chosen === undefined;
  }

  function buildNavigator() {
    el.navGrid.innerHTML = state.questions.map((q, i) =>
      `<button type="button" class="nav-item" data-index="${i}">${i + 1}</button>`).join('');
  }

  function renderNavigator() {
    $$('.nav-item', el.navGrid).forEach((b, i) => {
      const q = state.questions[i];
      const answered = q.id in state.answers;
      const flagged = state.flagged.has(q.id);
      b.classList.toggle('answered', answered);
      b.classList.toggle('flagged', flagged);
      b.classList.toggle('current', i === state.current);
      if (i === state.current) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-label', `Câu ${i + 1}: ${answered ? 'đã làm' : 'chưa làm'}${flagged ? ', đánh dấu xem lại' : ''}`);
    });
  }

  function updateStats() {
    const total = state.questions.length;
    const done = state.questions.filter(q => q.id in state.answers).length;
    el.done.textContent = `${done}/${total}`;
    el.left.textContent = total - done;
    el.progress.style.width = total ? `${(done / total) * 100}%` : '0';
  }

  function renderTimer(ms) {
    el.timerValue.textContent = formatClock(ms);
    const danger = ms <= CONFIG.DANGER_MINUTES * 60000;
    const warn = !danger && ms <= CONFIG.WARN_MINUTES * 60000;
    el.timer.classList.toggle('danger', danger);
    el.timer.classList.toggle('warn', warn);
    if (ms > 0 && warn && !state.warned.warn) { state.warned.warn = true; toast(`Còn ${CONFIG.WARN_MINUTES} phút làm bài.`, 'warn'); }
    if (ms > 0 && danger && !state.warned.danger) { state.warned.danger = true; state.warned.warn = true; toast(`Chỉ còn ${CONFIG.DANGER_MINUTES} phút!`, 'error'); }
  }

  /* ---------- Thao tác ---------- */
  function choose(i) {
    if (state.submitting) return;
    const q = state.questions[state.current];
    if (i < 0 || i >= q.luaChon.length) return;
    state.answers[q.id] = i;
    afterChange();
  }
  function clearChoice() {
    const q = state.questions[state.current];
    delete state.answers[q.id];
    afterChange();
    el.options.querySelector('input')?.focus();
  }
  function toggleFlag() {
    const id = state.questions[state.current].id;
    state.flagged.has(id) ? state.flagged.delete(id) : state.flagged.add(id);
    afterChange();
  }
  function afterChange() {
    const hadFocus = document.activeElement?.name === 'answer';
    renderQuestion();
    renderNavigator();
    updateStats();
    // Giữ focus trong nhóm đáp án (đặt vào ô vừa chọn) để dùng bàn phím liên tục
    if (hadFocus) el.options.querySelector('input:checked, input')?.focus({ preventScroll: true });
    scheduleSave();
  }

  /* ---------- Lưu tạm ---------- */
  let saveTimer = null;
  let savePromise = Promise.resolve();
  function scheduleSave() {
    el.saveStatus.classList.remove('error');
    el.saveStatus.textContent = 'Đang lưu…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 400);
  }
  function saveNow() {
    clearTimeout(saveTimer);
    if (state.submitting || state.submitted) return savePromise;
    savePromise = API.saveProgress(state.attemptId, { answers: state.answers, flagged: [...state.flagged] })
      .then(({ savedAt }) => {
        el.saveStatus.classList.remove('error');
        el.saveStatus.textContent = `Đã lưu lúc ${formatTime(savedAt)}`;
      })
      .catch(err => {
        el.saveStatus.classList.add('error');
        el.saveStatus.textContent = 'Chưa lưu được: ' + err.message;
      });
    return savePromise;
  }

  /* ---------- Nộp bài ---------- */
  async function confirmSubmit() {
    const total = state.questions.length;
    const unanswered = state.questions.filter(q => !(q.id in state.answers)).length;
    const flagged = state.flagged.size;
    const lines = [`<p>Bạn đã làm <strong>${total - unanswered}/${total}</strong> câu.</p>`];
    if (unanswered) lines.push(`<p>Còn <strong>${unanswered} câu chưa làm</strong> — các câu này sẽ được tính là sai.</p>`);
    if (flagged) lines.push(`<p>Có <strong>${flagged} câu</strong> đang đánh dấu xem lại.</p>`);
    lines.push('<p>Sau khi nộp sẽ không thể sửa bài.</p>');
    const ok = await confirmDialog({
      title: 'Nộp bài?', message: lines.join(''),
      okText: 'Nộp bài', cancelText: 'Làm tiếp', danger: true
    });
    if (ok) submit('manual');
  }

  async function submit(reason) {
    if (state.submitting || state.submitted) return;
    state.submitting = true;
    state.timer?.stop();
    state.proctor?.stop(); // rời trang sau khi nộp không bị tính là vi phạm
    clearTimeout(saveTimer);
    showOverlay('Đang nộp bài…', 'Đang chấm điểm và gửi kết quả. Vui lòng không đóng trang.');
    try {
      await API.submitExam(state.attemptId, state.answers, reason);
      state.submitted = true;
      location.replace('result.html');
    } catch (err) {
      if (err.code === 'ALREADY_SUBMITTED') { state.submitted = true; location.replace('result.html'); return; }
      state.submitting = false;
      showOverlay('Nộp bài chưa thành công', err.message + ' Bài làm của bạn vẫn được giữ nguyên.', {
        spinner: false,
        actions: [{ label: 'Thử nộp lại', primary: true, onClick: () => submit(reason) }]
      });
    }
  }

  /* ---------- Sự kiện ---------- */
  el.options.addEventListener('change', e => {
    if (e.target.name === 'answer') choose(Number(e.target.value));
  });
  el.prevBtn.addEventListener('click', () => goTo(state.current - 1));
  el.nextBtn.addEventListener('click', () => goTo(state.current + 1));
  el.clearBtn.addEventListener('click', clearChoice);
  el.flagBtn.addEventListener('click', toggleFlag);
  el.navGrid.addEventListener('click', e => {
    const b = e.target.closest('.nav-item');
    if (b) goTo(Number(b.dataset.index));
  });
  el.submitBtn.addEventListener('click', confirmSubmit);

  document.addEventListener('keydown', e => {
    if (el.root.hidden || state.submitting || !el.proctorOverlay.hidden || document.querySelector('dialog[open]')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowright') { e.preventDefault(); goTo(state.current + 1); }
    else if (k === 'arrowleft') { e.preventDefault(); goTo(state.current - 1); }
    else if (/^[1-6]$/.test(k)) choose(Number(k) - 1);
    else if (/^[a-f]$/.test(k) && k !== 'f') choose(k.charCodeAt(0) - 97);
    else if (k === 'f') toggleFlag();
  });

  // Cảnh báo khi rời trang lúc đang thi; lưu ngay bài làm trước khi trang bị đóng.
  window.addEventListener('beforeunload', e => {
    if (!state.attemptId || state.submitted) return;
    e.preventDefault();
    e.returnValue = '';
  });
  window.addEventListener('pagehide', () => {
    if (state.attemptId && !state.submitted && !state.submitting) saveNow();
  });

  init();
})();

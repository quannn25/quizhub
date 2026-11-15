/* Trang đăng nhập: MSSV → thông tin SV + mã đề → đồng ý quy chế → bắt đầu / tiếp tục / xem kết quả. */
renderHeader('login');
renderFooter();

const loginCard = $('#login-card');
const infoCard = $('#info-card');
const form = $('#login-form');
const input = $('#mssv');
const loginBtn = $('#login-btn');
const errorBox = $('#login-error');

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  errorBox.hidden = true;
  setLoading(loginBtn, true);
  try {
    const info = await API.login(input.value);
    showInfo(info);
  } catch (err) {
    showError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
    input.focus();
  } finally {
    setLoading(loginBtn, false);
  }
});

function showInfo({ student, exam, attempt, serverNow }) {
  let status = '';
  let actions = '';

  if (attempt?.status === 'submitted') {
    status = `<div class="alert alert-success">Bạn đã nộp bài${attempt.submittedAt ? ' lúc ' + escapeHtml(formatDateTime(attempt.submittedAt)) : ''}. Mỗi sinh viên chỉ được làm một lần.</div>`;
    actions = `<button class="btn btn-primary" id="result-btn" type="button">Xem kết quả</button>`;
  } else if (attempt?.status === 'in_progress') {
    const left = attempt.deadline - serverNow;
    status = left > 0
      ? `<div class="alert alert-warn">Bạn đang làm dở bài thi. Thời gian còn lại: <strong>${formatClock(left)}</strong>.</div>`
      : `<div class="alert alert-warn">Đã hết giờ làm bài. Bài của bạn sẽ được nộp với các câu đã chọn.</div>`;
    actions = `<button class="btn btn-primary" id="start-btn" type="button">${left > 0 ? 'Tiếp tục làm bài' : 'Nộp bài'}</button>`;
  } else {
    status = `
      <div class="alert alert-info">
        Bài thi gồm <strong>${exam.soCau} câu</strong> trong <strong>${exam.thoiGian} phút</strong>.
        Đồng hồ bắt đầu chạy khi bạn bấm "Bắt đầu làm bài" và không dừng khi tải lại trang. Hết giờ hệ thống tự nộp bài.
      </div>
      <label class="check"><input type="checkbox" id="agree"> <span>Tôi đã đọc và đồng ý với <a href="index.html#quy-che" target="_blank" rel="noopener">quy chế làm bài</a>.</span></label>`;
    actions = `<button class="btn btn-primary" id="start-btn" type="button" disabled>Bắt đầu làm bài</button>`;
  }

  infoCard.innerHTML = `
    <h1>Xác nhận thông tin</h1>
    <dl class="info-list">
      <dt>Họ tên</dt><dd>${escapeHtml(student.hoTen)}</dd>
      <dt>MSSV</dt><dd>${escapeHtml(student.mssv)}</dd>
      <dt>Lớp</dt><dd>${escapeHtml(student.lop)}</dd>
      <dt>Bài thi</dt><dd>${escapeHtml(exam.tieuDe)}</dd>
      <dt>Mã đề</dt><dd><span class="badge">${escapeHtml(exam.maDe)}</span></dd>
    </dl>
    ${status}
    <div class="alert alert-error" id="start-error" role="alert" hidden></div>
    <div class="btn-row">
      <button class="btn btn-outline" id="back-btn" type="button">Không phải tôi</button>
      ${actions}
    </div>`;

  loginCard.hidden = true;
  infoCard.hidden = false;

  $('#back-btn').addEventListener('click', () => {
    API.session.clear();
    infoCard.hidden = true;
    loginCard.hidden = false;
    input.select();
    input.focus();
  });

  const agree = $('#agree');
  const startBtn = $('#start-btn');
  agree?.addEventListener('change', () => { startBtn.disabled = !agree.checked; });

  startBtn?.addEventListener('click', async () => {
    setLoading(startBtn, true);
    try {
      const a = await API.startExam(student.mssv);
      API.session.set({ mssv: student.mssv, attemptId: a.attemptId });
      location.href = 'exam.html';
    } catch (err) {
      const box = $('#start-error');
      box.textContent = err.message;
      box.hidden = false;
      setLoading(startBtn, false);
    }
  });

  $('#result-btn')?.addEventListener('click', () => {
    API.session.set({ mssv: student.mssv, attemptId: attempt.attemptId });
    location.href = 'result.html';
  });

  (startBtn && !startBtn.disabled ? startBtn : (agree || $('#result-btn')))?.focus();
}

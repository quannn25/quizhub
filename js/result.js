/* Trang kết quả: điểm, thống kê, xem lại từng câu (nếu giảng viên cho phép). */
renderHeader('');
renderFooter();

(async () => {
  const root = $('#result-root');
  const sess = API.session.get();
  if (!sess?.attemptId) { location.replace('login.html'); return; }

  let r;
  try {
    r = await API.getResult(sess.attemptId);
  } catch (err) {
    if (err.code === 'NOT_SUBMITTED') { location.replace('exam.html'); return; }
    root.innerHTML = `<div class="card"><div class="alert alert-error">${escapeHtml(err.message)}</div>
      <a class="btn btn-primary" href="login.html">Về trang đăng nhập</a></div>`;
    return;
  }

  const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
  const ring = r.score >= 8 ? 'var(--success)' : r.score >= 5 ? 'var(--primary)' : 'var(--danger)';
  const wrong = r.answered - r.correct;
  const skipped = r.total - r.answered;
  const hasKey = r.detail.length > 0 && 'dapAn' in r.detail[0];

  const review = !r.detail.length ? '' : `
    <section class="card">
      <h2>Chi tiết bài làm</h2>
      ${hasKey ? '' : '<p class="muted">Giảng viên không cho xem đáp án đúng. Dưới đây là các lựa chọn của bạn.</p>'}
      <ol class="review-list">
        ${r.detail.map((d, i) => {
          const cls = !hasKey ? '' : d.chon === null ? 'skip' : d.dung ? 'ok' : 'wrong';
          const tag = !hasKey ? '' : d.chon === null
            ? '<span class="review-tag" style="color:var(--warn)">Bỏ trống</span>'
            : d.dung ? `<span class="review-tag" style="color:var(--success)">${ICONS.check} Đúng</span>`
                     : `<span class="review-tag" style="color:var(--danger)">${ICONS.x} Sai</span>`;
          return `
          <li class="review-item ${cls}">
            <div class="review-q" style="display:flex;gap:8px">Câu ${i + 1}. ${escapeHtml(d.noiDung)} ${tag}</div>
            <ul class="review-opts">
              ${d.luaChon.map((t, j) => {
                let c = '', note = '';
                if (hasKey && j === d.dapAn) { c = 'correct'; note = j === d.chon ? ' — bạn chọn' : ' — đáp án đúng'; }
                else if (j === d.chon) { c = hasKey ? 'chosen-wrong' : 'correct'; note = ' — bạn chọn'; }
                return `<li class="${c}"><strong>${LETTERS[j]}.</strong> ${escapeHtml(t)}<span class="muted" style="font-weight:400">${note}</span></li>`;
              }).join('')}
            </ul>
          </li>`;
        }).join('')}
      </ol>
    </section>`;

  root.innerHTML = `
    <section class="card">
      <div class="result-summary">
        <div class="score-ring" style="--p:${pct};--ring:${ring}" role="img" aria-label="Điểm ${formatScore(r.score)} trên 10">
          <div class="score-ring-inner">
            <div><div class="score-value">${formatScore(r.score)}</div><div class="score-label">trên 10 điểm</div></div>
          </div>
        </div>
        <div>
          <span class="badge">Đã nộp bài</span>
          <h1 style="margin-top:8px">${escapeHtml(r.hoTen)}</h1>
          <p class="muted" style="margin:0">MSSV ${escapeHtml(r.mssv)} · Lớp ${escapeHtml(r.lop)} · Mã đề ${escapeHtml(r.maDe)}</p>
          <p class="muted" style="margin:0">${escapeHtml(r.tieuDe)}</p>
          <div class="stats-grid">
            <div class="stat"><span class="stat-label">Câu đúng</span><span class="stat-value">${r.correct}/${r.total}</span></div>
            <div class="stat"><span class="stat-label">Sai / bỏ trống</span><span class="stat-value">${wrong} / ${skipped}</span></div>
            <div class="stat${r.violations ? ' stat-violation has' : ''}"><span class="stat-label">Vi phạm</span><span class="stat-value">${r.violations ?? 0} lần</span></div>
            <div class="stat"><span class="stat-label">Thời gian làm</span><span class="stat-value" style="font-size:1rem">${formatDuration(r.durationMs)}</span></div>
            <div class="stat"><span class="stat-label">Nộp lúc</span><span class="stat-value" style="font-size:1rem">${formatDateTime(r.submittedAt)}</span></div>
            <div class="stat"><span class="stat-label">Hình thức nộp</span><span class="stat-value" style="font-size:1rem">${escapeHtml(REASON_LABEL[r.reason] || r.reason)}</span></div>
          </div>
        </div>
      </div>
      <div id="email-status" class="no-print" style="margin-top:20px"></div>
      <div class="btn-row no-print" style="margin-top:8px">
        <button class="btn btn-outline" id="print-btn" type="button">In kết quả</button>
        <button class="btn btn-primary" id="done-btn" type="button">Hoàn tất &amp; thoát</button>
      </div>
    </section>
    ${review}`;

  renderEmail(r.email);

  function renderEmail(email) {
    const box = $('#email-status');
    const status = email?.status || 'pending';
    if (status === 'sent') {
      box.innerHTML = `<div class="alert alert-success">${ICONS.check} Đã gửi kết quả về email giảng viên${email.to ? ` (<strong>${escapeHtml(email.to)}</strong>)` : ''} lúc ${formatTime(email.at)}.</div>`;
    } else if (status === 'disabled') {
      box.innerHTML = `<div class="alert alert-info">Chưa cấu hình gửi email (EmailJS) nên kết quả chỉ được lưu trên máy này. Xem hướng dẫn trong README.</div>`;
    } else {
      // failed / pending / sending (trang bị đóng giữa chừng) → cho gửi lại
      box.innerHTML = `
        <div class="alert alert-warn" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <span style="flex:1;min-width:200px">Chưa gửi được kết quả về email${email?.error ? ': ' + escapeHtml(email.error) : '.'} Bài làm và điểm vẫn đã được lưu.</span>
          <button class="btn btn-outline btn-sm" id="resend-btn" type="button">Gửi lại email</button>
        </div>`;
      const btn = $('#resend-btn');
      btn.addEventListener('click', async () => {
        setLoading(btn, true);
        try {
          const res = await API.resendResultEmail(sess.attemptId);
          renderEmail(res);
          if (res.status === 'sent') toast('Đã gửi email kết quả.', 'success');
        } catch (err) {
          toast(err.message, 'error');
          setLoading(btn, false);
        }
      });
    }
  }

  $('#print-btn').addEventListener('click', () => window.print());
  $('#done-btn').addEventListener('click', () => { API.session.clear(); location.href = 'index.html'; });
})();

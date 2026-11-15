/* =========================================================
   Trang giảng viên
   - Đăng nhập (mật khẩu demo ở bản tĩnh, token ở bản server).
   - Thống kê: số SV, đã nộp, đang làm, điểm TB/cao/thấp, phân bố xếp loại, theo mã đề.
   - Bảng sinh viên: tìm kiếm, lọc, sắp xếp, xem chi tiết, chấm bài hết giờ, cho thi lại.
   - Xuất CSV (mở được bằng Excel, đủ dấu tiếng Việt).
   Mọi dữ liệu đi qua API.admin.* — không đọc localStorage trực tiếp.
   ========================================================= */
renderHeader('admin');
renderFooter();

(() => {
  const STATUS = {
    submitted:   { label: 'Đã nộp',            cls: 'badge-success', order: 0 },
    expired:     { label: 'Hết giờ, chưa nộp', cls: 'badge-warn',    order: 1 },
    in_progress: { label: 'Đang làm',          cls: 'badge',         order: 2 },
    not_started: { label: 'Chưa thi',          cls: 'badge-muted',   order: 3 }
  };
  const GRADES = [
    { label: 'Xuất sắc',   min: 9,   color: 'var(--success)' },
    { label: 'Giỏi',       min: 8,   color: 'color-mix(in srgb, var(--success) 70%, var(--primary))' },
    { label: 'Khá',        min: 6.5, color: 'var(--primary)' },
    { label: 'Trung bình', min: 5,   color: 'color-mix(in srgb, var(--primary) 45%, var(--warn))' },
    { label: 'Yếu',        min: 4,   color: 'var(--warn)' },
    { label: 'Kém',        min: 0,   color: 'var(--danger)' }
  ];
  const gradeOf = s => s === null || s === undefined ? '' : GRADES.find(g => s >= g.min).label;
  const VIOLATION_LABEL = {
    tab_hidden: 'Chuyển tab / thu nhỏ trình duyệt',
    window_blur: 'Chuyển cửa sổ / ứng dụng khác',
    fullscreen_exit: 'Thoát toàn màn hình'
  };
  const EMAIL_LABEL = {
    sent: '<span class="dot dot-ok"></span>Đã gửi',
    failed: '<span class="dot dot-bad"></span>Lỗi',
    pending: '<span class="dot dot-bad"></span>Chưa gửi',
    sending: '<span class="dot dot-bad"></span>Chưa gửi',
    disabled: '<span class="dot"></span>Chưa cấu hình'
  };

  const state = { data: null, sort: { key: 'mssv', dir: 1 }, timer: null, loading: false };

  const el = {
    login: $('#admin-login'), dash: $('#admin-dash'),
    form: $('#admin-form'), pw: $('#admin-password'), btn: $('#admin-btn'), err: $('#admin-error'), hint: $('#admin-hint'),
    updated: $('#updated-at'), scope: $('#scope-note'), kpis: $('#kpis'), dist: $('#dist'), byExam: $('#by-exam'),
    search: $('#f-search'), exam: $('#f-exam'), status: $('#f-status'),
    tbody: $('#tbody'), foot: $('#table-foot'),
    refresh: $('#refresh-btn'), csv: $('#csv-btn'), logout: $('#logout-btn')
  };

  /* ---------- Đăng nhập ---------- */
  if (CONFIG.MODE === 'local') {
    el.hint.innerHTML = `Bản demo: mật khẩu là <code>${escapeHtml(CONFIG.ADMIN_PASSWORD)}</code> (đổi trong <code>js/config.js</code>).`;
  }

  el.form.addEventListener('submit', async e => {
    e.preventDefault();
    el.err.hidden = true;
    setLoading(el.btn, true);
    try {
      await API.admin.login(el.pw.value);
      el.pw.value = '';
      showDashboard();
    } catch (err) {
      el.err.textContent = err.message;
      el.err.hidden = false;
      el.pw.select();
    } finally {
      setLoading(el.btn, false);
    }
  });

  function showLogin() {
    stopAutoRefresh();
    el.dash.hidden = true;
    el.login.hidden = false;
    el.pw.focus();
  }

  async function showDashboard() {
    el.login.hidden = true;
    el.dash.hidden = false;
    await load();
    startAutoRefresh();
  }

  el.logout.addEventListener('click', () => { API.admin.logout(); showLogin(); });

  /* ---------- Tải dữ liệu ---------- */
  async function load({ quiet = false } = {}) {
    if (state.loading) return;
    state.loading = true;
    if (!quiet) setLoading(el.refresh, true);
    try {
      state.data = await API.admin.getResults();
      renderAll();
      renderImportNote(await API.admin.getDataSource());
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') { API.admin.logout(); showLogin(); }
      else if (!quiet) toast(err.message, 'error');
    } finally {
      state.loading = false;
      setLoading(el.refresh, false);
    }
  }

  function startAutoRefresh() {
    stopAutoRefresh();
    const sec = CONFIG.ADMIN_AUTO_REFRESH_SEC;
    if (sec > 0) {
      state.timer = setInterval(() => {
        if (document.visibilityState === 'visible' && !document.querySelector('dialog[open]')) load({ quiet: true });
      }, sec * 1000);
    }
  }
  function stopAutoRefresh() { clearInterval(state.timer); state.timer = null; }

  // Bản tĩnh: sinh viên thi ở tab khác trên cùng máy → cập nhật ngay
  window.addEventListener('storage', () => { if (!el.dash.hidden) load({ quiet: true }); });

  el.refresh.addEventListener('click', () => load());
  [el.search, el.exam, el.status].forEach(i => i.addEventListener('input', renderTable));

  /* ---------- Hiển thị ---------- */
  function renderImportNote(src) {
    const box = $('#import-note');
    box.hidden = src.source !== 'imported';
    if (box.hidden) return;
    box.innerHTML = `<span><strong>Đang dùng dữ liệu nhập thử</strong> từ ${formatDateTime(src.importedAt)} (chỉ trên trình duyệt này).</span>
      <a class="btn btn-outline btn-sm" href="import.html">Quản lý dữ liệu</a>`;
  }

  function renderAll() {
    const { rows, generatedAt, scope } = state.data;
    el.updated.textContent = `Cập nhật lúc ${formatTime(generatedAt)}` +
      (CONFIG.ADMIN_AUTO_REFRESH_SEC > 0 ? ` · tự làm mới mỗi ${CONFIG.ADMIN_AUTO_REFRESH_SEC} giây` : '');

    el.scope.hidden = scope !== 'this_browser';
    el.scope.innerHTML = '<strong>Bản tĩnh (không có server):</strong> trang này chỉ thấy các bài làm <strong>trên trình duyệt này</strong>. ' +
      'Kết quả của sinh viên thi trên máy khác được gửi về email giảng viên. Khi chuyển lên server, trang này sẽ thấy toàn bộ lớp.';

    // Bộ lọc mã đề
    const exams = [...new Set(rows.map(r => r.maDe))].sort();
    const cur = el.exam.value;
    el.exam.innerHTML = '<option value="">Tất cả mã đề</option>' +
      exams.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
    el.exam.value = exams.includes(cur) ? cur : '';

    renderKpis(rows);
    renderDist(rows);
    renderByExam(rows, exams);
    renderTable();
  }

  const scoresOf = rows => rows.filter(r => r.status === 'submitted').map(r => r.score);
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  const fmt = x => x === null || x === undefined ? '—' : formatScore(Math.round(x * 100) / 100);

  function renderKpis(rows) {
    const count = s => rows.filter(r => r.status === s).length;
    const scores = scoresOf(rows);
    const pass = scores.filter(s => s >= 5).length;
    const items = [
      ['Sinh viên', rows.length, ''],
      ['Đã nộp', count('submitted'), `${rows.length ? Math.round(count('submitted') / rows.length * 100) : 0}% lớp`],
      ['Đang làm', count('in_progress'), count('expired') ? `${count('expired')} hết giờ chưa nộp` : ''],
      ['Chưa thi', count('not_started'), ''],
      ['Điểm trung bình', fmt(avg(scores)), scores.length ? `Cao ${fmt(Math.max(...scores))} · Thấp ${fmt(Math.min(...scores))}` : ''],
      ['Đạt (≥ 5)', scores.length ? `${pass}/${scores.length}` : '—', scores.length ? `${Math.round(pass / scores.length * 100)}%` : '']
    ];
    el.kpis.innerHTML = items.map(([label, value, sub]) => `
      <div class="card kpi">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        <div class="kpi-sub">${sub || '&nbsp;'}</div>
      </div>`).join('');
  }

  function renderDist(rows) {
    const scores = scoresOf(rows);
    if (!scores.length) { el.dist.innerHTML = '<p class="muted">Chưa có bài nộp.</p>'; return; }
    const counts = GRADES.map(g => ({ ...g, n: scores.filter(s => gradeOf(s) === g.label).length }));
    const max = Math.max(...counts.map(c => c.n), 1);
    el.dist.innerHTML = counts.map(c => `
      <div class="bar-row">
        <span class="bar-label">${c.label}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${(c.n / max) * 100}%;background:${c.color}"></span></span>
        <span class="bar-value">${c.n}</span>
      </div>`).join('');
  }

  function renderByExam(rows, exams) {
    el.byExam.innerHTML = `
      <table class="table table-compact">
        <thead><tr><th scope="col">Mã đề</th><th scope="col" class="num">SV</th><th scope="col" class="num">Đã nộp</th><th scope="col" class="num">Điểm TB</th></tr></thead>
        <tbody>${exams.map(m => {
          const rs = rows.filter(r => r.maDe === m);
          const sc = scoresOf(rs);
          return `<tr><td><span class="badge">${escapeHtml(m)}</span></td><td class="num">${rs.length}</td><td class="num">${sc.length}</td><td class="num">${fmt(avg(sc))}</td></tr>`;
        }).join('')}</tbody>
      </table>`;
  }

  function filteredRows() {
    const q = el.search.value.trim().toLowerCase();
    const exam = el.exam.value, status = el.status.value;
    const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();
    const nq = norm(q);
    const { key, dir } = state.sort;
    const val = r => key === 'status' ? STATUS[r.status].order : r[key];
    return state.data.rows
      .filter(r => (!exam || r.maDe === exam) && (!status || r.status === status) &&
        (!q || r.mssv.includes(q) || norm(r.hoTen).includes(nq)))
      .sort((a, b) => {
        const x = val(a), y = val(b);
        if (x === y) return a.mssv.localeCompare(b.mssv);
        if (x === null || x === undefined) return 1;   // ô trống luôn xuống cuối
        if (y === null || y === undefined) return -1;
        return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y), 'vi')) * dir;
      });
  }

  function renderTable() {
    if (!state.data) return;
    const rows = filteredRows();
    $$('#table th[data-sort]').forEach(th => {
      const active = th.dataset.sort === state.sort.key;
      th.setAttribute('aria-sort', active ? (state.sort.dir === 1 ? 'ascending' : 'descending') : 'none');
    });
    el.tbody.innerHTML = rows.length ? rows.map(r => {
      const st = STATUS[r.status];
      const actions = [];
      if (r.status !== 'not_started') actions.push(`<button class="btn btn-outline btn-xs" data-act="view" data-mssv="${r.mssv}">Xem</button>`);
      if (r.status === 'expired') actions.push(`<button class="btn btn-primary btn-xs" data-act="force" data-mssv="${r.mssv}">Chấm bài</button>`);
      if (r.status !== 'not_started') actions.push(`<button class="btn btn-ghost btn-xs" data-act="reset" data-mssv="${r.mssv}">Cho thi lại</button>`);
      return `
        <tr>
          <td class="mono">${escapeHtml(r.mssv)}</td>
          <td>${escapeHtml(r.hoTen)}</td>
          <td><span class="badge">${escapeHtml(r.maDe)}</span></td>
          <td><span class="badge ${st.cls}">${st.label}</span></td>
          <td class="num">${r.status === 'not_started' ? '—' : `${r.answered}/${r.total ?? '?'}`}</td>
          <td class="num"><strong>${r.score === null ? '—' : formatScore(r.score)}</strong>${r.score === null ? '' : `<div class="cell-sub">${gradeOf(r.score)}</div>`}</td>
          <td class="num">${r.violations ? `<span class="text-danger">${r.violations}</span>` : '0'}</td>
          <td>${r.submittedAt ? formatDateTime(r.submittedAt) : '—'}</td>
          <td class="nowrap">${r.emailStatus ? EMAIL_LABEL[r.emailStatus] || r.emailStatus : '—'}</td>
          <td class="actions">${actions.join('')}</td>
        </tr>`;
    }).join('') : `<tr><td colspan="10" class="empty">Không có sinh viên phù hợp bộ lọc.</td></tr>`;
    el.foot.textContent = `Hiển thị ${rows.length}/${state.data.rows.length} sinh viên.`;
  }

  // Sắp xếp khi bấm tiêu đề cột
  $$('#table th[data-sort]').forEach(th => {
    th.tabIndex = 0;
    const sortBy = () => {
      const key = th.dataset.sort;
      state.sort = { key, dir: state.sort.key === key ? -state.sort.dir : 1 };
      renderTable();
    };
    th.addEventListener('click', sortBy);
    th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(); } });
  });

  /* ---------- Thao tác trên từng dòng ---------- */
  el.tbody.addEventListener('click', async e => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const { act, mssv } = b.dataset;
    const row = state.data.rows.find(r => r.mssv === mssv);
    if (act === 'view') return openDetail(mssv);

    if (act === 'reset') {
      const ok = await confirmDialog({
        title: 'Cho thi lại?',
        message: `<p>Xóa lượt thi của <strong>${escapeHtml(row.hoTen)}</strong> (${escapeHtml(mssv)})${row.score !== null ? `, điểm hiện tại <strong>${formatScore(row.score)}</strong>` : ''}.</p><p>Sinh viên sẽ làm lại từ đầu với thời gian mới. Không thể hoàn tác.</p>`,
        okText: 'Cho thi lại', danger: true
      });
      if (!ok) return;
      await runAction(b, () => API.admin.resetAttempt(mssv), `Đã cho ${row.hoTen} thi lại.`);
    }

    if (act === 'force') {
      const ok = await confirmDialog({
        title: 'Chấm bài?',
        message: `<p><strong>${escapeHtml(row.hoTen)}</strong> đã hết giờ nhưng chưa nộp (có thể đã đóng trình duyệt). Hệ thống sẽ chấm với <strong>${row.answered} câu</strong> đã lưu.</p>`,
        okText: 'Chấm bài'
      });
      if (!ok) return;
      await runAction(b, () => API.admin.forceSubmit(mssv), `Đã chấm bài của ${row.hoTen}.`);
    }
  });

  async function runAction(btn, fn, okMsg) {
    setLoading(btn, true);
    try {
      await fn();
      toast(okMsg, 'success');
      await load({ quiet: true });
    } catch (err) {
      if (err.code === 'UNAUTHORIZED') { API.admin.logout(); showLogin(); }
      toast(err.message, 'error');
      setLoading(btn, false);
    }
  }

  /* ---------- Chi tiết một sinh viên ---------- */
  async function openDetail(mssv) {
    let d;
    try { d = await API.admin.getAttemptDetail(mssv); }
    catch (err) { toast(err.message, 'error'); return; }

    const r = d.result;
    const st = STATUS[d.status];
    const info = `
      <dl class="info-list">
        <dt>Họ tên</dt><dd>${escapeHtml(d.student.hoTen)}</dd>
        <dt>MSSV · Lớp</dt><dd>${escapeHtml(d.student.mssv)} · ${escapeHtml(d.student.lop)}</dd>
        <dt>Mã đề</dt><dd><span class="badge">${escapeHtml(d.student.maDe)}</span></dd>
        <dt>Trạng thái</dt><dd><span class="badge ${st.cls}">${st.label}</span></dd>
        ${d.startedAt ? `<dt>Bắt đầu</dt><dd>${formatDateTime(d.startedAt)}</dd>` : ''}
        ${r ? `<dt>Nộp lúc</dt><dd>${formatDateTime(r.submittedAt)} (${formatDuration(r.durationMs)})</dd>
               <dt>Hình thức</dt><dd>${escapeHtml(REASON_LABEL[r.reason] || r.reason)}</dd>
               <dt>Điểm</dt><dd>${formatScore(r.score)}/10 · ${gradeOf(r.score)} · đúng ${r.correct}/${r.total}</dd>`
            : d.status === 'in_progress' ? `<dt>Còn lại</dt><dd>${formatClock(d.deadline - d.serverNow)} · đã làm ${d.answered} câu</dd>`
            : d.status === 'expired' ? `<dt>Đã làm</dt><dd>${d.answered} câu (chưa nộp)</dd>` : ''}
      </dl>`;

    const log = d.violationLog?.length
      ? `<ol class="log">${d.violationLog.map(v => `<li><span class="mono">${formatTime(v.at)}</span> ${escapeHtml(VIOLATION_LABEL[v.type] || v.type)}</li>`).join('')}</ol>`
      : '<p class="muted">Không có vi phạm.</p>';

    const answers = r ? `
      <h3 class="dialog-sub">Bài làm</h3>
      <div class="table-wrap"><table class="table table-compact">
        <thead><tr><th scope="col">Câu</th><th scope="col">Nội dung</th><th scope="col" class="num">Chọn</th><th scope="col" class="num">Đáp án</th><th scope="col" class="num">KQ</th></tr></thead>
        <tbody>${r.detail.map((q, i) => `
          <tr><td class="num">${i + 1}</td><td>${escapeHtml(q.noiDung)}</td>
          <td class="num">${q.chon === null ? '—' : LETTERS[q.chon]}</td><td class="num">${LETTERS[q.dapAn]}</td>
          <td class="num">${q.dung ? `<span class="text-success">${ICONS.check}</span>` : `<span class="text-danger">${ICONS.x}</span>`}</td></tr>`).join('')}
        </tbody>
      </table></div>` : '';

    const dlg = document.createElement('dialog');
    dlg.className = 'dialog dialog-wide';
    dlg.setAttribute('aria-labelledby', 'detail-title');
    dlg.innerHTML = `
      <form method="dialog">
        <h2 class="dialog-title" id="detail-title">Chi tiết bài thi</h2>
        ${info}
        <h3 class="dialog-sub">Nhật ký vi phạm (${d.violationLog?.length || 0})</h3>
        ${log}
        ${answers}
        <div class="dialog-actions"><button class="btn btn-primary" value="close">Đóng</button></div>
      </form>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.showModal();
  }

  /* ---------- Xuất CSV ---------- */
  el.csv.addEventListener('click', () => {
    if (!state.data) return;
    const header = ['STT', 'MSSV', 'Họ tên', 'Lớp', 'Mã đề', 'Trạng thái', 'Đã làm', 'Tổng số câu', 'Số câu đúng',
      'Điểm', 'Xếp loại', 'Vi phạm', 'Bắt đầu', 'Nộp lúc', 'Thời gian làm', 'Hình thức nộp', 'Email'];
    const rows = [...state.data.rows].sort((a, b) => a.mssv.localeCompare(b.mssv)).map((r, i) => [
      i + 1, r.mssv, r.hoTen, r.lop, r.maDe, STATUS[r.status].label,
      r.status === 'not_started' ? '' : r.answered, r.total ?? '', r.correct ?? '',
      r.score ?? '', gradeOf(r.score), r.violations,
      r.startedAt ? formatDateTime(r.startedAt) : '', r.submittedAt ? formatDateTime(r.submittedAt) : '',
      r.durationMs !== null ? formatDuration(r.durationMs) : '',
      r.reason ? REASON_LABEL[r.reason] || r.reason : '',
      r.emailStatus ? ({ sent: 'Đã gửi', failed: 'Lỗi', disabled: 'Chưa cấu hình' }[r.emailStatus] || 'Chưa gửi') : ''
    ]);
    const esc = v => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '﻿' + [header, ...rows].map(line => line.map(esc).join(',')).join('\r\n'); // BOM → Excel hiểu UTF-8
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const d = new Date();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ket-qua-thi_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- Khởi động ---------- */
  API.admin.isLoggedIn() ? showDashboard() : showLogin();
})();

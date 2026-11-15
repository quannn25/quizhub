/* =========================================================
   Trang Nhập dữ liệu (giảng viên)
   File Excel/CSV → DataImporter.analyze (đọc + kiểm tra) → API.admin.checkExams (mã đề có đề chưa)
   → xem trước → áp dụng: API.admin.importData (dùng thử / lưu lên server) hoặc tải file .js.
   ========================================================= */
renderHeader('admin');
renderFooter();

(() => {
  if (!API.admin.isLoggedIn()) { $('#need-login').hidden = false; return; }
  $('#import-root').hidden = false;

  const isServer = CONFIG.MODE === 'server';
  const el = {
    banner: $('#source-banner'), input: $('#file-input'), drop: $('#dropzone'), fileList: $('#file-list'),
    checkStep: $('#check-step'), summary: $('#summary'), issues: $('#issues'), preview: $('#preview'),
    applyStep: $('#apply-step'), applyBtn: $('#apply-btn'), zipBtn: $('#zip-btn'), fileLinks: $('#file-links')
  };
  let current = null;   // kết quả kiểm tra gần nhất
  let files = [];       // file .js đã tạo

  // Bản server: "Dùng thử" thành "Lưu lên máy chủ"
  if (isServer) {
    $('#try-title').textContent = 'Lưu lên máy chủ';
    $('#try-text').textContent = 'Dữ liệu được lưu thẳng vào cơ sở dữ liệu và áp dụng ngay cho mọi sinh viên.';
    el.applyBtn.textContent = 'Lưu dữ liệu';
    $('#files-box h3').textContent = 'Sao lưu (tùy chọn)';
  }

  const handleAuth = err => {
    if (err.code === 'UNAUTHORIZED') { API.admin.logout(); location.href = 'admin.html'; return true; }
    return false;
  };

  /* ---------- Nguồn dữ liệu đang dùng ---------- */
  async function renderSource() {
    try {
      const s = await API.admin.getDataSource();
      if (s.source === 'imported') {
        const parts = [];
        if (s.students !== null && s.students !== undefined) parts.push(`${s.students} sinh viên`);
        if (s.exams?.length) parts.push(`đề ${s.exams.join(', ')}`);
        el.banner.className = 'alert alert-warn banner-row';
        el.banner.innerHTML = `<span><strong>Đang dùng dữ liệu nhập thử</strong> (${parts.join(', ') || 'trống'}) từ ${formatDateTime(s.importedAt)}, chỉ trên trình duyệt này.</span>
          <button class="btn btn-outline btn-sm" type="button" id="reset-src">Quay về dữ liệu gốc</button>`;
        $('#reset-src').addEventListener('click', async () => {
          const ok = await confirmDialog({ title: 'Quay về dữ liệu gốc?', message: '<p>Bỏ dữ liệu nhập thử, dùng lại các file trong thư mục <code>data/</code>.</p>', okText: 'Quay về' });
          if (!ok) return;
          await API.admin.clearImportedData();
          toast('Đã quay về dữ liệu gốc.', 'success');
          renderSource();
        });
      } else {
        el.banner.className = 'alert alert-info';
        el.banner.textContent = isServer ? 'Dữ liệu đang lấy từ máy chủ.' : 'Đang dùng dữ liệu gốc trong thư mục data/ của website.';
      }
    } catch (err) { if (!handleAuth(err)) el.banner.hidden = true; }
  }

  /* ---------- Bước 1: file mẫu ---------- */
  const today = () => { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };

  async function withBtn(btn, fn) {
    setLoading(btn, true);
    try { await fn(); } catch (err) { if (!handleAuth(err)) toast(err.message, 'error', 6000); }
    finally { setLoading(btn, false); }
  }
  $('#tpl-xlsx').addEventListener('click', e => withBtn(e.currentTarget, async () => {
    downloadBlob(await DataImporter.workbookBlob(DataImporter.sampleData()), 'mau_nhap_du_lieu_quizhub.xlsx');
  }));
  $('#tpl-csv-sv').addEventListener('click', () => {
    downloadBlob(DataImporter.csvBlob(DataImporter.toSheets(DataImporter.sampleData()).SinhVien), 'mau_sinh_vien.csv');
  });
  $('#tpl-csv-de').addEventListener('click', () => {
    downloadBlob(DataImporter.csvBlob(DataImporter.toSheets(DataImporter.sampleData()).DeThi), 'mau_de_thi.csv');
  });
  $('#export-xlsx').addEventListener('click', e => withBtn(e.currentTarget, async () => {
    const data = await API.admin.exportData();
    downloadBlob(await DataImporter.workbookBlob(data), `du_lieu_hien_co_${today()}.xlsx`);
  }));

  /* ---------- Bước 2: chọn file ---------- */
  el.input.addEventListener('change', () => { if (el.input.files.length) handleFiles([...el.input.files]); });
  ['dragenter', 'dragover'].forEach(t => el.drop.addEventListener(t, e => { e.preventDefault(); el.drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => el.drop.addEventListener(t, e => { e.preventDefault(); el.drop.classList.remove('over'); }));
  el.drop.addEventListener('drop', e => { if (e.dataTransfer.files.length) handleFiles([...e.dataTransfer.files]); });

  async function handleFiles(list) {
    el.fileList.innerHTML = list.map(f => `<span class="chip">${escapeHtml(f.name)} · ${Math.max(1, Math.round(f.size / 1024))} KB</span>`).join('');
    el.checkStep.hidden = false;
    el.applyStep.hidden = true;
    el.summary.innerHTML = '<div class="spinner" style="margin:8px 0"></div>';
    el.issues.innerHTML = el.preview.innerHTML = '';
    try {
      const result = await DataImporter.analyze(list);
      const codes = DataImporter.codesToCheck(result);
      if (codes.length) DataImporter.applyExamCheck(result, await API.admin.checkExams(codes));
      current = result;
      renderCheck();
    } catch (err) {
      if (handleAuth(err)) return;
      el.summary.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    } finally {
      el.input.value = '';   // cho phép chọn lại cùng file sau khi sửa
    }
  }

  /* ---------- Bước 3: kết quả kiểm tra ---------- */
  function renderCheck() {
    const r = current;
    const examCodes = Object.keys(r.exams || {}).sort();
    const qCount = examCodes.reduce((n, c) => n + r.exams[c].cauHoi.length, 0);
    const ok = !r.errors.length;
    el.summary.innerHTML = `
      <div class="summary-chips">
        ${r.students ? `<span class="chip">${r.students.length} sinh viên</span>` : ''}
        ${examCodes.length ? `<span class="chip">${examCodes.length} đề · ${qCount} câu hỏi</span>` : ''}
        <span class="chip ${ok ? 'chip-ok' : 'chip-bad'}">${r.errors.length} lỗi</span>
        <span class="chip ${r.warnings.length ? 'chip-warn' : ''}">${r.warnings.length} cảnh báo</span>
      </div>
      <div class="alert ${ok ? 'alert-success' : 'alert-error'}">${ok
        ? 'Dữ liệu hợp lệ. Xem lại bên dưới rồi chuyển sang bước 4.'
        : 'Cần sửa các lỗi dưới đây trong file Excel/CSV rồi chọn lại file. Chưa có gì bị thay đổi.'}</div>`;

    const issueList = (items, cls, title) => !items.length ? '' : `
      <details class="issues ${cls}" open>
        <summary>${title} (${items.length})</summary>
        <ul>${items.slice(0, 200).map(i => `<li><span class="where">${escapeHtml(i.where)}</span>${escapeHtml(i.msg)}</li>`).join('')}
        ${items.length > 200 ? `<li class="muted">… và ${items.length - 200} mục khác</li>` : ''}</ul>
      </details>`;
    el.issues.innerHTML = issueList(r.errors, 'issues-error', 'Lỗi') + issueList(r.warnings, 'issues-warn', 'Cảnh báo');

    // Xem trước
    let html = '';
    if (r.students?.length) {
      html += `
        <details class="spec" open>
          <summary>Danh sách sinh viên (${r.students.length})</summary>
          <div class="table-wrap preview-table"><table class="table table-compact">
            <thead><tr><th scope="col">#</th><th scope="col">MSSV</th><th scope="col">Họ tên</th><th scope="col">Lớp</th><th scope="col">Mã đề</th><th scope="col">Email</th></tr></thead>
            <tbody>${r.students.slice(0, 300).map((s, i) => `<tr><td class="num">${i + 1}</td><td class="mono">${escapeHtml(s.mssv)}</td><td>${escapeHtml(s.hoTen)}</td><td>${escapeHtml(s.lop)}</td><td><span class="badge">${escapeHtml(s.maDe)}</span></td><td>${escapeHtml(s.email || '')}</td></tr>`).join('')}</tbody>
          </table></div>
          ${r.students.length > 300 ? `<p class="muted">Hiển thị 300/${r.students.length} dòng đầu.</p>` : ''}
        </details>`;
    }
    for (const code of examCodes) {
      const ex = r.exams[code];
      html += `
        <details class="spec">
          <summary>Đề ${escapeHtml(code)} — ${escapeHtml(ex.tieuDe)} · ${ex.thoiGian ?? '?'} phút · ${ex.cauHoi.length} câu</summary>
          <ol class="q-preview">${ex.cauHoi.map(q => `
            <li><div class="qp-text">${escapeHtml(q.noiDung)}</div>
              <ul>${q.luaChon.map((o, j) => `<li class="${r.answers[code][q.id] === j ? 'correct' : ''}"><strong>${LETTERS[j]}.</strong> ${escapeHtml(o)}${r.answers[code][q.id] === j ? ` <span class="text-success">${ICONS.check}</span>` : ''}</li>`).join('')}</ul>
            </li>`).join('')}</ol>
        </details>`;
    }
    el.preview.innerHTML = html;

    // Bước 4
    el.applyStep.hidden = !ok;
    if (ok) {
      files = DataImporter.buildFiles(r);
      el.fileLinks.innerHTML = files.map((f, i) => `<li><button class="link-btn" type="button" data-i="${i}">${escapeHtml(f.path)}</button></li>`).join('');
    }
  }

  /* ---------- Bước 4: áp dụng ---------- */
  el.applyBtn.addEventListener('click', async () => {
    if (!current || current.errors.length) return;
    const r = current;
    const parts = [];
    if (r.students) parts.push(`<strong>thay toàn bộ danh sách</strong> bằng ${r.students.length} sinh viên`);
    if (r.exams && Object.keys(r.exams).length) parts.push(`thêm/thay đề <strong>${Object.keys(r.exams).sort().join(', ')}</strong>`);
    const ok = await confirmDialog({
      title: isServer ? 'Lưu dữ liệu lên máy chủ?' : 'Dùng thử dữ liệu này?',
      message: `<p>Sẽ ${parts.join(' và ')}.</p>` +
        (isServer ? '<p>Áp dụng ngay cho mọi sinh viên.</p>' : '<p>Chỉ áp dụng trên trình duyệt này. Bài làm đã có của sinh viên vẫn được giữ.</p>'),
      okText: isServer ? 'Lưu' : 'Dùng thử'
    });
    if (!ok) return;
    setLoading(el.applyBtn, true);
    try {
      await API.admin.importData({ students: r.students, exams: r.exams, answers: r.answers });
      toast(isServer ? 'Đã lưu dữ liệu.' : 'Đã áp dụng trên trình duyệt này. Có thể vào thi thử ngay.', 'success', 5000);
      renderSource();
    } catch (err) {
      if (!handleAuth(err)) toast(err.message, 'error', 6000);
    } finally {
      setLoading(el.applyBtn, false);
    }
  });

  el.zipBtn.addEventListener('click', e => withBtn(e.currentTarget, async () => {
    downloadBlob(await DataImporter.buildZip(files), `du_lieu_quizhub_${today()}.zip`);
  }));
  el.fileLinks.addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const f = files[Number(b.dataset.i)];
    downloadBlob(new Blob([f.content], { type: 'text/javascript;charset=utf-8' }), f.path.split('/').pop());
  });

  /* ---------- Giảng viên: tạo đoạn cấu hình ---------- */
  const tEmail = $('#t-email'), tPass = $('#t-pass'), snippet = $('#t-snippet');
  tEmail.value = CONFIG.EMAIL?.TEACHER_EMAIL || '';
  function renderSnippet() {
    snippet.textContent =
      `// js/config.js — thay 2 dòng tương ứng\n` +
      `ADMIN_PASSWORD: ${JSON.stringify(tPass.value || CONFIG.ADMIN_PASSWORD)},\n` +
      `// trong khối EMAIL: { … }\n` +
      `TEACHER_EMAIL: ${JSON.stringify(tEmail.value.trim() || 'giangvien@example.com')},`;
  }
  [tEmail, tPass].forEach(i => i.addEventListener('input', renderSnippet));
  renderSnippet();
  $('#t-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(snippet.textContent); toast('Đã sao chép.', 'success'); }
    catch (e) {
      const range = document.createRange(); range.selectNodeContents(snippet);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
      toast('Đã chọn đoạn cấu hình, nhấn Ctrl+C để sao chép.');
    }
  });

  renderSource();
})();

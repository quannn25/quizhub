/* Dùng chung cho mọi trang: tiện ích, header/footer, hộp thoại, thông báo, sáng/tối.
   KHÔNG chứa logic dữ liệu — dữ liệu chỉ đi qua js/api.js. */

/** Lỗi có mã, dùng chung cho cả bản local và bản server. */
class ApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

const REASON_LABEL = {
  manual: 'Sinh viên tự nộp bài',
  timeout: 'Hết giờ — hệ thống tự nộp',
  violation: 'Vi phạm quy chế — hệ thống tự nộp'
};
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const pad = n => String(n).padStart(2, '0');

/** 754000 → "12:34" ; ≥ 1 giờ → "1:02:03" */
function formatClock(ms) {
  const t = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
function formatDuration(ms) {
  const t = Math.round(Math.max(0, ms) / 1000);
  const m = Math.floor(t / 60), s = t % 60;
  return m ? `${m} phút ${s} giây` : `${s} giây`;
}
function formatDateTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} · ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function formatTime(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
const formatScore = x => Number(x).toLocaleString('vi-VN', { maximumFractionDigits: 2 });

/* ---------- Giao diện sáng / tối ---------- */
const Theme = {
  KEY: 'quiz.theme',
  init() {
    let t = null;
    try { t = localStorage.getItem(this.KEY); } catch (e) { /* bỏ qua */ }
    if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  },
  current() {
    return document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  },
  toggle() {
    const next = this.current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(this.KEY, next); } catch (e) { /* bỏ qua */ }
  }
};
Theme.init();

const ICONS = {
  theme: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>'
};

/* ---------- Header / footer ---------- */
function renderHeader(active) {
  const h = document.getElementById('site-header');
  if (!h) return;
  const links = [
    ['index.html', 'Trang chủ', 'home'],
    ['login.html', 'Vào thi', 'login'],
    ['about.html', 'Giới thiệu', 'about'],
    ['admin.html', 'Giảng viên', 'admin']
  ];
  h.className = 'site-header';
  h.innerHTML = `
    <div class="container header-inner">
      <a class="brand" href="index.html">
        <img src="assets/logo.svg" alt="" width="32" height="32">
        <span>${escapeHtml(CONFIG.APP_NAME)}</span>
      </a>
      <nav class="nav" aria-label="Điều hướng chính">
        ${links.map(([href, label, key]) =>
          `<a href="${href}" ${key === active ? 'aria-current="page"' : ''}>${label}</a>`).join('')}
      </nav>
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="Đổi giao diện sáng/tối" title="Sáng / tối">${ICONS.theme}</button>
    </div>`;
  $('#theme-toggle').addEventListener('click', () => Theme.toggle());
}

function renderFooter() {
  const f = document.getElementById('site-footer');
  if (!f) return;
  f.className = 'site-footer';
  f.innerHTML = `<div class="container">© ${new Date().getFullYear()} ${escapeHtml(CONFIG.APP_NAME)} · Đề án môn Thiết kế Web &amp; Đồ họa — ĐH Hoa Sen</div>`;
}

/* ---------- Thông báo nhỏ (toast) ---------- */
function toast(message, type = 'info', ms = 3500) {
  let box = document.getElementById('toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'toasts';
    box.setAttribute('aria-live', 'polite');
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('hide'); setTimeout(() => t.remove(), 300); }, ms);
}

/* ---------- Hộp thoại xác nhận ---------- */
function confirmDialog({ title, message, okText = 'Đồng ý', cancelText = 'Hủy', danger = false }) {
  return new Promise(resolve => {
    const d = document.createElement('dialog');
    d.className = 'dialog';
    d.innerHTML = `
      <form method="dialog">
        <h2 class="dialog-title">${escapeHtml(title)}</h2>
        <div class="dialog-body">${message}</div>
        <div class="dialog-actions">
          <button value="cancel" class="btn btn-outline">${escapeHtml(cancelText)}</button>
          <button value="ok" class="btn ${danger ? 'btn-danger' : 'btn-primary'}">${escapeHtml(okText)}</button>
        </div>
      </form>`;
    document.body.appendChild(d);
    d.addEventListener('close', () => { resolve(d.returnValue === 'ok'); d.remove(); });
    d.showModal();
    $('button[value="ok"]', d).focus();
  });
}

/** Tải một Blob về máy với tên file cho trước. */
function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/** Khóa nút + hiện vòng xoay khi đang chờ. */
function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('is-loading', loading);
}

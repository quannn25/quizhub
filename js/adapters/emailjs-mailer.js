/* =========================================================
   EmailJsMailer — gửi email kết quả thi từ trình duyệt qua EmailJS (https://www.emailjs.com)
   Chỉ LocalAdapter dùng. KHI LÊN SERVER: server tự gửi mail, xóa file này và gỡ khóa trong config.js.

   ⚠ Khóa public của EmailJS nằm lộ trong mã nguồn → người khác có thể gửi email giả.
     Chấp nhận được cho đồ án; nên bật giới hạn domain trong EmailJS (Account → Security).

   Các biến dùng trong template EmailJS (xem mẫu trong README):
   {{to_email}} {{cc_email}} {{subject}} {{ho_ten}} {{mssv}} {{lop}} {{ma_de}} {{tieu_de}}
   {{score}} {{correct}} {{total}} {{answered}} {{reason}} {{started_at}} {{submitted_at}}
   {{duration}} {{violations}} {{detail}}
   ========================================================= */
window.EmailJsMailer = (() => {
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js';
  let sdkPromise = null;

  function loadSdk() {
    if (window.emailjs) return Promise.resolve();
    if (!sdkPromise) {
      sdkPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = SDK_URL;
        s.onload = resolve;
        s.onerror = () => { sdkPromise = null; s.remove(); reject(new Error('Không tải được thư viện EmailJS (kiểm tra mạng).')); };
        document.head.appendChild(s);
      });
    }
    return sdkPromise;
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Hết thời gian chờ máy chủ email.')), ms))
    ]);
  }

  const isConfigured = () => {
    const E = CONFIG.EMAIL || {};
    return !!(E.PUBLIC_KEY && E.SERVICE_ID && E.TEMPLATE_ID && E.TEACHER_EMAIL);
  };

  // "Câu 1: B ✔" / "Câu 2: A ✘ (đáp án C)" / "Câu 3: bỏ trống (đáp án B)"
  function detailText(detail) {
    return detail.map((d, i) => {
      const chon = d.chon === null ? 'bỏ trống' : LETTERS[d.chon];
      if (d.dung) return `Câu ${i + 1}: ${chon} ✔`;
      return `Câu ${i + 1}: ${chon} ✘ (đáp án ${LETTERS[d.dapAn]})`;
    }).join('\n');
  }

  function buildParams(r, studentEmail) {
    const E = CONFIG.EMAIL;
    return {
      to_email: E.TEACHER_EMAIL,
      cc_email: E.CC_STUDENT && studentEmail ? studentEmail : '',
      subject: `[KẾT QUẢ THI] ${r.maDe} - ${r.mssv} - ${r.hoTen}`,
      ho_ten: r.hoTen,
      mssv: r.mssv,
      lop: r.lop,
      ma_de: r.maDe,
      tieu_de: r.tieuDe,
      score: formatScore(r.score),
      correct: r.correct,
      total: r.total,
      answered: r.answered,
      reason: REASON_LABEL[r.reason] || r.reason,
      started_at: formatDateTime(r.startedAt),
      submitted_at: formatDateTime(r.submittedAt),
      duration: formatDuration(r.durationMs),
      violations: r.violations,
      detail: detailText(r.detail)
    };
  }

  return {
    isConfigured,
    /** Luôn resolve (không throw): { status: 'sent' | 'failed' | 'disabled', at, to?, error? } */
    async send(result, studentEmail) {
      const at = Date.now();
      if (!isConfigured()) return { status: 'disabled', at };
      const E = CONFIG.EMAIL;
      try {
        await loadSdk();
        await withTimeout(
          window.emailjs.send(E.SERVICE_ID, E.TEMPLATE_ID, buildParams(result, studentEmail), { publicKey: E.PUBLIC_KEY }),
          E.TIMEOUT_MS || 10000
        );
        return { status: 'sent', at: Date.now(), to: E.TEACHER_EMAIL };
      } catch (err) {
        return { status: 'failed', at: Date.now(), error: err?.text || err?.message || 'Lỗi không xác định.' };
      }
    }
  };
})();

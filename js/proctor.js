/* =========================================================
   Proctor — giám sát phòng thi PHÍA TRÌNH DUYỆT
   - Bắt buộc chế độ toàn màn hình (nếu trình duyệt hỗ trợ).
   - Phát hiện: chuyển tab / thu nhỏ (visibilitychange), chuyển cửa sổ hoặc ứng dụng khác (blur),
     thoát toàn màn hình (fullscreenchange).
   - Mỗi lần vi phạm: cảnh báo + báo về API; đủ số lần tối đa → gọi onLimit (tự nộp bài).
   - Chặn chuột phải, copy/cut/paste, kéo thả, phím tắt DevTools / xem nguồn / lưu / in.

   GIỚI HẠN (ghi rõ trong báo cáo): trang web KHÔNG thể chặn Alt+Tab, điện thoại, máy thứ hai,
   hay phần mềm chạy trên màn hình phụ — chỉ PHÁT HIỆN được khi trang mất focus.
   Khóa máy thật sự cần phần mềm như Safe Exam Browser.

   Module này độc lập với dữ liệu: chỉ nhận callback, không gọi API trực tiếp.
   ========================================================= */
class Proctor {
  constructor({
    maxViolations = 3,
    initialCount = 0,
    requireFullscreen = true,
    blockShortcuts = true,
    onViolation = async () => null,   // ({type, at}) → Promise<số lần vi phạm do server ghi nhận | null>
    onCountChange = () => {},
    onLimit = () => {}
  } = {}) {
    Object.assign(this, { maxViolations, requireFullscreen, blockShortcuts, onViolation, onCountChange, onLimit });
    this.count = initialCount;
    this.active = false;
    this.unloading = false;
    this.lastAt = 0;
    this.ui = {
      root: document.getElementById('proctor-overlay'),
      title: document.getElementById('proctor-title'),
      text: document.getElementById('proctor-text'),
      btn: document.getElementById('proctor-btn')
    };

    // Giữ tham chiếu để gỡ listener khi dừng
    this.h = {
      visibility: () => { if (document.visibilityState === 'hidden') this.violate('tab_hidden'); },
      blur: () => this.violate('window_blur'),
      fullscreen: () => {
        if (this.requireFullscreen && this.fullscreenSupported && !this.isFullscreen()) this.violate('fullscreen_exit');
      },
      pagehide: () => { this.unloading = true; },   // tải lại / rời trang có xác nhận → không tính là vi phạm
      prevent: e => e.preventDefault(),
      keydown: e => this.onKeydown(e)
    };
    this.ui.btn?.addEventListener('click', () => this.resume());
  }

  static LABELS = {
    tab_hidden: 'Bạn đã chuyển sang tab khác hoặc thu nhỏ trình duyệt.',
    window_blur: 'Bạn đã chuyển sang cửa sổ hoặc ứng dụng khác.',
    fullscreen_exit: 'Bạn đã thoát chế độ toàn màn hình.'
  };

  get fullscreenSupported() {
    return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
  }
  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  /** → true nếu đã vào toàn màn hình. Không bao giờ treo: một số trình duyệt nhúng không trả lời yêu cầu. */
  async enterFullscreen() {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!fn) return false;
    try {
      await Promise.race([
        Promise.resolve(fn.call(el)),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
      ]);
    } catch (e) { /* bị từ chối hoặc không phản hồi */ }
    return this.isFullscreen();
  }
  get needsFullscreen() {
    return this.requireFullscreen && this.fullscreenSupported && !this.isFullscreen();
  }

  start() {
    if (this.active) return;
    this.active = true;
    document.addEventListener('visibilitychange', this.h.visibility);
    window.addEventListener('blur', this.h.blur);
    document.addEventListener('fullscreenchange', this.h.fullscreen);
    document.addEventListener('webkitfullscreenchange', this.h.fullscreen);
    window.addEventListener('pagehide', this.h.pagehide);
    if (this.blockShortcuts) {
      ['contextmenu', 'copy', 'cut', 'paste', 'dragstart', 'drop'].forEach(t => document.addEventListener(t, this.h.prevent));
      document.addEventListener('keydown', this.h.keydown, true);
    }
    this.onCountChange(this.count);

    if (this.count >= this.maxViolations) { this.onLimit(); return; }
    if (this.needsFullscreen) {
      this.show('Bài thi yêu cầu chế độ toàn màn hình',
        'Trong lúc thi, mọi lần chuyển tab, chuyển cửa sổ hoặc thoát toàn màn hình đều bị ghi nhận. ' +
        `Vi phạm ${this.maxViolations} lần, bài thi sẽ tự động được nộp.`,
        'Vào toàn màn hình & làm bài', 'info');
    }
  }

  stop() {
    this.active = false;
    document.removeEventListener('visibilitychange', this.h.visibility);
    window.removeEventListener('blur', this.h.blur);
    document.removeEventListener('fullscreenchange', this.h.fullscreen);
    document.removeEventListener('webkitfullscreenchange', this.h.fullscreen);
    window.removeEventListener('pagehide', this.h.pagehide);
    ['contextmenu', 'copy', 'cut', 'paste', 'dragstart', 'drop'].forEach(t => document.removeEventListener(t, this.h.prevent));
    document.removeEventListener('keydown', this.h.keydown, true);
    this.hide();
  }

  async violate(type) {
    if (!this.active || this.unloading) return;
    const now = Date.now();
    // Một lần Alt+Tab có thể bắn cả blur + visibilitychange + fullscreenchange → gộp thành 1 vi phạm.
    if (now - this.lastAt < 1500) return;
    this.lastAt = now;

    this.count++;
    this.onCountChange(this.count);
    const remaining = this.maxViolations - this.count;
    if (remaining > 0) {
      this.show(`Cảnh báo vi phạm (${this.count}/${this.maxViolations})`,
        `${Proctor.LABELS[type] || 'Phát hiện rời khỏi phòng thi.'} Vi phạm thêm ${remaining} lần nữa, bài thi sẽ tự động được nộp.`,
        'Quay lại làm bài', 'danger');
    }

    try {
      const serverCount = await this.onViolation({ type, at: now });
      if (Number.isInteger(serverCount) && serverCount > this.count) {
        this.count = serverCount;
        this.onCountChange(this.count);
      }
    } catch (e) { /* không ghi được vẫn tính ở máy */ }

    if (this.count >= this.maxViolations && this.active) {
      this.hide();
      this.stop();
      this.onLimit();
    }
  }

  async resume() {
    if (this.resuming) return;
    this.resuming = true;
    this.ui.btn.disabled = true;
    if (this.requireFullscreen && this.fullscreenSupported) {
      const ok = await this.enterFullscreen();
      if (!ok) {
        // Trình duyệt / khung nhúng không cho toàn màn hình → vẫn cho thi, chỉ giám sát chuyển tab/cửa sổ.
        this.requireFullscreen = false;
        if (typeof toast === 'function') toast('Trình duyệt không cho phép toàn màn hình. Hệ thống vẫn ghi nhận khi bạn chuyển tab hoặc cửa sổ.', 'warn', 6000);
      }
    }
    // Vừa vào lại toàn màn hình có thể kéo theo sự kiện focus/blur → bỏ qua trong 1,5 giây
    this.lastAt = Date.now();
    this.ui.btn.disabled = false;
    this.resuming = false;
    this.hide();
  }

  show(title, text, button, tone) {
    const { root } = this.ui;
    if (!root) return;
    this.ui.title.textContent = title;
    this.ui.text.textContent = text;
    this.ui.btn.textContent = button;
    root.dataset.tone = tone;
    root.hidden = false;
    this.ui.btn.focus();
  }
  hide() {
    if (this.ui.root) this.ui.root.hidden = true;
  }

  onKeydown(e) {
    const k = e.key.toLowerCase();
    const ctrl = e.ctrlKey || e.metaKey;
    const blocked =
      k === 'f12' ||
      (ctrl && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) ||   // DevTools
      (ctrl && ['u', 's', 'p', 'c', 'x', 'v', 'a'].includes(k));     // xem nguồn, lưu, in, copy/paste, chọn hết
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}

/* Đồng hồ đếm ngược tính theo DEADLINE (mốc giờ tuyệt đối), không đếm lùi từng giây.
   → Tải lại trang, máy bị treo hay tab chạy nền đều không làm sai giờ.
   serverNow giúp căn giờ máy sinh viên theo giờ server (bản local: serverNow = giờ máy). */
class ExamTimer {
  constructor({ deadline, serverNow = Date.now(), onTick, onExpire }) {
    this.deadline = deadline;
    this.offset = serverNow - Date.now();
    this.onTick = onTick;
    this.onExpire = onExpire;
    this.expired = false;
    this.handle = null;
  }
  now() { return Date.now() + this.offset; }
  remaining() { return Math.max(0, this.deadline - this.now()); }
  start() {
    this.tick();
    if (!this.expired) this.handle = setInterval(() => this.tick(), 250);
  }
  stop() {
    clearInterval(this.handle);
    this.handle = null;
  }
  tick() {
    const left = this.remaining();
    this.onTick?.(left);
    if (left <= 0 && !this.expired) {
      this.expired = true;
      this.stop();
      this.onExpire?.();
    }
  }
}

/* =========================================================
   DataImporter — đọc file Excel / CSV, kiểm tra lỗi, tạo file dữ liệu
   Không đụng tới giao diện và không gọi API → dùng lại được khi có server
   (server nhận đúng đối tượng { students, exams, answers } mà module này tạo ra).

   Định dạng cột (không phân biệt hoa thường, có dấu hay không dấu):
   - Sinh viên : MSSV | Họ tên | Lớp | Mã đề | Email (tùy chọn)
   - Đề thi    : Mã đề | Tiêu đề | Thời gian (phút) | STT | Nội dung câu hỏi | A | B | C | D | (E | F) | Đáp án
                 Mã đề / Tiêu đề / Thời gian chỉ cần ghi ở dòng đầu của mỗi đề.
   Một file Excel có thể chứa cả hai sheet; loại sheet được nhận diện theo tên cột.
   ========================================================= */
const DataImporter = (() => {
  const LIBS = {
    XLSX: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    JSZip: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
  };
  const loading = {};
  function loadLib(name) {
    if (window[name]) return Promise.resolve(window[name]);
    if (!loading[name]) {
      loading[name] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = LIBS[name];
        s.onload = () => resolve(window[name]);
        s.onerror = () => {
          delete loading[name];
          s.remove();
          reject(new Error(`Không tải được thư viện ${name === 'XLSX' ? 'đọc Excel' : 'nén ZIP'}. Kiểm tra kết nối Internet` +
            (name === 'XLSX' ? ', hoặc lưu file dưới dạng CSV (UTF-8) rồi nhập lại.' : '.')));
        };
        document.head.appendChild(s);
      });
    }
    return loading[name];
  }

  /* ---------- Nhận diện cột ---------- */
  // "Họ và tên" → "hovaten", "Thời gian (phút)" → "thoigianphut"
  const keyOf = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
  const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const CODE_COLS = ['made', 'madethi', 'de', 'examcode'];
  const COLUMNS = {
    students: {
      mssv: ['mssv', 'masosinhvien', 'masv', 'studentid'],
      hoTen: ['hoten', 'hovaten', 'hotensinhvien', 'ten', 'name', 'fullname'],
      lop: ['lop', 'tenlop', 'class'],
      maDe: CODE_COLS,
      email: ['email', 'mail', 'emailsinhvien']
    },
    exams: {
      maDe: CODE_COLS,
      tieuDe: ['tieude', 'tenbaithi', 'baithi', 'title'],
      thoiGian: ['thoigian', 'thoigianphut', 'phut', 'thoiluong', 'duration'],
      stt: ['stt', 'cau', 'socau', 'no'],
      noiDung: ['noidung', 'cauhoi', 'noidungcauhoi', 'question'],
      ...Object.fromEntries(OPTION_KEYS.map(k => [k, [k.toLowerCase(), 'luachon' + k.toLowerCase(), 'phuongan' + k.toLowerCase()]])),
      dapAn: ['dapan', 'dapandung', 'answer', 'key']
    }
  };

  function mapHeader(row, type) {
    const map = {};
    row.forEach((cell, i) => {
      const k = keyOf(cell);
      for (const [field, aliases] of Object.entries(COLUMNS[type])) {
        if (aliases.includes(k) && !Object.values(map).includes(field)) { map[i] = field; break; }
      }
    });
    return map;
  }
  function detectType(row) {
    const keys = row.map(keyOf);
    const has = list => keys.some(k => list.includes(k));
    if (has(COLUMNS.exams.noiDung) && has(COLUMNS.exams.dapAn)) return 'exams';
    if (has(COLUMNS.students.mssv) && has(COLUMNS.students.hoTen)) return 'students';
    return null;
  }

  /* ---------- Đọc file ---------- */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0] || '';
    const count = ch => first.split(ch).length - 1;
    const delim = count(';') > count(',') ? ';' : count('\t') > count(',') ? '\t' : ',';   // Excel tiếng Việt hay lưu bằng ";"
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
        else cell += c;
      } else if (c === '"' && cell === '') quoted = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  // CSV lưu bằng "CSV (Comma delimited)" của Excel là bảng mã Windows-1258, không phải UTF-8
  function decodeText(buf, notes, name) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
    catch (e) {
      notes.push({ where: name, msg: 'File không phải UTF-8, đã đọc theo bảng mã Windows-1258. Nếu dấu tiếng Việt bị lỗi, hãy lưu lại bằng "CSV UTF-8".' });
      return new TextDecoder('windows-1258').decode(buf);
    }
  }

  /** files → [{ name, rows: string[][], firstLine }] */
  async function readFiles(files, notes) {
    const out = [];
    for (const file of files) {
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      const buf = await file.arrayBuffer();
      if (['csv', 'txt', 'tsv'].includes(ext)) {
        out.push({ name: file.name, rows: parseCSV(decodeText(buf, notes, file.name)), firstLine: 1 });
      } else if (['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) {
        const XLSX = await loadLib('XLSX');
        const wb = XLSX.read(buf, { type: 'array' });
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          if (!ws['!ref']) continue;
          const start = XLSX.utils.decode_range(ws['!ref']).s.r;
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true });
          out.push({ name: `${file.name} › ${sheetName}`, sheetName, rows, firstLine: start + 1 });
        }
      } else {
        notes.push({ where: file.name, msg: 'Định dạng không hỗ trợ (chỉ nhận .xlsx, .xls, .csv).' });
      }
    }
    return out;
  }

  /** Tách các bảng thành dòng sinh viên / dòng đề thi, kèm vị trí (file · dòng) để báo lỗi */
  function collectRows(sources, notes) {
    const students = [], exams = [];
    let foundStudents = false, foundExams = false;
    for (const src of sources) {
      const h = src.rows.slice(0, 10).findIndex(r => detectType(r));
      if (h === -1) {
        if (!/huongdan|readme|guide/.test(keyOf(src.sheetName || ''))) {
          notes.push({ where: src.name, msg: 'Không nhận ra bảng (cần cột "MSSV, Họ tên" cho sinh viên hoặc "Nội dung câu hỏi, Đáp án" cho đề thi). Đã bỏ qua.' });
        }
        continue;
      }
      const type = detectType(src.rows[h]);
      const map = mapHeader(src.rows[h], type);
      const target = type === 'students' ? students : exams;
      if (type === 'students') foundStudents = true; else foundExams = true;
      src.rows.slice(h + 1).forEach((r, i) => {
        if (!r.some(c => String(c).trim() !== '')) return;   // bỏ dòng trống
        const obj = { __where: `${src.name} · dòng ${src.firstLine + h + 1 + i}` };
        Object.entries(map).forEach(([col, field]) => { obj[field] = String(r[col] ?? '').trim(); });
        target.push(obj);
      });
    }
    return { students: foundStudents ? students : null, exams: foundExams ? exams : null };
  }

  /* ---------- Kiểm tra & chuẩn hóa ---------- */
  const CODE_RE = /^[A-Za-z0-9_-]{1,20}$/;
  const MSSV_RE = /^[A-Za-z0-9]{3,20}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate({ students: sRows, exams: eRows }) {
    const errors = [], warnings = [];
    const err = (where, msg) => errors.push({ where, msg });
    const warn = (where, msg) => warnings.push({ where, msg });

    /* Đề thi */
    let exams = null, answers = null;
    if (eRows) {
      exams = {}; answers = {};
      const first = {};
      let lastCode = '';
      for (const r of eRows) {
        const w = r.__where;
        const code = (r.maDe || lastCode).toUpperCase();
        if (r.maDe) lastCode = r.maDe.toUpperCase();
        if (!code) { err(w, 'Thiếu mã đề (ghi ở dòng đầu của mỗi đề).'); continue; }
        if (!CODE_RE.test(code)) { err(w, `Mã đề "${code}" chỉ được gồm chữ, số, "-" hoặc "_" (tối đa 20 ký tự).`); continue; }

        const ex = exams[code] || (exams[code] = { maDe: code, tieuDe: '', thoiGian: null, cauHoi: [] });
        answers[code] = answers[code] || {};
        first[code] = first[code] || w;

        if (r.tieuDe) {
          if (!ex.tieuDe) ex.tieuDe = r.tieuDe;
          else if (r.tieuDe !== ex.tieuDe) warn(w, `Tiêu đề khác dòng đầu của đề ${code}; dùng "${ex.tieuDe}".`);
        }
        if (r.thoiGian) {
          const n = Number(r.thoiGian.replace(',', '.'));
          if (!Number.isFinite(n) || n < 1 || n > 600) err(w, `Thời gian "${r.thoiGian}" không hợp lệ (số phút từ 1 đến 600).`);
          else if (ex.thoiGian === null) ex.thoiGian = Math.round(n);
          else if (Math.round(n) !== ex.thoiGian) warn(w, `Thời gian khác dòng đầu của đề ${code}; dùng ${ex.thoiGian} phút.`);
        }

        const vals = OPTION_KEYS.map(k => r[k] || '');
        const lastOpt = vals.reduce((m, v, i) => (v ? i : m), -1);
        if (!r.noiDung) {
          if (lastOpt >= 0 || r.dapAn) err(w, 'Thiếu nội dung câu hỏi.');
          continue;   // dòng chỉ có tiêu đề / thời gian là hợp lệ
        }

        let bad = false;
        const opts = vals.slice(0, lastOpt + 1);
        if (opts.length < 2) { err(w, 'Mỗi câu cần ít nhất 2 lựa chọn (cột A, B…).'); bad = true; }
        else if (opts.some(v => !v)) {
          err(w, `Lựa chọn ${OPTION_KEYS[opts.findIndex(v => !v)]} bị bỏ trống giữa các lựa chọn khác.`); bad = true;
        }
        const a = (r.dapAn || '').toUpperCase();
        let idx = a.length === 1 ? OPTION_KEYS.indexOf(a) : -1;
        if (/^[1-6]$/.test(a)) idx = Number(a) - 1;
        if (!a) { err(w, 'Thiếu đáp án đúng.'); bad = true; }
        else if (idx < 0) { err(w, `Đáp án "${r.dapAn}" không hợp lệ (ghi một chữ A, B, C, D…).`); bad = true; }
        else if (idx >= opts.length) { err(w, `Đáp án ${OPTION_KEYS[idx]} trỏ tới lựa chọn đang để trống.`); bad = true; }
        if (bad) continue;

        if (new Set(opts.map(o => o.toLowerCase())).size < opts.length) warn(w, 'Có hai lựa chọn giống nhau.');
        if (ex.cauHoi.some(q => q.noiDung.toLowerCase() === r.noiDung.toLowerCase())) warn(w, `Câu hỏi bị trùng trong đề ${code}.`);

        const id = 'q' + (ex.cauHoi.length + 1);
        ex.cauHoi.push({ id, noiDung: r.noiDung, luaChon: opts });
        answers[code][id] = idx;
      }
      for (const [code, ex] of Object.entries(exams)) {
        if (!ex.cauHoi.length) err(first[code], `Đề ${code} chưa có câu hỏi hợp lệ nào.`);
        if (ex.thoiGian === null) err(first[code], `Đề ${code} thiếu thời gian làm bài (cột "Thời gian (phút)" ở dòng đầu của đề).`);
        if (!ex.tieuDe) { ex.tieuDe = `Bài thi ${code}`; warn(first[code], `Đề ${code} chưa có tiêu đề; tạm đặt "${ex.tieuDe}".`); }
      }
    }

    /* Sinh viên */
    let students = null;
    const studentWhere = {};
    if (sRows) {
      students = [];
      const seen = new Map();
      for (const r of sRows) {
        const w = r.__where;
        const mssv = (r.mssv || '').toUpperCase();
        const maDe = (r.maDe || '').toUpperCase();
        let bad = false;
        if (!mssv) { err(w, 'Thiếu MSSV.'); bad = true; }
        else if (!MSSV_RE.test(mssv)) { err(w, `MSSV "${r.mssv}" chỉ được gồm chữ và số (3–20 ký tự). Nếu Excel đổi thành dạng 2.2E+07, hãy định dạng cột MSSV là Text.`); bad = true; }
        else if (seen.has(mssv)) { err(w, `MSSV ${mssv} bị trùng (đã có ở ${seen.get(mssv)}).`); bad = true; }
        if (!r.hoTen) { err(w, 'Thiếu họ tên.'); bad = true; }
        if (!maDe) { err(w, 'Thiếu mã đề.'); bad = true; }
        else if (!CODE_RE.test(maDe)) { err(w, `Mã đề "${r.maDe}" không hợp lệ.`); bad = true; }
        let email = r.email || '';
        if (email && !EMAIL_RE.test(email)) { warn(w, `Email "${email}" không hợp lệ, sẽ để trống.`); email = ''; }
        if (bad) continue;
        seen.set(mssv, w);
        studentWhere[mssv] = w;
        students.push({ mssv, hoTen: r.hoTen, lop: r.lop || '', maDe, ...(email ? { email } : {}) });
      }
      if (!students.length && !errors.length) err('Danh sách sinh viên', 'Không có sinh viên nào.');
      if (exams) {
        const used = new Set(students.map(s => s.maDe));
        Object.keys(exams).filter(c => !used.has(c)).forEach(c => warn(`Đề ${c}`, `Đề ${c} chưa được gán cho sinh viên nào.`));
      }
    }

    return { students, exams, answers, errors, warnings, studentWhere };
  }

  /** Bước kiểm tra cần hỏi API: mã đề của SV phải có trong file đề vừa nhập hoặc trong dữ liệu hiện có */
  function codesToCheck(result) {
    if (!result.students) return [];
    return [...new Set(result.students.map(s => s.maDe))].filter(c => !result.exams?.[c]);
  }
  function applyExamCheck(result, existsMap) {
    const missing = Object.entries(existsMap).filter(([, ok]) => !ok).map(([c]) => c);
    for (const code of missing) {
      const s = result.students.find(x => x.maDe === code);
      result.errors.push({ where: result.studentWhere[s.mssv], msg: `Mã đề ${code} chưa có đề thi. Hãy nhập đề ${code} cùng lúc (sheet Đề thi) hoặc sửa lại mã đề.` });
    }
    return result;
  }

  /* ---------- Tạo file dữ liệu ---------- */
  const stamp = () => {
    const d = new Date();
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const HEAD = "window.QUIZ_DATA = window.QUIZ_DATA || { exams: {}, answers: {} };\n\n";

  function studentsJs(students) {
    return `/* Danh sách sinh viên dự thi — tạo bởi trang Nhập dữ liệu lúc ${stamp()}.\n` +
      `   KHI LÊN SERVER: chuyển vào CSDL / Google Sheet và xóa file này khỏi bản deploy. */\n` + HEAD +
      'QUIZ_DATA.students = [\n' + students.map(s => '  ' + JSON.stringify(s)).join(',\n') + '\n];\n';
  }
  function examJs(exam) {
    const clean = { maDe: exam.maDe, tieuDe: exam.tieuDe, thoiGian: exam.thoiGian, cauHoi: exam.cauHoi };
    return `/* Đề ${exam.maDe} — KHÔNG chứa đáp án (đáp án ở data/answers/${exam.maDe}.js). Tạo lúc ${stamp()}. */\n` + HEAD +
      `QUIZ_DATA.exams[${JSON.stringify(exam.maDe)}] = ${JSON.stringify(clean, null, 2)};\n`;
  }
  function answersJs(code, key) {
    return `/* Đáp án ${code} — chỉ số lựa chọn đúng (0 = A, 1 = B, 2 = C, 3 = D…). Tạo lúc ${stamp()}.\n` +
      `   ⚠ Bản tĩnh: ai mở file này cũng xem được. KHI LÊN SERVER: xóa thư mục data/answers/ khỏi bản deploy. */\n` + HEAD +
      `QUIZ_DATA.answers[${JSON.stringify(code)}] = ${JSON.stringify(key)};\n`;
  }

  /** → [{ path: 'data/students.js', content }] */
  function buildFiles({ students, exams, answers }) {
    const files = [];
    if (students) files.push({ path: 'data/students.js', content: studentsJs(students) });
    for (const code of Object.keys(exams || {}).sort()) {
      files.push({ path: `data/exams/${code}.js`, content: examJs(exams[code]) });
      files.push({ path: `data/answers/${code}.js`, content: answersJs(code, answers[code]) });
    }
    return files;
  }

  async function buildZip(files) {
    const JSZip = await loadLib('JSZip');
    const zip = new JSZip();
    files.forEach(f => zip.file(f.path, f.content));
    zip.file('HUONG_DAN.txt',
      'CÁCH CẬP NHẬT DỮ LIỆU CHO WEBSITE QUIZHUB\r\n\r\n' +
      '1. Giải nén file này.\r\n' +
      '2. Chép thư mục "data" vào thư mục website (exam_online), chọn "Thay thế" (Replace) khi được hỏi.\r\n' +
      '3. Mở lại website (F5). Nếu website đặt trên GitHub Pages: tải các file mới lên repository.\r\n' +
      '4. Vào trang Giảng viên → Nhập dữ liệu, bấm "Quay về dữ liệu gốc" nếu trước đó đã dùng thử.\r\n\r\n' +
      'Các file:\r\n' + files.map(f => ' - ' + f.path).join('\r\n') + '\r\n');
    return zip.generateAsync({ type: 'blob' });
  }

  /* ---------- File mẫu & xuất dữ liệu hiện có ---------- */
  const STUDENT_HEADER = ['MSSV', 'Họ tên', 'Lớp', 'Mã đề', 'Email'];
  function toSheets({ students, exams, answers }) {
    const maxOpts = Math.max(4, ...Object.values(exams || {}).flatMap(e => e.cauHoi.map(q => q.luaChon.length)));
    const optCols = OPTION_KEYS.slice(0, maxOpts);
    const examHeader = ['Mã đề', 'Tiêu đề', 'Thời gian (phút)', 'STT', 'Nội dung câu hỏi', ...optCols, 'Đáp án'];
    const sv = [STUDENT_HEADER, ...(students || []).map(s => [s.mssv, s.hoTen, s.lop || '', s.maDe, s.email || ''])];
    const de = [examHeader];
    for (const code of Object.keys(exams || {}).sort()) {
      const ex = exams[code];
      ex.cauHoi.forEach((q, i) => {
        const key = answers?.[code]?.[q.id];
        de.push([i === 0 ? code : '', i === 0 ? ex.tieuDe : '', i === 0 ? String(ex.thoiGian) : '', String(i + 1), q.noiDung,
          ...optCols.map((_, j) => q.luaChon[j] || ''), Number.isInteger(key) ? OPTION_KEYS[key] : '']);
      });
    }
    const guide = [
      ['HƯỚNG DẪN NHẬP DỮ LIỆU QUIZHUB'],
      [''],
      ['Sheet "SinhVien": mỗi dòng một sinh viên. MSSV, Họ tên, Mã đề là bắt buộc; Lớp, Email tùy chọn.'],
      ['  - Định dạng cột MSSV là Text để không mất số 0 ở đầu.'],
      ['  - Mã đề phải trùng với một mã đề trong sheet DeThi (hoặc đề đã có sẵn trên website).'],
      ['Sheet "DeThi": mỗi dòng một câu hỏi.'],
      ['  - Mã đề, Tiêu đề, Thời gian (phút) chỉ cần ghi ở dòng đầu của mỗi đề.'],
      ['  - Cột A, B, C, D là các lựa chọn (có thể thêm cột E, F). Cần ít nhất 2 lựa chọn.'],
      ['  - Cột Đáp án ghi một chữ: A, B, C, D…'],
      [''],
      ['Có thể chỉ nhập một sheet (chỉ sinh viên hoặc chỉ đề thi). Có thể lưu từng sheet thành file CSV UTF-8.'],
      ['Sau khi chọn file, trang Nhập dữ liệu sẽ kiểm tra lỗi và chỉ rõ dòng bị lỗi trước khi áp dụng.']
    ];
    return { SinhVien: sv, DeThi: de, HuongDan: guide };
  }

  function sampleData() {
    return {
      students: [
        { mssv: '22110001', hoTen: 'Nguyễn Văn An', lop: 'TINV205DV01', maDe: 'DE01', email: '22110001@sv.example.edu.vn' },
        { mssv: '22110002', hoTen: 'Trần Thị Bình', lop: 'TINV205DV01', maDe: 'DE02' }
      ],
      exams: {
        DE01: { maDe: 'DE01', tieuDe: 'Kiểm tra giữa kỳ — Thiết kế Web', thoiGian: 15, cauHoi: [
          { id: 'q1', noiDung: 'HTML là viết tắt của cụm từ nào?', luaChon: ['HyperText Markup Language', 'High Text Machine Language', 'Hyperlink Tool Markup Language', 'Home Tool Markup Language'] },
          { id: 'q2', noiDung: 'Thẻ nào dùng để tạo liên kết?', luaChon: ['<link>', '<a>', '<href>', '<url>'] }
        ] },
        DE02: { maDe: 'DE02', tieuDe: 'Kiểm tra giữa kỳ — Thiết kế Web', thoiGian: 15, cauHoi: [
          { id: 'q1', noiDung: 'Từ khóa nào khai báo hằng số trong JavaScript?', luaChon: ['var', 'let', 'const', 'static'] },
          { id: 'q2', noiDung: 'Định dạng ảnh nào là ảnh vector?', luaChon: ['JPG', 'PNG', 'SVG'] }
        ] }
      },
      answers: { DE01: { q1: 0, q2: 1 }, DE02: { q1: 2, q2: 2 } }
    };
  }

  async function workbookBlob(data) {
    const XLSX = await loadLib('XLSX');
    const wb = XLSX.utils.book_new();
    const widths = { SinhVien: [12, 26, 14, 9, 30], DeThi: [9, 30, 10, 5, 50, 26, 26, 26, 26, 26, 26, 8], HuongDan: [100] };
    for (const [name, aoa] of Object.entries(toSheets(data))) {
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = (widths[name] || []).map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, name);
    }
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  function csvBlob(aoa) {
    const esc = v => /[",;\r\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
    return new Blob(['﻿' + aoa.map(r => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  }

  /** Toàn bộ quy trình: file → kết quả đã kiểm tra (chưa gồm bước kiểm tra mã đề qua API) */
  async function analyze(files) {
    const notes = [];
    const sources = await readFiles(files, notes);
    const rows = collectRows(sources, notes);
    const result = validate(rows);
    result.warnings.unshift(...notes);
    if (!rows.students && !rows.exams) {
      result.errors.push({ where: 'Tệp đã chọn', msg: 'Không tìm thấy bảng sinh viên hoặc bảng đề thi nào. Hãy dùng file mẫu.' });
    }
    return result;
  }

  return { analyze, codesToCheck, applyExamCheck, buildFiles, buildZip, toSheets, sampleData, workbookBlob, csvBlob, parseCSV };
})();

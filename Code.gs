// WISMIR: penghubung Dashboard + POS ke Google Sheets
// Kode ini TIDAK perlu diedit. PIN tidak ditulis di sini (file ini ada di GitHub publik).
//
// Pemasangan pertama:
//  1. Google Sheet > Extensions > Apps Script, tempel kode ini, simpan (Ctrl+S).
//  2. Pilih fungsi "setup" di toolbar, klik Run, izinkan akses. Semua tab dibuat otomatis.
//  3. Kembali ke Google Sheet, muat ulang halaman. Menu "WISMIR" muncul > Atur PIN.
//  4. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone). Salin URL /exec.
//
// Update kode: hapus semua, tempel kode baru, simpan, lalu
//  Deploy > Manage deployments > Edit (pensil) > Version: New version > Deploy. URL tetap sama, PIN tetap tersimpan.

// ---- Tab milik Dashboard (ditulis ulang penuh setiap sync dari dashboard) ----
const HEADERS = {
  Keuangan: ['id', 'tanggal', 'jenis', 'kategori', 'jumlah', 'channel', 'catatan'],
  // Stok & Staff = daftar produk & karyawan untuk dashboard DAN POS (diatur dari dashboard).
  // stokToko tidak dipakai lagi (stok toko dihitung dari POS); kolomnya dibiarkan supaya urutan tidak bergeser.
  Stok: ['id', 'nama', 'varian', 'stokToko', 'stokOnline', 'min', 'harga', 'kategori', 'aktif', 'sku', 'cogs', 'brand'],
  Tugas: ['id', 'judul', 'tempo', 'selesai', 'div', 'repeat', 'jam', 'every', 'unit', 'link'],
  Purchasing: ['id', 'date', 'name', 'category', 'qty', 'total'],
  Staff: ['id', 'joined', 'name', 'aktif'],
  // sumber = toko asal stok untuk toko online; produk = daftar id produk (JSON), kosong = semua produk
  Store: ['id', 'name', 'type', 'address', 'sumber', 'produk'],
  Production: ['id', 'date', 'name', 'qty', 'material', 'matQty', 'unitCost', 'status', 'total'],
  Marketing: ['id', 'name', 'channel', 'status', 'start', 'end', 'budget', 'spent', 'revenue'],
  // Supplier = bulan rekap supplier yang sudah dibayar (satu baris per bulan, dari dashboard > Production > Supplier)
  Supplier: ['id', 'bulan', 'total', 'paidOn'],
  // Penjualan = rekap penjualan per bulan (impor riwayat lama dari dashboard > Finance > Sales): bulan yyyy-mm, toko, sku, qty, total
  Penjualan: ['id', 'bulan', 'toko', 'sku', 'qty', 'total'],
  // Recurring = pengeluaran berulang (dashboard > Operational > Expense > Recurring): repeat Monthly/Weekly/Daily/Yearly, next = tanggal berikutnya
  Recurring: ['id', 'kategori', 'jumlah', 'catatan', 'repeat', 'next'],
  // Annual = pengeluaran yang dibayar sekaligus di awal (dashboard > Operational > Expense > Annually), dibagi rata per bulan dari bulan 'dari' sampai 'sampai' (yyyy-mm)
  Annual: ['id', 'kategori', 'jumlah', 'catatan', 'dari', 'sampai'],
};

// ---- Tab milik POS (baris ditambah / diperbarui per id, tidak pernah dihapus massal) ----
// POS Produk & POS Karyawan hanya arsip dari versi lama POS; dashboard memindahkannya ke Stok & Staff.
const POS = {
  'POS Produk': ['id', 'nama', 'kategori', 'aktif'],
  'POS Karyawan': ['id', 'nama', 'aktif'],
  'POS Stok': ['id', 'tanggal', 'jam', 'produk', 'dari', 'ke', 'qty', 'oleh', 'catatan', 'status', 'jenis', 'ref', 'pid', 't'],
  'POS Kasir': ['id', 'tanggal', 'jam', 'toko', 'shiftId', 'metode', 'total', 'dibayar', 'kembalian', 'rincian', 'status', 'items', 'pays', 't'],
  'POS Shift': ['id', 'tanggal', 'toko', 'buka', 'tutup', 'karyawan', 'kasAwal', 'penjualanTunai', 'kasMasuk', 'kasKeluar', 'kasSeharusnya', 'tunai', 'transfer', 'edc', 'totalPenjualan', 'transaksi', 'mutasiKas', 'tBuka', 'tTutup'],
  'POS Absen': ['id', 'tanggal', 'jam', 'toko', 'nama', 'shiftId', 'staffId', 't'],
};
const UPD = '_upd'; // waktu server saat baris terakhir diubah (untuk sync bertahap POS)

// Kolom angka. Kolom lain disimpan sebagai TEKS supaya Sheets tidak mengubah
// "2026-11-04" menjadi tanggal (yang bisa bergeser sehari karena zona waktu).
const NUM = {
  Keuangan: ['jumlah'], Stok: ['stokToko', 'stokOnline', 'min', 'harga', 'cogs'], Tugas: ['every'],
  Purchasing: ['qty', 'total'], Production: ['qty', 'matQty', 'unitCost', 'total'],
  Marketing: ['budget', 'spent', 'revenue'], Supplier: ['total'], Penjualan: ['qty', 'total'], Recurring: ['jumlah'], Annual: ['jumlah'],
  'POS Stok': ['qty'], 'POS Kasir': ['total', 'dibayar', 'kembalian'],
  'POS Shift': ['kasAwal', 'penjualanTunai', 'kasMasuk', 'kasKeluar', 'kasSeharusnya', 'tunai', 'transfer', 'edc', 'totalPenjualan', 'transaksi'],
};

// ---- PIN: disimpan di Script Properties, bukan di kode, jadi aman saat kode diganti ----
function getPin() { return PropertiesService.getScriptProperties().getProperty('PIN') || ''; }
const NO_PIN = 'PIN belum diatur. Buka Google Sheet > menu WISMIR > Atur PIN.';

// Menu "WISMIR" di Google Sheet
function onOpen() {
  SpreadsheetApp.getUi().createMenu('WISMIR')
    .addItem('Atur PIN', 'setPin')
    .addItem('Atur katalog website', 'setCatalog')
    .addItem('Siapkan tab', 'setup')
    .addToUi();
}

function setPin() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('Atur PIN WISMIR',
    (getPin() ? 'PIN sudah ada. Isi PIN baru untuk menggantinya. ' : '') +
    'PIN ini dipakai di Settings dashboard dan di Owner > Data tablet POS. Minimal 4 karakter; lebih aman 6 atau lebih.',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const p = r.getResponseText().trim();
  if (p.length < 4) { ui.alert('PIN minimal 4 karakter. PIN tidak diubah.'); return; }
  PropertiesService.getScriptProperties().setProperty('PIN', p);
  ui.alert('PIN tersimpan. Kalau PIN diganti, isi PIN yang sama di dashboard dan semua tablet.');
}

function tell(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { Logger.log(msg); } // dari editor: lihat Execution log
}

// Membuat semua tab + judul kolom. Aman dijalankan ulang: data yang sudah ada tidak dihapus.
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone('Asia/Jakarta');
  Object.keys(HEADERS).concat(Object.keys(POS)).forEach(function (n) {
    const sh = sheetFor(n), cols = colsFor(n);
    sh.getRange(1, 1, 1, cols.length).setBackground('#e5efeb');
    sh.setFrozenRows(1);
  });
  // hapus tab bawaan yang masih kosong (Sheet1 / Lembar1)
  ss.getSheets().forEach(function (sh) {
    const n = sh.getName();
    if (!HEADERS[n] && !POS[n] && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });
  tell('Selesai: ' + ss.getSheets().length + ' tab siap.' + (getPin() ? '' : ' Langkah berikutnya: muat ulang Google Sheet, lalu menu WISMIR > Atur PIN.'));
}

// Versi data dashboard: berubah setiap kali dashboard menyimpan.
// Dipakai supaya perangkat dengan data lama tidak menimpa perubahan dari perangkat lain.
// Versi kode ini. Naikkan setiap kali Code.gs berubah; dashboard memberi tahu owner kalau Apps Script masih versi lama.
const CODE_VERSION = 16;

function dashVer() { return PropertiesService.getScriptProperties().getProperty('dashVer') || '0'; }
// Penanda "Mulai baru" POS: berubah saat riwayat POS dikosongkan, supaya semua tablet ikut membersihkan datanya.
function posEpoch() { return PropertiesService.getScriptProperties().getProperty('posEpoch') || '0'; }

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function colsFor(name) { return HEADERS[name] || POS[name].concat([UPD]); }
function isNum(name, col) { return col === UPD || (NUM[name] || []).indexOf(col) >= 0; }

function sheetFor(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.setFrozenRows(1); }
  const cols = colsFor(name);
  const head = sh.getRange(1, 1, 1, cols.length);
  if (head.getValues()[0].join('|') !== cols.join('|')) {
    head.setNumberFormat('@').setValues([cols]).setFontWeight('bold');
  }
  return sh;
}

// Satu nilai JS -> [nilai sel, format sel]
function cellOf(name, col, v) {
  if (isNum(name, col)) {
    if (v === '' || v === null || v === undefined) return ['', '0'];
    const n = Number(String(v).replace(/,/g, ''));
    if (isFinite(n)) return [n, col === UPD ? '0' : (Number.isInteger(n) ? '#,##0' : '#,##0.##')];
  }
  if (v === null || v === undefined) return ['', '@'];
  if (typeof v === 'object') return [JSON.stringify(v), '@'];
  return [String(v), '@'];
}

function rowsFrom(name, items) {
  const cols = colsFor(name), vals = [], fmts = [];
  items.forEach(function (it) {
    const r = [], f = [];
    cols.forEach(function (c) { const x = cellOf(name, c, it[c]); r.push(x[0]); f.push(x[1]); });
    vals.push(r); fmts.push(f);
  });
  return { vals: vals, fmts: fmts };
}

// Baca satu tab. since > 0: hanya baris POS yang berubah sejak waktu itu.
// v12: total struk (tanpa yang dibatalkan) per tanggal + shift, 40 hari terakhir. Dashboard memakainya untuk penjualan
// shift yang belum ditutup (shift yang sudah ditutup sudah ada di POS Shift). Ringkas: tidak mengirim detail struk.
function posDaily() {
  const d = new Date(); d.setDate(d.getDate() - 40);
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const from = Utilities.formatDate(d, tz, 'yyyy-MM-dd'), agg = {};
  const sh = sheetFor('POS Kasir'), cols = colsFor('POS Kasir'), last = sh.getLastRow();
  if (last < 2) return [];
  // v16: hanya kolom yang perlu (tanggal s/d total, dan status), bukan rincian/isi struk yang panjang
  const a = cols.indexOf('tanggal'), b = cols.indexOf('total'), si = cols.indexOf('status');
  const blk = sh.getRange(2, a + 1, last - 1, b - a + 1).getValues(), st = sh.getRange(2, si + 1, last - 1, 1).getValues();
  const col = function (c) { return cols.indexOf(c) - a; };
  blk.forEach(function (r, i) {
    let t = r[col('tanggal')];
    t = t instanceof Date ? Utilities.formatDate(t, tz, 'yyyy-MM-dd') : String(t || '');
    if (!t || t < from || String(st[i][0]) === 'VOID') return;
    const sid = String(r[col('shiftId')] || ''), k = t + '|' + sid;
    const g = agg[k] || (agg[k] = { id: k, tanggal: t, shiftId: sid, toko: String(r[col('toko')] || ''), total: 0, n: 0 });
    g.total += Number(r[col('total')]) || 0; g.n++;
  });
  return Object.keys(agg).map(function (k) { return agg[k]; });
}
function readSheet(name, since) {
  const sh = sheetFor(name), cols = colsFor(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const ui = cols.indexOf(UPD);
  let first = 2, n = last - 1;
  if (since && ui >= 0) {
    // v16 (owner 2026-11-18: "sync mulai lama"): tablet menarik data tiap menit. Dulu SEMUA baris dibaca setiap kali
    // (terus membesar tiap hari, sambil memegang kunci sehingga dashboard ikut antre). Sekarang baca kolom _upd saja,
    // lalu hanya baris dari perubahan pertama sampai perubahan terakhir (biasanya beberapa baris di bawah).
    const upd = sh.getRange(2, ui + 1, n, 1).getValues();
    let lo = -1, hi = -1;
    for (let i = 0; i < upd.length; i++) if (Number(upd[i][0]) >= since) { if (lo < 0) lo = i; hi = i; }
    if (lo < 0) return [];
    first = 2 + lo; n = hi - lo + 1;
  }
  const rows = sh.getRange(first, 1, n, cols.length).getValues();
  const res = [];
  rows.forEach(function (r) {
    if (r[0] === '') return;
    if (since && ui >= 0 && Number(r[ui]) < since) return;
    const o = {};
    cols.forEach(function (c, i) {
      if (c === UPD) return;
      let v = r[i];
      // Data lama yang terlanjur jadi "tanggal" di Sheets: format pakai zona waktu spreadsheet itu sendiri.
      if (v instanceof Date) v = Utilities.formatDate(v, tz, c === 'jam' ? 'HH:mm' : 'yyyy-MM-dd');
      else if (!isNum(name, c) && v !== '') v = String(v);
      o[c] = v;
    });
    res.push(o);
  });
  return res;
}

function doGet(e) {
  const p = e.parameter || {};
  const pin = getPin();
  if (!pin) return out({ ok: false, error: NO_PIN });
  if (p.pin !== pin) return out({ ok: false, error: 'PIN salah' });
  // Baca setelah penyimpanan yang sedang berjalan selesai (penyimpanan memegang kunci yang sama), jadi tidak pernah
  // membaca tab yang baru setengah ditulis (penyebab data "hilang-timbul" di HP, 2026-11-12).
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) return out({ ok: false, error: 'Sheet sedang menyimpan, coba lagi sebentar' });
  try {
    const data = {};
    if (p.pos) {
      // POS: ambil perubahan sejak sync terakhir
      const since = Number(p.since) || 0;
      Object.keys(POS).forEach(function (n) { data[n] = readSheet(n, since); });
      data.Stok = readSheet('Stok');   // daftar produk dari dashboard (selalu lengkap, ukurannya kecil)
      data.Staff = readSheet('Staff'); // daftar karyawan dari dashboard
      data.Store = readSheet('Store'); // daftar toko & gudang dari dashboard
      return out({ ok: true, v: CODE_VERSION, now: Date.now(), epoch: posEpoch(), data: data });
    }
    // Dashboard: semua tab dashboard + ringkasan POS (tanpa detail struk supaya ringan)
    Object.keys(HEADERS).forEach(function (n) { data[n] = readSheet(n); });
    ['POS Produk', 'POS Karyawan', 'POS Stok', 'POS Shift', 'POS Absen'].forEach(function (n) { data[n] = readSheet(n); });
    try { data['POS Harian'] = posDaily(); } catch (e) { data['POS Harian'] = []; } // tidak boleh menggagalkan muat dashboard // v12: penjualan per hari per shift (struk, 40 hari terakhir) untuk Overview
    return out({ ok: true, v: CODE_VERSION, ver: dashVer(), data: data });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  const cat = catRoute(e); // v14: katalog website (Marketing > Website)
  if (cat) return cat;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const body = JSON.parse(e.postData.contents);
    const pin = getPin();
    if (!pin) return out({ ok: false, error: NO_PIN });
    if (body.pin !== pin) return out({ ok: false, error: 'PIN salah' });

    if (body.action === 'resetPos') {
      // "Mulai baru" dari POS: kosongkan semua tab POS (riwayat uji coba). Tab dashboard tidak disentuh.
      Object.keys(POS).forEach(function (n) {
        const sh = sheetFor(n);
        if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, colsFor(n).length).clearContent();
      });
      const ep = String(Date.now());
      PropertiesService.getScriptProperties().setProperty('posEpoch', ep);
      return out({ ok: true, reset: true, epoch: ep });
    }

    if (body.action === 'upsert') {
      // Dari POS: tambah baris baru / perbarui baris dengan id yang sama
      const rows = body.rows || {};
      Object.keys(rows).forEach(function (n) { if (POS[n]) upsert(n, rows[n] || []); });
      return out({ ok: true, now: Date.now() });
    }

    // Dari Dashboard: tulis ulang tab dashboard saja. Tab POS tidak pernah disentuh di sini.
    // Perangkat lain sudah menyimpan sejak perangkat ini terakhir memuat data: tolak, perangkat ini akan menggabungkan dulu.
    if (typeof body.base === 'string' && body.base !== dashVer()) return out({ ok: false, conflict: true, ver: dashVer() });
    // Semua baris disiapkan dulu; kalau ada yang gagal, belum ada tab yang disentuh.
    const todo = Object.keys(HEADERS).filter(function (n) { return body.data && body.data[n]; }) // tab yang tidak dikirim tidak dikosongkan
      .map(function (n) { return { name: n, n: body.data[n].length, x: body.data[n].length ? rowsFrom(n, body.data[n]) : null }; });
    todo.forEach(function (t) {
      const sh = sheetFor(t.name), cols = colsFor(t.name), last = sh.getLastRow();
      // tulis data baru di atas data lama, baru hapus sisa baris di bawahnya: tab tidak pernah kosong di tengah jalan
      if (t.n) { const rg = sh.getRange(2, 1, t.n, cols.length); rg.setNumberFormats(t.x.fmts); rg.setValues(t.x.vals); }
      if (last > t.n + 1) sh.getRange(t.n + 2, 1, last - t.n - 1, cols.length).clearContent();
    });
    const ver = String(Date.now());
    PropertiesService.getScriptProperties().setProperty('dashVer', ver);
    return out({ ok: true, ver: ver });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ============ Katalog website (v14, Marketing > Website di dashboard) ============
// Mengatur katalog wismir.id: tab "produk" di Google Sheet katalog (bukan Sheet dashboard) dan foto di repo GitHub website.
// Memakai PIN yang sama dengan dashboard. Pengaturan lewat menu WISMIR > Atur katalog website (disimpan di Script Properties,
// tidak pernah di kode): CATALOG_SHEET_ID, GITHUB_REPO, GITHUB_TOKEN (opsional GITHUB_BRANCH = main, CATALOG_TAB = produk).
// Aksi: catList, catSave, catDelete. Jawaban katalog selalu memuat cat:true (dashboard memakainya untuk mengenali kode versi baru).
// Foto dikirim ke GitHub TANPA memegang kunci Sheet, supaya tablet kasir tidak menunggu.
const CAT_DIR = 'foto/';
const CAT_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}\.(jpe?g|png|webp)$/i;
const CAT_MAX_FAILS = 5, CAT_FAIL_WINDOW_S = 900, CAT_LOCK_S = 600; // 5 kali PIN salah dalam 15 menit = katalog dikunci 10 menit (kasir/dashboard tidak ikut terkunci)

function catRoute(e) {
  const raw = (e && e.postData && e.postData.contents) || '';
  if (raw.indexOf('"action":"cat') < 0) return null; // dashboard/POS saves (can be large) are not parsed twice
  let body;
  try { body = JSON.parse(raw); } catch (err) { return null; }
  const act = String((body && body.action) || '');
  if (act.indexOf('cat') !== 0) return null;
  const pin = getPin();
  if (!pin) return out({ ok: false, error: NO_PIN });
  const left = catLockedMinutes();
  if (left) return out({ ok: false, error: 'Terlalu banyak percobaan salah. Coba lagi dalam ' + left + ' menit.' });
  if (body.pin !== pin) { catNoteFail(); Utilities.sleep(800); return out({ ok: false, error: 'PIN salah' }); }
  catNoteOk();
  try {
    if (act === 'catList') return out(Object.assign({ cat: true }, catList()));
    if (act === 'catSave') return out(Object.assign({ cat: true }, catSave(body)));
    if (act === 'catDelete') return out(Object.assign({ cat: true }, catDelete(body)));
    return out({ ok: false, cat: true, error: 'Aksi katalog tidak dikenal.' });
  } catch (err) {
    return out({ ok: false, cat: true, error: String((err && err.message) || err) });
  }
}

function catProp(k, d) { return PropertiesService.getScriptProperties().getProperty(k) || d || ''; }

function catLockedMinutes() {
  try {
    const left = Number(CacheService.getScriptCache().get('catLockUntil') || 0) - Date.now();
    return left > 0 ? Math.ceil(left / 60000) : 0;
  } catch (e) { return 0; } // cache bermasalah: pemilik tidak diblokir
}
function catNoteFail() {
  try {
    const lock = LockService.getUserLock();
    lock.waitLock(5000);
    try {
      const c = CacheService.getScriptCache(), n = Number(c.get('catFails') || 0) + 1;
      if (n >= CAT_MAX_FAILS) { c.put('catLockUntil', String(Date.now() + CAT_LOCK_S * 1000), CAT_LOCK_S + 60); c.remove('catFails'); }
      else c.put('catFails', String(n), CAT_FAIL_WINDOW_S);
    } finally { lock.releaseLock(); }
  } catch (e) {}
}
function catNoteOk() { try { CacheService.getScriptCache().remove('catFails'); } catch (e) {} }

function catSheet() {
  const id = catProp('CATALOG_SHEET_ID');
  if (!id) throw new Error('Katalog website belum diatur. Di Google Sheet dashboard: menu WISMIR > Atur katalog website.');
  const ss = SpreadsheetApp.openById(id), tab = catProp('CATALOG_TAB', 'produk');
  return ss.getSheetByName(tab) || ss.getSheets()[0];
}
function catHeaders(sh) {
  return sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim(); });
}
// Katalog memakai kunci PENGGUNA, bukan kunci script milik dashboard/kasir: Sheet katalog terpisah dari Sheet dashboard, jadi
// katalog tidak perlu menunggu sinkron dashboard/POS yang sedang berjalan (itu yang membuat "Loading the catalog" lama).
function catWithLock(fn) {
  const lock = LockService.getUserLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function catList() { // hanya membaca: tanpa kunci apa pun
  const sh = catSheet(), head = catHeaders(sh), last = sh.getLastRow(), items = [];
  if (last > 1) {
    sh.getRange(2, 1, last - 1, head.length).getDisplayValues().forEach(function (r, i) {
      const o = { _row: i + 2 };
      head.forEach(function (h, c) { if (h) o[h.toLowerCase()] = String(r[c]).trim(); });
      if (o.nama) items.push(o);
    });
  }
  return { ok: true, headers: head.filter(String).map(function (h) { return h.toLowerCase(); }), items: items };
}

function catRowCheck(sh, head, row, nama) {
  const last = sh.getLastRow();
  if (!row || row < 2 || row > last) throw new Error('Baris produk tidak ditemukan. Muat ulang katalog.');
  const c = head.map(function (h) { return h.toLowerCase(); }).indexOf('nama');
  if (nama != null && String(sh.getRange(row, c + 1).getValue()).trim() !== String(nama).trim()) throw new Error('Data berubah di Sheet katalog. Muat ulang katalog lalu coba lagi.');
}

function catSave(req) {
  const d = req.data || {};
  if (!String(d.nama || '').trim()) throw new Error('Nama produk wajib diisi.');
  const photos = req.newPhotos || [];
  photos.forEach(function (p) { if (!CAT_NAME_RE.test(p.name || '')) throw new Error('Nama foto tidak valid: ' + p.name); });
  catSheet(); // gagal lebih awal kalau katalog belum diatur, sebelum ada foto yang dikirim
  photos.forEach(function (p) { catGhPut(CAT_DIR + p.name, p.b64, 'Foto produk: ' + d.nama); });
  catWithLock(function () {
    const sh = catSheet(), head = catHeaders(sh), lower = head.map(function (h) { return h.toLowerCase(); });
    let vals = head.map(function (h, i) { const k = lower[i]; return k && d[k] != null ? String(d[k]) : ''; });
    if (req.row) {
      const r = Number(req.row);
      catRowCheck(sh, head, r, req.origNama);
      const cur = sh.getRange(r, 1, 1, head.length).getValues()[0];
      vals = vals.map(function (v, i) { return lower[i] && d[lower[i]] != null ? v : cur[i]; });
      sh.getRange(r, 1, 1, head.length).setValues([vals]);
    } else {
      sh.appendRow(vals);
    }
  });
  return { ok: true, uploaded: photos.map(function (p) { return p.name; }), deleted: catDeleteFiles(req.deleteFiles) };
}

function catDelete(req) {
  catWithLock(function () {
    const sh = catSheet(), head = catHeaders(sh), r = Number(req.row);
    catRowCheck(sh, head, r, req.nama);
    sh.deleteRow(r);
  });
  return { ok: true, deleted: catDeleteFiles(req.deleteFiles) };
}

function catDeleteFiles(names) {
  const done = [];
  (names || []).forEach(function (n) { if (CAT_NAME_RE.test(n) && catGhDelete(CAT_DIR + n)) done.push(n); });
  return done;
}

function catGh(method, path, body) {
  let url = 'https://api.github.com/repos/' + catProp('GITHUB_REPO') + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  if (method === 'get') url += '?ref=' + encodeURIComponent(catProp('GITHUB_BRANCH', 'main'));
  const opt = { method: method, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + catProp('GITHUB_TOKEN'), Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } };
  if (body) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  return UrlFetchApp.fetch(url, opt);
}
function catGhPut(path, b64, msg) {
  if (!catProp('GITHUB_TOKEN') || !catProp('GITHUB_REPO')) throw new Error('Token GitHub belum diatur. Di Google Sheet dashboard: menu WISMIR > Atur katalog website.');
  const body = { message: msg, content: b64, branch: catProp('GITHUB_BRANCH', 'main') };
  const ex = catGh('get', path);
  if (ex.getResponseCode() === 200) body.sha = JSON.parse(ex.getContentText()).sha;
  const res = catGh('put', path, body);
  if (res.getResponseCode() >= 300) throw new Error('Gagal mengirim foto ke GitHub (' + res.getResponseCode() + '). Cek token dan nama repo di menu WISMIR > Atur katalog website.');
}
function catGhDelete(path) {
  const ex = catGh('get', path);
  if (ex.getResponseCode() !== 200) return false;
  const res = catGh('delete', path, { message: 'Hapus foto produk', sha: JSON.parse(ex.getContentText()).sha, branch: catProp('GITHUB_BRANCH', 'main') });
  return res.getResponseCode() < 300;
}

// Menu WISMIR > Atur katalog website: simpan Sheet katalog + repo + token GitHub di Script Properties.
function setCatalog() {
  const ui = SpreadsheetApp.getUi(), P = PropertiesService.getScriptProperties();
  const ask = function (title, text) { const r = ui.prompt(title, text, ui.ButtonSet.OK_CANCEL); return r.getSelectedButton() === ui.Button.OK ? r.getResponseText().trim() : null; };
  const a = ask('Katalog website 1/3: Google Sheet katalog',
    'Tempel link Google Sheet katalog (yang bernama "web"), atau ID-nya. ' + (catProp('CATALOG_SHEET_ID') ? 'Sudah ada; kosongkan untuk tidak mengubah.' : ''));
  if (a === null) return;
  const m = a.match(/\/d\/([\w-]{20,})/) || a.match(/^([\w-]{20,})$/);
  if (a && !m) { ui.alert('Link atau ID Sheet tidak dikenali. Tidak ada yang diubah.'); return; }
  const b = ask('Katalog website 2/3: repo GitHub website', 'Contoh: yogaprasetia16/Wismirmuslim. ' + (catProp('GITHUB_REPO') ? 'Sekarang: ' + catProp('GITHUB_REPO') + '. Kosongkan untuk tidak mengubah.' : ''));
  if (b === null) return;
  if (b && !/^[\w.-]+\/[\w.-]+$/.test(b)) { ui.alert('Nama repo harus berbentuk pemilik/nama-repo. Tidak ada yang diubah.'); return; }
  const c = ask('Katalog website 3/3: token GitHub', 'Token yang hanya boleh mengubah isi repo website (Contents: Read and write). ' + (catProp('GITHUB_TOKEN') ? 'Sudah ada; kosongkan untuk tidak mengubah.' : ''));
  if (c === null) return;
  if (m) P.setProperty('CATALOG_SHEET_ID', m[1]);
  if (b) P.setProperty('GITHUB_REPO', b);
  if (c) P.setProperty('GITHUB_TOKEN', c);
  ui.alert('Tersimpan. Buka dashboard > Marketing > Website. ' + (catProp('CATALOG_SHEET_ID') && catProp('GITHUB_REPO') && catProp('GITHUB_TOKEN') ? 'Semua pengaturan lengkap.' : 'Masih ada yang kosong: ' + ['CATALOG_SHEET_ID', 'GITHUB_REPO', 'GITHUB_TOKEN'].filter(function (k) { return !catProp(k); }).join(', ') + '.'));
}

function upsert(name, items) {
  if (!items.length) return;
  const sh = sheetFor(name), cols = colsFor(name), now = Date.now();
  const last = sh.getLastRow();
  const pos = {};
  if (last > 1) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { pos[String(r[0])] = i + 2; });
  const byId = {};
  items.forEach(function (it) { if (it && it.id) byId[String(it.id)] = it; });
  const fresh = [];
  Object.keys(byId).forEach(function (id) {
    const it = Object.assign({}, byId[id]); it[UPD] = now;
    if (pos[id]) {
      const x = rowsFrom(name, [it]), rg = sh.getRange(pos[id], 1, 1, cols.length);
      rg.setNumberFormats(x.fmts); rg.setValues(x.vals);
    } else fresh.push(it);
  });
  if (fresh.length) {
    const x = rowsFrom(name, fresh), rg = sh.getRange(sh.getLastRow() + 1, 1, x.vals.length, cols.length);
    rg.setNumberFormats(x.fmts); rg.setValues(x.vals);
  }
}

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
  Marketing: ['budget', 'spent', 'revenue'], Supplier: ['total'], Penjualan: ['qty', 'total'], Recurring: ['jumlah'],
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
const CODE_VERSION = 11;

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
function readSheet(name, since) {
  const sh = sheetFor(name), cols = colsFor(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const rows = sh.getRange(2, 1, last - 1, cols.length).getValues();
  const ui = cols.indexOf(UPD);
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
    return out({ ok: true, v: CODE_VERSION, ver: dashVer(), data: data });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
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

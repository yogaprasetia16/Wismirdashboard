// WISMIR: penghubung Dashboard + POS ke Google Sheets
// Cara pakai:
//  1. Buat Google Sheet kosong, lalu Extensions > Apps Script, tempel kode ini.
//  2. Ganti PIN di bawah, simpan (Ctrl+S).
//  3. Pilih fungsi "setup" di toolbar, klik Run, izinkan akses. Semua tab dibuat otomatis.
//  4. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone). Salin URL /exec.
// Sudah pernah deploy? Deploy > Manage deployments > Edit > New version > Deploy (URL tetap sama).

const PIN = 'GANTI-PIN-ANDA';

// ---- Tab milik Dashboard (ditulis ulang penuh setiap sync dari dashboard) ----
const HEADERS = {
  Keuangan: ['id', 'tanggal', 'jenis', 'kategori', 'jumlah', 'channel', 'catatan'],
  Stok: ['id', 'nama', 'varian', 'stokToko', 'stokOnline', 'min', 'harga'],
  Tugas: ['id', 'judul', 'tempo', 'selesai', 'div', 'repeat', 'jam', 'every', 'unit'],
  Purchasing: ['id', 'date', 'name', 'category', 'qty', 'total'],
  Staff: ['id', 'joined', 'name'],
  Store: ['id', 'name', 'type', 'address'],
  Production: ['id', 'date', 'name', 'qty', 'material', 'matQty', 'unitCost', 'status', 'total'],
  Marketing: ['id', 'name', 'channel', 'status', 'start', 'end', 'budget', 'spent', 'revenue'],
};

// ---- Tab milik POS (baris ditambah / diperbarui per id, tidak pernah dihapus massal) ----
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
  Keuangan: ['jumlah'], Stok: ['stokToko', 'stokOnline', 'min', 'harga'], Tugas: ['every'],
  Purchasing: ['qty', 'total'], Production: ['qty', 'matQty', 'unitCost', 'total'],
  Marketing: ['budget', 'spent', 'revenue'],
  'POS Stok': ['qty'], 'POS Kasir': ['total', 'dibayar', 'kembalian'],
  'POS Shift': ['kasAwal', 'penjualanTunai', 'kasMasuk', 'kasKeluar', 'kasSeharusnya', 'tunai', 'transfer', 'edc', 'totalPenjualan', 'transaksi'],
};

const DEFAULT_PIN = 'GANTI-PIN-ANDA';

// Jalankan sekali dari editor Apps Script: membuat semua tab + judul kolom.
// Aman dijalankan ulang: data yang sudah ada tidak dihapus.
function setup() {
  if (PIN === DEFAULT_PIN) throw new Error('Ganti PIN di baris atas Code.gs dulu, simpan, lalu Run setup lagi.');
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
  Logger.log('Selesai: ' + ss.getSheets().length + ' tab siap. Lanjutkan ke Deploy > New deployment.');
}

// Versi data dashboard: berubah setiap kali dashboard menyimpan.
// Dipakai supaya perangkat dengan data lama tidak menimpa perubahan dari perangkat lain.
function dashVer() { return PropertiesService.getScriptProperties().getProperty('dashVer') || '0'; }

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
  if (PIN === DEFAULT_PIN) return out({ ok: false, error: 'PIN di Code.gs belum diganti' });
  if (p.pin !== PIN) return out({ ok: false, error: 'PIN salah' });
  try {
    const data = {};
    if (p.pos) {
      // POS: ambil perubahan sejak sync terakhir
      const since = Number(p.since) || 0;
      Object.keys(POS).forEach(function (n) { data[n] = readSheet(n, since); });
      return out({ ok: true, now: Date.now(), data: data });
    }
    // Dashboard: semua tab dashboard + ringkasan POS (tanpa detail struk supaya ringan)
    Object.keys(HEADERS).forEach(function (n) { data[n] = readSheet(n); });
    ['POS Produk', 'POS Karyawan', 'POS Stok', 'POS Shift', 'POS Absen'].forEach(function (n) { data[n] = readSheet(n); });
    return out({ ok: true, ver: dashVer(), data: data });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const body = JSON.parse(e.postData.contents);
    if (PIN === DEFAULT_PIN) return out({ ok: false, error: 'PIN di Code.gs belum diganti' });
    if (body.pin !== PIN) return out({ ok: false, error: 'PIN salah' });

    if (body.action === 'upsert') {
      // Dari POS: tambah baris baru / perbarui baris dengan id yang sama
      const rows = body.rows || {};
      Object.keys(rows).forEach(function (n) { if (POS[n]) upsert(n, rows[n] || []); });
      return out({ ok: true, now: Date.now() });
    }

    // Dari Dashboard: tulis ulang tab dashboard saja. Tab POS tidak pernah disentuh di sini.
    // Perangkat lain sudah menyimpan sejak perangkat ini terakhir memuat data: tolak, perangkat ini akan menggabungkan dulu.
    if (typeof body.base === 'string' && body.base !== dashVer()) return out({ ok: false, conflict: true, ver: dashVer() });
    Object.keys(HEADERS).forEach(function (name) {
      if (!body.data || !body.data[name]) return; // tab yang tidak dikirim tidak dikosongkan
      const items = body.data[name], sh = sheetFor(name), cols = colsFor(name);
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, cols.length).clearContent();
      if (items.length) {
        const x = rowsFrom(name, items);
        const rg = sh.getRange(2, 1, x.vals.length, cols.length);
        rg.setNumberFormats(x.fmts); rg.setValues(x.vals);
      }
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

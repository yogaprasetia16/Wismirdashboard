# Panduan sambung Dashboard + POS ke Google Sheets

Isi folder:

- `index.html`: halaman pembuka (pilih Dashboard atau POS).
- `dashboard.html`: dashboard owner (komputer, HP, tablet).
- `pos.html`: kasir, stok, dan absen (tablet toko).
- `Code.gs`: penghubung ke Google Sheets. Satu script dipakai bersama oleh dashboard dan POS.

## 1. Buat Google Sheet + pasang Apps Script (sekali saja, ±10 menit)

1. Buka https://sheets.new (login dengan akun Google bisnis Anda). Spreadsheet kosong baru langsung terbuat. Beri nama, misalnya **WISMIR Data**.
2. Di menu atas: **Extensions → Apps Script**. Tab editor baru akan terbuka.
3. Buka https://github.com/yogaprasetia16/Wismirdashboard/blob/main/Code.gs lalu klik ikon **Copy raw file** (dua kotak bertumpuk, kanan atas kode).
4. Di editor Apps Script: hapus semua tulisan, tempel, lalu simpan (Ctrl+S). **Kode tidak perlu diedit.**
5. Di toolbar, pilih fungsi **setup**, lalu klik **Run**.
   - Google akan meminta izin: **Review permissions** → pilih akun Anda → **Advanced** → **Go to … (unsafe)** → **Allow**. Peringatan "unsafe" ini normal karena script buatan sendiri, bukan dari Google.
   - Setelah selesai ada 14 tab: 8 untuk dashboard (`Keuangan`, `Stok`, `Tugas`, `Purchasing`, `Staff`, `Store`, `Production`, `Marketing`) dan 6 untuk POS (`POS Produk`, `POS Karyawan`, `POS Stok`, `POS Kasir`, `POS Shift`, `POS Absen`).
6. Kembali ke tab Google Sheet, lalu **muat ulang halaman**. Menu **WISMIR** muncul di menu atas.
7. Pilih **WISMIR → Atur PIN**, lalu isi PIN pilihan Anda. Lebih aman 6 karakter atau lebih, dan jangan pakai `1234` atau tanggal lahir.
8. Kembali ke Apps Script, klik **Deploy → New deployment**. Klik ikon gerigi lalu pilih **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`).

Simpan URL dan PIN tersebut. Keduanya dipakai di dashboard dan di semua tablet.

**PIN tidak ditulis di kode**, jadi tetap aman walaupun `Code.gs` ada di GitHub publik. PIN tersimpan di Google Sheet Anda dan **tidak hilang** saat kode diperbarui. Untuk mengganti PIN: **WISMIR → Atur PIN**, lalu isi PIN baru di dashboard dan semua tablet.

### Kalau `Code.gs` diperbarui

1. Buka `Code.gs` di GitHub, lalu klik **Copy raw file**.
2. Di Apps Script: hapus semua, tempel, lalu simpan (Ctrl+S).
3. **Deploy → Manage deployments → Edit (pensil) → Version: New version → Deploy.** URL tetap sama.

Jangan pilih "New deployment" saat update, karena itu membuat URL baru.

Jangan mengubah nama tab atau urutan kolom di Sheet. Isi barisnya boleh dilihat, difilter, dan dibuat pivot. Kalau tab dihapus, tab itu akan dibuat ulang otomatis saat sinkron berikutnya.

## 2. Sambungkan tablet POS

Di setiap tablet: **Owner** → masukkan PIN owner → **Data** → bagian **Google Sheets**.
Isi URL `/exec` dan PIN Sheets, lalu tekan **Simpan & sinkron sekarang**.

- POS **tidak punya data contoh**. Produk, karyawan, dan toko semuanya diambil dari dashboard. Data lama yang tidak ada di dashboard (termasuk produk/karyawan contoh dan "Stok awal contoh") otomatis hilang dari tablet saat tersambung.
- Tablet yang sudah berisi data asli: tekan **Kirim semua data tablet ke Sheets** sekali saja (ketuk 2x). Lakukan ini di satu tablet dulu, baru sambungkan tablet lain. Produk dan karyawan dari tablet itu otomatis dipindahkan ke daftar di dashboard saat dashboard dibuka.
- **Produk dan karyawan diatur di dashboard**, tidak di tablet. Menu Owner di POS hanya berisi **Laporan** dan **Data**.
- **Toko dan gudang** diambil dari dashboard: **Operational → Store**. Tipe **Physical store** menjadi pilihan toko di tablet, dan tipe **Warehouse** menjadi gudang. **Jangan mengganti nama toko** setelah dipakai, karena riwayat stok dicatat per nama toko.

## 3. Cara kerja sinkron

| Data | Kapan dikirim |
|---|---|
| Stok (masuk, keluar, transfer, rusak, opname) | Langsung. Kalau internet putus, masuk antrean dan dikirim otomatis saat online. |
| Produk dan karyawan | Diatur di dashboard. Tablet mengambilnya setiap 1 menit dan setiap kali tab Stok dibuka. |
| Kasir (struk), shift, dan absen | Sekali, saat **Tutup shift**. Kasir tidak pernah menunggu jaringan. |
| Penjualan shift (mengurangi stok) | Saat tutup shift. |

- Setiap 1 menit tablet mengambil perubahan dari tablet lain, misalnya stok Gudang yang dipindah dari tablet lain.
- Bagian Owner → Data menampilkan berapa data yang masih menunggu dikirim.

## 4. Dashboard

Settings → isi URL dan PIN yang sama → **Save settings**. Data POS tampil di:

- **Finance**: setiap shift yang ditutup muncul sebagai Income bertanda `POS` dan ikut dihitung di Net profit. Kalau sebelumnya Anda mencatat penjualan toko secara manual, hapus catatan manual itu supaya tidak terhitung dua kali.
- **Operational → Stock**: satu daftar produk untuk dashboard **dan** POS. Setiap produk menampilkan stok per lokasi dari POS (Gudang / Toko A / Toko B) ditambah stok online.
  - Tombol − / + mengubah **stok online**. Stok toko dan gudang dicatat dari tablet (tab Stok).
  - Form produk berisi **Product name**, **Category**, **Brand**, **SKU** (kode produk, tidak boleh sama antar produk), dan **COGS** (harga pokok per pcs). Category dan Brand diketik bebas. Nama yang pernah diketik muncul sebagai pilihan, jadi tulisannya konsisten.
  - **Stock → History**: riwayat pergerakan stok dari tablet (masuk, keluar, transfer, terjual, rusak, opname). Bisa difilter per periode, toko/gudang, jenis, kategori, brand, dan dicari per nama produk atau SKU. Penjualan dari shift yang belum ditutup baru muncul setelah shift ditutup.
  - Produk yang sudah punya riwayat di POS tidak bisa dihapus. Tombol bawahnya menjadi **Hide from cashier**: produk hilang dari kasir, tapi riwayatnya tetap ada. Produk itu bisa dimunculkan lagi lewat **Show in cashier again**.
  - Peringatan stok menipis muncul kalau total stok tinggal **3 atau kurang**.
- **Operational → Staff**: satu daftar karyawan untuk dashboard **dan** POS. Karyawan **Active** muncul di tablet saat buka shift.
- **Operational → Attendance**: jumlah shift per karyawan bulan ini dan daftar shift terakhir.
- **Operational → Store**: daftar toko. Physical store dan Warehouse muncul di tablet; Online store dan Marketplace tidak.
- **Overview → Low stock**: produk yang total stoknya (toko + gudang + online) sama dengan atau di bawah batas minimum.

Penjualan, shift, absen, dan pergerakan stok dari POS hanya untuk dibaca di dashboard. Pencatatannya tetap dilakukan dari tablet.

### Pengaman data dashboard

- Perubahan yang belum terkirim (misalnya karena offline) dikirim lebih dulu sebelum dashboard memuat ulang dari Sheets, jadi tidak tertimpa.
- Komputer baru wajib memuat data dari Sheets dulu sebelum boleh mengirim, jadi Sheets tidak bisa terhapus oleh browser yang masih kosong.
- Tanggal sekarang disimpan sebagai teks di Sheets, jadi tidak bisa bergeser sehari karena perbedaan zona waktu.

### Membuka dashboard dari beberapa perangkat

Dashboard boleh dibuka di laptop, HP, dan tablet sekaligus.

- Setiap kali tab dibuka kembali, dan setiap 5 menit, dashboard memuat ulang data dari Sheets.
- Kalau perangkat lain sudah menyimpan duluan, perubahan digabung per baris, jadi tidak saling menimpa.
- Batasannya: kalau baris yang sama diedit di dua perangkat dalam waktu hampir bersamaan, yang tersimpan adalah editan yang terakhir dikirim.

## 5. Online-kan lewat GitHub Pages

1. Repo `Wismirdashboard` harus **Public**: Settings → General → paling bawah → Change visibility. GitHub Pages gratis hanya untuk repo public.
   - Aman, karena kode HTML tidak berisi data, URL, ataupun PIN. Semua itu tersimpan di browser masing-masing perangkat.
   - **Jangan pernah** menyimpan `Code.gs` yang sudah berisi PIN asli ke repo. PIN asli cukup ada di Apps Script.
2. Pastikan file `index.html`, `dashboard.html`, dan `pos.html` ada di branch `main`.
3. Settings → **Pages** → Source: **Deploy from a branch** → Branch: **main**, folder **/ (root)** → Save.
4. Tunggu 1–2 menit. Alamatnya:
   - `https://yogaprasetia16.github.io/Wismirdashboard/`: halaman pembuka
   - `https://yogaprasetia16.github.io/Wismirdashboard/dashboard.html`
   - `https://yogaprasetia16.github.io/Wismirdashboard/pos.html`
5. Di setiap perangkat, buka alamatnya, isi URL dan PIN Sheets sekali, lalu pilih **Add to Home Screen** supaya muncul seperti aplikasi.

Setelah tablet mulai dipakai, jangan mengganti alamat POS (misalnya mengganti nama repo), karena data yang belum terkirim terikat pada alamat itu.

## 6. Pasang sebagai aplikasi (layar penuh, tanpa search bar)

**Tablet Android (Chrome):**
1. Buka `https://yogaprasetia16.github.io/Wismirdashboard/pos.html`.
2. Ketuk menu **⋮** (kanan atas), lalu pilih **Install app** atau **Tambahkan ke layar utama → Install**.
3. Buka POS dari ikon **WISMIR POS** di layar utama. POS akan terbuka layar penuh tanpa search bar.
   - Kalau sebelumnya sudah pernah dibuat shortcut, hapus dulu shortcut lama, lalu install ulang.
   - Pakai Chrome yang sama dengan yang sudah berisi data POS, supaya data tablet tetap terbaca.

**iPad (Safari):** tombol Bagikan → **Add to Home Screen**.

**Dashboard** bisa dipasang dengan cara yang sama di HP atau laptop (Chrome: ikon install di address bar, atau menu → Install).

**Tanpa install:** di POS ada tombol **layar penuh** (ikon kotak sudut) di kanan atas. Tombol ini hilang otomatis kalau POS sudah dibuka sebagai aplikasi.

**Bonus:** setelah POS pernah dibuka sekali, POS tetap bisa dibuka walaupun internet toko mati. Transaksi tetap tersimpan di tablet dan dikirim saat internet kembali. Saat online, POS selalu mengambil versi terbaru.

## 7. Menu POS

Pindah halaman (Shift, Kasir, Struk, Stok, Owner) dilakukan lewat **logo "wismir" di kiri atas**. Ketuk logo untuk membuka menu, lalu pilih halamannya. Di bawah logo tertulis halaman yang sedang dibuka. Kalau keranjang berisi barang dan Anda sedang di halaman lain, logo menampilkan angka jumlah barangnya.

## 8. Printer struk + laci uang (Kassen BT-P3200 atau printer Bluetooth lain)

**Sebelum mulai:**
- Cek bagian belakang printer. Harus ada colokan kecil seperti colokan telepon, berlabel **DK** atau **Cash Drawer**. Laci uang dicolok ke sana, dan printerlah yang membuka laci.
- Pastikan Chrome di tablet sudah versi terbaru: Play Store → Chrome → **Update**.

**Langkah:**
1. Nyalakan printer. Di tablet: **Pengaturan → Bluetooth** → pilih printer (misalnya "BT-P3200" atau "Printer") → **Pair**. Kalau diminta PIN pairing, coba `0000` atau `1234`.
2. Buka POS → logo → **Owner** → masukkan PIN owner → **Data** → bagian **Printer struk & laci uang**.
3. Pilih **Bluetooth langsung**, lalu ketuk **Sambungkan printer** dan pilih printernya dari daftar.
   - Di bawah pilihan mode ada info **Bluetooth klasik / Bluetooth LE: ada / tidak ada**. POS otomatis memakai jalur yang tersedia di tablet. Kalau tertulis "tidak bisa di tablet ini", langsung pakai **RawBT** (lihat di bawah).
   - Bluetooth LE hanya berhasil kalau printernya juga mendukung Bluetooth LE. Kalau printer tidak muncul di daftar, atau muncul pesan "tidak menerima data lewat Bluetooth LE", pakai **RawBT**.
4. Atur pilihan berikut:
   - **Lebar kertas:** 80 mm (BT-P3200).
   - **Buka laci otomatis:** Ya. Laci terbuka saat pembayaran tunai, Tambah kas, dan Kurangi kas.
   - **Cetak struk otomatis setelah bayar:** Ya atau Tidak, sesuai kebutuhan.
5. Tekan **Tes cetak**, lalu **Tes buka laci**.

**Setiap hari (sambung otomatis):** setelah sekali disambungkan, di kanan atas POS ada tombol **ikon printer + nama printer** (misalnya **RPP02N**):
- **Titik hijau:** printer siap.
- **Titik kuning:** belum tersambung. POS mencoba menyambung sendiri setiap 20 detik, jadi cukup nyalakan printer dan tunggu sebentar.
- Kalau tetap kuning (sebagian Chrome tidak mengizinkan sambung otomatis), **ketuk tombol Printer sekali**, lalu pilih printer toko di daftar yang muncul. Daftar itu hanya berisi printer toko.

**Kalau "Bluetooth langsung" tidak bisa di tablet Anda** (misalnya muncul pesan Chrome belum mendukung):
1. Install aplikasi **RawBT** dari Play Store.
2. Sambungkan printer di dalam aplikasi RawBT.
3. Di POS → Owner → Data, pilih **Aplikasi RawBT**, lalu tekan **Tes cetak** dan **Tes buka laci**.

**Catatan:**
- Mode **Cetak biasa** memakai dialog cetak Android seperti sebelumnya. Mode ini **tidak bisa** membuka laci.
- Kalau printer mati atau di luar jangkauan, transaksi **tetap tersimpan**. Yang muncul hanya pesan "Printer: …", dan struk bisa dicetak ulang dari menu **Struk**.


## 9. Mulai baru (setelah uji coba selesai)

Gunakan sekali saja, saat POS akan mulai dipakai sungguhan di toko.

1. Pasang `Code.gs` terbaru dulu (lihat bagian 1, "Kalau `Code.gs` diperbarui").
2. Di salah satu tablet: logo → **Owner** → **Data** → paling bawah → **Mulai baru (hapus riwayat uji coba)** → ketuk 2x.

Yang dihapus:
- Semua transaksi, shift, absen, dan pergerakan stok, di tablet ini, di tablet lain (otomatis saat tablet itu sinkron, paling lama 1 menit), dan di tab **POS** Google Sheet.
- Penjualan uji coba juga hilang dari Finance di dashboard.

Yang tetap ada:
- Produk, karyawan, dan toko dari dashboard.
- Pengaturan tablet (URL, PIN, printer, suara).

Setelah itu, masukkan stok awal yang sebenarnya di tablet: **Stok → Masuk**. Kalau produk atau karyawan contoh sempat ikut masuk ke dashboard, hapus dari dashboard (Operational → Stock / Staff). Sekarang keduanya sudah bisa dihapus karena riwayat uji cobanya sudah hilang.

## 10. Riwayat stok di tablet

- **Stok → Riwayat** di tablet hanya menampilkan **Masuk, Keluar, Transfer, Rusak, dan Opname**, supaya tidak membingungkan karyawan. Penjualan tetap mengurangi stok, dan tetap terlihat di **dashboard → Operational → Stock → History**.
- **Mengubah catatan stok** yang salah ketik (bisa oleh siapa saja, tanpa mode owner): ketuk **Ubah** di baris riwayat, lalu ganti **produk** dan/atau **jumlah**, lalu **Simpan perubahan**.
  - Untuk **Opname**, yang diubah adalah **hasil hitung fisik**. Selisihnya dihitung ulang otomatis.
  - Catatan yang diubah ditandai "diubah" beserta tanggal dan jamnya, jadi terlihat juga di dashboard.
- Kalau catatan memang tidak seharusnya ada, pakai **Batalkan (void)**.
- Stok keluar, transfer, atau rusak yang membuat stok **minus** tetap bisa disimpan tanpa PIN owner. Layar "Cek sebelum simpan" hanya mengingatkan bahwa stok akan menjadi minus.

## 11. Teks struk beberapa baris

Owner → **Data** → **Teks struk**:
- **Alamat / info** dan **Pesan bawah** bisa diisi beberapa baris. Tekan **Enter** untuk baris baru, misalnya alamat, nomor WA, dan Instagram di baris masing-masing.
- Setiap baris tercetak di baris tersendiri di struk. Baris yang terlalu panjang dipotong ke baris berikutnya secara otomatis.
- Tekan **Simpan teks struk**, lalu **Tes cetak** untuk melihat hasilnya.

## 12. Import produk dari spreadsheet lama

1. Di spreadsheet lama, **blok** kolom **Produk, Category, brand, sku, cogs**, termasuk baris judulnya, lalu **Copy** (Ctrl+C).
2. Di dashboard: **Operational → Stock → Products → Import from spreadsheet**.
3. Klik kotak putih, lalu **Paste** (Ctrl+V). Daftar pratinjau akan muncul.
4. Cek pratinjaunya, lalu tekan **Import … products**.

Catatan:
- Produk yang **SKU-nya sudah ada** dilewati, jadi aman kalau tidak sengaja di-import dua kali.
- Baris tanpa nama produk juga dilewati.
- Jumlah stok **tidak** ikut di-import. Masukkan stok awal di tablet lewat **Stok → Masuk**.

## 13. Rekap supplier (Production › Supplier)

Menghitung tagihan ke supplier per bulan dari pergerakan stok di tablet POS:

- **Barang masuk** = Stok › Masuk dengan "Dari: Supplier".
- **Barang keluar** = Stok › Keluar dengan "Ke: Supplier" (retur).
- Per produk: (masuk − keluar) × COGS, lalu semua dijumlahkan. Transfer antar toko, Konveksi dan baris yang dibatalkan tidak dihitung.

Cara pakai:
1. Buka Dashboard › **Production** › **Supplier**. Setiap bulan tampil dengan totalnya, misalnya "June 2026 · Pay in July 2026".
2. Klik bulannya untuk melihat rekap per produk.
3. Tekan **Copy** untuk menyalin angka total (tanpa titik, misalnya `1200000`), lalu tempel di aplikasi bank.
4. Setelah dibayar, tekan **Mark as paid**. Bulan itu mendapat tanda centang hijau. Salah tekan? Buka lagi, lalu tekan **Mark as not paid** dua kali.

Pastikan setiap produk sudah punya **COGS** (Operational › Stock). Produk tanpa COGS dihitung Rp 0 dan diberi tanda merah di rekap.

Fitur ini butuh **Code.gs versi 5**. Selama Code.gs belum diperbarui, tanda "sudah bayar" hanya tersimpan di perangkat itu. Setelah Code.gs diperbarui, tanda tersebut otomatis terkirim ke Sheet (tab baru **Supplier**).

## 14. Toko: tipe, sumber stok, dan produk per toko (Operational › Store)

Ada 3 tipe toko:
- **Warehouse**: hanya gudang. Ada stok, tapi tidak ada penjualan dan tidak bisa dipilih sebagai toko di tablet.
- **Physical store**: toko fisik biasa, dengan tablet kasir dan stoknya sendiri.
- **Online store**: punya rekap penjualan sendiri (struk dan shift atas nama toko online), tapi **stoknya diambil dari toko lain**. Pilih tokonya di **Stock from**. Setiap penjualan online mengurangi stok toko yang dipilih di sana.

Produk per toko:
1. Klik nama toko di Operational › Store.
2. Di bagian **Products**, centang produk yang dijual atau disimpan di toko itu. Ada kolom cari serta tombol All / None.
3. Tekan **Save**.

Kasir dan input stok di tablet hanya menampilkan produk yang dicentang untuk toko tersebut. Kalau semua produk dicentang, produk baru yang ditambahkan nanti otomatis ikut muncul. Kalau hanya sebagian yang dicentang, produk baru harus dicentang dulu di toko itu.

Menjalankan toko online di tablet:
1. Aktifkan mode owner di tablet.
2. Ketuk nama toko di kanan atas, lalu pilih toko online.
3. Buka shift seperti biasa.

Fitur ini butuh **Code.gs versi 6** (kolom baru `sumber` dan `produk` di tab Store).

## 15. Rekap penjualan & impor penjualan lama (Finance › Transactions › Income)

**Memasukkan penjualan tahun-tahun sebelumnya:**
1. Di spreadsheet Anda, blok tabel penjualan **beserta baris judulnya**. Kolomnya: `date`, `Store`, `SKU`, `Sold`, `Total pendapatan`.
2. Tekan **Ctrl+C**.
3. Buka Dashboard › **Finance** › **Transactions** › **Income**, lalu tekan **Import sales history**.
4. Tempel dengan **Ctrl+V**. Akan muncul ringkasan: jumlah baris, periode, total, daftar toko, dan SKU yang belum ada di daftar produk.
5. Tekan **Import**.

Catatan:
- Baris dengan bulan, toko, dan SKU yang sama otomatis dijumlahkan.
- Kalau bulan yang sama di-import lagi, datanya **diganti**, bukan ditambah. Jadi aman untuk mengoreksi data.
- Pendapatan yang kosong dihitung Rp 0, tapi jumlah pcs tetap terhitung.
- SKU yang sudah ada di daftar produk (Operational › Stock) tampil dengan nama produknya.

**Membaca rekap:**
- Pilih tahun, dan bila perlu satu toko. Rekap menampilkan total pendapatan, pcs terjual, dan perbandingan dengan **bulan yang sama** di tahun sebelumnya.
- Tabel per bulan menampilkan pcs, pendapatan, angka tahun lalu, dan perubahan. Klik satu bulan untuk melihat rincian per toko dan per produk.
- Di bawah tabel ada rekap per toko dan 10 produk terlaris.
- Bulan yang tidak ada di data impor diambil dari tablet kasir (POS).

Fitur ini butuh **Code.gs versi 7** (tab baru **Penjualan**).

## 16. Link di reminder

Di form reminder ada kolom **Link (optional)**. Isinya bisa salah satu dari dua:
- **Alamat website**, misalnya `seller.shopee.co.id`. Tidak perlu mengetik `https://`.
- **Halaman dashboard** dari daftar pilihan, misalnya `Production › Supplier` atau `Operational › Stock`.

Reminder yang punya link akan menampilkan **tombol link bulat** di sebelah kanan. Tekan tombol itu untuk langsung membuka website (di tab baru) atau halaman dashboard yang dituju.

Fitur ini butuh **Code.gs versi 8** (kolom baru `link` di tab Tugas).

## 17. Pengeluaran & impor pengeluaran lama (Finance › Transactions › Expense)

**Memasukkan pengeluaran tahun-tahun sebelumnya:**
1. Di spreadsheet Anda, blok tabel pengeluaran **beserta baris judulnya** (`Tanggal`, `Kategori`, `Jumlah`, `Catatan`), lalu tekan **Ctrl+C**.
2. Buka Dashboard › **Finance** › **Transactions** › **Expense**, lalu tekan **Import expenses**.
3. Tempel dengan **Ctrl+V**. Akan muncul ringkasan: jumlah baris, periode, total, dan daftar kategori.
4. Tekan **Import**.

Catatan:
- Satu baris = satu pengeluaran. Dua baris yang sama persis tetap dihitung dua kali.
- Kalau baris yang sama di-import lagi, datanya **diganti**, tidak dobel. Jadi aman untuk mengoreksi data. Perubahan yang sempat Anda buat di dashboard pada baris tersebut akan tertimpa oleh data impor.

**Membaca rekap:**
- Pilih tahun, dan bila perlu satu kategori. Rekap menampilkan total pengeluaran, jumlah catatan, dan perbandingan dengan bulan yang sama tahun lalu. Kenaikan pengeluaran ditandai merah.
- Klik satu bulan untuk melihat daftar pengeluarannya. Klik satu pengeluaran untuk mengubah atau menghapusnya.
- Klik nama kategori di bagian **By category** untuk memfilter rekap.
- Pengeluaran baru: tekan **+ New expense**. Kategori bisa diketik bebas, dan dashboard menyarankan kategori yang sudah pernah dipakai.

## 18. Input pengeluaran toko & pengeluaran berulang (Operational › Expense)

**Mencatat pengeluaran:**
1. Buka Dashboard › **Operational** › **Expense**.
2. Tekan **+ New expense**, lalu isi:
   - **Date**: tanggal pengeluaran.
   - **Category**: pilih kategori yang pernah dipakai, atau ketik kategori baru.
   - **Amount**: jumlahnya.
   - **Note**: catatan, boleh dikosongkan.
3. Tekan **Save**.

Di atas daftar ada pilihan bulan, dan untuk setiap bulan terlihat total pengeluarannya. Untuk mengubah tanggal, kategori, jumlah, atau catatan, ketuk pengeluarannya. Untuk menghapus, tekan **Delete** dua kali.

**Pengeluaran berulang (sewa, gaji, dll.):**
1. Tekan tombol **Recurring** di kanan atas. Daftar pengeluaran berulang akan muncul.
2. Tekan **+ Add recurring expense**, lalu isi:
   - **Category**, **Amount**, dan **Note**.
   - **Repeat**: setiap bulan, minggu, hari, atau tahun.
   - **Next date**: tanggal tagihan berikutnya.
3. Tekan **Save**.

Pada tanggalnya, dashboard otomatis mencatat pengeluaran tersebut dan memberinya tanda ↻. Kalau Next date diisi tanggal yang sudah lewat, semua tanggal yang terlewat ikut dicatat. Untuk mengubah atau menghapus pengeluaran berulang, ketuk namanya di daftar Recurring.

Fitur ini butuh **Code.gs versi 9** (tab baru **Recurring**).

## 19. Pembelian & impor pembelian lama (Production › Purchasing)

- Kategori pembelian: **Textile** (kain), **Item** (kancing, plastik, kantong, handtag, dll.), **Zakat**, dan **Dividen**.
- Jumlah boleh pakai koma, misalnya `1108,1` meter.
- Daftar pembelian bisa dipilih per tahun dan dikelompokkan per bulan. Setiap bulan menampilkan totalnya.

**Impor pembelian lama:**
1. Di Google Sheet lama, blok tabel pembelian **beserta baris judulnya** (`date`, `category`, `name`, `quantity`, `total payment`), lalu tekan **Ctrl+C**.
2. Buka Dashboard › **Production** › **Purchasing**, lalu tekan **Import purchases**.
3. Tempel tabelnya, cek ringkasan yang muncul, lalu tekan **Import**.
4. Biarkan dashboard tetap terbuka sampai tombol **Sync** berhenti berputar.

Kalau Anda impor ulang baris yang sama, datanya diganti dan tidak dobel.

## 20. Produksi & impor produksi lama (Production › Manufacturing)

- Di data lama, produk ditulis dengan **kode SKU** (misalnya wg001). Dashboard otomatis menampilkannya sebagai **nama produk**, asalkan produk dengan SKU itu sudah ada di Operational › Stock. Pencocokan ini juga berlaku untuk produk yang baru ditambahkan nanti.
- Saat menambah order baru, kolom **Product** menampilkan daftar nama produk. Pilih dari daftar, atau ketik untuk mencari.
- Urutan daftar: order yang masih **Ongoing** tampil paling atas. Di bawahnya, order yang sudah **Done** dikelompokkan per tahun dan per bulan, lengkap dengan jumlah pcs dan biayanya.

**Impor produksi lama:**
1. Di Google Sheet lama, blok tabel produksi **beserta baris judulnya**: `Tanggal`, `Product`, `qtt product`, `material`, `qtt material`, `Cost/product`. Lalu tekan **Ctrl+C**.
2. Buka Dashboard › **Production** › **Manufacturing**, lalu tekan **Import orders**.
3. Tempel tabelnya. Di ringkasan, cek SKU mana saja yang sudah cocok dengan produk.
4. Tekan **Import**, lalu biarkan dashboard tetap terbuka sampai **Sync** selesai.

Order hasil impor otomatis berstatus **Done**. Totalnya dihitung dari qtt product × Cost/product. Kalau data yang sama diimpor ulang, baris lama diganti, jadi tidak dobel.

## 21. Riwayat pembayaran supplier (Production › Supplier)

Rekap supplier untuk bulan-bulan baru dihitung otomatis dari barang masuk dan keluar ke Supplier di tablet POS. Untuk bulan-bulan sebelum ada POS, Anda bisa mengimpor riwayat pembayarannya. Cukup tanggal bayar dan jumlahnya saja.

1. Di Google Sheet lama, blok tabel pembayaran **beserta baris judulnya** (`Tanggal`, `Jumlah`), lalu tekan **Ctrl+C**.
2. Buka Dashboard › **Production** › **Supplier**, lalu tekan **Import payments**.
3. Tempel tabelnya. Akan muncul ringkasan bulan mana saja yang dibayar.
4. Tekan **Import**, lalu biarkan dashboard terbuka sampai **Sync** selesai.

Aturan pembacaan:
- Pembayaran dihitung untuk **bulan sebelum** tanggal bayarnya. Contoh: bayar 5 Juli 2026 dicatat sebagai pembayaran untuk Juni 2026.
- Kalau dalam satu bulan ada beberapa kali bayar, jumlahnya dijumlahkan.
- Bulan hasil impor tampil dengan centang hijau dan tanda **imported**, tanpa rincian produk.
- Impor ulang hanya mengganti bulan-bulan tersebut, jadi data tidak dobel.

## 22. Impor stok (opname) untuk semua toko & produk (Operational › Stock)

Gunakan fitur ini kalau Anda punya daftar stok hasil hitung, dan ingin stok di sistem disamakan dengan daftar itu.

1. Siapkan daftar stok **beserta baris judul**. Bisa salah satu dari dua bentuk berikut:
   - `SKU` (atau `Produk`), lalu **satu kolom per toko/gudang**. Nama kolomnya harus sama dengan nama di Operational › Store, misalnya `Gudang` atau `Toko C6`.
   - `SKU`, `Lokasi`, `Jumlah` (satu baris per produk per lokasi).
2. Buka Dashboard › **Operational** › **Stock** › **Products**, lalu tekan **Import stock count**.
3. Isi **Count date**, yaitu tanggal stok itu dihitung.
4. Tempel daftarnya. Ringkasan akan menampilkan stok sistem → stok hitungan per produk dan lokasi, serta produk atau lokasi yang tidak dikenali.
5. Tekan **Import**.

Cara kerjanya:
- Ini sama dengan **opname**. Sistem hanya mencatat **selisihnya**, dan di riwayat stok tercatat sebagai "Stock count".
- Barang yang sudah Anda input lewat tablet POS tetap ada.
- Penjualan dan pergerakan stok **setelah** tanggal hitung tetap menambah atau mengurangi stok.
- Kalau Anda impor ulang untuk tanggal yang sama, hitungan sebelumnya diganti, tidak ditambah.
- Produk yang tidak ada di daftar tidak berubah.
- Tablet kasir otomatis mendapat angka barunya dalam 1 menit.

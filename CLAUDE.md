# WISMIR business system

Owner: Yoga, who runs WISMIR, a Muslim-fashion brand with physical stores (Toko A, Toko B, a warehouse "Gudang") and new online channels. The owner is a business person, not a developer. **Always reply in Indonesian**, in plain words, with step-by-step instructions for anything they must do by hand.

## What is here

| File | What it is | Who uses it |
|---|---|---|
| `dashboard.html` | Owner dashboard, single file. **All UI text in English.** | Owner, on laptop / phone / tablet |
| `pos.html` | Store tablet app: cashier (Kasir), stock moves (Stok), shifts + attendance. **All UI text in Indonesian.** Light mode only. | Store staff |
| `index.html` | Landing page linking both | |
| `Code.gs` | Google Apps Script web app: the only bridge to the Google Sheet. Pasted by the owner into Apps Script; it is **not** run from GitHub. | |
| `sw.js`, `*.webmanifest`, `icons/` | Installable app (full screen on Android) + opens offline | |
| `PANDUAN.md` | Owner-facing setup guide (Indonesian). Update it whenever setup steps change. | Owner |
| `tests/` | Fake Google Sheets server running the real `Code.gs`, browser tests, preview builder | Claude |

Hosting: GitHub Pages from `main` (repo is public): `https://yogaprasetia16.github.io/Wismirdashboard/`. A merge to `main` goes live on every device within 1-2 minutes, including the cashier tablets.

## How data flows

- Each device keeps its data in `localStorage` (`wismir_v1` dashboard, `wismir_pos_v1` POS) and syncs to one Google Sheet through `Code.gs` (URL + PIN entered in each device's settings, never in the code).
- **Dashboard tabs** (`Keuangan`, `Stok`, `Tugas`, `Purchasing`, `Staff`, `Store`, `Production`, `Marketing`): the dashboard rewrites the whole tab on save. A version number (`dashVer`) rejects saves based on stale data; the dashboard then merges row by row (add/edit/delete by id) and retries. It reloads on focus and every 5 minutes.
- **Products and staff are managed only in the dashboard** (`Stok`, `Staff` tabs) and shared with the POS. The POS reads them on every pull. Products have `kategori` (POS cashier filter) and `aktif` (`Active`/`Inactive`, Inactive = hidden from the cashier). A product with POS history can only be set Inactive, never deleted. Store/warehouse stock is computed from POS moves; the dashboard only types **online** stock (`stokOnline`). `stokToko` is a dead legacy column kept so column order does not shift.
- **POS tabs** (`POS Stok`, `POS Kasir`, `POS Shift`, `POS Absen`): rows are upserted by id with a server timestamp `_upd`; tablets pull changes since their last sync every minute. `POS Produk` / `POS Karyawan` are archives from the old POS; the dashboard copies their rows into `Stok` / `Staff` once (same id).
- **Owner's rule for the POS:** stock moves sync immediately (offline queue, retried). Receipts, shift summary and attendance upload **only when the shift is closed**, so the cashier never waits for the network. Do not change this.
- The PIN lives in Apps Script **Script Properties**, set from the Sheet menu **WISMIR → Atur PIN**. Never write a real PIN into any file in this repo (it is public).
- Text cells are written with plain-text format so Sheets never turns `2026-11-04` into a date; numeric columns are listed in `NUM` in `Code.gs`. Dates in the apps use local `ymd()` helpers, never `toISOString()` (UTC shifts the day in Jakarta).

## Owner's decisions (do not undo)

- No cash-count field at shift close: the owner checks differences with staff directly.
- POS prices are typed per sale (bargaining in store) with "frequently used price" chips. No fixed price list in the POS.
- POS Owner menu has only **Laporan** and **Data**. Products/staff are not editable on the tablet.
- Attendance = who was ticked when the shift opened (no clock-in/out yet).
- The POS has **no sample data**. Products, staff and store locations come only from the dashboard; local items unknown to the dashboard are dropped on sync (except ones still queued for upload from an old tablet). Sample data for previews/tests lives in `tests/pos-sample.js`.
- Dashboard product form = exactly **Product name, Category, Brand, SKU, COGS** (owner's list, 2026-11-06; Brand added 2026-11-06). Keys `nama`, `kategori`, `brand`, `sku`, `cogs`; `sku`, `cogs`, `brand` are the last `Stok` columns. Category and brand are free text with suggestions (datalist) from values already used; no built-in category list. No Status field: the form's bottom button is Delete (no POS history) / "Hide from cashier" (sets `aktif` Inactive) / "Show in cashier again". Low-stock minimum defaults to 3 (`min` kept for old rows). Variant, selling price and online stock are no longer in the form (old values stay in the data; the list's −/+ still changes online stock). Duplicate SKUs are refused.
- POS stock history (Stok › Riwayat) leaves out **sales** (staff only see Masuk, Keluar, Transfer, Rusak, Opname); the dashboard history keeps sales. Manual moves can be edited (product + quantity; for opname the physical count, difference recomputed against stock without that move) by **anyone, no owner mode** (owner's decision 2026-11-06); the row is updated in place (same id) and its note gets "· diubah <date time>".
- Stock moves that take a location below zero need **no owner PIN** (owner's decision 2026-11-06); the check screen only warns "Stok … akan menjadi -N".
- Dashboard Operational > Stock has **Products | History**. History = POS stock moves with filters (period incl. custom dates, store/warehouse, type, category, brand, product/SKU search); only the list re-renders when a filter changes.
- Store locations = dashboard `Store` tab: type `Physical store` = POS stores (tablet picks one), type `Warehouse` = warehouses. History is keyed by store **name**: renaming a store splits its history.
- "Mulai baru" (Owner > Data): `Code.gs` action `resetPos` clears all POS tabs and bumps `posEpoch`; every tablet that sees a new epoch wipes its local history (keeping an open shift). It waits for a running sync first and ignores answers to requests started before the reset.
- POS navigation is a menu under the top-left logo (no side rail / bottom bar: the owner found the rail laggy). Menu items act on touch-down; the following click is swallowed.
- POS price sheet on tablets: keypad left, quantity + "Tambah ke keranjang" right (button must never drop below the fold).
- POS sounds (Web Audio, no files): tap on every button, chime on sale / shift close, low tone on errors; switch in Owner > Data.
- Printer: store tablet uses a **Kassen BT-P3200** (80 mm, Bluetooth + USB) with the cash drawer on the printer's drawer port. POS prints ESC/POS via Web Serial over Bluetooth (Chrome Android 138+, SPP UUID 00001101-...), with RawBT intent as fallback and the system print dialog as the default mode. Drawer pulse `ESC p 0 25 250` on cash sales and cash in/out. Printing never blocks or undoes a sale. Not yet verified on the real printer.
- Dashboard design rules come from the `wismir-dashboard` skill: icon-only navigation, round green "+" add buttons, no colored backgrounds behind text labels, in-app two-tap delete (never `alert`/`confirm`/`prompt`), forms contain exactly the fields the owner asked for (if a new field is technically required, say so).
- New Sheet columns are appended **at the end** of a tab's header list in `Code.gs`.

## Workflow agreed with the owner

1. Make the change, run `bash tests/run_all.sh` (must print `EVERYTHING PASSED`), and for visual changes send previews: `node tests/make_preview.js <scratchpad-dir>`, then send the two files with display `render` (plus screenshots). Never commit preview files or logs.
2. Push to the session's `claude/...` branch and open a pull request into `main` (Indonesian title and description: summary, changes, testing, steps for the owner).
3. **Merging: always merge right away** once tests pass (owner's decision 2026-11-06), including `Code.gs` changes and cashier-flow changes. Follow the project skill **`wismir-ship`** (`.claude/skills/wismir-ship/SKILL.md`).
   - `Code.gs` changes must be safe to install late: new columns at the end, apps tolerate the old script (`keepMissing()` in the dashboard, fallbacks in the POS), and `CODE_VERSION` (Code.gs) = `NEED_CODE` (dashboard) bumped together so the dashboard shows "Update Code.gs" until the owner installs it.
   - After merging, tell the owner what changed (and the Code.gs steps if it changed). Revert quickly if they are unhappy.
   - The POS was still in trial on 2026-11-05. When it goes live, still merge right away, but point out in the message when a change touches checkout / sync / shifts.
4. If `Code.gs` changed, tell the owner: open `Code.gs` on GitHub → **Copy raw file** → paste in Apps Script → Ctrl+S → **Deploy → Manage deployments → Edit → New version → Deploy** (never "New deployment": that changes the URL on every device).

## Testing notes

- `tests/fake_sheets_server.js` serves the repo on `http://localhost:8765` and runs the real `Code.gs` against an in-memory sheet (PIN `9999`); `GET /dump` shows sheet contents.
- `tests/smoke.js` renders every dashboard tab without a browser (from the skill; extended for POS data).
- Browser tests need `require('playwright')` with Chromium. They have not replaced testing on a real tablet and a real Google Sheet: say so when reporting.
- The network sandbox cannot reach `*.github.io`; ask the owner to check the live site.

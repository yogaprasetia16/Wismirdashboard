#!/bin/bash
# Runs every test. Needs Node + Playwright with Chromium (require('playwright') must work).
# Usage: bash tests/run_all.sh        (from anywhere)
cd "$(dirname "$0")"
fails=0; SRV=""
start(){ stop; node fake_sheets_server.js > /dev/null 2>&1 & SRV=$!; sleep 1; }
stop(){ [ -n "$SRV" ] && kill $SRV 2>/dev/null; SRV=""; sleep 0.3; }
run(){ echo "== $1"; out=$(timeout 180 "${@:2}" 2>&1); echo "$out" | grep -E "FAIL|ERR|ERROR|ALL PASSED|all good|problem"; echo "$out" | grep -qE "ALL PASSED|all good" || fails=$((fails+1)); }
run "Code.gs PIN menu" node pin_test.js
run "dashboard smoke (no browser)" node smoke.js ../dashboard.html
start; run "POS + dashboard sync (e2e)" node e2e.js
start; run "dashboard multi-device conflict" node conflict.js
start; run "dashboard PIN lock" node lock.js
start; run "dashboard Sync button animation" node dash_ui.js
start; run "new dashboard + old Code.gs (no data loss)" node compat.js
start; run "dashboard import products from a spreadsheet" node dash_import.js
start; run "dashboard Production › Supplier recap + paid" node supplier.js
start; run "store types, online stock source, products per store" node stores.js
start; run "Finance › Sales: import history + monthly recap" node sales.js
start; run "Finance › Report + Financial (sample data)" node finance_report.js
start; run "reminder links (website or dashboard page)" node task_link.js
start; run "Finance tabs: Income / Expense" node finance_tabs.js
start; run "Finance › Expense: import + recap" node expenses.js
start; run "Operational › Expense + recurring" node ops_expense.js
start; run "phone bottom bar: round indicator" node nav_circle.js
start; run "phone: category list + slide the bottom bar" node phone_ui.js
start; run "safety net: emptied Sheet tab is restored" node empty_guard.js
start; run "expense list grouped per day" node exp_days.js
start; run "Production › Purchasing: import + year/month list" node purchases.js
start; run "saves send only changed tabs" node sync_changed.js
start; run "Production › Manufacturing: import + SKU names" node manufacturing.js
start; run "Production › Supplier: import past payments" node supplier_import.js
start; run "install as app / offline" node pwa.js
start; run "POS menu, price sheet, sounds, printer" node pos_ui.js
start; run "POS stock history: no sales, owner edits" node pos_stock.js
start; run "POS brand + category names, one-tap Simpan" node pos_brand.js
start; run "POS receipts: change payment / cancel, no owner mode" node pos_receipt.js
start; run "POS printer over Bluetooth LE (no Web Serial)" node pos_ble.js
start; run "POS printer auto-connect" node pos_autoconnect.js
stop
echo; [ $fails -eq 0 ] && echo "EVERYTHING PASSED" || echo "$fails SUITE(S) FAILED"; exit $fails

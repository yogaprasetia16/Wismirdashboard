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
start; run "install as app / offline" node pwa.js
start; run "POS menu, price sheet, sounds, printer" node pos_ui.js
start; run "POS stock history: no sales, owner edits" node pos_stock.js
start; run "POS printer over Bluetooth LE (no Web Serial)" node pos_ble.js
start; run "POS printer auto-connect" node pos_autoconnect.js
stop
echo; [ $fails -eq 0 ] && echo "EVERYTHING PASSED" || echo "$fails SUITE(S) FAILED"; exit $fails

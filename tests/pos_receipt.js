// POS Struk: anyone (no owner mode) can change a receipt's payment method or cancel it (two taps);
// a cancelled receipt is struck through in the list.
const {chromium,devices}=require('playwright');
const B='http://localhost:8765';
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const S0=require('./pos-sample')();
(async()=>{
 const br=await chromium.launch();const p=await (await br.newContext({...devices['Galaxy Tab S4 landscape']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(st=>{try{if(!localStorage.getItem('wismir_pos_v1'))localStorage.setItem('wismir_pos_v1',JSON.stringify(st))}catch(e){}},S0);
 await p.goto(B+'/pos.html');await p.waitForTimeout(400);
 await p.click('[data-a=tgStaff]');await p.fill('#cashStart','0');await p.click('[data-a=openShift]');await p.waitForTimeout(300);
 const sell=async(i,price,m)=>{await p.click('#grid .pc >> nth='+i);await p.fill('#pp',price);await p.click('[data-a=addLine]');await p.click('[data-a=pay]');await p.click('[data-a=setMethod][data-m='+m+']');await p.click('#sheet [data-a=x]')};
 await sell(0,'100000','Tunai');await p.waitForTimeout(20);await sell(1,'50000','Tunai');
 const nav=async t=>{await p.tap('#menuBtn');await p.tap('#menu [data-t='+t+']');await p.waitForTimeout(200)};
 await nav('rc');
 ok(await p.evaluate(()=>!window.__wismir.ownerOK),'owner mode is off');
 await p.click('.row[data-a=viewTx] >> nth=1');
 ok(await p.isVisible('[data-a=rcPay]')&&await p.isVisible('[data-a=rcVoid]')&&!(await p.$('[data-a=rcEdit]')),'receipt shows "Ubah pembayaran" and "Batalkan struk" without owner mode');
 await p.click('[data-a=rcPay]');
 ok((await p.$$('#emchips [data-a=ePay]')).length===3&&!(await p.$('[data-ei]')),'payment sheet: only method buttons, no item/price editing');
 await p.click('[data-a=ePay][data-m=Transfer]');await p.waitForTimeout(150);
 const first=await p.evaluate(()=>{const S=window.__wismir.S;const t=S.txs.slice().sort((a,b)=>a.t-b.t)[0];return [t.method,t.pays.map(x=>x.method+x.amount).join(),t.edited].join('|')});
 ok(first==='Transfer|Transfer100000|true','one tap changes the payment to Transfer: '+first);
 ok((await p.textContent('#app')).includes('Diubah'),'list marks the receipt "Diubah"');
 // cancel the other receipt: two taps
 await p.click('.row[data-a=viewTx] >> nth=0');await p.click('[data-a=rcVoid]');
 ok((await p.textContent('[data-a=rcVoid]')).includes('Ketuk lagi'),'first tap asks to tap again');
 await p.click('[data-a=rcVoid]');await p.waitForTimeout(150);
 const row=await p.$eval('.row.void',e=>[getComputedStyle(e.querySelector('.t')).textDecorationLine,getComputedStyle(e.querySelector('.v')).textDecorationLine,e.textContent.includes('Dibatalkan')].join('|'));
 ok(row==='line-through|line-through|true','cancelled receipt is struck through and marked "Dibatalkan" in the list');
 ok((await p.textContent('.ph .live')).includes('1 transaksi'),'header count leaves out the cancelled receipt');
 await p.click('.row.void');ok(!(await p.$('[data-a=rcPay]'))&&!(await p.$('[data-a=rcVoid]')),'a cancelled receipt has no change/cancel buttons');
 await p.click('#sheet [data-a=x]');
 const by=await p.evaluate(()=>{const S=window.__wismir.S;const by={};S.txs.filter(t=>!t.void).forEach(t=>t.pays.forEach(x=>by[x.method]=(by[x.method]||0)+x.amount));return JSON.stringify(by)});
 ok(by==='{"Transfer":100000}','sales left: one receipt paid by Transfer '+by);
 await p.screenshot({path:'receipts.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

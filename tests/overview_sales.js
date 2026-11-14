// Overview (owner 2026-11-13): 7 bars = sales of the last 7 days, the last bar is today; the big number is today's sales,
// including receipts of a shift that is still open (Code.gs v12 "POS Harian"); closing the shift does not count it twice.
// Income / Expenses = this month. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
const nav=async(pg,t)=>{await pg.click('#menuBtn');await pg.click('#menu [data-t='+t+']');await pg.waitForTimeout(200)};
(async()=>{const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 const Y=await D.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);return ymd(d)});
 await D.evaluate(Y=>{S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',min:3,aktif:'Active'});S.stores.push({id:'s1',name:'Toko A',type:'Physical store'});S.staff.push({id:'k1',name:'Rina',status:'Active'});
  S.tx.push({id:'x1',jenis:'Income',tanggal:Y,kategori:'Sales',jumlah:50000,catatan:''},{id:'x2',jenis:'Expense',tanggal:today(),kategori:'Rent',jumlah:20000,catatan:''});save()},Y);
 await sleep(2500);
 const A=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();A.on('pageerror',e=>errs.push('pos: '+e.message));
 await A.goto(B+'/pos.html');await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.click('[data-a=osub][data-s=data]');
 await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.products.length===1),10000,'tablet');await A.click('[data-a=ownerOff]').catch(()=>{});
 await nav(A,'home');await A.click('[data-a=tgStaff]');await A.fill('#cashStart','0');await A.click('[data-a=openShift]');await A.waitForTimeout(200);
 await A.click('#grid .pc');await A.fill('#pp','150000');await A.click('[data-a=addLine]');await A.click('[data-a=pay]');await A.click('[data-a=setMethod][data-m=Transfer]');await A.click('#sheet [data-a=x]');
 await until(()=>A.evaluate(()=>window.__wismir.S.outbox.length===0),10000,'sent');
 await D.evaluate(()=>pullSheets());await D.evaluate(()=>{tab='home';render()});
 let t=txt(await D.textContent('#app'));
 ok(t.includes("Today's sales")&&t.includes('Rp 150.000')&&!t.includes('Net profit'),'big number = today\'s sales from the open shift (150.000)');
 ok(t.includes('This week')&&!t.includes('This month')&&t.includes('Sales, last 7 days'),'labels: This week, Sales, last 7 days');
const inc=await D.evaluate(()=>sums(monthTx()).i+150000).then(v=>v.toLocaleString('id-ID'));
 ok(t.includes("'s income Rp "+inc)&&t.includes("'s expense Rp 20.000"),'income this month includes the open shift; expenses of this month');
 const bars=await D.$$eval('.hero .bars > div',e=>e.map(x=>({l:x.textContent.trim(),h:parseFloat(x.querySelector('i').style.height)})));
 ok(bars.length===7&&bars[6].l==='Today'&&bars[6].h===90&&bars[5].h===30,'7 bars, last = Today (tallest), yesterday 50.000 = a third: '+JSON.stringify(bars.slice(5)));
 await nav(A,'home');await A.click('[data-a=closeSheet]');await A.click('[data-a=doClose]');
 await until(()=>A.evaluate(()=>window.__wismir.S.outbox.length===0),10000,'closed');
 await D.evaluate(()=>pullSheets());await D.evaluate(()=>{tab='home';render()});t=txt(await D.textContent('#app'));
 ok(txt(await D.textContent('.hero .hbig'))==='Rp 150.000','after closing the shift: still 150.000 (not counted twice)');
 await D.screenshot({path:'overview.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

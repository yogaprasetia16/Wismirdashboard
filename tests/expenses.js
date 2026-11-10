// Finance > Transactions > Expense: import past expenses (Tanggal, Kategori, Jumlah, Catatan), monthly recap per year and
// category, month details with edit, re-import replaces, rows reach the Keuangan tab. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
const PASTE=['Tanggal\tKategori\tJumlah\tCatatan',
 '05/01/2025\tstore rent\t5000000\t','10/01/2025\tporter\t20000\t','10/01/2025\tporter\t20000\t',   // two identical rows stay two expenses
 '03/02/2025\tstaff\t1.500.000\tgaji','01/01/2026\tstore rent\t5500000\t','15/01/2026\tsupplies\t250000\thanger, plastik',
 '20/02/2026\tads\t300000\t','bad\t\t\t'].join('\n');
(async()=>{
 const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{tab='tx';fv='tx';txf='Expense';render()});
 ok((await D.textContent('#app')).includes('No expenses yet')&&await D.isVisible('text=Import expenses'),'empty Expense tab with "Import expenses"');
 await D.click('text=Import expenses');await D.fill('#etext',PASTE);
 const pv=txt(await D.textContent('#eprev'));
 ok(pv.includes('7 expenses')&&pv.includes('Rp 12.590.000')&&pv.includes('1 rows skipped')&&pv.includes('Porter')&&pv.includes('Store rent'),'preview: 7 expenses, total, categories, 1 bad row: '+pv);
 await D.click('#ego');await D.waitForTimeout(200);
 ok(await D.evaluate(()=>S.tx.filter(t=>t.jenis==='Expense').length===7&&txf==='Expense'&&EY==='2026'),'imported 7 expenses, opens Expense on 2026');
 ok(txt(await D.textContent('#eyTot'))==='Rp 6.050.000','2026 expenses Rp 6.050.000');
 const jan=await D.$eval('tr[data-em="2026-01"]',e=>[...e.children].map(c=>c.textContent.replace(/\s/g,' ')).join('|'));
 ok(jan==='Jan 2026|2|Rp 5.750.000|Rp 5.040.000|+14%','Jan 2026 vs Jan 2025 (more spending = red): '+jan);
 ok(await D.$eval('tr[data-em="2026-01"] td:last-child',e=>e.className)==='neg','more spending shows in red');
 const cats=await D.$$eval('.sub + .card .row .t',e=>e.map(x=>x.textContent));
 ok(cats.join()==='Store rent,Ads,Supplies','2026 by category, largest first: '+cats.join(', '));
 // category filter
 await D.selectOption('.f select','Store rent');
 ok(txt(await D.textContent('#eyTot'))==='Rp 5.500.000','filter Store rent: Rp 5.500.000');
 await D.selectOption('.f select','all');
 // month details + edit
 await D.click('tr[data-em="2026-01"]');
 ok((await D.$$('#sheet .row')).length===2&&(await D.textContent('#sheet')).includes('hanger, plastik'),'month details list the expenses with notes');
 await D.click('#sheet .row >> text=Supplies');
 ok((await D.textContent('#sheet h3'))==='Edit expense'&&await D.$eval('#sheet [data-k=kategori]',e=>e.value)==='Supplies','tapping an expense opens it for editing');
 await D.fill('#sheet [data-k=jumlah]','260000');await D.click('#ok');
 ok(txt(await D.textContent('#eyTot'))==='Rp 6.060.000','edit saved (Rp 6.060.000)');
 // re-import replaces, the edited row too (same id): no double counting
 await D.click('text=Import expenses');await D.fill('#etext',PASTE);
 ok(txt(await D.textContent('#eprev')).includes('7 rows replace'),'re-import: all 7 rows replace the earlier ones');
 await D.click('#ego');await D.waitForTimeout(200);
 ok(await D.evaluate(()=>S.tx.filter(t=>t.jenis==='Expense').length===7)&&txt(await D.textContent('#eyTot'))==='Rp 6.050.000','re-import does not double count (still 7, the imported amount is back)');
 // year 2025 and the Sheet
 await D.click('[onclick="EY=\'2025\';render()"]');
 ok(txt(await D.textContent('#eyTot'))==='Rp 6.540.000','2025 expenses Rp 6.540.000 (both porter rows counted)');
 await until(async()=>{const o=await dump();if(!o.Keuangan)return false;const h=o.Keuangan.v[0];return o.Keuangan.v.filter(r=>r[h.indexOf('jenis')]==='Expense').length===7},10000,'synced');
 const k=(await dump()).Keuangan.v,h=k[0];
 ok(k.slice(1).filter(r=>r[h.indexOf('jenis')]==='Expense').length===7&&k.slice(1).some(r=>r[h.indexOf('tanggal')]==='2026-01-15'&&r[h.indexOf('kategori')]==='Supplies'),'expenses saved in the Keuangan tab with yyyy-mm-dd dates');
 // manual expense with a new category
 await D.click('#cta');await D.fill('#sheet [data-k=kategori]','internet');await D.fill('#sheet [data-k=jumlah]','100000');await D.click('#ok');
 ok(await D.evaluate(()=>S.tx.some(t=>t.kategori==='Internet')),'a typed category is saved capitalised (Internet)');
 await D.evaluate(()=>{EY='2026';render()});await D.screenshot({path:'expenses.png',fullPage:true});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

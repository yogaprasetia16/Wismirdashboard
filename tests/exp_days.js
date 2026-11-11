// Expense lists grouped per day (Operational > Expense and Finance > Expense month details): newest day first,
// a header per day with the day's total, rows still open the edit form. Sample data is made up.
const {chromium}=require('playwright');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
(async()=>{const br=await chromium.launch();const errs=[];
 const p=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8765/dashboard.html');await p.waitForTimeout(300);
 const d=await p.evaluate(()=>{const z=k=>{const x=new Date();x.setDate(1+k);return ymd(x)};return [z(0),z(1),z(2)]});
 await p.evaluate(d=>{S.tx.push({id:'e1',jenis:'Expense',tanggal:d[0],kategori:'Store rent',jumlah:9584000,catatan:''},{id:'e2',jenis:'Expense',tanggal:d[0],kategori:'Porter',jumlah:30000,catatan:'angkut'},
  {id:'e3',jenis:'Expense',tanggal:d[2],kategori:'Supplies',jumlah:150000,catatan:'hanger'},{id:'e4',jenis:'Expense',tanggal:d[1],kategori:'Staff',jumlah:500000,catatan:'fika'});tab='ops';ops='exp';OM=d[0].slice(0,7);render()},d);
 const days=await p.$$eval('.dayh',e=>e.map(x=>x.dataset.day));
 ok(days.join()===[d[2],d[1],d[0]].join(),'one group per day, newest first: '+days.join(', '));
 const first=txt(await p.textContent('.dayh[data-day="'+d[0]+'"]'));
 ok(first.includes('−Rp 9.614.000')&&/\d/.test(first),'day header shows the date and the day total: '+first);
 const rows=await p.$$eval('.dayh[data-day="'+d[0]+'"] + .card .row',r=>r.map(x=>x.dataset.eid).sort().join());
 ok(rows==='e1,e2','the day lists its expenses');
 await p.click('[data-eid="e2"]');ok((await p.textContent('#sheet h3'))==='Edit expense','tapping an expense still opens it');await p.click('#no');
 // Finance > Expense > month details
 await p.evaluate(m=>{tab='tx';fv='tx';txf='Expense';EY=m.slice(0,4);render()},d[0]);await p.click('tr[data-em="'+d[0].slice(0,7)+'"]');
 ok((await p.$$('#sheet .dayh')).length===3&&(await p.$$('#sheet .row')).length===4,'Finance month details are grouped per day too');
 await p.click('#sheet #no');
 await p.evaluate(()=>{tab='ops';ops='exp';render()});await p.screenshot({path:'exp-days.png',fullPage:true});
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

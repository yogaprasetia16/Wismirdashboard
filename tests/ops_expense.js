// Operational > Expense: enter monthly store expenses (Date, Category, Amount, Note), edit every field, delete;
// Recurring button (top right) with a list of recurring expenses (Category, Amount, Note, Repeat + Next date) that add
// expenses on their date, once, also with two devices. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
(async()=>{
 const br=await chromium.launch();const errs=[];
 const open=async()=>{const p=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto(B+'/dashboard.html');await p.evaluate(()=>{tab='set';render()});await p.fill('#cu',URL_);await p.fill('#cp','9999');await p.evaluate(()=>saveCfg());
  await until(()=>p.evaluate(()=>S.cfg.pulled===1),10000,'pull');return p};
 const D=await open();
 await D.evaluate(()=>{tab='ops';ops='exp';render()});
 const seg=await D.$eval('#app .seg',s=>[...s.querySelectorAll('button')].map(x=>x.getAttribute('aria-label')||x.textContent));
 ok(seg.join()==='Stock,Staff,Attendance,Store,Expense','Operational has an Expense tab: '+seg.join(', '));
 ok(await D.isVisible('#cta')&&(await D.textContent('#cta')).includes('New expense'),'"+ New expense" button');
 const T=await D.evaluate(()=>today());
 // add an expense
 await D.click('#cta');
 const f=await D.$$eval('#sheet .f label',l=>l.map(x=>x.textContent));
 ok(f.join()==='Date,Category,Amount (Rp),Note','form: '+f.join(', '));
 await D.fill('#sheet [data-k=kategori]','store rent');await D.fill('#sheet [data-k=jumlah]','9584000');await D.click('#ok');
 await D.click('#cta');await D.fill('#sheet [data-k=kategori]','Porter');await D.fill('#sheet [data-k=jumlah]','30000');await D.fill('#sheet [data-k=catatan]','angkut barang');await D.click('#ok');
 let t=txt(await D.textContent('#app'));
 ok(t.includes('2 expenses')&&t.includes('Rp 9.614.000')&&t.includes('Store rent')&&t.includes('angkut barang'),'this month: 2 expenses, total, notes');
 const sug=await D.evaluate(()=>{addExpense();const o=[...document.querySelectorAll('#sheet .cmbo')].map(x=>x.dataset.v);close();return o});
 ok(sug.includes('Store rent')&&sug.includes('Porter'),'category suggests the categories used before');
 // edit every field
 const id=await D.evaluate(()=>S.tx.find(x=>x.kategori==='Porter').id);
 await D.click('[data-eid="'+id+'"]');
 ok((await D.textContent('#sheet h3'))==='Edit expense','tapping an expense opens it');
 const prev=await D.evaluate(()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);return ymd(d)});
 await D.fill('#sheet [data-k=tanggal]',prev);await D.fill('#sheet [data-k=kategori]','Supplies');await D.fill('#sheet [data-k=jumlah]','45000');await D.fill('#sheet [data-k=catatan]','hanger');await D.click('#ok');
 const e=await D.evaluate(id=>{const x=S.tx.find(t=>t.id===id);return [x.tanggal,x.kategori,x.jumlah,x.catatan].join('|')},id);
 ok(e===prev+'|Supplies|45000|hanger','date, category, amount and note all changed: '+e);
 ok(txt(await D.textContent('#app')).includes('1 expenses'),'moved to last month, so this month shows 1');
 await D.selectOption('#app .f select',prev.slice(0,7));
 ok(txt(await D.textContent('#app')).includes('hanger'),'month picker shows last month');
 // delete (two taps)
 await D.click('[data-eid="'+id+'"]');await D.click('#rm');ok((await D.textContent('#rm')).includes('Tap again'),'delete asks for a second tap');await D.click('#rm');
 ok(await D.evaluate(id=>!S.tx.some(t=>t.id===id),id),'expense deleted');
 // recurring
 await D.evaluate(()=>{OM='';render()});
 const rb=await D.$eval('#recBtn',b=>{const r=b.getBoundingClientRect();return r.right>innerWidth*0.7});
 ok(rb,'Recurring button sits on the right');
 await D.click('#recBtn');
 ok((await D.textContent('#sheet')).includes('No recurring expenses yet'),'recurring popup: empty list');
 await D.click('#recAdd');
 const rf=await D.$$eval('#sheet .f label',l=>l.map(x=>x.textContent));
 ok(rf.join()==='Category,Amount (Rp),Note,Repeat,Next date','recurring form: '+rf.join(', '));
 ok((await D.$$eval('#sheet [data-k=repeat] option',o=>o.map(x=>x.value))).join()==='Monthly,Weekly,Daily,Yearly','repeat options');
 // a monthly one that started two months ago: adds this month's and last two months' rent (3 expenses)
 const start=await D.evaluate(()=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-2);return ymd(d)});
 await D.fill('#sheet [data-k=kategori]','Store rent');await D.fill('#sheet [data-k=jumlah]','917000');await D.fill('#sheet [data-k=catatan]','lapak');await D.fill('#sheet [data-k=tanggal]','').catch(()=>{});
 await D.fill('#sheet [data-k=next]',start);await D.click('#ok');await D.waitForTimeout(150);
 ok(await D.isVisible('#sheet')&&(await D.$$('#sheet [data-rid]')).length===1,'back in the recurring list with the new item');
 const gen=await D.evaluate(()=>S.tx.filter(t=>String(t.id).startsWith('r-')).map(t=>t.tanggal).sort());
 ok(gen.length===3&&gen[0]===start,'due dates were added as expenses: '+gen.join(', '));
 const nx=await D.evaluate(()=>S.rec[0].next);ok(nx>T,'next date moved after today: '+nx);
 ok((await D.textContent('#sheet')).includes('Every month'),'list shows the repeat');
 // edit + a second device never adds them twice
 await D.click('#sheet [data-rid]');ok((await D.textContent('#sheet h3'))==='Edit recurring expense','tap opens the recurring expense');
 await D.fill('#sheet [data-k=jumlah]','950000');await D.click('#ok');
 ok(await D.evaluate(()=>S.rec[0].jumlah===950000),'recurring amount edited');
 await D.click('#no');
 await until(async()=>{const o=await dump();return o.Recurring&&o.Recurring.v.length===2&&o.Keuangan.v.filter(r=>String(r[0]).startsWith('r-')).length===3},10000,'synced');
 ok(true,'recurring item and its expenses reach the Sheet (tab Recurring)');
 const E=await open();await E.evaluate(()=>runRecurring());await sleep(300);
 ok(await E.evaluate(()=>S.tx.filter(t=>String(t.id).startsWith('r-')).length===3),'second device: no duplicate recurring expenses');
 await D.evaluate(()=>{tab='ops';ops='exp';render()});await D.click('#recBtn');await D.screenshot({path:'ops-recurring.png'});await D.click('#no');
 await D.screenshot({path:'ops-expense.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

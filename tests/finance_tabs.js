// Finance tabs (owner 2026-11-10): Transactions | Report | Financial; inside Transactions: Income (the sales recap) | Expense.
// No "All" view and no separate Sales tab. Expense form: Date, Category, Amount, Note.
const {chromium}=require('playwright');
const B='http://localhost:8765';
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='tx';render()});
 const top=await D.$eval('#app .seg',s=>[...s.querySelectorAll('button')].map(x=>x.textContent));
 const sub=await D.$$eval('#app .seg:nth-of-type(2) button',b=>b.map(x=>x.textContent));
 ok(top.join()==='Transactions,Report,Financial','top tabs: '+top.join(', '));
 ok(sub.join()==='Income,Expense','Transactions has Income | Expense, no All: '+sub.join(', '));
 ok(await D.evaluate(()=>txf==='Income')&&(await D.textContent('#app')).includes('Import sales history'),'Income opens first and is the sales recap (with Import sales history)');
 ok(!(await D.isVisible('#cta')),'no "+" button on Income');
 await D.click('#app .seg button >> text=Expense');
 ok(await D.isVisible('#cta')&&(await D.textContent('#cta')).includes('New expense'),'Expense has the "+ New expense" button');
 await D.click('#cta');
 const f=await D.$$eval('#sheet .f label',l=>l.map(x=>x.textContent));
 ok(f.join()==='Date,Category,Amount (Rp),Note','expense form: '+f.join(', '));
 ok(!(await D.$$eval('#dl-kategori option',o=>o.map(x=>x.value))).includes('Sales'),'expense category suggestions leave out Sales');
 await D.fill('#sheet [data-k=kategori]','rent');await D.fill('#sheet [data-k=jumlah]','2500000');await D.fill('#sheet [data-k=catatan]','Toko A');await D.click('#ok');
 ok(await D.evaluate(()=>S.tx.length===1&&S.tx[0].jenis==='Expense'&&S.tx[0].kategori==='Rent'),'expense saved as Expense (category capitalised)');
 ok((await D.textContent('#app')).includes('Rent'),'expense shows in the recap');
 await D.click('tr[data-em]');await D.click('#sheet .row >> text=Rent');
 ok((await D.textContent('#sheet h3'))==='Edit expense'&&(await D.$$('#sheet .f')).length===4,'editing uses the same four fields');
 await D.click('#no');
 // an old link / old state to Sales lands on Income
 await D.evaluate(()=>{fv='sales';render()});
 ok(await D.evaluate(()=>fv==='tx'&&txf==='Income'),'old "Sales" view now opens Income');
 await D.screenshot({path:'fin-expense.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

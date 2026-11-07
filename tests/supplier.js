// Dashboard > Production > Supplier: per month, stock in from "Supplier" minus stock out to "Supplier" per product × COGS,
// copy the total, mark a month as paid (Supplier tab, synced), checkmark in the list; rows made before Code.gs knew the tab survive.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const errs=[];
 const ctx=await br.newContext({viewport:{width:1280,height:850}});await ctx.grantPermissions(['clipboard-read','clipboard-write'],{origin:B});
 const D=await ctx.newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 for(const [n,c] of [['Gamis A','100000'],['Hijab B','25000'],['Tunik C','']])await D.evaluate(([n,c])=>{tab='ops';ops='stock';addProduct();document.querySelector('#sheet [data-k=nama]').value=n;document.querySelector('#sheet [data-k=cogs]').value=c;document.querySelector('#ok').click()},[n,c]);
 await until(async()=>{const o=await dump();return o.Stok&&o.Stok.v.length===4},10000,'products');
 const id=await D.evaluate(()=>Object.fromEntries(S.products.map(p=>[p.nama,p.id])));
 // POS stock moves: June in/out with the supplier, a transfer and a void row that must not count, July in
 let n=0;const mv=(d,pid,name,dari,ke,qty,status)=>({id:'M'+(n++),tanggal:d,jam:'10:00',produk:name,dari,ke,qty,oleh:'Toko A',catatan:'',status:status||'ok',jenis:'',ref:'',pid,t:String(n)});
 const rows=[mv('2026-06-03',id['Gamis A'],'Gamis A','Supplier','Toko A',10),mv('2026-06-20',id['Gamis A'],'Gamis A','Toko A','Supplier',3),
  mv('2026-06-05',id['Hijab B'],'Hijab B','Supplier','Gudang',20),mv('2026-06-06',id['Hijab B'],'Hijab B','Gudang','Toko A',5),
  mv('2026-06-07',id['Hijab B'],'Hijab B','Supplier','Toko A',50,'void'),mv('2026-06-08',id['Tunik C'],'Tunik C','Supplier','Toko A',4),
  mv('2026-06-09',id['Gamis A'],'Gamis A','Konveksi','Toko A',7),mv('2026-07-02',id['Hijab B'],'Hijab B','Supplier','Toko A',2)];
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':rows}})});
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>(S.pos.stok||[]).length===8),10000,'pull moves');
 await D.evaluate(()=>{tab='prod';pt='supp';render()});
 const cols=await D.$$eval('.board.b3 .bcol .bh .sub',e=>e.map(x=>x.textContent));
 ok(cols.join()==='Purchasing,Manufacturing,Supplier','Production shows Supplier beside Purchasing and Manufacturing: '+cols.join(', '));
 const list=await D.$$eval('[data-supp]',e=>e.map(x=>x.dataset.supp+'|'+x.querySelector('b').textContent.replace(/\s/g,' ')));
 // June: Gamis (10-3)=7×100000=700000 + Hijab 20×25000=500000 + Tunik 4×0 = 1.200.000; July: Hijab 2×25000=50.000
 ok(list.join(';')==='2026-07|Rp 50.000;2026-06|Rp 1.200.000','monthly list, newest first, totals: '+list.join(' ; '));
 ok((await D.textContent('[data-supp="2026-06"]')).includes('Pay in July 2026'),'unpaid June says "Pay in July 2026"');
 ok(!(await D.isVisible('#cta')),'no "+" add button on the Supplier list');
 await D.click('[data-supp="2026-06"]');
 const tb=await D.$$eval('#sheet .stab tbody tr',r=>r.map(x=>[...x.children].map(c=>c.textContent.replace(/\s/g,' ')).join('|')));
 ok(tb.length===3&&tb[0]==='Gamis A|10|3|7|Rp 100.000|Rp 700.000'&&tb[1]==='Hijab B|20|0|20|Rp 25.000|Rp 500.000'&&tb[2].startsWith('Tunik C|4|0|4|no COGS'),'recap per product (in, out, net, COGS, total): '+tb.join(' / '));
 ok((await D.textContent('#sTot')).replace(/\s/g,' ')==='Rp 1.200.000'&&(await D.textContent('#sheet')).includes('no COGS'),'total to pay + warning for the product without COGS');
 await D.click('#sCopy');await sleep(200);
 ok(await D.evaluate(()=>navigator.clipboard.readText())==='1200000'&&(await D.textContent('#sCopy'))==='Copied','Copy puts the plain number 1200000 on the clipboard');
 await D.click('#sPaid');await sleep(200);
 ok(!(await D.isVisible('#sheet')),'Mark as paid closes the recap');
 await until(async()=>{const o=await dump();return o.Supplier&&o.Supplier.v.length===2},10000,'paid synced');
 const sp=(await dump()).Supplier.v;
 ok(sp[0].join()==='id,bulan,total,paidOn'&&sp[1][1]==='2026-06'&&sp[1][2]===1200000,'paid month saved in the Supplier tab: '+sp[1].join(','));
 ok(await D.$eval('[data-supp="2026-06"] .th',e=>e.title==='Paid'&&!!e.querySelector('svg'))&&(await D.textContent('[data-supp="2026-06"]')).includes('Paid'),'June shows a checkmark and "Paid"');
 ok(!(await D.$eval('[data-supp="2026-07"] .th',e=>!!e.querySelector('svg'))),'July (unpaid) has no checkmark');
 // second device sees the paid month
 const E=await (await br.newContext({viewport:{width:390,height:800}})).newPage();E.on('pageerror',e=>errs.push(e.message));
 await E.goto(B+'/dashboard.html');await E.evaluate(()=>{tab='set';render()});await E.fill('#cu',URL_);await E.fill('#cp','9999');await E.evaluate(()=>saveCfg());
 await until(()=>E.evaluate(()=>S.cfg.pulled===1&&(S.pos.stok||[]).length===8),10000,'phone');
 await E.evaluate(()=>{tab='prod';pt='supp';render()});
 ok(await E.isVisible('[data-supp="2026-06"]')&&await E.$eval('[data-supp="2026-06"] .th',e=>e.title==='Paid'),'phone: Supplier column shown, June paid');
 await E.screenshot({path:'supplier-phone.png'});
 // unmark needs two taps
 await D.click('[data-supp="2026-06"]');await D.click('#sPaid');
 ok((await D.textContent('#sPaid')).includes('Tap again'),'Mark as not paid asks for a second tap');
 await D.click('#sPaid');await until(async()=>(await dump()).Supplier.v.length===1,10000,'unpaid synced');ok(true,'second tap marks June as not paid again (row removed from the Sheet)');
 // a month marked paid while Code.gs was old (no Supplier tab yet) survives the first load from the updated Code.gs
 await D.evaluate(()=>{S.cfg.tabs=['Keuangan','Stok','Tugas','Production','Marketing','Purchasing','Staff','Store'];S.supp=[{id:'sup-2026-07',bulan:'2026-07',total:50000,paidOn:'2026-08-01'}];S.cfg.dirty=0;persist()});
 await D.evaluate(()=>pullSheets());
 await until(async()=>(await dump()).Supplier.v.length===2,10000,'late tab pushed');
 ok(await D.evaluate(()=>S.supp.length===1&&S.supp[0].bulan==='2026-07'),'paid mark made before the Code.gs update is kept and sent to the Sheet');
 await D.evaluate(()=>{tab='prod';pt='supp';render()});await D.click('[data-supp="2026-06"]');await sleep(150);
 await D.screenshot({path:'supplier.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

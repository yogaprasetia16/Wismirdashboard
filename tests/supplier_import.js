// Production > Supplier: import past supplier payments (date + amount, no products). A payment counts for the month before
// it was paid; payments in one month are added up; months show as paid ("imported"), with year pills; re-import replaces;
// a POS month keeps its product recap. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
const PASTE=['Tanggal\tJumlah','05/02/2025\tRp12.500.000','20/02/2025\t2.500.000','07/03/2025\t9000000','10/01/2026\tRp8.000.000','x\t'].join('\n');
(async()=>{const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{tab='prod';pt='supp';render()});
 await D.click('text=Import payments');await D.fill('#stp',PASTE);
 const pv=txt(await D.textContent('#stpv'));
 ok(pv.includes('4 payments → 3 months')&&pv.includes('Rp 32.000.000')&&pv.includes('January 2025: Rp 15.000.000')&&pv.includes('2 payments')&&pv.includes('December 2025: Rp 8.000.000')&&pv.includes('1 rows skipped'),'preview: payments mapped to the month before, same-month payments added: '+pv);
 await D.click('#stgo');await D.waitForTimeout(200);
 ok(await D.evaluate(()=>S.supp.length===3&&SPY==='2025'),'3 paid months saved, opens 2025');
 const jan=txt(await D.textContent('[data-supp="2025-01"]'));
 ok(jan.includes('January 2025')&&jan.includes('Paid 20 Feb 2025')&&jan.includes('imported')&&jan.includes('Rp 15.000.000'),'January 2025 shows paid on 20 Feb, imported, Rp 15.000.000: '+jan);
 ok(await D.$eval('[data-supp="2025-01"] .th',e=>e.title==='Paid'),'green check on imported months');
 ok(txt(await D.textContent('#app')).includes('2025 · Rp 32.000.000 paid'),'year total of payments');
 await D.click('[data-supp="2025-01"]');
 ok((await D.textContent('#sheet')).includes('no product details')&&!(await D.$('#sheet .stab')),'imported month opens without a product table');
 await D.click('#no');
 await D.evaluate(()=>{SPY='2025';render()});
 // re-import replaces (no doubling)
 await D.click('text=Import payments');await D.fill('#stp',PASTE);ok(txt(await D.textContent('#stpv')).includes('3 months replace'),'re-import replaces those months');await D.click('#stgo');
 ok(await D.evaluate(()=>S.supp.length===3&&S.supp.find(x=>x.bulan==='2025-01').total===15000000),'still 3 months, January still Rp 15.000.000');
 // remove one (two taps)
 await D.evaluate(()=>{SPY='2025';render()});await D.click('[data-supp="2025-02"]');await D.click('#sPaid');ok((await D.textContent('#sPaid')).includes('Tap again'),'removing asks for a second tap');await D.click('#sPaid');
 ok(await D.evaluate(()=>!S.supp.some(x=>x.bulan==='2025-02')),'payment removed');
 await until(async()=>{const o=await dump();return o.Supplier&&o.Supplier.v.length===3},10000,'synced');ok(true,'payments saved in the Supplier tab');
 // a POS month still has its product recap
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[{id:'S1',tanggal:'2026-10-03',produk:'X',dari:'Supplier',ke:'Toko A',qty:5,status:'ok',pid:'p1',t:'1'}]}})});
 await D.evaluate(()=>{S.products.push({id:'p1',nama:'Gamis X',cogs:100000,min:3});pullSheets()});await until(()=>D.evaluate(()=>(S.pos.stok||[]).length===1),10000,'pos');
 await D.evaluate(()=>{SPY='2026';render()});
 ok(txt(await D.textContent('[data-supp="2026-10"]')).includes('in 5'),'2026: October comes from the POS (in 5)');await D.evaluate(()=>{SPY='2025';render()});ok(txt(await D.textContent('[data-supp="2025-12"]')).includes('imported'),'December 2025 (paid in January 2026) is an imported month');
 await D.screenshot({path:'supplier-import.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

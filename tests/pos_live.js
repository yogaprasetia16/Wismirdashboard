// POS (owner 2026-11-13): a sale is saved on the tablet first, then its receipt and its stock moves are sent to the Sheet
// in the background right away (no waiting for shift close). Cancelling a receipt also goes out at once. Closing the shift
// sends the shift summary and attendance and does not take the stock off a second time. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const nav=async(pg,t)=>{await pg.click('#menuBtn');await pg.click('#menu [data-t='+t+']');await pg.waitForTimeout(200)};
const rows=(o,tab)=>{const t=o[tab];if(!t||!t.v.length)return[];const h=t.v[0];return t.v.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))};
(async()=>{
 const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:850}})).newPage();D.on('pageerror',e=>errs.push('dash: '+e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',min:3,aktif:'Active'},{id:'pb',nama:'Tunik Beta',sku:'BB02',min:3,aktif:'Active'});
  S.stores.push({id:'s1',name:'Toko A',type:'Physical store'});S.staff.push({id:'k1',name:'Rina',status:'Active'});save()});
 await until(async()=>{const o=await dump();return o.Store&&o.Store.v.length===2&&o.Stok&&o.Stok.v.length===3},10000,'master');
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[
  {id:'m1',tanggal:'2026-11-01',jam:'09:00',produk:'Gamis Alpha',dari:'Supplier',ke:'Toko A',qty:10,oleh:'Toko A',catatan:'',status:'ok',jenis:'',ref:'',pid:'pa',t:'1'},
  {id:'m2',tanggal:'2026-11-01',jam:'09:00',produk:'Tunik Beta',dari:'Supplier',ke:'Toko A',qty:10,oleh:'Toko A',catatan:'',status:'ok',jenis:'',ref:'',pid:'pb',t:'2'}]}})});
 const A=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();A.on('pageerror',e=>errs.push('pos: '+e.message));
 await A.goto(B+'/pos.html');await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.click('[data-a=osub][data-s=data]');
 await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.products.length===2&&window.__wismir.S.moves.length===2),10000,'tablet');
 await A.click('[data-a=ownerOff]').catch(()=>{});
 await nav(A,'home');await A.click('[data-a=tgStaff]');await A.fill('#cashStart','0');await A.click('[data-a=openShift]');await A.waitForTimeout(200);
 const sell=async(pid,price,qty)=>{await A.click('#grid .pc[data-id="'+pid+'"]');await A.fill('#pp',price);await A.fill('#pq',qty);await A.click('[data-a=addLine]');await A.click('[data-a=pay]');await A.click('[data-a=setMethod][data-m=Transfer]');await A.click('#sheet [data-a=x]');await A.waitForTimeout(100)};
 await sell('pa','100000','2');await sell('pb','50000','1');
 const local=await A.evaluate(()=>{const S=window.__wismir.S;return{tx:S.txs.length,st:S.moves.filter(m=>m.to==='Sale').length}});
 ok(local.tx===2&&local.st===2,'saved on the tablet first: 2 receipts, 2 stock moves');
 // stock shown on the tablet is not taken off twice (moves + open shift)
 await A.click('#grid .pc[data-id="pa"]');const note=await A.textContent('#sheet .note');await A.click('#sheet [data-a=x]').catch(()=>{});
 ok(note.includes('Stok di Toko A: 8'),'tablet stock after selling 2 of 10: 8 (not 6): '+note.replace(/\s+/g,' ').slice(0,80));
 await until(async()=>{const o=await dump();return rows(o,'POS Kasir').length===2&&rows(o,'POS Stok').filter(r=>r.ke==='Sale').length===2},10000,'sent while the shift is open');
 const o1=await dump();
 ok(rows(o1,'POS Kasir').length===2&&!rows(o1,'POS Shift').length,'receipts are on the Sheet while the shift is still open');
 ok(rows(o1,'POS Stok').filter(r=>r.ke==='Sale').map(r=>r.pid+':'+r.qty).sort().join()==='pa:2,pb:1','each sale\'s stock moves are on the Sheet right away');
 // dashboard sees the stock right away
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>((posStock().pa||{})['Toko A'])===8),10000,'dash stock');
 ok(true,'dashboard: Gamis Alpha in Toko A = 8 before the shift closes');
 // cancel the second receipt: receipt and its stock go out at once
 await nav(A,'rc');
 const tid=await A.evaluate(()=>window.__wismir.S.txs.find(t=>t.items[0].pid==='pb').id);
 await A.evaluate(id=>{const r=[...document.querySelectorAll('.row[data-a=viewTx]')].find(e=>e.dataset.id===id);r.click()},tid);
 await A.click('[data-a=rcVoid]');await A.click('[data-a=rcVoid]');
 await until(async()=>{const o=await dump();const k=rows(o,'POS Kasir').find(r=>r.id===tid),s=rows(o,'POS Stok').find(r=>r.pid==='pb'&&r.ke==='Sale');return k&&k.status==='VOID'&&s&&s.status==='void'},10000,'void sent');
 ok(true,'cancelled receipt and its stock move are updated on the Sheet right away');
 ok(await A.evaluate(()=>{const S=window.__wismir.S;let n=0;S.moves.forEach(m=>{if(m.status==='void'||m.pid!=='pb')return;if(m.to==='Toko A')n+=m.qty;if(m.from==='Toko A')n-=m.qty});return n})===10,'Tunik Beta back to 10 after the cancel');
 // close the shift: summary + attendance, no second stock move
 await nav(A,'home');await A.click('[data-a=closeSheet]');await A.click('[data-a=doClose]');
 await until(async()=>{const o=await dump();return rows(o,'POS Shift').length===1&&rows(o,'POS Absen').length===1},10000,'close');
 const o2=await dump();
 ok(rows(o2,'POS Stok').filter(r=>r.ke==='Sale').length===2,'closing the shift adds no extra sale moves');
 ok(+rows(o2,'POS Shift')[0].totalPenjualan===200000,'shift summary total 200.000 (cancelled receipt left out)');
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>((posStock().pa||{})['Toko A'])===8&&((posStock().pb||{})['Toko A'])===10),10000,'dash final');
 ok(true,'dashboard after close: Gamis Alpha 8, Tunik Beta 10');
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

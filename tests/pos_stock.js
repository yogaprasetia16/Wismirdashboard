// POS stock history: no sales listed (dashboard keeps them), owner can edit a move's product and quantity,
// editing an opname recomputes the difference, edits reach the Sheet and the dashboard.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
const nav=async(pg,t)=>{await pg.click('#menuBtn');await pg.click('#menu [data-t='+t+']');await pg.waitForTimeout(200)};
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const errs=[];
 // dashboard: one store, two products, one staff
 const D=await (await br.newContext({viewport:{width:1280,height:850}})).newPage();D.on('pageerror',e=>errs.push('dash: '+e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 for(const n of ['Gamis A','Hijab B'])await D.evaluate(n=>{tab='ops';ops='stock';addProduct();document.querySelector('#sheet [data-k=nama]').value=n;document.querySelector('#ok').click()},n);
 await D.evaluate(()=>{addStaff();document.querySelector('#sheet [data-k=name]').value='Rina';document.querySelector('#ok').click()});
 await D.evaluate(()=>{addStore();document.querySelector('#sheet [data-k=name]').value='Toko A';document.querySelector('#ok').click()});
 await until(async()=>{const o=await dump();return o.Stok&&o.Stok.v.length===3&&o.Store&&o.Store.v.length===2},10000,'dash push');
 // tablet
 const A=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();A.on('pageerror',e=>errs.push('pos: '+e.message));
 await A.goto(B+'/pos.html');await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.click('[data-a=osub][data-s=data]');
 await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.products.length===2&&window.__wismir.S.cfg.store==='Toko A'),10000,'tablet lists');
 const ids=await A.evaluate(()=>Object.fromEntries(window.__wismir.S.products.map(p=>[p.name,p.id])));
 const stock=(pid)=>A.evaluate(id=>{const S=window.__wismir.S;let n=0;S.moves.forEach(m=>{if(m.status==='void'||m.pid!==id)return;if(m.to==='Toko A')n+=m.qty;if(m.from==='Toko A')n-=m.qty});return n},pid);
 await A.click('[data-a=ownerOff]');
 // stock in 10 Gamis A, sell 2, close shift
 await nav(A,'stock');await A.click('[data-a=mvStart][data-m=in]');await A.selectOption('#mvP',ids['Gamis A']);await A.fill('#mvQ','10');await A.click('[data-a=mvNext]');
 await nav(A,'home');await A.click('[data-a=tgStaff]');await A.fill('#cashStart','0');await A.click('[data-a=openShift]');
 await A.click('.pc[data-id="'+ids['Gamis A']+'"]');await A.fill('#pp','100000');await A.fill('#pq','2');await A.click('[data-a=addLine]');await A.click('[data-a=pay]');await A.click('[data-a=setMethod][data-m=Tunai]');await A.click('#sheet [data-a=x]');
 await nav(A,'home');await A.click('[data-a=closeSheet]');await A.click('[data-a=doClose]');
 await until(async()=>(await dump())['POS Stok'].v.length===3,10000,'moves synced');
 await nav(A,'stock');
 const hist=await A.textContent('#app');
 ok(hist.includes('Masuk')&&!hist.includes('Penjualan'),'POS stock history shows the stock-in but not the sale');
 ok(await stock(ids['Gamis A'])===8,'stock still counts the sale (10 in − 2 sold = 8)');
 // staff (no owner mode) can edit; quantity 10 -> 7
 await A.click('[data-a=mvEdit]');ok(await A.isVisible('#emQ'),'staff can open the edit sheet without owner mode');await A.fill('#emQ','7');await A.click('[data-a=mvEditSave]');
 ok(await stock(ids['Gamis A'])===5,'quantity edited: 7 in − 2 sold = 5');
 // owner edits product: the stock-in was really Hijab B
 await A.click('[data-a=mvEdit]');await A.selectOption('#emP',ids['Hijab B']);await A.click('[data-a=mvEditSave]');
 ok(await stock(ids['Hijab B'])===7&&await stock(ids['Gamis A'])===-2,'product edited: Hijab B gets the 7, Gamis A only has the sale');
 // opname on Hijab B: count 5 (system 7) -> -2; then the count was really 9 -> +2
 await A.click('[data-a=mvStart][data-m=opname]');await A.selectOption('#mvP',ids['Hijab B']);await A.fill('#mvQ','5');await A.click('[data-a=mvNext]');
 ok(await stock(ids['Hijab B'])===5,'opname: counted 5');
 ok(!(await A.$('[data-a=mvEdit]'))||!(await A.textContent('.card')).includes('Opname'),'default filter "Masuk & keluar" hides the opname');
 await A.click('[data-a=hflt][data-f=all]');await A.click('[data-a=mvEdit] >> nth=0');
 ok((await A.textContent('#emHint')).includes('7'),'opname edit shows system stock without this record (7)');
 await A.fill('#emQ','9');await A.click('[data-a=mvEditSave]');
 ok(await stock(ids['Hijab B'])===9,'opname edited to a count of 9: stock is 9');
 // stock out of more than there is: no owner PIN, only a warning
 await A.click('[data-a=mvStart][data-m=out]');await A.selectOption('#mvP',ids['Hijab B']);await A.fill('#mvQ','12');
 ok(!(await A.$('#mvPin'))&&(await A.textContent('#sheet')).includes('akan menjadi -3'),'stock out below zero: no PIN asked, warning "akan menjadi -3" shown in the form');
 await A.click('[data-a=mvNext]');ok(await stock(ids['Hijab B'])===-3,'saved: stock is -3');
 // edits reach the Sheet and the dashboard history
 await until(async()=>{const r=(await dump())['POS Stok'].v;const h=r[0];return r.slice(1).some(x=>x[h.indexOf('catatan')].includes('diubah')&&x[h.indexOf('produk')]==='Hijab B'&&x[h.indexOf('qty')]===7)},10000,'edit synced');
 ok(true,'edited move is updated in the POS Stok sheet (same row, marked "diubah")');
 // load again until the dashboard sees the edit (a load can be skipped while the dashboard is still sending its own changes)
 await until(async()=>{await D.evaluate(()=>pullSheets());return D.evaluate(()=>(S.pos.stok||[]).length>=3&&S.pos.stok.some(x=>String(x.catatan).includes('diubah')))},15000,'dash pulls').catch(async e=>{console.log('ERR DIAG',await D.evaluate(()=>JSON.stringify({status,dirty:S.cfg.dirty,n:(S.pos.stok||[]).length,c:(S.pos.stok||[]).map(x=>x.catatan)})));throw e});
 await D.evaluate(()=>{tab='ops';ops='stock';stv='hist';HF.per='all';render()});
 const dh=await D.textContent('#hlist');ok(dh.includes('Sale')&&dh.includes('diubah'),'dashboard history still shows the sale and the edit note');
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

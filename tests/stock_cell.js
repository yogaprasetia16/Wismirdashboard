// Operational › Stock › Products (owner 2026-11-13): tap a stock number to type the counted stock of that product at that
// location (opname of today, written to POS Stok); a second count the same day replaces the first; the tablet gets it.
// POS Stok › Riwayat filter: "Masuk & keluar" (default) / "Semua transaksi". Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=12000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const nav=async(pg,t)=>{await pg.click('#menuBtn');await pg.click('#menu [data-t='+t+']');await pg.waitForTimeout(200)};
(async()=>{const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',min:3,aktif:'Active'});S.stores.push({id:'s1',name:'Gudang',type:'Warehouse'},{id:'s2',name:'Toko A',type:'Physical store'});save()});
 await sleep(2500);
 const Y=await D.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);return ymd(d)});
 const mv=(id,dari,ke,qty,jenis)=>({id,tanggal:Y,jam:'10:00',produk:'Gamis Alpha',dari,ke,qty,oleh:'Toko A',catatan:'',status:'ok',jenis:jenis||'manual',ref:'',pid:'pa',t:String(Date.now()-864e5)});
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[mv('m1','Supplier','Toko A',10),mv('m2','Toko A','Gudang',2),mv('m3','Toko A','Sale',1,'sale'),mv('m4','Toko A','Supplier',1)]}})});
 await D.evaluate(()=>pullSheets());await D.evaluate(()=>{tab='ops';ops='stock';stv='list';render()});
 const cell=()=>D.$('tr[data-pid="pa"] td.cc >> nth=1');
 ok((await (await cell()).textContent()).trim()==='6','Toko A shows 6 (10 in − 2 transfer − 1 sold − 1 out)');
 await (await cell()).click();
 ok(await D.isVisible('#ccv')&&!(await D.isVisible('#sheet [data-k=nama]')),'tapping the number opens the stock count, not the product form');
 await D.fill('#ccv','4');await D.click('#ccgo');
 await until(async()=>(await D.evaluate(()=>(posStock().pa||{})['Toko A']))===4,12000,'count saved');
 ok(true,'counted 4: Toko A = 4');
 ok(await D.evaluate(()=>S.pos.stok.filter(m=>String(m.id).startsWith('op-')).length===1&&(posStock().pa||{}).Gudang===2),'one opname row; Gudang unchanged (2)');
 await D.evaluate(()=>{tab='ops';ops='stock';stv='list';render()});await (await cell()).click();await D.fill('#ccv','9');await D.click('#ccgo');
 await until(async()=>(await D.evaluate(()=>(posStock().pa||{})['Toko A']))===9,12000,'recount');
 ok(await D.evaluate(()=>S.pos.stok.filter(m=>String(m.id).startsWith('op-')).length===1),'second count today replaces the first: Toko A = 9, still one opname row');
 // tablet: Riwayat filter
 const A=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();A.on('pageerror',e=>errs.push('pos: '+e.message));
 await A.goto(B+'/pos.html');await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.click('[data-a=osub][data-s=data]');
 await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.moves.length===5),12000,'tablet');
 await A.click('[data-a=ownerOff]').catch(()=>{});
 ok(await A.evaluate(()=>{const S=window.__wismir.S;let n=0;S.moves.forEach(m=>{if(m.status==='void'||m.pid!=='pa')return;if(m.to==='Toko A')n+=m.qty;if(m.from==='Toko A')n-=m.qty});return n})===9,'tablet: Gamis Alpha in Toko A = 9');
 await nav(A,'stock');
 const kinds=async()=>A.$$eval('.ktag',e=>e.map(x=>x.textContent).sort().join());
 ok(await A.isVisible('[data-a=hflt][data-f=io].on'),'Riwayat filter: "Masuk & keluar" is the default');
 ok(await kinds()==='Keluar,Masuk','default shows only stock in and out: '+await kinds());
 await A.click('[data-a=hflt][data-f=all]');
 ok(await kinds()==='Keluar,Masuk,Opname,Penjualan,Transfer','"Semua transaksi" shows every move incl. sales and opname: '+await kinds());
 await A.click('[data-a=hflt][data-f=io]');await A.waitForTimeout(1500);await A.screenshot({path:'riwayat-filter.png'});
 await D.evaluate(()=>{tab='ops';ops='stock';stv='list';render()});await (await cell()).click();await D.waitForTimeout(400);await D.screenshot({path:'stock-cell.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

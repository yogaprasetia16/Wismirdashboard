// Operational > Stock > Import stock count: an opname for every product × location in the pasted list as of a count date;
// stock moves already entered on the tablets stay, only the difference is recorded; re-import replaces; the tablet gets the
// result; moves after the count date still count. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=12000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
(async()=>{const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',min:3},{id:'pb',nama:'Tunik Beta',sku:'BB02',min:3});
  S.stores.push({id:'s1',name:'Gudang',type:'Warehouse'},{id:'s2',name:'Toko C6',type:'Physical store'});save()});
 await until(async()=>{const o=await dump();return o.Store&&o.Store.v.length===3},10000,'stores');
 // stock already entered on the tablet yesterday: 10 Gamis Alpha into Toko C6, and a sale of 2
 const Y=await D.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-1);return ymd(d)}),T=await D.evaluate(()=>today());
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[
  {id:'m1',tanggal:Y,jam:'10:00',produk:'Gamis Alpha',dari:'Supplier',ke:'Toko C6',qty:10,oleh:'Toko C6',catatan:'',status:'ok',jenis:'',ref:'',pid:'pa',t:'1'},
  {id:'m2',tanggal:Y,jam:'15:00',produk:'Gamis Alpha',dari:'Toko C6',ke:'Sale',qty:2,oleh:'Sistem',catatan:'',status:'ok',jenis:'sale',ref:'',pid:'pa',t:'2'}]}})});
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>(S.pos.stok||[]).length===2),10000,'pull');
 const stock=(pid,l)=>D.evaluate(([pid,l])=>(posStock()[pid]||{})[l]||0,[pid,l]);
 ok(await stock('pa','Toko C6')===8,'before: Gamis Alpha in Toko C6 = 8 (10 in − 2 sold)');
 await D.evaluate(()=>{tab='ops';ops='stock';stv='list';render()});
 await D.click('text=Import stock count');
 await D.fill('#sctext',['SKU\tProduk\tGudang\tToko C6\tToko Lama','aa01\tGamis Alpha\t120\t35\t4','BB02\tTunik Beta\t50\t\t','zz99\tX\t1\t1\t'].join('\n'));
 const pv=txt(await D.textContent('#scprev'));
 ok(pv.includes('Tunik Beta · Gudang: 0 → 50'),'system stock is counted per product (Gamis Alpha in the same warehouse does not count for Tunik Beta)');
 ok(pv.includes('2 products × 2 locations')&&pv.includes('Gamis Alpha · Toko C6: 8 → 35 (+27)')&&pv.includes('zz99')&&pv.includes('Toko Lama'),'preview: system → counted per product and location, unknown SKU and location named: '+pv);
 await D.click('#scgo');
 await until(()=>D.evaluate(()=>(S.pos.stok||[]).length===5),12000,'saved');
 ok(await stock('pa','Toko C6')===35&&await stock('pa','Gudang')===120&&await stock('pb','Gudang')===50,'after: stock equals the count (35, 120, 50)');
 ok(await D.evaluate(()=>S.pos.stok.filter(m=>String(m.id).startsWith('op-')).every(m=>m.dari==='Koreksi opname'||m.ke==='Koreksi opname')),'recorded as stock-count moves');
 ok(await D.evaluate(()=>S.pos.stok.some(m=>m.id==='m1')&&S.pos.stok.some(m=>m.id==='m2')),'the tablet\'s earlier moves stay');
 // a move after the count still counts
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[{id:'m3',tanggal:'2099-01-01',jam:'10:00',produk:'Gamis Alpha',dari:'Toko C6',ke:'Sale',qty:3,oleh:'Sistem',catatan:'',status:'ok',jenis:'sale',ref:'',pid:'pa',t:'3'}]}})});
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>(S.pos.stok||[]).length===6),10000,'pull2');
 ok(await stock('pa','Toko C6')===32,'a sale after the count date still takes stock off (35 − 3 = 32)');
 // re-import with a corrected count replaces the earlier count (no doubling); an unchanged count voids nothing new
 await D.click('text=Import stock count');await D.fill('#sctext',['SKU\tGudang\tToko C6','aa01\t120\t30'].join('\n'));
 ok(txt(await D.textContent('#scprev')).includes('Toko C6: 8 → 30'),'re-import measures against the stock without the earlier count of that date');
 await D.click('#scgo');await until(async()=>(await stock('pa','Toko C6'))===27,12000,'recount');
 ok(await D.evaluate(()=>S.pos.stok.filter(m=>String(m.id).startsWith('op-')).length===3),'still one count move per product × location (replaced, not added)');
 // the tablet sees the counted stock
 const A=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();A.on('pageerror',e=>errs.push('pos: '+e.message));
 await A.goto(B+'/pos.html');await A.click('#menuBtn');await A.click('#menu [data-t=owner]');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.click('[data-a=osub][data-s=data]');
 await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.moves.length===6),12000,'tablet');
 const ts=await A.evaluate(()=>{const S=window.__wismir.S;let n=0;S.moves.forEach(m=>{if(m.status==='void'||m.pid!=='pa')return;if(m.to==='Toko C6')n+=m.qty;if(m.from==='Toko C6')n-=m.qty});return n});
 ok(ts===27,'tablet: Gamis Alpha in Toko C6 = 27');
 // stale dashboard: tablet moves reach the Sheet but the dashboard has not reloaded yet -> the import loads them first,
 // so the stock still ends up exactly at the count (owner 2026-11-13: "transaksi stok kemarin dihiraukan")
 const post=r=>fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[r]}})});
 await post({id:'m4',tanggal:T,jam:'11:00',produk:'Tunik Beta',dari:'Supplier',ke:'Gudang',qty:7,oleh:'Gudang',catatan:'',status:'ok',jenis:'',ref:'',pid:'pb',t:'4'});
 ok(await stock('pb','Gudang')===50,'dashboard has not seen the new tablet move yet (50)');
 await D.click('text=Import stock count');await D.fill('#sctext',['SKU\tGudang','BB02\t50'].join('\n'));
 await until(async()=>txt(await D.textContent('#scload')).includes('loaded'),10000,'load on open');
 ok(txt(await D.textContent('#scprev')).includes('Tunik Beta · Gudang: 7 → 50'),'opening the import loads the newest tablet moves first: '+txt(await D.textContent('#scprev')));
 await post({id:'m5',tanggal:T,jam:'12:00',produk:'Tunik Beta',dari:'Supplier',ke:'Gudang',qty:3,oleh:'Gudang',catatan:'',status:'ok',jenis:'',ref:'',pid:'pb',t:'5'});
 await D.click('#scgo');await until(()=>D.evaluate(()=>S.pos.stok.some(m=>m.id==='m5')&&!document.querySelector('#bg.open')),12000,'stale save');
 await until(async()=>(await stock('pb','Gudang'))===50,8000,'stale stock');
 ok(await stock('pb','Gudang')===50,'a move arriving while the import is open is loaded again before saving: Gudang = 50 as counted');
 ok(txt(await D.evaluate(()=>status)).includes('equals your count'),'status confirms the stock equals the count');
 await D.evaluate(()=>render());await D.screenshot({path:'stock-count.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

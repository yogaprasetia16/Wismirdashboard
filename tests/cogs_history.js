// COGS history (owner 2026-11-24, option 2): when a product's COGS changes, the new value counts from that day on and sales
// before it keep the old value, so the profit (and supplier recap) of past months does not change. Tab COGS (Code.gs v20).
// Sample data only.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const rows=(o,tab)=>{const t=o[tab];if(!t||!t.v.length)return[];const h=t.v[0];return t.v.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))};
(async()=>{
 const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1366,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',kategori:'Gamis',brand:'WISMIR',cogs:60000,min:3,aktif:'Active'});S.stores.push({id:'s1',name:'Toko A',type:'Physical store'});save()});
 await until(async()=>{const o=await dump();return o.Stok&&o.Stok.v.length===2},10000,'master');
 const T=await D.evaluate(()=>today());
 // October: 10 sold, 5 in from the supplier; today: 1 sold
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[
  {id:'in1',tanggal:'2026-10-05',jam:'09:00',produk:'Gamis Alpha',dari:'Supplier',ke:'Toko A',qty:5,status:'ok',pid:'pa'},
  {id:'S-old-pa',tanggal:'2026-10-10',jam:'17:00',produk:'Gamis Alpha',dari:'Toko A',ke:'Sale',qty:10,status:'ok',jenis:'sale',ref:'old',pid:'pa'},
  {id:'S-new-pa',tanggal:T,jam:'17:00',produk:'Gamis Alpha',dari:'Toko A',ke:'Sale',qty:1,status:'ok',jenis:'sale',ref:'new',pid:'pa'}]}})});
 await D.evaluate(()=>pullSheets());
 const cost=()=>D.evaluate(T=>{const r=finRows().filter(x=>x.key==='pa');return {oct:r.filter(x=>x.m==='2026-10').reduce((a,x)=>a+x.cost,0),now:r.filter(x=>x.m===T.slice(0,7)).reduce((a,x)=>a+x.cost,0),sup:(suppMonths().find(m=>m.m==='2026-10')||{}).total}},T);
 const before=await cost();
 ok(before.oct===600000&&before.now===60000,'before: October cost 10 × 60.000, today 1 × 60.000: '+JSON.stringify(before));
 // change COGS in the product form (twice the same day: the last value counts)
 for(const v of ['65000','70000']){await D.evaluate(()=>{tab='ops';ops='stock';render();editProduct('pa')});await D.fill('#sheet [data-k=cogs]',v);await D.click('#sheet #ok');await D.waitForTimeout(200)}
 const h=await D.evaluate(()=>S.cogsh.map(x=>x.dari+':'+x.cogs).sort());
 ok(h.length===2&&h.includes(':60000')&&h.includes(T+':70000'),'history: the old value from the start + one entry for today (the last change of the day): '+h);
 const after=await cost();
 ok(after.oct===600000,'October cost stays 600.000 (old COGS) after the change: '+after.oct);
 ok(before.sup===300000&&after.sup===300000,'Supplier recap for October stays 5 × 60.000 = 300.000: '+before.sup+' / '+after.sup);
 ok(after.now===70000,'a sale from today on uses the new COGS: '+after.now);
 ok(+(await D.evaluate(()=>S.products.find(p=>p.id==='pa').cogs))===70000,'the product shows the new COGS');
 await until(async()=>rows(await dump(),'COGS').length===2,10000,'COGS tab');
 ok(rows(await dump(),'COGS').some(r=>r.dari===T&&+r.cogs===70000),'the history is saved in the Sheet tab COGS');
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

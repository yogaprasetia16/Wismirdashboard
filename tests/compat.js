// A new dashboard against an OLD Code.gs (one that does not know a new column yet), then Code.gs gets updated.
// Nothing typed in the meantime may be lost, and the owner is told to update Code.gs.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const p=await (await br.newContext({viewport:{width:1280,height:850}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 // behave like an old Code.gs: no version, no 'brand' column in reads, drops 'brand' on writes
 const OLD=async route=>{const req=route.request();
  if(req.method()==='POST'){const b=JSON.parse(req.postData()||'{}');if(b.data&&b.data.Stok)b.data.Stok=b.data.Stok.map(r=>{const x={...r};delete x.brand;return x});return route.continue({postData:JSON.stringify(b)})}
  const res=await route.fetch();const j=await res.json();delete j.v;if(j.data&&j.data.Stok)j.data.Stok.forEach(r=>delete r.brand);return route.fulfill({response:res,body:JSON.stringify(j)})};
 await p.route('**/exec**',OLD);
 await p.goto(B+'/dashboard.html');
 await p.evaluate(()=>{tab='set';render()});await p.fill('#cu',URL_);await p.fill('#cp','9999');await p.evaluate(()=>saveCfg());
 await until(()=>p.evaluate(()=>S.cfg.pulled===1),10000,'first load');
 ok((await p.textContent('#app')).includes('Update Code.gs'),'old Code.gs: the dashboard asks the owner to update it');
 await p.evaluate(()=>{tab='ops';ops='stock';stv='list';addProduct();const q=k=>document.querySelector('#sheet [data-k='+k+']');q('nama').value='Gamis Test';q('kategori').value='Gamis';q('brand').value='Karmila';document.querySelector('#ok').click()});
 await until(async()=>((await dump()).Stok||{v:[]}).v.some(r=>r[1]==='Gamis Test'),10000,'saved');
 ok(!(await dump()).Stok.v.find(r=>r[1]==='Gamis Test')[11],'old Code.gs dropped the brand in the Sheet (as an old script would)');
 await p.evaluate(()=>pullSheets());await sleep(1500);
 ok(await p.evaluate(()=>S.products.find(x=>x.nama==='Gamis Test').brand==='Karmila'),'reloading from the old Code.gs does NOT wipe the brand on this device');
 // owner updates Code.gs
 await p.unroute('**/exec**');
 await p.click('#sync');
 await until(async()=>(await dump()).Stok.v.find(r=>r[1]==='Gamis Test')[11]==='Karmila',10000,'brand reaches the sheet');
 ok(true,'after Code.gs is updated, the brand typed earlier reaches the Sheet');
 await sleep(800);await p.evaluate(()=>render());
 ok(!(await p.textContent('#app')).includes('Update Code.gs')&&await p.evaluate(()=>S.products.find(x=>x.nama==='Gamis Test').brand==='Karmila'),'notice gone, brand still there');
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

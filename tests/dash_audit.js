// Dashboard › Operational › Audit (owner 2026-11-27): read-only recap of the tablets' POS › Audit. Code.gs v22 sends the
// Sheet tab 'POS Audit' with the dashboard load; products and photos come from the wismir.id catalog (sample here).
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const CAT={v:1,items:[{nama:'Gamis Contoh',kategori:'Gamis',ukuran:'S, M, L',foto:'a1.jpg|a2.jpg|a3.jpg'},{nama:'Blus Contoh',kategori:'Atasan',ukuran:'All size',foto:'b1.jpg|b2.jpg'}]};
const PIX='<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40"><rect width="30" height="40" fill="#c9a"/></svg>';
(async()=>{
 const br=await chromium.launch();const errs=[];
 for(const [n,vp] of [['laptop',{width:1366,height:900}],['phone',{width:360,height:780}]]){
  const ctx=await br.newContext({viewport:vp});
  await ctx.route('https://wismir.id/**',r=>r.request().url().endsWith('katalog.json')?r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(CAT)}):r.fulfill({status:200,contentType:'image/svg+xml',body:PIX}));
  const D=await ctx.newPage();D.on('pageerror',e=>errs.push(n+': '+e.message));
  await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
  await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
  if(n==='laptop'){
   await D.evaluate(()=>{S.stores.push({id:'s1',name:'WISMIR Toko A',type:'Physical store'},{id:'s2',name:'WISMIR Toko B',type:'Physical store'},{id:'s3',name:'Gudang',type:'Warehouse'});save()});
   await until(async()=>{const o=await dump();return o.Store&&o.Store.v.length===4},10000,'stores');
   const t=Date.now(),row=(st,f,z,h)=>({id:st+'|'+f,toko:st,produk:'',foto:f,status:JSON.stringify(z),oleh:'Owner',waktu:'',t:String(t-h*3600000)});
   await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Audit':[row('WISMIR Toko A','a2.jpg',{M:'out'},1),row('WISMIR Toko B','a2.jpg',{S:'low'},3),row('WISMIR Toko B','b1.jpg',{all:'out'},2),row('WISMIR Toko A','a1.jpg',{S:'ok'},5)]}})});
  }
  await D.evaluate(()=>pullSheets());
  ok(await D.evaluate(()=>P('audit').length===4),n+': the dashboard load brings the Sheet tab POS Audit (Code.gs v22)');
  await D.evaluate(()=>{tab='ops';ops='audit';render()});await D.waitForSelector('.audc',{timeout:10000});
  ok((await D.textContent('#app h1')).includes('Audit'),n+': title "Audit" beside Operational');
  const k=await D.$$eval('.audk .card b',e=>e.map(x=>x.textContent));
  ok(k[0]==='2'&&k[1]==='2'&&k[2]==='0','All stores: 2 variations need restock, both Out (Toko A M out / Toko B Blus out): '+k);
  ok((await D.$$('.audc')).length===2&&(await D.textContent('.audg')).includes('Gamis Contoh'),'one card per variation that needs restock, grouped per product');
  const lu=await D.$$eval('.audlu .audlr',e=>e.map(x=>x.textContent));
  ok(lu.length===2&&lu[0].startsWith('Toko A')&&lu[1].startsWith('Toko B'),'Last updated: every store (short names) in All stores: '+lu);
  ok(await D.$eval('.audc .audt',e=>e.querySelectorAll('th').length===3&&!!e.querySelector('.aus.out')&&!!e.querySelector('.aus.low')),'card: size × store table with Out (A) and Low (B)');
  await D.selectOption('#audSt','WISMIR Toko B');
  const k2=await D.$$eval('.audk .card b',e=>e.map(x=>x.textContent));
  ok(k2[0]==='2'&&k2[1]==='1'&&k2[2]==='1'&&(await D.$$('.audlu .audlr')).length===0&&(await D.textContent('.audlu')).includes(':'),'one store chosen (dropdown at the right of the tabs): Toko B counts + its own last update: '+k2);
  await D.click('.audc');await D.waitForSelector('#sheet .audbig');
  ok((await D.textContent('#sheet')).includes('view only')&&(await D.$$('#sheet .row')).length===2,'tap a card: big photo + every store, view only');
  ok(await D.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),n+': fits the screen');
  await D.screenshot({path:'dash-audit-'+n+'.png'});
  await ctx.close();
 }
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

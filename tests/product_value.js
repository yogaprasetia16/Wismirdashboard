// Owner 2026-11-23: Finance › Report showed "?" / Uncategorized for the running month (POS months had pieces per product but
// no rupiah per product). The POS shift sale rows now carry 'nilai' (Code.gs v18, column after _upd), the dashboard ranks
// products and categories by it, and old shift rows get their value once from the tablet's own receipts. Sample data only.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const nav=async(pg,t)=>{await pg.click('#menuBtn');await pg.click('#menu [data-t='+t+']');await pg.waitForTimeout(200)};
const rows=(o,tab)=>{const t=o[tab];if(!t||!t.v.length)return[];const h=t.v[0];return t.v.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))};
(async()=>{
 const br=await chromium.launch();const errs=[];
 // the Sheet already has a POS Stok row: _upd must stay in its column when the new column is added
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[{id:'old1',tanggal:'2026-10-01',jam:'09:00',produk:'X',dari:'Supplier',ke:'Toko A',qty:4,status:'ok',pid:'pa'}]}})});
 const D=await (await br.newContext({viewport:{width:1366,height:900}})).newPage();D.on('pageerror',e=>errs.push('dash: '+e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',kategori:'Gamis',min:3,aktif:'Active'},{id:'pb',nama:'Kulot Beta',sku:'BB02',kategori:'Bawahan',min:3,aktif:'Active'},{id:'pc',nama:'Blus Gama',sku:'CC03',kategori:'Atasan',min:3,aktif:'Active'});
  S.stores.push({id:'s1',name:'Toko A',type:'Physical store'});S.staff.push({id:'k1',name:'Rina',status:'Active'});save()});
 await until(async()=>{const o=await dump();return o.Stok&&o.Stok.v.length===4},10000,'master');
 const A=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();A.on('pageerror',e=>errs.push('pos: '+e.message));
 await A.goto(B+'/pos.html');await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.click('[data-a=osub][data-s=data]');
 await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.products.length===3),10000,'tablet');await A.click('[data-a=ownerOff]').catch(()=>{});
 await nav(A,'home');await A.click('[data-a=tgStaff]');await A.fill('#cashStart','0');await A.click('[data-a=openShift]');await A.waitForTimeout(300);
 const sell=async(pid,price,qty)=>{await A.click('#grid .pc[data-id="'+pid+'"]');await A.fill('#pp',price);await A.fill('#pq',qty);await A.click('[data-a=addLine]');await A.click('[data-a=pay]');await A.click('[data-a=setMethod][data-m=Transfer]');await A.click('#sheet [data-a=x]');await A.waitForTimeout(200)};
 await sell('pa','200000','2');await sell('pb','100000','1');await sell('pa','150000','1');await sell('pc','90000','1');
 await until(()=>A.evaluate(()=>window.__wismir.S.outbox.length===0),15000,'sent');
 const st=rows(await dump(),'POS Stok');const sh=st.filter(r=>String(r.id).startsWith('S-'));
 const va=sh.find(r=>r.pid==='pa'),vb=sh.find(r=>r.pid==='pb');
 ok(va&&+va.qty===3&&+va.nilai===550000&&vb&&+vb.nilai===100000,'shift sale rows carry the rupiah value: Gamis 3 pcs Rp 550.000, Kulot Rp 100.000');
 const o=st.find(r=>r.id==='old1');ok(o&&+o._upd>1e12&&(o.nilai===''||o.nilai==null),'an older row keeps its _upd (the new column comes after _upd)');
 await D.evaluate(()=>pullSheets());
 const pr=await D.evaluate(()=>{const m=today().slice(0,7);const g={};finRows().filter(r=>r.m===m).forEach(r=>{const k=r.name||'?';g[k]=(g[k]||0)+r.v});return g});
 ok(pr['Gamis Alpha']===550000&&pr['Kulot Beta']===100000&&pr['Blus Gama']===90000&&!pr['?'],'Report: running month revenue per product, no "?" row: '+JSON.stringify(pr));
 await D.evaluate(()=>{tab='tx';fv='report';FM='';render()});await D.waitForTimeout(1300);
 const leg=await D.$$eval('#rCat .rleg>div',e=>e.map(x=>[x.querySelector('b').textContent,getComputedStyle(x.querySelector('i')).backgroundColor]));
 ok(leg.length===3&&leg[0][0]==='Gamis'&&new Set(leg.map(x=>x[1])).size===3,'Category: each category its own colour: '+JSON.stringify(leg));
 ok((await D.$$('#rCat svg circle[stroke-dasharray]')).length===3,'donut has one segment per category');
 await D.screenshot({path:'product-value.png',clip:{x:0,y:250,width:1366,height:560}});
 // an old shift row without 'nilai' gets its value from the tablet's own receipts once (only when the quantities match)
 await A.evaluate(()=>{const S=window.__wismir.S;const m=S.moves.find(x=>x.pid==='pb'&&String(x.id).startsWith('S-'));m.val=undefined;const n=S.moves.find(x=>x.pid==='pc'&&String(x.id).startsWith('S-'));n.val=undefined;n.qty=5});
 const n=await A.evaluate(()=>window.__wismir.fill());
 ok(n===1&&await A.evaluate(()=>{const S=window.__wismir.S;return S.moves.find(x=>x.pid==='pb'&&String(x.id).startsWith('S-')).val===100000&&S.moves.find(x=>x.pid==='pc'&&String(x.id).startsWith('S-')).val==null}),'fill: a row whose pieces match the receipts gets its value; a row that does not match is left alone');
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

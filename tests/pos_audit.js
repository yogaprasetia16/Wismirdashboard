// POS › Audit (owner 2026-11-27): only in owner mode. Products + photos come from the wismir.id catalog (katalog.json);
// every photo is a variation with a status per store (Cukup / Kurang / Habis), per size when "ukuran" has a comma.
// Not connected to stock. Saved in the Sheet tab 'POS Audit' (Code.gs v21) and seen by the other tablets.
// Sample catalog only (the real catalog is never fetched here).
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const rows=(o,tab)=>{const t=o[tab];if(!t||!t.v.length)return[];const h=t.v[0];return t.v.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))};
const CAT={v:1,items:[{nama:'Gamis Contoh',kategori:'Gamis',ukuran:'S, M, L',foto:'a1.jpg|a2.jpg|a3.jpg'},{nama:'Blus Contoh',kategori:'Atasan',ukuran:'All size',foto:'b1.jpg|b2.jpg'},{nama:'Produk Tersembunyi',sembunyi:'ya'}]};
const PIX='<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40"><rect width="30" height="40" fill="#c9a"/></svg>';
async function tablet(br,vp,store){
 const ctx=await br.newContext({viewport:vp});
 await ctx.route('https://wismir.id/**',r=>{const u=r.request().url();if(u.endsWith('katalog.json'))return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(CAT)});return r.fulfill({status:200,contentType:'image/svg+xml',body:PIX})});
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(store+': '+e.message));
 await p.goto(B+'/pos.html');
 await p.click('#menuBtn');await p.click('#menu [data-t=owner]');await p.fill('#gpin','1234');await p.click('[data-a=gateOk]');await p.click('[data-a=osub][data-s=data]');
 await p.fill('#gsu',URL_);await p.fill('#gsp','9999');await p.click('[data-a=gsSave]');
 await until(()=>p.evaluate(()=>!!(window.__wismir.S.locs&&window.__wismir.S.locs.stores.length===2)),10000,'stores '+store);
 return p;
}
const menu=async p=>{await p.click('#menuBtn');const t=await p.$$eval('#menu [data-t]',e=>e.map(x=>x.dataset.t));await p.keyboard.press('Escape');await p.waitForTimeout(150);return t};
const errs=[];
(async()=>{
 const br=await chromium.launch();
 const D=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();D.on('pageerror',e=>errs.push('dash: '+e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{S.stores.push({id:'s1',name:'Toko A',type:'Physical store'},{id:'s2',name:'Toko B',type:'Physical store'},{id:'s3',name:'Gudang',type:'Warehouse'});save()});
 await until(async()=>{const o=await dump();return o.Store&&o.Store.v.length===4},10000,'stores');

 const A=await tablet(br,{width:1280,height:800},'Toko A');
 await A.click('[data-a=ownerOff]');await A.waitForTimeout(200);
 ok(!(await menu(A)).includes('audit'),'menu without owner mode: no Audit');
 await A.click('#menuBtn');await A.click('#menu [data-t=owner]');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.waitForTimeout(200);
 const m=await menu(A);ok(m.includes('audit')&&m.indexOf('audit')===m.indexOf('owner')-1,'owner mode on: Audit in the menu, before Owner: '+m.join(','));
 await A.click('#menuBtn');await A.click('#menu [data-t=audit]');
 await A.waitForSelector('.au-card',{timeout:10000});
 const cats=await A.$$eval('[data-a=auCat]',e=>e.map(x=>x.textContent+(x.classList.contains('on')?'*':'')));
 ok(cats.join()==='Gamis*,Atasan','categories from the catalog, the first one chosen, hidden product left out: '+cats);
 ok((await A.textContent('.au-card')).includes('3 variasi')&&await A.$('.au-card .au-bdg.chk'),'one card per product: 3 photos = 3 variations, all Cukup (check mark)');
 ok(await A.$eval('.au-card img',e=>e.getAttribute('src'))==='https://wismir.id/foto/t/a1.jpg','card picture = the website thumbnail of the first photo');
 // pop up: per-size status, move to the next photo with the arrow and by swiping
 await A.click('.au-card .au-pic');await A.waitForSelector('#aupop:not([hidden])');
 ok((await A.$$('#audlg .au-szr')).length===3,'pop up: one row per size (S, M, L)');
 await A.click('#audlg [data-z=M][data-s=out]');
 ok(await A.$eval('#audlg [data-z=M][data-s=out]',e=>e.classList.contains('on'))&&!(await A.$('#aupop[hidden]')),'size M set to Habis, the pop up stays open');
 await A.click('#audlg .au-nav.r');ok((await A.textContent('#audlg small')).includes('variasi 2 dari 3'),'arrow: next variation');
 const bb=await (await A.$('#aubig')).boundingBox();await A.mouse.move(bb.x+bb.width*.75,bb.y+bb.height/2);await A.mouse.down();await A.mouse.move(bb.x+bb.width*.2,bb.y+bb.height/2,{steps:5});await A.mouse.up();
 ok((await A.textContent('#audlg small')).includes('variasi 3 dari 3'),'swipe left: next variation');
 await A.click('#audlg .au-th:nth-child(1)');ok((await A.textContent('#audlg small')).includes('variasi 1 dari 3')&&await A.$eval('#audlg .au-th:nth-child(1)',e=>e.classList.contains('out')),'thumbnail: jump to variation 1 (red frame = needs restock)');
 await A.click('#audlg .au-done');ok(!!(await A.$('#aupop[hidden]')),'Selesai closes the pop up');
 ok((await A.textContent('.au-card .au-bdg')).trim()==='Restock 1','card: Restock 1');
 await A.click('[data-a=auF][data-f=rs]');
 ok((await A.$$('.au-rc')).length===1&&!(await A.$('[data-a=auCat]')),'Perlu restock: one card, no category filter');
 ok((await A.textContent('.au-rc')).includes('Toko B'),'Perlu restock: size M can come from Toko B (never audited there = Cukup)');
 await until(()=>A.evaluate(()=>window.__wismir.S.outbox.length===0),15000,'sent');
 let r=rows(await dump(),'POS Audit');
 ok(r.length===1&&r[0].id==='Toko A|a1.jpg'&&JSON.parse(r[0].status).M==='out'&&r[0].produk==='Gamis Contoh'&&r[0].toko==='Toko A','Sheet tab POS Audit: one row (Toko A, photo a1.jpg, M Habis)');

 // second tablet (Toko B) sees Toko A's status; an "All size" product has one status
 const P=await tablet(br,{width:360,height:780},'Toko B');
 await P.click('#menuBtn');await P.click('#menu [data-t=audit]');await P.waitForSelector('.au-card',{timeout:10000});
 await P.click('[data-a=auSt][data-s="Toko B"]');
 ok((await P.textContent('#app h2')).includes('Toko B'),'store picker: auditing Toko B');
 await until(()=>P.evaluate(()=>window.__wismir.S.audit.length===1),15000,'pulled');
 await P.click('.au-card .au-pic');await P.waitForSelector('#aupop:not([hidden])');
 ok((await P.textContent('#audlg .au-ol')).includes('Toko A')&&(await P.textContent('#audlg .au-ol .au-szc .out')).trim()==='M','Toko B pop up: Toko A has size M Habis');
 ok(await P.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone 360 px: fits the screen with the pop up open');
 await P.screenshot({path:'pos-audit-phone.png'});
 await P.click('#audlg .au-done');
 await P.click('[data-a=auCat][data-c=Atasan]');await P.click('.au-card .au-pic');
 ok((await P.$$('#audlg .au-szr')).length===0&&(await P.$$('#audlg .au-st button')).length===3,'All size: one status row');
 await P.click('#audlg [data-z=all][data-s=low]');await P.click('#audlg .au-done');
 ok((await P.textContent('.au-card .au-bdg')).includes('Restock 1'),'All size set to Kurang: Restock 1');
 await until(async()=>rows(await dump(),'POS Audit').length===2,15000,'second row');
 // Toko A sees it after a pull; owner mode off closes Audit
 await A.evaluate(()=>window.__wismir.S.since=0);await until(()=>A.evaluate(()=>window.__wismir.S.audit.length===2),70000,'A pulls');
 await A.click('[data-a=auF][data-f=all]');await A.waitForTimeout(700);await A.screenshot({path:'pos-audit.png'});await A.click('.au-card .au-pic');await A.waitForTimeout(700);await A.screenshot({path:'pos-audit-pop.png'});await A.click('#audlg .au-done');await A.click('[data-a=auF][data-f=rs]');await A.waitForTimeout(700);await A.screenshot({path:'pos-audit-restock.png'});
 await A.click('[data-a=ownerOff]');await A.waitForTimeout(200);
 ok(!(await menu(A)).includes('audit')&&!(await A.$('.au-card')),'owner mode off: Audit gone from the menu and the page');
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

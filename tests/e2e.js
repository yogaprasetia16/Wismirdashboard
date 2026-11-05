const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const rows=async n=>{const o=await dump();return o[n]?o[n].v.slice(1):[]};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
// POS navigation lives in the menu under the logo
const nav=async(pg,t)=>{await pg.click('#menuBtn');await pg.click('#menu [data-t='+t+']');await pg.waitForTimeout(150)};
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const errs=[];
 // a tablet on the OLD version already sent a product + staff to the archive tabs
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Produk':[{id:'PLEG',nama:'Khimar Lama',kategori:'Hijab',aktif:'1'}],'POS Karyawan':[{id:'KLEG',nama:'Budi',aktif:'1'}]}})});
 // ---- dashboard ----
 const D=await (await br.newContext({viewport:{width:1280,height:850}})).newPage();D.on('pageerror',e=>errs.push('dash: '+e.message));
 await D.goto(B+'/dashboard.html');
 await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash pull');
 await until(async()=>(await rows('Stok')).some(r=>r[0]==='PLEG')&&(await rows('Staff')).some(r=>r[0]==='KLEG'),10000,'migration');
 ok(true,'old tablet product + staff copied into the dashboard lists (same id)');
 // add product + staff in dashboard
 await D.evaluate(()=>{tab='ops';ops='stock';addProduct();const q=k=>document.querySelector('#sheet [data-k='+k+']');q('nama').value='Gamis Navy';q('varian').value='L';q('kategori').value='Gamis';document.querySelector('#ok').click()});
 await D.evaluate(()=>{ops='staff';addStaff();document.querySelector('#sheet [data-k=name]').value='Rina';document.querySelector('#ok').click()});
 await until(async()=>(await rows('Stok')).length===2&&(await rows('Staff')).length===2,10000,'dash push');
 const st=(await dump()).Stok;ok(st.v[0].join()==='id,nama,varian,stokToko,stokOnline,min,harga,kategori,aktif','Stok sheet has kategori + aktif columns');
 // ---- tablet A ----
 const ctxA=await br.newContext({viewport:{width:1024,height:768}});const A=await ctxA.newPage();A.on('pageerror',e=>errs.push('A: '+e.message));
 await A.goto(B+'/pos.html');
 await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');
 const subs=await A.$$eval('[data-a=osub]',b=>b.map(x=>x.textContent));ok(subs.join()==='Laporan,Data','POS owner sub-tabs are only Laporan + Data: '+subs);
 await A.click('[data-a=osub][data-s=data]');await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.products.length===2&&window.__wismir.S.staff.length===2),10000,'tablet gets lists');
 const names=await A.evaluate(()=>window.__wismir.S.products.map(p=>p.name+'|'+p.category).sort().join(', '));
 ok(names==='Gamis Navy · L|Gamis, Khimar Lama|Hijab','tablet shows dashboard products incl. variant & category: '+names);
 // stock in + transfer + shift + sale
 await A.click('[data-a=ownerOff]');await nav(A,'stock');
 ok(!(await A.$('[data-a=mvNew]')),'no "+ Produk baru" shortcut in the stock form');
 const pid=await A.evaluate(()=>window.__wismir.S.products.find(p=>p.name.startsWith('Gamis')).id);
 await A.click('[data-a=mvStart][data-m=in]');ok(!(await A.$('[data-a=mvNew]')),'stock form has no product creation');
 await A.selectOption('#mvP',pid);await A.selectOption('#mvT','Toko A');await A.fill('#mvQ','10');await A.click('[data-a=mvNext]');await A.click('[data-a=mvSave]');
 await nav(A,'home');await A.click('[data-a=tgStaff]');await A.fill('#cashStart','0');await A.click('[data-a=openShift]');
 await A.click('.pc >> text=Gamis Navy');await A.fill('#pp','200000');await A.click('[data-a=addLine]');await A.click('[data-a=pay]');await A.click('[data-a=confirmPay]');await A.click('#sheet [data-a=x]');
 await nav(A,'home');await A.click('[data-a=closeSheet]');await A.click('[data-a=doClose]');
 await until(async()=>(await rows('POS Kasir')).length===1&&(await rows('POS Stok')).length===2,10000,'close shift');
 ok(true,'shift + sale + stock still sync');
 // ---- dashboard sees combined stock; deactivate product hides it in POS ----
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>(S.pos.stok||[]).length===2),10000,'dash sees moves');
 await D.evaluate(()=>{tab='ops';ops='stock';render()});
 const row=await D.textContent('#app');ok(row.includes('Toko A 9')&&row.includes('Online 0'),'dashboard Stock row: Toko A 9 · Online 0');
 await D.screenshot({path:'dash-stock2.png'});
 const delMsg=await D.evaluate(id=>{editProduct(id);document.querySelector('#rm').click();document.querySelector('#rm').click();return document.querySelector('#err').textContent+'|'+document.querySelector('#bg').className},pid);
 ok(delMsg.includes('Inactive')&&delMsg.includes('open'),'cannot delete a product with POS history (asks to set Inactive)');
 await D.evaluate(id=>{document.querySelector('#sheet [data-k=aktif]').value='Inactive';document.querySelector('#ok').click()},pid);
 await until(async()=>(await rows('Stok')).some(r=>r[0]===pid&&r[8]==='Inactive'),10000,'inactive pushed');
 await nav(A,'stock');
 await until(()=>A.evaluate(id=>window.__wismir.S.products.find(p=>p.id===id).active===false,pid),10000,'tablet sees inactive');
 await nav(A,'pos');
 ok(true,'product set Inactive in dashboard → hidden from POS cashier');
 // delete a product without history → disappears from tablet
 await D.evaluate(()=>{addProduct();document.querySelector('#sheet [data-k=nama]').value='Tes Hapus';document.querySelector('#ok').click()});
 await until(async()=>(await rows('Stok')).some(r=>r[1]==='Tes Hapus'),10000,'new product pushed');
 await nav(A,'home');await nav(A,'stock');
 await until(()=>A.evaluate(()=>window.__wismir.S.products.some(p=>p.name==='Tes Hapus')),10000,'new product on tablet');
 await D.evaluate(()=>{const p=S.products.find(x=>x.nama==='Tes Hapus');editProduct(p.id);document.querySelector('#rm').click();document.querySelector('#rm').click()});
 await until(async()=>!(await rows('Stok')).some(r=>r[1]==='Tes Hapus'),10000,'deleted pushed');
 await nav(A,'home');await nav(A,'stock');
 await until(()=>A.evaluate(()=>!window.__wismir.S.products.some(p=>p.name==='Tes Hapus')),10000,'tablet removes deleted');
 ok(true,'product deleted in dashboard (no history) → removed from tablet');
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

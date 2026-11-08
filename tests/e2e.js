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
 await D.evaluate(()=>{tab='ops';ops='stock';addProduct();const q=k=>document.querySelector('#sheet [data-k='+k+']');q('nama').value='Gamis Navy';q('kategori').value='Gamis';q('brand').value='WISMIR';q('sku').value='GMS-NVY-L';q('cogs').value='120000';document.querySelector('#ok').click()});
 await D.evaluate(()=>{ops='staff';addStaff();document.querySelector('#sheet [data-k=name]').value='Rina';document.querySelector('#ok').click()});
 await until(async()=>(await rows('Stok')).length===2&&(await rows('Staff')).length===2,10000,'dash push');
 // stores: physical store + warehouse appear on the tablet, marketplace does not
 for(const [n,t] of [['Toko A','Physical store'],['Gudang','Warehouse'],['Shopee WISMIR','Marketplace']])
  await D.evaluate(([n,t])=>{tab='ops';ops='store';addStore();document.querySelector('#sheet [data-k=name]').value=n;document.querySelector('#sheet [data-k=type]').value=t;document.querySelector('#ok').click()},[n,t]);
 await until(async()=>(await rows('Store')).length===3,10000,'stores pushed');
 const st=(await dump()).Stok;ok(st.v[0].join()==='id,nama,varian,stokToko,stokOnline,min,harga,kategori,aktif,sku,cogs,brand','Stok sheet has sku, cogs, brand columns at the end');
 const gr=st.v.find(r=>r[1]==='Gamis Navy');ok(gr[9]==='GMS-NVY-L'&&gr[10]===120000,'SKU stored as text, COGS as a number: '+gr[9]+' / '+gr[10]);
ok(await D.evaluate(()=>{addProduct();const k=[...document.querySelectorAll('#sheet [data-k]')].map(e=>e.dataset.k).join();close();return k==='nama,kategori,brand,sku,cogs'}),'product form fields: Product name, Category, Brand, SKU, COGS');
 ok(await D.evaluate(()=>{addProduct();const c=[...document.querySelectorAll('#dl-kategori option')].map(o=>o.value),b=[...document.querySelectorAll('#dl-brand option')].map(o=>o.value),inp=document.querySelector('#sheet [data-k=kategori]');close();return inp.tagName==='INPUT'&&inp.value===''&&c.includes('Gamis')&&c.includes('Hijab')&&b.join()==='WISMIR'}),'category is free text (empty by default) with suggestions from earlier categories; brand suggestions too');
 ok((await dump()).Stok.v.find(r=>r[1]==='Gamis Navy')[11]==='WISMIR','brand stored in the Stok sheet');
 ok(await D.evaluate(()=>{addProduct();const q=k=>document.querySelector('#sheet [data-k='+k+']');q('nama').value='Dup';q('sku').value='gms-nvy-l ';document.querySelector('#ok').click();const r=document.querySelector('#err').textContent.includes('SKU')&&document.querySelector('#bg').classList.contains('open');close();return r&&!S.products.some(p=>p.nama==='Dup')}),'duplicate SKU is refused');
 // ---- tablet A ----
 const ctxA=await br.newContext({viewport:{width:1024,height:768}});const A=await ctxA.newPage();A.on('pageerror',e=>errs.push('A: '+e.message));
 // tablet A is like the owner's trial tablet: old sample data (products, staff Rina/Budi/Sari/Andi, "Stok awal contoh") AND a trial sale
 const OLD=require('./pos-sample')();delete OLD.locs;OLD.moves.forEach(m=>{m.by='Contoh';m.note='Stok awal contoh'});
 OLD.shifts=[{id:'SHT',store:'Toko A',openedAt:Date.now()-7e6,closedAt:Date.now()-6e6,staff:['Rina'],cashStart:0,cashSales:1,expected:1,cashIn:0,cashOut:0,cashMoves:[],total:1,by:{Tunai:1},n:1}];
 OLD.txs=[{id:'TT',shiftId:'SHT',store:'Toko A',t:Date.now()-6.5e6,method:'Tunai',pays:[{method:'Tunai',amount:1}],total:1,paid:1,change:0,items:[{pid:'PS0',name:'x',qty:1,price:1}]}];
 await A.addInitScript(st=>{try{if(!localStorage.getItem('wismir_pos_v1'))localStorage.setItem('wismir_pos_v1',JSON.stringify(st))}catch(e){}},OLD);
 await A.goto(B+'/pos.html');
 await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');
 const subs=await A.$$eval('[data-a=osub]',b=>b.map(x=>x.textContent));ok(subs.join()==='Laporan,Data','POS owner sub-tabs are only Laporan + Data: '+subs);
 await A.click('[data-a=osub][data-s=data]');await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.products.length===2&&window.__wismir.S.staff.length===2),10000,'tablet gets lists');
 const names=await A.evaluate(()=>window.__wismir.S.products.map(p=>p.name+'|'+p.category).sort().join(', '));
 ok(names==='Gamis Navy|Gamis, Khimar Lama|Hijab','tablet shows dashboard products with category: '+names);
 const cl=await A.evaluate(()=>{const S=window.__wismir.S;return JSON.stringify({staff:S.staff.map(k=>k.name).sort(),contoh:S.moves.filter(m=>m.by==='Contoh').length,locs:S.locs,store:S.cfg.store})});
 ok(cl==='{"staff":["Budi","Rina"],"contoh":0,"locs":{"stores":["Toko A"],"wh":["Gudang"],"online":[],"prods":{}},"store":"Toko A"}','old sample products, staff and stock are gone; stores come from the dashboard: '+cl);
 // stock in + transfer + shift + sale
 await A.click('[data-a=ownerOff]');await nav(A,'stock');
 ok(!(await A.$('[data-a=mvNew]')),'no "+ Produk baru" shortcut in the stock form');
 const pid=await A.evaluate(()=>window.__wismir.S.products.find(p=>p.name.startsWith('Gamis')).id);
 await A.click('[data-a=mvStart][data-m=in]');ok(!(await A.$('[data-a=mvNew]')),'stock form has no product creation');
 await A.selectOption('#mvP',pid);await A.selectOption('#mvT','Toko A');await A.fill('#mvQ','10');await A.click('[data-a=mvNext]');
 await nav(A,'home');await A.click('[data-a=tgStaff]');await A.fill('#cashStart','0');await A.click('[data-a=openShift]');
 await A.click('.pc >> text=Gamis Navy');await A.fill('#pp','200000');await A.click('[data-a=addLine]');await A.click('[data-a=pay]');await A.click('[data-a=setMethod][data-m=Tunai]');await A.click('#sheet [data-a=x]');
 await nav(A,'home');await A.click('[data-a=closeSheet]');await A.click('[data-a=doClose]');
 await until(async()=>(await rows('POS Kasir')).length===1&&(await rows('POS Stok')).length===2,10000,'close shift');
 ok(true,'shift + sale + stock still sync');
 // ---- dashboard sees combined stock; deactivate product hides it in POS ----
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>(S.pos.stok||[]).length===2),10000,'dash sees moves');
 await D.evaluate(()=>{tab='ops';ops='stock';render()});
 const row=await D.$eval('.ptab tbody tr',e=>[...e.children].slice(1).map(c=>c.textContent).join('|'));ok(row==='0|9|9','dashboard stock table: Gudang 0, Toko A 9, total 9: '+row);
 // stock history with filters
 await D.evaluate(()=>{stv='hist';HF.per='today';render()});
 const h1=await D.textContent('#hlist');ok(h1.includes('Gamis Navy')&&h1.includes('Stock in')&&h1.includes('Sale'),'Stock › History lists today\'s moves (stock in + sale)');
 await D.selectOption('.hfil select >> nth=1','Toko A');await D.selectOption('.hfil select >> nth=2','sale');
 const h2=await D.textContent('#hlist');ok(h2.startsWith('1 move ·')&&h2.includes('out 1 pcs')&&!h2.includes('Stock in'),'filter by location + type: '+h2.slice(0,40));
 await D.selectOption('.hfil select >> nth=2','all');await D.selectOption('.hfil select >> nth=3','Hijab');
 ok((await D.textContent('#hlist')).includes('No stock moves match'),'filter by category');
 await D.selectOption('.hfil select >> nth=3','all');await D.fill('.hfil input[type=search]','gms-nvy');
 ok((await D.textContent('#hlist')).startsWith('2 moves'),'search by SKU');
 await D.selectOption('.hfil select >> nth=0','last');ok((await D.textContent('#hlist')).includes('No stock moves match'),'period filter (last month: nothing)');
 await D.screenshot({path:'history.png'});
 await D.evaluate(()=>{stv='list';HF.per='30d';HF.q='';HF.loc='all';render()});
 await D.screenshot({path:'dash-stock2.png'});
 const hid=await D.evaluate(id=>{editProduct(id);const b=document.querySelector('#rm'),lab=b.textContent;b.click();b.click();return lab+'|'+document.querySelector('#bg').className+'|'+S.products.find(p=>p.id===id).aktif},pid);
 ok(hid.startsWith('Hide from cashier|')&&!hid.includes('open')&&hid.endsWith('|Inactive'),'product with POS history: bottom button hides it from the cashier instead of deleting: '+hid);

 await until(async()=>(await rows('Stok')).some(r=>r[0]===pid&&r[8]==='Inactive'),10000,'inactive pushed');
 await nav(A,'stock');
 await until(()=>A.evaluate(id=>window.__wismir.S.products.find(p=>p.id===id).active===false,pid),10000,'tablet sees inactive');
 await nav(A,'pos');
 ok(true,'product set Inactive in dashboard → hidden from POS cashier');
 ok(await D.evaluate(id=>{editProduct(id);const b=document.querySelector('#rm'),lab=b.textContent;b.click();b.click();return lab==='Show in cashier again'&&S.products.find(p=>p.id===id).aktif==='Active'},pid),'hidden product can be shown in the cashier again');
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
 // ---- "Mulai baru": tablet B has history too; A wipes everything ----
 const Bt=await (await br.newContext({viewport:{width:1024,height:768}})).newPage();Bt.on('pageerror',e=>errs.push('B: '+e.message));
 await Bt.goto(B+'/pos.html');await nav(Bt,'owner');await Bt.fill('#gpin','1234');await Bt.click('[data-a=gateOk]');await Bt.click('[data-a=osub][data-s=data]');
 await Bt.fill('#gsu',URL_);await Bt.fill('#gsp','9999');await Bt.click('[data-a=gsSave]');
 await until(()=>Bt.evaluate(()=>window.__wismir.S.shifts.length>0&&window.__wismir.S.moves.length>0),10000,'tablet B has history');
 ok((await rows('POS Kasir')).length>0,'before: POS tabs in the Sheet have trial rows');
 await nav(A,'owner');await A.fill('#gpin','1234').catch(()=>{});await A.click('[data-a=gateOk]').catch(()=>{});await A.click('[data-a=osub][data-s=data]');
 await A.click('[data-a=reset]');await A.click('[data-a=reset]');
 await until(async()=>(await rows('POS Kasir')).length===0&&(await rows('POS Stok')).length===0&&(await rows('POS Shift')).length===0,10000,'sheet cleared');
 ok(true,'Mulai baru empties the POS tabs in the Sheet');
 await until(()=>A.evaluate(()=>window.__wismir.S.epoch!=='0'),15000,'tablet A reset done');ok(await A.evaluate(()=>{const S=window.__wismir.S;return !S.moves.length&&!S.txs.length&&!S.shifts.length&&!S.attendance.length&&S.products.length===2}),'tablet A history wiped, dashboard products kept');
 ok((await rows('Stok')).length===2&&(await rows('Staff')).length===2&&(await rows('Store')).length===3,'dashboard tabs (products, staff, stores) untouched');
 await nav(Bt,'stock');
 await until(()=>Bt.evaluate(()=>{const S=window.__wismir.S;return !S.moves.length&&!S.shifts.length&&!S.txs.length}),15000,'tablet B wiped');
 ok(true,'tablet B cleans itself on its next sync');
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>!(S.pos.shift||[]).length&&!(S.pos.stok||[]).length),10000,'dash pos cleared');
 ok(await D.evaluate(()=>!posTx().length),'dashboard no longer counts trial sales');
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

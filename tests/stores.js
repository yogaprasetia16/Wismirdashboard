// Store types (Warehouse / Physical store / Online store), "Stock from" for online stores, product checklist per store,
// product table with stock per location; POS: online store sells from its source store's stock, products filtered per store.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const nav=async(pg,t)=>{await pg.click('#menuBtn');await pg.click('#menu [data-t='+t+']');await pg.waitForTimeout(200)};
(async()=>{
 const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:850}})).newPage();D.on('pageerror',e=>errs.push('dash: '+e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 for(const n of ['Gamis A','Hijab B','Rok C'])await D.evaluate(n=>{tab='ops';ops='stock';addProduct();document.querySelector('#sheet [data-k=nama]').value=n;document.querySelector('#ok').click()},n);
 await D.evaluate(()=>{addStaff();document.querySelector('#sheet [data-k=name]').value='Rina';document.querySelector('#ok').click()});
 const id=await D.evaluate(()=>Object.fromEntries(S.products.map(p=>[p.nama,p.id])));
 // stores
 await D.evaluate(()=>{tab='ops';ops='store';render()});
 await D.evaluate(()=>addStore());
 const types=await D.$$eval('#sheet [data-k=type] option',o=>o.map(x=>x.value));
 ok(types.join()==='Physical store,Warehouse,Online store','store types: '+types.join(', '));
 ok(!(await D.isVisible('#sheet [data-k=sumber]'))&&await D.isVisible('#sheet .ckl'),'physical store: no "Stock from"; product checklist shown');
 ok((await D.$$('#sheet .ckl .ckb input:checked')).length===3,'new store: all products ticked');
 await D.fill('#sheet [data-k=name]','Gudang');await D.selectOption('#sheet [data-k=type]','Warehouse');await D.click('#ok');
 await D.evaluate(()=>addStore());await D.fill('#sheet [data-k=name]','Toko A');
 await D.uncheck('#sheet .ckb input[value="'+id['Rok C']+'"]');
 ok((await D.textContent('#sheet .ckn'))==='2 of 3','checklist counts ticked products');
 await D.click('#ok');
 await D.evaluate(()=>addStore());await D.fill('#sheet [data-k=name]','Online Shop');await D.selectOption('#sheet [data-k=type]','Online store');
 ok(await D.isVisible('#sheet [data-k=sumber]'),'online store: "Stock from" shown');
 const src=await D.$$eval('#sheet [data-k=sumber] option',o=>o.map(x=>x.value));
 ok(src.join()==='Gudang,Toko A','"Stock from" offers warehouses and physical stores: '+src.join(', '));
 await D.selectOption('#sheet [data-k=sumber]','Toko A');
 await D.click('#sheet .ckh button:nth-of-type(2)');await D.check('#sheet .ckb input[value="'+id['Hijab B']+'"]');await D.click('#ok');
 await until(async()=>{const o=await dump();return o.Store&&o.Store.v.length===4},10000,'stores synced');
 const st=(await dump()).Store.v,h=st[0];
 const row=n=>st.find(r=>r[h.indexOf('name')]===n);
 ok(h.join()==='id,name,type,address,sumber,produk','Store tab columns: '+h.join(','));
 ok(row('Online Shop')[h.indexOf('sumber')]==='Toko A'&&JSON.parse(row('Online Shop')[h.indexOf('produk')]).join()===id['Hijab B'],'online store saved with Stock from Toko A and only Hijab B');
 ok(JSON.parse(row('Toko A')[h.indexOf('produk')]).length===2&&row('Gudang')[h.indexOf('produk')]==='','Toko A has 2 products; Gudang (all ticked) is saved as "all products"');
 const lst=await D.textContent('#app');ok(lst.includes('Stock from Toko A')&&lst.includes('All products')&&lst.includes('2 products'),'store list shows Stock from, product counts');
 // stock in Toko A (tablet moves)
 let n=0;const mv=(pid,name,qty)=>({id:'M'+(n++),tanggal:'2026-11-08',jam:'09:00',produk:name,dari:'Supplier',ke:'Toko A',qty,oleh:'Toko A',catatan:'',status:'ok',jenis:'',ref:'',pid,t:String(n)});
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[mv(id['Gamis A'],'Gamis A',10),mv(id['Hijab B'],'Hijab B',10)]}})});
 // tablet
 const A=await (await br.newContext({viewport:{width:1280,height:800}})).newPage();A.on('pageerror',e=>errs.push('pos: '+e.message));
 await A.goto(B+'/pos.html');await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.click('[data-a=osub][data-s=data]');
 await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.products.length===3&&window.__wismir.S.moves.length===2),10000,'tablet lists');
 await A.click('[data-a=storeSwitch]');
 const pick=await A.$$eval('#sheet [data-a=setStore] .grow',e=>e.map(x=>x.textContent));
 ok(pick.length===2&&pick[0]==='Toko A'&&pick[1].includes('Online Shop')&&pick[1].includes('stok dari Toko A'),'tablet store picker: Toko A and Online Shop (stok dari Toko A), no warehouse: '+pick.join(' | '));
 await A.click('#sheet [data-a=setStore][data-s="Online Shop"]');await A.click('[data-a=ownerOff]');
 await nav(A,'home');await A.click('[data-a=tgStaff]');await A.fill('#cashStart','0');await A.click('[data-a=openShift]');await A.waitForTimeout(200);
 const grid=await A.$$eval('#grid .pc',e=>e.map(x=>x.dataset.id));
 ok(grid.join()===id['Hijab B'],'Online Shop cashier shows only its ticked product (Hijab B)');
 await A.click('#grid .pc');ok((await A.textContent('#sheet .note')).includes('Stok di Toko A: 10'),'price sheet shows the stock of Toko A');
 await A.fill('#pp','80000');await A.fill('#pq','3');await A.click('[data-a=addLine]');await A.click('[data-a=pay]');await A.click('[data-a=setMethod][data-m=Transfer]');await A.click('#sheet [data-a=x]');
 await A.waitForTimeout(150);
 ok((await A.$eval('#grid .pc[data-id="'+id['Hijab B']+'"]',e=>e.textContent))!==null,'still listed');
 const av=await A.evaluate(id=>{const S=window.__wismir.S;let n=0;S.moves.forEach(m=>{if(m.pid!==id)return;if(m.to==='Toko A')n+=m.qty;if(m.from==='Toko A')n-=m.qty});return n},id['Hijab B']);
 ok(av===7,'the sale takes the stock off Toko A right away, before the shift closes (owner 2026-11-13) ('+av+')');
 // stock form on the online tablet: location Toko A, products of Online Shop
 await nav(A,'stock');await A.click('[data-a=mvStart][data-m=in]');
 const opts=await A.$$eval('#mvP option',o=>o.map(x=>x.value).filter(Boolean)),to=await A.$eval('#mvT',e=>e.value).catch(()=>'');
 ok(opts.join()===id['Hijab B'],'stock form lists only the store\'s ticked products');
 ok(to==='Toko A','online store tablet puts stock into Toko A: '+to);
 await A.click('#sheet [data-a=x]');
 await nav(A,'home');await A.click('[data-a=closeSheet]');await A.click('[data-a=doClose]');
 await until(async()=>{const o=await dump();return o['POS Stok'].v.length===4&&o['POS Kasir']&&o['POS Kasir'].v.length===2},10000,'sale synced');
 const o=await dump(),sh=o['POS Stok'].v[0],sale=o['POS Stok'].v.find(r=>r[sh.indexOf('ke')]==='Sale'),kh=o['POS Kasir'].v[0];
 ok(sale[sh.indexOf('dari')]==='Toko A'&&sale[sh.indexOf('qty')]===3,'sale on Online Shop takes 3 pcs from Toko A stock');
 ok(o['POS Kasir'].v[1][kh.indexOf('toko')]==='Online Shop','receipt is recorded under Online Shop (own sales recap)');
 // Toko A tablet: Rok C is not ticked there
 await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.click('[data-a=storeSwitch]');await A.click('#sheet [data-a=setStore][data-s="Toko A"]');await A.click('[data-a=ownerOff]');
 await nav(A,'home');await A.click('[data-a=tgStaff]');await A.fill('#cashStart','0');await A.click('[data-a=openShift]');await A.waitForTimeout(200);
 const g2=await A.$$eval('#grid .pc',e=>e.map(x=>x.dataset.id).sort().join());
 ok(g2===[id['Gamis A'],id['Hijab B']].sort().join(),'Toko A cashier shows Gamis A and Hijab B, not Rok C');
 // dashboard product table
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>(S.pos.stok||[]).length===3),10000,'dash pull');
 await D.evaluate(()=>{tab='ops';ops='store';render()});await D.evaluate(()=>{tab='ops';ops='stock';stv='list';render()});
 const th=await D.$$eval('.ptab thead th',e=>e.map(x=>x.textContent));
 ok(th.join()==='Product,Gudang,Toko A,Total','product table columns: '+th.join(', '));
 const tr=await D.$eval('.ptab tr[data-pid="'+id['Hijab B']+'"]',e=>[...e.children].slice(1).map(c=>c.textContent).join('|'));
 ok(tr==='0|7|7','Hijab B: Gudang 0, Toko A 7 (10 − 3 sold online), total 7: '+tr);
 ok(!(await D.$('.stk button'))&&!(await D.$('[onclick^="adj("]')),'no +/− stock buttons');
 await D.click('.ptab tr[data-pid="'+id['Gamis A']+'"] td:first-child');ok(await D.isVisible('#sheet [data-k=nama]'),'tapping a row opens the product');
 await D.evaluate(()=>close());
 await D.screenshot({path:'stock-table.png'});
 await D.evaluate(()=>{tab='ops';ops='store';render()});await D.click('.row >> text=Online Shop');await D.waitForTimeout(150);await D.screenshot({path:'store-form.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

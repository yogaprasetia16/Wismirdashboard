// Overview › New transaction (owner 2026-11-24): enter a sale made without a cashier tablet (online store, POS off, after
// hours): date, store, product + qty + total amount per line, "+ Add product". Saved like a POS sale (receipt in POS Kasir,
// sale rows in POS Stok), so revenue, pieces, product ranking and stock count it, and tablets see it. Sample data only.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const rows=(o,tab)=>{const t=o[tab];if(!t||!t.v.length)return[];const h=t.v[0];return t.v.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))};
(async()=>{
 const br=await chromium.launch();const errs=[];
 for(const [n,vp] of [['laptop',{width:1366,height:900}],['phone',{width:360,height:780}]]){
  const D=await (await br.newContext({viewport:vp})).newPage();D.on('pageerror',e=>errs.push(n+': '+e.message));
  await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
  await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
  if(n==='laptop'){
   await D.evaluate(()=>{S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',kategori:'Gamis',brand:'WISMIR',cogs:60000,min:3,aktif:'Active'},{id:'pb',nama:'Kulot Beta',sku:'BB02',kategori:'Bawahan',brand:'Karmila',cogs:30000,min:3,aktif:'Active'});
    S.stores.push({id:'s1',name:'Toko A',type:'Physical store'},{id:'s2',name:'Gudang',type:'Warehouse'},{id:'s3',name:'Shopee',type:'Online store',sumber:'Gudang'});save()});
   await until(async()=>{const o=await dump();return o.Store&&o.Store.v.length===4},10000,'master');
  }
  await D.evaluate(()=>{tab='home';render()});
  await D.click('#cta');await D.waitForSelector('#sheet #slines');
  ok(await D.$$eval('#sst option',o=>o.map(x=>x.textContent).join())==='Toko A,Shopee','store list: physical and online stores, no warehouse');
  if(n==='laptop'){
   await D.selectOption('#slines .sline:nth-child(1) [data-s=p]','pa');await D.fill('#slines .sline:nth-child(1) [data-s=q]','2');await D.fill('#slines .sline:nth-child(1) [data-s=a]','400000');
   await D.click('#sadd');await D.selectOption('#slines .sline:nth-child(2) [data-s=p]','pb');await D.fill('#slines .sline:nth-child(2) [data-s=q]','1');await D.fill('#slines .sline:nth-child(2) [data-s=a]','150000');
   ok((await D.textContent('#stot')).includes('550.000'),'running total shown');
   await D.screenshot({path:'manual-sale.png'});
   await D.click('#ok');await D.waitForFunction(()=>!document.querySelector('#bg').classList.contains('open'),null,{timeout:15000});
   const o=await dump(),k=rows(o,'POS Kasir'),st=rows(o,'POS Stok');
   ok(k.length===1&&k[0].toko==='Toko A'&&+k[0].total===550000&&k[0].metode==='Manual','one receipt in POS Kasir: Toko A, Rp 550.000, method Manual');
   ok(st.length===2&&st.every(r=>r.ke==='Sale'&&r.dari==='Toko A'&&r.jenis==='sale')&&st.some(r=>r.pid==='pa'&&+r.qty===2&&+r.nilai===400000),'one sale row per product in POS Stok, from Toko A');
   const r=await D.evaluate(()=>{const m=today().slice(0,7),g={};finRows().filter(x=>x.m===m).forEach(x=>{g[x.name]=(g[x.name]||{q:0,v:0});g[x.name].q+=x.q;g[x.name].v+=x.v});return {g,day:daySales(today()),stock:posTotal(posStock(),'pa')}});
   ok(r.g['Gamis Alpha']&&r.g['Gamis Alpha'].q===2&&r.g['Gamis Alpha'].v===400000&&r.g['Kulot Beta'].v===150000&&!r.g['?'],'Report: products with pieces and rupiah: '+JSON.stringify(r.g));
   ok(r.day===550000,"Overview: today's sales includes it ("+r.day+')');
   ok(r.stock===-2,'stock of Gamis Alpha went down by 2 at Toko A ('+r.stock+')');
   // edit (owner 2026-11-24): list beside New transaction, tap the sale, change Gamis to 1 pc Rp 200.000, remove Kulot
   ok(await D.isVisible('#mlist'),'Manual sales button beside New transaction');
   await D.click('#mlist');await D.waitForSelector('#sheet [data-ms]');
   ok((await D.textContent('#sheet [data-ms]')).includes('Toko A')&&(await D.textContent('#sheet [data-ms]')).includes('550.000'),'the list shows the sale (date, store, total)');
   await D.click('#sheet [data-ms]');await D.waitForSelector('#sheet #slines');
   ok(await D.$eval('#slines .sline:nth-child(1) [data-s=p]',e=>e.value)==='pa'&&await D.$eval('#slines .sline:nth-child(1) [data-s=q]',e=>e.value)==='2','edit form opens with the saved lines');
   await D.fill('#slines .sline:nth-child(1) [data-s=q]','1');await D.fill('#slines .sline:nth-child(1) [data-s=a]','200000');await D.click('#slines .sline:nth-child(2) .sx');
   await D.click('#ok');await D.waitForFunction(()=>!document.querySelector('#bg').classList.contains('open'),null,{timeout:15000});
   let o2=await dump(),k2=rows(o2,'POS Kasir'),s2=rows(o2,'POS Stok');
   ok(k2.length===1&&+k2[0].total===200000&&k2[0].status==='DIUBAH','the same receipt is replaced (Rp 200.000, marked changed)');
   ok(s2.find(x=>x.pid==='pa').qty==1&&s2.find(x=>x.pid==='pb').status==='void','Gamis row now 1 pc, the removed Kulot row is void');
   let r2=await D.evaluate(()=>({day:daySales(today()),a:posTotal(posStock(),'pa'),b:posTotal(posStock(),'pb')}));
   ok(r2.day===200000&&r2.a===-1&&r2.b===0,'revenue and stock follow the change: '+JSON.stringify(r2));
   // delete: two taps
   await D.click('#mlist');await D.click('#sheet [data-ms]');await D.waitForSelector('#sheet #rm');await D.click('#rm');
   ok((await D.textContent('#rm')).includes('Tap again'),'delete asks for a second tap');await D.click('#rm');
   await D.waitForFunction(()=>!document.querySelector('#bg').classList.contains('open'),null,{timeout:15000});
   o2=await dump();k2=rows(o2,'POS Kasir');s2=rows(o2,'POS Stok');
   ok(k2[0].status==='VOID'&&s2.every(x=>x.status==='void'),'deleted: receipt VOID, every stock row void');
   r2=await D.evaluate(()=>({day:daySales(today()),a:posTotal(posStock(),'pa'),n:manualSales().length,rev:finRows().filter(x=>x.m===today().slice(0,7)).reduce((s,x)=>s+x.v,0)}));
   ok(r2.day===0&&r2.a===0&&r2.n===0&&r2.rev===0,'revenue, stock and the list are back to nothing: '+JSON.stringify(r2));
  }else{
   // phone: an online store sells from its stock source (Gudang); missing amount is refused
   await D.selectOption('#sst','Shopee');await D.selectOption('#slines .sline [data-s=p]','pb');await D.fill('#slines .sline [data-s=q]','3');
   await D.click('#ok');ok((await D.textContent('#err')).includes('total amount'),'a line without a total amount is refused');
   await D.fill('#slines .sline [data-s=a]','270000');
   ok(await D.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'phone 360 px: the form fits the screen');
   await D.screenshot({path:'manual-sale-phone.png'});
   await D.click('#ok');await D.waitForFunction(()=>!document.querySelector('#bg').classList.contains('open'),null,{timeout:15000});
   const st=rows(await dump(),'POS Stok').filter(r=>r.pid==='pb'&&+r.qty===3);
   ok(st.length===1&&st[0].dari==='Gudang','online store: stock taken from its source (Gudang)');
   const g=await D.evaluate(()=>{const m=today().slice(0,7);return finRows().filter(x=>x.m===m&&x.st==='Shopee').reduce((a,x)=>a+x.v,0)});
   ok(g===270000,'revenue counted for the online store Shopee ('+g+')');
  }
 }
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

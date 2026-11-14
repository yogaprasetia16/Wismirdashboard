// Finance > Report and Financial on real data: imported sales history (+ POS), cost = pieces × COGS, categories from products,
// valuation from current stock × COGS. Sample data below is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const PASTE=['date\tStore\tSKU\tSold\tTotal pendapatan',
 '31/01/2025\tToko X\taa01\t10\t1.000.000','31/01/2025\tShopee\tbb02\t5\t250.000',
 '28/02/2025\tToko X\taa01\t20\t2.000.000',
 '31/01/2026\tToko X\taa01\t12\t1.200.000','31/01/2026\tShopee\tbb02\t10\t500.000','31/01/2026\tToko X\tzz09\t2\t100.000',
 '28/02/2026\tToko X\taa01\t30\t3.000.000','28/02/2026\tToko X\tbb02\t4\t200.000'].join('\n');
(async()=>{
 const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='tx';fv='report';render()});
 ok((await D.textContent('#app')).includes('No sales yet'),'empty state before any sales');
 await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 for(const [n,k,sku,c] of [['Gamis Alpha','Gamis','AA01','60000'],['Hijab Beta','Hijab','BB02','20000']])await D.evaluate(([n,k,sku,c])=>{tab='ops';ops='stock';addProduct();const q=x=>document.querySelector('#sheet [data-k='+x+']');q('nama').value=n;q('kategori').value=k;q('sku').value=sku;q('cogs').value=c;document.querySelector('#ok').click()},[n,k,sku,c]);
 const ids=await D.evaluate(()=>Object.fromEntries(S.products.map(p=>[p.nama,p.id])));
 await D.evaluate(()=>{tab='tx';fv='sales';render()});await D.click('text=Import sales history');await D.fill('#stext',PASTE);await D.click('#sgo');
 // stock for valuation: 7 Gamis + 3 Hijab in Toko X
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Stok':[{id:'M1',tanggal:'2026-11-01',produk:'Gamis Alpha',dari:'Supplier',ke:'Toko X',qty:7,status:'ok',pid:ids['Gamis Alpha'],t:'1'},{id:'M2',tanggal:'2026-11-01',produk:'Hijab Beta',dari:'Supplier',ke:'Toko X',qty:3,status:'ok',pid:ids['Hijab Beta'],t:'2'}]}})});
 await D.evaluate(()=>{S.stores.push({id:'st1',name:'Toko X',type:'Physical store'});save()});
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>(S.pos.stok||[]).length===2),10000,'pull');
 // Report
 await D.evaluate(()=>{tab='tx';fv='report';FM='';render()});
 const seg=await D.$$eval('#app .seg:first-of-type button',b=>b.map(x=>x.textContent));
 ok(seg.join()==='Transactions,Report,Financial','Finance tabs: '+seg.join(', '));
 const t=await D.textContent('#app');
 ok(t.includes('February 2026')&&!t.includes('Sample data'),'report opens on the latest month with data, no "Sample data" tag');
 const k=await D.$$eval('.kp3 .kn',e=>e.map(x=>x.textContent.replace(/\s/g,' ')));
 // Feb 2026: rev 3.200.000, pcs 34, cost 30×60000+4×20000 = 1.880.000
 ok(k.join('|')==='Rp 3,2 jt|34 pcs|Rp 1,9 jt','Feb 2026 KPIs: revenue, pieces, cost (pieces × COGS): '+k.join(' | '));
 ok(t.includes('vs January 2026'),'compared with January 2026');
 ok((await D.$$('.viz .col')).length===2,'revenue vs cost chart: the months of 2026 with data');
 const cats=await D.$$eval('.donut tbody tr',r=>r.map(x=>x.children[0].textContent));
 ok(cats.join()==='Gamis,Hijab','categories from the product list: '+cats.join(', '));
 await D.selectOption('#app select','ytd');
 const k2=await D.$$eval('.kp3 .kn',e=>e.map(x=>x.textContent.replace(/\s/g,' ')));
 ok(k2[0]==='Rp 5,0 jt'&&(await D.textContent('#app')).includes('vs the same months of 2025'),'year to date 2026 (Rp 5,0 jt) vs Jan–Feb 2025: '+k2[0]);
 ok((await D.textContent('#app')).includes('1 product has no COGS'),'note for the SKU not in the product list (zz09)');
 const pr=await D.$$eval('.card:nth-last-child(2) tbody tr',r=>r.map(x=>x.querySelector('b').textContent));
 ok(pr[0]==='Gamis Alpha'&&pr.includes('zz09'),'product ranking uses product names, unknown SKU shown as code: '+pr.join(', '));
 await D.click('[data-fst="Shopee"]');
 ok((await D.textContent('#sheet')).replace(/\s/g,' ').includes('Rp 500.000')&&(await D.$$('#sheet tbody tr')).length===1,'store detail: Shopee sold Hijab Beta for Rp 500.000 in 2026');
 await D.click('#sheet #no');
 await D.screenshot({path:'fin-report.png',fullPage:true});
 // Financial
 await D.click('#app .seg button >> text=Financial');
 const f=await D.textContent('#app');
 ok(f.includes('January 2025 – February 2026')&&f.includes('2026 (YTD)'),'all time period and 2026 as year to date');
 const yr=await D.$$eval('.viz tbody tr',r=>r.map(x=>[...x.children].map(c=>c.textContent.replace(/\s/g,' ')).join('|')));
 // 2026: rev 5.000.000, cost 42×60000 + 14×20000 = 2.800.000; growth vs Jan–Feb 2025 (3.250.000) = +53,8%
 ok(yr[0]==='2026 (YTD)|Rp 5,0 jt|Rp 2,8 jt|Rp 2,2 jt|58|▲ 53,8%','2026 row: revenue, cost, gross profit, items, growth: '+yr[0]);
 const kn=await D.$$eval('.kp3 .kn',e=>e.map(x=>x.textContent.replace(/\s/g,' ')));
 ok(kn[0]==='Rp 8,3 jt'&&kn[1]==='93 pcs','all-time revenue Rp 8,3 jt and 93 pcs: '+kn.slice(0,2).join(' | '));
 ok(kn[5]==='Rp 0,5 jt'&&kn[4]==='Rp 0,0 jt'&&kn[3]!=='–','valuation (owner 2026-11-14): product 7×60000 + 3×20000 = Rp 0,5 jt; no textile = material 0; cash computed: '+kn.slice(2).join(' | '));
 ok((await D.$$eval('.stab',x=>x.length))>=4,'store, product, year and SKU tables');
 await D.screenshot({path:'fin-financial.png',fullPage:true});
 const Ph=await (await br.newContext({viewport:{width:390,height:844}})).newPage();Ph.on('pageerror',e=>errs.push('phone: '+e.message));
 await Ph.goto(B+'/dashboard.html');await Ph.evaluate(()=>{tab='tx';fv='report';render()});
 ok(await Ph.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone: no sideways page scroll');
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

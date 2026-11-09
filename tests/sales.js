// Finance > Sales: import monthly sales history (Date, Store, SKU, Sold, Revenue), recap per month / year / store / product,
// re-import replaces, POS fills months without history, data reaches the Penjualan tab. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const PASTE=['date\tStore\tSKU\tSold\tTotal pendapatan',
 '30/11/2024\tToko X\taa01\t10\t1.500.000',
 '30/11/2024\tToko X\tbb02\t4\t600000',
 '30/11/2024\tToko X\taa01\t2\t300.000',        // same month+store+SKU: added up
 '30/11/2024\tOnline Y\taa01\t1\t',               // revenue blank
 '31/12/2024\tToko X\taa01\t5\t750.000',
 '30/11/2025\tToko X\taa01\t20\t3.000.000',
 '30/11/2025\tOnline Y\tcc03\t3\t450000',
 'bad row\t\t\t\t'].join('\n');
(async()=>{
 const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{tab='ops';ops='stock';addProduct();const q=k=>document.querySelector('#sheet [data-k='+k+']');q('nama').value='Gamis Alpha';q('sku').value='AA01';document.querySelector('#ok').click()});
 await D.evaluate(()=>{tab='tx';fv='sales';render()});
 ok(!(await D.isVisible('#cta')),'no "+" button on the Sales view');
 await D.click('text=Import sales history');await D.fill('#stext',PASTE);
 const pv=await D.textContent('#sprev');
 ok(pv.includes('6 rows')&&pv.includes('November 2024')&&pv.includes('November 2025')&&pv.includes('1 rows skipped'),'preview: 6 rows (duplicates added up), period, 1 bad row skipped: '+pv.replace(/\s+/g,' '));
 ok(pv.includes('bb02')&&pv.includes('cc03')&&!pv.includes('aa01,'),'preview lists SKUs not in the product list');
 await D.click('#sgo');await D.waitForTimeout(200);
 ok(await D.evaluate(()=>S.hist.length===6&&fv==='sales'&&SY==='2025'),'imported 6 rows, opens Sales on the latest year');
 ok((await D.textContent('#syTot')).replace(/\s/g,' ')==='Rp 3.450.000','2025 revenue Rp 3.450.000');
 const nov=await D.$eval('tr[data-sm="2025-11"]',e=>[...e.children].map(c=>c.textContent.replace(/\s/g,' ')).join('|'));
 ok(nov==='Nov 2025|23|Rp 3.450.000|Rp 2.400.000|+44%','Nov 2025 vs Nov 2024 (12+4+1 pcs, Rp 2.400.000 last year): '+nov);
 await D.click('[onclick="SY=\'2024\';render()"]');
 const dec=await D.$eval('tr[data-sm="2024-12"]',e=>[...e.children].map(c=>c.textContent.replace(/\s/g,' ')).join('|'));
 ok(dec.startsWith('Dec 2024|5|Rp 750.000'),'Dec 2024 row: '+dec);
 ok((await D.textContent('#app')).includes('Gamis Alpha'),'top products use the product name when the SKU is known (aa01 = AA01)');
 await D.selectOption('.f select','Online Y');
 ok((await D.textContent('#syTot')).replace(/\s/g,' ')==='Rp 0'&&(await D.$eval('tr[data-sm="2024-11"]',e=>e.children[1].textContent))==='1','store filter: Online Y in 2024 = 1 pc, Rp 0');
 await D.selectOption('.f select','all');
 await D.click('tr[data-sm="2024-11"]');
 const det=await D.$$eval('#sheet tbody tr',r=>r.map(x=>[...x.children].map(c=>c.textContent.replace(/\s/g,' ')).join('|')));
 ok(det.length===3&&det.some(x=>x.startsWith('Toko X|Gamis Alpha')&&x.includes('|12|Rp 1.800.000')),'month details per store and product: '+det.join(' / '));
 await D.click('#sheet #no');
 // re-import corrected Nov 2025 for Toko X: replaces, no double counting
 await D.evaluate(()=>{tab='tx';fv='sales';render()});await D.click('text=Import sales history');
 await D.fill('#stext','date\tStore\tSKU\tSold\tTotal pendapatan\n30/11/2025\tToko X\taa01\t21\t3.100.000');
 ok((await D.textContent('#sprev')).includes('1 rows replace'),'preview says the row replaces an earlier import');
 await D.click('#sgo');await D.waitForTimeout(150);
 ok(await D.evaluate(()=>S.hist.length===6)&&(await D.textContent('#syTot')).replace(/\s/g,' ')==='Rp 3.550.000','re-import replaced Nov 2025 Toko X (Rp 3.550.000)');
 await until(async()=>{const o=await dump();return o.Penjualan&&o.Penjualan.v.length===7},10000,'synced');
 const pj=(await dump()).Penjualan.v;
 ok(pj[0].join()==='id,bulan,toko,sku,qty,total'&&pj.slice(1).some(r=>r[1]==='2024-11'&&r[2]==='Toko X'&&r[3]==='aa01'&&r[4]===12&&r[5]===1800000),'rows saved in the Penjualan tab (month as text, numbers as numbers)');
 // POS fills a month without history
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',action:'upsert',rows:{'POS Shift':[{id:'SH1',tanggal:'2026-11-05',toko:'Toko X',totalPenjualan:500000,transaksi:2}],'POS Stok':[{id:'MS1',tanggal:'2026-11-05',produk:'Gamis Alpha',dari:'Toko X',ke:'Sale',qty:3,status:'ok',jenis:'sale',pid:await D.evaluate(()=>S.products[0].id),t:'1'}]}})});
 await D.evaluate(()=>pullSheets());await until(()=>D.evaluate(()=>(S.pos.shift||[]).length===1),10000,'pull pos');
 await D.evaluate(()=>{SY='2026';render()});
 const n26=await D.$eval('tr[data-sm="2026-11"]',e=>[...e.children].map(c=>c.textContent.replace(/\s/g,' ')).join('|'));
 ok(n26==='Nov 2026|3|Rp 500.000|Rp 3.550.000|-86%','Nov 2026 from the POS (3 pcs, Rp 500.000) vs imported Nov 2025: '+n26);
 await D.evaluate(()=>{SY='2025';render()});await D.screenshot({path:'sales.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

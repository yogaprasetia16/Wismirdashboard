// Production > Manufacturing: import past orders (Tanggal, Product as SKU, qtt product "1.099", material, qtt material "3.277,0",
// Cost/product "Rp27.000"); SKUs show as the product name when the SKU is in the product list (also for products added later);
// the Product field offers product names; year pills + month groups; re-import replaces. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
const PASTE=['Tanggal\tProduct\tqtt product\tmaterial\tqtt material\tCost/product','16/01/2025\taa01\t1.099\tlinen a\t3.277,0\tRp27.000','05/02/2025\tbb02\t1.071\tflanel\t2.349,0\tRp21.000',
 '04/06/2025\taa01\t357\tgazella\t1.108,1\tRp27.000','30/10/2025\tpermak\t1\t0\t0,0\tRp112.000','10/08/2026\tcc03\t76\tgazella\t107,8\tRp18.500'].join('\n');
(async()=>{const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',kategori:'Gamis',cogs:100000,min:3},{id:'pb',nama:'Tunik Beta',sku:'bb02',kategori:'Atasan',cogs:80000,min:3});save();tab='prod';pt='manu';render()});
 await D.click('[aria-label="Import orders"]');await D.fill('#mtext',PASTE);
 const pv=txt(await D.textContent('#mprev'));
 ok(pv.includes('5 orders')&&pv.includes('2.604 pcs')&&pv.includes('2 of 4 products found')&&pv.includes('aa01 = Gamis Alpha')&&pv.includes('cc03'),'preview: orders, pieces, SKU matches and unknown codes: '+pv);
 await D.click('#mgo');await D.waitForTimeout(200);
 const a=await D.evaluate(()=>S.prod.find(p=>p.date==='2025-01-16'));
 ok(a.qty===1099&&a.matQty===3277&&a.unitCost===27000&&a.total===29673000&&a.status==='Done','numbers read: 1.099 pcs, 3.277,0 m, Rp27.000, total, Done');
 ok(await D.evaluate(()=>S.prod.find(p=>p.date==='2025-06-04').matQty===1108.1),'decimal material quantity 1.108,1 = 1108.1');
 ok(await D.evaluate(()=>S.prod.find(p=>p.name==='permak').material===''),'material "0" stored as empty');
 await D.evaluate(()=>{PRY='2025';render()});
 const t=txt(await D.textContent('#app'));
 ok(t.includes('Gamis Alpha × 1.099')&&t.includes('Tunik Beta × 1.071')&&t.includes('AA01'),'SKUs shown as product names (with the SKU below)');
 ok(t.includes('4 orders done in 2025')&&t.includes('January 2025')&&t.includes('June 2025'),'2025 grouped per month');
 // a product added later matches too
 await D.evaluate(()=>{S.products.push({id:'pc',nama:'Blouse Gamma',sku:'CC03',min:3});save();PRY='2026';render()});
 ok(txt(await D.textContent('#app')).includes('Blouse Gamma × 76'),'a product added after the import is matched as well');
 // the Product field offers product names, editing keeps working
 await D.evaluate(()=>addProd());
 const names=await D.$$eval('#sheet .cmbo',o=>o.map(x=>x.dataset.v));
 ok(names.includes('Gamis Alpha')&&names.includes('Blouse Gamma')&&!names.includes('aa01'),'Product field lists product names (no SKU codes): '+names.join(', '));
 await D.tap?0:0;await D.click('#sheet .cmbo[data-v="Gamis Alpha"]');await D.fill('#sheet [data-k=qty]','10');await D.fill('#sheet [data-k=matQty]','30,5');await D.fill('#sheet [data-k=unitCost]','27000');await D.click('#ok');
 const n=await D.evaluate(()=>S.prod.find(p=>p.name==='Gamis Alpha'));ok(n&&n.matQty===30.5&&n.total===270000&&n.status==='Ongoing','new order by product name, 30,5 m kept, total 270.000, Ongoing');
 ok(txt(await D.textContent('#app')).includes('Ongoing'),'ongoing orders listed on top');
 await D.click('[aria-label="Import orders"]');await D.fill('#mtext',PASTE);ok(txt(await D.textContent('#mprev')).includes('5 rows replace'),'re-import replaces');await D.click('#mgo');
 ok(await D.evaluate(()=>S.prod.length===6),'no double rows after re-import');
 await until(async()=>{const o=await dump();return o.Production&&o.Production.v.length===7},10000,'synced');ok(true,'saved in the Production tab');
 await D.evaluate(()=>{PRY='2025';render()});await D.screenshot({path:'manufacturing.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

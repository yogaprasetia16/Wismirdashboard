// Dashboard: import products pasted from a spreadsheet (made-up rows, same layout as the owner's old sheet).
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}return false}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
// what Google Sheets puts on the clipboard: tab-separated, header row first
const PASTE=['Produk\tCategory\tbrand\tsku\tcogs','Blus.Contoh\tatasan\tmerekA\tta001\t75000','Gamis.Contoh\tgamis\tmerekB\ttg001\t132.000','Gamis.Nol\tgamis\tmerekA\ttg002\t0','\tgamis\tmerekA\ttg003\t1000','Tunik.Contoh\tatasan\tmerekB\tTA001\t85000'].join('\n');
(async()=>{
 const br=await chromium.launch();const p=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(B+'/dashboard.html');await p.evaluate(()=>{tab='set';render()});await p.fill('#cu',URL_);await p.fill('#cp','9999');await p.evaluate(()=>saveCfg());
 await until(()=>p.evaluate(()=>S.cfg.pulled===1));
 await p.evaluate(()=>{tab='ops';ops='stock';stv='list';render()});
 await p.click('[aria-label="Import from spreadsheet"]');
 ok(await p.isVisible('#imptext'),'Import from spreadsheet opens a paste box');
 await p.fill('#imptext',PASTE);
 const prev=await p.textContent('#impprev');
 ok(!prev.includes('not found'),'all 5 columns recognised from the header (Produk, Category, brand, sku, cogs)');
 ok((await p.textContent('#impgo'))==='Import 3 products','3 new: row without a name skipped, duplicate SKU (TA001 = ta001) skipped');
 ok(prev.includes('Rp 132.000'),'"132.000" read as 132000');
 await p.click('#impgo');
 ok(await p.evaluate(()=>S.products.length===3&&S.products.every(x=>x.aktif==='Active'&&x.min===3)),'3 products added, active, low-stock minimum 3');
 const g=await p.evaluate(()=>JSON.stringify(S.products.find(x=>x.sku==='tg001')));
 ok(g.includes('"nama":"Gamis.Contoh"')&&g.includes('"kategori":"gamis"')&&g.includes('"brand":"merekB"')&&g.includes('"cogs":132000'),'fields mapped: '+g.slice(0,120));
 ok(await until(async()=>{const o=await dump();return o.Stok&&o.Stok.v.length===4}),'saved to the Stok sheet (3 rows)');
 const st=(await dump()).Stok;ok(st.v.find(r=>r[1]==='Gamis.Nol')[10]===0,'COGS 0 kept as 0');
 // importing the same paste again adds nothing
 await p.click('[aria-label="Import from spreadsheet"]');await p.fill('#imptext',PASTE);
 ok((await p.textContent('#impgo'))==='Nothing to import yet','pasting the same list again: nothing new (no duplicates)');
 await p.click('#no');
 // paste without a header row: Product, Category, Brand, SKU, COGS in that order
 await p.click('[aria-label="Import from spreadsheet"]');await p.fill('#imptext','Kulot.Contoh\tbawahan\tmerekA\tkk009\t80000');
 ok((await p.textContent('#impgo'))==='Import 1 product','paste without a header row also works');
 await p.screenshot({path:'import.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

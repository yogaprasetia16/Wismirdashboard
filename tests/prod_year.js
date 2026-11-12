// Production: one year dropdown beside the title (no year pills in the columns); picking a year shows that year in
// Purchasing, Manufacturing and Supplier together. Sample data is made up.
const {chromium}=require('playwright');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
(async()=>{const br=await chromium.launch();const errs=[];
 const p=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8765/dashboard.html');await p.waitForTimeout(300);
 await p.evaluate(()=>{S.purch.push({id:'a',date:'2024-03-01',name:'kain 24',category:'Textile',qty:1,total:1000},{id:'b',date:'2025-03-01',name:'kain 25',category:'Textile',qty:1,total:2000});
  S.prod.push({id:'c',date:'2024-05-01',name:'Gamis 24',qty:10,unitCost:1000,total:10000,status:'Done'},{id:'d',date:'2025-05-01',name:'Gamis 25',qty:20,unitCost:1000,total:20000,status:'Done'});
  S.supp.push({id:'sup-2024-06',bulan:'2024-06',total:5000,paidOn:'2024-07-05'},{id:'sup-2025-06',bulan:'2025-06',total:6000,paidOn:'2025-07-05'});tab='prod';render()});
 const opts=await p.$$eval('#prodYear option',o=>o.map(x=>x.value));const Y=await p.evaluate(()=>today().slice(0,4));
 ok(opts[0]===Y&&opts.includes('2025')&&opts.includes('2024'),'year dropdown beside the title: '+opts.join(', '));
 ok(await p.$eval('#prodYear',e=>!!e.closest('.f').parentElement.querySelector('h1')),'dropdown sits next to "Production"');
 ok((await p.$$('.board .seg')).length===0,'no year pills inside the columns');
 await p.selectOption('#prodYear','2025');
 let t=txt(await p.textContent('#app'));
 ok(t.includes('kain 25')&&!t.includes('kain 24')&&t.includes('Gamis 25')&&!t.includes('Gamis 24')&&t.includes('June 2025')&&!t.includes('June 2024'),'2025 picked: all three columns show 2025');
 await p.selectOption('#prodYear','2024');t=txt(await p.textContent('#app'));
 ok(t.includes('kain 24')&&t.includes('Gamis 24')&&t.includes('June 2024')&&!t.includes('kain 25'),'2024 picked: all three columns show 2024');
 await p.waitForTimeout(800);await p.screenshot({path:'prod-year.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

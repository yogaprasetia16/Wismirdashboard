// Production > Purchasing: categories Textile / Item only, import past purchases (date, category, name, quantity, total payment;
// quantities with decimals like "1108,1", amounts like "Rp4.150.000"), year pills + month groups, re-import replaces,
// rows reach the Purchasing tab. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
const PASTE=['date\tcategory\tname\tquantity\ttotal payment','06/09/2024\tTextile\tlinen a\t70\t2065000','25/09/2024\tItem\thandtag\t1\tRp4.150.000',
 '20/05/2025\tTextile\tgazella b\t1108,1\t34905150','06/02/2025\tItem\tkartu nama\t5\tRp125.000','06/02/2025\tItem\tkartu nama\t5\tRp125.000','\t\t\t\t'].join('\n');
(async()=>{const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{tab='prod';pt='purch';render()});
 await D.evaluate(()=>addPurch());
 ok((await D.$$eval('#sheet [data-k=category] option',o=>o.map(x=>x.value))).join()==='Textile,Item,Zakat,Dividen','category options: Textile, Item, Zakat, Dividen (no Karmila product)');
 await D.click('#no');
 await D.click('text=Import purchases');await D.fill('#ptext',PASTE);
 const pv=txt(await D.textContent('#pprev'));
 ok(pv.includes('5 purchases')&&pv.includes('Rp 41.370.150')&&pv.includes('Textile 2')&&pv.includes('Item 3'),'preview: 5 purchases, total, per category: '+pv);
 await D.click('#pgo');await D.waitForTimeout(200);
 ok(await D.evaluate(()=>S.purch.length===5&&PRY==='2025'),'imported 5, opens 2025');
 const g=await D.evaluate(()=>S.purch.find(p=>p.name==='gazella b'));
 ok(g.qty===1108.1&&g.total===34905150&&g.date==='2025-05-20','decimal quantity kept (1108,1 = 1108.1), amount and date read');
 const h=await D.evaluate(()=>S.purch.find(p=>p.name==='handtag'));ok(h.total===4150000,'"Rp4.150.000" read as 4150000');
 const t=txt(await D.textContent('#app'));
 ok(t.includes('3 purchases in 2025')&&t.includes('May 2026')===false&&t.includes('May 2025')&&t.includes('February 2025'),'2025 grouped per month');
 ok(t.includes('gazella b × 1108,1'),'quantity shown with a comma: '+(t.match(/gazella b × [\d,]+/)||[''])[0]);
 await D.evaluate(()=>{PRY='2024';render()});ok(txt(await D.textContent('#app')).includes('2 purchases in 2024'),'year pills switch to 2024');
 // edit keeps decimals
 const id=await D.evaluate(()=>S.purch.find(p=>p.name==='linen a').id);await D.click('[data-pid="'+id+'"]');await D.fill('#sheet [data-k=qty]','70,5');await D.click('#ok');
 ok(await D.evaluate(id=>S.purch.find(p=>p.id===id).qty===70.5,id),'editing keeps a decimal quantity (70,5)');
 // re-import replaces
 await D.click('text=Import purchases');await D.fill('#ptext',PASTE);ok(txt(await D.textContent('#pprev')).includes('5 rows replace'),'re-import: rows replace');await D.click('#pgo');
 ok(await D.evaluate(()=>S.purch.length===5),'no double rows after re-import');
 await until(async()=>{const o=await dump();return o.Purchasing&&o.Purchasing.v.length===6},10000,'synced');
 const pr=(await dump()).Purchasing.v;ok(pr[0].join()==='id,date,name,category,qty,total'&&pr.slice(1).some(r=>r[1]==='2025-05-20'&&r[4]===1108.1),'saved in the Purchasing tab');
 await D.evaluate(()=>{PRY='2025';render()});await D.screenshot({path:'purchases.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

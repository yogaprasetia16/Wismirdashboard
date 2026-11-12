// Saves send only the tabs that changed (adding an expense no longer rewrites Penjualan, Purchasing, ...), and the
// other device still gets every change; nothing changed = no save request at all.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{const br=await chromium.launch();const errs=[];
 const conn=async()=>{const p=await (await br.newContext()).newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(B+'/dashboard.html');await p.evaluate(()=>{tab='set';render()});await p.fill('#cu',URL_);await p.fill('#cp','9999');await p.evaluate(()=>saveCfg());await until(()=>p.evaluate(()=>S.cfg.pulled===1),15000,'pull');return p};
 const L=await conn();
 const posts=[];L.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/exec')){try{posts.push(Object.keys(JSON.parse(r.postData()).data||{}))}catch(e){}}});
 // some data in several tabs
 await L.evaluate(()=>{for(let i=0;i<30;i++)S.purch.push({id:'pu'+i,date:'2025-01-0'+(1+i%9),name:'kain '+i,category:'Textile',qty:1,total:1000});S.hist.push({id:'h-2025-01-a-x',bulan:'2025-01',toko:'A',sku:'x',qty:1,total:5});save()});
 await until(()=>L.evaluate(()=>!S.cfg.dirty),15000,'first save');
 posts.length=0;
 await L.evaluate(()=>{S.tx.push({id:'ex1',jenis:'Expense',channel:'',tanggal:today(),kategori:'Porter',jumlah:30000,catatan:''});save()});
 await until(()=>L.evaluate(()=>!S.cfg.dirty),15000,'expense save');
 ok(posts.length===1&&posts[0].join()==='Keuangan','adding an expense sends only the Keuangan tab: '+JSON.stringify(posts));
 // second device sees it, edits a purchase; first device sees that and still has its expense
 const P=await conn();
 ok(await P.evaluate(()=>S.tx.some(t=>t.id==='ex1')&&S.purch.length===30),'other device loads the expense and the purchases');
 await P.evaluate(()=>{S.purch[0].total=2000;save()});await until(()=>P.evaluate(()=>!S.cfg.dirty),15000,'p save');
 posts.length=0;await L.evaluate(()=>{S.tx.push({id:'ex2',jenis:'Expense',channel:'',tanggal:today(),kategori:'Ads',jumlah:10000,catatan:''});save()});
 await until(()=>L.evaluate(()=>!S.cfg.dirty),15000,'conflict save');
 const g=await (await fetch(URL_+'?pin=9999')).json();
 const pu=g.data.Purchasing.find(x=>x.id==='pu0'),ex=g.data.Keuangan.filter(x=>x.jenis==='Expense').map(x=>x.id).sort().join();
 ok(pu.total===2000&&ex==='ex1,ex2','stale device (conflict) keeps the other device\'s purchase edit and adds its expense: total '+pu.total+', '+ex);
 // a load followed by a save with no change sends nothing
 await L.evaluate(()=>pullSheets());await sleep(1500);posts.length=0;
 await L.evaluate(()=>{save()});await sleep(2500);
 ok(posts.length===0,'nothing changed: no save request ('+posts.length+')');
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

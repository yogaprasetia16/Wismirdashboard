const {chromium}=require('playwright');const B='http://localhost:8765';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=8000){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return}catch(e){}await sleep(200)}throw new Error('timeout '+fn)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{const br=await chromium.launch();const errs=[];
 async function dev(){const pg=await (await br.newContext()).newPage();pg.on('pageerror',e=>errs.push(e.message));await pg.goto(B+'/dashboard.html');
  await pg.evaluate(()=>{tab='set';render()});await pg.fill('#cu',B+'/exec');await pg.fill('#cp','9999');await pg.evaluate(()=>saveCfg());
  await until(()=>pg.evaluate(()=>S.cfg.pulled===1));return pg}
 const add=(pg,amt,note)=>pg.evaluate(([a,n])=>{addTx();document.querySelector('#sheet [data-k=jumlah]').value=a;document.querySelector('#sheet [data-k=catatan]').value=n;document.querySelector('#ok').click()},[amt,note]);
 const sheetTx=async()=>(await (await fetch(B+'/dump')).json()).o.Keuangan.v.slice(1).map(r=>r[6]);
 const L=await dev(),H=await dev();          // laptop + phone, both loaded
 await add(H,'111','from phone');await until(async()=>(await sheetTx()).includes('from phone'));
 // laptop still has stale data, edits an existing row and adds one
 await L.evaluate(()=>{const t=S.tx.find(x=>x.catatan==='lama');if(t){t.catatan='lama edited';save()}});
 await add(L,'222','from laptop');
 await until(async()=>{const t=await sheetTx();return t.includes('from laptop')&&t.includes('lama edited')});
 console.log(JSON.stringify((await (await fetch(B+'/dump')).json()).o.Keuangan.v));console.log('L',await L.evaluate(()=>JSON.stringify([S.tx,status,S.cfg.ver])));console.log('H',await H.evaluate(()=>JSON.stringify([S.tx,status,S.cfg.ver])));const t=await sheetTx();console.log('   Sheet Keuangan notes:',t.join(' | '));
 ok(t.includes('from phone')&&t.includes('from laptop')&&t.includes('lama edited'),'laptop with stale data did NOT erase phone change; both kept');
 // delete on phone after refresh, laptop then edits something else
 await H.evaluate(()=>pullSheets());await sleep(1500);
 await H.evaluate(()=>{S.tx=S.tx.filter(x=>x.catatan!=='from laptop');save()});
 await until(async()=>!(await sheetTx()).includes('from laptop'));
 await add(L,'333','laptop again');
 await until(async()=>(await sheetTx()).includes('laptop again'));
 const t2=await sheetTx();ok(!t2.includes('from laptop')&&t2.includes('from phone'),'deletion from phone respected by laptop merge: '+t2.join(' | '));
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error(e);process.exit(1)});

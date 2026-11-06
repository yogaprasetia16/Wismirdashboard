// Dashboard Sync button: spinner while syncing, back to normal when done, red dot when the last sync failed.
const {chromium}=require('playwright');
const B='http://localhost:8765';
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(B+'/dashboard.html');
 await p.evaluate(()=>{tab='set';render()});await p.fill('#cu',B+'/exec');await p.fill('#cp','9999');await p.evaluate(()=>saveCfg());
 const st=()=>p.evaluate(()=>{const b=document.querySelector('#sync');return (b.classList.contains('busy')?'busy':'idle')+'|'+(b.classList.contains('bad')?'bad':'ok')+'|'+b.textContent.trim()});
 await sleep(1500);ok((await st())==='idle|ok|Sync','idle after the first load: '+await st());
 // slow the network a little so the sync is visibly in progress
 await p.route('**/exec**',async r=>{await sleep(800);await r.continue()});
 await p.click('#sync');await sleep(150);
 ok((await st())==='busy|ok|Syncing…','tapping Sync shows the spinner and "Syncing…": '+await st());
 ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#sync i')).animationName==='spin'),'the ring is spinning');
 const before=await p.evaluate(()=>status);await p.click('#sync');await sleep(50);
 ok((await st()).startsWith('busy'),'a second tap while syncing is ignored');
 await sleep(2000);ok((await st())==='idle|ok|Sync','back to normal when done: '+await st());
 await p.unroute('**/exec**');
 // a fast sync still shows the spinner briefly
 await p.click('#sync');ok((await st()).startsWith('busy'),'even a fast sync shows the spinner');await sleep(1200);ok((await st()).startsWith('idle'),'… and ends');
 // failure: offline -> red dot, then a good sync clears it
 await ctx.setOffline(true);await p.click('#sync');await sleep(1500);
 ok((await st())==='idle|bad|Sync','failed sync leaves a red dot: '+await st());
 await ctx.setOffline(false);await p.click('#sync');await sleep(1500);
 ok((await st())==='idle|ok|Sync','next successful sync clears it: '+await st());
 await p.screenshot({path:'sync.png',clip:{x:1000,y:0,width:280,height:70}});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

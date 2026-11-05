const {chromium}=require('playwright');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{const br=await chromium.launch();const ctx=await br.newContext({viewport:{width:1024,height:700}});const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 for(const page of ['pos.html','dashboard.html']){
  await pg.goto('http://localhost:8765/'+page);
  await pg.evaluate(()=>navigator.serviceWorker.ready);
  const cdp=await ctx.newCDPSession(pg);
  const inst=await cdp.send('Page.getInstallabilityErrors');
  const man=await cdp.send('Page.getAppManifest');
  ok(inst.installabilityErrors.length===0,page+': Chrome says installable '+JSON.stringify(inst.installabilityErrors));
  ok(!man.errors.length,page+': manifest parsed without errors '+JSON.stringify(man.errors));
 }
 await pg.goto('http://localhost:8765/pos.html');await pg.waitForTimeout(500);
 ok(await pg.isVisible('#fs'),'POS in a normal tab shows the full-screen button');
 await pg.click('#fs');await pg.waitForTimeout(300);
 ok(await pg.evaluate(()=>!!document.fullscreenElement),'tapping it enters full screen');
 await pg.click('#fs');await pg.waitForTimeout(300);
 ok(await pg.evaluate(()=>!document.fullscreenElement),'tapping again exits');
 // offline open
 await pg.reload();await pg.waitForTimeout(800);
 await ctx.setOffline(true);await pg.reload();await pg.waitForTimeout(800);
 ok((await pg.textContent('#app')).length>20,'POS opens while offline (from saved copy)');
 await ctx.setOffline(false);
 // installed mode: button hidden
 const ap=await (await br.newContext()).newPage();await ap.addInitScript(()=>{const m=window.matchMedia;window.matchMedia=q=>q.includes('display-mode')?{matches:true,addEventListener(){},removeEventListener(){}}:m.call(window,q)});
 await ap.goto('http://localhost:8765/pos.html');await ap.waitForTimeout(300);ok(!(await ap.isVisible('#fs')),'installed app: no full-screen button (already full screen)');
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})();

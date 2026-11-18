// Owner 2026-11-18 ("penjualan sore tidak masuk ke dashboard"): a request to Google Sheets that never answers must not stop the
// tablet from sending later sales. Every request ends after NET_MS (90 s live; 1.5 s here) and the outbox is retried. Sample data.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const nav=async(pg,t)=>{await pg.click('#menuBtn');await pg.click('#menu [data-t='+t+']');await pg.waitForTimeout(200)};
const rows=(o,tab)=>{const t=o[tab];if(!t||!t.v.length)return[];const h=t.v[0];return t.v.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))};
(async()=>{
 const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:850}})).newPage();D.on('pageerror',e=>errs.push('dash: '+e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',min:3,aktif:'Active'});S.stores.push({id:'s1',name:'Toko A',type:'Physical store'});S.staff.push({id:'k1',name:'Rina',status:'Active'});save()});
 await until(async()=>{const o=await dump();return o.Stok&&o.Stok.v.length===2},10000,'master');
 const ctx=await br.newContext({viewport:{width:1280,height:800}});const A=await ctx.newPage();A.on('pageerror',e=>errs.push('pos: '+e.message));
 await A.goto(B+'/pos.html');await nav(A,'owner');await A.fill('#gpin','1234');await A.click('[data-a=gateOk]');await A.click('[data-a=osub][data-s=data]');
 await A.fill('#gsu',URL_);await A.fill('#gsp','9999');await A.click('[data-a=gsSave]');
 await until(()=>A.evaluate(()=>window.__wismir.S.products.length===1),10000,'tablet');await A.click('[data-a=ownerOff]').catch(()=>{});
 await A.evaluate(()=>{window.__netMs=1500});
 await nav(A,'home');await A.click('[data-a=tgStaff]');await A.fill('#cashStart','0');await A.click('[data-a=openShift]');await A.waitForTimeout(300);
 await until(()=>A.evaluate(()=>window.__wismir.S.outbox.length===0),10000,'idle');
 // the next request to the Sheet hangs forever (as on a dropped Wi-Fi), later ones work
 let hung=0;await ctx.route(/\/exec/,r=>{if(r.request().method()==='POST'&&!hung){hung=1;return}r.continue()});
 await A.click('#grid .pc');await A.fill('#pp','150000');await A.click('[data-a=addLine]');await A.click('[data-a=pay]');await A.click('[data-a=setMethod][data-m=Transfer]');await A.click('#sheet [data-a=x]');
 await until(()=>hung===1,5000,'hang');
 await until(()=>A.evaluate(()=>window.__wismir.S.outbox.length===0),20000,'sent after the hang').catch(async e=>{console.log(await A.evaluate(()=>JSON.stringify({ob:window.__wismir.S.outbox.length,x:1})));throw e});
 ok(hung===1,'the first send hung (no answer)');
 const k=rows(await dump(),'POS Kasir');
 ok(k.length===1&&+k[0].total===150000,'the sale still reached the Sheet without reopening the app: '+k.length+' receipt(s)');
 await D.evaluate(()=>pullSheets());
 ok(await D.evaluate(()=>liveSales().reduce((a,r)=>a+r.total,0))===150000,'and the dashboard sees it');
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

// Printer auto-connect: reconnects to the saved printer when the POS opens, when the printer is switched on
// later, and after the link drops; where Chrome cannot reconnect silently, one tap on the "Printer" button.
const {chromium,devices}=require('playwright');
const SAMPLE=require('./pos-sample')();
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=6000){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(150)}return false}
const INIT=([st,getDevices])=>{
 try{if(!localStorage.getItem('wismir_pos_v1'))localStorage.setItem('wismir_pos_v1',JSON.stringify(st))}catch(e){}
 try{delete Navigator.prototype.serial}catch(e){}
 window.__prRetryMs=500;window.__req=[];window.__chunks=[];
 const on=()=>localStorage.getItem('fakePrinterOn')!=='0';
 const ch={properties:{writeWithoutResponse:true},writeValueWithoutResponse:async b=>{window.__chunks.push(Array.from(b))}};
 const dev=new EventTarget();dev.id='dev1';dev.name='BT-P3200';
 dev.gatt={connected:false,connect:async()=>{await new Promise(r=>setTimeout(r,50));if(!on())throw new Error('NetworkError: device unreachable');dev.gatt.connected=true;return dev.gatt},
  disconnect(){if(dev.gatt.connected){dev.gatt.connected=false;dev.dispatchEvent(new Event('gattserverdisconnected'))}},
  getPrimaryService:async u=>{if(u==='000018f0-0000-1000-8000-00805f9b34fb')return{getCharacteristics:async()=>[ch]};throw new Error('NotFound')}};
 window.__dev=dev;
 const bt={requestDevice:async o=>{window.__req.push(o);return dev}};
 if(getDevices)bt.getDevices=async()=>[dev];
 Object.defineProperty(navigator,'bluetooth',{value:bt,configurable:true});
};
const chip=p=>p.evaluate(()=>{const b=document.querySelector('#prChip');return !b||b.style.display==='none'?'hidden':b.classList.contains('on')?'on':b.classList.contains('wait')?'wait':'off'});
(async()=>{
 const br=await chromium.launch();const errs=[];
 // ---- Chrome that CAN reconnect silently (getDevices) ----
 let ctx=await br.newContext({...devices['Galaxy Tab S4 landscape']});let p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 await ctx.addInitScript(INIT,[SAMPLE,true]);
 await p.goto('http://localhost:8765/pos.html');await sleep(300);
 ok(await chip(p)==='hidden','no Printer button while the printer mode is "Cetak biasa"');
 await p.tap('#menuBtn');await p.tap('#menu [data-t=owner]');await p.fill('#gpin','1234');await p.click('[data-a=gateOk]');await p.click('[data-a=osub][data-s=data]');
 await p.click('[data-a=prMode][data-v=bt]');await p.click('[data-a=prConnect]');
 ok(await until(async()=>await chip(p)==='on'),'first time: owner connects once in settings, Printer button turns green');
 // next morning: app opened again, printer already on -> connects without any tap
 await p.reload();await sleep(200);
 ok(await until(async()=>await chip(p)==='on'),'app opened again: connected automatically, no tap');
 ok((await p.evaluate(()=>window.__req.length))===0,'… without opening Chrome\'s printer picker');
 // printer still off when the app opens, switched on a bit later
 await p.evaluate(()=>localStorage.setItem('fakePrinterOn','0'));await p.reload();await sleep(1500);
 ok(await chip(p)==='off','printer off at opening: button shows not connected (amber)');
 await p.evaluate(()=>localStorage.setItem('fakePrinterOn','1'));
 ok(await until(async()=>await chip(p)==='on'),'printer switched on later: connects by itself');
 // link drops during the day (printer restarted)
 await p.evaluate(()=>{localStorage.setItem('fakePrinterOn','0');window.__dev.gatt.disconnect()});
 ok(await until(async()=>await chip(p)==='off'),'link dropped: button goes amber');
 await p.evaluate(()=>localStorage.setItem('fakePrinterOn','1'));
 ok(await until(async()=>await chip(p)==='on'),'… and reconnects by itself');
 await p.evaluate(()=>window.__chunks=[]);await p.tap('#menuBtn');await p.tap('#menu [data-t=owner]');await p.fill('#gpin','1234');await p.click('[data-a=gateOk]');await p.click('[data-a=osub][data-s=data]');await p.click('[data-a=prTest]');
 ok(await until(async()=>(await p.evaluate(()=>window.__chunks.length))>10),'printing works after the automatic reconnect');
 await ctx.close();
 // ---- Chrome that can NOT reconnect silently (no getDevices) ----
 ctx=await br.newContext({...devices['Galaxy Tab S4 landscape']});p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 const st=JSON.parse(JSON.stringify(SAMPLE));st.cfg.pr={mode:'bt',width:80,drawer:true,auto:true};st.cfg.prBle='dev1';st.cfg.prBleName='BT-P3200';
 await ctx.addInitScript(INIT,[st,false]);
 await p.goto('http://localhost:8765/pos.html');await sleep(1200);
 ok(await chip(p)==='off','no silent reconnect in this Chrome: Printer button is amber');
 await p.click('#prChip');
 ok(await until(async()=>await chip(p)==='on'),'one tap on the Printer button connects');
 const req=await p.evaluate(()=>JSON.stringify(window.__req[0]||{}));
 ok(req.includes('"name":"BT-P3200"'),'… and Chrome\'s list shows only the saved printer: '+req.slice(0,60));
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

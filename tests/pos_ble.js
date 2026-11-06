// "Bluetooth langsung" on a Chrome WITHOUT Web Serial: falls back to Bluetooth LE (Web Bluetooth).
const {chromium,devices}=require('playwright');
const SAMPLE=require('./pos-sample')();
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// printer: 'ble' = speaks BLE on service 18F0, 'classic' = shows up but has none of the printer services, 'none' = no Web Bluetooth at all
async function tablet(br,printer){
 const ctx=await br.newContext({...devices['Galaxy Tab S4 landscape']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(([st,printer])=>{
  try{if(!localStorage.getItem('wismir_pos_v1'))localStorage.setItem('wismir_pos_v1',JSON.stringify(st))}catch(e){}
  try{delete Navigator.prototype.serial}catch(e){}Object.defineProperty(navigator,'serial',{value:undefined,configurable:true});delete navigator.serial;
  window.__chunks=[];window.__req=null;
  const ch={properties:{writeWithoutResponse:true,write:false},writeValueWithoutResponse:async b=>{window.__chunks.push(Array.from(b))}};
  const gatt={connected:false,connect:async()=>{gatt.connected=true;return gatt},disconnect(){gatt.connected=false},
   getPrimaryService:async u=>{if(printer==='ble'&&u==='000018f0-0000-1000-8000-00805f9b34fb')return{getCharacteristics:async()=>[ch]};throw new Error('NotFound')}};
  const dev={id:'dev1',name:'BT-P3200',gatt};
  if(printer!=='none')Object.defineProperty(navigator,'bluetooth',{value:{requestDevice:async o=>{window.__req=o;return dev},getDevices:async()=>[dev]},configurable:true});
  else Object.defineProperty(navigator,'bluetooth',{value:undefined,configurable:true});
 },[SAMPLE,printer]);
 await p.goto('http://localhost:8765/pos.html');await p.waitForTimeout(400);
 await p.tap('#menuBtn');await p.tap('#menu [data-t=owner]');await p.fill('#gpin','1234');await p.click('[data-a=gateOk]');await p.click('[data-a=osub][data-s=data]');
 await p.click('[data-a=prMode][data-v=bt]');await p.waitForTimeout(200);
 return {p,errs};
}
const escText=b=>{let o='';for(let i=0;i<b.length;i++){const c=b[i];if(c===27){const n=b[i+1];i+=n===64?1:n===112?4:2;continue}if(c===29){i+=b[i+1]===86?3:2;continue}o+=c===10?'\n':c>=32&&c<127?String.fromCharCode(c):''}return o};
(async()=>{
 const br=await chromium.launch();
 // 1. BLE printer
 let {p,errs}=await tablet(br,'ble');
 ok(await p.evaluate(()=>!('serial' in navigator)||!navigator.serial),'this Chrome has no Web Serial (like the owner\'s tablet)');
 const diag=await p.textContent('#app');ok(diag.includes('Web Serial): tidak ada')&&diag.includes('Bluetooth LE: ada')&&diag.includes('dipakai: Bluetooth LE'),'settings show what this Chrome supports and which way is used');
 await p.click('[data-a=prConnect]');await sleep(300);
 ok((await p.textContent('#toast')).includes('Printer tersambung'),'Sambungkan printer works over Bluetooth LE');
 ok(JSON.stringify(await p.evaluate(()=>window.__req)).includes('000018f0'),'Chrome is asked for the usual receipt-printer services');
 await p.click('[data-a=prTest]');await sleep(600);
 const ch=await p.evaluate(()=>window.__chunks);const all=[].concat(...ch);
 ok(ch.length>1&&ch.every(c=>c.length<=180),'receipt sent in small pieces ('+ch.length+' pieces, max '+Math.max(...ch.map(c=>c.length))+' bytes)');
 ok(all[0]===27&&all[1]===64&&escText(all).includes('Tes cetak WISMIR')&&all.slice(-4).join()==='29,86,66,0','pieces join into one complete ESC/POS receipt (init … cut)');
 await p.evaluate(()=>window.__chunks=[]);await p.click('[data-a=prKick]');await sleep(300);
 ok([].concat(...await p.evaluate(()=>window.__chunks)).join()==='27,64,27,112,0,25,250','Tes buka laci over Bluetooth LE');
 // printer link drops, next print reconnects by itself
 await p.evaluate(()=>{window.__chunks=[]});await p.evaluate(()=>navigator.bluetooth.getDevices().then(d=>d[0].gatt.disconnect()));
 await p.click('[data-a=prTest]');await sleep(600);ok((await p.evaluate(()=>window.__chunks.length))>0,'reconnects automatically after the printer link dropped');
 ok(errs.length===0,'no page errors '+errs.join(';'));await p.context().close();
 // 2. classic-only printer (no BLE printer service)
 ({p,errs}=await tablet(br,'classic'));
 await p.click('[data-a=prConnect]');await sleep(300);
 ok((await p.textContent('#toast')).includes('RawBT'),'printer without Bluetooth LE: message points to RawBT');await p.context().close();
 // 3. no Bluetooth from the web at all
 ({p,errs}=await tablet(br,'none'));
 ok((await p.textContent('#app')).includes('pakai RawBT'),'no Bluetooth at all: settings say to use RawBT');
 await p.click('[data-a=prConnect]');await sleep(200);ok((await p.textContent('#toast')).includes('RawBT'),'… and so does Sambungkan printer');
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

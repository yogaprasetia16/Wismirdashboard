// POS on an Android tablet in landscape: rail buttons react instantly, owner PIN sheet survives the tap, tap sounds.
const {chromium,devices}=require('playwright');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const ctx=await br.newContext({...devices['Galaxy Tab S4 landscape']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 // count sounds instead of playing them
 await p.addInitScript(()=>{window.__snd=[];class FakeAC{constructor(){this.state='running';this.currentTime=0;this.sampleRate=8000;this.destination={}}
  resume(){}createBuffer(c,n){return{getChannelData:()=>new Float32Array(n)}}
  node(k){const n={connect:x=>x||n,start(){window.__snd.push(k)},stop(){},frequency:{value:0,setValueAtTime(){}},Q:{value:0},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},type:''};return n}
  createBufferSource(){return this.node('tap')}createBiquadFilter(){return this.node('f')}createGain(){return this.node('g')}createOscillator(){return this.node('tone')}}
  window.AudioContext=FakeAC;});
 await p.goto('http://localhost:8765/pos.html');await p.waitForTimeout(500);
 const sz=await p.evaluate(()=>{const r=document.querySelector('#side button[data-t=stock]').getBoundingClientRect();return Math.round(r.width)});
 ok(sz>=54,'rail buttons are at least 54 px in landscape: '+sz);
 ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.panel')).backdropFilter==='none'),'no expensive blur on panels');
 const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
 // highlight time: from finger down to the button showing as active
 for(const t of ['stock','rc','home']){
  const ms=await p.evaluate(t=>new Promise(res=>{const b=document.querySelector('#side button[data-t='+t+']'),r=b.getBoundingClientRect();const t0=performance.now();
   b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:r.left+5,clientY:r.top+5}));res(b.classList.contains('on')?Math.round(performance.now()-t0):-1)}),t);
  ok(ms>=0&&ms<50,'"'+t+'" lights up immediately on touch ('+ms+' ms at 6x slower CPU)');
  await p.waitForTimeout(500);
  ok(await p.evaluate(t=>document.querySelector('#side button[data-t='+t+']').classList.contains('on')&&!!document.querySelector('#app').textContent,t),'… and the "'+t+'" page opens');
 }
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 await p.tap('#side [data-t=stock]');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.querySelector('#side button.on').dataset.t==='stock'),'real touch tap navigates');
 await p.tap('#own');await p.waitForTimeout(400);
 ok(await p.isVisible('#gpin'),'owner button opens the PIN sheet and it stays open');
 ok(await p.evaluate(()=>window.__snd.filter(x=>x==='tap').length>=2),'tap sound plays on button press');
 await p.fill('#gpin','0000');await p.click('[data-a=gateOk]');
 ok(await p.evaluate(()=>window.__snd.includes('tone')),'error tone on wrong PIN');
 await p.fill('#gpin','1234');await p.click('[data-a=gateOk]');await p.waitForTimeout(300);
 await p.click('[data-a=osub][data-s=data]');await p.click('[data-a=sound][data-v="0"]');
 const before=await p.evaluate(()=>window.__snd.length);await p.click('[data-a=osub][data-s=report]');
 ok(await p.evaluate(b=>window.__snd.length===b,before),'Owner > Data > Suara tombol: Mati silences taps');
 await p.click('[data-a=osub][data-s=data]');await p.click('[data-a=sound][data-v="1"]');
 ok(await p.evaluate(()=>window.__wismir.S.cfg.sound===true),'sound can be switched back on');
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

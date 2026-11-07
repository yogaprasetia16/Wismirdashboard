// POS on an Android tablet in landscape: logo menu navigation, price sheet layout, tap sounds, thermal printer + cash drawer.
const {chromium,devices}=require('playwright');
// printable text of an ESC/POS job, with printer commands removed
const escText=b=>{let o='';for(let i=0;i<b.length;i++){const c=b[i];if(c===27){const n=b[i+1];i+=n===64?1:n===112?4:2;continue}if(c===29){i+=b[i+1]===86?(b[i+2]<2?2:3):2;continue}o+=c===10?'\n':c>=32&&c<127?String.fromCharCode(c):''}return o};
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const ctx=await br.newContext({...devices['Galaxy Tab S4 landscape']});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 const SAMPLE=require('./pos-sample')();
 await p.addInitScript(st=>{try{if(!localStorage.getItem('wismir_pos_v1'))localStorage.setItem('wismir_pos_v1',JSON.stringify(st))}catch(e){}},SAMPLE);
 await p.addInitScript(()=>{
  // count sounds instead of playing them
  window.__snd=[];class FakeAC{constructor(){this.state='running';this.currentTime=0;this.sampleRate=8000;this.destination={}}
   resume(){}createBuffer(c,n){return{getChannelData:()=>new Float32Array(n)}}
   node(k){const n={connect:x=>x||n,start(){window.__snd.push(k)},stop(){},frequency:{value:0,setValueAtTime(){}},Q:{value:0},gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(){}},type:''};return n}
   createBufferSource(){return this.node('tap')}createBiquadFilter(){return this.node('f')}createGain(){return this.node('g')}createOscillator(){return this.node('tone')}}
  window.AudioContext=FakeAC;
  // fake Bluetooth serial printer: records every byte written
  window.__printed=[];window.__reqOpts=null;const port={writable:null,async open(o){window.__baud=o.baudRate;this.writable={getWriter:()=>({write:async b=>{window.__printed.push(Array.from(b))},releaseLock(){}})}},async close(){this.writable=null}};
  let granted=false;Object.defineProperty(navigator,'serial',{value:{getPorts:async()=>granted?[port]:[],requestPort:async o=>{window.__reqOpts=o;granted=true;return port}}});
  window.__urls=[];window.__openUrl=u=>window.__urls.push(u);
 });
 await p.goto('http://localhost:8765/pos.html');await p.waitForTimeout(500);
 // ---------- navigation ----------
 ok(!(await p.$('#side'))&&!(await p.$('#bot')),'side rail and bottom bar are gone');
 ok((await p.textContent('#menuBtn')).includes('Shift'),'logo shows the current page (Shift)');
 const cdp=await ctx.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
 const ms=await p.evaluate(()=>{const b=document.querySelector('#menuBtn'),t0=performance.now();b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0}));return document.querySelector('#menu').classList.contains('open')?Math.round(performance.now()-t0):-1});
 ok(ms>=0&&ms<50,'menu opens immediately on touch ('+ms+' ms at 6x slower CPU)');
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
 await p.evaluate(()=>document.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0})));
 ok(!(await p.isVisible('#menu')),'touching outside closes the menu');
 const items=await (async()=>{await p.tap('#menuBtn');await p.waitForTimeout(200);return p.$$eval('#menu .mi',b=>b.map(x=>x.textContent.trim()))})();
 ok(items.join()==='Shift,Kasir,Struk,Stok,Owner','menu items: '+items.join(', '));
 const h=await p.$eval('#menu .mi',b=>b.getBoundingClientRect().height);ok(h>=56,'menu items are big touch targets ('+h+' px)');
 await p.tap('#menu [data-t=stock]');await p.waitForTimeout(300);
 ok(!(await p.isVisible('#menu'))&&(await p.textContent('#menuBtn')).includes('Stok')&&(await p.textContent('#app')).includes('Stok inventaris'),'tapping "Stok" closes the menu and opens Stok');
 await p.tap('#menuBtn');await p.tap('#menu [data-t=owner]');await p.waitForTimeout(400);
 ok(await p.isVisible('#gpin'),'menu → Owner opens the PIN sheet and it stays open');
 await p.fill('#gpin','0000');await p.click('[data-a=gateOk]');ok(await p.evaluate(()=>window.__snd.includes('tone')),'error tone on wrong PIN');
 ok(await p.evaluate(()=>window.__snd.filter(x=>x==='tap').length>=3),'tap sound on button presses');
 await p.fill('#gpin','1234');await p.click('[data-a=gateOk]');await p.waitForTimeout(300);
 await p.click('#menuBtn');ok((await p.textContent('#menu')).includes('aktif'),'menu shows owner mode is active');await p.click('#menuBtn');
 // ---------- printer settings ----------
 await p.click('[data-a=osub][data-s=data]');
 await p.click('[data-a=prMode][data-v=bt]');await p.click('[data-a=prConnect]');await p.waitForTimeout(200);
 const ro=await p.evaluate(()=>JSON.stringify(window.__reqOpts));
 ok(ro.includes('00001101-0000-1000-8000-00805f9b34fb'),'Sambungkan printer asks Chrome for a Bluetooth serial (SPP) printer');
 await p.click('[data-a=prTest]');await p.waitForTimeout(200);
 let pr=await p.evaluate(()=>window.__printed.pop());
 const txt=escText(pr);
 ok(pr[0]===0x1b&&pr[1]===0x40&&txt.includes('Tes cetak WISMIR')&&pr.slice(-6).join()==='27,100,5,29,86,1','Tes cetak sends ESC/POS (init, text, feed + cut GS V 1)');
 ok(txt.split('\n').every(l=>l.length<=48),'80 mm receipt lines fit 48 characters: '+Math.max(...txt.split('\n').map(l=>l.length)));
 await p.click('[data-a=prKick]');await p.waitForTimeout(200);
 pr=await p.evaluate(()=>window.__printed.pop());ok(pr.join()==='27,64,27,112,0,25,250','Tes buka laci sends the drawer pulse (ESC p 0 25 250)');
 // receipt texts on several lines (address/info and footer)
 await p.fill('#rca','Jl. Mawar No. 1, Bandung\nWA 0812-3456-7890\nIG @wismir');await p.fill('#rcf','Terima kasih\nBarang yang sudah dibeli tidak dapat ditukar');await p.click('[data-a=rcSave]');
 ok(await p.evaluate(()=>document.querySelector('#rca').tagName==='TEXTAREA'&&window.__wismir.S.cfg.rc.addr.split('\n').length===3),'address/info is a multi-line box and keeps its 3 lines');
 await p.click('[data-a=prTest]');await p.waitForTimeout(200);
 const rt=escText(await p.evaluate(()=>window.__printed.pop())).split('\n').map(l=>l.trim());
 ok(rt.includes('Jl. Mawar No. 1, Bandung')&&rt.includes('WA 0812-3456-7890')&&rt.includes('IG @wismir'),'printed receipt: each address line on its own line');
 ok(rt.includes('Terima kasih')&&rt.includes('Barang yang sudah dibeli tidak dapat ditukar'),'printed receipt: footer on two lines');
 // ---------- sale: price sheet layout, auto print + drawer ----------
 await p.click('[data-a=ownerOff]');
 await p.tap('#menuBtn');await p.tap('#menu [data-t=home]');await p.waitForTimeout(300);
 await p.click('[data-a=tgStaff]');await p.fill('#cashStart','0');await p.click('[data-a=openShift]');await p.waitForTimeout(300);
 // a product that already has frequently used prices (the case that pushed the button down)
 const pid=await p.evaluate(()=>{const S=window.__wismir.S,id=S.products[0].id;S.prices[id]={150000:{n:5,t:1},175000:{n:3,t:2},200000:{n:2,t:3},250000:{n:1,t:4},99000:{n:1,t:5}};return id});
 await p.click('.pc[data-id="'+pid+'"]');await p.waitForTimeout(300);
 ok(await p.isVisible('#pchips'),'price chips are shown');
 ok((await p.$$('#pchips .chip')).length===3,'at most 3 frequently used prices (5 in history)');
 const lay=await p.evaluate(()=>{const b=document.querySelector('[data-a=addLine]').getBoundingClientRect(),k=document.querySelector('.np').getBoundingClientRect(),sh=document.querySelector('#sheet').getBoundingClientRect();return{side:b.left>k.right,visible:b.bottom<=Math.min(innerHeight,sh.bottom)}});
 ok(lay.side,'"Tambah ke keranjang" sits beside the keypad, not below');
 ok(lay.visible,'… and is visible without scrolling, even with price chips');
 ok(await p.evaluate(()=>{const sh=document.querySelector('#sheet').getBoundingClientRect();return [...document.querySelectorAll('.pcr button,.pcr input')].every(e=>{const r=e.getBoundingClientRect();return r.left>=sh.left&&r.right<=sh.right})}),'quantity − / + and field fit inside the sheet');
 await p.screenshot({path:'price-sheet.png'});
 await p.click('#pchips .chip');await p.click('[data-a=addLine]');
 await p.click('[data-a=pay]');
 ok(!(await p.isVisible('#payBtn')),'no "Selesaikan transaksi" button for a single payment');
 const cash=await p.$$eval('#pchips2 .chip',b=>b.map(x=>x.textContent));ok(cash.length<=3&&cash[0]==='Uang pas','at most 3 cash buttons: '+cash.join(', '));
 await p.click('#pchips2 .chip >> nth=1');await p.waitForTimeout(300);
 ok((await p.textContent('#sheet')).includes('Transaksi berhasil')&&(await p.textContent('#sheet')).includes('Kembalian'),'tapping a cash amount finishes the sale at once and shows the change');
 ok(await p.evaluate(()=>window.__snd.includes('tone')),'chime on completed sale');
 pr=await p.evaluate(()=>window.__printed.pop());
 ok(pr&&pr.slice(0,7).join()==='27,64,27,112,0,25,250','cash sale: receipt printed automatically and drawer opened first');
 await p.click('#sheet [data-a=x]');
 // non-cash sale: receipt but no drawer
 await p.click('.pc[data-id="'+pid+'"]');await p.click('#pchips .chip');await p.click('[data-a=addLine]');await p.click('[data-a=pay]');
 await p.click('[data-a=setMethod][data-m=Transfer]');await p.waitForTimeout(300);ok((await p.textContent('#sheet')).includes('Transaksi berhasil'),'tapping Transfer finishes the sale at once');
 pr=await p.evaluate(()=>window.__printed.pop());ok(pr&&!pr.slice(0,8).join().includes('27,112'),'transfer sale: receipt printed, drawer stays closed');
 await p.click('#sheet [data-a=x]');
 // cash in opens drawer
 await p.tap('#menuBtn');await p.tap('#menu [data-t=home]');await p.waitForTimeout(300);
 await p.click('[data-a=kas][data-t=in]');await p.fill('#kv','5000');await p.click('[data-a=kasSave]');await p.waitForTimeout(200);
 pr=await p.evaluate(()=>window.__printed.pop());ok(pr&&pr.join().includes('27,112,0,25,250'),'Tambah kas opens the drawer');
 // RawBT fallback builds an intent link
 await p.evaluate(()=>{const S=window.__wismir.S;S.cfg.pr=Object.assign({},S.cfg.pr,{mode:'rawbt'})});
 await p.evaluate(()=>{document.querySelector('[data-a=kas][data-t=out]').click()});await p.fill('#kv','1000');await p.click('[data-a=kasSave]');await p.waitForTimeout(200);
 const u=await p.evaluate(()=>window.__urls.pop()||'');ok(u.startsWith('intent:base64,')&&u.includes('package=ru.a402d.rawbtprinter'),'RawBT mode sends the job to the RawBT app');
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

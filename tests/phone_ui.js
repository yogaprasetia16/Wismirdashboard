// Phone: expense Category shows a visible, searchable list (datalists are not a list on iPhone) and still takes a new
// category; sliding a finger along the bottom bar moves the yellow circle and opens the tab where the finger lifts.
const {chromium,devices}=require('playwright');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{const br=await chromium.launch();const errs=[];
 const p=await (await br.newContext({...devices['iPhone 13']})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8765/dashboard.html');await p.waitForTimeout(300);
 await p.evaluate(()=>{S.tx.push({id:'a1',jenis:'Expense',tanggal:today(),kategori:'Store rent',jumlah:100,catatan:''},{id:'a2',jenis:'Expense',tanggal:today(),kategori:'Porter',jumlah:20,catatan:''});tab='ops';ops='exp';render()});
 const vis0=await p.evaluate(()=>{const b=document.querySelector('#app .seg button.on'),B=b.getBoundingClientRect();return (b.getAttribute('aria-label')||b.textContent)+':'+(B.left>=0&&B.right<=innerWidth)}); // icon tabs since 2026-11-14 fit without scrolling
 ok(vis0==='Expense:true','the active Operational tab (Expense) is scrolled into view on a phone');
 await p.tap('#cta');
 await p.screenshot({path:'phone-combo-form.png'});
 const list=await p.$$eval('#sheet .cmbo',b=>b.filter(x=>x.offsetParent).map(x=>x.dataset.v));
 ok(list.includes('Store rent')&&list.includes('Porter')&&await p.isVisible('#sheet .cmbl'),'category list is visible without typing: '+list.slice(0,6).join(', '));
 await p.fill('#sheet [data-k=kategori]','por');
 const vis=await p.$$eval('#sheet .cmbo',b=>b.filter(x=>x.style.display!=='none').map(x=>x.dataset.v));
 ok(vis.join()==='Porter','typing searches the list: '+vis.join(', '));
 await p.tap('#sheet .cmbo[data-v="Porter"]');
 ok(await p.$eval('#sheet [data-k=kategori]',e=>e.value)==='Porter','tapping a category fills it in');
 await p.fill('#sheet [data-k=kategori]','Listrik');
 ok((await p.textContent('#sheet .cmbn')).includes('New category: Listrik'),'a new category is announced');
 await p.fill('#sheet [data-k=jumlah]','250000');await p.tap('#ok');
 ok(await p.evaluate(()=>S.tx.some(t=>t.kategori==='Listrik'&&t.jumlah==250000)),'new category saved');
 await p.screenshot({path:'phone-combo.png'});
 // slide along the bottom bar from Operational to Reminders
 const slide=async(from,to)=>p.evaluate(([f,t])=>{const bar=document.querySelector('#bot'),bf=bar.querySelector('[data-t="'+f+'"]').getBoundingClientRect(),bt=bar.querySelector('[data-t="'+t+'"]').getBoundingClientRect(),y=bf.top+bf.height/2;
  const mk=(type,x)=>{const tc=new Touch({identifier:1,target:bar,clientX:x,clientY:y});bar.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[tc],changedTouches:[tc],bubbles:true,cancelable:true}))};
  const x0=bf.left+bf.width/2,x1=bt.left+bt.width/2;mk('touchstart',x0);for(let k=1;k<=10;k++)mk('touchmove',x0+(x1-x0)*k/10);
  const mid=Math.round(document.querySelector('#bot .ind').getBoundingClientRect().left+19);mk('touchend',x1);return mid},[from,to]);
 await p.evaluate(()=>{close();tab='ops';render()});await p.waitForTimeout(500);
 await slide('ops','task');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>tab==='task'),'sliding from Operational to Reminders opens Reminders');
 const r=await p.evaluate(()=>{const i=document.querySelector('#bot .ind').getBoundingClientRect(),b=document.querySelector('#bot button.on').getBoundingClientRect();return Math.abs((i.left+i.width/2)-(b.left+b.width/2))<2&&b===b&&document.querySelector('#bot button.on').dataset.t==='task'});
 ok(r,'the yellow circle ends on Reminders');
 await slide('task','set');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>tab==='set'),'sliding to the right works too (Settings)');
 const th=await p.evaluate(()=>document.documentElement.dataset.theme||'');await slide('set','theme');await p.waitForTimeout(300);
 ok(await p.evaluate(th=>(document.documentElement.dataset.theme||'')===th&&tab==='set',th),'sliding onto the dark-mode button does not switch theme or tab');
 await p.tap('#bot [data-t="home"]');await p.waitForTimeout(300);ok(await p.evaluate(()=>tab==='home'),'a plain tap still works');
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

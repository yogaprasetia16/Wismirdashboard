// Phone bottom bar: the yellow indicator behind the active icon is a circle (not an oval) and centred on the icon.
const {chromium,devices}=require('playwright');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{const br=await chromium.launch();const errs=[];
 for(const dev of ['iPhone 13','iPhone SE','Pixel 7']){
  const p=await (await br.newContext({...devices[dev]})).newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8765/dashboard.html');await p.waitForTimeout(300);
  for(const t of ['task','ops']){await p.evaluate(t=>{tab=t;render()},t);await p.waitForTimeout(500);
   const r=await p.evaluate(()=>{const i=document.querySelector('#bot .ind').getBoundingClientRect(),b=document.querySelector('#bot button.on').getBoundingClientRect();return{w:Math.round(i.width),h:Math.round(i.height),dx:Math.round((i.left+i.width/2)-(b.left+b.width/2)),dy:Math.round((i.top+i.height/2)-(b.top+b.height/2))}});
   ok(r.w===r.h&&r.w>=30&&Math.abs(r.dx)<=1&&Math.abs(r.dy)<=1,dev+' '+t+': indicator is a centred circle '+JSON.stringify(r));}
  if(dev==='iPhone 13')await p.screenshot({path:'nav-phone.png'});
 }
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

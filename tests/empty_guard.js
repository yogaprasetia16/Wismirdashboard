// Safety net: if a dashboard tab comes back EMPTY from the Sheet (cleared by mistake / a failed write) while this device
// holds many rows it had already seen on the Sheet, the device keeps them and sends them back; other devices then get
// them again. Small tabs and normal deletes are not affected. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const nexp=async()=>{const k=(await dump()).Keuangan.v,h=k[0];return k.filter(r=>r[h.indexOf('jenis')]==='Expense').length};
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const errs=[];
 const conn=async()=>{const p=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();p.on('pageerror',e=>errs.push(e.message));await p.goto(B+'/dashboard.html');await p.evaluate(()=>{tab='set';render()});await p.fill('#cu',URL_);await p.fill('#cp','9999');await p.evaluate(()=>saveCfg());await until(()=>p.evaluate(()=>S.cfg.pulled===1),15000,'pull');return p};
 const L=await conn();
 const rows=['Tanggal\tKategori\tJumlah\tCatatan'];for(let i=1;i<=30;i++)rows.push(String(1+i%27).padStart(2,'0')+'/0'+(1+i%9)+'/2025\tstaff\t'+(100000+i)+'\tx'+i);
 await L.evaluate(()=>{tab='tx';fv='tx';txf='Expense';render()});await L.click('text=Import expenses');await L.fill('#etext',rows.join('\n'));await L.click('#ego');
 await until(async()=>await nexp()===30,15000,'pushed');ok(true,'30 expenses on the Sheet');
 // a phone that has loaded them too
 const P=await conn();ok(await P.evaluate(()=>S.tx.filter(t=>t.jenis==='Expense').length===30),'second device loaded 30');
 // the Sheet's Keuangan tab gets emptied (e.g. cleared by hand)
 const g=await (await fetch(URL_+'?pin=9999')).json();
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',base:String(g.ver),data:{Keuangan:[]}})});
 ok(await nexp()===0,'Sheet tab Keuangan is now empty');
 await L.evaluate(()=>pullSheets());
 await until(async()=>await nexp()===30,15000,'sent back');
 ok(await L.evaluate(()=>S.tx.filter(t=>t.jenis==='Expense').length===30),'laptop kept its 30 expenses');
 await until(()=>L.evaluate(()=>/came back empty/.test(status)&&/sent back/.test(status)),8000,'status').catch(()=>{});const st=await L.evaluate(()=>status);ok(st.includes('came back empty')&&st.includes('sent back'),'laptop says the tab came back empty and was sent back: '+st);
 ok(await nexp()===30,'the 30 expenses are back on the Sheet');
 await P.evaluate(()=>pullSheets());await sleep(1500);
 ok(await P.evaluate(()=>S.tx.filter(t=>t.jenis==='Expense').length===30),'second device still has them after loading');
 // normal deletes still work: delete one on the laptop, the phone follows
 await L.evaluate(()=>{const id=S.tx.find(t=>t.jenis==='Expense').id;S.tx=S.tx.filter(t=>t.id!==id);save()});
 await until(async()=>await nexp()===29,15000,'delete synced');
 await P.evaluate(()=>pullSheets());await sleep(1500);
 ok(await P.evaluate(()=>S.tx.filter(t=>t.jenis==='Expense').length===29),'a normal delete still reaches the other device');
 // a device with only a few rows (under 10) accepts an empty tab (e.g. the owner deleted them all)
 const g2=await (await fetch(URL_+'?pin=9999')).json();
 await fetch(URL_,{method:'POST',body:JSON.stringify({pin:'9999',base:String(g2.ver),data:{Tugas:[]}})});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

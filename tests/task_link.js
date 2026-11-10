// Reminders: optional Link (a website or a page of the dashboard); the reminder row shows a link button that opens it.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const errs=[];const ctx=await br.newContext({viewport:{width:1280,height:900}});
 const D=await ctx.newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 await D.evaluate(()=>{tab='task';render()});
 const add=async(name,link)=>{await D.evaluate(()=>addTask('Marketing'));await D.fill('#sheet [data-k=judul]',name);await D.fill('#sheet [data-k=tempo]',await D.evaluate(()=>today()));if(link!=null)await D.fill('#sheet [data-k=link]',link);await D.click('#ok')};
 await D.evaluate(()=>addTask('Marketing'));
 const labels=await D.$$eval('#sheet .f label',l=>l.map(x=>x.textContent));
 ok(labels.join()==='Reminder,Division,Date,Link (optional),Repeat,Repeat every,Unit','form has a Link field after Date: '+labels.join(', '));
 const sug=await D.$$eval('#dl-link option',o=>o.map(x=>x.value));
 ok(sug.includes('Finance › Income')&&sug.includes('Finance › Expense')&&sug.includes('Operational › Stock')&&sug.includes('Production › Supplier'),'Link suggests dashboard pages ('+sug.length+')');
 await D.click('#no');
 await add('Daily discount shopee','seller.shopee.co.id');
 await add('Check supplier bill','Production › Supplier');
 await add('No link',null);
 await add('Bad link','javascript:alert(1)');
 ok(await D.isVisible('#sheet')&&(await D.textContent('#err')).includes('Enter a website'),'an invalid link is refused with a message');await D.click('#no');
 ok((await D.$$('[data-link]')).length===2,'link button only on reminders with a valid link (website or page)');
 // website opens in a new tab
 const id1=await D.evaluate(()=>S.tasks.find(t=>t.judul==='Daily discount shopee').id);
 ok(await D.$eval('[data-link="'+id1+'"]',e=>e.title)==='https://seller.shopee.co.id','website without https:// gets it');
 const [pop]=await Promise.all([ctx.waitForEvent('page'),D.click('[data-link="'+id1+'"]')]);
 ok(!!pop,'website opens in a new tab');
 await pop.close().catch(()=>{});
 ok(!(await D.isVisible('#sheet')),'tapping the link button does not open the edit form');
 // page link navigates inside the dashboard
 const id2=await D.evaluate(()=>S.tasks.find(t=>t.judul==='Check supplier bill').id);
 await D.click('[data-link="'+id2+'"]');
 ok(await D.evaluate(()=>tab==='prod'&&pt==='supp'),'page link opens Production › Supplier');
 // overview list also shows the button
 await D.evaluate(()=>{tab='home';render();showKpi('today')});
 ok((await D.$$('#pp [data-link]')).length===2,'link buttons also in the Overview "Reminders today" list');
 await until(async()=>{const o=await dump();const h=o.Tugas.v[0];return h.includes('link')&&o.Tugas.v.some(r=>r[h.indexOf('link')]==='Production › Supplier')},10000,'synced');
 ok(true,'link saved in the Tugas tab (column link)');
 await D.evaluate(()=>{tab='task';render()});await D.screenshot({path:'task-link.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

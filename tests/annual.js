// Operational > Expense > Annually (owner 2026-11-14): an expense paid at once for a range of months (Category, Note,
// From month, To month, Amount) is spread evenly over the months (one expense per month, rest on the last month);
// editing rewrites the months, deleting removes them; saved in the Sheet tab Annual. Sample data is made up.
const {chromium}=require('playwright');
const B='http://localhost:8765',URL_=B+'/exec';
const dump=async()=>(await (await fetch(B+'/dump')).json()).o;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=10000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(250)}throw new Error('timeout '+label)}
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const rows=(o,tab)=>{const t=o[tab];if(!t||!t.v.length)return[];const h=t.v[0];return t.v.slice(1).map(r=>Object.fromEntries(h.map((k,i)=>[k,r[i]])))};
(async()=>{const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',URL_);await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'pull');
 await D.evaluate(()=>{tab='ops';ops='exp';render()});
 const Y=await D.evaluate(()=>today().slice(0,4));
 ok(await D.isVisible('#annBtn')&&await D.isVisible('#recBtn'),'"Annually" button beside "Recurring"');
 await D.click('#annBtn');await D.click('#annAdd');
 const f=await D.$$eval('#sheet .f label',l=>l.map(x=>x.textContent));
 ok(f.join()==='Category,Note,From month,To month,Amount for the whole period (Rp)','form: '+f.join(', '));
 ok(await D.$eval('#sheet [data-k=dari]',e=>e.value)==='January '+Y&&await D.$eval('#sheet [data-k=sampai]',e=>e.value)==='December '+Y,'default range: January – December of this year');
 await D.fill('#sheet [data-k=kategori]','store rent');await D.fill('#sheet [data-k=catatan]','Toko A');await D.fill('#sheet [data-k=jumlah]','100000000');await D.click('#ok');
 const gen=()=>D.evaluate(()=>S.tx.filter(t=>String(t.id).startsWith('a-')).map(t=>t.tanggal+':'+t.jumlah).sort());
 let g=await gen();
 ok(g.length===12&&g[0]===Y+'-01-01:8333333'&&g[11]===Y+'-12-01:8333337','12 monthly expenses of 8.333.333 (last one 8.333.337, total 100.000.000): '+g[0]+' … '+g[11]);
 ok(await D.evaluate(()=>S.tx.filter(t=>String(t.id).startsWith('a-')).reduce((a,t)=>a+t.jumlah,0))===100000000,'months add up to the total');
 ok((await D.textContent('#sheet')).includes('12 months'),'annual list shows the range and months');
 await until(async()=>{const o=await dump();return rows(o,'Annual').length===1&&rows(o,'Keuangan').filter(r=>String(r.id).startsWith('a-')).length===12},10000,'synced');
 ok(true,'saved on the Sheet: tab Annual + 12 expenses');
 // the month view shows it
 await D.click('#no');await D.evaluate(Y=>{OM=Y+'-03';render()},Y);
 ok((await D.textContent('#app')).includes('annual'),'March shows the annual expense, marked "annual"');
 // edit: Jan–Mar, 1.000.000
 await D.click('#annBtn');await D.click('#sheet [data-aid]');
 await D.selectOption('#sheet [data-k=sampai]','March '+Y);await D.fill('#sheet [data-k=jumlah]','1000000');await D.click('#ok');
 g=await gen();ok(g.join()===[Y+'-01-01:333333',Y+'-02-01:333333',Y+'-03-01:333334'].join(),'edited to Jan–Mar 1.000.000: 3 months, others removed: '+g.join());
 // wrong range refused
 await D.click('#annOld');await D.click('#sheet [data-aid]');await D.selectOption('#sheet [data-k=dari]','May '+Y);await D.click('#ok');
 ok((await D.textContent('#err')).includes('To month'),'"To month" before "From month" is refused');
 await D.click('#no');
 // delete
 await D.click('#annBtn');await D.click('#annOld');await D.click('#sheet [data-aid]');await D.click('#rm');await D.click('#rm');
 ok((await gen()).length===0&&await D.evaluate(()=>S.ann.length===0),'deleting removes the item and its monthly expenses');
 await until(async()=>{const o=await dump();return rows(o,'Annual').length===0&&!rows(o,'Keuangan').some(r=>String(r.id).startsWith('a-'))},10000,'deleted on Sheet');
 ok(true,'… also on the Sheet');
 // finished items are folded away (owner 2026-11-14)
 await D.evaluate(Y=>{S.ann.push({id:'old1',kategori:'Sewa toko',jumlah:1200,catatan:'',dari:(+Y-1)+'-01',sampai:(+Y-1)+'-12'},{id:'new1',kategori:'Sewa toko',jumlah:2400,catatan:'',dari:Y+'-01',sampai:Y+'-12'});annSync(S.ann[0]);annSync(S.ann[1]);save();close();tab='ops';ops='exp';render()},Y);await D.waitForTimeout(400);
 ok((await D.textContent('#annBtn')).includes('· 1'),'button counts only running items');
 await D.click('#annBtn');
 ok((await D.$$('#sheet [data-aid]')).length===1&&(await D.textContent('#annOld')).includes('Show finished (1)'),'last year\'s item is hidden under "Show finished (1)"');
 await D.click('#annOld');ok((await D.$$('#sheet [data-aid]')).length===2,'"Show finished" lists it again');
 await D.click('#no');
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

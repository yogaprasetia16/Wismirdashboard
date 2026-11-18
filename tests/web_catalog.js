// Marketing › Website: manage the wismir.id catalog (products + photos) from the dashboard.
// Runs the real Code.gs (v14 catalog actions) in the fake Apps Script server, with an in-memory catalog Sheet and a fake GitHub.
// Real Google Sheets / GitHub are not touched (they need the owner's accounts): say so when reporting.
const {chromium}=require('playwright');
const B='http://localhost:8765';
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=8000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(150)}throw new Error('timeout '+label)}
const dump=async()=>(await fetch(B+'/dump-cat')).json();
const post=async o=>(await fetch(B+'/exec',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(o)})).json();
(async()=>{
 await fetch(B+'/reset-cat');
 const br=await chromium.launch();const errs=[];const ctx=await br.newContext({viewport:{width:1280,height:900}});
 const D=await ctx.newPage();D.on('pageerror',e=>errs.push(e.message));
 const catPosts=[];D.on('request',r=>{if(r.method()==='POST'&&/"action":"cat/.test(r.postData()||''))catPosts.push(JSON.parse(r.postData()).action)});
 await D.goto(B+'/dashboard.html');
 // 1. Marketing: two icon tabs, campaigns first; Website without Sheets connected
 await D.evaluate(()=>{tab='mkt';render()});
 ok(await D.$$eval('#app .seg.ico button',b=>b.map(x=>x.title).join())==='Campaigns,Website','Marketing has icon tabs Campaigns and Website');
 ok((await D.textContent('#app')).includes('Spent')&&await D.isVisible('#cta'),'Campaigns is the default and keeps its New campaign button');
 await D.click('#app .seg.ico button[title=Website]');
 ok((await D.textContent('#app')).includes('Connect Google Sheets in Settings')&&!(await D.isVisible('#cta')),'without Google Sheets it asks to connect it (header button hidden)');
 await D.evaluate(()=>{tab='set';render()});
 ok(!(await D.$('#cw')),'Settings has no separate catalog URL or password: the dashboard URL and PIN are used (one place)');
 await D.fill('#cu',B+'/exec');await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 // 2. list (real Code.gs, catalog Sheet)
 await D.evaluate(()=>{tab='mkt';mk='camp';render()});await D.click('#app .seg.ico button[title=Website]');
 await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'list');
 ok(catPosts[0]==='catList','the list is read with action catList on the dashboard URL');
 ok(await D.isVisible('#webAdd')&&!(await D.isVisible('#cta')),'round + in the tab row, no header button');
 const t0=await D.$eval('#weblist .row',e=>e.textContent);ok(t0.includes('Gamis bordir')&&t0.includes('3 photos')&&t0.includes('NEW'),'row shows name, photo count and NEW: '+t0.replace(/\s+/g,' '));
 await D.fill('#webq','kulot');ok((await D.$$('#weblist .row')).length===1,'search filters the list');await D.fill('#webq','');
 // 3. edit: remove b.jpg (only this product), remove c.jpg (shared with Kulot), add a big photo, move it first, change fields
 await D.click('[data-wr="2"]');
 const labels=await D.$$eval('#sheet .f label',l=>l.map(x=>x.textContent));
 ok(labels.includes('Product name')&&labels.includes('Photos (first = main photo)')&&labels.includes('Mark as Sale'),'edit form has the catalog fields: '+labels.join(' | '));
 ok((await D.$$('#wpg .wph')).length===3,'3 photos shown');
 await D.click('[data-wx="1"]');await D.click('[data-wx="1"]');
 await D.evaluate(()=>{const c=document.createElement('canvas');c.width=2400;c.height=3200;const x=c.getContext('2d');x.fillStyle='#c33';x.fillRect(0,0,2400,3200);for(let i=0;i<4000;i++){x.fillStyle='rgb('+(i*37%255)+','+(i*91%255)+','+(i*53%255)+')';x.fillRect(i*7%2400,i*13%3200,40,40)}window.__j=c.toDataURL('image/jpeg',.9)});
 const buf=Buffer.from((await D.evaluate(()=>window.__j)).split(',')[1],'base64');
 await D.setInputFiles('#wfile',{name:'IMG_big.jpg',mimeType:'image/jpeg',buffer:buf});
 await until(()=>D.$$eval('#wpg .wph',e=>e.length===2),8000,'photo added');
 ok(await D.$eval('#wpg .wnew',e=>!!e),'new photo is marked NEW');
 await D.click('[data-wm="1:-1"]');
 await D.fill('#sheet [data-w=bahan]','Katun premium');await D.selectOption('#sheet [data-w=sale]','Yes');await D.fill('#sheet [data-w=detail]','- Rapi\n- Adem');
 await D.click('#ok');
 await until(async()=>(await dump()).rows[1][4]!==undefined&&(await dump()).rows[1][2]==='Katun premium',8000,'save');
 let d=await dump();const r1=d.rows[1],ph=r1[5].split('|');
 ok(/^p[a-z0-9]+\.jpg$/.test(ph[0])&&ph[1]==='a.jpg'&&ph.length===2,'photo order saved in the catalog Sheet (new photo first, then a.jpg): '+r1[5]);
 ok(r1[0]==='Gamis bordir'&&r1[1]==='Gamis'&&r1[3]==='M, L'&&r1[4]==='ya'&&r1[6]==='Adem','columns not shown to change keep their values');
 ok(r1[8]==='ya'&&r1[7]==='- Rapi\n- Adem','changed fields saved (sale Yes = ya)');
 const newFile='foto/'+ph[0];ok(d.gh.includes(newFile)&&d.ghSize[newFile]>1000&&d.ghSize[newFile]<350000,'new photo reached GitHub, shrunk ('+Math.round(d.ghSize[newFile]/1024)+' KB from a 2400x3200 photo)');
 ok(!d.gh.includes('foto/b.jpg'),'b.jpg (only this product) was deleted from the website repo');
 ok(d.gh.includes('foto/c.jpg')&&d.gh.includes('foto/a.jpg')&&d.gh.includes('foto/d.jpg'),'c.jpg (still used by Kulot polos), a.jpg and d.jpg are kept');
 await until(()=>D.$$eval('#weblist .row',r=>r[0]&&r[0].textContent.includes('2 photos')),8000,'reload');
 ok(!(await D.evaluate(()=>document.querySelector('#bg').classList.contains('open'))),'form closes after saving');
 ok((await D.textContent('#app')).includes('about 1–5 minutes'),'tells the owner changes take 1–5 minutes');
 // 4. add
 await D.click('#webAdd');ok((await D.$$('#wpg .wph')).length===0,'new product starts without photos');
 await D.click('#ok');ok((await D.textContent('#err')).includes('name'),'a name is required');
 await D.fill('#sheet [data-w=nama]','Tunik baru');await D.fill('#sheet [data-w=kategori]','Hijab');await D.click('#ok');
 await until(async()=>(await dump()).rows.length===4,8000,'add');d=await dump();
 ok(d.rows[3][0]==='Tunik baru'&&d.rows[3][1]==='Hijab','new product appended to the catalog Sheet, with a new category');
 await until(()=>D.$$eval('#weblist .row',r=>r.length===3),8000,'3 rows');
 // 5. stale data: the Sheet changed under the form → clear message, nothing overwritten
 await D.click('[data-wr="3"]');
 await post({pin:'9999',action:'catSave',row:3,origNama:'Kulot polos',data:{nama:'Kulot polos baru'}});
 await D.fill('#sheet [data-w=bahan]','Salah');await D.click('#ok');
 await until(async()=>(await D.textContent('#err')).includes('Data berubah'),8000,'stale');
 d=await dump();ok(d.rows[2][0]==='Kulot polos baru'&&d.rows[2][2]==='Linen','a stale form is refused with a message and does not overwrite the newer data');
 await D.click('#no');await D.click('#app .impb[title=Reload]');await until(()=>D.$$eval('#weblist .row',r=>r.some(x=>x.textContent.includes('Kulot polos baru'))),8000,'reload2');
 // 6. delete (two taps) with its photos
 await D.click('[data-wr="3"]');await D.click('#rm');
 ok((await D.textContent('#rm')).includes('Tap again'),'delete needs a second tap');
 ok((await dump()).rows.length===4,'nothing deleted after the first tap');
 await D.click('#rm');await until(async()=>(await dump()).rows.length===3,8000,'delete');d=await dump();
 ok(!d.rows.some(r=>r[0]==='Kulot polos baru')&&!d.gh.includes('foto/c.jpg')&&!d.gh.includes('foto/d.jpg')&&d.gh.includes('foto/a.jpg'),'product row and its now-unused photos (c.jpg, d.jpg) are deleted; a.jpg stays');
 await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'after delete');
 // 7. wrong PIN message, then lock after 5 wrong; the dashboard and the cashier keep working
 await D.evaluate(()=>{S.cfg.pin='0000'});await D.click('#app .impb[title=Reload]');
 await until(()=>D.evaluate(()=>/Wrong PIN/.test(document.querySelector('#app').textContent)),8000,'wrong pin');
 ok(true,'a wrong PIN shows "Wrong PIN. Check the Access PIN in Settings."');
 for(let i=0;i<4;i++)await post({pin:'0000',action:'catList'});
 const lk=await post({pin:'9999',action:'catList'});
 ok(lk.ok===false&&/Terlalu banyak percobaan salah\. Coba lagi dalam 10 menit/.test(lk.error),'after 5 wrong PINs the catalog is locked for 10 minutes, even for the right PIN');
 const dsh=await (await fetch(B+'/exec?pin=9999')).json();
 ok(dsh.ok===true,'while the catalog is locked, the dashboard and the cashier tablets (right PIN) keep working');
 const pos=await post({pin:'9999',action:'upsert',rows:{}});ok(pos.ok===true,'POS upload still works while the catalog is locked');
 await fetch(B+'/reset-cat');await D.evaluate(()=>{S.cfg.pin='9999'});
 // 8. older Code.gs: nothing is sent (codeOld) / an answer without cat:true is recognised
 await D.evaluate(()=>{S.cfg.codeOld=true});const n0=catPosts.length;await D.click('#app .impb[title=Reload]');
 await until(()=>D.evaluate(()=>/Update Code\.gs first/.test(document.querySelector('#app').textContent)),8000,'codeOld');
 ok(catPosts.length===n0,'with an old Code.gs the dashboard sends nothing and says "Update Code.gs first"');
 await D.evaluate(()=>{S.cfg.codeOld=false});
 await ctx.route(B+'/exec',r=>r.request().method()==='POST'?r.fulfill({status:200,headers:{'content-type':'application/json','access-control-allow-origin':'*'},body:JSON.stringify({ok:true,ver:'1'})}):r.continue());
 await D.click('#app .impb[title=Reload]');
 await until(()=>D.evaluate(()=>/older version without the website catalog/.test(document.querySelector('#app').textContent)),8000,'old answer');
 ok(true,'an answer from an old script (ok, no cat:true) is recognised, not mistaken for a catalog');
 await ctx.unroute(B+'/exec');
 // 9. the catalog never waits for a dashboard/POS sync that holds the script lock (why "Loading the catalog" was slow)
 await fetch(B+'/hold-lock?on=1');
 const dsh2=await (await fetch(B+'/exec?pin=9999')).json();
 ok(dsh2.ok===false,'(test setup) a dashboard sync is busy: the script lock is held, the dashboard read waits/fails');
 const lst=await post({pin:'9999',action:'catList'});
 ok(lst.ok===true&&lst.cat===true&&lst.items.length>=1,'the catalog list still answers at once while the script lock is held');
 const sv2=await post({pin:'9999',action:'catSave',row:2,origNama:'Gamis bordir',data:{nama:'Gamis bordir',bahan:'Katun premium'}});
 ok(sv2.ok===true,'saving a catalog product also works while the script lock is held');
 await fetch(B+'/hold-lock?on=0');
 // 10. the last list is kept on the device: the tab opens at once, then refreshes in the background
 const P2=await ctx.newPage();P2.on('pageerror',e=>errs.push(e.message));
 await P2.addInitScript(()=>{try{sessionStorage.setItem('wismir_unlocked','1')}catch(e){}}); // a second visit on this device: PIN already typed this session
 await ctx.route(B+'/exec',async r=>{if(r.request().method()==='POST'&&/"action":"catList"/.test(r.request().postData()||''))await sleep(2500);r.continue()});
 await P2.goto(B+'/dashboard.html');await until(()=>P2.evaluate(()=>S.cfg.pulled===1),10000,'p2');
 await P2.evaluate(()=>{tab='mkt';mk='camp';render()});const tc=Date.now();await P2.click('#app .seg.ico button[title=Website]');
 await P2.waitForSelector('#weblist .row',{timeout:1500});
 ok(Date.now()-tc<1500&&(await P2.textContent('#app')).includes('Updating from Google Sheets'),'second time the Website tab shows the saved list at once ('+(Date.now()-tc)+' ms) with "Updating from Google Sheets…" while the answer is 2.5 s away');
 await until(()=>P2.evaluate(()=>!/Updating from Google Sheets/.test(document.querySelector('#app').textContent)),8000,'refreshed');ok(true,'then it refreshes and the note disappears');
 await ctx.unroute(B+'/exec');
 // 11. a request that never answers ends with a clear message
 await P2.evaluate(()=>{WEB_TIMEOUT=1200});await ctx.route(B+'/exec',async r=>{if(r.request().method()==='POST'&&/"action":"catList"/.test(r.request().postData()||''))await sleep(4000);r.continue()});
 await P2.click('#app .impb[title=Reload]');await until(()=>P2.evaluate(()=>/taking too long/.test(document.querySelector('#app').textContent)),6000,'timeout');
 ok((await P2.$$('#weblist .row')).length>=1,'a slow answer ends with "Google Sheets is taking too long. Try again in a moment." and keeps showing the saved list');
 await ctx.unroute(B+'/exec');await P2.close();
 // 12. phone width
 await D.setViewportSize({width:320,height:640});await D.click('#app .impb[title=Reload]');await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'reload3');
 ok(await D.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 320 px (list)');
 await D.click('[data-wr="2"]');ok(await D.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 320 px (edit form)');
 await D.screenshot({path:'web-catalog.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.log('FAIL '+e.message);process.exit(1)});

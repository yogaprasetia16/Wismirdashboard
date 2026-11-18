// Marketing › Website: manage the wismir.id catalog (products + photos) through the catalog Apps Script.
// The catalog script is imitated in the browser (route), so this checks what the dashboard sends and shows,
// not the real Google Sheet / GitHub (those need the owner's accounts).
const {chromium}=require('playwright');
const B='http://localhost:8765',CAT='https://script.google.com/macros/s/CATALOG/exec';
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=8000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(150)}throw new Error('timeout '+label)}
const H=['nama','kategori','bahan','ukuran','terbaru','foto','deskripsi','detail','sale'];
let rows,calls,wrongPass;
const reset=()=>{rows=[
 {_row:2,nama:'Gamis bordir',kategori:'Gamis',bahan:'Katun linen',ukuran:'M, L',terbaru:'ya',foto:'a.jpg|b.jpg|c.jpg',deskripsi:'Adem',detail:'- Rapi',sale:''},
 {_row:3,nama:'Kulot polos',kategori:'Bawahan',bahan:'Linen',ukuran:'All size',terbaru:'',foto:'c.jpg|d.jpg',deskripsi:'',detail:'',sale:'ya'}];calls=[];wrongPass=false};
function api(route){
 const req=JSON.parse(route.request().postData()),h={'access-control-allow-origin':'*','content-type':'application/json'};calls.push(req);
 let out={ok:true};
 if(wrongPass||req.pass!=='9999')out={ok:false,error:'Kata sandi salah.'};
 else if(req.action==='list')out={ok:true,headers:H,items:rows.map(r=>({...r}))};
 else if(req.action==='save'){const d=req.data;if(req.row){const r=rows.find(x=>x._row===req.row);if(!r||r.nama!==req.origNama)out={ok:false,error:'Data berubah di Sheet.'};else Object.assign(r,d)}else rows.push({_row:rows.length+2,...d});out.uploaded=(req.newPhotos||[]).map(p=>p.name)}
 else if(req.action==='delete'){const i=rows.findIndex(x=>x._row===req.row);if(i<0)out={ok:false,error:'x'};else rows.splice(i,1);rows.forEach((r,k)=>r._row=k+2)}
 return route.fulfill({status:200,headers:h,body:JSON.stringify(out)})}
(async()=>{
 reset();
 const br=await chromium.launch();const errs=[];const ctx=await br.newContext({viewport:{width:1280,height:900}});
 const D=await ctx.newPage();D.on('pageerror',e=>errs.push(e.message));
 await ctx.route(CAT,api);
 await D.goto(B+'/dashboard.html');
 await D.evaluate(()=>{tab='set';render()});await D.fill('#cu',B+'/exec');await D.fill('#cp','9999');await D.evaluate(()=>saveCfg());
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 // 1. Marketing: two icon tabs, campaigns first
 await D.evaluate(()=>{tab='mkt';render()});
 ok(await D.$$eval('#app .seg.ico button',b=>b.map(x=>x.title).join())==='Campaigns,Website','Marketing has icon tabs Campaigns and Website');
 ok((await D.textContent('#app')).includes('Spent')&&await D.isVisible('#cta'),'Campaigns is the default and keeps its New campaign button');
 // 2. no URL yet
 await D.click('#app .seg.ico button[title=Website]');
 ok((await D.textContent('#app')).includes('Website catalog URL in Settings')&&!(await D.isVisible('#cta')),'without a catalog URL it asks for one in Settings (header + button hidden)');
 await D.evaluate(()=>{tab='set';render()});
 ok(await D.isVisible('#cw'),'Settings has the Website catalog URL field');
 await D.fill('#cw',CAT);await D.evaluate(()=>saveCfg());
 ok(await D.evaluate(()=>S.cfg.catUrl)===CAT,'catalog URL saved in Settings');
 // 3. list
 await D.evaluate(()=>{tab='mkt';mk='camp';render()});await D.click('#app .seg.ico button[title=Website]');
 await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'list');
 ok(true,'Website lists the 2 products');
 ok(calls[0].action==='list'&&calls[0].pass==='9999','list call sends the Access PIN as the password');
 ok(await D.isVisible('#webAdd')&&!(await D.isVisible('#cta')),'round + in the tab row, no header button');
 const t0=await D.$eval('#weblist .row',e=>e.textContent);ok(t0.includes('Gamis bordir')&&t0.includes('3 photos')&&t0.includes('NEW'),'row shows name, photo count and NEW: '+t0.replace(/\s+/g,' '));
 await D.fill('#webq','kulot');ok((await D.$$('#weblist .row')).length===1,'search filters the list');await D.fill('#webq','');
 // 4. edit: remove b.jpg (only this product), remove c.jpg (shared), add a photo, move it first, change fields
 await D.click('[data-wr="2"]');
 const labels=await D.$$eval('#sheet .f label',l=>l.map(x=>x.textContent));
 ok(labels.includes('Product name')&&labels.includes('Photos (first = main photo)')&&labels.includes('Mark as Sale'),'edit form has the catalog fields: '+labels.join(' | '));
 ok((await D.$$('#wpg .wph')).length===3,'3 photos shown');
 await D.click('[data-wx="1"]'); // remove b.jpg
 await D.click('[data-wx="1"]'); // remove c.jpg
 await D.evaluate(()=>{const c=document.createElement('canvas');c.width=2400;c.height=3200;const x=c.getContext('2d');x.fillStyle='#c33';x.fillRect(0,0,2400,3200);window.__j=c.toDataURL('image/jpeg',.9)});
 const buf=Buffer.from((await D.evaluate(()=>window.__j)).split(',')[1],'base64');
 await D.setInputFiles('#wfile',{name:'IMG_big.jpg',mimeType:'image/jpeg',buffer:buf});
 await until(()=>D.$$eval('#wpg .wph',e=>e.length===2),8000,'photo added');
 ok(await D.$eval('#wpg .wnew',e=>!!e),'new photo is marked NEW');
 await D.click('[data-wm="1:-1"]'); // new photo first
 await D.fill('#sheet [data-w=bahan]','Katun premium');await D.selectOption('#sheet [data-w=sale]','Yes');await D.fill('#sheet [data-w=detail]','- Rapi\n- Adem');
 await D.click('#ok');
 await until(()=>calls.some(c=>c.action==='save'),8000,'save');
 const sv=calls.find(c=>c.action==='save');
 ok(sv.row===2&&sv.origNama==='Gamis bordir','save names the row and the original name');
 ok(/^p[a-z0-9]+\.jpg$/.test(sv.data.foto.split('|')[0])&&sv.data.foto.split('|')[1]==='a.jpg'&&sv.data.foto.split('|').length===2,'photo order saved (new photo first, then a.jpg): '+sv.data.foto);
 ok(sv.newPhotos.length===1&&sv.newPhotos[0].b64.length>100&&sv.newPhotos[0].b64.length<400000,'photo uploaded shrunk ('+Math.round(sv.newPhotos[0].b64.length/1024)+' KB base64 from a 2400x3200 photo)');
 ok(sv.deleteFiles.join()==='b.jpg','only the photo no other product uses is deleted from the website (c.jpg is shared, kept): '+sv.deleteFiles.join());
 ok(sv.data.bahan==='Katun premium'&&sv.data.sale==='ya'&&sv.data.detail==='- Rapi\n- Adem','changed fields sent (sale Yes = ya)');
 await until(()=>D.$$eval('#weblist .row',r=>r[0]&&r[0].textContent.includes('2 photos')),8000,'reload');
 ok(!(await D.evaluate(()=>document.querySelector('#bg').classList.contains('open'))),'form closes after saving');
 ok((await D.textContent('#app')).includes('about 1–5 minutes'),'tells the owner changes take 1–5 minutes');
 // 5. add
 await D.click('#webAdd');ok((await D.$$('#wpg .wph')).length===0,'new product starts without photos');
 await D.click('#ok');ok((await D.textContent('#err')).includes('name'),'a name is required');
 await D.fill('#sheet [data-w=nama]','Tunik baru');await D.fill('#sheet [data-w=kategori]','Hijab');await D.click('#ok');
 await until(()=>calls.filter(c=>c.action==='save').length===2,8000,'add');
 const ad=calls.filter(c=>c.action==='save')[1];ok(ad.row===null&&ad.data.nama==='Tunik baru'&&ad.data.kategori==='Hijab','new product sent without a row, with a new category');
 await until(()=>D.$$eval('#weblist .row',r=>r.length===3),8000,'3 rows');
 // 6. delete (two taps)
 await D.click('[data-wr="3"]');await D.click('#rm');
 ok((await D.textContent('#rm')).includes('Tap again'),'delete needs a second tap');
 ok(!calls.some(c=>c.action==='delete'),'nothing deleted after the first tap');
 await D.click('#rm');await until(()=>calls.some(c=>c.action==='delete'),8000,'delete');
 const dl=calls.find(c=>c.action==='delete');ok(dl.row===3&&dl.nama==='Kulot polos','delete names the row and the product');
 ok(dl.deleteFiles.join()==='c.jpg,d.jpg'||dl.deleteFiles.join()==='d.jpg','only photos nobody else uses are deleted: '+dl.deleteFiles.join());
 await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'after delete');
 // 7. wrong password
 wrongPass=true;await D.click('#app .impb[title=Reload]');
 await until(()=>D.evaluate(()=>/Wrong password/.test(document.querySelector('#app').textContent)),8000,'wrong pw');
 ok(true,'a wrong password shows a clear message (catalog password must equal the Access PIN)');
 wrongPass=false;
 // 8. phone width
 await D.setViewportSize({width:320,height:640});await D.click('#app .impb[title=Reload]');await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'reload');
 ok(await D.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 320 px (list)');
 await D.click('[data-wr="2"]');ok(await D.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 320 px (edit form)');
 await D.screenshot({path:'web-catalog.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.log('FAIL '+e.message);process.exit(1)});

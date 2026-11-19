// Marketing › Website: manage the wismir.id catalog (products + photos) from the dashboard.
// Since 2026-11-19 it talks to the SEPARATE catalog Apps Script (Settings: Website catalog URL + optional password), never to the
// dashboard/POS script. That script is imitated in the browser (route), so this checks what the dashboard sends and shows,
// not the real catalog Google Sheet / GitHub (those need the owner's accounts): say so when reporting.
const {chromium}=require('playwright');
const B='http://localhost:8765',CAT='https://script.google.com/macros/s/CATALOG/exec';
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=8000,label=''){const t=Date.now();while(Date.now()-t<ms){try{if(await fn())return true}catch(e){}await sleep(150)}throw new Error('timeout '+label)}
const H=['nama','kategori','bahan','ukuran','terbaru','foto','deskripsi','detail','sale'];
const statRows=[['2026-11-19','visit','instagram',6],['2026-11-19','visit','direct',3],['2026-11-18','visit','tiktok',4],['2026-11-17','visit','google',2],['2026-11-19','product','gamis-bordir',7],['2026-11-18','product','kulot-polos',3],['2026-11-18','product','tunik-lama',1],['2026-11-19','wa','gamis-bordir',2],['2026-11-18','wa','umum',1],['2026-11-19','share','gamis-bordir',2]];
let rows,calls,mode,delay,testi;
const reset=()=>{testi=[{id:'t1',foto:['x1.jpg'],nama:'Ibu Siti',komentar:'Bahannya adem sekali'},{id:'t2',foto:[],nama:'',komentar:'Pelayanannya ramah'}];rows=[
 {_row:2,nama:'Gamis bordir',kategori:'Gamis',bahan:'Katun linen',ukuran:'M, L',terbaru:'ya',foto:'a.jpg|b.jpg|c.jpg',deskripsi:'Adem',detail:'- Rapi',sale:''},
 {_row:3,nama:'Kulot polos',kategori:'Bawahan',bahan:'Linen',ukuran:'All size',terbaru:'',foto:'c.jpg|d.jpg',deskripsi:'',detail:'',sale:'ya'}];calls=[];mode='ok';delay=0};
async function api(route){
 const req=JSON.parse(route.request().postData()),h={'access-control-allow-origin':'*','content-type':'application/json'};calls.push(req);
 if(delay)await sleep(delay);
 let out={ok:true};
 if(mode==='wrong'||req.pass!==(mode==='sep'?'katalog-rahasia':'9999'))out={ok:false,error:'Kata sandi salah.'};
 else if(mode==='lock')out={ok:false,error:'Terlalu banyak percobaan salah. Coba lagi dalam 10 menit.'};
 else if(req.action==='list')out={ok:true,headers:H,items:rows.map(r=>({...r}))};
 else if(req.action==='save'){const d=req.data;if(req.row){const r=rows.find(x=>x._row===req.row);if(!r||r.nama!==req.origNama)out={ok:false,error:'Data berubah di Sheet.'};else Object.assign(r,d)}else rows.push({_row:rows.length+2,...d});out.uploaded=(req.newPhotos||[]).map(p=>p.name)}
 else if(req.action==='delete'){const i=rows.findIndex(x=>x._row===req.row);if(i<0)out={ok:false,error:'x'};else rows.splice(i,1);rows.forEach((r,k)=>r._row=k+2)}
 else if(req.action==='statsGet'){if(mode==='oldstats')out={ok:false,error:'Aksi tidak dikenal.'};else out={ok:true,from:'2026-11-01',today:'2026-11-19',rows:statRows.map(r=>r.slice())}}
 else if(req.action==='testiList')out={ok:true,items:testi.map(t=>({...t}))};
 else if(req.action==='testiSave'){const d=req.data;if(!d.komentar&&!d.foto.length)out={ok:false,error:'Isi minimal satu foto atau komentar.'};else if(req.id){const t=testi.find(x=>x.id===req.id);if(!t)out={ok:false,error:'Testimoni tidak ditemukan. Muat ulang daftar.'};else Object.assign(t,d)}else{out.id='n'+(testi.length+1);testi.unshift({id:out.id,...d})}}
 else if(req.action==='testiDelete'){testi=testi.filter(x=>x.id!==req.id)}
 return route.fulfill({status:200,headers:h,body:JSON.stringify(out)})}
(async()=>{
 reset();
 const br=await chromium.launch();const errs=[];const ctx=await br.newContext({viewport:{width:1280,height:900}});
 const D=await ctx.newPage();D.on('pageerror',e=>errs.push(e.message));
 const dashCat=[];D.on('request',r=>{if(r.method()==='POST'&&r.url().startsWith(B)&&/"pass"|"action":"cat/.test(r.postData()||''))dashCat.push(r.postData())});
 await ctx.route(CAT,api);
 await D.goto(B+'/dashboard.html');
 // 1. Marketing: two icon tabs, campaigns first; Website without a catalog URL
 await D.evaluate(()=>{tab='mkt';render()});
 ok(await D.$$eval('#app .seg.ico button',b=>b.map(x=>x.title).join())==='Campaigns,Website','Marketing has two icon tabs, Campaigns and Website (testimonials are inside Website)');
 ok((await D.textContent('#app')).includes('Spent')&&await D.isVisible('#cta'),'Campaigns is the default and keeps its New campaign button');
 await D.click('#app .seg.ico button[title=Website]');
 ok((await D.textContent('#app')).includes('Website catalog URL in Settings')&&!(await D.isVisible('#cta')),'without a catalog URL it asks for one in Settings (header button hidden)');
 await D.evaluate(()=>{tab='set';render()});
 ok(await D.isVisible('#cw')&&await D.isVisible('#cwp'),'Settings has Website catalog URL and an optional catalog password');
 await D.fill('#cu',B+'/exec');await D.fill('#cp','9999');await D.fill('#cw',CAT);await D.evaluate(()=>saveCfg());
 ok(await D.evaluate(()=>S.cfg.catUrl)===CAT,'catalog URL saved in Settings');
 await until(()=>D.evaluate(()=>S.cfg.pulled===1),10000,'dash');
 // 2. list: separate script, Access PIN used while the catalog password is empty
 await D.evaluate(()=>{tab='mkt';mk='camp';render()});await D.click('#app .seg.ico button[title=Website]');
 await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'list');
 ok(calls[0].action==='list'&&calls[0].pass==='9999','the list is read from the catalog script; the Access PIN is the password while the catalog password is empty');
 ok(dashCat.length===0,'nothing about the catalog is ever sent to the dashboard/cashier script');
 ok(await D.isVisible('#webAdd')&&!(await D.isVisible('#cta')),'round + in the tab row, no header button');
 ok(await D.isVisible('#webOpen')&&await D.$eval('#webOpen',e=>e.href==='https://wismir.id/'&&e.target==='_blank'&&e.rel.includes('noopener')),'link button beside Reload and + opens wismir.id in a new tab');
 const t0=await D.$eval('#weblist .row',e=>e.textContent);ok(t0.includes('Gamis bordir')&&t0.includes('3 photos')&&t0.includes('NEW'),'row shows name, photo count and NEW: '+t0.replace(/\s+/g,' '));
 await D.fill('#webq','kulot');ok((await D.$$('#weblist .row')).length===1,'search filters the list');await D.fill('#webq','');
 // 2b. product link buttons (owner 2026-11-19): copy + open at the far right of every row
 const lkz=await D.$$eval('#weblist .row',r=>r.map(x=>({c:!!x.querySelector('[data-wcopy]'),o:x.querySelector('[data-wopen]').href,t:x.querySelector('[data-wopen]').target,rel:x.querySelector('[data-wopen]').rel,right:x.querySelector('[data-wopen]').getBoundingClientRect().right-x.getBoundingClientRect().right})));
 ok(lkz.length===2&&lkz.every(x=>x.c)&&lkz[0].o==='https://wismir.id/p/gamis-bordir/'&&lkz[1].o==='https://wismir.id/p/kulot-polos/','every row has copy and open buttons; the link is https://wismir.id/p/<slug>/ : '+lkz.map(x=>x.o).join(' '));
 ok(lkz.every(x=>x.t==='_blank'&&x.rel.includes('noopener')&&x.right<=1&&x.right>-24),'open link opens a new tab (noopener) and the buttons sit at the far right of the row');
 await D.fill('#webq','kulot');ok(await D.$eval('#weblist [data-wopen]',e=>e.href)==='https://wismir.id/p/kulot-polos/','a filtered list keeps each product own link');await D.fill('#webq','');
 const par=await D.evaluate(()=>webSlugs(['Gamis bordir','Gamis bordir','Kulot polos','Blus Çantik & Manis!','Tunik Linen','  --  ','Ünï Çödé','Gamis bordir'].map(n=>({nama:n}))).join(' '));
 ok(par==='gamis-bordir gamis-bordir-2 kulot-polos blus-cantik-manis tunik-linen produk uni-code gamis-bordir-3','slug rule is identical to the website (accents, symbols, duplicates numbered): '+par);
 await D.evaluate(()=>{window.__cp=null;Object.defineProperty(navigator,'clipboard',{value:{writeText:async x=>{window.__cp=x}},configurable:true})});
 await D.click('[data-wcopy="2"]');
 ok(await D.evaluate(()=>window.__cp)==='https://wismir.id/p/gamis-bordir/'&&await D.$eval('[data-wcopy="2"]',e=>e.title)==='Copied','copy puts the product link on the clipboard and the button says Copied');
 ok(!(await D.evaluate(()=>document.querySelector('#bg').classList.contains('open'))),'copying does not open the edit form');
 await sleep(1900);ok(await D.$eval('[data-wcopy="2"]',e=>e.title)==='Copy product link','the button goes back to normal after a moment');
 const [np]=await Promise.all([ctx.waitForEvent('page'),D.click('[data-wopen="2"]')]);await np.close().catch(()=>{});
 ok(!(await D.evaluate(()=>document.querySelector('#bg').classList.contains('open'))),'opening the link does not open the edit form');
 // 3. edit: remove b.jpg (only this product), remove c.jpg (shared with Kulot), add a big photo, move it first, change fields
 await D.click('[data-wr="2"]');
 const labels=await D.$$eval('#sheet .f label',l=>l.map(x=>x.textContent));
 ok(labels.includes('Product name')&&labels.includes('Photos (first = main photo)')&&labels.includes('Mark as Sale'),'edit form has the catalog fields: '+labels.join(' | '));
 ok((await D.$$('#wpg .wph')).length===3,'3 photos shown');
 await D.click('[data-wx="1"]');await D.click('[data-wx="1"]');
 await D.evaluate(()=>{const c=document.createElement('canvas');c.width=2400;c.height=3200;const x=c.getContext('2d');x.fillStyle='#c33';x.fillRect(0,0,2400,3200);window.__j=c.toDataURL('image/jpeg',.9)});
 const buf=Buffer.from((await D.evaluate(()=>window.__j)).split(',')[1],'base64');
 await D.setInputFiles('#wfile',{name:'IMG_big.jpg',mimeType:'image/jpeg',buffer:buf});
 await until(()=>D.$$eval('#wpg .wph',e=>e.length===2),8000,'photo added');
 ok(await D.$eval('#wpg .wnew',e=>!!e),'new photo is marked NEW');
 await D.click('[data-wm="1:-1"]');
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
 // 4. add
 await D.click('#webAdd');ok((await D.$$('#wpg .wph')).length===0,'new product starts without photos');
 await D.click('#ok');ok((await D.textContent('#err')).includes('name'),'a name is required');
 await D.fill('#sheet [data-w=nama]','Tunik baru');await D.fill('#sheet [data-w=kategori]','Hijab');await D.click('#ok');
 await until(()=>calls.filter(c=>c.action==='save').length===2,8000,'add');
 const ad=calls.filter(c=>c.action==='save')[1];ok(ad.row===null&&ad.data.nama==='Tunik baru'&&ad.data.kategori==='Hijab','new product sent without a row, with a new category');
 await until(()=>D.$$eval('#weblist .row',r=>r.length===3),8000,'3 rows');
 // 5. stale data: the Sheet changed under the form → the script refuses, the message shows, the form stays
 await D.click('[data-wr="3"]');rows[1].nama='Kulot polos baru';
 await D.click('#ok');await until(async()=>(await D.textContent('#err')).includes('Data berubah'),8000,'stale');
 ok(true,'a stale form is refused by the catalog script and its message is shown in the form');
 await D.click('#no');rows[1].nama='Kulot polos';await D.click('#app .impb[title=Reload]');await until(()=>D.$$eval('#weblist .row',r=>r.some(x=>x.textContent.includes('Kulot polos'))),8000,'reload2');
 // 6. delete (two taps)
 await D.click('[data-wr="3"]');await D.click('#rm');
 ok((await D.textContent('#rm')).includes('Tap again'),'delete needs a second tap');
 ok(!calls.some(c=>c.action==='delete'),'nothing deleted after the first tap');
 await D.click('#rm');await until(()=>calls.some(c=>c.action==='delete'),8000,'delete');
 const dl=calls.find(c=>c.action==='delete');ok(dl.row===3&&dl.nama==='Kulot polos','delete names the row and the product');
 ok(dl.deleteFiles.join()==='c.jpg,d.jpg'||dl.deleteFiles.join()==='d.jpg','only photos nobody else uses are deleted: '+dl.deleteFiles.join());
 await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'after delete');
 // 6b. Testimonials (owner 2026-11-19): list, add (photo + name + comment), comment only, edit, delete
 ok(await D.$$eval('#app .seg.ico button',b=>b.map(x=>x.title+(x.classList.contains('on')?'*':'')).join())==='Campaigns,Website*,Catalog*,Testimonials,Visitors','inside Website a toggle Catalog | Testimonials | Visitors (like Products | History in Stock); Catalog is on');
 await D.click('#app .seg.ico button[title=Testimonials]');
 await until(()=>D.$$eval('#app [data-tr]',r=>r.length===2),8000,'testi list');
 ok(await D.$$eval('#app .seg.ico button',b=>b.map(x=>x.title+(x.classList.contains('on')?'*':'')).join())==='Campaigns,Website*,Catalog,Testimonials*,Visitors','the toggle switches to Testimonials');
 await D.click('#app .seg.ico button[title=Campaigns]');ok((await D.$$('#app .seg.ico button')).length===2,'the toggle only exists inside Website');
 await D.click('#app .seg.ico button[title=Website]');await until(()=>D.$$eval('#app [data-tr]',r=>r.length===2),8000,'testi again');ok(true,'Website remembers the last toggle (Testimonials)');
 const tl=await D.$$eval('#app [data-tr]',r=>r.map(x=>x.textContent.replace(/\s+/g,' ')));
 ok(tl[0].includes('Ibu Siti')&&tl[0].includes('Bahannya adem sekali')&&tl[0].includes('1 photo')&&tl[1].includes('(no name)')&&tl[1].includes('Pelayanannya ramah'),'testimonials list: name, comment, photo count; "(no name)" when empty: '+tl.join(' | '));
 ok(await D.isVisible('#testiAdd')&&!(await D.isVisible('#cta'))&&await D.$eval('#webOpen',e=>e.href==='https://wismir.id/#testimoni'),'round + in the tab row; the link icon opens the testimonials section of wismir.id');
 await D.click('#testiAdd');ok((await D.$$('#wpg .wph')).length===0,'new testimonial starts without photos');
 await D.click('#ok');ok((await D.textContent('#err')).includes('at least a photo or a comment'),'a photo or a comment is required');
 await D.evaluate(()=>{const c=document.createElement('canvas');c.width=3000;c.height=4000;const x=c.getContext('2d');x.fillStyle='#39c';x.fillRect(0,0,3000,4000);for(let i=0;i<3000;i++){x.fillStyle='rgb('+(i*37%255)+','+(i*91%255)+','+(i*53%255)+')';x.fillRect(i*7%3000,i*13%4000,60,60)}window.__t=c.toDataURL('image/jpeg',.9)});
 const tb=Buffer.from((await D.evaluate(()=>window.__t)).split(',')[1],'base64');
 await D.setInputFiles('#wfile',{name:'chat.jpg',mimeType:'image/jpeg',buffer:tb});await until(()=>D.$$eval('#wpg .wph',e=>e.length===1),8000,'testi photo');
 await D.fill('#sheet [data-t=nama]','Kak Dewi');await D.fill('#sheet [data-t=komentar]','Mantap sekali, bahannya premium');await D.click('#ok');
 await until(()=>calls.some(c=>c.action==='testiSave'),8000,'testi save');
 const ts=calls.find(c=>c.action==='testiSave');
 ok(ts.id===null&&ts.data.nama==='Kak Dewi'&&ts.data.komentar==='Mantap sekali, bahannya premium'&&/^p[a-z0-9]+\.jpg$/.test(ts.data.foto[0])&&ts.newPhotos.length===1&&ts.newPhotos[0].name===ts.data.foto[0],'add sends name, comment and the new photo');
 const szt=await D.evaluate(async()=>{const f=await (await fetch(window.__t)).blob();const b=await webShrink(f,2000,.85);const im=await createImageBitmap(b);return [im.width,im.height,b.size]});
 ok(Math.max(szt[0],szt[1])===2000&&szt[2]<900000,'testimonial photos are shrunk to 2000 px (not 1400), so chat text stays readable ('+szt[0]+'x'+szt[1]+', '+Math.round(szt[2]/1024)+' KB)');
 await until(()=>D.$$eval('#app [data-tr]',r=>r.length===3),8000,'3 testi');
 ok((await D.$eval('#app [data-tr]',e=>e.textContent)).includes('Kak Dewi'),'the new testimonial is first (newest first)');
 await D.click('[data-tr="t1"]');ok(await D.$eval('#sheet [data-t=nama]',e=>e.value)==='Ibu Siti'&&(await D.$$('#wpg .wph')).length===1,'edit form shows the saved name, comment and photo');
 await D.click('[data-wx="0"]');await D.fill('#sheet [data-t=komentar]','Sudah dipakai, nyaman');await D.click('#ok');
 await until(()=>calls.filter(c=>c.action==='testiSave').length===2,8000,'testi edit');
 const te=calls.filter(c=>c.action==='testiSave')[1];
 ok(te.id==='t1'&&te.orig.komentar==='Bahannya adem sekali'&&te.data.foto.length===0&&te.deleteFiles.join()==='x1.jpg'&&te.data.komentar==='Sudah dipakai, nyaman','edit sends the id and the original values (to detect changes elsewhere), and deletes the removed photo');
 await until(()=>D.$$eval('#app [data-tr]',r=>r.some(x=>x.textContent.includes('Sudah dipakai'))),8000,'testi reload');
 await D.click('[data-tr="t2"]');await D.click('#rm');ok((await D.textContent('#rm')).includes('Tap again')&&!calls.some(c=>c.action==='testiDelete'),'delete needs a second tap');
 await D.click('#rm');await until(()=>calls.some(c=>c.action==='testiDelete'),8000,'testi delete');
 ok(calls.find(c=>c.action==='testiDelete').id==='t2','delete names the testimonial');
 await until(()=>D.$$eval('#app [data-tr]',r=>r.length===2),8000,'2 testi');
 // 6c. Visitors (owner 2026-11-19): the website's own counter, shown from the catalog script's statsGet
 await D.click('#app .seg.ico button[title=Visitors]');
 await until(()=>D.evaluate(()=>/Where visitors come from/.test(document.querySelector('#app').textContent)),8000,'stats');
 ok(calls.some(c=>c.action==='statsGet'&&c.days===30&&c.pass==='9999'),'Visitors asks the catalog script for the last 30 days (statsGet) with the same password');
 const kp=await D.$$eval('#app .card .lbl',e=>e.map(x=>x.textContent));
 const kv=await D.evaluate(()=>[...document.querySelectorAll('#app .card')].filter(c=>c.querySelector('.lbl')&&/^(Visits|Product views|WhatsApp clicks|WhatsApp per 100 visits)$/.test(c.querySelector('.lbl').textContent)).map(c=>c.querySelector('.lbl').textContent+'='+c.children[1].textContent));
 ok(kv.join('|')==='Visits=15|Product views=11|WhatsApp clicks=3|WhatsApp per 100 visits=20','four numbers: visits 15, product views 11, WhatsApp clicks 3, WhatsApp per 100 visits 20: '+kv.join(' | '));
 const sc=await D.evaluate(()=>document.querySelector('#app').textContent);
 ok(sc.includes('Instagram')&&sc.includes('40%')&&sc.includes('Direct')&&sc.includes('TikTok')&&sc.includes('Google'),'sources are listed with their share (Instagram 6 of 15 = 40%)');
 const tp=await D.evaluate(()=>{const g=[...document.querySelectorAll('#app .card')].find(c=>c.querySelector('.sub')&&c.querySelector('.sub').textContent==='Top products');return [...g.querySelectorAll('div[style*="border-top"]')].map(x=>x.textContent)});
 ok(tp.slice(0,3).join('|')==='Gamis bordir|7|2'&&tp[3]==='kulot-polos'&&tp[6]==='tunik-lama','top products: names come from the catalog (Gamis bordir 7 views 2 WhatsApp); the slug is shown for products no longer in it (Kulot polos was deleted earlier in this test): '+tp.join(','));
 ok((await D.$$('#app div[title*="visits"]')).length===30,'chart: one bar per day for the last 30 days');
 ok(await D.isVisible('#webOpen')&&await D.isVisible('#statReload')&&!(await D.isVisible('#webAdd')),'Visitors has the site link and Reload, but no +');
 await D.selectOption('#statDays','7');await until(()=>calls.some(c=>c.action==='statsGet'&&c.days===7),8000,'7 days');ok(true,'changing the period asks for that many days');
 ok((await D.$$('#app div[title*="visits"]')).length===7,'chart shows 7 bars for 7 days');
 mode='oldstats';await D.click('#statReload');await until(()=>D.evaluate(()=>/Update the catalog Apps Script first/.test(document.querySelector('#app').textContent)),8000,'old script');ok(true,'with an older catalog script the page says to update it (instead of "Aksi tidak dikenal")');mode='ok';
 await D.click('#app .seg.ico button[title=Catalog]');await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'back to catalog');ok(true,'switching back to Catalog still works');
 // 7. wrong password / locked messages
 mode='wrong';await D.click('#app .impb[title=Reload]');
 await until(()=>D.evaluate(()=>/Wrong password/.test(document.querySelector('#app').textContent)),8000,'wrong pw');
 ok(true,'a wrong password shows a clear message (must match ADMIN_PASSWORD of the catalog script)');
 mode='lock';await D.click('#app .impb[title=Reload]');
 await until(()=>D.evaluate(()=>/Terlalu banyak percobaan salah/.test(document.querySelector('#app').textContent)),8000,'lock');
 ok(!(await D.textContent('#app')).includes('Wrong password'),'the catalog script\'s lock message (5 wrong passwords) is shown as it is, not mistaken for a wrong password');
 // 8. a separate catalog password (Settings) is used instead of the PIN
 mode='sep';await D.evaluate(()=>{tab='set';render()});await D.fill('#cwp','katalog-rahasia');await D.evaluate(()=>saveCfg());
 ok(await D.evaluate(()=>S.cfg.catPass)==='katalog-rahasia'&&await D.evaluate(()=>S.cfg.pin)==='9999','catalog password saved separately; the Access PIN is unchanged');
 await D.evaluate(()=>{tab='mkt';mk='camp';render()});calls.length=0;await D.click('#app .seg.ico button[title=Website]');
 await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'sep');
 ok(calls[0].pass==='katalog-rahasia','with a catalog password set, that password (not the PIN) is sent');
 ok(dashCat.length===0,'still nothing about the catalog goes to the dashboard/cashier script');
 // 9. the last list is kept on the device: the tab opens at once, then refreshes in the background
 const P2=await ctx.newPage();P2.on('pageerror',e=>errs.push(e.message));
 await P2.addInitScript(()=>{try{sessionStorage.setItem('wismir_unlocked','1')}catch(e){}}); // a second visit on this device: PIN already typed this session
 delay=2500;await P2.goto(B+'/dashboard.html');await until(()=>P2.evaluate(()=>S.cfg.pulled===1),10000,'p2');
 await P2.evaluate(()=>{tab='mkt';mk='camp';render()});const tc=Date.now();await P2.click('#app .seg.ico button[title=Website]');
 await P2.waitForSelector('#weblist .row',{timeout:1500});
 ok(Date.now()-tc<1500&&(await P2.textContent('#app')).includes('Updating the catalog'),'second time the Website tab shows the saved list at once ('+(Date.now()-tc)+' ms) with "Updating the catalog…" while the answer is 2.5 s away');
 await until(()=>P2.evaluate(()=>!/Updating the catalog/.test(document.querySelector('#app').textContent)),8000,'refreshed');ok(true,'then it refreshes and the note disappears');
 // 10. a request that never answers ends with a clear message and keeps the saved list
 delay=4000;await P2.evaluate(()=>{WEB_TIMEOUT=1200});await P2.click('#app .impb[title=Reload]');await until(()=>P2.evaluate(()=>/taking too long/.test(document.querySelector('#app').textContent)),6000,'timeout');
 ok((await P2.$$('#weblist .row')).length>=1,'a slow answer ends with "The catalog script is taking too long." and keeps showing the saved list');
 delay=0;await P2.close();
 // 11. phone width
 await D.setViewportSize({width:320,height:640});await D.click('#app .impb[title=Reload]');await until(()=>D.$$eval('#weblist .row',r=>r.length===2),8000,'reload3');
 ok(await D.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 320 px (list)');
 ok(await D.evaluate(()=>{const r=document.querySelector('#weblist .row'),g=r.querySelector('.grow').getBoundingClientRect(),o=r.querySelector('[data-wopen]').getBoundingClientRect();return o.right<=innerWidth&&g.width>=70}),'at 320 px both link buttons stay on screen and the product name keeps room');
 await D.click('[data-wr="2"]');ok(await D.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no sideways scroll at 320 px (edit form)');
 await D.screenshot({path:'web-catalog.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.log('FAIL '+e.message);process.exit(1)});

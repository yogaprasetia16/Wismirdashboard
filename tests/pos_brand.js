// POS: category filter shows names, product cards show brand (left) + category (right),
// stock form has a Brand picker (default Karmila) and saves with one tap on "Simpan" (no check screen).
const {chromium,devices}=require('playwright');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const S0=require('./pos-sample')();
S0.products.forEach((p,i)=>{p.brand=i%2?'wismir':'karmila';p.category=p.category.toLowerCase()});
(async()=>{
 const br=await chromium.launch();const p=await (await br.newContext({...devices['Galaxy Tab S4 landscape']})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(st=>{try{if(!localStorage.getItem('wismir_pos_v1'))localStorage.setItem('wismir_pos_v1',JSON.stringify(st))}catch(e){}},S0);
 await p.goto('http://localhost:8765/pos.html');await p.waitForTimeout(400);
 await p.click('[data-a=tgStaff]');await p.fill('#cashStart','0');await p.click('[data-a=openShift]');await p.waitForTimeout(400);
 // ---- Kasir ----
 const cats=await p.$$eval('#cats button',b=>b.map(x=>x.textContent+(x.querySelector('svg')?'[icon]':'')));
 ok(cats[0]==='Semua'&&cats.includes('Gamis')&&cats.includes('Hijab')&&!cats.some(c=>c.includes('[icon]')),'category filter shows names, no icons: '+cats.join(', '));
 await p.click('#cats button >> text=Hijab');
 ok((await p.$$eval('#grid .pc',b=>b.map(x=>x.textContent))).every(t=>t.includes('Hijab')),'tapping a category name filters the products');
 await p.click('#cats button >> text=Semua');
 const pm=await p.$eval('#grid .pc .pm',e=>[...e.children].map(c=>c.textContent+'@'+Math.round(c.getBoundingClientRect().left)));
 ok(pm.length===2&&/^(Karmila|Wismir)@/.test(pm[0])&&+pm[0].split('@')[1]<+pm[1].split('@')[1],'product card: brand on the left, category on the right: '+pm.join(' | '));
 await p.screenshot({path:'kasir-brand.png'});
 // ---- Stok: brand picker + one-tap Simpan ----
 await p.tap('#menuBtn');await p.tap('#menu [data-t=stock]');await p.waitForTimeout(300);
 const n0=await p.evaluate(()=>window.__wismir.S.moves.length);
 await p.click('[data-a=mvStart][data-m=in]');await p.waitForTimeout(200);
 ok(await p.$eval('#mvB',e=>e.value)==='karmila','Brand picker next to Produk, Karmila chosen by default');
 const opts=await p.$$eval('#mvP option',o=>o.map(x=>x.value).filter(Boolean));
 const kar=await p.evaluate(()=>window.__wismir.S.products.filter(x=>x.brand==='karmila').map(x=>x.id));
 ok(opts.length===kar.length&&opts.every(v=>kar.includes(v)),'product list shows only Karmila products ('+opts.length+')');
 await p.selectOption('#mvB','wismir');await p.waitForTimeout(150);
 const wis=await p.evaluate(()=>window.__wismir.S.products.filter(x=>x.brand==='wismir').map(x=>x.id));
 const opts2=await p.$$eval('#mvP option',o=>o.map(x=>x.value).filter(Boolean));
 ok(opts2.length===wis.length&&opts2.every(v=>wis.includes(v)),'switching to Wismir shows only Wismir products');
 const lay=await p.evaluate(()=>{const b=document.querySelector('[data-a=mvNext]'),k=document.querySelector('#sheet .np');return{txt:b.textContent,side:b.getBoundingClientRect().left>k.getBoundingClientRect().right}});
 ok(lay.txt==='Simpan'&&lay.side,'button says "Simpan" and sits beside the keypad');
 await p.selectOption('#mvP',wis[0]);await p.fill('#mvQ','5');await p.click('[data-a=mvNext]');await p.waitForTimeout(250);
 ok(!(await p.isVisible('#sheet'))&&(await p.textContent('#sheet'))==='','Simpan saves at once: no check screen, form closed');
 const last=await p.evaluate(()=>{const S=window.__wismir.S,m=S.moves[S.moves.length-1];return [S.moves.length,m.pid,m.qty,m.to].join('|')});
 ok(last===[n0+1,wis[0],5,'Toko A'].join('|'),'stock-in recorded: '+last);
 // brand from a product row: tapping a product in the Stok list pre-selects its brand
 await p.click('[data-a=sview][data-v=stock]');await p.click('[data-a=mvRow][data-id="'+kar[0]+'"]');await p.waitForTimeout(150);
 ok(await p.$eval('#mvB',e=>e.value)==='karmila'&&await p.$eval('#mvP',e=>e.value)===kar[0],'opening from a product keeps that product and its brand');
 await p.screenshot({path:'stock-form.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

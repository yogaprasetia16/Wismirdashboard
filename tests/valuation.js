// Finance › Financial › Valuation (owner 2026-11-14): Material value = per material (qty bought in Purchasing › Textile −
// qty used in Manufacturing) × average price per unit; Cash = all-time revenue − (purchases + manufacturing + supplier paid
// + expenses); Total valuation = cash + material value + product value. Sample data is made up.
const {chromium}=require('playwright');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const txt=s=>s.replace(/\s/g,' ');
(async()=>{const br=await chromium.launch();const errs=[];
 const p=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8765/dashboard.html');await p.waitForTimeout(300);
 await p.evaluate(()=>{S.tx=[];S.purch=[];S.prod=[];S.supp=[];S.hist=[];S.products=[];
  S.hist.push({id:'h1',bulan:'2026-01',toko:'Toko A',sku:'AA01',qty:10,total:10000000});
  S.products.push({id:'pa',nama:'Gamis Alpha',sku:'AA01',cogs:100000});
  // textile: 100 m for 5.000.000 + 50 m for 3.000.000 -> 150 m, 8.000.000, avg 53.333,33
  S.purch.push({id:'p1',date:'2026-01-02',name:'Linen',category:'Textile',qty:100,total:5000000},{id:'p2',date:'2026-02-02',name:'linen ',category:'Textile',qty:'50',total:3000000},
   {id:'p3',date:'2026-02-03',name:'Plastik',category:'Item',qty:10,total:200000},{id:'p4',date:'2026-03-01',name:'Zakat',category:'Zakat',qty:1,total:300000});
  // manufacturing used 90 m linen; one order with an unknown material
  S.prod.push({id:'m1',date:'2026-02-05',name:'Gamis Alpha',qty:50,material:'LINEN',matQty:'90',unitCost:20000,total:1000000,status:'Done'},{id:'m2',date:'2026-02-06',name:'Gamis Alpha',qty:10,material:'Katun',matQty:5,unitCost:10000,total:100000,status:'Done'});
  S.supp.push({id:'sup-2026-01',bulan:'2026-01',total:400000,paidOn:'2026-02-05'},{id:'sup-2026-02',bulan:'2026-02',total:999999,paidOn:''});
  S.tx.push({id:'e1',jenis:'Expense',tanggal:'2026-01-10',kategori:'Rent',jumlah:500000,catatan:''});
  tab='tx';fv='fin';render()});
 await p.waitForTimeout(200);
 const mat=await p.evaluate(()=>matRows());
 // owner 2026-11-14: all textile together, names ignored: 150 m for 8.000.000 (avg 53.333,33); used 90 + 5 = 95 m; left 55 m
 ok(mat.buy===150&&mat.used===95&&Math.round(mat.left)===55&&Math.round(mat.val)===2933333,'material: all Textile 150 − all used 95 = 55 × 53.333 = 2.933.333 (names ignored): '+JSON.stringify(mat));
 const cc=await p.evaluate(()=>cashCalc(finRows().reduce((a,r)=>a+r.v,0)));
 // 10.000.000 − purchases 8.500.000 − manufacturing 1.100.000 − supplier paid 400.000 − expenses 500.000 = −500.000
 ok(cc.cash===-500000&&cc.pur===8500000&&cc.man===1100000&&cc.sup===400000&&cc.exp===500000,'cash = revenue − purchases − manufacturing − supplier paid (unpaid month left out) − expenses: '+JSON.stringify(cc));
 const k=txt(await p.textContent('#valKpi'));
 const product=await p.evaluate(()=>{const st=posStock();return S.products.reduce((a,x)=>a+Math.max(0,posTotal(st,x.id))*(+x.cogs||0),0)});
 const tot=await p.evaluate(v=>fM(v),-500000+2933333+product);
 ok(k.includes('Total valuation'+txt(tot))&&k.includes('Cash')&&k.includes('Material value'),'total valuation = cash + material + product: '+k.slice(0,160));
 ok(!(await p.textContent('#app')).includes('Not tracked yet'),'"Not tracked yet" is gone');
 ok((await p.textContent('#matCard')).includes('Used in Manufacturing')&&(await p.textContent('#cashCard')).includes('Manufacturing'),'material table and cash breakdown shown');
 await p.$eval('#valKpi',e=>e.scrollIntoView());await p.screenshot({path:'valuation.png'});
 ok(errs.length===0,'no page errors '+errs.join(';'));await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

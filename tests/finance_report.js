// Finance > Report and Financial (ported from the owner's "Monthly Report" page, sample data):
// month filter, KPIs with change vs previous month, revenue vs cost chart, category / product / store ranking with store detail,
// all-time totals, yearly growth, valuation and SKU table. Light, dark and phone render without errors.
const {chromium}=require('playwright');
const B='http://localhost:8765';
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
(async()=>{
 const br=await chromium.launch();const errs=[];
 const D=await (await br.newContext({viewport:{width:1280,height:900}})).newPage();D.on('pageerror',e=>errs.push(e.message));
 await D.goto(B+'/dashboard.html');await D.evaluate(()=>{tab='tx';fv='tx';render()});
 const seg=await D.$$eval('#app .seg:first-of-type button',b=>b.map(x=>x.textContent));
 ok(seg.join()==='Transactions,Sales,Report,Financial','Finance tabs: '+seg.join(', '));
 await D.click('#app .seg button >> text=Report');
 ok(!(await D.isVisible('#cta')),'no add button on Report');
 const t=await D.textContent('#app');
 ok(t.includes('Monthly report')&&t.includes('September 2026')&&t.includes('Sample data'),'report header shows the month and "Sample data"');
 ok((await D.$$('.kp3 .card')).length===3&&(await D.$$('.kp3 .spk')).length===3,'three KPI cards with trend lines');
 ok((await D.$$('.viz .col')).length===9&&(await D.$$('.viz .dot')).length===9,'revenue vs cost chart: 9 months, cost markers');
 ok(t.includes('Category ranked')&&t.includes('Product ranked')&&t.includes('Store ranked'),'category, product and store ranking');
 // tooltip on hover
 await D.hover('.viz .col >> nth=2');await D.waitForTimeout(100);
 ok(await D.isVisible('#vtip')&&(await D.textContent('#vtip')).includes('March 2026'),'hovering a bar shows a tooltip');
 // tapping a bar selects the month; filter shows it
 await D.click('.viz .col >> nth=2');
 ok(await D.$eval('#app select',e=>e.value)==='2026-03'&&(await D.textContent('#app')).includes('vs February 2026'),'tapping a bar switches the report to March 2026');
 await D.selectOption('#app select','ytd');
 ok((await D.textContent('#app')).includes('Year to date')&&(await D.textContent('#app')).includes('vs Jan – Sep 2025'),'year-to-date filter compares with Jan – Sep 2025');
 ok(!(await D.textContent('#app')).includes('NaN')&&(await D.$eval('[data-fst="Toko A"] td:nth-child(2)',e=>e.textContent))!=='Rp 0','store revenue is filled in');
 await D.click('[data-fst="Toko A"]');
 ok(await D.isVisible('#sheet')&&(await D.textContent('#sheet')).includes('Toko A')&&(await D.$$('#sheet tbody tr')).length===6,'tapping a store opens what it sold');
 await D.click('#sheet #no');
 await D.screenshot({path:'fin-report.png',fullPage:true});
 // Financial
 await D.click('#app .seg button >> text=Financial');
 const f=await D.textContent('#app');
 ok(f.includes('Total earning')&&f.includes('Yearly growth')&&f.includes('Valuation')&&f.includes('Product quantity per SKU'),'financial: earnings, yearly growth, valuation, SKU table');
 ok((await D.$$('.viz .col')).length===5&&(await D.$$eval('.stab',x=>x.length))>=4,'yearly growth: 5 bars + tables');
 ok(f.includes('2026 (YTD)')&&f.includes('Gross profit'),'year table with 2026 YTD and gross profit');
 await D.screenshot({path:'fin-financial.png',fullPage:true});
 // dark + phone
 await D.evaluate(()=>{document.documentElement.dataset.theme='dark';fv='report';FM='2026-09';render()});await D.screenshot({path:'fin-report-dark.png',fullPage:true});
 const P=await (await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:1})).newPage();P.on('pageerror',e=>errs.push('phone: '+e.message));
 await P.goto(B+'/dashboard.html');await P.evaluate(()=>{tab='tx';fv='report';render()});
 ok(await P.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'phone: no sideways page scroll');
 await P.screenshot({path:'fin-phone.png',fullPage:true});
 ok(errs.length===0,'no page errors '+errs.join(';'));
 await br.close();console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);
})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

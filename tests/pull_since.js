// Code.gs v16 (owner 2026-11-18 "sync mulai lama"): a tablet pull reads only the _upd column + the changed rows, and still
// returns exactly the rows changed since the last pull (also rows updated in the middle of the tab). posDaily reads only the
// columns it needs. Sample data only.
const B='http://localhost:8765/exec',P='9999';
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const post=b=>fetch(B,{method:'POST',body:JSON.stringify({pin:P,...b})}).then(r=>r.json());
const pull=since=>fetch(B+'?pin='+P+'&pos=1&since='+since).then(r=>r.json());
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const today=(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})();
const st=(id,qty)=>({id,tanggal:today,jam:'10:00',produk:'Contoh',dari:'Toko A',ke:'Sale',qty,oleh:'Rina',status:'ok',jenis:'sale',pid:'p1'});
(async()=>{
 const many=Array.from({length:300},(_,i)=>st('m'+i,1));
 await post({action:'upsert',rows:{'POS Stok':many}});await wait(30);
 let since=Date.now();await wait(30);
 ok((await pull(since)).data['POS Stok'].length===0,'nothing changed: nothing pulled');
 await post({action:'upsert',rows:{'POS Stok':[st('m150',7)]}});
 let d=(await pull(since)).data['POS Stok'];
 ok(d.length===1&&d[0].id==='m150'&&d[0].qty===7,'a row updated in the middle of the tab is pulled (and only that one): '+d.map(x=>x.id));
 await wait(30);since=Date.now();await wait(30);
 await post({action:'upsert',rows:{'POS Stok':[st('m3',2),st('new1',5)]}});
 d=(await pull(since)).data['POS Stok'].map(x=>x.id).sort();
 ok(d.join()==='m3,new1','an early row + a new row: both pulled, the rows in between are not: '+d);
 ok((await pull(0)).data['POS Stok'].length===301,'a full pull (since 0) still returns every row');
 // posDaily: receipts of today per shift, VOID left out
 await post({action:'upsert',rows:{'POS Kasir':[{id:'r1',tanggal:today,toko:'Toko A',shiftId:'s1',total:100000,items:'[{"x":1}]'},{id:'r2',tanggal:today,toko:'Toko A',shiftId:'s1',total:50000,items:'[]'},{id:'r3',tanggal:today,toko:'Toko A',shiftId:'s1',total:999,status:'VOID'},{id:'r4',tanggal:'2020-01-01',toko:'Toko A',shiftId:'s0',total:5}]}});
 const h=(await fetch(B+'?pin='+P).then(r=>r.json())).data['POS Harian'];
 ok(h.length===1&&h[0].total===150000&&h[0].n===2&&h[0].toko==='Toko A'&&h[0].shiftId==='s1','POS Harian: today per shift, VOID and old receipts left out: '+JSON.stringify(h));
 console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0)})().catch(e=>{console.error('ERROR',e.message);process.exit(1)});

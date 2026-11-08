// Smoke test for the WISMIR dashboard single-file HTML (no browser needed).
// Usage: node smoke_test.js path/to/dashboard.html
// Renders every tab/sub-tab against a fake DOM, then exercises add/edit/delete flows.
// Catches ReferenceErrors and broken render paths that a plain syntax check misses.
const fs=require('fs'),vm=require('vm');
const file=process.argv[2];
if(!file){console.error('usage: node smoke_test.js dashboard.html');process.exit(2)}
const html=fs.readFileSync(file,'utf8');
const code=html.match(/<script>([\s\S]*)<\/script>/)[1];
try{new Function(code)}catch(e){console.log('SYNTAX ERR',e.message);process.exit(1)}
const els={};
const mk=()=>new Proxy(function(){},{
  get:(t,k)=>k==='classList'?{add(){},remove(){},toggle(){}}:k==='dataset'?{}:k==='style'?{}
    :k==='addEventListener'?()=>{}:k==='getBoundingClientRect'?()=>({bottom:10,left:5})
    :k==='querySelector'?()=>mk():k==='querySelectorAll'?()=>[]:(k in t?t[k]:undefined),
  set:(t,k,v)=>{t[k]=v;return true},apply:()=>mk()});
const store={};
const sb={document:{querySelector:s=>els[s]||(els[s]=mk()),querySelectorAll:()=>[],documentElement:{dataset:{}},addEventListener(){},createElement:()=>mk()},
  localStorage:{getItem:k=>store[k]||null,setItem:(k,v)=>store[k]=v},matchMedia:()=>({matches:false}),
  addEventListener(){},innerWidth:400,scrollY:0,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,scrollTo(){},
  alert(){},confirm:()=>true,fetch:async()=>({json:async()=>({})}),Blob:function(){},URL:{createObjectURL:()=>''},console};
sb.window=sb;
const d=new Date(),ym=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
store.wismir_v1=JSON.stringify({
  tx:[{id:'a',tanggal:ym+'-01',jenis:'Income',kategori:'Sales',jumlah:1000}],
  products:[{id:'p',nama:'X',varian:'M',stokToko:1,stokOnline:0,min:3,harga:5}],
  tasks:[{id:'t1',judul:'A',tempo:ym+'-01',selesai:'',div:'Finance'},{id:'t2',judul:'B',tempo:'',selesai:'',repeat:'Daily',div:'Marketing'},{id:'t3',judul:'C',tempo:'2099-01-01',selesai:'',div:'Production',repeat:'Custom',every:'2',unit:'weeks'}],
  prod:[{id:'q',date:ym+'-01',name:'P',qty:2,material:'M',matQty:3,unitCost:5,total:10,status:'Ongoing'}],
  mkt:[{id:'m',name:'M',channel:'Instagram',status:'Planned',budget:1,spent:1,revenue:2}],
  purch:[{id:'u',date:ym+'-01',name:'T',category:'Textile',qty:1,total:5}],
  staff:[{id:'s',name:'N',joined:ym+'-01'}],stores:[{id:'o',name:'S',type:'Physical store',address:'x'}],cfg:{url:'',pin:''},
  pos:{produk:[{id:'P1',nama:'Gamis',kategori:'Gamis',aktif:1},{id:'P2',nama:'Hijab',kategori:'Hijab',aktif:1}],
  stok:[{id:'M1',pid:'P1',dari:'Supplier',ke:'Gudang',qty:10,status:'ok'},{id:'M2',pid:'P1',dari:'Gudang',ke:'Toko A',qty:4,status:'ok'},{id:'M3',pid:'P2',dari:'Supplier',ke:'Toko B',qty:2,status:'ok'},{id:'M4',pid:'P1',dari:'Toko A',ke:'Sale',qty:1,status:'ok'}],
  shift:[{id:'SH1',tanggal:'2026-11-03T17:00:00.000Z',toko:'Toko A',buka:'09:00',tutup:'17:00',karyawan:'Rina, Budi',kasAwal:100000,penjualanTunai:150000,kasMasuk:0,kasKeluar:0,kasSeharusnya:250000,tunai:150000,transfer:50000,edc:0,totalPenjualan:200000,transaksi:3,tTutup:'1'}],
  absen:[{id:'A1',tanggal:ym+'-02',nama:'Rina'},{id:'A2',tanggal:ym+'-03',nama:'Rina'}]}});
vm.createContext(sb);
let bad=0;
const run=(c,label)=>{try{vm.runInContext(c,sb);console.log('ok ',label||c.slice(0,60))}catch(e){bad++;console.log('ERR',label||c.slice(0,60),'->',e.message)}};
try{vm.runInContext(code,sb)}catch(e){bad++;console.log('LOAD ERR',e.message)}
// render every tab and its sub-views
const tabs=vm.runInContext('TABS.map(t=>t[0])',sb);
for(const t of tabs){
  if(t==='prod')for(const p of ['purch','manu'])run(`tab='prod';pt='${p}';render()`,`render prod/${p}`);
  else if(t==='ops')for(const o of ['stock','pos','staff','att','store'])run(`tab='ops';ops='${o}';render()`,`render ops/${o}`);
  else run(`tab='${t}';render()`,`render ${t}`);
}
// edit + two-tap delete flows (in-app confirmation, never native confirm())
for(const [open,get] of [["editTx('a')","S.tx"],["editProduct('p')","S.products"],["editProd('q')","S.prod"],["editMkt('m')","S.mkt"],["editPurch('u')","S.purch"],["editStaff('s')","S.staff"],["editStore('o')","S.stores"],["editTask('t1')","S.tasks"]]){
  try{const b=vm.runInContext(get+'.length',sb);vm.runInContext(open+";$('#rm').onclick();$('#rm').onclick()",sb);
    const a=vm.runInContext(get+'.length',sb);console.log(a<b?'ok ':'ERR',open,b,'->',a);if(a>=b)bad++}
  catch(e){bad++;console.log('ERR',open,e.message)}
}
// reminders: complete one-off, daily and custom repeat
run("tog('t2');tog('t3');tab='task';render()",'complete reminders');
run("addTask('Finance');tab='home';render()",'add reminder + home');
run("['late','today','nod'].forEach(showKpi)",'KPI popovers');
run("tab='tx';render();posShift('SH1');close()",'finance with POS + shift sheet');
run("tab='ops';ops='stock';stv='hist';HF.per='all';render();HF.loc='Toko A';if(histRows().length!==2)throw Error('loc '+histRows().length);HF.type='sale';if(histRows().length!==1)throw Error('type');HF.loc='all';HF.type='all';hList();stv='list'",'stock history + filters');
run("if(nd('2026-11-03T17:00:00.000Z')!==ymd(new Date('2026-11-03T17:00:00.000Z')))throw Error('nd');if(nd('2026-11-04')!=='2026-11-04')throw Error('nd2')",'date normalisation');
run("const m=posStock();if(m.P1.Gudang!==6||m.P1['Toko A']!==3)throw Error(JSON.stringify(m));S.products.push({id:'P2',nama:'Hijab',stokOnline:1,min:3});if(!lowStock().some(p=>p.id==='P2'))throw Error('low');tab='ops';ops='stock';render();if(!String(document.querySelector('#app').innerHTML).includes('ptab'))throw Error('table')",'POS stock math + low stock + product table');
run("S.cfg.url='x';S.cfg.pulled=0;pushSheets()",'push blocked before first pull');
console.log(bad?`\n${bad} problem(s)`:'\nall good');process.exit(bad?1:0);

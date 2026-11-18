// Fake Google Apps Script runtime + HTTP server that runs the real ../Code.gs against an in-memory spreadsheet.
// Emulates Sheets turning date-like / number-like text into dates/numbers unless the cell format is plain text ('@').
// Serves the repo files too. PIN in this fake = 9999. GET /dump shows the sheet contents.
const fs=require('fs'),http=require('http'),vm=require('vm'),path=require('path');
const ROOT=path.resolve(__dirname,'..');
function Sheet(name){this.name=name;this.v=[];this.f=[];}
Sheet.prototype.getLastRow=function(){let n=this.v.length;while(n&&this.v[n-1].every(x=>x===''))n--;return n};
Sheet.prototype.getLastColumn=function(){return Math.max(0,...this.v.map(r=>{let n=r.length;while(n&&r[n-1]==='')n--;return n}))};
Sheet.prototype.setFrozenRows=function(){};
Sheet.prototype.getName=function(){return this.name};
Sheet.prototype.appendRow=function(row){const n=this.getLastRow()+1;this.cell(n,row.length);row.forEach((x,j)=>this.v[n-1][j]=x)};
Sheet.prototype.deleteRow=function(r){this.v.splice(r-1,1);this.f.splice(r-1,1)};
Sheet.prototype.cell=function(r,c){while(this.v.length<r){this.v.push([]);this.f.push([])}const row=this.v[r-1];while(row.length<c)row.push('');const fr=this.f[r-1];while(fr.length<c)fr.push('');};
Sheet.prototype.getDataRange=function(){return this.getRange(1,1,Math.max(1,this.getLastRow()),Math.max(1,this.getLastColumn()))};
Sheet.prototype.getRange=function(r,c,nr=1,nc=1){const sh=this;const each=fn=>{for(let i=0;i<nr;i++)for(let j=0;j<nc;j++){sh.cell(r+i,c+j);fn(i,j)}};
 const R={
  getValue(){sh.cell(r,c);return sh.v[r-1][c-1]},
  getDisplayValues(){return R.getValues().map(row=>row.map(x=>String(x)))},
  getValues(){const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++){sh.cell(r+i,c+j);row.push(sh.v[r+i-1][c+j-1])}o.push(row)}return o},
  setValues(m){each((i,j)=>{let x=m[i][j];const fmt=sh.f[r+i-1][c+j-1];
    // emulate Sheets auto-conversion when the cell is not plain text
    if(fmt!=='@'&&typeof x==='string'){if(/^\d{4}-\d{2}-\d{2}$/.test(x))x=new Date(x+'T00:00:00+07:00');else if(/^-?\d+(\.\d+)?$/.test(x))x=Number(x)}
    sh.v[r+i-1][c+j-1]=x});return R},
  setNumberFormat(f){each((i,j)=>sh.f[r+i-1][c+j-1]=f);return R},
  setNumberFormats(m){each((i,j)=>sh.f[r+i-1][c+j-1]=m[i][j]);return R},
  clearContent(){each((i,j)=>sh.v[r+i-1][c+j-1]='');return R},
  setFontWeight(){return R}};return R};
const PROPS={PIN:'9999',CATALOG_SHEET_ID:'CAT',GITHUB_REPO:'o/r',GITHUB_TOKEN:'tok'};const SS={sheets:{},getSheetByName(n){return this.sheets[n]||null},insertSheet(n){return this.sheets[n]=new Sheet(n)},getSpreadsheetTimeZone(){return 'Asia/Jakarta'}};
// Catalog (website) Sheet + GitHub contents API + script cache, for Marketing > Website (Code.gs v14)
const CAT_HEAD=['nama','kategori','bahan','ukuran','terbaru','foto','deskripsi','detail','sale'];
const CAT_SS={sheets:{},getSheetByName(n){return this.sheets[n]||null},getSheets(){return Object.values(this.sheets)}};
let GH={},GHCALLS=[],CACHE={},SCRIPT_LOCK_HELD=false; // SCRIPT_LOCK_HELD simulates a dashboard/POS sync that is holding the script lock
function resetCat(){CAT_SS.sheets={};const s=CAT_SS.sheets.produk=new Sheet('produk');
 s.v=[CAT_HEAD.slice(),['Gamis bordir','Gamis','Katun linen','M, L','ya','a.jpg|b.jpg|c.jpg','Adem','- Rapi',''],['Kulot polos','Bawahan','Linen','All size','','c.jpg|d.jpg','','','ya']];s.f=s.v.map(r=>r.map(()=>'@'));
 GH={'foto/a.jpg':'A','foto/b.jpg':'B','foto/c.jpg':'C','foto/d.jpg':'D'};GHCALLS=[];CACHE={}}
resetCat();
const GHRES=(code,obj)=>({getResponseCode:()=>code,getContentText:()=>JSON.stringify(obj||{})});
const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>SS,getActive:()=>SS,openById:id=>{if(id!=='CAT')throw new Error('Unable to open spreadsheet '+id);return CAT_SS}},
 CacheService:{getScriptCache:()=>({get:k=>{const v=CACHE[k];return v&&v.exp>Date.now()?v.v:null},put:(k,v,ttl)=>{CACHE[k]={v,exp:Date.now()+ttl*1000}},remove:k=>{delete CACHE[k]}})},
 UrlFetchApp:{fetch:(url,o)=>{const m=url.match(/\/contents\/([^?]+)/),path=decodeURIComponent(m[1]);GHCALLS.push((o.method)+' '+path);
   if(o.method==='get')return GH[path]!=null?GHRES(200,{sha:'sha-'+path}):GHRES(404);
   if(o.method==='put'){const b=JSON.parse(o.payload);GH[path]=Buffer.from(b.content,'base64').toString('latin1');return GHRES(201)}
   if(o.method==='delete'){delete GH[path];return GHRES(200)}return GHRES(400)}},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({t,setMimeType(){return this}})},
 LockService:{getScriptLock:()=>({waitLock(){if(SCRIPT_LOCK_HELD)throw new Error('Lock timeout')},tryLock(){return !SCRIPT_LOCK_HELD},releaseLock(){}}),getUserLock:()=>({waitLock(){},tryLock(){return true},releaseLock(){}})},
 Utilities:{sleep(){},formatDate:(d,tz,f)=>{const s=new Date(d.getTime()+7*3600e3).toISOString();return f==='HH:mm'?s.slice(11,16):s.slice(0,10)}},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>PROPS[k]||null,setProperty:(k,v)=>{PROPS[k]=v}})},
 console,Date,JSON,Number,String,Object,Math,isFinite};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(ROOT+'/Code.gs','utf8'),ctx);
// pre-existing dashboard data written by the OLD script (dates already converted by Sheets)
const k=SS.insertSheet('Keuangan');k.v=[['id','tanggal','jenis','kategori','jumlah','channel','catatan'],['old1',new Date('2026-11-01T00:00:00+07:00'),'Income','Sales',500000,'Instagram','lama']];k.f=[[],[]];
let hits={get:0,post:0};
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://x');
 if(u.pathname==='/exec'){
  const send=o=>{res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(o.t)};
  if(req.method==='GET'){hits.get++;return send(ctx.doGet({parameter:Object.fromEntries(u.searchParams)}))}
  let b='';req.on('data',d=>b+=d);req.on('end',()=>{hits.post++;send(ctx.doPost({postData:{contents:b}}))});return;
 }
 if(u.pathname==='/dump-cat'){res.writeHead(200,{'Content-Type':'application/json'});return res.end(JSON.stringify({rows:CAT_SS.sheets.produk.v.slice(0,CAT_SS.sheets.produk.getLastRow()),gh:Object.keys(GH).sort(),calls:GHCALLS,ghSize:Object.fromEntries(Object.entries(GH).map(([k,v])=>[k,v.length]))}))}
 if(u.pathname==='/hold-lock'){SCRIPT_LOCK_HELD=u.searchParams.get('on')==='1';res.writeHead(200);return res.end('ok')}
 if(u.pathname==='/reset-cat'){resetCat();SCRIPT_LOCK_HELD=false;res.writeHead(200);return res.end('ok')}
 if(u.pathname==='/dump'){res.writeHead(200,{'Content-Type':'application/json'});const o={};for(const n in SS.sheets)o[n]={v:SS.sheets[n].v.slice(0,SS.sheets[n].getLastRow()),f:SS.sheets[n].f.slice(0,3)};return res.end(JSON.stringify({hits,o}))}
 const f=path.join(ROOT,u.pathname);if(fs.existsSync(f)&&fs.statSync(f).isFile()){const T={'.html':'text/html','.js':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png','.md':'text/plain'};res.writeHead(200,{'Content-Type':T[path.extname(f)]||'application/octet-stream'});return res.end(fs.readFileSync(f))}
 res.writeHead(404);res.end();
}).listen(8765,()=>console.log('listening'));

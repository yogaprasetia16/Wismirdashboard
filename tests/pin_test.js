const fs=require('fs'),vm=require('vm');
let fail=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fail++};
const props={},alerts=[];let answer=null,menu=[];
function Sh(n){this.n=n;this.v=[]}
Sh.prototype={getName(){return this.n},getLastRow(){return this.v.length},setFrozenRows(){},getRange(r,c,nr,nc){const s=this;const R={getValues:()=>[Array.from({length:nc},(_,j)=>(s.v[r-1]||[])[c-1+j]??'')],setValues(m){s.v[r-1]=m[0].slice();return R},setNumberFormat(){return R},setFontWeight(){return R},setBackground(){return R}};return R}};
const list=[new Sh('Sheet1')];
const ui={ButtonSet:{OK_CANCEL:1},Button:{OK:'OK',CANCEL:'C'},alert:m=>alerts.push(m),prompt:()=>({getSelectedButton:()=>answer?'OK':'C',getResponseText:()=>answer||''}),
 createMenu:n=>{const m={items:[],addItem(a,f){this.items.push(a+':'+f);return this},addToUi(){menu=this.items}};return m}};
const SS={getSheets:()=>list.slice(),getSheetByName:n=>list.find(s=>s.n===n)||null,insertSheet(n){const s=new Sh(n);list.push(s);return s},deleteSheet(s){list.splice(list.indexOf(s),1)},setSpreadsheetTimeZone(){}};
const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>SS,getUi:()=>ui},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>{props[k]=v}})},
 Logger:{log(){}},ContentService:{MimeType:{},createTextOutput:t=>({t,setMimeType(){return this}})},LockService:{getScriptLock:()=>({waitLock(){},tryLock(){return true},releaseLock(){}})},Object,JSON,Number,String,Error,Date};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','Code.gs'),'utf8'),ctx);
ok(!/GANTI-PIN|const PIN\s*=/.test(fs.readFileSync(require('path').join(__dirname,'..','Code.gs'),'utf8')),'no PIN written in the code');
const g=pin=>JSON.parse(vm.runInContext(`doGet({parameter:{pin:${JSON.stringify(pin)}}}).t`,ctx));
ok(g('x').error.includes('Atur PIN'),'before a PIN is set, requests are refused with a hint');
vm.runInContext('setup()',ctx);ok(alerts.pop().includes('Atur PIN'),'setup works without editing code and tells the next step');
vm.runInContext('onOpen()',ctx);ok(menu.join()==='Atur PIN:setPin,Siapkan tab:setup','menu WISMIR: Atur PIN, Siapkan tab');
answer='12';vm.runInContext('setPin()',ctx);ok(!props.PIN&&alerts.pop().includes('minimal'),'too-short PIN rejected');
answer='wismir2580';vm.runInContext('setPin()',ctx);ok(props.PIN==='wismir2580','PIN saved in Script Properties');
ok(g('wrong').error==='PIN salah'&&g('wismir2580').ok===true,'wrong PIN refused, right PIN accepted');
// simulate a code update: fresh context, same properties
const ctx2=vm.createContext({...ctx});vm.runInContext(fs.readFileSync(require('path').join(__dirname,'..','Code.gs'),'utf8'),ctx2);
ok(JSON.parse(vm.runInContext(`doGet({parameter:{pin:'wismir2580'}}).t`,ctx2)).ok,'PIN survives pasting new code');
console.log(fail?fail+' FAILED':'ALL PASSED');process.exit(fail?1:0);

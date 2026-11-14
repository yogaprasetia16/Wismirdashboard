// Builds preview copies with sample data so the owner can look at the design without Google Sheets.
// Usage: node tests/make_preview.js <output-dir>   -> <out>/dashboard-preview.html, <out>/pos-preview.html
// Send them with display "render" and/or publish them as a private Artifact (see CLAUDE.md). Never commit the preview files.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=process.argv[2];
if(!out){console.error('usage: node tests/make_preview.js <output-dir>');process.exit(2)}
fs.mkdirSync(out,{recursive:true});
const demo=fs.readFileSync(path.join(__dirname,'preview-demo.js'),'utf8');
let d=fs.readFileSync(path.join(root,'dashboard.html'),'utf8');
const hook='S.pos=S.pos||{};';
if(d.split(hook).length!==2)throw new Error('dashboard.html changed: hook "'+hook+'" not found once');
d=d.replace(hook,hook+'\n'+demo).replace('<title>WISMIR Dashboard</title>','<title>WISMIR Dashboard (preview)</title>');
fs.writeFileSync(path.join(out,'dashboard-preview.html'),d);
// POS starts empty in real use; the preview gets sample products, staff, stock and stores (owner PIN 1234)
let pos=fs.readFileSync(path.join(root,'pos.html'),'utf8');const ph='let S=load()||blank();';
if(pos.split(ph).length!==2)throw new Error('pos.html changed: hook "'+ph+'" not found once');
pos=pos.replace(ph,'let S=load()||'+JSON.stringify(require('./pos-sample')())+';').replace('<title>WISMIR POS</title>','<title>WISMIR POS (preview)</title>');
fs.writeFileSync(path.join(out,'pos-preview.html'),pos);
console.log('written to',out);

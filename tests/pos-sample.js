// Sample POS state for previews and tests only (the real POS starts empty and gets everything from the dashboard).
// Usage: const sample=require('./pos-sample'); localStorage['wismir_pos_v1']=JSON.stringify(sample())
module.exports=function sample(){
  const P=[["Gamis Syar'i Navy",'Gamis'],['Gamis Polos Hitam','Gamis'],['Gamis Brokat Maroon','Gamis'],['Khimar Instan Cream','Hijab'],['Pashmina Ceruty Sage','Hijab'],
    ['Hijab Segi Empat Voal','Hijab'],['Abaya Dubai Mocha','Abaya'],['Koko Pria Putih','Koko'],['Mukena Katun Jepang','Mukena'],['Sarung Tenun Premium','Sarung']];
  const t=Date.now()-86400000,products=[],moves=[];
  P.forEach((p,i)=>{const id='PS'+i;products.push({id,name:p[0],category:p[1],active:true});
    [['Gudang',40+i],['Toko A',8+i%4],['Toko B',6+i%3]].forEach((x,k)=>moves.push({id:'MS'+i+'_'+k,t,pid:id,from:'Supplier',to:x[0],qty:x[1],by:'Sampel',note:'Stok sampel',status:'ok',kind:'manual'}))});
  return {v:1,cfg:{store:'Toko A',pin:'1234'},products,staff:['Rina','Budi','Sari','Andi'].map((n,i)=>({id:'KS'+i,name:n,active:true})),
    moves,txs:[],shifts:[],attendance:[],prices:{},shift:null,cart:[],holds:[],outbox:[],since:0,epoch:'0',locs:{stores:['Toko A','Toko B'],wh:['Gudang']}};
};

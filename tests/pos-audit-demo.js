// POS › Audit sample for previews only (the real POS reads https://wismir.id/katalog.json and photos from wismir.id).
// Dummy catalog + coloured placeholder photos + a few Kurang/Habis statuses, so the Audit menu can be clicked through in an artifact.
(()=>{
 const C={a1:'#2b2b2e',a2:'#a07a5f',a3:'#2d3e5c',a4:'#e9dcc6',a5:'#a5a9ad',b1:'#9fb39a',b2:'#7a2f3a',b3:'#c99aa0',c1:'#e9dcc6',c2:'#b7a6cf',c3:'#b9dccd',d1:'#a5a9ad',d2:'#b8613f'};
 const img=f=>'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80"><rect width="60" height="80" fill="#efe7da"/><path fill="'+(C[String(f).replace(/^.*\//,'').replace(/\..*/,'')]||'#999')+'" d="M22 8h16l2 7 8 4-4 12-6-2 8 46H14l8-46-6 2-4-12 8-4z"/></svg>');
 const CAT={v:1,items:[{nama:'Kulot',kategori:'Bawahan',ukuran:'S, M, L, XL',foto:'a1.jpg|a2.jpg|a3.jpg|a4.jpg|a5.jpg'},{nama:'Gamis Polos',kategori:'Gamis',ukuran:'M, L, XL',foto:'b1.jpg|b2.jpg|b3.jpg'},{nama:'Blus Gazella',kategori:'Atasan',ukuran:'All size',foto:'c1.jpg|c2.jpg|c3.jpg'},{nama:'Oneset Linen',kategori:'Oneset',ukuran:'S, M, L',foto:'d1.jpg|d2.jpg'}]};
 window.__catUrl='https://example.invalid/katalog.json';
 const f0=window.fetch;
 window.fetch=function(u,o){return /katalog\.json/.test(String(u))?Promise.resolve(new Response(JSON.stringify(CAT),{status:200,headers:{'content-type':'application/json'}})):f0.apply(this,arguments)};
 window.__auImgDemo=img;
 S.audit=S.audit||[];if(!S.audit.length){const t=Date.now(),A=(st,f,z,h)=>({id:st+'|'+f,store:st,prod:'',foto:f,z:z,by:'Owner',t:t-h*3600000});
  S.audit=[A('Toko A','a2.jpg',{M:'low'},2),A('Toko A','a4.jpg',{L:'out',XL:'low'},2),A('Toko A','b1.jpg',{XL:'low'},5),A('Toko A','c3.jpg',{all:'out'},26),A('Toko B','a2.jpg',{S:'out'},3),A('Toko B','a1.jpg',{XL:'low'},3),A('Toko B','d2.jpg',{L:'out'},30)]}
})();

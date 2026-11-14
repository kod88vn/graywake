// Crafting at home with a full pack and a box with room: the output must go to the box (0.10.62).
// Usage: node tools/measure/craftfull.mjs <repo root>
const root=process.argv[2],R='file://'+root+'/js/';
const c=await import(R+'sim/core.js');const World=await import(R+'sim/world.js');const {RECIPES}=await import(R+'data/recipes.js');c.G.headless=true;
const S=World.newGame(21),Z=c.G.Z,w=Z.w,x=Math.floor(Z.pl.x),y=Math.floor(Z.pl.y);
Z.obj[y*w+x+2]={k:'box_small',r:0,v:0,hp:100,inv:[]};
const cap=c.slotCount(S);S.p.inv=[{id:'stick',n:20},{id:'stone',n:20},{id:'fiber',n:20}];while(S.p.inv.filter(Boolean).length<cap)S.p.inv.push({id:'hatchet_stone',n:1,d:10});
const r=RECIPES.hatchet_stone||Object.values(RECIPES).find(r=>r.o==='hatchet_stone');
const why=c.canCraft(S,r,1,null);const ok=why===null||why===undefined?c.craft(S,r.id,1):false;
const hatchets=S.p.inv.filter(s=>s&&s.id==='hatchet_stone').length,box=(Z.obj[y*w+x+2].inv||[]).filter(Boolean).map(s=>s.id);
console.log('pack full, craft refused?',why,'| crafted:',ok,'| hatchets in pack',hatchets,'| in box',box.join(','));

// Where Auto stands when a tide begins if it was switched on well away from a walled yard, 24 minutes before.
// Usage: node tools/measure/pretide.mjs <repo root> [runs=8]    Prints the distance from the yard middle at tide start (0.10.61 fixed 14-15 tiles to ~1.4).
const root=process.argv[2],N=+(process.argv[3]||8),R='file://'+root+'/js/';
const {G,give,equip,derive,edgeIdx}=await import(R+'sim/core.js');const World=await import(R+'sim/world.js');
G.headless=true;
const rs=[];
for(let r=0;r<N;r++){
  const S=World.newGame(900+r*13),Z=G.Z,W=Z.w,cx=Math.floor(W/2),cy=Math.floor(Z.h/2);
  for(let y=cy-4;y<=cy+4;y++)for(let x=cx-4;x<=cx+4;x++)Z.obj[y*W+x]=null;
  for(let k=-2;k<=2;k++){Z.ed[edgeIdx(W,cx+k,cy-2,0)]={k:'wall_stone',hp:900};Z.ed[edgeIdx(W,cx+k,cy+2,2)]=k===0?{k:'door_plank',hp:300}:{k:'wall_stone',hp:900};Z.ed[edgeIdx(W,cx-2,cy+k,3)]={k:'wall_stone',hp:900};Z.ed[edgeIdx(W,cx+2,cy+k,1)]={k:'wall_stone',hp:900}}
  Z.obj[cy*W+cx]={k:'bed_roll',r:0,v:0,hp:60};Z.obj[(cy-1)*W+cx+1]={k:'campfire',r:0,v:0,hp:100};Z.navDirty=true;
  S.p.lvl=10;give(S,'machete',1);equip(S,S.p.inv.findIndex(s=>s&&s.id==='machete'),'w1');G.ds=derive(S);S.p.hp=G.ds.maxHp;
  // out gathering: 12 tiles from the yard, with Auto on, 24 minutes before the tide
  Z.pl.x=cx+.5+12;Z.pl.y=cy+.5+8;G.auto=true;S.tide.at=S.t+24;
  let t=0,at=null;const dt=1/30;
  while(t<60*60){S.p.hp=1e6;S.p.food=90;S.p.water=90;G.auto=true;World.tick(dt);G.ev.length=0;t+=dt;if(S.tide.live){at={x:Z.pl.x-cx-.5,y:Z.pl.y-cy-.5};break}}
  rs.push(at?Math.hypot(at.x,at.y):null);
}
console.log(`distance from the yard's middle when the tide began: ${rs.map(d=>d===null?'no tide':d.toFixed(1)).join(', ')}`);

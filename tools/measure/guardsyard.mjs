// Survivors in a tide with the player passive and unhurtable: how many attackers they kill and how many wall pieces are lost.
// Usage: node tools/measure/guardsyard.mjs <repo root> <tide n> <survivors> [runs] [windows: 0 none, 1 one per side, 2 two per side]
// Stone yard with a door; the survivors stand at the windows. Used to measure 0.10.52 (shoot over walls) and 0.10.57 (windows).
const root=process.argv[2],n=+(process.argv[3]||8),guards=+(process.argv[4]||3),N=+(process.argv[5]||6),WIN=+(process.argv[6]||0),R='file://'+root+'/js/';
const {G,derive,edgeIdx}=await import(R+'sim/core.js');const World=await import(R+'sim/world.js');
G.headless=true;
const rs=[];
for(let r=0;r<N;r++){
  const S=World.newGame(5000+r*31),Z=G.Z;S.tide.n=n-1;S.p.lvl=1+n*3;G.ds=derive(S);
  {const W=Z.w,cx=Math.floor(Z.w/2),cy=Math.floor(Z.h/2);for(let y=cy-4;y<=cy+4;y++)for(let x=cx-4;x<=cx+4;x++)Z.obj[y*W+x]=null;
    for(let k=-3;k<=3;k++){Z.ed[edgeIdx(W,cx+k,cy-3,0)]={k:'wall_stone',hp:900};Z.ed[edgeIdx(W,cx+k,cy+3,2)]=k===0?{k:'door_plank',hp:300}:{k:'wall_stone',hp:900};Z.ed[edgeIdx(W,cx-3,cy+k,3)]={k:'wall_stone',hp:900};Z.ed[edgeIdx(W,cx+3,cy+k,1)]={k:'wall_stone',hp:900}}
    if(WIN&&globalThis.__noWin!==1){const wk=WIN?'window_stone':'wall_stone';for(const k of(WIN>=2?[-2,2]:[-1])){Z.ed[edgeIdx(W,cx+k,cy-3,0)]={k:wk,hp:650};Z.ed[edgeIdx(W,cx-3,cy+k,3)]={k:wk,hp:650};Z.ed[edgeIdx(W,cx+3,cy+k,1)]={k:wk,hp:650};Z.ed[edgeIdx(W,cx+k,cy+3,2)]={k:wk,hp:650}}}
    for(let k=0;k<3;k++)Z.obj[(cy+2)*W+cx-2+k*2]={k:'bed',r:0,v:0,hp:100};Z.navDirty=true;Z.pl.x=cx+.5;Z.pl.y=cy+.5}
  for(let g=0;g<guards;g++){const sv=World.addSurvivor(S,{id:++S.survN,n:'G'+g,trait:'strong'});if(sv)sv.job='farm'}
  // let the survivors walk out as people first (they are spawned as actors at home)
  for(let k=0;k<60;k++){World.tick(1/10);G.ev.length=0}
  for(const a of Z.actors)if(a.sv){a.x=Z.w/2+(Math.random()-.5)*3;a.y=Z.h/2+(Math.random()-.5)*3}const people=Z.actors.filter(a=>a.sv).length;
  S.tide.at=S.t+.5;let t=0,hp0=0,dealt=0,kills=0,spawned=0,gd=0,gs=0,maxLvl=0,eLvl=0;const seen=new Set();
  while(t<300){S.p.hp=1e6;G.auto=false;World.tick(1/30);G.ev.length=0;t+=1/30;
    for(const a of Z.actors){if(a.team===1&&a.tide&&!seen.has(a.id)){seen.add(a.id);spawned++;eLvl=a.lvl}if(a.def&&a.def.ai==='guard'&&a.from==='home'){gs=Math.max(gs,1);maxLvl=a.lvl;if(a.dead)gd++}}
    if(S.tide.live===null&&t>3)break}
  const left=Z.actors.filter(a=>a.team===1&&!a.dead&&a.tide).length,gAlive=Z.actors.filter(a=>a.def&&a.def.ai==='guard'&&a.from==='home'&&!a.dead).length;
  rs.push({people,guardsSpawned:Z.actors.filter(a=>a.def&&a.def.ai==='guard').length+0,gAlive,spawned,left,killed:spawned-left,ended:!S.tide.live,t:Math.round(t),walls:Z.ed.filter(Boolean).length,lost:S.stats.lostWalls||0});
}
console.log(`tide ${n}, ${guards} survivors:`);for(const r of rs)console.log(' ',JSON.stringify(r));

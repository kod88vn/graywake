// Early version of guardsyard.mjs without walls (survivors in the open). Kept for comparison.
// Usage: node tools/measure/guards.mjs <repo root> <tide n> <survivors> [runs]
const root=process.argv[2],n=+(process.argv[3]||8),guards=+(process.argv[4]||3),N=+(process.argv[5]||6),R='file://'+root+'/js/';
const {G,derive}=await import(R+'sim/core.js');const World=await import(R+'sim/world.js');
G.headless=true;
const rs=[];
for(let r=0;r<N;r++){
  const S=World.newGame(5000+r*31),Z=G.Z;S.tide.n=n-1;S.p.lvl=1+n*3;G.ds=derive(S);
  {const cx=Math.floor(Z.w/2),cy=Math.floor(Z.h/2);for(let k=0;k<4;k++){const i=(cy+3)*Z.w+cx-3+k*2;Z.obj[i]={k:'bed',r:0,v:0,hp:100}}}
  for(let g=0;g<guards;g++){const sv=World.addSurvivor(S,{id:++S.survN,n:'G'+g,trait:'strong'});if(sv)sv.job='farm'}
  // let the survivors walk out as people first (they are spawned as actors at home)
  for(let k=0;k<60;k++){World.tick(1/10);G.ev.length=0}
  const people=Z.actors.filter(a=>a.sv).length;
  S.tide.at=S.t+.5;let t=0,hp0=0,dealt=0,kills=0,spawned=0,gd=0,gs=0,maxLvl=0,eLvl=0;const seen=new Set();
  while(t<300){S.p.hp=1e6;G.auto=false;World.tick(1/30);G.ev.length=0;t+=1/30;
    for(const a of Z.actors){if(a.team===1&&a.tide&&!seen.has(a.id)){seen.add(a.id);spawned++;eLvl=a.lvl}if(a.def&&a.def.ai==='guard'&&a.from==='home'){gs=Math.max(gs,1);maxLvl=a.lvl;if(a.dead)gd++}}
    if(S.tide.live===null&&t>3)break}
  const left=Z.actors.filter(a=>a.team===1&&!a.dead&&a.tide).length,gAlive=Z.actors.filter(a=>a.def&&a.def.ai==='guard'&&a.from==='home'&&!a.dead).length;
  rs.push({people,guardsSpawned:Z.actors.filter(a=>a.def&&a.def.ai==='guard').length+0,gAlive,spawned,left,killed:spawned-left,ended:!S.tide.live,t:Math.round(t),guardLvl:maxLvl,enemyLvl:eLvl});
}
console.log(`tide ${n}, ${guards} survivors:`);for(const r of rs)console.log(' ',JSON.stringify(r));

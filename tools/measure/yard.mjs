// Tide survival in a walled yard: a 5x5 stone yard with a door and a bed, a ring of stake traps and guard survivors, Auto mode fighting a tide.
// Usage: node tools/measure/yard.mjs <repo root> [runs=32] [start outside=1|inside=0] [traps=0] [guards=0]
// Prints how many runs lived, how many tides ended, and the share of the tide Auto spent outside the walls. Tide 5, a level 16 character with a machete.
const root=process.argv[2],N=+(process.argv[3]||32),outside=process.argv[4]!=='0',traps=+(process.argv[5]||0),guards=+(process.argv[6]||0),R='file://'+root+'/js/';
const {G,give,equip,derive,edgeIdx}=await import(R+'sim/core.js');const World=await import(R+'sim/world.js');
G.headless=true;
async function trial(n,weapon,armor){
  const S=World.newGame(1000+Math.floor(Math.random()*1e6)),Z=G.Z,W=Z.w,cx=Math.floor(W/2),cy=Math.floor(Z.h/2);
  // clear a 9x9 patch, then a 5x5 yard of stone walls (x cx-2..cx+2, y cy-2..cy+2) with a plank door in the middle of the south side, a bed inside
  for(let y=cy-4;y<=cy+4;y++)for(let x=cx-4;x<=cx+4;x++){Z.obj[y*W+x]=null;Z.g[y*W+x]=Z.g[y*W+x]===6?0:Z.g[y*W+x]}
  for(let k=-2;k<=2;k++){Z.ed[edgeIdx(W,cx+k,cy-2,0)]={k:'wall_stone',hp:900};Z.ed[edgeIdx(W,cx+k,cy+2,2)]=k===0?{k:'door_plank',hp:300}:{k:'wall_stone',hp:900};
    Z.ed[edgeIdx(W,cx-2,cy+k,3)]={k:'wall_stone',hp:900};Z.ed[edgeIdx(W,cx+2,cy+k,1)]={k:'wall_stone',hp:900}}
  Z.obj[cy*W+cx]={k:'bed_roll',r:0,v:0,hp:60};
  // a ring of stake traps one tile out from the walls, leaving the door's approach open
  if(traps){let n=0;for(let k=-3;k<=3&&n<traps;k++)for(const[x,y]of[[cx+k,cy-3],[cx+k,cy+3],[cx-3,cy+k],[cx+3,cy+k]]){if(n>=traps)break;if(x===cx&&y===cy+3)continue;if(!Z.obj[y*W+x]){Z.obj[y*W+x]={k:'spikes',r:0,v:0,hp:60,uses:0};n++}}}
  for(let g=0;g<guards;g++){const sv=World.addSurvivor(S,{id:++S.survN,n:'Guard'+g,trait:'tough'});if(sv)sv.job='guard'}
  Z.navDirty=true;
  S.tide.n=n-1;S.p.lvl=1+n*3;give(S,weapon,1);equip(S,S.p.inv.findIndex(s=>s&&s.id===weapon),'w1');for(const a of armor){give(S,a,1);const i=S.p.inv.findIndex(s=>s&&s.id===a);if(i>=0)equip(S,i)}
  G.ds=derive(S);S.p.hp=G.ds.maxHp;Z.pl.x=cx+.5;Z.pl.y=outside?cy-3.5:cy+.5+1;G.auto=true;S.tide.at=S.t+.5;
  const inYard=p=>p.x>cx-2&&p.x<cx+3&&p.y>cy-2&&p.y<cy+3;let t=0,out=0,live=0,far=0;const dt=1/30;
  while(t<420){const p=Z.pl;if(p.dead)break;G.auto=true;S.p.food=80;S.p.water=80;World.tick(dt);G.ev.length=0;t+=dt;
    if(S.tide.live){live+=dt;if(!inYard(p))out+=dt;far=Math.max(far,Math.hypot(p.x-cx-.5,p.y-cy-.5))}if(t>3&&!S.tide.live)break}
  return{alive:!Z.pl.dead?1:0,ended:!S.tide.live?1:0,hp:Math.round(S.p.hp),out:live?out/live:0,far}}
const rs=[];for(let i=0;i<N;i++)rs.push(await trial(5,'machete',['leather_jacket','leather_pants','leather_cap']));
const a=k=>(rs.reduce((s,r)=>s+r[k],0)/N);
console.log(`${outside?'outside':'inside'} start, ${traps} traps, ${guards} guards: lived ${a('alive')*N}/${N} · tide ended ${a('ended')*N}/${N} · hp ${a('hp').toFixed(0)} · share of tide spent outside the yard ${(a('out')*100).toFixed(0)}% · farthest ${a('far').toFixed(1)}`);

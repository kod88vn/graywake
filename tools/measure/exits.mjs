// Same yard as yard.mjs, but logs the moment Auto steps out of it: queue left, post, nearest attackers, walls standing.
// Usage: node tools/measure/exits.mjs <repo root> [runs] [outside=0] [traps=20] [guards=2]
// How the "Auto charges out as the last wave spawns" fault was found (0.10.71): read the first lines it prints.
const root=process.argv[2],N=+(process.argv[3]||32),outside=process.argv[4]!=='0',traps=+(process.argv[5]||0),guards=+(process.argv[6]||0),R='file://'+root+'/js/';
const {G,give,equip,derive,edgeIdx}=await import(R+'sim/core.js');const AC=await import(R+'sim/actors.js');const World=await import(R+'sim/world.js');
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
  const inYard=p=>p.x>cx-2&&p.x<cx+3&&p.y>cy-2&&p.y<cy+3;let t=0,out=0,live=0,far=0,wasIn=true,logs=0;const dt=1/30;
  while(t<420){const p=Z.pl;if(p.dead)break;G.auto=true;S.p.food=80;S.p.water=80;World.tick(dt);G.ev.length=0;t+=dt;
    if(S.tide.live){const nowIn=inYard(p);if(wasIn&&!nowIn&&logs<4){logs++;const fs=Z.actors.filter(a=>a.team===1&&!a.dead&&a.tide).map(a=>({k:a.kind,d:+Math.hypot(a.x-p.x,a.y-p.y).toFixed(1),inside:inYard(a),st:a.st})).sort((a,b)=>a.d-b.d).slice(0,3);console.log('LEFT YARD at t='+Math.round(t)+' queue left '+S.tide.live.q.length+' post '+(p.post?[+p.post.x.toFixed(1),+p.post.y.toFixed(1)]:null)+' me '+[+p.x.toFixed(1),+p.y.toFixed(1)]+' hp '+Math.round(S.p.hp)+' nearest foes '+JSON.stringify(fs)+' walls '+Z.ed.filter(Boolean).length)}wasIn=nowIn;live+=dt;if(!inYard(p))out+=dt;far=Math.max(far,Math.hypot(p.x-cx-.5,p.y-cy-.5))}if(t>3&&!S.tide.live)break}
  return{alive:!Z.pl.dead?1:0,ended:!S.tide.live?1:0,hp:Math.round(S.p.hp),out:live?out/live:0,far}}
const rs=[];for(let i=0;i<N;i++)rs.push(await trial(5,'machete',['leather_jacket','leather_pants','leather_cap']));
const a=k=>(rs.reduce((s,r)=>s+r[k],0)/N);
console.log(`${outside?'outside':'inside'} start, ${traps} traps, ${guards} guards: lived ${a('alive')*N}/${N} · tide ended ${a('ended')*N}/${N} · hp ${a('hp').toFixed(0)} · share of tide spent outside the yard ${(a('out')*100).toFixed(0)}% · farthest ${a('far').toFixed(1)}`);

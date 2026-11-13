// Lead balance bot: is a radio lead's threat rating honest for a given character?
// Takes a save (the one a bug report carries, or an exported one), sends that character to one of its leads and clears it in the game's own
// Auto mode, many times over, and sets what was promised (skulls) beside what happened (lived or died, how many came at once, toxin).
// Auto mode is a plain fighter: it does not sneak, pull one at a time or run. Usage:
//   node tools/leadbot.mjs path/to/save.json [site kind, e.g. lead_pharmacy] [runs]        (no save: a level 10 character with a flint spear)
//   node tools/leadbot.mjs path/to/save.json --ambush [runs]     every fight a road event can start, as it would be pitched to that character
import fs from 'node:fs';
const R=new URL('../js/',import.meta.url).href;
const {G,give,equip,derive,count}=await import(R+'sim/core.js');const World=await import(R+'sim/world.js');const {field,pathAim}=await import(R+'sim/zone.js');const {SITES}=await import(R+'data/world.js');
G.headless=true;
const[file,kind='lead_pharmacy',runs='20']=process.argv.slice(2),raw=file&&file!=='-'?fs.readFileSync(file,'utf8'):null;
function start(){
  let S;if(raw){S=World.deserialize(raw);World.resume(S)}else{S=World.newGame(1000+Math.floor(Math.random()*1e6));S.p.lvl=10;give(S,'spear',1);equip(S,S.p.inv.findIndex(s=>s&&s.id==='spear'),'w1');give(S,'bandage',3)}
  G.ds=derive(S);let st=S.sites.find(s=>s.site===kind);if(!st)st=World.addLead(S,kind);return[S,st]}
if(kind==='--ambush'){
  // every fight an event can start on the road: what the player would be told (skulls) beside what happens when Auto mode stands and fights
  const {EVENTS}=await import(R+'data/events.js');const tabs=new Map();for(const e of EVENTS)for(const o of e.o||[])for(const r of o.r||[])for(const fx of r[2]||[])if(fx[0]==='fight')tabs.set(JSON.stringify(fx[1]),fx[1]);   // (fights that come to the homestead are run here as road fights: the same creatures, pitched the same way)
  const N=+(process.argv[4]||12),by={};
  for(const table of tabs.values()){let win=0,plan=null,hp=0;
    for(let r=0;r<N;r++){const[S]=start();S.p.hp=G.ds.maxHp;G.pending={};World.applyFx([['fight',table]]);plan=World.ambushPlan(S,table,99);const top=World.optionFight(S,{r:[[1,'',[['fight',table]]]]});plan=top;World.eventDone();const Z=G.Z;let t=0;const dt=1/30;
      while(t<150&&!Z.pl.dead&&G.Z===Z){G.auto=true;S.p.food=70;S.p.water=70;World.tick(dt);G.ev.length=0;t+=dt;if(!Z.actors.some(a=>a.team===1&&!a.dead&&a.def.ai!=='flee'))break}
      if(!Z.pl.dead){win++;hp+=S.p.hp}}
    (by[plan.skulls]=by[plan.skulls]||[]).push(win/N);console.log(`${JSON.stringify(table).padEnd(34)} → ${plan.names.padEnd(28)} level ${plan.lvl}  ${plan.skulls} skulls (${plan.word}, odds ${plan.odds.toFixed(2)})  lived ${win}/${N}${win?', health left '+Math.round(hp/win):''}`)}
  for(const k in by)console.log(`${k} skulls: ${by[k].length} fights, lived ${Math.round(by[k].reduce((a,b)=>a+b,0)/by[k].length*100)}%`);
  process.exit(0)}
const out=[];let info=null;
for(let r=0;r<+runs;r++){
  const[S,st]=start();if(!st){console.log('no such lead: '+kind);process.exit(1)}if(process.env.FULL)S.p.hp=G.ds.maxHp;
  info=World.leadInfo(S,st);const hp0=S.p.hp;G.Z=null;World.arrive(st.id);const Z=G.Z;G.auto=true;let t=0,most=0,tox=0,first=null;const dt=1/30;
  let F=null,ft=-9,tg=null;
  while(t<420&&!Z.pl.dead){if(G.Z!==Z)break;S.p.food=Math.max(S.p.food,60);S.p.water=Math.max(S.p.water,60);const p=Z.pl;
    // the driver: while something is coming, Auto mode fights it; otherwise walk at the nearest one left until it notices (no sneaking, no waiting)
    const foes=Z.actors.filter(a=>a.team===1&&!a.dead&&a.def.ai!=='flee'),hot=foes.some(a=>a.alert&&Math.hypot(a.x-p.x,a.y-p.y)<16);
    G.auto=hot;G.inp.mx=G.inp.my=0;
    if(!hot&&foes.length){let b=null,bd=1e9;for(const a of foes){const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<bd){bd=d;b=a}}
      if(b!==tg||t-ft>.5){tg=b;ft=t;F=field(Z,Math.floor(b.x),Math.floor(b.y),true,400)}const a=pathAim(Z,F,p.x,p.y,p.r,true);if(a){const l=Math.hypot(a[0]-p.x,a[1]-p.y)||1;G.inp.mx=(a[0]-p.x)/l;G.inp.my=(a[1]-p.y)/l}}
    if(process.env.NOTOX)S.p.tox=0;World.tick(dt);G.ev.length=0;t+=dt;const al=Z.actors.filter(a=>a.team===1&&!a.dead&&a.alert).length;if(al>most)most=al;if(al&&first===null)first=t;tox=Math.max(tox,S.p.tox);
    if(!Z.actors.some(a=>a.team===1&&!a.dead&&a.def.ai!=='flee')&&Z.spawns.every(s=>s.done))break}
  out.push({alive:!Z.pl.dead&&G.Z===Z,hp:Math.round(S.p.hp),hp0:Math.round(hp0),t:Math.round(t),most,tox:Math.round(tox),left:Z.actors.filter(a=>a.team===1&&!a.dead&&a.def.ai!=='flee').length+Z.spawns.filter(s=>!s.done).length})}
const win=out.filter(o=>o.alive&&!o.left),avg=k=>Math.round(out.reduce((a,o)=>a+o[k],0)/out.length);
console.log(`${info.name} · level ${info.lvl} · promised ${info.skulls} of 5 skulls ("${info.word}") · started on ${out[0].hp0} health`);
console.log(`cleared and lived ${win.length}/${out.length}; died ${out.filter(o=>!o.alive).length}; health left when it lived ${win.length?Math.round(win.reduce((a,o)=>a+o.hp,0)/win.length):0}; most coming at once avg ${avg('most')} (max ${Math.max(...out.map(o=>o.most))}); toxin peak avg ${avg('tox')}; seconds avg ${avg('t')}`);

#!/usr/bin/env node
// A crude player. It plays a fresh character at home with only what a player can do (auto-gather, craft with what it holds,
// build with the real costs and level gates, eat, drink, sleep, let auto mode fight) and builds a homestead to a fixed plan.
// It writes the save at the end of chosen days so the base can be looked at, or carried on from, in the real game:
//   node tools/playbot.mjs [days=10] [seed=7] [days to snapshot, e.g. 2,5,9]     → .out/playbot/day-N.json (taken each morning) + log.txt
// Load a snapshot in the game through Menu → Export / import → Load this text. It is not a balance proof: one seed, one plan.
import fs from 'node:fs';
import path from 'node:path';
import {OUT} from './lib.mjs';
import {ITEMS} from '../js/data/items.js';
import {OBJ} from '../js/data/objects.js';
import {G,EREF,edgeIdx,isEdgeKind,give,count,craft,canCraft,place,canPlace,upgrade,canUpgrade,equip,quickUse,derive,slotCount,freeSlots,addTo,homeStores,findTool,buildUnlocked,learnPerk} from '../js/sim/core.js';
import {RECIPES} from '../js/data/recipes.js';
import {PERKS} from '../js/data/progress.js';
import {plant,openLoot,lootAll} from '../js/sim/actors.js';
import * as World from '../js/sim/world.js';
import {dayOf,hourOf} from '../js/sim/util.js';

const DAYS=+process.argv[2]||10,SEED=+process.argv[3]||7,SNAP=new Set((process.argv[4]||'2,3,4,5,7,9,11,13,16,20').split(',').map(Number)),snapped=new Set();
G.headless=true;const S=World.newGame(SEED);let Z=G.Z;const cx=Math.floor(Z.w/2),cy=Math.floor(Z.h/2),I=(x,y)=>y*Z.w+x,log=[];
const say=m=>{const l=`day ${dayOf(S.t)} ${String(Math.floor(hourOf(S.t))).padStart(2,'0')}:00  ${m}`;log.push(l);console.log(l)};
const stats={deaths:0,tides:0};
// ---- the clock: every tick, deal with what would be a pop-up for a person
function run(sec){for(let t=0;t<sec;t+=1/30){World.tick(1/30);for(const e of G.ev){if(e[0]!=='ui')continue;
    if(e[1]==='death'){stats.deaths++;say('died; wakes at home');World.respawn();Z=G.Z;G.auto=false}
    else if(e[1]==='event'){const ev=World.getEvent(e[2]);if(ev){const oi=ev.o.findIndex(o=>!World.optionBlocked(S,o));if(oi>=0){World.chooseOption(e[2],oi);World.eventDone()}G.pending=null}}
    else if(e[1]==='tide'||e[1]==='tideStart'){say('tide begins: health '+Math.round(S.p.hp)+', food '+Math.round(S.p.food)+', water '+Math.round(S.p.water))}
    else if(e[1]==='tideEnd'){stats.tides++;say('tide '+S.tide.n+' is over: '+(e[2]&&e[2].won?'held':'overrun')+', '+(e[2]?e[2].lost:0)+' structures lost')}}
  G.ev.length=0;Z=G.Z}}
// ---- needs
function needs(){const p=S.p;if(p.food<50)quickUse(S,'food');if(p.water<50){if(!quickUse(S,'water'))boil()}if(p.hp<G.ds.maxHp*.5)quickUse(S,'hp');G.ev.length=0}
const find=k=>{for(let i=0;i<Z.obj.length;i++)if(Z.obj[i]&&Z.obj[i].k===k)return i;return-1},findWhere=f=>{for(let i=0;i<Z.obj.length;i++)if(Z.obj[i]&&f(OBJ[Z.obj[i].k],Z.obj[i]))return i;return-1};
function boil(){const at=findWhere(d=>d.station==='campfire');if(at<0)return;const n=Math.min(4,count(S,'dirty_water',true));if(n>0&&!(Z.obj[at].q&&Z.obj[at].q.length))craft(S,'water',n,at)}
function cook(){const at=findWhere(d=>d.station==='campfire');if(at<0||(Z.obj[at].q&&Z.obj[at].q.length))return;for(const[r,raw]of[['cooked_meat','raw_meat'],['cooked_fish','raw_fish'],['baked_potato','potato']])if(RECIPES[r]&&count(S,raw,true)>0&&!canCraft(S,RECIPES[r],1,at)){craft(S,r,Math.min(4,count(S,raw,true)),at);return}}
// ---- making things by hand, in order of use
const has=(id,n=1)=>count(S,id,true)>=n,make=(rid,n=1,at)=>RECIPES[rid]&&!canCraft(S,RECIPES[rid],n,at)&&craft(S,rid,n,at);
function wear(id){const i=S.p.inv.findIndex(s=>s&&s.id===id);if(i>=0){equip(S,i);G.ds=derive(S);return true}return false}
function kit(){
  if(!findTool(S,'axe',1)&&make('hatchet_stone'))say('made a stone hatchet');
  if(!findTool(S,'pick',1)&&make('pick_stone'))say('made a stone pickaxe');
  const w1=S.p.eq.w1&&ITEMS[S.p.eq.w1.id];
  if(!w1||w1.t==='tool'||(w1.dmg<15&&(has('spear')||make('spear')))){if(!has('spear')&&!make('spear')&&!has('club'))make('club');let wi=S.p.inv.findIndex(s=>s&&s.id==='spear');if(wi<0)wi=S.p.inv.findIndex(s=>s&&s.id==='club');if(wi>=0){equip(S,wi,'w1');S.p.active='w1';say('took up a '+ITEMS[S.p.eq.w1.id].n.toLowerCase())}}
  // rags are scarce at home: the bedroll and the first rain catcher come before clothes
  if(find('bed_roll')>=0&&find('collector')>=0)for(const[slot,id]of[['body','rag_shirt'],['legs','rag_pants'],['feet','rag_wraps'],['hands','hand_wraps'],['head','bandana']])if(!S.p.eq[slot]&&(count(S,id)>0||make(id))&&wear(id))say('put on '+ITEMS[id].n.toLowerCase());
  for(const[slot,ids]of[['head',['hide_hood']],['body',['hide_vest']],['legs',['hide_pants']],['feet',['hide_boots']]])for(const id of ids){const cur=S.p.eq[slot]&&ITEMS[S.p.eq[slot].id];if((!cur||(cur.arm||0)<ITEMS[id].arm)&&make(id,1,findWhere(d=>d.station==='workbench'))&&wear(id))say('made and put on '+ITEMS[id].n.toLowerCase())}
  while(S.p.sp>0){const id=Object.keys(PERKS).find(k=>learnPerk(S,k));if(!id)break}
  G.ev.length=0;
}
// ---- storage: keep tools, a weapon, food and water on you; put the rest away when the pack is nearly full
function stow(){const boxes=homeStores(S);if(!boxes.length||freeSlots(S)>5)return;let moved=0;
  S.p.inv.forEach((s,i)=>{if(!s)return;const it=ITEMS[s.id];if(it.tool||['melee','gun','food','med','seed','head','body','legs','feet','hands'].includes(it.t)&&!(it.t==='food'&&s.n>8))return;
    for(const b of boxes){const d=OBJ[b.k],left=addTo(b.inv,d.store,s.id,s.n,s.d);if(left<s.n){moved+=s.n-left;if(left>0)s.n=left;else{S.p.inv[i]=null;break}}}});
  if(moved)say('stowed '+moved+' things in storage')}
// ---- the plan: [object, dx, dy, rotation] from the middle of the clearing, in the order it is wanted
const PLAN=[['box_small',-3,2],['bed_roll',-3,-2],['campfire',1,-1],['collector',-8,-3],['workbench',-1,-3],['box_small',-2,2]];
const X0=-5,X1=5,Y0=-4,Y1=4,ring=[];for(let x=X0;x<=X1;x++){ring.push([x,Y0],[x,Y1])}for(let y=Y0+1;y<Y1;y++){ring.push([X0,y],[X1,y])}
ring.sort((a,b)=>(a[1]===Y1?0:1)-(b[1]===Y1?0:1));   // the south wall, where the first trail comes in, goes up first
// walls stand on the outward edge of the yard's outermost cells: [kind, dx, dy, side] with side 0 north, 1 east, 2 south, 3 west
for(const[x,y]of ring){const sides=[];if(y===Y1)sides.push(2);if(y===Y0)sides.push(0);if(x===X0)sides.push(3);if(x===X1)sides.push(1);for(const sd of sides)PLAN.push([x===0&&(sd===0||sd===2)?'door_stick':'wall_stick',x,y,sd])}
PLAN.push(['sawbench',1,-3],['garden',-8,-1],['garden',-8,0],['garden',-8,1],['garden',-7,-1],['garden',-7,0],['garden',-7,1],['tannery',2,-3],['spikes',-1,6],['spikes',0,6],['spikes',1,6],['spikes',-1,7],['spikes',1,7],['collector',-7,-3],['box_small',-1,2],['compost_bin',-9,-3],['scarecrow',-9,0],['spikes',-2,6],['spikes',2,6],['garden',-8,2],['garden',-7,2]);
for(let x=X0+1;x<X1;x++)for(let y=Y0+1;y<Y1;y++)PLAN.push(['floor_wood',x,y]);
const placed=new Set();
function ropeFor(k){const need=(OBJ[k].cost.rope||0)-count(S,'rope',true);for(let i=0;i<need;i++)if(!make('rope'))break}
let blocked={},tideSaid=false,stallSaid=false;
function build(){let n=0;blocked={};
  for(let pi=0;pi<PLAN.length;pi++){if(placed.has(pi))continue;const[k,dx,dy,r]=PLAN[pi],x=cx+dx,y=cy+dy,i=I(x,y),d=OBJ[k];
    if(isEdgeKind(k)){if(Z.ed[edgeIdx(Z.w,x,y,r)]){placed.add(pi);continue}}
    else if(d.floor?Z.fl[i]:Z.obj[i]&&OBJ[Z.obj[i].k].cost){placed.add(pi);continue}
    if(!buildUnlocked(S,k))continue;ropeFor(k);const why=canPlace(S,k,x,y,r||0);
    if(why===null&&place(S,k,x,y,r||0)){placed.add(pi);n++;if(!d.wall&&!d.floor)say('built '+d.n.toLowerCase())}
    else if(why&&!blocked[k])blocked[k]=why;
  }
  if(n)say('placed '+n+' piece'+(n===1?'':'s')+' ('+[...placed].filter(pi=>OBJ[PLAN[pi][0]].wall||OBJ[PLAN[pi][0]].door).length+'/'+PLAN.filter(q=>isEdgeKind(q[0])).length+' of the wall)');
  // planks for floors and upgrades: keep the sawhorse working
  const saw=findWhere(d=>d.station==='sawbench');if(saw>=0&&!(Z.obj[saw].q&&Z.obj[saw].q.length)&&count(S,'log',true)>=14&&count(S,'plank',true)<24)make('plank',4,saw);
  const wb=findWhere(d=>d.station==='workbench');if(wb>=0&&count(S,'scrap',true)>0&&count(S,'nails',true)<16)make('nails',Math.min(3,count(S,'scrap',true)),wb);
  // better walls once the level and the materials are there
  if(buildUnlocked(S,'wall_plank'))for(let e=0;e<Z.ed.length;e++){const w=Z.ed[e];if(w&&(w.k==='wall_stick'||w.k==='door_stick')&&canUpgrade(S,EREF+e,false)===null)upgrade(S,EREF+e,false)}
  G.ev.length=0;
}
function farm(){for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(!o||OBJ[o.k].special!=='garden')continue;
    if(o.seed&&S.t>=o.ripe)World.Community.harvestAll(S);
    if(!o.seed){const s=S.p.inv.find(x=>x&&ITEMS[x.id].t==='seed');if(s)plant(Z,i,s.id)}}
  for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(o&&OBJ[o.k].prod&&Math.floor(o.stock||0)>0&&freeSlots(S)>1){const d=OBJ[o.k].prod,n=Math.floor(o.stock),left=addTo(S.p.inv,slotCount(S),d.item,n);o.stock-=n-left}}
  G.ev.length=0}
function snapshot(){const day=dayOf(S.t);if(!SNAP.has(day)||snapped.has(day))return;snapped.add(day);const dir=path.join(OUT,'playbot');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,`day-${day}.json`),World.serialize());
  const built={};for(const o of[...Z.obj,...Z.ed])if(o&&OBJ[o.k].cost)built[OBJ[o.k].n]=(built[OBJ[o.k].n]||0)+1;const floors=Z.fl.filter(Boolean).length;
  say(`SNAPSHOT day ${day}: level ${S.p.lvl}, ${Object.entries(built).map(([k,n])=>n+' '+k).join(', ')}${floors?', '+floors+' floor tiles':''}; deaths ${stats.deaths}, tides faced ${S.tide.n}`)}

// ---- play
say('wakes in the clearing with nothing on');let lastDay=dayOf(S.t);
// search the wreck and the crate beside the clearing, as the first journal page tells a new player to
for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(o&&o.starter){openLoot(Z,i);lootAll(Z,i)}}say('searched the wreck and the crate: '+S.p.inv.filter(Boolean).map(x=>x.n+' '+ITEMS[x.id].n.toLowerCase()).join(', '));G.ev.length=0;
while(dayOf(S.t)<=DAYS){
  needs();kit();stow();build();farm();cook();
  const h=hourOf(S.t),bed=findWhere(d=>d.bed);
  if((h>=21||h<5)&&bed>=0&&!S.tide.live&&World.canSleep(S)===null){World.sleep(bed);G.ev.length=0;Z=G.Z;say('slept; morning of day '+dayOf(S.t));snapshot();continue}
  // a full pack with no box yet: throw away the least useful stack (forage beyond what will be eaten), as a player would, so wood and stone can still be carried
  if(freeSlots(S)<=1&&!homeStores(S).length){const KEEP=new Set(['log','stick','stone','fiber','rope','rags','flint','scrap','water','dirty_water','bandage']);let worst=-1,wv=1e9;S.p.inv.forEach((s,i)=>{if(!s||KEEP.has(s.id))return;const it=ITEMS[s.id];if(it.tool||['melee','gun','head','body','legs','feet','hands'].includes(it.t))return;const v=(it.t==='food'?3:1)*it.v*s.n;if(v<wv){wv=v;worst=i}});if(worst>=0){say('pack full, no box yet: threw away '+S.p.inv[worst].n+' '+ITEMS[S.p.inv[worst].id].n.toLowerCase());S.p.inv[worst]=null}}
  if(S.tide.live&&!tideSaid){tideSaid=true;say('tide '+(S.tide.n+1)+' lands: health '+Math.round(S.p.hp)+', food '+Math.round(S.p.food)+', water '+Math.round(S.p.water)+', armour '+G.ds.arm)}if(!S.tide.live)tideSaid=false;
  if(S.tide.live&&S.tide.live.t>200&&!stallSaid){stallSaid=true;const p=Z.pl;say('STALL: player '+(p.x-cx).toFixed(0)+','+(p.y-cy).toFixed(0)+' auto '+G.auto+' fight '+!!p.fight+' q '+S.tide.live.q.length+' | '+Z.actors.filter(a=>a.team===1&&!a.dead&&a.tide).map(a=>a.kind+'@'+(a.x-cx).toFixed(0)+','+(a.y-cy).toFixed(0)+' '+a.st+(a.alert?'!':'')+' hp'+Math.round(a.hp)).join(' '))}if(!S.tide.live)stallSaid=false;
  G.auto=true;run(25);
  if(dayOf(S.t)!==lastDay){lastDay=dayOf(S.t);const b=Object.entries(blocked).slice(0,4).map(([k,w])=>OBJ[k].n+': '+w).join('; ');if(b)say('waiting on: '+b)}
}
snapshot();fs.mkdirSync(path.join(OUT,'playbot'),{recursive:true});fs.writeFileSync(path.join(OUT,'playbot','log.txt'),log.join('\n'));fs.writeFileSync(path.join(OUT,'playbot','final.json'),World.serialize());
console.log(`\nfinished on day ${dayOf(S.t)}: level ${S.p.lvl}, ${stats.deaths} deaths, ${S.tide.n} tides`);

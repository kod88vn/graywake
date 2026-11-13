// Core state: the shared game context G, the save shape, inventory, derived stats, crafting and building.
// Pure logic: no DOM, no three.js. Everything the outside world needs to know is pushed onto G.ev by emit().
import {ITEMS,SETS} from '../data/items.js';
import {OBJ} from '../data/objects.js';
import {RECIPES,VEHICLES} from '../data/recipes.js';
import {PERK,xpFor,MAX_LEVEL} from '../data/progress.js';
import {clamp,rnd} from './util.js';

export const VERSION='0.5.2';
export const SAVE_V=1;
export const HOME_W=46,HOME_H=46,EXIT_RING=2,NO_BUILD=4;
export const MIN_PER_SEC=1.5;            // game minutes per real second: a day is 16 real minutes
export const FIST={id:'fist',n:'Fists',t:'melee',dmg:5,spd:.48,rng:1.05,arc:80,kb:1};

/** The live game context. S = save state, Z = current zone (null on the map), ev = outgoing events, inp = player intent. */
export const G={S:null,Z:null,ev:[],inp:{mx:0,my:0,aim:null,attack:false,interact:false,dodge:false,sneak:false},ds:null,auto:false,headless:false,mode:'menu',pending:null,now:0};
export function emit(...a){if(G.ev.length<600)G.ev.push(a)}
export const toast=(msg,kind='info')=>emit('toast',msg,kind);
export const sfx=(name,x,y,o)=>emit('sfx',name,x,y,o);
export const stat=(k,n=1)=>{const s=G.S.stats;s[k]=(s[k]||0)+n;return s[k]};
export const statMax=(k,v)=>{const s=G.S.stats;if(!(s[k]>=v))s[k]=v};

export function blankState(seed){
  return{v:SAVE_V,seed:seed>>>0,t:7*60,created:Date.now(),
    p:{hp:100,food:80,water:80,tox:0,lvl:1,xp:0,sp:0,perks:{},inv:[],eq:{w1:null,w2:null,head:null,body:null,legs:null,feet:null,pack:null},active:'w1',known:{},buffs:[],bed:null},
    home:{obj:[],fl:[],regrow:[],pile:{},report:null},
    loc:{},sites:[],siteN:0,at:'home',from:'home',
    tide:{n:0,at:0,kind:'shamble',dir:0,weak:0,warned:0,live:null},
    weather:{id:'clear',until:0},
    surv:[],survN:0,morale:60,wait:[],fac:{},clog:[],
    q:{i:0,base:{},contracts:[],refresh:0,done:[]},
    flags:{},seen:{},ach:{},stats:{},codex:{it:{},en:{}},scrip:0,veh:0,mut:0,depth:0,trader:null,nextEv:0,
    set:{music:true,sfx:true,vol:.8,quality:'auto',shake:true,autoPick:true,autoRepair:true,replant:true,hints:true,tides:'standard'},
  };
}

// ---------------------------------------------------------------- derived stats
export const weaponItem=S=>S.p.eq[S.p.active];
export const weaponDef=S=>{const e=S.p.eq[S.p.active];return e?ITEMS[e.id]:FIST};
const buffSum=(p,k)=>{let v=0;for(const b of p.buffs)if(b.k===k)v+=b.v;return v};
export function hasItem(S,id){for(const s of S.p.inv)if(s&&s.id===id)return true;return false}
/** Everything computed from perks, gear and buffs. Recomputed every simulation step; cheap. */
export function derive(S){
  const p=S.p,pk={};
  for(const id in p.perks){const P=PERK[id];if(P)for(const k in P.fx)pk[k]=(pk[k]||0)+P.fx[k]*p.perks[id]}
  let arm=0,cold=pk.cold||0,tox=pk.tox||0,spd=0;const sets={};
  for(const s of['head','body','legs','feet']){const e=p.eq[s];if(!e)continue;const it=ITEMS[e.id];arm+=it.arm||0;cold+=it.cold||0;tox+=it.tox||0;spd+=it.spd||0;if(it.set)sets[it.set]=(sets[it.set]||0)+1}
  let set=null;for(const k in sets)if(sets[k]===4)set=k;
  const sf=set?SETS[set].fx:{};
  const w=weaponDef(S),veh=VEHICLES[S.veh||0],pack=p.eq.pack?ITEMS[p.eq.pack.id].slots:0;
  const weak=buffSum(p,'weak');
  return{pk,arm,armRed:Math.min(.8,arm/(arm+40)),set,
    cold:Math.min(1,cold+(sf.cold||0)),tox:Math.min(.95,tox+(sf.tox||0)),
    spd:4.2*(1+spd+(sf.spd||0)+(w.spdMove||0)+buffSum(p,'speed')-weak*.5),
    maxHp:100+(pk.hp||0)+buffSum(p,'vigor'),
    slots:18+pack+(pk.slots||0)+veh.slots,
    melee:(1+(pk.melee||0)+(sf.melee||0))*(1-weak),ranged:(1+(pk.ranged||0)+(sf.ranged||0))*(1-weak),
    haste:1+(pk.haste||0)+buffSum(p,'haste'),
    taken:(1-(pk.resist||0))*(1-(sf.resist||0))*(1-Math.min(.6,buffSum(p,'resist'))),
    regen:(pk.regen||0),regenBuff:buffSum(p,'regen'),steady:!!sf.steady,butcher:(pk.butcher||0)+(sf.butcher||0),
    light:hasItem(S,'lantern'),radar:hasItem(S,'binoculars'),
  };
}
export const perk=k=>(G.ds&&G.ds.pk[k])||0;
export function addBuff(S,k,v,t){const b=S.p.buffs.find(b=>b.k===k&&b.v===v);if(b)b.t=Math.max(b.t,t);else S.p.buffs.push({k,v,t})}

// ---------------------------------------------------------------- inventory
export const slotCount=S=>(G.ds||derive(S)).slots;
const fit=inv=>n=>{while(inv.length<n)inv.push(null);return inv};
export function homeStores(S){const out=[];const o=S.home.obj;for(let i=0;i<o.length;i++){const b=o[i];if(b&&OBJ[b.k]&&OBJ[b.k].store){if(!b.inv)b.inv=[];out.push(b)}}return out}
/** How many of an item the player holds (and, with `home`, everything in home storage too). */
export function count(S,id,home=false){let n=0;for(const s of S.p.inv)if(s&&s.id===id)n+=s.n;if(home)for(const b of homeStores(S))for(const s of b.inv)if(s&&s.id===id)n+=s.n;return n}
/** Put items into a slot array of `cap` slots. Returns how many did not fit. */
export function addTo(inv,cap,id,n,d){
  const it=ITEMS[id];if(!it)return 0;fit(inv)(cap);
  if(it.st>1)for(let i=0;i<cap&&n>0;i++){const s=inv[i];if(s&&s.id===id&&s.n<it.st){const k=Math.min(n,it.st-s.n);s.n+=k;n-=k}}
  for(let i=0;i<cap&&n>0;i++)if(!inv[i]){const k=Math.min(n,it.st);inv[i]={id,n:k};if(it.dur)inv[i].d=d===undefined?it.dur:d;n-=k}
  return n;
}
export function removeFrom(inv,id,n){for(let i=inv.length-1;i>=0&&n>0;i--){const s=inv[i];if(s&&s.id===id){const k=Math.min(n,s.n);s.n-=k;n-=k;if(s.n<=0)inv[i]=null}}return n}
/** Would n of an item fit in the pack right now? */
export function roomFor(S,id,n){const it=ITEMS[id],cap=slotCount(S);let room=0;for(let i=0;i<cap;i++){const s=S.p.inv[i];if(!s)room+=it.st;else if(s.id===id&&it.st>1)room+=it.st-s.n;if(room>=n)return true}return room>=n}
export const freeSlots=S=>{const cap=slotCount(S);let n=0;for(let i=0;i<cap;i++)if(!S.p.inv[i])n++;return n};
/** Give the player items. Whatever does not fit is dropped at their feet (or lost on the map). Returns the number that fit. */
export function give(S,id,n=1,d,quiet){
  if(!ITEMS[id]||n<=0)return 0;
  const left=addTo(S.p.inv,slotCount(S),id,n,d),got=n-left;
  S.codex.it[id]=1;
  if(got>0&&!quiet)emit('loot',id,got);
  // first weapon or tool goes straight into an empty hand
  if(got>0&&!S.p.eq.w1&&['melee','gun','tool'].includes(ITEMS[id].t)){const i=S.p.inv.findIndex(s=>s&&s.id===id);if(i>=0){S.p.eq.w1={id,d:S.p.inv[i].d};S.p.inv[i]=null;S.p.active='w1';G.ds=derive(S);emit('eq')}}
  if(left>0){if(G.Z&&G.Z.pl){dropAt(G.Z,G.Z.pl.x,G.Z.pl.y,[{id,n:left,d}]);if(!quiet)toast('Pack full: '+ITEMS[id].n+' dropped','bad')}else if(!quiet)toast('Pack full: '+ITEMS[id].n+' left behind','bad')}
  return got;
}
/** Take items from the pack, then (with `home`) from home storage. Returns true when all were found. */
export function take(S,id,n,home=false){
  if(count(S,id,home)<n)return false;
  n=removeFrom(S.p.inv,id,n);
  if(n>0&&home)for(const b of homeStores(S)){n=removeFrom(b.inv,id,n);if(n<=0)break}
  return true;
}
export function dropAt(Z,x,y,items){
  let d=Z.drops.find(d=>Math.abs(d.x-x)<.6&&Math.abs(d.y-y)<.6);
  if(!d){d={id:++Z.uid,x:x+(rnd()-.5)*.4,y:y+(rnd()-.5)*.4,items:[],t:0};Z.drops.push(d)}
  for(const it of items){const same=!ITEMS[it.id].dur&&d.items.find(s=>s.id===it.id);if(same)same.n+=it.n;else d.items.push({...it})}
  d.t=0;return d;
}
/** Wear down the item in an equipment slot. Returns true if it broke. */
/** With the auto-repair setting on, a tool or weapon that is nearly worn out gets repaired on the spot (see autoRepair in world.js). True if it was. */
function nearlyWorn(S,ref){const it=ITEMS[ref.id];return!!(S.set.autoRepair&&it&&it.dur&&ref.d<=Math.max(2,it.dur*.12)&&G.hooks.repair&&G.hooks.repair(S,ref)&&ref.d>0)}
export function wear(S,slot,n=1){
  const e=S.p.eq[slot];if(!e||e.d===undefined)return false;
  if(rnd()<perk('dur'))return false;
  e.d-=n;if((slot==='w1'||slot==='w2')&&nearlyWorn(S,e))return false;if(e.d>0)return false;
  toast(ITEMS[e.id].n+' broke','bad');sfx('break');S.p.eq[slot]=null;emit('eq');return true;
}
/** Best tool of a type in the pack or hands: {slot|inv index, item def, ref}. */
export function findTool(S,type,minTier=0){
  let best=null;const see=(ref,where)=>{if(!ref)return;const it=ITEMS[ref.id];if(it&&it.tool===type&&(it.tier||1)>=minTier&&(!best||it.tier>best.it.tier))best={it,ref,where}};
  see(S.p.eq.w1,'w1');see(S.p.eq.w2,'w2');S.p.inv.forEach((s,i)=>see(s,i));return best;
}
export function wearTool(S,tool,n=1){
  if(rnd()<perk('dur'))return;const ref=tool.ref;ref.d-=n;if(nearlyWorn(S,ref))return;if(ref.d>0)return;
  toast(tool.it.n+' broke','bad');sfx('break');
  if(typeof tool.where==='string'){S.p.eq[tool.where]=null;emit('eq')}else S.p.inv[tool.where]=null;
}
/** Equip from pack slot i. Weapons go to the active hand unless `slot` says otherwise. */
export function equip(S,i,slot){
  const s=S.p.inv[i];if(!s)return false;const it=ITEMS[s.id];
  let dst=slot;
  if(!dst){if(['head','body','legs','feet','pack'].includes(it.t))dst=it.t;else if(['melee','gun','tool','throw'].includes(it.t))dst=!S.p.eq.w1?'w1':!S.p.eq.w2?'w2':S.p.active;else return false}
  const old=S.p.eq[dst];
  if(dst==='pack'&&old){const lose=ITEMS[old.id].slots-(it.slots||0);if(lose>0){const cap=slotCount(S)-lose;for(let k=cap;k<S.p.inv.length;k++)if(S.p.inv[k]&&k!==i){toast('Empty the last '+lose+' slots first','bad');return false}}}
  S.p.eq[dst]=it.t==='throw'?{id:s.id,n:s.n}:{id:s.id,d:s.d};
  S.p.inv[i]=old?(old.n?{id:old.id,n:old.n}:{id:old.id,n:1,d:old.d}):null;
  G.ds=derive(S);compact(S);emit('eq');sfx('equip');return true;
}
export function unequip(S,slot){
  const e=S.p.eq[slot];if(!e)return false;
  if(slot==='pack'){const lose=ITEMS[e.id].slots,cap=slotCount(S)-lose;let used=0;for(const s of S.p.inv)if(s)used++;if(used+1>cap){toast('Not enough room without the pack','bad');return false}
    S.p.eq.pack=null;G.ds=derive(S);const items=S.p.inv.filter(Boolean);S.p.inv=items;addTo(S.p.inv,cap,e.id,1,e.d);emit('eq');return true}
  if(freeSlots(S)<1){toast('Pack full','bad');return false}
  S.p.eq[slot]=null;addTo(S.p.inv,slotCount(S),e.id,e.n||1,e.d);G.ds=derive(S);emit('eq');sfx('equip');return true;
}
/** Pull overflow items (beyond capacity) back into free slots, drop what cannot fit. */
export function compact(S){
  const cap=slotCount(S),inv=S.p.inv;
  for(let k=cap;k<inv.length;k++){const s=inv[k];if(!s)continue;inv[k]=null;const left=addTo(inv,cap,s.id,s.n,s.d);if(left>0&&G.Z&&G.Z.pl)dropAt(G.Z,G.Z.pl.x,G.Z.pl.y,[{id:s.id,n:left,d:s.d}])}
  inv.length=Math.max(cap,0);fit(inv)(cap);
}
export function sortInv(inv,cap){
  const order={tool:0,melee:1,gun:2,throw:3,ammo:4,head:5,body:6,legs:7,feet:8,pack:9,med:10,food:11,seed:12,mat:13,misc:14,key:15,bp:16};
  const items=inv.filter(Boolean),merged=[];
  for(const s of items){const it=ITEMS[s.id];if(it.st>1){let n=s.n;for(const m of merged)if(m.id===s.id&&m.n<it.st){const k=Math.min(n,it.st-m.n);m.n+=k;n-=k}if(n>0)merged.push({id:s.id,n})}else merged.push(s)}
  merged.sort((a,b)=>(order[ITEMS[a.id].t]-order[ITEMS[b.id].t])||(ITEMS[b.id].v-ITEMS[a.id].v)||(a.id<b.id?-1:1));
  inv.length=0;for(const m of merged)inv.push(m);fit(inv)(cap);
}

// ---------------------------------------------------------------- experience
export function addXp(S,n){
  if(n<=0)return;const p=S.p;p.xp+=Math.round(n*(1+perk('xp')));
  while(p.lvl<MAX_LEVEL&&p.xp>=xpFor(p.lvl)){p.xp-=xpFor(p.lvl);p.lvl++;p.sp++;G.ds=derive(S);p.hp=G.ds.maxHp;statMax('level',p.lvl);emit('ui','levelup',p.lvl);sfx('levelup')}
}
export function learnPerk(S,id){const P=PERK[id],p=S.p;if(!P||p.sp<1||(p.perks[id]||0)>=P.max)return false;p.perks[id]=(p.perks[id]||0)+1;p.sp--;G.ds=derive(S);compact(S);sfx('ui_tap');return true}

// ---------------------------------------------------------------- crafting
export const knows=(S,r)=>!!S.p.known[r.id]||!!S.p.known[r.o];
export const recipeVisible=(S,r)=>r.bp?knows(S,r):(S.p.lvl>=r.lv||knows(S,r));
/** Is there a station of this type and tier at home / in reach? `at` is the tile index of the station being used. */
export function stationOk(r,at){
  if(r.s==='hand')return true;const Z=G.Z;if(!Z||at==null)return false;const o=Z.obj[at];if(!o)return false;const d=OBJ[o.k];
  return d.station===r.s&&d.sl>=r.sl;
}
export function recipeCost(r){return r.i}
export function canCraft(S,r,n=1,at){
  if(!recipeVisible(S,r))return'Locked';if(!stationOk(r,at))return'Wrong station';
  const home=!!(G.Z&&G.Z.home);for(const k in r.i)if(count(S,k,home)<r.i[k]*n)return'Missing '+ITEMS[k].n;
  if(r.fx&&r.fx.veh&&S.veh>=r.fx.veh)return'Already built';
  if(!r.fx&&!(r.t>0&&at!=null)&&!roomFor(S,r.o,r.q*n)){let frees=false;for(const k in r.i){let c=0;for(const s of S.p.inv)if(s&&s.id===k)c+=s.n;if(c>0&&c<=r.i[k]*n)frees=true}if(!frees)return'Pack full: make room first'}
  return null;
}
export function craft(S,rid,n=1,at){
  const r=RECIPES[rid];if(!r)return false;const why=canCraft(S,r,n,at);if(why){toast(why,'bad');sfx('error');return false}
  const home=!!(G.Z&&G.Z.home),thrift=perk('thrift');
  for(const k in r.i){let need=r.i[k]*n;if(thrift>0&&!r.fx){let saved=0;for(let j=0;j<need;j++)if(rnd()<thrift)saved++;need-=saved}if(need>0)take(S,k,need,home)}
  if(r.t>0&&at!=null){const o=G.Z.obj[at];(o.q=o.q||[]).push({id:rid,n,left:r.t});sfx('craft');emit('obj',at);return true}
  for(let j=0;j<n;j++)produce(S,r,null);
  sfx('craft');if(!r.fx)toast('Made '+(r.q*n>1?r.q*n+' × ':'')+ITEMS[r.o].n,'good');return true;
}
/** Finish one unit of a recipe: into the station's output tray when `o` is given, otherwise straight to the player. */
export function produce(S,r,o){
  if(r.fx){if(r.fx.veh){S.veh=Math.max(S.veh,r.fx.veh);G.ds=derive(S);compact(S);toast(VEHICLES[S.veh].n+' built','good');emit('veh');stat('crafted')}return}
  const it=ITEMS[r.o];let q=r.q;
  if(['campfire','medic','chem'].includes(r.s)&&rnd()<perk('double'))q*=2;
  if(it.t==='ammo')q=Math.round(q*(1+perk('ammo')));
  if(o){ // a station job: hand it to you if you are at home with room, otherwise it waits in the station's tray
    let left=q;if(G.Z&&G.Z.home&&G.Z.pl&&!G.Z.pl.dead){left=addTo(S.p.inv,slotCount(S),r.o,q);if(q-left>0)emit('loot',r.o,q-left)}
    if(left>0){o.out=o.out||{};o.out[r.o]=(o.out[r.o]||0)+left}}
  else give(S,r.o,q);
  stat('crafted',q);stat('c_'+r.o,q);S.codex.it[r.o]=1;
  if(!S.flags['made_'+r.id]){S.flags['made_'+r.id]=1;addXp(S,8+r.lv*3)}else addXp(S,1+Math.floor(r.lv/4));
}
export function collectStation(S,at){
  const o=G.Z&&G.Z.obj[at];if(!o||!o.out)return 0;let got=0;
  for(const k in o.out){const n=o.out[k],cap=slotCount(S),left=addTo(S.p.inv,cap,k,n);if(n-left>0){emit('loot',k,n-left);got+=n-left}if(left>0)o.out[k]=left;else delete o.out[k]}
  if(!Object.keys(o.out).length)delete o.out;if(got)sfx('pickup');emit('obj',at);return got;
}
export function cancelJob(S,at,qi){
  const o=G.Z&&G.Z.obj[at];if(!o||!o.q||!o.q[qi])return;const job=o.q[qi],r=RECIPES[job.id];
  for(const k in r.i)give(S,k,r.i[k]*job.n,undefined,true);o.q.splice(qi,1);emit('obj',at);
}
export function learn(S,i){
  const s=S.p.inv[i];if(!s)return false;const it=ITEMS[s.id];if(it.t!=='bp')return false;
  if(it.learn.every(id=>S.p.known[id])){toast('You already know this','info');return false}
  for(const id of it.learn)S.p.known[id]=1;s.n--;if(s.n<=0)S.p.inv[i]=null;
  stat('schematics');toast('Learned: '+it.n.replace(/^(Schematic|Formula): /,''),'good');sfx('quest');addXp(S,60);return true;
}

// ---------------------------------------------------------------- building (home only)
export const idx=(Z,x,y)=>y*Z.w+x;
export const maxHp=k=>Math.round((OBJ[k].hp||0)*(1+(OBJ[k].cost?perk('wallhp'):0)));
export function buildCost(k){const c=OBJ[k].cost||{},m=1-perk('cheap'),out={};for(const i in c)out[i]=Math.max(1,Math.round(c[i]*m));return out}
export function buildUnlocked(S,k){const d=OBJ[k];if(!d.cost)return false;if(d.bp)return!!S.p.known[d.bp];return S.p.lvl>=d.lv}
const afford=(S,cost)=>{for(const i in cost)if(count(S,i,true)<cost[i])return ITEMS[i].n;return null};
const pay=(S,cost)=>{for(const i in cost)take(S,i,cost[i],true)};
export function inBuildArea(Z,x,y){return x>=NO_BUILD&&y>=NO_BUILD&&x<Z.w-NO_BUILD&&y<Z.h-NO_BUILD}
/** Why a piece cannot go on this tile, or null if it can. */
export function canPlace(S,k,x,y){
  const Z=G.Z,d=OBJ[k];if(!Z||!Z.home)return'Only at home';if(!d||!d.cost)return'Cannot build that';
  if(!buildUnlocked(S,k))return d.bp?'Needs a schematic':'Needs level '+d.lv;
  if(!inBuildArea(Z,x,y))return'Too close to the tree line';
  const i=idx(Z,x,y);if(Z.g[i]===6)return'Water';
  if(d.floor){if(Z.fl[i])return'Already floored'}
  else{if(Z.obj[i])return'Occupied';if(d.solid)for(const a of Z.actors)if(!a.dead&&Math.floor(a.x)===x&&Math.floor(a.y)===y)return'Something is standing there'}
  const miss=afford(S,buildCost(k));if(miss)return'Missing '+miss;
  return null;
}
export function place(S,k,x,y,rot=0){
  const why=canPlace(S,k,x,y);if(why){toast(why,'bad');sfx('error');return false}
  const Z=G.Z,d=OBJ[k],i=idx(Z,x,y);pay(S,buildCost(k));
  if(d.floor){Z.fl[i]=k;emit('floor',i)}else{Z.obj[i]={k,hp:maxHp(k),r:rot};if(d.store)Z.obj[i].inv=[];if(d.turret)Z.obj[i].ammo=0;Z.touch(i)}
  stat('built');if(!S.flags['built_'+k]){S.flags['built_'+k]=1;addXp(S,10+d.lv*4)}else addXp(S,2);
  sfx('build',x+.5,y+.5);emit('fx','dust',x+.5,y+.5);return true;
}
/** Turn a structure you built a quarter turn where it stands. */
export function rotateObj(S,i){const Z=G.Z;if(!Z||!Z.home)return false;const o=Z.obj[i];if(!o||!OBJ[o.k].cost){toast('Nothing of yours to turn here','bad');sfx('error');return false}o.r=((o.r||0)+1)%4;Z.touch(i);sfx('ui_tap');return true}
/** Why the structure on tile i cannot be moved to (x, y), or null. Moving is free and keeps everything about it (health, contents, crops, jobs). */
export function canMove(S,i,x,y){
  const Z=G.Z;if(!Z||!Z.home)return'Only at home';const o=Z.obj[i];if(!o||!OBJ[o.k]||!OBJ[o.k].cost)return'Nothing of yours to move';
  if(x<0||y<0||x>=Z.w||y>=Z.h||!inBuildArea(Z,x,y))return'Too close to the tree line';const j=idx(Z,x,y);if(j===i)return null;
  if(Z.g[j]===6)return'Water';if(Z.obj[j])return'Occupied';
  if(OBJ[o.k].solid)for(const a of Z.actors)if(!a.dead&&Math.floor(a.x)===x&&Math.floor(a.y)===y)return'Something is standing there';
  return null;
}
export function moveObj(S,i,x,y,rot){
  const why=canMove(S,i,x,y);if(why){toast(why,'bad');sfx('error');return false}
  const Z=G.Z,j=idx(Z,x,y),o=Z.obj[i];if(rot!==undefined)o.r=rot;
  if(j!==i){Z.obj[j]=o;Z.obj[i]=null;if(S.p.bed===i)S.p.bed=j;Z.touch(i)}Z.touch(j);
  stat('moved');sfx('build',x+.5,y+.5);emit('fx','dust',x+.5,y+.5);return true;
}
export function canUpgrade(S,i,floor){
  const Z=G.Z;if(!Z||!Z.home)return'Only at home';const k=floor?Z.fl[i]:Z.obj[i]&&Z.obj[i].k;if(!k)return'Nothing here';const d=OBJ[k];if(!d.up)return'Fully upgraded';
  if(!buildUnlocked(S,d.up))return OBJ[d.up].bp?'Needs a schematic':'Needs level '+OBJ[d.up].lv;
  const miss=afford(S,buildCost(d.up));if(miss)return'Missing '+miss;return null;
}
export function upgrade(S,i,floor){
  const why=canUpgrade(S,i,floor);if(why){toast(why,'bad');sfx('error');return false}
  const Z=G.Z;
  if(floor){const up=OBJ[Z.fl[i]].up;pay(S,buildCost(up));Z.fl[i]=up;emit('floor',i)}
  else{const o=Z.obj[i],up=OBJ[o.k].up;pay(S,buildCost(up));o.k=up;o.hp=maxHp(up);Z.touch(i)}
  stat('built');addXp(S,6);sfx('build');emit('fx','dust',i%Z.w+.5,Math.floor(i/Z.w)+.5);return true;
}
export function repairCost(o){const d=OBJ[o.k],mh=maxHp(o.k),f=1-o.hp/mh,out={};if(f<=.01)return null;for(const k in d.cost){const n=Math.ceil(d.cost[k]*f*.5);if(n>0)out[k]=n}return out}
export function repair(S,i){
  const Z=G.Z,o=Z&&Z.obj[i];if(!o||!Z.home)return false;const cost=repairCost(o);if(!cost){toast('No damage','info');return false}
  const miss=afford(S,cost);if(miss){toast('Missing '+miss,'bad');sfx('error');return false}
  pay(S,cost);o.hp=maxHp(o.k);if(OBJ[o.k].trap)o.uses=0;Z.touch(i);sfx('build');return true;
}
export function demolish(S,i,floor){
  const Z=G.Z;if(!Z||!Z.home)return false;
  if(floor){const k=Z.fl[i];if(!k)return false;const c=OBJ[k].cost;for(const m in c)give(S,m,Math.floor(c[m]*.5),undefined,true);Z.fl[i]=null;emit('floor',i);sfx('break');return true}
  const o=Z.obj[i];if(!o)return false;const d=OBJ[o.k];if(!d.cost){toast('Cannot remove that','bad');return false}
  if(o.inv&&o.inv.some(Boolean)){toast('Empty it first','bad');return false}
  if(o.q&&o.q.length||o.out){toast('It is still working','bad');return false}
  for(const m in d.cost)give(S,m,Math.floor(d.cost[m]*.5*(o.hp/maxHp(o.k))),undefined,true);
  if(o.ammo>0&&d.turret&&d.turret.ammo)give(S,d.turret.ammo,Math.floor(o.ammo),undefined,true);
  if(o.fuel>0)give(S,'fuel',Math.floor(o.fuel),undefined,true);
  Z.obj[i]=null;Z.touch(i);sfx('break');return true;
}
/** Count home structures matching a kind id or a predicate. */
export function countBuilt(S,test){
  const f=typeof test==='function'?test:(d=>d.id===test);let n=0;
  for(const o of S.home.obj)if(o&&OBJ[o.k]&&f(OBJ[o.k]))n++;
  for(const k of S.home.fl)if(k&&OBJ[k]&&f(OBJ[k]))n++;
  return n;
}
export const hasBuilt=(S,test)=>countBuilt(S,test)>0;

// ---------------------------------------------------------------- consumables
export function useItem(S,i){
  const s=S.p.inv[i];if(!s)return false;const it=ITEMS[s.id],p=S.p,ds=G.ds||derive(S);
  if(it.t==='bp')return learn(S,i);
  if(it.t==='food'||it.t==='med'){
    if(it.t==='med'&&it.hp&&!it.tox&&!it.buff&&p.hp>=ds.maxHp){toast('Already at full health','info');return false}
    if(it.food)p.food=clamp(p.food+it.food,0,100);if(it.water)p.water=clamp(p.water+it.water,0,100);
    if(it.hp)p.hp=clamp(p.hp+it.hp,1,ds.maxHp);if(it.tox)p.tox=clamp(p.tox+it.tox,0,100);
    if(it.risk&&rnd()<it.risk[0]*(1-perk('gut'))){p.tox=clamp(p.tox+it.risk[1],0,100);toast('That did not sit well','bad')}
    if(it.buff)addBuff(S,it.buff[0],it.buff[1],it.buff[2]);
    s.n--;if(s.n<=0)p.inv[i]=null;
    sfx(it.t==='med'?'heal':it.water>(it.food||0)?'drink':'eat');if(it.hp>0)emit('fx','heal',G.Z&&G.Z.pl?G.Z.pl.x:0,G.Z&&G.Z.pl?G.Z.pl.y:0);G.ds=derive(S);return true;
  }
  if(s.id==='repair_kit'){toast('Open your gear and tap a worn piece to repair it','info');return false}
  if(['melee','gun','tool','throw','head','body','legs','feet','pack'].includes(it.t))return equip(S,i);
  return false;
}
/** Eat/drink/heal with the best thing in the pack for a need: 'food' | 'water' | 'hp' | 'tox'. */
export function quickUse(S,need){
  let best=-1,score=0;const p=S.p,ds=G.ds;
  S.p.inv.forEach((s,i)=>{if(!s)return;const it=ITEMS[s.id];if(it.t!=='food'&&it.t!=='med')return;let v=0;
    if(need==='food')v=(it.food||0)-(it.risk?it.risk[0]*40:0);else if(need==='water')v=(it.water||0)-(it.risk?it.risk[0]*40:0);
    else if(need==='hp'){if(it.t!=='med'&&!(it.hp>=8))return;const miss=ds.maxHp-p.hp;v=it.hp>0?100-Math.abs(miss-it.hp):0}
    else if(need==='tox')v=-(it.tox||0);
    if(v>score){score=v;best=i}});
  if(best<0){toast(need==='hp'?'Nothing to heal with':need==='tox'?'No antidote':'Nothing suitable in your pack','bad');sfx('error');return false}
  return useItem(S,best);
}
export function repairWithKit(S,slot){
  const e=S.p.eq[slot];if(!e||e.d===undefined)return false;const it=ITEMS[e.id];if(e.d>=it.dur){toast('Not worn','info');return false}
  if(!take(S,'repair_kit',1)){toast('No repair kit','bad');return false}e.d=Math.min(it.dur,e.d+Math.max(60,it.dur*.6));sfx('build');return true;
}

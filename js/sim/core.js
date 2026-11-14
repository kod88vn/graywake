// Core state: the shared game context G, the save shape, inventory, derived stats, crafting and building.
// Pure logic: no DOM, no three.js. Everything the outside world needs to know is pushed onto G.ev by emit().
import {ITEMS,SETS} from '../data/items.js';
import {OBJ} from '../data/objects.js';
import {RECIPES,VEHICLES} from '../data/recipes.js';
import {PERK,xpFor,MAX_LEVEL} from '../data/progress.js';
import {clamp,rnd} from './util.js';
import {sourcesOf} from '../data/sources.js';

export const VERSION='0.10.21';
export const SAVE_V=2;
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
    p:{hp:100,food:80,water:80,tox:0,lvl:1,xp:0,sp:0,perks:{},inv:[],eq:{w1:null,w2:null,head:null,body:null,legs:null,feet:null,hands:null,pack:null},active:'w1',known:{},buffs:[],bed:null},
    home:{obj:[],fl:[],ed:[],regrow:[],pile:{},report:null},
    loc:{},sites:[],siteN:0,lead:{next:0,note:null,last:'',n:0},at:'home',from:'home',
    tide:{n:0,at:0,kind:'shamble',dir:0,weak:0,warned:0,live:null},
    weather:{id:'clear',until:0},
    surv:[],survN:0,morale:60,wait:[],fac:{},clog:[],
    q:{i:0,base:{},contracts:[],refresh:0,done:[]},
    flags:{},seen:{},ach:{},stats:{},codex:{it:{},en:{}},scrip:0,veh:0,mut:0,depth:0,trader:null,nextEv:0,
    // a shared world, when the game is joined to one (js/net.js): `net` is the pass to it, `world` the last news of it, `deeds` what this
    // enclave has done that the world has not been told yet. All three are idle in a game played alone.
    net:null,world:null,deeds:{held:0,lost:0,deaths:0,leads:[]},
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
  for(const s of['head','body','legs','feet','hands']){const e=p.eq[s];if(!e)continue;const it=ITEMS[e.id];if(!it)continue;arm+=it.arm||0;cold+=it.cold||0;tox+=it.tox||0;spd+=it.spd||0;if(it.set)sets[it.set]=(sets[it.set]||0)+1}
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
const WEAR=['head','body','legs','feet','hands'];
/** Something has just come into the pack. The first weapon or tool goes straight into an empty hand, and a thing to wear goes straight on if
 *  nothing is worn there (it says so). Taking something off does not come through here, so what the player takes off stays off. */
export function gained(S,id,quiet){
  const it=ITEMS[id],p=S.p;if(!it)return;
  if(!p.eq.w1&&['melee','gun','tool'].includes(it.t)){const i=p.inv.findIndex(s=>s&&s.id===id);if(i>=0){p.eq.w1={id,d:p.inv[i].d};p.inv[i]=null;p.active='w1';G.ds=derive(S);emit('eq')}return}
  if((WEAR.includes(it.t)||it.t==='pack')&&!p.eq[it.t]){const i=p.inv.findIndex(s=>s&&s.id===id);if(i>=0&&equip(S,i,it.t)&&!quiet)toast((it.t==='pack'?'Shouldered: ':'Put on: ')+it.n,'good')}
}
/** How good a thing is at its job, for comparing with what is worn or held: armour first for clothes (warmth, filters and speed count a little),
 *  slots for a pack, damage a second for a weapon (a gun without a dozen shots is worth nothing; a weapon about to break very little). */
export function gearScore(S,s){
  const it=s&&ITEMS[s.id];if(!it)return 0;const cond=it.dur&&s.d!==undefined?Math.max(0,Math.min(1,s.d/it.dur)):1,weapon=it.t==='melee'||it.t==='gun',frail=weapon?(cond<.15?.2:1)*(.9+.1*cond):(.97+.03*cond);   // clothes give their full armour until the moment they fall apart, so a worn pair still beats a weaker fresh one   // under 15% it is about to break (the line the lead rating draws); above that, condition only decides between near-equals: the fresher of two alike wins
  if(WEAR.includes(it.t))return((it.arm||0)+(it.cold||0)*6+(it.tox||0)*6+(it.spd||0)*20+.1)*frail;
  if(it.t==='pack')return it.slots||0;
  if(it.t==='gun')return count(S,it.ammo)>=(it.ammoPer||1)*12?it.dmg*(it.pellets||1)/it.spd*frail:0;
  if(it.t==='melee')return it.dmg/it.spd*(1+(it.rng||1)*.2)*frail;
  return 0;
}
/** What in the pack beats what is worn or held: [{i, slot, id, was}] with the pack slot it is in. Weapons fill the hand and the spare. */
export function betterGear(S){
  const p=S.p,out=[];
  for(const slot of[...WEAR,'pack']){let bi=-1,bs=p.eq[slot]?gearScore(S,p.eq[slot]):0;p.inv.forEach((s,i)=>{if(s&&ITEMS[s.id].t===slot&&gearScore(S,s)>bs+1e-6){bs=gearScore(S,s);bi=i}});if(bi>=0)out.push({i:bi,slot,id:p.inv[bi].id,was:p.eq[slot]?p.eq[slot].id:null})}
  // weapons: the best two of what is held and carried belong in the two hands; a thrown thing or a tool in the spare hand is left there
  const held=['w1','w2'].filter(k=>!(k==='w2'&&p.eq.w2&&['throw','tool'].includes(ITEMS[p.eq.w2.id].t))),sc=k=>p.eq[k]&&['melee','gun'].includes(ITEMS[p.eq[k].id].t)?gearScore(S,p.eq[k]):0;
  const cand=[];p.inv.forEach((s,i)=>{if(s&&['melee','gun'].includes(ITEMS[s.id].t)&&gearScore(S,s)>0)cand.push({i,v:gearScore(S,s),id:s.id})});cand.sort((a,b)=>b.v-a.v);
  const slots=held.map(k=>({k,v:sc(k)})).sort((a,b)=>a.v-b.v);   // weakest hand first
  for(const c of cand){const h=slots.find(h=>c.v>h.v+1e-6);if(!h)break;out.push({i:c.i,slot:h.k,id:c.id,was:p.eq[h.k]?p.eq[h.k].id:null});h.v=c.v;slots.sort((a,b)=>a.v-b.v)}
  return out;
}
/** Put on and take in hand the best of everything carried. Returns the names of what changed. */
export function wearBest(S){
  const names=[];for(let guard=0;guard<12;guard++){const b=betterGear(S)[0];if(!b)break;if(!equip(S,b.i,b.slot))break;names.push(b.id)}
  // the better of the two weapons goes in the hand, the other is the spare
  {const p=S.p,a=p.eq.w1,b=p.eq.w2;if(b&&['melee','gun'].includes(ITEMS[b.id].t)&&gearScore(S,b)>(a&&['melee','gun'].includes(ITEMS[a.id].t)?gearScore(S,a):0)){p.eq.w1=b;p.eq.w2=a;p.active='w1';G.ds=derive(S);emit('eq');if(!names.length)names.push(b.id)}
    // and the hand is the one in use: with the spare drawn (Q) the best weapon sat in the hand slot unused, while the message said it was in hand
    const w=p.eq.w1,ws=w&&['melee','gun'].includes(ITEMS[w.id].t)?gearScore(S,w):0,o=p.eq.w2,os=o&&['melee','gun'].includes(ITEMS[o.id].t)?gearScore(S,o):0;if(p.active!=='w1'&&ws>0&&ws>=os){p.active='w1';emit('eq');if(!names.includes(w.id))names.push(w.id)}}
  // say where each thing went: "in hand" and "spare" matter, a weapon taken as the spare is not the one being swung
  if(names.length){const p=S.p,where=id=>p.eq.w1&&p.eq.w1.id===id?' in hand':p.eq.w2&&p.eq.w2.id===id?' as spare':' on';toast('Wear best: '+[...new Set(names)].map(id=>ITEMS[id].n+where(id)).join(', '),'good')}
  else toast('You already have your best on','info');
  return names.map(id=>ITEMS[id].n);
}
export function give(S,id,n=1,d,quiet){
  if(!ITEMS[id]||n<=0)return 0;
  const left=addTo(S.p.inv,slotCount(S),id,n,d),got=n-left;
  S.codex.it[id]=1;
  if(got>0&&!quiet)emit('loot',id,got);
  if(got>0)gained(S,id,quiet);
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
  if(!dst){if(['head','body','legs','feet','hands','pack'].includes(it.t))dst=it.t;else if(['melee','gun','tool','throw'].includes(it.t))dst=!S.p.eq.w1?'w1':!S.p.eq.w2?'w2':S.p.active;else return false}
  const old=S.p.eq[dst];
  // the same thing again, and no fresher than the one in use: swapping them would change nothing, so say so
  if(old&&old.id===s.id&&it.t!=='throw'&&(s.d===undefined||(old.d||0)>=s.d)){toast('You already have '+(dst==='w1'||dst==='w2'?'that in hand':'a '+it.n+' on')+': this one is a spare','info');return false}
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
  const home=!!(G.Z&&G.Z.home);for(const k in r.i)if(count(S,k,home)<r.i[k]*n)return'Missing '+ITEMS[k].n+': need '+r.i[k]*n+', have '+count(S,k,home);
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
    let left=q;if(G.Z&&G.Z.home&&G.Z.pl&&!G.Z.pl.dead){left=addTo(S.p.inv,slotCount(S),r.o,q);if(q-left>0){emit('loot',r.o,q-left);gained(S,r.o)}}
    if(left>0){o.out=o.out||{};o.out[r.o]=(o.out[r.o]||0)+left}}
  else give(S,r.o,q);
  stat('crafted',q);stat('c_'+r.o,q);S.codex.it[r.o]=1;
  if(!S.flags['made_'+r.id]){S.flags['made_'+r.id]=1;addXp(S,8+r.lv*3)}else addXp(S,1+Math.floor(r.lv/4));
}
export function collectStation(S,at){
  const o=G.Z&&G.Z.obj[at];if(!o||!o.out)return 0;let got=0;
  for(const k in o.out){const n=o.out[k],cap=slotCount(S),left=addTo(S.p.inv,cap,k,n);if(n-left>0){emit('loot',k,n-left);got+=n-left;gained(S,k)}if(left>0)o.out[k]=left;else delete o.out[k]}
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
/** What is short for a cost, said so a player can act on it ("Log: need 4, have 1"), or null when it can be paid. */
const afford=(S,cost)=>{for(const i in cost){const have=count(S,i,true);if(have<cost[i]){const src=sourcesOf(i,2);return`${ITEMS[i].n}: need ${cost[i]}, have ${have}${src?' ('+src+')':''}`}}return null};
const pay=(S,cost)=>{for(const i in cost)take(S,i,cost[i],true)};
export function inBuildArea(Z,x,y){return x>=NO_BUILD&&y>=NO_BUILD&&x<Z.w-NO_BUILD&&y<Z.h-NO_BUILD}
// ---- walls stand on the edges between cells
// A wall or door you build does not fill a cell: it stands on one side of it, and the cell stays free to walk in and build on.
// Z.ed holds them: Z.ed[tile*2] is the wall on that tile's north edge, Z.ed[tile*2+1] the one on its west edge (a south edge is the
// north edge of the tile below, an east edge the west edge of the tile to the right). Where one number has to name either a tile
// object or a wall (what an enemy is breaking, what a build tool points at), a wall is EREF + its edge index.
export const EREF=1<<22;
export const isEdgeKind=k=>{const d=OBJ[k];return!!(d&&d.cost&&(d.wall||d.door))};
/** The edge on one side of tile (x, y) in a zone W tiles wide. side: 0 north, 1 east, 2 south, 3 west. */
export const edgeIdx=(W,x,y,side)=>side===0?(y*W+x)*2:side===2?((y+1)*W+x)*2:side===3?(y*W+x)*2+1:(y*W+x+1)*2+1;
/** What a structure reference points at (tile index, or EREF + edge), and where its middle is. */
export const structAt=(Z,ref)=>ref>=EREF?Z.ed[ref-EREF]:Z.obj[ref];
export const structXY=(Z,ref)=>{if(ref>=EREF){const e=ref-EREF,i=e>>1,x=i%Z.w,y=(i-x)/Z.w;return e&1?[x,y+.5]:[x+.5,y]}return[ref%Z.w+.5,Math.floor(ref/Z.w)+.5]};
const touchRef=(Z,ref)=>{if(ref>=EREF)Z.touchEdge(ref-EREF);else Z.touch(ref)};
/** Why a piece cannot go on this tile, or null if it can. For a wall or door, `side` says which edge of the tile (0 north, 1 east, 2 south, 3 west). */
/** Would a solid thing on tile i leave the player with no way on foot to the edge of the homestead? (A bot boxed itself into a corner of its own yard
 *  with a torch and a storage box.) Walls stop the way unless they are doors; solid things stop it unless they are doors. */
/** Would a solid thing on tile i leave a station, a storage box or anything else you use, next to it, with no open side to stand at? (A bot walled its
 *  campfire into a corner with the workbench and the furnace and could not reach it.) Returns the name of what would be boxed in, or null. */
function boxesIn(Z,i){
  const W=Z.w,x0=i%W,y0=(i-x0)/W,useful=o=>{const d=o&&OBJ[o.k];return d&&(d.station||d.store||d.special||d.bed||d.loot)&&d.solid};
  const sides=[[1,0,1],[-1,0,3],[0,1,2],[0,-1,0]];
  for(const[dx,dy]of sides){const nx=x0+dx,ny=y0+dy,n=ny*W+nx;if(nx<0||ny<0||nx>=W||ny>=Z.h||!useful(Z.obj[n]))continue;
    let open=0;for(const[ex,ey,side]of sides){const mx=nx+ex,my=ny+ey,m=my*W+mx;if(m===i||mx<0||my<0||mx>=W||my>=Z.h)continue;if(Z.ed[edgeIdx(W,nx,ny,side)])continue;const o=Z.obj[m];if(o&&OBJ[o.k]&&OBJ[o.k].solid&&!OBJ[o.k].door)continue;open++}
    if(!open)return OBJ[Z.obj[n].k].n}
  return null;
}
function sealsIn(Z,i){
  const W=Z.w,H=Z.h,p=Z.pl,s=Math.floor(p.y)*W+Math.floor(p.x);if(s===i)return false;const seen=new Uint8Array(W*H),q=[s];seen[s]=1;
  const open=j=>{if(j===i)return false;const o=Z.obj[j];if(!o)return true;const od=OBJ[o.k];return!od||!od.solid||!!od.door};
  const wallOn=e=>{const w=Z.ed[e];if(!w)return false;const wd=OBJ[w.k];return!(wd&&wd.door)};
  while(q.length){const c=q.pop(),x=c%W,y=(c-x)/W;if(x<3||y<3||x>=W-3||y>=H-3)return false;
    for(const[dx,dy,side]of[[1,0,1],[-1,0,3],[0,1,2],[0,-1,0]]){const nx=x+dx,ny=y+dy,n=ny*W+nx;if(nx<0||ny<0||nx>=W||ny>=H||seen[n])continue;if(wallOn(edgeIdx(W,x,y,side)))continue;if(!open(n))continue;seen[n]=1;q.push(n)}}
  return true;
}
export function canPlace(S,k,x,y,side=0){
  const Z=G.Z,d=OBJ[k];if(!Z||!Z.home)return'Only at home';if(!d||!d.cost)return'Cannot build that';
  if(!buildUnlocked(S,k))return d.bp?'Needs a schematic':'Needs level '+d.lv;
  if(!inBuildArea(Z,x,y))return'Too close to the tree line';
  if(isEdgeKind(k)){if(Z.g[idx(Z,x,y)]===6)return'Water';if(Z.ed[edgeIdx(Z.w,x,y,side&3)])return'There is already a wall on that side';const miss=afford(S,buildCost(k));return miss?'Missing '+miss:null}
  const i=idx(Z,x,y);if(Z.g[i]===6)return'Water';
  if(d.floor){if(Z.fl[i])return'Already floored'}
  else{if(Z.obj[i])return'Occupied by '+(OBJ[Z.obj[i].k]?OBJ[Z.obj[i].k].n:'something');if(d.solid)for(const a of Z.actors)if(!a.dead&&Math.floor(a.x)===x&&Math.floor(a.y)===y)return'Something is standing there';
    if(d.solid&&!d.door&&Z.pl&&sealsIn(Z,i))return'That would shut you in: leave yourself a way out';
    if(d.solid&&!d.door){const b=boxesIn(Z,i);if(b)return'That would leave the '+b+' with no side to stand at'}}
  const miss=afford(S,buildCost(k));if(miss)return'Missing '+miss;
  return null;
}
export function place(S,k,x,y,rot=0){
  const why=canPlace(S,k,x,y,rot);if(why){toast(why,'bad');sfx('error');return false}
  const Z=G.Z,d=OBJ[k],i=idx(Z,x,y);pay(S,buildCost(k));
  if(isEdgeKind(k)){const e=edgeIdx(Z.w,x,y,rot&3);Z.ed[e]={k,hp:maxHp(k)};Z.touchEdge(e);const[mx,my]=structXY(Z,EREF+e);stat('built');if(!S.flags['built_'+k]){S.flags['built_'+k]=1;addXp(S,10+d.lv*4)}else addXp(S,2);sfx('build',mx,my);emit('fx','dust',mx,my);return true}
  if(d.floor){Z.fl[i]=k;emit('floor',i)}else{Z.obj[i]={k,hp:maxHp(k),r:rot};if(d.store)Z.obj[i].inv=[];if(d.turret)Z.obj[i].ammo=0;Z.touch(i)}
  stat('built');if(!S.flags['built_'+k]){S.flags['built_'+k]=1;addXp(S,10+d.lv*4)}else addXp(S,2);
  sfx('build',x+.5,y+.5);emit('fx','dust',x+.5,y+.5);return true;
}
/** Turn a structure you built a quarter turn where it stands. */
export function rotateObj(S,i,x,y){const Z=G.Z;if(!Z||!Z.home)return false;if(i>=EREF)return turnEdge(S,i-EREF,x,y);const o=Z.obj[i];if(!o||!OBJ[o.k].cost){toast('Nothing of yours to turn here','bad');sfx('error');return false}o.r=((o.r||0)+1)%4;Z.touch(i);sfx('ui_tap');return true}
/** Swing a wall or door to the next free side, clockwise, of the cell it is being pointed at from (either of the two cells it stands between). */
function turnEdge(S,e,x,y){
  const Z=G.Z,w=Z.ed[e];if(!w){toast('Nothing of yours to turn here','bad');sfx('error');return false}
  let from=-1;if(x!==undefined)for(let s=0;s<4;s++)if(edgeIdx(Z.w,x,y,s)===e)from=s;
  if(from<0){const t=e>>1;x=t%Z.w;y=(t-x)/Z.w;from=e&1?3:0}
  for(let k=1;k<4;k++){const s=(from+k)&3,j=edgeIdx(Z.w,x,y,s);if(Z.ed[j])continue;Z.ed[j]=w;Z.ed[e]=null;Z.touchEdge(e);Z.touchEdge(j);sfx('ui_tap');return true}
  toast('Every side of this cell already has a wall','bad');sfx('error');return false;
}
/** Why the structure on tile i cannot be moved to (x, y), or null. Moving is free and keeps everything about it (health, contents, crops, jobs). */
export function canMove(S,i,x,y,side=0){
  const Z=G.Z;if(!Z||!Z.home)return'Only at home';
  // a wall or door goes from its edge to side `side` of tile (x, y)
  if(i>=EREF){if(!Z.ed[i-EREF])return'Nothing of yours to move';if(x<0||y<0||x>=Z.w||y>=Z.h||!inBuildArea(Z,x,y))return'Too close to the tree line';if(Z.g[idx(Z,x,y)]===6)return'Water';
    const j=edgeIdx(Z.w,x,y,side&3);return j!==i-EREF&&Z.ed[j]?'There is already a wall on that side':null}
  const o=Z.obj[i];if(!o||!OBJ[o.k]||!OBJ[o.k].cost)return'Nothing of yours to move';
  if(x<0||y<0||x>=Z.w||y>=Z.h||!inBuildArea(Z,x,y))return'Too close to the tree line';const j=idx(Z,x,y);if(j===i)return null;
  if(Z.g[j]===6)return'Water';if(Z.obj[j])return'Occupied by '+(OBJ[Z.obj[j].k]?OBJ[Z.obj[j].k].n:'something');
  if(OBJ[o.k].solid)for(const a of Z.actors)if(!a.dead&&Math.floor(a.x)===x&&Math.floor(a.y)===y)return'Something is standing there';
  return null;
}
export function moveObj(S,i,x,y,rot){
  const why=canMove(S,i,x,y,rot);if(why){toast(why,'bad');sfx('error');return false}
  if(i>=EREF){const Z=G.Z,e=i-EREF,j=edgeIdx(Z.w,x,y,rot&3);if(j!==e){Z.ed[j]=Z.ed[e];Z.ed[e]=null;Z.touchEdge(e)}Z.touchEdge(j);const[mx,my]=structXY(Z,EREF+j);stat('moved');sfx('build',mx,my);emit('fx','dust',mx,my);return true}
  const Z=G.Z,j=idx(Z,x,y),o=Z.obj[i];if(rot!==undefined)o.r=rot;
  if(j!==i){Z.obj[j]=o;Z.obj[i]=null;if(S.p.bed===i)S.p.bed=j;Z.touch(i)}Z.touch(j);
  stat('moved');sfx('build',x+.5,y+.5);emit('fx','dust',x+.5,y+.5);return true;
}
export function canUpgrade(S,i,floor){
  const Z=G.Z;if(!Z||!Z.home)return'Only at home';const st=floor?null:structAt(Z,i),k=floor?Z.fl[i]:st&&st.k;if(!k)return'Nothing here';const d=OBJ[k];if(!d.up)return'Fully upgraded';
  if(!buildUnlocked(S,d.up))return OBJ[d.up].bp?'Needs a schematic':'Needs level '+OBJ[d.up].lv;
  const miss=afford(S,buildCost(d.up));if(miss)return'Missing '+miss;return null;
}
export function upgrade(S,i,floor){
  const why=canUpgrade(S,i,floor);if(why){toast(why,'bad');sfx('error');return false}
  const Z=G.Z;
  if(floor){const up=OBJ[Z.fl[i]].up;pay(S,buildCost(up));Z.fl[i]=up;emit('floor',i)}
  else{const o=structAt(Z,i),up=OBJ[o.k].up;pay(S,buildCost(up));o.k=up;o.hp=maxHp(up);touchRef(Z,i)}
  stat('built');addXp(S,6);sfx('build');emit('fx','dust',...structXY(Z,i));return true;
}
export function repairCost(o){const d=OBJ[o.k],mh=maxHp(o.k),f=1-o.hp/mh,out={};if(f<=.01)return null;for(const k in d.cost){const n=Math.ceil(d.cost[k]*f*.5);if(n>0)out[k]=n}return out}
export function repair(S,i){
  const Z=G.Z,o=Z&&structAt(Z,i);if(!o||!Z.home)return false;const cost=repairCost(o);if(!cost){toast('No damage','info');return false}
  const miss=afford(S,cost);if(miss){toast('Missing '+miss,'bad');sfx('error');return false}
  pay(S,cost);o.hp=maxHp(o.k);if(OBJ[o.k].trap)o.uses=0;touchRef(Z,i);sfx('build');return true;
}
export function demolish(S,i,floor){
  const Z=G.Z;if(!Z||!Z.home)return false;
  if(floor){const k=Z.fl[i];if(!k)return false;const c=OBJ[k].cost;for(const m in c)give(S,m,Math.floor(c[m]*.5),undefined,true);Z.fl[i]=null;emit('floor',i);sfx('break');return true}
  if(i>=EREF){const e=i-EREF,w=Z.ed[e];if(!w)return false;const c=OBJ[w.k].cost;for(const m in c)give(S,m,Math.floor(c[m]*.5*(w.hp/maxHp(w.k))),undefined,true);Z.ed[e]=null;Z.touchEdge(e);sfx('break');return true}
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
  for(const o of S.home.ed||[])if(o&&OBJ[o.k]&&f(OBJ[o.k]))n++;
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
  if(['melee','gun','tool','throw','head','body','legs','feet','hands','pack'].includes(it.t))return equip(S,i);
  return false;
}
/** Eat/drink/heal with the best thing in the pack for a need: 'food' | 'water' | 'hp' | 'tox'. */
export function quickUse(S,need){
  let best=-1,score=0,risky=null;const p=S.p,ds=G.ds;
  S.p.inv.forEach((s,i)=>{if(!s)return;const it=ITEMS[s.id];if(it.t!=='food'&&it.t!=='med')return;let v=0;
    if(need==='food')v=(it.food||0)-(it.risk?it.risk[0]*40:0);else if(need==='water'){if((it.water||0)<10||(it.food||0)>(it.water||0)*2)return;   // a drink: not berries, and not a meal that happens to be moist (a Field Ration)
      v=(it.water||0)-(it.risk?it.risk[0]*40:0);if(v<=0)risky=it.n}   // a drink, not a handful of berries; and nothing that is likely to make you ill
    else if(need==='hp'){if(it.t!=='med'&&!(it.hp>=8))return;const miss=ds.maxHp-p.hp;v=it.hp>0?Math.max(1,100-Math.abs(miss-it.hp)):0}
    else if(need==='tox')v=-(it.tox||0);
    if(v>score){score=v;best=i}});
  if(best<0){toast(need==='hp'?'Nothing to heal with':need==='tox'?'No antidote':need==='water'?(risky?'Only '+risky+' to drink: boil it at a campfire first, or drink it from your pack and risk it':'Nothing to drink in your pack'):'Nothing suitable in your pack','bad');sfx('error');return false}
  // say what was used and how many are left: a quick key, the health bar or auto mode spends things the player did not pick by hand
  const id=S.p.inv[best].id,ok=useItem(S,best);if(ok){const left=count(S,id);toast('Used '+ITEMS[id].n+(left?' · '+left+' left':' · that was the last one'),left?'info':'bad');
    // a weak cure for a heavy dose: say what would actually clear it
    if(need==='tox'&&S.p.tox>=40)toast('Toxin still '+Math.round(S.p.tox)+': Charcoal Tablets (-25) or Antitoxin (-70) clear it properly. A gas mask keeps it out','bad')}return ok;
}
export function repairWithKit(S,slot){
  const e=S.p.eq[slot];if(!e||e.d===undefined)return false;const it=ITEMS[e.id];if(e.d>=it.dur){toast('Not worn','info');return false}
  if(!take(S,'repair_kit',1)){toast('No repair kit','bad');return false}e.d=Math.min(it.dur,e.d+Math.max(60,it.dur*.6));sfx('build');return true;
}

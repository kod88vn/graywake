// The world outside a single frame of combat: the clock, hunger and thirst, weather, tides, travel, events,
// survivors, trading, sleep, death and the save format. Pure logic.
import {ITEMS} from '../data/items.js';
import {OBJ} from '../data/objects.js';
import {RECIPES,VEHICLES} from '../data/recipes.js';
import {LOC,LOCATIONS,SITES,REGIONS,LEADS} from '../data/world.js';
import {EVENTS,WEATHER,WEATHER_BY_REG,TIDE_KINDS,TIDE_COST} from '../data/events.js';
import {SURV_NAMES,SURV_TRAITS,JOBS,TRADE,TRADE_BP} from '../data/progress.js';
import {ENEMIES,scale} from '../data/enemies.js';
import {FACTIONS} from '../data/community.js';
import {G,FIST,emit,toast,sfx,stat,statMax,blankState,derive,perk,count,take,give,addTo,removeFrom,slotCount,homeStores,addXp,addBuff,produce,maxHp,hasBuilt,countBuilt,compact,dropAt,SAVE_V,edgeIdx,MIN_PER_SEC,HOME_W,HOME_H} from './core.js';
import {genHome,homeZone,genZone,siteDef,freeNear,rollLoot,playerField} from './zone.js';
import {spawnActor,spawnPlayer,populate,enemiesAlive,step,alertActor,harvest,plant} from './actors.js';
import {startQuest,checkStory,checkAch,fillContracts,noteClear,maxRegion} from './quests.js';
import {clamp,rnd,dist,dayOf,hourOf,hash,TAU} from './util.js';
import * as Community from './community.js';

G.hooks={};
export const isNight=t=>{const h=hourOf(t);return h>=20.5||h<5.5};
/** 0 at midnight-dark, 1 at full day, with dawn and dusk ramps. */
export const daylight=t=>{const h=hourOf(t);return h<4.5?0:h<7?(h-4.5)/2.5:h<18.5?1:h<21?1-(h-18.5)/2.5:0};
export const weather=S=>WEATHER[S.weather.id]||WEATHER.clear;
const regionHere=S=>G.Z?G.Z.reg||1:1;

// ---------------------------------------------------------------- new game / zones
export function newGame(seed=(Date.now()&0x7fffffff)){
  const S=G.S=blankState(seed);G.ds=derive(S);genHome(S);
  addTo(S.p.inv,slotCount(S),'water',1);addTo(S.p.inv,slotCount(S),'canned_beans',1);
  S.weather={id:'clear',until:S.t+360};scheduleTide(S,true);S.nextEv=S.t+600;startQuest(S);goHome(false);
  return S;
}
export function enterZone(Z,x,y){
  const S=G.S;G.Z=Z;G.ds=derive(S);G.auto=false;G.night=isNight(S.t);spawnPlayer(Z,x,y);populate(Z,G.night||Z.dark);
  if(S.flags.dog&&!(S.flags.dogDown>S.t)){const[dx,dy]=freeNear(Z,x,y,2);spawnActor(Z,'dog',dx,dy,1+Math.floor(S.p.lvl/2))}
  Z.hadEnemies=enemiesAlive(Z)>0;Z.cleared=false;G.mode='play';S.at=Z.id;emit('zone');
}
export function goHome(arriving=true){
  const S=G.S,Z=homeZone(S);
  if(arriving)enterZone(Z,Z.gate.x,Z.gate.y);else enterZone(Z,Z.spawn.x,Z.spawn.y+(S.p.bed!=null?.9:0));
  S.pos='home';
  // people
  const posts=[];Z.obj.forEach((o,i)=>{if(o&&OBJ[o.k].special==='guard')posts.push(i)});const towers=[];Z.obj.forEach((o,i)=>{if(o&&OBJ[o.k].special==='tower')towers.push(i)});
  let pi=0;const cx=HOME_W/2,cy=HOME_H/2;
  for(const sv of S.surv){
    if(sv.job==='guard'&&pi<posts.length){const i=posts[pi++],px=i%Z.w+.5,py=Math.floor(i/Z.w)+.5,[x,y]=freeNear(Z,px,py,1.5);
      const g=spawnActor(Z,'guard',x,y,1+Math.floor(S.tide.n*1.2));g.sv=sv.id;g.far=towers.some(t=>dist(t%Z.w,Math.floor(t/Z.w),px,py)<8);if(sv.trait==='shot')g.dmg=Math.round(g.dmg*1.5);if(sv.trait==='tough'){g.hp*=2;g.mhp*=2}if(sv.trait==='owl')g.far=true}
    else{const[x,y]=freeNear(Z,cx+(rnd()-.5)*8,cy+(rnd()-.5)*8,3);const a=spawnActor(Z,'captive',x,y,1);a.stay=true;a.sv=sv.id;a.look=sv.id}
  }
  if(S.home.report){emit('ui','report',S.home.report);S.home.report=null}
  return Z;
}
export function locLevel(S,l){return l.endless?l.lvl+S.depth*2:l.lvl}
/** Why the player cannot go somewhere, or null. */
export function canVisit(S,id){
  const site=S.sites.find(s=>s.id===id);if(site)return REGIONS[site.reg].veh>S.veh?'Needs a '+VEHICLES[REGIONS[site.reg].veh].n.toLowerCase():null;
  if(id==='home')return null;const l=LOC[id];if(!l)return'Unknown';
  if(REGIONS[l.reg].veh>S.veh)return'Needs a '+VEHICLES[REGIONS[l.reg].veh].n.toLowerCase();
  if(l.flag&&!S.flags[l.flag])return'The way is not open yet';
  const m=S.loc[id];if(m&&m.cool>S.t&&!(m.bag&&m.bag.some(Boolean)))return'Picked clean. Give it '+Math.ceil((m.cool-S.t)/60)+' h';
  return null;
}
export const posXY=(S,id)=>{const s=S.sites.find(s=>s.id===id);if(s)return[s.x,s.y];const l=LOC[id]||LOC.home;return[l.x,l.y]};
export function travelInfo(S,dest){
  const[ax,ay]=posXY(S,S.pos),[bx,by]=posXY(S,dest),d=dist(ax,ay,bx,by);let veh=VEHICLES[S.veh];
  const fuel=Math.ceil(veh.fuel*d/100),hasFuel=fuel<=0||count(S,'fuel',S.pos==='home')>=fuel;if(!hasFuel)veh=VEHICLES[2];
  const speed=veh.spd*(1+perk('travel'))*(hasBuilt(S,o=>o.special==='maptable')?1.15:1),min=Math.max(10,Math.round(d/speed*60));
  return{d,min,fuel:hasFuel?fuel:0,noFuel:!hasFuel&&fuel>0};
}
/** What mending on the road costs per point of health, and the food and water it will not go below. */
export const ROAD={food:.15,water:.2,keep:10};
/** Walk off the edge of the current zone onto the map. */
export function leaveZone(){
  const S=G.S,Z=G.Z;if(!Z)return false;
  if(S.tide.live){toast('Not while the tide is at the walls','bad');return false}
  if(!Z.exit&&!Z.pl.dead){toast('Walk to the edge of the area to leave','info');return false}
  if(!Z.home&&Z.id!=='ambush'){if(Z.site){const st=S.sites.find(s=>s.id===Z.site),keep=st&&((SITES[st.site].lead&&Z.obj.some(o=>o&&OBJ[o.k].lock==='guard'&&!o.inv))||(st.bag&&st.bag.some(Boolean)));if(!keep)S.sites=S.sites.filter(s=>s.id!==Z.site)}else if(LOC[Z.id]){const m=S.loc[Z.id]=S.loc[Z.id]||{n:0};m.cool=S.t+(LOC[Z.id].cool||10)*60}}
  const pend=G.pending;G.Z=null;G.auto=false;
  if(Z.id==='ambush'&&pend&&pend.dest){G.pending=null;arrive(pend.dest);return true}
  G.mode='map';S.at='map';emit('ui','map');emit('save');return true;
}
export function travel(dest){
  const S=G.S,why=canVisit(S,dest);if(why){toast(why,'bad');sfx('error');return false}
  if(dest===S.pos&&dest==='home'){goHome(true);return true}
  const info=travelInfo(S,dest),reg=destReg(S,dest);
  if(info.fuel>0)take(S,'fuel',info.fuel,S.pos==='home');else if(info.noFuel)toast('No fuel: going the slow way','bad');
  sfx('travel');advance(S,info.min,'travel');stat('distance',Math.round(info.d));
  // The road is also a rest: wounds mend on the way, paid for in food and water, as far as there is any to spare (the user's idea:
  // "leaving the map and come back should instant heal, hunger and thirst decrease").
  {const ds=G.ds||derive(S),p=S.p,miss=ds.maxHp-p.hp;if(miss>=2){const heal=Math.floor(Math.min(miss,Math.max(0,p.food-ROAD.keep)/ROAD.food,Math.max(0,p.water-ROAD.keep)/ROAD.water));
      if(heal>0){p.hp+=heal;p.food-=heal*ROAD.food;p.water-=heal*ROAD.water;toast(`You mended on the way: +${heal} health for ${Math.round(heal*ROAD.food)} food and ${Math.round(heal*ROAD.water)} water`,'good')}
      else toast('Too hungry and thirsty to mend on the way','info')}}
  if(S.p.hp<=0){S.p.hp=5}
  if(info.min>25&&rnd()<.36){const ev=pickEvent(S,'travel',reg);if(ev){G.pending={dest};S.pos=dest==='home'?'home':S.pos;emit('ui','event',ev.id);return true}}
  arrive(dest);return true;
}
const destReg=(S,dest)=>{const s=S.sites.find(s=>s.id===dest);return s?s.reg:(LOC[dest]||LOC.home).reg};
export function arrive(dest){
  const S=G.S;S.pos=dest;
  if(dest==='home'){goHome(true);emit('save');return}
  const site=S.sites.find(s=>s.id===dest);let Z;
  // the place went off the map while the player was on the road to it (a rival opened the strongroom, or its time ran out): back to the map, with a word
  if(!site&&!LOC[dest]){G.Z=null;G.pending=null;G.mode='map';S.at='map';toast('That place is gone: someone got there first, or it was abandoned','bad');emit('ui','map');emit('save');return}
  if(site){Z=genZone(siteDef(site,site.reg,site.lvl),hash(S.seed,site.id*7919));Z.site=site.id;Z.id='site';Z.name=SITES[site.site].n;Z.siteKind=site.site;if(site.bag&&site.bag.some(Boolean)){const x=Math.floor(Z.w/2)-2,y=Z.h-4;Z.obj[y*Z.w+x]={k:'deathbag',r:0,v:0,inv:site.bag,open:1}}if(SITES[site.site].lead&&leadInfo(S,site).skulls>=4)Z.lt=Math.min(5,Z.lt+1)}
  else{const l=LOC[dest],m=S.loc[dest]=S.loc[dest]||{n:0};Z=genZone(l,hash(S.seed+m.n*101,LOCATIONS.indexOf(l)),{lvl:locLevel(S,l)});if(!m.n)stat('locs');m.n++}
  enterZone(Z,Z.spawn.x,Z.spawn.y);
  // what the story sent you for is somewhere here: say which kind of container to look in, and roughly where (the bot searched open ground for the coil)
  {const qi=Z.obj.findIndex(o=>o&&o.qi);if(qi>=0){const x=qi%Z.w,y=Math.floor(qi/Z.w),dx=x-Z.pl.x,dy=y-Z.pl.y,dir=(Math.abs(dy)>Math.abs(dx)*.5?(dy<0?'north':'south'):'')+(Math.abs(dx)>Math.abs(dy)*.5?(dx<0?'west':'east'):'');
    toast('The '+ITEMS[Z.obj[qi].qi].n+' should be in a '+OBJ[Z.obj[qi].k].n+' to the '+(dir||'middle')+', inside one of the buildings','info')}}
  // the player travels alone, except to attack a base (a war camp, a raider camp): then the people of the homestead who are fit come too
  if(site&&SITES[site.site].base){const go=S.surv.filter(Community.available);for(const sv of go){const[x,y]=freeNear(Z,Z.pl.x+(rnd()-.5)*3,Z.pl.y+1.5,3),a=spawnActor(Z,'guard',x,y,Math.max(1,S.p.lvl-2),{from:'group'});a.escort=true;a.sv=sv.id;sv.away=1}
    if(go.length)toast(go.map(s=>s.n).join(', ')+(go.length>1?' come':' comes')+' with you. They are carried home if they fall, and laid up for three days','info')}
  emit('save');
}
function startAmbush(table,home){
  const S=G.S;
  // a fight that comes to the homestead is pitched to whoever lives there, like one on the road: six raiders with guns at the homestead's level killed a
  // level 13 character with 43 armour and sixteen bandages in six seconds (0.10.0)
  if(home&&G.Z&&G.Z.home){const Z=G.Z,side=Math.floor(rnd()*4),plan=ambushPlan(S,table,Z.lvl);table=plan.table;for(const k in table)for(let i=0;i<table[k];i++){const[x,y]=edgePoint(Z,side,10);spawnActor(Z,k,x,y,plan.lvl,ENEMIES[k]&&ENEMIES[k].ai==='flee'?{}:{alert:true,st:'chase',tide:true})}sfx('warning');return}
  const reg=G.pending&&G.pending.dest?destReg(S,G.pending.dest):regionHere(S),biome=['forest','forest','dust','city','frost','gray'][reg];
  // pitched to the player as they stand, the same way the choice that led here described it
  const plan=ambushPlan(S,table,ambushTop(S,reg)),lvl=plan.lvl;table=plan.table;
  const Z=genZone({id:'ambush',n:'Ambush',lay:'wild',biome,reg,lvl,size:[30,30],nodes:biome==='forest'?{tree_pine:14,rock:4,grass_tall:5}:biome==='dust'?{cactus:6,rock:6,tree_joshua:3}:biome==='city'?{car_hull:5}:biome==='frost'?{tree_snow:10,rock:5}:{tree_gray:8,bloom:4},props:biome==='city'?{car_wreck:4,rubble:5}:{}},hash(S.seed,Math.floor(S.t)));
  enterZone(Z,Z.spawn.x,Z.spawn.y-8);
  for(const k in table)for(let i=0;i<table[k];i++){const a=rnd()*TAU,[x,y]=freeNear(Z,clamp(Z.pl.x+Math.cos(a)*9,3,Z.w-3),clamp(Z.pl.y+Math.sin(a)*9,3,Z.h-3),3);spawnActor(Z,k,x,y,lvl,{alert:true,st:'chase'})}
  Z.hadEnemies=true;sfx('warning');
}
function edgePoint(Z,side,spread){
  const m=2.5,c=(side%2?Z.h:Z.w)/2+(rnd()-.5)*(Z.home?3:spread*2);let x,y;if(side===0){x=c;y=m}else if(side===1){x=Z.w-m;y=c}else if(side===2){x=c;y=Z.h-m}else{x=m;y=c}
  return freeNear(Z,clamp(x,m,Z.w-m),clamp(y,m,Z.h-m),3);
}

// ---------------------------------------------------------------- effects (events, quests, contracts)
/** Apply a list of effects. Returns short human-readable lines describing what happened. */
export function applyFx(list,announce){
  const S=G.S,out=[];
  for(const f of list||[]){const[k,a,b,c]=f;
    if(k==='item'){give(S,a,b||1,undefined,!announce&&false);out.push('+'+(b||1)+' '+ITEMS[a].n)}
    else if(k==='take'){take(S,a,b||1);out.push('−'+(b||1)+' '+ITEMS[a].n)}
    else if(k==='hp'){S.p.hp=clamp(S.p.hp+a,1,G.ds.maxHp);out.push((a>0?'+':'')+a+' health')}
    else if(k==='food'){S.p.food=clamp(S.p.food+a,0,100);out.push((a>0?'+':'')+a+' food')}
    else if(k==='water'){S.p.water=clamp(S.p.water+a,0,100);out.push((a>0?'+':'')+a+' water')}
    else if(k==='tox'){const v=Math.round(a*(a>0?1-G.ds.tox:1));S.p.tox=clamp(S.p.tox+v,0,100);out.push((v>0?'+':'')+v+' toxin')}
    else if(k==='time'){advance(S,a,'wait');out.push(a>=60?Math.round(a/60*10)/10+' h pass':a+' min pass')}
    else if(k==='xp'){addXp(S,a);out.push('+'+a+' xp')}
    else if(k==='sp'){S.p.sp+=a;out.push('+'+a+' perk point'+(a>1?'s':''))}
    else if(k==='scrip'){S.scrip=Math.max(0,S.scrip+a);if(a>0)stat('earned',a);out.push((a>0?'+':'')+a+' scrip')}
    else if(k==='loot'){for(const it of rollLoot(a,maxRegion(S),rnd,(b||1)-1)){give(S,it.id,it.n,it.d);out.push('+'+it.n+' '+ITEMS[it.id].n)}}
    else if(k==='fight'){G.pending=G.pending||{};G.pending.fight={table:a,home:b==='home'};out.push('Fight!')}
    // a choice that says "go home" goes home: the trip under way is abandoned
    else if(k==='turnback'){if(G.pending&&G.pending.dest&&G.pending.dest!=='home'){G.pending.dest='home';out.push('You turn back for the homestead')}}
    else if(k==='surv'){const sv=addSurvivor(S);out.push(sv?sv.n+' joins you':'No room for another survivor')}
    else if(k==='survleave'){if(S.surv.length){const sv=S.surv.splice(Math.floor(rnd()*S.surv.length),1)[0];out.push(sv.n+' leaves')}}
    else if(k==='buff'){addBuff(S,a,b,c);out.push(a==='weak'?'Weakened':'Feeling '+({resist:'steady',regen:'restored',speed:'quick',haste:'sharp',vigor:'strong'}[a]||'better'))}
    else if(k==='horde'){S.tide.at+=a*60;out.push(a>0?'The tide is delayed '+a+' h':'The tide comes '+(-a)+' h sooner')}
    else if(k==='hordeWeak'){S.tide.weak=Math.min(.6,S.tide.weak+a);out.push('The next tide will be thinner')}
    else if(k==='morale'){S.morale=clamp(S.morale+a,0,100);if(S.surv.length)out.push((a>0?'+':'')+a+' morale')}
    else if(k==='site'){const s=addSite(S,a);if(s)out.push('Marked on your map: '+SITES[a].n)}
    else if(k==='weather'){S.weather={id:a,until:S.t+300}}
    else if(k==='raid'){const n=raidBase(S,a);if(n)out.push(n+' structure'+(n>1?'s':'')+' damaged')}
    else if(k==='bp'){const all=Object.values(TRADE_BP).flat().filter(id=>!ITEMS[id].learn.every(r=>S.p.known[r])&&REGIONS.findIndex((r,i)=>i&&TRADE_BP[i]&&TRADE_BP[i].includes(id))<=maxRegion(S)+1);if(all.length){const id=all[Math.floor(rnd()*all.length)];give(S,id,1);out.push('+'+ITEMS[id].n)}else{S.scrip+=150;out.push('+150 scrip')}}
    else if(k==='trade'){G.pending=G.pending||{};G.pending.trade=true}
    else if(k==='lose'){for(let n=0;n<a;n++){const idxs=S.p.inv.map((s,i)=>s?i:-1).filter(i=>i>=0);if(!idxs.length)break;const i=idxs[Math.floor(rnd()*idxs.length)];out.push('Lost '+S.p.inv[i].n+' '+ITEMS[S.p.inv[i].id].n);S.p.inv[i]=null}}
    else if(k==='losefood'){let n=a;for(const b of homeStores(S))for(let i=0;i<b.inv.length&&n>0;i++){const s=b.inv[i];if(s&&ITEMS[s.id].t==='food'){const q=Math.min(n,s.n);s.n-=q;n-=q;if(s.n<=0)b.inv[i]=null}}out.push('Lost '+(a-n)+' food from the stores')}
    else if(k==='crop'){for(const o of S.home.obj)if(o&&o.seed&&rnd()<-a){o.seed=null;o.ripe=0}if(G.Z&&G.Z.home)emit('zoneDirty');out.push('Some crops were lost')}
    else if(k==='flag'){S.flags[a]=1;if(a==='core_dead'){out.push('The Deep Gray is open');emit('ui','ending')}}
  }
  if(announce&&out.length)toast(out.join(' · '),'good');
  G.ds=derive(S);return out;
}
G.hooks.fx=applyFx;

// ---------------------------------------------------------------- events
function homeHas(S,what){return hasBuilt(S,o=>o.id===what||o.special===what)}
export function pickEvent(S,at,reg){
  const day=dayOf(S.t),list=EVENTS.filter(e=>{
    if(e.at!==at)return false;if(e.once&&S.seen[e.id])return false;const m=e.min||{};
    if(m.day&&day<m.day)return false;if(m.lvl&&S.p.lvl<m.lvl)return false;if(m.veh&&S.veh<m.veh)return false;
    if(e.reg&&!e.reg.includes(reg))return false;if(e.weather&&!e.weather.includes(S.weather.id))return false;
    if(e.need&&!homeHas(S,e.need))return false;if(e.noneed&&homeHas(S,e.noneed))return false;if(e.minSurv&&S.surv.length<e.minSurv)return false;
    return true});
  if(!list.length)return null;let tot=0;for(const e of list)tot+=e.w*(S.seen[e.id]?.6:1);let x=rnd()*tot;
  for(const e of list){x-=e.w*(S.seen[e.id]?.6:1);if(x<=0)return e}return list[list.length-1];
}
export const getEvent=id=>EVENTS.find(e=>e.id===id);
/** Can this option be chosen? Returns null or the reason. */
export function optionBlocked(S,o){
  if(o.tool&&!['w1','w2'].map(s=>S.p.eq[s]).concat(S.p.inv).some(s=>s&&ITEMS[s.id].tool===o.tool))return'Needs '+{pry:'a crowbar',axe:'a hatchet',wrench:'a wrench',pick:'a pickaxe'}[o.tool];
  for(const k in o.need||{}){if(k==='scrip'){if(S.scrip<o.need[k])return'Needs '+o.need[k]+' scrip'}else if(count(S,k)<o.need[k])return'Needs '+o.need[k]+' '+ITEMS[k].n}
  return null;
}
export function chooseOption(evId,oi){
  const S=G.S,ev=getEvent(evId),o=ev.o[oi];if(optionBlocked(S,o))return null;S.seen[evId]=(S.seen[evId]||0)+1;
  let x=rnd(),pick=o.r[o.r.length-1];for(const r of o.r){x-=r[0];if(x<=0){pick=r;break}}
  const lines=applyFx(pick[2]);stat('events');return{text:pick[1],lines};
}
/** Called by the UI when an event card is dismissed: carries on with whatever the event set up. */
export function eventDone(){
  const S=G.S,p=G.pending||{};
  if(p.trade){p.trade=false;openTrader(S,true);emit('ui','trade');return}
  if(p.fight){const f=p.fight;p.fight=null;if(f.home&&G.Z&&G.Z.home){startAmbush(f.table,true);G.pending=null}else startAmbush(f.table,false);return}
  if(p.dest){G.pending=null;arrive(p.dest);return}
  G.pending=null;
}
function addSite(S,kind,reg){
  const def=SITES[kind];if(!def||S.sites.length>=6)return null;const mr=maxRegion(S);reg=reg||Math.max(1,mr-Math.floor(rnd()*2));
  const locs=LOCATIONS.filter(l=>l.reg===reg),a=locs[Math.floor(rnd()*locs.length)],ang=rnd()*TAU,r=30+rnd()*40;
  const lvl=Math.max(1,Math.round(locs.reduce((s,l)=>s+l.lvl,0)/locs.length+(rnd()-.5)*4));
  const s={id:1000+(++S.siteN),site:kind,x:clamp(a.x+Math.cos(ang)*r,30,970),y:clamp(a.y+Math.sin(ang)*r,25,615),until:S.t+def.dur*60,reg,lvl};S.sites.push(s);return s;
}

// ---------------------------------------------------------------- radio leads: special places to loot, announced with their danger
const THREAT=['','Easy pickings','A fair fight','Dangerous','Very dangerous','Deadly'];
/** How clearing a place would go for this player as they stand now: the damage they would take doing it, as a share of the health they bring
 *  (armour and the medicine in their pack included). It weighs their best weapon against the garrison's health and its blows, at the place's
 *  level. About a third is comfortable, one is even, three is hopeless. Level alone says little: a spear does not grow with its owner. */
export function leadOdds(S,def,lvl){
  const ds=derive(S),p=S.p,fist=FIST.dmg/FIST.spd,arms=[];
  // each weapon in hand: how fast it kills, and how much killing is left in it before it breaks or runs dry (a repair kit puts three fifths back)
  for(const slot of['w1','w2']){const e=p.eq[slot],w=e&&ITEMS[e.id];if(!w||w.t==='throw')continue;
    if(w.t==='gun'){const shots=count(S,w.ammo)/(w.ammoPer||1);if(shots>=12)arms.push({v:w.dmg*(w.pellets||1)*.7/w.spd*(ds.ranged||1),cap:shots*w.dmg*(w.pellets||1)*.7})}
    else arms.push({v:w.dmg/w.spd*(ds.melee||1)*(w.fx&&w.fx.cleave?1.3:1),cap:w.dur&&e.d!==undefined?(e.d+(arms.some(a=>a.kit)?0:count(S,'repair_kit')*w.dur*.6))*w.dmg*(ds.melee||1):Infinity,kit:1})}
  arms.sort((a,b)=>b.v-a.v);
  let hp=0,dmg=0,n=0;const add=(k,c)=>{const e=ENEMIES[k];if(!e||e.ai==='flee')return;const sc=scale(k,lvl,S.mut||0);hp+=c*sc.hp/(1-(e.arm||0)*.8);dmg+=c*sc.dmg/e.cd*(e.proj?1.4:1);n+=c;
    if(e.call&&ENEMIES[e.call.kind]&&!ENEMIES[e.call.kind].call)add(e.call.kind,c*e.call.n)};   // one that calls others in gets a call off before it dies
  for(const t of[def.en,def.inn])for(const k in t||{})add(k,t[k]);if(def.boss)add(def.boss,1);if(!n)return 0;
  let heal=0;for(const it of p.inv)if(it&&ITEMS[it.id]&&ITEMS[it.id].t==='med'&&ITEMS[it.id].hp>0)heal+=ITEMS[it.id].hp*it.n;
  const mine=(ds.maxHp+Math.min(heal,ds.maxHp))/(1-Math.min(.8,ds.armRed||0));
  // in a building they come two or three at a time, and about a third of their blows land on someone who keeps moving;
  // in the open (an ambush on the road) they all come at once, up to as many as can get round one person, and more of their blows land
  // toxic air eats health for as long as the fight lasts, and what lives in it spits more of the same: without a mask the place is that much worse
  // the garrison's health is worked through with the best weapon until it gives out, then the next, then bare hands: a flint spear has about 900 points
  // of killing in it and a Hardware Store's garrison 1,200, so a place the spear cannot finish is rated for the fists that finish it (0.10.3)
  let left=hp,time=0;for(const a of arms){if(left<=0)break;if(a.v<=fist)continue;const use=Math.min(left,a.cap);time+=use/a.v;left-=use}if(left>0)time+=left/fist;const dps=hp/time;
  const open=def.open,air=1+(def.tox||0)*1.6*(1-(ds.tox||0));return hp/dps*(dmg/n*Math.min(open?AMBUSH.round:2.5,n)*(open?AMBUSH.land:.33))/mine*air;
}
/** Fights that events start on the road. Everything arrives awake and at once, so the same garrison is far deadlier than in a building:
 *  `round` is how many can get at one person together, `land` the share of their blows that connect, `want` the odds an ambush is pitched to
 *  (the top of two skulls) and `most` the odds above which it is thinned out (the top of three). Measured with tools/leadbot.mjs --ambush. */
export const AMBUSH={round:5,land:.55,want:.8,most:1};
/** What a road fight will actually be for this player as they stand: the creatures (thinned if even level 1 of them would be a massacre),
 *  their level (no higher than the country's, lowered until the fight is a fair one) and the threat in skulls, to show before they choose. */
export function ambushPlan(S,table,top){
  const t={};for(const k in table)if(ENEMIES[k])t[k]=table[k];const odds=L=>leadOdds(S,{en:t,open:1},L);
  let lvl=Math.max(1,top||1);while(lvl>1&&odds(lvl)>AMBUSH.want)lvl--;
  for(let g=0;g<40&&odds(lvl)>AMBUSH.most;g++){const k=Object.keys(t).filter(k=>ENEMIES[k].ai!=='flee').sort((a,b)=>t[b]-t[a])[0];if(!k||Object.values(t).reduce((a,b)=>a+b,0)<=1)break;if(--t[k]<=0)delete t[k]}
  const o=odds(lvl),sk=skullsFor(o);return{table:t,lvl,odds:o,skulls:sk,word:THREAT[sk],names:Object.keys(t).map(k=>t[k]+' '+ENEMIES[k].n+(t[k]>1?'s':'')).join(', ')};
}
/** The level road fights in a region would be at before they are pitched to the player. */
const ambushTop=(S,reg)=>Math.max(1,Math.round((LOCATIONS.filter(l=>l.reg===reg).reduce((a,l)=>Math.min(a,l.lvl),99)+S.p.lvl*.6)/1.6));
/** For an event's choice: the fight it leads to, if any, as it would be for this player ({names, skulls, word, sure}). */
export function optionFight(S,o){
  let worst=null,p=0;for(const r of o.r||[])for(const fx of r[2]||[])if(fx[0]==='fight'){const reg=G.pending&&G.pending.dest?destReg(S,G.pending.dest):regionHere(S),pl=ambushPlan(S,fx[1],fx[2]==='home'&&G.Z&&G.Z.home?G.Z.lvl:ambushTop(S,reg));p+=r[0];if(!worst||pl.odds>worst.odds)worst=pl}
  return worst?{...worst,sure:p>=.999}:null;
}
// Where the skulls fall, measured 2026-11-13 with a simulated player who clears the place in auto mode with three bandages (150 runs):
// under 0.75 it always lived, 0.75 to 1 four times in five, 1 to 1.5 three in five, 1.5 to 2.2 one in four, above that almost never.
const ODDS=[.4,.8,1.3,2.2],skullsFor=r=>r<ODDS[0]?1:r<ODDS[1]?2:r<ODDS[2]?3:r<ODDS[3]?4:5;
/** Everything a player is told about a lead before going: how hard (1 to 5 skulls, for them as they stand: weapon, armour, medicine), who holds it, what is in the strongroom, how long it lasts. */
export function leadInfo(S,site){
  const def=SITES[site.site];if(!def||!def.lead)return null;const gap=site.lvl-S.p.lvl,boss=def.boss?ENEMIES[def.boss]:null;
  let n=0;for(const t of[def.en,def.inn])for(const k in t||{})n+=t[k];
  const odds=leadOdds(S,def,site.lvl),skulls=skullsFor(odds);
  return{id:site.id,kind:site.site,name:def.n,lvl:site.lvl,gap,odds,skulls,word:THREAT[skulls],who:def.who,prize:def.prize,boss:boss?boss.n:null,raiders:!!def.raiders,count:n+(boss?1:0),left:Math.max(0,site.until-S.t),tox:def.tox||0,guard:derive(S).tox,again:!!site.again,radio:def.radio,d:def.d};
}
/** The level at which this kind of lead would be the wanted threat for this player: the highest level that is no harder than that (so the
 *  fight and the loot are as rich as the rating allows), or level 1 if even that is harder. */
function leadLevel(S,def,want){let best=1;for(let L=1;L<=S.p.lvl+8;L++){if(skullsFor(leadOdds(S,def,L))<=want)best=L;else break}return best}
/** Put a lead on the map, a couple of hours' travel from home. Its level is set so that its threat, for the player as they stand, falls in the
 *  lead's range (`tier`, in skulls); an explicit `offset` from the player's level overrides that. */
export function addLead(S,kind,offset,want){
  const def=SITES[kind];if(!def||!def.lead)return null;const site=addSite(S,kind,Math.max(1,maxRegion(S)-(rnd()<.5?1:0)));if(!site)return null;
  const[a,b]=def.tier||[2,3];site.lvl=offset!==undefined?Math.max(1,S.p.lvl+offset):leadLevel(S,def,Math.min(4,want||a+Math.floor(rnd()*(b-a+1))));   // never pitched at "deadly"
  // near enough to be an expedition and not a migration: one and a half to two and a half hours each way by whatever you travel in
  if(maxRegion(S)<=1||rnd()<.6){const h=LOC.home,v=VEHICLES[S.veh||0].spd*(1+perk('travel')),ang=rnd()*TAU,r=(1.5+rnd())*v;site.x=clamp(h.x+Math.cos(ang)*r,30,970);site.y=clamp(h.y+Math.sin(ang)*r,25,615);site.reg=1}
  // the same kind of place comes up again and again; it is never the one already emptied, and the sheet says so
  {const seen=S.lead.seen=S.lead.seen||{};if(seen[kind])site.again=1;seen[kind]=(seen[kind]||0)+1}
  S.lead.last=kind;S.lead.n++;stat('leads');return site;
}
/** Leads come over the truck's radio a couple of times a day, two on the map at most; a Radio Mast at home hears them more often and keeps three. */
function leadTick(S){
  if(S.net)return;   // in a shared world the leads are the world's: everyone hears the same ones (worldNews below)
  const L=S.lead;if(!L.next){L.next=S.t+(5+rnd()*4)*60;return}if(S.t<L.next)return;
  const mast=homeHas(S,'radio'),day=dayOf(S.t),active=S.sites.filter(s=>SITES[s.site]&&SITES[s.site].lead).length;
  L.next=S.t+(mast?6+rnd()*4:8+rnd()*6)*60;if(active>=(mast?3:2)||S.tide.live)return;
  const kinds=LEADS.filter(k=>(SITES[k].minDay||0)<=day&&k!==L.last&&!S.sites.some(s=>s.site===k));if(!kinds.length)return;
  // the first lead anyone hears is a gentle one: the grocery, below their own level
  // only places that can be made a fair fight for this player; if none can, the least bad one
  const fair=kinds.filter(k=>skullsFor(leadOdds(S,SITES[k],1))<=3),pool=fair.length?fair:[kinds.slice().sort((x,y)=>leadOdds(S,SITES[x],1)-leadOdds(S,SITES[y],1))[0]];
  const site=L.n===0?addLead(S,'lead_grocery',undefined,2):addLead(S,pool[Math.floor(rnd()*pool.length)]);if(!site)return;const I=leadInfo(S,site);
  L.note=site.id;sfx('radio');toast((mast?'Radio: ':'Truck radio: ')+(I.again?'another ':'')+I.name+' · '+I.word+' (threat '+I.skulls+' of 5)','info');
}
/** The radio note waiting to be read, shown as a sheet when the player is home and nothing else is going on. */
// ---------------------------------------------------------------- a shared world (the news arrives through js/net.js; nothing here talks to a network)
/** Take in the world's news: its stage and standings, and the radio leads everyone in it hears. A lead someone else has opened is struck off
 *  the map (unless the player is standing in it); a new one is put on the map, pitched to this player like any other lead. */
export function worldNews(S,W,you){
  if(!W)return;const was=S.world,me=you&&you.name;
  S.world={id:W.id,name:W.name,day:W.day,stage:W.stage,stageName:W.stageName,stageText:W.stageText,points:W.points,next:W.next,fx:W.fx||{},enclaves:W.enclaves||[],feed:W.feed||[],gone:W.gone||[],leads:(W.leads||[]).map(l=>({id:l.id,by:l.by||null})),you:you||null};
  if(was&&was.id===W.id&&W.stage>was.stage){toast('The world moves on: '+W.stageName,'bad');sfx('warning')}
  // the hold never changes without a word: a bot (and its developer) twice took a silent change for a fault
  if(was&&was.id===W.id&&was.you&&you&&was.you.hold!==undefined&&you.hold!==was.you.hold)toast('Your hold on '+W.name+': '+was.you.hold+' → '+you.hold+(you.hold<=25?'. At nothing the enclave falls':''),you.hold>was.you.hold?'good':'bad');
  const net=S.net||(S.net={});net.heard=net.heard||{};
  // leads heard before joining belong to no world: they are struck off, so the same place is never on the map twice (one being stood in, or holding a dropped pack, stays)
  S.sites=S.sites.filter(s=>!(SITES[s.site]&&SITES[s.site].lead&&!s.wid&&!(G.Z&&G.Z.site===s.id)&&!(s.bag&&s.bag.some(Boolean))));if(S.lead.note&&!S.sites.some(s=>s.id===S.lead.note))S.lead.note=null;
  for(const l of W.leads||[]){const site=S.sites.find(s=>s.wid===l.id);
    if(l.by&&l.by!==me){if(site&&!(G.Z&&G.Z.site===site.id)){S.sites=S.sites.filter(s=>s!==site);if(S.lead.note===site.id)S.lead.note=null;toast('Radio: '+l.by+' reached the '+SITES[l.kind].n+' first','bad');sfx('radio')}net.heard[l.id]=1;continue}
    if(site||l.by||net.heard[l.id]||!SITES[l.kind]||S.tide.live)continue;
    const st=addLead(S,l.kind,undefined,S.lead.n===0?2:undefined);if(!st)continue;net.heard[l.id]=1;st.wid=l.id;st.until=S.t+Math.max(120,l.until-W.t);
    // the same place for everyone: a bearing and a distance from the world, turned into a spot one and a half to two and a half hours from this home
    {const h=LOC.home,v=VEHICLES[S.veh||0].spd*(1+perk('travel')),r=(1.5+l.far)*v;st.x=clamp(h.x+Math.cos(l.ang)*r,30,970);st.y=clamp(h.y+Math.sin(l.ang)*r,25,615);st.reg=1}
    const I=leadInfo(S,st);S.lead.note=st.id;sfx('radio');toast('Radio, to everyone in '+W.name+': '+I.name+' · '+I.word+' (threat '+I.skulls+' of 5). First there takes it','info')}
}
/** The enclave has fallen and its people move to another valley: the character keeps what they wear, carry and know; the homestead, its
 *  stores, its people and the map of the old valley are gone. A new homestead is laid out and the tides start over. */
export function exile(S){
  S.seed=(S.seed*1103515245+12345)>>>0;S.home={obj:[],fl:[],ed:[],regrow:[],pile:{},report:null};S.loc={};S.sites=[];S.lead={next:0,note:null,last:'',n:0};
  S.surv=[];S.wait=[];S.morale=60;S.fac={};S.clog=[];S.trader=null;S.tide={n:0,at:0,kind:'shamble',dir:0,weak:0,warned:0,live:null};S.deeds={held:0,lost:0,deaths:0,leads:[]};S.world=null;if(S.net)S.net.heard={};
  S.p.bed=null;S.p.hp=Math.max(S.p.hp,derive(S).maxHp*.6);S.p.food=Math.max(S.p.food,50);S.p.water=Math.max(S.p.water,50);
  G.Z=null;G.pending=null;genHome(S);scheduleTide(S,true);S.nextEv=S.t+600;S.pos='home';goHome(false);emit('save');
}
export function leadNote(S){const L=S.lead;if(!L.note)return null;const site=S.sites.find(s=>s.id===L.note);if(!site){L.note=null;return null}return site}
export function leadRead(S){S.lead.note=null}

// ---------------------------------------------------------------- survivors
/** A homestead supports at most this many people besides you. The user's rule: "each base can support maximum 3 people". */
export const BASE_PEOPLE=3;
/** How many people can live at the homestead: one for every bed beyond your own, and one more sleeping by the fire (unhappily) until a bed is built; never more than BASE_PEOPLE. */
export const survRoom=S=>Math.min(BASE_PEOPLE,survCap(S)+1);
export function survCap(S){let beds=0;for(const o of S.home.obj)if(o&&OBJ[o.k].bed)beds+=OBJ[o.k].bed>=3?2:1;return Math.min(BASE_PEOPLE,Math.max(0,beds-1)+(homeHas(S,'beacon')?2:0)+perk('surv'))}
/** Add someone to the homestead. `who` ({n, trait}) is a person who was waiting to be recruited; without it a stranger is made up. */
export function addSurvivor(S,who){
  if(S.surv.length>=survRoom(S)){toast(S.surv.length>=BASE_PEOPLE?'A homestead can support '+BASE_PEOPLE+' people besides you, and yours has that many':'No room for another survivor: build a bed (Build, Base) for each new person','bad');return null}
  const used=new Set(S.surv.map(s=>s.n)),names=SURV_NAMES.filter(n=>!used.has(n)),traits=Object.keys(SURV_TRAITS);
  const sv={id:++S.survN,n:who?who.n:names[Math.floor(rnd()*names.length)]||'Stranger',trait:who?who.trait:traits[Math.floor(rnd()*traits.length)],job:'idle',days:0,xp:0,hurt:0};
  S.surv.push(sv);statMax('survMax',S.surv.length);sfx('quest');
  if(S.surv.length>survCap(S))toast(sv.n+' sleeps by the fire until you build a bed for them (Build, Base): morale suffers until then','info');
  toast(sv.n+' is resting. Give them a job in the Camp ledger (L, People): forager, hunter, scavenger, mechanic and more','good');
  if(G.Z&&G.Z.home){const[x,y]=freeNear(G.Z,G.Z.w/2,G.Z.h/2,5);const a=spawnActor(G.Z,'captive',x,y,1);a.stay=true;a.sv=sv.id}
  return sv;
}
// someone you free does not move in by themselves: they wait at your fence and you decide (Camp ledger, People)
G.hooks.rescue=()=>{Community.candidate(G.S,'was freed by you');addXp(G.S,120)};
export function setJob(S,id,job){
  const sv=S.surv.find(s=>s.id===id),J=JOBS[job];if(!sv||!J)return false;
  if(J.needs&&!hasBuilt(S,o=>o.id===J.needs||o.special===J.needs||o.station===J.needs)){toast('Build '+(OBJ[J.needs]?OBJ[J.needs].n.toLowerCase():'the station')+' first','bad');return false}
  sv.job=job;sfx('ui_tap');return true;
}
function pile(S,id,n){S.home.pile[id]=(S.home.pile[id]||0)+n}
export function collectPile(S){let any=false;for(const id in S.home.pile){const n=S.home.pile[id],left=addTo(S.p.inv,slotCount(S),id,n);if(n-left>0){emit('loot',id,n-left);any=true}if(left>0)S.home.pile[id]=left;else delete S.home.pile[id]}if(any)sfx('pickup');return any}
function feedOne(S,key){ // key: 'food' | 'water'
  let best=null;for(const b of homeStores(S))b.inv.forEach((s,i)=>{if(!s)return;const it=ITEMS[s.id];if(it.t!=='food'||it.risk||(it[key]||0)<8||it.buff)return;if(!best||it.v<ITEMS[best.b.inv[best.i].id].v)best={b,i}});
  if(!best)return false;const s=best.b.inv[best.i];s.n--;if(s.n<=0)best.b.inv[best.i]=null;return true;
}
function dawn(S){
  const day=dayOf(S.t);statMax('days',day);
  // people
  if(S.surv.length){
    const mult=.5+S.morale/100*.75,cooks=S.surv.filter(s=>s.job==='cook').length;let hungry=0,fed=0;
    for(const sv of S.surv){sv.days++;const meals=(sv.trait==='glutton'?2:1);for(let m=0;m<meals;m++){if(cooks&&rnd()<.25*cooks){fed++;continue}if(feedOne(S,'food'))fed++;else hungry++}if(!feedOne(S,'water'))hungry++}
    for(let c=0;c<cooks*JOBS.cook.cook;c++){for(const[raw,done]of[['raw_meat','cooked_meat'],['raw_fish','cooked_fish'],['potato','baked_potato'],['dirty_water','water']]){let ok=false;for(const b of homeStores(S)){if(removeFrom(b.inv,raw,1)===0){ok=true;break}}if(ok){pile(S,done,1);break}}}
    for(const sv of S.surv){const J=JOBS[sv.job]||JOBS.idle,tm=t=>sv.trait===t?1.5:1;
      if(sv.hurt>0||sv.away||Community.routeOf(S,sv.id)){if(sv.trait==='cheer')S.morale+=2;continue}
      if(sv.job!=='idle')sv.xp=(sv.xp||0)+1;
      if(J.out){const k=(sv.job==='medic'?tm('nurse')*1.3:1)*Community.svMult(sv);for(const[id,a,b]of J.out){const n=Math.round((a+rnd()*(b-a))*mult*k*(sv.job==='forage'||sv.job==='hunt'||sv.job==='scav'?.6+rnd()*.8:1));if(n>0&&rnd()<.85)pile(S,id,n)}
        if(J.rare&&rnd()<(sv.trait==='lucky'?.8:.45)){const[id,a,b]=J.rare[Math.floor(rnd()*J.rare.length)];pile(S,id,Math.round(a+rnd()*(b-a)))}}
      if(J.repair){let f=J.repair*(sv.trait==='tinker'?2:1)*mult;for(const o of[...S.home.obj,...(S.home.ed||[])])if(o&&o.hp>0&&OBJ[o.k].cost){const mh=maxHp(o.k);if(o.hp<mh)o.hp=Math.min(mh,o.hp+mh*f)}}
      if(sv.trait==='cheer')S.morale+=2;if(J.morale)S.morale+=J.morale}
    let comfort=0;for(const o of S.home.obj)if(o&&OBJ[o.k].comfort)comfort+=OBJ[o.k].comfort;
    S.morale+=Math.min(8,comfort*.5)-hungry*5+(hungry?0:1)+(60-S.morale)*.05-(S.surv.length>survCap(S)?4:0);S.morale=clamp(Math.round(S.morale),0,100);
    if(hungry)toast(hungry>1?'Your people went hungry or thirsty last night':'Someone went without last night','bad');
    if(S.morale<15&&rnd()<.35){const sv=S.surv.splice(Math.floor(rnd()*S.surv.length),1)[0];toast(sv.n+' has had enough and leaves','bad')}
    if(Object.keys(S.home.pile).length)toast('Your people brought things in. Collect them from the camp ledger.','info');
    if(G.Z&&G.Z.home)emit('zoneDirty');
  }
  // beacon draws wanderers
  if(homeHas(S,'beacon')&&S.surv.length+S.wait.length<survCap(S)&&rnd()<.16)Community.candidate(S,'saw your signal fire and walked in');
  Community.dawn(S);
  if(homeHas(S,'kennel')&&!S.flags.dog&&(S.flags.dog_met||rnd()<.3)){S.flags.dog=1;toast('A dog has moved into the kennel','good')}
  fillContracts(S);
  if(homeHas(S,'trade')&&day%2===0&&(!S.trader||S.trader.until<S.t)){openTrader(S,true);toast('A caravan is waiting at your trading post','info')}
  S.nextEv=S.t+120+rnd()*600;
  emit('save');
}

// ---------------------------------------------------------------- the clock
const HUNGER=100/(1440*1.5),THIRST=100/(1440*1.0);
/** Move the clock forward. mode: 'live' (per frame), 'travel', 'sleep', 'wait'. */
export function advance(S,m,mode='live'){
  if(m<=0)return;const p=S.p,ds=G.ds||derive(S),t0=S.t,Z=G.Z,W=weather(S),live=mode==='live',f=live?1:mode==='travel'?.6:mode==='sleep'?.3:.6;
  S.t+=m;
  const reg=live?regionHere(S):1;
  p.food=Math.max(0,p.food-m*HUNGER*f*(1+(ds.pk.hunger||0)));
  p.water=Math.max(0,p.water-m*THIRST*f*(1+(ds.pk.thirst||0))*(live?(W.thirst||1)*(Z&&Z.heat?1.35:1):1));
  let loss=0;if(p.food<=0)loss+=m*.14;if(p.water<=0)loss+=m*.2;
  if(live&&Z){
    const tox=(Z.tox||0)+(W.tox&&reg===5?.4:0);if(tox>0)p.tox=Math.min(100,p.tox+m*.5*tox*(1-ds.tox));else p.tox=Math.max(0,p.tox-m*.03);
    const cold=(Z.cold||0)*(W.cold||1);if(cold>0)loss+=m*.22*cold*(1-ds.cold);
  }else p.tox=Math.max(0,p.tox-m*.03);
  if(p.tox>=50)loss+=m*(p.tox-50)/50*.25;
  if(loss>0){p.hp-=loss;if(!live)p.hp=Math.max(5,p.hp);else if(p.hp<=0&&Z&&Z.pl&&!Z.pl.dead){p.hp=0;Z.pl.dead=true;sfx('death');G.hooks.die()}}
  // home keeps working whether you are there or not
  S._acc=(S._acc||0)+m;if(S._acc>=1||!live){processHome(S,S._acc);S._acc=0}
  if(S.t>=S.weather.until)rollWeather(S);
  // map sites come and go
  if(S.sites.length&&S.sites.some(s=>s.until<S.t))S.sites=S.sites.filter(s=>s.until>=S.t||(Z&&Z.site===s.id));
  S._site=(S._site||0)+m;if(S._site>=240){S._site=0;const day=dayOf(S.t),cap=homeHas(S,'radio')?4:2;if(S.sites.length<cap&&rnd()<.45){const kinds=Object.keys(SITES).filter(k=>!SITES[k].manual&&!SITES[k].lead&&(SITES[k].minDay||0)<=day&&!S.sites.some(s=>s.site===k));const k=kinds[Math.floor(rnd()*kinds.length)];if(k&&addSite(S,k)&&homeHas(S,'radio'))toast('Radio: '+SITES[k].n+' reported','info')}}
  leadTick(S);
  for(let d=dayOf(t0)+1;d<=dayOf(S.t);d++)dawn(S);
  Community.tick(S);
  // the tide
  const T=S.tide,lead=(12+(homeHas(S,'tower')?6:0))*60;
  if(!T.warned&&S.t>=T.at-lead&&!T.live){T.warned=1;emit('ui','tideWarn');sfx('warning')}
  if(S.t>=T.at&&!T.live){if(live&&Z&&Z.home)startTide(S,Z);else if(!(live&&Z&&Z.home))resolveAway(S)}
  if(S.trader&&S.trader.until<S.t)S.trader=null;
}
function rollWeather(S){
  const reg=G.Z?G.Z.reg||1:1,mod=WEATHER_BY_REG[reg]||{};let tot=0;const rows=[];
  for(const id in WEATHER){const w=mod[id]!==undefined?mod[id]:WEATHER[id].w;if(w>0){rows.push([id,w]);tot+=w}}
  let x=rnd()*tot,id='clear';for(const r of rows){x-=r[1];if(x<=0){id=r[0];break}}
  S.weather={id,until:S.t+240+rnd()*360};if(id==='storm'&&G.Z)sfx('thunder');
}
function runJobs(S,o,i,m,atHome){
  let left=m;while(left>0&&o.q.length){const job=o.q[0],r=RECIPES[job.id];const use=Math.min(left,job.left);job.left-=use;left-=use;
    if(job.left<=0){produce(S,r,o);job.n--;if(job.n>0)job.left=r.t;else o.q.shift();if(atHome){emit('obj',i);if(!o.q.length)emit('jobDone',i)}}}
}
/** Keep one station working while its sheet is open and the rest of the world is paused. */
export function benchTick(i,dt){const S=G.S,Z=G.Z,o=Z&&Z.obj[i];if(o&&o.q&&o.q.length)runJobs(S,o,i,dt*MIN_PER_SEC,true)}
function processHome(S,m){
  const H=S.home,obj=H.obj,Wd=weather(S),atHome=G.Z&&G.Z.home,farmers=S.surv.filter(s=>s.job==='farm').reduce((a,s)=>a+(s.trait==='green'?1.5:1),0);
  let scare=null;
  for(let i=0;i<obj.length;i++){const o=obj[i];if(!o)continue;const d=OBJ[o.k];if(!d)continue;
    if(o.q&&o.q.length)runJobs(S,o,i,m,atHome);
    if(d.special==='garden'&&o.seed){
      if(scare===null){scare=[];obj.forEach((s,j)=>{if(s&&OBJ[s.k]&&OBJ[s.k].special==='scarecrow')scare.push(j)})}
      let mult=(Wd.crop||1)+farmers*.3;if(scare.some(j=>Math.abs(j%HOME_W-i%HOME_W)<=3&&Math.abs(Math.floor(j/HOME_W)-Math.floor(i/HOME_W))<=3))mult+=.25;
      if(mult!==1)o.ripe-=m*(mult-1);
      if(S.t>=o.ripe){if(!o.rdy){o.rdy=1;if(atHome)emit('obj',i)}
        if(farmers>0){const seed=ITEMS[o.seed],n=Math.round((seed.yield[0]+Math.floor(rnd()*(seed.yield[1]-seed.yield[0]+1)))*(o.fert?1.5:1));pile(S,seed.crop,n);stat('harvest',n);o.ripe=S.t+seed.grow;o.rdy=0;o.wet=0;o.fert=0;if(atHome)emit('obj',i)}}
      else if(o.rdy){o.rdy=0}
      const half=o.ripe-S.t<(ITEMS[o.seed].grow*.5);if(half&&!o.half){o.half=1;if(atHome)emit('obj',i)}else if(!half&&o.half){o.half=0}
    }
    if(d.prod){const pr=d.prod,rate=m/pr.every*(pr.rain&&Wd.rain?pr.rain:1),before=Math.floor(o.stock||0);o.stock=Math.min(pr.cap,(o.stock||0)+rate);
      if(Math.floor(o.stock)>before){if(pr.extra&&rnd()<pr.extra[1])o.extra=Math.min(pr.cap,(o.extra||0)+1);if(atHome)emit('obj',i)}}
    if(d.special==='generator'&&o.fuel>0){o.fuel=Math.max(0,o.fuel-m/150);if(o.fuel<=0&&atHome){toast('The generator is out of fuel','bad');G.Z.navDirty=true}}
  }
  if(H.regrow.length){for(let k=H.regrow.length-1;k>=0;k--){const r=H.regrow[k];if(r.at>S.t)continue;if(!obj[r.i]&&!H.fl[r.i]){
      if(atHome){let busy=false;for(const a of G.Z.actors)if(Math.floor(a.x)===r.i%HOME_W&&Math.floor(a.y)===Math.floor(r.i/HOME_W))busy=true;if(busy)continue}
      obj[r.i]={k:r.k,r:Math.floor(rnd()*4),v:Math.floor(rnd()*3),n:OBJ[r.k].node.hits};if(atHome)G.Z.touch(r.i)}
    H.regrow.splice(k,1)}}
}

// ---------------------------------------------------------------- tides
export const TIDE_DIFF={gentle:.65,standard:1,brutal:1.5};
export const tideBudget=(S,n)=>(2+2.6*n+.3*n*n)*(1-S.tide.weak)*(1+.5*S.mut)*(TIDE_DIFF[S.set.tides]||1)*(S.world&&S.world.fx&&S.world.fx.tide||1);   // a shared world's stage makes tides heavier for everyone in it
export const tideLevel=(S,n)=>1+Math.round(1.1*(n-1))+S.mut*10;
function scheduleTide(S,first){
  const T=S.tide,n=T.n+1,day=dayOf(S.t)-1;T.at=(day+(first?2:3))*1440+21*60;if(T.at-S.t<26*60)T.at+=1440;
  const kinds=TIDE_KINDS.filter(k=>(k.min||0)<=n);T.kind=n===1?'shamble':kinds[Math.floor(rnd()*kinds.length)].id;T.dir=Math.floor(rnd()*4);T.weak=0;T.warned=0;T.live=null;
}
function tideQueue(S){
  const T=S.tide,n=T.n+1,kind=TIDE_KINDS.find(k=>k.id===T.kind)||TIDE_KINDS[0];let budget=tideBudget(S,n);const q=[],rows=Object.entries(kind.mix).filter(([k])=>!ENEMIES[k].tide||ENEMIES[k].tide[1]<=n||kind.id!=='shamble');
  let lvl=tideLevel(S,n);
  // very large tides become stronger rather than more numerous
  const maxUnits=70;let est=budget/1.6;if(est>maxUnits){lvl+=Math.round((est/maxUnits-1)*8);budget*=maxUnits/est}
  let guard=0;while(budget>0&&guard++<400){let tot=0;for(const r of rows)tot+=r[1];let x=rnd()*tot,k=rows[0][0];for(const r of rows){x-=r[1];if(x<=0){k=r[0];break}}const c=TIDE_COST[k]||1;if(c>budget+1&&q.length>3){if(guard>200)break;continue}budget-=c;q.push(k)}
  const waves=n<3?2:n<8?3:4,out=q.map((k,i)=>({k,t:Math.floor(i/q.length*waves)*28+rnd()*8,side:n>=6&&rnd()<.3?(T.dir+1+Math.floor(rnd()*3))%4:T.dir}));
  if(n%5===0)out.push({k:'juggernaut',t:(waves-1)*28+10,side:T.dir,boss:true});
  out.sort((a,b)=>a.t-b.t);return{q:out,lvl};
}
function startTide(S,Z){
  const{q,lvl}=tideQueue(S);S.tide.live={q,lvl,t:0,total:q.length,killed:0};Z.tideLost=0;Z.lvl=lvl;
  // allies keep their word: two fighters from every community you have a pact with
  for(const[id,n]of Community.allies(S)){for(let i=0;i<n;i++){const[x,y]=freeNear(Z,Z.w/2+(rnd()-.5)*6,Z.h/2+(rnd()-.5)*6,4);spawnActor(Z,'guard',x,y,lvl,{from:id})}toast(FACTIONS[id].n+' sends two fighters to stand with you','good')}
  for(const a of Z.actors)if(a.team===1&&!a.dead)a.tide=true;
  emit('ui','tideStart');sfx('horde_horn');if(G.auto&&Z.pl){Z.pl.auto=null;toast('Auto: holding the homestead','bad')}   // auto mode stays on and defends
}
function tickTide(S,Z,dt){
  // animals that only run away never count as attackers: a herd that wandered in must not keep a tide from ending
  const L=S.tide.live;L.t+=dt;let alive=0;for(const a of Z.actors)if(a.team===1&&!a.dead&&a.tide&&a.def.ai!=='flee'){alive++;
    // an attacker that lost sight of you behind your own walls does not wander off and leave the tide hanging: it keeps coming
    if(!a.alert||a.st==='idle'){a.alert=true;a.st='chase'}}
  const flow=Z.pl&&!Z.pl.dead?playerField(Z):null,can=(x,y)=>!flow||flow[Math.floor(y)*Z.w+Math.floor(x)]<1e9,spot=side=>{let p;for(let k=0;k<12;k++){p=edgePoint(Z,k<8?side:Math.floor(rnd()*4),13);if(can(p[0],p[1]))break}return p};
  L.fix=(L.fix||0)+dt;if(L.fix>3&&flow){L.fix=0;for(const a of Z.actors)if(a.team===1&&!a.dead&&a.tide&&!can(a.x,a.y)){a.boxed=(a.boxed||0)+1;if(a.boxed>=2){const p=spot(Math.floor(rnd()*4));a.x=p[0];a.y=p[1];a.boxed=0}}}
  while(L.q.length&&L.q[0].t<=L.t&&alive<46){const s=L.q.shift(),[x,y]=spot(s.side);const a=spawnActor(Z,s.k,x,y,L.lvl,{alert:true,st:'chase',tide:true});if(a&&s.boss){a.boss=true;sfx('roar',x,y)}alive++}
  L.alive=alive;L.left=L.q.length+alive;
  if(!L.q.length&&alive===0)endTide(S,Z,true);
}
function endTide(S,Z,won){
  const n=S.tide.n+1,kind=TIDE_KINDS.find(k=>k.id===S.tide.kind)||TIDE_KINDS[0];S.tide.n=n;S.tide.live=null;stat('tides');S.deeds[won?'held':'lost']++;
  if(G.Z&&G.Z.home)for(let i=G.Z.actors.length-1;i>=0;i--)if(G.Z.actors[i].from)G.Z.actors.splice(i,1);   // allied fighters go home
  const res={n,name:kind.n,won,lost:Z?Z.tideLost||0:0,xp:0,scrip:0,items:[]};
  if(won){res.xp=60+45*n;res.scrip=12+8*n;addXp(S,res.xp);S.scrip+=res.scrip;stat('earned',res.scrip);
    const loot=rollLoot('stash',maxRegion(S),rnd,1);if(n%5===0)loot.push(...rollLoot('mil',Math.max(2,maxRegion(S)),rnd));for(const it of loot){give(S,it.id,it.n,it.d,true);res.items.push(it)}
    sfx('quest')}
  if(Z){Z.tideLost=undefined;Z.lvl=1+Math.floor(S.tide.n*1.2)}
  scheduleTide(S);emit('ui','tideEnd',res);emit('save');
}
function defenceScore(S){
  let d=0;const n=S.tide.n;for(const w of S.home.ed||[])if(w&&OBJ[w.k])d+=w.hp/50;
  for(const o of S.home.obj){if(!o)continue;const k=OBJ[o.k];if(!k||!k.cost)continue;
    if(k.wall||k.door||(k.low&&k.cat==='defense'))d+=o.hp/50;else if(k.trap)d+=Math.max(0,(k.trap.dmg+(k.trap.slow?30:0))*(k.trap.uses-(o.uses||0))/90);
    else if(k.turret){const t=k.turret,shots=t.power?200:Math.floor((o.ammo||0)/(t.per||1));d+=Math.min(shots,150)*t.dmg/90}}
  d+=S.surv.filter(s=>s.job==='guard').length*(30+n*6);return d*(1+perk('turret')*.5);
}
/** A tide arrived while you were away: work out what it did without simulating it. */
function resolveAway(S){
  const n=S.tide.n+1,kind=TIDE_KINDS.find(k=>k.id===S.tide.kind)||TIDE_KINDS[0],strength=tideBudget(S,n)*(1+.15*tideLevel(S,n))*2,def=defenceScore(S),ratio=strength/(def+8);
  const lost=raidBase(S,clamp(ratio*.3,.04,.85),true);let stolen=0;
  if(ratio>1.3)for(const b of homeStores(S))for(let i=0;i<b.inv.length;i++)if(b.inv[i]&&rnd()<Math.min(.4,(ratio-1.3)*.25)){stolen++;b.inv[i]=null}
  for(const o of S.home.obj){if(!o)continue;const k=OBJ[o.k];if(k&&k.trap)o.uses=Math.min(k.trap.uses-1,(o.uses||0)+Math.ceil(k.trap.uses*Math.min(.8,ratio*.4)));if(k&&k.turret&&o.ammo)o.ammo=Math.floor(o.ammo*Math.max(.2,1-ratio*.5))}
  S.tide.n=n;stat('tides');S.deeds[ratio<1?'held':'lost']++;if(ratio<1)addXp(S,Math.round((60+45*n)*.5));
  S.home.report={n,name:kind.n,held:ratio<1,lost,stolen};scheduleTide(S);if(G.mode==='map'||G.Z)toast('A tide hit the homestead while you were away','bad');
}
/** Damage a share of the base's walls. Returns how many structures were destroyed (or damaged when not `count`). */
function raidBase(S,frac,destroyCount){
  let n=0;const obj=S.home.obj,atHome=G.Z&&G.Z.home;
  for(let i=0;i<obj.length;i++){const o=obj[i];if(!o||!(o.hp>0))continue;const k=OBJ[o.k];if(!k.cost||!(k.wall||k.door||k.low||k.trap||rnd()<.25))continue;if(rnd()>Math.min(1,frac*2.2))continue;
    o.hp-=maxHp(o.k)*frac*(.5+rnd()*1.2);if(o.hp<=0){if(o.inv&&o.inv.some(Boolean)){o.hp=1}else{obj[i]=null;n++;if(atHome)G.Z.touch(i);continue}}if(!destroyCount)n++;if(atHome)emit('obj',i)}
  const ed=S.home.ed||[];for(let e=0;e<ed.length;e++){const w=ed[e];if(!w||rnd()>Math.min(1,frac*2.2))continue;w.hp-=maxHp(w.k)*frac*(.5+rnd()*1.2);if(w.hp<=0){ed[e]=null;n++;if(atHome)G.Z.touchEdge(e)}else{if(!destroyCount)n++;if(atHome)emit('edge',e)}}
  return n;
}

// ---------------------------------------------------------------- live frame
let secAcc=0,wanderT=30;
export function tick(dt){
  const S=G.S,Z=G.Z;if(!S||!Z)return;
  G.night=isNight(S.t);G.sight=weather(S).sight||1;G.now+=dt;
  step(dt);
  const p=S.p,ds=G.ds,pl=Z.pl;
  if(!pl.dead){
    for(let i=p.buffs.length-1;i>=0;i--){p.buffs[i].t-=dt;if(p.buffs[i].t<=0)p.buffs.splice(i,1)}
    // fed and watered, health trickles back; well fed (both bars above 70), three times as fast
    pl.fed=p.food>70&&p.water>70;
    let regen=ds.regenBuff+(p.food>25&&p.water>25?ds.regen+(pl.fed?.36:.12):0);
    // Catching your breath: stand still for a few seconds with nothing hunting you and health comes back quickly, up to three fifths of full.
    // It costs a little food and water. Without it a hurt player has nothing to do but stand about for minutes.
    {let hunted=false;for(const a of Z.actors)if(a.team===1&&!a.dead&&a.alert&&a.def.ai!=='flee'&&dist(a.x,a.y,pl.x,pl.y)<12){hunted=true;break}
      pl.restT=pl.mv<.1&&!pl.atk&&!pl.act&&!pl.roll&&!(pl.hurtT>0)&&!hunted?(pl.restT||0)+dt:0;
      pl.rest=pl.restT>4&&p.hp<ds.maxHp*.6&&p.food>15&&p.water>15;pl.rested=pl.restT>4&&!pl.rest&&p.hp<ds.maxHp*.95;
      if(pl.rest){regen+=1.5;p.food-=.035*dt;p.water-=.045*dt;if(!S.flags.restTip){S.flags.restTip=1;toast('Standing still out of danger, you catch your breath: health comes back fast, up to three fifths','info')}}}
    if(regen>0&&p.hp<ds.maxHp)p.hp=Math.min(ds.maxHp,p.hp+regen*dt);if(p.hp>ds.maxHp)p.hp=ds.maxHp;
    advance(S,dt*MIN_PER_SEC,'live');
  }
  if(S.tide.live&&Z.home)tickTide(S,Z,dt);
  secAcc+=dt;if(secAcc<1)return;secAcc=0;
  // once a second
  if(!Z.nightUp&&(G.night||Z.dark)){Z.nightUp=true;populate(Z,true)}if(Z.nightUp&&!G.night&&!Z.dark)Z.nightUp=false;
  if(!Z.cleared&&Z.hadEnemies&&!Z.home&&enemiesAlive(Z)===0&&Z.spawns.every(s=>s.done||s.night)){Z.cleared=true;addXp(S,40+Z.lvl*12);toast(Z.name+' is clear','good');sfx('quest');noteClear(Z.id);stat('cleared');
    if(Z.def&&Z.def.endless){S.depth++;statMax('depth',S.depth);toast('Depth '+S.depth+' reached','good')}
    if(Z.def&&Z.def.fx){const fx=[];for(const k in Z.def.fx)fx.push([k,Z.def.fx[k]]);applyFx(fx,true)}
    if(Z.site){const st=S.sites.find(x=>x.id===Z.site);if(st&&st.fac){Community.campCleared(S,st.fac);st.fac=null}}}
  if(Z.site&&SITES[Z.siteKind]&&SITES[Z.siteKind].wave){const w=SITES[Z.siteKind].wave;Z.waveT=(Z.waveT||w.every)-1;if(Z.waveT<=0&&(Z.waves||0)<3){Z.waveT=w.every;Z.waves=(Z.waves||0)+1;for(let i=0;i<w.n;i++){const[x,y]=edgePoint(Z,Math.floor(rnd()*4),12);spawnActor(Z,w.kind,x,y,Z.lvl,{alert:true,st:'chase'})}toast('More of them, drawn by the flare','bad');sfx('warning')}}
  if(Z.home&&!S.tide.live){wanderT-=1;if(wanderT<=0){wanderT=35+rnd()*45;let hostile=0,calm=0;for(const a of Z.actors){if(a.dead||a.team!==1)continue;if(a.def.ai==='flee')calm++;else hostile++}
      const side=Math.floor(rnd()*4),[x,y]=edgePoint(Z,side,16);
      if(G.night&&hostile<4&&dayOf(S.t)>1){const k=S.tide.n>=2&&rnd()<.3?'runner':S.tide.n>=4&&rnd()<.15?'crawler':'shambler',n=1+Math.floor(rnd()*Math.min(3,1+S.tide.n/2));for(let i=0;i<n;i++){const a=spawnActor(Z,k,x+rnd(),y+rnd(),Z.lvl);a.hx=Z.w/2+(rnd()-.5)*14;a.hy=Z.h/2+(rnd()-.5)*14;a.wx=a.hx;a.wy=a.hy;a.t=20}}
      else if(!G.night&&calm<3){const a=spawnActor(Z,rnd()<.6?'rabbit':'deer',x,y,1);a.hx=Z.w/2+(rnd()-.5)*24;a.hy=Z.h/2+(rnd()-.5)*24}}
    // a radio note is read when the player has stood still for a couple of seconds (never in the middle of doing something), or after half a minute regardless
    if(S.lead.note&&!G.busy&&!G.build&&enemiesAlive(Z)===0&&!pl.dead&&!S.tide.live){Z.noteWait=(Z.noteWait||0)+1;Z.noteIdle=pl.mv<.1&&!pl.act&&!pl.atk?(Z.noteIdle||0)+1:0;
      if(Z.noteIdle>=2||Z.noteWait>=30){const st=leadNote(S);Z.noteWait=Z.noteIdle=0;if(st)emit('ui','lead',st.id)}}
    if(S.t>=S.nextEv&&!G.busy&&enemiesAlive(Z)===0&&!pl.dead&&S.tide.at-S.t>150){S.nextEv=Infinity;const ev=pickEvent(S,'home',1);if(ev&&rnd()<.75)emit('ui','event',ev.id)}}
  checkStory(S);checkAch(S);statMax('mutation',S.mut);
  S._save=(S._save||0)+1;if(S._save>=45&&Z.home&&!S.tide.live){S._save=0;emit('save')}
}

// ---------------------------------------------------------------- sleep, death
export function canSleep(S){
  const Z=G.Z;if(!Z||!Z.home)return'Only at home';if(S.tide.live)return'Not during a tide';
  for(const a of Z.actors)if(a.team===1&&!a.dead&&a.def.ai!=='flee'&&dist(a.x,a.y,Z.pl.x,Z.pl.y)<16)return'Hostiles nearby';
  const h=hourOf(S.t);if(h>=6.5&&h<19)return'Too early to sleep. Come back after dusk';
  const wake=wakeTime(S);if(S.tide.at<wake)return'You can hear them gathering. No sleep tonight';
  return null;
}
const wakeTime=S=>{const h=hourOf(S.t),day=Math.floor(S.t/1440);return(h>=12?day+1:day)*1440+6*60};
export function sleep(i){
  const S=G.S,why=canSleep(S);if(why){toast(why,'bad');sfx('error');return false}
  const o=G.Z.obj[i],tier=o?OBJ[o.k].bed||1:1,m=wakeTime(S)-S.t;S.p.bed=i;
  advance(S,m,'sleep');const ds=G.ds,medic=S.surv.some(s=>s.job==='medic');
  S.p.hp=Math.min(ds.maxHp,S.p.hp+ds.maxHp*([0,.35,.6,1][tier]+(medic?.25:0)));S.p.tox=Math.max(0,S.p.tox-25);S.p.buffs=[];
  sfx('sleep');emit('ui','wake',dayOf(S.t));emit('save');return true;
}
G.hooks.die=()=>{const S=G.S;stat('deaths');S.deeds.deaths++;G.auto=false;emit('ui','death',{where:G.Z?G.Z.name:'',day:dayOf(S.t)})};
/** After the death screen: lose the pack where you fell, wake at home next morning. */
export function respawn(){
  const S=G.S,Z=G.Z,items=S.p.inv.filter(Boolean),day=Math.floor(S.t/1440),wake=(hourOf(S.t)>=6?day+1:day)*1440+7*60;
  if(Z){
    if(Z.home){if(S.tide.live){raidBase(S,.3,true);endTide(S,Z,false)}if(items.length){const[x,y]=freeNear(Z,Z.pl.x,Z.pl.y,3),i=Math.floor(y)*Z.w+Math.floor(x);if(!Z.obj[i])Z.obj[i]={k:'deathbag',r:0,v:0,inv:items}}}
    else if(LOC[Z.id]){const m=S.loc[Z.id]=S.loc[Z.id]||{n:1};m.bag=items;m.cool=0}
    else if(Z.site){const st=S.sites.find(s=>s.id===Z.site);if(st){st.bag=(st.bag||[]).concat(items);st.until=Math.max(st.until,wake+18*60)}}
    // brought down on the road: the spot goes on the map, halfway to where they were going, and the pack waits there two days
    else if(items.length){const h=LOC.home,to=G.pending&&G.pending.dest?posXY(S,G.pending.dest):[h.x+40,h.y+20],old=S.sites.find(s=>s.site==='fell');
      if(old){old.bag=(old.bag||[]).concat(items);old.until=wake+48*60}else S.sites.push({id:1000+(++S.siteN),site:'fell',x:clamp((h.x+to[0])/2,30,970),y:clamp((h.y+to[1])/2,25,615),until:wake+48*60,reg:1,lvl:1,bag:items})}   // you wake the next morning: it has to last past that
  }
  S.p.inv=[];compact(S);
  G.Z=null;G.pending=null;
  S.p.hp=1;advance(S,Math.max(0,wake-S.t),'sleep');G.ds=derive(S);S.p.hp=Math.round(G.ds.maxHp*.5);S.p.food=Math.max(S.p.food,35);S.p.water=Math.max(S.p.water,35);S.p.tox=Math.min(S.p.tox,30);S.p.buffs=[];
  goHome(false);emit('save');
}

// ---------------------------------------------------------------- trading & utility stations
export function openTrader(S,fresh){
  if(S.trader&&S.trader.until>S.t&&!fresh)return S.trader;
  const tier=maxRegion(S),rows=TRADE.filter(r=>tier>=r[4]&&tier<=r[5]),stock=[],n=8+Math.floor(rnd()*4)+(homeHas(S,'trade')?4:0),hag=1-perk('haggle');
  for(let k=0;k<n&&rows.length;k++){let tot=0;for(const r of rows)tot+=r[1];let x=rnd()*tot,r=rows[0];for(const q of rows){x-=q[1];if(x<=0){r=q;break}}rows.splice(rows.indexOf(r),1);stock.push({id:r[0],n:r[2]+Math.floor(rnd()*(r[3]-r[2]+1)),p:Math.max(1,Math.ceil(ITEMS[r[0]].v*2.2*hag))})}
  const bps=[];for(let t=1;t<=tier;t++)for(const id of TRADE_BP[t])if(!ITEMS[id].learn.every(r=>S.p.known[r]))bps.push(id);
  for(let k=0;k<2&&bps.length;k++){const id=bps.splice(Math.floor(rnd()*bps.length),1)[0];stock.push({id,n:1,p:Math.ceil(ITEMS[id].v*1.6*hag)})}
  S.trader={until:S.t+14*60,stock};return S.trader;
}
export const sellPrice=id=>Math.max(ITEMS[id].v>0?1:0,Math.floor(ITEMS[id].v*.5*(1+perk('haggle')*1.6)));
export function buy(S,si,n=1){
  const T=S.trader,s=T&&T.stock[si];if(!s||s.n<n)return false;const cost=s.p*n;if(S.scrip<cost){toast('Not enough scrip','bad');sfx('error');return false}
  S.scrip-=cost;s.n-=n;give(S,s.id,n);if(s.n<=0)T.stock.splice(si,1);sfx('coin');return true;
}
export function sell(S,i,n){
  const s=S.p.inv[i];if(!s)return false;const it=ITEMS[s.id];if(it.t==='key'||!it.v){toast('Nobody wants that','info');return false}
  n=Math.min(n||s.n,s.n);const pay=Math.max(1,Math.round(sellPrice(s.id)*n*(s.d!==undefined?.4+.6*s.d/it.dur:1)));S.scrip+=pay;stat('earned',pay);s.n-=n;if(s.n<=0)S.p.inv[i]=null;sfx('coin');return true;
}
export function useFlare(S,i){
  if(!G.Z||!G.Z.home){toast('Fire it at home','info');return false}const s=S.p.inv[i];if(!s||s.id!=='flare')return false;s.n--;if(s.n<=0)S.p.inv[i]=null;
  openTrader(S,true);toast('A caravan answers the flare','good');sfx('travel');emit('ui','trade');return true;
}
export function loadTurret(S,i){
  const o=G.Z.obj[i];if(!o)return false;const t=OBJ[o.k].turret;if(!t||!t.ammo)return false;const room=t.cap-(o.ammo||0),have=count(S,t.ammo,true),n=Math.min(Math.floor(room),have);
  if(n<=0){toast(have?'Already full':'No '+ITEMS[t.ammo].n,'bad');return false}take(S,t.ammo,n,true);o.ammo=(o.ammo||0)+n;sfx('equip');emit('obj',i);return true;
}
export function fuelGenerator(S,i,n=5){
  const o=G.Z.obj[i];if(!o)return false;const room=30-(o.fuel||0);n=Math.min(n,Math.floor(room),count(S,'fuel',true));if(n<=0){toast(room<1?'Tank is full':'No fuel','bad');return false}
  take(S,'fuel',n,true);o.fuel=(o.fuel||0)+n;G.Z.navDirty=true;sfx('drink');emit('obj',i);return true;
}
const recipeOf=id=>RECIPES[id]||Object.values(RECIPES).find(r=>r.o===id);
/** Break an item from pack slot i into half its ingredients. */
export function recycle(S,i){
  const s=S.p.inv[i];if(!s)return false;const r=recipeOf(s.id),it=ITEMS[s.id];if(!r||r.fx||it.t==='food'||it.t==='med'){toast('Nothing to recover from that','info');return false}
  const f=.5*(1+perk('salvage'))*(s.d!==undefined?.4+.6*s.d/it.dur:1)/r.q;S.p.inv[i]=s.n>1?{...s,n:s.n-1}:null;
  for(const k in r.i){const n=Math.floor(r.i[k]*f+rnd()*.6);if(n>0)give(S,k,n)}sfx('break');stat('recycled');return true;
}
export function mendCost(e){const it=ITEMS[e.id],r=recipeOf(e.id);if(!it.dur||e.d>=it.dur)return null;const f=(1-e.d/it.dur)*.35,out={};if(r)for(const k in r.i){const n=Math.ceil(r.i[k]*f);if(n>0&&ITEMS[k].t==='mat')out[k]=n}if(!Object.keys(out).length)out.scrap=Math.max(1,Math.ceil(it.v*f/6));return out}
export function mend(S,ref){
  const cost=mendCost(ref);if(!cost){toast('Not worn','info');return false}for(const k in cost)if(count(S,k,true)<cost[k]){toast('Missing '+ITEMS[k].n+': need '+cost[k]+', have '+count(S,k,true)+' (pack and boxes)','bad');sfx('error');return false}
  for(const k in cost)take(S,k,cost[k],true);ref.d=ITEMS[ref.id].dur;sfx('build');return true;
}
/** Auto-repair (the "Auto-repair tools" setting): called when a tool or weapon is nearly worn out. At home with a mending bench standing
 *  and the materials in the pack or in storage it is mended in full; anywhere else a repair kit is spent. Says so once if neither is possible. */
const warnedWorn=new WeakSet();
export function autoRepair(S,ref){
  const it=ITEMS[ref.id];if(!it||!it.dur)return false;
  if(G.Z&&G.Z.home&&hasBuilt(S,d=>d.special==='repair')){const cost=mendCost(ref);
    if(cost&&Object.keys(cost).every(k=>count(S,k,true)>=cost[k])){for(const k in cost)take(S,k,cost[k],true);ref.d=it.dur;warnedWorn.delete(ref);toast(it.n+' mended: your Mending Bench keeps tools up at home while the materials last','good');sfx('build');return true}}
  if(take(S,'repair_kit',1)){ref.d=Math.min(it.dur,Math.max(0,ref.d)+Math.max(60,it.dur*.6));warnedWorn.delete(ref);const left=count(S,'repair_kit');toast(it.n+' repaired with a kit ('+(left?left+' left':'that was the last one')+')','good');sfx('build');return true}
  if(!warnedWorn.has(ref)){warnedWorn.add(ref);toast(it.n+' is nearly worn out and there is no repair kit','bad')}
  return false;
}
G.hooks.repair=autoRepair;
Community.bind({addSurvivor,survCap,survRoom,pile,ambush:startAmbush,addSite,defence:defenceScore,raidBase,maxRegion,homeHas,harvest,plant});
export {Community};
export function raiseMutation(S){if(!S.flags.core_dead)return false;S.mut++;statMax('mutation',S.mut);for(const id in S.loc)S.loc[id].cool=0;toast('Mutation tier '+S.mut+': everything out there is stronger, and carries more','bad');sfx('horde_horn');emit('save');return true}

// ---------------------------------------------------------------- save format
export function serialize(){
  const S=G.S;if(!S)return null;const sparse=a=>{const o={};for(let i=0;i<a.length;i++)if(a[i])o[i]=a[i];return o};
  return JSON.stringify(S,(k,v)=>k==='home'?{...v,obj:sparse(v.obj),fl:sparse(v.fl),ed:sparse(v.ed||[])}:k.startsWith('_')?undefined:v);
}
const MIGRATE={
  // 1 → 2: walls and doors moved from filling a cell to standing on a cell's edge. A wall cell that closed something in becomes a wall on its
  // outward face (so the old wall cells become usable ground inside); a free-standing run becomes one line of walls.
  1:S=>{const W=HOME_W,H=HOME_H,obj=S.home.obj||{},ed={},wasW=new Uint8Array(W*H);for(const key in obj){const o=obj[key];if(o&&OBJ[o.k]&&OBJ[o.k].cost&&(OBJ[o.k].wall||OBJ[o.k].door))wasW[+key]=1}const isW=i=>wasW[i]===1;
    const out=new Uint8Array(W*H),q=[];for(let x=0;x<W;x++)q.push(x,(H-1)*W+x);for(let y=0;y<H;y++)q.push(y*W,y*W+W-1);
    while(q.length){const i=q.pop();if(out[i]||isW(i))continue;out[i]=1;const x=i%W,y=(i-x)/W;if(x>0)q.push(i-1);if(x<W-1)q.push(i+1);if(y>0)q.push(i-W);if(y<H-1)q.push(i+W)}
    for(const key in obj){const i=+key;if(!isW(i))continue;const o=obj[i],x=i%W,y=(i-x)/W,o4=[y===0||out[i-W],x===W-1||out[i+1],y===H-1||out[i+W],x===0||out[i-1]];
      let sides=[0,1,2,3].filter(s=>o4[s]);
      if(!sides.length||(o4[0]&&o4[2])||(o4[1]&&o4[3])){sides=[];if((x>0&&isW(i-1))||(x<W-1&&isW(i+1)))sides.push(0);if(isW(i-W)||isW(i+W))sides.push(3);if(!sides.length)sides.push(0)}
      for(const sd of sides){const e=edgeIdx(W,x,y,sd);if(!ed[e])ed[e]={k:o.k,hp:o.hp}}
      delete obj[i]}
    S.home.ed=ed;S.v=2},
};
export function deserialize(str){
  const S=JSON.parse(str);if(!S||!S.v||!S.p||!S.home)throw new Error('Not a Graywake save');
  while(S.v<SAVE_V){if(!MIGRATE[S.v])throw new Error('Save is too old');MIGRATE[S.v](S)}
  const dense=o=>{const a=new Array(HOME_W*HOME_H);for(const k in o)a[+k]=o[k];return a};S.home.obj=dense(S.home.obj||{});S.home.fl=dense(S.home.fl||{});{const a=[],o=S.home.ed||{};for(const k in o)if(o[k])a[+k]=o[k];S.home.ed=a}
  const fresh=blankState(S.seed);for(const k in fresh)if(S[k]===undefined)S[k]=fresh[k];for(const k in fresh.set)if(S.set[k]===undefined)S.set[k]=fresh.set[k];for(const k in fresh.p)if(S.p[k]===undefined)S.p[k]=fresh.p[k];
  S.tide.live=null;S.p.inv=S.p.inv.map(s=>s&&ITEMS[s.id]?s:null);for(const k in S.p.eq)if(S.p.eq[k]&&!ITEMS[S.p.eq[k].id])S.p.eq[k]=null;
  return S;
}
/** Resume from a parsed save: always back at home (a save made in the field returns you to the last time you were safe). */
export function resume(S){
  G.S=S;G.ds=derive(S);G.pending=null;if(S.p.hp<=0)S.p.hp=20;S.pos='home';goHome(false);
}

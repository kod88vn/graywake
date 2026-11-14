// Settlements: the enclaves a world plays itself. No model drives them and nothing is rolled against a fixed chance: each is seeded from its
// world, lives one game day at a time on a built-in plan (work the day, raise walls, lay traps, make better gear, take people in), levels up
// as its world's days pass, and meets the same tides and the same radio leads as the players, judged by the game's own rules:
// tide strength from `tideBudget`/`tideLevel` against a defence counted the way `defenceScore` counts a homestead, and a lead's danger from
// `leadOdds` for the gear the settlement's leader actually carries. Same seed, same days, same world events: same history.
import {blankState} from '../../js/sim/core.js';
import * as World from '../../js/sim/world.js';
import {OBJ} from '../../js/data/objects.js';
import {ITEMS} from '../../js/data/items.js';
import {SITES} from '../../js/data/world.js';

/** What kind of people they are: where a day's work goes, and how dangerous a lead they will walk into (odds as the game rates them: .8 is the top of "a fair fight"). */
export const TRAITS={
  builders:{walls:.45,traps:.2,gear:.12,grow:.23,bold:.6,d:'wall builders'},
  fighters:{walls:.2,traps:.2,gear:.4,grow:.2,bold:.95,d:'fighters'},
  scavengers:{walls:.2,traps:.1,gear:.4,grow:.3,bold:1.15,d:'scavengers'},
  farmers:{walls:.3,traps:.1,gear:.15,grow:.45,bold:.5,d:'farmers'},
};
const WALLS=['wall_stick','wall_plank','wall_stone','wall_metal','wall_reinf'].filter(k=>OBJ[k]);
const TRAPS=['spikes','spikes2','spikes3'].filter(k=>OBJ[k]);
// what a settlement's leader fights with and wears, by the level at which the game lets a player make it
const WEAPONS=[['club',1],['spear',2],['bat',5],['nail_bat',8],['machete',12],['fire_axe',24],['sledge',27],['katana',36]].filter(w=>ITEMS[w[0]]);
const SETS=[[1,'rags',{body:'rag_shirt',legs:'rag_pants',feet:'rag_wraps',head:'bandana',hands:'hand_wraps'}],[4,'hide',{body:'hide_vest',legs:'hide_pants',feet:'hide_boots',head:'hide_hood',hands:'hand_wraps'}],
  [11,'leather',{body:'leather_jacket',legs:'leather_pants',feet:'leather_boots',head:'leather_cap',hands:'leather_gloves'}],[17,'scrap',{body:'scrap_plate',legs:'scrap_greaves',feet:'scrap_boots',head:'scrap_helm',hands:'scrap_gauntlets'}],
  [30,'riot',{body:'riot_vest',legs:'riot_pants',feet:'riot_boots',head:'riot_helm',hands:'scrap_gauntlets'}],[41,'military',{body:'mil_vest',legs:'mil_pants',feet:'mil_boots',head:'mil_helm',hands:'tac_gloves'}]];
const rng=seed=>{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}};
const clamp=(x,a,b)=>x<a?a:x>b?b:x;

/** A new settlement, the same every time for the same world seed and place in the list. It starts where a new player starts: a few people, a club, no walls. */
export function seedSettlement(worldSeed,i){
  const seed=(Math.imul(worldSeed>>>0,2654435761)+i*40503+17)>>>0,r=rng(seed),trait=Object.keys(TRAITS)[Math.floor(r()*4)];
  return{seed,trait,lvl:1,xp:0,people:2+Math.floor(r()*2),guards:0,walls:{},traps:{},wpn:0,set:-1,meds:1,pts:{walls:0,traps:0,gear:0,grow:0},tideN:0,tideAt:3,doing:'settling in',days:0};
}
/** The leader as the game would see them: a character of that level in that gear, for `leadOdds` and the tide formulas. */
export function leader(st,tideMult=1){
  const S=blankState(st.seed);S.p.lvl=st.lvl;S.p.eq.w1={id:WEAPONS[st.wpn][0],d:ITEMS[WEAPONS[st.wpn][0]].dur};
  if(st.set>=0)for(const[slot,id]of Object.entries(SETS[st.set][2]))if(ITEMS[id])S.p.eq[slot]={id,d:ITEMS[id].dur||1};
  if(st.meds>0)S.p.inv=[{id:'bandage',n:st.meds}];S.tide.n=st.tideN;S.world={fx:{tide:tideMult}};return S;
}
/** Defence, counted as the game counts a homestead when the player is away: wall health, what the traps can still do, and the guards. */
export function defence(st){
  let d=0;for(const k in st.walls)d+=st.walls[k]*OBJ[k].hp/50;for(const k in st.traps)d+=st.traps[k]*OBJ[k].trap.dmg*OBJ[k].trap.uses/90;
  return d+st.guards*(30+st.tideN*6);
}
const count=o=>Object.values(o).reduce((a,b)=>a+b,0);
/** One game day of a settlement's life. `ctx`: {day, stage, tideMult, leads:[{id,kind,age}]} (leads still open, with their age in minutes).
 *  Returns what happened that the world should know: [{k:'held'|'lost'|'death'|'take', lead?, text}]. */
export function settlementDay(st,ctx){
  const r=rng(st.seed+ctx.day*7919),out=[];st.days++;
  // each settlement has its own knack, so two of the same kind do not live the same life: how hard they work, and a lean of their own in
  // what they put first (settlements from before this get theirs from their seed, the same every time)
  if(!st.knack){const q=rng(st.seed^0x9e3779b9);st.knack={work:.82+q()*.36,lean:['walls','traps','gear','grow'][Math.floor(q()*4)]}}
  const T0=TRAITS[st.trait],T=Object.assign({},T0);T[st.knack.lean]+=.1;
  // ---- growing with the world: experience from the day's work, quicker when behind the world's pace and slower when ahead of it
  const pace=1+(ctx.day-1)*.55+ctx.stage*1.5;st.xp+=(34+st.people*5+ctx.stage*8)*(st.lvl<pace-2?1.6:st.lvl>pace+3?.5:1);
  while(st.xp>=50+st.lvl*40){st.xp-=50+st.lvl*40;st.lvl++}
  // ---- the day's work, shared out the way these people do things
  // (a pair of hands raises two or three stick walls a day, as a player's do)
  // a good day and a bad one: the weather, the sick, a find
  const work=st.people*(6.5+st.lvl*.45)*st.knack.work*(.8+r()*.4);
  // after the tide has broken the walls, everyone digs out: most hands go to the walls until the ring is mostly whole again
  {const ring=Math.min(40,14+st.people*2),have=count(st.walls);if(have<ring*.8){const rest=1-T.walls,want=Math.max(T.walls,.65);for(const k of['traps','gear','grow'])T[k]*=(1-want)/rest;T.walls=want}}
  {const sum=T.walls+T.traps+T.gear+T.grow;for(const k of['walls','traps','gear','grow'])st.pts[k]+=work*T[k]/sum}
  let did='gathering';
  // walls: build out to a ring, then replace the weakest with the best this level can make
  {const best=WALLS.filter(k=>OBJ[k].lv<=st.lvl).pop(),ring=Math.min(40,14+st.people*2),cost=k=>3+WALLS.indexOf(k)*5;
    for(let g=0;g<30&&best;g++){if(count(st.walls)<ring){if(st.pts.walls<cost(best))break;st.pts.walls-=cost(best);st.walls[best]=(st.walls[best]||0)+1;did='raising walls'}
      else{const weak=WALLS.find(k=>st.walls[k]>0);if(!weak||weak===best||st.pts.walls<cost(best))break;st.pts.walls-=cost(best);st.walls[weak]--;if(!st.walls[weak])delete st.walls[weak];st.walls[best]=(st.walls[best]||0)+1;did='rebuilding the walls in '+OBJ[best].n.replace(/ wall/i,'').toLowerCase()}}}
  {const best=TRAPS.filter(k=>OBJ[k].lv<=st.lvl).pop(),cap=6+Math.floor(st.lvl/2),cost=k=>4+TRAPS.indexOf(k)*6;
    for(let g=0;g<20&&best&&count(st.traps)<cap&&st.pts.traps>=cost(best);g++){st.pts.traps-=cost(best);st.traps[best]=(st.traps[best]||0)+1}}
  // gear: the next weapon and the next set of clothes, when the level allows and the work has been put in; bandages in between
  {const nw=st.wpn+1,ns=st.set+1;
    if(WEAPONS[nw]&&st.lvl>=WEAPONS[nw][1]*.8&&st.pts.gear>=10+WEAPONS[nw][1]*2){st.pts.gear-=10+WEAPONS[nw][1]*2;st.wpn=nw;did='arming themselves'}
    else if(SETS[ns]&&st.lvl>=SETS[ns][0]*.8&&st.pts.gear>=14+SETS[ns][0]*3){st.pts.gear-=14+SETS[ns][0]*3;st.set=ns;did='making '+SETS[ns][1]+' clothes'}
    else if(st.meds<4&&st.pts.gear>=6){st.pts.gear-=6;st.meds++}}
  // people: the settlement takes someone in when it can feed them; every third stands guard
  if(st.people<Math.min(14,4+Math.floor(st.lvl/2))&&st.pts.grow>=24+st.people*9){st.pts.grow-=24+st.people*9;st.people++;st.guards=Math.floor(st.people/3);did='taking someone in'}
  // ---- the tide, every third day, as heavy as the world's stage makes it
  const tideDay=ctx.day>=st.tideAt;
  if(tideDay){const n=++st.tideN,S=leader(st,ctx.tideMult),strength=World.tideBudget(S,n)*(1+.15*World.tideLevel(S,n))*2,ratio=strength/(defence(st)+8);st.tideAt=ctx.day+3;
    const wear=(o,f)=>{for(const k in o){o[k]=Math.max(0,Math.round(o[k]*(1-f)));if(!o[k])delete o[k]}};
    if(ratio<1){wear(st.traps,Math.min(.5,ratio*.3));out.push({k:'held',text:'held tide '+n});did='holding the tide'}
    else{wear(st.walls,clamp(ratio*.3,.1,.85));wear(st.traps,Math.min(.8,ratio*.4));if(ratio>1.8&&st.people>2){st.people--;st.guards=Math.floor(st.people/3)}out.push({k:'lost',text:'tide '+n+' went through'});did='digging out after the tide'}}
  // ---- a lead on the radio: only one that the game itself would call fair for this leader's gear, and never on a tide day
  // (and not within three days of the last expedition: the walls need the hands)
  if(!tideDay&&ctx.day-(st.wentDay||-9)>=3)for(const l of ctx.leads||[]){const def=SITES[l.kind];if(!def||l.age<(ctx.headStart||0))continue;const S=leader(st);
    let L=1;for(let x=1;x<=st.lvl+4;x++){if(World.leadOdds(S,def,x)<=T.bold)L=x;else break}const odds=World.leadOdds(S,def,L);
    if(odds>T.bold)continue;   // too dangerous as they stand: they stay home and keep building
    const p=odds<.4?.97:odds<.8?.88:odds<1.3?.5:.12;st.wentDay=ctx.day;
    if(r()<p){out.push({k:'take',lead:l.id,text:'opened the strongroom'});st.pts.gear+=22;st.meds=Math.min(4,st.meds+2);did='back from the '+def.n+' with the haul'}
    else{out.push({k:'death',lead:l.id,text:'beaten back from the '+def.n});st.meds=0;did='carrying their leader home'}
    break}
  st.doing=did;return out;
}
/** A line for the world sheet: what this settlement is and has. */
export function describe(st){
  const w=Object.entries(st.walls).map(([k,n])=>n+' '+OBJ[k].n.toLowerCase()+(n>1?'s':'')).join(', ')||'no walls yet',t=count(st.traps);
  return`${TRAITS[st.trait].d} · ${st.people} people${st.guards?', '+st.guards+' on guard':''} · ${ITEMS[WEAPONS[st.wpn][0]].n.toLowerCase()}${st.set>=0?', '+SETS[st.set][1]+' clothes':', no armour'} · ${w}${t?', '+t+' trap'+(t>1?'s':''):''} · today: ${st.doing}`;
}

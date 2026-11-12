// Story progress, radio contracts and achievements. Pure logic.
import {ITEMS} from '../data/items.js';
import {ENEMIES} from '../data/enemies.js';
import {OBJ} from '../data/objects.js';
import {LOCATIONS,REGIONS} from '../data/world.js';
import {STORY,BUILD_TAGS,CONTRACTS,CONTRACT_GIVERS,ACHIEVEMENTS} from '../data/progress.js';
import {G,emit,toast,sfx,stat,count,take,countBuilt,hasBuilt} from './core.js';
import {rnd} from './util.js';

export const story=S=>STORY[S.q.i]||null;
export function startQuest(S){
  const q=story(S);if(!q)return;S.flags[q.id]=1;S.q.base={};
  for(const g of q.goals){if(g.k==='craft')S.q.base['c_'+g.id]=S.stats['c_'+g.id]||0;if(g.k==='kill')S.q.base[g.kind?'k_'+g.kind:'kills']=S.stats[g.kind?'k_'+g.kind:'kills']||0}
}
/** [current, needed] for one goal. */
export function goalProgress(S,g){
  const st=S.stats,b=S.q.base;
  switch(g.k){
    case'have':case'deliver':return[Math.min(g.n,count(S,g.item,true)),g.n];
    case'craft':return[Math.min(g.n,(st['c_'+g.id]||0)-(b['c_'+g.id]||0)),g.n];
    case'build':return[Math.min(g.n,countBuilt(S,g.tag?BUILD_TAGS[g.tag]:g.kind)),g.n];
    case'visit':return[S.loc[g.loc]&&S.loc[g.loc].n?1:0,1];
    case'kill':{const k=g.kind?'k_'+g.kind:'kills';return[Math.min(g.n,(st[k]||0)-(b[k]||0)),g.n]}
    case'boss':return[st['k_'+g.kind]?1:0,1];
    case'level':return[Math.min(g.n,S.p.lvl),g.n];
    case'tide':return[Math.min(g.n,st.tides||0),g.n];
    case'surv':return[Math.min(g.n,S.surv.length),g.n];
    case'veh':return[Math.min(g.n,S.veh),g.n];
    case'stat':return[Math.min(g.n,st[g.s]||0),g.n];
  }
  return[0,1];
}
export function goalText(g){
  switch(g.k){
    case'have':return'Gather '+ITEMS[g.item].n;case'deliver':return'Bring home '+ITEMS[g.item].n;case'craft':return'Make '+ITEMS[g.id].n;
    case'build':return'Build '+(g.tag?{wall:'walls',door:'a door',bed:'a bed',store:'storage',trap:'traps',water:'a rain catcher',workbench:'a workbench',furnace:'a furnace',forge:'a forge',garage:'a vehicle bay',chem:'a chem station',gunbench:'a gunsmith bench',elec:'an electronics bench'}[g.tag]:OBJ[g.kind].n);
    case'visit':return'Travel to '+LOCATIONS.find(l=>l.id===g.loc).n;case'kill':return'Kill '+(g.kind?ENEMIES[g.kind].n:'hostiles');case'boss':return'Kill '+ENEMIES[g.kind].n;
    case'level':return'Reach level '+g.n;case'tide':return'Survive tides';case'surv':return'Shelter survivors';case'veh':return'Build a '+['','hand cart','bicycle','motorbike','dune buggy','sealed truck'][g.n];
    case'stat':return{planted:'Plant a seed',depth:'Descend into the Deep Gray'}[g.s]||g.s;
  }
  return'';
}
export function checkStory(S){
  const q=story(S);if(!q)return false;let all=true;
  for(const g of q.goals){const[c,n]=goalProgress(S,g);if(c<n){all=false;break}}
  if(!all)return false;
  if(q.goals.some(g=>g.k==='deliver')&&!(G.Z&&G.Z.home))return false;
  for(const g of q.goals)if(g.k==='deliver')take(S,g.item,g.n,true);
  delete S.flags[q.id];S.q.done.push(q.id);S.q.i++;
  emit('ui','questDone',q.id);sfx('quest');if(G.hooks.fx)G.hooks.fx(q.rw,true);
  startQuest(S);return true;
}

// ---------------------------------------------------------------- contracts
export const maxRegion=S=>{let m=1;for(let r=1;r<REGIONS.length;r++)if(REGIONS[r].veh<=S.veh)m=r;return m};
export function genContract(S){
  const mr=maxRegion(S),reg=Math.max(1,mr-(rnd()<.45?Math.floor(rnd()*2+1):0)),roll=rnd(),id=++S.siteN;
  const giver=CONTRACT_GIVERS[Math.floor(rnd()*CONTRACT_GIVERS.length)];
  if(roll<.42){const[item,n0]=CONTRACTS.fetch[reg][Math.floor(rnd()*CONTRACTS.fetch[reg].length)],n=Math.max(1,Math.round(n0*(.7+rnd()*.6)));return{id,type:'fetch',item,n,have:0,pay:Math.round(ITEMS[item].v*n*1.5+15*reg),xp:Math.round(ITEMS[item].v*n*2+40*reg),giver,reg}}
  if(roll<.84){const[kind,n0]=CONTRACTS.hunt[reg][Math.floor(rnd()*CONTRACTS.hunt[reg].length)],n=Math.max(1,Math.round(n0*(.7+rnd()*.6)));return{id,type:'hunt',kind,n,have:0,pay:Math.round(n*(4+ENEMIES[kind].xp*.35)*(1+reg*.5)),xp:Math.round(n*ENEMIES[kind].xp*(1+reg)),giver,reg}}
  const locs=LOCATIONS.filter(l=>l.id!=='home'&&l.reg<=mr&&l.reg>=Math.max(1,mr-1)&&(!l.flag||S.flags[l.flag])),l=locs[Math.floor(rnd()*locs.length)];
  return{id,type:'clear',loc:l.id,n:1,have:0,pay:60+l.lvl*14,xp:150+l.lvl*40,giver,reg:l.reg};
}
export function fillContracts(S){
  if(!hasBuilt(S,d=>d.special==='radio'))return;const cap=hasBuilt(S,d=>d.special==='trade')?5:3;let added=0;
  while(S.q.contracts.length<cap&&added<2){S.q.contracts.push(genContract(S));added++}
  if(added)toast('New contracts on the radio','info');
}
export function contractText(c){return c.type==='fetch'?'Deliver '+c.n+' × '+ITEMS[c.item].n:c.type==='hunt'?'Kill '+c.n+' × '+ENEMIES[c.kind].n:'Clear out '+LOCATIONS.find(l=>l.id===c.loc).n}
export function contractReady(S,c){return c.type==='fetch'?count(S,c.item,true)>=c.n&&!!(G.Z&&G.Z.home):c.have>=c.n}
export function turnIn(S,id){
  const i=S.q.contracts.findIndex(c=>c.id===id),c=S.q.contracts[i];if(!c)return false;
  if(!contractReady(S,c)){toast(c.type==='fetch'?'Bring the goods home first':'Not done yet','bad');return false}
  if(c.type==='fetch')take(S,c.item,c.n,true);S.q.contracts.splice(i,1);stat('contracts');
  const rw=[['scrip',c.pay],['xp',c.xp]];if(rnd()<.3)rw.push(['loot',['ammo','med','food','tool'][Math.floor(rnd()*4)],1]);if(rnd()<.06+c.reg*.01)rw.push(['bp']);
  if(G.hooks.fx)G.hooks.fx(rw,true);sfx('coin');return true;
}
export function dropContract(S,id){const i=S.q.contracts.findIndex(c=>c.id===id);if(i>=0)S.q.contracts.splice(i,1)}
export function noteKill(kind){const S=G.S;for(const c of S.q.contracts)if(c.type==='hunt'&&c.kind===kind&&c.have<c.n){c.have++;if(c.have===c.n)toast('Contract complete: '+contractText(c),'good')}}
export function noteClear(locId){const S=G.S;for(const c of S.q.contracts)if(c.type==='clear'&&c.loc===locId&&c.have<1){c.have=1;toast('Contract complete: '+contractText(c),'good')}}

// ---------------------------------------------------------------- achievements
export function checkAch(S){
  for(const a of ACHIEVEMENTS){if(S.ach[a.id])continue;if((S.stats[a.s]||0)>=a.v){S.ach[a.id]=1;emit('ui','ach',a.id);sfx('quest');if(G.hooks.fx)G.hooks.fx(a.rw,true)}}
}

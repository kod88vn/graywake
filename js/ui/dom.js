// Small DOM and formatting helpers shared by the interface modules.
import {iconURL,iconFor} from './icons.js';
import {ITEMS,SETS} from '../data/items.js';
import {G,count} from '../sim/core.js';
import {sourcesOf} from '../data/sources.js';

export const $=id=>document.getElementById(id);
export const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const img=id=>`<img src="${iconURL(id)}" alt="">`;
export const gimg=(glyph,col,col2)=>`<img src="${iconFor(glyph,col,col2)}" alt="">`;
/** Filled in by ui.js so panels can call back without a circular import. */
export const bus={};
export const fmtMin=m=>m>=1440?Math.floor(m/1440)+'d '+Math.floor(m%1440/60)+'h':m>=60?Math.floor(m/60)+'h '+(Math.round(m%60)?Math.round(m%60)+'m':''):Math.max(1,Math.round(m))+' min';
/** An inventory slot button. s = {id,n,d} or null. attrs = extra attributes string. */
export function slot(s,attrs='',cls=''){
  if(!s)return`<button class="sl ${cls}" ${attrs}></button>`;const it=ITEMS[s.id];let x=img(s.id);
  if(s.n>1)x+=`<u class="num">${s.n}</u>`;if(s.d!==undefined&&it.dur){const f=Math.max(0,s.d/it.dur);x+=`<s><i class="${f<.25?'lo':''}" style="width:${Math.round(f*100)}%"></i></s>`}
  return`<button class="sl ${cls}" title="${esc(it.n)}" ${attrs}>${x}</button>`;
}
/** Ingredient chips for a cost table, coloured by whether you have enough (pack plus home stores when at home). */
export function chips(cost,mult=1){
  const home=!!(G.Z&&G.Z.home);let h='';
  for(const k in cost){const need=cost[k]*mult,have=count(G.S,k,home);const src=have<need?sourcesOf(k):'',own=home?count(G.S,k,false):have;h+=`<span class="${have>=need?'ok':'no'}" title="${esc(ITEMS[k].n)}: have ${have}${home&&own<have?' ('+own+' on you, the rest stored at home)':''}${src?' · '+esc(src):''}">${img(k)}${need}</span>`}
  return`<div class="ing">${h}</div>`;
}
const BUFF={speed:'move speed',haste:'attack speed',resist:'damage resistance',regen:'health per second',vigor:'max health'};
/** Stat tags for an item card. */
export function tags(it,s){
  const t=[];const add=x=>t.push(`<span>${x}</span>`);
  if(it.t==='melee'||it.t==='tool'||it.t==='gun'||it.t==='throw'){if(it.dmg)add((it.pellets?it.pellets+' × ':'')+it.dmg+' damage');if(it.spd)add((1/it.spd).toFixed(1)+' hits/s');if(it.t==='gun'||it.t==='throw')add('range '+it.rng);
    if(it.ammo)add('uses '+ITEMS[it.ammo].n);if(it.aoe)add('blast '+it.aoe);if(it.noise===0)add('silent');else if(it.noise>=20)add('loud');
    const fx=it.fx||{};if(fx.cleave)add('hits all in arc');if(fx.bleed)add('bleed');if(fx.stun)add('stuns');if(fx.sneak)add('+sneak damage');if(it.burn)add('burns');if(it.pierce)add('pierces');if(it.lure)add('lures '+it.lure+' s')}
  if(it.tool)add({axe:'fells trees',pick:'mines',rod:'catches fish',wrench:'strips wrecks',pry:'forces locks'}[it.tool]+' · tier '+it.tier);
  if(it.arm)add('armour '+it.arm);if(it.cold)add('cold −'+Math.round(it.cold*100)+'%');if(it.tox&&it.arm!==undefined)add('toxin −'+Math.round(it.tox*100)+'%');if(it.spd&&it.arm!==undefined)add((it.spd>0?'+':'')+Math.round(it.spd*100)+'% speed');
  if(it.slots)add('+'+it.slots+' slots');
  if(it.food)add((it.food>0?'+':'')+it.food+' food');if(it.water)add((it.water>0?'+':'')+it.water+' water');if(it.hp)add((it.hp>0?'+':'')+it.hp+' health');
  if(it.tox&&it.arm===undefined)add((it.tox>0?'+':'')+it.tox+' toxin');if(it.risk)add(Math.round(it.risk[0]*100)+'% risky');
  if(it.buff)add('+'+(it.buff[1]<1?Math.round(it.buff[1]*100)+'%':it.buff[1])+' '+(BUFF[it.buff[0]]||it.buff[0])+' for '+it.buff[2]+' s');
  if(it.crop)add('grows '+ITEMS[it.crop].n+' in '+fmtMin(it.grow));if(it.set)add('set: '+SETS[it.set].n);
  if(s&&s.d!==undefined&&it.dur)add('condition '+Math.round(s.d/it.dur*100)+'%');if(it.v)add(it.v+' scrip');
  return`<div class="tags">${t.join('')}</div>`;
}
export const TYPE_NAMES={mat:'Material',food:'Food & drink',med:'Medicine',tool:'Tool',melee:'Melee weapon',gun:'Ranged weapon',throw:'Thrown',ammo:'Ammunition',head:'Headgear',body:'Body armour',legs:'Leg armour',feet:'Footwear',hands:'Gloves',pack:'Backpack',seed:'Seed',bp:'Schematic',key:'Key item',misc:'Gear'};

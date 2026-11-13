// Where each item comes from, worked out from the content tables so it cannot go stale: what makes it, what it is gathered from,
// which containers hold it, what drops it. Shown wherever the game says something is missing. Pure data.
import {ITEMS} from './items.js';
import {OBJ} from './objects.js';
import {RECIPE_LIST} from './recipes.js';
import {LOOT} from './world.js';
import {ENEMIES} from './enemies.js';

// what grows and lies about at the homestead is named first: it is what a new player can reach
const NEAR=['log_pile','stone_pile','grass_tall','bush_berry','mushrooms','herb_patch','pond','clay_pit','tree_birch','tree_pine','tree_dead','rock','rock_flint','crate','car_wreck'];
let MAP=null;
function build(){
  MAP={};const add=(id,kind,name)=>{if(!ITEMS[id]||!name)return;const m=MAP[id]=MAP[id]||{make:[],gather:[],grow:[],find:[],drop:[]};if(!m[kind].includes(name))m[kind].push(name)};
  const bench={};for(const k in OBJ){const d=OBJ[k];if(d.station&&d.cost&&(!bench[d.station]||d.sl<bench[d.station].sl))bench[d.station]=d}
  // "made by hand (C) from Cloth": naming what it is made from saves looking for a recipe that the list may not be showing yet
  const from=r=>{const ks=Object.keys(r.i||{}).filter(k=>ITEMS[k]);return ks.length?' from '+ks.slice(0,2).map(k=>ITEMS[k].n).join(' and ')+(ks.length>2?' and more':''):''};
  for(const r of RECIPE_LIST)if(!r.fx)add(r.o,'make',(r.s==='hand'?'by hand (C)':bench[r.s]?'at a '+bench[r.s].n:r.s)+from(r));
  for(const k of[...NEAR.filter(k=>OBJ[k]),...Object.keys(OBJ).filter(k=>!NEAR.includes(k))]){const d=OBJ[k];if(d.node)for(const g of d.node.give)add(g[0],'gather',d.n);if(d.prod)add(d.prod.item,'make','by a '+d.n);
    if(d.loot&&LOOT[d.loot]&&!d.lock)for(const row of LOOT[d.loot])if(row.t0<=2)add(row.i,'find',d.n)}
  for(const k in ENEMIES)for(const dr of ENEMIES[k].drop||[])if(!ENEMIES[k].boss)add(dr[0],'drop',ENEMIES[k].n);
  for(const id in ITEMS)if(ITEMS[id].crop)add(ITEMS[id].crop,'grow',ITEMS[id].n);
}
/** A short line saying where an item comes from ("made at a Campfire · found in Cabinet, Bin · dropped by Husk"), or '' if nothing is known. */
export function sourcesOf(id,max=3){
  if(!MAP)build();const m=MAP[id];if(!m)return'';const part=(label,a)=>a.length?label+' '+a.slice(0,max).join(', ')+(a.length>max?' and more':''):'';
  return[part('gathered from',m.gather),part('grown from',m.grow),part('made',m.make),part('found in',m.find),part('dropped by',m.drop)].filter(Boolean).join(' · ');
}

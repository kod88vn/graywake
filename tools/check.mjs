#!/usr/bin/env node
// Static checks, about a second: every id that one table uses exists in the table it points at,
// every item can actually be obtained, every model / icon / sound the game asks for is defined.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib.mjs';
import {ITEMS} from '../js/data/items.js';
import {OBJ,BUILD_CATS,G as GT} from '../js/data/objects.js';
import {RECIPES,RECIPE_LIST} from '../js/data/recipes.js';
import {ENEMIES} from '../js/data/enemies.js';
import {LOCATIONS,SITES,BLD,LOOT,ROLLS,BIOMES} from '../js/data/world.js';
import {EVENTS,TIDE_KINDS,TIDE_COST} from '../js/data/events.js';
import {STORY,BUILD_TAGS,CONTRACTS,PERKS,ACHIEVEMENTS,JOBS,TRADE,TRADE_BP} from '../js/data/progress.js';
import {FACTIONS} from '../js/data/community.js';

const errs=[],warns=[];const E=m=>errs.push(m),W=m=>warns.push(m);
const item=(id,where)=>{if(!ITEMS[id])E(`${where}: unknown item "${id}"`)},obj=(id,where)=>{if(!OBJ[id])E(`${where}: unknown object "${id}"`)},foe=(id,where)=>{if(!ENEMIES[id])E(`${where}: unknown creature "${id}"`)};
const got=new Set(),used=new Set();
const read=f=>fs.existsSync(path.join(ROOT,f))?fs.readFileSync(path.join(ROOT,f),'utf8'):'';

// items
for(const id in ITEMS){const it=ITEMS[id];if(!it.n||!it.t||!it.ic)E(`item ${id}: needs n, t and ic`);
  if(it.ammo)item(it.ammo,'item '+id+' ammo');if(it.crop){item(it.crop,'item '+id+' crop');got.add(it.crop)}
  if(it.learn)for(const r of it.learn)if(!RECIPES[r]&&!(OBJ[r]&&OBJ[r].bp===r))E(`item ${id}: schematic teaches unknown recipe "${r}"`);
  if(['melee','gun','tool'].includes(it.t)&&!it.dur)E(`item ${id}: weapons and tools need dur`);}
// recipes
for(const r of RECIPE_LIST){if(!r.fx){item(r.o,'recipe '+r.id);got.add(r.o)}for(const k in r.i){item(k,'recipe '+r.id);used.add(k)}
  if(r.s!=='hand'&&!Object.values(OBJ).some(o=>o.station===r.s&&o.sl>=r.sl))E(`recipe ${r.id}: no station "${r.s}" tier ${r.sl}`);
  if(r.bp&&!Object.values(ITEMS).some(it=>it.learn&&(it.learn.includes(r.id)||it.learn.includes(r.o))))E(`recipe ${r.id}: needs a schematic but no item teaches it`);}
// objects
for(const k in OBJ){const o=OBJ[k];for(const c in o.cost||{}){item(c,'object '+k+' cost');used.add(c)}if(o.up)obj(o.up,'object '+k+' up');
  if(o.node)for(const g of o.node.give){item(g[0],'object '+k+' yield');got.add(g[0])}
  if(o.loot&&!LOOT[o.loot])E(`object ${k}: unknown loot family "${o.loot}"`);if(o.lock&&!['pry','pick','guard'].includes(o.lock))item(o.lock,'object '+k+' lock');
  if(o.prod){item(o.prod.item,'object '+k+' prod');got.add(o.prod.item);if(o.prod.extra){item(o.prod.extra[0],'object '+k);got.add(o.prod.extra[0])}}
  if(o.turret&&o.turret.ammo){item(o.turret.ammo,'object '+k+' turret');used.add(o.turret.ammo)}
  if(o.cost&&!o.cat)E(`object ${k}: buildable without a category`);if(o.cat&&!BUILD_CATS.some(c=>c[0]===o.cat))E(`object ${k}: unknown category ${o.cat}`);
  if(o.cost&&!o.hp)E(`object ${k}: buildable without hp`);
  if(o.bp&&!Object.values(ITEMS).some(it=>it.learn&&it.learn.includes(o.bp)))E(`object ${k}: needs schematic "${o.bp}" that no item teaches`);}
// loot
for(const f in LOOT){if(!ROLLS[f])E(`loot ${f}: no ROLLS entry`);for(const r of LOOT[f]){item(r.i,'loot '+f);got.add(r.i)}for(let t=1;t<=5;t++)if(!LOOT[f].some(r=>t>=r.t0&&t<=r.t1)&&!['pod','relic','lab'].includes(f))W(`loot ${f}: nothing at tier ${t}`)}
// creatures
for(const k in ENEMIES){const e=ENEMIES[k];for(const d of e.drop||[]){item(d[0],'creature '+k+' drop');got.add(d[0])}if(e.call)foe(e.call.kind,'creature '+k);for(const a of e.abil||[])if(a.kind)foe(a.kind,'creature '+k+' summon');
  if(e.tide&&!TIDE_COST[k])E(`creature ${k}: in tides but has no TIDE_COST`);if(!e.rig)E(`creature ${k}: no rig`)}
for(const t of TIDE_KINDS)for(const k in t.mix){foe(k,'tide '+t.id);if(!TIDE_COST[k])E(`tide ${t.id}: ${k} has no cost`)}
// world
const gen=(d,where)=>{for(const f of['nodes','props','fill','lock','hazard'])for(const k in d[f]||{})obj(k,where+' '+f);for(const f of['en','inn','night'])for(const k in d[f]||{})foe(k,where+' '+f);
  if(d.boss)foe(d.boss,where+' boss');for(const[b]of d.bld||[])if(!BLD[b])E(`${where}: unknown building "${b}"`);if(d.wall)obj(d.wall,where);if(d.floor&&GT[d.floor]===undefined)E(`${where}: unknown floor "${d.floor}"`);
  if(d.biome&&!BIOMES[d.biome])E(`${where}: unknown biome ${d.biome}`);for(const[it]of d.qi||[]){item(it,where+' qi');got.add(it)}if(d.wave)foe(d.wave.kind,where)};
for(const l of LOCATIONS)gen(l,'location '+l.id);for(const k in SITES)gen(SITES[k],'site '+k);
for(const b in BLD){obj(BLD[b].wall,'building '+b);if(GT[BLD[b].floor]===undefined)E(`building ${b}: unknown floor`);for(const[k]of BLD[b].in)obj(k,'building '+b)}
for(const b in BIOMES){for(const k of BIOMES[b].border)obj(k,'biome '+b);for(const k in BIOMES[b].deco)obj(k,'biome '+b);for(const g of['g','g2','g3'])if(GT[BIOMES[b][g]]===undefined)E(`biome ${b}: unknown ground ${BIOMES[b][g]}`)}
// effects
const fx=(list,where)=>{for(const f of list||[]){const[k,a]=f;if(k==='item'){item(a,where);got.add(a)}else if(k==='take')item(a,where);else if(k==='loot'){if(!LOOT[a])E(`${where}: unknown loot family ${a}`)}else if(k==='fight'){for(const e in a)foe(e,where)}else if(k==='site'){if(!SITES[a])E(`${where}: unknown site ${a}`)}
  else if(!['hp','food','water','tox','time','xp','sp','scrip','surv','survleave','buff','horde','hordeWeak','morale','weather','raid','bp','trade','lose','losefood','crop','flag','turnback'].includes(k))E(`${where}: unknown effect "${k}"`)}};
const ids=new Set();
for(const e of EVENTS){if(ids.has(e.id))E('duplicate event '+e.id);ids.add(e.id);if(!['travel','home'].includes(e.at))E(`event ${e.id}: bad "at"`);
  for(const o of e.o){for(const k in o.need||{})if(k!=='scrip')item(k,'event '+e.id);let p=0;for(const r of o.r){p+=r[0];fx(r[2],'event '+e.id)}if(Math.abs(p-1)>.001)E(`event ${e.id} option "${o.l}": chances sum to ${p}`)}}
for(const q of STORY){fx(q.rw,'quest '+q.id);for(const g of q.goals){if(g.item)item(g.item,'quest '+q.id);if(g.id)item(g.id,'quest '+q.id);if(g.kind&&g.k==='build')obj(g.kind,'quest '+q.id);if(g.kind&&g.k!=='build')foe(g.kind,'quest '+q.id);
  if(g.tag&&!BUILD_TAGS[g.tag])E(`quest ${q.id}: unknown build tag ${g.tag}`);if(g.loc&&!LOCATIONS.some(l=>l.id===g.loc))E(`quest ${q.id}: unknown location ${g.loc}`);if(g.k==='craft'&&!Object.values(RECIPES).some(r=>r.o===g.id))E(`quest ${q.id}: nothing crafts ${g.id}`)}}
for(const l of LOCATIONS)for(const[,flag]of l.qi||[])if(!STORY.some(q=>q.id===flag))E(`location ${l.id}: quest item waits for unknown quest ${flag}`);
for(const row of CONTRACTS.fetch)for(const[it]of row||[])item(it,'contract fetch');for(const row of CONTRACTS.hunt)for(const[k]of row||[])foe(k,'contract hunt');
for(const a of ACHIEVEMENTS)fx(a.rw,'achievement '+a.id);
for(const r of TRADE){item(r[0],'trade');got.add(r[0])}for(const t in TRADE_BP)for(const id of TRADE_BP[t]){item(id,'trade schematics');got.add(id)}
for(const j in JOBS)for(const r of[...(JOBS[j].out||[]),...(JOBS[j].rare||[])]){item(r[0],'job '+j);got.add(r[0])}
for(const id of['water','canned_beans','rags','scrap','rope','bandage','berries','stick','flint'])got.add(id);
// wearables: each needs a look the rig knows how to draw
const STYLES={head:['hood','cap','helm','visor','mask','furhat','combat','gasmask','exo','brim','skull','bandana'],body:['shirt','vest','jacket','coat','duster','plate','riot','carrier','suit','exo','spiked'],legs:['pants','wrap','greaves','guards','cargo','suit','exo','fur','chaps','kilt'],feet:['boots','wraps','heavy','rubber','fur','exo'],hands:['gloves','wraps','gauntlet','exo'],pack:[undefined]};
for(const id in ITEMS){const it=ITEMS[id];if(!STYLES[it.t])continue;if(!it.look||!it.look.c)E(`wearable ${id}: no look`);else if(it.t==='pack'){if(!(it.look.z>=1&&it.look.z<=5))E(`pack ${id}: look.z must be 1..5`)}else if(!STYLES[it.t].includes(it.look.s))E(`wearable ${id}: unknown ${it.t} style '${it.look.s}'`)}
// neighbouring communities
for(const id in FACTIONS){const F=FACTIONS[id],w='community '+id;for(const x of F.likes)item(x,w+' likes');for(const x of F.stock){item(x,w+' stock');got.add(x)}for(const r of F.route){item(r[0],w+' route');got.add(r[0])}for(const r of F.spoils){item(r[0],w+' spoils');got.add(r[0])}for(const k in F.raid)foe(k,w+' raid');
  if(!(F.reg>=1&&F.reg<=5))E(w+': bad region');if(F.start>F.cap)E(w+': start standing above its cap')}
used.add('compost');
// obtainable / used
for(const id in ITEMS){if(!got.has(id))E(`item ${id}: cannot be obtained anywhere`);if(ITEMS[id].t==='mat'&&!used.has(id)&&!STORY.some(q=>q.goals.some(g=>g.item===id)))W(`material ${id}: never used in a recipe or building`)}
// art, icons, sounds
const props=read('js/view/props.js'),icons=read('js/ui/icons.js'),audio=read('js/audio.js');
const has=(src,name)=>new RegExp('(^|[\\s,{;.])["\']?'+name+'["\']?\\s*(\\(|:|=)','m').test(src);
if(props){for(const k of[...new Set(Object.values(OBJ).map(o=>o.m)),'garden_1','garden_2','lootbag','veh_cart','veh_bike','veh_moto','veh_buggy','veh_truck','ghost_tile'])if(!has(props,k))E(`model missing in props.js: ${k}`);
  for(const id in ITEMS)if(ITEMS[id].mdl&&!has(props,ITEMS[id].mdl))E(`hand model missing in props.js: ${ITEMS[id].mdl}`)}else W('js/view/props.js not written yet');
if(icons){for(const id in ITEMS)if(!has(icons,ITEMS[id].ic[0]))E(`icon glyph missing: ${ITEMS[id].ic[0]} (item ${id})`);for(const p of PERKS)if(p.ic&&!has(icons,p.ic))E(`icon glyph missing: ${p.ic} (perk ${p.id})`)}else W('js/ui/icons.js not written yet');
if(audio){const names=new Set();for(const f of fs.readdirSync(path.join(ROOT,'js'),{recursive:true})){if(!String(f).endsWith('.js')||String(f).includes('audio.js'))continue;const src=read('js/'+f);for(const m of src.matchAll(/sfx\(\s*'([a-z_0-9]+)'/g))names.add(m[1]);for(const m of src.matchAll(/'((?:shot|hit)_[a-z]+)'/g))names.add(m[1])}
  for(const n of names)if(!new RegExp('\\b'+n+'\\b').test(audio))E(`sound missing in audio.js: ${n}`)}else W('js/audio.js not written yet');

const n={items:Object.keys(ITEMS).length,recipes:RECIPE_LIST.length,objects:Object.keys(OBJ).length,buildable:Object.values(OBJ).filter(o=>o.cost).length,creatures:Object.keys(ENEMIES).length,locations:LOCATIONS.length,sites:Object.keys(SITES).length,events:EVENTS.length,quests:STORY.length,perks:PERKS.length,achievements:ACHIEVEMENTS.length};
console.log('content: '+Object.entries(n).map(([k,v])=>v+' '+k).join(', '));
for(const w of warns)console.log('  warn  '+w);for(const e of errs)console.log('  ERROR '+e);
console.log(errs.length?`check: ${errs.length} error(s)`:'check: ok'+(warns.length?` (${warns.length} warning(s))`:''));
process.exitCode=errs.length?1:0;

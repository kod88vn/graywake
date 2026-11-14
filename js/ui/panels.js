// Every sheet that slides over the game: pack, crafting, containers, journal, camp, trade, events, settings and the small station dialogs.
// A panel is {title, tabs?, render(arg, tab) → html, act(action, dataset) → false to skip re-render, open?, close?, narrow?, modal?}.
import {G,VERSION,gained,gearScore,betterGear,wearBest,derive,count,take,give,addTo,removeFrom,slotCount,freeSlots,sortInv,equip,unequip,useItem,learnPerk,craft,canCraft,recipeVisible,knows,collectStation,cancelJob,repairWithKit,dropAt,maxHp,hasBuilt,homeStores} from '../sim/core.js';
import * as World from '../sim/world.js';
import {openLoot,lootAll,checkEmpty,plant,cropReady} from '../sim/actors.js';
import {story,goalProgress,goalText,contractText,contractReady,turnIn,dropContract} from '../sim/quests.js';
import {ITEMS,SETS} from '../data/items.js';
import {OBJ} from '../data/objects.js';
import {RECIPE_LIST,RECIPES,STATION_NAMES,VEHICLES} from '../data/recipes.js';
import {EVENTS,TIDE_KINDS} from '../data/events.js';
import {STORY,PERKS,PERK_TREES,ACHIEVEMENTS,SURV_TRAITS,JOBS} from '../data/progress.js';
import {FACTIONS,COMM} from '../data/community.js';
import {REGIONS} from '../data/world.js';
import {sourcesOf} from '../data/sources.js';
import {dayOf} from '../sim/util.js';
import {$,esc,img,gimg,slot,chips,tags,bus,fmtMin,TYPE_NAMES} from './dom.js';

const UI=()=>bus.UI,S=()=>G.S;
const btn=(label,a,extra='',cls='')=>`<button class="btn ${cls}" data-a="${a}" ${extra}>${label}</button>`;
const sec=(l,r='')=>`<div class="sec"><span>${l}</span><span>${r}</span></div>`;
const DIRS=['north','east','south','west'];
export const PANELS={};

// ---------------------------------------------------------------- pack
let sel=null;
const EQ=[['w1','Hand'],['w2','Spare'],['head','Head'],['body','Body'],['hands','Hands'],['legs','Legs'],['feet','Feet'],['pack','Pack']];
/** The slot of the most worn thing the player has on (weapons and clothes), or null if nothing is worn at all. */
function mostWorn(p){let best=null,bf=1;for(const k in p.eq){const e=p.eq[k],it=e&&ITEMS[e.id];if(!it||!it.dur||e.d===undefined)continue;const f=e.d/it.dur;if(f<bf-1e-9){bf=f;best=k}}return best}
function itemCard(s,actions){
  if(!s)return`<div class="card"><p>Select something to see what it does.</p></div>`;const it=ITEMS[s.id];
  return`<div class="card"><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div style="width:52px;flex:none">${slot({id:s.id})}</div><div style="min-width:0"><h3>${esc(it.n)}${s.n>1?' × '+s.n:''}</h3><small style="color:var(--dim)">${TYPE_NAMES[it.t]||''}</small></div></div>${it.d?`<p>${esc(it.d)}</p>`:''}${tags(it,s)}${sourcesOf(s.id)?`<p style="font-size:12.5px">Where it comes from: ${esc(sourcesOf(s.id))}.</p>`:''}${it.set?`<p>${esc(SETS[it.set].n)} (all four pieces): ${esc(SETS[it.set].d)}</p>`:''}<div class="row">${actions}</div></div>`;
}
PANELS.inv={title:'Pack',live:true,open(){sel=null},
  render(){
    const s=S(),p=s.p,cap=slotCount(s),ds=G.ds=derive(s),up=betterGear(s),upAt=new Set(up.map(b=>b.i));let g='';
    // a green corner marks what would be better on you or in your hand than what is there now
    for(let i=0;i<cap;i++)g+=slot(p.inv[i],`data-a="sel" data-i="${i}"`,(sel&&sel.src==='inv'&&sel.i===i?'sel':'')+(upAt.has(i)?' up':''));
    let eq='';for(const[k,l]of EQ){const e=p.eq[k];eq+=`<button class="sl ${sel&&sel.src==='eq'&&sel.slot===k?'sel':''} ${p.active===k?'sel':''}" data-a="seleq" data-slot="${k}" title="${l}"><em>${l}</em>${e?slot(e).replace(/^<button[^>]*>|<\/button>$/g,''):''}</button>`}
    let card;
    if(sel&&sel.src==='inv'&&p.inv[sel.i]){const it=ITEMS[p.inv[sel.i].id];let a='';
      if(it.t==='food')a+=btn(it.water>(it.food||0)?'Drink':'Eat','use','','go');else if(it.t==='med')a+=btn('Use','use','','go');else if(it.t==='bp')a+=btn('Learn','use','','go');
      else if(['melee','gun','tool','throw'].includes(it.t)){a+=btn('Equip','equip','data-slot="w1"','go')+btn('Equip as spare','equip','data-slot="w2"')}
      else if(['head','body','legs','feet','hands','pack'].includes(it.t))a+=btn('Wear','use','','go');
      else if(p.inv[sel.i].id==='flare')a+=btn('Fire','flare','','go');
      // one button for each worn thing you have on or in hand, most worn first: the kit is yours to spend where you choose
      else if(p.inv[sel.i].id==='repair_kit'){const worn=Object.keys(p.eq).filter(k=>{const e=p.eq[k],it=e&&ITEMS[e.id];return it&&it.dur&&e.d!==undefined&&e.d<it.dur}).sort((x,y)=>p.eq[x].d/ITEMS[p.eq[x].id].dur-p.eq[y].d/ITEMS[p.eq[y].id].dur).slice(0,4);
        a+=worn.length?worn.map((w,j)=>btn('Repair '+ITEMS[p.eq[w].id].n+' ('+Math.round(p.eq[w].d/ITEMS[p.eq[w].id].dur*100)+'%)','kitOn',`data-slot="${w}"`,j?'':'go')).join(''):'<small style="color:var(--dim)">Nothing you have on is worn.</small> '}
      a+=btn(p.inv[sel.i].n>1?'Drop one':'Drop','drop')+(p.inv[sel.i].n>1?btn('Drop all','dropall'):'');
      const b=up.find(b=>b.i===sel.i);card=itemCard(p.inv[sel.i],a);if(b)card=card.replace('<div class="row">',`<p class="okc">${b.was?'Better than the '+esc(ITEMS[b.was].n)+' you have '+(b.slot==='w1'||b.slot==='w2'?'in hand':'on')+'.':b.slot==='w1'||b.slot==='w2'?'You have a hand free for it.':'You have nothing on there.'}</p><div class="row">`)}
    else if(sel&&sel.src==='eq'&&p.eq[sel.slot]){const e=p.eq[sel.slot],it=ITEMS[e.id];card=itemCard(e,btn('Take off','unequip','','go')+(it.dur&&e.d<it.dur&&count(s,'repair_kit')?btn('Use repair kit','kit'):'')+(sel.slot==='w1'||sel.slot==='w2'?btn('Make active','active'):''))}
    else card=itemCard(null);
    const kv=[['Health',Math.ceil(p.hp)+' / '+ds.maxHp],['Armour',ds.arm+' (−'+Math.round(ds.armRed*100)+'% damage)'],['Cold resistance',Math.round(ds.cold*100)+'%'],['Toxin resistance',Math.round(ds.tox*100)+'%'],['Move speed',ds.spd.toFixed(1)],['Melee damage','×'+ds.melee.toFixed(2)],['Ranged damage','×'+ds.ranged.toFixed(2)],['Set bonus',ds.set?SETS[ds.set].n:'none'],['Vehicle',VEHICLES[s.veh].n],['Scrip',s.scrip]];
    return`<div class="cols w3"><div>${sec('Carried '+p.inv.filter(Boolean).length+' / '+cap,btn('Sort','sort'))}<div class="grid">${g}</div><div style="height:10px"></div>${card}</div>
      <div>${sec('Equipped',btn(up.length?'Wear best ('+up.length+')':'Wear best','best','title="Put on and take in hand the best of what you carry"',up.length?'go':''))}<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${eq}</div><div style="height:12px"></div>${sec('You',ds.set?SETS[ds.set].n+': '+SETS[ds.set].d:(['body','legs','feet'].every(k=>!p.eq[k])?'Nothing on: make rag clothes by hand':''))}<div id="doll" style="height:300px;background:radial-gradient(ellipse at 50% 60%,rgba(255,255,255,.07),rgba(0,0,0,0) 70%);border:1px solid var(--line);margin-bottom:8px"></div><div class="kv">${kv.map(([a,b])=>`<span>${a}</span><span class="num">${b}</span>`).join('')}</div></div></div>`;
  },
  act(a,d){
    const s=S(),p=s.p;
    if(a==='sel'){const i=+d.i;if(sel&&sel.src==='inv'&&sel.i!==i&&p.inv[sel.i]&&!p.inv[i]){p.inv[i]=p.inv[sel.i];p.inv[sel.i]=null;sel={src:'inv',i}}else if(sel&&sel.src==='inv'&&sel.i===i&&p.inv[i]){PANELS.inv.act(defaultAct(p.inv[i]),{slot:'w1'})}else sel=p.inv[i]?{src:'inv',i}:null}
    else if(a==='seleq'){sel=p.eq[d.slot]?{src:'eq',slot:d.slot}:null}
    else if(a==='sort'){sortInv(p.inv,slotCount(s));sel=null}
    else if(a==='best'){wearBest(s);sel=null;bus.emitEq()}
    else if(!sel)return;
    else if(a==='use'){useItem(s,sel.i);if(!p.inv[sel.i])sel=null}
    else if(a==='equip'){equip(s,sel.i,d.slot);if(!p.inv[sel.i])sel=null}
    else if(a==='flare'){if(World.useFlare(s,sel.i))return false}
    else if(a==='drop'||a==='dropall'){const it=p.inv[sel.i],n=a==='drop'?1:it.n;if(G.Z&&G.Z.pl)Object.assign(dropAt(G.Z,G.Z.pl.x+Math.cos(G.Z.pl.a)*1.1,G.Z.pl.y+Math.sin(G.Z.pl.a)*1.1,[{id:it.id,n,d:it.d}]),{full:G.Z.time+6,mine:1});/* what you put down yourself, auto mode and walking over it leave alone (E still picks it up) */it.n-=n;if(it.n<=0){p.inv[sel.i]=null;sel=null}}
    else if(a==='unequip'){unequip(s,sel.slot);sel=null}
    else if(a==='kit'){repairWithKit(s,sel.slot)}
    else if(a==='kitOn'){repairWithKit(s,d.slot);if(!p.inv[sel.i])sel=null}
    else if(a==='active'){p.active=sel.slot;bus.emitEq()}
  }};
const defaultAct=it=>{const t=ITEMS[it.id].t;return['melee','gun','tool','throw'].includes(t)?'equip':'use'};

// ---------------------------------------------------------------- crafting
function recipeRow(r,at,tier){
  const s=S(),it=r.fx?null:ITEMS[r.o],name=r.fx?VEHICLES[r.fx.veh].n:it.n,vis=recipeVisible(s,r),higher=r.s!=='hand'&&r.sl>tier;
  let lock='';if(!vis)lock=r.bp?'Schematic needed':'Level '+r.lv;else if(higher){const up=Object.values(OBJ).find(o=>o.station===r.s&&o.sl===r.sl);lock='Needs '+(up?up.n:'a better station')}
  const why=lock?lock:canCraft(s,r,1,at),home=!!(G.Z&&G.Z.home);let max=99;for(const k in r.i)max=Math.min(max,Math.floor(count(s,k,home)/r.i[k]));if(r.fx)max=Math.min(max,1);
  const ic=r.fx?gimg('cart','#8a8f6a'):img(r.o);
  // when something is short, say where it comes from
  const short=!lock&&why?Object.keys(r.i).find(k=>count(s,k,home)<r.i[k]):null,src=short?sourcesOf(short):'';
  return`<div class="rec ${why?'off':''}">${ic}<div><b>${esc(name)}${r.q>1?' × '+r.q:''}</b> <small>${r.t?fmtMin(r.t):''}${lock?' · '+lock:''}${!r.fx&&count(s,r.o,home)?' · you have '+count(s,r.o,home):''}</small>${chips(r.i)}${src?`<small style="display:block;color:var(--dim)">To get ${esc(ITEMS[short].n)}: ${esc(src)}</small>`:''}${r.fx?`<small>${esc(VEHICLES[r.fx.veh].d)}</small>`:it.d&&!why?'':''}</div>
    <div class="row" style="flex-wrap:nowrap">${why?`<small style="color:var(--dim);max-width:110px;text-align:right">${lock?'':esc(why)}</small>`:btn('Make','make',`data-r="${r.id}" data-n="1"`,'go')+(max>=2?btn('×'+Math.min(max,r.t?10:max>20?20:max),'make',`data-r="${r.id}" data-n="${Math.min(max,r.t?10:max>20?20:max)}" title="Make ${Math.min(max,r.t?10:max>20?20:max)} ${r.q>1?'batches at once: '+Math.min(max,r.t?10:max>20?20:max)*r.q+' '+esc(name):'at once'}"`):'')}</div></div>`;
}
PANELS.craft={title:a=>a!=null&&G.Z&&G.Z.obj[a]?OBJ[G.Z.obj[a].k].n:'Crafting',live:true,
  open(a){if(a!=null&&G.Z&&G.Z.obj[a]&&G.Z.obj[a].out)collectStation(S(),a)},
  /** Called every frame while the sheet is open: the station keeps working. Returns true when the sheet should be redrawn. */
  tick(a,dt){const o=a!=null&&G.Z?G.Z.obj[a]:null;if(!o||!o.q||!o.q.length)return false;const n=o.q.length,units=o.q[0].n;World.benchTick(a,dt);
    if(!o.q.length||o.q.length!==n||o.q[0].n!==units)return true;const j=o.q[0],r=RECIPES[j.id],p=$('jobp'),t=$('jobt');if(p)p.style.width=Math.round((1-j.left/r.t)*100)+'%';if(t)t.textContent=fmtMin(j.left+(j.n-1)*r.t)+' left';return false},
  tabs(a){const o=a!=null&&G.Z&&G.Z.obj[a];return o&&OBJ[o.k].station?[['st',STATION_NAMES[OBJ[o.k].station]],['hand','By hand']]:[['hand','By hand']]},
  render(a,tab){
    const s=S(),o=a!=null&&G.Z?G.Z.obj[a]:null,d=o?OBJ[o.k]:null,st=tab==='st'&&d?d.station:'hand',tier=tab==='st'&&d?d.sl:9;let h='';
    if(tab==='st'&&o){
      if(o.out){h+=sec('Waiting in the tray: your pack was full',btn('Collect all','collect','','go'))+`<div class="grid" style="margin-bottom:10px">${Object.entries(o.out).map(([id,n])=>slot({id,n})).join('')}</div>`}
      if(o.q&&o.q.length){h+=sec('Working','goes to your pack when done')+`<div class="list" style="margin-bottom:10px">${o.q.map((j,qi)=>{const r=RECIPES[j.id];return`<div class="rec">${img(r.o)}<div><b>${esc(ITEMS[r.o].n)} × ${j.n*r.q}</b><div class="prog"><i ${qi?'':'id="jobp"'} style="width:${qi?0:Math.round((1-j.left/r.t)*100)}%"></i></div><small ${qi?'':'id="jobt"'}>${qi?'queued':fmtMin(j.left+(j.n-1)*r.t)+' left'}</small></div>${btn('Cancel','cancel',`data-q="${qi}"`)}</div>`}).join('')}</div>`}
      if(d.up)h+=`<p style="color:var(--dim);font-size:12px;margin:0 0 8px">Upgrade this to a ${esc(OBJ[d.up].n)} in build mode for more recipes.</p>`;
    }
    const rows=RECIPE_LIST.filter(r=>r.s===st&&(recipeVisible(s,r)||r.lv<=s.p.lvl+5)).map(r=>({r,k:(recipeVisible(s,r)&&!(r.s!=='hand'&&r.sl>tier))?(canCraft(s,r,1,tab==='st'?a:null)?1:0):2})).sort((x,y)=>x.k-y.k||x.r.lv-y.r.lv);
    h+=rows.length?`<div class="list">${rows.map(x=>recipeRow(x.r,tab==='st'?a:null,tier)).join('')}</div>`:'<p style="color:var(--dim)">Nothing to make here yet.</p>';
    if(tab==='hand'&&a==null)h+=`<p style="color:var(--dim);font-size:12px">Most things need a station. Build a campfire and a workbench, then walk up to them and press E.</p>`;
    return h;
  },
  act(a,d,el){const s=S(),at=UI().panel&&cur_at();if(a==='make')craft(s,d.r,+d.n,curTabIsStation()?at:null);else if(a==='collect')collectStation(s,at);else if(a==='cancel')cancelJob(s,at,+d.q)}};
let craftAt=null,craftTab='hand';const cur_at=()=>craftAt,curTabIsStation=()=>craftTab==='st';
{const P=PANELS.craft,r0=P.render;P.render=(a,tab)=>{craftAt=a;craftTab=tab;return r0(a,tab)}}
PANELS.station={can(i){setTimeout(()=>UI().open('craft',i),0);return false}};

// ---------------------------------------------------------------- containers and storage
// How many slots a container shows. A storage box has its own size. Anything else is as big as what is in it, and away from home (or a dropped pack anywhere)
// keeps a free slot or more to the end of the row, so that someone with a full pack can put one thing down to pick another up.
function lootCap(o){const d=OBJ[o.k];if(d.store)return d.store;const n=o.inv.length;return Math.max(8,G.Z.home&&d.special!=='deathbag'?n:8*Math.ceil((o.inv.filter(Boolean).length+1)/8),n)}
PANELS.loot={title:i=>G.Z&&G.Z.obj[i]?OBJ[G.Z.obj[i].k].n:'Container',live:true,
  open(i){const o=G.Z.obj[i];if(o&&!o.inv){if(OBJ[o.k].store)o.inv=[];else openLoot(G.Z,i)}},
  render(i){
    const s=S(),o=G.Z.obj[i];if(!o)return'';const d=OBJ[o.k],store=!!d.store,cap=lootCap(o),pc=slotCount(s);
    let a='',b='';for(let k=0;k<cap;k++)a+=slot(o.inv[k],`data-a="take" data-i="${k}"`);for(let k=0;k<pc;k++)b+=slot(s.p.inv[k],`data-a="put" data-i="${k}"`);
    return`<div class="cols"><div>${sec(esc(d.n)+(store?' '+o.inv.filter(Boolean).length+' / '+cap:''),btn('Take all','all','','go')+(store?' '+btn('Sort','sortc'):''))}<div class="grid">${a}</div></div>
      <div>${sec('Your pack '+s.p.inv.filter(Boolean).length+' / '+pc,store?btn('Stow materials','stow'):'')}<div class="grid">${b}</div><p style="color:var(--dim);font-size:12px">Tap an item on either side to move the whole stack across.${store?' Crafting and building at home draw from every storage box.':G.Z.home?' Anything you leave in here stays here.':' Anything you leave here is gone when you leave the area.'}</p></div></div>`;
  },
  act(a,d){
    const s=S(),Z=G.Z,i=curLoot,o=Z.obj[i];if(!o)return;const dd=OBJ[o.k],cap=lootCap(o);
    if(a==='take'){const it=o.inv[+d.i];if(!it)return;const left=addTo(s.p.inv,slotCount(s),it.id,it.n,it.d);if(left===it.n){UI().toast('Pack full','bad');return}s.codex.it[it.id]=1;if(left>0)it.n=left;else o.inv[+d.i]=null;gained(s,it.id);sfxq('pickup')}
    else if(a==='put'){const it=s.p.inv[+d.i];if(!it)return;const left=addTo(o.inv,cap,it.id,it.n,it.d);if(left===it.n){UI().toast('No room in there','bad');return}if(left>0)it.n=left;else s.p.inv[+d.i]=null;o.kept=1;sfxq('pickup')}
    else if(a==='all'){if(dd.store){for(let k=0;k<o.inv.length;k++){const it=o.inv[k];if(!it)continue;const left=addTo(s.p.inv,slotCount(s),it.id,it.n,it.d);if(left<it.n)gained(s,it.id);if(left>0)it.n=left;else o.inv[k]=null}}else lootAll(Z,i);sfxq('pickup');
      const o2=Z.obj[i],rest=o2&&o2.inv?o2.inv.filter(Boolean).length:0;if(rest)UI().toast('Pack full: '+rest+' '+(rest>1?'stacks':'stack')+' still in there','bad')}
    else if(a==='stow'){for(let k=0;k<s.p.inv.length;k++){const it=s.p.inv[k];if(!it||!['mat','seed','ammo'].includes(ITEMS[it.id].t))continue;const left=addTo(o.inv,cap,it.id,it.n,it.d);if(left>0)it.n=left;else s.p.inv[k]=null}sfxq('pickup')}
    else if(a==='sortc'){sortInv(o.inv,cap)}
    if(a==='all'&&!dd.store&&o.inv&&!o.inv.some(Boolean)){UI().close();return false}
  },
  close(i){if(G.Z&&G.Z.obj[i]&&!OBJ[G.Z.obj[i].k].store)checkEmpty(G.Z,i)}};
let curLoot=null;{const P=PANELS.loot,r0=P.render;P.render=i=>{curLoot=i;return r0(i)}}
PANELS.store=PANELS.loot;
const sfxq=n=>G.ev.push(['sfx',n]);

// ---------------------------------------------------------------- journal
PANELS.journal={title:'Journal',live:true,tab:a=>a||'story',
  tabs(){const s=S();return[['story','Story'],['contracts','Contracts',s.q.contracts.some(c=>contractReady(s,c))],['perks','Perks',s.p.sp>0],['records','Records']]},
  render(a,tab){
    const s=S();
    if(tab==='story'){const q=story(s);if(!q)return'<div class="card"><h3>The wake has passed</h3><p>There is nothing left that anyone is asking of you. The valley is yours.</p></div>';
      return`<div class="card"><small class="h" style="color:var(--amber2)">${q.who==='mer'?'Meridian Station, on the radio':'Your journal'} · ${s.q.i+1} of ${STORY.length}</small><h3>${esc(q.t)}</h3><div class="quote">${esc(q.x)}</div>
        ${q.goals.map(g=>{const[c,n]=goalProgress(s,g);return`<div class="goal ${c>=n?'ok':''}"><span>${esc(goalText(g))}</span><span class="num">${c} / ${n}</span></div>`}).join('')}
        ${q.goals.some(g=>g.k==='deliver')?'<p>Bring it back to the homestead.</p>':''}</div>
        ${s.q.done.length?sec('Behind you')+`<div class="tags">${s.q.done.slice(-12).map(id=>`<span>${esc(STORY.find(q=>q.id===id).t)}</span>`).join('')}</div>`:''}`}
    // (contracts already taken can still be finished and handed in without a mast: an enclave that moved valleys kept them and could not reach them)
    if(tab==='contracts'){if(!hasBuilt(s,o=>o.special==='radio')&&!(s.q.contracts&&s.q.contracts.length))return'<div class="card"><h3>No signal</h3><p>Build a Radio Mast at home. People out there have work, and they pay in scrip, schematics and ammunition.</p></div>';
      // the leads on the air right now, with how hard each is for you: the mast is where a player goes looking for them
      const air=s.sites.map(x=>World.leadInfo(s,x)).filter(I=>I&&I.left>0&&!I.done);
      const onAir=air.length?`<div class="card"><h3>On the radio now</h3>${air.map(I=>`<p style="margin:4px 0"><b>${esc(I.name)}</b> · <span class="${I.skulls>=4?'danger':I.skulls===3?'amb':'okc'}">${esc(I.word)} for you as you stand</span> · ${esc(fmtMin(I.left))} left${I.boss?' · held by '+esc(I.boss):''}</p>`).join('')}<small style="color:var(--dim)">Marked on your map (M). Walk to the edge of the homestead to set out.</small></div>`:'';
      return onAir+(s.q.contracts.length?`<div class="list">${s.q.contracts.map(c=>{const rdy=contractReady(s,c),have=c.type==='fetch'?Math.min(c.n,count(s,c.item,true)):c.have;
        return`<div class="rec">${c.type==='fetch'?img(c.item):gimg(c.type==='hunt'?'skull':'map')}<div><b>${esc(contractText(c))}</b><br><small>${esc(c.giver)} · pays ${c.pay} scrip, ${c.xp} xp · ${have} / ${c.n}</small></div><div class="row" style="flex-wrap:nowrap">${btn('Hand in','turn',`data-id="${c.id}" ${rdy?'':'disabled'}`,'go')}${btn('Drop','dropc',`data-id="${c.id}"`)}</div></div>`}).join('')}</div>`:'<p style="color:var(--dim)">Nothing on the board. New work comes in at dawn.</p>')
        +(s.flags.core_dead?`<div class="card" style="margin-top:12px"><h3>Mutation tier ${s.mut}</h3><p>The Gray adapts. Raise the tier and everything out there grows stronger, tides included, and carries more. There is no way back down.</p>${btn('Raise the tier','mut','','bad')}</div>`:'')}
    if(tab==='perks'){return`<div class="card" style="margin-bottom:10px"><b class="h" style="color:var(--amber2)">${s.p.sp} point${s.p.sp===1?'':'s'} to spend</b> <small style="color:var(--dim)">One per level.</small></div><div class="cols">${PERK_TREES.map(t=>`<div>${sec(t)}<div class="list">${PERKS.filter(p=>p.tree===t).map(p=>{const r=s.p.perks[p.id]||0;return`<div class="perk">${gimg(p.ic,r?'#e3a432':'#6a6a5a')}<div><b>${esc(p.n)}</b><small>${esc(p.d)}</small></div><div class="row" style="flex-wrap:nowrap"><span class="pips num">${r} / ${p.max}</span>${btn('+','perk',`data-id="${p.id}" ${s.p.sp>0&&r<p.max?'':'disabled'}`,'go')}</div></div>`}).join('')}</div></div>`).join('')}</div>`}
    const st=s.stats,kv=[['Day',dayOf(s.t)],['Level',s.p.lvl],['Hostiles put down',st.kills||0],['Tides survived',st.tides||0],['Structures built',st.built||0],['Things crafted',st.crafted||0],['Containers opened',st.opened||0],['Places visited',st.locs||0],['Bosses killed',st.bosses||0],['Deaths',st.deaths||0],['Schematics learned',st.schematics||0],['Scrip earned',st.earned||0]];
    return`<div class="cols"><div>${sec('Achievements '+Object.keys(s.ach).length+' / '+ACHIEVEMENTS.length)}<div class="list">${ACHIEVEMENTS.map(x=>{const v=Math.min(x.v,st[x.s]||0),done=s.ach[x.id];return`<div class="rec" style="grid-template-columns:minmax(0,1fr) auto"><div><b style="${done?'color:var(--green)':''}">${esc(x.n)}</b><br><small>${esc(x.d)}</small><div class="prog"><i style="width:${v/x.v*100}%"></i></div></div><small class="num">${done?'✓':v+' / '+x.v}</small></div>`}).join('')}</div></div><div>${sec('Tally')}<div class="kv">${kv.map(([k,v])=>`<span>${k}</span><span class="num">${v}</span>`).join('')}</div></div></div>`;
  },
  act(a,d){const s=S();if(a==='turn')turnIn(s,+d.id);else if(a==='dropc')dropContract(s,+d.id);else if(a==='perk')learnPerk(s,d.id);else if(a==='mut'){World.raiseMutation(s)}}};
PANELS.radio={can(){setTimeout(()=>UI().open('journal','contracts'),0);return false}};

// ---------------------------------------------------------------- camp
const CM=()=>World.Community,ROMAN=['','I','II','III','IV','V'],campSel={gift:null,runner:{},party:{},seed:null};
const daysLeft=x=>x===Infinity?'nobody to feed':x>=10?'10+ days':Math.floor(x)+(Math.floor(x)===1?' day':' days');
const lowCol=x=>x<2?'var(--red)':x<4?'var(--amber2)':'var(--green)';
PANELS.camp={title:'Camp ledger',live:true,tab:a=>a||'camp',
  tabs(){const s=S();return[['camp','Camp'],['people','People '+s.surv.length,s.wait.length>0],['farm','Farm',CM().farm(s).ripe>0],['others','Neighbours',CM().known(s).some(id=>CM().fac(s,id).raidAt>0&&hasBuilt(s,o=>o.special==='radio'))]]},
  render(a,tab){
    const s=S(),C=CM();
    if(tab==='people'){
      const cap=World.survCap(s);let h='';
      if(s.wait.length)h+=sec('Asking to join','They wait a few days, then move on')+`<div class="list">${s.wait.map(c=>`<div class="rec">${gimg('people','#e0a84a')}<div><b>${esc(c.n)}</b> <small>${esc(c.how)} · waits ${fmtMin(Math.max(0,c.until-s.t))}</small><br><small>${esc(SURV_TRAITS[c.trait].n)}: ${esc(SURV_TRAITS[c.trait].d)}</small></div><div class="row">${btn('Recruit','recruit',`data-id="${c.id}"`,'go')}${btn('Turn away','away',`data-id="${c.id}"`)}</div></div>`).join('')}</div><div style="height:12px"></div>`;
      h+=sec('Survivors '+s.surv.length+' / '+World.survRoom(s)+' · beds for '+cap+' (most a homestead supports: '+World.BASE_PEOPLE+')','Morale '+s.morale)+`<div class="prog" style="margin-bottom:8px"><i style="width:${s.morale}%;background:${s.morale<30?'var(--red)':s.morale<60?'var(--amber)':'var(--green)'}"></i></div>`;
      h+=s.surv.length?`<div class="list">${s.surv.map(v=>{const rt=C.routeOf(s,v.id),st=v.hurt>0?`<span style="color:var(--red)">Hurt: back in ${v.hurt} day${v.hurt===1?'':'s'}</span>`:v.away?'<span style="color:var(--amber2)">Out with the war party until dawn</span>':rt?`<span style="color:var(--amber2)">Walks the trade run to ${esc(FACTIONS[rt].n)} every day</span>`:esc(JOBS[v.job].d);
        return`<div class="rec">${gimg('people','#8a9a78')}<div><b>${esc(v.n)}</b> <small>${v.job!=='idle'||rt?esc(rt?'Runner':(JOBS[v.job]||JOBS.idle).n)+' '+ROMAN[C.svLevel(v)]+' · ':''}day ${v.days}</small><br><small>${esc(SURV_TRAITS[v.trait].n)}: ${esc(SURV_TRAITS[v.trait].d)}</small><br><small style="color:var(--ink)">${st}</small></div><div class="row">${rt?`<small style="color:var(--dim)">Runs the trade route to ${esc(FACTIONS[rt]?FACTIONS[rt].n:rt)}, so has no job here.</small> ${btn('Bring home to work','routeoff',`data-id="${rt}" title="Close the route to ${esc(FACTIONS[rt]?FACTIONS[rt].n:rt)}"`)}`:`<div class="row" style="gap:4px;flex-wrap:wrap">${Object.entries(JOBS).map(([j,J])=>`<button class="btn ${v.job===j?'go':''}" style="padding:2px 8px;font-size:12px" data-a="job" data-id="${v.id}" data-j="${j}" title="${esc(J.d)}">${J.n}</button>`).join('')}</div>`}${btn('Ask to leave','dismiss',`data-id="${v.id}"`)}</div></div>`}).join('')}</div>`
        :`<div class="card"><p>Nobody yet. People you free from cages, meet on the road or draw in with a signal fire will ask to join; you decide here. Every bed beyond your own houses one more. Each person needs one meal and one drink a day from your storage boxes, and gets better at a job the longer they do it.</p></div>`;
      return h;
    }
    if(tab==='farm'){
      const f=C.farm(s),seeds=[...new Set(s.p.inv.filter(x=>x&&ITEMS[x.id].t==='seed').map(x=>x.id))],home=G.Z&&G.Z.home,farmers=s.surv.filter(v=>v.job==='farm').length;
      if(!seeds.includes(campSel.seed))campSel.seed=seeds[0]||null;
      if(!f.beds)return'<div class="card"><h3>No garden beds yet</h3><p>Build garden beds (Build, Farm) and plant seeds from tall grass, kitchen cabinets and caravans. Rain catchers and wells give water, a compost heap gives compost, hens and bees give eggs and honey. A survivor set to Farmer harvests and replants for you.</p></div>';
      let h=`<div class="card"><small class="h" style="color:var(--amber2)">Garden beds</small><h3>${f.beds} bed${f.beds===1?'':'s'}: ${f.ripe} ripe, ${f.growing} growing, ${f.empty} empty</h3><div class="tags">${f.next<Infinity?`<span>next harvest in ${fmtMin(f.next)}</span>`:''}<span>${farmers?farmers+' farmer'+(farmers===1?'':'s')+' tending':'no farmer assigned'}</span><span>water ×${count(s,'water')+count(s,'dirty_water')}</span><span>compost ×${count(s,'compost')}</span></div>
        <div class="row" style="margin-top:8px">${btn('Harvest ripe'+(f.ripe?' ('+f.ripe+')':''),'harvest',f.ripe&&home?'':'disabled','go')}${btn('Water growing beds'+(f.dry?' ('+f.dry+')':''),'water',f.dry&&home?'':'disabled')}${btn('Compost growing beds'+(f.unfed?' ('+f.unfed+')':''),'compost',f.unfed&&home?'':'disabled')}</div>
        <div class="row" style="margin-top:8px">${seeds.length?`<select class="sel2" data-c="seed" id="farmseed">${seeds.map(id=>`<option value="${id}" ${campSel.seed===id?'selected':''}>${esc(ITEMS[id].n)} ×${count(s,id)}</option>`).join('')}</select>${btn('Plant empty beds'+(f.empty?' ('+f.empty+')':''),'plantall',f.empty&&home?'':'disabled','go')}`:'<small>No seeds in your pack.</small>'}${btn('Replant after harvest: '+(s.set.replant?'on':'off'),'replant')}</div>
        ${home?'':'<p style="color:var(--dim)">You have to be home to work the beds.</p>'}</div>`;
      const rows=Object.entries(f.crops);if(rows.length)h+=`<div style="height:12px"></div>${sec('In the ground')}<div class="list">${rows.map(([id,c])=>`<div class="rec">${img(ITEMS[id].crop)}<div><b>${esc(ITEMS[ITEMS[id].crop].n)}</b> <small>${c.n} bed${c.n===1?'':'s'}${c.ripe?' · '+c.ripe+' ripe':''}</small><br><small>${ITEMS[id].yield[0]}–${ITEMS[id].yield[1]} a bed every ${fmtMin(ITEMS[id].grow)}</small></div></div>`).join('')}</div>`;
      h+=`<p style="color:var(--dim);font-size:12px">Watering a growing bed takes a quarter off the time left (one water each). Compost gives half again the harvest (one compost each). Rain, a scarecrow nearby and farmers all speed growth.</p>`;
      return h;
    }
    if(tab==='others'){
      const ids=C.known(s);if(!ids.length)return'<div class="card"><p>You have not heard of anyone else yet.</p></div>';
      const free=s.surv.filter(v=>C.available(v)&&!C.routeOf(s,v.id));
      return`<p style="color:var(--dim);font-size:12px;margin:0 0 8px">Other communities, run by the game, not by other players. Scrip: ${s.scrip}. Gifts raise standing; trade routes need ${COMM.routeAt}, a pact ${COMM.pactAt}. Below ${COMM.routeAt} you can send a war party or hunt down their forward camp; at −50 or below they raid you.</p><div class="list">`+ids.map(id=>{const F=FACTIONS[id],fs=C.fac(s,id),rel=C.relOf(fs.st),sv=fs.route&&s.surv.find(v=>v.id===fs.route.sv),tags=[];
        if(fs.dead)return`<div class="card" style="opacity:.6"><small class="h">${esc(REGIONS[F.reg].n)}</small><h3>${esc(F.n)} · broken</h3><p>Nobody answers there any more.</p></div>`;
        if(fs.route)tags.push(`<span>route: ${esc(sv?sv.n:'nobody')} · ${fs.route.n} runs</span>`);if(fs.pact)tags.push('<span>pact: sends fighters when a tide lands</span>');if(fs.raidAt>0&&hasBuilt(s,o=>o.special==='radio'))tags.push(`<span style="color:var(--red)">raid on the road: ${fmtMin(Math.max(0,fs.raidAt-s.t))}</span>`);
        if(s.sites.some(x=>x.fac===id))tags.push('<span>forward camp marked on the map</span>');
        const A=[];
        A.push(btn('Gift 25 scrip','gift',`data-id="${id}"`+(s.scrip<25?' disabled':'')),btn(campSel.gift===id?'Close gifts':'Gift from pack','giftopen',`data-id="${id}"`));
        if(fs.st>=-15&&F.stock.length)A.push(btn('Call their caravan','caravan',`data-id="${id}"`));
        if(F.route.length){if(fs.route)A.push(btn('Close trade route','routeoff',`data-id="${id}"`));else if(fs.st>=COMM.routeAt){if(!free.find(v=>v.id===campSel.runner[id]))campSel.runner[id]=free[0]?free[0].id:null;A.push(free.length?`<select class="sel2" data-c="runner" data-id="${id}" id="run${id}">${free.map(v=>`<option value="${v.id}" ${campSel.runner[id]===v.id?'selected':''}>${esc(v.n)}</option>`).join('')}</select>`+btn('Open trade route · '+COMM.routeCost+' scrip','route',`data-id="${id}"`+(s.scrip<COMM.routeCost?' disabled':''),'go'):'<small>Trade route: nobody free to walk it</small>')}}
        if(!fs.pact&&fs.st>=COMM.pactAt)A.push(btn('Stand together (pact)','pact',`data-id="${id}"`,'go'));
        if(fs.pact)A.push(btn('Ask for a volunteer · '+COMM.volunteerCost+' scrip','vol',`data-id="${id}"`+(s.scrip<COMM.volunteerCost||s.t<fs.volAt?' disabled':'')));
        if(fs.st<-15)A.push(btn('Pay them off · '+C.tributeCost(s,id)+' scrip','tribute',`data-id="${id}"`+(s.scrip<C.tributeCost(s,id)?' disabled':'')));
        const B=[];if(fs.st>=COMM.routeAt){}else if(free.length){const n=Math.min(free.length,Math.max(1,campSel.party[id]||free.length));campSel.party[id]=n;B.push(`<select class="sel2" data-c="party" data-id="${id}" id="par${id}">${free.map((v,i)=>`<option value="${i+1}" ${n===i+1?'selected':''}>${i+1} fighter${i?'s':''}</option>`).join('')}</select>`+btn('Send a war party','war',`data-id="${id}"`,'bad'))}
        if(fs.st<COMM.routeAt)B.push(btn('Find their forward camp','camp',`data-id="${id}"`+(s.sites.some(x=>x.fac===id)?' disabled':''),'bad'));
        let gifts='';if(campSel.gift===id){const st=s.p.inv.map((x,i)=>[x,i]).filter(([x])=>x&&ITEMS[x.id].v>0);gifts=`<div style="margin-top:8px">${sec('Give a stack from your pack',F.likes.length?'They prize '+F.likes.map(k=>ITEMS[k].n.toLowerCase()).join(', '):'')}${st.length?`<div class="list">${st.map(([x,i])=>`<div class="rec">${img(x.id)}<div><b>${esc(ITEMS[x.id].n)}</b> <small>× ${x.n}</small><br><small>standing +${Math.round(Math.min(COMM.giftDayCap,C.giftWorth(id,x.id,x.n))*10)/10}${F.likes.includes(x.id)?' · prized':''}</small></div>${btn('Give','giftit',`data-id="${id}" data-i="${i}"`,'go')}</div>`).join('')}</div>`:'<p>Your pack is empty.</p>'}</div>`}
        return`<div class="card"><small class="h" style="color:${F.c}">${esc(REGIONS[F.reg].n)}</small><h3>${esc(F.n)} · <span style="color:${rel[2]}">${rel[1]}</span></h3><p>${esc(F.d)}</p>
          <div class="prog" title="standing ${Math.round(fs.st)}"><i style="width:${(fs.st+100)/2}%;background:${rel[2]}"></i></div><div class="tags"><span>standing ${Math.round(fs.st)}</span><span>strength ${Math.round(fs.str)}</span>${tags.join('')}</div>
          <div class="row" style="margin-top:8px;flex-wrap:wrap">${A.join('')}</div><div class="row" style="margin-top:6px;flex-wrap:wrap">${B.join('')}</div>${gifts}</div>`}).join('')+'</div>';
    }
    const T=s.tide,k=TIDE_KINDS.find(k=>k.id===T.kind),pile=Object.entries(s.home.pile),nd=C.needs(s);
    let h=`<div class="cols"><div class="card"><small class="h" style="color:var(--amber2)">Next tide · number ${T.n+1}</small><h3>${esc(k.n)}</h3><p>${esc(k.d)}</p><div class="tags"><span>in ${fmtMin(Math.max(0,T.at-s.t))}</span><span>from the ${DIRS[T.dir]} trail</span><span>about ${Math.round(World.tideBudget(s,T.n+1)/1.5)} of them</span><span>level ${World.tideLevel(s,T.n+1)}</span>${T.weak?`<span>thinned ${Math.round(T.weak*100)}%</span>`:''}</div><p>If you are away when it lands, your walls, traps, turrets and guards fight it without you.</p></div>
      <div class="card"><small class="h" style="color:var(--amber2)">Brought in by your people</small>${pile.length?`<div class="grid" style="margin:6px 0">${pile.map(([id,n])=>slot({id,n})).join('')}</div>${btn('Collect','pile','','go')}`:'<p>Nothing waiting. Foragers, hunters, scavengers, farmers and trade runners report at dawn.</p>'}</div></div><div style="height:12px"></div>`;
    h+=`<div class="card"><small class="h" style="color:var(--amber2)">Stores</small><h3>${nd.people?nd.people+(nd.people===1?' person':' people')+' to feed':'Only yourself to feed'}</h3>${nd.people?`<p>They take ${nd.meals} meal${nd.meals===1?'':'s'} and ${nd.drinks} drink${nd.drinks===1?'':'s'} a day from your storage boxes. Going without costs morale, and people leave when morale runs out.</p><div class="tags"><span style="color:${lowCol(nd.foodDays)}">food ×${nd.food}: ${daysLeft(nd.foodDays)}</span><span style="color:${lowCol(nd.waterDays)}">water ×${nd.water}: ${daysLeft(nd.waterDays)}</span><span>morale ${s.morale}</span><span>scrip ${s.scrip}</span></div>${Object.keys(nd.skip||{}).length?`<p style="color:var(--dim);font-size:13px">Not counted: ${Object.entries(nd.skip).map(([k,n])=>esc(ITEMS[k].n)+' ×'+n).join(', ')}. They eat only a proper meal (worth 8 food or more, nothing raw or risky: cook it first) and drink only clean water (boil dirty water).</p>`:''}`:'<p>Everyone who joins needs one meal and one drink a day from your storage boxes.</p>'}</div>`;
    if(s.clog.length)h+=`<div style="height:12px"></div>${sec('Community log')}<div class="card">${s.clog.slice(0,8).map(l=>`<p style="margin:3px 0"><small style="color:var(--dim)">day ${l.d}</small> <span style="color:${l.k==='bad'?'var(--red)':l.k==='good'?'var(--green)':'var(--ink)'}">${esc(l.x)}</span></p>`).join('')}</div>`;
    return h;
  },
  act(a,d){const s=S(),C=CM(),id=d.id;
    // (jobs are buttons, one tap each: a drop-down was hard to use on a phone and could not be used at all by the bot)
    if(a==='job'){World.setJob(s,+id,d.j);return}
    if(a==='pile'){World.collectPile(s);UI().dirty()}
    else if(a==='recruit')C.recruit(s,+id);else if(a==='away')C.turnAway(s,+id);else if(a==='dismiss')C.dismiss(s,+id);
    else if(a==='harvest')C.harvestAll(s);else if(a==='water')C.tendAll(s,'water');else if(a==='compost')C.tendAll(s,'compost');else if(a==='plantall'){if(campSel.seed)C.plantAll(s,campSel.seed)}
    else if(a==='replant'){s.set.replant=!s.set.replant}
    else if(a==='gift')C.gift(s,id,25);else if(a==='giftopen')campSel.gift=campSel.gift===id?null:id;else if(a==='giftit')C.gift(s,id,{i:+d.i});
    else if(a==='caravan'){if(C.callCaravan(s,id)){UI().open('trade');return false}}
    else if(a==='route')C.openRoute(s,id,campSel.runner[id]);else if(a==='routeoff')C.closeRoute(s,id);
    else if(a==='pact')C.pact(s,id);else if(a==='vol')C.askVolunteer(s,id);else if(a==='tribute')C.tribute(s,id);
    else if(a==='war')C.warParty(s,id,campSel.party[id]||1);else if(a==='camp')C.markCamp(s,id);
    UI().dirty()},
  change(c,v,d){if(c==='job')World.setJob(S(),+d.id,v);else if(c==='seed')campSel.seed=v;else if(c==='runner')campSel.runner[d.id]=+v;else if(c==='party')campSel.party[d.id]=+v}};

// ---------------------------------------------------------------- trade
PANELS.trade={title:'Caravan',live:true,
  can(){if(S().trader&&S().trader.until>S().t)return true;UI().toast('No caravan here today. They pass every couple of days, or come to a flare.','info');return false},
  render(){
    const s=S(),T=s.trader;if(!T)return'';
    const stock=T.stock.map((x,i)=>`<div class="rec">${img(x.id)}<div><b>${esc(ITEMS[x.id].n)}</b> <small>× ${x.n}</small><br><small>${x.p} scrip each</small></div>${btn('Buy','buy',`data-i="${i}" ${s.scrip>=x.p?'':'disabled'}`,'go')}</div>`).join('');
    const mine=s.p.inv.map((x,i)=>{if(!x)return'';const it=ITEMS[x.id],pr=World.sellPrice(x.id);if(!pr||it.t==='key')return'';return`<div class="rec">${img(x.id)}<div><b>${esc(it.n)}</b> <small>× ${x.n}</small><br><small>${pr} scrip each</small></div><div class="row" style="flex-wrap:nowrap">${btn('Sell','sell',`data-i="${i}" data-n="1"`)}${x.n>1?btn('All','sell',`data-i="${i}" data-n="${x.n}"`):''}</div></div>`}).join('');
    return`<div class="card" style="margin-bottom:10px"><b class="h" style="color:var(--amber2)">${s.scrip} scrip</b> <small style="color:var(--dim)">They leave in ${fmtMin(T.until-s.t)}.</small></div><div class="cols"><div>${sec('For sale')}<div class="list">${stock||'<p style="padding:8px;color:var(--dim)">Sold out.</p>'}</div></div><div>${sec('Your pack')}<div class="list">${mine||'<p style="padding:8px;color:var(--dim)">Nothing they want.</p>'}</div></div></div>`;
  },
  act(a,d){const s=S();if(a==='buy')World.buy(s,+d.i,1);else if(a==='sell')World.sell(s,+d.i,+d.n)}};

// ---------------------------------------------------------------- events
let evRes=null;
PANELS.event={title:id=>World.getEvent(id).t,narrow:true,modal:true,open(){evRes=null},
  render(id){
    const ev=World.getEvent(id),s=S();
    if(evRes)return`<div class="quote">${esc(evRes.text)}</div>${evRes.lines.length?`<div class="tags">${evRes.lines.map(l=>`<span>${esc(l)}</span>`).join('')}</div>`:''}<div class="row" style="justify-content:flex-end">${btn('Continue','done','','go')}</div>`;
    return`<div class="quote">${esc(ev.x)}</div><div style="display:grid;gap:6px">${ev.o.map((o,i)=>{const why=World.optionBlocked(s,o),f=World.optionFight(s,o);return`<button class="btn" style="text-align:left;white-space:normal" data-a="opt" data-i="${i}" ${why?'disabled':''}>${esc(o.l)}${why?` <small style="color:#ff8a7a">(${esc(why)})</small>`:''}${f?`<small style="display:block;color:var(--dim)">${f.sure?'A fight':'May come to a fight'}: ${esc(f.names)} · <span class="${f.skulls>=4?'danger':f.skulls===3?'amb':'okc'}">${esc(f.word)} for you as you stand</span>${f.cost>=.15?' · costs you about '+(f.cost>=1?'more health than you have':f.cost>=.85?'all your health':f.cost>=.6?'two thirds of your health':f.cost>=.4?'half your health':f.cost>=.25?'a third of your health':'a quarter of your health')+(f.cost>=.85?' (medicine makes up the rest)':''):''}</small>`:''}</button>`}).join('')}</div>`;
  },
  act(a,d){if(a==='opt'){evRes=World.chooseOption(curEv,+d.i)}else if(a==='done'){UI().close();return false}},
  close(){evRes=null;World.eventDone()}};
let curEv=null;{const P=PANELS.event,r0=P.render;P.render=id=>{curEv=id;return r0(id)}}

// ---------------------------------------------------------------- a radio lead: what the voice said, and how dangerous the place is, before you go
export const skulls=n=>{let h='<span style="display:inline-flex;gap:2px;vertical-align:-4px" title="threat '+n+' of 5">';for(let i=1;i<=5;i++)h+=`<span style="display:inline-block;width:18px;height:18px;opacity:${i<=n?1:.22}">${gimg('skull',i<=n?(n>=4?'#e0503c':n===3?'#e3a432':'#8fc060'):'#9c9884').replace('<img','<img style="width:18px;height:18px"')}</span>`;return h+'</span>'};
export function leadCard(s,I,full){
  const cls=I.skulls>=4?'danger':I.skulls===3?'amb':'okc',ti=World.travelInfo(s,I.id);
  return`<div class="card"><h3>${esc(I.name)} · <span class="${cls}">${esc(I.word)}</span></h3>${full?`<p>${esc(I.d)}</p>`:''}
    <div class="kv" style="margin-top:6px"><span>Threat <small style="color:var(--dim)">for you as you stand</small></span><span class="${cls}">${skulls(I.skulls)}</span><span>Level</span><span>${I.lvl} <small style="color:var(--dim)">(you are ${s.p.lvl})</small></span>
    <span>Held by</span><span style="text-align:right;max-width:24em">${esc(I.who)}</span><span>How many</span><span>about ${I.count}${I.boss?', one of them a boss':''}</span>
    <span>Strongroom</span><span style="text-align:right;max-width:24em">${esc(I.prize)}</span><span>Gone in</span><span>${fmtMin(I.left)}</span><span>The trip</span><span>${fmtMin(ti.min)} each way</span></div>
    <p>${I.boss?`The strongroom is locked. <b style="color:var(--ink)">${esc(I.boss)}</b> carries the keys.`:'The strongroom is barred from inside. It opens when the place is clear.'}</p>
    ${I.tox?`<p><b style="color:var(--ink)">The air is toxic.</b> Toxin builds while you are in there, faster from what spits and bursts; past half it eats your health and it does not clear by itself until you are out. ${I.guard>0?'What you are wearing keeps out '+Math.round(I.guard*100)+'% of it.':'A Gas Mask ('+esc(sourcesOf('gas_mask',1)||'traders')+') keeps out a third.'} Charcoal Tablets or Antitoxin clear it (${esc(sourcesOf('charcoal_tabs',1)||'medicine cabinets')}).</p>`:''}
    ${I.again&&full?'<p style="color:var(--dim)">Not the one you have been to: another place like it.</p>':''}</div>`}
PANELS.lead={title:'On the radio',narrow:true,
  render(id){const s=S(),site=s.sites.find(x=>x.id===id),I=site&&World.leadInfo(s,site);if(!I)return'<div class="card"><p>The signal is gone.</p></div>';
    return`<div class="quote">${esc(I.radio)}</div>${leadCard(s,I,true)}<p style="color:var(--dim);font-size:13px">It is marked on your map. Walk to the edge of the homestead to set out. The threat is worked out from the weapon in your hands, your armour and the medicine in your pack against who is in there: arm better and it drops. You carry out only what your pack holds.</p><div class="row" style="justify-content:flex-end">${btn('Noted','done','','go')}</div>`},
  act(a){if(a==='done'){UI().close();return false}},
  close(){World.leadRead(S())}};

// ---------------------------------------------------------------- small station dialogs
const infoCard=(i,body)=>{const o=G.Z.obj[i],d=OBJ[o.k];return`<div class="card"><h3>${esc(d.n)}</h3>${d.d?`<p>${esc(d.d)}</p>`:''}${o.hp?`<div class="tags"><span>condition ${Math.round(o.hp)} / ${maxHp(o.k)} health</span></div>`:''}${body||''}</div>`};
const objTitle=i=>G.Z&&G.Z.obj[i]?OBJ[G.Z.obj[i].k].n:'';
PANELS.info={title:objTitle,narrow:true,render:i=>infoCard(i)};
PANELS.bed={title:'Rest',narrow:true,render(i){const why=World.canSleep(S());return infoCard(i,`<p>${why?esc(why)+'.':'Sleep until six. Better beds mend more of you.'}</p><div class="row">${btn('Sleep','sleep',why?'disabled':'','go')}</div>`)},
  act(a){if(a==='sleep'){const i=curBed;UI().close();World.sleep(i);return false}}};
let curBed=null;{const P=PANELS.bed,r0=P.render;P.render=i=>{curBed=i;return r0(i)}}
PANELS.turret={title:objTitle,narrow:true,live:true,render(i){const o=G.Z.obj[i],t=OBJ[o.k].turret;curBed=i;return infoCard(i,t.ammo?`<div class="tags"><span>${Math.floor(o.ammo||0)} / ${t.cap} ${esc(ITEMS[t.ammo].n)}</span><span>${t.dmg} damage</span><span>range ${t.rng}</span><span>you have ${count(S(),t.ammo,true)}</span></div><div class="row">${btn('Load','load','','go')}</div>`:`<div class="tags"><span>${t.dmg} damage</span><span>range ${t.rng}</span><span>${G.Z.power?'powered':'no power: fuel a generator'}</span></div>`)},act(a){if(a==='load')World.loadTurret(S(),curBed)}};
PANELS.generator={title:objTitle,narrow:true,live:true,render(i){const o=G.Z.obj[i];curBed=i;return infoCard(i,`<div class="tags"><span>${(o.fuel||0).toFixed(1)} / 30 fuel</span><span>you have ${count(S(),'fuel',true)}</span><span>burns about 10 a day</span></div><div class="row">${btn('Add 5 fuel','fuel','','go')}</div>`)},act(a){if(a==='fuel')World.fuelGenerator(S(),curBed,5)}};
PANELS.garden={title:'Garden bed',narrow:true,render(i){curBed=i;const s=S(),seeds=[...new Set(s.p.inv.filter(x=>x&&ITEMS[x.id].t==='seed').map(x=>x.id))];
    return seeds.length?`<div class="list">${seeds.map(id=>`<div class="rec">${img(id)}<div><b>${esc(ITEMS[id].n)}</b> <small>× ${count(s,id)}</small><br><small>${esc(ITEMS[ITEMS[id].crop].n)} in ${fmtMin(ITEMS[id].grow)}</small></div>${btn('Plant','plant',`data-id="${id}"`,'go')}</div>`).join('')}</div>`:'<div class="card"><p>You have no seeds. Tall grass, overgrown fields, kitchen cabinets and caravans all turn them up.</p></div>'},
  act(a,d){if(a==='plant'){plant(G.Z,curBed,d.id);UI().close();return false}}};
let rsel=null;
PANELS.recycler={title:'Recycler',live:true,open(){rsel=null},render(i){const s=S();let g='';for(let k=0;k<slotCount(s);k++)g+=slot(s.p.inv[k],`data-a="rs" data-i="${k}"`,rsel===k?'sel':'');const it=rsel!=null&&s.p.inv[rsel];
    return`<div class="cols"><div>${sec('Your pack')}<div class="grid">${g}</div></div><div>${it?itemCard(it,btn('Break down','rec','','bad')):'<div class="card"><p>Pick something you made or found. About half of what went into it comes back, less if it is worn.</p></div>'}</div></div>`},
  act(a,d){const s=S();if(a==='rs')rsel=s.p.inv[+d.i]?+d.i:null;else if(a==='rec'&&rsel!=null){World.recycle(s,rsel);if(!s.p.inv[rsel])rsel=null}}};
PANELS.repair={title:'Mending bench',live:true,render(){const s=S(),rows=[];
    for(const[k,l]of EQ){const e=s.p.eq[k];if(e&&World.mendCost(e))rows.push([e,'eq:'+k,l])}s.p.inv.forEach((x,i)=>{if(x&&World.mendCost(x))rows.push([x,'inv:'+i,'pack'])});
    return rows.length?`<div class="list">${rows.map(([e,ref,l])=>`<div class="rec">${img(e.id)}<div><b>${esc(ITEMS[e.id].n)}</b> <small>${l} · ${Math.round(e.d/ITEMS[e.id].dur*100)}%</small>${chips(World.mendCost(e))}</div>${btn('Mend','mend',`data-ref="${ref}"`,'go')}</div>`).join('')}</div>`:'<div class="card"><p>Nothing you carry is worn.</p></div>'},
  act(a,d){if(a==='mend'){const s=S(),[w,k]=d.ref.split(':');World.mend(s,w==='eq'?s.p.eq[k]:s.p.inv[+k])}}};
for(const k of['kennel','maptable','guard','beacon','tower','scarecrow'])PANELS[k]=PANELS.info;

// ---------------------------------------------------------------- results
PANELS.death={title:'You died',narrow:true,modal:true,render(){const s=S(),Z=G.Z;return`<div class="quote">${Z&&Z.home?'They got you inside your own fence. What you carried is lying where you fell.':Z&&Z.id==='ambush'?'They brought you down on the road. Somebody dragged you home. Your pack is lying where you fell: the place is on your map for two days.':'You went down in '+esc(Z?Z.name:'the wild')+'. Somebody dragged you home. Your pack stayed behind, and it will wait there until you go back for it.'}</div><div class="tags"><span>Day ${dayOf(s.t)}</span><span>${s.stats.kills||0} put down</span><span>what you wear and hold comes with you</span></div><div class="row" style="justify-content:flex-end">${btn('Wake up','go','','go')}</div>`},
  act(){UI().close();return false},close(){World.respawn()}};
// ---------------------------------------------------------------- the shared world: who holds ground in it, how it stands, what the radio says
const KIND={npc:'settlement',bot:'bot',human:'player'};
PANELS.world={title:()=>S().world?S().world.name:'The world',live:true,
  render(){const s=S(),w=s.world;if(!w)return'<div class="card"><p>This game is not joined to a shared world.</p></div>';const me=w.you||{},pct=w.next?Math.min(100,Math.round(w.points/w.next*100)):100;
    const rows=w.enclaves.map((e,i)=>{const mine=e.name===me.name;return`<div class="rec" style="${mine?'outline:1px solid var(--amber)':''}"><div style="width:26px;text-align:center;font:700 16px var(--disp);color:var(--dim)">${i+1}</div><div><b>${esc(e.name)}</b> <small>${mine?'you':KIND[e.kind]||e.kind}${e.idle?' · away':''} · ${e.day} day${e.day===1?'':'s'} here · level ${e.level}</small>
      <div class="prog" title="hold ${e.hold} of 100"><i style="width:${e.hold}%;background:${e.hold<25?'#c8503c':e.hold<50?'var(--amber)':'var(--green)'}"></i></div><small>hold ${e.hold} · tides held ${e.deeds.held}, lost ${e.deeds.lost} · strongrooms ${e.deeds.leads}${e.deeds.deaths?' · deaths '+e.deeds.deaths:''}</small>${e.about?`<small style="display:block;color:var(--dim)">${esc(e.about)}</small>`:''}</div><div class="num" style="font:700 18px var(--disp)">${e.score}</div></div>`}).join('');
    const leads=s.sites.filter(x=>x.wid).map(x=>{const I=World.leadInfo(s,x),l=(w.leads||[]).find(l=>l.id===x.wid);if(I)I.by=l&&l.by||(s.deeds.leads.includes(x.wid)?me.name:null);return I}).filter(Boolean);
    return`<div class="cols"><div>${sec('Who holds ground here','score')}<div class="list">${rows}</div>
      <p style="color:var(--dim);font-size:12.5px">Every enclave has a hold on its ground. Beating a tide at your walls raises it by 10 and opening a lead's strongroom by 6; a tide that goes through you costs 25 and dying costs 8. At nothing the enclave has fallen: you take what you carry and start again in another valley. The leads on the radio go out to everyone here, and the first to open the strongroom takes it.</p>
      ${w.gone.length?sec('Fallen')+`<div class="tags">${w.gone.map(g=>`<span>${esc(g.name)} · day ${g.day}</span>`).join('')}</div>`:''}</div>
      <div>${sec('The world: '+esc(w.stageName),'the world\'s day '+w.day)}<div class="card"><p>${esc(w.stageText||'')}</p><div class="prog"><i style="width:${pct}%"></i></div><small style="color:var(--dim)">${w.next?'Everyone\'s deeds push it on: '+w.points+' of '+w.next+' to the next stage.':'The last stage.'} Tides here are ×${(w.fx.tide||1).toFixed(2)}.</small></div>
      ${leads.length?sec('On every radio')+leads.map(I=>`<div class="card"><b>${esc(I.name)}</b> · ${I.by?`<span class="okc">${I.by===me.name?'yours: you opened the strongroom':'taken by '+esc(I.by)}</span>`:`<span class="${I.skulls>=4?'danger':I.skulls===3?'amb':'okc'}">${esc(I.word)}</span> <small style="color:var(--dim)">gone in ${fmtMin(I.left)} · first there takes it</small>`}</div>`).join(''):''}
      ${sec('News')}<div class="list">${w.feed.slice().reverse().map(f=>`<div style="padding:3px 0;border-bottom:1px solid var(--line);color:${f.kind==='bad'?'#ff9a8a':f.kind==='good'?'var(--green)':'var(--ink)'};font-size:13px">${esc(f.text)}</div>`).join('')}</div></div></div>`},
  act(){}};
PANELS.exile={title:'Your enclave has fallen',narrow:true,modal:true,
  render(a){return`<div class="quote">There was nothing left to hold in ${esc(a.from)}. What could walk has walked out over the pass with you, and what you carry is all there is. ${esc(a.to)} is the next valley: other fires already burn there.</div><div class="tags"><span>you keep what you wear, carry and know</span><span>the homestead and its stores are gone</span><span>the tides start over</span></div><div class="row" style="justify-content:flex-end">${btn('Start again in '+esc(a.to),'go','','go')}</div>`},
  act(){UI().close();return false},close(a){const s=S();World.exile(s);if(s.net)delete s.net.exile;if(a&&a.world)World.worldNews(s,a.world,a.you)}};
PANELS.tideEnd={title:r=>r.won?'The tide breaks':'Overrun',narrow:true,render(r){return`<div class="quote">${r.won?esc(r.name)+', number '+r.n+', is finished. The valley goes quiet again.':'They went through you and through the walls. What was left of them moved on by morning.'}</div><div class="tags">${r.won?`<span>+${r.xp} xp</span><span>+${r.scrip} scrip</span>`:''}<span>${r.lost} structure${r.lost===1?'':'s'} lost</span></div>${r.gone&&r.gone.length?`<p style="color:var(--dim);font-size:13px">Broken: ${(()=>{const c={};for(const n of r.gone)c[n]=(c[n]||0)+1;return Object.entries(c).map(([n,k])=>k>1?k+' × '+esc(n):esc(n)).join(', ')})()}. Rebuild them before the next tide (Build, B).</p>`:''}${r.items.length?sec('Picked up from the field')+`<div class="grid">${r.items.map(i=>slot(i)).join('')}</div>`:''}<div class="row" style="justify-content:flex-end;margin-top:10px">${btn('Carry on','ok','','go')}</div>`},act(){UI().close();return false}};
PANELS.report={title:'While you were away',narrow:true,render(r){return`<div class="quote">${esc(r.name)}, tide ${r.n}, reached the homestead without you. ${r.held?'The defences held.':'It was more than the defences could stop.'}</div><div class="tags"><span>${r.lost} structure${r.lost===1?'':'s'} destroyed</span>${r.stolen?`<span>${r.stolen} stacks taken from storage</span>`:''}</div><p style="color:var(--dim)">Walk the walls and repair what is left.</p><div class="row" style="justify-content:flex-end">${btn('Understood','ok','','go')}</div>`},act(){UI().close();return false}};
PANELS.ending={title:'After',narrow:true,render(){return`<div class="quote">The Core comes apart like wet paper. For a long moment the radio hisses, and then a voice you know says, very quietly, "Thank you," and does not speak again.

The tides will still come. Smaller, stranger, leaderless. Past the place where the Core stood, the Gray goes on, and down.</div><div class="tags"><span>The Deep Gray is open</span><span>Mutation tiers unlocked in the journal</span></div><div class="row" style="justify-content:flex-end">${btn('Keep going','ok','','go')}</div>`},act(){UI().close();return false}};

// ---------------------------------------------------------------- menu
let confirmNew=false,saveBox=false;
PANELS.menu={title:'Graywake',narrow:true,open(){confirmNew=false;saveBox=false},
  render(){
    const s=S().set,tog=(k,l)=>btn(l+': '+(s[k]?'on':'off'),'tog',`data-k="${k}"`,s[k]?'':'');
    return`<div style="display:grid;gap:10px"><div class="row">${btn('Resume','close','','go')}</div>
      ${sec('Sound')}<div class="row">${tog('music','Music')}${tog('sfx','Effects')}${btn('Volume '+Math.round(s.vol*100)+'%','vol')}</div>
      ${sec('Picture')}<div class="row">${btn('Quality: '+s.quality,'qual')}${tog('shake','Screen shake')}${btn('Zoom in','zoom','data-k="in"')}${btn('Zoom out','zoom','data-k="out"')}</div>
      ${sec('Play')}<div class="row">${tog('autoPick','Auto pick-up')}${tog('autoRepair','Auto-repair tools')}${btn('Tides: '+(s.tides||'standard'),'tides')}</div><p style="color:var(--dim);font-size:12px;margin:0">Auto-repair fixes a tool or weapon when it is nearly worn out: at home it uses the mending bench and materials, anywhere else it spends a repair kit. Gentle tides are about two thirds the size, brutal ones half again as large. Applies from the next tide.</p>
      ${sec('Save')}<p style="color:var(--dim);font-size:12px;margin:0">The game saves by itself at home, on the map and when you close the tab, in this browser only. Copy the text below to move a save somewhere else.</p>
      <div class="row">${btn('Save now','save')}${btn(saveBox?'Hide save text':'Export / import','box')}${btn('Quit to title','title')}</div>
      ${saveBox?`<textarea class="save" id="savetxt" spellcheck="false">${esc(bus.api().exportSave())}</textarea><div class="row">${btn('Copy','copy')}${btn('Load this text','import','','bad')}</div>`:''}
      ${sec('Keys')}<div class="kv" style="grid-template-columns:auto 1fr"><span>WASD</span><span>move</span><span>Mouse / click</span><span>aim / attack</span><span>E or right-click</span><span>interact</span><span>F</span><span>auto-gather</span><span>Space / Shift</span><span>dodge / sneak</span><span>Q</span><span>swap weapon</span><span>1 2 3 4</span><span>heal, eat, drink, antidote</span><span>I C B J L</span><span>pack, craft, build, journal, camp</span><span>R</span><span>rotate while building</span><span>Wheel</span><span>zoom</span></div>
      <small style="color:var(--dim)">v${VERSION}</small></div>`;
  },
  act(a,d){
    const s=S().set,A=bus.api();
    if(a==='close'){UI().close();return false}
    if(a==='tog'){s[d.k]=!s[d.k];A.applySettings()}else if(a==='vol'){s.vol=s.vol>=1?0.2:Math.round((s.vol+.2)*10)/10;A.applySettings()}
    else if(a==='qual'){s.quality={auto:'low',low:'med',med:'high',high:'auto'}[s.quality]||'auto';A.applySettings()}
    else if(a==='tides'){s.tides={gentle:'standard',standard:'brutal',brutal:'gentle'}[s.tides||'standard']}
    else if(a==='zoom'){bus.zoom(d.k==='in'?.9:1.1);return false}
    else if(a==='save'){UI().toast(A.save()?'Saved':'This browser would not store the save','info')}
    else if(a==='box'){saveBox=!saveBox}
    else if(a==='copy'){const t=$('savetxt');t.select();try{navigator.clipboard.writeText(t.value).then(()=>UI().toast('Copied','good'),()=>UI().toast('Select the text and copy it by hand','info'))}catch(e){UI().toast('Select the text and copy it by hand','info')}return false}
    else if(a==='import'){const v=$('savetxt').value;UI().close();A.importSave(v);return false}
    else if(a==='title'){UI().close();A.toTitle();return false}
  }};

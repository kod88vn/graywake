// Every sheet that slides over the game: pack, crafting, containers, journal, camp, trade, events, settings and the small station dialogs.
// A panel is {title, tabs?, render(arg, tab) → html, act(action, dataset) → false to skip re-render, open?, close?, narrow?, modal?}.
import {G,VERSION,derive,count,take,give,addTo,removeFrom,slotCount,freeSlots,sortInv,equip,unequip,useItem,learnPerk,craft,canCraft,recipeVisible,knows,collectStation,cancelJob,repairWithKit,dropAt,maxHp,hasBuilt,homeStores} from '../sim/core.js';
import * as World from '../sim/world.js';
import {openLoot,lootAll,checkEmpty,plant,cropReady} from '../sim/actors.js';
import {story,goalProgress,goalText,contractText,contractReady,turnIn,dropContract} from '../sim/quests.js';
import {ITEMS,SETS} from '../data/items.js';
import {OBJ} from '../data/objects.js';
import {RECIPE_LIST,RECIPES,STATION_NAMES,VEHICLES} from '../data/recipes.js';
import {EVENTS,TIDE_KINDS} from '../data/events.js';
import {STORY,PERKS,PERK_TREES,ACHIEVEMENTS,SURV_TRAITS,JOBS} from '../data/progress.js';
import {dayOf} from '../sim/util.js';
import {$,esc,img,gimg,slot,chips,tags,bus,fmtMin,TYPE_NAMES} from './dom.js';

const UI=()=>bus.UI,S=()=>G.S;
const btn=(label,a,extra='',cls='')=>`<button class="btn ${cls}" data-a="${a}" ${extra}>${label}</button>`;
const sec=(l,r='')=>`<div class="sec"><span>${l}</span><span>${r}</span></div>`;
const DIRS=['north','east','south','west'];
export const PANELS={};

// ---------------------------------------------------------------- pack
let sel=null;
const EQ=[['w1','Hand'],['w2','Spare'],['head','Head'],['body','Body'],['legs','Legs'],['feet','Feet'],['pack','Pack']];
function itemCard(s,actions){
  if(!s)return`<div class="card"><p>Select something to see what it does.</p></div>`;const it=ITEMS[s.id];
  return`<div class="card"><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div style="width:52px;flex:none">${slot({id:s.id})}</div><div style="min-width:0"><h3>${esc(it.n)}${s.n>1?' × '+s.n:''}</h3><small style="color:var(--dim)">${TYPE_NAMES[it.t]||''}</small></div></div>${it.d?`<p>${esc(it.d)}</p>`:''}${tags(it,s)}${it.set?`<p>${esc(SETS[it.set].n)} (all four pieces): ${esc(SETS[it.set].d)}</p>`:''}<div class="row">${actions}</div></div>`;
}
PANELS.inv={title:'Pack',live:true,open(){sel=null},
  render(){
    const s=S(),p=s.p,cap=slotCount(s),ds=G.ds=derive(s);let g='';for(let i=0;i<cap;i++)g+=slot(p.inv[i],`data-a="sel" data-i="${i}"`,sel&&sel.src==='inv'&&sel.i===i?'sel':'');
    let eq='';for(const[k,l]of EQ){const e=p.eq[k];eq+=`<button class="sl ${sel&&sel.src==='eq'&&sel.slot===k?'sel':''} ${p.active===k?'sel':''}" data-a="seleq" data-slot="${k}" title="${l}"><em>${l}</em>${e?slot(e).replace(/^<button[^>]*>|<\/button>$/g,''):''}</button>`}
    let card;
    if(sel&&sel.src==='inv'&&p.inv[sel.i]){const it=ITEMS[p.inv[sel.i].id];let a='';
      if(it.t==='food')a+=btn(it.water>(it.food||0)?'Drink':'Eat','use','','go');else if(it.t==='med')a+=btn('Use','use','','go');else if(it.t==='bp')a+=btn('Learn','use','','go');
      else if(['melee','gun','tool','throw'].includes(it.t)){a+=btn('Equip','equip','data-slot="w1"','go')+btn('Equip as spare','equip','data-slot="w2"')}
      else if(['head','body','legs','feet','pack'].includes(it.t))a+=btn('Wear','use','','go');
      else if(p.inv[sel.i].id==='flare')a+=btn('Fire','flare','','go');
      a+=btn('Drop','drop')+(p.inv[sel.i].n>1?btn('Drop all','dropall'):'');card=itemCard(p.inv[sel.i],a)}
    else if(sel&&sel.src==='eq'&&p.eq[sel.slot]){const e=p.eq[sel.slot],it=ITEMS[e.id];card=itemCard(e,btn('Take off','unequip','','go')+(it.dur&&e.d<it.dur&&count(s,'repair_kit')?btn('Use repair kit','kit'):'')+(sel.slot==='w1'||sel.slot==='w2'?btn('Make active','active'):''))}
    else card=itemCard(null);
    const kv=[['Health',Math.ceil(p.hp)+' / '+ds.maxHp],['Armour',ds.arm+' (−'+Math.round(ds.armRed*100)+'% damage)'],['Cold resistance',Math.round(ds.cold*100)+'%'],['Toxin resistance',Math.round(ds.tox*100)+'%'],['Move speed',ds.spd.toFixed(1)],['Melee damage','×'+ds.melee.toFixed(2)],['Ranged damage','×'+ds.ranged.toFixed(2)],['Set bonus',ds.set?SETS[ds.set].n:'none'],['Vehicle',VEHICLES[s.veh].n],['Scrip',s.scrip]];
    return`<div class="cols w3"><div>${sec('Carried '+p.inv.filter(Boolean).length+' / '+cap,btn('Sort','sort'))}<div class="grid">${g}</div><div style="height:10px"></div>${card}</div>
      <div>${sec('Equipped')}<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">${eq}</div><div style="height:12px"></div>${sec('You')}<div class="kv">${kv.map(([a,b])=>`<span>${a}</span><span class="num">${b}</span>`).join('')}</div></div></div>`;
  },
  act(a,d){
    const s=S(),p=s.p;
    if(a==='sel'){const i=+d.i;if(sel&&sel.src==='inv'&&sel.i!==i&&p.inv[sel.i]&&!p.inv[i]){p.inv[i]=p.inv[sel.i];p.inv[sel.i]=null;sel={src:'inv',i}}else if(sel&&sel.src==='inv'&&sel.i===i&&p.inv[i]){PANELS.inv.act(defaultAct(p.inv[i]),{slot:'w1'})}else sel=p.inv[i]?{src:'inv',i}:null}
    else if(a==='seleq'){sel=p.eq[d.slot]?{src:'eq',slot:d.slot}:null}
    else if(a==='sort'){sortInv(p.inv,slotCount(s));sel=null}
    else if(!sel)return;
    else if(a==='use'){useItem(s,sel.i);if(!p.inv[sel.i])sel=null}
    else if(a==='equip'){equip(s,sel.i,d.slot);if(!p.inv[sel.i])sel=null}
    else if(a==='flare'){if(World.useFlare(s,sel.i))return false}
    else if(a==='drop'||a==='dropall'){const it=p.inv[sel.i],n=a==='drop'?1:it.n;if(G.Z&&G.Z.pl)dropAt(G.Z,G.Z.pl.x+Math.cos(G.Z.pl.a)*1.1,G.Z.pl.y+Math.sin(G.Z.pl.a)*1.1,[{id:it.id,n,d:it.d}]).full=G.Z.time+6;it.n-=n;if(it.n<=0){p.inv[sel.i]=null;sel=null}}
    else if(a==='unequip'){unequip(s,sel.slot);sel=null}
    else if(a==='kit'){repairWithKit(s,sel.slot)}
    else if(a==='active'){p.active=sel.slot;bus.emitEq()}
  }};
const defaultAct=it=>{const t=ITEMS[it.id].t;return['melee','gun','tool','throw'].includes(t)?'equip':'use'};

// ---------------------------------------------------------------- crafting
function recipeRow(r,at,tier){
  const s=S(),it=r.fx?null:ITEMS[r.o],name=r.fx?VEHICLES[r.fx.veh].n:it.n,vis=recipeVisible(s,r),higher=r.s!=='hand'&&r.sl>tier;
  let lock='';if(!vis)lock=r.bp?'Schematic needed':'Level '+r.lv;else if(higher){const up=Object.values(OBJ).find(o=>o.station===r.s&&o.sl===r.sl);lock='Needs '+(up?up.n:'a better station')}
  const why=lock?lock:canCraft(s,r,1,at),home=!!(G.Z&&G.Z.home);let max=99;for(const k in r.i)max=Math.min(max,Math.floor(count(s,k,home)/r.i[k]));if(r.fx)max=Math.min(max,1);
  const ic=r.fx?gimg('cart','#8a8f6a'):img(r.o);
  return`<div class="rec ${why?'off':''}">${ic}<div><b>${esc(name)}${r.q>1?' × '+r.q:''}</b> <small>${r.t?fmtMin(r.t):''}${lock?' · '+lock:''}${!r.fx&&count(s,r.o,home)?' · you have '+count(s,r.o,home):''}</small>${chips(r.i)}${r.fx?`<small>${esc(VEHICLES[r.fx.veh].d)}</small>`:it.d&&!why?'':''}</div>
    <div class="row" style="flex-wrap:nowrap">${why?`<small style="color:var(--dim);max-width:110px;text-align:right">${lock?'':esc(why)}</small>`:btn('Make','make',`data-r="${r.id}" data-n="1"`,'go')+(max>=2?btn('×'+Math.min(max,r.t?10:max>20?20:max),'make',`data-r="${r.id}" data-n="${Math.min(max,r.t?10:max>20?20:max)}"`):'')}</div></div>`;
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
PANELS.loot={title:i=>G.Z&&G.Z.obj[i]?OBJ[G.Z.obj[i].k].n:'Container',live:true,
  open(i){const o=G.Z.obj[i];if(o&&!o.inv){if(OBJ[o.k].store)o.inv=[];else openLoot(G.Z,i)}},
  render(i){
    const s=S(),o=G.Z.obj[i];if(!o)return'';const d=OBJ[o.k],store=!!d.store,cap=store?d.store:Math.max(8,o.inv.length),pc=slotCount(s);
    let a='',b='';for(let k=0;k<cap;k++)a+=slot(o.inv[k],`data-a="take" data-i="${k}"`);for(let k=0;k<pc;k++)b+=slot(s.p.inv[k],`data-a="put" data-i="${k}"`);
    return`<div class="cols"><div>${sec(esc(d.n)+(store?' '+o.inv.filter(Boolean).length+' / '+cap:''),btn('Take all','all','','go')+(store?' '+btn('Sort','sortc'):''))}<div class="grid">${a}</div></div>
      <div>${sec('Your pack '+s.p.inv.filter(Boolean).length+' / '+pc,store?btn('Stow materials','stow'):'')}<div class="grid">${b}</div><p style="color:var(--dim);font-size:12px">Tap an item on either side to move the whole stack across.${store?' Crafting and building at home draw from every storage box.':G.Z.home?' Anything you leave in here stays here.':' Anything you leave here is gone when you leave the area.'}</p></div></div>`;
  },
  act(a,d){
    const s=S(),Z=G.Z,i=curLoot,o=Z.obj[i];if(!o)return;const dd=OBJ[o.k],cap=dd.store||Math.max(8,o.inv.length);
    if(a==='take'){const it=o.inv[+d.i];if(!it)return;const left=addTo(s.p.inv,slotCount(s),it.id,it.n,it.d);if(left===it.n){UI().toast('Pack full','bad');return}s.codex.it[it.id]=1;if(left>0)it.n=left;else o.inv[+d.i]=null;sfxq('pickup')}
    else if(a==='put'){const it=s.p.inv[+d.i];if(!it)return;const left=addTo(o.inv,cap,it.id,it.n,it.d);if(left===it.n){UI().toast('No room in there','bad');return}if(left>0)it.n=left;else s.p.inv[+d.i]=null;sfxq('pickup')}
    else if(a==='all'){if(dd.store){for(let k=0;k<o.inv.length;k++){const it=o.inv[k];if(!it)continue;const left=addTo(s.p.inv,slotCount(s),it.id,it.n,it.d);if(left>0)it.n=left;else o.inv[k]=null}}else lootAll(Z,i);sfxq('pickup')}
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
    if(tab==='contracts'){if(!hasBuilt(s,o=>o.special==='radio'))return'<div class="card"><h3>No signal</h3><p>Build a Radio Mast at home. People out there have work, and they pay in scrip, schematics and ammunition.</p></div>';
      return(s.q.contracts.length?`<div class="list">${s.q.contracts.map(c=>{const rdy=contractReady(s,c),have=c.type==='fetch'?Math.min(c.n,count(s,c.item,true)):c.have;
        return`<div class="rec">${c.type==='fetch'?img(c.item):gimg(c.type==='hunt'?'skull':'map')}<div><b>${esc(contractText(c))}</b><br><small>${esc(c.giver)} · pays ${c.pay} scrip, ${c.xp} xp · ${have} / ${c.n}</small></div><div class="row" style="flex-wrap:nowrap">${btn('Hand in','turn',`data-id="${c.id}" ${rdy?'':'disabled'}`,'go')}${btn('Drop','dropc',`data-id="${c.id}"`)}</div></div>`}).join('')}</div>`:'<p style="color:var(--dim)">Nothing on the board. New work comes in at dawn.</p>')
        +(s.flags.core_dead?`<div class="card" style="margin-top:12px"><h3>Mutation tier ${s.mut}</h3><p>The Gray adapts. Raise the tier and everything out there grows stronger, tides included, and carries more. There is no way back down.</p>${btn('Raise the tier','mut','','bad')}</div>`:'')}
    if(tab==='perks'){return`<div class="card" style="margin-bottom:10px"><b class="h" style="color:var(--amber2)">${s.p.sp} point${s.p.sp===1?'':'s'} to spend</b> <small style="color:var(--dim)">One per level.</small></div><div class="cols">${PERK_TREES.map(t=>`<div>${sec(t)}<div class="list">${PERKS.filter(p=>p.tree===t).map(p=>{const r=s.p.perks[p.id]||0;return`<div class="perk">${gimg(p.ic,r?'#e3a432':'#6a6a5a')}<div><b>${esc(p.n)}</b><small>${esc(p.d)}</small></div><div class="row" style="flex-wrap:nowrap"><span class="pips num">${r} / ${p.max}</span>${btn('+','perk',`data-id="${p.id}" ${s.p.sp>0&&r<p.max?'':'disabled'}`,'go')}</div></div>`}).join('')}</div></div>`).join('')}</div>`}
    const st=s.stats,kv=[['Day',dayOf(s.t)],['Level',s.p.lvl],['Hostiles put down',st.kills||0],['Tides survived',st.tides||0],['Structures built',st.built||0],['Things crafted',st.crafted||0],['Containers opened',st.opened||0],['Places visited',st.locs||0],['Bosses killed',st.bosses||0],['Deaths',st.deaths||0],['Schematics learned',st.schematics||0],['Scrip earned',st.earned||0]];
    return`<div class="cols"><div>${sec('Achievements '+Object.keys(s.ach).length+' / '+ACHIEVEMENTS.length)}<div class="list">${ACHIEVEMENTS.map(x=>{const v=Math.min(x.v,st[x.s]||0),done=s.ach[x.id];return`<div class="rec" style="grid-template-columns:minmax(0,1fr) auto"><div><b style="${done?'color:var(--green)':''}">${esc(x.n)}</b><br><small>${esc(x.d)}</small><div class="prog"><i style="width:${v/x.v*100}%"></i></div></div><small class="num">${done?'✓':v+' / '+x.v}</small></div>`}).join('')}</div></div><div>${sec('Tally')}<div class="kv">${kv.map(([k,v])=>`<span>${k}</span><span class="num">${v}</span>`).join('')}</div></div></div>`;
  },
  act(a,d){const s=S();if(a==='turn')turnIn(s,+d.id);else if(a==='dropc')dropContract(s,+d.id);else if(a==='perk')learnPerk(s,d.id);else if(a==='mut'){World.raiseMutation(s)}}};
PANELS.radio={can(){setTimeout(()=>UI().open('journal','contracts'),0);return false}};

// ---------------------------------------------------------------- camp
PANELS.camp={title:'Camp ledger',live:true,
  render(){
    const s=S(),T=s.tide,k=TIDE_KINDS.find(k=>k.id===T.kind),cap=World.survCap(s),pile=Object.entries(s.home.pile);
    let h=`<div class="cols"><div class="card"><small class="h" style="color:var(--amber2)">Next tide · number ${T.n+1}</small><h3>${esc(k.n)}</h3><p>${esc(k.d)}</p><div class="tags"><span>in ${fmtMin(Math.max(0,T.at-s.t))}</span><span>from the ${DIRS[T.dir]} trail</span><span>about ${Math.round(World.tideBudget(s,T.n+1)/1.5)} of them</span><span>level ${World.tideLevel(s,T.n+1)}</span>${T.weak?`<span>thinned ${Math.round(T.weak*100)}%</span>`:''}</div><p>If you are away when it lands, your walls, traps, turrets and guards fight it without you.</p></div>
      <div class="card"><small class="h" style="color:var(--amber2)">Brought in by your people</small>${pile.length?`<div class="grid" style="margin:6px 0">${pile.map(([id,n])=>slot({id,n})).join('')}</div>${btn('Collect','pile','','go')}`:'<p>Nothing waiting. Foragers, hunters and scavengers report at dawn.</p>'}</div></div>`;
    h+=`<div style="height:12px"></div>${sec('Survivors '+s.surv.length+' / '+cap,'Morale '+s.morale)}<div class="prog" style="margin-bottom:8px"><i style="width:${s.morale}%;background:${s.morale<30?'var(--red)':s.morale<60?'var(--amber)':'var(--green)'}"></i></div>`;
    h+=s.surv.length?`<div class="list">${s.surv.map(v=>`<div class="rec">${gimg('people','#8a9a78')}<div><b>${esc(v.n)}</b> <small>day ${v.days}</small><br><small>${esc(SURV_TRAITS[v.trait].n)}: ${esc(SURV_TRAITS[v.trait].d)}</small><br><small style="color:var(--ink)">${esc(JOBS[v.job].d)}</small></div><select class="sel2" data-c="job" data-id="${v.id}" id="job${v.id}">${Object.entries(JOBS).map(([j,J])=>`<option value="${j}" ${v.job===j?'selected':''}>${J.n}</option>`).join('')}</select></div>`).join('')}</div>`
      :`<div class="card"><p>Nobody yet. Every bed beyond your own is room for one more: people turn up on the road, at your fence, in cages in the places you clear. A signal fire brings them in by themselves. Each needs one meal and one drink a day from your storage boxes.</p></div>`;
    return h;
  },
  act(a){if(a==='pile'){World.collectPile(S());UI().dirty()}},change(c,v,d){if(c==='job')World.setJob(S(),+d.id,v)}};

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
    return`<div class="quote">${esc(ev.x)}</div><div style="display:grid;gap:6px">${ev.o.map((o,i)=>{const why=World.optionBlocked(s,o);return`<button class="btn" style="text-align:left;white-space:normal" data-a="opt" data-i="${i}" ${why?'disabled':''}>${esc(o.l)}${why?` <small style="color:#ff8a7a">(${esc(why)})</small>`:''}</button>`}).join('')}</div>`;
  },
  act(a,d){if(a==='opt'){evRes=World.chooseOption(curEv,+d.i)}else if(a==='done'){UI().close();return false}},
  close(){evRes=null;World.eventDone()}};
let curEv=null;{const P=PANELS.event,r0=P.render;P.render=id=>{curEv=id;return r0(id)}}

// ---------------------------------------------------------------- small station dialogs
const infoCard=(i,body)=>{const o=G.Z.obj[i],d=OBJ[o.k];return`<div class="card"><h3>${esc(d.n)}</h3>${d.d?`<p>${esc(d.d)}</p>`:''}${o.hp?`<div class="tags"><span>${Math.round(o.hp)} / ${maxHp(o.k)} health</span></div>`:''}${body||''}</div>`};
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
PANELS.death={title:'You died',narrow:true,modal:true,render(){const s=S(),Z=G.Z;return`<div class="quote">${Z&&Z.home?'They got you inside your own fence. What you carried is lying where you fell.':'You went down in '+esc(Z?Z.name:'the wild')+'. Somebody dragged you home. Your pack stayed behind, and it will wait there until you go back for it.'}</div><div class="tags"><span>Day ${dayOf(s.t)}</span><span>${s.stats.kills||0} put down</span><span>what you wear and hold comes with you</span></div><div class="row" style="justify-content:flex-end">${btn('Wake up','go','','go')}</div>`},
  act(){UI().close();return false},close(){World.respawn()}};
PANELS.tideEnd={title:r=>r.won?'The tide breaks':'Overrun',narrow:true,render(r){return`<div class="quote">${r.won?esc(r.name)+', number '+r.n+', is finished. The valley goes quiet again.':'They went through you and through the walls. What was left of them moved on by morning.'}</div><div class="tags">${r.won?`<span>+${r.xp} xp</span><span>+${r.scrip} scrip</span>`:''}<span>${r.lost} structure${r.lost===1?'':'s'} lost</span></div>${r.items.length?sec('Picked up from the field')+`<div class="grid">${r.items.map(i=>slot(i)).join('')}</div>`:''}<div class="row" style="justify-content:flex-end;margin-top:10px">${btn('Carry on','ok','','go')}</div>`},act(){UI().close();return false}};
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

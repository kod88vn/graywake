// The interface: HUD, toasts, build mode, title screen, and the plumbing that opens sheets and the map.
import {G,VERSION,weaponDef,count,quickUse,place,upgrade,repair,demolish,rotateObj,moveObj,canMove,canPlace,canUpgrade,isEdgeKind,edgeIdx,EREF,structAt,buildCost,buildUnlocked,repairCost,maxHp,inBuildArea,freeSlots} from '../sim/core.js';
import * as World from '../sim/world.js';
import {story,goalProgress,goalText,contractReady} from '../sim/quests.js';
import {autoPlan} from '../sim/actors.js';
import {Portrait} from '../view/portrait.js';
import {ITEMS} from '../data/items.js';
import {OBJ,BUILD_CATS} from '../data/objects.js';
import {TIDE_KINDS,WEATHER} from '../data/events.js';
import {ACHIEVEMENTS,STORY,xpFor} from '../data/progress.js';
import {dayOf,fmtTime} from '../sim/util.js';
import {View} from '../view/render.js';
import {$,esc,img,gimg,chips,bus,fmtMin} from './dom.js';
import {iconURL,iconFor} from './icons.js';
import {PANELS} from './panels.js';
import {MapScreen} from './map.js';

let api,cur=null,curArg=null,curTab=null,hudT=0,miniT=0,questT=0,deathT=0,needHud=true,hints=[],hintT=0;
const B={tool:'place',cat:'base',kind:'wall_stick',rot:0,last:-1,hover:null,side:0,run:null,moving:null};
const FACING=['south','east','north','west'];
const DIRS=['north','east','south','west'];
export const UI={init,title,start,zone,frame,onEvent,dirty(){needHud=true;if(cur&&PANELS[cur].live)refresh()},hot,buildPointer,resize(){if(G.mode==='map')MapScreen.draw()},toast,open,close,refresh,banner,get panel(){return cur}};
bus.UI=UI;bus.api=()=>api;

function init(a){
  api=a;
  $('px').onclick=()=>close();
  $('shade').addEventListener('pointerdown',e=>{if(e.target===$('shade')&&PANELS[cur]&&!PANELS[cur].modal)close()});
  $('pb').addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el||el.disabled)return;const P=PANELS[cur];if(P&&P.act){const keep=$('pb').scrollTop;const r=P.act(el.dataset.a,el.dataset,el);if(r!==false&&cur){refresh();$('pb').scrollTop=keep}}});
  $('pb').addEventListener('change',e=>{const el=e.target.closest('[data-c]');if(!el)return;const P=PANELS[cur];if(P&&P.change){P.change(el.dataset.c,el.value,el.dataset,el);if(cur)refresh()}});
  $('tabs').addEventListener('click',e=>{const el=e.target.closest('[data-t]');if(el){curTab=el.dataset.t;refresh();$('pb').scrollTop=0;sfx('ui_tap')}});
  $('stat').addEventListener('click',e=>{const el=e.target.closest('[data-q]');if(el&&G.S&&!G.paused){quickUse(G.S,el.dataset.q);needHud=true}});
  $('quest').onclick=()=>open('journal');
  $('travel').onclick=()=>{World.leaveZone()};
  $('btns').addEventListener('click',e=>{const el=e.target.closest('[data-h]');if(el)hot(el.dataset.h)});
  $('weap').addEventListener('click',e=>{const el=e.target.closest('[data-w]');if(!el)return;if(el.dataset.w==='auto'){hot('auto')}else if(el.dataset.w==='w1'||el.dataset.w==='w2'){G.S.p.active=el.dataset.w;bus.emitEq();needHud=true}});
  $('build').addEventListener('click',e=>{const el=e.target.closest('[data-b]');if(!el)return;const[k,v]=el.dataset.b.split(':');
    B.just=null;if(k==='tool'){if(v==='done')return buildClose();if(v==='rot'){hot('rotate');return}B.tool=v;B.moving=null}else if(k==='cat'){B.cat=v;const first=pieces()[0];if(first)B.kind=first.id;B.tool='place'}else if(k==='kind'){B.kind=v;B.tool='place'}
    renderBuild();sfx('ui_tap')});
  // the mouse wheel moves the build bar sideways, and wheel or keys over a sheet scroll it rather than the game
  $('bpieces').addEventListener('wheel',e=>{e.preventDefault();$('bpieces').scrollLeft+=e.deltaY||e.deltaX},{passive:false});
  addEventListener('keydown',e=>{if(!cur)return;const pb=$('pb'),k=e.code;if(k==='PageDown'||k==='PageUp'||k==='ArrowDown'||k==='ArrowUp'||k==='Home'||k==='End'){e.preventDefault();pb.scrollTop=k==='Home'?0:k==='End'?pb.scrollHeight:pb.scrollTop+(k==='PageDown'?1:k==='PageUp'?-1:k==='ArrowDown'?.18:-.18)*pb.clientHeight}});
  bus.emitEq=()=>{G.ev.push(['eq'])};bus.zoom=f=>View.setZoom(View.zoom*f);
  MapScreen.init();
}
const sfx=n=>G.ev.push(['sfx',n]);

// ---------------------------------------------------------------- title
function title(){
  G.mode='menu';$('hud').hidden=true;$('map').hidden=true;$('build').hidden=true;$('shade').hidden=true;$('touch').style.visibility='hidden';cur=null;G.build=null;
  const has=api.hasSave(),t=$('title');t.hidden=false;
  t.querySelector('.in').innerHTML=`<h1>Gray<i>wake</i></h1><div class="tag">Build · Scavenge · Hold the line</div>
    ${has?'<button class="btn go" id="t-cont">Continue</button>':''}<button class="btn ${has?'':'go'}" id="t-new">New game</button>
    <div id="t-confirm" hidden><p>This replaces your saved homestead. Start over?</p><div class="row" style="justify-content:center"><button class="btn bad" id="t-yes">Start over</button><button class="btn" id="t-no">Keep my save</button></div></div>
    <p>A clearing, a dead truck, and a valley full of husks. Fell trees, raise walls, plant a garden, walk out past the tree line for everything else. Every third night the tide comes for whatever you have built.</p>
    <div class="keys"><span><b>WASD</b> move</span><span><b>Mouse</b> aim · <b>click</b> attack</span><span><b>E</b> interact · <b>F</b> auto-gather</span><span><b>Space</b> dodge · <b>Shift</b> sneak</span><span><b>I</b> pack · <b>C</b> craft · <b>B</b> build</span><span><b>J</b> journal · <b>Q</b> swap weapon</span><span><b>Touch</b> left thumb moves, pad on the right</span><span>Progress saves in this browser</span></div>
    <p style="font-size:11px;opacity:.6">v${VERSION}</p>`;
  const go=fn=>{$('fade').classList.add('on');setTimeout(()=>{fn();setTimeout(()=>$('fade').classList.remove('on'),150)},300)};
  if(has)$('t-cont').onclick=()=>go(()=>{if(!api.continueGame())title()});
  $('t-new').onclick=()=>{if(has){$('t-confirm').hidden=false}else go(()=>api.newGame())};
  $('t-yes').onclick=()=>go(()=>api.newGame());$('t-no').onclick=()=>{$('t-confirm').hidden=true};
}
function start(){$('title').hidden=true;$('hud').hidden=false;$('touch').style.visibility='';needHud=true;zone();const S=G.S;if(S.q.i===0&&S.t<7*60+2&&!window.__noIntro){setTimeout(()=>{if(G.mode==='play'&&!cur)open('journal')},900);hints=[[4,'Walk up to anything ringed in gold and press E (or the Use button) to gather or search it'],[16,'F toggles auto-gather: you walk and collect by yourself until the pack is full'],[40,'I opens your pack. C crafts by hand. Tap the food and water bars to eat and drink'],[90,'When you are ready to explore, walk to any edge of the clearing']]}}
function zone(){
  if(!G.S)return;$('map').hidden=true;$('hud').hidden=false;buildClose();buttons();const Z=G.Z,S=G.S;
  if(Z)banner(Z.name,Z.home?'Day '+dayOf(S.t):'Level '+Z.lvl+(Z.cold?' · freezing':'')+(Z.tox?' · toxic air':'')+(Z.dark?' · dark':''));
  needHud=true;
}
/** The row of buttons top right: depends on where you are and what is waiting for you. */
function buttons(){
  const Z=G.Z,home=Z&&Z.home,S=G.S,pile=Object.keys(S.home.pile).length;
  const b=(h,gl,key,tip,dot)=>`<button class="ib" data-h="${h}" title="${tip}">${gimg(gl)}<kbd>${key}</kbd>${dot?`<span class="dot">${dot}</span>`:''}</button>`;
  $('btns').innerHTML=b('inv','backpack_open','I','Pack')+b('craft','wrench','C','Craft')+(home?b('build','hammer_build','B','Build'):'')+b('journal','book','J','Journal',S.p.sp||'')+(home?b('camp','people','L','Camp',pile?'!':''):'')+b('menu','gear','P','Menu');
}

// ---------------------------------------------------------------- feedback
function toast(msg,kind='info'){const t=$('toasts');while(t.children.length>=4)t.firstChild.remove();const d=document.createElement('div');d.className=kind;d.textContent=msg;t.appendChild(d);setTimeout(()=>d.remove(),3700)}
function banner(big,small=''){const b=$('banner');b.classList.remove('on');b.firstElementChild.textContent=big;b.lastElementChild.textContent=small;void b.offsetWidth;b.classList.add('on')}
function feed(id,n){const f=$('feed');const same=[...f.children].find(c=>c.dataset.id===id&&Date.now()-c.dataset.t<1500);if(same){same.dataset.n=+same.dataset.n+n;same.lastChild.textContent='+'+same.dataset.n+' '+ITEMS[id].n;return}
  while(f.children.length>=6)f.lastChild.remove();const d=document.createElement('div');d.dataset.id=id;d.dataset.n=n;d.dataset.t=Date.now();d.innerHTML=img(id)+'<span></span>';d.lastChild.textContent='+'+n+' '+ITEMS[id].n;f.prepend(d);setTimeout(()=>d.remove(),2600)}
function floatNum(x,y,dmg,crit,isPl){const fl=$('float');if(fl.children.length>40)return;const p=View.project(x,y,1.3);if(!p.vis)return;const s=document.createElement('span');s.textContent=dmg;s.className=isPl?'p':crit?'c':'';s.style.left=(p.x+(Math.random()-.5)*26)+'px';s.style.top=p.y+'px';fl.appendChild(s);setTimeout(()=>s.remove(),800)}

function onEvent(e){
  const t=e[0],S=G.S;
  if(t==='toast')toast(e[1],e[2]);else if(t==='loot'){feed(e[1],e[2]);needHud=true}else if(t==='hit')floatNum(e[1],e[2],e[3],e[4],e[5]);
  else if(t==='jobDone'){const o=G.Z&&G.Z.obj[e[1]];if(o)toast(OBJ[o.k].n+(o.out?': finished, but your pack is full. Collect it from the station':': finished'),o.out?'bad':'good')}
  else if(t==='ui'){const n=e[1],a=e[2];
    if(n==='levelup'){banner('Level '+a,'Perk point earned');G.ev.push(['fx','level',G.Z?G.Z.pl.x:0,G.Z?G.Z.pl.y:0]);const fresh=Object.values(OBJ).filter(o=>o.cost&&o.lv===a&&!o.bp).length;if(fresh)toast(fresh+' new thing'+(fresh>1?'s':'')+' to build','good');buttons();if(G.build)renderBuild()}
    else if(n==='questDone'){const q=STORY.find(q=>q.id===a),nx=story(S);banner('Done',q?q.t:'');if(nx)setTimeout(()=>toast('New in your journal: '+nx.t,'info'),1800);questT=0}
    else if(n==='ach'){const A=ACHIEVEMENTS.find(x=>x.id===a);toast('Achievement: '+A.n,'good')}
    else if(n==='map'){closeQuiet();MapScreen.open()}
    else if(n==='lead'){if(!cur&&!G.build&&G.mode==='play')open('lead',a)}
    else if(n==='death'){deathT=1.6}
    else if(n==='tideWarn'){const k=TIDE_KINDS.find(k=>k.id===S.tide.kind);banner('Tide coming',k.n+' from the '+DIRS[S.tide.dir]);if(G.mode==='map')MapScreen.draw()}
    else if(n==='tideStart'){const k=TIDE_KINDS.find(k=>k.id===S.tide.kind);banner('The tide',k.n+' · from the '+DIRS[S.tide.dir]);closeQuiet();buildClose()}
    else if(n==='tideEnd')setTimeout(()=>open('tideEnd',a),900);
    else if(n==='wake')banner('Day '+a,WEATHER[S.weather.id].n);
    else if(n==='ending')setTimeout(()=>open('ending'),2500);
    else if(PANELS[n])open(n,a);
    else if(OBJ[G.Z&&G.Z.obj[a]&&G.Z.obj[a].k])open('info',a)}
}

// ---------------------------------------------------------------- sheets
function open(name,arg){
  const P=PANELS[name];if(!P)return;if(P.can&&!P.can(arg))return;
  if(G.build)buildClose();cur=name;curArg=arg;curTab=P.tabs?(P.tab?P.tab(arg):P.tabs(arg)[0][0]):null;G.paused=true;G.busy=true;if(P.open)P.open(arg);
  $('shade').hidden=false;refresh();$('pb').scrollTop=0;sfx('ui_open');
}
function refresh(){
  const P=PANELS[cur];if(!P)return;const tabs=P.tabs?P.tabs(curArg):null;
  $('panel').className=P.narrow?'narrow':'';$('ph').querySelector('.ttl').textContent=typeof P.title==='function'?P.title(curArg):P.title;
  $('tabs').innerHTML=tabs?tabs.map(([id,l,dot])=>`<button data-t="${id}" class="${id===curTab?'on':''}">${l}${dot?' <span style="color:var(--amber2)">●</span>':''}</button>`).join(''):'';
  $('px').hidden=!!P.modal;$('pb').innerHTML=P.render(curArg,curTab);needHud=true;
  if(cur==='inv')Portrait.mount($('doll'),G.S.p.eq,G.S.p.active);
}
function closeQuiet(){if(!cur)return;const P=PANELS[cur],a=curArg;cur=null;curArg=null;$('shade').hidden=true;G.paused=false;G.busy=false;if(P.close)P.close(a)}
function close(){if(!cur)return;sfx('ui_close');closeQuiet();if(G.mode==='map')MapScreen.draw()}

// ---------------------------------------------------------------- hot-keys
function hot(k){
  const S=G.S;if(!S||G.mode==='menu')return;const Z=G.Z;
  if(k==='esc'){if(cur){if(!PANELS[cur].modal)close()}else if(G.build){if(B.moving!=null){B.moving=null;toast('Put back','info')}else buildClose()}else open('menu');return}
  if(cur){if(PANELS[cur].modal)return;const same={inv:'inv',craft:'craft',journal:'journal',camp:'camp',menu:'menu'}[k]===cur;close();if(same)return}
  if(k==='inv')open('inv');else if(k==='journal')open('journal');else if(k==='menu')open('menu');
  else if(k==='craft'){const h=Z&&Z.hint;open('craft',h&&h.type==='station'?h.i:null)}
  else if(k==='camp'){if(Z&&Z.home)open('camp');else toast('Your camp ledger is at home','info')}
  else if(k==='build'){if(G.build)buildClose();else if(Z&&Z.home&&!S.tide.live)buildOpen();else toast(S.tide.live?'Not during a tide':'You can only build at home','info')}
  else if(G.mode!=='play'||!Z)return;
  else if(k==='swap'){S.p.active=S.p.active==='w1'?'w2':'w1';bus.emitEq();sfx('equip');needHud=true}
  else if(k==='auto'){G.auto=!G.auto;if(Z.pl){Z.pl.auto=null;Z.pl.fight=null}if(G.auto){const pl=autoPlan(Z);toast('Auto-gather on'+(pl.using.length?': using '+pl.using.join(', ').toLowerCase():': by hand only'),'info');if(pl.skipping.length)toast('Skipping '+pl.skipping.slice(0,3).join(', '),'bad')}else toast('Auto-gather off','info');needHud=true}
  else if(k==='rotate'){if(!G.build)return;
    // placing or carrying: turn the piece in hand. Otherwise turn the structure under the pointer where it stands.
    if(B.tool==='place'||(B.tool==='move'&&B.moving!=null)){B.rot=(B.rot+1)%4;sfx('ui_tap')}else if(B.hover){const[tx,ty]=B.hover,T=buildTarget(tx,ty);if(tx>=0&&ty>=0&&tx<Z.w&&ty<Z.h&&T.o&&OBJ[T.o.k].cost)rotateObj(S,T.ref,tx,ty);else toast('Point at one of your structures to turn it','info')}}
  else if(k==='leave'){if(Z.exit)World.leaveZone();else toast('Walk to the edge of the area to leave','info')}
  else if(k.startsWith('q_')){quickUse(S,k.slice(2));needHud=true}
}

// ---------------------------------------------------------------- build mode
const pieces=()=>Object.values(OBJ).filter(o=>o.cost&&o.cat===B.cat).sort((a,b)=>a.lv-b.lv);
function buildOpen(){G.build=B;G.auto=false;B.last=-1;B.moving=null;B.tool='place';B.just=null;$('build').hidden=false;$('bot').hidden=true;renderBuild();sfx('ui_open')}
function buildClose(){if(!G.build)return;G.build=null;$('build').hidden=true;$('bot').hidden=false;View.setGhost(null)}
function renderBuild(){
  const S=G.S,tools=[['place','Place'],['move','Move'],['turn','Rotate'],['upgrade','Upgrade'],['repair','Repair'],['remove','Remove']];
  $('btool').innerHTML=tools.map(([id,l])=>`<button data-b="tool:${id}" class="${B.tool===id?'on':''}">${l}</button>`).join('')+(B.tool==='place'||B.tool==='move'?`<button data-b="tool:rot" title="R or right-click">Turn piece ↻</button>`:'')+`<button data-b="tool:done" style="margin-left:auto;border-color:var(--amber)!important;color:var(--amber2)">Done</button>`;
  $('bcat').innerHTML=BUILD_CATS.map(([id,l])=>`<button data-b="cat:${id}" class="${B.cat===id?'on':''}">${l}</button>`).join('');
  const list=pieces().filter(o=>o.bp?S.p.known[o.bp]||o.lv<=S.p.lvl+6:o.lv<=S.p.lvl+6);
  $('bpieces').innerHTML=list.map(o=>{const ok=buildUnlocked(S,o.id);return`<button class="bp ${B.kind===o.id&&B.tool==='place'?'on':''} ${ok?'':'off'}" data-b="kind:${o.id}" title="${esc(o.d||o.n)}"><b>${esc(o.n)}</b>${ok?chips(buildCost(o.id)):`<div class="ing"><span class="no">${o.bp&&!S.p.known[o.bp]?'Schematic':'Level '+o.lv}</span></div>`}</button>`}).join('');
  $('bpieces').style.display=B.tool==='place'?'':'none';$('bcat').style.display=B.tool==='place'?'':'none';
}
/** What a build tool is pointing at: the wall on the nearest side of the cell when the pointer is close to that side, otherwise the cell's object. */
function buildTarget(tx,ty){const Z=G.Z,i=ty*Z.w+tx;if(tx<0||ty<0||tx>=Z.w||ty>=Z.h)return{i,ref:i,o:null};
  if(B.near<.3||!Z.obj[i]){const e=edgeIdx(Z.w,tx,ty,B.side);if(Z.ed[e]&&(B.near<.3||!Z.fl[i]))return{i,ref:EREF+e,o:Z.ed[e],edge:true}}
  return{i,ref:i,o:Z.obj[i]}}
function buildApply(tx,ty){
  const S=G.S,Z=G.Z,i=ty*Z.w+tx;if(tx<0||ty<0||tx>=Z.w||ty>=Z.h)return;let ok=false;
  const T=buildTarget(tx,ty);
  if(B.tool==='place'){ok=isEdgeKind(B.kind)?place(S,B.kind,tx,ty,B.side):place(S,B.kind,tx,ty,B.rot);if(ok)B.just=tx+'_'+ty+'_'+B.side}
  else if(B.tool==='move'){
    if(B.moving==null){const o=T.o;if(o&&OBJ[o.k].cost){B.moving=T.ref;if(!T.edge)B.rot=o.r||0;sfx('ui_tap');toast('Picked up '+OBJ[o.k].n.toLowerCase()+(T.edge?': tap the side of a cell where it should stand':': tap where it should go'),'info')}else{toast('Tap one of your structures to pick it up','info')}}
    else if(!structAt(Z,B.moving))B.moving=null;
    else if(moveObj(S,B.moving,tx,ty,B.moving>=EREF?B.side:B.rot)){B.moving=null;ok=true}}
  else if(B.tool==='turn')ok=T.edge?rotateObj(S,T.ref,tx,ty):rotateObj(S,i);
  else if(B.tool==='upgrade')ok=T.o?upgrade(S,T.ref,false):upgrade(S,i,!!Z.fl[i]);
  else if(B.tool==='repair'){if(T.o)ok=repair(S,T.ref)}
  else if(B.tool==='remove')ok=T.o?demolish(S,T.ref,false):demolish(S,i,!!Z.fl[i]);
  if(ok)renderBuild();
}
function buildPointer(type,x,y,down){
  if(!G.build||!G.Z)return;const p=View.pick(x,y);if(!p)return;const tx=Math.floor(p.x),ty=Math.floor(p.y),i=ty*G.Z.w+tx;B.hover=[tx,ty];
  // the nearest side of the cell under the pointer (0 north, 1 east, 2 south, 3 west) and how far the pointer is from it
  {const fx=p.x-tx,fy=p.y-ty,d=[fy,1-fx,1-fy,fx];let sd=0;for(let k=1;k<4;k++)if(d[k]<d[sd])sd=k;B.side=sd;B.near=d[sd]}
  if(type==='up'){B.last=-1;B.run=null;return}
  // walls: press to set the first piece, then drag along it to run a straight line
  if(B.tool==='place'&&isEdgeKind(B.kind)){const S=G.S,Z=G.Z;
    if(type==='down'){const horiz=B.side===0||B.side===2;B.run={horiz,line:horiz?(B.side===0?ty:ty+1):(B.side===3?tx:tx+1)};if(place(S,B.kind,tx,ty,B.side)){B.just=tx+'_'+ty+'_'+B.side;renderBuild()}return}
    if(type==='move'&&down&&B.run){const r=B.run,cx=r.horiz?tx:r.line,cy=r.horiz?r.line:ty,sd=r.horiz?0:3,key=cx+'_'+cy;if(key!==B.last&&cx>=0&&cy>=0&&cx<Z.w&&cy<Z.h){B.last=key;if(canPlace(S,B.kind,cx,cy,sd)===null&&place(S,B.kind,cx,cy,sd)){B.just=tx+'_'+ty+'_'+B.side;renderBuild()}}}
    return}
  // painting by dragging is for placing and clearing; moving and turning act once per tap
  if((type==='down'||(type==='move'&&down&&B.tool!=='move'&&B.tool!=='turn'))&&i!==B.last){B.last=i;buildApply(tx,ty)}
}
function buildFrame(){
  const S=G.S,Z=G.Z,h=B.hover;let info='';
  if(B.tool==='place'){const d=OBJ[B.kind];info=`<b style="color:var(--ink)">${esc(d.n)}</b> · ${esc(d.d||(d.wall?'Stands on the side of a cell you point at; the cell stays free. Drag to run a line. '+d.hp+' health.':d.door?'Stands on the side of a cell. You walk through it; they have to break it.':d.floor?'Flooring.':d.store?d.store+' slots of storage.':d.station?'Crafting station.':d.trap?'Triggers when something walks over it.':d.turret?'Fires on anything hostile in range. Needs loading.':''))}`}
  else info={move:B.moving!=null&&structAt(Z,B.moving)?`Carrying <b style="color:var(--ink)">${esc(OBJ[structAt(Z,B.moving).k].n)}</b>: ${B.moving>=EREF?'tap the side of a cell to stand it there':'tap a free tile to set it down'}. Esc puts it back.`:'Tap a structure to pick it up, then tap where it should go. Moving is free and keeps its contents.',turn:'Tap a structure to turn it a quarter turn; a wall swings to the next side of its cell. R does the same to whatever you point at.',upgrade:'Tap a structure to raise it to the next tier.',repair:'Tap a damaged structure to mend it.',remove:'Tap a structure to take it down. Half the materials come back.'}[B.tool];
  if((B.tool==='place'&&!isEdgeKind(B.kind))||(B.tool==='move'&&B.moving!=null&&B.moving<EREF))info+=` · facing ${FACING[B.rot]}`;
  if(h){const[tx,ty]=h,i=ty*Z.w+tx,T=buildTarget(tx,ty);let why=null,kind='*',edge=T.edge?B.side:-1;
    if(tx<0||ty<0||tx>=Z.w||ty>=Z.h)why='Out of bounds';
    else if(B.tool==='place'){kind=B.kind;why=canPlace(S,B.kind,tx,ty,B.side);edge=isEdgeKind(B.kind)?B.side:-1;
      const here=tx+'_'+ty+'_'+B.side;if(B.just&&B.just!==here&&!(B.just.startsWith(tx+'_'+ty+'_')&&!isEdgeKind(B.kind)))B.just=null;if(B.just&&why&&/already|Occupied|floored/i.test(why)){why=null;kind='*';info+=' · <span class="okc">placed</span>'}}
    else if(B.tool==='move'){const m=B.moving!=null&&structAt(Z,B.moving);if(m){const ed=B.moving>=EREF;kind=m.k;why=canMove(S,B.moving,tx,ty,ed?B.side:B.rot);edge=ed?B.side:-1}else{const o=T.o;if(!(o&&OBJ[o.k].cost))why='Nothing of yours here'}}
    else if(B.tool==='turn'){const o=T.o;if(!(o&&OBJ[o.k].cost))why='Nothing of yours here';else if(!T.edge)info+=` · ${esc(OBJ[o.k].n)} faces ${FACING[o.r||0]}`}
    else if(B.tool==='upgrade'){why=T.o?canUpgrade(S,T.ref,false):canUpgrade(S,i,!!Z.fl[i]);const k=T.o?T.o.k:Z.fl[i];if(k&&OBJ[k].up)info=`${esc(OBJ[k].n)} → <b style="color:var(--ink)">${esc(OBJ[OBJ[k].up].n)}</b> ${chips(buildCost(OBJ[k].up))}`}
    else if(B.tool==='repair'){const o=T.o;if(!o||!OBJ[o.k].cost)why='Nothing to repair';else{const c=repairCost(o);if(!c)why='No damage';else info=`${esc(OBJ[o.k].n)} ${Math.round(o.hp)}/${maxHp(o.k)} ${chips(c)}`}}
    else if(B.tool==='remove'){const o=T.o;if(!(o&&OBJ[o.k].cost)&&!Z.fl[i])why='Nothing of yours here'}
    View.setGhost(kind,tx,ty,!why,B.rot,edge);if(why)info+=` · <span class="danger">${esc(why)}</span>`}
  else View.setGhost(null);
  const el=$('binfo');if(el._h!==info){el._h=info;el.innerHTML=info}
}

// ---------------------------------------------------------------- HUD
const setBar=(el,v,max,warn)=>{el.firstElementChild.style.width=Math.max(0,Math.min(100,v/max*100))+'%';el.querySelector('.num').textContent=Math.ceil(v)+(max!==100?' / '+max:'');el.classList.toggle('warn',!!warn)};
function frame(dt){if(cur==='inv')Portrait.frame(dt||.016);
  const S=G.S,Z=G.Z;if(!S||!Z)return;const p=Z.pl,ds=G.ds;
  if(deathT>0){deathT-=dt;if(deathT<=0)open('death')}
  if(cur&&!G.hold&&PANELS[cur].tick&&PANELS[cur].tick(curArg,dt||1/60)){const keep=$('pb').scrollTop;refresh();$('pb').scrollTop=keep}
  if(hints.length){hintT+=dt;if(hintT>=hints[0][0]){toast(hints.shift()[1],'info')}}
  if(G.build)buildFrame();
  hudT-=dt;if(hudT>0&&!needHud)return;hudT=.1;needHud=false;
  const st=$('stat').children;setBar(st[0],S.p.hp,ds.maxHp,S.p.hp<ds.maxHp*.25);setBar(st[1],S.p.food,100,S.p.food<15);setBar(st[2],S.p.water,100,S.p.water<15);st[3].hidden=S.p.tox<1;if(S.p.tox>=1)setBar(st[3],S.p.tox,100,S.p.tox>=50);
  $('lvl').firstElementChild.textContent=S.p.lvl;$('lvl').querySelector('i').style.width=Math.min(100,S.p.xp/xpFor(S.p.lvl)*100)+'%';
  const bf=S.p.buffs.map(b=>`<span>${{speed:'Quick',haste:'Sharp',resist:'Steady',regen:'Mending',vigor:'Hale',weak:'Weak'}[b.k]||b.k} ${Math.ceil(b.t)}s</span>`).join('')+(p.sneak?'<span style="color:var(--violet)">Sneaking</span>':'')+(ds.set?`<span>Set bonus</span>`:'')+(Z.cold&&ds.cold<.95?'<span class="danger">Freezing</span>':'')+(Z.heat?'<span>Heat</span>':'');
  if($('buffs')._h!==bf){$('buffs')._h=bf;$('buffs').innerHTML=bf}
  const W=WEATHER[S.weather.id];$('clock').firstElementChild.innerHTML=`DAY ${dayOf(S.t)} · ${fmtTime(S.t)}<span>${W.n}</span>`;
  const T=S.tide,te=$('tide');if(T.live){te.className='live';te.textContent=`TIDE ${T.n+1} · ${T.live.left||T.live.total} LEFT`}else{const left=T.at-S.t;te.className=left<12*60?'soon':'';te.textContent=`TIDE ${T.n+1} IN ${fmtMin(left).toUpperCase()}`+(T.warned?' · '+DIRS[T.dir].toUpperCase():'')}
  let boss=null;for(const a of Z.actors)if(a.team===1&&!a.dead&&(a.def.boss)&&a.alert){boss=a;break}
  $('boss').hidden=!boss;if(boss){$('boss').firstElementChild.textContent=boss.def.n.toUpperCase();$('boss').querySelector('i').style.width=boss.hp/boss.mhp*100+'%'}
  $('vig').className=p.hurtT>.15?'hurt':S.p.hp<ds.maxHp*.25?'low':S.p.tox>=50?'tox':'';
  // prompt, weapons
  const h=Z.hint,pr=$('prompt'),show=h&&!G.build&&!p.dead&&!p.act;pr.hidden=!show;
  if(show){const name=h.drop?'':h.i!==undefined&&Z.obj[h.i]?OBJ[Z.obj[h.i].k].n:'';const txt=`<kbd>E</kbd>${esc(h.label)}${name?' · '+esc(name):''}`;if(pr._h!==txt){pr._h=txt;pr.innerHTML=txt}}
  $('b-use').textContent=h?h.label:'Use';$('b-use').classList.toggle('act',!!h);
  $('travel').hidden=!(Z.exit&&!S.tide.live&&!G.build&&!p.dead);$('travel').textContent=Z.home?'Leave the homestead':'Leave '+Z.name;
  let wh='';for(const s of['w1','w2']){const e=S.p.eq[s],it=e&&ITEMS[e.id];wh+=`<button class="ws ${S.p.active===s?'on':''}" data-w="${s}" title="${it?esc(it.n):'Fists'}">${it?img(e.id):gimg('sword_cross','#6a6a5a')}${it&&it.ammo?`<u class="num">${count(S,it.ammo)}</u>`:it&&e.n?`<u class="num">${e.n}</u>`:''}${it&&it.dur&&e.d!==undefined?`<s><i style="width:${Math.round(e.d/it.dur*100)}%"></i></s>`:''}</button>`}
  wh+=`<button class="ib ${G.auto?'on':''}" id="auto" data-w="auto" title="Auto-gather (F)"><b>AUTO</b></button>`;
  if($('weap')._h!==wh){$('weap')._h=wh;$('weap').innerHTML=wh;const w=weaponDef(S);$('b-atk').innerHTML=w.id==='fist'?gimg('sword_cross'):img(S.p.eq[S.p.active].id)}
  questT-=.1;if(questT<=0){questT=1;{const k=(S.p.sp>0)+'|'+Object.keys(S.home.pile).length+'|'+(Z.home?1:0);if(buttons._k!==k){buttons._k=k;buttons()}}const q=story(S);let qh='';if(q){qh=`<div class="h">${esc(q.t)}</div>`+q.goals.map(g=>{const[c,n]=goalProgress(S,g);return`<div class="${c>=n?'ok':''}"><span>${esc(goalText(g))}</span><span class="num">${n>1?c+'/'+n:c>=n?'✓':''}</span></div>`}).join('')}
    const rdy=S.q.contracts.filter(c=>contractReady(S,c)).length;if(rdy)qh+=`<div class="ok"><span>${rdy} contract${rdy>1?'s':''} ready to hand in</span><span></span></div>`;
    if($('quest')._h!==qh){$('quest')._h=qh;$('quest').innerHTML=qh;$('quest').hidden=!qh}}
  miniT-=.1;if(miniT<=0){miniT=.25;minimap(Z,p)}
}
function minimap(Z,p){
  const c=$('mini'),x=c.getContext('2d'),R=112,range=G.ds.radar?26:16,k=R/range;x.clearRect(0,0,224,224);x.save();x.beginPath();x.arc(R,R,R-2,0,7);x.clip();x.fillStyle='rgba(20,24,16,.55)';x.fillRect(0,0,224,224);
  const px=p.x,py=p.y,X=v=>R+(v-px)*k,Y=v=>R+(v-py)*k;
  x.fillStyle='rgba(150,128,90,.35)';x.fillRect(X(0),Y(0),Z.w*k,2*k);x.fillRect(X(0),Y(Z.h-2),Z.w*k,2*k);x.fillRect(X(0),Y(0),2*k,Z.h*k);x.fillRect(X(Z.w-2),Y(0),2*k,Z.h*k);
  const x0=Math.max(0,Math.floor(px-range)),x1=Math.min(Z.w-1,Math.ceil(px+range)),y0=Math.max(0,Math.floor(py-range)),y1=Math.min(Z.h-1,Math.ceil(py+range));
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){const o=Z.obj[ty*Z.w+tx];if(!o)continue;const d=OBJ[o.k];
    if(d.wall||d.door){x.fillStyle=d.cost?'#b8a070':'#6a6f66';x.fillRect(X(tx),Y(ty),k+.5,k+.5)}else if(d.loot&&!o.empty){x.fillStyle='#e3a432';x.fillRect(X(tx+.25),Y(ty+.25),k*.5,k*.5)}else if(d.station||d.store||d.turret){x.fillStyle='#8a9a78';x.fillRect(X(tx+.15),Y(ty+.15),k*.7,k*.7)}else if(d.special==='deathbag'){x.fillStyle='#fff';x.fillRect(X(tx),Y(ty),k,k)}}
  if(Z.ed.length){const col=w=>OBJ[w.k].cost?'#b8a070':OBJ[w.k].low?'#55594f':'#8a8f84';for(let ty=y0;ty<=y1+1;ty++)for(let tx=x0;tx<=x1+1;tx++){const e=(ty*Z.w+tx)*2,a=Z.ed[e],b=Z.ed[e+1];if(a&&!OBJ[a.k].open){x.fillStyle=col(a);x.fillRect(X(tx),Y(ty)-1,k+.5,2.5)}if(b&&!OBJ[b.k].open){x.fillStyle=col(b);x.fillRect(X(tx)-1,Y(ty),2.5,k+.5)}}}
  for(const d of Z.drops){x.fillStyle='#fff';x.fillRect(X(d.x)-2,Y(d.y)-2,4,4)}
  for(const a of Z.actors){if(a.pl||a.dead)continue;if(a.team===1&&!a.alert&&Math.hypot(a.x-px,a.y-py)>range*.6)continue;if(a.vis<.5)continue;x.fillStyle=a.team===0?'#60c0ff':a.def.ai==='flee'?'#c8c8a0':a.def.boss?'#ff9030':'#e04030';x.beginPath();x.arc(X(a.x),Y(a.y),a.def.boss?6:3.5,0,7);x.fill()}
  x.translate(R,R);x.rotate(p.a+Math.PI/2);x.fillStyle='#fff';x.beginPath();x.moveTo(0,-8);x.lineTo(6,7);x.lineTo(0,4);x.lineTo(-6,7);x.closePath();x.fill();x.restore();
}

// The travel map: regions, places, temporary sites, and the card that sends you somewhere.
import {G,count} from '../sim/core.js';
import * as World from '../sim/world.js';
import {LOCATIONS,LOC,REGIONS,SITES} from '../data/world.js';
import {VEHICLES} from '../data/recipes.js';
import {ENEMIES} from '../data/enemies.js';
import {TIDE_KINDS} from '../data/events.js';
import {FACTIONS} from '../data/community.js';
import {dayOf,fmtTime} from '../sim/util.js';
import {$,esc,gimg,bus,fmtMin} from './dom.js';
import {drawIcon} from './icons.js';

let c,x,sel=null,scale=1,ox=0,oy=0,drag=null,moved=0,pulse=0,raf=0;
const MW=1000,MH=640,DIRS=['north','east','south','west'];
export const MapScreen={init,open,draw,spots};
/** Every place drawn on the map with where it is on the screen (page pixels), for tools that have to click one: the play harness and tests. */
function spots(){const r=c.getBoundingClientRect(),S=G.S;return nodes().map(n=>({id:n.id,lead:!!(n.site&&SITES[n.site.site].lead),name:n.site?SITES[n.site.site].n:n.loc.n,x:r.left+ox+n.x*scale,y:r.top+oy+n.y*scale,here:n.id===S.pos,sel:n.id===sel}))}

function init(){
  c=$('mapc');x=c.getContext('2d');
  c.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,ox,oy};moved=0;c.setPointerCapture(e.pointerId)});
  c.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;moved=Math.max(moved,Math.abs(dx)+Math.abs(dy));ox=drag.ox+dx;oy=drag.oy+dy;clampPan();draw()});
  c.addEventListener('pointerup',e=>{if(drag&&moved<8){const r=c.getBoundingClientRect(),mx=(e.clientX-r.left-ox)/scale,my=(e.clientY-r.top-oy)/scale;const R=30/Math.max(.6,scale);
      // every place under the finger, nearest first; tapping the same spot again steps to the next one, so a place drawn under another can still be picked
      const hit=nodes().map(n=>({id:n.id,d:Math.hypot(n.x-mx,n.y-my)})).filter(h=>h.d<R).sort((a,b)=>a.d-b.d);let best=hit.length?hit[0].id:null;
      if(hit.length>1){const k=hit.findIndex(h=>h.id===sel);if(k>=0)best=hit[(k+1)%hit.length].id}
      if(best!==null){sel=best;G.ev.push(['sfx','ui_tap']);info();draw()}}drag=null});
  $('mapinfo').addEventListener('click',e=>{const el=e.target.closest('[data-a]');if(!el||el.disabled)return;if(el.dataset.a==='go')go(sel)});
  $('maptop').addEventListener('click',e=>{const el=e.target.closest('[data-h]');if(el)bus.UI.hot?bus.UI.open({inv:'inv',craft:'craft',journal:'journal',menu:'menu'}[el.dataset.h]):0});
}
const nodes=()=>{const S=G.S;return[...LOCATIONS.filter(l=>!l.flag||S.flags[l.flag]).map(l=>({id:l.id,x:l.x,y:l.y,loc:l})),...S.sites.map(s=>({id:s.id,x:s.x,y:s.y,site:s}))]};
function clampPan(){const w=c.clientWidth,h=c.clientHeight,mw=MW*scale,mh=MH*scale;ox=mw<=w?(w-mw)/2:Math.min(0,Math.max(w-mw,ox));oy=mh<=h?(h-mh)/2:Math.min(0,Math.max(h-mh,oy))}
function open(){
  const S=G.S;$('map').hidden=false;$('hud').hidden=true;$('build').hidden=true;sel=S.pos;
  const w=c.clientWidth||innerWidth,h=c.clientHeight||innerHeight;scale=Math.max(Math.min(w/MW,h/MH),Math.min(.72,h/MH));
  const[px,py]=World.posXY(S,S.pos);ox=w/2-px*scale;oy=h/2-py*scale;clampPan();top();info();draw();
  cancelAnimationFrame(raf);const tick=()=>{if($('map').hidden)return;pulse+=.05;draw();raf=requestAnimationFrame(tick)};raf=requestAnimationFrame(tick);
}
function top(){
  const S=G.S,T=S.tide,left=T.at-S.t,k=TIDE_KINDS.find(k=>k.id===T.kind);
  const b=(h,gl,tip)=>`<button class="ib" data-h="${h}" title="${tip}">${gimg(gl)}</button>`;
  $('maptop').innerHTML=`<div style="display:grid;gap:4px"><div class="t h" style="background:rgba(14,16,11,.8);border:1px solid var(--line);padding:2px 12px;font-size:15px">Day ${dayOf(S.t)} · ${fmtTime(S.t)}</div><div id="maptide" class="${left<12*60?'soon':''}">TIDE ${T.n+1} IN ${fmtMin(left).toUpperCase()}${T.warned?' · '+k.n.toUpperCase()+' · '+DIRS[T.dir].toUpperCase():''}</div></div><div id="btns">${b('inv','backpack_open','Pack')}${b('craft','wrench','Craft by hand')}${b('journal','book','Journal')}${b('menu','gear','Menu')}</div>`;
}
function info(){
  const S=G.S,el=$('mapinfo');if(sel==null){el.innerHTML='';return}
  const site=S.sites.find(s=>s.id===sel),l=site?null:LOC[sel];if(!site&&!l){el.innerHTML='';return}
  const here=sel===S.pos,why=World.canVisit(S,sel),ti=World.travelInfo(S,sel),reg=REGIONS[site?site.reg:l.reg],lvl=site?site.lvl:World.locLevel(S,l),def=site?SITES[site.site]:l;
  const LI=site?World.leadInfo(S,site):null;
  const gap=lvl-S.p.lvl,danger=LI?`<span class="${LI.skulls>=4?'danger':LI.skulls===3?'amb':'okc'}">${LI.word}</span>`:sel==='home'?'':gap>8?'<span class="danger">Far beyond you</span>':gap>3?'<span class="danger">Dangerous</span>':gap>-3?'<span class="amb">A fair fight</span>':'<span class="okc">Easy for your level</span>';
  const tg=[];if(LI)tg.push('RADIO LEAD','Threat '+LI.skulls+' of 5: '+LI.word,'Held by '+LI.who,'Strongroom: '+LI.prize);if(sel!=='home')tg.push('Level '+lvl);if(def.boss&&!def.bossChance)tg.push('Boss: '+ENEMIES[def.boss].n);if(reg.cold||def.cold)tg.push('Freezing: wear fur');if(def.tox||reg.tox)tg.push('Toxic air: mask or suit');if(reg.heat)tg.push('Heat: bring water');if(def.dark)tg.push('Dark: bring a lantern');
  if(site)tg.push('Gone in '+fmtMin(site.until-S.t));if(site&&site.bag&&site.bag.some(Boolean))tg.push('Your pack is here');const mem=l&&S.loc[l.id];if(mem&&mem.bag&&mem.bag.some(Boolean))tg.push('Your pack is here');if(mem&&mem.n)tg.push('Visited '+mem.n+'×');if(l&&l.endless)tg.push('Depth '+S.depth);
  // going out and coming straight back takes two trips: say so when the tide would be at home first
  const toTide=S.tide.at-S.t,tideWarn=here||why||toTide<=0?'':sel==='home'?(toTide<ti.min+10?` · <span class="danger">the tide comes in ${fmtMin(toTide)}: it will reach home before you do</span>`:''):S.pos==='home'&&toTide<ti.min*2+30?` · <span class="danger">the tide comes in ${fmtMin(toTide)}: you would not be back in time</span>`:'';
  el.innerHTML=`<div class="card"><small class="h" style="color:var(--amber2)">${esc(reg.n)}${S.world?' · in the world of '+esc(S.world.name):''}</small><h3>${esc(def.n)} ${danger?'· '+danger:''}</h3><p>${esc(def.d)}</p><div class="tags">${tg.map(t=>`<span>${esc(t)}</span>`).join('')}</div>
    <div class="row" style="justify-content:space-between"><small style="color:var(--dim)">${here?'You are here.':fmtMin(ti.min)+(S.veh?' by ':' ')+VEHICLES[S.veh].n.toLowerCase()+(ti.fuel?' · '+ti.fuel+' fuel':'')+(ti.noFuel?' · <span class="danger">no fuel, going slow</span>':'')}${S.p.hp<(G.ds?G.ds.maxHp:100)-2&&!why?' · you mend on the way, for food and water':''}${why?` · <span class="danger">${esc(why)}</span>`:''}${tideWarn}</small>
    <button class="btn go" data-a="go" ${why?'disabled':''}>${here?(sel==='home'?'Walk in':'Go back in'):'Travel'}</button></div></div>`;
}
function go(id){$('fade').classList.add('on');setTimeout(()=>{World.travel(id);if(G.mode==='map'&&!bus.UI.panel){top();info();draw()}setTimeout(()=>$('fade').classList.remove('on'),200)},320)}

function draw(){
  if($('map').hidden||!G.S)return;const S=G.S,dpr=Math.min(2,devicePixelRatio||1),w=c.clientWidth,h=c.clientHeight;if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);clampPan()}
  x.setTransform(dpr,0,0,dpr,0,0);x.fillStyle='#171a13';x.fillRect(0,0,w,h);x.translate(ox,oy);x.scale(scale,scale);
  // paper
  x.fillStyle='#1d2118';x.fillRect(0,0,MW,MH);x.strokeStyle='rgba(233,227,209,.05)';x.lineWidth=1;for(let g=0;g<=MW;g+=50){x.beginPath();x.moveTo(g,0);x.lineTo(g,MH);x.stroke()}for(let g=0;g<=MH;g+=50){x.beginPath();x.moveTo(0,g);x.lineTo(MW,g);x.stroke()}
  // regions as soft territory
  for(let r=1;r<REGIONS.length;r++){const R=REGIONS[r],locked=R.veh>S.veh;x.globalAlpha=locked?.16:.34;for(const l of LOCATIONS)if(l.reg===r){const g=x.createRadialGradient(l.x,l.y,10,l.x,l.y,95);g.addColorStop(0,R.c);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(l.x-95,l.y-95,190,190)}
    x.globalAlpha=1;const ls=LOCATIONS.filter(l=>l.reg===r),cx=ls.reduce((a,l)=>a+l.x,0)/ls.length,top=Math.min(...ls.map(l=>l.y));
    x.font='700 20px "Barlow Condensed",sans-serif';x.textAlign='center';x.fillStyle=locked?'rgba(233,227,209,.3)':'rgba(233,227,209,.62)';x.fillText(R.n.toUpperCase(),Math.min(MW-90,Math.max(90,cx)),Math.max(20,top-34));
    if(locked){x.font='600 12px "Barlow Condensed",sans-serif';x.fillStyle='rgba(255,154,138,.75)';x.fillText('NEEDS A '+VEHICLES[R.veh].n.toUpperCase(),Math.min(MW-90,Math.max(90,cx)),Math.max(34,top-20))}}
  // route to the selection
  const[px,py]=World.posXY(S,S.pos);
  if(sel!=null&&sel!==S.pos){const[sx,sy]=World.posXY(S,sel);x.setLineDash([6,6]);x.lineDashOffset=-pulse*8;x.strokeStyle='#e3a432';x.lineWidth=2;x.beginPath();x.moveTo(px,py);x.lineTo(sx,sy);x.stroke();x.setLineDash([])}
  // the other communities: a banner each, coloured by how they stand with you, and a line for every trade route you run
  {const C=World.Community,[hx,hy]=World.posXY(S,'home');for(const id of C.known(S)){const F=FACTIONS[id],fs=C.fac(S,id),rel=C.relOf(fs.st);
    if(fs.route){x.setLineDash([2,5]);x.strokeStyle=F.c;x.globalAlpha=.8;x.lineWidth=2;x.beginPath();x.moveTo(hx,hy);x.lineTo(F.x,F.y);x.stroke();x.setLineDash([]);x.globalAlpha=1}
    x.globalAlpha=fs.dead?.35:1;x.strokeStyle='#e9e3d1';x.lineWidth=1.5;x.beginPath();x.moveTo(F.x-7,F.y+9);x.lineTo(F.x-7,F.y-11);x.stroke();
    x.fillStyle=F.c;x.beginPath();x.moveTo(F.x-7,F.y-11);x.lineTo(F.x+9,F.y-7);x.lineTo(F.x-7,F.y-2);x.closePath();x.fill();
    x.font='700 11px "Barlow Condensed",sans-serif';x.textAlign='center';x.fillStyle='#e9e3d1';x.fillText(F.n.toUpperCase(),F.x,F.y+22);
    x.font='600 10px "Barlow Condensed",sans-serif';x.fillStyle=fs.dead?'#8a8a80':fs.st<-15?'#ff9a8a':fs.st>=25?'#a8d878':'#b8b4a4';x.fillText(fs.dead?'BROKEN':rel[1].toUpperCase(),F.x,F.y+33);x.globalAlpha=1}}
  // places
  for(const n of nodes()){const l=n.loc,site=n.site,why=World.canVisit(S,n.id),isSel=n.id===sel,r=l&&l.id==='home'?17:14;
    x.save();x.translate(n.x,n.y);
    if(site){const s=1+Math.sin(pulse*2)*.08;x.rotate(Math.PI/4);x.fillStyle='#2a1c10';x.strokeStyle='#f6c860';x.lineWidth=2;x.fillRect(-11*s,-11*s,22*s,22*s);x.strokeRect(-11*s,-11*s,22*s,22*s);x.rotate(-Math.PI/4)}
    else{x.beginPath();x.arc(0,0,r,0,7);x.fillStyle=why?'#22251e':l.id==='home'?'#3a3320':'#2b2f24';x.fill();x.lineWidth=isSel?3:1.5;x.strokeStyle=isSel?'#f6c860':why?'#4a4f42':l.boss?'#d24a3a':'#8a8f7a';x.stroke()}
    const glyph=site?SITES[site.site].ic:l.id==='home'?'house':l.boss?'skull':l.lay==='complex'?'wall':l.lay==='town'?'chest':l.biome==='forest'?'tree':'rock';
    x.globalAlpha=why?.4:1;x.translate(-10,-10);try{drawIcon(x,glyph,site?'#f6c860':null,null,20)}catch(e){}x.restore();
    x.font='600 12px "Barlow Condensed",sans-serif';x.textAlign='center';x.fillStyle=why?'rgba(233,227,209,.4)':'#e9e3d1';x.shadowColor='#000';x.shadowBlur=3;x.fillText((site?SITES[site.site].n:l.n).toUpperCase(),n.x,n.y+r+13);x.shadowBlur=0}
  // you
  x.save();x.translate(px,py-22-Math.abs(Math.sin(pulse*1.5))*4);x.fillStyle='#fff';x.strokeStyle='#12140f';x.lineWidth=2;x.beginPath();x.moveTo(0,10);x.lineTo(-7,-2);x.arc(0,-4,7,Math.PI,0);x.lineTo(0,10);x.closePath();x.fill();x.stroke();x.restore();
}

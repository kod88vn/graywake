// Runs inside the bot's game page (served only by tools/bot/session.mjs, never published). It reads what a player could see into plain data,
// numbers the things that can be clicked, and helps the session steer by key presses. It never changes game state: every action the bot takes
// goes through real key and mouse events sent by the session.
import {G,weaponDef,betterGear,gearScore,canCraft,recipeVisible} from '../js/sim/core.js';
import {RECIPE_LIST} from '../js/data/recipes.js';
import {JOBS} from '../js/data/progress.js';
import {OBJ} from '../js/data/objects.js';
import {ITEMS} from '../js/data/items.js';
import {interactInfo,retreatSpot} from '../js/sim/actors.js';
import {field,pathAim,walkClear,los,edgeCross,atExit} from '../js/sim/zone.js';
import {MapScreen} from '../js/ui/map.js';

const $=id=>document.getElementById(id),vis=el=>!!el&&!el.hidden&&el.offsetParent!==null,txt=el=>el?el.innerText.replace(/\s+\n/g,'\n').replace(/[ \t]+/g,' ').trim():'';
const DIRS=['E','SE','S','SW','W','NW','N','NE'],compass=(dx,dy)=>DIRS[((Math.round(Math.atan2(dy,dx)/(Math.PI/4))%8)+8)%8];
const r1=v=>Math.round(v*10)/10;
const B=window.__bot={OBJ,msgs:[],els:[],gateUntil:0,shield:false,nav:null};

// ---- everything the game says in passing (toasts, the pickup feed, banners) is kept, because it fades before a slow reader sees it
const watch=(id,kind)=>{const el=$(id);if(!el)return;new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes){const t=(n.innerText||n.textContent||'').trim();if(t)B.msgs.push({kind,t,cls:n.className||''})}}).observe(el,{childList:true})};
watch('toasts','toast');watch('feed','got');
{const b=$('banner');if(b)new MutationObserver(()=>{const t=txt(b);if(t&&b.classList.contains('on')&&B._ban!==t){B._ban=t;B.msgs.push({kind:'banner',t})}}).observe(b,{attributes:true,childList:true,subtree:true,characterData:true})}

// ---- in a visible window, the person watching must not be able to play by accident: real input is swallowed unless the session has just opened the gate
const SHIELD=['pointerdown','pointerup','pointermove','pointercancel','mousedown','mouseup','mousemove','click','dblclick','contextmenu','wheel','keydown','keyup','keypress','touchstart','touchmove','touchend'];
for(const t of SHIELD)window.addEventListener(t,e=>{if(B.shield&&performance.now()>B.gateUntil){e.stopImmediatePropagation();e.preventDefault()}},{capture:true,passive:false});
B.gate=ms=>{B.gateUntil=performance.now()+ms;return true};

// ---- what can be clicked right now, numbered
function label(el){
  let t=(el.innerText||'').replace(/\s+/g,' ').trim();const ti=el.getAttribute('title')||el.getAttribute('aria-label')||'';
  if(el.classList.contains('sl')){const n=el.querySelector('u');t=(ti||'empty slot')+(n&&n.textContent?' ×'+n.textContent:'')+(el.querySelector('em')?' ['+el.querySelector('em').textContent+']':'');
    // a container sheet has two grids of the same things: say which side a slot is on and what a tap does
    const a=el.dataset.a;if(ti&&a==='take')t+=' — in the container, tap to take';else if(ti&&a==='put')t+=' — in your pack, tap to put in'}
  else if(!t)t=ti;else if(ti&&ti!==t&&t.length<24)t+=' ('+ti+')';
  if(/^×\d+$/.test(t))t='MAKE '+t+' (that many batches at once)';
  if(el.tagName==='SELECT')t=(ti||'choice')+': '+(el.selectedOptions[0]?el.selectedOptions[0].textContent:'');
  // costs are drawn as icons with a number; spell them out ("needs 2 Log (have 5)")
  // (the icon's hover text also says where the thing comes from; that is left out here, it is in the sheet's own text and would crowd the label)
  const costs=root=>[...root.querySelectorAll('.ing span[title]')].map(c=>{const[nm,rest]=c.getAttribute('title').split(': '),have=(rest||'').split(' · ')[0].replace(/\s*\(.*$/,'');return c.textContent.trim()+' '+nm+(have?' ('+have+')':'')}).join(', ');
  if(el.classList.contains('bp')){const nm=el.querySelector('b'),c=costs(el),lock=el.querySelector('.ing .no');t=(nm?nm.textContent:t)+(c?' — needs '+c:lock?' — '+lock.textContent:'');return t.slice(0,140)}
  // a button in a row of a list ("MAKE", "×5", "Recruit") says nothing without the row's name
  const row=!el.classList.contains('sl')&&el.closest('.rec,.perk,.goal,.card');if(row&&row!==el){const h=row.querySelector('b,h3');const ht=h&&h.textContent.replace(/\s+/g,' ').trim();if(ht&&!t.includes(ht)&&(t.length<40||el.dataset.a==='job')){t+=' — '+ht.slice(0,40);const c=!/^×\d+/.test((el.innerText||'').trim())&&row.querySelector('.ing span[title]')?costs(row):'';if(c)t+=' (needs '+c+')'}}
  return t.slice(0,150)}
function layer(){
  if(vis($('title')))return['title',[$('title')]];
  if(vis($('shade')))return['sheet',[$('panel')]];
  if(vis($('map')))return['map',[$('maptop'),$('mapinfo')]];
  const roots=[$('btns'),$('weap'),$('stat'),$('quest'),$('travel')];if(vis($('build')))roots.push($('build'));
  return[vis($('build'))?'build':'hud',roots]}
function elements(full){
  const[name,roots]=layer(),out=[],seen=new Set();B.els=[];
  for(const root of roots){if(!root)continue;const list=root.matches('button,[data-q]')?[root]:root.querySelectorAll('button,select,textarea,[data-a],[data-b],[data-t],[data-h],[data-w],[data-q],[data-i]');
    for(const el of list){if(seen.has(el)||!vis(el))continue;seen.add(el);const r=el.getBoundingClientRect();if(r.width<4||r.height<4)continue;
      const lab=label(el);if(!lab&&!el.classList.contains('sl'))continue;
      const flags=[];if(el.disabled)flags.push('disabled');if(el.classList.contains('on')||el.classList.contains('sel'))flags.push('selected');if(el.classList.contains('off')||el.classList.contains('lock'))flags.push('locked');
      if(r.bottom<0||r.top>innerHeight)flags.push('scrolled out of view');
      B.els.push(el);out.push({n:B.els.length,label:lab||'empty slot',flags});
      // a drop-down: its choices as lines of their own (a native list cannot be clicked into in this browser; choosing one moves through it with the arrow keys)
      if(el.tagName==='SELECT'){const who=(el.getAttribute('title')||label(el)).split(':')[0];const row=el.closest('.rec');const rn=row&&row.querySelector('b')?row.querySelector('b').textContent.trim():'';
        [...el.options].forEach((o,i)=>{if(i===el.selectedIndex||o.disabled)return;B.els.push({opt:true,sel:el,i});out.push({n:B.els.length,label:'choose '+o.textContent.trim()+(rn?' — for '+rn:' — '+who),flags:[]})})}
      if(!full&&out.length>=90)break}}
  if(name==='map')for(const s of MapScreen.spots()){B.els.push({spot:s});out.push({n:B.els.length,label:'place on the map: '+s.name+(s.lead?' (RADIO LEAD)':''),flags:[s.here?'you are here':'',s.sel?'selected':''].filter(Boolean)})}
  return[name,out]}
/** The number of the one clickable thing whose label contains this text (case does not matter), 0 if none, -1 if several do. */
B.byText=q=>{q=String(q).toLowerCase().trim();const hit=[];q=q.replace(/^place on the map:\s*/,'').replace(/\s*\(radio lead\)\s*$/,'');B.els.forEach((el,i)=>{const l=(el.spot?el.spot.name:el.opt?'choose '+el.sel.options[el.i].textContent.trim()+' — for '+((el.sel.closest('.rec')||{}).querySelector?((el.sel.closest('.rec').querySelector('b')||{}).textContent||''):''):label(el)).toLowerCase();if(l.includes(q))hit.push([i+1,l])});const exact=hit.filter(h=>h[1]===q||h[1].startsWith(q+' '));return hit.length===1?hit[0][0]:exact.length===1?exact[0][0]:hit.length?-1:0};
/** Where to click for numbered element n (scrolling it into view first), or null. */
B.target=n=>{const el=B.els[n-1];if(!el)return null;
  if(el.opt){if(!document.contains(el.sel))return null;el.sel.scrollIntoView({block:'center'});const r=el.sel.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,label:'choose '+el.sel.options[el.i].textContent.trim(),opt:true,steps:el.i-el.sel.selectedIndex}}if(el.spot){const s=MapScreen.spots().find(q=>q.id===el.spot.id)||el.spot,top=document.elementFromPoint(s.x,s.y);return{x:s.x,y:s.y,label:s.name,spot:true,covered:!top||top.id!=='mapc'}}
  if(!document.contains(el))return null;el.scrollIntoView({block:'center',inline:'center'});const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,label:label(el),disabled:!!el.disabled}};

// ---- the world around the player
function around(full){
  const Z=G.Z,p=Z.pl,W=Z.w,R=full?14:10,things=new Map(),foes=[],others=[];
  const x0=Math.max(0,Math.floor(p.x-R)),x1=Math.min(W-1,Math.floor(p.x+R)),y0=Math.max(0,Math.floor(p.y-R)),y1=Math.min(Z.h-1,Math.floor(p.y+R));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x,o=Z.obj[i];if(!o)continue;const d=OBJ[o.k];if(!d)continue;const info=interactInfo(Z,i);
    if(!info&&!d.cost&&!d.loot)continue;                       // plain scenery is left to the picture
    const dist=Math.hypot(x+.5-p.x,y+.5-p.y),key=d.n+'|'+(info?info.label:'')+(d.loot&&o.empty?'|searched':''),t=things.get(key);
    if(!t)things.set(key,{name:d.n,act:info?info.label:d.loot&&o.empty?'already searched':null,yours:!!d.cost,n:1,x,y,dist});else{t.n++;if(dist<t.dist){t.x=x;t.y=y;t.dist=dist}}}
  // at a radio lead the game's minimap shows the guardian always and the last four of the garrison wherever they are; the bot is told the same
  const lead=!!(Z.def&&Z.def.lead),few=lead&&Z.actors.reduce((n,a)=>n+(a.team===1&&!a.dead&&a.def.ai!=='flee'?1:0),0)<=4;
  for(const a of Z.actors){if(a.pl||a.dead)continue;const dist=Math.hypot(a.x-p.x,a.y-p.y);if((dist>R+4&&!(a.team===1&&lead&&(few||a.def.boss)))||a.vis<.5)continue;
    const e={name:a.def.n||a.kind,x:r1(a.x),y:r1(a.y),dist:r1(dist),dir:compass(a.x-p.x,a.y-p.y),hp:Math.round(a.hp/a.mhp*100)};
    if(a.team===1&&a.def.ai!=='flee'){e.state=a.alert?(a.st==='wind'?'about to strike':a.st==='charge'?'charging':'coming for you'):'has not seen you';if(a.def.boss)e.boss=true;foes.push(e)}
    // one of your own people walking about the homestead is named, with their job, so they are not taken for a newcomer to free
    else{const sv=a.sv&&G.S.surv.find(s=>s.id===a.sv);if(sv){e.name=sv.n;e.kind='lives here: '+((JOBS[sv.job]||JOBS.idle).n).toLowerCase()}else if(a.escort)e.kind='your group';else e.kind=a.team===0?'on your side':'animal';others.push(e)}}
  foes.sort((a,b)=>a.dist-b.dist);others.sort((a,b)=>a.dist-b.dist);
  // something within arm's reach on the far side of a wall cannot be used from here: say so, since the game (rightly) just does nothing
  const list=[...things.values()].sort((a,b)=>a.dist-b.dist).slice(0,full?40:18).map(t=>({name:t.name,act:t.act&&t.dist<2.2&&Z.ed.length&&edgeCross(Z,p.x,p.y,t.x+.5,t.y+.5,true)>=0?t.act+' (but a wall is between you and it: go round)':t.act,yours:t.yours,n:t.n,x:t.x,y:t.y,dist:r1(t.dist),dir:compass(t.x+.5-p.x,t.y+.5-p.y)}));
  const drops=Z.drops.map(d=>({x:r1(d.x),y:r1(d.y),dist:r1(Math.hypot(d.x-p.x,d.y-p.y)),dir:compass(d.x-p.x,d.y-p.y),what:(d.items||[]).map(it=>(ITEMS[it.id]?ITEMS[it.id].n:it.id)+(it.n>1?' ×'+it.n:'')).join(', ')})).sort((a,b)=>a.dist-b.dist).slice(0,6);
  let walls=0;const doorways=[],SIDE=['N','W'];
  if(Z.ed)for(let e=0;e<Z.ed.length;e++){const w=Z.ed[e];if(!w||!OBJ[w.k])continue;if(OBJ[w.k].cost)walls++;
    if(OBJ[w.k].open||OBJ[w.k].door){const t=e>>1,x=t%W,y=(t-x)/W,mx=e&1?x:x+.5,my=e&1?y+.5:y,dist=Math.hypot(mx-p.x,my-p.y);if(dist<R+2)doorways.push({x,y,side:SIDE[e&1],dist:r1(dist),dir:compass(mx-p.x,my-p.y),yours:!!OBJ[w.k].door})}}
  doorways.sort((a,b)=>a.dist-b.dist);
  // in build mode at home, where every wall piece of yours stands, so strays can be found and lines checked
  let yours=null;if(Z.home&&G.build){const rows={},cols={};for(let e=0;e<Z.ed.length;e++){const w=Z.ed[e];if(!w||!OBJ[w.k]||!OBJ[w.k].cost)continue;const t=e>>1,x=t%W,y=(t-x)/W;if(e&1)(cols[x]=cols[x]||[]).push(y);else(rows[y]=rows[y]||[]).push(x)}
    const runs=a=>{a.sort((p,q)=>p-q);const out=[];let s=a[0],l=a[0];for(let i=1;i<=a.length;i++){if(a[i]===l+1){l=a[i];continue}out.push(s===l?''+s:s+'-'+l);s=l=a[i]}return out.join(',')};
    yours=[...Object.keys(rows).map(y=>`north side of row y=${y}: x ${runs(rows[y])}`),...Object.keys(cols).map(x=>`west side of column x=${x}: y ${runs(cols[x])}`)].slice(0,24)}
  return{things:list,foes:foes.slice(0,12),others:others.slice(0,8),drops,walls,doorways:doorways.slice(0,6),yours}}

B.observe=(full=false)=>{
  const S=G.S,Z=G.Z,o={mode:G.mode,version:window.GW&&GW.VERSION,hold:!!G.hold,paused:!!G.paused,screen:[innerWidth,innerHeight]};
  o.msgs=B.msgs.splice(0);
  const[lay,els]=elements(full);o.layer=lay;o.els=els;
  if(lay==='title')o.text=txt($('title')).slice(0,900);
  if(lay==='sheet'){o.sheet={title:txt($('panel').querySelector('.ttl')),name:GW.UI.panel,text:txt($('pb')).slice(0,full?6000:1600)}}
  if(lay==='map')o.text=(txt($('maptop'))+'\n'+txt($('mapinfo'))).slice(0,900);
  if(lay==='build'){o.buildInfo=txt($('binfo'));
    // the ground that can be clicked right now: what the camera shows, less the interface along the top and the build bar along the bottom
    const top=$('build').getBoundingClientRect().top,a=GW.View.pick(innerWidth*.08,130),b=GW.View.pick(innerWidth*.92,130),c=GW.View.pick(innerWidth*.08,top-24),d=GW.View.pick(innerWidth*.92,top-24);
    if(a&&b&&c&&d)o.buildView={x0:Math.ceil(Math.max(a.x,c.x)),x1:Math.floor(Math.min(b.x,d.x))-1,y0:Math.ceil(a.y),y1:Math.floor(c.y)-1}}
  if(S&&G.mode!=='menu'){
    const p=S.p,ds=G.ds||{},e=p.eq[p.active],it=e&&ITEMS[e.id],sp=p.eq[p.active==='w1'?'w2':'w1'];
    o.you={hp:Math.round(p.hp),maxHp:Math.round(ds.maxHp||100),food:Math.round(p.food),water:Math.round(p.water),tox:Math.round(p.tox),level:p.lvl,perkPoints:p.sp||0,
      weapon:it?it.n+(it.dur?' ('+Math.round((e.d||0)/it.dur*100)+'% condition)':'')+(it.ammo?', '+(p.inv.filter(s=>s&&s.id===it.ammo).reduce((a,s)=>a+s.n,0))+' '+ITEMS[it.ammo].n:''):'bare fists',
      spare:sp&&ITEMS[sp.id]?ITEMS[sp.id].n:null,auto:!!G.auto,build:!!G.build};
    o.you.pack=(p.inv||[]).filter(Boolean).length;
    // people: who lives here and what they do, who waits at the fence, and room
    {const beds=GW.World.survCap?GW.World.survCap(S):0;o.people={surv:S.surv.map(s=>s.n+' ('+((JOBS[s.job]||JOBS.idle).n)+(Object.values(S.fac||{}).some(f=>f&&f.route&&f.route.sv===s.id)?', on the trade run':s.job==='idle'?', no job':', job set')+')'),idle:S.surv.filter(s=>s.job==='idle'&&!Object.values(S.fac||{}).some(f=>f&&f.route&&f.route.sv===s.id)).length,wait:S.wait.map(c=>c.n),beds,room:GW.World.survRoom?GW.World.survRoom(S):beds+1}}
    // the shared world, if this game is in one: where this enclave stands and who else holds ground
    if(S.world){const w=S.world,y=w.you||{};o.world={name:w.name,stage:w.stageName,tide:w.fx&&w.fx.tide||1,hold:y.hold,rank:y.rank,of:y.of,score:y.score,rivals:w.enclaves.filter(e=>e.name!==y.name).map(e=>e.name+' ('+(e.kind==='npc'?'settlement':e.kind)+', hold '+e.hold+', score '+e.score+')'),leads:S.sites.filter(s=>s.wid).length,news:w.feed.slice(-3).map(f=>f.text)}}
    // what is worn, what in the pack would be better, and what could be made by hand this minute for a slot that is bare or poorly covered
    {const W=['head','body','legs','feet','hands'];o.you.wearing=W.map(k=>k+': '+(p.eq[k]&&ITEMS[p.eq[k].id]?ITEMS[p.eq[k].id].n:'NOTHING')).join(', ');o.you.armour=ds.arm||0;
      o.you.better=betterGear(S).map(b=>ITEMS[b.id].n+' ('+(b.slot==='w1'?'weapon in hand':b.slot==='w2'?'spare weapon':b.slot)+(b.was?', better than your '+ITEMS[b.was].n:', you have nothing there')+')');
      o.you.canMake=RECIPE_LIST.filter(r=>r.o&&ITEMS[r.o]&&W.includes(ITEMS[r.o].t)&&r.s==='hand'&&recipeVisible(S,r)&&!canCraft(S,r,1,null)&&gearScore(S,{id:r.o})>(p.eq[ITEMS[r.o].t]?gearScore(S,{id:p.eq[ITEMS[r.o].t].id})*1.01:0)&&!p.inv.some(s=>s&&s.id===r.o)).map(r=>ITEMS[r.o].n).slice(0,5)}
    o.clock=[...$('clock').querySelector('.t').childNodes].map(n=>n.textContent.trim()).filter(Boolean).join(' · ')||null;o.tide=txt($('tide'))||null;o.quest=vis($('quest'))?txt($('quest')):null;o.buffs=txt($('buffs'))||null;
    if(vis($('boss')))o.boss=txt($('boss'));
  }
  if(Z&&G.mode==='play'){const p=Z.pl;
    o.zone={name:Z.name||Z.id,id:Z.id,home:!!Z.home,size:[Z.w,Z.h],atEdge:!!Z.exit,dark:!!Z.dark};
    o.you.at=[r1(p.x),r1(p.y)];o.you.dead=!!p.dead;o.you.doing=p.act?p.act.type:p.atk?'swinging':p.roll?'rolling':p.mv>.3?'moving':'standing';o.you.sneaking=!!p.sneak;
    o.prompt=vis($('prompt'))?[...$('prompt').childNodes].filter(n=>n.nodeName!=='KBD').map(n=>n.textContent).join('').trim():null;o.leave=vis($('travel'))?txt($('travel')):null;
    Object.assign(o,around(full))}
  return o};

/** A cheap pulse while an action runs. */
B.pulse=()=>{const S=G.S,Z=G.Z,p=Z&&Z.pl;let foe=99,alertN=0;if(Z&&p)for(const a of Z.actors){if(a.pl||a.dead||a.team!==1||a.def.ai==='flee'||!a.alert)continue;alertN++;const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<foe)foe=d}
  return{mode:G.mode,sheet:window.GW?GW.UI.panel:null,hp:S?S.p.hp:0,max:G.ds&&G.ds.maxHp||100,x:p?p.x:0,y:p?p.y:0,dead:!!(p&&p.dead),act:p&&p.act?p.act.type:null,atk:!!(p&&p.atk),foe:r1(foe),alertN,auto:!!G.auto,exit:!!(Z&&Z.exit),home:!!(Z&&Z.home),meds:S?S.p.inv.reduce((n,s)=>n+(s&&ITEMS[s.id].t==='med'&&ITEMS[s.id].hp>0?s.n:0),0):0,t:Z?Z.time:0,zone:Z?Z.id:null,tide:!!(S&&S.tide&&S.tide.live),tideSoon:!!(S&&S.tide&&!S.tide.live&&S.tide.at-S.t<=60&&S.tide.at>S.t),fps:window.GW?GW.View.fps:0,msgs:B.msgs.length}};

// ---- walking by keys: which of the eight ways to press to get to a tile (or next to it, when something solid stands on it)
/** What stops a step in a direction from where the player stands: a wall on a tile edge, a solid thing, water, the edge of the place. For the walk command's message. */
B.whyBlocked=(dx,dy)=>{const Z=G.Z;if(!Z||!Z.pl)return'';const p=Z.pl,l=Math.hypot(dx,dy)||1,x1=p.x+dx/l*.75,y1=p.y+dy/l*.75,tx=Math.floor(x1),ty=Math.floor(y1);
  if(x1<0.3||y1<0.3||x1>Z.w-.3||y1>Z.h-.3)return'the edge of this place';
  const e=edgeCross(Z,p.x,p.y,x1,y1,true);if(e>=0&&Z.ed[e]){const d=OBJ[Z.ed[e].k];return'a '+(d?d.n.toLowerCase():'wall')+' on the edge between tiles ('+Math.floor(p.x)+', '+Math.floor(p.y)+') and ('+tx+', '+ty+'). Walls are thin and stand on tile edges: the way through is a doorway or a door'}
  const o=Z.obj[ty*Z.w+tx];if(o&&OBJ[o.k]&&OBJ[o.k].solid)return'the '+OBJ[o.k].n+' at ('+tx+', '+ty+')';
  return''};
/** Where to run to: the way out of this place that is nearest by foot and farthest from whatever is hostile. Null at home (there is nowhere further to run). */
B.fleeTo=()=>{const Z=G.Z;if(!Z||!Z.pl)return null;
  // at home there is no edge to run off (and no leaving during a tide): run to the spot farthest from them instead
  if(Z.home){const s=retreatSpot(Z,Z.pl);return s?{x:Math.floor(s.x),y:Math.floor(s.y),home:true,near:s.near}:null}const p=Z.pl,f=field(Z,Math.floor(p.x),Math.floor(p.y),true,400),foes=Z.actors.filter(a=>a.team===1&&!a.dead&&a.def.ai!=='flee');let best=null,bs=1e9;
  for(let y=0;y<Z.h;y++)for(let x=0;x<Z.w;x++){if(!atExit(Z,x,y))continue;const d=f[y*Z.w+x];if(!(d<400))continue;let near=12;for(const a of foes)near=Math.min(near,Math.hypot(a.x-x-.5,a.y-y-.5));const s=d-near*1.2;if(s<bs){bs=s;best={x,y,d:r1(d)}}}
  return best};
B.navTo=(tx,ty)=>{const Z=G.Z;if(!Z||tx<0||ty<0||tx>=Z.w||ty>=Z.h)return false;B.nav={tx,ty,f:field(Z,Math.floor(tx),Math.floor(ty),true,400),t:Z.time,zone:Z.id};return true};
B.steer=()=>{const Z=G.Z,nv=B.nav;if(!Z||!nv||nv.zone!==Z.id)return{done:'lost'};const p=Z.pl,cx=Math.floor(nv.tx)+.5,cy=Math.floor(nv.ty)+.5,d=Math.hypot(cx-p.x,cy-p.y);
  const ti=Math.floor(nv.ty)*Z.w+Math.floor(nv.tx),o=Z.obj[ti],solid=o&&OBJ[o.k]&&OBJ[o.k].solid,usable=o&&!!interactInfo(Z,ti);
  // stop beside a solid thing, and a step short of anything else that can be used, facing it: standing on top of a plant, E picks whatever you face
  // ...and never count as arrived on the wrong side of a wall: next to a crate with a wall between is not next to it
  const walled=Z.ed.length>0&&edgeCross(Z,p.x,p.y,cx,cy,true)>=0;
  if(d<(solid?1.28:usable?.95:.3)&&!walled)return{done:'arrived',d:r1(d),face:solid||usable?[cx-p.x,cy-p.y]:null};
  if(Z.time-nv.t>1.5){nv.f=field(Z,Math.floor(nv.tx),Math.floor(nv.ty),true,400);nv.t=Z.time}
  // (the player's own tile may read as unreachable when standing beside a tree trunk; what matters is whether a neighbour leads on)
  let gx=cx,gy=cy;if(!walkClear(Z,p.x,p.y,cx,cy,p.r,true)||solid||walled){const a=pathAim(Z,nv.f,p.x,p.y,p.r,true);if(a){gx=a[0];gy=a[1]}else if(d>1.6)return{done:'no way there'}}
  return{dx:gx-p.x,dy:gy-p.y,d:r1(d)}};
/** Page pixels of a point in the world (h metres above the ground). */
B.screen=(x,y,h=0)=>{const s=GW.View.project(x,y,h),r=$('cv').getBoundingClientRect();return{x:s.x+r.left,y:s.y+r.top,on:s.x>=0&&s.y>=0&&s.x<=r.width&&s.y<=r.height}};
B.nearestFoe=(maxD=9)=>{const Z=G.Z,p=Z&&Z.pl;if(!p)return null;let b=null,bd=maxD;for(const a of Z.actors){if(a.pl||a.dead||a.team!==1||a.vis<.5)continue;const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<bd){bd=d;b=a}}return b?{x:b.x,y:b.y,d:bd,name:b.def.n,flee:b.def.ai==='flee'}:null};
/** Who to fight and whether it can be hit from here: the nearest hostile thing, preferring ones in plain view; `blocked` when a wall or
 *  something solid stands between, `reach` how close the weapon in hand needs to be. */
B.fight=(keep=0,hunt=false)=>{const Z=G.Z,p=Z&&Z.pl;if(!p)return null;const w=weaponDef(G.S),gun=w.t==='gun';let b=null,bs=1e9;
  for(const a of Z.actors){if(a.pl||a.dead||a.team!==1||a.vis<.5)continue;const d=Math.hypot(a.x-p.x,a.y-p.y),mine=a.id===keep&&a.def.ai!=='flee';
    // the one already being gone after is kept however far the way round takes you; otherwise the nearest within fourteen tiles, and animals that run only when beside you
    if(!mine&&(d>14||(a.def.ai==='flee'&&d>3.5)))continue;
    // one that has not noticed you is left alone unless it is close or you are hunting: charging a sleeping pack is how fights are lost
    if(!mine&&!hunt&&!a.alert&&d>4.5)continue;
    const blocked=!los(Z,p.x,p.y,a.x,a.y),sc=mine?-99:d+(blocked?4:0)+(a.def.ai==='flee'?3:0)+(a.alert?0:2);if(sc<bs){bs=sc;b={id:a.id,x:a.x,y:a.y,d,name:a.def.n,blocked,flee:a.def.ai==='flee',r:a.r}}}
  if(!b)return null;b.reach=gun?Math.min(w.rng*.8,8):w.rng+b.r+.1;b.gun=gun;return b};
B.unaware=()=>{const Z=G.Z,p=Z&&Z.pl;if(!p)return 0;let n=0;for(const a of Z.actors)if(!a.pl&&!a.dead&&a.team===1&&a.def.ai!=='flee'&&!a.alert&&Math.hypot(a.x-p.x,a.y-p.y)<16)n++;return n};
B.find=name=>{const Z=G.Z,p=Z&&Z.pl;if(!p)return null;const q=name.toLowerCase();let b=null,bd=1e9;
  for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(!o||!OBJ[o.k])continue;const d=OBJ[o.k];if(!(d.n||'').toLowerCase().includes(q)&&o.k!==q)continue;const x=i%Z.w,y=(i-x)/Z.w,dist=Math.hypot(x+.5-p.x,y+.5-p.y)+(d.loot&&o.empty?12:0);if(dist<bd){bd=dist;b={x,y,name:d.n+(d.loot&&o.empty?' (already searched)':'')}}}
  for(const dr of Z.drops)if('loot drop bag'.includes(q)){const dist=Math.hypot(dr.x-p.x,dr.y-p.y);if(dist<bd){bd=dist;b={x:dr.x,y:dr.y,name:'loose loot',free:true}}}
  for(const a of Z.actors){if(a.pl||a.dead)continue;if(!(a.def.n||'').toLowerCase().includes(q))continue;const dist=Math.hypot(a.x-p.x,a.y-p.y);if(dist<bd){bd=dist;b={x:a.x,y:a.y,name:a.def.n,free:true}}}
  return b};

// ---- things that should never be true; the session files a report when one is
B.check=()=>{const bad=[],S=G.S,Z=G.Z;if(!S||G.mode==='menu')return bad;const p=S.p,nan=v=>typeof v!=='number'||Number.isNaN(v)||!Number.isFinite(v);
  for(const k of['hp','food','water','tox','xp'])if(nan(p[k]))bad.push('player '+k+' is '+p[k]);
  if(nan(S.t))bad.push('game clock is '+S.t);if(G.ds&&p.hp>G.ds.maxHp+.5)bad.push('health '+p.hp+' above maximum '+G.ds.maxHp);
  (p.inv||[]).forEach((s,i)=>{if(s&&(!ITEMS[s.id]||nan(s.n)||s.n<=0))bad.push('pack slot '+i+' holds '+JSON.stringify(s))});
  if(Z&&Z.pl){const q=Z.pl;if(nan(q.x)||nan(q.y))bad.push('player position is '+q.x+','+q.y);else if(q.x<0||q.y<0||q.x>Z.w||q.y>Z.h)bad.push('player is outside the zone at '+r1(q.x)+','+r1(q.y));
    for(const a of Z.actors)if(!a.pl&&!a.dead&&(nan(a.x)||nan(a.y)||nan(a.hp))){bad.push(a.kind+' has a broken position or health');break}}
  const hud=txt($('hud'))+' '+txt($('panel'));const m=/\b(undefined|NaN|\[object Object\]|null)\b/.exec(hud);if(m)bad.push('the interface shows "'+m[0]+'": …'+hud.slice(Math.max(0,m.index-40),m.index+30).replace(/\n/g,' ')+'…');
  return bad};
B.ready=true;

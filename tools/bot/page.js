// Runs inside the bot's game page (served only by tools/bot/session.mjs, never published). It reads what a player could see into plain data,
// numbers the things that can be clicked, and helps the session steer by key presses. It never changes game state: every action the bot takes
// goes through real key and mouse events sent by the session.
import {G,weaponDef} from '../js/sim/core.js';
import {OBJ} from '../js/data/objects.js';
import {ITEMS} from '../js/data/items.js';
import {interactInfo} from '../js/sim/actors.js';
import {field,pathAim,walkClear,los,edgeCross} from '../js/sim/zone.js';
import {MapScreen} from '../js/ui/map.js';

const $=id=>document.getElementById(id),vis=el=>!!el&&!el.hidden&&el.offsetParent!==null,txt=el=>el?el.innerText.replace(/\s+\n/g,'\n').replace(/[ \t]+/g,' ').trim():'';
const DIRS=['E','SE','S','SW','W','NW','N','NE'],compass=(dx,dy)=>DIRS[((Math.round(Math.atan2(dy,dx)/(Math.PI/4))%8)+8)%8];
const r1=v=>Math.round(v*10)/10;
const B=window.__bot={msgs:[],els:[],gateUntil:0,shield:false,nav:null};

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
  if(el.classList.contains('sl')){const n=el.querySelector('u');t=(ti||'empty slot')+(n&&n.textContent?' ×'+n.textContent:'')+(el.querySelector('em')?' ['+el.querySelector('em').textContent+']':'')}
  else if(!t)t=ti;else if(ti&&ti!==t&&t.length<24)t+=' ('+ti+')';
  if(/^×\d+$/.test(t))t='MAKE '+t+' (that many batches at once)';
  if(el.tagName==='SELECT')t=(ti||'choice')+': '+(el.selectedOptions[0]?el.selectedOptions[0].textContent:'');
  // costs are drawn as icons with a number; spell them out ("needs 2 Log (have 5)")
  const costs=root=>[...root.querySelectorAll('.ing span[title]')].map(c=>{const[nm,have]=c.getAttribute('title').split(': ');return c.textContent.trim()+' '+nm+(have?' ('+have+')':'')}).join(', ');
  if(el.classList.contains('bp')){const nm=el.querySelector('b'),c=costs(el),lock=el.querySelector('.ing .no');t=(nm?nm.textContent:t)+(c?' — needs '+c:lock?' — '+lock.textContent:'');return t.slice(0,140)}
  // a button in a row of a list ("MAKE", "×5", "Recruit") says nothing without the row's name
  const row=!el.classList.contains('sl')&&el.closest('.rec,.perk,.goal,.card');if(row&&row!==el){const h=row.querySelector('b,h3');const ht=h&&h.textContent.replace(/\s+/g,' ').trim();if(ht&&!t.includes(ht)&&t.length<40){t+=' — '+ht.slice(0,40);const c=row.classList.contains('rec')&&/^make$/i.test((el.innerText||'').trim())?costs(row):'';if(c)t+=' (needs '+c+')'}}
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
      B.els.push(el);out.push({n:B.els.length,label:lab||'empty slot',flags});if(!full&&out.length>=70)break}}
  if(name==='map')for(const s of MapScreen.spots()){B.els.push({spot:s});out.push({n:B.els.length,label:'place on the map: '+s.name+(s.lead?' (RADIO LEAD)':''),flags:[s.here?'you are here':'',s.sel?'selected':''].filter(Boolean)})}
  return[name,out]}
/** The number of the one clickable thing whose label contains this text (case does not matter), 0 if none, -1 if several do. */
B.byText=q=>{q=String(q).toLowerCase().trim();const hit=[];q=q.replace(/^place on the map:\s*/,'').replace(/\s*\(radio lead\)\s*$/,'');B.els.forEach((el,i)=>{const l=(el.spot?el.spot.name:label(el)).toLowerCase();if(l.includes(q))hit.push([i+1,l])});const exact=hit.filter(h=>h[1]===q||h[1].startsWith(q+' '));return hit.length===1?hit[0][0]:exact.length===1?exact[0][0]:hit.length?-1:0};
/** Where to click for numbered element n (scrolling it into view first), or null. */
B.target=n=>{const el=B.els[n-1];if(!el)return null;if(el.spot){const s=MapScreen.spots().find(q=>q.id===el.spot.id)||el.spot,top=document.elementFromPoint(s.x,s.y);return{x:s.x,y:s.y,label:s.name,spot:true,covered:!top||top.id!=='mapc'}}
  if(!document.contains(el))return null;el.scrollIntoView({block:'center',inline:'center'});const r=el.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,label:label(el),disabled:!!el.disabled}};

// ---- the world around the player
function around(full){
  const Z=G.Z,p=Z.pl,W=Z.w,R=full?14:10,things=new Map(),foes=[],others=[];
  const x0=Math.max(0,Math.floor(p.x-R)),x1=Math.min(W-1,Math.floor(p.x+R)),y0=Math.max(0,Math.floor(p.y-R)),y1=Math.min(Z.h-1,Math.floor(p.y+R));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=y*W+x,o=Z.obj[i];if(!o)continue;const d=OBJ[o.k];if(!d)continue;const info=interactInfo(Z,i);
    if(!info&&!d.cost&&!d.loot)continue;                       // plain scenery is left to the picture
    const dist=Math.hypot(x+.5-p.x,y+.5-p.y),key=d.n+'|'+(info?info.label:'')+(d.loot&&o.empty?'|searched':''),t=things.get(key);
    if(!t)things.set(key,{name:d.n,act:info?info.label:d.loot&&o.empty?'already searched':null,yours:!!d.cost,n:1,x,y,dist});else{t.n++;if(dist<t.dist){t.x=x;t.y=y;t.dist=dist}}}
  for(const a of Z.actors){if(a.pl||a.dead)continue;const dist=Math.hypot(a.x-p.x,a.y-p.y);if(dist>R+4||a.vis<.5)continue;
    const e={name:a.def.n||a.kind,x:r1(a.x),y:r1(a.y),dist:r1(dist),dir:compass(a.x-p.x,a.y-p.y),hp:Math.round(a.hp/a.mhp*100)};
    if(a.team===1&&a.def.ai!=='flee'){e.state=a.alert?(a.st==='wind'?'about to strike':a.st==='charge'?'charging':'coming for you'):'has not seen you';if(a.def.boss)e.boss=true;foes.push(e)}
    else{e.kind=a.team===0?'with you':'animal';others.push(e)}}
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
  return{mode:G.mode,sheet:window.GW?GW.UI.panel:null,hp:S?S.p.hp:0,x:p?p.x:0,y:p?p.y:0,dead:!!(p&&p.dead),act:p&&p.act?p.act.type:null,atk:!!(p&&p.atk),foe:r1(foe),alertN,auto:!!G.auto,t:Z?Z.time:0,zone:Z?Z.id:null,fps:window.GW?GW.View.fps:0,msgs:B.msgs.length}};

// ---- walking by keys: which of the eight ways to press to get to a tile (or next to it, when something solid stands on it)
B.navTo=(tx,ty)=>{const Z=G.Z;if(!Z||tx<0||ty<0||tx>=Z.w||ty>=Z.h)return false;B.nav={tx,ty,f:field(Z,Math.floor(tx),Math.floor(ty),true,400),t:Z.time,zone:Z.id};return true};
B.steer=()=>{const Z=G.Z,nv=B.nav;if(!Z||!nv||nv.zone!==Z.id)return{done:'lost'};const p=Z.pl,cx=Math.floor(nv.tx)+.5,cy=Math.floor(nv.ty)+.5,d=Math.hypot(cx-p.x,cy-p.y);
  const ti=Math.floor(nv.ty)*Z.w+Math.floor(nv.tx),o=Z.obj[ti],solid=o&&OBJ[o.k]&&OBJ[o.k].solid,usable=o&&!!interactInfo(Z,ti);
  // stop beside a solid thing, and a step short of anything else that can be used, facing it: standing on top of a plant, E picks whatever you face
  if(d<(solid?1.28:usable?.95:.3))return{done:'arrived',d:r1(d)};
  if(Z.time-nv.t>1.5){nv.f=field(Z,Math.floor(nv.tx),Math.floor(nv.ty),true,400);nv.t=Z.time}
  // (the player's own tile may read as unreachable when standing beside a tree trunk; what matters is whether a neighbour leads on)
  let gx=cx,gy=cy;if(!walkClear(Z,p.x,p.y,cx,cy,p.r,true)||solid){const a=pathAim(Z,nv.f,p.x,p.y,p.r,true);if(a){gx=a[0];gy=a[1]}else if(d>1.6)return{done:'no way there'}}
  return{dx:gx-p.x,dy:gy-p.y,d:r1(d)}};
/** Page pixels of a point in the world (h metres above the ground). */
B.screen=(x,y,h=0)=>{const s=GW.View.project(x,y,h),r=$('cv').getBoundingClientRect();return{x:s.x+r.left,y:s.y+r.top,on:s.x>=0&&s.y>=0&&s.x<=r.width&&s.y<=r.height}};
B.nearestFoe=(maxD=9)=>{const Z=G.Z,p=Z&&Z.pl;if(!p)return null;let b=null,bd=maxD;for(const a of Z.actors){if(a.pl||a.dead||a.team!==1||a.vis<.5)continue;const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<bd){bd=d;b=a}}return b?{x:b.x,y:b.y,d:bd,name:b.def.n,flee:b.def.ai==='flee'}:null};
/** Who to fight and whether it can be hit from here: the nearest hostile thing, preferring ones in plain view; `blocked` when a wall or
 *  something solid stands between, `reach` how close the weapon in hand needs to be. */
B.fight=(keep=0)=>{const Z=G.Z,p=Z&&Z.pl;if(!p)return null;const w=weaponDef(G.S),gun=w.t==='gun';let b=null,bs=1e9;
  for(const a of Z.actors){if(a.pl||a.dead||a.team!==1||a.vis<.5)continue;const d=Math.hypot(a.x-p.x,a.y-p.y),mine=a.id===keep&&a.def.ai!=='flee';
    // the one already being gone after is kept however far the way round takes you; otherwise the nearest within fourteen tiles, and animals that run only when beside you
    if(!mine&&(d>14||(a.def.ai==='flee'&&d>3.5)))continue;
    const blocked=!los(Z,p.x,p.y,a.x,a.y),sc=mine?-99:d+(blocked?4:0)+(a.def.ai==='flee'?3:0)+(a.alert?0:2);if(sc<bs){bs=sc;b={id:a.id,x:a.x,y:a.y,d,name:a.def.n,blocked,flee:a.def.ai==='flee',r:a.r}}}
  if(!b)return null;b.reach=gun?Math.min(w.rng*.8,8):w.rng+b.r+.1;b.gun=gun;return b};
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

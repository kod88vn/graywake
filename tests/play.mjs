#!/usr/bin/env node
// Play-through test: drives the real page with real key presses and clicks, the way a person plays,
// and checks that each step did what it should. This is the test that catches "I pressed it and nothing happened".
import {launch,reporter} from '../tools/lib.mjs';
const T=reporter('play-through (real input)');
const page=await launch({width:1280,height:720,quiet:true,pathName:'/?shots=1'});
const ev=js=>page.eval(js),J=async js=>JSON.parse(await ev(`JSON.stringify(${js})`));
const count=id=>ev(`GW.G.S.p.inv.reduce((n,s)=>n+(s&&s.id==='${id}'?s.n:0),0)`);
const pos=()=>J(`[GW.G.Z.pl.x,GW.G.Z.pl.y]`);
const until=async(js,ms=8000)=>{for(let t=0;t<ms;t+=150){if(await ev(js))return true;await page.sleep(150)}return false};
const hold=async(k,ms)=>{const code='Key'+k.toUpperCase();await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:k,code});await page.sleep(ms);await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:k,code})};
/** Walk with WASD until within `stop` of a point. */
async function walkTo(tx,ty,stop=.9){for(let i=0;i<160;i++){const[x,y]=await pos(),dx=tx-x,dy=ty-y,d=Math.hypot(dx,dy);if(d<stop)return true;const ms=Math.min(260,Math.max(40,d*150));
  if(Math.abs(dx)>.35&&Math.abs(dy)>.35){const a=dx>0?'d':'a',b=dy>0?'s':'w';await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:a,code:'Key'+a.toUpperCase()});await hold(b,ms);await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:a,code:'Key'+a.toUpperCase()})}
  else await hold(Math.abs(dx)>Math.abs(dy)?(dx>0?'d':'a'):(dy>0?'s':'w'),ms)}return false}
const nearest=kinds=>J(`(()=>{const Z=GW.G.Z,p=Z.pl;let b=null,bd=1e9;Z.obj.forEach((o,i)=>{if(!o||!${JSON.stringify(kinds)}.includes(o.k)||o.empty)return;const x=i%Z.w+.5,y=Math.floor(i/Z.w)+.5,d=Math.hypot(x-p.x,y-p.y);if(d<bd){bd=d;b=[x,y,i]}});return b})()`);
/** Walk next to the nearest object of a kind and press E. */
async function use(kinds,holdMs=0){const t=await nearest(kinds);if(!t)return false;await walkTo(t[0],t[1],1.25);await page.sleep(200);
  for(const[ox,oy]of[[0,0],[-.9,0],[.9,0],[0,.9],[0,-.9]]){if(await ev(`!!GW.G.Z.hint&&GW.G.Z.hint.i===${t[2]}`))break;await walkTo(t[0]+ox,t[1]+oy,.4);await page.sleep(250)}
  if(holdMs)await page.sleep(50);await page.key('e');return t}
const click=async sel=>{await page.tap(sel);await page.sleep(160)};
const tileXY=async(tx,ty)=>J(`(()=>{const s=GW.View.project(${tx}+.5,${ty}+.5,0),r=document.getElementById('cv').getBoundingClientRect();return[s.x+r.left,s.y+r.top]})()`);
try{
  await page.sleep(700);await ev(`window.__noIntro=true;localStorage.clear()`);await click('#t-new');
  T.ok(await until(`GW.G.mode==='play'&&!!GW.G.Z&&!document.getElementById('fade').classList.contains('on')`),'New game button starts the game');
  await ev(`GW.G.S.lead.next=1e12`);   // radio leads are tested on their own at the end; none may interrupt the scripted path
  // ---- gather by hand
  for(const[kind,item]of[[['stone_pile'],'stone'],[['log_pile'],'stick'],[['grass_tall'],'fiber'],[['stone_pile'],'stone'],[['log_pile'],'stick'],[['grass_tall'],'fiber']]){const before=await count(item);await use(kind);await until(`GW.G.S.p.inv.reduce((n,s)=>n+(s&&s.id==='${item}'?s.n:0),0)>${before}`,4000)}
  T.ok(await count('stone')>=4&&await count('stick')>=3&&await count('fiber')>=4,'E gathers stones, sticks and fibre by hand ('+await count('stone')+' stone, '+await count('stick')+' stick, '+await count('fiber')+' fibre)');
  // ---- the starter crate: search, take, put back
  await use(['crate']);T.ok(await until(`GW.UI.panel==='loot'`,5000),'E on the crate opens it');
  const c0=await ev(`document.querySelectorAll('#pb [data-a=take][title]').length`);await click('#pb [data-a="take"][title]');
  T.ok(await ev(`document.querySelectorAll('#pb [data-a=take][title]').length`)===c0-1,'clicking an item takes it');
  await click('#pb [data-a="put"][title]');T.ok(await ev(`document.querySelectorAll('#pb [data-a=take][title]').length`)===c0,'clicking a pack item puts it back in the crate');
  await click('#pb [data-a="all"]');T.ok(await ev(`GW.UI.panel===null`),'Take all empties and closes it');
  // ---- craft tools from the craft sheet
  await ev(`GW.World.applyFx([['item','stick',8],['item','stone',8],['item','fiber',8]])`);
  await page.key('c');T.ok(await until(`GW.UI.panel==='craft'`,2000),'C opens crafting');
  await click('#pb [data-r="hatchet_stone"][data-n="1"]');await click('#pb [data-r="pick_stone"][data-n="1"]');
  T.ok(await ev(`!!GW.G.S.p.eq.w1&&GW.G.S.p.eq.w1.id==='hatchet_stone'`),'crafted hatchet lands in the hand');T.ok(await count('pick_stone')===1,'crafted pickaxe lands in the pack');
  T.ok(await ev(`document.getElementById('toasts').innerText.includes('Made')&&getComputedStyle(document.getElementById('toasts')).zIndex>getComputedStyle(document.getElementById('shade')).zIndex`),'a "Made" message shows above the sheet');
  await page.key('Escape');T.ok(await until(`GW.UI.panel===null`,1500),'Esc closes the sheet');
  // ---- chop and mine
  let l0=await count('log');await use(['tree_pine','tree_birch','tree_dead']);if(!(await until(`GW.G.S.p.inv.reduce((n,s)=>n+(s&&s.id==='log'?s.n:0),0)>${l0}`,9000)))T.info('tree: toasts «'+await ev(`[...document.getElementById('toasts').children].map(e=>e.textContent).join(' / ')`)+'» pack '+await ev(`GW.G.S.p.inv.filter(Boolean).length+'/'+GW.G.S.p.inv.length`)+' hint '+await ev(`JSON.stringify(GW.G.Z.hint)`)+' act '+await ev(`JSON.stringify(GW.G.Z.pl.act)`));T.ok(await until(`GW.G.S.p.inv.reduce((n,s)=>n+(s&&s.id==='log'?s.n:0),0)>${l0}`,9000),'E on a tree chops it down for logs');
  let s0=await count('stone');await use(['rock','rock_flint']);T.ok(await until(`GW.G.S.p.inv.reduce((n,s)=>n+(s&&s.id==='stone'?s.n:0),0)>${s0}||GW.G.S.p.inv.some(s=>s&&s.id==='flint')`,9000),'E on a rock mines it');
  // ---- auto-gather
  await page.key('f');T.ok(await ev(`GW.G.auto`),'F turns auto-gather on');const n0=await ev(`GW.G.S.stats.wood||0`);await page.sleep(7000);
  T.ok(await ev(`(GW.G.S.stats.wood||0)+(GW.G.S.stats.ore||0)+(GW.G.S.stats.forage||0)`)>n0,'auto-gather keeps gathering');await page.key('f');T.ok(!(await ev(`GW.G.auto`)),'F turns it off');
  // ---- build: campfire, walls by dragging, a box, a bed
  await ev(`GW.World.applyFx([['item','log',40],['item','stone',20],['item','stick',30],['item','rope',6],['item','fiber',20],['item','rags',6]])`);
  const c=await J(`[Math.floor(GW.G.Z.w/2),Math.floor(GW.G.Z.h/2)]`);await walkTo(c[0]+.5,c[1]+.5,.6);
  await ev(`(()=>{const Z=GW.G.Z;for(let y=${c[1]}-3;y<=${c[1]}+3;y++)for(let x=${c[0]}-4;x<=${c[0]}+4;x++)if(Z.obj[y*Z.w+x]){Z.obj[y*Z.w+x]=null;Z.touch(y*Z.w+x)}})()`);
  await page.key('b');T.ok(await until(`!document.getElementById('build').hidden`,1500),'B opens build mode');
  const placeAt=async(cat,kind,tx,ty)=>{await click(`[data-b="cat:${cat}"]`);await click(`[data-b="kind:${kind}"]`);const[x,y]=await tileXY(tx,ty);await page.click(x,y);await page.sleep(200);const ok=await ev(`!!GW.G.Z.obj[${ty}*GW.G.Z.w+${tx}]&&GW.G.Z.obj[${ty}*GW.G.Z.w+${tx}].k==='${kind}'`);if(!ok)T.info(kind+' not placed: toasts «'+await ev(`[...document.getElementById('toasts').children].map(e=>e.textContent).join(' / ')`)+'» pack '+await ev(`GW.G.S.p.inv.filter(Boolean).length+'/'+GW.G.S.p.inv.length`)+' build '+await ev(`JSON.stringify(GW.G.build)`));return ok};
  T.ok(await placeAt('craft','campfire',c[0]+2,c[1]),'click places a campfire');
  T.ok(await placeAt('storage','box_small',c[0]+2,c[1]-1),'click places a storage box');
  T.ok(await placeAt('base','bed_roll',c[0]-2,c[1]),'click places a bedroll');
  await click('[data-b="cat:base"]');await click('[data-b="kind:wall_stick"]');
  // walls stand on the side of a cell: press near the north side of one cell, drag along the row, and a straight line of wall follows
  {const[x0,y0]=await tileXY(c[0]-2,c[1]+2-.35),[x1,y1]=await tileXY(c[0]+2,c[1]+2-.3);await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x0,y:y0});await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:x0,y:y0,button:'left',buttons:1,clickCount:1});
    for(let i=1;i<=20;i++){await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:x0+(x1-x0)*i/20,y:y0+(y1-y0)*i/20,button:'left',buttons:1});await page.sleep(30)}await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:x1,y:y1,button:'left',clickCount:1})}
  const WALLS=`GW.G.Z.ed.filter(o=>o&&o.k==='wall_stick').length`,walls=await ev(WALLS);T.ok(walls>=4,'dragging runs a line of walls along the cell edges ('+walls+')');
  T.ok(await ev(`(()=>{const Z=GW.G.Z,W=Z.w,y=${c[1]+2};let n=0;for(let x=${c[0]-2};x<=${c[0]+2};x++)if(Z.ed[(y*W+x)*2]&&!Z.obj[y*W+x])n++;return n})()`)>=4,'they stand on the north side of the row and leave its cells empty');
  await click('[data-b="tool:remove"]');{const[x,y]=await tileXY(c[0]-2,c[1]+2-.42);await page.click(x,y);await page.sleep(200)}T.ok(await ev(WALLS)===walls-1,'Remove takes a wall down');
  // move and rotate with the tools
  {const bi=(c[1]-1)*await ev(`GW.G.Z.w`)+c[0]+2,[bx,by]=await tileXY(c[0]+2,c[1]-1),[nx,ny]=await tileXY(c[0]+4,c[1]-2),ni=(c[1]-2)*await ev(`GW.G.Z.w`)+c[0]+4;
    await ev(`GW.G.Z.obj[${ni}]=null`);await click('[data-b="tool:move"]');await page.click(bx,by);await page.sleep(200);await page.key('r');await page.sleep(100);await page.click(nx,ny);await page.sleep(250);
    T.ok(await ev(`!GW.G.Z.obj[${bi}]&&!!GW.G.Z.obj[${ni}]&&GW.G.Z.obj[${ni}].k==='box_small'`),'Move: click a box, click a free tile, and it is there');T.ok(await ev(`GW.G.Z.obj[${ni}]&&GW.G.Z.obj[${ni}].r`)===1,'R while carrying turns it');
    await click('[data-b="tool:turn"]');await page.click(nx,ny);await page.sleep(200);T.ok(await ev(`GW.G.Z.obj[${ni}]&&GW.G.Z.obj[${ni}].r`)===2,'Rotate: clicking a structure turns it');}
  // the same two tools on a wall: pick it up by its side, stand it on another cell's side, swing it round that cell, carry it back
  {const W=await ev(`GW.G.Z.w`),N=(x,y)=>`GW.G.Z.ed[(${y}*${W}+${x})*2]`,E=(x,y)=>`GW.G.Z.ed[(${y}*${W}+${x}+1)*2+1]`,ax=c[0],ay=c[1]+2,bx=c[0]+1,by=c[1]-2;   // both spots are clear of the build bar
    const[x0,y0]=await tileXY(ax,ay-.42),[x1,y1]=await tileXY(bx,by-.42),[x2,y2]=await tileXY(bx+.42,by);
    await click('[data-b="tool:move"]');await page.click(x0,y0);await page.sleep(200);await page.click(x1,y1);await page.sleep(250);
    T.ok(await ev(`!${N(ax,ay)}&&!!${N(bx,by)}&&${N(bx,by)}.k==='wall_stick'`),'Move: click a wall, click the side of another cell, and it stands there');
    await click('[data-b="tool:turn"]');await page.click(x1,y1);await page.sleep(200);T.ok(await ev(`!${N(bx,by)}&&!!${E(bx,by)}`),'Rotate: clicking a wall swings it to the next side of its cell');
    await click('[data-b="tool:move"]');await page.click(x2,y2);await page.sleep(200);await page.click(x0,y0);await page.sleep(250);T.ok(await ev(`!${E(bx,by)}&&!!${N(ax,ay)}`),'and Move carries it back');}
  await click('[data-b="tool:done"]');T.ok(await ev(`document.getElementById('build').hidden`),'Done leaves build mode');
  // ---- storage box: put, take, stow
  await use(['box_small']);T.ok(await until(`GW.UI.panel==='store'`,4000),'E on the box opens storage');
  const p0=await ev(`GW.G.S.p.inv.filter(Boolean).length`);await click('#pb [data-a="put"][title]');T.ok(await ev(`GW.G.S.p.inv.filter(Boolean).length`)===p0-1,'clicking a pack item stores it');
  await click('#pb [data-a="stow"]');T.ok(await ev(`GW.G.Z.obj.find(o=>o&&o.k==='box_small').inv.filter(Boolean).length`)>=3,'Stow materials moves materials in');
  await click('#pb [data-a="take"][title]');await page.key('Escape');await page.sleep(200);
  // ---- campfire: boil water, wait, receive it
  await ev(`GW.World.applyFx([['item','dirty_water',2],['item','raw_meat',2]])`);const w0=await count('water');
  await use(['campfire']);T.ok(await until(`GW.UI.panel==='craft'`,4000),'E on the campfire opens its recipes');
  await ev(`GW.G.S.p.lvl=30`);await click('#tabs [data-t="hand"]');await click('#tabs [data-t="st"]');
  {const m=await J(`(()=>{const p=document.getElementById('panel').getBoundingClientRect(),b=document.getElementById('pb');return[p.bottom<=innerHeight+1&&p.top>=-1,b.scrollHeight>b.clientHeight+20]})()`);T.ok(m[0],'a long sheet stays inside the screen');
   if(m[1]){const r=await J(`(()=>{const b=document.getElementById('pb').getBoundingClientRect();return[b.left+b.width/2,b.top+b.height/2]})()`);await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:r[0],y:r[1]});await page.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:r[0],y:r[1],deltaX:0,deltaY:400});T.ok(await until(`document.getElementById('pb').scrollTop>50`,4000),'the mouse wheel scrolls a long list');await page.sleep(900);await ev(`document.getElementById('pb').scrollTop=0`);await page.sleep(400)}else T.info('list was not long enough to need scrolling')}
  await click('#pb [data-r="water"][data-n="1"]');if(!(await ev(`!!document.getElementById('jobp')`)))T.info('craft: tab '+await ev(`document.querySelector('#tabs .on').dataset.t`)+' toasts «'+await ev(`[...document.getElementById('toasts').children].map(e=>e.textContent).join(' / ')`)+'» dirty '+await count('dirty_water')+' pack '+await ev(`GW.G.S.p.inv.filter(Boolean).length+'/'+GW.G.S.p.inv.length`)+' row '+await ev(`(document.querySelector('#pb [data-r=water]')||{}).outerHTML`)+' scroll '+await ev(`JSON.stringify([document.getElementById('pb').scrollTop,document.getElementById('pb').scrollHeight,document.getElementById('pb').clientHeight])`));T.ok(await ev(`!!document.getElementById('jobp')`),'the job shows a progress bar');
  T.ok(await until(`GW.G.S.p.inv.reduce((n,s)=>n+(s&&s.id==='water'?s.n:0),0)>${w0}`,12000),'boiled water arrives in the pack while the sheet is open');
  await click('#pb [data-r="cooked_meat"][data-n="1"]');await page.key('Escape');T.ok(await until(`GW.G.S.p.inv.some(s=>s&&s.id==='cooked_meat')`,12000),'cooked meat arrives after walking away');
  // ---- pack: eat, equip, drop
  await page.key('i');await until(`GW.UI.panel==='inv'`,1500);const mi=await ev(`GW.G.S.p.inv.findIndex(s=>s&&s.id==='cooked_meat')`);const f0=await ev(`GW.G.S.p.food`);await ev(`GW.G.S.p.food=40`);
  await click(`#pb [data-a="sel"][data-i="${mi}"]`);await click('#pb [data-a="use"]');T.ok(await ev(`GW.G.S.p.food`)>40,'Eat in the pack sheet feeds you');
  const pi=await ev(`GW.G.S.p.inv.findIndex(s=>s&&s.id==='pick_stone')`);await click(`#pb [data-a="sel"][data-i="${pi}"]`);await click('#pb [data-a="equip"][data-slot="w2"]');T.ok(await ev(`GW.G.S.p.eq.w2&&GW.G.S.p.eq.w2.id==='pick_stone'`),'Equip as spare works');
  await page.key('Escape');await page.sleep(200);await page.key('q');T.ok(await ev(`GW.G.S.p.active==='w2'`),'Q swaps weapon');await page.key('q');
  // ---- journal and perks
  await page.key('j');await until(`GW.UI.panel==='journal'`,1500);T.ok(await ev(`GW.G.S.q.i>=1`),'the opening quest completed by itself (now on step '+(await ev(`GW.G.S.q.i`)+1)+')');
  await ev(`GW.G.S.p.sp=1`);await click('#tabs [data-t="perks"]');await click('#pb [data-a="perk"]:not([disabled])');T.ok(await ev(`Object.keys(GW.G.S.p.perks).length`)===1,'a perk can be bought');await page.key('Escape');
  // ---- community: someone asks to join, and the neighbours
  await ev(`GW.G.hooks.rescue();GW.G.S.scrip=200`);await page.key('l');T.ok(await until(`GW.UI.panel==='camp'`,3000),'L opens the Camp ledger');
  await click('#tabs [data-t="people"]');T.ok(await until(`!!document.querySelector('#pb [data-a="recruit"]')`,3000),'the People tab lists someone asking to join');
  await click('#pb [data-a="recruit"]');T.ok(await ev(`GW.G.S.surv.length`)===0&&await ev(`GW.G.S.wait.length`)===1,'recruiting without a spare bed is refused and they keep waiting');
  await ev(`(async()=>{const core=await import('/js/sim/core.js'),S=GW.G.S,Z=GW.G.Z,cx=Math.floor(Z.w/2),cy=Math.floor(Z.h/2);core.give(S,'fiber',30);core.give(S,'rags',9);let n=0;for(let r=3;r<14&&n<2;r++)for(let dx=-r;dx<=r&&n<2;dx++){const x=cx+dx,y=cy-r;if(core.canPlace(S,'bed_roll',x,y)===null&&core.place(S,'bed_roll',x,y))n++}window.__beds=n})()`);await until(`window.__beds>=1`,3000);
  await click('#pb [data-a="recruit"]');T.ok(await until(`GW.G.S.surv.length===1&&GW.G.S.wait.length===0`,3000),'with a bed, clicking Recruit moves them in');
  await click('#tabs [data-t="others"]');T.ok(await until(`!!document.querySelector('#pb [data-a="gift"]')`,3000),'the Neighbours tab lists a community');
  const st0=await ev(`GW.World.Community.fac(GW.G.S,'mill').st`);await click('#pb [data-a="gift"]');T.ok(await ev(`GW.World.Community.fac(GW.G.S,'mill').st`)>st0,'clicking Gift raises standing');
  await click('#tabs [data-t="farm"]');await page.sleep(200);T.ok(await ev(`document.getElementById('pb').innerText.length>40`),'the Farm tab renders');await page.key('Escape');await ev(`GW.G.S.surv.length=0`);
  // ---- sleep
  await ev(`GW.G.S.t=Math.floor(GW.G.S.t/1440)*1440+21.5*60;GW.G.S.tide.at=GW.G.S.t+4000`);await use(['bed_roll']);{const ok=await until(`GW.UI.panel==='bed'`,4000);if(!ok)T.info('bedroll: '+await ev(`(()=>{const Z=GW.G.Z,p=Z.pl,h=Z.hint;return JSON.stringify({panel:GW.UI.panel,hint:h&&{i:h.i,type:h.type,label:h.label,k:h.i!==undefined&&Z.obj[h.i]&&Z.obj[h.i].k},at:[+p.x.toFixed(2),+p.y.toFixed(2)],act:p.act&&p.act.type,auto:GW.G.auto,build:!!GW.G.build,paused:GW.G.paused,foes:Z.actors.filter(a=>a.team===1&&!a.dead).length,toasts:[...document.getElementById('toasts').children].map(e=>e.textContent).slice(-3)})})()`));T.ok(ok,'E on the bedroll opens Rest')}
  const d0=await ev(`Math.floor(GW.G.S.t/1440)`);await click('#pb [data-a="sleep"]');T.ok(await until(`Math.floor(GW.G.S.t/1440)===${d0+1}`,3000),'Sleep passes the night');
  // ---- leave, map, travel, event, arrive
  const gate=await J(`[GW.G.Z.w/2,GW.G.Z.h-1.2]`);await walkTo(c[0]-1.5,c[1]+1.2,.45);await walkTo(c[0]-1.5,c[1]+3.6,.45);await walkTo(gate[0],c[1]+4.2,.5);T.ok(await walkTo(gate[0],gate[1],.8),'walk out through the gap and down the south trail to the edge');T.ok(await until(`!document.getElementById('travel').hidden`,2000),'the Leave button appears');
  await click('#travel');T.ok(await until(`GW.G.mode==='map'&&document.getElementById('mapc').getBoundingClientRect().width>100`,4000),'Leave opens the map');
  const node=await J(`(()=>{const c=document.getElementById('mapc'),r=c.getBoundingClientRect();return[r.left,r.top,r.width,r.height]})()`);
  // click the Birch Hollow node: find it by scanning for the info card to say so
  let found=false;for(let gx=.04;gx<.4&&!found;gx+=.02)for(let gy=.2;gy<.6&&!found;gy+=.03){await page.click(node[0]+node[2]*gx,node[1]+node[3]*gy);if(await ev(`document.getElementById('mapinfo').innerText.toUpperCase().includes('BIRCH HOLLOW')`))found=true}
  T.ok(found,'clicking the map selects Birch Hollow');await click('#mapinfo [data-a="go"]');
  await until(`GW.UI.panel==='event'||(GW.G.Z&&GW.G.Z.id==='birch_hollow')||(GW.G.Z&&GW.G.Z.id==='ambush')`,6000);
  if(await ev(`GW.UI.panel==='event'`)){await ev(`[...document.querySelectorAll('#pb [data-a=opt]:not([disabled])')].pop().click()`);await page.sleep(200);T.ok(await ev(`!!document.querySelector('#pb [data-a=done]')`),'a road event resolves to a result');await click('#pb [data-a="done"]');await page.sleep(600)}
  if(await ev(`GW.G.Z&&GW.G.Z.id==='ambush'`)){await ev(`for(const a of GW.G.Z.actors)if(a.team===1)a.dead=true;GW.G.Z.pl.y=GW.G.Z.h-1`);await page.sleep(400);await click('#travel');await page.sleep(800)}
  if(!(await until(`GW.G.Z&&GW.G.Z.id==='birch_hollow'&&GW.G.mode==='play'`,6000)))console.log('DBG',await ev(`JSON.stringify({mode:GW.G.mode,panel:GW.UI.panel,z:GW.G.Z&&GW.G.Z.id,pos:GW.G.S.pos,pend:!!GW.G.pending,q:GW.View.quality,fps:GW.View.fps,info:document.getElementById('mapinfo').innerText.slice(0,50),pb:document.getElementById('pb').innerText.slice(0,80)})`));
  T.ok(await until(`GW.G.Z&&GW.G.Z.id==='birch_hollow'&&GW.G.mode==='play'`,6000),'Travel arrives at Birch Hollow');
  // ---- fight with the mouse
  await ev(`(()=>{const{G}=GW,Z=G.Z;G.S.p.active='w1';for(const a of Z.actors)if(a.team===1)a.dead=true;window.__e=GW.World&&null})()`);
  await ev(`import('/js/sim/actors.js').then(m=>{const Z=GW.G.Z;window.__foe=m.spawnActor(Z,'shambler',Z.pl.x+1.6,Z.pl.y,1);__foe.alert=true;__foe.st='chase'})`);await page.sleep(300);
  const k0=await ev(`GW.G.S.stats.kills||0`);{const s=await J(`(()=>{const s=GW.View.project(__foe.x,__foe.y,.6),r=document.getElementById('cv').getBoundingClientRect();return[s.x+r.left,s.y+r.top]})()`);
    await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:s[0],y:s[1]});await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:s[0],y:s[1],button:'left',buttons:1,clickCount:1});await until(`(GW.G.S.stats.kills||0)>${k0}`,15000);await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:s[0],y:s[1],button:'left',clickCount:1})}
  T.ok(await ev(`GW.G.S.stats.kills||0`)>k0,'holding the mouse button on a husk kills it');T.ok(await ev(`GW.G.S.p.hp`)>0,'and you live (health '+Math.round(await ev(`GW.G.S.p.hp`))+')');
  // a second husk, fought the careless way: separate quick clicks with the cursor a step to one side of it, not on it
  await ev(`import('/js/sim/actors.js').then(m=>{const Z=GW.G.Z;window.__foe=m.spawnActor(Z,'shambler',Z.pl.x+1.5,Z.pl.y,1);__foe.alert=true;__foe.st='chase'})`);await page.sleep(300);
  {const k1=await ev(`GW.G.S.stats.kills||0`);let clicks=0;await ev(`GW.G.S.p.hp=Math.max(GW.G.S.p.hp,80)`);
    for(;clicks<45&&!(await ev(`(GW.G.S.stats.kills||0)>${k1}`));clicks++){const s=await J(`(()=>{const p=GW.G.Z.pl,dx=__foe.x-p.x,dy=__foe.y-p.y,l=Math.hypot(dx,dy)||1,s=GW.View.project(__foe.x-dy/l*1.0,__foe.y+dx/l*1.0,.6),r=document.getElementById('cv').getBoundingClientRect();return[s.x+r.left,s.y+r.top]})()`);
      await page.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:s[0],y:s[1]});await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:s[0],y:s[1],button:'left',buttons:1,clickCount:1});await page.sleep(50);await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:s[0],y:s[1],button:'left',clickCount:1});await page.sleep(200)}
    T.ok(await ev(`(GW.G.S.stats.kills||0)>${k1}`),'quick clicks beside a husk still land and kill it ('+clicks+' clicks)')}
  await page.send('Input.dispatchKeyEvent',{type:'keyDown',key:' ',code:'Space'});await page.sleep(80);await page.send('Input.dispatchKeyEvent',{type:'keyUp',key:' ',code:'Space'});T.ok(await until(`GW.G.Z.pl.rollCd>0`,1500),'Space dodges');
  // ---- go home, save, reload
  await ev(`for(const a of GW.G.Z.actors)if(a.team===1)a.dead=true`);const ex=await J(`[GW.G.Z.w/2,GW.G.Z.h-1.2]`);await ev(`GW.G.Z.pl.x=${ex[0]};GW.G.Z.pl.y=${ex[1]}-3`);await walkTo(ex[0],ex[1],.8);await until(`!document.getElementById('travel').hidden`,2000);await click('#travel');await until(`GW.G.mode==='map'`,2000);
  await ev(`GW.G.pending=null;GW.World.travel('home')`);await page.sleep(500);if(await ev(`GW.UI.panel==='event'`)){await ev(`[...document.querySelectorAll('#pb [data-a=opt]:not([disabled])')].pop().click()`);await page.sleep(200);await click('#pb [data-a="done"]');await page.sleep(500)}
  if(await ev(`GW.G.Z&&GW.G.Z.id==='ambush'`)){await ev(`for(const a of GW.G.Z.actors)if(a.team===1)a.dead=true;GW.G.Z.pl.y=GW.G.Z.h-1`);await page.sleep(400);await click('#travel');await page.sleep(800)}
  T.ok(await until(`GW.G.Z&&GW.G.Z.home`,5000),'travel home');T.ok(await ev(`GW.G.Z.obj.some(o=>o&&o.k==='campfire')`),'the base is as it was left');
  // coming home can open a sheet of its own (an away report, a home event): answer it the way a player would before opening the menu
  for(let k=0;k<5&&await ev(`!!GW.UI.panel&&GW.UI.panel!=='menu'`);k++){await ev(`(()=>{const b=document.querySelector('#pb [data-a=ok],#pb [data-a=go],#pb [data-a=done],#pb [data-a=opt]:not([disabled]),#px');if(b)b.click()})()`);await page.sleep(300)}
  // ---- a radio lead: the note opens by itself once you stand still, says how dangerous the place is, and the place is on the map
  await ev(`(()=>{const{G,World}=GW,S=G.S;S.nextEv=Infinity;S.tide.at=S.t+9e4;for(const a of G.Z.actors)if(a.team===1)a.dead=true;const st=World.addLead(S,'lead_pharmacy',1);window.__lead=st.id;S.lead.note=st.id})()`);
  T.ok(await until(`GW.UI.panel==='lead'`,8000),'a radio note opens by itself when you are standing still at home');
  {const txt=await ev(`document.getElementById('pb').innerText`);T.ok(/Pharmacy/i.test(txt)&&/Threat/i.test(txt)&&/The Chemist/.test(txt)&&/Strongroom/i.test(txt)&&/Gone in/i.test(txt),'it names the place, its threat, its guardian, its strongroom and how long it lasts');
    T.ok(await ev(`(()=>{const p=document.getElementById('panel').getBoundingClientRect();return p.bottom<=innerHeight+1&&p.top>=-1})()`),'the note fits the screen')}
  await click('#pb [data-a="done"]');T.ok(await ev(`GW.UI.panel===null&&GW.G.S.lead.note===null&&GW.G.S.sites.some(s=>s.id===window.__lead)`),'Noted closes it and the place stays marked on the map');
  await page.key('p');T.ok(await until(`GW.UI.panel==='menu'`,3000),'P opens the menu (open sheet: '+await ev(`GW.UI.panel`)+')');await click('#pb [data-a="save"]');await click('#pb [data-a="title"]');T.ok(await until(`!document.getElementById('title').hidden`,2000),'Quit to title');
  await click('#t-cont');T.ok(await until(`GW.G.mode==='play'&&GW.G.Z&&GW.G.Z.home&&GW.G.Z.obj.some(o=>o&&o.k==='campfire')`,6000),'Continue restores the homestead');
  T.ok(page.errors.length===0,'no page errors'+(page.errors.length?': '+page.errors.slice(0,6).join(' | '):''));
}catch(e){T.ok(false,'threw: '+e.message+(page.errors.length?' | page: '+page.errors.slice(0,5).join(' | '):''))}
await page.close();process.exitCode=T.end()?1:0;

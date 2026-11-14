#!/usr/bin/env node
// A play session for a bot: the game in a Chrome of its own (own profile, own save, a frozen copy of the code), a small command API to play it
// through real key and mouse events, a live picture for people to watch, and a log of everything that happens.
//
//   node tools/bot/session.mjs [--profile haiku] [--port 8777] [--pace live|turns] [--window] [--fresh] [--sound] [--world http://127.0.0.1:8795 --name "Camp name"]
//
// Nothing here touches your own browser, keyboard or mouse. See docs/AUTOMATION.md.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {ROOT,OUT} from '../lib.mjs';

const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:true};
const PROFILE=String(arg('profile','haiku')).replace(/[^\w-]/g,''),PORT=+arg('port',8777),PACE=arg('pace','live')==='turns'?'turns':'live',WINDOW=!!arg('window',false),FRESH=!!arg('fresh',false),SOUND=!!arg('sound',false),POINTER=!process.argv.includes('--no-current');
const W=1280,H=720,HERE=path.dirname(new URL(import.meta.url).pathname),BOT=path.join(OUT,'bot'),PROF=path.join(BOT,'profiles',PROFILE);
const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15),SID=stamp(new Date())+'-'+PROFILE,SD=path.join(BOT,'sessions',SID);
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const git=(...a)=>{try{return execFileSync('git',a,{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()}catch(e){return''}};

// ---------------------------------------------------------------- a frozen copy of the game, so edits to the working tree cannot reach a running session
for(const d of['game','shots','bugs'])fs.mkdirSync(path.join(SD,d),{recursive:true});fs.mkdirSync(PROF,{recursive:true});
for(const f of['js','vendor','index.html'])fs.cpSync(path.join(ROOT,f),path.join(SD,'game',f),{recursive:true});
const META={session:SID,profile:PROFILE,pace:PACE,window:WINDOW,port:PORT,started:new Date().toISOString(),commit:git('rev-parse','--short','HEAD'),dirty:!!git('status','--porcelain','--','js','index.html'),pid:process.pid};
const jl=(file,o)=>fs.appendFileSync(path.join(SD,file),JSON.stringify(o)+'\n');
const NOTEBOOK=path.join(PROF,'notebook.md');

// ---------------------------------------------------------------- state
const S={events:[],bugs:[],ideas:[],says:[],hints:[],errors:[],n:0,busy:null,paused:false,stopping:false,shift:{left:0,total:0,n:0},deaths:0,last:null,guardT:0,guardMsg:null,autoKeys:new Set(),chromeDead:false,frames:0};
let latest=null,viewers=new Set(),casting=false,lastPoll=0;const waiters=new Set();
const watching=()=>viewers.size+(Date.now()-lastPoll<2500?1:0);

// ---------------------------------------------------------------- Chrome
const CHROME=[process.env.CHROME,'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','/Applications/Chromium.app/Contents/MacOS/Chromium','/usr/bin/google-chrome','/usr/bin/chromium'].filter(Boolean).find(p=>fs.existsSync(p));
if(!CHROME){console.error('Chrome not found. Set CHROME=/path/to/chrome');process.exit(1)}
const chromeDir=path.join(PROF,'chrome');if(FRESH)fs.rmSync(chromeDir,{recursive:true,force:true});fs.mkdirSync(chromeDir,{recursive:true});
const portFile=path.join(chromeDir,'DevToolsActivePort');fs.rmSync(portFile,{force:true});
let chromeProc=null,send,ev;
async function startChrome(){
  const flags=['--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+chromeDir,'--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--disable-features=CalculateNativeWinOcclusion,MacWebContentsOcclusion','--autoplay-policy=no-user-gesture-required'];
  if(!SOUND)flags.push('--mute-audio');
  // joined to a shared world when asked: the game page is told where the world server is and what this enclave is called (docs/MULTIPLAYER.md)
  const WORLD=arg('world',''),NAME=arg('name',''),url=`http://127.0.0.1:${PORT}/play/`+(WORLD&&WORLD!==true?`?world=${encodeURIComponent(WORLD)}&kind=bot&enclave=${encodeURIComponent(NAME&&NAME!==true?NAME:PROFILE)}`:'');
  if(WINDOW){
    // a real window, opened behind whatever you are doing (-g), as a bare app window; your clicks and keys in it are swallowed by the page shield
    flags.push(`--window-size=${W},${H+28}`,'--app='+url);
    if(process.platform==='darwin')spawn('open',['-g','-n','-a',path.resolve(CHROME,'../../..'),'--args',...flags],{stdio:'ignore',detached:true}).unref();
    else chromeProc=spawn(CHROME,flags,{stdio:'ignore'});
  }else chromeProc=spawn(CHROME,['--headless=new',`--window-size=${W},${H}`,...flags,'about:blank'],{stdio:'ignore'});
  for(let i=0;i<150&&!fs.existsSync(portFile);i++)await sleep(100);
  if(!fs.existsSync(portFile))throw new Error('Chrome did not start');
  const dport=fs.readFileSync(portFile,'utf8').split('\n')[0];
  let target;for(let i=0;i<80&&!target;i++){try{const list=await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json();target=list.find(t=>t.type==='page'&&(!WINDOW||t.url.startsWith(url)))||(!WINDOW&&list.find(t=>t.type==='page'))}catch(e){}if(!target)await sleep(150)}
  if(!target)throw new Error('no page in Chrome');
  const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((ok,no)=>{ws.addEventListener('open',ok);ws.addEventListener('error',no)});
  let id=0;const pending=new Map();
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.no(new Error(m.error.message)):p.ok(m.result)}else onCdp(m.method,m.params)});
  ws.addEventListener('close',()=>{S.chromeDead=true;for(const p of pending.values())p.no(new Error('Chrome went away'));pending.clear()});
  send=(method,params={})=>new Promise((ok,no)=>{if(S.chromeDead)return no(new Error('Chrome went away'));pending.set(++id,{ok,no});ws.send(JSON.stringify({id,method,params}))});
  ev=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw new Error('page: '+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text));return r.result.value};
  await send('Page.enable');await send('Runtime.enable');
  if(!WINDOW){await send('Emulation.setDeviceMetricsOverride',{width:W,height:H,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url})}
  try{await send('Emulation.setFocusEmulationEnabled',{enabled:true})}catch(e){}
  for(let i=0;i<100;i++){try{if(await ev('!!(window.__bot&&__bot.ready&&window.GW)'))break}catch(e){}await sleep(150)}
  if(!(await ev('!!(window.__bot&&__bot.ready&&window.GW)')))throw new Error('the game did not load in the bot browser');
  if(WINDOW)await ev('__bot.shield=true');
  if(PACE==='turns')await ev('GW.G.hold=true');
  META.version=await ev('GW.VERSION');META.browserPort=+dport;
}
function onCdp(method,p){
  if(method==='Runtime.exceptionThrown'){const d=p.exceptionDetails;pageError((d.exception&&d.exception.description||d.text)+' @'+(d.url||'').split('/').pop()+':'+d.lineNumber)}
  else if(method==='Runtime.consoleAPICalled'&&p.type==='error')pageError('console.error: '+p.args.map(a=>a.value!==undefined?a.value:a.description).join(' '));
  else if(method==='Page.screencastFrame'){send('Page.screencastFrameAck',{sessionId:p.sessionId}).catch(()=>{});push(Buffer.from(p.data,'base64'))}
}
function pageError(text){text=String(text).slice(0,1500);S.errors.push({at:Date.now(),text});autoBug('major','Page error: '+text.split('\n')[0].slice(0,140),text)}

// ---------------------------------------------------------------- picture: one JPEG stream for everyone watching
// Watchers get the picture one of two ways. The watch page asks for "the next frame after number N" over and over (plain fetches: this works in
// every browser); /live.mjpg is the same picture as one endless multipart stream for anything that prefers that.
const sendFrame=res=>{res.writeHead(200,{'content-type':'image/jpeg','cache-control':'no-store','x-frame':String(S.frames)});res.end(latest)};
function push(buf){latest=buf;S.frames++;for(const w of waiters){clearTimeout(w.t);try{sendFrame(w.res)}catch(e){}}waiters.clear();for(const res of viewers){try{res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${buf.length}\r\n\r\n`);res.write(buf);res.write('\r\n')}catch(e){}}}
async function cast(on){if(on===casting||S.chromeDead)return;casting=on;try{if(on)await send('Page.startScreencast',{format:'jpeg',quality:62,maxWidth:W,maxHeight:H,everyNthFrame:2});else await send('Page.stopScreencast')}catch(e){casting=false}}
async function shot(scale=1,quality=58){const r=await send('Page.captureScreenshot',{format:'jpeg',quality,...(scale!==1?{clip:{x:0,y:0,width:W,height:H,scale}}:{})});return Buffer.from(r.data,'base64')}
async function keepShot(){try{const b=await shot();const name=String(S.n).padStart(6,'0')+'.jpg';fs.writeFileSync(path.join(SD,'shots',name),b);if(!casting)push(b);return'shots/'+name}catch(e){return null}}

// ---------------------------------------------------------------- input: real events, the same ones a keyboard and mouse make
const gate=async()=>{if(WINDOW)await ev('__bot.gate(350)')};
const KEYS={down:['ArrowDown','ArrowDown',40],up:['ArrowUp','ArrowUp',38],esc:['Escape','Escape',27],escape:['Escape','Escape',27],tab:['Tab','Tab',9],space:[' ','Space',32],enter:['Enter','Enter',13],shift:['Shift','ShiftLeft',16]};
const keyDef=k=>{k=String(k).toLowerCase();if(KEYS[k])return KEYS[k];if(/^[a-z]$/.test(k))return[k,'Key'+k.toUpperCase(),k.toUpperCase().charCodeAt(0)];if(/^[0-9]$/.test(k))return[k,'Digit'+k,48+ +k];return null};
const held=new Set();let mouseDown=false,mouse={x:W/2,y:H/2},sneak=false;
async function keyDown(k){const d=keyDef(k);if(!d||held.has(d[1]))return;held.add(d[1]);await gate();await send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:d[0],code:d[1],windowsVirtualKeyCode:d[2]})}
async function keyUp(k){const d=keyDef(k);if(!d||!held.has(d[1]))return;held.delete(d[1]);await gate();await send('Input.dispatchKeyEvent',{type:'keyUp',key:d[0],code:d[1],windowsVirtualKeyCode:d[2]})}
async function press(k,ms=70){await keyDown(k);await sleep(ms);await keyUp(k)}
async function mouseTo(x,y){mouse={x,y};await gate();await send('Input.dispatchMouseEvent',{type:'mouseMoved',x,y,button:mouseDown?'left':'none',buttons:mouseDown?1:0})}
async function mousePress(button='left'){await gate();if(button==='left')mouseDown=true;await send('Input.dispatchMouseEvent',{type:'mousePressed',x:mouse.x,y:mouse.y,button,buttons:button==='left'?1:2,clickCount:1})}
async function mouseRelease(button='left'){await gate();if(button==='left')mouseDown=false;await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:mouse.x,y:mouse.y,button,buttons:0,clickCount:1})}
async function click(x,y,button='left'){await mouseTo(x,y);await mousePress(button);await sleep(50);await mouseRelease(button)}
async function releaseAll(){for(const code of[...held]){if(code==='ShiftLeft'&&sneak)continue;held.delete(code);const d=Object.values(KEYS).find(k=>k[1]===code)||[code.slice(-1).toLowerCase(),code,0];await gate();await send('Input.dispatchKeyEvent',{type:'keyUp',key:d[0],code,windowsVirtualKeyCode:d[2]}).catch(()=>{})}if(mouseDown)await mouseRelease().catch(()=>{})}
const WAYS={n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0],nw:[-1,-1],north:[0,-1],east:[1,0],south:[0,1],west:[-1,0],up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
async function steerKeys(dx,dy){const want=new Set();if(dx>.38)want.add('d');else if(dx<-.38)want.add('a');if(dy>.38)want.add('s');else if(dy<-.38)want.add('w');
  // stopping releases all four whether or not the tool thinks they are down: a key left down by a lost event kept the character walking after a goto
  if(!want.size){for(const k of['w','a','s','d']){const d=keyDef(k);if(!d)continue;held.delete(d[1]);await gate();await send('Input.dispatchKeyEvent',{type:'keyUp',key:d[0],code:d[1],windowsVirtualKeyCode:d[2]})}return}
  for(const k of['w','a','s','d'])if(want.has(k))await keyDown(k);else await keyUp(k)}

// ---------------------------------------------------------------- letting time pass, and noticing what should cut an action short
// every reading of the character also counts deaths, whenever they happen (a death while the model was thinking used to go uncounted)
const pulse=async()=>{const p=await ev('__bot.pulse()');if(p&&p.mode==='play'){if(p.dead&&!S.wasDead)S.deaths++;S.wasDead=!!p.dead}return p};
const hold=async v=>{if(PACE==='turns'||S.paused)await ev('GW.G.hold='+(v?'true':'false'))};
async function during(secs,o={}){
  const t0=Date.now(),p0=await pulse();let why=null,p=p0;
  while(Date.now()-t0<secs*1000){await sleep(90);p=await pulse();
    if(o.each){const r=await o.each(p,p0,(Date.now()-t0)/1000);if(r){why=r;break}}
    if(p.dead&&!p0.dead){why='you died';break}
    if(p.mode!==p0.mode){why='the screen changed ('+p.mode+')';break}
    if(p.sheet&&p.sheet!==p0.sheet){why='a sheet opened';break}
    if(p.zone!==p0.zone){why='you are somewhere else now';break}
    if(p.tide&&!p0.tide){why='THE TIDE HAS STARTED';break}
    if(p.tideSoon&&!p0.tideSoon){why='the tide is due within the hour';break}
    if(!o.fight&&p.hp<p0.hp-4){why='you are losing health ('+Math.round(p0.hp)+' → '+Math.round(p.hp)+')';break}
    if(!o.fight&&p.alertN>p0.alertN&&p.foe<8){why='something hostile has noticed you, '+p.foe+' tiles away';break}
    if(o.fight&&!o.flee&&p.hp<(p.max||100)*.4&&p.hp<p0.hp-1){why='HEALTH IS DOWN TO '+Math.round(p.hp)+' of '+Math.round(p.max||100)+': stop fighting. '+(p.meds?'Use medicine (`key 1`) and get clear, or `flee`.':'You have no medicine: `flee` now.');break}
  }
  return{why,p,p0,secs:(Date.now()-t0)/1000}}
const moved=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

// ---------------------------------------------------------------- commands
const num=(v,d)=>{const n=parseFloat(v);return Number.isFinite(n)?n:d};
const C={};
// the character glides a little after the keys come up (the game moves with inertia): wait until it has stopped before saying where it is, or the next
// look finds it somewhere else (a bot reported drifting after every walk)
const settle=async()=>{let last=await ev('(()=>{const p=GW.G.Z&&GW.G.Z.pl;return p?[p.x,p.y]:null})()');for(let k=0;k<8&&last;k++){await sleep(70);const now=await ev('(()=>{const p=GW.G.Z&&GW.G.Z.pl;return p?[p.x,p.y]:null})()');if(!now)return;if(Math.hypot(now[0]-last[0],now[1]-last[1])<.015)return;last=now}};
// English plurals for the names of things: Branches, Boxes, Bushes, Grass (not Grasss), Birches
const plural=n=>{const w=n.split(' '),l=w.pop();let p;if(/grass$/i.test(l)||(/s$/i.test(l)&&!/ss$/i.test(l)))p=l;else if(/(ss|x|z|ch|sh)$/i.test(l))p=l+'es';else if(/[^aeiou]y$/i.test(l))p=l.slice(0,-1)+'ies';else p=l+'s';return[...w,p].join(' ')};
C.look=async a=>({msg:'',full:a.includes('full')});
C.walk=async a=>{const way=WAYS[String(a[0]||'').toLowerCase()];if(!way)return{msg:'walk needs a direction: n ne e se s sw w nw (n is up the screen), then seconds'};const secs=clamp(num(a[1],1.5),.2,8);
  await steerKeys(way[0],way[1]);let mark=null,markT=0;
  const r=await during(secs,{each:(p,p0,t)=>{if(!mark){mark=p;markT=t}else if(t-markT>.9){if(moved(p,mark)<.25)return'blocked: something is in the way';mark=p;markT=t}}});
  await steerKeys(0,0);await settle();
  // say what is in the way, and that goto finds the way round: three reports read a wall as being stuck on nothing
  let why=r.why||'';if(/^blocked/.test(why)){const w=await ev(`__bot.whyBlocked(${way[0]},${way[1]})`).catch(()=>'');why='blocked by '+(w||'something in the way')+'. `walk` only goes in a straight line; `goto` a tile or a named thing finds the way round'}
  return{msg:`walked ${String(a[0]).toUpperCase()} ${moved(r.p,r.p0).toFixed(1)} tiles`+(why?' and stopped: '+why:'')}};
C.goto=async a=>{let tx,ty,name;if(a.length>=2&&Number.isFinite(parseFloat(a[0]))&&Number.isFinite(parseFloat(a[1]))){tx=parseFloat(a[0]);ty=parseFloat(a[1]);name=`(${tx}, ${ty})`}
  else{const f=await ev(`__bot.find(${JSON.stringify(a.join(' '))})`);if(!f)return{msg:`nothing called "${a.join(' ')}" is known here; use a name from the list, or goto X Y`};tx=f.x;ty=f.y;name=f.name+` at (${Math.floor(tx)}, ${Math.floor(ty)})`}
  if(!(await ev(`__bot.navTo(${tx},${ty})`)))return{msg:'that is outside this place'};
  let mark=null,markT=0,end=null;
  let face=null;
  const r=await during(22,{each:async(p,p0,t)=>{const s=await ev('__bot.steer()');if(s.done){end=s.done;face=s.face;return s.done}await steerKeys(s.dx/Math.max(.01,Math.hypot(s.dx,s.dy)),s.dy/Math.max(.01,Math.hypot(s.dx,s.dy)));
    if(!mark){mark=p;markT=t}else if(t-markT>1.2){if(moved(p,mark)<.25){end='stuck';return'stuck: not getting any closer'}mark=p;markT=t}}});
  await steerKeys(0,0);await settle();
  // end facing the thing walked to, with a nudge of the keys, so that E means it and not a neighbour
  if(end==='arrived'&&face){const l=Math.max(.01,Math.hypot(face[0],face[1]));await steerKeys(face[0]/l,face[1]/l);await sleep(70);await steerKeys(0,0);await sleep(60)}
  return{msg:end==='arrived'?`walked to ${name}`:`heading for ${name}, stopped after ${moved(r.p,r.p0).toFixed(1)} tiles: ${r.why||'ran out of time, call goto again'}`}};
C.leave=async a=>{const e=await ev('__bot.exitSpot()');if(!e)return{msg:'no way out found from here (walled in?)'};
  if(!(await ev(`__bot.navTo(${e.x},${e.y})`)))return{msg:'no way out found'};let mark=null,markT=0,end=null;
  const r=await during(25,{each:async(p,p0,t)=>{if(p.exit){end='edge';return'at the edge'}const s=await ev('__bot.steer()');if(s.done){end=s.done;return s.done}await steerKeys(s.dx/Math.max(.01,Math.hypot(s.dx,s.dy)),s.dy/Math.max(.01,Math.hypot(s.dx,s.dy)));
    if(!mark){mark=p;markT=t}else if(t-markT>1.2){if(moved(p,mark)<.25){end='stuck';return'stuck'}mark=p;markT=t}}});
  await steerKeys(0,0);return{msg:end==='edge'||end==='arrived'?`walked to the edge of this place at (${Math.floor(e.x)}, ${Math.floor(e.y)}): now press M or tap the LEAVE button`:`heading for the way out at (${Math.floor(e.x)}, ${Math.floor(e.y)}), stopped after ${moved(r.p,r.p0).toFixed(1)} tiles: ${r.why||'ran out of time, call leave again'}`}};
C.use=async a=>{const before=await ev(`(()=>{const e=document.getElementById('prompt');return e&&!e.hidden?[...e.childNodes].filter(n=>n.nodeName!=='KBD').map(n=>n.textContent).join('').trim():''})()`);await press('e');
  const r=await during(.5);if(r.why)return{msg:`pressed E (${before||'nothing was in reach'}): ${r.why}`};
  if(r.p.act){const r2=await during(clamp(num(a[0],10),1,25),{each:p=>p.act?null:'done'});return{msg:`pressed E (${before}) and kept at it for ${(r2.secs+.5).toFixed(1)} s`+(r2.why&&r2.why!=='done'?', stopped: '+r2.why:'')}}
  return{msg:`pressed E (${before||'nothing was in reach, so nothing happened'})`}};
C.attack=async a=>{
  // a click in build mode places a piece, not a blow: leave build mode first (as a player would press Esc)
  for(let k=0;k<2&&await ev('!!GW.G.build');k++){await press('esc');await sleep(120)}
  const secs=clamp(num(a[0],3),.3,12),hunt=a.includes('hunt');let quiet=0,navT=-9,walked=false,hit=false,name=null,stuck=null,mark=null,markT=0,tid=0;
  // fight like a person: nothing is swung at through a wall. Walk round to a foe that is out of reach or out of sight, then aim and hold the button.
  const r=await during(secs,{fight:true,each:async(p,p0,t)=>{const f=await ev(`__bot.fight(${tid},${hunt})`);if(f)tid=f.id;
    if(!f){if(mouseDown)await mouseRelease();await steerKeys(0,0);return ++quiet>5?'nothing left to fight':null}quiet=0;name=name||f.name;
    if(f.blocked||f.d>f.reach){if(mouseDown)await mouseRelease();walked=true;if(t-navT>.5){navT=t;await ev(`__bot.navTo(${f.x},${f.y})`)}const s=await ev('__bot.steer()');
      if(s.done==='no way there'||s.done==='lost'){stuck='there is no way round to the '+f.name+' from here (it is behind a wall)';return stuck}
      if(!s.done){const l=Math.max(.01,Math.hypot(s.dx,s.dy));await steerKeys(s.dx/l,s.dy/l)}
      if(!mark){mark=p;markT=t}else if(t-markT>1.5){if(moved(p,mark)<.25){stuck='cannot get any closer to the '+f.name;return stuck}mark=p;markT=t}
      // at home in a tide, the walls are the defence: no chasing more than a few steps from where the fight began (a bot followed a gunman out of its yard into the tide)
      if(p.home&&p.tide&&moved(p,p0)>4){stuck='the '+f.name+' is drawing you away from your walls in a tide: stopped after 4 tiles. Let it come to you, or `attack` again only if you mean to leave the yard';return stuck}
      if(moved(p,p0)>30){stuck='the way round to the '+f.name+' is long: stopped after 30 tiles, call attack again to keep going';return stuck}return null}
    await steerKeys(0,0);mark=null;const sc=await ev(`__bot.screen(${f.x},${f.y},.6)`);await mouseTo(clamp(sc.x,4,W-4),clamp(sc.y,4,H-4));if(!mouseDown)await mousePress();hit=true;return null}});
  if(mouseDown)await mouseRelease();await steerKeys(0,0);
  return{msg:(name?(hit?`fought the ${name} for ${r.secs.toFixed(1)} s`+(walked?' (closing in first)':''):`went after the ${name} for ${r.secs.toFixed(1)} s without getting a blow in`):`nothing is coming at you, so nothing was attacked`)+(r.why?': '+r.why:'')+(await ev('__bot.unaware()').then(n=>n&&!hunt?` — ${n} nearby ${n>1?'have':'has'} not noticed you; attack with hunt set goes after them, one at a time is wiser`:''))}};
// Run for it: Auto off, straight for the way out that is nearest and farthest from them, without stopping for blows, and out through it.
C.flee=async()=>{
  const t=await ev('__bot.fleeTo()');if(!t)return{msg:(await pulse()).home?'nothing hostile is close: you are safe where you are. Heal (`key 1`), eat and drink, and catch your breath':'there is no way out of here on foot'};
  let p=await pulse();if(p.auto){await press('f');S.autoOffT=Date.now()}
  // at home: run from them, keep running for a few seconds (heal on the way), then say where things stand
  if(t.home){const run=async()=>{const s=await ev('__bot.fleeTo()');if(!s)return null;await ev(`__bot.navTo(${s.x},${s.y})`);return s};let s=t;await ev(`__bot.navTo(${s.x},${s.y})`);let lastT=0,healed=false;
    const r=await during(7,{fight:true,flee:true,each:async(p,p0,tt)=>{if(!healed&&p.hp<(p.max||100)*.5&&p.meds){healed=true;await press('1')}if(tt-lastT>1.2){lastT=tt;s=await run();if(!s)return'clear of them'}const st=await ev('__bot.steer()');if(st.done)return null;await steerKeys(st.dx/Math.max(.01,Math.hypot(st.dx,st.dy)),st.dy/Math.max(.01,Math.hypot(st.dx,st.dy)));return null}});
    await steerKeys(0,0);p=r.p;if(p.dead)return{msg:'ran from them and did not make it: you died'};
    const tideOn=await ev('!!(GW.G.S.tide&&GW.G.S.tide.live)').catch(()=>false);
    return{msg:`ran from them for ${r.secs.toFixed(1)} s, health ${Math.round(p.hp)}${tideOn?'. IT IS A TIDE: do not keep running, it only bleeds you outside your walls. Heal (`key 1`) and `auto on` inside the yard; your people and traps fight with you.':r.why==='clear of them'?': nothing is close now. Catch your breath, heal, then go back to the fight with Auto (`key f`)':'. They are still after you: call flee again to keep running, heal (`key 1`), or turn and fight with `attack` if they are few'}`}}
  await ev(`__bot.navTo(${t.x},${t.y})`);let end=null;
  const r=await during(30,{fight:true,flee:true,each:async p=>{if(p.exit){end='out';return'at the edge'}const s=await ev('__bot.steer()');if(s.done&&s.done!=='arrived'){end=s.done;return s.done}if(s.done){end='out';return'at the edge'}await steerKeys(s.dx/Math.max(.01,Math.hypot(s.dx,s.dy)),s.dy/Math.max(.01,Math.hypot(s.dx,s.dy)));return null}});
  await steerKeys(0,0);p=r.p;if(p.dead)return{msg:'ran for the edge and did not make it: you died'};
  if(end!=='out')return{msg:`ran ${moved(r.p,r.p0).toFixed(1)} tiles toward the way out and stopped: ${r.why||'out of time, call flee again'}`};
  await sleep(150);await press('m');const r2=await during(1.2,{fight:true,flee:true});
  return{msg:r2.p.mode==='map'||r2.p.zone!==r.p0.zone?`got away with ${Math.round(r2.p.hp)} health. The map is open: tap your Homestead and Travel to go home and mend (the road heals you on the way).`:`reached the edge with ${Math.round(r2.p.hp)} health, but could not leave: ${r2.why||'press `key m` or tap the Leave button'}`}};
C.dodge=async a=>{const way=WAYS[String(a[0]||'').toLowerCase()];if(way)await steerKeys(way[0],way[1]);await sleep(60);await press('space');const r=await during(.6,{fight:true});await steerKeys(0,0);return{msg:'rolled'+(way?' '+String(a[0]).toUpperCase():'')+(r.why?': '+r.why:'')}};
C.sneak=async a=>{sneak=String(a[0]).toLowerCase()!=='off';if(sneak)await keyDown('shift');else await keyUp('shift');return{msg:'sneaking '+(sneak?'on (slower, harder to notice)':'off')}};
// Auto mode by intent, not by toggle: the session sometimes switches it on while the model is thinking, and a bot pressing F to turn it ON turned it OFF in the
// middle of a tide and died. `auto on` / `auto off` set it; `key f` right after the session switched it on is taken as "on".
C.auto=async a=>{const want=String(a[0]||'on').toLowerCase()!=='off';const p=await pulse();if(!!p.auto===want)return{msg:'Auto mode is already '+(want?'ON':'OFF')};
  if(!want&&p.alertN>0&&p.foe<6&&p.hp<(p.max||100)*.6)return{msg:'NOT NOW: something is '+p.foe+' tiles away and your health is '+Math.round(p.hp)+'. Auto is fighting for you; turn it off once they are dealt with, or `flee`.'};
  await press('f');const r=await during(.45);if(!want)S.autoOffT=Date.now();else S.autoOffT=0;
  // Auto switches itself off at once when there is nothing it can do (nothing to gather here, a full pack): say why, from what the game said
  let why='';if(want&&!r.p.auto)why=await ev(`(__bot.msgs||[]).slice(-3).map(m=>m.t||m).filter(t=>/Auto/.test(t)).pop()||''`).catch(()=>'');
  return{msg:'Auto mode is now '+(r.p.auto?'ON':'OFF')+(why?` (the game switched it straight off: "${why}". Auto fights only what comes at you and otherwise gathers; with nothing to gather or a full pack it stops)`:'')+(r.why?': '+r.why:'')}};
C.key=async a=>{if(String(a[0]).toLowerCase()==='f'&&Date.now()-(S.guardT||0)<20000){const p=await pulse();if(p.auto)return{msg:'Auto mode is ALREADY ON: the session switched it on a moment ago because something hostile came close. Use `auto off` if you really want it off.'}}
  if(!keyDef(a[0]))return{msg:'unknown key "'+a[0]+'". Keys: i c b j l m f q r e 1 2 3 4 esc tab space enter'};await press(a[0]);const r=await during(clamp(num(a[1],.45),.2,5));
  // the bot switching Auto off is a decision: the guardian leaves it off for a while (unless the character is badly hurt), and the result says which way it went
  let auto='';if(String(a[0]).toLowerCase()==='f'&&r.p){auto=r.p.auto?' (Auto mode is now ON)':' (Auto mode is now OFF; it stays off for the next 45 seconds unless you are badly hurt, so fight with `attack`)';S.autoOffT=r.p.auto?0:Date.now()}
  return{msg:'pressed '+String(a[0]).toUpperCase()+auto+(r.why?': '+r.why:'')}};
C.tap=async a=>{let n=parseInt(a[0]);
  if(!(n>0)){const q=a.join(' ');n=await ev(`(__bot.observe(),__bot.byText(${JSON.stringify(q)}))`);if(n===0)return{msg:`nothing clickable is labelled "${q}" right now: look again`};if(n<0)return{msg:`several clickable things contain "${q}": be more exact (include the row name, e.g. "MAKE — Stone Pickaxe"), or use its number`}}
  let t=await ev(`__bot.target(${n})`);if(!t)return{msg:`there is no clickable thing numbered ${a[0]} any more: look again`};
  // a bot once read 'start again in a new valley' as 'start a new game' and wiped a level 16 character: with a save on file, the title's New game is refused
  if(!FRESH&&/^(new game|start over)/i.test(String(t.label||''))&&await ev('GW.api.hasSave()'))return{msg:'NOT ALLOWED: you have a saved game. Tap CONTINUE. Starting a new game would wipe your character, homestead and place in the world.'};
  // a choice in a drop-down: give the list the keyboard (Tab from the element before it, as a person would) and step to the choice with the arrow keys
  if(t.opt){const before=await ev(`(()=>{const el=__bot.els[${n}-1];return el.sel.value})()`);await ev(`(()=>{const el=__bot.els[${n}-1];el.sel.focus();return true})()`);
    // type the start of the choice's name (a closed list jumps to what is typed), then Tab away so the choice is taken
    const word=t.label.replace(/^choose /,'').toLowerCase().replace(/[^a-z]/g,'');for(const ch of word.slice(0,4)){await press(ch,30);await sleep(30)}await press('tab');await sleep(250);
    const after=await ev(`(()=>{const el=__bot.els[${n}-1];return document.contains(el.sel)?el.sel.value:'(redrawn)'})()`);return{msg:`${t.label}: ${after!==before?'chosen':'the choice did not take: look again'}`}}
  // a place on the map that sits under the info card or off the edge: drag the map, as a person would, until the pin is in the open
  for(let k=0;k<3&&t.spot&&(t.covered||t.x<40||t.x>W-40||t.y<70||t.y>H-40);k++){const dx=clamp(W/2-t.x,-360,360),dy=clamp(H*.36-t.y,-260,260);await mouseTo(W/2,H*.4);await mousePress();for(let i=1;i<=8;i++){await mouseTo(W/2+dx*i/8,H*.4+dy*i/8);await sleep(30)}await mouseRelease();await sleep(200);t=await ev(`__bot.target(${n})`)||t}
  await sleep(120);const t2=await ev(`__bot.target(${n})`)||t;
  await click(clamp(t2.x,2,W-2),clamp(t2.y,2,H-2));
  // places drawn on top of each other: the game steps to the next one under the finger on each tap, so tap again until the one asked for is chosen
  if(t.spot){const want=t.spot.name||t.label.replace(/^place on the map:\s*/,'').replace(/\s*\(RADIO LEAD\)$/,'');for(let k=0;k<4&&(await ev('__bot.mapSel()'))!==want;k++){await sleep(150);await click(clamp(t2.x,2,W-2),clamp(t2.y,2,H-2))}}
  const r=await during(.5);return{msg:`clicked "${t.label}"`+(t.disabled?' (it is greyed out)':'')+(r.why?': '+r.why:'')}};
C.click=async a=>{const x=num(a[0],-1),y=num(a[1],-1);if(x<0||y<0||x>W||y>H)return{msg:`click needs page pixels inside ${W}×${H}`};await click(x,y,a[2]==='right'?'right':'left');const r=await during(.45);return{msg:`clicked at ${x}, ${y}`+(r.why?': '+r.why:'')}};
const SIDE={n:[0,-.34],e:[.34,0],s:[0,.34],w:[-.34,0]};   // (not nearer the boundary than that: at .42 a click could land in the next cell, and the wall on its far side)
// how much stands at home, so a build click can say whether anything was actually placed or removed
const builtCount=()=>ev(`(()=>{const Z=GW.G.Z;if(!Z||!Z.home)return null;let e=0,o=0,f=0;for(const w of Z.ed)if(w)e++;for(const q of Z.obj)if(q&&q.hp>0)o++;for(const k of Z.fl)if(k)f++;
  // what stands where (kind and facing, by name and tile), so an upgrade, a move or a turn can be named even though nothing was added or taken away
  const W=Z.w,O=(window.__bot&&__bot.OBJ)||{},nm=k=>(O[k]&&O[k].n)||k,m={};Z.ed.forEach((w,i)=>{if(!w)return;const t=i>>1,x=t%W,y=(t-x)/W;m['e'+i]=[nm(w.k),x,y,i&1?'W':'N']});Z.obj.forEach((q,i)=>{if(q&&q.hp>0){const x=i%W,y=(i-x)/W;m['o'+i]=[nm(q.k)+(q.r?' (turned '+q.r+')':''),x,y,'']}});return[e,o,f,m]})()`);
const builtDelta=(a,b)=>{if(!a||!b)return'';const d=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],names=['wall or door piece','structure','floor tile'],out=[];d.forEach((n,i)=>{if(n)out.push((n>0?'+':'')+n+' '+names[i]+(Math.abs(n)>1?'s':''))});
  const ch=[];for(const k in b[3]){const x=a[3][k],y=b[3][k];if(x&&x[0]!==y[0])ch.push(`${x[0]} → ${y[0]} at (${y[1]}, ${y[2]})${y[3]?' '+y[3]+' side':''}`)}
  const said=ch.length?' — changed: '+ch.slice(0,8).join('; ')+(ch.length>8?` and ${ch.length-8} more`:''):'';
  return out.length?' — placed/removed: '+out.join(', ')+said:said||' — nothing was placed, removed or changed'};
const tileXY=async(x,y,side)=>{const o=SIDE[String(side||'').toLowerCase()]||[0,0];return ev(`__bot.screen(${Math.floor(x)+.5+o[0]},${Math.floor(y)+.5+o[1]},0)`)};
const needBuild=async()=>(await ev('!!GW.G.build'))?null:{msg:'build mode is not open (it closes on Esc or Done): press `key b` first. Clicking the ground outside build mode swings your weapon.'};
C.tile=async a=>{const nb=await needBuild();if(nb)return nb;const x=num(a[0],NaN),y=num(a[1],NaN);if(!(x>=0&&y>=0))return{msg:'tile needs X Y (and optionally a side n e s w for walls)'};const s=await tileXY(x,y,a[2]);
  if(!s.on||s.y>H-8)return{msg:`tile (${x}, ${y}) is not on the screen: walk closer first`};const cover=await ev(`(()=>{const e=document.elementFromPoint(${s.x},${s.y});return e&&e.id!=='cv'?(e.id||e.className||e.tagName):''})()`);
  if(cover)return{msg:`tile (${x}, ${y}) is hidden behind the interface (${cover}) at this camera position: walk so it is nearer the middle of the screen`};
  // a side named with upgrade, repair or remove means that wall: if there is none, the click would land on whatever stands in the cell (a bot upgraded its
  // storage box into a chest that way), so say so instead of clicking
  if(a[2]){const chk=await ev(`(()=>{const B=GW.UI&&GW.G.build,Z=GW.G.Z;if(!B||!Z)return null;const t=document.querySelector('#btool button.on[data-b^="tool:"]');const tool=t?t.dataset.b.slice(5):'';if(!/upgrade|repair|remove/.test(tool))return null;const sd={n:0,e:1,s:2,w:3}[${JSON.stringify(String(a[2]).toLowerCase())}];const W=Z.w,x=${Math.floor(x)},y=${Math.floor(y)},e=sd===0?(y*W+x)*2:sd===2?((y+1)*W+x)*2:sd===3?(y*W+x)*2+1:(y*W+x+1)*2+1;return Z.ed[e]?null:tool})()`).catch(()=>null);
    if(chk)return{msg:`there is no wall or door on the ${String(a[2]).toUpperCase()} side of tile (${x}, ${y}), so the ${chk} tool would act on whatever stands in that cell instead. Check the build list for where your walls stand, and name the cell and side the wall is on (a wall between two cells is the E side of one and the W side of the other).`}}
  const n0=await builtCount();await click(s.x,s.y);const r=await during(.45),n1=await builtCount();
  return{msg:`clicked the ground at tile (${x}, ${y})${a[2]?' on its '+a[2].toUpperCase()+' side':''}`+builtDelta(n0,n1)+(r.why?': '+r.why:'')}};
C.dragtile=async a=>{const nb=await needBuild();if(nb)return nb;const[x1,y1,x2,y2]=a.slice(0,4).map(v=>num(v,NaN));if([x1,y1,x2,y2].some(v=>!(v>=0)))return{msg:'dragtile needs X1 Y1 X2 Y2 (and optionally a side)'};const s1=await tileXY(x1,y1,a[4]),s2=await tileXY(x2,y2,a[4]);
  if(!s1.on||!s2.on)return{msg:'both ends must be on the screen: see "Ground you can click right now" in build mode and stand nearer the middle of what you are building'};
  const n0=await builtCount();await mouseTo(s1.x,s1.y);await mousePress();const steps=Math.max(14,Math.round(Math.hypot(x2-x1,y2-y1)*4));for(let i=1;i<=steps;i++){await mouseTo(s1.x+(s2.x-s1.x)*i/steps,s1.y+(s2.y-s1.y)*i/steps);await sleep(40)}await mouseRelease();const r=await during(.45),n1=await builtCount();
  return{msg:`dragged from tile (${x1}, ${y1}) to (${x2}, ${y2})`+builtDelta(n0,n1)+(r.why?': '+r.why:'')}};
C.scroll=async a=>{const dy=num(a[0],300);const at=await ev(`(()=>{const e=document.getElementById('pb');const s=document.getElementById('shade');if(s&&!s.hidden){const r=e.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]}return[${W/2},${H/2}]})()`);
  await mouseTo(at[0],at[1]);await gate();await send('Input.dispatchMouseEvent',{type:'mouseWheel',x:at[0],y:at[1],deltaX:0,deltaY:dy});await during(.3);return{msg:'scrolled '+(dy>0?'down':'up')}};
C.wait=async a=>{const secs=clamp(num(a[0],5),.5,30);if(S.paused){await sleep(secs*1000);return{msg:'the person watching has paused the session; waited '+secs+' s of real time'}}const r=await during(secs);return{msg:`let ${r.secs.toFixed(1)} s pass`+(r.why?', then: '+r.why:'')}};
C.shot=async()=>({msg:'picture taken',image:true});
// ---- writing things down (no game time passes)
C.note=async a=>{const t=a.join(' ').trim();if(!t)return{msg:'note needs some text'};fs.appendFileSync(path.join(SD,'journal.md'),`- ${new Date().toTimeString().slice(0,8)} ${t}\n`);return{msg:'noted',free:true}};
C.notebook=async a=>{const t=a.join(' ').trim();if(!t)return{msg:fs.existsSync(NOTEBOOK)?'Your notebook:\n'+fs.readFileSync(NOTEBOOK,'utf8'):'Your notebook is empty.',free:true};fs.writeFileSync(NOTEBOOK,t.slice(0,6000)+'\n');fs.writeFileSync(path.join(SD,'notebook.md'),t.slice(0,6000)+'\n');return{msg:'notebook saved ('+Math.min(6000,t.length)+' characters). It replaces what was there and is what you will be handed next shift.',free:true}};
C.bug=async a=>{const sev=['minor','major','blocker'].includes(String(a[0]).toLowerCase())?a.shift().toLowerCase():'minor',t=a.join(' ').trim();if(t.length<12)return{msg:'bug needs: severity (minor|major|blocker), then a title, then " :: " and what you did, what you expected, what happened'};
  const[title,...rest]=t.split('::');const b=await fileBug('bot',sev,title.trim(),rest.join('::').trim());return{msg:`filed as bug ${b.id} with a picture, the save and your last moves attached`,free:true}};
C.idea=async a=>{const t=a.join(' ').trim();if(t.length<8)return{msg:'idea needs some text'};const o={id:S.ideas.length+1,at:new Date().toISOString(),n:S.n,text:t,where:S.last&&S.last.zone?S.last.zone.name:null};S.ideas.push(o);jl('ideas.jsonl',o);return{msg:'idea '+o.id+' recorded',free:true}};
const MOVES=new Set(['walk','goto','leave','use','attack','dodge','flee','tile','dragtile']);   // (auto and key work with a sheet open too)
const TIMELESS=new Set(['look','shot','note','notebook','bug','idea']);
// writing while something is hitting you: in live pace the world does not wait, and bots died typing notes and bug reports in the middle of a tide
const WRITING=new Set(['note','notebook','bug','idea']);

// ---------------------------------------------------------------- bug reports: every one carries the evidence needed to reproduce it
async function fileBug(source,severity,title,details){
  // a report sent without a title gets the start of what it says (one arrived titled "undefined")
  if(!title||title==='undefined'){const d=String(details||'').trim();title=(d.split(/[.:\n]/)[0]||'Untitled report').slice(0,110)}
  const id=S.bugs.length+1,dir=path.join('bugs',String(id).padStart(3,'0'));fs.mkdirSync(path.join(SD,dir),{recursive:true});
  const b={id,at:new Date().toISOString(),n:S.n,source,severity,title:title.slice(0,200),details:(details||'').slice(0,3000),dir};S.bugs.push(b);
  try{fs.writeFileSync(path.join(SD,dir,'shot.jpg'),await shot(1,70))}catch(e){}
  try{fs.writeFileSync(path.join(SD,dir,'state.json'),JSON.stringify(await ev('__bot.observe(true)'),null,1))}catch(e){}
  try{const sv=await ev(`GW.G.S&&GW.G.mode!=='menu'?GW.api.exportSave():''`);if(sv)fs.writeFileSync(path.join(SD,dir,'save.json'),sv)}catch(e){}
  fs.writeFileSync(path.join(SD,dir,'events.json'),JSON.stringify(S.events.slice(-40),null,1));
  fs.writeFileSync(path.join(SD,dir,'report.md'),`# Bug ${id}: ${b.title}\n\n- severity: ${severity}\n- reported by: ${source}\n- when: ${b.at} (action ${S.n})\n- game: ${META.version} at commit ${META.commit}${META.dirty?' plus uncommitted changes':''}\n\n${b.details||'(no details)'}\n\nFiles here: shot.jpg (the screen), state.json (what the bot could see), save.json (load it with Menu → Export / import to stand where the bot stood), events.json (the last 40 moves).\n`);
  jl('bugs.jsonl',b);return b}
const autoSeen=new Set();
function autoBug(sev,title,details){const key=title.replace(/\d+/g,'#');if(autoSeen.has(key))return;autoSeen.add(key);fileBug('session',sev,title,details).catch(()=>{})}

// ---------------------------------------------------------------- what the player can see, as text
function describe(o){
  const L=[],y=o.you;
  if(o.mode==='menu'||o.layer==='title'){L.push(`== Graywake ${o.version} · title screen`);if(o.text)L.push(o.text)}
  else{L.push(`== ${o.zone?o.zone.name+(o.zone.home?' (your homestead)':''):o.mode==='map'?'The map':'Graywake'} · ${(o.clock||'').replace(/\n/g,' · ')} · ${o.tide||''}`+(o.boss?' · BOSS '+o.boss.replace(/\n/g,' '):''));
    if(y)L.push(`You: health ${y.hp}/${y.maxHp}, food ${y.food}, water ${y.water}${y.tox?', toxin '+y.tox:''} · level ${y.level}${y.perkPoints?' ('+y.perkPoints+' perk point'+(y.perkPoints>1?'s':'')+' to spend)':''} · in hand: ${y.weapon}${y.spare?' (spare: '+y.spare+')':''} · pack holds ${y.pack} stacks`+(y.at?` · at (${y.at[0]}, ${y.at[1]}), ${y.dead?'DEAD':y.doing}${y.sneaking?', sneaking':''}`:'')+` · Auto ${y.auto?'ON':'off'}${y.build?' · BUILD MODE':''}`);
    if(o.blocked&&o.blocked.length)L.push('!! Cannot be walked to from your door: '+o.blocked.join(', ')+'. Furniture walls them off: use Build, Move on a bed, fire or box to open a path.');
    if(o.yard)L.push((o.yard.startsWith('OPEN')?'!! ':'')+'Your yard: '+o.yard);
    if(o.people){const q=o.people;L.push(`People: ${q.surv.length?q.surv.join(', '):'nobody but you'} · ${q.surv.length} of ${q.room} places taken${q.surv.length>=q.room?' (FULL: a homestead supports at most three people besides you)':''}`+(q.wait.length?`\n!! ${q.wait.join(', ')} ${q.wait.length>1?'are':'is'} WAITING AT YOUR FENCE to join. Open the Camp ledger (key l) at home, People, and take them in`+(q.surv.length>=q.room?' (build a bed first: Build, Base)':'')+'. They leave after a few days.':'')+(q.idle?`\n!! ${q.idle} of your people ${q.idle>1?'are':'is'} idle. Give each a job in the Camp ledger (key l), People: mechanic, farmer, cook, medic or guard.`:''))}
    if(o.world){const w=o.world;L.push(`World ${w.name} (stage: ${w.stage}, tides ×${w.tide}): your enclave's hold is ${w.hold} of 100, score ${w.score}, place ${w.rank} of ${w.of}. Rivals: ${w.rivals.join('; ')}.`+(w.news.length?` News: ${w.news.join(' | ')}`:'')+(w.hold<30?' !! YOUR HOLD IS LOW: at 0 the enclave falls and you start again in another valley. Hold the next tide at your walls and do not die.':''))}
    if(y&&!y.dead&&y.hp<y.maxHp*.4)L.push(`!! HEALTH ${y.hp}/${y.maxHp}: do not fight on. Heal (key 1) if you carry medicine and get clear, otherwise \`flee\`.`);
    if(y&&y.wearing)L.push(`Wearing (armour ${y.armour}): ${y.wearing}`+(y.better&&y.better.length?`\n!! BETTER GEAR IS IN YOUR PACK: ${y.better.join('; ')}. Open the pack (key i) and tap "Wear best".`:'')+(y.canMake&&y.canMake.length?`\n!! YOU CAN MAKE BY HAND RIGHT NOW (key c): ${y.canMake.join(', ')}. Clothes go on by themselves when made.`:''));
    if(o.buffs)L.push('Effects: '+o.buffs.replace(/\n/g,', '));
    if(o.quest)L.push('Quest tracker: '+o.quest.replace(/\n+/g,' · '))}
  if(o.zone&&o.mode==='play'){
    if(o.prompt)L.push('In reach — E would: '+o.prompt.replace(/\n/g,' '));
    if(o.leave)L.push('You are at the edge of this place: the "'+o.leave+'" button is showing (or press M).');
    if(o.foes&&o.foes.length)L.push('HOSTILE: '+o.foes.map(f=>`${f.boss?'BOSS ':''}${f.name} ${f.dist} tiles ${f.dir} at (${f.x}, ${f.y}), health ${f.hp}%, ${f.state}`).join(' | '));
    if(o.others&&o.others.length)L.push('Also here: '+o.others.map(f=>`${f.name} (${f.kind}) ${f.dist} ${f.dir}`).join(' | '));
    if(o.drops&&o.drops.length)L.push('Loose on the ground: '+o.drops.map(d=>`${d.what||'loot'} ${d.dist} ${d.dir} at (${d.x}, ${d.y})`).join(' | '));
    if(o.things&&o.things.length){L.push('Around you (tile x,y; N is up the screen). One line per kind of thing: the NEAREST one, and how many more of that kind are about:');for(const t of o.things)L.push(`  ${t.name} — ${t.dist} tiles ${t.dir} at (${t.x}, ${t.y})${t.act?' — '+t.act:''}${t.yours?' (you built it)':''}${t.n>1?` [${t.n-1} more ${t.n>2?plural(t.name):t.name} elsewhere in this place]`:''}`)}
    else L.push('Nothing to use, search or gather within ten tiles.');
    if(o.blds&&o.blds.length)L.push(`Buildings in this place (${o.blds.length}): `+o.blds.map(b=>`${b.dist} tiles ${b.dir}, tiles (${b.x0},${b.y0}) to (${b.x1},${b.y1})${b.door?`, door at (${b.door[0]}, ${b.door[1]})`:''}${b.loot?`, ${b.loot} thing${b.loot>1?'s':''} to search inside`:', searched'}`).join('; '));
    if(o.doorways&&o.doorways.length)L.push((o.zone.home?'Your doors: ':'Doorways into buildings: ')+o.doorways.map(d=>`${d.dist} tiles ${d.dir}, between (${d.side==='N'?d.x+', '+(d.y-1):(d.x-1)+', '+d.y}) and (${d.x}, ${d.y})`).join(' | '));
    if(o.yours&&o.yours.length)L.push('Where your wall and door pieces stand (a piece on the south side of a cell is listed as the north side of the cell below it, east as the west side of the next column): '+o.yours.join(' · '));
    if(o.walls)L.push(`Wall and door pieces you have standing in the whole homestead (not only what is on screen): ${o.walls}.`)}
  if(o.layer==='build')L.push('BUILD MODE is open. '+(o.buildInfo||'')+(o.buildView?` Ground you can click right now: x ${o.buildView.x0} to ${o.buildView.x1}, y ${o.buildView.y0} to ${o.buildView.y1} (walk to move this window).`:'')+' Pick a tool and a piece from the numbered list, then click the ground with `tile X Y` (walls and doors: `tile X Y n|e|s|w` for the side of the cell, `dragtile` for a line). Esc or Done leaves.');
  if(o.sheet){L.push(`SHEET OPEN: "${o.sheet.title}" — the world is paused while it is open; Esc closes it.`);if(o.sheet.text)L.push(o.sheet.text)}
  if(o.layer==='map'&&o.text)L.push('MAP SCREEN. '+o.text);
  if(o.els&&o.els.length){L.push('Clickable now (`tap N`):');let row='';for(const e of o.els){const s=`[${e.n}] ${e.label}${e.flags.length?' {'+e.flags.join(', ')+'}':''}`;if(row.length+s.length>150){L.push('  '+row);row=s}else row+=(row?'   ':'')+s}if(row)L.push('  '+row)}
  if(o.msgs&&o.msgs.length)L.push('The game said: '+o.msgs.map(m=>(m.kind==='got'?'picked up ':m.kind==='banner'?'BANNER ':'')+m.t.replace(/\s+/g,' ')).join(' | '));
  return L.join('\n')}

// ---------------------------------------------------------------- running one command
let chain=Promise.resolve();
const run=(name,args,who)=>{const p=chain.then(()=>exec(name,args||[],who||'bot'));chain=p.catch(()=>{});return p};
async function exec(name,args,who){
  name=String(name||'').toLowerCase();const fn=C[name];
  if(!fn)return{text:'Unknown command "'+name+'". Commands: '+Object.keys(C).join(', ')};
  if(S.chromeDead)return{text:'The bot browser is gone; the session has to be restarted.'};
  const game=!TIMELESS.has(name);
  if(game&&who==='bot'){
    if(S.stopping)return{text:'SESSION ENDING. Save what you learned with `notebook`, then stop.'};
    if(S.shift.total&&S.shift.left<=0)return{text:'SHIFT OVER. Save what you learned with `notebook` (it replaces the old one), then stop calling tools and say DONE.'};
    if(S.paused&&name!=='wait')return{text:'The person watching has paused the session. Call `wait 20` and try again; meanwhile nothing in the game moves.'};
  }
  if(WRITING.has(name)&&who==='bot'&&PACE==='live'&&!(name==='notebook'&&!args.length)&&!S.stopping&&!(S.shift.total&&S.shift.left<=3)){const p=await pulse().catch(()=>null);if(p&&p.mode==='play'&&!p.dead&&p.alertN>0&&p.foe<7)return{text:`NOT NOW: something hostile is ${p.foe} tiles away and the world does not wait while you write. Deal with it first (\`attack\`, \`flee\`, \`key 1\` to heal, or \`key f\` for Auto), then write. Health ${Math.round(p.hp)}.`}}
  const t0=Date.now();S.busy={cmd:name+' '+args.join(' '),since:t0,who};let r;
  try{if(game)await hold(false);
    const blocked=MOVES.has(name)&&await ev(`(()=>{const s=document.getElementById('shade');return s&&!s.hidden?document.querySelector('#panel .ttl').textContent:(GW.G.mode==='map'?'the map':'')})()`);
    r=blocked?{msg:`cannot ${name}: ${blocked==='the map'?'the map screen is open':'the sheet "'+blocked+'" is open and the world is paused'}. Close it first (key esc) or use what is on it.`}:await fn(args.map(String));}
  catch(e){r={msg:'the command failed inside the session: '+e.message};if(!/Chrome went away/.test(e.message))autoBug('major','Session command failed: '+name,String(e.stack||e))}
  finally{try{await releaseAll();if(game)await hold(true)}catch(e){}}
  if(!r.free){S.n++;if(who==='bot'&&game&&S.shift.total)S.shift.left--}
  let o=null,text=r.msg||'';
  try{o=await ev(`__bot.observe(${r.full?'true':'false'})`);S.last=o;for(const bad of await ev('__bot.check()'))autoBug('major','Broken state: '+bad.slice(0,120),bad)}catch(e){text+='\n(could not read the screen: '+e.message+')'}
  if(o&&!r.free)text=(text?'» '+text+'\n':'')+describe(o);
  if(S.guardMsg&&who==='bot'){text+='\n'+S.guardMsg;S.guardMsg=null}
  const errs=S.errors.filter(e=>!e.told);if(errs.length){text+='\nThe page reported an error (already filed as a bug by the session): '+errs.map(e=>e.text.split('\n')[0]).join(' | ');errs.forEach(e=>e.told=true)}
  if(who==='bot'&&S.hints.some(h=>!h.told)){for(const h of S.hints)if(!h.told){text+='\nMESSAGE FROM THE DEVELOPER WATCHING: '+h.text;h.told=true}}
  if(who==='bot'&&game&&S.shift.total&&S.shift.left===5)text+='\n(Five moves left in this shift. Start writing your notebook.)';
  if(who==='bot'&&game&&S.shift.total&&S.shift.left<=0)text+='\nSHIFT OVER. Save what you learned with `notebook`, then stop calling tools and say DONE.';
  const file=r.free?null:await keepShot();
  const evt={n:S.n,at:new Date().toISOString(),who,cmd:name,args,ms:Date.now()-t0,result:(r.msg||'').slice(0,300),shot:file,day:o&&o.clock?o.clock.replace(/\n/g,' '):null,hp:o&&o.you?o.you.hp:null,zone:o&&o.zone?o.zone.name:o?o.layer:null,at2:o&&o.you&&o.you.at||null};
  S.events.push(evt);if(S.events.length>400)S.events.shift();jl('events.jsonl',evt);S.busy=null;
  const out={text};if(r.image||args.includes('picture')){try{out.image=(await shot(.75,60)).toString('base64')}catch(e){}}
  return out}

// ---------------------------------------------------------------- live pace: the world does not wait, so the game's own Auto mode stands guard while the bot thinks
async function guardian(){
  if(PACE!=='live'||S.busy||S.paused||S.chromeDead||Date.now()-S.guardT<8000)return;
  try{const p=await pulse();if(p.mode!=='play'||p.dead||p.sheet||p.auto)return;const hurt=S._ghp!==undefined&&p.hp<S._ghp-1.5;S._ghp=p.hp;
    // badly hurt, away from home, and nothing left to heal with: staying is dying, so the session runs for the way out and says so
    // badly hurt with medicine: heal first (the bot died at 25 health with bandages in its pack, waiting)
    if(p.alertN>0&&p.foe<9&&p.hp<(p.max||100)*.35&&p.meds&&Date.now()-(S.healT||0)>2500){if(S.busy)return;S.healT=Date.now();await press('1');if(!p.auto){await press('f');S.autoOffT=0}S.guardMsg='WHILE YOU WERE DECIDING your health fell under a third: the session used medicine (key 1) and switched Auto on. If it keeps falling, `flee`.';return}
    if(p.alertN>0&&p.foe<9&&p.hp<(p.max||100)*.3&&!p.meds&&Date.now()-(S.fleeT||0)>12000){if(S.busy)return;S.fleeT=S.guardT=Date.now();const r=await exec('flee',[],'session');S.guardMsg='WHILE YOU WERE DECIDING your health fell under a third with no medicine left, so the session ran for it: '+((r&&r.text||'').split('\n')[0]||'').slice(0,200);return}
    if((p.alertN>0&&p.foe<6.5)||hurt){if(S.busy)return;if(Date.now()-(S.autoOffT||0)<45000&&p.hp>=(p.max||100)*.55)return;S.guardT=Date.now();await press('f');S.guardMsg='WHILE YOU WERE DECIDING, something hostile closed in. The world does not wait, so the session pressed F: Auto mode is ON and the character is defending itself. Press F (`key f`) to take over, or leave it on and `wait`.';
      const evt={n:S.n,at:new Date().toISOString(),who:'session',cmd:'guard',args:[],ms:0,result:'threat while idle: switched Auto on',zone:null};S.events.push(evt);jl('events.jsonl',evt)}}catch(e){}}

// ---------------------------------------------------------------- HTTP: the watch page, the command API, the game itself for the bot browser
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.md':'text/plain; charset=utf-8','.jsonl':'text/plain; charset=utf-8'};
const file=(res,f)=>{if(!fs.existsSync(f)||fs.statSync(f).isDirectory()){res.writeHead(404);return res.end('not found')}res.writeHead(200,{'content-type':MIME[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res)};
const body=req=>new Promise(ok=>{let s='';req.on('data',d=>s+=d);req.on('end',()=>{try{ok(JSON.parse(s||'{}'))}catch(e){ok({})}})});
const json=(res,o,code=200)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(o))};
const status=()=>({...META,ready:!!META.version,uptime:Math.round((Date.now()-Date.parse(META.started))/1000),paused:S.paused,stopping:S.stopping,shift:S.shift,busy:S.busy,actions:S.n,deaths:S.deaths,viewers:watching(),frames:S.frames,chromeDead:S.chromeDead,
  you:S.last&&S.last.you||null,zone:S.last&&S.last.zone||null,clock:S.last&&S.last.clock||null,tide:S.last&&S.last.tide||null,quest:S.last&&S.last.quest||null,layer:S.last&&S.last.layer||null,
  events:S.events.slice(-80),bugs:S.bugs,ideas:S.ideas,says:S.says.slice(-30),hints:S.hints,errors:S.errors.slice(-10),notebook:fs.existsSync(NOTEBOOK)?fs.readFileSync(NOTEBOOK,'utf8'):'',dir:SD});
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://x'),p=decodeURIComponent(url.pathname);
  try{
    if(p==='/')return file(res,path.join(HERE,'watch.html'));
    if(p==='/play/'){const frag=fs.readFileSync(path.join(SD,'game','index.html'),'utf8');res.writeHead(200,{'content-type':MIME['.html'],'cache-control':'no-store'});
      return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><style>html,body{margin:0}[hidden]{display:none!important}</style></head><body>${frag}<script type="module" src="__bot/page.js"></script></body></html>`)}
    if(p==='/play/__bot/page.js')return file(res,path.join(HERE,'page.js'));
    if(p.startsWith('/play/')){const f=path.normalize(path.join(SD,'game',p.slice(6)));if(!f.startsWith(path.join(SD,'game')+path.sep)){res.writeHead(403);return res.end()}return file(res,f)}
    if(p.startsWith('/files/')){const f=path.normalize(path.join(SD,p.slice(7)));if(!f.startsWith(SD+path.sep)){res.writeHead(403);return res.end()}return file(res,f)}
    if(p==='/live.mjpg'){res.writeHead(200,{'content-type':'multipart/x-mixed-replace; boundary=frame','cache-control':'no-store','connection':'close'});viewers.add(res);cast(true);if(latest){res.write(`--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${latest.length}\r\n\r\n`);res.write(latest);res.write('\r\n')}
      req.on('close',()=>viewers.delete(res));return}
    if(p==='/frame.jpg'){if(!latest){res.writeHead(503);return res.end()}
      if(!url.searchParams.has('after'))return sendFrame(res);                       // just the current picture
      lastPoll=Date.now();cast(true);if(S.frames>+url.searchParams.get('after'))return sendFrame(res);
      const w={res};w.t=setTimeout(()=>{waiters.delete(w);res.writeHead(204,{'x-frame':String(S.frames),'cache-control':'no-store'});res.end()},1000);waiters.add(w);req.on('close',()=>{clearTimeout(w.t);waiters.delete(w)});return}
    if(p==='/api/status')return json(res,status());
    if(p==='/api/cmd'&&req.method==='POST'){const b=await body(req);return json(res,await run(b.name,b.args,b.who))}
    if(p==='/api/control'&&req.method==='POST'){const b=await body(req);
      if(b.op==='pause'){S.paused=true;if(!S.busy)await ev('GW.G.hold=true').catch(()=>{})}
      else if(b.op==='resume'){S.paused=false;if(PACE==='live')await ev('GW.G.hold=false').catch(()=>{})}
      else if(b.op==='stop')S.stopping=true;
      // for the harness's own tests only (never reachable by the model, whose tools go through /api/cmd): set up a situation to test a tool on
      else if(b.op==='eval'&&process.env.GW_BOT_TEST==='1'){return json(res,{v:await ev(String(b.js)).catch(e=>String(e))})}
      else if(b.op==='shutdown'){json(res,{ok:true});return shutdown()}
      else if(b.op==='hint'&&b.text){S.hints.push({at:new Date().toISOString(),text:String(b.text).slice(0,600)});jl('hints.jsonl',S.hints[S.hints.length-1])}
      else if(b.op==='shift'){S.shift={left:+b.n||60,total:+b.n||60,n:S.shift.n+1,model:b.model||null,started:new Date().toISOString()}}
      else if(b.op==='shiftEnd'){S.shift.left=0;S.shift.total=0}
      else if(b.op==='say'&&b.text){const o={at:new Date().toISOString(),text:String(b.text).slice(0,1200)};S.says.push(o);if(S.says.length>200)S.says.shift();jl('says.jsonl',o)}
      else if(b.op==='bug'&&b.title){await fileBug('you',b.severity||'minor',String(b.title),String(b.details||''))}
      return json(res,{ok:true})}
    res.writeHead(404);res.end('not found');
  }catch(e){json(res,{error:String(e.message||e)},500)}
});
let closing=false;
async function shutdown(){if(closing)return;closing=true;
  // leave the save at the moment the bot left the game: a death is woken from first, then the game is saved. A restart once loaded an older moment,
  // and in a shared world the bot lived (and was charged for) the same hours twice
  try{await Promise.race([ev(`(()=>{try{if(GW.UI.panel==='death')GW.UI.close();return GW.api.save()}catch(e){return String(e)}})()`),sleep(2500)])}catch(e){}try{fs.writeFileSync(path.join(SD,'meta.json'),JSON.stringify({...META,ended:new Date().toISOString(),actions:S.n,bugs:S.bugs.length,ideas:S.ideas.length,deaths:S.deaths},null,1))}catch(e){}
  try{if(!S.chromeDead)await ev(`GW.G.S&&GW.G.mode!=='menu'&&GW.api.save()`)}catch(e){}
  // close Chrome politely and give it time: killed at once, it lost the last moments of the browser's storage (the save), and a bot that had just taken
  // someone in found nobody there next session
  try{if(!S.chromeDead)await Promise.race([send('Browser.close'),sleep(4000)])}catch(e){}
  if(chromeProc){for(let i=0;i<40&&chromeProc.exitCode===null;i++)await sleep(100);try{if(chromeProc.exitCode===null)chromeProc.kill('SIGTERM')}catch(e){}}
  try{if(POINTER)fs.unlinkSync(path.join(BOT,'current.json'))}catch(e){}
  server.close();setTimeout(()=>process.exit(0),400)}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);

server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${PORT} is taken: a session is probably already running (node tools/bot/ctl.mjs status). Use --port for a second one.`:e.message);process.exit(1)});
server.listen(PORT,'127.0.0.1',async()=>{
  try{await startChrome()}catch(e){console.error('Could not start the bot browser: '+e.message);return shutdown()}
  fs.writeFileSync(path.join(SD,'meta.json'),JSON.stringify(META,null,1));if(POINTER)fs.writeFileSync(path.join(BOT,'current.json'),JSON.stringify({...META,dir:SD},null,1));
  try{S.last=await ev('__bot.observe(false)');await keepShot()}catch(e){}
  setInterval(guardian,600);setInterval(()=>{if(casting&&!watching()&&Date.now()-lastPoll>5000)cast(false)},2000);setInterval(()=>{if(!casting&&!S.busy&&!S.chromeDead)shot().then(b=>push(b)).catch(()=>{})},4000);
  console.log(`Graywake bot session ${SID}\n  game ${META.version} at ${META.commit}${META.dirty?' + uncommitted changes':''} (a frozen copy: edit the working tree freely)\n  watch live:  http://127.0.0.1:${PORT}/\n  pace: ${PACE}${WINDOW?' · game window on screen':' · game browser hidden'} · profile "${PROFILE}"\n  files: ${SD}`);
});

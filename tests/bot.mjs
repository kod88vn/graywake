#!/usr/bin/env node
// Self-test of the bot play harness (tools/bot): starts a session of its own on a spare port, plays a few moves through the same command API
// a bot uses, and checks the picture stream, the logs, bug evidence and the controls. No model is involved. About 40 seconds.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,OUT,reporter} from '../tools/lib.mjs';

import net from 'node:net';
// a port nobody is using right now (other programs on this machine hold fixed ones)
const PORT=await new Promise(ok=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p))})});
const T=reporter('bot harness'),base=`http://127.0.0.1:${PORT}`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const proc=spawn(process.execPath,[path.join(ROOT,'tools/bot/session.mjs'),'--profile','selftest','--fresh','--port',String(PORT),'--no-current'],{stdio:['ignore','pipe','pipe']});
let log='';proc.stdout.on('data',d=>log+=d);proc.stderr.on('data',d=>log+=d);
const get=async p=>(await fetch(base+p)).json(),post=async(p,b)=>(await fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})).json();
const cmd=async(name,...args)=>(await post('/api/cmd',{name,args:args.map(String),who:'bot'})).text||'';
try{
  let st=null;for(let i=0;i<120&&!(st&&st.ready);i++){await sleep(250);try{st=await get('/api/status')}catch(e){}}
  if(!T.ok(!!(st&&st.ready),'a session starts with a browser of its own (game '+(st&&st.version)+')'))throw new Error(log);
  T.ok(fs.existsSync(path.join(st.dir,'game','js','main.js'))&&path.resolve(st.dir,'game')!==ROOT,'it plays a frozen copy of the game, not the working tree');
  let t=await cmd('look');T.ok(/title screen/.test(t)&&/\[1\] NEW GAME/.test(t),'look reads the title screen and numbers its button');
  t=await cmd('tap',1);T.ok(/Homestead/.test(t)&&/Quest tracker/.test(t),'tap starts a new game and the result describes the homestead');
  await cmd('wait',1.5);t=await cmd('look');
  if(/SHEET OPEN/.test(t)){const w=await cmd('walk','n',1);T.ok(/cannot walk/.test(w),'walking with a sheet open is refused with the reason');t=await cmd('key','esc')}
  T.ok(!/SHEET OPEN/.test(t),'esc closes the opening journal');
  const at=s=>{const m=/at \(([\d.]+), ([\d.]+)\)/.exec(s);return m?[+m[1],+m[2]]:null},p0=at(t);
  t=await cmd('walk','e',1);const p1=at(t);T.ok(p0&&p1&&p1[0]-p0[0]>2,'walk moves the character by held keys ('+(p1&&p0?(p1[0]-p0[0]).toFixed(1):'?')+' tiles east)');
  t=await cmd('goto','fallen','branches');T.ok(/walked to Fallen Branches/.test(t),'goto finds its way to a named thing');
  t=await cmd('use');if(!T.ok(/pressed E \(Gather · Fallen Branches\)/.test(t)&&/picked up/.test(t),'use presses E on it and the pickup is reported'))T.info(t.split('\n').filter(l=>/^»|In reach|game said|You:/.test(l)).join(' ¦ ').slice(0,600));
  t=await cmd('key','i');T.ok(/SHEET OPEN: "PACK"/.test(t)&&/Stick/.test(t),'the pack sheet lists what was gathered');await cmd('key','esc');
  t=await cmd('key','b');T.ok(/BUILD MODE/.test(t)&&/Stick Wall/.test(t),'build mode lists its pieces');await cmd('key','esc');
  t=await cmd('bug','minor','self-test report :: filed by tests/bot.mjs');st=await get('/api/status');const b=st.bugs.find(b=>/self-test/.test(b.title));
  T.ok(!!b&&['shot.jpg','save.json','state.json','events.json','report.md'].every(f=>fs.existsSync(path.join(st.dir,b.dir,f))),'a bug report carries a picture, the save, the visible state and the last moves');
  T.ok(st.bugs.filter(b=>b.source==='session').length===0&&st.errors.length===0,'the session saw no page errors and no broken state');
  await cmd('notebook','remember this');T.ok(/remember this/.test(await cmd('notebook')),'the notebook is kept');
  // the live picture
  {const ac=new AbortController(),r=await fetch(base+'/live.mjpg',{signal:ac.signal}),rd=r.body.getReader();let n=0,head='';const t0=Date.now();
    while(n<60000&&Date.now()-t0<6000){const{value,done}=await rd.read();if(done)break;if(!head)head=Buffer.from(value).toString('latin1').slice(0,80);n+=value.length}ac.abort();
    T.ok(/image\/jpeg/.test(head)&&n>20000,'the watch stream sends JPEG frames ('+Math.round(n/1024)+' KB in '+((Date.now()-t0)/1000).toFixed(1)+' s)')}
  // the way the watch page itself gets the picture: "the next frame after N", again and again, while the character is moving
  {const walking=cmd('walk','w',2);let n=-1,got=0;const t0=Date.now();while(Date.now()-t0<1800){const r=await fetch(base+'/frame.jpg?after='+n);if(r.status===200){n=+r.headers.get('x-frame');await r.arrayBuffer();got++}}await walking;
    T.ok(got>=12,'new frames keep arriving while the character moves ('+got+' in 1.8 s)')}
  T.ok((await (await fetch(base+'/')).text()).includes('bot watch'),'the watch page is served');
  // controls
  await post('/api/control',{op:'pause'});T.ok(/paused the session/.test(await cmd('walk','w',1)),'Pause holds the bot off');await post('/api/control',{op:'resume'});
  await post('/api/control',{op:'hint',text:'hello from the test'});T.ok(/MESSAGE FROM THE DEVELOPER WATCHING: hello from the test/.test(await cmd('look')),'a hint reaches the bot with its next move');
  await post('/api/control',{op:'shift',n:1});await cmd('wait',.5);T.ok(/SHIFT OVER/.test(await cmd('walk','w',1)),'a shift ends after its moves');
  const ev=fs.readFileSync(path.join(st.dir,'events.jsonl'),'utf8').trim().split('\n').length,shots=fs.readdirSync(path.join(st.dir,'shots')).length;
  T.ok(ev>=12&&shots>=10,'every move is logged with a picture ('+ev+' events, '+shots+' pictures)');
  const {report}=await import('../tools/bot/report.mjs');const f=report(st.dir);T.ok(fs.readFileSync(f,'utf8').includes('self-test report'),'the session report lists the bug');
  // an open watch page must find the picture again by itself when the session is restarted under it (it once stayed black)
  const {launch}=await import('../tools/lib.mjs');const view=await launch({width:1200,height:800,quiet:true,pathName:'/tools/rigs.html?q=none'});
  try{await view.send('Page.navigate',{url:base+'/'});await sleep(3500);T.ok((await get('/api/status')).viewers===1,'an open watch page is counted as one viewer of the stream');
    await post('/api/control',{op:'shutdown'}).catch(()=>{});await sleep(1200);T.ok(proc.exitCode!==null,'shutdown ends the session and its browser');
    const again=spawn(process.execPath,[path.join(ROOT,'tools/bot/session.mjs'),'--profile','selftest','--port',String(PORT),'--no-current'],{stdio:'ignore'});
    try{let s2=null;for(let i=0;i<120&&!(s2&&s2.ready);i++){await sleep(250);try{s2=await get('/api/status')}catch(e){}}let v=0;for(let i=0;i<40&&!v;i++){await sleep(300);v=(await get('/api/status')).viewers}
      T.ok(!!s2&&s2.session!==st.session&&v===1,'after a restart the same open page is watching the new session without a reload');T.ok(/CONTINUE/.test(await cmd('look')),'and the profile kept its save: the title screen offers Continue');
      await post('/api/control',{op:'shutdown'}).catch(()=>{});await sleep(800)}finally{try{again.kill('SIGKILL')}catch(e){}}
  }finally{await view.close()}
}catch(e){T.ok(false,'harness error: '+(e.stack||e).split('\n').slice(0,3).join(' | '))}
finally{try{proc.kill('SIGKILL')}catch(e){}}
process.exit(T.end()?1:0);

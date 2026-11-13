#!/usr/bin/env node
// Talk to a running bot session by hand: the same commands the bot has, plus the controls.
//   node tools/bot/ctl.mjs look            node tools/bot/ctl.mjs walk n 2         node tools/bot/ctl.mjs tap 3
//   node tools/bot/ctl.mjs status | pause | resume | stop | shutdown | hint "go and build a wall" | open
import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';
import {OUT} from '../lib.mjs';
const cur=path.join(OUT,'bot','current.json');
if(!fs.existsSync(cur)){console.error('No bot session is running. Start one with: npm run bot   (or: node tools/bot/session.mjs)');process.exit(1)}
// with two sessions running, `--port N` says which one; without it, the one that started last
const argv=process.argv.slice(2),pi=argv.indexOf('--port'),PORT=pi>=0?+argv.splice(pi,2)[1]:0;
const M=JSON.parse(fs.readFileSync(cur,'utf8')),base=`http://127.0.0.1:${PORT||M.port}`,[cmd,...args]=argv;
const post=async(p,b)=>(await fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})).json();
try{
  if(!cmd||cmd==='status'){const s=await (await fetch(base+'/api/status')).json();
    console.log(`session ${s.session} · game ${s.version} at ${s.commit}${s.dirty?'+':''} · pace ${s.pace} · up ${Math.round(s.uptime/60)} min · ${s.actions} moves · ${s.bugs.length} bugs · ${s.ideas.length} ideas · ${s.deaths} deaths${s.paused?' · PAUSED':''}${s.stopping?' · stopping':''}\nwatch: ${base}/\nfiles: ${s.dir}`);
    if(s.busy)console.log('doing: '+s.busy.cmd);for(const e of s.events.slice(-8))console.log(`  ${e.n} ${e.who} ${e.cmd} ${e.args.join(' ')} → ${e.result}`)}
  else if(['pause','resume','stop','shutdown'].includes(cmd)){await post('/api/control',{op:cmd});console.log(cmd+': ok')}
  else if(cmd==='end'){await post('/api/control',{op:'stop'});console.log('Asked the bot to stop: giving it up to a minute to save its notebook…');
    for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,1000));const s=await (await fetch(base+'/api/status')).json();if(!s.shift.total&&!s.busy)break}
    await post('/api/control',{op:'shutdown'}).catch(()=>{});console.log('Session ended. Report: npm run bot:report')}
  else if(cmd==='hint'){await post('/api/control',{op:'hint',text:args.join(' ')});console.log('The bot will read that with its next move.')}
  else if(cmd==='open'){spawn('open',['-g',base+'/'],{stdio:'ignore',detached:true}).unref();console.log(base+'/')}
  else{const r=await post('/api/cmd',{name:cmd,args,who:'you'});console.log(r.text||r.error);if(r.image){const f=path.join(M.dir,'last-look.jpg');fs.writeFileSync(f,Buffer.from(r.image,'base64'));console.log('picture: '+f)}}
}catch(e){console.error('The session does not answer ('+e.message+'). If it crashed, remove '+cur+' and start again.');process.exit(1)}

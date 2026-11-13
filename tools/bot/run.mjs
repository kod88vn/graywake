#!/usr/bin/env node
// Let a Claude model play Graywake by itself, in shifts, while you do something else.
//
//   npm run bot -- [--minutes 30] [--moves 50] [--model haiku] [--profile haiku] [--pace live|turns] [--window] [--fresh] [--goal "text"] [--no-open] [--keep]
//
// It starts a play session (tools/bot/session.mjs) if none is running, opens the watch page behind your other windows, and then runs the model
// through the Claude Code CLI with nothing but the game tools: no shell, no files, no web. Each shift is a fresh conversation; the model's
// notebook carries what it knows from one to the next. Stop it with Ctrl-C here, the Stop button on the watch page, or `npm run bot:stop`.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ROOT,OUT} from '../lib.mjs';

const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[i+1]:true};
const MINUTES=+arg('minutes',30),MOVES=+arg('moves',50),MODEL=String(arg('model','haiku')),PROFILE=String(arg('profile','haiku')),PORT=+arg('port',8777),GOAL=arg('goal',''),KEEP=!!arg('keep',false),OPEN=!process.argv.includes('--no-open');
const HERE=path.dirname(new URL(import.meta.url).pathname),BOT=path.join(OUT,'bot'),base=`http://127.0.0.1:${PORT}`,sleep=ms=>new Promise(r=>setTimeout(r,ms));
const get=async p=>(await fetch(base+p)).json(),post=async(p,b)=>(await fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)})).json();
const alive=async()=>{try{return await get('/api/status')}catch(e){return null}};

// ---- the session
let st=await alive(),started=false;
if(st&&!st.ready)for(let i=0;i<120&&!((st=await alive())&&st.ready);i++)await sleep(250);
if(!st){
  fs.mkdirSync(BOT,{recursive:true});const log=fs.openSync(path.join(BOT,'session.log'),'a');
  const a=['--profile',PROFILE,'--port',String(PORT),'--pace',String(arg('pace','live'))];if(arg('window',false))a.push('--window');if(arg('fresh',false))a.push('--fresh');if(arg('sound',false))a.push('--sound');
  spawn(process.execPath,[path.join(HERE,'session.mjs'),...a],{detached:true,stdio:['ignore',log,log]}).unref();started=true;
  for(let i=0;i<160&&!((st=await alive())&&st.ready);i++)await sleep(250);
  if(!st){console.error('The play session did not start. See '+path.join(BOT,'session.log'));process.exit(1)}
}
console.log(`Session ${st.session}: game ${st.version} at ${st.commit}${st.dirty?' + uncommitted changes':''}, pace ${st.pace}.\nWatch it live: ${base}/\nFiles: ${st.dir}\nPlayer: ${MODEL}, ${MOVES} moves a shift, for ${MINUTES} minutes.`);
if(OPEN&&process.platform==='darwin')spawn('open',['-g',base+'/'],{stdio:'ignore',detached:true}).unref();

// ---- the player: Claude Code with only the game tools, started somewhere that has no project instructions to read
const work=fs.mkdtempSync(path.join(os.tmpdir(),'graywake-bot-'));
const mcp=path.join(work,'mcp.json');fs.writeFileSync(mcp,JSON.stringify({mcpServers:{graywake:{command:process.execPath,args:[path.join(HERE,'mcp.mjs')],env:{GRAYWAKE_BOT_URL:base}}}}));
const brief=fs.readFileSync(path.join(HERE,'PLAYER.md'),'utf8');
const env={...process.env};for(const k of Object.keys(env))if(/^CLAUDE_?CODE|^CLAUDECODE/.test(k))delete env[k];
let child=null,stopping=false;
const shiftLog=o=>fs.appendFileSync(path.join(st.dir,'shifts.jsonl'),JSON.stringify(o)+'\n');

function shift(n){return new Promise(async done=>{
  const s=await get('/api/status'),nb=(s.notebook||'').trim();
  const prompt=[`Shift ${n}. You have ${MOVES} moves.`,nb?`Your notebook from earlier shifts:\n\n${nb}`:'Your notebook is empty: this is your first shift. The game is at its title screen or already running; start with `look`.',
    GOAL?`What the developers want from this session in particular: ${GOAL}`:'','Begin with `look` (with a picture), then play.'].filter(Boolean).join('\n\n');
  await post('/api/control',{op:'shift',n:MOVES,model:MODEL});
  const t0=Date.now(),out=fs.createWriteStream(path.join(st.dir,`shift-${String(n).padStart(3,'0')}.jsonl`));let result=null,buf='';
  child=spawn('claude',['-p',prompt,'--model',MODEL,'--system-prompt',brief,'--tools','','--mcp-config',mcp,'--strict-mcp-config','--allowedTools','mcp__graywake','--permission-mode','dontAsk','--output-format','stream-json','--verbose','--no-session-persistence'],{cwd:work,env,stdio:['ignore','pipe','pipe']});
  const limit=setTimeout(()=>{console.log('  shift ran too long: ending it');try{child.kill('SIGTERM')}catch(e){}},Math.max(8,MOVES*.6)*60000);
  child.stdout.on('data',d=>{out.write(d);buf+=d;let i;while((i=buf.indexOf('\n'))>=0){const line=buf.slice(0,i);buf=buf.slice(i+1);let m;try{m=JSON.parse(line)}catch(e){continue}
    if(m.type==='assistant'&&m.message&&Array.isArray(m.message.content))for(const c of m.message.content){if(c.type==='text'&&c.text.trim()){post('/api/control',{op:'say',text:c.text.trim()}).catch(()=>{});console.log('  '+MODEL+': '+c.text.trim().replace(/\s+/g,' ').slice(0,160))}}
    else if(m.type==='result')result=m}});
  let err='';child.stderr.on('data',d=>{err+=d});
  child.on('error',e=>{err+=String(e)});
  child.on('close',async code=>{clearTimeout(limit);out.end();child=null;await post('/api/control',{op:'shiftEnd'}).catch(()=>{});
    const o={shift:n,model:MODEL,minutes:+((Date.now()-t0)/60000).toFixed(1),exit:code,turns:result&&result.num_turns,cost_usd:result&&result.total_cost_usd,usage:result&&result.usage,error:result&&result.is_error?String(result.result||'').slice(0,400):err.trim().slice(0,400)||undefined};
    shiftLog(o);console.log(`  shift ${n} over: ${o.minutes} min, ${o.turns??'?'} turns${o.cost_usd!=null?', $'+o.cost_usd.toFixed(3)+' at API prices':''}${o.error?' — '+o.error:''}`);done(o)})})}

async function finish(why){if(stopping)return;stopping=true;console.log(why);try{if(child)child.kill('SIGTERM')}catch(e){}
  const s=await alive();if(s){console.log(`${s.actions} moves, ${s.bugs.length} bug reports, ${s.ideas.length} ideas, ${s.deaths} deaths.`);
    try{const {report}=await import('./report.mjs');const f=report(s.dir);console.log('Report: '+f)}catch(e){}
    if(started&&!KEEP)await post('/api/control',{op:'shutdown'}).catch(()=>{});else console.log('The session is still running (watch page stays up). End it with: npm run bot:stop')}
  fs.rmSync(work,{recursive:true,force:true});process.exit(0)}
process.on('SIGINT',()=>finish('\nStopping.'));process.on('SIGTERM',()=>finish('\nStopping.'));

const until=Date.now()+MINUTES*60000;let n=0,fails=0;
while(Date.now()<until){
  const s=await alive();if(!s)await finish('The play session has gone away.');if(s.stopping)break;
  const o=await shift(++n);if(stopping)break;
  if(o.exit!==0||!o.turns||o.turns<3){if(++fails>=2)await finish('The player could not be started twice in a row'+(o.error?': '+o.error:'')+'. Is the `claude` command signed in?');await sleep(3000)}else fails=0;
}
await finish('Time is up.');

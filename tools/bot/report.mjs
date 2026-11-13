#!/usr/bin/env node
// Turn a bot session's files into one page a person (or Claude) can triage: what was played, what broke, what was suggested.
//   node tools/bot/report.mjs            the latest session        node tools/bot/report.mjs <session folder>
import fs from 'node:fs';
import path from 'node:path';
import {OUT} from '../lib.mjs';

const lines=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8').split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l)}catch(e){return null}}).filter(Boolean):[];
export function latest(){const d=path.join(OUT,'bot','sessions');if(!fs.existsSync(d))return null;const all=fs.readdirSync(d).filter(n=>fs.statSync(path.join(d,n)).isDirectory()).sort();return all.length?path.join(d,all[all.length-1]):null}
export function report(dir){
  const meta=fs.existsSync(path.join(dir,'meta.json'))?JSON.parse(fs.readFileSync(path.join(dir,'meta.json'),'utf8')):{};
  const ev=lines(path.join(dir,'events.jsonl')),bugs=lines(path.join(dir,'bugs.jsonl')),ideas=lines(path.join(dir,'ideas.jsonl')),shifts=lines(path.join(dir,'shifts.jsonl')),hints=lines(path.join(dir,'hints.jsonl'));
  const bot=ev.filter(e=>e.who==='bot'),by={};for(const e of bot)by[e.cmd]=(by[e.cmd]||0)+1;
  const first=ev[0],last=ev[ev.length-1],mins=first&&last?Math.round((Date.parse(last.at)-Date.parse(first.at))/60000):0;
  const zones=[...new Set(ev.map(e=>e.zone).filter(z=>z&&!['title','sheet','hud','map','build'].includes(z)))];
  const stuck=bot.filter(e=>/stuck|blocked|cannot |no way|nothing was in reach|not on the screen|hidden behind/.test(e.result||'')),died=ev.filter(e=>/you died/.test(e.result||''));
  const cost=shifts.reduce((a,s)=>a+(s.cost_usd||0),0),sev={blocker:0,major:1,minor:2};
  const who=b=>b.source==='session'?'the session (automatic check)':b.source==='you'?'a person watching':'the bot';
  const L=['# Bot session '+(meta.session||path.basename(dir)),'',
    '- game '+(meta.version||'?')+' at commit '+(meta.commit||'?')+(meta.dirty?' plus uncommitted changes':'')+'; pace '+(meta.pace||'?')+'; profile "'+(meta.profile||'?')+'"',
    '- '+mins+' minutes of play, '+bot.length+' moves by the bot in '+shifts.length+' shift'+(shifts.length===1?'':'s')+(shifts[0]?' ('+shifts[0].model+')':'')+(cost?', about $'+cost.toFixed(2)+' at API prices':''),
    '- reached: '+(last&&last.day?last.day:'?')+'; places seen: '+(zones.join(', ')||'none')+'; deaths: '+died.length,
    '- '+bugs.length+' bug report'+(bugs.length===1?'':'s')+' ('+bugs.filter(b=>b.source==='session').length+' from the session\'s automatic checks, '+bugs.filter(b=>b.source==='you').length+' from a person), '+ideas.length+' idea'+(ideas.length===1?'':'s'),
    '- moves by kind: '+Object.entries(by).sort((a,b)=>b[1]-a[1]).map(([k,n])=>k+' '+n).join(', '),''];
  L.push('## Bugs','');if(!bugs.length)L.push('None reported.','');
  for(const b of bugs.slice().sort((a,c)=>(sev[a.severity]??3)-(sev[c.severity]??3)||a.id-c.id))
    L.push('### '+b.id+'. ['+b.severity+'] '+b.title,'','Reported by '+who(b)+' at move '+b.n+', '+b.at+'. Evidence: `'+b.dir+'/` (shot.jpg, save.json, state.json, events.json).','',b.details||'(no details)','');
  L.push('## Ideas','');if(!ideas.length)L.push('None.','');for(const i of ideas)L.push('- '+i.text+(i.where?' ('+i.where+', move '+i.n+')':''));if(ideas.length)L.push('');
  L.push('## Where the bot struggled','','Moves that did not do what was asked. Some are the bot\'s mistakes, some are the tool\'s, some are the game\'s: the pattern is what to look at.','');
  if(!stuck.length)L.push('Nothing notable.','');
  else{const g={};for(const e of stuck){const k=e.cmd+': '+(e.result||'').replace(/\(.*?\)|[\d.]+/g,'#').slice(0,70);(g[k]=g[k]||[]).push(e.n)}
    for(const[k,ns]of Object.entries(g).sort((a,b)=>b[1].length-a[1].length).slice(0,15))L.push('- '+ns.length+'× '+k+' (moves '+ns.slice(0,8).join(', ')+(ns.length>8?', …':'')+')');L.push('')}
  if(hints.length){L.push('## What the developers told it','');for(const h of hints)L.push('- '+h.at+': '+h.text);L.push('')}
  const nb=path.join(dir,'notebook.md');if(fs.existsSync(nb))L.push('## The bot\'s notebook at the end','','```',fs.readFileSync(nb,'utf8').trim(),'```','');
  const j=path.join(dir,'journal.md');if(fs.existsSync(j))L.push('## Its journal','',fs.readFileSync(j,'utf8').trim(),'');
  L.push('## Files','','Everything is in `'+dir+'`: `events.jsonl` (every move), `shots/` (the screen after every move), `bugs/NNN/`, `shift-NNN.jsonl` (the model\'s full conversation), `says.jsonl`.','');
  const f=path.join(dir,'report.md');fs.writeFileSync(f,L.join('\n'));return f}

if(process.argv[1]&&process.argv[1].endsWith('report.mjs')){
  const dir=process.argv[2]||latest();if(!dir){console.error('No sessions yet.');process.exit(1)}
  const f=report(dir);console.log(fs.readFileSync(f,'utf8'));console.error('written to '+f)}

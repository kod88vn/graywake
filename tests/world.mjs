#!/usr/bin/env node
// The world server by itself: worlds are made, joined, shared, lost and deleted by the rules in tools/world/server.mjs. No browser. 2 s.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {reporter} from '../tools/lib.mjs';
import {makeServer,RULES} from '../tools/world/server.mjs';
const T=reporter('world server'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'gw-world-'));
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};let clock=1e12;
const S=makeServer({dir,rnd,now:()=>clock});
try{
  const a=S.api['POST /api/join']({name:'Haiku',kind:'bot'}),w0=a.world;
  T.ok(S.DB().worlds.length===1&&w0.enclaves.length===RULES.npcs+1&&w0.enclaves.some(e=>e.name==='Haiku'&&e.kind==='bot'),'joining with no world makes one, with '+RULES.npcs+' settlements already in it ('+w0.name+': '+w0.enclaves.map(e=>e.name).join(', ')+')');
  const b=S.api['POST /api/join']({name:'Second',kind:'bot'});T.ok(b.world.id===w0.id&&b.world.enclaves.length===RULES.npcs+2,'a second bot joins the same world');
  const rep=(who,r)=>S.sync({world:who.world.id,enclave:who.enclave,token:who.token,report:r});
  let r=rep(a,{t:7*60+30,day:1,level:3,deeds:{}});T.ok(r.world.leads.length===0,'no lead in the first hours');r=rep(a,{t:12*60,day:1,level:3,deeds:{}});T.ok(r.world.leads.length===1&&r.world.leads[0].kind==='lead_grocery'&&r.you.hold===RULES.hold0,'the first shared lead goes out on every radio, and it is the grocery');
  const lid=r.world.leads[0].id;r=rep(b,{t:12*60+30,day:1,level:1,deeds:{leads:[lid]}});T.ok(r.took.includes(lid)&&r.you.hold===RULES.hold0+RULES.lead&&r.you.score>=RULES.score.lead,'the first to open the strongroom takes it: hold and score go up');
  r=rep(a,{t:12*60+40,day:1,level:3,deeds:{leads:[lid]}});T.ok(!r.took.length&&r.world.leads.find(l=>l.id===lid).by==='Second'&&r.you.hold===RULES.hold0,'the other is told who got there first and gains nothing');
  r=rep(a,{t:3*1440,day:3,level:4,deeds:{held:1}});T.ok(r.you.hold===RULES.hold0+RULES.tideHeld&&r.world.points>=5&&r.world.feed.some(f=>/held the tide/.test(f.text)),'a tide held raises hold, pushes the world on, and is in the news');
  // push the world along its event track
  for(let i=0;i<4;i++)r=rep(a,{t:(4+i)*1440,day:4+i,level:5,deeds:{held:1}});T.ok(r.world.stage>=1&&r.world.fx.tide>1,'deeds move the world to its next stage, and tides get heavier there ('+r.world.stageName+', ×'+r.world.fx.tide+')');
  // losing: the hold runs out, the enclave is moved to another world, and it keeps playing there
  r=rep(b,{t:9*1440,day:9,level:2,deeds:{lost:2,deaths:3}});
  T.ok(!!r.moved&&r.moved.world!==w0.id&&r.world.id===r.moved.world&&r.you.hold===RULES.hold0&&S.DB().worlds.length===2,'an enclave whose hold runs out has lost: it is moved to a new world ('+(r.moved&&r.moved.from)+' → '+r.world.name+')');
  T.ok(S.DB().worlds.find(w=>w.id===w0.id).gone.some(g=>g.name==='Second')&&rep(b,{t:1,deeds:{}}).gone===true,'the old world remembers who fell, and the old pass no longer works');
  const b2={world:r.world,enclave:r.moved.enclave,token:r.moved.token};T.ok(rep(b2,{t:9*1440+10,day:1,level:2,deeds:{}}).you.name==='Second','the new pass does');
  // a world with nobody holding is deleted; anyone can make a new one
  const w1=S.DB().worlds.find(w=>w.id===r.world.id);for(const e of w1.enclaves)if(e.kind==='npc')e.status='fallen';S.leave({world:b2.world.id,enclave:b2.enclave,token:b2.token});
  T.ok(!S.DB().worlds.some(w=>w.id===w1.id),'a world with no enclave left is deleted');
  const made=S.api['POST /api/worlds']({name:'Test Hollow'});T.ok(made.name==='Test Hollow'&&S.api['GET /api/worlds']().some(w=>w.id===made.id),'anyone can make a new world');
  clock+=RULES.stale+1;S.sweep();T.ok(!S.DB().worlds.some(w=>w.id===made.id)&&!S.DB().worlds.some(w=>w.id===w0.id),'worlds nobody has played in for a day and a half are deleted');
  // settlements the server plays live and die by the same hold
  const c=S.api['POST /api/join']({name:'Watcher',kind:'human'});let last=rep(c,{t:30*1440,day:30,level:9,deeds:{}});
  T.ok(last.world.day===1&&last.world.enclaves.every(e=>e.day<=2),'a character on its day 30 joining a new world does not drag the world to day 30: every day shown is days in this world');
  for(let d=31;d<=90;d++)last=rep(c,{t:d*1440+600,day:d,level:9,deeds:{held:d%3===0?1:0}});
  const npcs=last.world.enclaves.filter(e=>e.kind==='npc');T.ok(last.world.gone.some(g=>g.kind==='npc')||npcs.some(e=>e.hold!==RULES.hold0),'over sixty days the settlements gain and lose ground by themselves ('+npcs.map(e=>e.name+' '+e.hold).join(', ')+'; fallen: '+last.world.gone.map(g=>g.name).join(', ')+')');
  // over HTTP, from another origin
  await new Promise(r=>S.server.listen(0,'127.0.0.1',r));const port=S.server.address().port,res=await fetch(`http://127.0.0.1:${port}/api/worlds`);
  T.ok(res.headers.get('access-control-allow-origin')==='*'&&Array.isArray(await res.json()),'the API answers over HTTP to a page on another port');
  T.ok((await (await fetch(`http://127.0.0.1:${port}/watch`)).text()).includes('side by side'),'and serves the side-by-side watch page');
  S.flush();T.ok(JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8')).worlds.length===S.DB().worlds.length,'worlds are kept on disk');
}catch(e){T.ok(false,'error: '+(e.stack||e).split('\n').slice(0,3).join(' | '))}
finally{await S.close();fs.rmSync(dir,{recursive:true,force:true})}
process.exit(T.end()?1:0);

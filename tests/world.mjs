#!/usr/bin/env node
// The world server by itself: worlds are made, joined, shared, lost and deleted by the rules in tools/world/server.mjs. No browser. 2 s.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {reporter} from '../tools/lib.mjs';
import {makeServer,RULES} from '../tools/world/server.mjs';
import {seedSettlement,settlementDay,defence,describe,leader,TRAITS} from '../tools/world/settle.mjs';
import * as World from '../js/sim/world.js';
import {SITES} from '../js/data/world.js';
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
  // an older save loaded: the hours lived again are not counted again
  {const h0=r.you.hold,t0=3*1440;r=rep(a,{t:t0-600,day:3,level:4,deeds:{held:1,deaths:2}});T.ok(r.you.hold===h0,'a game that has gone back in time cannot have its tides and deaths counted twice');r=rep(a,{t:t0+5,day:3,level:4,deeds:{}})}
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
  // ---- the settlements: seeded, levelled with their world, on a plan of their own, judged by the game's rules (no model, no fixed dice)
  {const life=(seed,i,days,leads)=>{const st=seedSettlement(seed,i),log=[];for(let d=1;d<=days;d++)log.push(settlementDay(st,{day:d,stage:d<10?0:1,tideMult:d<10?1:1.1,leads:leads?leads(d):[],headStart:480}).map(e=>e.k).join('+'));return{st,log}};
    const a1=life(4242,1,30),a2=life(4242,1,30),b1=life(4243,1,30);
    T.ok(JSON.stringify(a1)===JSON.stringify(a2)&&JSON.stringify(a1.st)!==JSON.stringify(b1.st),'the same world seed gives a settlement the same thirty days; another seed gives another settlement');
    const young=life(4242,1,2).st,st=a1.st;T.ok(young.lvl<=3&&st.lvl>=8&&defence(st)>defence(young)*3&&st.people>young.people&&st.wpn>0&&st.set>=0,'it starts like a new player and grows with the world: '+describe(young)+'  →  day 30, level '+st.lvl+': '+describe(st));
    T.ok(a1.log.filter(x=>/held|lost/.test(x)).length===10&&a1.log.slice(0,2).every(x=>x===''),'it meets a tide every third day, like everyone ('+a1.log.filter(x=>/held/.test(x)).length+' held, '+a1.log.filter(x=>/lost/.test(x)).length+' lost in thirty days)');
    // leads: it goes only where the game's own rating says its gear can go
    const all=[];for(let s=1;s<=12;s++)for(let i=0;i<3;i++){const r=life(s*101,i,6,d=>[{id:'x'+d,kind:'lead_checkpoint',age:999}]);all.push(...r.log)}
    T.ok(!all.some(x=>/take|death/.test(x)),'no young settlement walks into an Army Checkpoint: the rating for its gear is far past what it will risk');
    const went=[];for(let s=1;s<=12;s++)for(let i=0;i<3;i++){const r=life(s*101,i,24,d=>[{id:'g'+d,kind:'lead_grocery',age:999}]);const st=r.st,odds=World.leadOdds(leader(st),SITES.lead_grocery,1);went.push([r.log.filter(x=>/take/.test(x)).length,r.log.filter(x=>/death/.test(x)).length,st.trait,odds])}
    T.ok(went.some(w=>w[0]>0)&&went.every(w=>w[0]+w[1]<=8),'with a grocery always on the radio they do go, at most once in three days ('+went.reduce((a,w)=>a+w[0],0)+' strongrooms and '+went.reduce((a,w)=>a+w[1],0)+' beaten back across 36 settlements in 24 days)');
    const pub=S.api['POST /api/worlds']({name:'Seedwater'}),np=pub&&pub.enclaves.find(e=>e.kind==='npc');T.ok(!!np&&/people/.test(np.about)&&np.level>=1,'the world tells every game what each settlement is and has ('+(np&&np.name+': '+np.about)+')')}
  // over HTTP, from another origin
  // a valley that loses a settlement gets a new one two days later, grown to the world's pace
  {const c=S.api['POST /api/join']({name:'Watcher',kind:'bot'}),wd=S.DB().worlds.find(x=>x.id===c.world.id),gone=wd.enclaves.find(e=>e.kind==='npc'&&e.status==='holding');gone.status='fallen';
    const n0=wd.enclaves.filter(e=>e.kind==='npc'&&e.status==='holding').length,d0=Math.floor(wd.t/1440)+1;for(let k=1;k<=5;k++)S.sync({world:c.world.id,enclave:c.enclave,token:c.token,report:{t:(d0+k)*1440-wd.t%1440+600,day:k,level:5,deeds:{}}});
    const fresh=wd.enclaves.filter(e=>e.kind==='npc'&&e.status==='holding');T.ok(fresh.length===n0+1&&fresh.some(e=>!['fallen'].includes(e.status)&&e.joined&&e.name!==gone.name&&e.st.lvl>1),'a settlement that falls is replaced two days later by newcomers already grown ('+fresh.map(e=>e.name+' lvl '+e.st.lvl).join(', ')+')')}
  await new Promise(r=>S.server.listen(0,'127.0.0.1',r));const port=S.server.address().port,res=await fetch(`http://127.0.0.1:${port}/api/worlds`);
  T.ok(res.headers.get('access-control-allow-origin')==='*'&&Array.isArray(await res.json()),'the API answers over HTTP to a page on another port');
  T.ok((await (await fetch(`http://127.0.0.1:${port}/watch`)).text()).includes('side by side'),'and serves the side-by-side watch page');
  S.flush();T.ok(JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8')).worlds.length===S.DB().worlds.length,'worlds are kept on disk');
}catch(e){T.ok(false,'error: '+(e.stack||e).split('\n').slice(0,3).join(' | '))}
finally{await S.close();fs.rmSync(dir,{recursive:true,force:true})}
process.exit(T.end()?1:0);

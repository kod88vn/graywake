#!/usr/bin/env node
// The world server: shared game worlds for several enclaves (people, bots, and settlements the server plays itself).
// It keeps no game simulation. Each game plays its own copy of the valley and reports its enclave's deeds here; the server keeps what is
// shared: who is in the world and how firmly each holds, the radio leads everyone hears (the first to open a strongroom takes it), the
// world's event stage, and the news. An enclave whose hold reaches nothing has lost: it is moved to another world. A world with no enclave
// left is deleted. Anyone can make a new world. No dependencies; state is one JSON file.
//   node tools/world/server.mjs [--port 8795] [--dir .out/worlds]         (docs/MULTIPLAYER.md)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {SITES} from '../../js/data/world.js';
import {seedSettlement,settlementDay,describe} from './settle.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url)),ROOT=path.resolve(HERE,'../..');
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i>=0?process.argv[i+1]:d};

/** Every number that decides how worlds behave, in one place. */
export const RULES={
  hold0:60,holdMax:100,          // an enclave's hold on its ground: starts here, lost at 0
  tideHeld:10,tideLost:-25,      // a tide beaten at the walls; a tide that went through them
  death:-8,lead:6,               // the enclave's leader brought home on a door; a strongroom opened
  npcs:3,room:4,                 // settlements the server plays in each new world; places for people and bots
  leads:2,leadEvery:240,leadLasts:[18,26],headStart:480,   // (a settlement only goes for a lead that has been out eight hours: players get first run at it)   // shared radio leads: how many at once, minutes of game time between them, hours they last
  stale:36*3600e3,               // a world nobody has played in for this long (real time) is deleted
  score:{held:10,lead:15,day:2,level:3},
  // the world's event track: every deed pushes it on (a tide held 2, a strongroom 3), and each stage makes the tides heavier for everyone in it
  stages:[{n:'The Quiet',need:0,tide:1,d:'The valley is still working out who is left.'},
    {n:'First Blood',need:8,tide:1.1,d:'The husks have learned where the fires are.'},
    {n:'The Tide Turns',need:20,tide:1.2,d:'They come in numbers now, and on a schedule.'},
    {n:'The Bloom Spreads',need:40,tide:1.35,d:'Gray growth on the ridge lines. The air tastes of it.'},
    {n:'The Long Night',need:70,tide:1.5,d:'Nobody remembers the last quiet week.'},
    {n:'The Signal',need:110,tide:1.7,d:'Something is calling them all to the same place.'}],
};
const WORLD_NAMES=['Pinewatch','Low Water','Greywell','Emberfield','Stonecross','Marrow Lake','Thornreach','Coldharbour','Ashlow','Wickerfen','Dunmere','Haldane Gap'];
const NPC_NAMES=['Ashford Mill','Kettle Row','Saltmarsh Chapel','Hollow Bridge','Cinder Yard',"Wren's Landing",'The Granary','Tollhouse Six','Brackwater','Old Quarry Camp'];
const LEAD_KINDS=Object.keys(SITES).filter(k=>SITES[k].lead);

export function makeServer({dir=path.join(ROOT,'.out/worlds'),rnd=Math.random,now=()=>Date.now()}={}){
  fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'state.json');
  let DB={n:0,worlds:[]};try{DB=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){}
  // settlements from before they were simulated get their seed and the first days they would have had, quietly, as soon as the server starts
  for(const w of DB.worlds)w.enclaves.forEach((e,i)=>{if(e.kind==='npc'&&e.status==='holding'&&!e.st){e.st=seedSettlement(w.seed,i);for(let d=1;d<Math.min(w.npcDay||1,9);d++)settlementDay(e.st,{day:d,stage:0,tideMult:1,leads:[]});e.level=e.st.lvl}});
  for(const w of DB.worlds)if(!w.rel){w.rel=1;for(const e of w.enclaves){e.day=1;e.scoredDay=1;delete e.off}}   // (worlds from before enclaves had their own clocks)
  let dirty=false;const save=()=>{dirty=true},flush=()=>{if(dirty){dirty=false;try{fs.writeFileSync(file,JSON.stringify(DB))}catch(e){}}};
  const pick=a=>a[Math.floor(rnd()*a.length)],id=()=>crypto.randomBytes(5).toString('hex');
  const stageOf=w=>{let s=0;RULES.stages.forEach((st,i)=>{if(w.points>=st.need)s=i});return s};
  const news=(w,text,kind='info')=>{w.feed.push({t:w.t,at:now(),text,kind});if(w.feed.length>40)w.feed.shift()};
  const holding=w=>w.enclaves.filter(e=>e.status==='holding'),players=w=>holding(w).filter(e=>e.kind!=='npc');

  function createWorld(name){
    const used=new Set(DB.worlds.map(w=>w.name));name=(name||'').trim().slice(0,24)||WORLD_NAMES.find(n=>!used.has(n))||pick(WORLD_NAMES)+' '+(DB.n+1);
    const w={rel:1,id:'w'+(++DB.n),name,seed:Math.floor(rnd()*2**31),created:now(),last:now(),t:7*60,points:0,stage:0,leadN:0,leadAt:7*60+240,npcDay:0,enclaves:[],leads:[],feed:[],gone:[]};
    // the settlements are seeded from the world: the same world seed gives the same people, and they start where a new player starts
    const names=NPC_NAMES.slice().sort(()=>rnd()-.5).slice(0,RULES.npcs);
    names.forEach((n,i)=>w.enclaves.push({id:id(),name:n,kind:'npc',status:'holding',hold:RULES.hold0,score:0,day:1,level:1,deeds:{held:0,lost:0,deaths:0,leads:0},joined:now(),seen:now(),st:seedSettlement(w.seed,i)}));
    news(w,'A new world: '+name+'. '+names.join(', ')+' are already holding ground here.');DB.worlds.push(w);save();return w;
  }
  function join(wid,name,kind){
    let w=wid&&DB.worlds.find(x=>x.id===wid);if(!w)w=DB.worlds.filter(x=>players(x).length<RULES.room).sort((a,b)=>players(b).length-players(a).length)[0]||createWorld();
    if(players(w).length>=RULES.room)w=createWorld();
    name=String(name||'Enclave').trim().slice(0,24)||'Enclave';if(w.enclaves.some(e=>e.name===name))name+=' '+(w.enclaves.length+1);
    const e={id:id(),token:id()+id(),name,kind:kind==='bot'?'bot':'human',status:'holding',hold:RULES.hold0,score:0,day:1,level:1,deeds:{held:0,lost:0,deaths:0,leads:0},joined:now(),seen:now()};
    w.enclaves.push(e);w.last=now();news(w,name+' has settled in '+w.name+'.','good');save();return{w,e};
  }
  /** The settlements the world plays itself (settle.mjs): each lives the day on its own plan, with the world's stage and open leads in front of it.
   *  What happens to them moves their hold, their score and the world's event track by the same numbers as a player's deeds. */
  function npcDay(w){
    const st=stageOf(w),tideMult=RULES.stages[st].tide;
    for(const e of holding(w).filter(e=>e.kind==='npc')){
      if(!e.st){e.st=seedSettlement(w.seed,w.enclaves.indexOf(e));for(let d=1;d<Math.min(w.npcDay,9);d++)settlementDay(e.st,{day:d,stage:0,tideMult:1,leads:[]})}   // a settlement from before they were simulated: it gets the days it would have had, quietly
      const leads=w.leads.filter(l=>!l.by).map(l=>({id:l.id,kind:l.kind,age:w.t-l.born})),ev=settlementDay(e.st,{day:w.npcDay,stage:st,tideMult,leads,headStart:RULES.headStart});
      e.day++;e.level=e.st.lvl;
      for(const x of ev){
        if(x.k==='held'){e.hold=Math.min(RULES.holdMax,e.hold+RULES.tideHeld);e.deeds.held++;e.score+=RULES.score.held;w.points+=2;news(w,e.name+' held the tide.','good')}
        else if(x.k==='lost'){e.hold+=RULES.tideLost;e.deeds.lost++;news(w,'The tide went through '+e.name+'.','bad')}
        else if(x.k==='death'){e.hold+=RULES.death;e.deeds.deaths++;news(w,e.name+' were '+x.text+'.','bad')}
        else if(x.k==='take'){const l=w.leads.find(l=>l.id===x.lead);if(l&&!l.by){l.by=e.name;l.byId=e.id;l.byT=w.t;e.hold=Math.min(RULES.holdMax,e.hold+RULES.lead);e.deeds.leads++;e.score+=RULES.score.lead;w.points+=3;news(w,e.name+' reached the '+SITES[l.kind].n+' first.','bad')}}}
      e.score+=RULES.score.day;if(e.hold<=0)fall(w,e)}
  }
  function fall(w,e){e.status='fallen';e.hold=0;w.gone.push({name:e.name,kind:e.kind,day:Math.floor(w.t/1440)+1,score:e.score});news(w,e.name+' has fallen. '+(e.kind==='npc'?'Nobody is left there.':'Its people are on the road, looking for another valley.'),'bad')}
  function tick(w){
    // leads everyone in the world hears
    w.leads=w.leads.filter(l=>l.until>w.t&&(!l.by||w.t-l.byT<120));
    if(w.leads.filter(l=>!l.by).length<RULES.leads&&w.t>=w.leadAt&&players(w).length){w.leadAt=w.t+RULES.leadEvery*(.7+rnd()*.6);
      // not a kind that is out now or was one of the last three: the same shop twice in a row reads as the one already emptied
      const have=new Set(w.leads.map(l=>l.kind)),first=w.leadN===0,recent=w.recent||(w.recent=[]),ok=LEAD_KINDS.filter(k=>!have.has(k)&&(SITES[k].minDay||0)<=Math.floor(w.t/1440)+1),kinds=ok.filter(k=>!recent.includes(k)),k=first?'lead_grocery':pick(kinds.length?kinds:ok.length?ok:LEAD_KINDS);recent.push(k);if(recent.length>3)recent.shift();const seen=w.kinds||(w.kinds={}),again=!!seen[k];seen[k]=1;
      const[a,b]=RULES.leadLasts,l={id:w.id+'-l'+(++w.leadN),kind:k,ang:rnd()*Math.PI*2,far:rnd(),born:w.t,until:w.t+(a+rnd()*(b-a))*60,by:null};w.lastLead=k;w.leads.push(l);news(w,'On every radio: '+(again?'another ':'')+SITES[k].n+(again?', not the one already emptied':'')+'. First there takes it.')}
    // the settlements live one day at a time; when a long-played character joins and the world's clock leaps, they do not live the gap in one breath
    const day=Math.floor(w.t/1440);if(day-w.npcDay>1)w.npcDay=day-1;while(w.npcDay<day){w.npcDay++;npcDay(w)}
    const st=stageOf(w);if(st>w.stage){w.stage=st;news(w,'The world moves on: '+RULES.stages[st].n+'. '+RULES.stages[st].d,'bad')}
  }
  function sweep(){
    // an enclave nobody has played for a day and a half has been abandoned
    for(const w of DB.worlds)for(const e of players(w))if(now()-e.seen>RULES.stale){e.status='left';news(w,e.name+' has gone quiet. Its fires are out.');save()}
    const before=DB.worlds.length;DB.worlds=DB.worlds.filter(w=>holding(w).length>0&&!(players(w).length===0&&now()-w.last>RULES.stale));if(DB.worlds.length!==before)save();
  }
  const publicWorld=w=>({id:w.id,name:w.name,seed:w.seed,t:w.t,day:Math.floor(w.t/1440)+1,stage:w.stage,stageName:RULES.stages[w.stage].n,stageText:RULES.stages[w.stage].d,points:w.points,next:RULES.stages[w.stage+1]?RULES.stages[w.stage+1].need:null,
    fx:{tide:RULES.stages[w.stage].tide},room:RULES.room-players(w).length,
    enclaves:w.enclaves.filter(e=>e.status==='holding').sort((a,b)=>b.score-a.score).map(e=>({id:e.id,name:e.name,kind:e.kind,hold:Math.round(e.hold),score:e.score,day:e.day,level:e.level,deeds:e.deeds,idle:e.kind!=='npc'&&now()-e.seen>90e3,about:e.kind==='npc'&&e.st?describe(e.st):''})),
    leads:w.leads.map(l=>({id:l.id,kind:l.kind,ang:l.ang,far:l.far,until:l.until,by:l.by||null})),feed:w.feed.slice(-14),gone:w.gone.slice(-8)});

  /** One enclave reports what it has done since last time; gets the world back. */
  function sync(b){
    let w=DB.worlds.find(x=>x.id===b.world),e=w&&w.enclaves.find(x=>x.id===b.enclave&&x.token===b.token);
    if(!e||e.status!=='holding')return{gone:true};   // the world was deleted, or this enclave is not in it any more: the game should join again
    const r=b.report||{},d=r.deeds||{};e.seen=w.last=now();
    // the world keeps its own clock. Each enclave's clock is tied to it at the moment it first reports, so a character on its day 26 who joins a
    // world on its day 1 does not drag the world to day 26, and every enclave's "day" here means days in this world
    if(e.off===undefined){e.off=w.t-(r.t||0);e.joinT=w.t}const wt=(r.t||0)+e.off;if(wt>w.t)w.t=wt;const days=Math.floor(Math.max(0,wt-e.joinT)/1440)+1;e.day=Math.max(e.day,days);if(r.level){if(r.level>e.level)e.score+=(r.level-e.level)*RULES.score.level;e.level=Math.max(e.level,r.level)}
    const held=Math.max(0,d.held|0),lost=Math.max(0,d.lost|0),deaths=Math.max(0,d.deaths|0),took=[];
    for(const lid of d.leads||[]){const l=w.leads.find(x=>x.id===lid);if(l&&!l.by){l.by=e.name;l.byId=e.id;l.byT=w.t;took.push(l);news(w,e.name+' opened the strongroom at the '+SITES[l.kind].n+'.','good')}}
    e.deeds.held+=held;e.deeds.lost+=lost;e.deeds.deaths+=deaths;e.deeds.leads+=took.length;
    e.hold=Math.max(0,Math.min(RULES.holdMax,e.hold+held*RULES.tideHeld+lost*RULES.tideLost+deaths*RULES.death+took.length*RULES.lead));
    e.score+=held*RULES.score.held+took.length*RULES.score.lead+(days>(e.scoredDay||1)?(days-(e.scoredDay||1))*RULES.score.day:0);e.scoredDay=Math.max(e.scoredDay||1,days);
    w.points+=held*2+took.length*3;
    if(held)news(w,e.name+' held the tide.','good');if(lost)news(w,'The tide went through '+e.name+'.','bad');if(deaths)news(w,e.name+"'s leader was carried home.",'bad');
    tick(w);
    let moved=null;
    if(e.hold<=0){fall(w,e);const from=w.name,j=join((DB.worlds.find(x=>x!==w&&players(x).length<RULES.room)||createWorld()).id,e.name,e.kind);j.e.level=e.level;j.e.day=1;
      j.e.off=j.w.t-(r.t||0);j.e.joinT=j.w.t;moved={from,world:j.w.id,enclave:j.e.id,token:j.e.token,name:j.e.name};news(j.w,j.e.name+' came over the pass from '+from+', beaten there.');sweep();w=j.w;e=j.e}
    save();return{world:publicWorld(w),you:{id:e.id,name:e.name,hold:Math.round(e.hold),score:e.score,rank:holding(w).sort((a,b)=>b.score-a.score).indexOf(e)+1,of:holding(w).length},took:took.map(l=>l.id),moved};
  }
  function leave(b){const w=DB.worlds.find(x=>x.id===b.world),e=w&&w.enclaves.find(x=>x.id===b.enclave&&x.token===b.token);if(!e)return{ok:false};e.status='left';news(w,e.name+' has left '+w.name+'.');sweep();save();return{ok:true}}

  const api={
    'GET /api/rules':()=>RULES,
    'GET /api/worlds':()=>{sweep();return DB.worlds.map(publicWorld)},
    'POST /api/worlds':b=>publicWorld(createWorld(b.name)),
    'POST /api/join':b=>{const j=join(b.world,b.name,b.kind);tick(j.w);return{world:publicWorld(j.w),enclave:j.e.id,token:j.e.token,name:j.e.name}},
    'POST /api/sync':sync,'POST /api/leave':leave,
  };
  const send=(res,code,body,type='application/json')=>{res.writeHead(code,{'content-type':type,'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS','cache-control':'no-store'});res.end(typeof body==='string'||Buffer.isBuffer(body)?body:JSON.stringify(body))};
  const server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://x');if(req.method==='OPTIONS')return send(res,204,'');
    if(req.method==='GET'&&(u.pathname==='/'||u.pathname==='/watch'))return send(res,200,fs.readFileSync(path.join(HERE,'watch.html')),'text/html; charset=utf-8');
    // a bot session's status, fetched here so the side-by-side page (served from this port) is not stopped by the browser's cross-port rule
    const bm=/^\/api\/bot\/(87\d\d)$/.exec(u.pathname);if(req.method==='GET'&&bm){fetch(`http://127.0.0.1:${bm[1]}/api/status`).then(r=>r.json()).then(s=>send(res,200,{profile:s.profile,version:s.version,zone:s.zone&&s.zone.name,level:s.you&&s.you.level,hp:s.you&&s.you.hp,maxHp:s.you&&s.you.maxHp,moves:s.actions,deaths:s.deaths,bugs:(s.bugs||[]).length,clock:s.clock,session:s.session,food:s.you&&s.you.food,water:s.you&&s.you.water,weapon:s.you&&s.you.weapon,wearing:s.you&&s.you.wearing,busy:s.busy&&s.busy.cmd,last:(s.events||[]).slice(-3).map(e=>e.cmd+' '+(e.args||[]).join(' ').slice(0,40)+(e.result?' → '+String(e.result).split('\n')[0].slice(0,110):'')),say:((s.says||[]).slice(-1)[0]||{}).text||''}),()=>send(res,200,{down:true}));return}
    const m=/^\/api\/world\/([\w-]+)$/.exec(u.pathname);if(req.method==='GET'&&m){const w=DB.worlds.find(x=>x.id===m[1]);return w?send(res,200,publicWorld(w)):send(res,404,{error:'no such world'})}
    const h=api[req.method+' '+u.pathname];if(!h)return send(res,404,{error:'not found'});
    let raw='';req.on('data',c=>{raw+=c;if(raw.length>1e5)req.destroy()});req.on('end',()=>{let b={};try{b=raw?JSON.parse(raw):{}}catch(e){return send(res,400,{error:'bad JSON'})}try{send(res,200,h(b))}catch(e){send(res,500,{error:String(e&&e.message||e)})}});
  });
  const timer=setInterval(flush,1500);timer.unref();
  return{server,api,DB:()=>DB,createWorld,join,sync,leave,sweep,flush,close:()=>{clearInterval(timer);flush();return new Promise(r=>server.close(r))}};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=+arg('port',8795),S=makeServer({dir:path.resolve(arg('dir',path.join(ROOT,'.out/worlds')))});
  S.server.listen(port,'127.0.0.1',()=>console.log(`World server on http://127.0.0.1:${port}/  (side-by-side watch page at /watch?a=8777&b=8778; ${S.DB().worlds.length} world(s) on file)`));
  for(const sig of['SIGINT','SIGTERM'])process.on(sig,()=>{S.close().then(()=>process.exit(0))});
}

#!/usr/bin/env node
// Monkey test: a mid-game save, then thousands of random clicks on every button in every sheet, random hot-keys and random
// build actions. Fails on any page error or broken invariant (NaN vitals, negative stacks, pack the wrong size).
// Usage: node tests/monkey.mjs [seconds=45]
import {launch,reporter} from '../tools/lib.mjs';
const secs=+process.argv[2]||45,T=reporter('monkey ('+secs+' s of random input)');
const page=await launch({width:1100,height:700,quiet:true,pathName:'/?shots=1'});const ev=js=>page.eval(js);
try{
  await page.sleep(700);await ev(`window.__noIntro=true;localStorage.clear();GW.api.newGame()`);await page.sleep(2000);
  // a rich mid-game state so every sheet has something in it
  await ev(`(async()=>{const{G,World}=GW,S=G.S,Z=G.Z,core=await import('/js/sim/core.js'),cx=Math.floor(Z.w/2),cy=Math.floor(Z.h/2);S.p.lvl=45;S.p.sp=6;S.scrip=900;S.veh=3;S.tide.at=S.t+9e5;
    for(let y=cy-5;y<=cy+5;y++)for(let x=cx-6;x<=cx+6;x++)Z.obj[y*Z.w+x]=null;
    const give=(id,n)=>World.applyFx([['item',id,n]]);S.p.eq.pack={id:'pack_exped'};G.ds=core.derive(S);
    for(const[id,n]of[['log',80],['plank',80],['stone',60],['stick',40],['rope',20],['fiber',40],['rags',20],['nails',120],['iron_bar',40],['clay',30],['brick',30],['scrap',30],['cloth',20],['leather',12],['raw_meat',6],['dirty_water',4],['seed_carrot',4],['bandage',4],['medkit',2],['canned_beans',4],['water',4],['arrow',40],['xbolt',40],['fuel',10],['spring',6],['gear',6],['machete',1],['bow',1],['hide_vest',1],['leather_cap',1],['bp_shotgun',1],['repair_kit',2],['flare',1],['lockpick',3],['molotov',3],['glass',6],['wire',8],['battery',2],['engine_part',4],['pipe',6],['herb',6],['charcoal',10],['iron_ore',10]])give(id,n);
    let k=0;for(const kind of['campfire','workbench2','sawbench','furnace','tannery','loom','medic','forge','box_small','chest','bed','garden','collector','turret_xbow','generator','radio','recycler','repair_bench','trade_post','guard_post','beacon','spikes','torch_stand','garage','kennel','map_table'])core.place(S,kind,cx-6+(k%13),cy-5+Math.floor(k++/13)*3);
    World.addSurvivor(S);World.addSurvivor(S);S.home.pile={log:5};World.openTrader(S,true);const q=await import('/js/sim/quests.js');S.q.contracts.push(q.genContract(S),q.genContract(S));Z.pl.x=cx+.5;Z.pl.y=cy+3.5;G.ev.length=0})()`);
  await page.sleep(500);
  const step=`(()=>{const{G,World,UI}=GW,S=G.S,Z=G.Z,R=Math.random,pick=a=>a[Math.floor(R()*a.length)];let did='';
    if(G.mode==='menu')return'menu';
    if(G.mode==='map'&&!UI.panel){World.arrive('home');return'home'}
    if(UI.panel){const els=[...document.querySelectorAll('#pb [data-a]:not([disabled]),#tabs [data-t]')].filter(e=>!['title','import','mut'].includes(e.dataset.a));
      if(els.length&&R()<.86){const e=pick(els);did=UI.panel+':'+(e.dataset.a||'tab '+e.dataset.t);e.click()}else{const sel=document.querySelector('#pb select');if(sel&&R()<.5){sel.value=pick([...sel.options]).value;sel.dispatchEvent(new Event('change',{bubbles:true}));did='select'}else{if(UI.panel==='event'||UI.panel==='death'){const b=document.querySelector('#pb [data-a]:not([disabled])');if(b)b.click()}else UI.close();did='close'}}
      return did}
    const r=R();
    if(r<.5&&Z){const P=['inv','craft','journal','camp','menu','trade'];const idx=[];Z.obj.forEach((o,i)=>{if(o&&o.hp)idx.push(i)});const i=pick(idx),o=Z.obj[i];
      if(R()<.5||!o){const p=pick(P);UI.open(p);did='open '+p}else{const d=GW.G.Z.obj[i];Z.pl.x=i%Z.w+.5;Z.pl.y=Math.floor(i/Z.w)+1.4;G.inp.interact=true;did='interact '+o.k}}
    else if(r<.7){const k=pick(['inv','craft','build','journal','camp','swap','auto','q_hp','q_food','q_water','rotate','esc','menu']);UI.hot(k);did='hot '+k}
    else if(r<.9&&G.build){const b=pick([...document.querySelectorAll('#build [data-b]')].filter(e=>e.dataset.b!=='tool:done'||R()<.2));if(b){b.click();did='build '+b.dataset.b}const p=Z.pl;UI.buildPointer('down',300+R()*500,150+R()*350);UI.buildPointer('up',0,0)}
    else if(r<.93){UI.open('event',pick(['ev_stash','ev_stranger','home_gate','home_trader','ev_peddler','home_storm']));did='event'}
    else{G.inp.mx=R()*2-1;G.inp.my=R()*2-1;did='move'}
    return did})()`;
  const check=`(()=>{const{G}=GW,S=G.S,bad=[];if(!S)return'';const p=S.p;for(const k of['hp','food','water','tox','xp'])if(!Number.isFinite(p[k]))bad.push(k+' is '+p[k]);
    p.inv.forEach((s,i)=>{if(s&&(!(s.n>0)||!Number.isFinite(s.n)))bad.push('pack slot '+i+' has '+JSON.stringify(s))});
    if(!Number.isFinite(S.scrip)||S.scrip<0)bad.push('scrip '+S.scrip);if(G.Z&&G.Z.pl&&!Number.isFinite(G.Z.pl.x))bad.push('player x');
    for(const o of S.home.obj)if(o&&o.inv)for(const s of o.inv)if(s&&!(s.n>0))bad.push('store has '+JSON.stringify(s));
    return bad.join('; ')})()`;
  let n=0,last=[];const t0=Date.now();
  while(Date.now()-t0<secs*1000){const d=await ev(step);last.push(d);if(last.length>12)last.shift();n++;if(n%4===0)await page.sleep(40);
    const bad=await ev(check);if(bad||page.errors.length){T.ok(false,(bad||page.errors.slice(0,3).join(' | '))+'  ← after: '+last.join(' → '));break}}
  T.ok(page.errors.length===0&&!(await ev(check)),n+' random actions, no errors, state stays sane');
}catch(e){T.ok(false,'threw: '+e.message+(page.errors.length?' | page: '+page.errors.slice(0,4).join(' | '):''))}
await page.close();process.exitCode=T.end()?1:0;

// 160 settlements (4 per seed, 40 seeds) lived for 60 world days against the real tide formulas: how many fall, when, and how many distinct histories each kind produces.
// Usage: node tools/measure/settlements.mjs        The numbers that tuned settlement rules (0.10.57: 100% fell, now ~46%; farmers never).
import * as St from '../world/settle.mjs';
const MULT=[1,1.1,1.2,1.35,1.5,1.7];
const res={};
for(let seed=1;seed<=40;seed++)for(let i=0;i<4;i++){const st=St.seedSettlement(seed*977,i);let hold=60,fell=0,lost=0,held=0,sig=[];
  for(let d=1;d<=60;d++){const stage=Math.min(5,Math.floor(d/12));const ev=St.settlementDay(st,{day:d,stage,tideMult:MULT[stage],leads:d%4===0?[{id:'L'+d,kind:'lead_gunshop',age:600}]:[]});
    for(const e of ev){if(e.k==='held'){hold=Math.min(100,hold+10);held++}if(e.k==='lost'){hold-=25;lost++}if(e.k==='death')hold-=8;if(e.k==='take')hold=Math.min(100,hold+6)}hold=Math.min(100,hold+0);
    if(hold<=0&&!fell){fell=d}}
  const r=res[st.trait]=res[st.trait]||{n:0,fell:0,fellDay:0,lost:0,held:0,uniq:new Set()};r.n++;if(fell){r.fell++;r.fellDay+=fell}r.lost+=lost;r.held+=held;r.uniq.add(JSON.stringify([st.walls,st.lvl,st.people]))}
for(const[k,r]of Object.entries(res))console.log(k.padEnd(11),'n',r.n,'fell',r.fell,'avg fall day',r.fell?Math.round(r.fellDay/r.fell):'-','lost',(r.lost/r.n).toFixed(1),'held',(r.held/r.n).toFixed(1),'distinct ends',r.uniq.size);

// One settlement of a given kind, day by day: level, people, tide result, defence against strength, walls.
// Usage: node tools/measure/settlement-trace.mjs [builders|fighters|scavengers|farmers]
import * as St from '../world/settle.mjs';import * as World from '../../js/sim/world.js';
const MULT=[1,1.1,1.2,1.35,1.5,1.7];const trait=process.argv[2]||'scavengers';
let i=0,st;for(let s=1;;s++){for(i=0;i<4;i++){st=St.seedSettlement(s*977,i);if(st.trait===trait)break}if(st.trait===trait)break}
for(let d=1;d<=48;d++){const stage=Math.min(5,Math.floor(d/9));const ev=St.settlementDay(st,{day:d,stage,tideMult:MULT[stage],leads:[]});
 if(ev.length){const S=St.leader(st,MULT[stage]),n=st.tideN,str=World.tideBudget(S,n)*(1+.15*World.tideLevel(S,n))*2;console.log('day',d,'stage',stage,'lvl',st.lvl,'ppl',st.people,ev.map(e=>e.k).join(','),'def',Math.round(St.defence(st)),'str',Math.round(str),JSON.stringify(st.walls))}}

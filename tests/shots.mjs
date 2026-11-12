#!/usr/bin/env node
// Screenshots of the main screens into .out/shots/ for a visual review after art, lighting or interface changes.
// Usage: node tests/shots.mjs [name filter]
import {launch} from '../tools/lib.mjs';
const only=process.argv[2]||'';
const page=await launch({width:1280,height:720,quiet:true,pathName:'/?shots=1'}),ev=js=>page.eval(js),out=[];
const snap=async n=>{if(only&&!n.includes(only))return;await page.sleep(350);out.push(await page.shot(n))};
// a furnished base to look at
const BASE=`(()=>{const{G,World}=GW,S=G.S,Z=G.Z,cx=Math.floor(Z.w/2),cy=Math.floor(Z.h/2);S.p.lvl=40;
  const put=(k,x,y,e)=>{Z.obj[y*Z.w+x]=Object.assign({k,hp:500,r:0},e);};const fl=(k,x,y)=>{Z.fl[y*Z.w+x]=k};
  for(let y=cy-5;y<=cy+5;y++)for(let x=cx-6;x<=cx+6;x++){Z.obj[y*Z.w+x]=null}
  for(let y=cy-3;y<=cy+3;y++)for(let x=cx-4;x<=cx+4;x++)fl(x<cx?'floor_wood':'floor_stone',x,y);
  for(let x=cx-5;x<=cx+5;x++){put(x<cx?'wall_plank':'wall_stone',x,cy-4);put(x===cx?'door_plank':x<cx-2?'wall_stick':'wall_plank',x,cy+4)}
  for(let y=cy-3;y<=cy+3;y++){put('wall_plank',cx-5,y);put(y===cy?'door_stone':'wall_stone',cx+5,y)}
  put('campfire',cx-1,cy+1);put('workbench',cx-4,cy-3);put('furnace',cx-3,cy-3);put('sawbench',cx-2,cy-3);put('chest',cx+4,cy-3,{inv:[]});put('box_small',cx+3,cy-3,{inv:[]});put('bed',cx+4,cy+3);put('loom',cx+1,cy-3);put('forge',cx+2,cy-3);put('tannery',cx-4,cy+3);put('radio',cx-4,cy+1);
  put('garden',cx-8,cy-1,{seed:'seed_carrot',ripe:0});put('garden',cx-8,cy,{seed:'seed_corn',ripe:S.t+9999});put('garden',cx-8,cy+1);put('collector',cx-8,cy-3);put('scarecrow',cx-9,cy);
  put('turret_xbow',cx-2,cy+6,{ammo:50});put('turret_gun',cx+2,cy+6,{ammo:200});put('spikes',cx-1,cy+7);put('spikes',cx,cy+7);put('spikes',cx+1,cy+7);put('barricade',cx-3,cy+7);put('barricade',cx+3,cy+7);put('torch_stand',cx-1,cy+5);put('torch_stand',cx+1,cy+5);put('guard_post',cx+4,cy+6);
  S.veh=3;World.goHome(false);G.Z.pl.x=cx+.5;G.Z.pl.y=cy+2.5;G.ev.push(['zone'])})()`;
try{
  await page.sleep(900);await snap('01-title');
  await ev(`localStorage.clear();GW.api.newGame()`);for(let i=0;i<60&&!(await ev(`GW.UI.panel==='journal'`));i++)await page.sleep(200);await snap('02-journal-first');
  await ev(`GW.UI.close()`);await page.sleep(600);await snap('03-home-start');
  await ev(BASE);await page.sleep(900);await ev(`GW.UI.close()`);await page.sleep(400);await snap('04-base-day');
  await ev(`(()=>{const S=GW.G.S;S.p.eq.w1={id:'fire_axe',d:200};S.p.eq.head={id:'riot_helm',d:100};S.p.eq.body={id:'leather_jacket',d:100};S.p.eq.legs={id:'scrap_greaves',d:100};S.p.eq.pack={id:'pack_hiker'};GW.G.ev.push(['eq']);for(const[id,n]of[['log',30],['plank',40],['stone',22],['iron_bar',9],['cooked_meat',4],['water',5],['bandage',3],['bow',1],['arrow',30],['medkit',2],['seed_potato',4],['rope',8],['nails',60],['bp_shotgun',1],['machete',1]])GW.World.applyFx([['item',id,n]]);GW.G.ev.length=GW.G.ev.filter(e=>e[0]!=='loot').length})()`);
  await ev(`GW.UI.open('inv')`);await page.sleep(200);await page.tap('#pb .sl[data-i="0"]');await snap('05-pack');await ev(`GW.UI.close()`);
  await ev(`(()=>{const Z=GW.G.Z;const i=Z.obj.findIndex(o=>o&&o.k==='workbench');GW.UI.open('craft',i)})()`);await snap('06-craft');await ev(`GW.UI.close()`);
  await ev(`GW.G.S.p.sp=3;GW.UI.open('journal','perks')`);await snap('07-perks');await ev(`GW.UI.close()`);
  await ev(`GW.World.addSurvivor(GW.G.S);GW.G.S.home.pile={log:12,raw_meat:3};GW.UI.open('camp')`);await snap('08-camp');await ev(`GW.UI.close()`);
  await ev(`GW.UI.hot('build')`);await page.click(700,300);await page.sleep(100);await ev(`GW.UI.buildPointer('move',760,380,false)`);await snap('09-build');await ev(`GW.UI.hot('build')`);
  // dusk and night
  await ev(`GW.G.S.t=Math.floor(GW.G.S.t/1440)*1440+19.6*60`);await page.sleep(1200);await snap('10-base-dusk');
  await ev(`GW.G.S.t=Math.floor(GW.G.S.t/1440)*1440+23*60;GW.G.S.tide.at=GW.G.S.t+3000`);await page.sleep(1500);await snap('11-base-night');
  // a tide at the gate
  await ev(`(()=>{const{G}=GW;G.S.tide.n=3;G.S.tide.at=G.S.t+.1;G.S.p.hp=1e5})()`);await page.sleep(9000);await ev(`GW.G.inp.attack=true`);await page.sleep(2500);await snap('12-tide-night');await ev(`GW.G.inp.attack=false`);
  // locations by biome
  const go=async(id,name,pre='')=>{await ev(`(()=>{const{G,World}=GW;G.S.tide.live=null;G.S.tide.at=G.S.t+9e4;G.S.veh=5;G.S.flags.core_dead=1;G.S.p.hp=1e5;G.pending=null;G.S.t=Math.floor(G.S.t/1440)*1440+11*60;G.S.weather={id:'clear',until:G.S.t+900};${pre};G.S.loc['${id}']={n:0};World.arrive('${id}')})()`);await page.sleep(900);await ev(`GW.UI.close();(()=>{const Z=GW.G.Z;Z.pl.y-=9;for(const a of Z.actors)if(a.team===1&&Math.hypot(a.x-Z.pl.x,a.y-Z.pl.y)<16){a.alert=true;a.st='chase'}})()`);await page.sleep(2600);await snap(name)};
  await go('birch_hollow','13-birch-hollow');await go('gas_stop','14-fuel-stop');await go('quarry','15-quarry');await go('market','16-market');await go('mirror_lake','17-mirror-lake','G.S.weather={id:"snow",until:G.S.t+900}');await go('spore_fields','18-spore-fields');
  await ev(`(()=>{const Z=GW.G.Z;Z.pl.y=Z.h-1})()`);await page.sleep(300);await ev(`for(const a of GW.G.Z.actors)if(a.team===1)a.dead=true;GW.World.leaveZone()`);await page.sleep(700);await snap('19-map');
  await ev(`GW.World.arrive('home')`);await page.sleep(600);await ev(`GW.UI.close();GW.UI.open('event','ev_stranger')`);await snap('20-event');await ev(`GW.G.pending=null;GW.UI.close()`);
  await page.send('Emulation.setDeviceMetricsOverride',{width:400,height:860,deviceScaleFactor:2,mobile:true});await ev(`document.getElementById('gw').classList.add('touch');dispatchEvent(new Event('resize'))`);await page.sleep(900);await snap('21-phone-home');
  await ev(`GW.UI.open('inv')`);await snap('22-phone-pack');await ev(`GW.UI.close()`);
  console.log(out.map(f=>'  '+f).join('\n'));if(page.errors.length){console.log('page errors: '+page.errors.slice(0,8).join(' | '));process.exitCode=1}
}catch(e){console.error(e.message,page.errors.slice(0,5));process.exitCode=1}
await page.close();

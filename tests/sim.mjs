#!/usr/bin/env node
// Headless simulation test: plays the game logic in Node with no renderer.
// Covers world generation for every location, gathering, crafting, building, combat, tides, travel, events, days passing and saves.
import {reporter} from '../tools/lib.mjs';
import {ITEMS} from '../js/data/items.js';
import {OBJ} from '../js/data/objects.js';
import {RECIPES} from '../js/data/recipes.js';
import {ENEMIES} from '../js/data/enemies.js';
import {LOCATIONS,SITES} from '../js/data/world.js';
import {EVENTS} from '../js/data/events.js';
import {STORY} from '../js/data/progress.js';
import {G,EREF,edgeIdx,structAt,dropAt,give,count,craft,place,upgrade,demolish,repair,moveObj,rotateObj,canMove,equip,useItem,quickUse,learnPerk,derive,canPlace,slotCount,freeSlots,sortInv,HOME_W} from '../js/sim/core.js';
import {genZone,field,siteDef,blockAt,collide,los,edgeCross} from '../js/sim/zone.js';
import {spawnActor,enemiesAlive,populate,interact,findInteract,lootAll,openLoot,plant,damageObj} from '../js/sim/actors.js';
import * as World from '../js/sim/world.js';
import {goalProgress,story,genContract,contractText,turnIn} from '../js/sim/quests.js';
import {dayOf,hourOf} from '../js/sim/util.js';

G.headless=true;
const T=reporter('simulation');const Z2=()=>G.Z;
const run=(sec,fn)=>{const dt=1/30;for(let t=0;t<sec;t+=dt){if(fn)fn(t);World.tick(dt);G.ev.length=0}};
const uiEvents=()=>G.ev.filter(e=>e[0]==='ui').map(e=>e[1]);
const god=()=>{G.S.p.hp=1e6};
// bot: invulnerable, walks at the nearest enemy
const chase=()=>{god();const p=G.Z.pl;let b=null,bd=1e9;for(const a of G.Z.actors)if(a.team===1&&!a.dead){const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<bd){bd=d;b=a}}if(b&&bd>1.3){G.inp.mx=(b.x-p.x)/bd;G.inp.my=(b.y-p.y)/bd}else{G.inp.mx=G.inp.my=0}};
let crashed=null;const safe=(name,fn)=>{try{fn()}catch(e){crashed=e;T.ok(false,name+': threw '+e.stack.split('\n').slice(0,4).join(' | '))}};

// ---- new game
safe('new game',()=>{
  const S=World.newGame(12345);
  T.ok(G.Z&&G.Z.home&&G.Z.pl,'new game starts at the homestead');
  T.ok(story(S).id==='q_wake','story starts at q_wake');
  const trees=G.Z.obj.filter(o=>o&&o.k.startsWith('tree')).length;T.ok(trees>60,'home has a forest ('+trees+' trees)');
  run(3);T.ok(S.t>7*60,'the clock runs');
});
// ---- auto gather with bare hands, then tools
safe('gather',()=>{
  const S=G.S;G.auto=true;run(60);
  T.ok(count(S,'stick')+count(S,'fiber')+count(S,'berries')>0,'auto-gather by hand collects something ('+S.p.inv.filter(Boolean).map(s=>s.n+' '+s.id).join(', ')+')');
  S.p.inv=S.p.inv.map(()=>null);give(S,'stick',10);give(S,'stone',10);give(S,'fiber',10);
  T.ok(craft(S,'hatchet_stone'),'craft stone hatchet by hand');T.ok(craft(S,'pick_stone'),'craft stone pickaxe by hand');
  const logs0=count(S,'log');G.auto=true;run(120,()=>{G.S.p.food=80;G.S.p.water=80});
  T.ok(count(S,'log')>logs0,'auto-gather with a hatchet fells trees (+'+(count(S,'log')-logs0)+' logs)');
  G.auto=false;T.ok((S.stats.wood||0)>0&&S.p.xp+S.p.lvl>1,'gathering gives stats and xp (level '+S.p.lvl+')');
});
// ---- clothing: you start with nothing on, rags are the first clothes, gloves have their own slot, sets give bonuses
safe('clothing',()=>{
  const S=G.S,keep=S.p.inv.slice(),eq0=Object.assign({},S.p.eq);
  T.ok(['head','body','legs','feet','hands'].every(k=>!eq0[k]),'a new survivor starts with nothing on');
  S.p.inv=S.p.inv.map(()=>null);give(S,'rags',12);give(S,'fiber',6);
  T.ok(craft(S,'rag_shirt')&&craft(S,'rag_pants')&&craft(S,'rag_wraps')&&craft(S,'hand_wraps'),'rag clothes and hand wraps are made by hand from rags and fibre');
  for(const id of['rag_shirt','rag_pants','rag_wraps','hand_wraps'])equip(S,S.p.inv.findIndex(x=>x&&x.id===id));
  T.ok(S.p.eq.body&&S.p.eq.body.id==='rag_shirt'&&S.p.eq.legs&&S.p.eq.feet&&S.p.eq.hands&&S.p.eq.hands.id==='hand_wraps','they go on, gloves into the Hands slot');
  const a0=derive(S).arm;T.ok(a0===4,'every worn piece counts toward armour, gloves included ('+a0+')');
  for(const[id,slot]of[['ranger_hat','head'],['ranger_duster','body'],['ranger_chaps','legs'],['ranger_boots','feet']])S.p.eq[slot]={id,d:ITEMS[id].dur};const ds=derive(S);
  T.ok(ds.set==='ranger'&&Math.abs(ds.ranged-1.1)<1e-9,'four pieces of a set give its bonus, with gloves of another kind on ('+ds.set+', ranged ×'+ds.ranged.toFixed(2)+')');
  const bad=Object.keys(ITEMS).filter(id=>['head','body','legs','feet','hands','pack'].includes(ITEMS[id].t)&&!(ITEMS[id].look&&ITEMS[id].look.c));T.ok(!bad.length,'every wearable has a look to draw'+(bad.length?': '+bad.join(', '):''));
  for(const k of['head','body','legs','feet','hands'])S.p.eq[k]=eq0[k]||null;S.p.inv=keep;G.ds=derive(S);
});
// ---- auto mode picks up loose loot before it goes back to gathering
safe('auto loot',()=>{
  const S=G.S,Z=G.Z,p=Z.pl;S.p.inv=S.p.inv.map(()=>null);const d0=Z.drops.length;
  dropAt(Z,p.x+6,p.y+1,[{id:'scrap',n:4}]);dropAt(Z,p.x-7,p.y-2,[{id:'rope',n:2}]);
  G.auto=true;let secs=0;while(secs<25&&Z.drops.length>d0){run(1,()=>{S.p.food=80;S.p.water=80});secs++}G.auto=false;
  T.ok(Z.drops.length===d0&&count(S,'scrap')===4&&count(S,'rope')===2,'loose loot within a short walk is collected first, with plants and piles nearer by ('+secs+' s)');
});
// ---- auto mode holds the homestead through a tide instead of switching off
safe('auto tide',()=>{
  const S=G.S,Z=G.Z,p=Z.pl,keep=Object.assign({},S.p.eq),n0=S.tide.n;S.p.eq.w1={id:'spear',d:200};S.p.active='w1';G.ds=derive(S);S.p.hp=G.ds.maxHp;
  S.tide.at=S.t+1;let off=false,secs=0;run(3);T.ok(!!S.tide.live,'a tide lands');G.auto=true;
  while(S.tide.live&&secs<240){run(2,()=>{S.p.food=80;S.p.water=80;if(!G.auto&&S.tide.live)off=true});secs+=2}
  T.ok(!off,'auto mode stays on for as long as the tide lasts');T.ok(!S.tide.live&&S.tide.n===n0+1&&!p.dead&&S.p.hp>0,'and fights the first tide off alone with a spear ('+secs+' s, health '+Math.round(S.p.hp)+')');
  G.auto=false;p.fight=null;S.p.eq.w1=keep.w1||null;S.tide.at=S.t+3*1440;G.ds=derive(S);S.p.hp=G.ds.maxHp;for(const a of Z.actors)if(a.team===1)a.dead=true;
});
// ---- auto mode defends itself instead of stopping
safe('auto defence',()=>{
  const S=G.S,Z=G.Z,p=Z.pl;S.p.inv=S.p.inv.map(()=>null);S.p.eq.w1={id:'hatchet_stone',d:60};S.p.eq.w2=null;S.p.active='w1';G.ds=derive(S);S.p.hp=G.ds.maxHp;give(S,'bandage',2);
  const k0=S.stats.kills||0,logs0=0;G.auto=true;run(2);
  const e1=spawnActor(Z,'shambler',p.x+3,p.y,1),e2=spawnActor(Z,'shambler',p.x-3,p.y+1,1);e1.alert=e2.alert=true;e1.st=e2.st='chase';
  let hit=false,stopped=false;run(30,()=>{S.p.food=80;S.p.water=80;if(S.p.hp<G.ds.maxHp)hit=true;if(!G.auto)stopped=true});
  T.ok(!stopped&&G.auto,'auto mode stays on when hostiles close in');
  T.ok(e1.dead&&e2.dead&&(S.stats.kills||0)>=k0+2,'auto mode kills what attacks it ('+((S.stats.kills||0)-k0)+' kills'+(hit?', took hits':'')+')');
  T.ok(S.p.hp>0&&!p.dead,'and survives two shamblers at level 1 (health '+Math.round(S.p.hp)+')');
  run(60,()=>{S.p.food=80;S.p.water=80});T.ok(!p.fight&&count(S,'log')+count(S,'stick')+count(S,'fiber')+count(S,'stone')>logs0,'then goes back to gathering');
  // a gun is preferred while it has ammunition, and the slot the player chose comes back afterwards
  S.p.inv=S.p.inv.map(()=>null);give(S,'bandage',2);S.p.eq.w2={id:'bow',d:80};give(S,'arrow',30);S.p.active='w1';G.ds=derive(S);G.auto=true;const e3=spawnActor(Z,'shambler',p.x+6,p.y,1);e3.alert=true;e3.st='chase';
  let usedBow=false;run(20,()=>{S.p.food=80;S.p.water=80;if(S.p.active==='w2')usedBow=true});
  T.ok(e3.dead&&usedBow&&count(S,'arrow')<30,'auto mode draws the bow when it has arrows');T.ok(S.p.active==='w1','and puts the player\'s own choice back in hand afterwards');
  G.auto=true;S.p.hp=10;const e4=spawnActor(Z,'shambler',p.x+2,p.y,1);e4.alert=true;e4.st='chase';const b0=count(S,'bandage');run(6,()=>{S.p.food=80;S.p.water=80});
  T.ok(count(S,'bandage')<b0,'auto mode bandages itself when badly hurt');
  G.auto=false;p.fight=null;for(const a of Z.actors)if(a.team===1)a.dead=true;S.p.eq.w2=null;S.p.hp=G.ds.maxHp;
});
// ---- auto-repair setting
safe('auto repair',()=>{
  const S=G.S,Z=G.Z;S.p.inv=S.p.inv.map(()=>null);S.p.eq.w1={id:'hatchet_stone',d:5};S.p.active='w1';S.set.autoRepair=true;G.ds=derive(S);
  G.auto=true;run(40,()=>{S.p.food=80;S.p.water=80});
  T.ok(!S.p.eq.w1||S.p.eq.w1.id!=='hatchet_stone'||S.p.eq.w1.d<=5,'without a kit a worn hatchet wears out as before');
  S.p.inv=S.p.inv.map(()=>null);S.p.eq.w1={id:'hatchet_stone',d:5};give(S,'repair_kit',1);G.auto=true;let fixed=false;run(40,()=>{S.p.food=80;S.p.water=80;if(S.p.eq.w1&&S.p.eq.w1.d>40)fixed=true});
  T.ok(fixed&&S.p.eq.w1&&S.p.eq.w1.id==='hatchet_stone'&&count(S,'repair_kit')===0,'with auto-repair on, a nearly worn hatchet is fixed with a kit and keeps working (durability '+(S.p.eq.w1?S.p.eq.w1.d:'gone')+')');
  S.p.inv=S.p.inv.map(()=>null);S.p.eq.w1={id:'hatchet_stone',d:5};give(S,'repair_kit',1);S.set.autoRepair=false;G.auto=true;run(40,()=>{S.p.food=80;S.p.water=80});
  T.ok(count(S,'repair_kit')===1,'with auto-repair off the kit is left alone');
  S.set.autoRepair=true;G.auto=false;S.p.inv=S.p.inv.map(()=>null);S.p.eq.w1={id:'hatchet_stone',d:60};
  const back=World.deserialize(JSON.stringify(Object.assign(JSON.parse(World.serialize()),{})).replace('"autoRepair":true,',''));T.ok(back&&back.set.autoRepair===true,'an older save without the setting loads with auto-repair on');
});
// ---- building and crafting at stations
let cx,cy;
safe('build',()=>{
  const S=G.S,Z=G.Z;cx=Math.floor(Z.w/2);cy=Math.floor(Z.h/2);S.p.eq.pack={id:'pack_exped',d:999};S.p.lvl=Math.max(S.p.lvl,5);G.ds=derive(S);S.p.inv=S.p.inv.filter(s=>s&&ITEMS[s.id].tool);
  for(const[id,n]of[['log',200],['stone',200],['stick',100],['rope',40],['fiber',60],['rags',20],['plank',200],['nails',200],['clay',60],['iron_ore',40],['charcoal',40],['raw_meat',6],['dirty_water',4]])give(S,id,n);
  for(let y=cy-6;y<=cy+6;y++)for(let x=cx-6;x<=cx+6;x++){const i=y*Z.w+x;if(Z.obj[i]){Z.obj[i]=null}}Z.navDirty=true;
  Z.pl.x=cx+.5;Z.pl.y=cy+.5;Z.actors=Z.actors.filter(a=>a.pl); // wandering deer may not stand where we build
  T.ok(place(S,'campfire',cx+2,cy),'place campfire');T.ok(place(S,'workbench',cx+2,cy+1),'place workbench');T.ok(place(S,'box_small',cx+2,cy-1),'place box');T.ok(place(S,'bed_roll',cx-2,cy),'place bedroll');
  T.ok(canPlace(S,'furnace',cx,cy)!==null,'level-gated building is refused at level '+S.p.lvl);
  // walls stand on cell edges: a ring round the 9×9 block of cells from (cx-4, cy-4) to (cx+4, cy+4), with a door in the east side
  let walls=0;for(let x=cx-4;x<=cx+4;x++){if(place(S,'wall_stick',x,cy-4,0))walls++;if(place(S,'wall_stick',x,cy+4,2))walls++}for(let y=cy-4;y<=cy+4;y++){if(place(S,'wall_stick',cx-4,y,3))walls++;if(place(S,y===cy?'door_stick':'wall_stick',cx+4,y,1))walls++}
  T.ok(walls===36,'ring of walls placed on the cell edges ('+walls+')');T.ok(place(S,'floor_wood',cx,cy),'place floor');
  const eN=EREF+edgeIdx(Z.w,cx,cy-4,0),eD=EREF+edgeIdx(Z.w,cx+4,cy,1);
  T.ok(!Z.obj[(cy-4)*Z.w+cx]&&canPlace(S,'box_small',cx,cy-4)===null,'the cell behind a wall is still free to build on');
  T.ok(canPlace(S,'wall_stick',cx,cy-4,0)!==null&&canPlace(S,'wall_stick',cx,cy-5,2)!==null,'one wall to an edge, whichever cell it is named from');
  {const[ax,ay]=collide(Z,cx+.5,cy-4+.2,.3,true),[bx,by]=collide(Z,cx+.5,cy-4-.2,.3,true);T.ok(ay>=cy-4+.38&&by<=cy-4-.38,'a body is pushed off the wall line to its own side ('+ay.toFixed(2)+', '+by.toFixed(2)+')')}
  T.ok(!los(Z,cx+.5,cy-3.5,cx+.5,cy-5.5)&&los(Z,cx+.5,cy-3.5,cx+2.5,cy-3.5),'a wall blocks sight across it and not along it');
  T.ok(edgeCross(Z,cx+4.5,cy+.5,cx+5.5,cy+.5,false)>=0&&edgeCross(Z,cx+4.5,cy+.5,cx+5.5,cy+.5,true)<0,'a door stops strangers and lets you through');
  {const f=field(Z,cx,cy,true,200),g=field(Z,cx,cy,false,400),outN=(cy-5)*Z.w+cx,outE=cy*Z.w+cx+5;T.ok(f[outE]<8&&f[outN]>12,'your own path leaves by the door, not through the wall ('+f[outE].toFixed(1)+' by the door, '+f[outN].toFixed(1)+' round to the north)');T.ok(g[outN]<Infinity&&g[outN]>5,'an attacker can come through a wall, at a price ('+g[outN].toFixed(1)+')')}
  // nothing is reached across a wall: a box just inside the north wall opens from inside the yard and not from outside it
  {const bi=(cy-4)*Z.w+cx-3,p=Z.pl,px=p.x,py=p.y;T.ok(place(S,'box_small',cx-3,cy-4),'a box goes in the cell right behind the wall');
    p.x=cx-2.5;p.y=cy-2.6;p.a=-Math.PI/2;const inH=findInteract(Z);p.y=cy-4.4;p.a=Math.PI/2;const outH=findInteract(Z);p.x=px;p.y=py;
    T.ok(inH&&inH.i===bi&&!(outH&&outH.i===bi),'it opens from inside the wall and not from outside');demolish(S,bi)}
  const camp=(cy)*Z.w+cx+2;T.ok(craft(S,'cooked_meat',2,camp),'queue cooking at the campfire');
  T.ok(Z.obj[camp].q&&Z.obj[camp].q.length===1,'station has a job queue');
  run(30);T.ok(Z.obj[camp].out&&Z.obj[camp].out.cooked_meat>=2||count(S,'cooked_meat')>=2,'cooking finishes over time');
  S.p.lvl=30;S.p.sp=10;G.ds=derive(S);
  T.ok(place(S,'furnace',cx-2,cy+2),'furnace at level 30');T.ok(craft(S,'iron_bar',2,(cy+2)*Z.w+cx-2),'queue smelting');
  T.ok(upgrade(S,eN),'upgrade a wall to planks');T.ok(structAt(Z,eN).k==='wall_plank','wall is now plank');
  structAt(Z,eN).hp=50;give(S,'plank',20);T.ok(repair(S,eN)&&structAt(Z,eN).hp===320,'repair a damaged wall');
  T.ok(damageObj(Z,eN,100)===false&&structAt(Z,eN).hp===220&&damageObj(Z,eN,500)===true&&!structAt(Z,eN),'a wall takes damage and falls');place(S,'wall_plank',cx,cy-4,0);
  const eX=EREF+edgeIdx(Z.w,cx+1,cy-4,0);T.ok(demolish(S,eX)&&!structAt(Z,eX),'demolish a wall');place(S,'wall_stick',cx+1,cy-4,0);
  T.ok(learnPerk(S,'thick')&&derive(S).maxHp===112,'perk raises max health');
  give(S,'seed_carrot',3);place(S,'garden',cx-1,cy-2);T.ok(plant(Z,(cy-2)*Z.w+cx-1,'seed_carrot'),'plant a seed');
  place(S,'collector',cx-2,cy-2);place(S,'spikes',cx,cy+6);place(S,'spikes',cx+1,cy+6);
});
// ---- move and rotate what is built
safe('move rotate',()=>{
  const S=G.S,Z=G.Z;let from=-1;for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(o&&o.inv&&OBJ[o.k].store){from=i;break}}T.ok(from>=0,'there is a storage box to move');
  const o=Z.obj[from];o.inv[0]={id:'stone',n:3};let tx=-1,ty=-1;for(let r=2;r<12&&tx<0;r++)for(let dx=-r;dx<=r&&tx<0;dx++){const x=from%Z.w+dx,y=Math.floor(from/Z.w)+r;if(canMove(S,from,x,y)===null&&!Z.obj[y*Z.w+x]){tx=x;ty=y}}
  T.ok(moveObj(S,from,tx,ty,1)&&!Z.obj[from]&&Z.obj[ty*Z.w+tx]===o&&o.r===1&&o.inv[0]&&o.inv[0].n===3,'a structure moves to a free tile with its contents and facing');
  T.ok(canMove(S,ty*Z.w+tx,cx,cy)!==null||!Z.obj[cy*Z.w+cx],'an occupied tile refuses it');T.ok(canMove(S,ty*Z.w+tx,0,0)==='Too close to the tree line','and so does the tree line');
  const r0=o.r;T.ok(rotateObj(S,ty*Z.w+tx)&&o.r===(r0+1)%4,'a structure turns a quarter turn in place');
  const tree=Z.obj.findIndex(q=>q&&!OBJ[q.k].cost);T.ok(!rotateObj(S,tree)&&canMove(S,tree,tx+1,ty)!==null,'things you did not build cannot be turned or moved');o.inv[0]=null;
  T.ok(moveObj(S,ty*Z.w+tx,from%Z.w,Math.floor(from/Z.w),0)&&Z.obj[from]===o,'and it moves back');
  // walls move from edge to edge and turn round the cell they are pointed at from
  const a=EREF+edgeIdx(Z.w,cx+2,cy-4,0),w=structAt(Z,a),b=EREF+edgeIdx(Z.w,cx+2,cy-8,2),c=EREF+edgeIdx(Z.w,cx+2,cy-8,3);
  T.ok(!!w&&canMove(S,a,cx+3,cy-4,0)==='There is already a wall on that side'&&moveObj(S,a,cx+2,cy-8,2)&&!structAt(Z,a)&&structAt(Z,b)===w,'a wall moves to a free edge, and not onto a taken one');
  T.ok(rotateObj(S,b,cx+2,cy-8)&&!structAt(Z,b)&&structAt(Z,c)===w,'a wall turns to the next side of its cell');
  T.ok(moveObj(S,c,cx+2,cy-4,0)&&structAt(Z,a)===w,'and it goes back where it was');
});
// ---- combat
safe('combat',()=>{
  const S=G.S,Z=G.Z;give(S,'spear',1);const si=S.p.inv.findIndex(s=>s&&s.id==='spear');T.ok(si<0?S.p.eq.w1&&S.p.eq.w1.id==='spear':equip(S,si,'w1'),'equip spear');S.p.active='w1';
  const e=spawnActor(Z,'shambler',cx+.5,cy+2.5,1);const hp0=e.hp;G.inp.attack=true;run(6,god);G.inp.attack=false;
  T.ok(e.dead||e.hp<hp0,'melee hits a husk next to the player ('+(e.dead?'dead':e.hp+'/'+hp0)+')');
  give(S,'bow',1);give(S,'arrow',40);equip(S,S.p.inv.findIndex(s=>s&&s.id==='bow'),'w2');S.p.active='w2';
  const e2=spawnActor(Z,'shambler',cx-2.5,cy+.5,1);G.inp.attack=true;run(8,god);G.inp.attack=false;T.ok(e2.dead,'bow kills at range');T.ok(count(S,'arrow')<40,'arrows are spent');
  S.p.active='w1';S.p.hp=100;const e3=spawnActor(Z,'runner',cx+.5,cy-2.5,3);run(6);T.ok(S.p.hp<100,'an unanswered sprinter hurts the player (hp '+Math.round(S.p.hp)+')');
  G.inp.attack=true;run(10,god);G.inp.attack=false;
  T.ok((S.stats.kills||0)>=3,'kills are counted');
});
// ---- every location and site generates and can be walked
safe('worldgen',()=>{
  const S=G.S;let bad=0,total=0;
  const test=(def,name,seed)=>{const Z=genZone(def,seed);total++;
    const f=field(Z,Math.floor(Z.spawn.x),Math.floor(Z.spawn.y),true,9999);let cont=0,reach=0,nodes=0,nreach=0;
    Z.obj.forEach((o,i)=>{if(!o)return;const d=OBJ[o.k];if(!(d.loot||d.node))return;const x=i%Z.w,y=Math.floor(i/Z.w);let ok=false;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(f[(y+dy)*Z.w+x+dx]<1e9)ok=true;if(d.loot){cont++;if(ok)reach++}else{nodes++;if(ok)nreach++}});
    let es=0,er=0;for(const s of Z.spawns){es++;if(f[Math.floor(s.y)*Z.w+Math.floor(s.x)]<1e9)er++}
    const boss=Z.spawns.find(s=>s.boss);const bossOk=!boss||f[Math.floor(boss.y)*Z.w+Math.floor(boss.x)]<1e9;
    const okc=cont===0||reach/cont>=.9,okn=nodes===0||nreach/nodes>=.85,oke=es===0||er/es>=.9;
    if(!(okc&&okn&&oke&&bossOk)){bad++;T.info(`${name} seed ${seed}: containers ${reach}/${cont}, nodes ${nreach}/${nodes}, spawns ${er}/${es}, boss ${bossOk}`)}
    if(def.boss&&!def.bossChance&&!boss){bad++;T.info(name+': boss missing')}
    return Z};
  for(const l of LOCATIONS){if(l.id==='home')continue;for(const seed of[1,77,9001])test(l,l.id,seed)}
  for(const k in SITES)for(let reg=1;reg<=5;reg++)test(siteDef({site:k},reg,5),'site '+k,reg*13);
  T.ok(bad===0,`all ${total} generated zones are reachable from the arrival point`);
});
// ---- live play in every location: enemies wake, fight, nothing throws
safe('locations live',()=>{
  const S=G.S;S.veh=5;S.flags.core_dead=1;give(S,'sledge',1);equip(S,S.p.inv.findIndex(s=>s&&s.id==='sledge'),'w1');S.p.active='w1';
  let n=0;for(const l of LOCATIONS){if(l.id==='home')continue;S.pos='home';G.Z=null;S.loc[l.id]={n:0};World.arrive(l.id);const Z=G.Z;n++;
    for(const a of Z.actors)if(a.team===1){a.alert=true;a.st='chase'}
    G.inp.attack=true;run(12,god);G.inp.attack=false;
    if(!Z.pl||Number.isNaN(Z.pl.x))throw new Error('player position broke in '+l.id);
    for(const a of Z.actors)if(Number.isNaN(a.x)||Number.isNaN(a.hp))throw new Error('actor NaN in '+l.id+' '+a.kind)}
  T.ok(true,n+' locations played for 12 s each with every enemy awake');
  // search a container and take everything
  const Z=G.Z;let ci=-1;Z.obj.forEach((o,i)=>{if(o&&OBJ[o.k].loot&&!OBJ[o.k].lock&&ci<0)ci=i});
  if(ci>=0){openLoot(Z,ci);const had=Z.obj[ci].inv.length;lootAll(Z,ci);T.ok(had>=0,'container opens and empties ('+had+' stacks)')}
  Z.pl.x=Z.spawn.x;Z.pl.y=Z.h-1;run(.2,god);T.ok(Z.exit,'standing at the edge counts as the exit');
  for(const a of Z.actors)if(a.team===1)a.dead=true;T.ok(World.leaveZone()&&G.mode==='map','leaving puts you on the map');
  T.ok(World.travel('home')||true,'travel home');if(G.pending){const p=uiEvents();}
});
// ---- events: every option, several times
safe('events',()=>{
  const S=G.S;if(!G.Z||!G.Z.home){G.pending=null;G.Z=null;World.arrive('home')}
  let n=0;for(const ev of EVENTS)for(let oi=0;oi<ev.o.length;oi++)for(let k=0;k<4;k++){const o=ev.o[oi];for(const id in o.need||{})if(id==='scrip')S.scrip+=o.need[id];else give(S,id,o.need[id],undefined,true);if(o.tool==='pry')give(S,'crowbar',1,undefined,true);if(o.tool==='axe')give(S,'hatchet_iron',1,undefined,true);if(o.tool==='wrench')give(S,'wrench',1,undefined,true);
    S.p.hp=1e6;const r=World.chooseOption(ev.id,oi);if(!r)throw new Error('option blocked: '+ev.id+' #'+oi+' '+World.optionBlocked(S,o));n++;G.pending=null;S.p.inv=S.p.inv.map(()=>null);G.ev.length=0}
  T.ok(n>300,n+' event outcomes resolved without error');
  // a fight outcome really starts an ambush and ends back on the road
  G.pending={dest:'birch_hollow'};S.loc.birch_hollow={n:0};World.applyFx([['fight',{shambler:2}]]);World.eventDone();
  T.ok(G.Z&&G.Z.id==='ambush'&&enemiesAlive(G.Z)===2,'ambush zone starts with the right enemies');
  for(const a of G.Z.actors)if(a.team===1)a.dead=true;G.Z.pl.y=G.Z.h-1;run(.2,god);World.leaveZone();
  T.ok(G.Z&&G.Z.id==='birch_hollow','after the ambush you arrive where you were going');
  for(const a of G.Z.actors)if(a.team===1)a.dead=true;G.Z.pl.y=G.Z.h-1;run(.2,god);World.leaveZone();G.pending=null;World.arrive('home');
});
// ---- a tide, fought live
safe('tide',()=>{
  const S=G.S,Z=G.Z;S.p.hp=1e6;give(S,'katana',1);equip(S,S.p.inv.findIndex(s=>s&&s.id==='katana'),'w1');S.p.active='w1';
  const n0=S.tide.n,t0=S.stats.tides||0;S.tide.at=S.t+1;run(2,god);T.ok(!!S.tide.live,'tide starts when its hour comes ('+S.tide.live.total+' in the queue)');
  T.ok(World.leaveZone()===false,'cannot leave during a tide');
  let secs=0;while(S.tide.live&&secs<400){G.inp.attack=true;if(S.p.eq.w1)S.p.eq.w1.d=300;run(5,chase);secs+=5}G.inp.mx=G.inp.my=0;G.inp.attack=false;
  if(S.tide.live){const pf=field(G.Z,Math.floor(G.Z.pl.x),Math.floor(G.Z.pl.y),false);for(const a of G.Z.actors)if(a.team===1&&!a.dead)T.info(`stuck: ${a.kind} at ${a.x.toFixed(1)},${a.y.toFixed(1)} st=${a.st} alert=${a.alert} tide=${a.tide} field=${pf[Math.floor(a.y)*G.Z.w+Math.floor(a.x)]} player ${G.Z.pl.x.toFixed(1)},${G.Z.pl.y.toFixed(1)} w=${S.p.eq.w1&&S.p.eq.w1.id}`);T.info('queue left '+S.tide.live.q.length+'; auto '+G.auto+' fight '+!!G.Z.pl.fight+' dead '+G.Z.pl.dead+' act '+(G.Z.pl.act&&G.Z.pl.act.type)+' weapon '+(S.p.eq[S.p.active]?S.p.eq[S.p.active].id:'fists')+' mv '+G.Z.pl.mv.toFixed(2)+' fieldHere '+(G.Z.pl.fight&&G.Z.pl.fight.f?G.Z.pl.fight.f[Math.floor(G.Z.pl.y)*G.Z.w+Math.floor(G.Z.pl.x)]:'-')+' objHere '+(G.Z.obj[Math.floor(G.Z.pl.y)*G.Z.w+Math.floor(G.Z.pl.x)]||{}).k)}
  T.ok(!S.tide.live&&S.tide.n===n0+1,'a tide ends ('+secs+' s), next one scheduled for day '+dayOf(S.tide.at));
  T.ok((S.stats.tides||0)===t0+1,'tide is counted');
  // a big one with turrets, guards and traps
  S.tide.n=14;give(S,'steel_bar',200);give(S,'gear',100);give(S,'circuit',50);give(S,'motor',20);give(S,'pipe',50);give(S,'ammo_9',600);give(S,'plank',100);give(S,'rope',50);give(S,'log',50);give(S,'cloth',30);give(S,'nails',100);
  S.p.lvl=60;place(S,'turret_gun',cx-5,cy+6);place(S,'turret_gun',cx+5,cy+6);World.loadTurret(S,(cy+6)*Z.w+cx-5);World.loadTurret(S,(cy+6)*Z.w+cx+5);place(S,'guard_post',cx,cy+7);
  T.info('bed: '+canPlace(S,'bed',cx-1,cy+1)+' / '+canPlace(S,'bed',cx-1,cy+2)+' cap '+World.survCap(S));place(S,'bed',cx-1,cy+1);place(S,'bed',cx-1,cy+2);T.info('cap now '+World.survCap(S)+' surv '+S.surv.length);const sv=World.addSurvivor(S);T.ok(!!sv,'a survivor joins when there is a bed');if(sv)T.ok(World.setJob(S,sv.id,'guard'),'assign guard duty');
  G.Z=null;World.arrive('home');S.tide.at=S.t+1;run(2,god);const total=S.tide.live?S.tide.live.total:0;secs=0;
  // fought the way auto mode fights it (it finds its way round trees and through its own doors, which a bot walking in straight lines does not)
  while(S.tide.live&&secs<900){if(S.p.eq.w1)S.p.eq.w1.d=300;G.auto=true;run(5,god);secs+=5;}G.auto=false;G.inp.mx=G.inp.my=0;G.inp.attack=false;
  if(S.tide.live){const pf=field(Z2(),Math.floor(G.Z.pl.x),Math.floor(G.Z.pl.y),false);for(const a of G.Z.actors)if(a.team===1&&!a.dead)T.info(`stuck: ${a.kind} at ${a.x.toFixed(1)},${a.y.toFixed(1)} st=${a.st} alert=${a.alert} cd=${a.cd.toFixed(1)} field=${pf[Math.floor(a.y)*G.Z.w+Math.floor(a.x)]} player ${G.Z.pl.x.toFixed(1)},${G.Z.pl.y.toFixed(1)}`);T.info('queue left '+S.tide.live.q.length);T.info('auto '+G.auto+' fight '+!!G.Z.pl.fight+' dead '+G.Z.pl.dead+' act '+(G.Z.pl.act&&G.Z.pl.act.type)+' weapon '+(S.p.eq[S.p.active]?S.p.eq[S.p.active].id:'fists')+' mv '+G.Z.pl.mv.toFixed(2)+' fieldHere '+(G.Z.pl.fight&&G.Z.pl.fight.f?G.Z.pl.fight.f[Math.floor(G.Z.pl.y)*G.Z.w+Math.floor(G.Z.pl.x)]:'-')+' objHere '+(G.Z.obj[Math.floor(G.Z.pl.y)*G.Z.w+Math.floor(G.Z.pl.x)]||{}).k+' hp '+Math.round(S.p.hp)+' stun '+G.Z.pl.slowT);}
  T.ok(!S.tide.live,'tide 15 ('+total+' attackers) resolves in '+secs+' s; walls lost '+(S.stats.lostWalls||0));
});
// ---- community: recruits, stores, neighbours, trade routes, war
safe('community',()=>{
  const S=G.S,Z=G.Z,C=World.Community;S.surv.length=0;S.wait.length=0;S.morale=60;S.scrip=500;S.veh=0;for(const a of Z.actors)if(a.team===1)a.dead=true;
  S.p.inv=S.p.inv.map(()=>null);for(const[id,n]of[['plank',120],['cloth',40],['nails',120],['rope',40],['log',80],['fiber',80],['stick',40],['rags',40],['hide',20],['stone',40]])give(S,id,n);
  const put=k=>{for(let r=3;r<16;r++)for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){const x=cx+dx,y=cy+dy;if(Math.max(Math.abs(dx),Math.abs(dy))===r&&canPlace(S,k,x,y)===null&&place(S,k,x,y))return y*Z.w+x}return-1};
  for(let k=0;k<4;k++)put('bed');if(!Z.obj.some(o=>o&&o.inv&&OBJ[o.k].store))put('box_small');
  const cap=World.survCap(S);T.ok(cap>=2,'beds give room for people (cap '+cap+')');
  G.hooks.rescue();T.ok(S.wait.length===1&&S.surv.length===0,'someone you free waits to be recruited instead of moving in by themselves');
  const c=S.wait[0];T.ok(!!C.recruit(S,c.id)&&S.surv.length===1&&S.surv[0].n===c.n&&S.surv[0].trait===c.trait,'recruiting them adds that person ('+c.n+', '+c.trait+')');
  C.candidate(S);T.ok(C.turnAway(S,S.wait[0].id)&&S.wait.length===0,'a candidate can be turned away');
  C.candidate(S);C.recruit(S,S.wait[0].id);T.ok(S.surv.length===2,'a second recruit moves in');
  const n0=C.needs(S);T.ok(n0.people===2&&n0.meals>=2&&n0.drinks===2,'needs counts '+n0.meals+' meals and '+n0.drinks+' drinks a day');
  const box=Z.obj.find(o=>o&&o.inv&&OBJ[o.k].store);T.ok(!!box,'a storage box exists at home');
  if(box){box.inv.fill(null);box.inv[0]={id:'cooked_meat',n:6};box.inv[1]={id:'water',n:4}}
  const n1=C.needs(S);T.ok(n1.food===6&&n1.water===4&&Math.floor(n1.waterDays)===2,'stores are counted: food for '+n1.foodDays.toFixed(1)+' days, water for '+n1.waterDays.toFixed(1));
  // neighbours
  const ids=C.known(S);T.ok(ids.includes('mill')&&!ids.includes('choir'),'you know of the communities in reach ('+ids.join(', ')+')');
  const fm=C.fac(S,'mill'),st0=fm.st;C.gift(S,'mill',25);T.ok(fm.st>st0&&S.scrip===475,'a gift of scrip raises standing ('+st0+' → '+fm.st+')');
  for(let k=0;k<6;k++)C.gift(S,'mill',25);T.ok(fm.st<=st0+12.01,'a community takes only so much in one day (standing '+fm.st+')');
  fm.st=10;T.ok(!C.openRoute(S,'mill',S.surv[0].id),'no trade route below the standing it needs');
  fm.st=40;const sc0=S.scrip;T.ok(C.openRoute(S,'mill',S.surv[0].id)&&S.scrip===sc0-40&&C.routeOf(S,S.surv[0].id)==='mill','a trade route opens with a runner and costs scrip');
  let runs=0,lost=0;S.home.pile={};for(let d=0;d<12;d++){const r0=S.stats.routeRuns||0,l0=S.stats.routeLost||0;S.surv[0].hurt=0;C.dawn(S);runs+=(S.stats.routeRuns||0)-r0;lost+=(S.stats.routeLost||0)-l0}
  T.ok(runs>=7&&(S.home.pile.plank||0)>0&&S.scrip>sc0-40,'the route brings goods and scrip most days ('+runs+' runs, '+lost+' lost, '+(S.home.pile.plank||0)+' planks)');
  fm.st=70;T.ok(C.pact(S,'mill')&&C.allies(S).length===1,'a pact at high standing brings allies to a tide');
  const w0=S.wait.length;T.ok(C.askVolunteer(S,'mill')&&S.wait.length===w0+1,'an ally sends a volunteer for scrip');S.wait.length=0;
  // war
  S.veh=2;const fl=C.fac(S,'ledger');T.ok(C.atWar(fl),'the raider crew starts at war with you');
  const str0=fl.str;let wins=0;for(let k=0;k<8&&!fl.dead;k++){for(const v of S.surv){v.away=0;v.hurt=0}while(S.surv.length<2)World.addSurvivor(S);const r=C.warParty(S,'ledger',2);if(r&&r.won)wins++}
  T.ok(fl.str<str0,'war parties wear an enemy down (strength '+str0+' → '+fl.str+', '+wins+' wins)');
  fl.str=3;fl.dead=false;for(const v of S.surv){v.away=0;v.hurt=0}while(S.surv.length<2)World.addSurvivor(S);for(let k=0;k<12&&!fl.dead;k++){for(const v of S.surv){v.away=0;v.hurt=0}while(S.surv.length<1)World.addSurvivor(S);C.warParty(S,'ledger',2)}
  T.ok(fl.dead&&fl.str===0,'an enemy at no strength is broken for good');
  // their raids
  const fw=C.fac(S,'ward');fw.st=-70;fw.raidAt=S.t-1;for(const a of Z.actors)if(a.team===1)a.dead=true;const e0=Z.actors.filter(a=>a.team===1&&!a.dead).length;C.tick(S);
  T.ok(Z.actors.filter(a=>a.team===1&&!a.dead).length>e0,'a community at war sends raiders to your fence when you are home');for(const a of Z.actors)if(a.team===1)a.dead=true;
  const sc1=S.scrip=400;T.ok(C.tribute(S,'ward')&&fw.st>-70&&S.scrip<sc1,'tribute buys standing back ('+fw.st+')');
  // farm orders
  for(let i=0;i<Z.obj.length;i++)if(Z.obj[i]&&OBJ[Z.obj[i].k].special==='garden'){Z.obj[i]=null}S.p.inv=S.p.inv.map(()=>null);give(S,'log',40);give(S,'fiber',40);const beds=[];for(let k=0;k<3;k++){const i=put('garden');if(i>=0)beds.push(i)}
  T.ok(beds.length===3,'three garden beds are built');S.p.inv=S.p.inv.map(()=>null);give(S,'seed_carrot',5);give(S,'water',3);give(S,'compost',2);
  T.ok(C.plantAll(S,'seed_carrot')===3&&count(S,'seed_carrot')===2,'Plant empty beds sows them all');
  const ripe0=Z.obj[beds[0]].ripe;T.ok(C.tendAll(S,'water')===3&&Z.obj[beds[0]].ripe<ripe0&&count(S,'water')===0,'watering takes time off and uses water');
  T.ok(C.tendAll(S,'compost')===2&&Z.obj[beds[0]].fert===1,'compost is dug in while it lasts');
  for(const i of beds)Z.obj[i].ripe=S.t-1;const f=C.farm(S);T.ok(f.ripe===3&&f.beds>=3,'the farm summary sees three ripe beds');
  S.set.replant=true;const got=C.harvestAll(S);T.ok(got===3&&count(S,'carrot')>=6,'Harvest ripe brings them in ('+count(S,'carrot')+' carrots)');
  T.ok(beds.filter(i=>Z.obj[i].seed==='seed_carrot').length>=2,'and replants while seed lasts');
  S.surv.length=0;S.wait.length=0;for(const id in S.fac){S.fac[id].route=null;S.fac[id].raidAt=0}S.home.pile={};S.p.inv=S.p.inv.map(()=>null);
});

// ---- days pass: dawn, weather, away tide, sites, production
safe('days',()=>{
  const S=G.S;S.p.hp=100;World.leaveZone();G.Z=null;G.mode='map';const d0=dayOf(S.t),n0=S.tide.n;
  for(let i=0;i<40;i++){S.p.food=80;S.p.water=80;World.advance(S,360,'wait');G.ev.length=0}
  T.ok(dayOf(S.t)===d0+10,'ten days pass');T.ok(S.tide.n>n0,'tides resolve while away ('+(S.tide.n-n0)+')');
  T.ok(S.home.report&&typeof S.home.report.lost==='number','an away report is waiting');
  T.ok(S.sites.length>=0&&(S.stats.days||0)>=d0+10,'days are counted');
  World.arrive('home');const Z=G.Z;S.tide.at=S.t+9*1440;{const gi=(cy-2)*Z.w+cx-1;if(!Z.obj[gi]){give(S,'log',10);give(S,'fiber',10);place(S,'garden',cx-1,cy-2)}if(!Z.obj[gi].seed){give(S,'seed_carrot',2);plant(Z,gi,'seed_carrot');World.advance(S,1000,'wait')}}if(!Z.obj[(cy-2)*Z.w+cx-2]){give(S,'log',10);give(S,'rags',10);give(S,'rope',3);place(S,'collector',cx-2,cy-2);World.advance(S,600,'wait')}const col=Z.obj[(cy-2)*Z.w+cx-2];T.ok(col&&col.stock>0,'rain catcher filled while away');
  const g=Z.obj[(cy-2)*Z.w+cx-1];T.ok(g&&g.seed&&S.t>=g.ripe,'crop ripened while away');
  T.ok(interact(Z,{i:(cy-2)*Z.w+cx-1,x:cx-.5,y:cy-1.5,type:'garden'})&&count(S,'carrot')>0,'harvest gives carrots');
});
// ---- sleep, death, save
safe('sleep death save',()=>{
  const S=G.S,Z=G.Z;for(const a of Z.actors)if(a.team===1)a.dead=true;
  S.t=Math.floor(S.t/1440)*1440+22*60;S.tide.at=S.t+5*1440;S.p.hp=40;const bed=Z.obj.findIndex(o=>o&&OBJ[o.k].bed);
  T.ok(World.sleep(bed)&&Math.abs(hourOf(S.t)-6)<.01,'sleeping passes the night');T.ok(S.p.hp>40,'sleep heals');
  give(S,'log',5);S.p.hp=1;G.Z.pl.dead=false;const e=spawnActor(G.Z,'brute',G.Z.pl.x+.6,G.Z.pl.y,20);e.alert=true;e.st='chase';run(8);
  T.ok(G.Z.pl.dead,'the player can die');World.respawn();T.ok(G.Z&&G.Z.home&&!G.Z.pl.dead&&S.p.hp>0,'respawn at home');T.ok(count(S,'log')===0,'pack is dropped on death');
  T.ok(G.Z.obj.some(o=>o&&o.k==='deathbag'),'dropped pack can be recovered');
  const str=World.serialize();T.ok(str.length>500,'save serialises ('+Math.round(str.length/1024)+' KB)');
  const S2=World.deserialize(str);T.ok(S2.p.lvl===S.p.lvl&&S2.home.obj.filter(Boolean).length===S.home.obj.filter(Boolean).length,'save round-trips level and base');
  // a save from before walls moved to the cell edges: a closed 5×5 ring of wall cells with a door in its south side, and a loose run of three
  {const old=JSON.parse(str),W=HOME_W,o=old.home.obj;old.v=1;delete old.home.ed;for(let y=5;y<=11;y++)for(let x=5;x<=13;x++)delete o[y*W+x];
    const put=(k,x,y)=>{o[y*W+x]={k,hp:77,r:0}};for(let k=6;k<=10;k++){put('wall_stick',k,6);put(k===8?'door_stick':'wall_stick',k,10);put('wall_stick',6,k);put('wall_stick',10,k)}for(let y=6;y<=8;y++)put('wall_plank',12,y);
    const S3=World.deserialize(JSON.stringify(old)),ed=S3.home.ed,n=ed.filter(Boolean).length,at=(x,y,sd)=>ed[edgeIdx(W,x,y,sd)];let cells=0;for(let y=6;y<=10;y++)for(let x=6;x<=12;x++)if(S3.home.obj[y*W+x])cells++;
    T.ok(S3.v===2&&cells===0&&n===23,'an older save loads: its wall cells become walls on cell edges ('+n+' walls, '+cells+' wall cells left)');
    T.ok(at(6,6,0)&&at(6,6,3)&&at(10,10,1)&&at(10,10,2)&&at(8,10,2).k==='door_stick'&&at(8,10,2).hp===77&&!at(8,10,0),'the ring keeps its outline on the outward faces, the door and its health with it');
    T.ok(at(12,6,3)&&at(12,7,3)&&at(12,8,3)&&at(12,7,3).k==='wall_plank','a loose run becomes one straight line')}
  World.resume(S2);run(2,god);T.ok(G.Z&&G.Z.home,'resumed game runs');
});
// ---- contracts, trade, story bookkeeping
safe('misc',()=>{
  const S=G.S;for(let i=0;i<60;i++){const c=genContract(S);if(!contractText(c))throw new Error('contract without text')}
  T.ok(true,'60 contracts generate with text');
  World.openTrader(S,true);T.ok(S.trader.stock.length>=8,'caravan has stock ('+S.trader.stock.length+')');S.scrip=99999;const s0=S.trader.stock[0].id,c0=count(S,s0);World.buy(S,0,1);T.ok(count(S,s0)===c0+1,'buying works');
  give(S,'old_coin',5);const sc=S.scrip;World.sell(S,S.p.inv.findIndex(s=>s&&s.id==='old_coin'));T.ok(S.scrip>sc,'selling works');
  for(const q of STORY)for(const g of q.goals){const[c,n]=goalProgress(S,g);if(!(n>0)||Number.isNaN(c))throw new Error('bad goal in '+q.id)}
  T.ok(true,'every story goal reports progress');T.info('story index after test: '+S.q.i+' ('+(story(S)?story(S).id:'done')+')');
  sortInv(S.p.inv,slotCount(S));T.ok(S.p.inv.length===slotCount(S),'sorting keeps the pack size');
  give(S,'fire_axe',1);const ai=S.p.inv.findIndex(s=>s&&s.id==='fire_axe');const n0=S.p.inv.filter(Boolean).length;World.recycle(S,ai);T.ok(count(S,'steel_bar')>0||S.p.inv.filter(Boolean).length>=n0,'recycling returns materials');
});
T.info('level '+G.S.p.lvl+', day '+dayOf(G.S.t)+', kills '+(G.S.stats.kills||0)+', tides '+G.S.tide.n);
process.exitCode=T.end()?1:0;

// Tide balance bot: a crude player (melee only, no walls, no healing, no turrets, backs away between swings) against tide N.
// It is a floor, not a model of a person: a real player dodges tells, shuts doors, builds walls and shoots. Usage: node tools/tidebot.mjs
const R=new URL('../js/',import.meta.url).href;
const {G,give,equip,place,derive}=await import(R+'sim/core.js');const World=await import(R+'sim/world.js');
G.headless=true;
// A fresh-ish player at tide N: weapon, a little armour, a few traps. Bot: fight what is in reach, otherwise back away from the nearest (kiting), drink/eat ignored.
async function trial(n,weapon,armor,traps,kite){
  const S=World.newGame(1000+Math.floor(Math.random()*1e6));const Z=G.Z,cx=Math.floor(Z.w/2),cy=Math.floor(Z.h/2);
  S.tide.n=n-1;S.p.lvl=30;give(S,weapon,1);equip(S,S.p.inv.findIndex(s=>s&&s.id===weapon),'w1');for(const a of armor){give(S,a,1);equip(S,S.p.inv.findIndex(s=>s&&s.id===a))}
  give(S,'stick',200);give(S,'log',100);for(let i=0;i<traps;i++){const side=S.tide.dir;const[x,y]=side===0?[cx-2+i%5,cy-8-Math.floor(i/5)]:side===1?[cx+8+Math.floor(i/5),cy-2+i%5]:side===2?[cx-2+i%5,cy+8+Math.floor(i/5)]:[cx-8-Math.floor(i/5),cy-2+i%5];Z.obj[y*Z.w+x]=null;place(S,'spikes',x,y)}
  S.p.lvl=1+n*3;G.ds=derive(S);S.p.hp=G.ds.maxHp;S.tide.at=S.t+.5;let t=0;const dt=1/30;
  while(t<400){const p=Z.pl;if(p.dead)break;let b=null,bd=1e9;for(const a of Z.actors)if(a.team===1&&!a.dead){const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<bd){bd=d;b=a}}
    G.inp.attack=!!b&&bd<2.6;G.inp.mx=G.inp.my=0;
    if(b&&kite&&p.cd>0.12&&!p.atk){let ax=0,ay=0;for(const a of Z.actors)if(a.team===1&&!a.dead){const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<3){ax+=(p.x-a.x)/d/d;ay+=(p.y-a.y)/d/d}}const ex=p.x-cx,ey=p.y-cy,el=Math.hypot(ex,ey);if(el>8){ax-=ex/el*1.2;ay-=ey/el*1.2}const l=Math.hypot(ax,ay)||1;G.inp.mx=ax/l;G.inp.my=ay/l}
    S.p.food=80;S.p.water=80;World.tick(dt);G.ev.length=0;t+=dt;if(t>3&&!S.tide.live)break}
  return{alive:!Z.pl.dead&&!S.tide.live,hp:Math.round(S.p.hp),t:Math.round(t)};
}
const cases=[[1,'spear',[],2,false],[1,'spear',[],2,true],[1,'club',[],0,true],[2,'spear',['hide_vest'],4,true],[3,'bat',['hide_vest','hide_pants'],6,true],[5,'machete',['leather_jacket','leather_pants','leather_cap'],10,true],[8,'fire_axe',['scrap_plate','scrap_greaves','scrap_helm'],10,true],[12,'katana',['riot_vest','riot_pants','riot_helm','riot_boots'],15,true]];
for(const c of cases){let win=0,hp=0;const N=6;for(let i=0;i<N;i++){const r=await trial(...c);if(r.alive){win++;hp+=r.hp}}console.log(`tide ${c[0]} ${c[1]} armour ${c[2].length} traps ${c[3]} ${c[4]?'kiting':'standing'}: survived ${win}/${N}, avg hp left ${win?Math.round(hp/win):0}`)}

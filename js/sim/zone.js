// Zones: the tile world the player walks around in. Generation (home, wild, town, complex), collision, line of sight, path fields, loot rolls.
// Pure logic. A zone is a plain object; the home zone shares its object and floor arrays with the save.
import {OBJ,G as GT,GROUND} from '../data/objects.js';
import {ITEMS} from '../data/items.js';
import {LOC,BLD,BIOMES,SITES,LOOT,ROLLS,REGIONS} from '../data/world.js';
import {G,emit,HOME_W,HOME_H,EXIT_RING,perk} from './core.js';
import {RNG,noise2,Heap,rnd} from './util.js';

export function newZone(id,w,h,base){
  return{id,w,h,g:new Uint8Array(w*h).fill(base),fl:[],obj:[],ed:[],actors:[],projs:[],drops:[],areas:[],spawns:[],uid:0,time:0,pl:null,
    navDirty:true,flow:null,flowKey:-1,flowT:0,biome:'forest',lvl:1,lt:1,home:false,
    touch(i){this.navDirty=true;emit('obj',i)},touchEdge(e){this.navDirty=true;emit('edge',e)}};
}
export const inZone=(Z,x,y)=>x>=0&&y>=0&&x<Z.w&&y<Z.h;
export const atExit=(Z,x,y)=>x<EXIT_RING||y<EXIT_RING||x>=Z.w-EXIT_RING||y>=Z.h-EXIT_RING;
const put=(Z,x,y,k,rng,extra)=>{const d=OBJ[k],o={k,r:rng.int(0,3),v:rng.int(0,2)};if(d.node)o.n=d.node.hits;if(extra)Object.assign(o,extra);Z.obj[y*Z.w+x]=o;return o};
const isFree=(Z,R,x,y,m=2)=>x>=m&&y>=m&&x<Z.w-m&&y<Z.h-m&&!Z.obj[y*Z.w+x]&&GROUND[Z.g[y*Z.w+x]].walk!==false&&!(R&&R[y*Z.w+x]);

// ---------------------------------------------------------------- ground
function paint(Z,b,seed,alt){
  const g=GT[b.g],g2=GT[alt||b.g2],g3=GT[b.g3];
  for(let y=0;y<Z.h;y++)for(let x=0;x<Z.w;x++){const n=noise2(x*.13,y*.13,seed),m=noise2(x*.31+40,y*.31,seed+5);Z.g[y*Z.w+x]=n>.62?g2:(m>.78?g3:g)}
}
function lake(Z,rng,seed){
  const cx=rng.chance(.5)?rng.int(6,12):Z.w-rng.int(7,13),cy=rng.int(8,Z.h-14),rx=rng.int(5,8),ry=rng.int(6,10);
  for(let y=2;y<Z.h-2;y++)for(let x=2;x<Z.w-2;x++){const d=((x-cx)/rx)**2+((y-cy)/ry)**2+(noise2(x*.4,y*.4,seed)-.5)*.5;if(d<1)Z.g[y*Z.w+x]=GT.water;else if(d<1.35&&Z.g[y*Z.w+x]!==GT.water)Z.g[y*Z.w+x]=GT.sand}
  Z.lake={cx,cy,rx,ry};
}
/** Scatter `count` of a kind, clumped by noise so forests have glades and ore comes in seams. */
function scatter(Z,R,rng,k,count,seed,avoid){
  const d=OBJ[k];if(!d)return;const shore=k==='fish_spot';let placed=0;
  for(let t=0;t<count*40&&placed<count;t++){
    const x=rng.int(3,Z.w-4),y=rng.int(3,Z.h-4);
    if(shore){if(Z.g[y*Z.w+x]!==GT.water||Z.obj[y*Z.w+x])continue;let land=false;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(GROUND[Z.g[(y+dy)*Z.w+x+dx]].walk!==false)land=true;if(!land)continue;put(Z,x,y,k,rng);placed++;continue}
    if(!isFree(Z,R,x,y,3))continue;
    if(avoid&&Math.hypot(x-avoid[0],y-avoid[1])<avoid[2])continue;
    if(d.node&&d.solid&&t<count*25&&noise2(x*.17+seed,y*.17,seed*3+1)<.5)continue;
    put(Z,x,y,k,rng);placed++;
  }
}

// ---------------------------------------------------------------- buildings
/** True when every open tile inside the rectangle can still be walked to from (sx,sy), and (px,py) has an open neighbour. */
function roomOk(Z,x0,y0,x1,y1,sx,sy,px,py){
  const W=Z.w,w=x1-x0+1,h=y1-y0+1,seen=new Uint8Array(w*h),open=(x,y)=>{const o=Z.obj[y*W+x];return!o||!OBJ[o.k].solid};
  let total=0;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(open(x,y))total++;
  const st=[[sx,sy]];seen[(sy-y0)*w+sx-x0]=1;let n=0;
  while(st.length){const[x,y]=st.pop();n++;for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<x0||ny<y0||nx>x1||ny>y1)continue;const k=(ny-y0)*w+nx-x0;if(seen[k]||!open(nx,ny))continue;seen[k]=1;st.push([nx,ny])}}
  if(n<total)return false;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=px+dx,ny=py+dy;if(nx<x0||ny<y0||nx>x1||ny>y1)continue;if(seen[(ny-y0)*w+nx-x0])return true}
  return false;
}
/** Place a solid thing indoors only if it does not wall anything off. */
function putIn(Z,x,y,k,rng,b,extra){const o=put(Z,x,y,k,rng,extra);if(!OBJ[k].solid)return o;if(roomOk(Z,b[0],b[1],b[2],b[3],b[4],b[5],x,y))return o;Z.obj[y*Z.w+x]=null;return null}
function stamp(Z,R,rng,x0,y0,w,h,tpl,side){
  const fl=GT[tpl.floor],W=Z.w,inner=[],doors=[];
  for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const i=y*W+x;Z.g[i]=fl;R[i]=2;Z.obj[i]=null;
    if(x===x0||x===x0+w-1||y===y0||y===y0+h-1)Z.obj[i]={k:tpl.wall,r:0,v:rng.int(0,2)};else inner.push([x,y])}
  const door=s=>{let dx,dy;if(s===0){dx=rng.int(x0+1,x0+w-2);dy=y0}else if(s===2){dx=rng.int(x0+1,x0+w-2);dy=y0+h-1}else if(s===1){dx=x0+w-1;dy=rng.int(y0+1,y0+h-2)}else{dx=x0;dy=rng.int(y0+1,y0+h-2)}Z.obj[dy*W+dx]=null;doors.push([dx,dy]);const ox=s===1?1:s===3?-1:0,oy=s===0?-1:s===2?1:0;for(let k=1;k<=2;k++){const j=(dy+oy*k)*W+dx+ox*k;if(!R[j])R[j]=1;if(Z.obj[j]&&!OBJ[Z.obj[j].k].wall)Z.obj[j]=null}};
  door(side);if(rng.chance(.4))door((side+2)%4);
  if(tpl.rooms===2&&w>=9){const px=x0+Math.floor(w/2)+rng.int(-1,0),gap=rng.int(y0+1,y0+h-2);for(let y=y0+1;y<y0+h-1;y++)if(y!==gap&&!doors.some(d=>Math.abs(d[0]-px)+Math.abs(d[1]-y)<=1))Z.obj[y*W+px]={k:tpl.wall,r:0,v:rng.int(0,2)};doors.push([px,gap])}
  const nearDoor=(x,y)=>doors.some(d=>Math.abs(d[0]-x)+Math.abs(d[1]-y)<=1);
  const wallAdj=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const o=Z.obj[(y+dy)*W+x+dx];return o&&OBJ[o.k].wall});
  const cand=rng.shuffle(inner.filter(([x,y])=>!Z.obj[y*W+x]&&wallAdj(x,y)&&!nearDoor(x,y)));
  const bnd=[x0,y0,x0+w-1,y0+h-1,doors[0][0],doors[0][1]];
  for(const[k,a,b]of tpl.in){let n=rng.int(a,b);while(n-->0&&cand.length){const[x,y]=cand.pop();if(!putIn(Z,x,y,k,rng,bnd)&&cand.length){const[x2,y2]=cand.pop();putIn(Z,x2,y2,k,rng,bnd)}}}
  return{x0,y0,w,h,doors,inner:inner.filter(([x,y])=>!Z.obj[y*W+x])};
}
const overlaps=(R,W,x0,y0,w,h,m)=>{for(let y=y0-m;y<y0+h+m;y++)for(let x=x0-m;x<x0+w+m;x++)if(R[y*W+x])return true;return false};

// ---------------------------------------------------------------- generators
function spawnList(Z,R,rng,table,pool,night,minDist=9){
  if(!table)return;
  for(const k in table)for(let n=0;n<table[k];n++){
    let x,y,ok=false;
    for(let t=0;t<40&&!ok;t++){if(pool&&pool.length){const p=rng.pick(pool);x=p[0];y=p[1]}else{x=rng.int(3,Z.w-4);y=rng.int(3,Z.h-4)}
      ok=!Z.obj[y*Z.w+x]&&GROUND[Z.g[y*Z.w+x]].walk!==false&&Math.hypot(x-Z.spawn.x,y-Z.spawn.y)>=minDist&&(pool||!R||R[y*Z.w+x]!==2)}
    if(ok)Z.spawns.push({k,x:x+.5,y:y+.5,night:!!night});
  }
}
function genOutdoor(Z,R,rng,def,seed,town){
  const b=BIOMES[Z.biome],W=Z.w,H=Z.h,blds=[];
  paint(Z,b,seed,def.alt);if(def.water)lake(Z,rng,seed);
  const midY=Math.floor(H/2);
  if(town){const road=def.road?GT.asphalt:GT.path;for(let y=midY-1;y<=midY+1;y++)for(let x=0;x<W;x++){Z.g[y*W+x]=road;R[y*W+x]=1}
    for(let x=Math.floor(W/2)-1;x<=Math.floor(W/2)+1;x++)for(let y=midY;y<H;y++){Z.g[y*W+x]=road;R[y*W+x]=1}}
  else{let px=W/2;for(let y=H-1;y>H-12;y--){px+=rng.range(-.7,.7);for(let dx=-1;dx<=0;dx++){const x=Math.round(px)+dx;if(Z.g[y*W+x]!==GT.water)Z.g[y*W+x]=GT.path}}}
  // buildings
  const list=[];for(const[t,n]of def.bld||[])for(let i=0;i<n;i++)list.push(t);rng.shuffle(list);
  let cur=[5,5];
  for(const t of list){const tpl=BLD[t],w=rng.int(tpl.w[0],tpl.w[1]),h=rng.int(tpl.h[0],tpl.h[1]);let done=false;
    if(town)for(const s of rng.chance(.5)?[0,1]:[1,0]){const x0=cur[s],y0=s===0?midY-2-h:midY+3;
      if(x0+w<W-4&&y0>3&&y0+h<H-5&&!overlaps(R,W,x0,y0,w,h,0)&&!(s===1&&x0<W/2+3&&x0+w>W/2-3)){blds.push(stamp(Z,R,rng,x0,y0,w,h,tpl,s===0?2:0));cur[s]=x0+w+rng.int(2,4);done=true;break}
      else if(s===1&&x0<W/2+3)cur[1]=Math.floor(W/2)+4}
    for(let k=0;k<60&&!done;k++){const x0=rng.int(5,W-w-5),y0=rng.int(5,H-h-9);if(overlaps(R,W,x0,y0,w,h,2))continue;
      let water=false;for(let y=y0;y<y0+h&&!water;y++)for(let x=x0;x<x0+w;x++)if(Z.g[y*W+x]===GT.water){water=true;break}if(water)continue;
      const cx=x0+w/2-W/2,cy=y0+h/2-H/2,side=Math.abs(cx)>Math.abs(cy)?(cx>0?3:1):(cy>0?0:2);blds.push(stamp(Z,R,rng,x0,y0,w,h,tpl,side));done=true}
  }
  const avoid=[Z.spawn.x,Z.spawn.y,3.5];
  for(const k in def.props||{}){if(k.startsWith('fence'))fenceRun(Z,R,rng,k,def.props[k]);else if(town&&['car_wreck','bus'].includes(k)){let n=def.props[k];for(let t=0;t<n*30&&n>0;t++){const x=rng.int(4,W-5),y=midY+rng.int(-1,1);if(!Z.obj[y*W+x]&&Math.abs(x-W/2)>3){put(Z,x,y,k,rng);n--}}}
    else if(town&&['streetlight','sign','trashcan','gas_pump'].includes(k)){let n=def.props[k];for(let t=0;t<n*30&&n>0;t++){const x=rng.int(4,W-5),y=midY+(rng.chance(.5)?-2:2);if(!Z.obj[y*W+x]&&!R[y*W+x]){put(Z,x,y,k,rng);n--}}}
    else scatter(Z,R,rng,k,def.props[k],seed+7,avoid)}
  let s=seed+11;for(const k in def.nodes||{})scatter(Z,R,rng,k,def.nodes[k],s++,avoid);
  for(const k in b.deco||{}){const n=Math.round(b.deco[k]*W*H);scatter(Z,R,rng,k,n,s++,avoid)}
  const inner=[];for(const bl of blds)for(const p of bl.inner)inner.push(p);
  spawnList(Z,R,rng,def.en,null,false);spawnList(Z,R,rng,def.inn,inner.length?inner:null,false,5);spawnList(Z,R,rng,def.night,null,true);
  Z.blds=blds;return inner;
}
function fenceRun(Z,R,rng,k,n){
  while(n>0){let x=rng.int(5,Z.w-6),y=rng.int(5,Z.h-8);const hz=rng.chance(.5),len=Math.min(n,rng.int(4,8));
    for(let i=0;i<len;i++){if(isFree(Z,R,x,y,3)&&!rng.chance(.12))put(Z,x,y,k,rng,{r:hz?0:1});if(hz)x++;else y++}n-=len}
}
function genComplex(Z,R,rng,def,seed){
  const b=BIOMES[Z.biome],W=Z.w,H=Z.h;paint(Z,b,seed,def.alt);
  const x0=5,y0=4,w=W-10,h=H-13,fl=GT[def.floor],wall=def.wall,doors=[],rooms=[];
  for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){const i=y*W+x;Z.g[i]=fl;R[i]=2;if(x===x0||x===x0+w-1||y===y0||y===y0+h-1)Z.obj[i]={k:wall,r:0,v:rng.int(0,2)}}
  for(let y=y0+h;y<H;y++)for(let x=Math.floor(W/2)-1;x<=Math.floor(W/2)+1;x++)Z.g[y*W+x]=GT.path;
  const ex=Math.floor(W/2);for(const dx of[-1,0,1]){Z.obj[(y0+h-1)*W+ex+dx]=null;doors.push([ex+dx,y0+h-1])}
  const nearDoor=(x,y)=>doors.some(d=>Math.abs(d[0]-x)+Math.abs(d[1]-y)<=1);
  const split=(ax,ay,bx,by,depth)=>{ // interior rectangle inclusive
    const rw=bx-ax+1,rh=by-ay+1;
    if(depth>5||(rw<=9&&rh<=9)||(rw<11&&rh<11&&rng.chance(.3))){rooms.push({ax,ay,bx,by});return}
    const vert=rw>rh?true:rh>rw?false:rng.chance(.5);
    if(vert){if(rw<9){rooms.push({ax,ay,bx,by});return}const p=rng.int(ax+4,bx-4),gaps=[rng.int(ay,by)];if(rh>10)gaps.push(rng.int(ay,by));
      for(let y=ay;y<=by;y++)if(!gaps.includes(y)&&!nearDoor(p,y))Z.obj[y*W+p]={k:wall,r:0,v:rng.int(0,2)};for(const g of gaps)doors.push([p,g]);
      split(ax,ay,p-1,by,depth+1);split(p+1,ay,bx,by,depth+1)}
    else{if(rh<9){rooms.push({ax,ay,bx,by});return}const p=rng.int(ay+4,by-4),gaps=[rng.int(ax,bx)];if(rw>10)gaps.push(rng.int(ax,bx));
      for(let x=ax;x<=bx;x++)if(!gaps.includes(x)&&!nearDoor(x,p))Z.obj[p*W+x]={k:wall,r:0,v:rng.int(0,2)};for(const g of gaps)doors.push([g,p]);
      split(ax,ay,bx,p-1,depth+1);split(ax,p+1,bx,by,depth+1)}
  };
  split(x0+1,y0+1,x0+w-2,y0+h-2,0);
  for(const r of rooms){r.cx=(r.ax+r.bx)/2;r.cy=(r.ay+r.by)/2;r.far=Math.hypot(r.cx-ex,r.cy-(y0+h))}
  rooms.sort((a,b)=>a.far-b.far);const entry=rooms[0],bossRoom=rooms[rooms.length-1];
  const tilesOf=r=>{const out=[];for(let y=r.ay;y<=r.by;y++)for(let x=r.ax;x<=r.bx;x++)if(!Z.obj[y*W+x]&&!nearDoor(x,y))out.push([x,y]);return out};
  const wallAdj=(x,y)=>[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>{const o=Z.obj[(y+dy)*W+x+dx];return o&&OBJ[o.k].wall});
  const pickTile=(r,edge)=>{let c=tilesOf(r);if(def.boss&&r===bossRoom)c=c.filter(([x,y])=>Math.hypot(x-r.cx,y-r.cy)>2.6);if(edge){const e=c.filter(([x,y])=>wallAdj(x,y));if(e.length)c=e}return c.length?rng.pick(c):null};
  const fillRooms=rooms.length>1?rooms.slice(1):rooms,bnd=[x0,y0,x0+w-1,y0+h-1,ex,y0+h-1];
  const putC=(t,k)=>{for(let tries=0;tries<4&&t;tries++){if(putIn(Z,t[0],t[1],k,rng,bnd))return true;t=pickTile(rng.pick(fillRooms),true)}return false};
  for(const k in def.fill||{})for(let n=0;n<def.fill[k];n++){const d=OBJ[k],t=pickTile(rng.pick(fillRooms),!(d.node&&d.solid===2));putC(t,k)}
  const deep=rooms.slice(Math.floor(rooms.length*.5));
  for(const k in def.lock||{})for(let n=0;n<def.lock[k];n++){const t=pickTile(rng.pick(deep),true);putC(t,k)}
  for(const k in def.hazard||{})for(let n=0;n<def.hazard[k];n++){const t=pickTile(rng.pick(fillRooms),false);if(t)put(Z,t[0],t[1],k,rng)}
  // outdoors
  const avoid=[Z.spawn.x,Z.spawn.y,3];let s=seed+3;for(const k in def.props||{})scatter(Z,R,rng,k,def.props[k],s++,avoid);
  for(const k in b.deco||{})scatter(Z,R,rng,k,Math.round(b.deco[k]*W*H*.4),s++,avoid);
  const inner=[];for(const r of fillRooms)if(!(def.boss&&r===bossRoom))for(const t of tilesOf(r))inner.push(t);
  spawnList(Z,R,rng,def.en,null,false,6);spawnList(Z,R,rng,def.inn,inner,false,7);spawnList(Z,R,rng,def.night,null,true);
  Z.rooms=rooms;Z.bossAt=[bossRoom.cx+.5,bossRoom.cy+.5];return inner;
}

/** Build a location, site or ambush zone. `def` has the generator fields of a LOCATIONS row. */
export function genZone(def,seed,opts={}){
  const S=G.S,rng=RNG(seed),size=def.size||[44,44],reg=def.reg||1,biome=def.biome||'forest',b=BIOMES[biome];
  const Z=newZone(def.id,size[0],size[1],GT[b.g]);Z.biome=biome;Z.def=def;Z.lvl=opts.lvl||def.lvl||1;Z.lt=def.lt||reg;Z.reg=reg;Z.seed=seed;
  Z.dark=!!def.dark;Z.tox=(def.tox||0);Z.cold=def.cold||0;Z.heat=REGIONS[reg].heat||0;Z.name=def.n;
  Z.spawn={x:Math.floor(Z.w/2)+.5,y:Z.h-2.5};
  const R=new Uint8Array(Z.w*Z.h);
  const inner=def.lay==='complex'?genComplex(Z,R,rng,def,seed):genOutdoor(Z,R,rng,def,seed,def.lay==='town');
  // boss
  if(def.boss&&(!def.bossChance||rng.chance(def.bossChance))){let bx,by;if(Z.bossAt){[bx,by]=Z.bossAt}else{let ok=false;for(let t=0;t<80&&!ok;t++){bx=rng.int(8,Z.w-9)+.5;by=rng.int(6,Math.floor(Z.h*.45))+.5;ok=!Z.obj[Math.floor(by)*Z.w+Math.floor(bx)]&&GROUND[Z.g[Math.floor(by)*Z.w+Math.floor(bx)]].walk!==false}}
    Z.spawns.push({k:def.boss,x:bx,y:by,boss:true})}
  // keep the arrival point clear
  for(let y=Z.h-5;y<Z.h-1;y++)for(let x=Math.floor(Z.w/2)-2;x<=Math.floor(Z.w/2)+2;x++){const o=Z.obj[y*Z.w+x];if(o&&!OBJ[o.k].wall)Z.obj[y*Z.w+x]=null;if(Z.g[y*Z.w+x]===GT.water)Z.g[y*Z.w+x]=GT.path}
  put(Z,Math.floor(Z.w/2)+2,Z.h-3,'exit_sign',rng);
  // rescue site: a caged survivor deep inside
  if(def.rescue&&inner&&inner.length){const p=rng.pick(inner);put(Z,p[0],p[1],'cage',rng,{held:1})}
  // story items hide in a container while their quest is active
  if(def.qi&&S)for(const[item,flag]of def.qi){if(!S.flags[flag]||S.flags['got_'+flag+'_'+def.id])continue;const c=[];Z.obj.forEach((o,i)=>{if(o&&OBJ[o.k].loot)c.push(o)});if(c.length){const o=c[Math.floor(rng()*c.length)];o.qi=item;o.qf='got_'+flag+'_'+def.id}}
  // the pack you dropped when you died here
  const mem=S&&S.loc[def.id];if(mem&&mem.bag&&mem.bag.length){const x=Math.floor(Z.w/2)-2,y=Z.h-4;Z.obj[y*Z.w+x]={k:'deathbag',r:0,v:0,inv:mem.bag,open:1}}
  if(def.rich)Z.obj.forEach(o=>{if(o&&o.n)o.rich=1});
  return Z;
}

/** The four trails into the homestead: tides come down them, and the south one is the way out. */
export function onTrail(x,y){const cx=HOME_W/2,cy=HOME_H/2;return(Math.abs(x+.5-cx)<1.6||Math.abs(y+.5-cy)<1.6)}
function homeGround(Z,S){paint(Z,BIOMES.forest,S.seed);const cx=HOME_W/2,cy=HOME_H/2;for(let y=0;y<Z.h;y++)for(let x=0;x<Z.w;x++){const d=Math.hypot(x+.5-cx,y+.5-cy);if(onTrail(x,y)&&d>7+noise2(x*.5,y*.5,S.seed)*3)Z.g[y*Z.w+x]=GT.path;else if(d<5.5&&noise2(x*.4,y*.4,S.seed+9)>.45)Z.g[y*Z.w+x]=GT.dirt}}
/** First-time layout of the homestead: a clearing ringed by forest, a wrecked truck, a pool. Writes into S.home. */
export function genHome(S){
  const rng=RNG(S.seed^0x51ed),W=HOME_W,H=HOME_H,Z=newZone('home',W,H,GT.grass),R=new Uint8Array(W*H),cx=W/2,cy=H/2;
  Z.spawn={x:cx+.5,y:cy+2.5};homeGround(Z,S);
  const clear=(x,y)=>Math.hypot(x-cx,y-cy)+noise2(x*.3,y*.3,S.seed)*3;
  const scat=(k,n,min,max)=>{let p=0;for(let t=0;t<n*60&&p<n;t++){const x=rng.int(3,W-4),y=rng.int(3,H-4),d=clear(x,y);if(d<min||d>max||!isFree(Z,R,x,y,3)||onTrail(x,y))continue;put(Z,x,y,k,rng);p++}};
  scat('tree_pine',66,8.5,40);scat('tree_birch',38,8,40);scat('tree_dead',6,8,40);scat('rock',18,7,40);scat('rock_flint',4,12,40);scat('bush_berry',9,7,40);
  scat('grass_tall',22,5,40);scat('stone_pile',12,4,40);scat('log_pile',9,4,40);scat('mushrooms',4,10,40);scat('herb_patch',3,9,40);scat('pond',2,8,14);scat('clay_pit',2,13,40);scat('flowers',14,3,40);
  put(Z,Math.floor(cx)+4,Math.floor(cy)-3,'car_wreck',rng,{r:1,starter:1});put(Z,Math.floor(cx)+3,Math.floor(cy)-1,'crate',rng,{starter:2});put(Z,Math.floor(cx)-4,Math.floor(cy)+1,'log_pile',rng);
  S.home.obj=Z.obj;S.home.fl=[];S.home.ed=[];
}
export function homeZone(S){
  const Z=newZone('home',HOME_W,HOME_H,GT.grass);homeGround(Z,S);
  if(!S.home.ed)S.home.ed=[];Z.obj=S.home.obj;Z.fl=S.home.fl;Z.ed=S.home.ed;for(let e=0;e<Z.ed.length;e++)if(Z.ed[e]&&!OBJ[Z.ed[e].k])Z.ed[e]=null;Z.home=true;Z.biome='forest';Z.lvl=1+Math.floor(S.tide.n*1.2);Z.lt=1;Z.reg=1;Z.name='Homestead';Z.def=LOC.home;Z.seed=S.seed;
  for(let i=0;i<Z.fl.length;i++)if(Z.fl[i]&&!OBJ[Z.fl[i]])Z.fl[i]=null;
  for(let i=0;i<Z.obj.length;i++)if(Z.obj[i]&&!OBJ[Z.obj[i].k])Z.obj[i]=null;
  let sx=HOME_W/2+.5,sy=HOME_H/2+2.5;
  if(S.p.bed!=null&&Z.obj[S.p.bed]&&OBJ[Z.obj[S.p.bed].k].bed){sx=S.p.bed%Z.w+.5;sy=Math.floor(S.p.bed/Z.w)+.5}
  Z.spawn={x:sx,y:sy};Z.gate={x:HOME_W/2+.5,y:HOME_H-2.5};
  return Z;
}
/** A free walkable spot near (x,y). */
export function freeNear(Z,x,y,rmax=6){
  for(let r=0;r<=rmax;r++)for(let t=0;t<12;t++){const a=rnd()*6.283,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r,tx=Math.floor(px),ty=Math.floor(py);
    if(tx<1||ty<1||tx>=Z.w-1||ty>=Z.h-1)continue;const o=Z.obj[ty*Z.w+tx];if((!o||!OBJ[o.k].solid)&&GROUND[Z.g[ty*Z.w+tx]].walk!==false)return[tx+.5,ty+.5]}
  return[x,y];
}

// ---------------------------------------------------------------- loot
export function rollLoot(family,tier,rng=rnd,bonus=0){
  const tab=LOOT[family];if(!tab)return[];const rows=tab.filter(r=>tier>=r.t0&&tier<=r.t1);if(!rows.length)return[];
  const[a,b]=ROLLS[family]||[1,2];let n=a+Math.floor(rng()*(b-a+1))+bonus;if(rng()<perk('luck'))n++;
  const out=[],S=G.S;
  for(let k=0;k<n;k++){const r=rng.weighted?rng.weighted(rows,r=>r.w):rows[Math.floor(rng()*rows.length)];let id=r.i,q=r.a+Math.floor(rng()*(r.b-r.a+1));const it=ITEMS[id];
    if(it.t==='bp'&&S&&(it.learn.every(x=>S.p.known[x])||out.some(o=>o.id===id))){id='old_coin';q=3}
    const e=out.find(o=>o.id===id&&!ITEMS[id].dur);if(e)e.n+=q;else{const o={id,n:q};if(ITEMS[id].dur)o.d=Math.round(ITEMS[id].dur*(.35+rng()*.6));out.push(o)}}
  return out;
}

// ---------------------------------------------------------------- collision & sight
/** 0 open · 1 blocks everything · 2 round obstacle · 3 door (blocks enemies only) */
export function blockAt(Z,tx,ty){
  if(tx<0||ty<0||tx>=Z.w||ty>=Z.h)return 1;const i=ty*Z.w+tx;if(GROUND[Z.g[i]].walk===false){const o=Z.obj[i];return o&&OBJ[o.k].solid===2?1:1}
  const o=Z.obj[i];if(!o)return 0;const d=OBJ[o.k];if(!d.solid)return 0;if(d.door)return 3;return d.solid;
}
/** Push a circle (x,y,r) out of solid tiles. `ally` walks through doors. Returns [x,y]. */
export function collide(Z,x,y,r,ally){
  for(let pass=0;pass<2;pass++){
    const tx0=Math.floor(x-r),tx1=Math.floor(x+r),ty0=Math.floor(y-r),ty1=Math.floor(y+r);
    for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){
      const b=blockAt(Z,tx,ty);if(!b||(b===3&&ally))continue;
      if(b===2){const o=Z.obj[ty*Z.w+tx],rr=(OBJ[o.k].r||.3)+r,dx=x-(tx+.5),dy=y-(ty+.5),d=Math.hypot(dx,dy);if(d<rr){if(d<1e-4){x+=rr}else{x=tx+.5+dx/d*rr;y=ty+.5+dy/d*rr}}continue}
      const nx=x<tx?tx:x>tx+1?tx+1:x,ny=y<ty?ty:y>ty+1?ty+1:y,dx=x-nx,dy=y-ny,d2=dx*dx+dy*dy;
      if(d2<r*r){if(d2>1e-8){const d=Math.sqrt(d2);x=nx+dx/d*r;y=ny+dy/d*r}else{const l=x-tx,rt=tx+1-x,u=y-ty,dn=ty+1-y,m=Math.min(l,rt,u,dn);if(m===l)x=tx-r;else if(m===rt)x=tx+1+r;else if(m===u)y=ty-r;else y=ty+1+r}}
    }
  }
  // walls on cell edges: thin boxes along the grid lines. Doors let allies through.
  if(Z.ed.length)for(let pass=0;pass<2;pass++){
    const tx0=Math.floor(x-r-WT),tx1=Math.floor(x+r+WT),ty0=Math.floor(y-r-WT),ty1=Math.floor(y+r+WT),W=Z.w;
    for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){if(tx<0||ty<0||tx>=W||ty>=Z.h)continue;const e=(ty*W+tx)*2;
      for(let s=0;s<2;s++){const w=Z.ed[e+s];if(!w||(ally&&OBJ[w.k].door))continue;
        const x0=s?tx-WT:tx,x1=s?tx+WT:tx+1,y0=s?ty:ty-WT,y1=s?ty+1:ty+WT,nx=x<x0?x0:x>x1?x1:x,ny=y<y0?y0:y>y1?y1:y,dx=x-nx,dy=y-ny,d2=dx*dx+dy*dy;
        if(d2<r*r){if(d2>1e-8){const d=Math.sqrt(d2);x=nx+dx/d*r;y=ny+dy/d*r}else if(s)x=x<tx?tx-WT-r:tx+WT+r;else y=y<ty?ty-WT-r:ty+WT+r}}}
  }
  const m=.3;x=x<m?m:x>Z.w-m?Z.w-m:x;y=y<m?m:y>Z.h-m?Z.h-m:y;
  return[x,y];
}
/** Half the thickness of an edge wall. */
export const WT=.09;
/** The first wall crossed on the way from (x0,y0) to (x1,y1): its edge index, or -1. `ally` passes through doors. */
export function edgeCross(Z,x0,y0,x1,y1,ally=false){
  const ed=Z.ed;if(!ed.length)return-1;const W=Z.w,H=Z.h,dx=x1-x0,dy=y1-y0;let best=-1,bt=2;
  if(dx){const a=Math.floor(Math.min(x0,x1))+1,b=Math.floor(Math.max(x0,x1));for(let k=a;k<=b;k++){const t=(k-x0)/dx;if(t<0||t>1||t>=bt)continue;const ty=Math.floor(y0+dy*t);if(k<0||k>=W||ty<0||ty>=H)continue;const e=(ty*W+k)*2+1,w=ed[e];if(w&&!(ally&&OBJ[w.k].door)){bt=t;best=e}}}
  if(dy){const a=Math.floor(Math.min(y0,y1))+1,b=Math.floor(Math.max(y0,y1));for(let k=a;k<=b;k++){const t=(k-y0)/dy;if(t<0||t>1||t>=bt)continue;const tx=Math.floor(x0+dx*t);if(tx<0||tx>=W||k<0||k>=H)continue;const e=(k*W+tx)*2,w=ed[e];if(w&&!(ally&&OBJ[w.k].door)){bt=t;best=e}}}
  return best;
}
/** The wall or door on the edge between two cells that share a side: its edge index, or -1. */
export function edgeBetween(Z,x0,y0,x1,y1){const W=Z.w,e=y1<y0?(y0*W+x0)*2:y1>y0?(y1*W+x0)*2:x1<x0?(y0*W+x0)*2+1:(y0*W+x1)*2+1;return Z.ed[e]?e:-1}
/** Does any wall touch the corner shared by two diagonal cells? (Nothing cuts a corner a wall ends on.) */
function cornerWalled(Z,x0,y0,x1,y1){const W=Z.w,cx=Math.max(x0,x1),cy=Math.max(y0,y1),ed=Z.ed;return!!(ed[(cy*W+cx-1)*2]||ed[(cy*W+cx)*2]||ed[((cy-1)*W+cx)*2+1]||ed[(cy*W+cx)*2+1])}
/** Does a wall stand between two points? Low cover (barricades, furniture) does not block sight or shots. */
export function los(Z,x0,y0,x1,y1){
  const dx=x1-x0,dy=y1-y0,d=Math.hypot(dx,dy),n=Math.ceil(d*3);if(n<1)return true;
  for(let i=1;i<n;i++){const x=x0+dx*i/n,y=y0+dy*i/n,tx=Math.floor(x),ty=Math.floor(y);if(tx<0||ty<0||tx>=Z.w||ty>=Z.h)return false;const o=Z.obj[ty*Z.w+tx];if(o){const k=OBJ[o.k];if(k.solid===1&&!k.low)return false}}
  return edgeCross(Z,x0,y0,x1,y1)<0;
}
/** What a projectile hits at (x,y): tile index of a blocking object, or -1. */
export function shotBlock(Z,x,y){
  const tx=Math.floor(x),ty=Math.floor(y);if(tx<0||ty<0||tx>=Z.w||ty>=Z.h)return-2;const i=ty*Z.w+tx,o=Z.obj[i];if(!o)return-1;const k=OBJ[o.k];
  if(k.solid===1&&!k.low)return i;if(k.solid===2&&(k.r||.3)>=.26&&k.node&&Math.hypot(x-tx-.5,y-ty-.5)<k.r)return i;return-1;
}

// ---------------------------------------------------------------- path fields
/** Cost for an enemy to enter tile i; Infinity = never. Breakable home structures cost extra, so hordes prefer gaps and weak points. */
function enterCost(Z,i,ally){
  if(GROUND[Z.g[i]].walk===false)return Infinity;const o=Z.obj[i];if(!o)return 1;const d=OBJ[o.k];if(!d.solid)return d.trap&&ally?4:1;
  if(d.door&&ally)return 1;if(d.solid===2)return(d.r||.3)<.2?1.5:Infinity;
  if(!ally&&o.hp>0&&d.cost)return 3+Math.min(80,o.hp/25);
  return Infinity;
}
/** Dijkstra distance field toward (tx,ty). d[i] = cost to reach the target from tile i. */
export function field(Z,tx,ty,ally=false,maxCost=400){
  const W=Z.w,H=Z.h,d=new Float32Array(W*H).fill(Infinity),heap=new Heap(),s=ty*W+tx;if(tx<0||ty<0||tx>=W||ty>=H)return d;
  d[s]=0;heap.push(0,s);const hasEd=Z.ed.length>0;
  const cost=new Float32Array(W*H),hard=new Uint8Array(W*H);for(let i=0;i<W*H;i++){cost[i]=enterCost(Z,i,ally);const o=Z.obj[i];hard[i]=GROUND[Z.g[i]].walk===false||(o&&OBJ[o.k].solid===1&&!(ally&&OBJ[o.k].door))?1:0}cost[s]=1;
  while(heap.size){const i=heap.pop(),di=d[i];if(di>maxCost)break;const x=i%W,y=(i-x)/W;
    for(let k=0;k<8;k++){const dx=NB[k][0],dy=NB[k][1],nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;
      // moving out of j into i costs entering i; diagonal only if both sides are open
      const c=cost[i];if(c===Infinity&&i!==s)continue;
      if(dx&&dy&&(hard[y*W+nx]||hard[ny*W+x]))continue;
      // a wall on the edge between the two cells: allies only pass doors, attackers pay to break through; nobody cuts a walled corner
      let wall=0;if(hasEd){if(dx&&dy){if(cornerWalled(Z,x,y,nx,ny))continue}else{const e=edgeBetween(Z,x,y,nx,ny);if(e>=0){const w=Z.ed[e];if(ally){if(!OBJ[w.k].door)continue}else wall=3+Math.min(80,w.hp/25)}}}
      const nd=di+(dx&&dy?1.414:1)*(i===s?1:c)+wall;if(nd<d[j]&&cost[j]!==Infinity){d[j]=nd;heap.push(nd,j)}else if(nd<d[j]&&cost[j]===Infinity&&j!==s){/* blocked tile: unreachable */}}
  }
  return d;
}
const NB=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
/** Best neighbouring tile to step to from (x,y) on a field: returns tile index or -1. An ally never steps through a wall; an attacker may, and then has to break it. */
export function stepOn(Z,f,x,y,ally=false){
  const W=Z.w,tx=Math.floor(x),ty=Math.floor(y),hasEd=Z.ed.length>0;let best=-1,bd=f[ty*W+tx];
  for(let k=0;k<8;k++){const nx=tx+NB[k][0],ny=ty+NB[k][1];if(nx<0||ny<0||nx>=W||ny>=Z.h)continue;
    if(NB[k][0]&&NB[k][1]){const b1=blockAt(Z,nx,ty),b2=blockAt(Z,tx,ny);if(b1===1||b1===3||b2===1||b2===3)continue;if(hasEd&&cornerWalled(Z,tx,ty,nx,ny))continue}
    else if(hasEd&&ally){const e=edgeBetween(Z,tx,ty,nx,ny);if(e>=0&&!OBJ[Z.ed[e].k].door)continue}
    const v=f[ny*W+nx];if(v<bd){bd=v;best=ny*W+nx}}
  return best;
}
/** The enemies' shared field toward the player, refreshed when the player changes tile or the base changes. */
export function playerField(Z){
  const p=Z.pl;if(!p)return null;const key=Math.floor(p.y)*Z.w+Math.floor(p.x);
  if(Z.flow&&key===Z.flowKey&&!Z.navDirty)return Z.flow;
  if(Z.flow&&Z.time-Z.flowT<.25&&!Z.navDirty)return Z.flow;
  Z.flow=field(Z,Math.floor(p.x),Math.floor(p.y),false);Z.flowKey=key;Z.flowT=Z.time;Z.navDirty=false;return Z.flow;
}
export function siteDef(site,reg,lvl){const s=SITES[site.site||site];const biome=['forest','forest','dust','city','frost','gray'][reg]||'forest';return Object.assign({id:'site',reg,lvl,biome,size:[40,40],lt:reg},s)}

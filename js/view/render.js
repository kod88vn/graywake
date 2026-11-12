// The renderer: turns the current zone into a three.js scene and keeps it in step with the simulation.
// Sim (x, y) maps to world (X, Z); Y is up. A sim facing angle a becomes rotation.y = π/2 − a.
import {THREE,Geo,material,shade,mix} from './geo.js';
import {PROPS} from './props.js';
import {rigFor,playerRig,setWeapon,pose,disposeRig} from './rigs.js';
import {OBJ,GROUND} from '../data/objects.js';
import {ITEMS} from '../data/items.js';
import {BIOMES} from '../data/world.js';
import {VEHICLES} from '../data/recipes.js';
import {WEATHER} from '../data/events.js';
import {G,weaponDef,maxHp,EXIT_RING} from '../sim/core.js';
import {daylight} from '../sim/world.js';
import {hash,clamp} from '../sim/util.js';

const V3=THREE.Vector3,M4=THREE.Matrix4,Q=THREE.Quaternion,C=THREE.Color;
const _m=new M4(),_q=new Q(),_p=new V3(),_s=new V3(),_c=new C(),_c2=new C(),_e=new THREE.Euler(),UP=new V3(0,1,0);
const MARGIN=14,QUAL={low:{pr:1,shadow:0},med:{pr:1.5,shadow:1024},high:{pr:2,shadow:2048}};
let R,scene,cam,sun,hemi,plight,fxLight,canvas,quality='high',zoom=1,Z=null,frame=0,time=0;
let ground=null,borderMeshes=[],vehMesh=null;
const geoCache=new Map(),inst=new Map(),shown=[],shownF=[],dirty=new Set(),dyn=new Map(),wobble=[];
const rigs=new Map(),lightPool=[],lightSrc=[];
let projMesh,dropMesh,barBg,barFg,partMesh,wxMesh,hintRing,ghost=null,ghostTile,areaPool=[],playerRing;
const parts=[],wx=[];let shakeAmt=0,flashT=0;
const camT=new V3(),camOff=new V3(0,13.5,9.4),basicBox=new THREE.BoxGeometry(1,1,1);
let fps=60,fpsAcc=0,fpsN=0,lowT=0;

export const View={init,setZone,frame:draw,onEvent,resize,pick,project,setGhost,setQuality,get quality(){return quality},setZoom(z){zoom=clamp(z,.6,1.5)},get zoom(){return zoom},get fps(){return fps},shot:()=>R.domElement.toDataURL()};

function modelGeo(key){
  let g=geoCache.get(key);if(g)return g;const[m,v]=key.split('|'),fn=PROPS[m];const b=new Geo();
  if(fn){try{fn(b,+v||0)}catch(e){console.error('model '+m,e);b.box(.8,.8,.8,'#ff00ff',0,.4,0)}}else{console.error('no model for '+key);b.box(.8,.8,.8,'#ff00ff',0,.4,0)}
  g=b.build();geoCache.set(key,g);return g;
}
function init(cv,q){
  canvas=cv;R=new THREE.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:!!window.__shots});
  scene=new THREE.Scene();scene.background=new C('#a9c0a0');scene.fog=new THREE.Fog('#a9c0a0',24,52);
  cam=new THREE.PerspectiveCamera(38,1,1,160);
  hemi=new THREE.HemisphereLight('#cfe0ff','#5a5040',1);scene.add(hemi);
  sun=new THREE.DirectionalLight('#fff2d8',2.2);sun.castShadow=true;sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;scene.add(sun);scene.add(sun.target);
  plight=new THREE.PointLight('#ffd9a0',0,13,1.6);scene.add(plight);fxLight=new THREE.PointLight('#ffb060',0,14,1.5);scene.add(fxLight);
  for(let i=0;i<4;i++){const l=new THREE.PointLight('#ffb060',0,12,1.6);scene.add(l);lightPool.push(l)}
  const basic=()=>new THREE.MeshBasicMaterial({color:'#ffffff'});
  projMesh=new THREE.InstancedMesh(basicBox,basic(),256);dropMesh=new THREE.InstancedMesh(modelGeo('lootbag|0'),material(),96);dropMesh.castShadow=true;
  const plane=new THREE.PlaneGeometry(1,1);barBg=new THREE.InstancedMesh(plane,new THREE.MeshBasicMaterial({color:'#15130f',depthTest:false,transparent:true,opacity:.75}),96);barFg=new THREE.InstancedMesh(plane,new THREE.MeshBasicMaterial({color:'#ffffff',depthTest:false,transparent:true}),96);
  partMesh=new THREE.InstancedMesh(basicBox,basic(),700);wxMesh=new THREE.InstancedMesh(basicBox,new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.55}),500);
  for(const m of[projMesh,dropMesh,barBg,barFg,partMesh,wxMesh]){m.count=0;m.frustumCulled=false;scene.add(m)}barBg.renderOrder=10;barFg.renderOrder=11;
  for(const m of[projMesh,barFg,partMesh,wxMesh]){m.setColorAt(0,_c.set('#fff'));m.instanceColor.setUsage(THREE.DynamicDrawUsage)}
  const ring=(r0,r1,col,op)=>{const m=new THREE.Mesh(new THREE.RingGeometry(r0,r1,28).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:op,depthWrite:false}));m.visible=false;scene.add(m);return m};
  hintRing=ring(.46,.56,'#ffd870',.9);playerRing=ring(.3,.36,'#ffffff',.25);
  ghostTile=new THREE.Mesh(new THREE.PlaneGeometry(.96,.96).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#7cff7c',transparent:true,opacity:.35,depthWrite:false}));ghostTile.visible=false;scene.add(ghostTile);
  for(let i=0;i<28;i++){const g=new THREE.Group(),disc=new THREE.Mesh(new THREE.CircleGeometry(1,28).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#ff3020',transparent:true,opacity:.3,depthWrite:false})),rim=new THREE.Mesh(new THREE.RingGeometry(.94,1,32).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:'#ff3020',transparent:true,opacity:.8,depthWrite:false}));g.add(disc);g.add(rim);g.visible=false;g.userData={disc,rim};scene.add(g);areaPool.push(g)}
  setQuality(q||'auto');resize();
}
function setQuality(q){
  if(q==='auto')q=(matchMedia('(pointer:coarse)').matches||Math.min(screen.width,screen.height)<700)?'med':'high';
  quality=q;const o=QUAL[q]||QUAL.med;R.setPixelRatio(Math.min(o.pr,devicePixelRatio||1));
  R.shadowMap.enabled=!!o.shadow;R.shadowMap.type=THREE.PCFSoftShadowMap;if(o.shadow){sun.shadow.mapSize.set(o.shadow,o.shadow);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
  sun.castShadow=!!o.shadow;const sc=sun.shadow.camera;sc.left=-19;sc.right=19;sc.top=19;sc.bottom=-19;sc.near=1;sc.far=70;sc.updateProjectionMatrix();
  scene.traverse(o=>{if(o.material&&o.material.needsUpdate!==undefined)o.material.needsUpdate=true});resize();
}
function resize(){if(!R)return;const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.fov=w<h?46:38;cam.updateProjectionMatrix()}

// ---------------------------------------------------------------- zone build
function disposeZone(){
  if(ground){scene.remove(ground);ground.geometry.dispose();ground=null}
  for(const m of borderMeshes){scene.remove(m);m.dispose()}borderMeshes=[];
  for(const e of inst.values()){scene.remove(e.mesh);e.mesh.dispose()}inst.clear();shown.length=0;shownF.length=0;dirty.clear();
  for(const m of dyn.values())scene.remove(m);dyn.clear();
  for(const r of rigs.values()){scene.remove(r.root);disposeRig(r)}rigs.clear();
  if(vehMesh){scene.remove(vehMesh);vehMesh=null}parts.length=0;wobble.length=0;
}
function setZone(z){
  disposeZone();Z=z;if(!Z)return;const b=BIOMES[Z.biome]||BIOMES.forest,W=Z.w,H=Z.h;
  // ground
  const n=(W+MARGIN*2)*(H+MARGIN*2),pos=new Float32Array(n*18),col=new Float32Array(n*18),nor=new Float32Array(n*18);let k=0;
  const base=new C(GROUND.find(g=>g.id===b.g).c),path=new C('#96805a'),GW2=W+MARGIN*2,GH2=H+MARGIN*2;
  // one colour per tile, then soft-blend natural ground at the corners so it does not read as a chessboard; paving keeps hard edges
  const HARD={asphalt:1,concrete:1,tile:1,boards:1,water:1},tc=new Float32Array(GW2*GH2*3),hard=new Uint8Array(GW2*GH2);
  for(let y=-MARGIN;y<H+MARGIN;y++)for(let x=-MARGIN;x<W+MARGIN;x++){
    const inside=x>=0&&y>=0&&x<W&&y<H,h=hash(x+500,y+500)/4294967295,j=((y+MARGIN)*GW2+x+MARGIN);
    if(inside){const g=GROUND[Z.g[y*W+x]];_c.set(g.c);if(HARD[g.id])hard[j]=1;else if(x<EXIT_RING||y<EXIT_RING||x>=W-EXIT_RING||y>=H-EXIT_RING)_c.lerp(path,.35)}else{_c.copy(base).multiplyScalar(.8)}
    _c.multiplyScalar(hard[j]?.95+h*.1:.9+h*.2);tc[j*3]=_c.r;tc[j*3+1]=_c.g;tc[j*3+2]=_c.b}
  const corner=(cx,cy,out)=>{let r=0,g=0,bl=0,n=0;for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){const xx=cx+dx+MARGIN,yy=cy+dy+MARGIN;if(xx<0||yy<0||xx>=GW2||yy>=GH2)continue;const j=yy*GW2+xx;if(hard[j])continue;r+=tc[j*3];g+=tc[j*3+1];bl+=tc[j*3+2];n++}if(n){out[0]=r/n;out[1]=g/n;out[2]=bl/n;return true}return false};
  const cc=[0,0,0];
  for(let y=-MARGIN;y<H+MARGIN;y++)for(let x=-MARGIN;x<W+MARGIN;x++){
    const inside=x>=0&&y>=0&&x<W&&y<H,j=((y+MARGIN)*GW2+x+MARGIN),yy=inside&&Z.g[y*W+x]===6?-.07:0;
    const vx=[x,x,x+1,x,x+1,x+1],vz=[y,y+1,y+1,y,y+1,y];
    for(let v=0;v<6;v++){pos[k]=vx[v];pos[k+1]=yy;pos[k+2]=vz[v];nor[k+1]=1;
      if(!hard[j]&&corner(vx[v],vz[v],cc)){col[k]=cc[0];col[k+1]=cc[1];col[k+2]=cc[2]}else{col[k]=tc[j*3];col[k+1]=tc[j*3+1];col[k+2]=tc[j*3+2]}k+=3}}
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.BufferAttribute(pos,3));gg.setAttribute('normal',new THREE.BufferAttribute(nor,3));gg.setAttribute('color',new THREE.BufferAttribute(col,3));
  ground=new THREE.Mesh(gg,material());ground.receiveShadow=true;scene.add(ground);
  // tree line beyond the edge
  const lists={};
  for(let y=-MARGIN+2;y<H+MARGIN-2;y++)for(let x=-MARGIN+2;x<W+MARGIN-2;x++){if(x>=-1&&y>=-1&&x<=W&&y<=H)continue;const h=hash(x*3+11,y*7+5);if((h%100)>=(Z.home||Z.biome==='forest'||Z.biome==='frost'||Z.biome==='gray'?40:16))continue;
    const kind=b.border[(h>>>8)%b.border.length],key=kind+'|'+((h>>>12)%3);(lists[key]=lists[key]||[]).push([x,y,h])}
  for(const key in lists){const L=lists[key],m=new THREE.InstancedMesh(modelGeo(key),material(),L.length);m.castShadow=false;m.receiveShadow=true;m.frustumCulled=false;
    L.forEach(([x,y,h],i)=>{const s=.9+((h>>>16)%100)/250;_q.setFromAxisAngle(UP,((h>>>4)%628)/100);_m.compose(_p.set(x+.5,0,y+.5),_q,_s.set(s,s,s));m.setMatrixAt(i,_m)});scene.add(m);borderMeshes.push(m)}
  // objects and floors
  for(let i=0;i<W*H;i++){if(Z.obj[i])syncObj(i);if(Z.fl[i])syncFloor(i)}flush();
  if(Z.home&&G.S.veh>0&&VEHICLES[G.S.veh].m){vehMesh=new THREE.Mesh(modelGeo(VEHICLES[G.S.veh].m+'|0'),material());vehMesh.position.set(W/2+3.2,0,H-4.5);vehMesh.rotation.y=.5;vehMesh.castShadow=true;scene.add(vehMesh)}
  const p=Z.pl;if(p){camT.set(p.x,0,p.y)}
  scene.fog.color.set(b.fog);time=0;
}
function keyOf(o){
  const d=OBJ[o.k];if(!d)return null;if(d.turret)return null;let m=d.m;
  if(d.special==='garden')m=o.seed?(G.S.t>=o.ripe?'garden_2':'garden_1'):'garden';
  return m+'|'+(d.cost?0:(o.v||0));
}
function entry(key){
  let e=inst.get(key);if(e)return e;const d=OBJ[key.split('|')[0]]||{};
  e={key,set:new Set(),mesh:null,cap:0,flat:d.floor||(d.solid===0&&!d.node)};inst.set(key,e);return e;
}
function syncObj(i){
  const o=Z.obj[i],old=shown[i],d=o&&OBJ[o.k];
  if(d&&d.turret){if(old){entry(old).set.delete(i);dirty.add(old);shown[i]=null}let m=dyn.get(i);if(!m||m.userData.k!==o.k){if(m)scene.remove(m);m=new THREE.Mesh(modelGeo(d.m+'|0'),material());m.castShadow=m.receiveShadow=true;m.position.set(i%Z.w+.5,0,Math.floor(i/Z.w)+.5);m.userData.k=o.k;scene.add(m);dyn.set(i,m)}return}
  if(dyn.has(i)){scene.remove(dyn.get(i));dyn.delete(i)}
  const key=o?keyOf(o):null;
  if(old&&old!==key){entry(old).set.delete(i);dirty.add(old)}
  if(key){entry(key).set.add(i);dirty.add(key)}shown[i]=key;
}
function syncFloor(i){
  const k=Z.fl[i],key=k?'F:'+k:null,old=shownF[i];
  if(old&&old!==key){entry(old).set.delete(i);dirty.add(old)}if(key){entry(key).set.add(i);dirty.add(key)}shownF[i]=key;
}
function flush(){
  if(!dirty.size)return;const W=Z.w;
  for(const key of dirty){const e=inst.get(key);if(!e)continue;const n=e.set.size,floor=key.startsWith('F:');
    if(n>e.cap||!e.mesh){if(e.mesh){scene.remove(e.mesh);e.mesh.dispose()}e.cap=Math.max(8,Math.ceil(n*1.5));const gk=floor?key.slice(2)+'|0':key;
      e.mesh=new THREE.InstancedMesh(modelGeo(gk),material(),e.cap);e.mesh.castShadow=!e.flat&&!floor;e.mesh.receiveShadow=true;e.mesh.frustumCulled=false;scene.add(e.mesh)}
    let j=0;const mesh=e.mesh;
    for(const i of e.set){const x=i%W,y=(i-x)/W,o=floor?null:Z.obj[i],h=hash(x*31+7,y*17+3);let rot=0,s=1,sy=1,tint=1,red=0;
      if(o){const d=OBJ[o.k];if(d.node||(!d.cost&&d.solid!==1&&!d.loot)){rot=((h>>>4)%628)/100;s=.88+((h>>>14)%100)/400}else rot=(o.r||0)*Math.PI/2;
        if(d.wall&&!d.cost)rot=0;if(o.hit!==undefined&&Z.time-o.hit<.14){sy=.9;s*=1.05}
        if(o.empty)tint=.55;if(d.cost&&o.hp>0){const f=o.hp/maxHp(o.k);if(f<.6){tint=.6+f*.6;red=(.6-f)*.5}}}
      _q.setFromAxisAngle(UP,rot);_m.compose(_p.set(x+.5,0,y+.5),_q,_s.set(s,s*sy,s));mesh.setMatrixAt(j,_m);mesh.setColorAt(j,_c.setRGB(Math.min(1,tint+red),tint,tint));j++}
    mesh.count=j;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  dirty.clear();lightSrc.length=0;lightSrc.dirty=true;
}
function collectLights(){
  lightSrc.length=0;lightSrc.dirty=false;const W=Z.w;
  for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(!o)continue;const d=OBJ[o.k];if(!d.light)continue;if(d.power&&!Z.power)continue;lightSrc.push({x:i%W+.5,y:Math.floor(i/W)+.5,r:d.light,lamp:!!d.power})}
}

// ---------------------------------------------------------------- events from the sim
function onEvent(e){
  if(!Z)return;const t=e[0];
  if(t==='obj'){syncObj(e[1]);const o=Z.obj[e[1]];if(o&&o.hit!==undefined&&Z.time-o.hit<.05)wobble.push({i:e[1],t:.16})}
  else if(t==='floor')syncFloor(e[1]);
  else if(t==='zoneDirty'){for(let i=0;i<Z.w*Z.h;i++)if(Z.obj[i]||shown[i])syncObj(i)}
  else if(t==='fx')spawnFx(e[1],e[2],e[3],e[4]);
  else if(t==='shake'){if(G.S.set.shake)shakeAmt=Math.max(shakeAmt,e[1])}
  else if(t==='eq'){const r=rigs.get(0);if(r){scene.remove(r.root);disposeRig(r);rigs.delete(0)}}
  else if(t==='veh'){if(Z.home){if(vehMesh)scene.remove(vehMesh);vehMesh=new THREE.Mesh(modelGeo(VEHICLES[G.S.veh].m+'|0'),material());vehMesh.position.set(Z.w/2+3.2,0,Z.h-4.5);vehMesh.rotation.y=.5;vehMesh.castShadow=true;scene.add(vehMesh)}}
}
const PAL={wood:['#8a5a2b','#b07a40','#6a4420'],stone:['#8d8f93','#a8aaae','#6a6c70'],spark:['#ffe080','#fff0c0','#ffb040'],leaf:['#5c8a3a','#7da04a','#4a6a2a'],dust:['#b8a888','#d0c0a0','#988868'],
  explode:['#ff8020','#ffd040','#3a3028','#ff5010','#fff0a0'],toxburst:['#8ad040','#5a9a30','#c0e070'],fire:['#ff8020','#ffc040','#ff5010'],tox:['#8ad040','#c0e070'],heal:['#70e090','#b0ffc0'],die:['#5a1a1a','#8a2a2a','#3a1010'],level:['#ffd870','#fff0b0','#ffb040'],slam:['#b8a888','#8a7a60','#d0c0a0']};
function burst(x,y,z,n,cols,spd,up,life,size,grav=9,spread=1){
  for(let i=0;i<n&&parts.length<680;i++){const a=Math.random()*6.283,r=Math.random()*spd*spread;_c.set(cols[(Math.random()*cols.length)|0]);
    parts.push({x,y,z,vx:Math.cos(a)*r,vy:up*(.5+Math.random()*.8),vz:Math.sin(a)*r,life:life*(.6+Math.random()*.6),max:life,size:size*(.6+Math.random()*.8),r:_c.r,g:_c.g,b:_c.b,grav})}
}
function spawnFx(name,x,y,a){
  if(name==='blood')burst(x,.7,y,6,[a||'#8a2a2a',shade(a||'#8a2a2a',.6)],2.2,2.5,.5,.09);
  else if(name==='muzzle'){for(let i=0;i<4;i++){_c.set(PAL.spark[i%3]);const s=6+Math.random()*6,an=a+(Math.random()-.5)*.5;parts.push({x,y:.85,z:y,vx:Math.cos(an)*s,vy:Math.random(),vz:Math.sin(an)*s,life:.09,max:.09,size:.11,r:_c.r,g:_c.g,b:_c.b,grav:0})}fxLight.position.set(x,1.2,y);fxLight.color.set('#ffd080');flashT=.06;fxLight.userData.i=40}
  else if(name==='explode'){burst(x,.5,y,26,PAL.explode,5*(a||2.5)/2.5,5,.8,.22,7);burst(x,.3,y,10,PAL.dust,3,1.5,1.2,.3,1);fxLight.position.set(x,1.6,y);fxLight.color.set('#ff9040');flashT=.22;fxLight.userData.i=220}
  else if(name==='toxburst'){burst(x,.5,y,22,PAL.toxburst,4,3,1,.2,3)}
  else if(name==='slam'){for(let i=0;i<22;i++){const an=i/22*6.283,r=a||3;_c.set(PAL.slam[i%3]);parts.push({x:x+Math.cos(an)*r*.3,y:.15,z:y+Math.sin(an)*r*.3,vx:Math.cos(an)*r*1.8,vy:1.5,vz:Math.sin(an)*r*1.8,life:.5,max:.5,size:.24,r:_c.r,g:_c.g,b:_c.b,grav:4})}}
  else if(name==='ring'){for(let i=0;i<18;i++){const an=i/18*6.283,r=a||3;parts.push({x,y:.2,z:y,vx:Math.cos(an)*r*1.6,vy:0,vz:Math.sin(an)*r*1.6,life:.6,max:.6,size:.12,r:1,g:.85,b:.4,grav:0})}}
  else if(name==='arc'){const dx=a.x-x,dy=a.y-y,n=Math.max(4,Math.ceil(Math.hypot(dx,dy)*3));for(let i=0;i<=n;i++){const f=i/n;parts.push({x:x+dx*f+(Math.random()-.5)*.25,y:1+(Math.random()-.5)*.3,z:y+dy*f+(Math.random()-.5)*.25,vx:0,vy:0,vz:0,life:.14,max:.14,size:.1,r:.6,g:.85,b:1,grav:0})}}
  else if(name==='fire')burst(x,.4,y,2,PAL.fire,.6,2.2,.5,.14,-2);
  else if(name==='heal'||name==='level')burst(x,.3,y,name==='level'?26:8,PAL[name],1,3,1,.1,-1.5);
  else if(name==='die')burst(x,.5,y,9,PAL.die,2,2.5,.7,.12);
  else if(PAL[name])burst(x,name==='dust'?.2:.7,y,name==='dust'?8:5,PAL[name],name==='spark'?3.5:2,name==='dust'?1.2:2.6,name==='dust'?.8:.5,name==='dust'?.2:.09,name==='dust'?1:9);
}

// ---------------------------------------------------------------- per-frame sync
function syncActors(dt){
  const S=G.S,p=Z.pl;frame++;let bars=0;
  const camQ=cam.quaternion;
  for(const a of Z.actors){
    let r=rigs.get(a.id);
    if(!r){r=a.pl?playerRig(S.p.eq):rigFor(a.def,a.sv||a.id);r.wkey=null;r.root.rotation.y=Math.PI/2-a.a;rigs.set(a.id,r);scene.add(r.root)}
    r.seen=frame;r.root.position.set(a.x,0,a.y);
    let ty=Math.PI/2-a.a,dy=ty-r.root.rotation.y;dy=((dy+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;r.root.rotation.y+=dy*Math.min(1,dt*16);
    if(a.pl){
      const w=weaponDef(S),wk=w.mdl||null;if(r.wkey!==wk){setWeapon(r,wk);r.wkey=wk}
      const gun=w.t==='gun'&&(G.inp.attack||a.cd>-.6)?(['rifle','shotgun','carbine','sniper','minigun','flamer','launcher','lance','smg','crossbow','bow'].includes(w.mdl)?2:1):0;
      pose(r,{dt,t:time,mv:a.mv,atk:a.atk?a.atk.t/a.atk.dur:-1,act:a.act&&a.act.type==='gather'?a.act.t/a.act.dur*.5:0,gun,recoil:a.recoil,throwing:a.atkT>0?a.atkT:0,sneak:a.sneak,roll:a.roll?1-a.roll.t/.3:0,dead:a.dead,deadT:a.dead?(a.dT=(a.dT||0)+dt):0,flash:a.hurtT>.22?1:0,vis:1});
      if(a.dead===false)a.dT=0;
    }else{
      const d=a.def,w=['wind','windS','cast','cwind','fuse'].includes(a.st)?clamp(a.t/(d.wind||.5),0.01,1):0;
      pose(r,{dt,t:time,mv:a.mv,atk:-1,wind:w,gun:d.proj&&a.alert&&r.type==='human'?1:0,recoil:a.atkT>0?1:0,charge:a.st==='charge',stun:a.stunT>0,dead:a.dead,deadT:a.deadT,flash:a.flash,vis:a.vis});
      if(!a.dead&&bars<95&&(a.hp<a.mhp||a.boss||d.boss)&&a.vis>.5){const w0=d.boss?1.6:.7,f=clamp(a.hp/a.mhp,0,1),hy=r.h+.35;
        _m.compose(_p.set(a.x,hy,a.y),camQ,_s.set(w0+.06,.13,1));barBg.setMatrixAt(bars,_m);
        _p.set(-(w0*(1-f))/2,0,0).applyQuaternion(camQ);_p.x+=a.x;_p.y+=hy;_p.z+=a.y;_m.compose(_p,camQ,_s.set(Math.max(.001,w0*f),.085,1));barFg.setMatrixAt(bars,_m);
        barFg.setColorAt(bars,a.team===0?_c.set('#60c0ff'):d.boss?_c.set('#ff9030'):_c.set('#e04030'));bars++}
    }
  }
  for(const[id,r]of rigs)if(r.seen!==frame){scene.remove(r.root);disposeRig(r);rigs.delete(id)}
  barBg.count=barFg.count=bars;barBg.instanceMatrix.needsUpdate=barFg.instanceMatrix.needsUpdate=true;if(barFg.instanceColor)barFg.instanceColor.needsUpdate=true;
}
const PROJ={bullet:[.05,.05,.55,'#ffe9a0'],arrow:[.035,.035,.6,'#c8a070'],spit:[.16,.16,.16,'#9ad040'],flame:[.22,.22,.22,'#ff9030'],nade:[.16,.16,.16,'#3a4030'],shard:[.09,.09,.4,'#a0e8ff'],beam:[.09,.09,1.6,'#80ffe8'],bottle:[.12,.12,.2,'#c08040'],grenade:[.15,.15,.15,'#3a4030'],arc:[.1,.1,.1,'#a0d0ff']};
function syncProjs(dt){
  let n=0;
  for(const p of Z.projs){if(n>=255)break;const d=PROJ[p.kind]||PROJ.bullet;let sc=1;if(p.kind==='flame'){sc=.6+Math.random()*.9;if(Math.random()<.3&&parts.length<600)burst(p.x,.8,p.y,1,PAL.fire,.5,1.2,.3,.12,-2)}
    _e.set(p.lob?time*9:0,Math.PI/2-(p.a||0),0);_q.setFromEuler(_e);_m.compose(_p.set(p.x,p.lob?.5+p.h:.9,p.y),_q,_s.set(d[0]*sc,d[1]*sc,d[2]*sc));projMesh.setMatrixAt(n,_m);projMesh.setColorAt(n,_c.set(d[3]));n++}
  projMesh.count=n;projMesh.instanceMatrix.needsUpdate=true;if(projMesh.instanceColor)projMesh.instanceColor.needsUpdate=true;
  n=0;for(const d of Z.drops){if(n>=95)break;_q.setFromAxisAngle(UP,d.id*1.7);_m.compose(_p.set(d.x,.03+Math.abs(Math.sin(time*2.5+d.id))*.06,d.y),_q,_s.set(1,1,1));dropMesh.setMatrixAt(n++,_m)}
  dropMesh.count=n;dropMesh.instanceMatrix.needsUpdate=true;
  // ground effects
  let k=0;
  for(const a of Z.areas){if(k>=areaPool.length)break;const g=areaPool[k++],u=g.userData;g.visible=true;g.position.set(a.x,.04+k*.001,a.y);const f=1-a.t/a.T;
    if(a.kind==='tele'||a.kind==='fuse'){g.scale.setScalar(a.r);u.rim.material.color.set('#ff3020');u.disc.material.color.set('#ff3020');u.disc.scale.setScalar(Math.max(.05,f));u.disc.material.opacity=.22+f*.3;u.rim.material.opacity=.9}
    else if(a.kind==='fire'){g.scale.setScalar(a.r);u.disc.scale.setScalar(1);u.disc.material.color.set('#ff7020');u.rim.material.color.set('#ffb040');u.disc.material.opacity=.25+Math.random()*.12;u.rim.material.opacity=.5;if(Math.random()<.5)burst(a.x+(Math.random()-.5)*a.r*1.5,.2,a.y+(Math.random()-.5)*a.r*1.5,1,PAL.fire,.3,2.2,.6,.16,-2)}
    else{g.scale.setScalar(a.r);u.disc.scale.setScalar(1);u.disc.material.color.set('#7ac030');u.rim.material.color.set('#a0e050');u.disc.material.opacity=.22*Math.min(1,a.t);u.rim.material.opacity=.4*Math.min(1,a.t)}}
  if(Z.lure&&k<areaPool.length){const g=areaPool[k++],u=g.userData;g.visible=true;g.position.set(Z.lure.x,.05,Z.lure.y);g.scale.setScalar(.6+Math.sin(time*10)*.2);u.disc.scale.setScalar(1);u.disc.material.color.set('#ffd040');u.rim.material.color.set('#ffd040');u.disc.material.opacity=.4;u.rim.material.opacity=.9}
  for(;k<areaPool.length;k++)areaPool[k].visible=false;
  // turrets swivel
  for(const[i,m]of dyn){const o=Z.obj[i];if(o&&o.a!==undefined){let ty=Math.PI/2-o.a,dy=ty-m.rotation.y;dy=((dy+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;m.rotation.y+=dy*Math.min(1,dt*10)}}
  for(let w=wobble.length-1;w>=0;w--){wobble[w].t-=dt;if(wobble[w].t<=0){const key=shown[wobble[w].i];if(key)dirty.add(key);wobble.splice(w,1)}}
}
function stepParts(dt){
  let n=0;
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;if(p.life<=0){parts[i]=parts[parts.length-1];parts.pop();continue}
    p.vy-=p.grav*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.03&&p.grav>0){p.y=.03;p.vy*=-.3;p.vx*=.6;p.vz*=.6}}
  for(const p of parts){const s=p.size*Math.min(1,p.life/p.max*2.5);_m.makeScale(s,s,s);_m.setPosition(p.x,p.y,p.z);partMesh.setMatrixAt(n,_m);partMesh.setColorAt(n,_c.setRGB(p.r,p.g,p.b));n++}
  partMesh.count=n;partMesh.instanceMatrix.needsUpdate=true;if(partMesh.instanceColor)partMesh.instanceColor.needsUpdate=true;
}
function stepWeather(dt,W){
  const kind=Z.dark?null:W.rain?'rain':W.snow?'snow':W.spores?'spores':null,want=kind==='rain'?(W.rain>1?420:260):kind?200:0;
  while(wx.length<want)wx.push({x:(Math.random()-.5)*34,y:Math.random()*14,z:(Math.random()-.5)*30,s:Math.random()});if(wx.length>want)wx.length=want;
  const fall=kind==='rain'?22:kind==='snow'?2.4:.5;let n=0;
  for(const d of wx){d.y-=fall*dt*(.8+d.s*.4);if(kind!=='rain'){d.x+=Math.sin(time+d.s*9)*dt*.8;d.z+=Math.cos(time*.7+d.s*5)*dt*.5}if(d.y<0){d.y=13+Math.random()*2;d.x=(Math.random()-.5)*34;d.z=(Math.random()-.5)*30}
    if(kind==='rain')_s.set(.02,.5,.02);else if(kind==='snow')_s.set(.07,.07,.07);else _s.set(.06,.06,.06);
    _m.makeScale(_s.x,_s.y,_s.z);_m.setPosition(camT.x+d.x,d.y,camT.z+d.z);wxMesh.setMatrixAt(n,_m);wxMesh.setColorAt(n,kind==='rain'?_c.set('#b8d0e8'):kind==='snow'?_c.set('#ffffff'):_c.set('#b0a0e0'));n++}
  wxMesh.count=n;if(n){wxMesh.instanceMatrix.needsUpdate=true;if(wxMesh.instanceColor)wxMesh.instanceColor.needsUpdate=true}
}
const NIGHT_FOG=new C('#0b0f18'),NIGHT_SUN=new C('#5a76c0'),WARM=new C('#ffa860'),SKY_D=new C('#cfe0ff'),SKY_N=new C('#34446e'),GR_D=new C('#5a5040'),GR_N=new C('#141824');
function stepLight(dt,W){
  const S=G.S,b=BIOMES[Z.biome]||BIOMES.forest,p=Z.pl;let dl=Z.dark?.1:daylight(S.t);const wl=W.light||1,ramp=Z.dark?0:1-Math.abs(dl*2-1);
  _c.set(b.sun).lerp(WARM,ramp*.55);sun.color.copy(NIGHT_SUN).lerp(_c,Math.min(1,dl*1.4));sun.intensity=(.22+2.1*dl)*(dl>.2?wl:1);
  const h=(S.t/60)%24,ang=dl>0?(h-12)/12*1.1:(h<12?h+12:h-12-12)/12*.8;sun.position.set(camT.x+Math.sin(ang)*18-6,26,camT.z+9+Math.cos(ang)*4);sun.target.position.copy(camT);
  hemi.color.copy(SKY_N).lerp(SKY_D,dl);hemi.groundColor.copy(GR_N).lerp(GR_D,dl);hemi.intensity=(.34+.78*dl)*(.6+wl*.4);
  _c.set(b.fog).multiplyScalar(.55+.45*wl);_c2.copy(NIGHT_FOG).lerp(_c,Math.pow(dl,.8));if(W.spores)_c2.lerp(_c.set('#5a4a80'),.4);
  scene.fog.color.lerp(_c2,Math.min(1,dt*2));scene.background.copy(scene.fog.color);
  const fogK=(W.fog?.5:W.rain?.85:1)*(Z.dark?.75:1)*(.75+.25*dl),zf=camOff.length()*zoomEff()/16;scene.fog.near=20*fogK*zf;scene.fog.far=(50*fogK+4)*zf;
  // the player's own light and the nearest fires
  const dark=1-dl;plight.position.set(p.x,1.5,p.y);plight.intensity=dark*(G.ds&&G.ds.light?26:11);plight.distance=G.ds&&G.ds.light?15:9;
  if(lightSrc.dirty!==false)collectLights();
  const near=lightSrc.map(l=>({l,d:(l.x-p.x)**2+(l.y-p.y)**2})).sort((a,c)=>a.d-c.d);
  for(let i=0;i<lightPool.length;i++){const L=lightPool[i],s=near[i];if(s&&s.d<900){L.position.set(s.l.x,1.3,s.l.y);L.color.set(s.l.lamp?'#e8f0ff':'#ff9a40');L.distance=s.l.r*1.7;L.intensity=(.25+dark*.9)*s.l.r*(s.l.lamp?3:2.6)*(s.l.lamp?1:.88+Math.sin(time*11+i*2)*.07+Math.sin(time*23+i)*.05)}else L.intensity=0}
  if(flashT>0){flashT-=dt;fxLight.intensity=fxLight.userData.i*Math.max(0,flashT)*6}else fxLight.intensity=0;
}
const zoomEff=()=>zoom*(cam.aspect<1?1.12:1);
function draw(dt){
  if(!Z||!R)return;time+=dt;const p=Z.pl,W=WEATHER[G.S.weather.id]||WEATHER.clear;
  // camera
  const lead=G.inp.aim&&!G.build?.12:0,tx=p.x+(lead?(G.inp.aim.x-p.x)*lead:0),tz=p.y+(lead?(G.inp.aim.y-p.y)*lead:0);
  camT.x+=(tx-camT.x)*Math.min(1,dt*7);camT.z+=(tz-camT.z)*Math.min(1,dt*7);
  const ze=zoomEff();cam.position.set(camT.x,camOff.y*ze,camT.z+camOff.z*ze);
  if(shakeAmt>0){cam.position.x+=(Math.random()-.5)*shakeAmt;cam.position.y+=(Math.random()-.5)*shakeAmt;shakeAmt=Math.max(0,shakeAmt-dt*1.6)}
  cam.lookAt(camT.x,.6,camT.z);cam.updateMatrixWorld();
  syncActors(dt);syncProjs(dt);flush();stepParts(dt);stepWeather(dt,W);stepLight(dt,W);
  // hint ring and placement ghost
  const h=Z.hint;if(h&&!G.build&&!p.dead){hintRing.visible=true;hintRing.position.set(h.x,.05,h.y);hintRing.scale.setScalar(1+Math.sin(time*5)*.06)}else hintRing.visible=false;
  playerRing.visible=!p.dead;playerRing.position.set(p.x,.04,p.y);
  R.render(scene,cam);
  // adaptive quality
  fpsAcc+=dt;fpsN++;if(fpsAcc>=1){fps=Math.round(fpsN/fpsAcc);fpsAcc=0;fpsN=0;if(G.S.set.quality==='auto'&&!window.__shots){if(fps<27)lowT++;else lowT=0;if(lowT>=5){lowT=0;if(quality==='high')setQuality('med');else if(quality==='med')setQuality('low')}}}
}
/** Screen point → sim ground coordinates. */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new V3(0,1,0),0),hitP=new V3();
function pick(cx,cy){const r=canvas.getBoundingClientRect();ndc.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height*2-1));ray.setFromCamera(ndc,cam);return ray.ray.intersectPlane(plane,hitP)?{x:hitP.x,y:hitP.z}:null}
/** Sim point (+height) → screen pixels relative to the canvas. */
function project(x,y,h=0){_p.set(x,h,y).project(cam);const r=canvas.getBoundingClientRect();return{x:(_p.x*.5+.5)*r.width,y:(-_p.y*.5+.5)*r.height,vis:_p.z<1}}
/** Placement preview in build mode. kind=null hides it. */
const ghostMat=new THREE.MeshBasicMaterial({color:'#7cff7c',transparent:true,opacity:.5,depthWrite:false});
function setGhost(kind,tx,ty,ok,rot=0){
  if(!kind||tx==null){if(ghost)ghost.visible=false;ghostTile.visible=false;return}
  ghostTile.visible=true;ghostTile.position.set(tx+.5,.06,ty+.5);ghostTile.material.color.set(ok?'#7cff7c':'#ff5a4a');
  if(kind==='*'){if(ghost)ghost.visible=false;return}
  const key=OBJ[kind].m+'|0';if(!ghost){ghost=new THREE.Mesh(modelGeo(key),ghostMat);scene.add(ghost)}if(ghost.userData.key!==key){ghost.geometry=modelGeo(key);ghost.userData.key=key}
  ghost.visible=true;ghost.position.set(tx+.5,.02,ty+.5);ghost.rotation.y=rot*Math.PI/2;ghostMat.color.set(ok?'#7cff7c':'#ff5a4a');
}

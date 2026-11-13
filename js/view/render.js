// The renderer: turns the current zone into a three.js scene and keeps it in step with the simulation.
// Sim (x, y) maps to world (X, Z); Y is up. A sim facing angle a becomes rotation.y = π/2 − a.
import {THREE,Geo,material,shade,toon} from './geo.js';
import {Post,inkBlend,noInk} from './post.js';
import {PROPS} from './props.js';
import {rigFor,playerRig,setWeapon,pose,disposeRig} from './rigs.js';
import {groundTex,cloudTex,glowTex,puffTex,starTex,rippleTex,CLUTTER_BY_BIOME,clutterGeo,windMaterial,setWind} from './scenery.js';
import {OBJ,GROUND,G as GT} from '../data/objects.js';
import {BIOMES} from '../data/world.js';
import {VEHICLES} from '../data/recipes.js';
import {WEATHER} from '../data/events.js';
import {G,weaponDef,maxHp,EXIT_RING} from '../sim/core.js';
import {daylight} from '../sim/world.js';
import {hash,clamp} from '../sim/util.js';

const V3=THREE.Vector3,M4=THREE.Matrix4,Q=THREE.Quaternion,C=THREE.Color;
const _m=new M4(),_q=new Q(),_q2=new Q(),_p=new V3(),_s=new V3(),_c=new C(),_c2=new C(),_e=new THREE.Euler(),UP=new V3(0,1,0),ZERO=new M4().makeScale(0,0,0);
const MARGIN=18,QUAL={low:{pr:1,shadow:0,dens:.3,aa:0},med:{pr:1.5,shadow:1024,dens:.65,aa:2},high:{pr:2,shadow:2048,dens:1,aa:4}};
let R,post,scene,cam,sun,hemi,plight,fxLight,canvas,quality='high',zoom=.82,Z=null,frame=0,time=0;
let ground=null,water=null,borderMeshes=[],clutterMeshes=[],vehMesh=null,clouds=null;
let matStd,matTree,matBush,matGrass,matClutter,matClutterWind,matGround,matWater,texCloud;
const geoCache=new Map(),inst=new Map(),shown=[],shownF=[],dirty=new Set(),dyn=new Map(),wobble=[],clutterAt=new Map();
const rigs=new Map(),lightPool=[],lightSrc=[];
let projMesh,dropMesh,barBg,barFg,starMesh,partMesh,wxMesh,decalMesh,glowMesh,aoMesh,aoActors,hintRing,ghost=null,ghostTile,areaPool=[],arcPool=[],playerRing;
const parts=[],wx=[],decals=[],glows=[],stars=[];let decalN=0,decalDirty=true,shakeAmt=0,flashT=0,boltT=8,boltF=0,ambT=0;
const camT=new V3(),camOff=new V3(0,13.5,9.4),basicBox=new THREE.BoxGeometry(1,1,1);
let fps=60,fpsAcc=0,fpsN=0,lowT=0;

export const View={init,setZone,frame:draw,onEvent,resize,pick,project,setGhost,setQuality,get quality(){return quality},setZoom(z){zoom=clamp(z,.6,1.5)},get zoom(){return zoom},get fps(){return fps},get ink(){return !!(post&&post.ok&&post.rt)},shot:()=>R.domElement.toDataURL()};

function modelGeo(key,lo){
  const ck=lo?key+'~':key;let g=geoCache.get(ck);if(g)return g;const[m,v]=key.split('|'),fn=PROPS[m];const b=new Geo();Geo.DETAIL=lo?0:1;
  if(fn){try{fn(b,+v||0)}catch(e){console.error('model '+m,e);b.box(.8,.8,.8,'#ff00ff',0,.4,0)}}else{console.error('no model for '+key);b.box(.8,.8,.8,'#ff00ff',0,.4,0)}
  Geo.DETAIL=1;g=b.build();geoCache.set(ck,g);return g;
}
const SWAY_TREE=/^tree_/,SWAY_BUSH=/^(bush_|cactus|scarecrow|flag)/,SWAY_GRASS=/^(grass_tall|herb_patch|wild_crop|garden_[12]|bloom|flowers|mushrooms)/;
const matFor=key=>SWAY_TREE.test(key)?matTree:SWAY_BUSH.test(key)?matBush:SWAY_GRASS.test(key)?matGrass:matStd;

function init(cv,q){
  canvas=cv;R=new THREE.WebGLRenderer({canvas:cv,antialias:false,powerPreference:'high-performance'});post=new Post(R);
  scene=new THREE.Scene();scene.background=new C('#a9c0a0');scene.fog=new THREE.Fog('#a9c0a0',24,52);
  cam=new THREE.PerspectiveCamera(38,1,1,160);
  matStd=material();matTree=windMaterial(.011,.004,{amp:.16,scale:1.2,ink:.4});matBush=windMaterial(.03,.02,{amp:.16,scale:1.2,ink:.4});matGrass=windMaterial(.1,.1,{amp:.1,scale:1.2,ink:.4});
  // ground cover is never outlined: it writes an ink weight of zero
  matClutter=toon({ink:0});matClutterWind=windMaterial(.1,.1,{amp:.1,scale:1.2,ink:0});
  matGround=toon({ink:0,amp:.06},{map:groundTex()});
  // the painted patches fade out on pale ground (snow, tile, concrete), where they would read as stains
  {const prev=matGround.onBeforeCompile,key=matGround.customProgramCacheKey();matGround.onBeforeCompile=(sh,r)=>{sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>','vec3 gtx=texture2D(map,vMapUv).rgb;diffuseColor.rgb*=mix(gtx,vec3(1.0),smoothstep(.42,.8,dot(vColor.rgb,vec3(.3,.6,.1)))*.72);');prev(sh,r)};matGround.customProgramCacheKey=()=>key+'gnd'}
  matWater=new THREE.MeshPhongMaterial(Object.assign({color:'#3a9ad0',transparent:true,opacity:.84,shininess:160,specular:'#ffffff',bumpMap:rippleTex(),bumpScale:.9},inkBlend()));
  hemi=new THREE.HemisphereLight('#d6e2ff','#8f86b0',1);scene.add(hemi);
  sun=new THREE.DirectionalLight('#fff2d8',2.2);sun.castShadow=true;sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;scene.add(sun);scene.add(sun.target);
  plight=new THREE.PointLight('#ffd9a0',0,13,1.6);scene.add(plight);fxLight=new THREE.PointLight('#ffb060',0,14,1.5);scene.add(fxLight);
  for(let i=0;i<4;i++){const l=new THREE.PointLight('#ffb060',0,12,1.6);scene.add(l);lightPool.push(l)}
  const basic=o=>new THREE.MeshBasicMaterial(Object.assign({color:'#ffffff'},o&&o.transparent?inkBlend(o.blending===THREE.AdditiveBlending):null,o,o&&o.blending===THREE.AdditiveBlending?{blending:THREE.CustomBlending}:null));
  projMesh=new THREE.InstancedMesh(basicBox,noInk(basic({toneMapped:false})),256);dropMesh=new THREE.InstancedMesh(modelGeo('lootbag|0'),matStd,96);dropMesh.castShadow=true;
  const plane=new THREE.PlaneGeometry(1,1);barBg=new THREE.InstancedMesh(plane,basic({color:'#15130f',depthTest:false,transparent:true,opacity:.75,toneMapped:false}),96);barFg=new THREE.InstancedMesh(plane,basic({depthTest:false,transparent:true,toneMapped:false}),96);
  wxMesh=new THREE.InstancedMesh(basicBox,basic({transparent:true,opacity:.55}),500);
  decalMesh=new THREE.InstancedMesh(new THREE.CircleGeometry(1,12).rotateX(-Math.PI/2),basic({transparent:true,opacity:.72,depthWrite:false}),140);
  const texGlow=glowTex(),flat=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2),aoMat=()=>basic({map:texGlow,color:'#10122c',transparent:true,opacity:.5,depthWrite:false});
  glowMesh=new THREE.InstancedMesh(plane,basic({map:texGlow,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false}),90);
  partMesh=new THREE.InstancedMesh(plane,basic({map:puffTex(),transparent:true,depthWrite:false}),900);partMesh.renderOrder=5;
  // impact stars: a white flash that pops where a blow lands
  starMesh=new THREE.InstancedMesh(plane,basic({map:starTex(),transparent:true,depthWrite:false,depthTest:false,toneMapped:false}),24);starMesh.count=0;starMesh.frustumCulled=false;starMesh.renderOrder=7;scene.add(starMesh);
  // soft contact shadows: a dark blob under everything that stands on the ground
  aoMesh=new THREE.InstancedMesh(flat,aoMat(),3200);aoActors=new THREE.InstancedMesh(flat,aoMat(),110);aoMesh.renderOrder=1;aoActors.renderOrder=1;
  for(const m of[projMesh,dropMesh,barBg,barFg,partMesh,wxMesh,decalMesh,glowMesh,aoMesh,aoActors]){m.count=0;m.frustumCulled=false;scene.add(m)}barBg.renderOrder=10;barFg.renderOrder=11;decalMesh.renderOrder=1;glowMesh.renderOrder=6;
  for(const m of[projMesh,barFg,partMesh,wxMesh,decalMesh,glowMesh]){m.setColorAt(0,_c.set('#fff'));m.instanceColor.setUsage(THREE.DynamicDrawUsage)}
  const ring=(r0,r1,col,op)=>{const m=new THREE.Mesh(new THREE.RingGeometry(r0,r1,28).rotateX(-Math.PI/2),basic({color:col,transparent:true,opacity:op,depthWrite:false,toneMapped:false}));m.visible=false;scene.add(m);return m};
  hintRing=ring(.46,.56,'#ffd870',.9);playerRing=ring(.3,.36,'#ffffff',.22);
  ghostTile=new THREE.Mesh(new THREE.PlaneGeometry(.96,.96).rotateX(-Math.PI/2),basic({color:'#7cff7c',transparent:true,opacity:.35,depthWrite:false,toneMapped:false}));ghostTile.visible=false;scene.add(ghostTile);
  for(let i=0;i<28;i++){const g=new THREE.Group(),disc=new THREE.Mesh(new THREE.CircleGeometry(1,28).rotateX(-Math.PI/2),basic({color:'#ff3020',transparent:true,opacity:.3,depthWrite:false,toneMapped:false})),rim=new THREE.Mesh(new THREE.RingGeometry(.94,1,32).rotateX(-Math.PI/2),basic({color:'#ff3020',transparent:true,opacity:.8,depthWrite:false,toneMapped:false}));g.add(disc);g.add(rim);g.visible=false;g.userData={disc,rim};scene.add(g);areaPool.push(g)}
  // weapon swing arcs: a fan in front of the model (+Z), faded out over a few frames
  for(let i=0;i<4;i++){const m=new THREE.Mesh(new THREE.RingGeometry(.45,1,18,1,-Math.PI/2-.95,1.9).rotateX(-Math.PI/2),basic({color:'#fff6dc',transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false}));m.visible=false;m.userData.t=0;scene.add(m);arcPool.push(m)}
  // drifting cloud shadows
  texCloud=cloudTex();texCloud.repeat.set(2.4,2.4);clouds=new THREE.Mesh(new THREE.PlaneGeometry(150,150).rotateX(-Math.PI/2),basic({map:texCloud,color:'#101440',transparent:true,opacity:.2,depthWrite:false}));clouds.renderOrder=2;clouds.position.y=.06;scene.add(clouds);
  setQuality(q||'auto');resize();
}
function setQuality(q){
  if(q==='auto')q=(matchMedia('(pointer:coarse)').matches||Math.min(screen.width,screen.height)<700)?'med':'high';
  const was=quality;quality=q;const o=QUAL[q]||QUAL.med;R.setPixelRatio(Math.min(o.pr,devicePixelRatio||1));
  R.shadowMap.enabled=!!o.shadow;R.shadowMap.type=THREE.PCFSoftShadowMap;if(o.shadow){sun.shadow.mapSize.set(o.shadow,o.shadow);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
  post.set(o.aa,1,q==='low'?2:4);sun.castShadow=!!o.shadow;const sc=sun.shadow.camera;sc.left=-19;sc.right=19;sc.top=19;sc.bottom=-19;sc.near=1;sc.far=70;sc.updateProjectionMatrix();
  scene.traverse(o=>{if(o.material&&o.material.needsUpdate!==undefined)o.material.needsUpdate=true});resize();
  if(Z&&was!==q&&(QUAL[was]||{}).dens!==o.dens)buildClutter();
}
function resize(){if(!R)return;const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.fov=w<h?46:38;cam.updateProjectionMatrix()}

// ---------------------------------------------------------------- zone build
function disposeZone(){
  if(ground){scene.remove(ground);ground.geometry.dispose();ground=null}if(water){scene.remove(water);water.geometry.dispose();water=null}
  for(const m of borderMeshes){scene.remove(m);m.dispose()}borderMeshes=[];for(const m of clutterMeshes){scene.remove(m);m.dispose()}clutterMeshes=[];clutterAt.clear();
  for(const e of inst.values()){scene.remove(e.mesh);e.mesh.dispose()}inst.clear();shown.length=0;shownF.length=0;dirty.clear();
  for(const m of dyn.values())scene.remove(m);dyn.clear();
  for(const r of rigs.values()){scene.remove(r.root);disposeRig(r)}rigs.clear();
  if(vehMesh){scene.remove(vehMesh);vehMesh=null}parts.length=0;stars.length=0;wobble.length=0;decals.length=0;decalN=0;decalDirty=true;glows.length=0;if(aoMesh)aoMesh.count=0;
}
const HARD={asphalt:1,concrete:1,tile:1,boards:1,water:1};
function buildGround(b){
  const W=Z.w,H=Z.h,GW2=W+MARGIN*2,GH2=H+MARGIN*2,pos=[],col=[],uv=[],wpos=[],wuv=[];
  const base=new C(GROUND.find(g=>g.id===b.g).c),path=new C('#96805a');
  // one colour per tile, soft-blended at the corners for natural ground; paving keeps hard edges
  const tc=new Float32Array(GW2*GH2*3),hard=new Uint8Array(GW2*GH2);
  for(let y=-MARGIN;y<H+MARGIN;y++)for(let x=-MARGIN;x<W+MARGIN;x++){
    const inside=x>=0&&y>=0&&x<W&&y<H,h=hash(x+500,y+500)/4294967295,j=((y+MARGIN)*GW2+x+MARGIN);
    if(inside){const g=GROUND[Z.g[y*W+x]];_c.set(g.c);if(HARD[g.id])hard[j]=1;else if(x<EXIT_RING||y<EXIT_RING||x>=W-EXIT_RING||y>=H-EXIT_RING)_c.lerp(path,.35)}else{_c.copy(base).multiplyScalar(.82)}
    _c.multiplyScalar((hard[j]?.98+h*.1:.94+h*.2)*1.1);tc[j*3]=_c.r;tc[j*3+1]=_c.g;tc[j*3+2]=_c.b}
  const cc=[0,0,0],corner=(cx,cy)=>{let r=0,g=0,bl=0,n=0;for(let dy=-1;dy<=0;dy++)for(let dx=-1;dx<=0;dx++){const xx=cx+dx+MARGIN,yy=cy+dy+MARGIN;if(xx<0||yy<0||xx>=GW2||yy>=GH2)continue;const j=yy*GW2+xx;if(hard[j])continue;r+=tc[j*3];g+=tc[j*3+1];bl+=tc[j*3+2];n++}if(n){cc[0]=r/n;cc[1]=g/n;cc[2]=bl/n;return true}return false};
  const quad=(x0,z0,x1,z1,y,r,g,bl)=>{for(const[vx,vz]of[[x0,z0],[x0,z1],[x1,z1],[x0,z0],[x1,z1],[x1,z0]]){pos.push(vx,y,vz);col.push(r,g,bl);uv.push(vx/3.7,vz/3.7)}};
  const A=(x,y,id)=>x>=0&&y>=0&&x<W&&y<H&&Z.g[y*W+x]===id;
  for(let y=-MARGIN;y<H+MARGIN;y++)for(let x=-MARGIN;x<W+MARGIN;x++){
    const inside=x>=0&&y>=0&&x<W&&y<H,j=((y+MARGIN)*GW2+x+MARGIN),gid=inside?Z.g[y*W+x]:-1,wet=gid===GT.water,yy=wet?-.09:0,r0=tc[j*3],g0=tc[j*3+1],b0=tc[j*3+2];
    for(const[vx,vz]of[[x,y],[x,y+1],[x+1,y+1],[x,y],[x+1,y+1],[x+1,y]]){pos.push(vx,yy,vz);uv.push(vx/3.7,vz/3.7);if(!hard[j]&&corner(vx,vz))col.push(cc[0],cc[1],cc[2]);else col.push(r0,g0,b0)}
    if(!inside)continue;
    if(wet){for(const[vx,vz]of[[x,y],[x,y+1],[x+1,y+1],[x,y],[x+1,y+1],[x+1,y]]){wpos.push(vx,-.025,vz);wuv.push(vx/2.6,vz/2.6)}continue}
    const h=hash(x*7+3,y*13+1),id=GROUND[gid].id,d=(f)=>[r0*f,g0*f,b0*f];
    if(id==='boards'){const c=d(.6);quad(x,y+.32,x+1,y+.345,.004,...c);quad(x,y+.66,x+1,y+.685,.004,...c);const e=(h%80)/100;quad(x+e,y,x+e+.025,y+.32,.004,...c);quad(x+((h>>>8)%80)/100,y+.345,x+((h>>>8)%80)/100+.025,y+.66,.004,...c)}
    else if(id==='tile'){const c=d(.68);quad(x,y,x+1,y+.03,.004,...c);quad(x,y,x+.03,y+1,.004,...c);if(h%9===0)quad(x+.2,y+.2,x+.8,y+.8,.003,...d(.9))}
    else if(id==='concrete'){const c=d(.76);if(x%2===0)quad(x,y,x+.03,y+1,.004,...c);if(y%2===0)quad(x,y,x+1,y+.03,.004,...c);if(h%6===0)quad(x+.1+(h%50)/100,y+.15,x+.3+(h%50)/100,y+.2+((h>>>6)%60)/100,.003,...d(.86))}
    else if(id==='asphalt'){const a=GT.asphalt;
      if(A(x,y-1,a)&&A(x,y+1,a)&&!A(x,y-2,a)&&!A(x,y+2,a)&&x%2===0)quad(x+.12,y+.46,x+.88,y+.54,.004,.62,.54,.2);
      else if(A(x-1,y,a)&&A(x+1,y,a)&&!A(x-2,y,a)&&!A(x+2,y,a)&&y%2===0)quad(x+.46,y+.12,x+.54,y+.88,.004,.62,.54,.2);
      if(h%4===0)quad(x+(h%60)/100,y+((h>>>7)%60)/100,x+(h%60)/100+.35,y+((h>>>7)%60)/100+.3,.003,...d(h%8===0?1.18:.84))}
    else if(id==='path'||id==='dirt'||id==='mud'){if(h%3===0)quad(x+(h%70)/100,y+((h>>>7)%70)/100,x+(h%70)/100+.22,y+((h>>>7)%70)/100+.16,.003,...d(.86))}
  }
  const geo=(p,c,u)=>{const g=new THREE.BufferGeometry(),n=new Float32Array(p.length);for(let i=1;i<n.length;i+=3)n[i]=1;g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.BufferAttribute(n,3));if(c)g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));return g};
  ground=new THREE.Mesh(geo(pos,col,uv),matGround);ground.receiveShadow=true;scene.add(ground);
  if(wpos.length){water=new THREE.Mesh(geo(wpos,null,wuv),matWater);water.receiveShadow=true;water.renderOrder=1;scene.add(water)}
}
/** Grass, stones, litter: small instanced decoration that never blocks anything. */
function buildClutter(){
  for(const m of clutterMeshes){scene.remove(m);m.dispose()}clutterMeshes=[];clutterAt.clear();if(!Z)return;
  const W=Z.w,H=Z.h,list=CLUTTER_BY_BIOME[Z.biome]||CLUTTER_BY_BIOME.forest,dens=(QUAL[quality]||QUAL.med).dens,M=quality==='low'?0:quality==='med'?4:7,buckets={};
  for(let y=-M;y<H+M;y++)for(let x=-M;x<W+M;x++){
    const inside=x>=0&&y>=0&&x<W&&y<H,i=y*W+x;let gid='';
    if(inside){gid=GROUND[Z.g[i]].id;if(gid==='water')continue;const o=Z.obj[i];if(o){const d=OBJ[o.k];if(d.wall||d.cost||d.solid===1)continue}if(Z.fl[i])continue}
    const paved=!!HARD[gid],bare=gid==='path'||gid==='dirt'||gid==='mud'||gid==='sand';
    list.forEach(([name,d,wind,pave],k)=>{
      if(paved&&!pave)return;let n=d*dens*(inside?1:.55)*(bare&&wind?.2:1)*(paved?.6:1);const h0=hash(x*73+k*911,y*91+k*13);let cnt=Math.floor(n)+((h0%1000)/1000<n-Math.floor(n)?1:0);
      for(let c=0;c<cnt;c++){const h=hash(x*131+c*17+k*5,y*197+c*29),key=name+'|'+((h>>>20)%3);(buckets[key]=buckets[key]||{wind,rows:[]}).rows.push([x+(h&255)/255,y+((h>>>8)&255)/255,((h>>>4)%628)/100,.75+((h>>>14)%100)/160,inside?i:-1])}});
  }
  for(const key in buckets){const b=buckets[key],[name,v]=key.split('|'),m=new THREE.InstancedMesh(clutterGeo(name,+v),b.wind?matClutterWind:matClutter,b.rows.length);m.castShadow=false;m.receiveShadow=true;m.frustumCulled=false;
    b.rows.forEach(([x,z,rot,s,tile],idx)=>{_q.setFromAxisAngle(UP,rot);_m.compose(_p.set(x,0,z),_q,_s.set(s,s,s));m.setMatrixAt(idx,_m);if(tile>=0&&Z.home){let a=clutterAt.get(tile);if(!a)clutterAt.set(tile,a=[]);a.push(m,idx)}});
    scene.add(m);clutterMeshes.push(m)}
}
function hideClutter(i){const a=clutterAt.get(i);if(!a)return;for(let k=0;k<a.length;k+=2){a[k].setMatrixAt(a[k+1],ZERO);a[k].instanceMatrix.needsUpdate=true}clutterAt.delete(i)}
function setZone(z){
  disposeZone();Z=z;if(!Z)return;const b=BIOMES[Z.biome]||BIOMES.forest,W=Z.w,H=Z.h;
  buildGround(b);buildClutter();
  // tree line beyond the edge
  const lists={};
  for(let y=-MARGIN+2;y<H+MARGIN-2;y++)for(let x=-MARGIN+2;x<W+MARGIN-2;x++){if(x>=-1&&y>=-1&&x<=W&&y<=H)continue;const h=hash(x*3+11,y*7+5);if((h%100)>=(Z.home||Z.biome==='forest'||Z.biome==='frost'||Z.biome==='gray'?40:16))continue;
    const kind=b.border[(h>>>8)%b.border.length],key=kind+'|'+((h>>>12)%3);(lists[key]=lists[key]||[]).push([x,y,h])}
  for(const key in lists){const L=lists[key],m=new THREE.InstancedMesh(modelGeo(key,quality==='low'),matFor(key),L.length);m.castShadow=false;m.receiveShadow=true;m.frustumCulled=false;
    L.forEach(([x,y,h],i)=>{const s=.9+((h>>>16)%100)/250;_q.setFromAxisAngle(UP,((h>>>4)%628)/100);_m.compose(_p.set(x+.5,0,y+.5),_q,_s.set(s,s,s));m.setMatrixAt(i,_m)});scene.add(m);borderMeshes.push(m)}
  for(let i=0;i<W*H;i++){if(Z.obj[i])syncObj(i);if(Z.fl[i])syncFloor(i)}flush();
  if(Z.home&&G.S.veh>0&&VEHICLES[G.S.veh].m)parkVehicle();
  const p=Z.pl;if(p)camT.set(p.x,0,p.y);scene.fog.color.set(b.fog);time=0;
}
function parkVehicle(){if(vehMesh)scene.remove(vehMesh);vehMesh=new THREE.Mesh(modelGeo(VEHICLES[G.S.veh].m+'|0'),matStd);vehMesh.position.set(Z.w/2+3.2,0,Z.h-4.5);vehMesh.rotation.y=.5;vehMesh.castShadow=vehMesh.receiveShadow=true;scene.add(vehMesh)}
function keyOf(o){
  const d=OBJ[o.k];if(!d||d.turret)return null;let m=d.m;
  if(d.special==='garden')m=o.seed?(G.S.t>=o.ripe?'garden_2':'garden_1'):'garden';
  return m+'|'+(d.cost?0:(o.v||0));
}
function entry(key){
  let e=inst.get(key);if(e)return e;const d=OBJ[key.split('|')[0]]||{};
  e={key,set:new Set(),mesh:null,cap:0,flat:d.floor||(d.solid===0&&!d.node)};inst.set(key,e);return e;
}
function syncObj(i){
  const o=Z.obj[i],old=shown[i],d=o&&OBJ[o.k];
  if(d&&(d.cost||d.solid===1))hideClutter(i);
  if(d&&d.turret){if(old){entry(old).set.delete(i);dirty.add(old);shown[i]=null}let m=dyn.get(i);if(!m||m.userData.k!==o.k){if(m)scene.remove(m);m=new THREE.Mesh(modelGeo(d.m+'|0'),matStd);m.castShadow=m.receiveShadow=true;m.position.set(i%Z.w+.5,0,Math.floor(i/Z.w)+.5);m.userData.k=o.k;scene.add(m);dyn.set(i,m)}return}
  if(dyn.has(i)){scene.remove(dyn.get(i));dyn.delete(i)}
  const key=o?keyOf(o):null;
  if(old&&old!==key){entry(old).set.delete(i);dirty.add(old)}
  if(key){entry(key).set.add(i);dirty.add(key)}shown[i]=key;
}
function syncFloor(i){
  const k=Z.fl[i],key=k?'F:'+k:null,old=shownF[i];if(k)hideClutter(i);
  if(old&&old!==key){entry(old).set.delete(i);dirty.add(old)}if(key){entry(key).set.add(i);dirty.add(key)}shownF[i]=key;
}
function flush(){
  if(!dirty.size)return;const W=Z.w;
  for(const key of dirty){const e=inst.get(key);if(!e)continue;const n=e.set.size,floor=key.startsWith('F:');
    if(n>e.cap||!e.mesh){if(e.mesh){scene.remove(e.mesh);e.mesh.dispose()}e.cap=Math.max(8,Math.ceil(n*1.5));const gk=floor?key.slice(2)+'|0':key;
      e.mesh=new THREE.InstancedMesh(modelGeo(gk),floor?matClutter:matFor(gk),e.cap);e.mesh.castShadow=!e.flat&&!floor;e.mesh.receiveShadow=true;e.mesh.frustumCulled=false;scene.add(e.mesh)}
    let j=0;const mesh=e.mesh;
    for(const i of e.set){const x=i%W,y=(i-x)/W,o=floor?null:Z.obj[i],h=hash(x*31+7,y*17+3);let rot=0,s=1,sy=1,tint=1,red=0;
      if(o){const d=OBJ[o.k];if(d.node||(!d.cost&&d.solid!==1&&!d.loot)){rot=((h>>>4)%628)/100;s=.88+((h>>>14)%100)/400}else rot=(o.r||0)*Math.PI/2;
        if(d.wall&&!d.cost)rot=0;if(o.hit!==undefined&&Z.time-o.hit<.14){sy=.9;s*=1.05}
        if(o.empty)tint=.55;if(d.cost&&o.hp>0){const f=o.hp/maxHp(o.k);if(f<.6){tint=.6+f*.6;red=(.6-f)*.5}}}
      _q.setFromAxisAngle(UP,rot);_m.compose(_p.set(x+.5,0,y+.5),_q,_s.set(s,s*sy,s));mesh.setMatrixAt(j,_m);mesh.setColorAt(j,_c.setRGB(Math.min(1,tint+red),tint,tint));j++}
    mesh.count=j;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  dirty.clear();lightSrc.length=0;lightSrc.dirty=true;
  // contact shadows follow the objects
  let n=0;for(let i=0;i<Z.obj.length&&n<3190;i++){const o=Z.obj[i];if(!o)continue;const d=OBJ[o.k];if(!d||!d.solid)continue;const x=i%W,y=(i-x)/W,s=d.solid===1?(d.low?1.5:1.75):(d.r||.3)*3.2+.45;_m.makeScale(s,1,s);_m.setPosition(x+.5,.008,y+.5);aoMesh.setMatrixAt(n++,_m)}
  aoMesh.count=quality==='low'?0:n;aoMesh.instanceMatrix.needsUpdate=true;
}
function collectLights(){
  lightSrc.length=0;lightSrc.dirty=false;const W=Z.w;
  for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(!o)continue;const d=OBJ[o.k];if(!d.light)continue;if(d.power&&!Z.power)continue;lightSrc.push({x:i%W+.5,y:Math.floor(i/W)+.5,r:d.light,lamp:!!d.power,smoke:!d.power&&d.light<=7})}
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
  else if(t==='veh'){if(Z.home)parkVehicle()}
}
const PAL={wood:['#8a5a2b','#b07a40','#6a4420'],stone:['#8d8f93','#a8aaae','#6a6c70'],spark:['#ffe080','#fff0c0','#ffb040'],leaf:['#5c8a3a','#7da04a','#4a6a2a'],dust:['#b8a888','#d0c0a0','#988868'],
  explode:['#ff8020','#ffd040','#3a3028','#ff5010','#fff0a0'],toxburst:['#8ad040','#5a9a30','#c0e070'],fire:['#ff8020','#ffc040','#ff5010'],tox:['#8ad040','#c0e070'],heal:['#70e090','#b0ffc0'],die:['#5a1a1a','#8a2a2a','#3a1010'],level:['#ffd870','#fff0b0','#ffb040'],slam:['#b8a888','#8a7a60','#d0c0a0'],
  ember:['#ffb040','#ff7020','#ffd070']};
function burst(x,y,z,n,cols,spd,up,life,size,grav=9,spread=1){
  for(let i=0;i<n&&parts.length<880;i++){const a=Math.random()*6.283,r=Math.random()*spd*spread;_c.set(cols[(Math.random()*cols.length)|0]);
    parts.push({x,y,z,vx:Math.cos(a)*r,vy:up*(.5+Math.random()*.8),vz:Math.sin(a)*r,life:life*(.6+Math.random()*.6),max:life,size:size*(.6+Math.random()*.8),r:_c.r,g:_c.g,b:_c.b,grav})}
}
function decal(x,y,r,col,grow=0){_c.set(col);const d={x:x+(Math.random()-.5)*.2,y:y+(Math.random()-.5)*.2,r,rot:Math.random()*6.28,sx:.8+Math.random()*.5,cr:_c.r,cg:_c.g,cb:_c.b,t:grow?0:1};if(decals.length<138)decals.push(d);else{decals[decalN%138]=d;decalN++}decalDirty=true}
function star(x,h,y,size){if(stars.length<24)stars.push({x:x+(Math.random()-.5)*.15,h,y,size,t:.14,rot:Math.random()*1.5})}
function glow(x,h,y,size,col,t){if(glows.length<24)glows.push({x,h,y,size,col,t,T:t})}
function spawnFx(name,x,y,a){
  if(name==='blood'){star(x,.85,y,.75);burst(x,.7,y,6,[a||'#8a2a2a',shade(a||'#8a2a2a',.6)],2.2,2.5,.5,.09);if(Math.random()<.4)decal(x,y,.1+Math.random()*.14,'#4a1210')}
  else if(name==='muzzle'){for(let i=0;i<4;i++){_c.set(PAL.spark[i%3]);const s=6+Math.random()*6,an=a+(Math.random()-.5)*.5;parts.push({x,y:.85,z:y,vx:Math.cos(an)*s,vy:Math.random(),vz:Math.sin(an)*s,life:.09,max:.09,size:.11,r:_c.r,g:_c.g,b:_c.b,grav:0})}fxLight.position.set(x,1.2,y);fxLight.color.set('#ffd080');flashT=.06;fxLight.userData.i=40;glow(x,.9,y,1.6,'#ffd080',.07)}
  else if(name==='explode'){burst(x,.5,y,26,PAL.explode,5*(a||2.5)/2.5,5,.8,.22,7);burst(x,.3,y,10,PAL.dust,3,1.5,1.2,.3,1);for(let i=0;i<8;i++)parts.push({x:x+(Math.random()-.5),y:.6,z:y+(Math.random()-.5),vx:(Math.random()-.5),vy:1.4+Math.random(),vz:(Math.random()-.5),life:2.2,max:2.2,size:.3,grow:1.5,r:.2,g:.19,b:.18,grav:-.2});
    fxLight.position.set(x,1.6,y);fxLight.color.set('#ff9040');flashT=.22;fxLight.userData.i=220;glow(x,1,y,(a||2.5)*3,'#ffa040',.3);decal(x,y,(a||2.5)*.55,'#1c1814')}
  else if(name==='toxburst'){burst(x,.5,y,22,PAL.toxburst,4,3,1,.2,3);decal(x,y,1.1,'#3a5a1c')}
  else if(name==='slam'){for(let i=0;i<22;i++){const an=i/22*6.283,r=a||3;_c.set(PAL.slam[i%3]);parts.push({x:x+Math.cos(an)*r*.3,y:.15,z:y+Math.sin(an)*r*.3,vx:Math.cos(an)*r*1.8,vy:1.5,vz:Math.sin(an)*r*1.8,life:.5,max:.5,size:.24,r:_c.r,g:_c.g,b:_c.b,grav:4})}decal(x,y,(a||3)*.4,'#2a2622')}
  else if(name==='ring'){for(let i=0;i<18;i++){const an=i/18*6.283,r=a||3;parts.push({x,y:.2,z:y,vx:Math.cos(an)*r*1.6,vy:0,vz:Math.sin(an)*r*1.6,life:.6,max:.6,size:.12,r:1,g:.85,b:.4,grav:0})}}
  else if(name==='arc'){const dx=a.x-x,dy=a.y-y,n=Math.max(4,Math.ceil(Math.hypot(dx,dy)*3));for(let i=0;i<=n;i++){const f=i/n;parts.push({x:x+dx*f+(Math.random()-.5)*.25,y:1+(Math.random()-.5)*.3,z:y+dy*f+(Math.random()-.5)*.25,vx:0,vy:0,vz:0,life:.14,max:.14,size:.1,r:.6,g:.85,b:1,grav:0})}glow(a.x,1,a.y,1.8,'#80c0ff',.12)}
  else if(name==='fire')burst(x,.4,y,2,PAL.fire,.6,2.2,.5,.14,-2);
  else if(name==='heal'||name==='level'){burst(x,.3,y,name==='level'?26:8,PAL[name],1,3,1,.1,-1.5);if(name==='level')glow(x,1,y,4,'#ffd870',.6)}
  else if(name==='die'){star(x,.7,y,1.3);burst(x,.5,y,9,PAL.die,2,2.5,.7,.12);decal(x,y,.42+Math.random()*.2,'#3e0e0c',1)}
  else if(PAL[name])burst(x,name==='dust'?.2:.7,y,name==='dust'?8:5,PAL[name],name==='spark'?3.5:2,name==='dust'?1.2:2.6,name==='dust'?.8:.5,name==='dust'?.2:.09,name==='dust'?1:9);
}

// ---------------------------------------------------------------- per-frame sync
function swingArc(a,w){
  const m=arcPool.find(m=>m.userData.t<=0)||arcPool[0];m.visible=true;m.userData.t=.17;m.position.set(a.x,.75,a.y);m.rotation.y=Math.PI/2-a.a;const r=(w.rng||1.1)+.25;m.scale.set(r,1,r);m.material.color.set(w.fx&&w.fx.shock?'#a0d8ff':'#fff6dc');
}
function syncActors(dt){
  const S=G.S;frame++;let bars=0;const camQ=cam.quaternion;
  for(const a of Z.actors){
    let r=rigs.get(a.id);
    if(!r){r=a.pl?playerRig(S.p.eq):rigFor(a.def,a.sv||a.id);r.wkey=null;r.root.rotation.y=Math.PI/2-a.a;rigs.set(a.id,r);scene.add(r.root)}
    r.seen=frame;r.root.position.set(a.x,0,a.y);
    let ty=Math.PI/2-a.a,dy=ty-r.root.rotation.y;dy=((dy+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;r.root.rotation.y+=dy*Math.min(1,dt*16);
    if(a.mv>3.2&&!a.dead&&dt>0){r.dustT=(r.dustT||0)-dt;if(r.dustT<=0){r.dustT=.2;burst(a.x,.06,a.y,1,PAL.dust,.5,.6,.45,.1,1)}}
    if(a.pl){
      const w=weaponDef(S),wk=a.act&&a.act.mdl!==undefined?(a.act.mdl||null):(w.mdl||null);if(r.wkey!==wk){setWeapon(r,wk);r.wkey=wk}
      if(a.atk&&!a.atk.shown){a.atk.shown=1;swingArc(a,a.atk.w)}
      const gun=w.t==='gun'&&(G.inp.attack||a.cd>-.6)?(['rifle','shotgun','carbine','sniper','minigun','flamer','launcher','lance','smg','crossbow','bow'].includes(w.mdl)?2:1):0;
      pose(r,{dt,t:time,mv:a.mv,atk:a.atk?a.atk.t/a.atk.dur:-1,act:a.act&&a.act.type==='gather'?a.act.t/a.act.dur*.5:0,gun,recoil:a.recoil,throwing:a.atkT>0?a.atkT:0,sneak:a.sneak,roll:a.roll?1-a.roll.t/.3:0,dead:a.dead,deadT:0,flash:a.hurtT>.22?1:0,vis:1});
    }else{
      const d=a.def,w=['wind','windS','cast','cwind','fuse'].includes(a.st)?clamp(a.t/(d.wind||.5),0.01,1):0;
      pose(r,{dt,t:time,mv:a.mv,atk:-1,wind:w,gun:d.proj&&a.alert&&r.type==='human'?1:0,recoil:d.proj&&a.atkT>0?1:0,strike:!d.proj&&a.atkT>0,charge:a.st==='charge',stun:a.stunT>0,dead:a.dead,deadT:a.deadT,flash:a.flash,vis:a.vis});
      if(!a.dead&&bars<95&&(a.hp<a.mhp||a.boss||d.boss)&&a.vis>.5){const w0=d.boss?1.6:.7,f=clamp(a.hp/a.mhp,0,1),hy=r.h+.35;
        _m.compose(_p.set(a.x,hy,a.y),camQ,_s.set(w0+.06,.13,1));barBg.setMatrixAt(bars,_m);
        _p.set(-(w0*(1-f))/2,0,0).applyQuaternion(camQ);_p.x+=a.x;_p.y+=hy;_p.z+=a.y;_m.compose(_p,camQ,_s.set(Math.max(.001,w0*f),.085,1));barFg.setMatrixAt(bars,_m);
        barFg.setColorAt(bars,a.team===0?_c.set('#60c0ff'):d.boss?_c.set('#ff9030'):_c.set('#e04030'));bars++}
    }
  }
  for(const[id,r]of rigs)if(r.seen!==frame){scene.remove(r.root);disposeRig(r);rigs.delete(id)}
  let ao=0;for(const a of Z.actors){if(ao>=108||(a.def&&a.def.rooted))continue;const s=(a.r||.3)*(a.dead?4.2:3.1)+.2;_m.makeScale(s,1,s);_m.setPosition(a.x,.01,a.y);aoActors.setMatrixAt(ao++,_m)}aoActors.count=ao;aoActors.instanceMatrix.needsUpdate=true;
  barBg.count=barFg.count=bars;barBg.instanceMatrix.needsUpdate=barFg.instanceMatrix.needsUpdate=true;if(barFg.instanceColor)barFg.instanceColor.needsUpdate=true;
  for(const m of arcPool)if(m.userData.t>0){m.userData.t-=dt||.016;m.material.opacity=Math.max(0,m.userData.t/.17)*.5;if(m.userData.t<=0)m.visible=false}
}
const PROJ={bullet:[.05,.05,.55,'#ffe9a0'],arrow:[.035,.035,.6,'#c8a070'],spit:[.16,.16,.16,'#9ad040'],flame:[.22,.22,.22,'#ff9030'],nade:[.16,.16,.16,'#3a4030'],shard:[.09,.09,.4,'#a0e8ff'],beam:[.09,.09,1.6,'#80ffe8'],bottle:[.12,.12,.2,'#c08040'],grenade:[.15,.15,.15,'#3a4030'],arc:[.1,.1,.1,'#a0d0ff']};
function syncProjs(dt){
  let n=0;
  for(const p of Z.projs){if(n>=255)break;const d=PROJ[p.kind]||PROJ.bullet;let sc=1;if(p.kind==='flame'){sc=.6+Math.random()*.9;if(Math.random()<.3&&parts.length<800)burst(p.x,.8,p.y,1,PAL.fire,.5,1.2,.3,.12,-2)}
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
  for(const[i,m]of dyn){const o=Z.obj[i];if(o&&o.a!==undefined){let ty=Math.PI/2-o.a,dy=ty-m.rotation.y;dy=((dy+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;m.rotation.y+=dy*Math.min(1,dt*10)}}
  for(let w=wobble.length-1;w>=0;w--){wobble[w].t-=dt;if(wobble[w].t<=0){const key=shown[wobble[w].i];if(key)dirty.add(key);wobble.splice(w,1)}}
  // stains on the ground
  let growing=false;for(const d of decals)if(d.t<1){d.t=Math.min(1,d.t+dt*1.2);growing=true}
  if(decalDirty||growing){decalDirty=false;let j=0;for(const d of decals){const r=d.r*(.35+.65*d.t);_q.setFromAxisAngle(UP,d.rot);_m.compose(_p.set(d.x,.012+j*.0002,d.y),_q,_s.set(r*d.sx,1,r));decalMesh.setMatrixAt(j,_m);decalMesh.setColorAt(j,_c.setRGB(d.cr,d.cg,d.cb));j++}decalMesh.count=j;decalMesh.instanceMatrix.needsUpdate=true;if(decalMesh.instanceColor)decalMesh.instanceColor.needsUpdate=true}
}
function stepParts(dt){
  let n=0;
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];p.life-=dt;if(p.life<=0){parts[i]=parts[parts.length-1];parts.pop();continue}
    p.vy-=p.grav*dt;if(p.w){p.vx+=Math.sin(time*2.3+p.w*40)*p.w*dt;p.vz+=Math.cos(time*1.9+p.w*70)*p.w*dt}p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.y<.03&&p.grav>0){p.y=.03;p.vy*=-.3;p.vx*=.6;p.vz*=.6}}
  for(const p of parts){const f=p.life/p.max,s=p.size*Math.min(1,f*2.5)*(p.grow?1+p.grow*(1-f):1)*(p.pulse?.6+.4*Math.sin(time*6+p.w*90):1);_m.compose(_p.set(p.x,p.y,p.z),cam.quaternion,_s.set(s*2.6,s*2.6,1));partMesh.setMatrixAt(n,_m);partMesh.setColorAt(n,_c.setRGB(p.r,p.g,p.b));n++}
  partMesh.count=n;partMesh.instanceMatrix.needsUpdate=true;if(partMesh.instanceColor)partMesh.instanceColor.needsUpdate=true;
  n=0;for(let i=stars.length-1;i>=0;i--){const q=stars[i];q.t-=dt||.016;if(q.t<=0){stars.splice(i,1);continue}const f=q.t/.14,sz=q.size*(1.25-f*.7);_e.set(0,0,q.rot+(1-f)*.6);_q.copy(cam.quaternion).multiply(_q2.setFromEuler(_e));_m.compose(_p.set(q.x,q.h,q.y),_q,_s.set(sz,sz,1));starMesh.setMatrixAt(n++,_m)}
  starMesh.count=n;starMesh.instanceMatrix.needsUpdate=true;
}
/** Smoke and embers from fires, and the drifting life of each biome: leaves, fireflies, dust, ash, spores. */
function stepAmbient(dt,dl){
  if(dt<=0||parts.length>700)return;const rnd=Math.random,cx=camT.x,cz=camT.z;
  for(const l of lightSrc){if(l.lamp||Math.abs(l.x-cx)>17||Math.abs(l.y-cz)>15)continue;
    if(rnd()<dt*7){_c.set(PAL.ember[(rnd()*3)|0]);parts.push({x:l.x+(rnd()-.5)*.25,y:.35,z:l.y+(rnd()-.5)*.25,vx:(rnd()-.5)*.5,vy:1+rnd()*1.4,vz:(rnd()-.5)*.5,life:.7+rnd()*.6,max:1.1,size:.05,r:_c.r,g:_c.g,b:_c.b,grav:-.6,w:.5+rnd()})}
    if(l.smoke&&rnd()<dt*2.4){const v=(.16+rnd()*.1)*(.22+.78*dl);parts.push({x:l.x+(rnd()-.5)*.15,y:.8,z:l.y+(rnd()-.5)*.15,vx:.25+(rnd()-.5)*.2,vy:.7+rnd()*.3,vz:(rnd()-.5)*.2,life:2.4,max:2.4,size:.09,grow:1.5,r:v,g:v,b:v*1.02,grav:-.05})}}
  ambT+=dt;const rate=Z.dark?0:quality==='low'?2:5;
  while(ambT>1/Math.max(.01,rate)&&rate>0){ambT-=1/rate;const x=cx+(rnd()-.5)*30,z=cz+(rnd()-.5)*24-2,b=Z.biome,w=.4+rnd();
    if(b==='forest'){if(dl<.25){parts.push({x,y:.3+rnd()*1.3,z,vx:0,vy:0,vz:0,life:3+rnd()*2,max:4,size:.065,r:.85,g:1,b:.35,grav:0,w:w*1.6,pulse:1})}
      else{_c.set(['#b0742a','#c49a3a','#7a8a3a','#8a5a22'][(rnd()*4)|0]);parts.push({x,y:3+rnd()*2.5,z,vx:.5+rnd()*.5,vy:-.7-rnd()*.4,vz:(rnd()-.5)*.4,life:5,max:5,size:.07,r:_c.r,g:_c.g,b:_c.b,grav:.15,w})}}
    else if(b==='dust'){parts.push({x,y:.15+rnd()*1.2,z,vx:1.6+rnd()*1.4,vy:.1,vz:(rnd()-.5)*.5,life:3,max:3,size:.045,r:.78,g:.68,b:.5,grav:0,w})}
    else if(b==='city'){const v=.35+rnd()*.3;parts.push({x,y:2+rnd()*3,z,vx:.3,vy:-.35,vz:(rnd()-.5)*.3,life:6,max:6,size:.045,r:v,g:v,b:v,grav:0,w})}
    else if(b==='frost'){parts.push({x,y:.2+rnd()*2,z,vx:1.2+rnd(),vy:-.1,vz:.3,life:3,max:3,size:.04,r:.95,g:.98,b:1,grav:0,w})}
    else if(b==='gray'){parts.push({x,y:.1+rnd(),z,vx:(rnd()-.5)*.3,vy:.3+rnd()*.3,vz:(rnd()-.5)*.3,life:5,max:5,size:.06,r:.72,g:.62,b:.95,grav:0,w,pulse:1})}}
}
function stepWeather(dt,W,dl=1){
  const kind=Z.dark?null:W.rain?'rain':W.snow?'snow':W.spores?'spores':null,want=kind==='rain'?(W.rain>1?420:260):kind?200:0;
  while(wx.length<want)wx.push({x:(Math.random()-.5)*34,y:Math.random()*8,z:(Math.random()-.5)*30,s:Math.random()});if(wx.length>want)wx.length=want;
  const fall=kind==='rain'?22:kind==='snow'?2.4:.5;let n=0;
  for(const d of wx){d.y-=fall*dt*(.8+d.s*.4);if(kind!=='rain'){d.x+=Math.sin(time+d.s*9)*dt*.8;d.z+=Math.cos(time*.7+d.s*5)*dt*.5}
    if(d.y<0){if(kind==='rain'&&parts.length<760&&d.s<.4)parts.push({x:camT.x+d.x,y:.04,z:camT.z+d.z,vx:(Math.random()-.5)*1.2,vy:1.1,vz:(Math.random()-.5)*1.2,life:.2,max:.2,size:.06,r:.72,g:.82,b:.92,grav:9});d.y=7+Math.random()*1.5;d.x=(Math.random()-.5)*34;d.z=(Math.random()-.5)*30}
    if(kind==='rain')_s.set(.014,.42,.014);else if(kind==='snow')_s.set(.07,.07,.07);else _s.set(.06,.06,.06);
    _m.makeScale(_s.x,_s.y,_s.z);_m.setPosition(camT.x+d.x,d.y,camT.z+d.z);wxMesh.setMatrixAt(n,_m);wxMesh.setColorAt(n,(kind==='rain'?_c.set('#b8d0e8'):kind==='snow'?_c.set('#ffffff'):_c.set('#b0a0e0')).multiplyScalar(.3+.7*dl));n++}
  wxMesh.count=n;if(n){wxMesh.instanceMatrix.needsUpdate=true;if(wxMesh.instanceColor)wxMesh.instanceColor.needsUpdate=true}
  // lightning in a storm
  if(W.rain>1&&!Z.dark&&dt>0){boltT-=dt;if(boltT<=0){boltT=5+Math.random()*10;boltF=.22;G.ev.push(['sfx','thunder'])}}
  if(boltF>0)boltF-=dt;
}
const NIGHT_FOG=new C('#101632'),NIGHT_SUN=new C('#8aa4ff'),WARM=new C('#ffa060'),SKY_D=new C('#d6e2ff'),SKY_N=new C('#5068c0'),GR_D=new C('#8f86b0'),GR_N=new C('#2a2c60');
function stepLight(dt,W,dl){
  const S=G.S,b=BIOMES[Z.biome]||BIOMES.forest,p=Z.pl,wl=W.light||1,ramp=Z.dark?0:1-Math.abs(dl*2-1),camQ=cam.quaternion;
  _c.set(b.sun).lerp(WARM,ramp*.6);sun.color.copy(NIGHT_SUN).lerp(_c,Math.min(1,dl*1.4));sun.intensity=(.45+1.1*dl)*(dl>.2?wl:1);
  const h=(S.t/60)%24,ang=dl>0?(h-12)/12*1.1:(h<12?h+12:h-12-12)/12*.8;sun.position.set(camT.x+Math.sin(ang)*20-6,24,camT.z+9+Math.cos(ang)*4);sun.target.position.copy(camT);
  const bolt=boltF>0?Math.max(0,boltF/.22)*(Math.random()<.5?3:1.4):0;
  hemi.color.copy(SKY_N).lerp(SKY_D,dl);hemi.groundColor.copy(GR_N).lerp(GR_D,dl);hemi.intensity=(.85+1.05*dl)*(.6+wl*.4)+bolt;
  _c.set(b.fog).multiplyScalar(.55+.45*wl);_c2.copy(NIGHT_FOG).lerp(_c,Math.pow(dl,.8));if(W.spores)_c2.lerp(_c.set('#5a4a80'),.4);
  scene.fog.color.lerp(_c2,Math.min(1,dt*2+(dt?0:1)));scene.background.copy(scene.fog.color);
  const fogK=(W.fog?.5:W.rain?.85:1)*(Z.dark?.75:1)*(.75+.25*dl),zf=camOff.length()*zoomEff()/16;scene.fog.near=20*fogK*zf;scene.fog.far=(50*fogK+4)*zf;
  // the player's own light and the nearest fires
  const dark=1-dl;plight.position.set(p.x,1.5,p.y);plight.intensity=dark*(G.ds&&G.ds.light?24:8);plight.distance=G.ds&&G.ds.light?15:9;
  if(lightSrc.dirty!==false)collectLights();
  const near=lightSrc.map(l=>({l,d:(l.x-p.x)**2+(l.y-p.y)**2})).sort((a,c)=>a.d-c.d);
  for(let i=0;i<lightPool.length;i++){const L=lightPool[i],s=near[i];if(s&&s.d<900){L.position.set(s.l.x,1.3,s.l.y);L.color.set(s.l.lamp?'#e8f0ff':'#ff9a40');L.distance=s.l.r*1.7;L.intensity=(.25+dark*.95)*s.l.r*(s.l.lamp?2.5:2.1)*(s.l.lamp?1:.88+Math.sin(time*11+i*2)*.07+Math.sin(time*23+i)*.05)}else L.intensity=0}
  if(flashT>0){flashT-=dt;fxLight.intensity=fxLight.userData.i*Math.max(0,flashT)*6}else fxLight.intensity=0;
  // glow billboards: fires, lamps, loose loot, flashes
  let n=0;const k=.28+dark*.72,put=(x,hh,z,size,col,a)=>{if(n>=89)return;_m.compose(_p.set(x,hh,z),camQ,_s.set(size,size,1));glowMesh.setMatrixAt(n,_m);glowMesh.setColorAt(n,_c.set(col).multiplyScalar(a));n++};
  for(const s of near){if(s.d>700)break;const l=s.l,fl=l.lamp?1:.85+Math.sin(time*9+l.x*3)*.1+Math.sin(time*17+l.y)*.06;put(l.x,l.lamp?1.5:.5,l.y,l.r*(l.lamp?.5:.42)*fl,l.lamp?'#cfe0ff':'#ff9030',k*(l.lamp?.5:.75))}
  for(const d of Z.drops)put(d.x,.2,d.y,.9+Math.sin(time*3+d.id)*.12,'#ffe9a0',.22+dark*.25);
  for(let i=glows.length-1;i>=0;i--){const g=glows[i];g.t-=dt||.016;if(g.t<=0){glows.splice(i,1);continue}put(g.x,g.h,g.y,g.size*(.6+.4*g.t/g.T),g.col,g.t/g.T)}
  if(G.ds&&G.ds.light&&dark>.3)put(p.x,1,p.y,1.6,'#ffd090',dark*.35);
  glowMesh.count=n;glowMesh.instanceMatrix.needsUpdate=true;if(glowMesh.instanceColor)glowMesh.instanceColor.needsUpdate=true;
  // cloud shadows sliding over the ground
  const cv=!Z.dark&&quality!=='low'&&dl>.08;clouds.visible=cv;if(cv){clouds.position.set(camT.x,.06,camT.z);clouds.material.opacity=.13*dl*(wl<1?.45:1);texCloud.offset.set(camT.x/150*2.4+time*.006,-camT.z/150*2.4+time*.0035)}
  if(water)matWater.bumpMap.offset.set(time*.02,time*.013);
}
const zoomEff=()=>zoom*(cam.aspect<1?1.12:1);
function draw(dt){
  if(!Z||!R)return;time+=dt;const p=Z.pl,W=WEATHER[G.S.weather.id]||WEATHER.clear,dl=Z.dark?.1:daylight(G.S.t);
  setWind(time,W.rain>1?2.6:W.rain||W.snow?1.6:1);
  const lead=G.inp.aim&&!G.build?.12:0,tx=p.x+(lead?(G.inp.aim.x-p.x)*lead:0),tz=p.y+(lead?(G.inp.aim.y-p.y)*lead:0);
  camT.x+=(tx-camT.x)*Math.min(1,dt*7);camT.z+=(tz-camT.z)*Math.min(1,dt*7);
  const ze=zoomEff();cam.position.set(camT.x,camOff.y*ze,camT.z+camOff.z*ze);
  if(shakeAmt>0){cam.position.x+=(Math.random()-.5)*shakeAmt;cam.position.y+=(Math.random()-.5)*shakeAmt;shakeAmt=Math.max(0,shakeAmt-dt*1.6)}
  cam.lookAt(camT.x,.6,camT.z);cam.updateMatrixWorld();
  syncActors(dt);syncProjs(dt);flush();stepAmbient(dt,dl);stepParts(dt);stepWeather(dt,W,dl);stepLight(dt,W,dl);
  const h=Z.hint;if(h&&!G.build&&!p.dead){hintRing.visible=true;hintRing.position.set(h.x,.05,h.y);hintRing.scale.setScalar(1+Math.sin(time*5)*.06)}else hintRing.visible=false;
  playerRing.visible=!p.dead;playerRing.position.set(p.x,.04,p.y);
  post.render(scene,cam,[scene.fog.near*.9,scene.fog.far*.8]);
  const now=performance.now();fpsN++;if(!fpsAcc)fpsAcc=now;if(now-fpsAcc>=1000){fps=Math.round(fpsN*1000/(now-fpsAcc));fpsAcc=now;fpsN=0;if(G.S.set.quality==='auto'&&!location.search.includes('shots')&&!document.hidden){if(fps<26)lowT++;else lowT=0;if(lowT>=3){lowT=0;if(quality==='high')setQuality('med');else if(quality==='med')setQuality('low')}}}
}
/** Screen point → sim ground coordinates. */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new V3(0,1,0),0),hitP=new V3();
function pick(cx,cy){const r=canvas.getBoundingClientRect();ndc.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height*2-1));ray.setFromCamera(ndc,cam);return ray.ray.intersectPlane(plane,hitP)?{x:hitP.x,y:hitP.z}:null}
/** Sim point (+height) → screen pixels relative to the canvas. */
function project(x,y,h=0){_p.set(x,h,y).project(cam);const r=canvas.getBoundingClientRect();return{x:(_p.x*.5+.5)*r.width,y:(-_p.y*.5+.5)*r.height,vis:_p.z<1}}
/** Placement preview in build mode. kind=null hides it. */
let ghostArrow=null;
const ghostMat=new THREE.MeshBasicMaterial(Object.assign({color:'#7cff7c',transparent:true,opacity:.5,depthWrite:false,toneMapped:false},inkBlend()));
function setGhost(kind,tx,ty,ok,rot=0){
  if(!ghostArrow){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,0,.72,.17,0,.47,-.17,0,.47],3));ghostArrow=new THREE.Mesh(g,new THREE.MeshBasicMaterial(Object.assign({color:'#ffffff',transparent:true,opacity:.95,depthTest:false,side:THREE.DoubleSide,toneMapped:false},inkBlend())));ghostArrow.renderOrder=9;ghostArrow.visible=false;scene.add(ghostArrow)}
  if(!kind||tx==null){if(ghost)ghost.visible=false;ghostTile.visible=false;ghostArrow.visible=false;return}
  ghostTile.visible=true;ghostTile.position.set(tx+.5,.06,ty+.5);ghostTile.material.color.set(ok?'#7cff7c':'#ff5a4a');
  // a white arrow shows which way the piece will face
  ghostArrow.visible=kind!=='*';ghostArrow.position.set(tx+.5,.09,ty+.5);ghostArrow.rotation.y=rot*Math.PI/2;
  if(kind==='*'){if(ghost)ghost.visible=false;return}
  const key=OBJ[kind].m+'|0';if(!ghost){ghost=new THREE.Mesh(modelGeo(key),ghostMat);scene.add(ghost)}if(ghost.userData.key!==key){ghost.geometry=modelGeo(key);ghost.userData.key=key}
  ghost.visible=true;ghost.position.set(tx+.5,.02,ty+.5);ghost.rotation.y=rot*Math.PI/2;ghostMat.color.set(ok?'#7cff7c':'#ff5a4a');
}

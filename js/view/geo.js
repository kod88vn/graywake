// Geometry builder. A model is drawn by pushing coloured primitives into a Geo, which bakes them into one
// BufferGeometry with vertex colours. Round primitives keep smooth normals, boxes keep hard edges.
// Conventions: Y is up, the model stands on y=0, a tile is 1×1 centred on the origin, "front" faces +Z.
import * as THREE from '../../vendor/three.module.min.js';

const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_c=new THREE.Color(),_v=new THREE.Vector3(),_a=new THREE.Vector3(),_b=new THREE.Vector3();
const cache=new Map();
const prim=(key,make)=>{let g=cache.get(key);if(!g){g=make();if(g.index)g=g.toNonIndexed();cache.set(key,g)}return g};
/** Give a lump the normals of a sphere, so low-poly blobs shade as soft rounded forms. */
const rounded=g=>{if(g.index)g=g.toNonIndexed();const p=g.attributes.position,n=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){_v.fromBufferAttribute(p,i).normalize();n[i*3]=_v.x;n[i*3+1]=_v.y;n[i*3+2]=_v.z}g.setAttribute('normal',new THREE.BufferAttribute(n,3));return g};

/** Multiply a colour's brightness. shade('#808080',1.2) is lighter, .8 darker. */
export function shade(col,f){_c.set(col);return '#'+_c.clone().multiplyScalar(f).getHexString()}
/** Blend two colours. */
export function mix(a,b,t){return '#'+new THREE.Color(a).lerp(new THREE.Color(b),t).getHexString()}

export class Geo{
  constructor(){this.pos=[];this.col=[];this.nor=[];this.jit=.05;this._seed=7}
  _rnd(){this._seed=(this._seed*16807)%2147483647;return this._seed/2147483647}
  /** Append any BufferGeometry with a colour and a transform (position, euler rotation, scale). */
  add(geom,color,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){
    _e.set(rx,ry,rz);_q.setFromEuler(_e);_m.compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz));
    _c.set(color);const j=1+(this._rnd()-.5)*2*this.jit;const r=_c.r*j,g=_c.g*j,b=_c.b*j;
    const a=geom.attributes.position,n=geom.attributes.normal,i0=this.pos.length;
    for(let i=0;i<a.count;i++){_v.fromBufferAttribute(a,i).applyMatrix4(_m);this.pos.push(_v.x,_v.y,_v.z);this.col.push(r,g,b);
      if(n){_v.set(n.getX(i)/(sx||1),n.getY(i)/(sy||1),n.getZ(i)/(sz||1)).applyQuaternion(_q).normalize();this.nor.push(_v.x,_v.y,_v.z)}}
    if(!n)for(let i=i0;i<this.pos.length;i+=9){const p=this.pos;_a.set(p[i+3]-p[i],p[i+4]-p[i+1],p[i+5]-p[i+2]);_b.set(p[i+6]-p[i],p[i+7]-p[i+1],p[i+8]-p[i+2]);_a.cross(_b).normalize();for(let k=0;k<3;k++)this.nor.push(_a.x,_a.y,_a.z)}
    return this;
  }
  /** Box centred on (x,y,z). */
  box(w,h,d,color,x=0,y=0,z=0,rx=0,ry=0,rz=0){return this.add(prim('b',()=>new THREE.BoxGeometry(1,1,1)),color,x,y,z,rx,ry,rz,w,h,d)}
  /** Cylinder / frustum centred on (x,y,z): top radius, bottom radius, height. */
  cyl(rt,rb,h,color,x=0,y=0,z=0,seg=8,rx=0,ry=0,rz=0){return this.add(prim('c'+seg+'_'+(rt/rb).toFixed(3),()=>new THREE.CylinderGeometry(rt/rb,1,1,seg)),color,x,y,z,rx,ry,rz,rb,h,rb)}
  /** Cone centred on (x,y,z). */
  cone(r,h,color,x=0,y=0,z=0,seg=6,rx=0,ry=0,rz=0){return this.add(prim('k'+seg,()=>new THREE.ConeGeometry(1,1,seg)),color,x,y,z,rx,ry,rz,r,h,r)}
  /** Sphere, optionally squashed. */
  sph(r,color,x=0,y=0,z=0,sx=1,sy=1,sz=1,ws=7,hs=5){return this.add(prim('s'+ws+'_'+hs,()=>new THREE.SphereGeometry(1,ws,hs)),color,x,y,z,0,0,0,r*sx,r*sy,r*sz)}
  /** Rounded lump (icosahedron/dodecahedron with soft normals): rocks, foliage, sacks. */
  ico(r,color,x=0,y=0,z=0,sx=1,sy=1,sz=1,ry=0,detail=Geo.DETAIL){return this.add(prim('i'+detail,()=>rounded(new THREE.IcosahedronGeometry(1,detail))),color,x,y,z,0,ry,0,r*sx,r*sy,r*sz)}
  dod(r,color,x=0,y=0,z=0,sx=1,sy=1,sz=1,ry=0){return this.add(prim('d',()=>rounded(new THREE.DodecahedronGeometry(1,0))),color,x,y,z,0,ry,0,r*sx,r*sy,r*sz)}
  /** Flat quad lying on the ground (decals, rugs, puddles). */
  quad(w,d,color,x=0,y=.01,z=0,ry=0){return this.add(prim('q',()=>new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2)),color,x,y,z,0,ry,0,w,1,d)}
  /** Torus (tyres, rings, coils). Lies flat by default (axis = Y). */
  torus(r,tube,color,x=0,y=0,z=0,rx=0,ry=0,rz=0,seg=10){return this.add(prim('t'+seg+'_'+(tube/r).toFixed(2),()=>new THREE.TorusGeometry(1,tube/r,5,seg).rotateX(Math.PI/2)),color,x,y,z,rx,ry,rz,r,r,r)}
  /** A rounded limb hanging from (x,y,z) down its own −Y axis: radius r0 at the joint, r1 at the far end, length len. Rotations turn it about the joint. */
  limb(r0,r1,len,color,x=0,y=0,z=0,rx=0,ry=0,rz=0,seg=8){
    _e.set(rx,ry,rz);_q.setFromEuler(_e);const mid=_b.set(0,-len/2,0).applyQuaternion(_q),mx=mid.x,my=mid.y,mz=mid.z,end=_b.set(0,-len,0).applyQuaternion(_q),ex=end.x,ey=end.y,ez=end.z;
    this.cyl(r0,r1,len,color,x+mx,y+my,z+mz,seg,rx,ry,rz);this.sph(r0,color,x,y,z,1,1,1,seg,5);return this.sph(r1,color,x+ex,y+ey,z+ez,1,1,1,seg,5);
  }
  /** Bake into a BufferGeometry (position, normal, color). */
  build(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.col,3));
    if(this.nor.length===this.pos.length)g.setAttribute('normal',new THREE.Float32BufferAttribute(this.nor,3));else g.computeVertexNormals();
    g.computeBoundingSphere();g.computeBoundingBox();
    return g;
  }
}

/** Subdivision used for rounded lumps: 1 near the player, 0 for the distant tree line. */
Geo.DETAIL=1;

// ---------------------------------------------------------------- surface grain
let _detail;
/** A tiling grey noise texture: several octaves of value noise plus fine speckle. */
function detailTex(){
  if(_detail)return _detail;const S=256,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),im=x.createImageData(S,S);
  const h=(a,b,p)=>{a=((a%p)+p)%p;b=((b%p)+p)%p;let n=(a*374761393+b*668265263+p*1442695041)>>>0;n=Math.imul(n^(n>>>13),1274126177)>>>0;return((n^(n>>>16))>>>0)/4294967295};
  const vn=(u,v,p)=>{const xi=Math.floor(u),yi=Math.floor(v),xf=u-xi,yf=v-yi,a=xf*xf*(3-2*xf),b=yf*yf*(3-2*yf);return(h(xi,yi,p)*(1-a)+h(xi+1,yi,p)*a)*(1-b)+(h(xi,yi+1,p)*(1-a)+h(xi+1,yi+1,p)*a)*b};
  for(let y=0;y<S;y++)for(let X=0;X<S;X++){let v=0,amp=.5,p=4;for(let o=0;o<5;o++){v+=vn(X/S*p,y/S*p,p)*amp;amp*=.5;p*=2}v=v*.8+h(X,y,S)*.2;const g=Math.max(0,Math.min(255,Math.round(v*255*1.04)));const i=(y*S+X)*4;im.data[i]=im.data[i+1]=im.data[i+2]=g;im.data[i+3]=255}
  x.putImageData(im,0,0);_detail=new THREE.CanvasTexture(c);_detail.wrapS=_detail.wrapT=THREE.RepeatWrapping;_detail.colorSpace=THREE.NoColorSpace;_detail.anisotropy=4;return _detail;
}
/** Patch a vertex-colour material so every surface carries fine grain and broad mottling instead of flat paint.
 *  local:true keeps the pattern fixed to the mesh (characters); otherwise it is fixed to the world (props, walls). */
export function addDetail(m,{local=false,amp=.42,scale=.55}={}){
  const prev=m.onBeforeCompile,prevKey=m.customProgramCacheKey?m.customProgramCacheKey():'';
  m.onBeforeCompile=(sh,r)=>{if(prev)prev(sh,r);sh.uniforms.uDetail={value:detailTex()};
    sh.vertexShader='varying vec3 vDP;varying vec3 vDN;\n'+sh.vertexShader.replace('#include <project_vertex>',(local?'vDP=transformed;vDN=normalize(objectNormal);':`vec4 dwp=vec4(transformed,1.0);vec3 dwn=objectNormal;
#ifdef USE_INSTANCING
  dwp=instanceMatrix*dwp;dwn=mat3(instanceMatrix)*dwn;
#endif
  vDP=(modelMatrix*dwp).xyz;vDN=normalize(mat3(modelMatrix)*dwn);`)+'\n#include <project_vertex>');
    sh.fragmentShader='uniform sampler2D uDetail;varying vec3 vDP;varying vec3 vDN;\n'+sh.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
  vec3 dbw=abs(vDN);dbw/=(dbw.x+dbw.y+dbw.z+1e-4);vec3 dp=vDP*${scale.toFixed(3)};
  float dd=texture2D(uDetail,dp.zy).r*dbw.x+texture2D(uDetail,dp.xz).r*dbw.y+texture2D(uDetail,dp.xy).r*dbw.z;
  float dm=texture2D(uDetail,vDP.xz*${(scale*.11).toFixed(4)}+.37).r;
  diffuseColor.rgb*=(${(1-amp*.5).toFixed(3)}+dd*${amp.toFixed(3)})*(.88+dm*.24);`)};
  m.customProgramCacheKey=()=>'det'+(local?1:0)+amp+'_'+scale+prevKey;return m;
}
/** The shared material for world objects. */
let _mat;export function material(){return _mat||(_mat=addDetail(new THREE.MeshLambertMaterial({vertexColors:true})))}
export {THREE};

// Low-poly geometry builder. A model is drawn by pushing coloured primitives into a Geo, which bakes them into one
// non-indexed BufferGeometry with flat normals and vertex colours. Every model in the game shares one material.
// Conventions: Y is up, the model stands on y=0, a tile is 1×1 centred on the origin, "front" faces +Z.
import * as THREE from '../../vendor/three.module.min.js';

const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_s=new THREE.Vector3(),_p=new THREE.Vector3(),_c=new THREE.Color(),_v=new THREE.Vector3();
const cache=new Map();
const prim=(key,make)=>{let g=cache.get(key);if(!g){g=make();if(g.index)g=g.toNonIndexed();cache.set(key,g)}return g};

/** Multiply a colour's brightness. shade('#808080',1.2) is lighter, .8 darker. */
export function shade(col,f){_c.set(col);return '#'+_c.clone().multiplyScalar(f).getHexString()}
/** Blend two colours. */
export function mix(a,b,t){return '#'+new THREE.Color(a).lerp(new THREE.Color(b),t).getHexString()}

export class Geo{
  constructor(){this.pos=[];this.col=[];this.jit=.05;this._seed=7}
  _rnd(){this._seed=(this._seed*16807)%2147483647;return this._seed/2147483647}
  /** Append any BufferGeometry with a colour and a transform (position, euler rotation, scale). */
  add(geom,color,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1){
    _e.set(rx,ry,rz);_q.setFromEuler(_e);_m.compose(_p.set(x,y,z),_q,_s.set(sx,sy,sz));
    _c.set(color);const j=1+(this._rnd()-.5)*2*this.jit;const r=_c.r*j,g=_c.g*j,b=_c.b*j;
    const a=geom.attributes.position;
    for(let i=0;i<a.count;i++){_v.fromBufferAttribute(a,i).applyMatrix4(_m);this.pos.push(_v.x,_v.y,_v.z);this.col.push(r,g,b)}
    return this;
  }
  /** Box centred on (x,y,z). */
  box(w,h,d,color,x=0,y=0,z=0,rx=0,ry=0,rz=0){return this.add(prim('b',()=>new THREE.BoxGeometry(1,1,1)),color,x,y,z,rx,ry,rz,w,h,d)}
  /** Cylinder / frustum centred on (x,y,z): top radius, bottom radius, height. */
  cyl(rt,rb,h,color,x=0,y=0,z=0,seg=8,rx=0,ry=0,rz=0){return this.add(prim('c'+seg+'_'+(rt/rb).toFixed(3),()=>new THREE.CylinderGeometry(rt/rb,1,1,seg)),color,x,y,z,rx,ry,rz,rb,h,rb)}
  /** Cone centred on (x,y,z). */
  cone(r,h,color,x=0,y=0,z=0,seg=6,rx=0,ry=0,rz=0){return this.add(prim('k'+seg,()=>new THREE.ConeGeometry(1,1,seg)),color,x,y,z,rx,ry,rz,r,h,r)}
  /** Low-poly sphere, optionally squashed. */
  sph(r,color,x=0,y=0,z=0,sx=1,sy=1,sz=1,ws=7,hs=5){return this.add(prim('s'+ws+'_'+hs,()=>new THREE.SphereGeometry(1,ws,hs)),color,x,y,z,0,0,0,r*sx,r*sy,r*sz)}
  /** Faceted lump (icosahedron/dodecahedron): rocks, foliage, sacks. */
  ico(r,color,x=0,y=0,z=0,sx=1,sy=1,sz=1,ry=0,detail=0){return this.add(prim('i'+detail,()=>new THREE.IcosahedronGeometry(1,detail)),color,x,y,z,0,ry,0,r*sx,r*sy,r*sz)}
  dod(r,color,x=0,y=0,z=0,sx=1,sy=1,sz=1,ry=0){return this.add(prim('d',()=>new THREE.DodecahedronGeometry(1,0)),color,x,y,z,0,ry,0,r*sx,r*sy,r*sz)}
  /** Flat quad lying on the ground (decals, rugs, puddles). */
  quad(w,d,color,x=0,y=.01,z=0,ry=0){return this.add(prim('q',()=>new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2)),color,x,y,z,0,ry,0,w,1,d)}
  /** Torus (tyres, rings, coils). Lies flat by default (axis = Y). */
  torus(r,tube,color,x=0,y=0,z=0,rx=0,ry=0,rz=0,seg=10){return this.add(prim('t'+seg+'_'+(tube/r).toFixed(2),()=>new THREE.TorusGeometry(1,tube/r,5,seg).rotateX(Math.PI/2)),color,x,y,z,rx,ry,rz,r,r,r)}
  /** Bake into a BufferGeometry (position, normal, color). */
  build(){
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.col,3));
    g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();
    return g;
  }
}
/** The one shared material. */
let _mat;export function material(){return _mat||(_mat=new THREE.MeshLambertMaterial({vertexColors:true}))}
export {THREE};

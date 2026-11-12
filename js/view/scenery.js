// Set dressing that is not gameplay: procedural textures (ground grain, cloud shadows, glow, water ripples),
// ground clutter models per biome, and the wind-sway materials. Everything here is generated in code.
import {THREE,Geo,shade} from './geo.js';

const lcg=seed=>{let s=seed>>>0||1;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296}};
function canvasTex(size,draw,repeat=true){
  const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;
  if(repeat)t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t;
}
/** Near-white grain multiplied over the ground's vertex colours: speckle, short blade strokes, soft blotches. */
export const groundTex=()=>canvasTex(512,(x,s)=>{
  const r=lcg(11);x.fillStyle='#e6e6e6';x.fillRect(0,0,s,s);
  for(let i=0;i<70;i++){const px=r()*s,py=r()*s,rad=30+r()*70,g=x.createRadialGradient(px,py,0,px,py,rad),d=r()<.5;g.addColorStop(0,d?'rgba(170,170,170,.35)':'rgba(255,255,255,.4)');g.addColorStop(1,'rgba(200,200,200,0)');x.fillStyle=g;for(const ox of[-s,0,s])for(const oy of[-s,0,s]){x.setTransform(1,0,0,1,ox,oy);x.fillRect(px-rad,py-rad,rad*2,rad*2)}}
  x.setTransform(1,0,0,1,0,0);
  for(let i=0;i<9000;i++){const v=150+Math.floor(r()*105);x.fillStyle=`rgba(${v},${v},${v},${.25+r()*.4})`;const w=1+r()*2.5;x.fillRect(r()*s,r()*s,w,w)}
  x.lineCap='round';for(let i=0;i<2600;i++){const px=r()*s,py=r()*s,a=-Math.PI/2+(r()-.5)*1.4,l=4+r()*9,v=r()<.6?120+Math.floor(r()*60):235;x.strokeStyle=`rgba(${v},${v},${v},${.3+r()*.3})`;x.lineWidth=1+r();x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke()}
});
/** Soft dark blobs with alpha: drifting cloud shadows. */
export const cloudTex=()=>canvasTex(256,(x,s)=>{
  const r=lcg(5);x.clearRect(0,0,s,s);
  for(let i=0;i<9;i++){const px=r()*s,py=r()*s,rad=34+r()*56;for(const ox of[-s,0,s])for(const oy of[-s,0,s]){const g=x.createRadialGradient(px+ox,py+oy,rad*.2,px+ox,py+oy,rad);g.addColorStop(0,'rgba(0,0,0,.9)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(px+ox-rad,py+oy-rad,rad*2,rad*2)}}
});
export const glowTex=()=>canvasTex(64,(x,s)=>{const g=x.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(.6,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,s,s)},false);
/** Grey ripples used as a bump map on water. */
export const rippleTex=()=>{const t=canvasTex(128,(x,s)=>{const r=lcg(9);x.fillStyle='#808080';x.fillRect(0,0,s,s);for(let i=0;i<120;i++){const px=r()*s,py=r()*s,w=8+r()*22,v=r()<.5?40:215;x.strokeStyle=`rgba(${v},${v},${v},.5)`;x.lineWidth=1.5+r()*2;for(const ox of[-s,0,s]){x.beginPath();x.ellipse(px+ox,py,w,w*.28,0,0,Math.PI);x.stroke()}}});t.colorSpace=THREE.NoColorSpace;return t};

// ---------------------------------------------------------------- clutter
const BLADE=new THREE.ConeGeometry(1,1,3,1,true).toNonIndexed();
const blades=(g,n,h,c,spread=.1,seed=1)=>{const r=lcg(seed);for(let i=0;i<n;i++){const a=r()*6.28,d=r()*spread,hh=h*(.6+r()*.6);g.add(BLADE,shade(c,.8+r()*.45),Math.cos(a)*d,hh/2,Math.sin(a)*d,(r()-.5)*.5,r()*6,(r()-.5)*.5,.022+r()*.012,hh,.022+r()*.012)}};
export const CLUTTER={
  tuft(g,v){blades(g,4+(v&1),.2+v*.04,v===2?'#6f9a44':'#5f8a3c',.11,3+v)},
  fern(g,v){const c=v?'#3f6a30':'#4a7636';for(let i=0;i<6;i++){const a=i/6*6.28+v,l=.16+((i*7+v*3)%5)*.02;g.box(.045,.01,l,shade(c,.85+i*.04),Math.cos(a)*l*.5,.05+l*.22,Math.sin(a)*l*.5,-.45,-a+Math.PI/2,0);g.box(.03,.01,l*.5,shade(c,1.05),Math.cos(a)*l*1.1,.05+l*.3,Math.sin(a)*l*1.1,-.1,-a+Math.PI/2,0)}},
  pebble(g,v){const c=v===1?'#8a857a':'#7c7c78';g.dod(.045,c,-.05,.025,.02,1,.6,1,v);g.dod(.032,shade(c,1.15),.06,.018,-.04,1,.6,1,1+v);if(v)g.dod(.025,shade(c,.8),.02,.014,.08,1,.6,1,2)},
  leaves(g,v){const cs=['#b0742a','#8a5a22','#c49a3a','#7a6a30'];for(let i=0;i<5;i++){const a=i*1.9+v;g.box(.07,.008,.045,cs[(i+v)%4],Math.cos(a)*.16,.012,Math.sin(a)*.14,0,a*2,0)}},
  twig(g,v){g.cyl(.012,.016,.34,'#6a4e30',0,.02,0,4,Math.PI/2,v*1.3,0);g.cyl(.008,.01,.14,'#5e4630',.06,.022,.05,4,Math.PI/2,v*1.3+.9,0)},
  drygrass(g,v){blades(g,4+v,.22,v?'#b89a58':'#a88c50',.09,7+v)},
  crack(g,v){const c='#3a3530';g.box(.34,.004,.02,c,0,.006,0,0,.4+v,0);g.box(.2,.004,.016,c,.14,.006,.1,0,-.5+v,0);g.box(.16,.004,.014,c,-.12,.006,-.08,0,1.2+v,0)},
  litter(g,v){const cs=['#c9c4b4','#a8a69c','#8a7a5a'];g.box(.11,.006,.15,cs[v],0,.008,0,0,v*1.1,0);g.box(.07,.006,.09,cs[(v+1)%3],.14,.008,.1,0,v*2.3+1,0);if(v===2)g.cyl(.03,.03,.09,'#9a4a3a',-.12,.03,.06,6,Math.PI/2,.7,0)},
  weed(g,v){blades(g,4,.16,'#5a7a40',.06,11+v);g.box(.06,.01,.06,'#6a8a48',.03,.03,.02,0,v,0)},
  snowlump(g,v){g.sph(.12+v*.02,'#eef3f6',0,.02,0,1.3,.45,1.1,6,4);if(v)g.sph(.07,'#e2eaef',.14,.015,.06,1.2,.45,1,6,4)},
  iceshard(g,v){g.cone(.035,.16+v*.04,'#bfe4f2',0,.07,0,4,.2,v,.15);g.cone(.025,.1,'#d8f0f8',.07,.05,.03,4,-.25,1+v,-.2)},
  sporepuff(g,v){const c=v?'#9a8fc0':'#8a7fb0';g.cyl(.008,.012,.16,'#5a5470',0,.08,0,4);g.sph(.04,c,0,.18,0,1,1,1,5,4);if(v===2){g.cyl(.008,.01,.1,'#5a5470',.07,.05,.04,4);g.sph(.03,shade(c,1.2),.07,.12,.04,1,1,1,5,4)}},
  fungus(g,v){const c=v?'#7a6f98':'#a898c8';g.cyl(.014,.018,.05,'#d8d0e0',0,.025,0,5);g.cone(.055,.035,c,0,.065,0,6);g.cyl(.01,.014,.035,'#d8d0e0',.07,.018,.03,5);g.cone(.035,.025,shade(c,.85),.07,.045,.03,6)},
  ember(g,v){g.box(.05,.01,.05,'#2a2622',0,.008,0,0,v,0);g.box(.04,.01,.03,'#3a3530',.08,.008,.05,0,v+1,0)},
};
// [model, instances per tile, sways in the wind, allowed on paving]
export const CLUTTER_BY_BIOME={
  forest:[['tuft',1.3,1],['fern',.1,1],['leaves',.2,0],['twig',.12,0],['pebble',.12,0]],
  dust:[['drygrass',.55,1],['pebble',.42,0],['crack',.18,0],['twig',.08,0]],
  city:[['litter',.26,0,1],['crack',.24,0,1],['weed',.2,1,1],['pebble',.12,0,1],['ember',.1,0,1]],
  frost:[['snowlump',.6,0],['iceshard',.14,0],['drygrass',.1,1]],
  gray:[['sporepuff',.5,1],['fungus',.34,0],['pebble',.14,0],['ember',.12,0]],
};
export function clutterGeo(name,v){const g=new Geo();g.jit=.1;CLUTTER[name](g,v);return g.build()}

// ---------------------------------------------------------------- wind
const windUniform={value:0},gustUniform={value:1};
/** A vertex-colour Lambert material whose instances bend with the wind: `quad` scales with height², `lin` with height. */
export function windMaterial(quad,lin){
  const m=new THREE.MeshLambertMaterial({vertexColors:true});
  m.onBeforeCompile=sh=>{sh.uniforms.uTime=windUniform;sh.uniforms.uGust=gustUniform;
    sh.vertexShader='uniform float uTime;uniform float uGust;\n'+sh.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
  float wph=uTime*1.5+instanceMatrix[3].x*.83+instanceMatrix[3].z*1.27;
  float wb=(position.y*position.y*${quad.toFixed(4)}+position.y*${lin.toFixed(4)})*uGust;
  transformed.x+=(sin(wph)+sin(wph*2.3+1.7)*.35)*wb;transformed.z+=cos(wph*.8)*wb*.6;
#endif`)};
  m.customProgramCacheKey=()=>'wind'+quad+'_'+lin;return m;
}
export const setWind=(t,gust)=>{windUniform.value=t;gustUniform.value=gust};

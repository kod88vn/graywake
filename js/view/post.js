// The ink pass. The scene is drawn into an off-screen target (colour + depth); a full-screen shader then draws
// dark outlines on silhouettes and hard creases, and grades the colour (saturation, soft highlight shoulder).
// Opaque materials write an "ink weight" into alpha (see addDetail in geo.js): 0 for ground and grass (never outlined),
// .4 for foliage (silhouettes and overlaps only), .8 for objects (creases too), 1 for characters. Transparent materials must leave alpha alone: use inkBlend() for them.
import {THREE} from './geo.js';

/** Blending for transparent helpers (particles, rings, glows) that keeps the ink weight underneath untouched. */
export const inkBlend=additive=>({blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:additive?THREE.OneFactor:THREE.OneMinusSrcAlphaFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor});
/** Make an opaque unlit material invisible to the outline pass (tracers, rain). */
export function noInk(m){m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\n  gl_FragColor.a=0.0;')};m.customProgramCacheKey=()=>'noink';return m}

const VERT='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const FRAG=`
uniform sampler2D tC;uniform sampler2D tD;uniform vec2 uPx;uniform vec2 uNF;uniform vec2 uFog;uniform float uInk;uniform int uDirs;uniform float uFoot;uniform float uExp;uniform float uSat;uniform vec3 uInkCol;
varying vec2 vUv;
float viewZ(float d){return uNF.x*uNF.y/(uNF.y-d*(uNF.y-uNF.x));}
void main(){
  vec4 c=texture2D(tC,vUv);vec3 col=c.rgb;
  if(uInk>0.0){
    float dc=texture2D(tD,vUv).x,zc=viewZ(dc),ac=c.a,e=0.0;
    // raw depth is linear across the screen on any flat surface, so the second difference is zero there
    // and jumps at silhouettes and creases; scaled to world units and divided by the sample spacing
    float k=zc*zc*(uNF.y-uNF.x)/(uNF.x*uNF.y),o=uFoot*zc;
    // foliage (weight under .5) only takes lines at real overlaps, not at the facets of its low-poly lumps
    float thr=ac<.55?4.5:1.15;
    for(int i=0;i<4;i++){
      if(i>=uDirs)break;
      vec2 dir=i==0?vec2(1.0,0.0):i==1?vec2(0.0,1.0):i==2?vec2(.7071,.7071):vec2(.7071,-.7071);
      vec2 off=dir*uPx;
      float d1=texture2D(tD,vUv+off).x,d2=texture2D(tD,vUv-off).x;
      float a1=texture2D(tC,vUv+off).a,a2=texture2D(tC,vUv-off).a;
      float lap=(d1+d2-2.0*dc)*k/o;
      e=max(e,smoothstep(thr,thr*1.6,lap));
      // two things of different weight, the other one not in front: always a line (feet on the ground, a figure against a wall)
      float behind1=step(-.5*o,(d1-dc)*k),behind2=step(-.5*o,(d2-dc)*k);
      e=max(e,max(smoothstep(.05,.2,abs(ac-a1))*behind1,smoothstep(.05,.2,abs(ac-a2))*behind2));
    }
    float w=e*smoothstep(0.0,.25,ac)*uInk*(1.0-smoothstep(uFog.x,uFog.y,zc));
    col=mix(col,col*uInkCol+uInkCol*.06,w);
  }
  col*=uExp;float L=dot(col,vec3(.2126,.7152,.0722));col=max(mix(vec3(L),col,uSat),0.0);
  vec3 hi=max(col-.75,0.0);col=min(col,.75)+.25*(1.0-exp(-hi*4.0));
  gl_FragColor=vec4(col,1.0);
  #include <colorspace_fragment>
}`;

export class Post{
  constructor(R){
    this.R=R;this.ok=R.capabilities.isWebGL2;
    this.rt=null;this.samples=4;this.ink=1;this.size=new THREE.Vector2();
    this.mat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:{tC:{value:null},tD:{value:null},uPx:{value:new THREE.Vector2()},uNF:{value:new THREE.Vector2(1,160)},uFog:{value:new THREE.Vector2(1e4,2e4)},uInk:{value:1},uDirs:{value:4},uFoot:{value:.001},uExp:{value:1},uSat:{value:1.12},uInkCol:{value:new THREE.Color('#2a2038')}}});
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.mat);this.quad.frustumCulled=false;this.scene=new THREE.Scene();this.scene.add(this.quad);this.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  }
  /** samples: MSAA level of the off-screen target; ink: 0 turns the outlines off; dirs: 4 samples the full ring, 2 only across and down (cheaper, for low quality). */
  set(samples,ink,dirs=4){this.mat.uniforms.uDirs.value=dirs;if(samples!==this.samples&&this.rt){this.rt.dispose();this.rt=null}this.samples=samples;this.ink=ink}
  target(){
    const R=this.R,s=R.getDrawingBufferSize(this.size);
    if(this.rt&&this.rt.width===s.x&&this.rt.height===s.y)return this.rt;if(this.rt)this.rt.dispose();
    // 8-bit sRGB colour: every WebGL2 device can multisample it (float targets are not guaranteed on phones), and the lighting stays within 0..1
    const rt=new THREE.WebGLRenderTarget(s.x,s.y,{type:THREE.UnsignedByteType,samples:Math.min(this.samples,R.capabilities.maxSamples||0),depthBuffer:true,stencilBuffer:false});
    rt.texture.colorSpace=THREE.SRGBColorSpace;
    rt.depthTexture=new THREE.DepthTexture(s.x,s.y);rt.depthTexture.minFilter=rt.depthTexture.magFilter=THREE.NearestFilter;
    rt.texture.minFilter=rt.texture.magFilter=THREE.LinearFilter;rt.texture.generateMipmaps=false;
    // if this device cannot build the target, drop multisampling, then drop the pass altogether
    const gl=R.getContext();R.setRenderTarget(rt);const good=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;R.setRenderTarget(null);
    if(!good){rt.dispose();if(this.samples>0){this.samples=0;return this.target()}this.ok=false;console.warn('outline pass unavailable on this device');return null}
    return this.rt=rt;
  }
  /** Draw the scene with outlines. fog = [near, far] in view units: the ink fades out with the fog. */
  render(scene,cam,fog){
    const R=this.R;if(!this.ok){R.setRenderTarget(null);R.render(scene,cam);return}
    const rt=this.target();if(!rt){R.render(scene,cam);return}
    const u=this.mat.uniforms,lw=Math.max(1,Math.min(3,rt.height/760));
    R.setRenderTarget(rt);R.render(scene,cam);R.setRenderTarget(null);
    u.tC.value=rt.texture;u.tD.value=rt.depthTexture;u.uPx.value.set(lw/rt.width,lw/rt.height);u.uNF.value.set(cam.near,cam.far);u.uInk.value=this.ink;
    u.uFoot.value=2*Math.tan(cam.fov*Math.PI/360)/rt.height*lw;if(fog)u.uFog.value.set(fog[0],fog[1]);else u.uFog.value.set(1e4,2e4);
    R.render(this.scene,this.cam);
  }
}

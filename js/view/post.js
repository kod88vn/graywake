// The finishing pass. The scene is drawn into an off-screen target (colour + depth). A half-resolution pass then works out
// ambient occlusion from the depth buffer: creases, the foot of a wall, the ground under a canopy and the gaps between limbs
// lose a little light, as they do outdoors. The last pass smooths that, applies it, and grades the picture with a filmic curve.
import {THREE} from './geo.js';

const VERT='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}';
const COMMON=`
uniform sampler2D tD;uniform vec2 uNF;uniform vec2 uProj;varying vec2 vUv;
float viewZ(float d){return uNF.x*uNF.y/(uNF.y-d*(uNF.y-uNF.x));}
vec3 posAt(vec2 uv){float z=viewZ(texture2D(tD,uv).x);return vec3((uv*2.0-1.0)*uProj*z,-z);}`;
// occlusion: for points on a spiral around the pixel, how far each rises above this surface, weighed against its distance
const AO=COMMON+`
uniform vec2 uPx;uniform float uRad;
void main(){
  vec3 P=posAt(vUv),Pr=posAt(vUv+vec2(uPx.x,0.0)),Pl=posAt(vUv-vec2(uPx.x,0.0)),Pu=posAt(vUv+vec2(0.0,uPx.y)),Pd=posAt(vUv-vec2(0.0,uPx.y));
  vec3 dx=abs(Pr.z-P.z)<abs(P.z-Pl.z)?Pr-P:P-Pl,dy=abs(Pu.z-P.z)<abs(P.z-Pd.z)?Pu-P:P-Pd,N=normalize(cross(dx,dy));
  float z=-P.z,rot=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))))*6.2832,occ=0.0;
  vec2 rUv=uRad/(2.0*z*uProj);
  for(int i=0;i<12;i++){float fi=float(i)+.5,r=sqrt(fi/12.0),a=fi*2.39996+rot;
    vec3 v=posAt(vUv+vec2(cos(a),sin(a))*r*rUv)-P;float vv=dot(v,v);
    occ+=max(0.0,dot(v,N)-.02-.004*z)/(vv+.012)*step(vv,uRad*uRad*2.5);}
  gl_FragColor=vec4(vec3(clamp(1.0-occ*.11,0.0,1.0)),1.0);
}`;
const FINAL=COMMON+`
uniform sampler2D tC;uniform sampler2D tA;uniform vec2 uAPx;uniform vec2 uFog;uniform float uAO;uniform float uExp;uniform float uSat;
vec3 film(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);}
void main(){
  vec3 col=texture2D(tC,vUv).rgb;
  if(uAO>0.0){
    float zc=viewZ(texture2D(tD,vUv).x),s=0.0,w=0.0;
    for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 uv=vUv+vec2(float(x),float(y))*uAPx*1.5;float k=1.0/(1.0+abs(viewZ(texture2D(tD,uv).x)-zc)*6.0);s+=texture2D(tA,uv).r*k;w+=k;}
    float ao=mix(1.0,s/w,uAO*(1.0-smoothstep(uFog.x,uFog.y,zc)));
    col*=mix(vec3(ao),vec3(1.0),clamp(dot(col,vec3(.3,.6,.1))-.9,0.0,1.0));
  }
  col=film(col*uExp);float L=dot(col,vec3(.2126,.7152,.0722));col=max(mix(vec3(L),col,uSat),0.0);
  vec2 q=vUv-.5;col*=1.0-.22*smoothstep(.35,.95,length(q)*1.25);
  gl_FragColor=vec4(col,1.0);
  #include <colorspace_fragment>
}`;

export class Post{
  constructor(R){
    this.R=R;this.ok=R.capabilities.isWebGL2;this.hdr=this.ok&&(R.extensions.has('EXT_color_buffer_float')||R.extensions.has('EXT_color_buffer_half_float'));
    this.rt=null;this.art=null;this.samples=4;this.ao=1;this.size=new THREE.Vector2();
    const U=()=>({tD:{value:null},uNF:{value:new THREE.Vector2(1,160)},uProj:{value:new THREE.Vector2(1,1)}});
    this.aoMat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:AO,depthTest:false,depthWrite:false,toneMapped:false,uniforms:Object.assign(U(),{uPx:{value:new THREE.Vector2()},uRad:{value:.7}})});
    this.mat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FINAL,depthTest:false,depthWrite:false,toneMapped:false,
      uniforms:Object.assign(U(),{tC:{value:null},tA:{value:null},uAPx:{value:new THREE.Vector2()},uFog:{value:new THREE.Vector2(1e4,2e4)},uAO:{value:1},uExp:{value:1.18},uSat:{value:1.04}})});
    this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.mat);this.quad.frustumCulled=false;this.scene=new THREE.Scene();this.scene.add(this.quad);this.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  }
  /** samples: MSAA level of the off-screen target; ao: 0 turns ambient occlusion off (low quality), 1 is full strength. */
  set(samples,ao=1){if(samples!==this.samples&&this.rt){this.rt.dispose();this.rt=null}this.samples=samples;this.ao=ao}
  make(w,h,type,samples,depth){
    const R=this.R,rt=new THREE.WebGLRenderTarget(w,h,{type,samples,depthBuffer:depth,stencilBuffer:false});
    if(type===THREE.UnsignedByteType&&depth)rt.texture.colorSpace=THREE.SRGBColorSpace;rt.texture.minFilter=rt.texture.magFilter=THREE.LinearFilter;rt.texture.generateMipmaps=false;
    if(depth){rt.depthTexture=new THREE.DepthTexture(w,h);rt.depthTexture.minFilter=rt.depthTexture.magFilter=THREE.NearestFilter}
    const gl=R.getContext();R.setRenderTarget(rt);const good=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;R.setRenderTarget(null);
    if(!good){rt.dispose();return null}return rt;
  }
  target(){
    const R=this.R,s=R.getDrawingBufferSize(this.size);
    if(this.rt&&this.rt.width===s.x&&this.rt.height===s.y)return this.rt;if(this.rt)this.rt.dispose();if(this.art){this.art.dispose();this.art=null}
    // try the best first: floating-point colour with multisampling, then 8-bit sRGB (which every WebGL2 device can multisample), then no multisampling
    const ms=Math.min(this.samples,R.capabilities.maxSamples||0);let rt=null;
    for(const[type,n]of[[this.hdr?THREE.HalfFloatType:THREE.UnsignedByteType,ms],[THREE.UnsignedByteType,ms],[THREE.UnsignedByteType,0]]){rt=this.make(s.x,s.y,type,n,true);if(rt)break;if(type===THREE.HalfFloatType)this.hdr=false}
    if(!rt){this.ok=false;console.warn('finishing pass unavailable on this device');return null}
    this.art=this.make(Math.max(2,s.x>>1),Math.max(2,s.y>>1),THREE.UnsignedByteType,0,false);
    return this.rt=rt;
  }
  /** Draw the scene, then the occlusion and grade. fog = [near, far] in view units: occlusion fades out with the fog. */
  render(scene,cam,fog){
    const R=this.R;if(!this.ok){R.setRenderTarget(null);R.render(scene,cam);return}
    const rt=this.target();if(!rt){R.render(scene,cam);return}
    R.setRenderTarget(rt);R.render(scene,cam);
    const th=Math.tan(cam.fov*Math.PI/360),ao=this.ao>0&&this.art;
    for(const m of[this.aoMat,this.mat]){const u=m.uniforms;u.tD.value=rt.depthTexture;u.uNF.value.set(cam.near,cam.far);u.uProj.value.set(th*cam.aspect,th)}
    if(ao){this.quad.material=this.aoMat;this.aoMat.uniforms.uPx.value.set(1/this.art.width,1/this.art.height);R.setRenderTarget(this.art);R.render(this.scene,this.cam)}
    const u=this.mat.uniforms;u.tC.value=rt.texture;u.tA.value=ao?this.art.texture:null;u.uAO.value=ao?this.ao:0;if(ao)u.uAPx.value.set(1/this.art.width,1/this.art.height);
    if(fog)u.uFog.value.set(fog[0],fog[1]);else u.uFog.value.set(1e4,2e4);
    this.quad.material=this.mat;R.setRenderTarget(null);R.render(this.scene,this.cam);
  }
}

// A close look at yourself: the player's rig on its own small canvas, turning slowly, shown in the Pack sheet.
// In the game view a figure is a few dozen pixels tall; this is where what you are wearing can actually be seen.
import {THREE} from './geo.js';
import {playerRig,setWeapon,pose,disposeRig} from './rigs.js';
import {ITEMS} from '../data/items.js';

let R=null,scene,cam,rig=null,key='',t=0,cv=null,failed=false;
function init(){
  cv=document.createElement('canvas');cv.style.cssText='width:100%;height:100%;display:block';
  try{R=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true})}catch(e){failed=true;return}
  R.setClearColor(0,0);R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.15;
  scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#d8e4ff','#5a5040',1.25));
  const sun=new THREE.DirectionalLight('#fff2d8',2.6);sun.position.set(-2.5,4,3.5);scene.add(sun);const rim=new THREE.DirectionalLight('#a8c0ff',.9);rim.position.set(3,2,-3);scene.add(rim);
  cam=new THREE.PerspectiveCamera(24,1,.1,20);
}
export const Portrait={
  /** Put the canvas into `host` and dress the figure from `eq`. Call again whenever the sheet is redrawn. */
  mount(host,eq,active){
    if(!host||failed)return;if(!R)init();if(failed){host.textContent='';return}
    if(cv.parentNode!==host)host.appendChild(cv);
    const k=JSON.stringify(['head','body','legs','feet','hands','pack',active].map(s=>eq[s]?eq[s].id:0));
    if(k!==key){key=k;if(rig){scene.remove(rig.root);disposeRig(rig)}rig=playerRig(eq);const w=eq[active]&&ITEMS[eq[active].id];if(w&&w.mdl)setWeapon(rig,w.mdl);scene.add(rig.root)}
  },
  frame(dt){
    if(!R||!rig||!cv.isConnected)return;const w=cv.clientWidth,h=cv.clientHeight;if(!w||!h)return;
    const pr=Math.min(2,devicePixelRatio||1);if(cv.width!==Math.round(w*pr)||cv.height!==Math.round(h*pr)){R.setPixelRatio(pr);R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
    t+=dt;rig.root.rotation.y=.45+Math.sin(t*.45)*.75;pose(rig,{dt,t,mv:0,atk:-1,wind:0,gun:0,dead:false,deadT:0,flash:0,vis:1});
    cam.position.set(0,.95,3.5);cam.lookAt(0,.66,0);R.render(scene,cam);
  },
};

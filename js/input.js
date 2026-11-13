// Keyboard, mouse and touch → the player's intent (G.inp). Hot-keys and build-mode pointer events go to callbacks.
import {G} from './sim/core.js';
import {View} from './view/render.js';

const keys={};let mouse=null,joyId=null,joyO=null,cb={},gw,cv,joy,knob;
export const Input={touch:false,init,frame};
const HOT={KeyI:'inv',Tab:'inv',KeyC:'craft',KeyB:'build',KeyJ:'journal',KeyL:'camp',KeyO:'world',Escape:'esc',KeyQ:'swap',KeyF:'auto',Digit1:'q_hp',Digit2:'q_food',Digit3:'q_water',Digit4:'q_tox',KeyR:'rotate',KeyM:'leave',KeyP:'menu'};

function init(callbacks){
  cb=callbacks;gw=document.getElementById('gw');cv=document.getElementById('cv');joy=document.getElementById('joy');knob=joy.firstElementChild;
  addEventListener('keydown',e=>{
    if(e.target&&(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT'||e.target.tagName==='SELECT'))return;
    if(HOT[e.code]){e.preventDefault();if(!e.repeat)cb.hot(HOT[e.code]);return}
    if(G.paused)return;keys[e.code]=true;
    if(e.code==='KeyE'){if(!e.repeat)G.inp.interact=true}else if(e.code==='Space'){e.preventDefault();if(!e.repeat)G.inp.dodge=true}
    else if(e.code.startsWith('Arrow'))e.preventDefault();
  });
  addEventListener('keyup',e=>{keys[e.code]=false});
  addEventListener('blur',()=>{for(const k in keys)keys[k]=false;G.inp.attack=false});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('pointerdown',e=>{
    cb.gesture();if(e.pointerType==='touch'){setTouch(true);
      if(G.build){cb.build('down',e.clientX,e.clientY);return}
      if(joyId===null&&e.clientX<innerWidth*.5){joyId=e.pointerId;joyO={x:e.clientX,y:e.clientY};const r=gw.getBoundingClientRect();joy.style.left=(e.clientX-r.left-56)+'px';joy.style.top=(e.clientY-r.top-56)+'px';joy.style.bottom='auto';cv.setPointerCapture(e.pointerId)}
      return}
    setTouch(false);mouse={x:e.clientX,y:e.clientY};
    if(G.build){if(e.button===0)cb.build('down',e.clientX,e.clientY);else if(e.button===2)cb.hot('rotate');return}
    if(e.button===0){G.inp.attack=true;G.inp.tap=true}else if(e.button===2)G.inp.interact=true;
  });
  cv.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'){if(G.build){cb.build('move',e.clientX,e.clientY,true);return}
      if(e.pointerId===joyId){let dx=(e.clientX-joyO.x)/48,dy=(e.clientY-joyO.y)/48;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l}G.inp.mx=l<.15?0:dx;G.inp.my=l<.15?0:dy;knob.style.transform=`translate(${dx*34}px,${dy*34}px)`}return}
    mouse={x:e.clientX,y:e.clientY};if(G.build)cb.build('move',e.clientX,e.clientY,(e.buttons&1)===1);
  });
  const up=e=>{if(e.pointerId===joyId){joyId=null;G.inp.mx=G.inp.my=0;knob.style.transform='';joy.style.left=joy.style.top=joy.style.bottom=''}if(e.pointerType!=='touch'&&e.button===0)G.inp.attack=false;if(G.build)cb.build('up',e.clientX,e.clientY)};
  cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);addEventListener('mouseup',e=>{if(e.button===0)G.inp.attack=false});
  cv.addEventListener('wheel',e=>{e.preventDefault();View.setZoom(View.zoom*(e.deltaY>0?1.08:.93))},{passive:false});
  // on-screen pad
  const hold=(id,down,upf)=>{const el=document.getElementById(id);el.addEventListener('pointerdown',e=>{e.preventDefault();cb.gesture();setTouch(e.pointerType==='touch');el.setPointerCapture(e.pointerId);down()});if(upf){el.addEventListener('pointerup',upf);el.addEventListener('pointercancel',upf)}};
  hold('b-atk',()=>{if(!G.build){G.inp.attack=true;G.inp.tap=true}},()=>{G.inp.attack=false});hold('b-use',()=>{G.inp.interact=true});hold('b-dodge',()=>{G.inp.dodge=true});
  hold('b-sneak',()=>{G.inp.sneakT=!G.inp.sneakT;document.getElementById('b-sneak').classList.toggle('on',G.inp.sneakT)});
  if(matchMedia('(pointer:coarse)').matches)setTouch(true);
}
function setTouch(on){if(Input.touch===on)return;Input.touch=on;gw.classList.toggle('touch',on);if(on){mouse=null;G.inp.aim=null}}
/** Called every frame before the simulation. */
function frame(){
  const I=G.inp;
  if(G.paused||G.mode!=='play'){I.mx=I.my=0;I.attack=false;I.tap=false;I.interact=false;I.dodge=false;return}
  if(joyId===null){let x=0,y=0;if(keys.KeyW||keys.ArrowUp)y-=1;if(keys.KeyS||keys.ArrowDown)y+=1;if(keys.KeyA||keys.ArrowLeft)x-=1;if(keys.KeyD||keys.ArrowRight)x+=1;const l=Math.hypot(x,y)||1;I.mx=x/l;I.my=y/l}
  I.sneak=!!(keys.ShiftLeft||keys.ShiftRight||keys.ControlLeft||I.sneakT);
  I.aim=!Input.touch&&mouse&&!G.build?View.pick(mouse.x,mouse.y):null;
  if(G.build)I.attack=I.tap=false;
}

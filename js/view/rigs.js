// Character rigs: jointed low-poly bodies built from a description, and the code that poses them every frame.
// A rig is a THREE.Group: root → body (leans, crouches, falls) → parts. Each rig owns its material so it can flash, fade and go translucent.
import {THREE,Geo,shade} from './geo.js';
import {HAND} from './props.js';
import {ITEMS} from '../data/items.js';

const handCache=new Map();
function handGeo(mdl){let g=handCache.get(mdl);if(!g&&HAND[mdl]){const b=new Geo();HAND[mdl](b);g=b.build();handCache.set(mdl,g)}return g}
const part=(mat,draw)=>{const g=new Geo();draw(g);const m=new THREE.Mesh(g.build(),mat);m.castShadow=true;return m};
const HAIR=['#2a2018','#4a3520','#6a4a2a','#8a8478','#1a1a1a','#7a3a1a'],SKIN=['#c09a7a','#a87a5a','#d8b090','#8a6044','#e0c0a0'],TOPS=['#6a7a5a','#7a5a4a','#4a5a6a','#8a7a4a','#5a4a5a','#3a5a4a','#8a4a3a'];

/** Humanoid: o = {skin, top, legs, boots, hair, head (colour override), helm, helmStyle, vest, vestStyle, sleeves, pack, fat, scale, mask, weapon (hand model id)} */
export function humanoid(o){
  const mat=new THREE.MeshLambertMaterial({vertexColors:true}),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const fat=o.fat||1,skin=o.skin||'#c09a7a',top=o.top||'#6a7a5a',legs=o.legs||'#3a3f4a',boots=o.boots||shade(legs,.6),sleeves=o.sleeves||top;
  const P={};
  P.torso=part(mat,g=>{g.box(.36*fat,.42,.22*fat,top,0,.21,0);g.box(.37*fat,.07,.23*fat,shade(legs,.8),0,.035,0);g.box(.07,.05,.02,'#8a7a4a',0,.04,.115*fat);g.box(.14,.07,.14,skin,0,.44,0);
    if(!o.husk&&!o.vest){g.box(.3*fat,.05,.24*fat,shade(top,1.18),0,.4,0);g.box(.04,.3,.02,shade(top,.72),0,.22,.112*fat)}
    if(o.gore){const gc='#5a1412';g.box(.16,.14,.02,gc,-.06*fat,.26,.113*fat);if(o.gore>1)g.box(.02,.16,.12,gc,.181*fat,.2,0);if(o.gore>2){g.box(.2,.1,.02,shade(gc,.7),.04,.12,-.113*fat);g.box(.12*fat,.06,.23*fat,skin,.1,.07,0)}g.box(.1,.05,.225*fat,shade(top,.6),-.1,.1,0)}
    if(o.vest){const s=o.vestStyle;if(s==='plate'){g.box(.39*fat,.3,.26*fat,o.vest,0,.25,0);g.box(.2*fat,.16,.28*fat,shade(o.vest,1.2),0,.27,0);g.box(.13,.06,.24,shade(o.vest,.8),-.2*fat,.4,0);g.box(.13,.06,.24,shade(o.vest,.8),.2*fat,.4,0)}
      else if(s==='jacket'){g.box(.385*fat,.4,.245*fat,o.vest,0,.22,0);g.box(.05,.36,.02,shade(o.vest,.7),0,.22,.125*fat);g.box(.3*fat,.06,.26*fat,shade(o.vest,1.15),0,.41,0)}
      else{g.box(.38*fat,.32,.24*fat,o.vest,0,.24,0);g.box(.1,.34,.25*fat,top,0,.24,0)}}
    if(o.pack){g.box(.28,.32,.16,o.pack,0,.24,-.19*fat);g.box(.22,.12,.06,shade(o.pack,1.2),0,.2,-.29*fat);g.box(.3,.05,.17,shade(o.pack,.75),0,.39,-.19*fat)}});
  P.torso.position.y=.42;body.add(P.torso);
  P.head=part(mat,g=>{const hc=o.head||skin;g.box(.24,.24,.24,hc,0,.12,0);g.box(.05,.04,.02,'#1c1a18',-.06,.14,.121);g.box(.05,.04,.02,'#1c1a18',.06,.14,.121);
    const st=o.helmStyle;
    if(o.helm){if(st==='hood'){g.box(.28,.2,.28,o.helm,0,.17,-.01);g.box(.28,.1,.1,shade(o.helm,.85),0,.07,-.1)}
      else if(st==='cap'){g.box(.26,.09,.26,o.helm,0,.24,0);g.box(.22,.03,.12,shade(o.helm,.8),0,.21,.17)}
      else if(st==='visor'){g.box(.28,.2,.28,o.helm,0,.18,0);g.box(.24,.1,.03,'#9fd0e8',0,.13,.14);g.box(.3,.04,.3,shade(o.helm,.8),0,.09,0)}
      else if(st==='mask'){g.box(.27,.27,.27,o.helm,0,.13,0);g.box(.18,.08,.03,'#2a3030',0,.15,.137);g.cyl(.05,.05,.08,'#3a3a3a',0,.05,.16,8,Math.PI/2)}
      else{g.box(.28,.13,.28,o.helm,0,.22,0);g.box(.3,.04,.3,shade(o.helm,.8),0,.16,0)}}
    else if(o.hair){g.box(.26,.09,.26,o.hair,0,.22,-.01);if(o.hairStyle===1)g.box(.26,.14,.08,o.hair,0,.13,-.1);else if(o.hairStyle===2){g.box(.27,.2,.1,o.hair,0,.1,-.1);g.box(.05,.14,.2,o.hair,-.115,.13,-.02);g.box(.05,.14,.2,o.hair,.115,.13,-.02)}else g.box(.2,.03,.06,o.hair,0,.2,.12)}
    if(o.husk){g.box(.14,.045,.02,'#2a1210',0,.045,.122);if(o.gore)g.box(.1,.1,.02,'#5a1412',.07,.17,.122)}else g.box(.05,.03,.02,shade(hc,.8),0,.09,.122);
    if(o.mask&&!o.helm)g.box(.25,.1,.04,o.mask,0,.07,.11)});
  P.head.position.y=.86;body.add(P.head);
  const arm=side=>{const m=part(mat,g=>{g.box(.11,.26,.12,o.vestStyle==='jacket'&&o.vest?o.vest:sleeves,0,-.11,0);g.box(.1,.16,.11,skin,0,-.31,0);g.box(.11,.07,.12,shade(skin,.86),0,-.405,.005);if(o.gore>1&&side<0)g.box(.105,.08,.115,'#5a1412',0,-.3,0)});m.position.set(side*(.18*fat+.065),.8,0);body.add(m);return m};
  P.armL=arm(-1);P.armR=arm(1);
  const leg=side=>{const m=part(mat,g=>{g.box(.14,.3,.16,legs,0,-.15,0);g.box(.15,.13,.19,boots,0,-.355,.015)});m.position.set(side*.095,.42,0);body.add(m);return m};
  P.legL=leg(-1);P.legR=leg(1);
  const hand=new THREE.Group();hand.position.set(0,-.36,.02);hand.rotation.x=Math.PI/2;P.armR.add(hand);
  const rig={root,body,P,hand,mat,type:'human',ph:Math.random()*6,scale:o.scale||1,weapon:null,lean:o.lean||0,husk:!!o.husk,h:1.15*(o.scale||1),death:0};
  root.scale.setScalar(rig.scale);if(o.weapon)setWeapon(rig,o.weapon);
  return rig;
}
export function setWeapon(rig,mdl){
  if(rig.weaponMesh){rig.hand.remove(rig.weaponMesh);rig.weaponMesh=null}rig.weapon=mdl||null;if(!mdl)return;const g=handGeo(mdl);if(!g)return;
  const m=new THREE.Mesh(g,rig.mat);m.castShadow=true;rig.hand.add(m);rig.weaponMesh=m;
}
/** Four-legged animals. o = {c, scale, slim, stout, tail, ears, antler, tusk, spikes} */
export function quadruped(o){
  const mat=new THREE.MeshLambertMaterial({vertexColors:true}),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const c=o.c,w=o.stout?.42:o.slim?.26:.32,len=o.stout?.8:.72,ht=o.slim?.5:.42,P={};
  P.torso=part(mat,g=>{g.box(w,.32,len,c,0,0,0);g.box(w*.9,.26,len*.4,shade(c,.9),0,-.01,-len*.3);if(o.stout)g.box(w*1.05,.2,len*.5,shade(c,1.1),0,.1,.1);
    if(o.spikes)for(let i=0;i<4;i++)g.cone(.05,.16,o.spikes,0,.22,-.25+i*.17,4);
    if(o.tail)g.box(.07,.07,.3,shade(c,.85),0,.08,-len/2-.12,.5);else g.box(.08,.08,.08,shade(c,1.2),0,.08,-len/2-.03)});
  P.torso.position.y=ht;body.add(P.torso);
  P.head=part(mat,g=>{g.box(w*.75,.24,.26,c,0,.02,.1);g.box(w*.45,.14,.2,shade(c,.85),0,-.04,.3);g.box(.04,.04,.02,'#151515',-w*.25,.07,.235);g.box(.04,.04,.02,'#151515',w*.25,.07,.235);
    if(o.ears){g.box(.05,.2,.04,shade(c,.9),-w*.22,.22,.05);g.box(.05,.2,.04,shade(c,.9),w*.22,.22,.05)}else{g.box(.06,.08,.04,shade(c,.8),-w*.28,.16,.02);g.box(.06,.08,.04,shade(c,.8),w*.28,.16,.02)}
    if(o.antler)for(const s of[-1,1]){g.box(.03,.26,.03,'#d8c8a8',s*.1,.26,.02,0,0,s*-.4);g.box(.03,.14,.03,'#d8c8a8',s*.2,.36,.02,0,0,s*.5)}
    if(o.tusk)for(const s of[-1,1])g.cone(.03,.12,'#e8e0c8',s*w*.26,-.02,.36,4,-.8)});
  P.head.position.set(0,ht+.14,len/2);body.add(P.head);
  const leg=(sx,sz)=>{const m=part(mat,g=>{g.box(.09,ht-.12,.1,shade(c,.85),0,-(ht-.12)/2,0);g.box(.1,.06,.12,shade(c,.6),0,-(ht-.1),.01)});m.position.set(sx*(w/2-.05),ht-.12,sz*(len/2-.1));body.add(m);return m};
  P.legFL=leg(-1,1);P.legFR=leg(1,1);P.legBL=leg(-1,-1);P.legBR=leg(1,-1);
  const rig={root,body,P,mat,type:'quad',ph:Math.random()*6,scale:o.scale||1,h:(ht+.4)*(o.scale||1),death:0};root.scale.setScalar(rig.scale);return rig;
}
/** The Bloom Core: a rooted pulsing mass. */
export function blob(o){
  const mat=new THREE.MeshLambertMaterial({vertexColors:true}),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const core=part(mat,g=>{g.ico(.5,o.c,0,.5,0,1,1.1,1,0,1);g.ico(.32,o.c2,.3,.75,.15);g.ico(.28,o.c2,-.32,.6,-.1);g.ico(.24,shade(o.c2,1.2),.05,1.0,-.2);g.ico(.2,o.c2,-.1,.4,.42);
    for(let i=0;i<7;i++){const a=i/7*Math.PI*2;g.cone(.1,.7,shade(o.c,.7),Math.cos(a)*.55,.2,Math.sin(a)*.55,5,Math.sin(a)*1.1,0,-Math.cos(a)*1.1)}});
  body.add(core);const rig={root,body,P:{torso:core},mat,type:'blob',ph:0,scale:o.scale||1,h:1.3*(o.scale||1),death:0};root.scale.setScalar(rig.scale);return rig;
}
/** Build the rig for a creature definition's `rig` field, or for a survivor (seeded by id). */
export function rigFor(def,seed=0){
  const[type,o]=def.rig;if(type==='quad')return quadruped(o);if(type==='blob')return blob(o);
  if(type==='human'&&def.ai==='follow'){const h=(n)=>((seed*2654435761>>>0)>>n)%7;return humanoid({skin:SKIN[h(3)%SKIN.length],top:TOPS[h(7)%TOPS.length],legs:['#3a3f4a','#4a4032','#2e3a2e','#4a4a5a'][h(11)%4],hair:HAIR[h(15)%HAIR.length],hairStyle:h(5)%3})}
  let oo=o;if(o.vary){const h=n=>(((seed*2654435761)>>>0)>>>n)%1000/1000,ZT=['#5a4a3a','#4a5a6a','#6a3a3a','#3a4a3a','#7a7a6a','#2e3a44','#6a5a7a','#8a6a3a','#4a4a4a'],ZL=['#3a3f4a','#4a4032','#2e2e36','#4a4a5a','#3a3028'];
    oo={...o,top:h(3)<.75?ZT[Math.floor(h(7)*ZT.length)]:o.top,legs:ZL[Math.floor(h(11)*ZL.length)],scale:(o.scale||1)*(.92+h(5)*.16),fat:(o.fat||1)*(.92+h(13)*.22),hair:h(9)<.55?HAIR[Math.floor(h(15)*HAIR.length)]:null,hairStyle:Math.floor(h(17)*3),gore:1+Math.floor(h(19)*3),lean:(o.lean||0)+h(21)*.14}}
  else if(type==='husk'||type==='crawler')oo={...o,gore:o.helm?1:2};
  const r=humanoid({...oo,husk:type==='husk'||type==='crawler',vestStyle:oo.vest?'plate':null,helmStyle:oo.helm?'helm':null,hair:type==='human'?'#2a2018':oo.hair,hairStyle:oo.hairStyle});
  if(type==='crawler'){r.type='crawler';r.h=.5}return r;
}
/** The player's rig, dressed from what is equipped. */
export function playerRig(eq){
  const look=s=>eq[s]&&ITEMS[eq[s].id]?ITEMS[eq[s].id].look||{}:null,head=look('head'),bodyL=look('body'),legs=look('legs'),feet=look('feet'),pack=look('pack');
  return humanoid({skin:'#c9a07c',top:'#7a6a52',legs:legs?legs.c:'#3f4652',boots:feet?feet.c:'#2a2622',hair:'#3a2a1c',hairStyle:1,helm:head?head.c:null,helmStyle:head?head.s||'helm':null,vest:bodyL?bodyL.c:null,vestStyle:bodyL?bodyL.s||'vest':null,pack:pack?pack.c:null});
}

const lerpA=(a,b,t)=>a+(b-a)*Math.min(1,t);
/** Pose a rig for this frame. s = {mv speed, dt, t time, atk 0..1 swing progress or -1, wind 0..1 enemy wind-up, gun, aim, sneak, roll 0..1, dead, deadT, act, flash, vis, charge, stun} */
export function pose(rig,s){
  const P=rig.P,dt=s.dt,k=Math.min(1,dt*14);
  if(rig.type==='blob'){const p=1+Math.sin(s.t*2.2)*.05+(s.wind>0?s.wind*.18:0);rig.body.scale.set(p,2-p,p);rig.body.rotation.y+=dt*.2;fade(rig,s);return}
  const moving=s.mv>.25,speed=Math.min(1.4,s.mv/3.2);if(moving)rig.ph+=dt*(4+s.mv*1.9);
  const sw=moving?Math.sin(rig.ph)*.75*Math.min(1,speed+.3):0;
  if(s.dead){rig.death=Math.min(1,rig.death+dt*3.2);rig.body.rotation.x=lerpA(rig.body.rotation.x,rig.type==='quad'?0:-Math.PI/2,rig.death);if(rig.type==='quad')rig.body.rotation.z=rig.death*Math.PI/2;rig.body.position.y=rig.type==='quad'?rig.death*.12:rig.death*.12;fade(rig,s);return}
  if(rig.type==='quad'){
    P.legFL.rotation.x=sw;P.legBR.rotation.x=sw;P.legFR.rotation.x=-sw;P.legBL.rotation.x=-sw;
    rig.body.position.y=moving?Math.abs(Math.sin(rig.ph))*.04:0;P.head.rotation.x=lerpA(P.head.rotation.x,s.wind>0?-.5:moving?.05:Math.sin(s.t*1.3+rig.ph)*.12,k);
    rig.body.rotation.x=lerpA(rig.body.rotation.x,s.wind>0?-.25:s.charge?.12:0,k);fade(rig,s);return}
  // humanoids
  const crawl=rig.type==='crawler';
  P.legL.rotation.x=sw;P.legR.rotation.x=-sw;
  let aL=-sw*.8,aR=sw*.8,lean=rig.lean+(moving?.08*speed:0),bodyY=moving?Math.abs(Math.sin(rig.ph))*.035:0,twist=0,aRz=0;
  if(rig.husk){aL=-1.25+Math.sin(s.t*2+rig.ph)*.12;aR=-1.35+Math.cos(s.t*1.7+rig.ph)*.12;lean+=.12;P.head.rotation.z=Math.sin(s.t*1.1+rig.ph)*.15}
  if(crawl){lean=1.25;bodyY=-.3;aL=-2.6+sw*.6;aR=-2.6-sw*.6;P.legL.rotation.x=.3+sw*.2;P.legR.rotation.x=.3-sw*.2}
  if(s.gun){aR=-Math.PI/2+(s.recoil>0?-.25:0);if(s.gun===2)aL=-1.2;lean+=.05}
  if(s.wind>0){const f=1-s.wind;aR=-2.7+f*.3;aL=rig.husk?-2.5+f*.3:aL;lean-=.15}
  if(s.atk>=0){const f=s.atk;aR=f<.35?-2.6:lerpA(-2.6,.9,(f-.35)/.3);twist=f<.35?-.5:lerpA(-.5,.6,(f-.35)/.3);lean+=.12;aRz=.2}
  if(s.act){const f=(s.act*2)%1;aR=f<.5?-2.4:lerpA(-2.4,.3,(f-.5)/.2);lean+=.1}
  if(s.throwing>0){aR=-2.8+s.throwing*8}
  if(s.sneak){lean+=.35;bodyY-=.12;P.legL.rotation.x+=.5;P.legR.rotation.x+=.5}
  if(s.stun){P.head.rotation.z=Math.sin(s.t*14)*.25;lean+=.2}
  if(s.roll>0){rig.body.rotation.x=s.roll*Math.PI*2;rig.body.position.y=.25;fade(rig,s);return}
  P.armL.rotation.x=lerpA(P.armL.rotation.x,aL,k*1.6);P.armR.rotation.x=lerpA(P.armR.rotation.x,aR,s.atk>=0||s.act?1:k*1.6);P.armR.rotation.z=lerpA(P.armR.rotation.z,-aRz,k);
  if(!moving&&!crawl){const br=Math.sin(s.t*1.8+rig.ph);bodyY+=br*.008;P.torso.scale.z=1+br*.02;if(!rig.husk)P.head.rotation.y=Math.sin(s.t*.6+rig.ph)*.18}else if(!rig.husk)P.head.rotation.y=0;
  rig.body.rotation.x=lerpA(rig.body.rotation.x,lean,k);rig.body.rotation.y=lerpA(rig.body.rotation.y,twist,k*2);rig.body.position.y=lerpA(rig.body.position.y,bodyY,k*2);
  fade(rig,s);
}
function fade(rig,s){
  const m=rig.mat,fl=s.flash>0?1:0;if(m._fl!==fl){m._fl=fl;m.emissive.setRGB(fl*.55,fl*.5,fl*.45)}
  let op=s.vis===undefined?1:s.vis;if(s.dead&&s.deadT>8.6)op*=Math.max(0,1-(s.deadT-8.6)/1.3);
  const tr=op<.99;if(m.transparent!==tr){m.transparent=tr;m.needsUpdate=true}m.opacity=op;
}
export function disposeRig(rig){rig.mat.dispose();rig.root.traverse(o=>{if(o.isMesh&&!handCacheHas(o.geometry))o.geometry.dispose()})}
function handCacheHas(g){for(const v of handCache.values())if(v===g)return true;return false}

// Character rigs: jointed bodies built from rounded anatomy (not boxes), and the code that poses them every frame.
// A humanoid is about 1.2 units tall with real proportions: seven and a half heads, two-part limbs with elbows and knees.
// A rig is a THREE.Group: root → body (leans, crouches, falls) → parts. Each rig owns its material so it can flash and fade.
import {THREE,Geo,shade,addDetail} from './geo.js';
import {HAND} from './props.js';
import {ITEMS} from '../data/items.js';

const handCache=new Map();
function handGeo(mdl){let g=handCache.get(mdl);if(!g&&HAND[mdl]){const b=new Geo();HAND[mdl](b);g=b.build();handCache.set(mdl,g)}return g}
const newMat=()=>addDetail(new THREE.MeshLambertMaterial({vertexColors:true}),{local:true,amp:.2,scale:7});
const part=(mat,draw)=>{const g=new Geo();g.jit=.03;draw(g);const m=new THREE.Mesh(g.build(),mat);m.castShadow=true;return m};
const grp=(parent,x,y,z)=>{const o=new THREE.Group();o.position.set(x,y,z);parent.add(o);return o};
const HAIR=['#2a2018','#4a3520','#6a4a2a','#8a8478','#1a1a1a','#7a3a1a'],SKIN=['#c09a7a','#a87a5a','#d8b090','#8a6044','#e0c0a0'],TOPS=['#6a7a5a','#7a5a4a','#4a5a6a','#8a7a4a','#5a4a5a','#3a5a4a','#8a4a3a'];
const BLOOD='#561210';

/** Humanoid: o = {skin, top, legs, boots, hair, hairStyle, head (colour override), helm, helmStyle, vest, vestStyle, sleeves, pack, fat, scale, mask, weapon, husk, gore, lean} */
export function humanoid(o){
  const mat=newMat(),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const fat=o.fat||1,skin=o.skin||'#c09a7a',top=o.top||'#6a7a5a',legs=o.legs||'#3a3f4a',boots=o.boots||shade(legs,.55),jacket=o.vestStyle==='jacket'&&o.vest,sleeve=jacket||o.sleeves||top,P={};
  // ---- torso: pelvis, belly, ribcage, shoulders, neck (pivot at the hips)
  P.torso=part(mat,g=>{
    g.sph(.118,legs,0,.02,0,1.12*fat,.78,.86*fat,10,6);g.sph(.122,'#3a3026',0,.085,0,1.1*fat,.2,.84*fat,10,4);
    g.sph(.115,top,0,.17,.004,1.08*fat,1.15,.8*fat,10,6);g.sph(.142,top,0,.305,0,1.1*fat,.98,.74*fat,10,7);
    g.sph(.058,sleeve,-.16*fat,.36,0,1,.9,1,7,5);g.sph(.058,sleeve,.16*fat,.36,0,1,.9,1,7,5);
    g.cyl(.036,.042,.08,o.head||skin,0,.445,.004,8);
    if(!o.husk&&!o.vest)g.sph(.06,shade(top,1.15),0,.41,.01,1.3,.35,1.1,8,4);
    if(o.husk&&o.gore>2)g.sph(.07,skin,.05*fat,.1,.07*fat,1,.6,.5,7,4);
    if(o.vest){const v=o.vest,s=o.vestStyle;
      if(s==='plate'){g.sph(.15,v,0,.3,.006,1.12*fat,.95,.82*fat,10,7);g.sph(.125,shade(v,.86),0,.165,.006,1.1*fat,1,.84*fat,10,5);g.sph(.07,shade(v,1.15),-.17*fat,.385,0,1.05,.55,1.1,7,4);g.sph(.07,shade(v,1.15),.17*fat,.385,0,1.05,.55,1.1,7,4);for(let i=0;i<3;i++)g.box(.07,.05,.03,shade(v,.7),-.08+i*.08,.15,.1*fat)}
      else if(s==='jacket'){g.sph(.147,v,0,.3,0,1.12*fat,1,.78*fat,10,7);g.sph(.122,v,0,.165,.002,1.1*fat,1.18,.84*fat,10,6);g.box(.016,.3,.02,shade(v,.6),0,.24,.108*fat);g.sph(.065,shade(v,1.18),0,.42,.005,1.35,.4,1.15,8,4)}
      else{g.sph(.146,v,0,.29,.004,1.06*fat,.9,.8*fat,10,7);g.sph(.12,v,0,.17,.004,1.02*fat,.9,.84*fat,10,5);g.box(.05,.06,.03,shade(v,.75),-.07,.2,.1*fat);g.box(.05,.06,.03,shade(v,.75),.07,.2,.1*fat)}}
    if(o.pack){const p=o.pack;g.sph(.125,p,0,.26,-.165*fat,.98,1.3,.72,9,6);g.sph(.07,shade(p,1.2),0,.19,-.255*fat,1.05,.85,.6,7,4);g.sph(.1,shade(p,.8),0,.4,-.15*fat,1,.35,.7,8,4);g.box(.028,.24,.02,shade(p,.7),-.09,.31,.1*fat);g.box(.028,.24,.02,shade(p,.7),.09,.31,.1*fat)}
    if(o.gore){g.sph(.055,BLOOD,-.05*fat,.3,.1*fat,1.2,1.1,.3,6,4);if(o.gore>1)g.sph(.045,BLOOD,.1*fat,.17,.075*fat,.5,1.3,.9,6,4);if(o.gore>2)g.sph(.06,shade(BLOOD,.7),.03,.2,-.1*fat,1.3,.9,.3,6,4)}
  });P.torso.position.y=.6;body.add(P.torso);
  // ---- head (pivot at the top of the neck)
  P.head=part(mat,g=>{const hc=o.head||skin,st=o.helmStyle,hr=o.hair;
    g.sph(.086,hc,0,.088,.004,.93,1.08,1,10,8);g.sph(.058,hc,0,.036,.026,.96,.72,1,8,5);g.sph(.014,shade(hc,.9),0,.072,.088,.9,1.2,1,5,4);
    g.sph(.011,'#161412',-.031,.094,.076,1,1,.6,5,4);g.sph(.011,'#161412',.031,.094,.076,1,1,.6,5,4);g.sph(.017,shade(hc,.95),-.08,.082,.002,.5,1,.8,5,4);g.sph(.017,shade(hc,.95),.08,.082,.002,.5,1,.8,5,4);
    if(o.husk){g.sph(.03,'#2a100e',0,.034,.07,1.1,.55,.5,6,4);if(o.gore)g.sph(.035,BLOOD,.045,.1,.06,1,1.2,.5,6,4)}else g.sph(.02,shade(hc,.78),0,.04,.078,1.2,.25,.4,5,3);
    if(o.helm){const c=o.helm;
      if(st==='hood'){g.sph(.104,c,0,.094,-.012,1,1.1,1.06,10,7);g.sph(.09,shade(c,.85),0,.0,-.035,1.25,.5,.95,8,4)}
      else if(st==='cap'){g.sph(.092,c,0,.118,-.002,1,.72,1.03,10,5);g.box(.13,.012,.08,shade(c,.8),0,.108,.115,-.15)}
      else if(st==='visor'){g.sph(.101,c,0,.1,-.004,1,1.02,1.06,10,7);g.sph(.07,'#8fc4dc',0,.085,.052,1.08,.62,.8,8,5);g.sph(.105,shade(c,.75),0,.045,-.01,1.02,.25,1.04,10,4)}
      else if(st==='mask'){g.sph(.098,c,0,.088,.002,1,1.12,1.05,10,7);g.sph(.022,'#20282a',-.034,.096,.084,1,1,.5,6,4);g.sph(.022,'#20282a',.034,.096,.084,1,1,.5,6,4);g.cyl(.03,.034,.055,'#34383a',0,.035,.105,8,Math.PI/2)}
      else{g.sph(.1,c,0,.11,-.004,1,.86,1.06,10,6);g.sph(.106,shade(c,.78),0,.088,-.004,1.02,.2,1.07,10,4)}}
    else if(hr){if(o.hairStyle===2){g.sph(.091,hr,0,.108,-.016,1,.98,1.02,10,7);g.sph(.08,hr,0,.02,-.05,1.12,1.35,.7,8,6)}else if(o.hairStyle===1){g.sph(.092,hr,0,.112,-.014,1,.98,1.03,10,7);g.sph(.07,hr,0,.062,-.052,1.1,.9,.75,8,5)}else g.sph(.089,hr,0,.118,-.016,.98,.86,1.02,10,6)}
    if(o.mask&&!o.helm)g.sph(.066,o.mask,0,.04,.032,1,.72,1.02,8,5);
  });P.head.position.y=1.075;body.add(P.head);
  // ---- arms: upper arm from the shoulder, forearm and hand from the elbow
  const arm=side=>{const up=part(mat,g=>{g.limb(.047,.04,.215,sleeve,0,0,0,0,0,0,7);if(o.gore>1&&side<0)g.sph(.04,BLOOD,0,-.12,.02,1.1,1.4,.8,6,4)});up.position.set(side*(.168*fat+.012),.955,0);body.add(up);
    const el=grp(up,0,-.215,0),fore=part(mat,g=>{g.limb(.039,.031,.2,jacket||(o.sleeves?sleeve:skin),0,0,0,0,0,0,7);g.sph(.034,o.husk?shade(skin,.85):skin,0,-.225,.006,.82,1.15,1,7,5)});el.add(fore);return[up,el]};
  [P.armL,P.elbowL]=arm(-1);[P.armR,P.elbowR]=arm(1);
  // ---- legs: thigh from the hip, shin and boot from the knee
  const leg=side=>{const th=part(mat,g=>g.limb(.066*Math.min(1.25,fat),.05,.3,legs,0,0,0,0,0,0,7));th.position.set(side*.076,.6,0);body.add(th);
    const kn=grp(th,0,-.3,0),sh=part(mat,g=>{g.limb(.05,.038,.25,legs,0,0,0,0,0,0,7);g.limb(.046,.044,.09,boots,0,-.17,0,0,0,0,7);g.sph(.05,boots,0,-.275,.034,.92,.7,1.75,8,5);g.box(.085,.02,.17,shade(boots,.6),0,-.3,.03)});kn.add(sh);return[th,kn]};
  [P.legL,P.kneeL]=leg(-1);[P.legR,P.kneeR]=leg(1);
  const hand=grp(P.elbowR,0,-.228,.012);hand.rotation.x=Math.PI/2;
  const rig={root,body,P,hand,mat,type:'human',ph:Math.random()*6,scale:o.scale||1,weapon:null,lean:o.lean||0,husk:!!o.husk,h:1.22*(o.scale||1),death:0};
  root.scale.setScalar(rig.scale);if(o.weapon)setWeapon(rig,o.weapon);
  return rig;
}
export function setWeapon(rig,mdl){
  if(!rig.hand)return;if(rig.weaponMesh){rig.hand.remove(rig.weaponMesh);rig.weaponMesh=null}rig.weapon=mdl||null;if(!mdl)return;const g=handGeo(mdl);if(!g)return;
  const m=new THREE.Mesh(g,rig.mat);m.castShadow=true;rig.hand.add(m);rig.weaponMesh=m;
}
/** Four-legged animals with rounded bodies and two-part legs. o = {c, scale, slim, stout, tail, ears, antler, tusk, spikes} */
export function quadruped(o){
  const mat=newMat(),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const c=o.c,w=o.stout?.21:o.slim?.13:.16,len=o.stout?.8:.74,ht=o.slim?.5:.43,dk=shade(c,.78),lt=shade(c,1.18),P={};
  P.torso=part(mat,g=>{g.sph(1,c,0,0,0,w,o.stout?.2:.165,len*.5,10,7);g.sph(1,c,0,.02,len*.26,w*1.02,o.stout?.21:.17,len*.24,9,6);g.sph(1,dk,0,.07,-.02,w*.7,.12,len*.44,8,5);g.sph(1,lt,0,-.07,.04,w*.72,.09,len*.36,8,4);
    if(o.spikes)for(let i=0;i<5;i++)g.cone(.035,.15,o.spikes,0,.2,-.26+i*.13,5,-.2);
    if(o.tail)g.limb(.034,.012,.34,dk,0,.06,-len*.47,2.05,0,0,6);else g.sph(.05,lt,0,.06,-len*.5,1,1,1,6,4)});
  P.torso.position.y=ht;body.add(P.torso);
  P.head=part(mat,g=>{g.limb(.085,.07,.16,c,0,-.02,-.02,-2.2,0,0,7);g.sph(.095,c,0,.1,.13,w/.16*.95,.95,1.15,9,6);g.sph(.058,dk,0,.065,.25,w/.16*.9,.8,1.25,8,5);g.sph(.022,'#141210',0,.075,.32,1.2,.8,.8,5,4);
    g.sph(.014,'#141210',-.06*w/.16,.13,.19,1,1,.6,5,4);g.sph(.014,'#141210',.06*w/.16,.13,.19,1,1,.6,5,4);
    if(o.ears){g.limb(.022,.012,.2,dk,-.05,.17,.08,Math.PI-.15,0,.12,5);g.limb(.022,.012,.2,dk,.05,.17,.08,Math.PI-.15,0,-.12,5)}else{g.cone(.032,.08,dk,-.065*w/.16,.2,.09,4,-.2,0,.25);g.cone(.032,.08,dk,.065*w/.16,.2,.09,4,-.2,0,-.25)}
    if(o.antler)for(const s of[-1,1]){g.limb(.014,.009,.24,'#d8c8a8',s*.05,.17,.08,Math.PI-.2,0,s*-.5,5);g.limb(.01,.006,.13,'#d8c8a8',s*.14,.36,.05,Math.PI-.6,0,s*.3,5);g.limb(.01,.006,.12,'#d8c8a8',s*.1,.28,.07,Math.PI+.9,0,s*-.2,5)}
    if(o.tusk)for(const s of[-1,1])g.cone(.018,.11,'#e8e0c8',s*.045,.05,.3,5,.9,0,s*-.3)});
  P.head.position.set(0,ht+.1,len*.4);body.add(P.head);
  const leg=(sx,sz,key)=>{const L=ht-.06,u=part(mat,g=>g.limb(sz>0?.05:.058,.034,L*.52,c,0,0,0,0,0,0,6));u.position.set(sx*(w-.03),ht-.05,sz*(len*.5-.13));body.add(u);
    const k=grp(u,0,-L*.52,0);k.add(part(mat,g=>{g.limb(.032,.024,L*.44,dk,0,0,0,0,0,0,6);g.sph(.034,shade(c,.5),0,-L*.46,.012,1,.6,1.3,6,4)}));P[key]=u;P['k'+key]=k};
  leg(-1,1,'legFL');leg(1,1,'legFR');leg(-1,-1,'legBL');leg(1,-1,'legBR');
  const rig={root,body,P,mat,type:'quad',ph:Math.random()*6,scale:o.scale||1,h:(ht+.42)*(o.scale||1),death:0};root.scale.setScalar(rig.scale);return rig;
}
/** The Bloom Core: a rooted pulsing mass. */
export function blob(o){
  const mat=newMat(),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const core=part(mat,g=>{g.ico(.5,o.c,0,.5,0,1,1.1,1,0,2);g.ico(.32,o.c2,.3,.75,.15,1,1,1,0,1);g.ico(.28,o.c2,-.32,.6,-.1,1,1,1,1,1);g.ico(.24,shade(o.c2,1.2),.05,1.0,-.2,1,1,1,2,1);g.ico(.2,o.c2,-.1,.4,.42,1,1,1,0,1);
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2;g.cone(.1,.8,shade(o.c,.7),Math.cos(a)*.58,.2,Math.sin(a)*.58,7,Math.sin(a)*1.15,0,-Math.cos(a)*1.15)}});
  body.add(core);const rig={root,body,P:{torso:core},mat,type:'blob',ph:0,scale:o.scale||1,h:1.3*(o.scale||1),death:0};root.scale.setScalar(rig.scale);return rig;
}
/** Build the rig for a creature definition's `rig` field, or for a survivor (seeded by id). */
export function rigFor(def,seed=0){
  const[type,o]=def.rig;if(type==='quad')return quadruped(o);if(type==='blob')return blob(o);
  const h=n=>(((seed*2654435761)>>>0)>>>n)%1000/1000;
  if(type==='human'&&def.ai==='follow')return humanoid({skin:SKIN[Math.floor(h(3)*SKIN.length)],top:TOPS[Math.floor(h(7)*TOPS.length)],legs:['#3a3f4a','#4a4032','#2e3a2e','#4a4a5a'][Math.floor(h(11)*4)],hair:HAIR[Math.floor(h(15)*HAIR.length)],hairStyle:Math.floor(h(5)*3),fat:.94+h(9)*.16});
  let oo=o;
  if(o.vary){const ZT=['#5a4a3a','#4a5a6a','#6a3a3a','#3a4a3a','#7a7a6a','#2e3a44','#6a5a7a','#8a6a3a','#4a4a4a'],ZL=['#3a3f4a','#4a4032','#2e2e36','#4a4a5a','#3a3028'];
    oo={...o,top:h(3)<.75?ZT[Math.floor(h(7)*ZT.length)]:o.top,legs:ZL[Math.floor(h(11)*ZL.length)],scale:(o.scale||1)*(.93+h(5)*.14),fat:(o.fat||1)*(.9+h(13)*.26),hair:h(9)<.55?HAIR[Math.floor(h(15)*HAIR.length)]:null,hairStyle:Math.floor(h(17)*3),gore:1+Math.floor(h(19)*3),lean:(o.lean||0)+h(21)*.14}}
  else if(type==='husk'||type==='crawler')oo={...o,gore:o.helm?1:2};
  const r=humanoid({...oo,husk:type==='husk'||type==='crawler',vestStyle:oo.vest?'plate':null,helmStyle:oo.helm?'helm':null,hair:type==='human'?'#2a2018':oo.hair,hairStyle:type==='human'?0:oo.hairStyle});
  if(type==='crawler'){r.type='crawler';r.h=.5}return r;
}
/** The player's rig, dressed from what is equipped. */
export function playerRig(eq){
  const look=s=>eq[s]&&ITEMS[eq[s].id]?ITEMS[eq[s].id].look||{}:null,head=look('head'),bodyL=look('body'),legs=look('legs'),feet=look('feet'),pack=look('pack');
  return humanoid({skin:'#c9a07c',top:'#7a6a52',legs:legs?legs.c:'#3f4652',boots:feet?feet.c:'#2a2622',hair:'#3a2a1c',hairStyle:1,helm:head?head.c:null,helmStyle:head?head.s||'helm':null,vest:bodyL?bodyL.c:null,vestStyle:bodyL?bodyL.s||'vest':null,pack:pack?pack.c:null});
}

const lerpA=(a,b,t)=>a+(b-a)*Math.min(1,t);
/** Pose a rig for this frame. s = {mv speed, dt, t time, atk 0..1 swing progress or -1, wind 0..1 enemy wind-up, gun, sneak, roll 0..1, dead, deadT, act, flash, vis, charge, stun, recoil, throwing} */
export function pose(rig,s){
  const P=rig.P,dt=s.dt,k=Math.min(1,dt*14);
  if(rig.type==='blob'){const p=1+Math.sin(s.t*2.2)*.05+(s.wind>0?s.wind*.18:0);rig.body.scale.set(p,2-p,p);rig.body.rotation.y+=dt*.2;fade(rig,s);return}
  const moving=s.mv>.25,speed=Math.min(1.4,s.mv/3.2);if(moving)rig.ph+=dt*(4+s.mv*1.9);
  const amp=Math.min(1,speed+.3),sw=moving?Math.sin(rig.ph)*.7*amp:0,cw=moving?Math.cos(rig.ph)*amp:0;
  if(s.dead){rig.death=Math.min(1,rig.death+dt*3.2);
    if(rig.type==='quad'){rig.body.rotation.z=rig.death*Math.PI/2;rig.body.position.y=rig.death*.14}
    else{rig.body.rotation.x=lerpA(rig.body.rotation.x,-Math.PI/2,rig.death);rig.body.position.y=rig.death*.1;P.armL.rotation.z=-rig.death*.9;P.armR.rotation.z=rig.death*.7;P.legL.rotation.z=-rig.death*.18;P.legR.rotation.z=rig.death*.22;P.kneeR.rotation.x=rig.death*.5}
    fade(rig,s);return}
  if(rig.type==='quad'){
    for(const[a,b,sg]of[['legFL','legBR',1],['legFR','legBL',-1]]){P[a].rotation.x=sw*sg;P[b].rotation.x=sw*sg;P['k'+a].rotation.x=-Math.max(0,cw*sg)*.9;P['k'+b].rotation.x=Math.max(0,-cw*sg)*.9}
    rig.body.position.y=moving?Math.abs(Math.sin(rig.ph))*.035:Math.sin(s.t*1.6+rig.ph)*.006;P.head.rotation.x=lerpA(P.head.rotation.x,s.wind>0?-.45:moving?.06:Math.sin(s.t*1.1+rig.ph)*.14,k);P.head.rotation.y=moving?0:Math.sin(s.t*.5+rig.ph)*.25;
    rig.body.rotation.x=lerpA(rig.body.rotation.x,s.wind>0?-.22:s.charge?.12:0,k);fade(rig,s);return}
  // ---- humanoids: hips, knees, shoulders, elbows
  const crawl=rig.type==='crawler';
  let tL=sw,tR=-sw,kL=moving?Math.max(0,cw)*1.05*amp+.08:.04,kR=moving?Math.max(0,-cw)*1.05*amp+.08:.04;
  let aL=-sw*.75,aR=sw*.75,eL=-.22-Math.max(0,-sw)*.5,eR=-.22-Math.max(0,sw)*.5,zL=-.06,zR=.06,lean=rig.lean+(moving?.1*speed:0),bodyY=moving?Math.abs(Math.sin(rig.ph))*.03:0,twist=0;
  if(rig.husk&&!crawl){aL=-1.15+Math.sin(s.t*2+rig.ph)*.12;aR=-1.3+Math.cos(s.t*1.7+rig.ph)*.12;eL=-.35;eR=-.2;lean+=.16;P.head.rotation.z=Math.sin(s.t*1.1+rig.ph)*.16;P.head.rotation.x=.18;tL*=.7;tR*=.7}
  if(crawl){lean=1.32;bodyY=-.5;aL=-2.7+sw*.6;aR=-2.7-sw*.6;eL=-.5-Math.max(0,sw)*.6;eR=-.5-Math.max(0,-sw)*.6;tL=.25+sw*.2;tR=.25-sw*.2;kL=.3;kR=.5;P.head.rotation.x=-.9}
  if(s.gun){aR=-1.42+(s.recoil>0?-.18:0);eR=-.12;zR=-.1;if(s.gun===2){aL=-1.15;eL=-.75;zL=.55}lean+=.06;twist=s.gun===2?-.3:0}
  if(s.wind>0){const f=1-s.wind;aR=-2.75+f*.4;eR=-.7;if(rig.husk){aL=-2.6+f*.4;eL=-.6}lean-=.16}
  if(s.atk>=0){const f=s.atk,q=f<.35?0:Math.min(1,(f-.35)/.28);aR=-2.7+q*3.5;eR=-1.0+q*.85;zR=.25-q*.5;twist=-.55+q*1.2;lean+=.14;aL=.3;eL=-.6}
  if(s.act){const f=(s.act*2)%1,q=f<.5?0:Math.min(1,(f-.5)/.22);aR=-2.5+q*2.9;eR=-.9+q*.7;lean+=.12+q*.1;aL=-.5;eL=-.8}
  if(s.throwing>0){aR=-2.9+s.throwing*8;eR=-.5}
  if(s.sneak){lean+=.38;bodyY-=.13;tL-=.55;tR-=.55;kL+=1.0;kR+=1.0}
  if(s.stun){P.head.rotation.z=Math.sin(s.t*14)*.25;lean+=.22}
  if(s.roll>0){rig.body.rotation.x=s.roll*Math.PI*2;rig.body.position.y=.3;P.legL.rotation.x=P.legR.rotation.x=-1.3;P.kneeL.rotation.x=P.kneeR.rotation.x=1.9;P.armL.rotation.x=P.armR.rotation.x=-1;fade(rig,s);return}
  if(!moving&&!crawl){const br=Math.sin(s.t*1.8+rig.ph);bodyY+=br*.006;P.torso.scale.z=1+br*.025;if(!rig.husk)P.head.rotation.y=lerpA(P.head.rotation.y,Math.sin(s.t*.6+rig.ph)*.22,k)}else{P.torso.scale.z=1;if(!rig.husk)P.head.rotation.y=lerpA(P.head.rotation.y,0,k)}
  const fast=s.atk>=0||s.act?1:k*1.6;
  P.legL.rotation.x=lerpA(P.legL.rotation.x,tL,k*2);P.legR.rotation.x=lerpA(P.legR.rotation.x,tR,k*2);P.kneeL.rotation.x=lerpA(P.kneeL.rotation.x,kL,k*2);P.kneeR.rotation.x=lerpA(P.kneeR.rotation.x,kR,k*2);
  P.armL.rotation.x=lerpA(P.armL.rotation.x,aL,k*1.6);P.armR.rotation.x=lerpA(P.armR.rotation.x,aR,fast);P.elbowL.rotation.x=lerpA(P.elbowL.rotation.x,eL,k*1.6);P.elbowR.rotation.x=lerpA(P.elbowR.rotation.x,eR,fast);
  P.armL.rotation.z=lerpA(P.armL.rotation.z,zL,k);P.armR.rotation.z=lerpA(P.armR.rotation.z,zR,k);
  P.torso.rotation.y=lerpA(P.torso.rotation.y,moving?sw*.12:0,k);
  rig.body.rotation.x=lerpA(rig.body.rotation.x,lean,k);rig.body.rotation.y=lerpA(rig.body.rotation.y,twist,k*2);rig.body.position.y=lerpA(rig.body.position.y,bodyY,k*2);
  fade(rig,s);
}
function fade(rig,s){
  const m=rig.mat,fl=s.flash>0?1:0;if(m._fl!==fl){m._fl=fl;m.emissive.setRGB(fl*.55,fl*.5,fl*.45)}
  let op=s.vis===undefined?1:s.vis;if(s.dead&&s.deadT>8.6)op*=Math.max(0,1-(s.deadT-8.6)/1.3);
  const tr=op<.99;if(m.transparent!==tr){m.transparent=tr;m.needsUpdate=true}m.opacity=op;
}
export function disposeRig(rig){const keep=new Set(handCache.values());rig.mat.dispose();rig.root.traverse(o=>{if(o.isMesh&&!keep.has(o.geometry))o.geometry.dispose()})}

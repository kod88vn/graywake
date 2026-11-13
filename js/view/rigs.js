// Character rigs: jointed bodies built from rounded anatomy (not boxes), and the code that poses them every frame.
// A humanoid is about 1.26 units tall and about seven heads: a skinned body with real shoulders, waist, hips and calves, a real skull shape and natural hair,
// two-part limbs with elbows and knees. Smoothly lit, matte, with a fine cloth and skin grain.
// A rig is a THREE.Group: root → body (leans, crouches, falls) → hips (pelvis, legs) → chest (ribcage, head, arms). Each rig owns its material so it can flash and fade.
import {THREE,Geo,shade,mix,matte} from './geo.js';
import {HAND} from './props.js';
import {ITEMS} from '../data/items.js';

const handCache=new Map();
function handGeo(mdl){let g=handCache.get(mdl);if(!g&&HAND[mdl]){const b=new Geo();HAND[mdl](b);g=b.build();handCache.set(mdl,g)}return g}
const newMat=()=>matte({local:true,amp:.16,scale:7,rim:.22});
const part=(mat,draw)=>{const g=new Geo();g.jit=.02;g.lift=false;draw(g);const m=new THREE.Mesh(g.build(),mat);m.castShadow=true;return m};
const grp=(parent,x,y,z)=>{const o=new THREE.Group();o.position.set(x,y,z);parent.add(o);return o};
const HAIR=['#1c1612','#2e2218','#4a3320','#6b4a2a','#8a6a3a','#b89858','#7a3a1c','#8a8680','#c8c4bc'],HAIR_DULL=['#1c1814','#3a2c22','#5a4a3a','#7a746a','#2a2420','#4a3024'],EYES=['#4a3828','#5a4630','#3a4a5a','#4a5a3a','#2e2620','#5a6a78'];
const SKIN=['#e0b896','#c99a78','#a87a5a','#8a6044','#f0d0b4','#6e4a34'],TOPS=['#6a7a5a','#7a5a4a','#4a5a6a','#8a7a4a','#5a4a5a','#3a5a4a','#8a4a3a','#9a9486'],SCARF=['#8a3a30','#8a7a3a','#3a5a7a','#4a6a4a','#b0aa9c'];
const BLOOD='#561210';

// ---- head: a real skull shape (chin, jaw, cheekbones, brow, crown) with small eyes, a nose, lips and ears, and hair that sits on it.
// Realistic proportions throughout: about seven heads tall. The user rejected anime faces, big heads and stacked-ball bodies.
const HEAD=.9;
const SKULL=[[-.004,.022,.026,0,.03],[.012,.042,.044,0,.022],[.04,.058,.062,0,.012],[.075,.067,.076,0,.004],[.11,.07,.084,0,0],[.145,.068,.083,0,-.002],[.175,.055,.07,0,-.004],[.196,.03,.04,0,-.006]];
/** The skull's rings from height `from` up, grown by `k` and shifted back by `back`: a shell that sits on the head (hair, helmets, hoods). */
// It sits furthest back at its lower edge, so the brow and face stay clear, and comes forward over the crown.
const shell=(from,k,back=0)=>{const bk=y=>Math.max(.003,back-(y-from)*(back-.003)/.05);return[...SKULL.filter(r=>r[0]>=from).map(r=>[r[0],r[1]+k,r[2]+k,0,r[4]-bk(r[0])]),[.2+k*.8,.012,.016,0,-.009]]};
function drawHair(g,hr,style,short){
  const dk=shade(hr,.82);
  if(style===3||short){g.loft(shell(.118,.004,.02),dk,12);g.loft([[.05,.05,.04,0,-.046],[.085,.064,.05,0,-.04],[.118,.071,.06,0,-.03]],dk,10,'none');return}   // cropped close
  g.loft(shell(.118,.012,.024),hr,12);                                                                           // the top and crown
  if(style===0){g.loft([[.045,.052,.042,0,-.05],[.085,.068,.052,0,-.044],[.12,.078,.066,0,-.032]],dk,10,'none');g.sph(.03,hr,.03,.186,.04,1.3,.5,1,7,5);g.sph(.03,dk,-.028,.182,.046,1.2,.5,1,7,5)}   // short, a little untidy on top
  else if(style===1){g.loft([[-.03,.05,.034,0,-.056],[.02,.07,.046,0,-.05],[.08,.082,.06,0,-.04],[.12,.08,.07,0,-.03]],dk,12,'none');for(const s of[-1,1])g.sph(.03,hr,s*.068,.07,-.002,.5,1.6,1,6,6)}   // collar length
  else if(style===2){g.loft([[.05,.052,.042,0,-.05],[.085,.068,.052,0,-.044],[.12,.078,.066,0,-.032]],dk,10,'none');g.sph(.018,'#3a2a20',0,.14,-.1,1,1,1,6,4);g.limb(.03,.012,.2,hr,0,.14,-.106,.8,0,0,7)}   // ponytail
  else if(style===4){g.loft([[.0,.066,.05,0,-.04],[.05,.08,.066,0,-.03],[.12,.082,.078,0,-.022]],dk,12,'none');for(const s of[-1,1])g.sph(.032,hr,s*.07,.06,.006,.5,1.8,1.1,6,6)}                        // bob over the ears
  else{g.loft([[.05,.052,.042,0,-.05],[.085,.068,.052,0,-.044],[.12,.078,.066,0,-.032]],dk,10,'none');g.sph(.036,hr,0,.16,-.092,1,.9,.9,8,6)}                                                        // bun
}
function drawHead(g,o,skin){
  const hc=o.head||skin,st=o.helmStyle,hr=o.hair,face=!(o.helm&&st==='mask'),lip=mix(hc,o.husk?'#3a1a1c':'#a04a44',o.husk?.6:.4);
  g.loft(SKULL,hc,14);
  for(const s of[-1,1])g.sph(.017,shade(hc,.94),s*.069,.094,.002,.34,1,.72,6,5);                                 // ears
  if(face){
    g.sph(.011,shade(hc,.97),0,.088,.086,.72,1.8,1,6,5);g.sph(.0115,hc,0,.07,.093,1.05,.8,1,6,5);               // nose: bridge and tip
    for(const s of[-1,1]){g.sph(.015,shade(hc,o.husk?.5:.8),s*.028,.104,.071,1.25,.72,.5,6,4);                   // socket
      g.sph(.0078,o.husk?'#cfcab4':'#ebe7de',s*.028,.103,.0775,1.25,.8,.6,6,4);g.sph(.0046,o.husk?'#8a8870':o.eye||'#4a3828',s*.028,.103,.0822,1,1,.5,5,4);
      if(!o.husk)g.box(.027,.0045,.008,hr?shade(hr,.7):shade(hc,.6),s*.028,.118,.0785,0,0,-s*.07)}
    if(o.husk){g.sph(.026,'#24100f',0,.036,.066,1.1,.6,.5,7,4);if(o.gore)g.sph(.03,BLOOD,.04,.075,.058,1,1.3,.5,6,4)}
    else{g.sph(.014,lip,0,.043,.0775,1.45,.34,.5,6,4);if(o.beard){g.loft([[.0,.03,.03,0,.03],[.03,.061,.065,0,.012],[.062,.068,.074,0,.006]],shade(o.beard,.9),12,'start');g.sph(.014,lip,0,.045,.083,1.3,.3,.4,6,4)}}
  }
  if(o.helm){const c=o.helm;
    if(st==='hood'){g.loft([[-.02,.066,.05,0,-.03],[.05,.08,.068,0,-.022],...shell(.11,.016,.012)],c,12);g.loft([[-.03,.085,.06,0,-.02],[.0,.07,.052,0,-.026]],shade(c,.85),10,'none')}
    else if(st==='cap'){g.loft(shell(.128,.012,.004),c,12);g.sph(.05,shade(c,.8),0,.133,.092,1.1,.12,.8,8,4);if(hr)g.loft([[.045,.052,.042,0,-.05],[.085,.068,.052,0,-.044],[.128,.076,.064,0,-.03]],shade(hr,.82),10,'none')}
    else if(st==='visor'){g.loft(shell(.1,.016,.004),c,12);g.sph(.06,'#27343c',0,.092,.047,1.1,.72,.74,9,6);g.loft([[.02,.07,.07,0,.006],[.05,.078,.084,0,.002]],shade(c,.75),12,'none')}
    else if(st==='mask'){g.loft(SKULL.map(r=>[r[0],r[1]+.012,r[2]+.012,0,r[4]]),c,14);for(const s of[-1,1]){g.sph(.02,'#1c2a30',s*.03,.104,.086,1,1,.5,7,5);g.sph(.009,'#8fc8d8',s*.034,.11,.095,1,1,.4,5,4)}g.cyl(.026,.03,.05,'#34383a',0,.045,.1,8,Math.PI/2)}
    else{g.loft(shell(.108,.014,.004),c,12);g.loft([[.1,.088,.1,0,-.004],[.112,.084,.097,0,-.004]],shade(c,.78),12,'none')}}
  else if(hr)drawHair(g,hr,o.hairStyle||0,false);
  if(o.mask&&!o.helm)g.loft([[.0,.027,.031,0,.03],[.03,.063,.067,0,.012],[.082,.071,.081,0,.004]],o.mask,12,'start');
}

/** Humanoid: o = {skin, top, legs, boots, hair, hairStyle 0..5, eye, head (colour override), helm, helmStyle, vest, vestStyle, sleeves, pack, scarf, glove, build 'm'|'f', fat, scale, mask, weapon, husk, glow, gore, lean}
 *  The body is skinned, not stacked: torso, pelvis, arms and legs are lofted through anatomical cross-sections (shoulders, ribcage, waist, hips, calf, wrist). */
export function humanoid(o){
  const mat=newMat(),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const fat=o.fat||1,skin=o.skin||'#e8bf9c',top=o.top||'#6a7a5a',legs=o.legs||'#3a3f4a',boots=o.boots||shade(legs,.55),jacket=o.vestStyle==='jacket'&&o.vest,sleeve=jacket||o.sleeves||top,P={};
  const fem=o.build==='f',sh=(fem?.89:1)*fat,wa=(fem?.84:1)*fat,hp=(fem?1.06:1)*fat,dz=fat,lf=Math.min(1.22,fat),skinD=o.husk?shade(skin,.85):skin;
  // torso cross-sections, hips to neck: [height above the hips, half width, half depth, , forward shift]
  const TORSO=[[.055,.092*wa,.064*dz],[.13,.09*wa,.063*dz,0,.002],[.2,.104*(wa+sh)/2,.073*dz,0,.004],[.29,.124*sh,(fem?.094:.084)*dz,0,fem?.016:.006],[.355,.132*sh,(fem?.084:.08)*dz,0,fem?.006:.002],[.4,.124*sh,.066*dz,0,-.004],[.428,.074*sh,.05*dz,0,-.004],[.45,.04,.04,0,0]];
  const over=(k,from,to,dn=0)=>TORSO.filter(r=>r[0]>=from&&r[0]<=to).map((r,i)=>[i?r[0]:r[0]-dn,r[1]*k+.004,r[2]*k+.006,0,r[4]||0]);
  // skeleton: body → hips (pelvis, legs) → chest at the waist (ribcage, head, arms), so the two halves can twist against each other
  P.hips=grp(body,0,.6,0);P.pelvis=part(mat,g=>{
    g.loft([[-.088,.046*hp,.05*dz],[-.05,.092*hp,.071*dz],[0,.106*hp,.081*dz,0,-.004],[.05,.1*(hp+wa)/2,.073*dz],[.098,.094*wa,.066*dz]],legs,12);
    g.loft([[.066,.099*(hp+wa)/2+.004,.074*dz+.004],[.1,.095*wa+.004,.068*dz+.004]],shade(legs,.55),12,'none');g.box(.03,.026,.012,'#b8a060',0,.083,.072*dz+.006);
    if(jacket)g.loft([[-.03,.116*hp,.09*dz],[.05,.108*(hp+wa)/2,.082*dz],[.1,.102*wa,.076*dz]],jacket,12,'none');
  });P.hips.add(P.pelvis);P.chest=grp(P.hips,0,.1,0);
  P.torso=part(mat,g=>{
    g.loft(TORSO,top,16);g.loft([[.43,.037,.037,0,.002],[.505,.033,.035,0,.008]],o.head||skin,10,'none');
    for(const s of[-1,1])g.sph(.04,sleeve,s*.128*sh,.374,0,1.1,.8,1.1,8,6);
    if(!o.husk&&!o.vest)g.loft([[.418,.066*sh,.052,0,.002],[.455,.05,.047,0,.004]],shade(top,1.22),10,'none');
    if(o.husk&&o.gore>2)g.sph(.06,skin,.05*fat,.11,.06*fat,1,.6,.5,7,4);
    if(o.vest){const v=o.vest,s=o.vestStyle;
      if(s==='plate'){g.loft(over(1.07,.12,.41),v,14);for(const d of[-1,1])g.sph(.066,shade(v,1.18),d*.158*sh,.392,0,1.08,.5,1.15,8,4);for(let i=0;i<3;i++)g.box(.064,.05,.028,shade(v,.7),-.074+i*.074,.16,.074*dz+.012);g.box(.12,.07,.016,shade(v,.86),0,.3,.092*dz+.01)}
      else if(s==='jacket'){g.loft(over(1.07,.055,.43,.02),v,14);g.box(.014,.3,.012,shade(v,.6),0,.24,.086*dz+.012);g.loft([[.415,.074*sh,.058,0,.002],[.468,.056,.052,0,.002]],shade(v,1.2),10,'none')}
      else{g.loft(over(1.06,.12,.4),v,14);for(const d of[-1,1])g.box(.046,.056,.024,shade(v,.75),d*.062,.2,.07*dz+.014)}}
    if(o.pack){const p=o.pack;g.sph(.125,p,0,.26,-.165*fat,.98,1.3,.72,9,6);g.sph(.07,shade(p,1.2),0,.19,-.255*fat,1.05,.85,.6,7,4);g.sph(.1,shade(p,.8),0,.4,-.15*fat,1,.35,.7,8,4);for(const d of[-1,1])g.box(.026,.24,.016,shade(p,.7),d*.086*sh,.31,.084*dz+.004)}
    if(o.scarf){g.torus(.056,.028,o.scarf,0,.44,.002,0,0,0,10);g.sph(.03,shade(o.scarf,.85),.03,.43,-.062,1,1,1,6,4)}
    if(o.gore){g.sph(.055,BLOOD,-.05*fat,.3,.082*fat,1.2,1.1,.3,6,4);if(o.gore>1)g.sph(.045,BLOOD,.094*fat,.17,.05*fat,.5,1.3,.9,6,4);if(o.gore>2)g.sph(.06,shade(BLOOD,.7),.03,.2,-.07*fat,1.3,.9,.3,6,4)}
  });P.torso.position.y=-.1;P.chest.add(P.torso);
  // ---- scarf tails: two strips that trail behind when running
  if(o.scarf){P.scarf=part(mat,g=>{g.sph(.03,o.scarf,-.022,-.13,0,.95,4.4,.36,7,6);g.sph(.027,shade(o.scarf,.82),.03,-.1,-.008,.95,3.7,.36,7,6)});P.scarf.position.set(.03,.34,-.075);P.scarf.rotation.x=.25;P.chest.add(P.scarf)}
  // ---- head (pivot at the top of the neck)
  P.head=part(mat,g=>drawHead(g,o,skin));P.head.position.y=.385;P.head.scale.setScalar(HEAD);P.chest.add(P.head);
  // ---- arms: upper arm from the shoulder, forearm, wrist and hand from the elbow
  const arm=side=>{const up=part(mat,g=>{g.loft([[.04,.022*lf,.024*lf],[.024,.042*lf,.044*lf],[-.01,.05*lf,.052*lf],[-.07,.046*lf,.048*lf,0,.002],[-.145,.039*lf,.04*lf],[-.215,.035,.036]],sleeve,10,'start');if(o.gore>1&&side<0)g.sph(.04,BLOOD,0,-.12,.02,1.1,1.4,.8,6,4)});up.position.set(side*(.134*sh+.034),.262,0);P.chest.add(up);
    const fc=jacket||(o.sleeves?sleeve:skinD),hc=o.husk?skinD:o.glove||skin,el=grp(up,0,-.215,0),fore=part(mat,g=>{
      g.loft([[.014,.027,.028],[-.008,.037,.038],[-.05,.039,.039,0,.002],[-.12,.032,.032],[-.19,.026,.025],[-.204,.025,.024]],fc,10);
      if(!o.husk)g.loft([[-.148,.032,.031],[-.198,.029,.028]],shade(o.glove||sleeve,.72),10,'none');
      g.sph(.031,hc,0,-.226,.004,.6,1.05,.95,8,6);g.sph(.027,hc,0,-.258,.01,.55,.92,.8,7,5);g.sph(.012,hc,-side*.004,-.232,.03,1,1.5,1,6,4)});el.add(fore);return[up,el]};
  [P.armL,P.elbowL]=arm(-1);[P.armR,P.elbowR]=arm(1);
  // ---- legs: thigh from the hip, shin with a calf, boot from the knee
  const leg=side=>{const th=part(mat,g=>g.loft([[.03,.05*lf,.052*lf],[0,.067*lf*(fem?1.04:1),.07*lf],[-.08,.065*lf,.068*lf,0,.004],[-.19,.054*lf,.056*lf,0,.002],[-.28,.047,.048],[-.3,.046,.047]],legs,10,'start'));th.position.set(side*.072*(fem?1.04:1),0,0);P.hips.add(th);
    const kn=grp(th,0,-.3,0),sh2=part(mat,g=>{
      g.loft([[.014,.036,.038],[-.008,.046,.047],[-.07,.046,.05,0,-.009],[-.13,.04,.042,0,-.006],[-.2,.031,.032],[-.25,.03,.03]],legs,10);
      g.loft([[-.128,.045,.047,0,-.005],[-.2,.037,.038],[-.264,.037,.042,0,.004]],boots,10,'none');g.loft([[-.122,.047,.049,0,-.005],[-.14,.046,.048,0,-.005]],shade(boots,1.25),10,'none');
      g.sph(.05,boots,0,-.276,.04,.84,.62,1.9,9,6);g.sph(.037,boots,0,-.278,-.012,1,.78,1,7,5);g.sph(.052,shade(boots,.55),0,-.299,.036,.88,.2,1.98,9,4)});kn.add(sh2);return[th,kn]};
  [P.legL,P.kneeL]=leg(-1);[P.legR,P.kneeR]=leg(1);
  const hand=grp(P.elbowR,0,-.228,.012);hand.rotation.x=Math.PI/2;
  const rig={root,body,P,hand,mat,type:'human',ph:Math.random()*6,sd:Math.random()*6,scale:o.scale||1,weapon:null,lean:o.lean||0,husk:!!o.husk,h:1.3*(o.scale||1),death:0};
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
    for(const sd of[-1,1]){g.sph(.024,'#17121c',sd*.066*w/.16,.13,.185,.7,1.1,1,6,5);g.sph(.008,'#ffffff',sd*.078*w/.16,.14,.196,1,1,1,5,4)}
    if(o.ears){g.limb(.022,.012,.2,dk,-.05,.17,.08,Math.PI-.15,0,.12,5);g.limb(.022,.012,.2,dk,.05,.17,.08,Math.PI-.15,0,-.12,5)}else{g.cone(.032,.08,dk,-.065*w/.16,.2,.09,4,-.2,0,.25);g.cone(.032,.08,dk,.065*w/.16,.2,.09,4,-.2,0,-.25)}
    if(o.antler)for(const s of[-1,1]){g.limb(.014,.009,.24,'#d8c8a8',s*.05,.17,.08,Math.PI-.2,0,s*-.5,5);g.limb(.01,.006,.13,'#d8c8a8',s*.14,.36,.05,Math.PI-.6,0,s*.3,5);g.limb(.01,.006,.12,'#d8c8a8',s*.1,.28,.07,Math.PI+.9,0,s*-.2,5)}
    if(o.tusk)for(const s of[-1,1])g.cone(.018,.11,'#e8e0c8',s*.045,.05,.3,5,.9,0,s*-.3)});
  P.head.position.set(0,ht+.1,len*.4);body.add(P.head);
  const leg=(sx,sz,key)=>{const L=ht-.06,u=part(mat,g=>g.limb(sz>0?.05:.058,.034,L*.52,c,0,0,0,0,0,0,6));u.position.set(sx*(w-.03),ht-.05,sz*(len*.5-.13));body.add(u);
    const k=grp(u,0,-L*.52,0);k.add(part(mat,g=>{g.limb(.032,.024,L*.44,dk,0,0,0,0,0,0,6);g.sph(.034,shade(c,.5),0,-L*.46,.012,1,.6,1.3,6,4)}));P[key]=u;P['k'+key]=k};
  leg(-1,1,'legFL');leg(1,1,'legFR');leg(-1,-1,'legBL');leg(1,-1,'legBR');
  const rig={root,body,P,mat,type:'quad',ph:Math.random()*6,sd:Math.random()*6,scale:o.scale||1,h:(ht+.42)*(o.scale||1),death:0};root.scale.setScalar(rig.scale);return rig;
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
  const pick=(a,n)=>a[Math.floor(h(n)*a.length)];
  if(type==='human'&&def.ai==='follow')return humanoid({skin:pick(SKIN,3),top:pick(TOPS,7),legs:pick(['#3a3f4a','#4a4032','#2e3a2e','#4a4a5a','#3a4658'],11),hair:pick(HAIR,15),hairStyle:h(27)<.5?[1,2,4,5,0][Math.floor(h(5)*5)]:[0,0,3,1,2][Math.floor(h(5)*5)],eye:pick(EYES,19),scarf:h(21)<.2?pick(SCARF,23):null,beard:h(27)>=.5&&h(31)<.35?pick(HAIR,15):null,fat:.94+h(9)*.14,build:h(27)<.5?'f':'m',scale:h(27)<.5?.95:1});
  let oo=o;
  if(o.vary){const ZT=['#6a5040','#4a5a7a','#7a3a3a','#3a5a3a','#8a8a70','#2e3a54','#6a5a8a','#9a6a3a','#4a4a52'],ZL=['#3a3f4a','#4a4032','#2e2e36','#4a4a5a','#3a3028'];
    oo={...o,top:h(3)<.75?pick(ZT,7):o.top,legs:pick(ZL,11),scale:(o.scale||1)*(.93+h(5)*.14),fat:(o.fat||1)*(.9+h(13)*.26),hair:h(9)<.6?pick(HAIR_DULL,15):null,hairStyle:Math.floor(h(17)*6),gore:1+Math.floor(h(19)*3),lean:(o.lean||0)+h(21)*.14,build:h(25)<.4?'f':'m'}}
  else if(type==='husk'||type==='crawler')oo={...o,gore:o.helm?1:2};
  else if(type==='human')oo={...o,hair:o.hair||pick(HAIR_DULL,15),hairStyle:Math.floor(h(17)*6),eye:'#3a2e24',beard:h(25)>=.3&&h(29)<.5?pick(HAIR_DULL,15):null,build:!o.vest&&h(25)<.3?'f':'m'};
  const husk=type==='husk'||type==='crawler',r=humanoid({...oo,husk,vestStyle:oo.vest?'plate':null,helmStyle:oo.helm?'helm':null});
  if(type==='crawler'){r.type='crawler';r.h=.5;r.body.position.z=-.6}return r;
}
/** The player's rig, dressed from what is equipped. */
export function playerRig(eq){
  const look=s=>eq[s]&&ITEMS[eq[s].id]?ITEMS[eq[s].id].look||{}:null,head=look('head'),bodyL=look('body'),legs=look('legs'),feet=look('feet'),pack=look('pack');
  return humanoid({skin:'#d8a882',top:'#5d6b4a',legs:legs?legs.c:'#3a4658',boots:feet?feet.c:'#3a2a20',hair:'#3a2a1c',hairStyle:0,eye:'#4a3828',scarf:'#6e342c',glove:'#5a4634',helm:head?head.c:null,helmStyle:head?head.s||'helm':null,vest:bodyL?bodyL.c:null,vestStyle:bodyL?bodyL.s||'vest':null,pack:pack?pack.c:null});
}

// ---------------------------------------------------------------- motion
// Poses are built in layers every frame: a gait whose cycle advances with the distance covered (so feet do not slide), an idle
// layer of breathing and weight shift, stances (sneak, aim), and actions keyed over their own progress with eased curves
// (anticipation, strike, follow-through). Layer weights and the final joint angles are damped, never snapped, and the hips
// and chest twist against each other. Nothing here lerps straight to a target at a fixed frame fraction.
const damp=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-rate*dt));
const sat=x=>x<0?0:x>1?1:x,ease=t=>{t=sat(t);return t*t*(3-2*t)},mixv=(a,b,t)=>a+(b-a)*t;
/** A keyed curve: keys [[progress, value], ...], eased between neighbours. */
const key=(f,k)=>{if(f<=k[0][0])return k[0][1];for(let i=1;i<k.length;i++)if(f<=k[i][0]){const a=k[i-1],b=k[i];return a[1]+(b[1]-a[1])*ease((f-a[0])/(b[0]-a[0]))}return k[k.length-1][1]};
const lift=x=>Math.pow(Math.max(0,x),1.3);
// melee swing: wind back, cut across, carry through, settle
const SW={yaw:[[0,0],[.26,-.8],[.44,.85],[.68,.4],[1,0]],pitch:[[0,0],[.26,-.1],[.44,.3],[.7,.16],[1,0]],arm:[[0,-.3],[.26,-2.95],[.44,-.75],[.7,-.35],[1,-.1]],armZ:[[0,.1],[.26,.7],[.44,-.55],[.7,-.25],[1,.06]],
  el:[[0,-.4],[.26,-1.55],[.44,-.12],[.7,-.5],[1,-.3]],off:[[0,0],[.26,-.55],[.44,.5],[.7,.25],[1,0]],hips:[[0,0],[.26,-.28],[.44,.32],[1,0]],lunge:[[0,0],[.26,-.25],[.44,1],[.75,.5],[1,0]]};
// tool chop: bounce off the last hit, raise, bring it down (the hit lands as the cycle wraps)
const CH={arm:[[0,-.85],[.14,-.55],[.6,-2.95],[.94,-.85],[1,-.85]],el:[[0,-.3],[.14,-.6],[.6,-1.35],[.94,-.2],[1,-.3]],pitch:[[0,.32],[.14,.2],[.6,-.12],[.94,.34],[1,.32]],yaw:[[0,.28],[.6,-.5],[.94,.3],[1,.28]],hit:[[0,1],[.2,.15],[.6,0],[.94,1],[1,1]]};
const TH={arm:[[0,-2.9],[.45,-1.1],[1,-.3]],yaw:[[0,-.55],[.45,.55],[1,0]]};

/** Pose a rig for this frame. s = {mv speed, dt, t time, atk 0..1 swing progress or -1, wind 0..1 enemy wind-up, strike enemy blow landing, gun, sneak, roll 0..1, dead, deadT, act, flash, vis, charge, stun, recoil, throwing} */
export function pose(rig,s){
  const P=rig.P,dt=Math.min(.1,Math.max(0,s.dt));
  if(rig.type==='blob'){const p=1+Math.sin(s.t*2.2)*.05+(s.wind>0?s.wind*.18:0);rig.body.scale.set(p,2-p,p);rig.body.rotation.y+=dt*.2;fade(rig,s);return}
  const v=s.mv||0;rig.vS=damp(rig.vS||0,v,9,dt);
  if(rig.type==='quad'){poseQuad(rig,s,dt,v);fade(rig,s);return}
  poseHuman(rig,s,dt,v);fade(rig,s);
}
function poseQuad(rig,s,dt,v){
  const P=rig.P,sd=rig.sd||0,w=ease(rig.vS/.9),run=ease((rig.vS-2.6)/2.4),k=1-Math.exp(-18*dt);
  if(s.dead){rig.death=Math.min(1,rig.death+dt*1.7);const d=rig.death,fall=sat((d-.1)/.7),f2=fall*fall;
    rig.body.rotation.z=(Math.PI/2)*f2+Math.sin(Math.PI*sat((d-.8)/.2))*.06;rig.body.position.y=mixv(rig.body.position.y,.14*f2,k);
    for(const key of['legFL','legFR','legBL','legBR']){P[key].rotation.x=damp(P[key].rotation.x,key[3]==='F'?-.5:.4,6,dt);P['k'+key].rotation.x=damp(P['k'+key].rotation.x,.6,6,dt)}P.head.rotation.x=damp(P.head.rotation.x,.5,6,dt);return}
  rig.ph+=dt*v/(.5+run*.55)*Math.PI;const ph=rig.ph,A=(.45+run*.35)*w;
  // trot: diagonal pairs together; at a run the hind pair trails the front by a quarter cycle, which reads as a bound
  for(const[key,sg,off]of[['legFL',1,0],['legBR',1,run*.8],['legFR',-1,0],['legBL',-1,run*.8]]){const p=ph-off,sn=Math.sin(p)*sg,cs=Math.cos(p)*sg,front=key[3]==='F';
    P[key].rotation.x=mixv(P[key].rotation.x,A*sn,k);P['k'+key].rotation.x=mixv(P['k'+key].rotation.x,(front?-1:1)*w*(.1+(.8+run*.5)*lift(-cs)),k)}
  const bob=Math.cos(2*ph),br=Math.sin(s.t*1.6+sd);
  rig.body.position.y=mixv(rig.body.position.y,w*(.018+run*.035)*bob+(1-w)*br*.006,k);
  rig.body.rotation.x=mixv(rig.body.rotation.x,(s.wind>0?-.24*ease(s.wind*1.4):s.charge?.14:0)+w*run*.07*Math.sin(2*ph+.6),k);
  rig.body.rotation.z=mixv(rig.body.rotation.z,w*.035*Math.sin(ph),k);
  P.torso.scale.x=1+(1-w)*br*.02;
  P.head.rotation.x=mixv(P.head.rotation.x,s.wind>0?-.5*ease(s.wind*1.4):w*(.05-.07*bob)+(1-w)*Math.sin(s.t*1.1+sd)*.14,k);
  P.head.rotation.y=mixv(P.head.rotation.y,(1-w)*Math.sin(s.t*.5+sd)*.28-w*.05*Math.sin(ph),k);
}
function poseHuman(rig,s,dt,v){
  const P=rig.P,crawl=rig.type==='crawler',husk=rig.husk,sd=rig.sd||0,body=rig.body;
  // how the body is moving: gait weight, how much of a run, speeding up or slowing, turning
  const w=ease(rig.vS/1.1),run=husk?0:ease((rig.vS-2.4)/2.2),acc=Math.max(-1,Math.min(1,(v-rig.vS)*.45));
  const yaw=rig.root.rotation.y;let dy=yaw-(rig._yaw===undefined?yaw:rig._yaw);rig._yaw=yaw;dy=((dy+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;rig.turn=damp(rig.turn||0,dt>0?Math.max(-6,Math.min(6,dy/dt)):0,7,dt);
  rig.wSneak=damp(rig.wSneak||0,s.sneak?1:0,9,dt);rig.wAim=damp(rig.wAim||0,s.gun?1:0,12,dt);rig.wTwo=damp(rig.wTwo||0,s.gun===2?1:0,12,dt);
  if(s.recoil>0)rig.kick=1;rig.kick=damp(rig.kick||0,0,13,dt);if(s.strike&&!rig._st)rig.blow=1;rig._st=!!s.strike;rig.blow=damp(rig.blow||0,0,7,dt);
  if(s.flash>0&&!rig._fl)rig.flinch=1;rig._fl=s.flash>0;rig.flinch=damp(rig.flinch||0,0,8,dt);
  // ---- death: knees go, then the body falls and settles
  if(s.dead){rig.death=Math.min(1,rig.death+dt*1.5);const d=rig.death,buckle=ease(d/.35),fall=sat((d-.12)/.7),f2=fall*fall,side=sd>3?1:-1,settle=Math.sin(Math.PI*sat((d-.82)/.18))*.07;
    body.rotation.x=-(Math.PI/2)*f2+settle;body.rotation.y=side*.5*f2;body.position.y=-.1*buckle*(1-f2)+.1*f2;
    P.kneeL.rotation.x=1.2*buckle*(1-f2*.75);P.kneeR.rotation.x=1.0*buckle*(1-f2*.4);P.legL.rotation.x=-.5*buckle*(1-f2);P.legR.rotation.x=-.35*buckle*(1-f2)-.15*f2;P.legL.rotation.z=-.2*f2;P.legR.rotation.z=.26*f2;
    P.armL.rotation.x=damp(P.armL.rotation.x,-.6*f2,10,dt);P.armR.rotation.x=damp(P.armR.rotation.x,-2.2*f2,10,dt);P.armL.rotation.z=-1.0*f2;P.armR.rotation.z=.6*f2;P.elbowL.rotation.x=damp(P.elbowL.rotation.x,-.5,8,dt);P.elbowR.rotation.x=damp(P.elbowR.rotation.x,-.7,8,dt);
    P.chest.rotation.x=.25*buckle*(1-f2);P.chest.rotation.y=side*.3*f2;P.head.rotation.x=.3*buckle-.5*f2;P.head.rotation.z=side*.3*f2;return}
  // ---- gait: the cycle advances with distance, half a turn a step
  rig.ph+=dt*v/((husk?.5:.62)+run*.55)*Math.PI;
  const ph=rig.ph,sn=Math.sin(ph),cs=Math.cos(ph),la=Math.sin(ph-.35),t=s.t,br=Math.sin(t*1.7+sd),idle=1-w;
  const A=(.5+run*.38)*w;
  let legL=A*sn-.1*w*run,legR=-A*sn-.1*w*run,knL=w*(.1+(.9+run*.75)*lift(-cs)),knR=w*(.1+(.9+run*.75)*lift(cs));
  let bodyY=w*(.016+run*.028)*Math.cos(2*ph)-w*run*.02+idle*br*.005,bodyX=.014*w*sn+idle*.012*Math.sin(t*.5+sd),lean=rig.lean||0;
  let hipsYaw=-(.1+run*.1)*w*sn,hipsRoll=(.045+run*.03)*w*cs+idle*.035*Math.sin(t*.5+sd)+Math.max(-.12,Math.min(.12,rig.turn*.022))*w;
  let chestYaw=(.2+run*.2)*w*sn,chestRoll=-.05*w*cs-idle*.02*Math.sin(t*.5+sd),chestPitch=w*(.04+run*.2)+acc*.13+idle*br*.018;
  let headYaw=0,headPitch=0,headRoll=0;
  const armA=(.36+run*.5)*w;
  let armL=-armA*la+idle*.03*Math.sin(t*.9+sd),armR=armA*la-idle*.03*Math.sin(t*.9+sd+1),zL=-(.07+run*.07),zR=.07+run*.07;
  let elL=-(.2+run*w*.95+.34*w*Math.max(0,la)),elR=-(.2+run*w*.95+.34*w*Math.max(0,-la));
  let direct=0;
  if(husk&&!crawl){   // shamble: arms out, a dragged leg, the trunk lurching over each step
    armL=-1.15+Math.sin(t*2+sd)*.12+.14*w*sn;armR=-1.3+Math.cos(t*1.7+sd)*.12-.14*w*sn;elL=-.38+.1*Math.sin(t*1.3+sd);elR=-.22;chestPitch+=.18;chestRoll+=.11*w*sn;
    headRoll=Math.sin(t*1.1+sd)*.17;headPitch=.2;legR*=.6;knR*=.45;bodyX+=.02*w*sn}
  if(crawl){lean=1.32;bodyY=.05;armL=-2.7+sn*.6*Math.max(.25,w);armR=-2.7-sn*.6*Math.max(.25,w);elL=-.5-Math.max(0,sn)*.6;elR=-.5-Math.max(0,-sn)*.6;legL=.25+sn*.2;legR=.25-sn*.2;knL=.3;knR=.5;headPitch=-.9;chestPitch=0;chestRoll=.16*sn;chestYaw=.1*sn;hipsYaw=0;hipsRoll=0}
  // ---- stances
  const sk=rig.wSneak;if(sk>.01){bodyY-=.13*sk;legL-=.55*sk;legR-=.55*sk;knL+=1.0*sk;knR+=1.0*sk;chestPitch+=.4*sk;headPitch-=.3*sk;armL-=.3*sk;armR-=.3*sk;elL-=.5*sk;elR-=.5*sk}
  const ak=rig.wAim;if(ak>.01){const tk=rig.wTwo,kick=rig.kick;armR=mixv(armR,-1.42-kick*.24,ak);elR=mixv(elR,-.12-kick*.2,ak);zR=mixv(zR,-.1,ak);chestYaw=chestYaw*(1-.65*ak)-.3*tk;chestPitch+=.05*ak-kick*.07*ak;
    armL=mixv(armL,-1.15-kick*.1,tk);elL=mixv(elL,-.75,tk);zL=mixv(zL,.55,tk)}
  // ---- actions
  if(s.wind>0){const f=ease(s.wind*1.5);armR=mixv(armR,-2.85,f);elR=mixv(elR,-.9,f);zR+=.3*f;if(husk){armL=mixv(armL,-2.6,f);elL=mixv(elL,-.7,f)}chestPitch-=.2*f;chestYaw-=.3*f;bodyY-=.03*f}
  const bl=rig.blow;if(bl>.01){armR=mixv(armR,-.55,bl);elR=mixv(elR,-.15,bl);if(husk)armL=mixv(armL,-.6,bl);chestPitch+=.36*bl;chestYaw+=.4*bl;bodyY-=.04*bl;legL-=.3*bl*idle;knL+=.3*bl*idle}
  if(s.atk>=0){const f=s.atk,ln=key(f,SW.lunge)*(1-w*.7);armR=key(f,SW.arm);zR=key(f,SW.armZ);elR=key(f,SW.el);chestYaw=chestYaw*.3+key(f,SW.yaw);chestPitch+=key(f,SW.pitch);hipsYaw+=key(f,SW.hips);
    armL=mixv(armL,key(f,SW.off),.85);elL=mixv(elL,-.7,.6);legL-=.42*ln;knL+=.45*Math.max(0,ln);legR+=.3*ln;bodyY-=.045*Math.max(0,ln);direct=1}
  else if(s.act){const f=(s.act*2)%1,hit=key(f,CH.hit);armR=key(f,CH.arm);elR=key(f,CH.el);armL=key(f,CH.arm)*.78;elL=key(f,CH.el)-.55;zL=.28;zR=-.12;chestPitch+=key(f,CH.pitch);chestYaw=key(f,CH.yaw);
    knL+=.28*hit;knR+=.28*hit;legL-=.2*hit;legR-=.2*hit;bodyY-=.035*hit;direct=1}
  if(s.throwing>0){const f=sat(1-s.throwing/.25);armR=key(f,TH.arm);elR=-.5;chestYaw+=key(f,TH.yaw);direct=1}
  if(s.stun){headRoll=Math.sin(t*14)*.25;chestPitch+=.22;knL+=.2;knR+=.2}
  const fl=rig.flinch;if(fl>.01){chestPitch-=.3*fl;headPitch-=.22*fl;bodyY-=.03*fl;zL-=.3*fl;zR+=.3*fl;elL-=.3*fl;elR-=.3*fl}
  if(s.roll>0){const r=s.roll,tuck=Math.sin(Math.PI*sat(r));body.rotation.x=r*Math.PI*2;body.position.y=.12+.2*tuck;legL=legR=-1.3*tuck;knL=knR=1.9*tuck;armL=armR=-1.0*tuck;elL=elR=-1.2*tuck;chestPitch=.55*tuck;headPitch=.4*tuck;direct=2}
  // the head stays on the horizon while the trunk works under it
  if(!crawl){headYaw+=-(chestYaw+hipsYaw)*.8+(husk?0:idle*.22*Math.sin(t*.6+sd));headPitch+=-chestPitch*.55;headRoll+=-(chestRoll+hipsRoll)*.6}
  // ---- apply: cyclic joints follow closely, actions follow their keys exactly
  const rc=1-Math.exp(-(direct?40:20)*dt),ra=1-Math.exp(-(direct?60:22)*dt),set=(o,ax,val,k)=>{o.rotation[ax]+=(val-o.rotation[ax])*k};
  set(P.legL,'x',legL,rc);set(P.legR,'x',legR,rc);set(P.kneeL,'x',knL,rc);set(P.kneeR,'x',knR,rc);P.legL.rotation.z*=1-rc;P.legR.rotation.z*=1-rc;
  set(P.armL,'x',armL,ra);set(P.armR,'x',armR,ra);set(P.armL,'z',zL,ra);set(P.armR,'z',zR,ra);set(P.elbowL,'x',elL,ra);set(P.elbowR,'x',elR,ra);
  set(P.hips,'y',hipsYaw,rc);set(P.hips,'z',hipsRoll,rc);set(P.chest,'x',chestPitch,ra);set(P.chest,'y',chestYaw,ra);set(P.chest,'z',chestRoll,rc);
  set(P.head,'x',headPitch,rc);set(P.head,'y',headYaw,rc);set(P.head,'z',headRoll,rc);
  P.torso.scale.z=1+idle*br*.03;
  if(direct!==2){set(body,'x',lean,rc);body.rotation.y*=1-rc;body.position.y+=(bodyY-body.position.y)*rc}body.position.x+=(bodyX-body.position.x)*rc;
  if(P.scarf){set(P.scarf,'x',.2+w*(.45+run*.7)+Math.max(0,acc)*.4+Math.sin(t*(2+w*7)+sd)*(.05+w*.06),1-Math.exp(-6*dt));P.scarf.rotation.z=Math.sin(t*(1.3+w*5)+sd)*(.05+w*.1)-rig.turn*.05}
}
function fade(rig,s){
  const m=rig.mat,fl=s.flash>0?1:0;if(m._fl!==fl){m._fl=fl;m.emissive.setRGB(fl*.3,fl*.24,fl*.2)}
  let op=s.vis===undefined?1:s.vis;if(s.dead&&s.deadT>8.6)op*=Math.max(0,1-(s.deadT-8.6)/1.3);
  const tr=op<.99;if(m.transparent!==tr){m.transparent=tr;m.needsUpdate=true}m.opacity=op;
}
export function disposeRig(rig){const keep=new Set(handCache.values());rig.mat.dispose();rig.root.traverse(o=>{if(o.isMesh&&!keep.has(o.geometry))o.geometry.dispose()})}

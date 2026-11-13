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
const HEAD=.97;
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
  if(o.helm){const c=o.helm,c2=o.helmC2||shade(c,1.25);
    if(st==='hood'){g.loft([[-.02,.066,.05,0,-.03],[.05,.08,.068,0,-.022],...shell(.11,.016,.012)],c,12);g.loft([[-.03,.085,.06,0,-.02],[.0,.07,.052,0,-.026]],shade(c,.85),10,'none')}
    else if(st==='cap'){g.loft(shell(.128,.012,.004),c,12);g.sph(.05,shade(c,.8),0,.133,.092,1.1,.12,.8,8,4);if(hr)g.loft([[.045,.052,.042,0,-.05],[.085,.068,.052,0,-.044],[.128,.076,.064,0,-.03]],shade(hr,.82),10,'none')}
    else if(st==='visor'){g.loft(shell(.1,.016,.004),c,12);g.sph(.06,'#27343c',0,.092,.047,1.1,.72,.74,9,6);g.loft([[.02,.07,.07,0,.006],[.05,.078,.084,0,.002]],shade(c,.75),12,'none')}
    else if(st==='mask'){g.loft(SKULL.map(r=>[r[0],r[1]+.012,r[2]+.012,0,r[4]]),c,14);for(const s of[-1,1]){g.sph(.02,'#1c2a30',s*.03,.104,.086,1,1,.5,7,5);g.sph(.009,'#8fc8d8',s*.034,.11,.095,1,1,.4,5,4)}g.cyl(.026,.03,.05,'#34383a',0,.045,.1,8,Math.PI/2)}
    else if(st==='furhat'){g.loft(shell(.118,.02,.004),c,12);g.loft([[.11,.096,.108,0,-.004],[.14,.094,.106,0,-.004]],c2,12,'none');for(const d of[-1,1])g.sph(.036,c2,d*.074,.07,-.004,.5,1.5,1,6,6)}
    else if(st==='combat'){g.loft(shell(.108,.015,.004),c,12);g.loft([[.1,.089,.101,0,-.004],[.112,.085,.098,0,-.004]],shade(c,.78),12,'none');g.box(.11,.03,.02,'#1c2024',0,.168,.07,-.5);for(const d of[-1,1]){g.sph(.02,'#3a5a6a',d*.026,.17,.082,1,.7,.5,6,4);g.box(.01,.09,.01,'#22262a',d*.07,.06,.03)}}
    else if(st==='gasmask'){if(hr)drawHair(g,hr,o.hairStyle||0,false);g.loft([[.0,.03,.034,0,.03],[.03,.064,.068,0,.012],[.09,.073,.084,0,.004],[.122,.072,.087,0,.002]],c,12,'start');for(const d of[-1,1]){g.sph(.019,'#1c2a30',d*.03,.104,.088,1,1,.5,7,5);g.sph(.008,'#8fc8d8',d*.034,.11,.097,1,1,.4,5,4);g.cyl(.022,.026,.045,'#5a5e58',d*.05,.035,.075,8,Math.PI/2,0,d*.5)}g.loft([[.125,.076,.09,0,-.004],[.14,.075,.089,0,-.004]],shade(c,.7),12,'none')}
    else if(st==='exo'){g.loft(SKULL.map(r=>[r[0],r[1]+.014,r[2]+.014,0,r[4]]),c,14);g.box(.1,.014,.02,c2,0,.104,.092);g.box(.06,.05,.02,shade(c,.75),0,.05,.094);for(const d of[-1,1])g.box(.014,.05,.05,shade(c,.7),d*.086,.09,0);g.box(.02,.1,.1,shade(c,1.15),0,.2,-.02)}
    else if(st==='brim'){if(hr)g.loft([[.045,.052,.042,0,-.05],[.085,.068,.052,0,-.044],[.12,.078,.066,0,-.032]],shade(hr,.82),10,'none');g.loft([[.128,.08,.092,0,-.004],[.17,.074,.086,0,-.004],[.21,.062,.074,0,-.004],[.218,.03,.04,0,-.004]],c,12);g.cyl(.165,.165,.012,c,0,.135,-.004,16);g.loft([[.138,.082,.094,0,-.004],[.152,.08,.092,0,-.004]],c2,12,'none')}
    else if(st==='skull'){if(hr)drawHair(g,hr,o.hairStyle||0,false);g.loft([[.0,.03,.034,0,.034],[.03,.064,.068,0,.016],[.09,.074,.085,0,.008],[.14,.072,.088,0,.006],[.165,.05,.07,0,.004]],c,12);for(const d of[-1,1])g.sph(.02,'#14100e',d*.028,.104,.092,1.1,1,.5,7,5);g.sph(.012,'#14100e',0,.076,.098,.8,1.2,.5,5,4);for(let i=0;i<5;i++)g.box(.008,.02,.008,'#f0e8d0',-.022+i*.011,.038,.094);g.box(.004,.05,.004,c2,.03,.15,.094,0,0,.3)}
    else if(st==='bandana'){if(hr)g.loft([[.045,.052,.042,0,-.05],[.085,.068,.052,0,-.044],[.12,.078,.066,0,-.032]],shade(hr,.82),10,'none');g.loft(shell(.14,.012,.006),c,12);g.sph(.022,c,.01,.15,-.1,1,.7,.8,6,5);g.sph(.016,shade(c,.8),.03,.13,-.112,1,1.6,.6,5,4)}
    else{g.loft(shell(.108,.014,.004),c,12);g.loft([[.1,.088,.1,0,-.004],[.112,.084,.097,0,-.004]],shade(c,.78),12,'none');g.box(.012,.1,.11,c2,0,.2,-.01);g.sph(.03,'#8c4a2a',.05,.16,.05,1,1,.5,5,4)}}
  else if(hr)drawHair(g,hr,o.hairStyle||0,false);
  if(o.mask&&!o.helm)g.loft([[.0,.027,.031,0,.03],[.03,.063,.067,0,.012],[.082,.071,.081,0,.004]],o.mask,12,'start');
}

/** Humanoid. What it wears is what you see: with nothing on, the torso, legs and feet are bare skin and it stands in its underwear.
 *  o = {skin, hair, hairStyle 0..5, eye, beard, head (colour override), build 'm'|'f', fat, scale, husk, gore, lean, weapon, mask, scarf,
 *       top (shirt colour; null = bare chest), sleeves (long shirt sleeves),
 *       vest, vestStyle, vestC2 (body gear: vest | jacket | coat | duster | plate | riot | carrier | suit | exo | spiked),
 *       legs (trouser colour; null = underwear only), legStyle, legC2 (pants | wrap | greaves | guards | cargo | suit | exo | fur | chaps | kilt),
 *       boots (colour; null = barefoot), bootStyle, bootC2 (boots | wraps | heavy | rubber | fur | exo),
 *       glove, gloveStyle, gloveC2 (gloves | wraps | gauntlet | exo), helm, helmStyle, helmC2, pack, packSize 1..5}
 *  The body is skinned, not stacked: torso, pelvis, arms and legs are lofted through anatomical cross-sections. */
const UNDER='#a8a294',GLOW='#8ff0ff',LONG={jacket:1,coat:1,duster:1,riot:1,carrier:1,suit:1,exo:1,plate:1};
export function humanoid(o){
  const mat=newMat(),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const fat=o.fat||1,skin=o.skin||'#e8bf9c',skinD=o.husk?shade(skin,.85):skin,P={};
  const shirt=o.top===null?null:(o.top||'#6a7a5a'),legs=o.legs===null?null:(o.legs||'#3a3f4a'),boots=o.boots===null?null:(o.boots||shade(legs||'#3a3f4a',.55));
  const bs=o.vest?o.vestStyle||'vest':null,v=o.vest,v2=o.vestC2||(v?shade(v,1.2):null),ls=legs?o.legStyle||'pants':null,l2=o.legC2||(legs?shade(legs,1.3):null),fs=boots?o.bootStyle||'boots':null,f2=o.bootC2||(boots?shade(boots,1.4):null),gs=o.glove?o.gloveStyle||'gloves':null,g2=o.gloveC2||(o.glove?shade(o.glove,1.3):null);
  // what the arms show: a long-sleeved garment, a shirt sleeve, or skin
  const longC=bs&&LONG[bs]?(bs==='riot'?v2:bs==='carrier'?v2:bs==='exo'?'#22242c':bs==='plate'?v2:v):null,upperC=longC||shirt||skinD,foreC=longC||(shirt&&o.sleeves?shirt:skinD),torsoC=shirt||longC||skinD;
  const fem=o.build==='f',sh=(fem?.89:1)*fat,wa=(fem?.84:1)*fat,hp=(fem?1.06:1)*fat,dz=fat,lf=Math.min(1.22,fat),baggy=bs==='suit'?1.1:1,lbag=ls==='suit'?1.12:1;
  // torso cross-sections, hips to neck: [height above the hips, half width, half depth, , forward shift]. Shoulders are broad enough that the
  // arms grow out of them; there are no ball joints anywhere on this body.
  const TORSO=[[.055,.118*wa,.08*dz],[.1,.108*wa,.075*dz,0,.002],[.16,.112*(wa+sh)/2,.079*dz,0,.004],[.23,.128*sh,(fem?.094:.089)*dz,0,fem?.012:.006],[.3,.146*sh,(fem?.1:.095)*dz,0,fem?.014:.007],[.36,.154*sh,.088*dz,0,.002],[.395,.146*sh,.077*dz,0,-.003],[.425,.108*sh,.062*dz,0,-.004],[.446,.066*sh,.05*dz,0,-.003],[.46,.048,.046,0,0]];
  const over=(k,from,to,dn=0)=>TORSO.filter(r=>r[0]>=from&&r[0]<=to).map((r,i)=>[i?r[0]:r[0]-dn,r[1]*k+.004,r[2]*k+.006,0,r[4]||0]);
  // how far forward the chest or belly reaches at a height (for buttons, plates and straps that sit on it)
  const front=y=>{let a=TORSO[0],b=TORSO[TORSO.length-1];for(let i=1;i<TORSO.length;i++)if(y<=TORSO[i][0]){a=TORSO[i-1];b=TORSO[i];break}const t=Math.max(0,Math.min(1,(y-a[0])/((b[0]-a[0])||1)));return a[2]+(a[4]||0)+(b[2]+(b[4]||0)-a[2]-(a[4]||0))*t-.004};
  // ---- one skin over the whole skeleton. Every part of the body is drawn into the same mesh, in the place it has when standing, and each
  // vertex is tied to the bones around it: fully to one bone along a limb, shared between two across a joint. So a bent elbow, knee, waist or
  // shoulder is a curve in one surface, not two tubes meeting.
  const SG=new Geo();SG.jit=.02;SG.lift=false;const SI=[],SWT=[],BN={hips:0,chest:1,armL:2,elbowL:3,armR:4,elbowR:5,legL:6,kneeL:7,legR:8,kneeR:9};
  const bone=(parent,x,y,z)=>{const b=new THREE.Bone();b.position.set(x,y,z);parent.add(b);return b};
  const sm=(a,b,x)=>{let t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t)};
  /** Draw into the skin at an offset; `wf(x,y,z)` (in the part's own coordinates) says which bones each new vertex follows: [bone, weight, ...] up to three. */
  const seg=(ox,oy,oz,wf,draw)=>{const i0=SG.pos.length/3;draw(SG);const n=SG.pos.length/3;for(let i=i0;i<n;i++){const k=i*3,w=wf(SG.pos[k],SG.pos[k+1],SG.pos[k+2]);SG.pos[k]+=ox;SG.pos[k+1]+=oy;SG.pos[k+2]+=oz;SI.push(w[0],w[2]||0,w[4]||0,0);SWT.push(w[1],w[3]||0,w[5]||0,0)}};
  const wTorso=(x,y)=>{const c=sm(.03,.17,y);return[BN.hips,1-c,BN.chest,c]};
  // an arm, measured down from the shoulder: the top sits in the chest, the elbow is at -.215
  const wArm=side=>(x,y)=>{const c=.75*sm(-.05,.04,y),e=sm(-.165,-.265,y);return[BN.chest,c,side<0?BN.armL:BN.armR,(1-c)*(1-e),side<0?BN.elbowL:BN.elbowR,(1-c)*e]};
  // a leg, measured down from the hip: the top sits in the pelvis, the knee is at -.3
  const wLeg=side=>(x,y)=>{const h=.8*sm(-.07,.03,y),k=sm(-.25,-.35,y);return[BN.hips,h,side<0?BN.legL:BN.legR,(1-h)*(1-k),side<0?BN.kneeL:BN.kneeR,(1-h)*k]};
  // skeleton: body → hips (pelvis, legs) → chest at the waist (ribcage, head, arms), so the two halves can twist against each other
  P.hips=bone(body,0,.6,0);P.chest=bone(P.hips,0,.1,0);
  seg(0,.6,0,wTorso,g=>{
    g.loft([[-.092,.05*hp,.054*dz],[-.05,.112*hp*lbag,.082*dz*lbag,0,-.004],[0,.134*hp*lbag,.092*dz*lbag,0,-.006],[.05,.126*(hp+wa)/2,.086*dz,0,-.002],[.098,.11*wa,.076*dz]],legs||UNDER,14);
    if(legs){g.loft([[.066,.121*(hp+wa)/2+.004,.083*dz+.004],[.1,.11*wa+.004,.076*dz+.004]],shade(legs,.55),14,'none');g.box(.03,.026,.012,'#b8a060',0,.083,.081*dz+.006)}
    else g.loft([[.07,.12*(hp+wa)/2+.003,.082*dz+.003],[.098,.11*wa+.003,.076*dz+.003]],shade(UNDER,.8),14,'none');
    if(ls==='kilt'){g.loft([[-.17,.158*hp,.114*dz],[-.03,.142*hp,.098*dz],[.09,.116*wa,.082*dz]],l2,12,'none');for(let i=0;i<8;i++){const a=i/8*6.283;g.box(.012,.15,.012,shade(l2,.7),Math.cos(a)*.146*hp,-.08,Math.sin(a)*.104*dz)}}
    // hems that hang from the body garment over the hips
    if(bs==='jacket')g.loft([[-.03,.143*hp,.1*dz],[.05,.134*(hp+wa)/2,.093*dz],[.1,.118*wa,.084*dz]],v,12,'none');
    if(bs==='suit')g.loft([[-.06,.148*hp,.106*dz],[.02,.144*hp,.102*dz],[.1,.122*wa,.088*dz]],v,12,'none');
    if(bs==='coat'){g.loft([[-.15,.154*hp,.112*dz],[-.03,.146*hp,.104*dz],[.1,.12*wa,.086*dz]],v,12,'none');g.loft([[-.165,.158*hp,.116*dz],[-.14,.156*hp,.114*dz]],v2,12,'none')}
    if(bs==='duster'){g.loft([[-.25,.162*hp,.118*dz,0,-.012],[-.05,.146*hp,.104*dz,0,-.004],[.1,.12*wa,.086*dz]],v,12,'none');g.box(.02,.3,.02,shade(v,.6),0,-.1,.112*dz)}
  });
  seg(0,.6,0,wTorso,g=>{
    g.loft(baggy>1?over(baggy,.055,.45):TORSO,bs==='suit'?v:torsoC,16);g.loft([[.436,.05,.05,0,0],[.468,.042,.044,0,.004],[.524,.039,.041,0,.008]],o.head||skin,12,'none');
    if(!shirt&&!bs&&!o.husk){for(const s of[-1,1])g.sph(.03,shade(skin,.95),s*.05*sh,.33,front(.33)-.022,1.5,.5,.5,7,4);g.sph(.006,shade(skin,.7),0,.15,front(.15)-.001,1,1.4,.6,5,4);if(fem)g.loft(over(1.03,.27,.36),UNDER,14,'none')}
    // (no ball at the shoulder: the arm's own top is the deltoid)
    if(shirt&&!o.husk&&!bs)g.loft([[.428,.106*sh,.063,0,-.003],[.463,.053,.05,0,.002]],shade(shirt,1.22),12,'none');
    if(o.husk&&o.gore>2)g.sph(.06,skin,.05*fat,.11,.06*fat,1,.6,.5,7,4);
    if(bs==='vest'){g.loft(over(1.06,.12,.4),v,14);g.box(.03,.26,.012,torsoC,0,.26,front(.26));for(const d of[-1,1]){g.sph(.04,v2,d*.158*sh,.392,0,1.25,.42,1.35,8,5);for(let i=0;i<3;i++)g.box(.03,.008,.01,shade(v,.6),0,.18+i*.07,front(.2)+.004,0,0,d*.5)}}
    else if(bs==='jacket'){g.loft(over(1.07,.055,.43,.02),v,14);g.box(.014,.3,.012,shade(v,.6),0,.24,front(.24)+.006);g.loft([[.426,.112*sh,.068,0,-.003],[.472,.058,.054,0,.002]],shade(v,1.2),12,'none');for(const d of[-1,1])g.box(.04,.008,.01,shade(v,.7),d*.058,.2,front(.2)+.004)}
    else if(bs==='coat'){g.loft(over(1.09,.055,.43,.02),v,14);g.torus(.066,.036,v2,0,.44,-.004,0,0,0,10);g.box(.016,.32,.012,shade(v,.6),0,.24,front(.24)+.008);for(const d of[-1,1])g.sph(.014,shade(v,.6),d*.02,.3,front(.3)+.01,1,1,.6,5,4)}
    else if(bs==='duster'){g.loft(over(1.08,.055,.43,.02),v,14);g.loft([[.33,.178*sh,.108*dz],[.4,.172*sh,.09*dz],[.442,.106*sh,.064]],shade(v,.84),14,'none');g.box(.03,.42,.014,v2,0,.24,front(.24)+.008,0,0,.62);for(let i=0;i<5;i++)g.cyl(.008,.008,.03,'#c8a040',-.09+i*.045,.33-i*.062,front(.24)+.016,5)}
    else if(bs==='plate'){g.loft(over(1.09,.16,.4),v,14);g.sph(.076,shade(v,1.12),-.188*sh,.408,0,1.15,.55,1.25,8,5);g.sph(.05,shade(v,.9),.184*sh,.404,0,1.1,.5,1.1,7,4);g.sph(.05,'#8c4a2a',.05,.3,front(.3)-.03,1.2,1,.5,6,4);g.sph(.04,'#8c4a2a',-.07,.2,front(.2)-.026,1,1.3,.5,6,4);for(let i=0;i<3;i++)g.box(.066,.045,.014,shade(v,.74),-.07+i*.07,.13,front(.13)+.002);for(const[x,y]of[[-.07,.36],[.07,.36],[-.08,.22],[.08,.22]])g.sph(.008,shade(v,1.4),x,y,front(y)+.008,1,1,1,4,3)}
    else if(bs==='riot'){g.loft(over(1.08,.1,.41),v,14);for(const d of[-1,1])g.sph(.068,shade(v,1.22),d*.186*sh,.404,0,1.1,.5,1.2,8,5);g.loft([[.426,.11*sh,.066,0,-.003],[.472,.058,.052,0,.002]],v,12,'none');g.box(.13,.06,.012,'#c8ccd0',0,.31,front(.31)+.006);for(let i=0;i<4;i++)g.box(.05,.04,.016,shade(v,.8),-.085+i*.057,.14,front(.14)+.004)}
    else if(bs==='carrier'){g.loft(over(1.07,.14,.4),v,14);for(let i=0;i<3;i++)g.box(.05,.075,.03,shade(v,.82),-.058+i*.058,.19,front(.19)+.014);g.box(.11,.05,.014,shade(v,1.16),0,.31,front(.31)+.006);g.box(.036,.06,.03,'#22262a',-.09*sh,.36,front(.36)-.004);g.cyl(.004,.004,.07,'#22262a',-.09*sh,.42,front(.36)-.004,4);for(const d of[-1,1])g.box(.034,.1,.02,shade(v,.86),d*.07*sh,.4,.02,-.9)}
    else if(bs==='suit'){g.box(.012,.34,.012,shade(v,.62),0,.24,front(.24)+.022);g.box(.09,.07,.04,'#9a9c96',0,.3,front(.3)+.028);g.limb(.013,.013,.16,'#3a3c3a',.03,.33,front(.3)+.03,2.6,0,-.3,6);g.loft([[.426,.116*sh,.07,0,-.003],[.474,.066,.06,0,.002]],shade(v,.9),12,'none')}
    else if(bs==='exo'){g.loft(over(1.08,.2,.4),v,14);g.sph(.024,v2,0,.31,front(.31)+.004,1,1,.6,8,6);g.sph(.036,shade(v,.7),0,.31,front(.31)-.004,1,1,.5,8,5);for(const d of[-1,1]){g.sph(.078,shade(v,1.15),d*.192*sh,.41,0,1.2,.55,1.25,8,5);g.box(.05,.02,.1,shade(v,.8),d*.216*sh,.392,0,0,0,d*-.5);g.box(.046,.05,.014,shade(v,.86),d*.045,.15,front(.15)+.004)}for(let i=0;i<5;i++)g.box(.03,.04,.03,i%2?v:shade(v,.7),0,.14+i*.06,-.082*dz-.012);g.box(.014,.3,.014,v2,0,.27,-.082*dz-.03)}
    else if(bs==='spiked'){for(const d of[-1,1])g.box(.03,.44,.014,v,0,.26,front(.26)+.002,0,0,d*.62);g.loft(over(1.05,.1,.17),v,14,'none');g.sph(.08,v2,-.188*sh,.408,0,1.15,.55,1.25,8,5);for(let i=0;i<3;i++)g.cone(.016,.07,shade(v2,1.2),-.198*sh-.02+i*.02,.452,-.03+i*.03,5,0,0,.5);g.sph(.05,'#6a5a48',.172*sh,.402,-.01,1.3,.6,1.3,7,5);g.sph(.016,'#d8d0b8',0,.33,front(.33)+.006,1,1.1,.6,6,5)}
    if(o.pack){const p=o.pack,z=o.packSize||2,k=[.7,.88,1,1.08,1.16][z-1],bz=-.09*dz-.085*k;g.sph(.125*k,p,0,.25+(z>3?.02:0),bz,.98,z>4?1.55:1.3,.72,9,6);g.sph(.07*k,shade(p,1.2),0,.19,bz-.085*k,1.05,.85,.6,7,4);g.sph(.1*k,shade(p,.8),0,.39+(z>4?.05:0),bz+.012,1,.35,.7,8,4);
      for(const d of[-1,1])g.box(.026,.24,.016,shade(p,.7),d*.086*sh,.31,front(.31)+(bs?.016:.002));
      if(z>=3)g.cyl(.04,.04,.24,z>=4?'#5a5e4a':'#7a8a9a',0,.43+(z>4?.07:0),bz+.01,8,0,0,Math.PI/2);if(z>=4)for(const d of[-1,1])g.sph(.045,shade(p,.9),d*.12*k,.2,bz,1,1.2,.8,6,5);if(z>=5){g.cyl(.03,.03,.05,'#8a8f96',.1,.36,bz-.06,7);g.box(.012,.4,.012,'#8a8f96',-.09,.3,bz+.05)}}
    if(o.scarf){g.torus(.056,.028,o.scarf,0,.44,.002,0,0,0,10);g.sph(.03,shade(o.scarf,.85),.03,.43,-.062,1,1,1,6,4)}
    if(o.gore){g.sph(.055,BLOOD,-.05*fat,.3,.082*fat,1.2,1.1,.3,6,4);if(o.gore>1)g.sph(.045,BLOOD,.094*fat,.17,.05*fat,.5,1.3,.9,6,4);if(o.gore>2)g.sph(.06,shade(BLOOD,.7),.03,.2,-.07*fat,1.3,.9,.3,6,4)}
  });P.torso=new THREE.Object3D();   // (breathing used to scale this; the skin has no part of its own to scale)
  // ---- scarf tails: two strips that trail behind when running
  if(o.scarf){P.scarf=part(mat,g=>{g.sph(.03,o.scarf,-.022,-.13,0,.95,4.4,.36,7,6);g.sph(.027,shade(o.scarf,.82),.03,-.1,-.008,.95,3.7,.36,7,6)});P.scarf.position.set(.03,.34,-.075);P.scarf.rotation.x=.25;P.chest.add(P.scarf)}
  // ---- head (pivot at the top of the neck)
  P.head=part(mat,g=>drawHead(g,o,skin));P.head.position.y=.392;P.head.scale.setScalar(HEAD);P.chest.add(P.head);
  // ---- arms: one surface from inside the shoulder to the wrist. Deltoid, the swell of the upper arm, the elbow, the forearm's taper.
  const ab=bs==='suit'?1.14:bs==='coat'||bs==='duster'?1.08:1;
  const arm=side=>{const ax=side*(.13*sh+.03),up=bone(P.chest,ax,.262,0),el=bone(up,0,-.215,0),aw=wArm(side),k=lf*ab;
    const ARM=[[.052,.026*k,.034*k,-side*.034],[.028,.042*k,.05*k,-side*.02],[-.012,.05*k,.056*k,-side*.008],[-.075,.048*k,.053*k,-side*.002,.002],[-.135,.045*k,.048*k,0,.003],[-.185,.039*ab,.041*ab,0,.001],[-.215,.037*ab,.038*ab],[-.245,.038*ab,.039*ab,0,.001],[-.285,.04*ab,.041*ab,0,.002],[-.34,.034*ab,.034*ab,0,.001],[-.395,.027,.026],[-.422,.024,.022]];
    seg(ax,.962,0,aw,g=>{if(upperC===foreC)g.loft(ARM,upperC,12,'start');else{g.loft(ARM.slice(0,7),upperC,12,'start');g.loft(ARM.slice(6),foreC,12,'none')}
      if(shirt&&!longC&&!o.sleeves&&!o.husk)g.loft([[-.098,.054*lf,.057*lf,0,.002],[-.118,.052*lf,.055*lf,0,.002]],shade(shirt,.8),12,'none');
      if(bs==='exo'){g.box(.016,.17,.03,v,side*.05,-.1,0);g.sph(.014,v2,side*.052,-.02,0,1,1,1,5,4)}if(bs==='spiked'&&side>0)g.loft([[-.08,.05,.052],[-.11,.049,.051]],v,10,'none');
      if(o.gore>1&&side<0)g.sph(.04,BLOOD,0,-.12,.02,1.1,1.4,.8,6,4)
    });
    // from the elbow down: cuffs, guards and the hand (drawn as they always were, measured from the elbow)
    const hc=o.husk||gs==='wraps'?skinD:o.glove||skin;
    seg(ax,.962-.215,0,(x,y)=>aw(x,y-.215),g=>{
      if(bs==='riot'||bs==='carrier')g.sph(.034,bs==='riot'?v:'#2a2e28',0,.0,-.014,1,1.1,.8,7,5);
      if(bs==='exo'){g.loft([[-.03,.044,.044],[-.15,.037,.036]],v,10,'none');g.box(.012,.1,.012,v2,side*.04,-.09,0)}
      if(bs==='plate'&&side<0)g.loft([[-.05,.044,.044],[-.16,.034,.034]],v,10,'none');
      if(bs==='coat')g.loft([[-.16,.04,.04],[-.2,.037,.037]],v2,10,'none');if(bs==='suit')g.loft([[-.17,.034,.033],[-.2,.03,.029]],'#8a8c88',10,'none');
      if(longC&&bs!=='coat'&&bs!=='suit'&&bs!=='exo')g.loft([[-.172,.031,.03],[-.2,.029,.028]],shade(longC,.72),10,'none');
      if(gs==='gauntlet'||gs==='exo'){g.loft([[-.1,.04,.04],[-.2,.032,.031]],o.glove,10,'none');g.box(.03,.07,.012,g2,0,-.15,-.036)}
      else if(gs==='gloves')g.loft([[-.165,.031,.03],[-.205,.029,.028]],shade(o.glove,.78),10,'none');
      // the hand hangs relaxed, palm to the thigh: a flat palm, four fingers curling in a little, the thumb forward. Husks keep a plain claw.
      g.sph(.034,hc,-side*.002,-.235,.005,.4,1,.86,9,6);
      if(o.husk){g.sph(.028,hc,-side*.006,-.268,.008,.42,.95,.8,7,5);g.sph(.012,hc,-side*.004,-.236,.032,1,1.5,1,6,4)}
      else{for(let f=0;f<4;f++)g.limb(.0082-(f===3?.001:0),.0064,[.036,.041,.038,.031][f],hc,-side*.004,-.258-(f===3?.002:0),-.017+f*.0125,0,0,-side*(.2+f*.03),5);
        g.limb(.0095,.0072,.03,hc,-side*.006,-.224,.03,-.75,0,-side*.25,5)}
      if(gs==='wraps')g.loft([[-.185,.03,.029],[-.212,.027,.028],[-.244,.019,.033,0,.004]],o.glove,10,'none');
      if(gs==='exo')g.sph(.01,g2,0,-.24,.03,1.6,1,.6,5,4)
    });return[up,el]};
  [P.armL,P.elbowL]=arm(-1);[P.armR,P.elbowR]=arm(1);
  // ---- legs: one surface from inside the pelvis to the ankle. The thigh's fullness, the knee, a calf behind the shin.
  const lc=legs||skinD;
  const leg=side=>{const lx=side*.072*(fem?1.04:1),th=bone(P.hips,lx,0,0),kn=bone(th,0,-.3,0),lw=wLeg(side),kk=lf*lbag;
    const LEG=[[.045,.058*lf,.062*lf],[0,.074*kk*(fem?1.04:1),.08*kk,0,-.004],[-.07,.074*kk,.08*kk,0,.002],[-.15,.067*kk,.072*kk,0,.004],[-.23,.056*lbag,.06*lbag,0,.004],[-.285,.046*lbag,.049*lbag,0,.005],[-.31,.046*lbag,.05*lbag,0,.005],[-.34,.044*lbag,.047*lbag,0,-.001],[-.39,.049*lbag,.054*lbag,0,-.01],[-.45,.042*lbag,.045*lbag,0,-.008],[-.51,.033*lbag,.035*lbag,0,-.003],[-.556,.031,.032]];
    seg(lx,.6,0,lw,g=>{g.loft(LEG,lc,12,'start');
      if(!legs)g.loft([[.02,.077*lf,.083*lf,0,-.003],[-.07,.077*lf,.083*lf,0,.002],[-.092,.075*lf,.081*lf,0,.002]],UNDER,12,'none');
      if(ls==='greaves'||ls==='guards'){g.sph(.05,l2,0,-.13,.034,1.05,1.7,.5,7,5);g.sph(.03,shade(l2,.8),side*.05,-.12,0,.5,1.6,1,6,4)}
      if(ls==='cargo'){g.box(.03,.085,.07,shade(legs,.84),side*.062*lf,-.15,.004);g.box(.032,.016,.072,shade(legs,.7),side*.062*lf,-.112,.004)}
      if(ls==='chaps')g.sph(.062,l2,0,-.15,.022,1,2.2,.75,8,6);
      if(ls==='exo'){g.box(.016,.24,.03,l2,side*.066,-.15,0);g.sph(.018,GLOW,side*.068,-.02,0,1,1,1,5,4)}
      if(ls==='wrap')for(const y of[-.08,-.2])g.loft([[y,.072-(y<-.1?.012:0),.077-(y<-.1?.012:0),0,.003],[y-.02,.071-(y<-.1?.012:0),.076-(y<-.1?.012:0),0,.003]],l2,12,'none')
    });
    // from the knee down: guards, wraps and the foot or boot (measured from the knee, as before)
    seg(lx,.3,0,(x,y)=>lw(x,y-.3),g=>{
      if(ls==='greaves'||ls==='guards'||ls==='cargo'||ls==='chaps')g.sph(.04,ls==='cargo'?'#2a2e28':l2,0,-.004,.03,1,1,.6,7,5);
      if(ls==='greaves'||ls==='guards')g.sph(.044,l2,0,-.11,.022,.95,2,.5,7,5);
      if(ls==='exo'){g.box(.016,.2,.028,l2,side*.05,-.12,0);g.sph(.03,l2,0,-.004,.03,1,1,.7,7,5);g.sph(.012,GLOW,0,-.004,.052,1,1,.6,5,4);g.sph(.04,l2,0,-.11,.024,.9,2,.45,7,5)}
      if(ls==='wrap')for(const y of[-.05,-.12,-.19])g.loft([[y,.054+y*.085,.058+y*.085,0,-.008],[y-.018,.053+y*.085,.057+y*.085,0,-.008]],l2,12,'none');
      if(ls==='fur')g.loft([[-.19,.042,.044],[-.235,.04,.042]],l2,10,'none');
      if(!boots){g.sph(.036,skinD,0,-.276,.03,.95,.62,1.7,8,5);g.sph(.03,skinD,0,-.278,-.008,1,.8,1,7,5);for(let i=0;i<4;i++)g.sph(.009,skinD,-.02+i*.013,-.284,.088-Math.abs(i-1)*.004,1,.8,1.2,4,3)}
      else if(fs==='wraps'){g.sph(.042,boots,0,-.276,.032,.92,.62,1.75,8,5);g.sph(.033,boots,0,-.278,-.01,1,.8,1,7,5);for(const y of[-.2,-.235])g.loft([[y,.034,.035],[y-.016,.033,.034]],f2,10,'none')}
      else{const top=fs==='rubber'?-.06:fs==='heavy'||fs==='exo'?-.1:-.128;g.loft([[top,.045,.047,0,-.005],[-.2,.037,.038],[-.264,.037,.042,0,.004]],boots,10,'none');g.loft([[top+.006,.047,.049,0,-.005],[top-.012,.046,.048,0,-.005]],fs==='fur'?f2:shade(boots,1.25),10,'none');
        if(fs==='fur')g.torus(.044,.02,f2,0,top,-.004,0,0,0,8);
        g.sph(.05,boots,0,-.276,.04,.84,.62,1.9,9,6);g.sph(.037,boots,0,-.278,-.012,1,.78,1,7,5);g.sph(.052,shade(boots,.55),0,-.299,.036,.88,.2,1.98,9,4);
        if(fs==='heavy'||fs==='exo'){g.sph(.04,f2,0,-.268,.084,1,.7,.9,7,5);g.sph(.04,f2,0,-.17,.024,.9,1.8,.45,7,5)}if(fs==='exo')g.box(.07,.008,.012,GLOW,0,-.25,.07)}
    });return[th,kn]};
  [P.legL,P.kneeL]=leg(-1);[P.legR,P.kneeR]=leg(1);
  // ---- bind the skin to the skeleton as it stands now
  {const geo=SG.build();geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(SWT,4));
    geo.boundingSphere.center.set(0,.7,0);geo.boundingSphere.radius=1.7;   // room for a lunge, a crawl or a body on the ground
    const skinMesh=new THREE.SkinnedMesh(geo,mat);skinMesh.castShadow=true;body.add(skinMesh);root.updateMatrixWorld(true);
    skinMesh.bind(new THREE.Skeleton([P.hips,P.chest,P.armL,P.elbowL,P.armR,P.elbowR,P.legL,P.kneeL,P.legR,P.kneeR]));P.skin=skinMesh}
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
/** The player's rig, dressed from what is equipped: every worn piece shows, and an empty slot shows skin (or underwear). */
export function playerRig(eq){
  const look=s=>eq[s]&&ITEMS[eq[s].id]?ITEMS[eq[s].id].look||{}:null,head=look('head'),b=look('body'),l=look('legs'),f=look('feet'),h=look('hands'),pack=look('pack'),shirt=b&&b.s==='shirt';
  return humanoid({skin:'#d8a882',hair:'#3a2a1c',hairStyle:0,eye:'#4a3828',
    top:shirt?b.c:null,vest:b&&!shirt?b.c:null,vestStyle:b&&!shirt?b.s||'vest':null,vestC2:b?b.c2:null,
    legs:l?l.c:null,legStyle:l?l.s||'pants':null,legC2:l?l.c2:null,boots:f?f.c:null,bootStyle:f?f.s||'boots':null,bootC2:f?f.c2:null,
    glove:h?h.c:null,gloveStyle:h?h.s||'gloves':null,gloveC2:h?h.c2:null,helm:head?head.c:null,helmStyle:head?head.s||'helm':null,helmC2:head?head.c2:null,
    pack:pack?pack.c:null,packSize:pack?pack.z||2:0});
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
  let armL=-armA*la+idle*.03*Math.sin(t*.9+sd),armR=armA*la-idle*.03*Math.sin(t*.9+sd+1),zL=-(.03+run*.08),zR=.03+run*.08;
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
export function disposeRig(rig){const keep=new Set(handCache.values());rig.mat.dispose();rig.root.traverse(o=>{if(o.isMesh&&!keep.has(o.geometry))o.geometry.dispose();if(o.isSkinnedMesh&&o.skeleton)o.skeleton.dispose()})}

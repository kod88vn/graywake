// Character rigs: jointed bodies built from rounded anatomy (not boxes), and the code that poses them every frame.
// A humanoid is about 1.28 units tall and a little under seven and a half heads, to the measures of a real figure: one skin over the whole skeleton
// (shoulders, waist, hips, seat, calves), a head sculpted as one surface with its features pressed into it, hair that grows from a hairline,
// two-part limbs with elbows and knees, and clothes that are shells standing off the body. Smoothly lit, matte, with a fine cloth and skin grain.
// A rig is a THREE.Group: root → body (leans, crouches, falls) → hips (pelvis, legs) → chest (ribcage, head, arms). Each rig owns its material so it can flash and fade.
import {THREE,Geo,shade,mix,matte,smoothRings} from './geo.js';
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

// ---- head. Head space: the chin is at y=0 and the crown at .196, z=0 runs through the ears, the face looks down +Z.
// The head is ONE surface lofted through 25 sections whose width, depth and squareness come from the tables below. The nose, the eye sockets, the
// lips and the cheeks are pressed into that surface and the brows, lips, stubble and scalp are tints of it, so nothing on the face is stuck on.
// Realistic proportions throughout: about seven and a half heads tall. The user rejected anime faces, big heads and stacked-ball bodies.
const HEAD=.9;
const tab=(T,y)=>{if(y<=T[0][0])return T[0][1];for(let i=1;i<T.length;i++)if(y<=T[i][0]){const a=T[i-1],b=T[i];return a[1]+(b[1]-a[1])*(y-a[0])/(b[0]-a[0])}return T[T.length-1][1]};
const bell=(d,s)=>Math.exp(-(d*d)/(s*s)),clamp01=x=>x<0?0:x>1?1:x;
// half width; the profile down the middle of the face (without the nose and lips); the back of the head; where each section is widest; its squareness
const HW=[[-.006,.014],[.002,.024],[.012,.033],[.022,.04],[.03,.045],[.0365,.048],[.0445,.051],[.058,.055],[.07,.058],[.089,.0625],[.1035,.0645],[.118,.066],[.128,.067],[.142,.0695],[.156,.068],[.17,.062],[.182,.05],[.191,.031],[.196,.008]],
  HF=[[-.006,.042],[.002,.063],[.012,.0715],[.022,.07],[.03,.0725],[.0365,.0745],[.0405,.0755],[.0445,.0765],[.051,.0772],[.058,.077],[.07,.0755],[.089,.0745],[.1035,.0745],[.111,.0768],[.118,.079],[.128,.0798],[.142,.0785],[.156,.073],[.17,.062],[.182,.046],[.191,.027],[.196,.006]],
  HB=[[-.006,.012],[.002,-.008],[.012,-.026],[.022,-.04],[.03,-.052],[.045,-.066],[.06,-.076],[.08,-.084],[.1,-.088],[.12,-.089],[.14,-.086],[.156,-.079],[.17,-.067],[.182,-.05],[.191,-.031],[.196,-.012]],
  HC=[[-.006,.03],[.002,.026],[.012,.02],[.022,.013],[.03,.007],[.0365,.003],[.0445,0],[.058,-.003],[.08,-.005],[.14,-.006],[.17,-.008],[.196,-.004]],
  HN=[[-.006,2],[.012,1.95],[.03,2.05],[.058,2.2],[.089,2.3],[.118,2.35],[.156,2.25],[.182,2.1],[.196,2]];
const HYS=[-.006,.002,.012,.022,.03,.0365,.0392,.0405,.0418,.0445,.051,.058,.064,.07,.079,.089,.0965,.1035,.111,.118,.128,.142,.156,.17,.182,.191,.196];
// the nose: how far its ridge stands out at each height and how wide it is there; the lips
const NB=[[.054,0],[.058,.004],[.064,.0165],[.07,.0205],[.079,.0135],[.089,.007],[.0965,.003],[.1035,.0006],[.108,0]],NS=[[.058,.009],[.064,.0125],[.07,.0112],[.079,.008],[.089,.006],[.1035,.005]],
  LP=[[.032,0],[.0365,.003],[.0392,.0022],[.0405,-.0016],[.0418,.0016],[.0445,.0022],[.049,0]];
/** The head's section at a height: [y, half width, depth in front of the widest point, 0, z of the widest point, squareness, depth behind it]. */
const headRing=(y,jaw=1)=>{const zc=tab(HC,y);return[y,tab(HW,y)*(y<.07?jaw+(1-jaw)*Math.max(0,y)/.07:1),tab(HF,y)-zc,0,zc,tab(HN,y),zc-tab(HB,y)]};
/** How far the face stands out from (or sinks into) the plain skull at a point. f = {nose, lip, brow, husk} */
const relief=(x,y,f)=>{const ax=Math.abs(x);
  return tab(NB,y)*f.nose*bell(x,tab(NS,y))                          // nose
    -(f.husk?.009:.0062)*bell(ax-.03,.015)*bell(y-.0995,.0085)      // eye sockets
    +tab(LP,y)*f.lip*bell(x,.017)                                    // lips
    +(f.husk?-.004:.002)*bell(ax-.037,.016)*bell(y-.07,.016)         // cheeks (sunken on a husk)
    +f.brow*bell(ax-.03,.022)*bell(y-.117,.007)};                    // the ridge of the brow over each eye
/** z of the face's surface at (x, y) */
const faceZ=(x,y,f)=>{const[,w,F,,zc,n]=headRing(y,f.jaw);return zc+F*Math.pow(Math.max(0,1-Math.pow(Math.min(1,Math.abs(x)/w),n)),1/n)+relief(x,y,f)};
/** A ring that sits `k` outside the head at a height and covers it from the back forward as far as z=lim (hair, hoods, caps): everything in front of
 *  `lim` stays inside the head, so a hairline or the edge of a hood is where the shell comes out of the skin. */
const cover=(y,k,lim=1,col,back=0)=>{const[,w,F,,zc,n,B]=headRing(y);
  if(lim>=zc+F)return[y,w+k,F+k,0,zc-back,n,B+k,col];
  if(lim>=zc)return[y,w+k,Math.max(.004,lim-zc),0,zc-back,n,B+k,col];
  const d=Math.min(.98,(zc-lim)/B),wl=w*Math.pow(1-Math.pow(d,n),1/n);return[y,wl+k,.004,0,lim-back,n,Math.max(.004,B-(zc-lim)+k),col]};
/** A ring that covers the front of the head at a height and stops `back` behind its widest point (a beard, a mask). */
const frontCover=(y,k,back=.02,col)=>{const[,w,F,,zc,n]=headRing(y);return[y,w+k,F+k,0,zc,n,back,col]};
/** A shell over the top of the head from height `from` up, grown by `k` and set back by `back` at its lower edge (helmets, caps). */
const SHY=[.03,.06,.09,.108,.118,.128,.142,.156,.17,.182,.191];
const shell=(from,k,back=0)=>{const bk=y=>Math.max(.003,back-(y-from)*(back-.003)/.05);return[...[from,...SHY.filter(y=>y>from+.006)].map(y=>cover(y,k,1,undefined,bk(y))),[.197+k*.8,.012,.016,0,-.009]]};
const _h1=new THREE.Color(),_h2=new THREE.Color();
/** A cap of hair through [height, thickness, how far forward it reaches] rows, dark at the roots and nape, lighter over the crown, streaked along the way it grows. */
const hairCap=(g,L,hr,seg=12)=>{const dk=shade(hr,.74),lt=shade(hr,1.16);_h1.set(dk);_h2.set(lt);const col=new THREE.Color();
  return g.loft([...L.map(([y,k,lim])=>cover(y,k,lim)),[.197+L[L.length-1][1]*.8,.01,.012,0,-.008,2,.012]],hr,seg,'end',{paint:(p,a)=>{const h=Math.sin(a*91.7)*4375.85,f=h-Math.floor(h);return col.copy(_h1).lerp(_h2,clamp01((p[1]-.05)/.13)).multiplyScalar(.86+.28*f)}})};
/** A fringe: hair lying on the forehead from the crown down to `y0`, round from angle a0 to a1 (the face looks along π/2). Its lower edge rises by
 *  `part` towards the middle (a parting) or runs at a `slant`, and is uneven. */
const fringe=(g,col,y0,k,a0,a1,part=0,slant=0)=>g.loft([y0,(y0+.16)/2,.166,.181,.192].map((y,i)=>cover(y,k+(i===0?.002:0),1)),col,8,'none',{arc:[a0,a1],
  warp:(p,a,i)=>{if(i<2){const f=i?.5:1;p[1]+=f*(part*bell(p[0],.02)+slant*p[0]+.004*Math.sin(a*9+1))}}});
/** Hair on the back of the head and the nape, as it shows under a cap or a hat. */
const nape=(g,hr)=>g.loft([[.03,.003,-.05],[.06,.005,-.034],[.09,.006,-.018],[.112,.006,.004],[.135,.006,.03]].map(([y,k,lim])=>cover(y,k,lim)),shade(hr,.8),12,'none');
function drawHair(g,hr,style,short){
  const dk=shade(hr,.78),lt=shade(hr,1.14);
  if(style===3||short){hairCap(g,[[.03,.002,-.05],[.06,.003,-.034],[.09,.0035,-.018],[.112,.004,.004],[.128,.0045,.03],[.145,.005,.056],[.16,.0055,1],[.174,.006,1],[.186,.006,1],[.193,.005,1]],shade(hr,.84));return}   // cropped close
  if(style===0){hairCap(g,[[.03,.003,-.05],[.06,.006,-.034],[.09,.008,-.016],[.112,.009,.008],[.128,.011,.032],[.145,.013,.058],[.16,.015,1],[.174,.016,1],[.186,.014,1],[.194,.011,1]],hr);   // short, pushed up and across at the front
    g.ell(.04,.013,.03,hr,.012,.181,.048,-.3,0,-.18,8,5);g.ell(.03,.011,.03,lt,-.026,.186,.03,-.2,0,.25,7,5)}
  else if(style===1){hairCap(g,[[-.035,.013,-.014],[0,.015,-.004],[.04,.015,.008],[.08,.014,.018],[.112,.013,.028],[.13,.013,.044],[.148,.014,.064],[.162,.015,1],[.176,.015,1],[.187,.013,1],[.194,.01,1]],hr);   // collar length, parted in the middle
    fringe(g,hr,.116,.0155,-.05,3.19,.044)}
  else if(style===4){hairCap(g,[[-.008,.011,.012],[.02,.017,.018],[.06,.019,.024],[.1,.016,.032],[.124,.014,.046],[.145,.014,.07],[.16,.014,1],[.176,.014,1],[.188,.012,1],[.195,.009,1]],hr);   // a bob, with a fringe swept across the brow
    fringe(g,lt,.128,.0145,-.05,3.19,0,.2)}
  else{hairCap(g,[[.03,.003,-.05],[.06,.005,-.034],[.09,.006,-.016],[.112,.007,.01],[.128,.008,.036],[.145,.008,.06],[.16,.009,1],[.174,.009,1],[.186,.008,1],[.194,.007,1]],hr);      // drawn back off the face
    if(style===2){g.sph(.014,'#3a2a20',0,.132,-.098,1,1,1,6,4);g.loft([[.135,.012,.012,0,-.1],[.11,.02,.017,0,-.114],[.06,.019,.016,0,-.117],[.01,.015,.012,0,-.11],[-.035,.006,.006,0,-.104]],hr,7,'both')}   // ponytail
    else g.ell(.034,.03,.03,hr,0,.158,-.092,.3,0,0,8,6)}                                                                                                                     // bun
}
const _hc=new THREE.Color(),_t1=new THREE.Color();
function drawHead(g,o,skin){
  const hc=o.head||skin,st=o.helmStyle,hr=o.hair,fem=o.build==='f',husk=!!o.husk,face=!(o.helm&&(st==='mask'||st==='exo'));
  const f={nose:fem?.86:1,lip:fem?1.35:1,brow:husk?.003:fem?.0004:.002,husk,jaw:fem?.92:husk?.95:1};
  const lip=husk?mix(hc,'#2a1416',.6):mix(hc,'#a04640',fem?.62:.46),lipD=shade(lip,.45),browC=husk?null:hr?mix(shade(hr,.6),hc,.1):shade(hc,.6),sock=husk?'#2c2622':mix(shade(hc,.74),'#6a3a30',.25),
    blush=mix(hc,'#c8665a',.5),scalp=hr?shade(hr,.74):null,stub=!fem&&!husk&&!o.beard?mix(hc,hr?shade(hr,.8):'#4a4038',.5):null,sinA=a=>Math.sin(a);
  const hairline=a=>{const s=sinA(a);return s>0?.108+.057*Math.pow(s,.7):.108-.078*Math.pow(-s,1.2)};
  g.loft(HYS.map(y=>headRing(y,f.jaw)),hc,20,'both',{front:.6,
    warp:(p)=>{const k=clamp01((p[2]-.015)/.03);if(k>0)p[2]+=relief(p[0],p[1],f)*k},
    paint:(p,a)=>{const x=p[0],y=p[1],ax=Math.abs(x);_hc.set(hc);
      if(p[2]>.03&&face){
        _hc.lerp(_t1.set(sock),(husk?.8:.5)*bell(ax-.03,.014)*bell(y-.1,.008));
        if(!husk)_hc.lerp(_t1.set(blush),.2*bell(ax-.04,.02)*bell(y-.068,.02));
        if(stub)_hc.lerp(_t1.set(stub),.2*clamp01((.058-y)/.02)*clamp01(1-1.6*bell(x,.02)*bell(y-.042,.014)));
        if(browC)_hc.lerp(_t1.set(browC),Math.min(1,1.25*bell(y-.118,.0045)*clamp01((ax-.006)/.005)*clamp01((.058-ax)/.012)));
        _hc.lerp(_t1.set(lip),Math.min(1,1.2*bell(x,.018)*(bell(y-.0375,.0034)+.9*bell(y-.0436,.003))));
        _hc.lerp(_t1.set(lipD),Math.min(1,1.15*bell(x,.021)*bell(y-.0405,.0008)))}
      if(husk&&o.gore&&face)_hc.lerp(_t1.set(BLOOD),Math.min(.9,1.3*bell(x-.034,.022)*bell(y-.058,.03)*clamp01((p[2]-.01)/.03)));
      if(scalp)_hc.lerp(_t1.set(scalp),(husk?.6:.92)*clamp01((y-hairline(a))/.012));
      return _hc}});
  for(const s of[-1,1])g.ell(.0065,.026,.0135,mix(shade(hc,.93),'#b0605a',husk?0:.12),s*(tab(HW,.089)+.0035),.089,-.011,0,s*.4,s*-.12,6,5);   // ears
  if(face){
    for(const s of[-1,1]){const ex=s*.0295,ey=.0995,ez=faceZ(ex,ey,f);
      if(husk){g.ell(.011,.005,.0042,'#c9c4ae',ex,ey,ez+.0003,0,0,0,6,4);g.ell(.0026,.0026,.0018,'#3a3a30',ex,ey,ez+.0036,0,0,0,5,3)}   // a dead, pale eye
      else{g.ell(.012,.005,.0042,'#bdb5a8',ex,ey,ez-.0002,0,s*.3,0,7,4);                                               // the eye, in the shade of the brow
        g.ell(.0052,.0052,.0022,mix(o.eye||'#4a3828','#0c0a08',.4),ex+s*.0008,ey+.0002,ez+.0025,0,s*.3,0,7,4);    // iris and pupil as one dark disc
        g.ell(.0138,.003,.005,shade(hc,.9),ex,ey+.0071,ez+.0012,0,s*.3,s*-.07,7,4);                               // the upper lid, resting on the top of the iris
        g.ell(.0126,.001,.0036,'#2a1e18',ex,ey+.005,ez+.0027,0,s*.3,s*-.07,7,3)}}                                  // lashes
    if(husk){g.ell(.014,.0075,.006,'#1c0c0c',0,.037,faceZ(0,.037,f)-.001,0,0,0,7,4);}
    else if(o.beard){const bc=shade(o.beard,.9);g.loft([[-.012,.003],[.002,.007],[.014,.009],[.026,.009],[.038,.008],[.05,.006],[.06,.002]].map(([y,k])=>frontCover(y,k,.028)),bc,12,'start');
      g.ell(.02,.0045,.006,bc,0,.05,faceZ(0,.05,f)+.001,0,0,0,7,4);g.ell(.012,.0026,.004,lip,0,.0385,faceZ(0,.0385,f)+.0075,0,0,0,6,3)}
  }
  const hairOn=()=>{if(hr)drawHair(g,hr,o.hairStyle||0,false)};
  if(o.helm){const c=o.helm,c2=o.helmC2||shade(c,1.25);
    if(st==='hood'){g.loft([cover(-.03,.022,-.004),cover(.02,.019,.02),cover(.07,.017,.034),cover(.12,.017,.05),cover(.148,.017,1),cover(.17,.017,1),cover(.187,.015,1),[.21,.012,.014,0,-.016]],c,14,'end');
      g.loft([[-.045,.092,.06,0,-.012,2.2,.07],[-.012,.07,.05,0,-.014,2.2,.06]],shade(c,.85),12,'none');
      // a pale fur roll round the face opening, so the hood reads as a hood and not as a head of hair the colour of the hide
      g.torus(.066,.011,'#d6c6a2',0,.1,.05,Math.PI/2-.12,0,0,14)}
    else if(st==='cap'){g.loft(shell(.134,.009,.004),c,14);g.ell(.05,.006,.04,shade(c,.8),0,.136,.066,.12,0,0,8,4);for(const s of[-1,1])g.ell(.008,.03,.02,shade(c,.9),s*(tab(HW,.1)+.006),.1,-.012,0,s*.3,0,6,4);if(hr)nape(g,hr)}
    else if(st==='visor'){g.loft(shell(.104,.016,.004),c,14);g.ell(.064,.04,.04,'#27343c',0,.086,.05,0,0,0,9,6);g.loft([cover(.02,.018,-.01),cover(.06,.018,-.004),cover(.104,.016,.0)],shade(c,.75),12,'none');
      // a pale band round the brim, a glint on the visor and a badge: at the size of the pack figure a plain dark shell read as a head of dark hair
      g.torus(.094,.008,'#aeb6bc',0,.118,.004,-.1,0,0,16);g.ell(.03,.008,.006,'#9fb4c4',-.018,.098,.085,0,0,-.25,7,3);g.ell(.014,.012,.006,'#d8dce0',0,.15,.084,-.5,0,0,6,3)}
    else if(st==='mask'){g.loft(HYS.map(y=>{const r=headRing(y);r[1]+=.012;r[2]+=.012;r[6]+=.012;return r}),c,14);for(const s of[-1,1]){g.sph(.02,'#1c2a30',s*.03,.1,.079,1,1,.5,7,5);g.sph(.009,'#8fc8d8',s*.034,.106,.088,1,1,.4,5,4)}g.cyl(.026,.03,.05,'#34383a',0,.04,.094,8,Math.PI/2)}
    else if(st==='furhat'){g.loft(shell(.122,.02,.004),c,14);g.loft([cover(.114,.03,1),cover(.142,.029,1)],c2,14,'none');for(const d of[-1,1])g.ell(.016,.05,.034,c2,d*(tab(HW,.08)+.012),.075,-.006,0,0,0,6,6)}
    else if(st==='combat'){g.loft(shell(.112,.015,.004),c,14);g.loft([cover(.106,.02,1),cover(.118,.017,1)],shade(c,.78),14,'none');g.box(.1,.028,.02,'#1c2024',0,.168,.068,-.5);for(const d of[-1,1]){g.sph(.019,'#3a5a6a',d*.026,.17,.08,1,.7,.5,6,4);g.box(.008,.09,.01,'#22262a',d*(tab(HW,.07)+.004),.06,.026)}if(hr)nape(g,hr)}
    else if(st==='gasmask'){hairOn();g.loft([-.008,.006,.03,.06,.09,.112,.124].map((y,i)=>frontCover(y,i>5?.004:.008,.012)),c,12,'start');for(const d of[-1,1]){g.sph(.019,'#1c2a30',d*.03,.1,.079,1,1,.5,7,5);g.sph(.008,'#8fc8d8',d*.034,.106,.088,1,1,.4,5,4);g.cyl(.022,.026,.045,'#5a5e58',d*.046,.03,.068,8,Math.PI/2,0,d*.5)}g.loft([cover(.122,.008,1),cover(.136,.008,1)],shade(c,.7),12,'none')}
    else if(st==='exo'){g.loft(HYS.map(y=>{const r=headRing(y);r[1]+=.014;r[2]+=.014;r[6]+=.014;return r}),c,14);g.box(.1,.014,.02,c2,0,.1,.086);g.box(.06,.05,.02,shade(c,.75),0,.045,.088);for(const d of[-1,1])g.box(.014,.05,.05,shade(c,.7),d*.082,.09,0);g.box(.02,.1,.1,shade(c,1.15),0,.2,-.02)}
    else if(st==='brim'){if(hr)nape(g,hr);g.loft([cover(.132,.012,1),cover(.168,.008,1),[.208,.058,.068,0,-.006],[.216,.03,.04,0,-.006]],c,14);g.cyl(.165,.165,.01,c,0,.138,-.004,16);g.loft([cover(.142,.014,1),cover(.156,.012,1)],c2,14,'none')}
    else if(st==='skull'){hairOn();g.loft([0,.03,.06,.09,.118,.14,.164].map((y,i)=>frontCover(y,i>5?.004:.009,.004)),c,12);for(const d of[-1,1])g.sph(.02,'#14100e',d*.028,.1,.082,1.1,1,.5,7,5);g.sph(.012,'#14100e',0,.072,.09,.8,1.2,.5,5,4);for(let i=0;i<5;i++)g.box(.008,.02,.008,'#f0e8d0',-.022+i*.011,.036,.086);g.box(.004,.05,.004,c2,.03,.15,.088,0,0,.3)}
    else if(st==='bandana'){if(hr)nape(g,hr);g.loft(shell(.138,.007,.004),c,14);g.loft([cover(.132,.01,1),cover(.146,.009,1)],shade(c,.88),14,'none');g.sph(.02,c,.008,.142,-.098,1,.7,.8,6,5);g.ell(.012,.03,.008,shade(c,.8),.022,.118,-.106,.2,0,.25,5,4);g.ell(.01,.026,.007,shade(c,.86),-.004,.116,-.108,.25,0,-.1,5,4)}
    else{g.loft(shell(.112,.014,.004),c,14);g.loft([cover(.106,.019,1),cover(.118,.016,1)],shade(c,.78),14,'none');g.loft([[.196,.006,.05,0,-.012,2.6],[.214,.005,.058,0,-.014,2.6],[.222,.003,.05,0,-.016,2.4]],c2,8,'end')}}
  else hairOn();
  if(o.mask&&!o.helm)g.loft([-.008,.006,.03,.058,.082].map((y,i)=>frontCover(y,i>3?.003:.006,.05)),o.mask,12,'start');
}

/** Humanoid. What it wears is what you see: with nothing on, the torso, legs and feet are bare skin and it stands in its underwear.
 *  o = {skin, hair, hairStyle 0..5, eye, beard, head (colour override), build 'm'|'f', fat, scale, husk, gore, lean, weapon, mask, scarf,
 *       top (shirt colour; null = bare chest), sleeves (long shirt sleeves),
 *       vest, vestStyle, vestC2 (body gear: vest | jacket | coat | duster | plate | riot | carrier | suit | exo | spiked),
 *       legs (trouser colour; null = underwear only), legStyle, legC2 (pants | wrap | greaves | guards | cargo | suit | exo | fur | chaps | kilt),
 *       boots (colour; null = barefoot), bootStyle, bootC2 (boots | wraps | heavy | rubber | fur | exo),
 *       glove, gloveStyle, gloveC2 (gloves | wraps | gauntlet | exo), helm, helmStyle, helmC2, pack, packSize 1..5}
 *  The body is skinned, not stacked: torso, pelvis, arms and legs are lofted through anatomical cross-sections (measured from a real figure of
 *  about 1.78 m scaled to 1.28 units), and clothes are shells that stand off that body with their own hems, cuffs and collars. */
const UNDER='#a8a294',GLOW='#8ff0ff',LONG={jacket:1,coat:1,duster:1,riot:1,carrier:1,suit:1,exo:1,plate:1};
// the skeleton's measures: hips above the ground, the waist joint above the hips, the shoulder above the hips, upper arm, forearm to the palm, thigh
const HY=.64,CY=.12,SY=.375,EL=.21,PALM=.225,KN=.3;
/** The rings of a list between two heights, with a ring made exactly at each end (so a sleeve or a boot top can stop anywhere). */
const cut=(R,from,to)=>{const out=[],val=(r,i)=>r[i]===undefined?(i===5?2:i===6?r[2]:0):r[i],at=(a,b,y)=>{const t=(y-a[0])/(b[0]-a[0]),r=[y];for(let i=1;i<7;i++)r.push(val(a,i)+(val(b,i)-val(a,i))*t);return r};
  for(let i=0;i<R.length;i++){const r=R[i],y=r[0];if(y>=from-1e-6&&y<=to+1e-6)out.push(r);
    if(i<R.length-1){const n=R[i+1],lo=Math.min(y,n[0]),hi=Math.max(y,n[0]);for(const c of[from,to])if(c>lo+1e-6&&c<hi-1e-6)out.push(at(r,n,c))}}
  const up=R[0][0]<R[R.length-1][0];return out.sort((a,b)=>up?a[0]-b[0]:b[0]-a[0])};
export function humanoid(o){
  const mat=newMat(),root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const fat=o.fat||1,skin=o.skin||'#e8bf9c',skinD=o.husk?shade(skin,.85):skin,P={},husk=!!o.husk;
  const shirt=o.top===null?null:(o.top||'#6a7a5a'),legs=o.legs===null?null:(o.legs||'#3a3f4a'),boots=o.boots===null?null:(o.boots||shade(legs||'#3a3f4a',.55));
  const bs=o.vest?o.vestStyle||'vest':null,v=o.vest,v2=o.vestC2||(v?shade(v,1.2):null),ls=legs?o.legStyle||'pants':null,l2=o.legC2||(legs?shade(legs,1.3):null),fs=boots?o.bootStyle||'boots':null,f2=o.bootC2||(boots?shade(boots,1.4):null),gs=o.glove?o.gloveStyle||'gloves':null,g2=o.gloveC2||(o.glove?shade(o.glove,1.3):null);
  // what the arms show: a long-sleeved garment, a shirt sleeve, or skin
  const longC=bs&&LONG[bs]?(bs==='riot'?v2:bs==='carrier'?v2:bs==='exo'?'#22242c':bs==='plate'?v2:v):null,upperC=longC||shirt,foreC=longC||(shirt&&o.sleeves?shirt:null),torsoC=shirt||longC;
  const fem=o.build==='f',sh=(fem?.9:1)*fat,wa=(fem?.85:1)*fat,hp=(fem?1.05:1)*fat,dz=fat,lf=Math.min(1.22,fat),baggy=bs==='suit'?1:0,lbag=ls==='suit'?.012:ls==='fur'?.009:0;
  const G0=.39,G1=.41,G2=.432,G3=.452,nk=fem?.9:husk?.94:1;   // heights of the shoulder girdle, the slope up to the neck and the neck's root
  // torso sections, hips to the base of the neck: [height above the hips, half width, depth of the front, , , squareness, depth of the back].
  // Waist at .15, the chest fullest at .315, the shoulder girdle at .39 sloping up to the neck: the arms grow out of its ends.
  const TORSO=[[.05,.111*(hp+wa)/2,.078*dz,0,0,2.3,.072*dz],[.1,.101*wa,.075*dz,0,0,2.3,.061*dz],[.15,.095*wa,.072*dz,0,0,2.3,.057*dz],[.2,.103*(wa*.6+sh*.4),.076*dz,0,0,2.4,.062*dz],[.26,.118*sh,.083*dz,0,0,2.5,.073*dz],
    [.315,.131*sh,.089*dz,0,0,2.5,.08*dz],[.355,.135*sh,.085*dz,0,0,2.5,.082*dz],[G0,.134*sh,.068*dz,0,-.002,2.4,.075*dz],[G1,.121*sh,.055*dz,0,-.003,2.3,.066*dz],[G2,.076*sh,.047,0,-.004,2.1,.056],[G3,.056*nk,.045*nk,0,-.005,2,.05*nk]];
  const PELVIS=[[-.08,.03*hp,.032*dz,0,-.006,2,.045*dz],[-.066,.076*hp,.054*dz,0,-.004,2.2,.076*dz],[-.052,.119*hp,.07*dz,0,-.002,2.3,.086*dz],[-.04,.127*hp,.077*dz,0,0,2.4,.092*dz],[-.012,.129*hp,.079*dz,0,0,2.4,.095*dz],[.035,.123*hp,.08*dz,0,0,2.4,.086*dz],[.075,.111*(hp+wa)/2,.079*dz,0,0,2.3,.072*dz],[.105,.101*wa,.075*dz,0,0,2.3,.061*dz]];
  const pelvisAt=y=>{let a=PELVIS[0],b=PELVIS[PELVIS.length-1];for(let i=1;i<PELVIS.length;i++)if(y<=PELVIS[i][0]){a=PELVIS[i-1];b=PELVIS[i];break}const t=clamp01((y-a[0])/((b[0]-a[0])||1)),m=i=>a[i]+(b[i]-a[i])*t;return[m(1),m(2),m(6),m(5)]};
  const nc=o.head||skin,NECK=[[.47,.047*nk,.045*nk,0,-.005,2,.047*nk,nc],[.5,.043*nk,.044*nk,0,-.002,2,.044*nk,nc],[.545,.043*nk,.045*nk,0,.005,2,.045*nk,nc]];   // the neck carries on from the shoulders in the same surface
  /** sections `from`..`to` of a ring list, stood off the body by `e` (and `ez` in depth), the lowest dropped by `dn`: the body of a garment */
  const off=(R,e,from,to,dn=0,ez=e)=>cut(R,from,to).map((r,i)=>[i?r[0]:r[0]-dn,r[1]+e,r[2]+ez,r[3]||0,r[4]||0,r[5]||2,(r[6]===undefined?r[2]:r[6])+ez]);
  const over=(k,from,to,dn=0)=>off(TORSO,(k-1)*.12+.004,from,to,dn,(k-1)*.09+.006);
  // how far forward the chest or belly reaches at a height (for buttons, plates and straps that sit on it)
  const front=y=>{let a=TORSO[0],b=TORSO[TORSO.length-1];for(let i=1;i<TORSO.length;i++)if(y<=TORSO[i][0]){a=TORSO[i-1];b=TORSO[i];break}const t=Math.max(0,Math.min(1,(y-a[0])/((b[0]-a[0])||1)));return a[2]+(b[2]-a[2])*t-.002};
  const halfW=y=>{let a=TORSO[0],b=TORSO[TORSO.length-1];for(let i=1;i<TORSO.length;i++)if(y<=TORSO[i][0]){a=TORSO[i-1];b=TORSO[i];break}const t=Math.max(0,Math.min(1,(y-a[0])/((b[0]-a[0])||1)));return a[1]+(b[1]-a[1])*t};
  // the chest's own relief: a bust or the pectorals in front, a belly on the heavy, the furrow of the spine behind. Garments over it follow it.
  const tw=(k=1)=>(p,a)=>{const x=p[0],y=p[1],f=Math.sin(a),ax=Math.abs(x);
    if(f>0){if(fem){const d=bell(ax-.052*sh,.036)*bell(y-.3,.034);p[2]+=.024*d*k;p[1]-=.006*d}else p[2]+=.007*k*f*bell(ax-.058*sh,.05)*bell(y-.31,.04);
      if(fat>1.1)p[2]+=(fat-1)*.17*f*f*bell(y-.13,.09)}
    else p[2]+=.006*k*bell(x,.022)*clamp01((y-.08)/.08)*clamp01((.4-y)/.06)-(fat>1.1?(fat-1)*.03*bell(y-.1,.08):0)};
  // the light and shade of a bare chest and belly, as a tint: the line down the middle, the fold under the chest, the collar bones
  const _fc=new THREE.Color(),_fd=new THREE.Color(shade(skin,.8)),_fl=new THREE.Color(shade(skin,1.07));
  const flesh=(p,a)=>{const x=p[0],y=p[1],ax=Math.abs(x);if(y>G3+.004)return null;_fc.set(skinD);if(Math.sin(a)>0){
      _fc.lerp(_fd,Math.min(.6,(fem?.1:.5)*bell(y-.268,.014)*bell(ax-.062*sh,.045)+.34*bell(x,.012)*clamp01((y-.1)/.05)*clamp01((.37-y)/.04)+(fem?0:.16)*bell(ax-.032,.008)*bell(y-.17,.05)));
      _fc.lerp(_fl,.5*bell(y-G0,.012)*bell(ax-.06*sh,.04))}
    else _fc.lerp(_fd,.3*bell(x,.014)*clamp01((y-.06)/.06)*clamp01((.4-y)/.05)+.16*bell(ax-.07*sh,.03)*bell(y-.3,.04));return _fc};
  const rosy=husk?null:mix(skinD,'#b45a48',.5),flush=(...at)=>husk?undefined:p=>{let w=0;for(let i=0;i<at.length;i+=2)w+=bell(p[1]-at[i],at[i+1]);return w>.06?mix(skinD,rosy,Math.min(.5,w*.34)):null};   // living skin is a little redder over the joints
  // a husk's wounds: dark stains soaked into whatever covers the chest, the flank and the back
  const stain=(p,a,base)=>{if(!o.gore)return null;const x=p[0],y=p[1],f=Math.sin(a)>0;
    const w=(f?bell(x+.05*fat,.045)*bell(y-.27,.05):0)+(o.gore>1?bell(x-.1*fat,.05)*bell(y-.16,.05)*(Math.abs(Math.sin(a))<.8?1:.3):0)+(o.gore>2&&!f?bell(x-.03,.06)*bell(y-.21,.05):0);
    return w>.2?mix(base,BLOOD,Math.min(.92,w*1.3)):null};
  // ---- one skin over the whole skeleton. Every part of the body is drawn into the same mesh, in the place it has when standing, and each
  // vertex is tied to the bones around it: fully to one bone along a limb, shared between two across a joint. So a bent elbow, knee, waist or
  // shoulder is a curve in one surface, not two tubes meeting.
  const SG=new Geo();SG.jit=0;SG.lift=false;const SI=[],SWT=[],BN={hips:0,chest:1,armL:2,elbowL:3,armR:4,elbowR:5,legL:6,kneeL:7,legR:8,kneeR:9};
  const bone=(parent,x,y,z)=>{const b=new THREE.Bone();b.position.set(x,y,z);parent.add(b);return b};
  const sm=(a,b,x)=>{let t=(x-a)/(b-a);t=t<0?0:t>1?1:t;return t*t*(3-2*t)};
  /** Draw into the skin at an offset; `wf(x,y,z)` (in the part's own coordinates) says which bones each new vertex follows: [bone, weight, ...] up to three. */
  const seg=(ox,oy,oz,wf,draw)=>{const i0=SG.pos.length/3;draw(SG);const n=SG.pos.length/3;for(let i=i0;i<n;i++){const k=i*3,w=wf(SG.pos[k],SG.pos[k+1],SG.pos[k+2]);SG.pos[k]+=ox;SG.pos[k+1]+=oy;SG.pos[k+2]+=oz;SI.push(w[0],w[2]||0,w[4]||0,0);SWT.push(w[1],w[3]||0,w[5]||0,0)}};
  const wTorso=(x,y)=>{const c=sm(.04,.2,y);return[BN.hips,1-c,BN.chest,c]};
  // what hangs below the hips (a coat's skirt, a kilt, a long hem) swings with the leg on its side
  const wSkirt=(x,y)=>{if(y>-.02)return wTorso(x,y);const d=.75*sm(-.02,-.16,y)*sm(.004,.03,Math.abs(x));return[BN.hips,1-d,x<0?BN.legL:BN.legR,d]};
  // an arm, measured down from the shoulder: the top sits in the chest, the elbow is at -.21
  const wArm=side=>(x,y)=>{const c=.75*sm(-.05,.04,y),e=sm(-EL+.05,-EL-.05,y);return[BN.chest,c,side<0?BN.armL:BN.armR,(1-c)*(1-e),side<0?BN.elbowL:BN.elbowR,(1-c)*e]};
  // a leg, measured down from the hip: the top sits in the pelvis, the knee is at -.3
  const wLeg=side=>(x,y)=>{const h=sm(-.1,.06,y),k=sm(-KN+.055,-KN-.055,y);return[BN.hips,h,side<0?BN.legL:BN.legR,(1-h)*(1-k),side<0?BN.kneeL:BN.kneeR,(1-h)*k]};
  // skeleton: body → hips (pelvis, legs) → chest at the waist (ribcage, head, arms), so the two halves can twist against each other
  P.hips=bone(body,0,HY,0);P.chest=bone(P.hips,0,CY,0);
  const cloth=torsoC&&bs!=='suit',tee=shirt&&!bs,ragged=husk||(tee&&!o.sleeves);
  // a hem that hangs unevenly (rags, and everything a husk still wears)
  const tatter=(amp,ring=0)=>(p,a,i)=>{if(i===ring)p[1]+=amp*(Math.sin(a*3+1.3)+.6*Math.sin(a*7+.4))};
  seg(0,HY,0,wTorso,g=>{
    // ---- pelvis: trousers or underwear
    // (the hips and seat are the tops of the two legs, so a stride bends one surface; here is only what closes the fork between them)
    const pc=legs||UNDER,pe=legs?.006+lbag:.002;
    g.loft([[-.08,.018*lf,.028*lf,0,-.002,2,.03*lf],[-.056,.034*lf,.054*lf+pe,0,0,2,.052*lf],[-.02,.034*lf,.062*lf+pe,0,0,2,.06*lf],[.01,.02*lf,.05*lf,0,0,2,.05*lf]],pc,8);
    if(legs&&!tee&&!(bs==='coat'||bs==='duster'||bs==='suit')){g.loft(off(PELVIS,pe+.005,.072,.108),shade(legs,.55),16,'none');g.box(.026,.024,.01,'#b8a060',0,.09,.081*dz+pe+.007)}                    // belt and buckle
    else if(!legs)g.loft(off(PELVIS,.005,.076,.108),shade(UNDER,.82),16,'none');                                                                                // waistband
    // ---- torso: skin, or the cloth worn next to it
    if(!torsoC)g.loft([...smoothRings(cut(TORSO,.09,1),1),...NECK],skinD,20,'none',{warp:tw(),paint:husk?(p,a)=>p[1]<G2?stain(p,a,skinD):null:flesh});
    else if(bs==='suit')g.loft([...TORSO.slice(9),...NECK],skinD,14,'none');
    else{const low=tee?[...off(TORSO,.019,.05,.05,.012),...off(TORSO,.014,.1,.1),...off(TORSO,.009,.15,.15),...off(TORSO,.007,.2,.2)]:off(TORSO,.006,.09,.2);   // a shirt worn loose hangs over the belt; under other gear it is tucked in
      g.loft([...low,...off(TORSO,.006,.26,G0),...off(TORSO,.009,G1,G1),[G2+.004,.087*sh,.057,0,-.004,2.1,.066]],torsoC,20,'none',{warp:(p,a,i)=>{tw()(p,a);if(ragged)tatter(.007)(p,a,i)},paint:o.gore?(p,a)=>stain(p,a,torsoC):undefined});
      g.loft([...TORSO.slice(8),...NECK],skinD,14,'none');                                                                                              // the skin of the shoulders inside the collar
      if(tee&&!husk)g.loft([[G2-.016,.098*sh,.058,0,-.004,2.2,.067],[G2+.006,.083*sh,.056,0,-.004,2.1,.064]],shade(shirt,1.14),14,'none')}                           // collar band
    if(!torsoC&&!bs&&!husk){g.sph(.005,shade(skin,.72),0,.15,front(.15)+.001,1,1.3,.5,5,4);if(fem)g.loft(smoothRings(off(TORSO,.004,.26,.355),1),UNDER,20,'none',{warp:tw()})}   // navel; a band for her
  });
  P.torso=new THREE.Object3D();   // (breathing used to scale this; the skin has no part of its own to scale)
  // ---- body gear, hems and all (drawn after the limbs' bones exist; see below)
  const SX=.134*sh,ab=bs==='suit'?.012:bs==='coat'?.012:bs==='duster'?.008:bs==='jacket'?.007:longC?.004:0;
  // ---- arms: one surface from inside the shoulder to the wrist. Deltoid, the swell of the upper arm, the elbow, the forearm's taper.
  const arm=side=>{const ax=side*SX,up=bone(P.chest,ax,SY-CY,0),el=bone(up,0,-EL,0),aw=wArm(side),k=lf,s=side;
    const ARM=[[.034,.005*k,.006*k,-s*.016],[.03,.018*k,.022*k,-s*.013],[.023,.029*k,.035*k,-s*.009],[.012,.037*k,.043*k,-s*.004],[0,.041*k,.047*k,-s*.001],[-.035,.043*k,.048*k,0],[-.08,.04*k,.045*k,0],[-.122,.036*k,.04*k,0,.001],[-.165,.034*k,.038*k,0,.002],[-.195,.03*k,.033*k,0,.001],
      [-.21,.029*k,.032*k,0,-.002],[-.235,.031*k,.033*k,0,0],[-.265,.033*k,.034*k,0,.001],[-.31,.029*k,.03*k,0,.001],[-.36,.022,.024,0,.001],[-.395,.017,.0215,0,.001],[-.407,.016,.021,0,.002]];
    const sl=(e,from,to)=>cut(ARM,from,to).map(r=>[r[0],r[1]+e,r[2]+e,r[3]||0,r[4]||0]);
    const hem=upperC&&!foreC?-.128:0;                                                 // a short sleeve ends on the upper arm
    seg(ax,HY+SY,0,aw,g=>{
      const gl=gs&&gs!=='wraps',hc=husk||!gl?skinD:o.glove,he=gl?.002:0;
      if(!upperC)g.loft(ARM,skinD,10,'start',{paint:flush(-EL,.03)});
      else if(!foreC){g.loft(sl(0,-.407,-.08),skinD,10,'none',{paint:flush(-EL,.03)});                                                                                       // the bare arm below the sleeve
        g.loft([...sl(.005,-.08,.05),[-.105,.036*k+.007,.041*k+.007],[hem,.035*k+.0085,.04*k+.0085]].sort((a,b)=>b[0]-a[0]),upperC,10,'start',{warp:ragged?tatter(.006,5):undefined});
        if(!husk)g.loft([[hem+.012,.035*k+.009,.04*k+.009],[hem-.002,.035*k+.0095,.04*k+.0095]],shade(upperC,.84),10,'none')}                          // sleeve hem
      else{const e=.004+ab;g.loft([...sl(e,-.36,.05),[-.385,.02+e*.8,.0235+e*.8,0,.001]],foreC,10,'start');
        if(!gl)g.loft(sl(0,-.407,-.36),skinD,10,'none')}
      // ---- the hand: it hangs relaxed with the palm to the thigh, the fingers half curled, the thumb forward
      const HAND=[[-.397,.0165+he,.0215+he,0,.001,2.4],[-.412,.0135+he,.026+he,0,.003,2.6],[-.432,.0125+he,.03+he,-s*.001,.004,2.7],[-.456,.0118+he,.03+he,-s*.004,.004,2.7],[-.476,.0108+he,.028+he,-s*.009,.003,2.7],[-.494,.0098+he,.0255+he,-s*.016,.002,2.6],[-.507,.0082+he,.021+he,-s*.023,.001,2.4]];
      g.loft(HAND,hc,8,'end',hc===skinD?{paint:flush(-.47,.03)}:undefined);
      {const m=g.mark();g.loft([[0,.0078+he,.0085+he],[-.02,.0076+he,.008+he],[-.04,.006+he,.0062+he]],hc,6,'both');g.turn(m,-.62,0,s*.2,-s*.003,-.418,.028)}   // thumb
      if(husk){const m=g.mark();g.loft([[0,.006,.006],[-.03,.003,.003]],shade(skinD,.7),5,'end');g.turn(m,0,0,-s*.5,-s*.02,-.5,.012)}
      // ---- what is worn on the arm
      if(bs==='exo'){g.box(.014,.16,.028,v,s*.046,-.1,0);g.sph(.014,v2,s*.048,-.02,0,1,1,1,5,4);g.loft(sl(.008,-.36,-.24),v,10,'none');g.box(.01,.1,.012,v2,s*.04,-.3,0)}
      if(bs==='spiked'&&side>0)g.loft(sl(.006,-.122,-.08),v,10,'none');
      if(bs==='riot'||bs==='carrier')g.ell(.03,.036,.026,bs==='riot'?v:'#2a2e28',0,-.212,-.016,0,0,0,7,5);                                             // elbow pad
      if(bs==='plate'&&side<0)g.loft(sl(.008,-.36,-.265),v,10,'none');
      if(bs==='coat')g.loft([[-.345,.034,.035,0,.001],[-.39,.03,.032,0,.001]],v2,10,'none');
      if(bs==='suit')g.loft([[-.362,.034,.036,0,.001],[-.39,.03,.032,0,.001]],'#8a8c88',10,'none');
      if(bs==='jacket')g.loft([[-.358,.0305,.0325,0,.001],[-.388,.0285,.031,0,.001]],shade(v,.62),10,'none');
      if(gs==='gauntlet'||gs==='exo'){g.loft([[-.3,.037,.038,0,.001],[-.36,.029,.03,0,.001],[-.4,.022,.026,0,.001]],o.glove,10,'none');g.loft([[-.305,.041,.042,0,.001],[-.36,.033,.034,0,.001],[-.392,.027,.03,0,.001]],g2,10,'none',{arc:s>0?[-1,1]:[Math.PI-1,Math.PI+1]})}
      else if(gs==='gloves')g.loft([[-.37,.0245,.027,0,.001],[-.4,.021,.025,0,.001]],shade(o.glove,.8),10,'none');
      else if(gs==='wraps'){g.loft([[-.372,.0215,.0245,0,.001],[-.4,.018,.0235,0,.002],[-.42,.0145,.028,0,.003,2.6],[-.446,.014,.032,-s*.002,.004,2.7],[-.458,.013,.0315,-s*.004,.004,2.7]],o.glove,8,'none')}
      if(gs==='exo')g.sph(.01,g2,0,-.44,.03,1.6,1,.6,5,4);
    });return[up,el]};
  [P.armL,P.elbowL]=arm(-1);[P.armR,P.elbowR]=arm(1);
  // ---- legs: one surface from inside the pelvis to the ankle. The thigh's fullness, the knee, a calf behind the shin.
  const leg=side=>{const s=side,lx=s*.065*hp,th=bone(P.hips,lx,0,0),kn=bone(th,0,-KN,0),lw=wLeg(side),k=lf;
    // the top of a leg is half the pelvis: from the waist down its outer side is the hip, its back the seat, and the two meet in the middle
    const lobe=(y,out,f,b,n)=>{const i=-.032,c=(out+i)/2;return[y,(out-i)/2,f*dz,s*c-lx,0,n,b*dz]};
    const LEG=[lobe(.1,.1*wa,.075,.06,2.4),lobe(.075,.111*(hp+wa)/2,.079,.072,2.4),lobe(.04,.122*hp,.08,.086,2.4),lobe(-.01,.129*hp,.079,.095,2.3),[-.06,.0625*k,.074*k,-s*.003,.001,2.2,.09*k],[-.12,.06*k,.069*k,-s*.002,.004,2,.08*k],[-.19,.054*k,.061*k,-s*.005,.005,2,.068*k],[-.25,.047*k,.051*k,-s*.008,.004],[-.285,.042,.045,-s*.009,.004],
      [-.305,.04,.044,-s*.01,.006],[-.33,.038,.041,-s*.01,.002],[-.38,.041,.046,-s*.009,-.007],[-.44,.036,.04,-s*.009,-.007],[-.5,.0285,.031,-s*.01,-.004],[-.55,.0245,.0275,-s*.01,-.002],[-.585,.0255,.03,-s*.01,-.001]];
    // above the crotch the two legs together keep to the outline of the pelvis
    const hip=e=>p=>{const y=p[1];if(y<-.06)return;const[W,Df,Db,n]=pelvisAt(y),X=Math.min(1,Math.abs(p[0]+lx)/(W+e)),zm=((p[2]>=0?Df:Db)+e)*Math.pow(Math.max(0,1-Math.pow(X,n)),1/n);if(Math.abs(p[2])>zm)p[2]+=(Math.sign(p[2])*zm-p[2])*sm(-.06,.02,y)};
    const ll=(e,from,to,eb=e)=>cut(LEG,from,to).map(r=>{const t=clamp01((-r[0]-.2)/.25),ee=e+(eb-e)*t;return[r[0],r[1]+ee,r[2]+ee,r[3]||0,r[4]||0,r[5]||2,(r[6]===undefined?r[2]:r[6])+ee]});
    const FR=Math.PI/2,plate=(g,e,from,to,col,half=1.05,mid=FR)=>g.loft(ll(e,from,to),col,10,'none',{arc:[mid-half,mid+half]});   // a plate bent round part of the leg
    const tall=fs&&fs!=='wraps',top=fs==='rubber'?-.37:fs==='heavy'||fs==='exo'?-.41:fs==='fur'?-.42:-.435;   // where a boot's shaft ends
    seg(lx,HY,0,lw,g=>{
      if(!legs){g.loft(ll(0,-.585,-.12),skinD,12,'none',{paint:flush(-.305,.035,-.6,.04)});g.loft(ll(.002,-.12,.1),UNDER,12,'start',{warp:hip(.002)});g.loft([[-.106,.06*k+.0035,.069*k+.0035,-s*.002,.003,2,.074*k+.0035],[-.121,.06*k+.004,.069*k+.004,-s*.002,.004,2,.073*k+.004]],shade(UNDER,.86),12,'none')}   // bare legs in close shorts
      else{const tight=ls==='wrap'||ls==='kilt',e=tight?.003:.004+lbag,eb=tight?.003:ls==='chaps'?.012:.011+lbag,end=tall?top-.02:ragged&&ls==='pants'?-.53:-.56;
        g.loft(ll(e,end,.1,eb),legs,12,'start',{warp:(p,a)=>{hip(e)(p);if(ragged&&!tall&&p[1]<end+.001)p[1]+=.008*(Math.sin(a*3+1.3)+.6*Math.sin(a*7+.4))}});
        if(!tall)g.loft(ll(0,-.585,end+.03),skinD,10,'none')}
      // ---- what is worn on the leg
      if(ls==='greaves'||ls==='guards'){plate(g,.012,-.25,-.06,l2,ls==='guards'?1.25:.95);plate(g,.011,-.25,-.12,shade(l2,.8),.5,s>0?0:Math.PI);g.sph(.034,shade(l2,1.1),-s*.01,-.305,.034,1,1.05,.8,8,6);plate(g,.011,-.5,-.33,l2,ls==='guards'?1.3:1.1)}
      if(ls==='cargo'){plate(g,.02,-.25,-.12,shade(legs,.84),.55,s>0?0:Math.PI);plate(g,.023,-.12,-.06,shade(legs,.66),.6,s>0?0:Math.PI);g.sph(.033,'#2a2e28',-s*.01,-.305,.034,1,1,.8,8,6)}
      if(ls==='chaps'){g.loft(ll(.012,-.5,-.07,.016),l2,12,'none',{arc:s>0?[-1.9,2.2]:[.94,5.04]});g.sph(.032,shade(l2,.8),-s*.01,-.305,.04,1,1,.7,8,6)}
      if(ls==='exo'){g.box(.014,.23,.028,l2,s*.064,-.15,0);g.sph(.018,GLOW,s*.066,-.02,0,1,1,1,5,4);g.box(.014,.2,.026,l2,s*.046,-.42,0);g.sph(.032,l2,-s*.01,-.305,.036,1,1,.8,8,6);g.sph(.012,GLOW,-s*.01,-.305,.062,1,1,.6,5,4);plate(g,.011,-.5,-.33,l2,1)}
      if(ls==='wrap')for(const y of[-.1,-.2,-.37,-.44])g.loft(ll(.0065,y-.011,y+.011),l2,12,'none');
      if(ls==='fur')g.loft([[-.5,.046,.048,-s*.01,-.004],[-.55,.043,.045,-s*.01,-.002]],l2,10,'none');
      if(ls==='suit')g.loft([[-.515,.044,.046,-s*.01,-.004],[-.54,.042,.044,-s*.01,-.002]],'#8a8c88',10,'none');
      // ---- the foot: bare, bound in cloth, or in a boot
      const foot=(col,e,sole)=>{const m=g.mark(),w=e*1.2,lip=sole?.004:0;   // drawn lying along Y (heel to toe) and then laid down: its +Z is the sole
        g.loft([[-.046,.014+w,.012+e,0,-.022,2.4,.014+e],[-.034,.024+w+lip,.026+e*.5,0,-.026,2.5,.032+e],[-.004,.027+w+lip,.03+e*.5,0,-.03,2.6,.037+e],[.036,.031+w+lip,.025+e*.5,0,-.025,2.6,.026+e],[.076,.035+w+lip,.016+e*.5,0,-.016,2.7,.016+e*1.6],
          [.106,.035+w+lip,.011+e*.5,s*.002,-.011,2.6,.011+e*2.1],[.129+e,.021+w,.006+e*.4,s*.001,-.007,2.2,.006+e*1.6]],col,8,'both',sole?{paint:p=>p[2]>.006?sole:null}:undefined);
        g.turn(m,Math.PI/2,s*.1,0,-s*.01,-.64,0)};
      if(!boots){foot(skinD,0);for(let i=0;i<5;i++)g.ell(.0066-i*.0006,.0056,.009,skinD,-s*.01+s*(-.024+i*.0122)+(.124-i*.004)*Math.sin(s*.1),-.6335,.124-i*.0045+(i?0:.002),0,s*.1,0,5,3)}
      else if(fs==='wraps'){foot(boots,.004);for(const y of[-.52,-.555])g.loft([[y+.011,.03,.033,-s*.01,-.003],[y-.011,.0285,.0315,-s*.01,-.002]],f2,10,'none');g.loft([[-.575,.031,.036,-s*.01,.004],[-.612,.034,.04,-s*.01,.018]],f2,10,'none')}
      else{foot(boots,fs==='heavy'||fs==='exo'?.008:fs==='fur'?.007:.005,shade(boots,.5));
        const se=fs==='rubber'?.012:fs==='fur'?.012:.008;g.loft([...ll(se,-.585,top),[-.61,.031+se,.036+se,-s*.01,.002]],boots,10,'none');                // the shaft
        if(fs==='fur')g.loft([[top+.02,.05,.056,-s*.009,-.006],[top-.02,.052,.058,-s*.009,-.006]],f2,10,'none');
        else g.loft(ll(se+.004,top-.016,top+.004),fs==='rubber'?shade(boots,.8):shade(boots,1.3),10,'none');   // the cuff
        if(fs==='heavy'||fs==='exo'){g.sph(.034,f2,-s*.008+.098*Math.sin(s*.1),-.613,.1,1.12,.7,1.02,8,6);plate(g,se+.008,-.56,top-.02,f2,.9)}
        if(fs==='exo')g.box(.07,.008,.012,GLOW,-s*.01,-.59,.07)}
    });return[th,kn]};
  [P.legL,P.kneeL]=leg(-1);[P.legR,P.kneeR]=leg(1);
  // ---- what is worn on the body: each garment is its own shell with its own hem, collar and trim
  const fz=y=>front(y)+.012,strap=(g,x,y0,y1,w,c,e=.012)=>{for(let i=0;i<5;i++){const t0=i/5,t1=(i+1)/5,ya=y0+(y1-y0)*t0,yb=y0+(y1-y0)*t1,ym=(ya+yb)/2,za=front(ya)+e,zb=front(yb)+e;g.box(w,Math.hypot(yb-ya,zb-za)+.006,.007,c,x,ym,(za+zb)/2,Math.atan2(zb-za,yb-ya))}};
  seg(0,HY,0,wSkirt,g=>{
    const T=(e,from,to,dn=0)=>smoothRings(off(TORSO,e,from,to,dn),1),SK=(e,from)=>off(PELVIS,e,from,.08);
    if(ls==='kilt'){g.loft([[-.2,.15*hp,.11*dz,0,0,2.3,.118*dz],[-.1,.142*hp,.1*dz,0,0,2.3,.11*dz],[-.01,.131*hp,.09*dz,0,0,2.4,.1*dz],[.09,.113*wa,.084*dz,0,0,2.3,.074*dz]],l2,16,'none',{warp:(p,a,i)=>{const r=1+.035*Math.sin(a*9)*(i<2?1:.3);p[0]*=r;p[2]*=r}});
      g.loft([[.07,.119*(hp+wa)/2,.086*dz,0,0,2.3,.08*dz],[.1,.11*wa,.083*dz,0,0,2.3,.071*dz]],shade(l2,.6),16,'none');for(let i=0;i<7;i++){const a=(i-3)*.42;g.sph(.008,'#8a8f96',Math.sin(a)*.118*hp,.085,Math.cos(a)*.085*dz+.004,1,1,.6,5,3)}}
    if(ls==='wrap'){g.loft([[-.15,.03,.006,0,.076*dz,2.4,.004],[-.1,.046,.008,0,.078*dz,2.6,.004],[-.02,.052,.01,0,.078*dz,2.6,.004],[.085,.046,.01,0,.074*dz,2.6,.004]],shade(legs,.84),8,'start',{warp:tatter(.006,0)});g.loft([[.06,.121*(hp+wa)/2+.006,.088*dz,0,0,2.3,.082*dz],[.095,.111*wa+.007,.085*dz,0,0,2.3,.074*dz]],l2,16,'none')}   // a flap in front, a hide belt
    if(bs==='vest'){   // a hide vest: sleeveless, open down the front, trimmed with fur at the shoulders and hem
      g.loft(T(.011,.1,G1,.015),v,20,'none',{arc:[1.92,7.5],warp:(p,a,i)=>{tw()(p,a);tatter(.006)(p,a,i)}});
      g.loft([[G1,.106*sh,.062*dz,0,-.003,2.2,.072*dz],[G2,.084*sh,.055,0,-.004,2.1,.064]],v,16,'none',{arc:[2.2,7.22]});
      g.loft(T(.016,.085,.115),v2,20,'none',{arc:[1.92,7.5],warp:tatter(.005)});
      for(const a0 of[1.84,7.36])g.loft(T(.0155,.1,G1,.012),v2,2,'none',{arc:[a0,a0+.22],warp:(p,a)=>tw()(p,a)});
      for(const d of[-1,1]){g.ell(.036,.018,.05,v2,d*(SX-.006),SY+.03,0,0,0,d*-.5,8,5);for(let i=0;i<3;i++)g.box(.05,.006,.006,shade(v,.55),0,.19+i*.06,front(.19+i*.06)+.008,0,0,d*.45)}}
    else if(bs==='jacket'){   // a leather jacket: cut to the waist, with a lined stand collar, a zip, a yoke, knit hem and cuffs
      g.loft(smoothRings([...off(TORSO,.021,.112,.2),...off(TORSO,.012,.26,G1)],1),v,20,'none',{warp:tw(.8)});
      g.loft([[G1,.108*sh,.064*dz,0,-.003,2.2,.074*dz],[G2,.086*sh,.057,0,-.004,2.1,.066],[G3+.005,.066,.055,0,-.005,2,.062],[G3+.03,.06,.056,0,-.004,2,.061]],mix(v,'#d8c8a8',.55),14,'none',{arc:[1.8,7.62]});
      g.loft(off(TORSO,.025,.108,.142),shade(v,.62),20,'none');
      g.loft([[.35,.135*sh+.014,.09*dz,0,0,2.5,.09*dz],[G0+.004,.134*sh+.012,.074*dz,0,-.002,2.4,.082*dz],[G1+.004,.118*sh+.008,.06*dz,0,-.003,2.3,.072*dz]],shade(v,1.14),18,'none');   // the yoke across the shoulders
      strap(g,0,.14,G2,.01,'#8a8478',.016);for(const d of[-1,1]){g.ell(.03,.006,.008,shade(v,.66),d*.062,.22,front(.22)+.014,0,0,d*-.15,6,3);g.ell(.03,.006,.03,shade(v,.8),d*(SX-.03),G1+.004,0,0,0,d*-.4,6,3)}}
    else if(bs==='coat'){   // a fur coat: thick, to mid thigh, with a deep collar and fur at the hem
      g.loft([[-.16,.146*hp,.106*dz,0,0,2.4,.112*dz],...SK(.02,-.05),...T(.018,.1,G1)],v,20,'none',{warp:tw(.6)});
      g.loft([[-.18,.15*hp,.11*dz,0,0,2.4,.116*dz],[-.14,.149*hp,.109*dz,0,0,2.4,.115*dz]],v2,18,'none');
      g.loft([[G0+.012,.118*sh,.07*dz,0,-.002,2.2,.08*dz],[G2,.094*sh,.068,0,-.004,2.1,.074],[G3+.022,.074,.066,0,-.004,2,.07]],v2,14,'none');
      strap(g,0,-.12,.38,.014,shade(v,.6),.022);for(const d of[-1,1])g.sph(.012,shade(v,.6),d*.022,.28,front(.28)+.022,1,1,.6,5,4)}
    else if(bs==='duster'){   // a long duster: to the knee, a cape over the shoulders, a bandolier
      g.loft([[-.27,.156*hp,.112*dz,0,-.008,2.4,.122*dz],[-.14,.146*hp,.104*dz,0,-.004,2.4,.114*dz],...SK(.016,-.03),...T(.014,.1,G1)],v,20,'none',{warp:tw(.7)});
      g.loft([[.32,.176*sh,.108*dz,0,0,2.4,.1*dz],[.375,.178*sh,.092*dz,0,0,2.4,.094*dz],[G1+.004,.112*sh,.066,0,-.003,2.2,.076],[G3+.012,.064,.056,0,-.005,2,.064]],shade(v,.84),16,'none');
      for(let i=0;i<5;i++){const t=i/4,y=.34-t*.24;g.box(.05,.07,.01,v2,-.085+t*.17,y,front(y)+.02,0,0,.62);g.cyl(.007,.007,.028,'#c8a040',-.085+t*.17,y,front(y)+.03,5)}}
    else if(bs==='plate'){   // scrap plate: a beaten breastplate strapped over a shirt, one big pauldron, rust
      g.loft(T(.02,.15,.355,.0).map(r=>(r[5]=2.9,r)),v,18,'none',{warp:tw(.4),paint:(p,a)=>{const r=Math.sin(a)>0?bell(p[0]-.05,.04)*bell(p[1]-.29,.035)+bell(p[0]+.065,.035)*bell(p[1]-.2,.04):.8*bell(p[0]-.03,.06)*bell(p[1]-.22,.05);return r>.25?mix(v,'#7a4226',Math.min(.9,r*1.2)):null}});g.loft([[.355,.128*sh+.02,.107*dz,0,0,2.9,.103*dz],[G0+.006,.112*sh,.082*dz,0,-.002,2.5,.088*dz],[G1+.008,.092*sh,.064*dz,0,-.003,2.3,.074*dz]],shade(v,.9),18,'none');
      g.ell(.058,.034,.062,shade(v,1.12),-(SX+.012),SY+.022,0,0,0,.42,8,5);g.ell(.05,.02,.056,shade(v,.82),-(SX+.03),SY-.018,0,0,0,.75,8,4);g.ell(.04,.024,.048,shade(v,.9),SX+.008,SY+.022,0,0,0,-.4,7,4);
            for(let i=0;i<3;i++)g.box(.064,.05,.012,shade(v,.74),-.066+i*.066,.118,front(.118)+.014,.06);for(const[x,y]of[[-.07,.35],[.07,.35],[-.08,.2],[.08,.2]])g.sph(.007,shade(v,1.4),x,y,front(y)+.024,1,1,.6,4,3);
      }
    else if(bs==='riot'){
      g.loft(T(.017,.1,G1),v,20,'none',{warp:tw(.5)});for(const d of[-1,1])g.ell(.052,.03,.058,shade(v,1.22),d*(SX+.008),SY+.022,0,0,0,d*-.42,8,5);
      g.loft([[G1,.108*sh,.064*dz,0,-.003,2.2,.076*dz],[G2+.004,.084*sh,.058,0,-.004,2.1,.068],[G3+.024,.064,.058,0,-.004,2,.064]],v,14,'none');
      g.box(.12,.05,.01,'#c8ccd0',0,.31,front(.31)+.02,.05);for(let i=0;i<4;i++)g.box(.046,.044,.018,shade(v,.8),-.08+i*.053,.135,front(.135)+.022)}
    else if(bs==='carrier'){
      g.loft(T(.016,.14,.355),v,20,'none',{warp:tw(.4)});for(const d of[-1,1])g.loft([[.35,.03,.094*dz,d*.07*sh,0,2.6,.092*dz],[G0+.008,.03,.066*dz,d*.068*sh,-.002,2.6,.074*dz],[G1+.012,.028,.05*dz,d*.064*sh,-.003,2.6,.06*dz]],shade(v,.86),8,'none');
      for(let i=0;i<3;i++)g.box(.05,.07,.028,shade(v,.82),-.056+i*.056,.185,front(.185)+.03);g.box(.11,.05,.012,shade(v,1.16),0,.31,front(.31)+.022,.05);g.box(.034,.056,.028,'#22262a',-.085*sh,.345,front(.345)+.024);g.cyl(.004,.004,.07,'#22262a',-.085*sh,.4,front(.36)+.024,4)}
    else if(bs==='suit'){   // hazard suit: one loose skin from neck to hip, a chest unit and a hose
      g.loft([...SK(.022,-.06),...T(.018,.1,G1),[G2+.004,.088*sh,.06,0,-.004,2.1,.068],[G3+.02,.066,.06,0,-.004,2,.066]],v,20,'none',{warp:tw(.5)});
      strap(g,0,-.02,G1,.012,shade(v,.62),.02);g.box(.086,.066,.036,'#9a9c96',0,.3,front(.3)+.036);g.limb(.012,.012,.16,'#3a3c3a',.03,.33,front(.3)+.04,2.6,0,-.3,6);g.loft([[G3+.012,.072,.066,0,-.004,2,.07],[G3+.034,.068,.064,0,-.004,2,.068]],shade(v,.84),14,'none')}
    else if(bs==='exo'){
      g.loft(T(.018,.2,.355).map(r=>(r[5]=2.8,r)),v,18,'none',{warp:tw(.4)});g.loft([[.355,.128*sh+.018,.105*dz,0,0,2.8,.101*dz],[G0+.006,.112*sh,.08*dz,0,-.002,2.5,.086*dz],[G1+.008,.092*sh,.064*dz,0,-.003,2.3,.074*dz]],shade(v,.84),18,'none');
      g.sph(.022,v2,0,.31,front(.31)+.02,1,1,.6,8,6);g.sph(.034,shade(v,.7),0,.31,front(.31)+.012,1,1,.5,8,5);
      for(const d of[-1,1]){g.ell(.06,.034,.064,shade(v,1.15),d*(SX+.014),SY+.024,0,0,0,d*-.4,8,5);g.box(.05,.018,.1,shade(v,.8),d*(SX+.04),SY+.004,0,0,0,d*-.5);g.box(.044,.05,.012,shade(v,.86),d*.045,.15,front(.15)+.012)}
      for(let i=0;i<5;i++)g.box(.03,.04,.03,i%2?v:shade(v,.7),0,.14+i*.055,-.075*dz-.02);g.box(.014,.28,.014,v2,0,.26,-.075*dz-.036)}
    else if(bs==='spiked'){   // marauder harness: crossed straps on a bare chest, a spiked pauldron
      for(const d of[-1,1])for(let i=0;i<5;i++){const t=i/4,y=.14+t*.26;g.box(.026,.075,.008,v,d*(-.088+t*.176)*sh,y,front(y)+.008,0,0,d*-.58)}
      g.loft(T(.007,.1,.16),v,18,'none');g.ell(.06,.036,.064,v2,-(SX+.012),SY+.024,0,0,0,.42,8,5);for(let i=0;i<3;i++)g.cone(.014,.066,shade(v2,1.2),-(SX+.03)+i*.022,SY+.066-i*.004,-.03+i*.03,5,0,0,.5-i*.25);
      g.ell(.04,.02,.046,'#6a5a48',SX+.006,SY+.022,0,0,0,-.4,7,5);g.sph(.015,'#d8d0b8',0,.28,front(.28)+.012,1,1.1,.6,6,5)}
    if(o.pack){const p=o.pack,z=o.packSize||2,k=[.7,.88,1,1.08,1.16][z-1],bz=-.078*dz-.08*k-(bs?.012:0);g.ell(.118*k,.155*k*(z>4?1.2:1),.082*k,p,0,.24+(z>3?.02:0),bz,0,0,0,9,6);g.ell(.07*k,.06*k,.04*k,shade(p,1.2),0,.18,bz-.078*k,0,0,0,7,4);g.ell(.098*k,.034*k,.068*k,shade(p,.8),0,.385+(z>4?.05:0),bz+.012,0,0,0,8,4);
      for(const d of[-1,1])strap(g,d*.08*sh,.16,G1-.004,.022,shade(p,.7),bs?.022:.01);
      if(z>=3)g.cyl(.038,.038,.23,z>=4?'#5a5e4a':'#7a8a9a',0,.415+(z>4?.07:0),bz+.01,8,0,0,Math.PI/2);if(z>=4)for(const d of[-1,1])g.ell(.045,.054,.036,shade(p,.9),d*.115*k,.2,bz,0,0,0,6,5);if(z>=5){g.cyl(.03,.03,.05,'#8a8f96',.1,.35,bz-.06,7);g.box(.012,.4,.012,'#8a8f96',-.09,.29,bz+.05)}}
    if(o.scarf){g.loft([[G1+.006,.082,.064,0,-.004,2,.07],[G2+.01,.074,.068,0,-.003,2,.07],[G3+.022,.06,.06,0,-.002,2,.062]],o.scarf,12,'none');g.sph(.026,shade(o.scarf,.85),.03,G2,-.07,1,1,1,6,4)}
  });
  // ---- scarf tails: two strips that trail behind when running
  if(o.scarf){P.scarf=part(mat,g=>{g.sph(.03,o.scarf,-.022,-.13,0,.95,4.4,.36,7,6);g.sph(.027,shade(o.scarf,.82),.03,-.1,-.008,.95,3.7,.36,7,6)});P.scarf.position.set(.03,SY-CY+.06,-.07);P.scarf.rotation.x=.25;P.chest.add(P.scarf)}
  // ---- head (pivot at the top of the neck)
  P.head=part(mat,g=>drawHead(g,o,skin));P.head.position.set(0,1.108-HY-CY,.012);P.head.scale.setScalar(HEAD);P.chest.add(P.head);
  // ---- bind the skin to the skeleton as it stands now
  {const geo=SG.build();geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(SI,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(SWT,4));
    geo.boundingSphere.center.set(0,.7,0);geo.boundingSphere.radius=1.7;   // room for a lunge, a crawl or a body on the ground
    const skinMesh=new THREE.SkinnedMesh(geo,mat);skinMesh.castShadow=true;body.add(skinMesh);root.updateMatrixWorld(true);
    skinMesh.bind(new THREE.Skeleton([P.hips,P.chest,P.armL,P.elbowL,P.armR,P.elbowR,P.legL,P.kneeL,P.legR,P.kneeR]));P.skin=skinMesh}
  const hand=grp(P.elbowR,0,-PALM,.012);hand.rotation.x=Math.PI/2;
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
  let direct=0,legZ=0;
  // ---- at rest a person does not stand to attention: the weight settles on one leg, the other knee goes easy, and the hips and shoulders tilt against each other
  {const rest=!husk&&!crawl&&v<.2&&!(s.atk>=0)&&!s.act&&!s.gun&&!s.sneak&&!(s.wind>0)&&!s.stun?1:0;rig.wRest=damp(rig.wRest===undefined?rest:rig.wRest,rest,5,dt);
    const rs=rig.wRest*idle,side=sd>3?1:-1;
    if(rs>.001){hipsRoll+=side*.055*rs;legZ=-side*.055*rs;chestRoll-=side*.075*rs;bodyX+=side*.014*rs;bodyY-=.004*rs;hipsYaw+=side*.07*rs;chestYaw-=side*.05*rs;
      if(side>0){legL-=.2*rs;knL+=.2*rs}else{legR-=.2*rs;knR+=.2*rs}
      elL-=.1*rs;elR-=.07*rs;armL+=side*.05*rs;armR-=side*.05*rs}}
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
  set(P.legL,'x',legL,rc);set(P.legR,'x',legR,rc);set(P.kneeL,'x',knL,rc);set(P.kneeR,'x',knR,rc);set(P.legL,'z',legZ,rc);set(P.legR,'z',legZ,rc);
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

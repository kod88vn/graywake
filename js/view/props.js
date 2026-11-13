// Procedural low-poly models. PROPS: one drawing function per world object (see js/data/objects.js), HAND: held weapons (js/data/items.js `mdl`).
// Every function draws into the Geo it is given. Y up, model stands on y=0, tile is 1×1 on the origin, front faces +Z. `v` (0..2) varies nature and clutter.
import {shade,mix,THREE} from './geo.js';

const PI=Math.PI,T=PI*2,H2=PI/2;
const C={bark:'#5e4630',log:'#7d5c3a',wood:'#8f6e46',woodD:'#6a4e30',woodL:'#ad8c5c',plank:'#a07e50',stone:'#8e8e88',stoneD:'#6c6c68',stoneL:'#acaca4',conc:'#9c9d98',brick:'#9c5642',
  rust:'#8c4a2a',steel:'#7e868e',steelD:'#535a62',steelL:'#a8b1b9',iron:'#5c6168',titan:'#b4c6d6',leaf:'#4f7a38',olive:'#687238',sand:'#c9b27a',dirt:'#6e5438',soil:'#4c3828',
  cloth:'#b9aa8a',canvas:'#a3945f',hide:'#a9794f',straw:'#cfae52',red:'#b9382c',yel:'#dcb224',orange:'#dc762a',amber:'#f2a432',fire:'#f26c1e',flame:'#ffd44a',teal:'#3aa090',
  violet:'#8a5ad2',violetL:'#b890f4',gray:'#7c728a',grayD:'#544c62',white:'#e6e4dc',black:'#27272b',glass:'#9ccada',water:'#3c84ac',bone:'#ded8c2',rubber:'#2d2d31',green:'#3c8c4c',blue:'#3c6caa',copper:'#c8783a'};

// ---------- helpers ----------
const V=(v,a,b,c)=>v===1?b:v===2?c:a;                                    // pick by variant
const rot=(x,z,a)=>[x*Math.cos(a)-z*Math.sin(a),x*Math.sin(a)+z*Math.cos(a)];
const ring=(n,r,f,a0=0)=>{for(let i=0;i<n;i++){const a=a0+i/n*T;f(Math.cos(a)*r,Math.sin(a)*r,a,i)}};
/** Run fn, then scale / rotate (Y, then X, then Z) / move everything it drew: lets a sub-model be authored in its own frame. */
const at=(g,x,y,z,ry,fn,s=1,rx=0,rz=0)=>{const i0=g.pos.length;fn();const p=g.pos,c=Math.cos(ry),n=Math.sin(ry),cx=Math.cos(rx),nx=Math.sin(rx),cz=Math.cos(rz),nz=Math.sin(rz);
  for(let i=i0;i<p.length;i+=3){let X=p[i]*s,Y=p[i+1]*s,Z=p[i+2]*s,t=X*c+Z*n;Z=-X*n+Z*c;X=t;t=Y*cx-Z*nx;Z=Y*nx+Z*cx;Y=t;t=X*cz-Y*nz;Y=X*nz+Y*cz;X=t;p[i]=X+x;p[i+1]=Y+y;p[i+2]=Z+z}
  const q=g.nor;if(q)for(let i=i0;i<q.length;i+=3){let X=q[i],Y=q[i+1],Z=q[i+2],t=X*c+Z*n;Z=-X*n+Z*c;X=t;t=Y*cx-Z*nx;Z=Y*nx+Z*cx;Y=t;t=X*cz-Y*nz;Y=X*nz+Y*cz;X=t;q[i]=X;q[i+1]=Y;q[i+2]=Z}};
/** Cylinder starting at (x,y,z), length L, leaning `tilt` from vertical toward heading `hd` (0=+X, PI/2=+Z). Returns its tip. */
const limb=(g,rt,rb,L,c,x,y,z,tilt=0,hd=0,seg=5)=>{const sx=Math.sin(tilt)*Math.cos(hd),sz=Math.sin(tilt)*Math.sin(hd),cy=Math.cos(tilt);g.cyl(rt,rb,L,c,x+sx*L/2,y+cy*L/2,z+sz*L/2,seg,0,-hd,-tilt);return[x+sx*L,y+cy*L,z+sz*L]};
const spike=(g,r,L,c,x,y,z,tilt=0,hd=0,seg=4)=>{const sx=Math.sin(tilt)*Math.cos(hd),sz=Math.sin(tilt)*Math.sin(hd),cy=Math.cos(tilt);g.cone(r,L,c,x+sx*L/2,y+cy*L/2,z+sz*L/2,seg,0,-hd,-tilt);return[x+sx*L,y+cy*L,z+sz*L]};
/** Box whose top face is tw×td and bottom bw×bd (roofs, cabins, hoppers, barriers). Centred like box. */
const _fr=new Map();
const frus=(g,bw,bd,tw,td,h,c,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const a=Math.max(tw/bw,.001),b=Math.max(td/bd,.001),k=a.toFixed(3)+'_'+b.toFixed(3);let ge=_fr.get(k);
  if(!ge){const P=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5],[-.5*a,.5,-.5*b],[.5*a,.5,-.5*b],[.5*a,.5,.5*b],[-.5*a,.5,.5*b]],p=[];
    for(const[q,r,s,t]of[[3,2,6,7],[1,0,4,5],[2,1,5,6],[0,3,7,4],[7,6,5,4],[0,1,2,3]])for(const i of[q,r,s,q,s,t])p.push(...P[i]);
    ge=new THREE.BufferGeometry();ge.setAttribute('position',new THREE.Float32BufferAttribute(p,3));_fr.set(k,ge)}
  return g.add(ge,c,x,y,z,rx,ry,rz,bw,h,bd)};
const legs=(g,w,d,h,c,t=.07,y0=0)=>{for(const x of[-1,1])for(const z of[-1,1])g.box(t,h,t,c,x*(w-t)/2,y0+h/2,z*(d-t)/2)};
const tbl=(g,w,d,h,c,tc=shade(c,1.15),t=.07)=>{legs(g,w-.06,d-.06,h-t,shade(c,.78));g.box(w,t,d,tc,0,h-t/2,0)};   // 60 tris
const fire=(g,x,y,z,s=1)=>{g.cone(.12*s,.34*s,C.fire,x,y+.17*s,z,5);g.cone(.075*s,.24*s,C.flame,x+.02*s,y+.14*s,z+.04*s,4);g.cone(.06*s,.18*s,C.amber,x-.08*s,y+.09*s,z-.03*s,4)};   // 26
const wheel=(g,x,y,z,r,w=.12,hub=C.steel)=>{g.cyl(r,r,w,C.rubber,x,y,z,8,0,0,H2);g.box(w+.02,r*.7,r*.7,hub,x,y,z,PI/4)};   // axle along X, 44
// rocks
const FL=[[0,.56,.06],[.24,.42,.2],[-.24,.4,.16],[.08,.3,.36],[-.1,.5,-.18],[.3,.4,-.08],[-.3,.26,.26],[.2,.22,.36]];
const lump=(g,v,c,s=1)=>{const a=v*2.1,[x1,z1]=rot(.2,.16,a),[x2,z2]=rot(-.22,.14,a);g.dod(.4*s,c,0,.26*s,0,1,.8,.95,a);g.ico(.24*s,shade(c,.84),x1*s,.14*s,z1*s,1,.8,1,a);g.ico(.2*s,shade(c,1.12),x2*s,.12*s,z2*s,1,.8,1,a+1)};   // 76
const flecks=(g,v,c,n,sz=.1,s=1,c2=shade(c,1.25))=>{for(let i=0;i<n;i++){const[x,z]=rot(FL[i][0],FL[i][2],v*.5);g.box(sz,sz,sz,i%2?c2:c,x*s,FL[i][1]*s,z*s,.6,i*1.3,.5)}};
const xtal=(g,r,L,c,x,y,z,tilt=0,hd=0)=>{const p=limb(g,r,r*.85,L*.72,c,x,y,z,tilt,hd,5);spike(g,r,L*.3,shade(c,1.2),...p,tilt,hd,5)};   // 30
const xtals=(g,v,c,s=1)=>{const a=v*2.1;xtal(g,.1*s,.62*s,c,0,.1,0,.08,a);xtal(g,.08*s,.46*s,shade(c,.88),.08,.08,.06,.6,a+.6);xtal(g,.07*s,.4*s,shade(c,1.1),-.06,.08,.04,.65,a+2.7);
  spike(g,.07*s,.34*s,c,0,.08,-.06,.7,a+4.4,5);spike(g,.06*s,.26*s,shade(c,1.15),.05,.08,.1,.9,a+1.6,5)};   // 110
const pool=(g,v,c)=>{g.cyl(.45,.47,.05,'#5c5040',0,.025,0,9);g.cyl(.38,.38,.02,c,0,.056,0,9);ring(5,.42,(x,z,a,i)=>g.box(.16+.03*(i%3),.1+.02*(i%2),.12,i%2?C.stone:C.stoneD,x,.05,z,0,-a+.3*i,0),v)};   // 132
// containers, vehicles, walls
const crateB=(g,w,h,d,c,y0=0)=>{const t=.05,e=shade(c,.76);g.box(w-.04,h-.02,d-.04,c,0,y0+h/2-.01,0);for(const x of[-1,1])for(const z of[-1,1])g.box(t,h,t,e,x*(w-t)/2,y0+h/2,z*(d-t)/2);
  for(const z of[-1,1])g.box(w-t*2,t,t,e,0,y0+h-t/2,z*(d-t)/2);for(const x of[-1,1])g.box(t,t,d-t*2,e,x*(w-t)/2,y0+h-t/2,0)};   // 108
const cross=(g,x,y,z,s,flat)=>{if(flat){g.box(s,.012,s*.32,C.red,x,y,z);g.box(s*.32,.016,s,C.red,x,y,z)}else{g.box(s,s*.32,.02,C.red,x,y,z);g.box(s*.32,s,.026,C.red,x,y,z)}};
/** Top section of a scenery wall: whole (v0), corner broken off (v1) or notched (v2). */
const wtop=(g,v,y,h,c,w=1)=>{if(!v)g.box(w,h,w,c,0,y+h/2,0);else if(v===1){g.box(w*.66,h,w,c,-w*.17,y+h/2,0);g.box(w*.34,h*.4,w,shade(c,.84),w*.33,y+h*.2,0)}
  else{g.box(w*.4,h,w,c,-w*.3,y+h/2,0);g.box(w*.34,h*.7,w,shade(c,.9),w*.33,y+h*.35,0);g.box(w*.26,h*.3,w,shade(c,.8),w*.03,y+h*.15,0)}};
/** Sedan body, front at +Z, 1.4 long. */
const car=(g,c,wreck)=>{const d=shade(c,.8);g.box(.7,.2,1.38,c,0,.28,0);g.box(.68,.09,.44,shade(c,1.12),0,.42,.44,wreck?-.14:0);g.box(.68,.09,.3,d,0,.42,-.53);
  frus(g,.66,.7,.5,.34,.22,wreck?'#22282c':'#34424c',0,.53,-.1);g.box(.5,.035,.34,shade(c,.92),0,.655,-.1);
  g.box(.72,.07,.06,C.steelD,0,.22,.7);g.box(.72,.07,.06,C.steelD,0,.22,-.7);for(const x of[-1,1]){g.box(.12,.06,.03,wreck?'#5a5a52':'#f0e8b0',x*.24,.33,.695);g.box(.1,.05,.03,'#7a2a22',x*.26,.33,-.695)}};
// player building
/** Door: two piers, thin lintel, recessed leaf, threshold. 60 tris; tiers add their own leaf detail and handle. */
const door=(g,H,fc,lc,cap=shade(fc,1.14))=>{for(const x of[-1,1])g.box(.16,H-.12,.9,fc,x*.42,(H-.12)/2,0);g.box(1,.12,.4,cap,0,H-.06,0);g.box(.68,H-.12,.12,lc,0,(H-.12)/2,0);g.box(.68,.03,.9,shade(fc,.6),0,.015,0)};
const bottle=(g,x,y,z,c,s=1)=>{g.cyl(.035*s,.035*s,.1*s,c,x,y+.05*s,z,5);g.cyl(.012*s,.02*s,.06*s,shade(c,1.2),x,y+.13*s,z,4)};   // 36
const flask=(g,x,y,z,c,s=1)=>{g.cone(.07*s,.12*s,c,x,y+.06*s,z,6);g.cyl(.015*s,.015*s,.08*s,C.glass,x,y+.14*s,z,4)};   // 28
/** Long gun lying along Z (muzzle +Z), for racks and benches. 36 tris. */
const longgun=(g,x,y,z,ry=0,rx=0,c=C.black)=>at(g,x,y,z,ry,()=>{g.box(.04,.06,.22,C.woodD,0,0,-.2);g.box(.045,.07,.2,c,0,.01,0);g.box(.025,.03,.32,C.steelD,0,.02,.25)},1,rx);
const anvil=(g,x,y,z,s=1)=>{g.box(.14*s,.1*s,.12*s,C.iron,x,y+.05*s,z);g.box(.1*s,.08*s,.08*s,C.steelD,x,y+.14*s,z);g.box(.34*s,.08*s,.14*s,C.iron,x,y+.22*s,z);frus(g,.08*s,.12*s,.01,.04*s,.14*s,C.iron,x+.24*s,y+.22*s,z,0,0,-H2)};   // 48
const vice=(g,x,y,z)=>{g.box(.12,.05,.1,C.steelD,x,y+.025,z);g.box(.04,.1,.1,C.steel,x-.04,y+.1,z);g.box(.04,.1,.1,C.steel,x+.04,y+.1,z);g.box(.2,.02,.02,C.steelL,x+.08,y+.09,z)};   // 48
const glow=(g,w,h,x,y,z)=>{g.box(w+.06,h+.06,.04,C.black,x,y,z);g.box(w,h,.05,C.fire,x,y,z+.005);g.box(w*.5,h*.5,.06,C.flame,x,y-h*.15,z+.005)};   // furnace mouth facing +Z
// farm, defence, utility
const gbed=g=>{g.box(.9,.06,.9,C.soil,0,.04,0);for(const s of[-1,1]){g.box(.96,.12,.05,C.wood,0,.06,s*.455);g.box(.05,.12,.86,C.woodD,s*.455,.06,0)}for(const x of[-.28,0,.28])g.box(.16,.04,.84,shade(C.soil,1.3),x,.085,0)};   // 96
const sprout=(g,x,z,h,c,a=0)=>{spike(g,.035,h,c,x,.09,z,.45,a,3);spike(g,.035,h,shade(c,1.15),x,.09,z,.45,a+PI,3)};
/** Round turret mount: drum, collar and pivot post up to y=.5. 88 tris. */
const tbase=(g,c,c2=shade(c,.75))=>{g.cyl(.34,.38,.14,c2,0,.07,0,8);g.cyl(.26,.3,.14,c,0,.21,0,8);g.cyl(.1,.12,.24,c2,0,.4,0,6)};
const spoked=(g,x,y,z,r,w=.05,c=C.woodD)=>{g.cyl(r,r,w,c,x,y,z,8,0,0,H2);g.box(w+.02,r*.5,r*.5,C.iron,x,y,z,PI/4)};   // cart / bike wheel, axle X
// held weapons: melee along +Y with the grip at the origin, guns along +Z
const haft=(g,L,c,r=.024,y0=-.1,seg=5)=>g.cyl(r,r*1.12,L,c,0,y0+L/2,0,seg);
/** Axe blade flaring toward +Z from a head block at height y. 24 tris. */
const axehead=(g,y,c,e,s=1)=>{g.box(.05*s,.12*s,.12*s,c,0,y,.03*s);frus(g,.045*s,.12*s,.012*s,.22*s,.12*s,e,0,y,.15*s,H2)};
const gun=(g,c,len,z0=-.08,h=.065,w=.045)=>g.box(w,h,len,c,0,.05,z0+len/2);                 // receiver
const barrel=(g,c,r,len,z0,y=.06,seg=5)=>g.cyl(r,r,len,c,0,y,z0+len/2,seg,H2);
const pgrip=(g,c=C.black,z=-.01)=>g.box(.036,.13,.052,c,0,-.035,z,.25);
const stock=(g,c,z=-.2,len=.2)=>{g.box(.04,.06,len,c,0,.035,z);g.box(.042,.11,.06,c,0,.01,z-len/2+.02)};   // 24

export const PROPS={
// ================= nature: wood =================
tree_pine(g,v=0){const s=V(v,1,.86,1.12),c=V(v,'#3f6b3d','#37603a','#4a7040');g.cyl(.13,.26,1*s,C.bark,0,.5*s,0,6);
  g.cone(.8*s,1.1*s,shade(c,.82),0,1.2*s,0,7,0,v);g.cone(.62*s,1*s,c,0,1.9*s,0,7,0,v+.5);g.cone(.42*s,.9*s,shade(c,1.18),0,2.6*s,0,6,0,v+1)},
tree_birch(g,v=0){const s=V(v,1,1.12,.9),c=V(v,'#7f9a3e','#8aa040','#a39c3a'),w='#dcd8c8';g.cyl(.08,.17,1.9*s,w,0,.95*s,0,6);
  [[.13,.4,.06],[-.11,.85,.03],[.07,1.3,-.08]].forEach(([x,y,z])=>g.box(.07,.05,.07,C.black,x,y*s,z,0,.6));
  g.ico(.6*s,c,0,2.3*s,0,1,.9,1,v);g.ico(.42*s,shade(c,1.15),.32*s,2*s,.14*s,1,1,1,v+1);g.ico(.4*s,shade(c,.86),-.28*s,2.62*s,-.1*s,1,1,1,v+2);g.ico(.3*s,shade(c,1.06),-.22*s,1.9*s,.24*s)},
tree_oak(g,v=0){const s=V(v,1,.92,1.08),c=V(v,'#4c7034','#587632','#44682f'),a=v*2;g.cyl(.24,.42,1.3*s,C.bark,0,.65*s,0,6);limb(g,.1,.16,.8*s,shade(C.bark,.9),.1,1*s,0,.9,a,4);
  g.dod(.85*s,c,0,2.3*s,0,1.1,.8,1.1,a);g.ico(.6*s,shade(c,1.15),.55*s,2.05*s,.3*s,1,1,1,a);g.ico(.58*s,shade(c,.84),-.6*s,2*s,-.2*s,1,1,1,a+1);g.ico(.55*s,shade(c,1.07),-.1*s,2.85*s,.1*s,1,1,1,a+2)},
tree_dead(g,v=0){const c=V(v,'#6c5c4e','#77685c','#605248'),s=V(v,1,.88,1.1),a=v*2;g.cyl(.08,.2,1.5*s,c,0,.75*s,0,6);const t=limb(g,.03,.08,1*s,c,0,1.45*s,0,.25,a,5);
  limb(g,.02,.05,.8*s,shade(c,.88),0,1*s,0,.9,a+2,4);limb(g,.02,.05,.7*s,shade(c,1.12),0,1.3*s,0,1,a+4.2,4);limb(g,.015,.035,.5*s,c,...t,1.1,a+1,4);limb(g,.015,.03,.45*s,shade(c,.9),...t,.9,a+3.5,4)},
tree_joshua(g,v=0){const s=V(v,1,.9,1.1),a=v*2.2,c='#8c765a',l=V(v,'#6f8444','#78893f','#66803f');const tuft=(x,y,z)=>{g.cone(.2*s,.22*s,shade(c,.8),x,y-.04*s,z,4,PI);spike(g,.12*s,.6*s,shade(l,1.15),x,y,z,0,0,4);ring(4,1,(dx,dz,b,i)=>spike(g,.11*s,.58*s,i%2?l:shade(l,.88),x,y,z,.95,b,3),a)};
  const p=limb(g,.14,.22,1.5*s,c,0,0,0,.06,a,6);tuft(...limb(g,.1,.13,.8*s,shade(c,1.08),...p,.6,a+.5,5));tuft(...limb(g,.09,.12,.6*s,shade(c,.92),p[0],p[1]-.2*s,p[2],.8,a+3.4,5))},
tree_snow(g,v=0){const s=V(v,1.05,.92,1.15),c='#2f5548';g.cyl(.13,.24,1*s,'#4e3d30',0,.5*s,0,6);
  [[.82,1.1,1.2],[.64,1,1.9],[.44,.9,2.6]].forEach(([r,h,y],i)=>{g.cone(r*s,h*s,shade(c,.9+i*.1),0,y*s,0,7,0,v+i);g.cone(r*.8*s,h*.8*s,'#eef3f6',0,(y+h*.13)*s,0,7,0,v+i)})},
tree_gray(g,v=0){const c='#bbb4be',a=v*2.1,s=V(v,1,.9,1.1);const cap=(x,y,z,r)=>{g.cyl(.3*r,r,.28*r,C.violet,x,y+.08*r,z,6);g.cone(.32*r,.16*r,C.violetL,x,y+.3*r,z,6)};
  let p=limb(g,.2,.32,.9*s,c,0,0,0,.14,a,5);p=limb(g,.14,.2,.8*s,shade(c,.9),...p,.24,a+2.8,5);cap(...limb(g,.08,.14,.8*s,c,...p,.3,a+.3,3),.48*s);cap(...limb(g,.06,.1,.7*s,shade(c,1.08),...p,.95,a+3.4,3),.34*s);
  g.cone(.26*s,.16*s,C.violet,...limb(g,.04,.07,.4*s,c,p[0],p[1]-.5*s,p[2],1.2,a+1.6,3),5)},
log_pile(g,v=0){at(g,.02,0,-.02,v*1.1,()=>{limb(g,.06,.08,.8,C.log,-.4,.08,.08,H2,.15,6);limb(g,.05,.06,.6,C.woodD,-.2,.06,-.22,H2,-.5,5);limb(g,.04,.05,.5,C.wood,0,.17,-.1,H2-.08,1.2,5);
  limb(g,.02,.025,.4,C.woodD,.1,.03,.3,H2,2.6,4);limb(g,.02,.02,.35,C.log,-.3,.03,.3,H2,.9,4)},.82)},
// ================= nature: stone & ore =================
stone_pile(g,v=0){at(g,0,0,0,v*2.1,()=>{g.dod(.13,C.stone,-.12,.08,.05,1,.7,1,.4);g.dod(.1,C.stoneL,.14,.06,-.08,1.1,.7,.9,1.1);g.dod(.08,C.stoneD,.05,.05,.18,1,.7,1,2);g.dod(.07,'#84847e',-.18,.04,-.16,1,.7,1,.7);if(v)g.dod(.06,C.stoneL,.24,.04,.14,1,.7,1,1.6)})},
rock(g,v=0){const s=V(v,1,.86,1.06);lump(g,v,V(v,C.stone,'#84847e','#96958c'),s);g.ico(.1,C.stoneD,.3,.06,-.24)},
rock_flint(g,v=0){lump(g,v,'#b4b1a2',.84);const a=v*2;spike(g,.1,.34,'#2c3036',.04,.3,.02,.3,a,4);spike(g,.08,.3,'#3a4048',-.1,.26,.06,.8,a+2,4);spike(g,.08,.28,'#2c3036',.1,.22,.1,.9,a+4.3,4);flecks(g,v,'#30343a',4,.08,.84,'#454c55')},
clay_pit(g,v=0){const c='#b26c48';g.sph(.42,c,0,.14,0,1,.8,1);g.ico(.22,shade(c,.8),V(v,.2,-.2,.1),.3,.12,1,.7,1,v);g.ico(.18,shade(c,1.15),-.14,.42,-.08,1,.7,1,v+1);g.box(.16,.1,.12,shade(c,1.22),.1,.47,-.02,.2,v,.1);g.box(.12,.08,.1,shade(c,.7),-.26,.12,.3,0,.5)},
rock_iron(g,v=0){lump(g,v,'#7e746c');flecks(g,v,'#a2482a',6,.11,1,'#bc6238')},
rock_copper(g,v=0){lump(g,v,'#7c8078');flecks(g,v,C.teal,6,.11,1,C.copper)},
rock_coal(g,v=0){lump(g,v,'#46464a');flecks(g,v,'#17171a',6,.13,1,'#2a2a30')},
rock_sulfur(g,v=0){lump(g,v,'#a39c84',.92);flecks(g,v,'#e6cc2e',5,.12,.92,'#f0dc5a');g.ico(.16,'#dcc22c',0,.5,0,1,.5,1,v)},
rock_salt(g,v=0){const w='#eeeeea';g.sph(.4,'#d6d2c8',0,.08,0,1,.6,1);at(g,0,0,0,v*2,()=>{g.box(.26,.3,.26,w,0,.36,0,.2,.5,.1);g.box(.2,.22,.2,shade(w,.92),.2,.26,.12,.1,1.1,.3);g.box(.18,.2,.18,'#f4e8e2',-.2,.26,.06,.3,.2,.2);g.box(.14,.14,.14,w,.02,.24,.28,.5,.9,.1);g.box(.12,.12,.12,shade(w,.9),-.12,.3,-.2,.2,.4,.4)})},
sand_pile(g,v=0){at(g,0,0,0,v*2,()=>{g.sph(.42,C.sand,0,.12,0,1,.7,1);g.sph(.26,shade(C.sand,1.1),.14,.16,.16,1,.8,1,6,4);g.sph(.2,shade(C.sand,.9),-.2,.08,-.12,1,.7,1,6,4)})},
rock_bauxite(g,v=0){lump(g,v,'#c48a4c');flecks(g,v,'#8e4428',6,.11,1,'#dca868')},
rock_titan(g,v=0){lump(g,v,'#3e4650');flecks(g,v,C.titan,6,.11,1,'#dcecf6')},
rock_quartz(g,v=0){g.dod(.32,C.stone,0,.08,0,1.1,.6,1,v);xtals(g,v,'#dcecf0',1.2)},
rock_gray(g,v=0){g.dod(.32,'#4c465a',0,.08,0,1.1,.6,1,v);xtals(g,v,C.violet,1.25)},
// ================= nature: plants & water =================
bush_berry(g,v=0){const c=V(v,'#4a7034','#527a38','#446a30'),a=v*2;g.ico(.3,c,0,.24,0,1,.85,1,a);g.ico(.22,shade(c,1.15),.16,.2,.14,1,.9,1,a+1);g.ico(.2,shade(c,.85),-.18,.17,.08,1,.9,1,a+2);
  for(const[x,y,z]of[[.02,.5,.08],[.2,.36,.22],[-.18,.34,.2],[.1,.28,.3],[-.05,.42,-.14],[.28,.3,0]])g.box(.075,.075,.075,C.red,x,y,z,.5,.5,0)},
grass_tall(g,v=0){const c=V(v,'#6f8f3e','#7c963c','#86923e');ring(12,1,(x,z,a,i)=>{const r=.08+.1*(i%3);spike(g,.05,.28+.07*((i*7+v*3)%5),i%3?shade(c,.85+.15*(i%2)):c,x*r,0,z*r,.1+.12*(i%3),a+v,3)});g.box(.035,.1,.035,C.straw,.02,.52,.02)},
mushrooms(g,v=0){const c=V(v,'#b5673a','#c08a4a','#a8503a');[[0,0,.2,1],[.2,.12,.14,.8],[-.18,.1,.12,.7],[-.04,-.18,.16,.75]].forEach(([x0,z0,h,s],i)=>{const[x,z]=rot(x0,z0,v*2);
  g.cyl(.03*s,.04*s,h,'#e6dcc4',x,h/2,z,4);g.cone(.12*s,.09*s,shade(c,1+((i%3)-1)*.14),x,h+.03*s,z,6)})},
herb_patch(g,v=0){const c='#3f7a4a';at(g,0,0,0,v*2,()=>{[[0,0,.16],[.2,.1,.12],[-.18,.12,.13],[.02,-.2,.12]].forEach(([x,z,r],i)=>{g.ico(r,shade(c,1+((i%3)-1)*.15),x,r*.5,z,1,.6,1,i);spike(g,.03,.2,'#6aa060',x,r*.5,z,.15,i*2,3)});
  for(const[x,z]of[[.02,.02],[.22,.1],[-.2,.12],[.04,-.2]])g.box(.05,.05,.05,'#e8e4f0',x,.24,z,.5,.5)})},
cactus(g,v=0){const s=V(v,1,.85,1.1),c='#5d8a4a';g.sph(.27*s,c,0,.27*s,0,1,1.05,1,8,5);g.cone(.07,.08,'#e06a8a',0,.57*s,0,5);if(v!==1)g.sph(.12,shade(c,1.12),.25*s,.1,.1,1,1,1,6,4);
  ring(4,.265*s,(x,z)=>g.box(.03,.03,.03,'#ece4c4',x,.3*s,z,.5,.5),.4+v)},
pond(g,v=0){pool(g,v,C.water);spike(g,.03,.4,'#6f8f3e',-.3,.05,-.3,.1,1,3);spike(g,.03,.5,'#5f8238',-.36,.05,-.22,.05,2,3);g.box(.04,.1,.04,'#5a4028',-.36,.5,-.2)},
fish_spot(g,v=0){pool(g,v,'#34789e');g.cyl(.22,.22,.004,'#8cc4dc',.04,.07,.02,7);g.cyl(.16,.16,.004,'#34789e',.04,.076,.02,7);g.box(.05,.05,.05,C.red,.04,.1,.02);g.box(.03,.05,.03,C.white,.04,.14,.02);spike(g,.03,.45,'#6f8f3e',-.33,.05,-.26,.1,1,3)},
bloom(g,v=0){g.cyl(.2,.2,.012,'#6e52a8',0,.012,0,6);[[0,0,.3,1],[.2,.1,.2,.75],[-.16,.16,.16,.7]].forEach(([x0,z0,h,s],i)=>{const[x,z]=rot(x0,z0,v*2.1);
  limb(g,.015,.02,h,'#6c6480',x,0,z,.1,i*2,3);g.cone(.13*s,.12*s,i?C.violet:C.violetL,x,h+.02,z,5,PI);g.ico(.05*s,'#f0d8ff',x,h+.07*s,z)})},
wild_crop(g,v=0){at(g,0,0,0,v?H2:0,()=>{for(const z of[-.24,.22])g.box(.92,.07,.26,C.soil,0,.035,z);limb(g,.02,.03,.5,'#7a9440',-.25,0,-.24,.08,v,4);g.box(.05,.14,.05,C.yel,-.2,.3,-.24);spike(g,.05,.3,'#8aa048',-.25,.3,-.24,.7,2,3);
  for(const x of[.05,.3]){spike(g,.05,.22,'#4f8a3c',x,.05,-.24,.3,x*9,3);spike(g,.05,.2,'#5f9644',x,.05,-.24,.4,x*9+3,3);g.box(.05,.05,.05,C.orange,x,.08,-.24)}
  for(const x of[-.3,0,.28]){g.ico(.1,x?'#4a7a3a':'#5a8840',x,.1,.22,1,.7,1,x*5);spike(g,.04,.3,'#8a9a48',x+.1,.05,.22,.3,x*7,3)}})},
// ================= salvage nodes =================
machine(g){const c='#68746a';g.box(.92,.12,.84,C.steelD,0,.06,0);g.box(.78,.66,.62,c,-.04,.45,-.06);g.box(.5,.3,.5,shade(c,.84),-.16,.93,-.08);g.box(.52,.04,.52,shade(c,1.15),-.16,1.1,-.08);
  g.box(.32,.24,.04,'#2c3832',-.2,.56,.26);g.box(.07,.07,.03,C.red,-.3,.6,.285);g.box(.07,.07,.03,C.yel,-.18,.6,.285);g.box(.2,.04,.03,'#8fa89a',-.2,.5,.285);
  g.cyl(.25,.25,.08,C.rust,.4,.48,0,8,0,0,H2);g.box(.1,.12,.12,C.steelD,.42,.48,0,.6);g.cyl(.07,.07,.56,C.rust,.2,1.06,-.2,6);g.cyl(.1,.1,.06,C.steelD,.2,1.34,-.2,6);
  g.box(.26,.14,.3,C.rust,.2,.85,.1);limb(g,.03,.03,.36,C.steelD,.2,.92,.1,H2,PI,4)},
car_hull(g,v=0){const c=V(v,'#7e4c30','#74523a','#86482c'),d=shade(c,.75);g.box(.7,.2,1.36,c,0,.18,0);for(const x of[-1,1]){g.box(.12,.1,.46,shade(c,1.1),x*.29,.33,.44);for(const z of[.1,-.32])g.box(.045,.26,.045,d,x*.29,.41,z)}
  g.box(.42,.1,.34,'#262628',0,.31,.42);g.box(.16,.1,.14,C.steelD,-.06,.37,.42);g.box(.68,.08,.28,d,0,.32,-.53);g.box(.3,.2,.08,'#5a4634',-.14,.38,-.28,-.2);
  for(const x of[-1,1])g.box(.05,.035,.47,d,x*.29,.555,-.11);for(const z of[.1,-.32])g.box(.63,.035,.05,c,0,.555,z);for(const x of[-1,1])for(const z of[-.44,.44])g.cyl(.08,.08,.06,C.steelD,x*.36,.08,z,6,0,0,H2)},
vending(g){const c='#a94c3c';g.box(.74,1.46,.6,c,0,.77,-.06);g.box(.76,.05,.62,C.steelD,0,.025,-.06);g.box(.76,.05,.62,shade(c,.75),0,1.5,-.06);g.box(.44,.84,.03,'#26323a',-.12,.98,.245);
  for(const y of[.75,1,1.25])g.box(.42,.03,.02,'#7c949c',-.12,y,.262);g.box(.16,.84,.03,C.steelD,.24,.98,.245);g.box(.07,.04,.02,C.black,.24,1.1,.262);g.box(.1,.1,.02,'#c8c2a4',.24,1.26,.262);
  g.box(.44,.16,.04,C.black,-.12,.36,.245);g.box(.75,.16,.61,C.white,0,1.36,-.06)},
// ================= containers =================
crate(g,v=0){at(g,0,0,0,V(v,0,.3,-.2),()=>{const s=V(v,.72,.64,.78),c=V(v,C.wood,C.plank,'#84663f');crateB(g,s,s*.9,s,c);g.box(s*.07,.02,s*1.1,shade(c,.75),0,s*.9-.012,0,0,PI/4);g.box(s*.5,.012,s*.18,shade(c,1.25),-.05,s*.9-.012,s*.2,0,.1)})},
crate_mil(g,v=0){at(g,0,0,0,V(v,0,.2,-.15),()=>{const c='#5c6a3c';for(const x of[-.3,.3])g.box(.08,.05,.56,C.woodD,x,.025,0);g.box(.86,.36,.56,c,0,.23,0);g.box(.88,.1,.58,shade(c,1.18),0,.46,0);g.box(.89,.03,.59,shade(c,.62),0,.4,0);
  g.box(.14,.012,.585,C.yel,-.22,.512,0);g.box(.28,.012,.12,C.white,.16,.512,.08);for(const x of[-.25,.25])g.box(.07,.1,.03,C.steelL,x,.4,.295);for(const x of[-1,1])g.box(.03,.05,.22,C.black,x*.445,.28,0)})},
locker(g,v=0){const c=V(v,'#6c8792','#7c8a74','#8c8478');g.box(.6,.06,.44,C.steelD,0,.03,-.02);g.box(.64,1.34,.46,c,0,.73,-.02);g.box(.66,.04,.48,shade(c,.78),0,1.42,-.02);g.box(.02,1.26,.02,shade(c,.55),0,.73,.215);
  for(const x of[-.16,.16]){g.box(.2,.03,.02,shade(c,.62),x,1.22,.215);g.box(.2,.03,.02,shade(c,.62),x,1.15,.215);g.box(.035,.12,.035,C.steelL,x*.4,.75,.225)}},
fridge(g){const c=C.white;g.box(.64,.06,.6,C.steelD,0,.03,-.02);g.box(.66,1.3,.62,c,0,.71,-.02);g.box(.67,.025,.63,'#8a8c88',0,.98,-.02);g.box(.62,.03,.58,shade(c,.86),0,1.375,-.02);
  g.box(.04,.22,.04,C.steel,.24,1.14,.3);g.box(.04,.34,.04,C.steel,.24,.72,.3);g.box(.2,.14,.02,mix(c,C.rust,.5),-.16,.2,.292)},
cabinet(g){const c=C.wood;g.box(.8,.06,.42,C.woodD,0,.03,0);g.box(.84,.82,.46,c,0,.47,0);g.box(.9,.05,.5,C.woodL,0,.905,0);for(const x of[-.2,.2]){g.box(.36,.66,.02,shade(c,1.14),x,.47,.232);g.box(.04,.04,.03,C.steelL,x*.3,.5,.25)}
  g.box(.14,.12,.12,'#7c8a94',-.2,.99,0);g.box(.2,.03,.14,C.white,.18,.945,.04,0,.3)},
toolbox(g){const c=C.red;for(const x of[-.3,.3])for(const z of[-.16,.16])g.box(.07,.08,.07,C.black,x,.04,z);g.box(.72,.5,.44,c,0,.33,0);[.18,.32,.46].forEach(y=>{g.box(.66,.02,.02,shade(c,.5),0,y+.06,.222);g.box(.3,.03,.03,C.steelL,0,y,.232)});
  g.box(.68,.2,.4,shade(c,1.12),0,.68,0);g.box(.7,.03,.42,shade(c,.7),0,.795,0);g.box(.3,.03,.03,C.steelL,0,.68,.215);g.box(.04,.04,.3,C.steelL,.38,.5,0);g.box(.2,.05,.06,C.steel,-.14,.835,.02,0,.4)},
medbox(g){legs(g,.5,.28,.62,C.steel,.04);g.box(.5,.03,.28,C.steel,0,.3,0);g.box(.58,.6,.34,C.white,0,.92,0);g.box(.6,.04,.36,'#c4c6c0',0,1.24,0);cross(g,0,.92,.172,.3);cross(g,0,1.262,0,.24,1);g.box(.02,.56,.02,'#9a9c98',0,.92,.172)},
trashcan(g,v=0){const c=V(v,'#7c858a','#6c7a70','#84807a');g.cyl(.26,.22,.6,c,0,.3,0,8);g.cyl(.275,.275,.04,shade(c,.75),0,.5,0,8);at(g,V(v,0,.05,0),.6,0,0,()=>{g.cyl(.12,.29,.09,shade(c,1.15),0,.045,0,8);g.box(.12,.05,.04,C.steelD,0,.11,0)},1,0,V(v,0,.35,0));
  if(v===2){g.box(.1,.06,.08,'#c8c2a4',.3,.03,.2,0,.5);g.box(.06,.1,.06,'#5a7a8a',.34,.05,.05)}},
car_wreck(g,v=0){const c=mix(V(v,'#8a5a40','#5e7684','#a69c7c'),C.rust,.3);car(g,c,1);wheel(g,-.33,.15,.44,.15,.1,C.rust);wheel(g,.33,.15,-.44,.15,.1,C.rust);wheel(g,-.33,.15,-.44,.15,.1,C.rust);g.cyl(.07,.07,.06,C.rust,.34,.14,.44,6,0,0,H2);
  g.box(.26,.012,.2,C.rust,.08,.676,-.1);g.box(.2,.012,.16,C.rust,-.16,.474,-.56);g.box(.24,.012,.2,shade(C.rust,.8),.18,.474,.5,-.14)},
suitcase(g,v=0){at(g,0,0,0,V(v,.3,-.5,1.3),()=>{const c=V(v,'#7c5234','#4c5e6a','#8a3c34');g.box(.52,.16,.36,c,0,.08,0);g.box(.54,.02,.38,shade(c,.7),0,.08,0);for(const x of[-.14,.14])g.box(.05,.17,.37,'#3a2c20',x,.085,0);g.box(.16,.04,.04,C.black,0,.08,.2);g.box(.1,.012,.07,C.cloth,.2,.166,-.08)})},
corpse(g,v=0){at(g,0,0,0,V(v,.4,-.6,2.2),()=>{const c='#827c68';g.ico(.2,c,-.06,.04,-.02,1,.55,2);g.ico(.12,shade(c,1.12),-.06,.07,-.34,1,.7,1);g.box(.08,.08,.15,C.black,-.13,.04,.42,0,.25);g.box(.08,.08,.15,C.black,0,.04,.43,0,-.2);
  g.box(.22,.16,.26,C.olive,.28,.08,-.05,0,.3);g.box(.18,.05,.2,shade(C.olive,.75),.28,.17,-.05,0,.3);g.box(.04,.1,.04,'#3a2c20',.28,.2,-.05)},.9)},
barrel(g,v=0){const c=V(v,'#4c6c88','#8a4c2c','#5e6a3c');g.cyl(.26,.26,.76,c,0,.38,0,8);for(const y of[.26,.52])g.cyl(.275,.275,.04,shade(c,.7),0,y,0,8);g.cyl(.22,.22,.02,shade(c,.6),0,.765,0,8);g.box(.07,.03,.07,C.steelL,.1,.78,.06);g.box(.14,.2,.02,mix(c,C.rust,.7),.02,.3,.262)},
register(g){const c=C.wood;g.box(.92,.66,.5,c,0,.33,-.04);g.box(.98,.06,.58,C.woodL,0,.69,-.04);g.box(.9,.1,.02,C.woodD,0,.08,.212);g.box(.36,.14,.32,'#5a665e',.12,.79,-.04);frus(g,.36,.32,.36,.1,.12,'#4a564e',.12,.92,-.04);g.box(.3,.02,.14,'#c8c2a4',.12,.905,.08,.5);
  g.box(.2,.1,.03,'#1c2a22',.12,1,-.14,-.2);g.box(.3,.04,.14,'#3a443e',.12,.74,.19);g.box(.2,.012,.08,'#7aa06a',.1,.765,.2,0,.2);g.box(.14,.16,.14,'#b8a888',-.3,.8,-.06)},
file_cab(g,v=0){const c=V(v,'#7c8472','#84807a','#6c7c84');g.box(.5,1.14,.62,c,0,.57,-.02);g.box(.52,.04,.64,shade(c,.78),0,1.16,-.02);[.2,.58,.96].forEach((y,i)=>{g.box(.44,.32,.02,shade(c,1.12),0,y,.292+(v===1&&i===1?.14:0));g.box(.16,.035,.03,C.steelL,0,y+.06,.31+(v===1&&i===1?.14:0))});
  if(v===1)g.box(.44,.3,.14,shade(c,.6),0,.58,.36)},
ammo_box(g,v=0){at(g,0,0,0,V(v,.2,-.4,1),()=>{const c='#566238';g.box(.34,.17,.17,c,0,.085,0);g.box(.36,.035,.19,shade(c,1.2),0,.185,0);g.box(.16,.03,.03,C.black,0,.215,0);g.box(.345,.05,.175,C.yel,0,.09,0);g.box(.03,.06,.02,C.steelL,.185,.15,0)})},
safe(g){const c='#3f474e';for(const x of[-.28,.28])for(const z of[-.24,.24])g.box(.1,.06,.1,C.black,x,.03,z);g.box(.74,.8,.66,c,0,.46,-.02);g.box(.76,.05,.68,shade(c,1.25),0,.875,-.02);g.box(.56,.62,.03,shade(c,1.2),0,.46,.32);
  g.cyl(.1,.1,.05,C.steelL,-.08,.5,.35,8,H2);g.box(.03,.03,.03,C.black,-.08,.5,.38);g.box(.05,.18,.04,C.yel,.16,.48,.345);for(const y of[.28,.66])g.box(.05,.1,.04,C.black,-.3,y,.335)},
footlocker(g,v=0){at(g,0,0,0,V(v,0,.25,-.2),()=>{const c='#4a5642';g.box(.84,.28,.46,c,0,.14,0);g.box(.86,.1,.48,shade(c,1.2),0,.33,0);for(const x of[-.4,.4])for(const z of[-.21,.21])g.box(.08,.11,.08,C.steelL,x,.33,z);
  for(const x of[-.2,.2])g.box(.06,.385,.49,'#3a2c20',x,.19,0);g.box(.08,.1,.04,C.yel,0,.24,.25);g.box(.03,.05,.2,C.black,.435,.18,0);g.box(.03,.05,.2,C.black,-.435,.18,0)})},
gun_cabinet(g){const c='#4c545a';g.box(.9,.08,.5,c,0,.04,0);g.box(.9,.06,.5,shade(c,1.2),0,1.37,0);g.box(.86,1.26,.04,shade(c,.7),0,.71,-.22);legs(g,.9,.5,1.26,c,.05,.08);
  for(let i=0;i<6;i++)g.box(.022,1.26,.022,C.steelL,-.35+i*.14,.71,.23);g.box(.86,.04,.03,C.steelL,0,.7,.235);g.box(.1,.12,.05,C.yel,.3,.7,.25);
  for(const x of[-.24,0,.24]){g.box(.05,.7,.06,C.black,x,.75,-.08,-.12);g.box(.06,.34,.08,C.woodD,x,.28,-.02,-.12)}},
evidence(g){const c='#5c6c7c';g.box(.92,.06,.46,C.steelD,0,.03,0);g.box(.94,1.06,.48,c,0,.59,0);g.box(.96,.04,.5,shade(c,1.2),0,1.14,0);g.box(.02,1,.02,shade(c,.55),0,.59,.242);g.box(.9,.02,.02,shade(c,.55),0,.62,.242);
  for(const x of[-.24,.24])for(const y of[.34,.88]){g.box(.2,.1,.02,'#d8d2b8',x,y+.08,.245);g.box(.04,.08,.03,C.steelL,x*.3,y-.02,.25)}g.box(.95,.1,.49,C.yel,0,.98,0);g.box(.08,.1,.05,C.steelL,0,.62,.26);g.box(.3,.012,.16,C.yel,.2,1.166,.06,0,.5)},
lab_vault(g){const c='#dfe3e2';g.box(.86,.1,.74,C.steelD,0,.05,0);g.box(.84,.86,.72,c,0,.53,0);g.box(.88,.08,.76,C.steel,0,1,0);g.cyl(.24,.24,.06,C.steel,-.08,.56,.37,8,H2);g.cyl(.17,.17,.08,'#b8c2c4',-.08,.56,.38,8,H2);g.box(.3,.04,.04,C.steelD,-.08,.56,.43,0,0,.6);
  g.box(.12,.2,.03,'#26323a',.3,.62,.365);g.box(.06,.04,.02,C.teal,.3,.68,.385);g.box(.85,.06,.73,C.teal,0,.9,0);g.box(.3,.03,.3,'#26323a',-.2,1.05,0);g.box(.22,.012,.22,'#58d0bc',-.2,1.066,0);g.cyl(.06,.06,.1,C.steelD,.24,1.08,-.2,6)},
gray_vault(g){const c='#3a3644';g.box(.9,.1,.8,'#25222c',0,.05,0);g.box(.86,.96,.76,c,0,.58,0);g.box(.9,.08,.8,shade(c,1.3),0,1.1,0);g.box(.6,.76,.04,shade(c,1.25),0,.56,.385);g.box(.03,.76,.02,C.violetL,0,.56,.41);g.box(.6,.03,.02,C.violet,0,.74,.41);
  g.cyl(.12,.12,.05,'#25222c',0,.5,.42,6,H2);g.cyl(.07,.07,.07,C.violetL,0,.5,.425,6,H2);g.box(.5,.012,.05,C.violetL,0,1.146,0);g.box(.05,.012,.5,C.violet,0,1.146,0);for(const x of[-.39,.39])for(const z of[-.34,.34])g.box(.08,.04,.08,'#25222c',x,1.15,z);
  for(const x of[-.44,.44])g.box(.03,.5,.2,C.violet,x,.6,0)},
airdrop(g,v=0){const c='#5c6a3c';crateB(g,.7,.6,.7,c);g.box(.3,.2,.02,C.white,0,.3,.34);g.ico(.34,C.orange,-.14,.6,-.12,1.15,.36,1.05,v);g.box(.3,.02,.5,shade(C.orange,.85),-.41,.36,-.06,0,.1,1.3);g.box(.24,.02,.24,shade(C.orange,1.12),-.3,.02,.3,0,.5);g.box(.4,.02,.26,C.orange,.06,.4,-.4,1.4,.1);
  limb(g,.012,.012,.5,C.cloth,.32,.6,.32,1.2,3.6,3);limb(g,.012,.012,.5,C.cloth,.32,.6,-.3,1.3,3.4,3)},
spore_pod(g,v=0){const c=V(v,'#6c607c','#74648a','#645a72');g.sph(.33,c,0,.36,0,1,1.15,1,7,5);ring(5,.26,(x,z,a,i)=>g.ico(.13,shade(c,.78),x,.06,z,1,.7,1,a),v);g.cyl(.16,.2,.08,shade(c,1.2),0,.72,0,6);g.cyl(.11,.11,.03,C.violetL,0,.765,0,6);
  ring(3,.3,(x,z,a)=>g.box(.07,.07,.07,C.violet,x,.44,z,.5,a),v+.5)},
stash(g,v=0){at(g,0,0,0,V(v,.2,-.3,1.2),()=>{g.ico(.42,C.dirt,0,0,0,1,.16,.9,v);for(let i=0;i<3;i++)g.box(.15,.04,.46,shade(C.wood,.85+i*.12),-.16+i*.16,.07,0);g.box(.5,.03,.05,C.woodD,0,.1,-.14);g.box(.5,.03,.05,C.woodD,0,.1,.14);
  g.box(.08,.03,.08,C.steelD,.16,.105,0);g.ico(.1,'#4f7a38',.3,.05,.2,1,.4,1);g.ico(.08,'#7a8a40',-.32,.05,-.14,1,.4,1)})},
deathbag(g){const c='#a8672e';g.box(.32,.28,.22,c,0,.14,0,0,.3);g.box(.34,.08,.24,shade(c,.78),0,.3,0,0,.3);g.box(.2,.14,.06,shade(c,1.2),.04,.12,.13,0,.3);g.box(.1,.04,.05,C.black,0,.36,0,0,.3);
  g.box(.03,.8,.03,C.woodL,-.24,.4,-.06);g.box(.26,.18,.014,C.red,-.1,.7,-.06);g.box(.1,.1,.018,C.white,-.1,.7,-.06)},
// ================= scenery walls =================
w_brick(g,v=0){const c=V(v,C.brick,'#a45c46','#94503e');for(let i=0;i<3;i++)g.box(1-(i%2)*.03,.36,1-(i%2)*.03,shade(c,i%2?.86:1),0,.18+i*.36,0);wtop(g,v,1.08,.32,shade(c,1.12));
  for(const[x,y]of[[-.3,.2],[.2,.55],[-.14,.9],[.34,.9]])g.box(.24,.1,.02,shade(c,1.28),x,y,.502)},
w_concrete(g,v=0){const c=C.conc;g.box(1,.14,1,shade(c,.72),0,.07,0);g.box(.98,.94,.98,c,0,.61,0);wtop(g,v,1.08,.32,shade(c,1.12));g.box(.03,.9,.02,shade(c,.78),0,.6,.492);g.box(.3,.2,.02,shade(c,.86),-.26,.4,.492);
  if(v){limb(g,.015,.015,.3,C.rust,.3,1.2,.2,.3,1,3);limb(g,.015,.015,.26,C.rust,.34,1.2,-.2,.4,3,3)}},
w_wood(g,v=0){for(let i=0;i<5;i++){const h=1.4-(i%2)*.04-(v===1&&i===3?.4:0)-(v===2&&i<2?.25+i*.2:0);g.box(.2,h,1,shade(C.plank,.84+(i*37%5)*.07),-.4+i*.2,h/2,0)}g.box(1.01,.1,1.01,C.woodD,0,.9,0);g.box(1.01,.08,1.01,C.woodD,0,.3,0)},
w_metal(g,v=0){const c='#6c7e86';for(let i=0;i<6;i++)g.box(1/6,1.3,i%2?.94:1,i===V(v,9,1,4)?mix(c,C.rust,.7):shade(c,i%2?.82:1.05),-.4167+i/6,.65,0);wtop(g,v,1.3,.1,C.steelD);g.box(.3,.4,.02,C.rust,.2,.3,.502);g.box(.2,.2,.02,mix(c,C.rust,.6),-.3,1,.502)},
w_log(g,v=0){for(let i=0;i<3;i++)for(const z of[-.25,.25]){const cut=i===2&&((v===1&&z>0)||(v===2&&z<0));g.cyl(.25,.25,cut?.6:1,shade(C.log,.86+((i+(z>0))%3)*.12),cut?-.2:0,.25+i*.45,z,6,PI/6,0,H2)}},
w_lab(g,v=0){const c='#dfe3e2';g.box(1,.12,1,C.steelD,0,.06,0);g.box(.98,.96,.98,c,0,.6,0);g.box(1,.08,1,C.teal,0,.92,0);wtop(g,v,1.08,.32,'#eef0ee');g.box(.02,.74,.02,'#a2acae',0,.5,.492);g.box(.2,.12,.02,'#a2acae',.28,.6,.492)},
w_ice(g,v=0){g.box(1,.5,1,'#9fcfe4',0,.25,0);g.box(.97,.5,.97,'#b8dff0',0,.75,0);wtop(g,v,1,.4,'#d2ecf8');g.box(.5,.04,.6,C.white,-.2,1.42,.1,0,.2);g.box(.3,.3,.02,'#e4f6fc',.2,.5,.502,0,0,.3)},
w_bloom(g,v=0){const c='#5c5468';g.box(1,1.1,1,c,0,.55,0);wtop(g,v,1.1,.3,'#6c6280');g.ico(.24,C.gray,-.2,1.4,.1,1,.4,1,v);g.ico(.16,C.grayD,.24,v?1.2:1.4,-.2,1,.5,1);g.box(.04,.9,.02,C.violet,-.2,.5,.502,0,0,.1);g.box(.04,.6,.02,C.violet,.24,.4,.502,0,0,-.15);
  g.box(.1,.1,.04,C.violetL,-.2,.96,.49,0,0,.6);g.box(.08,.08,.04,C.violetL,.26,.72,.49,0,0,.6);g.box(.1,.1,.1,C.violetL,-.2,1.5,.1,.5,.5)},
// ================= scenery =================
fence_wood(g,v=0){const c=V(v,C.wood,'#86705a','#96784c');for(const x of[-.42,.42])g.box(.1,.8,.1,C.woodD,x,.4,0);for(const y of[.28,.6])g.box(1,.07,.05,shade(c,.9),0,y,-.03);
  for(let i=0;i<5;i++){if(v===2&&i===3)continue;const h=.72+(i*3%4)*.04;g.box(.13,h,.03,shade(c,.95+(i%3)*.1),-.36+i*.18,h/2+.03,.02,0,0,v===1&&i===1?.2:0);}},
fence_chain(g){const c='#9aa4a8';for(const x of[-.47,.47])g.cyl(.03,.03,1.1,C.steel,x,.55,0,5);g.box(.96,.035,.035,C.steel,0,1.08,0);g.box(.96,.03,.03,C.steel,0,.08,0);
  for(const x of[-.27,-.09,.09,.27]){g.box(.014,1,.014,c,x,.58,0,0,0,.5);g.box(.014,1,.014,c,x,.58,0,0,0,-.5)}},
bus(g,v=0){const c=V(v,'#c8a23c','#bc9838','#c4a650');for(const x of[-1,1])for(const z of[-.3,.3])wheel(g,x*.38,.15,z,.15,.1);g.box(.86,.52,1,c,0,.42,0);g.box(.87,.06,1.005,C.black,0,.4,0);g.box(.84,.26,.98,'#2c3840',0,.81,0);
  for(const z of[-.48,-.16,.16])g.box(.86,.26,.05,c,0,.81,z);for(const x of[-1,1])g.box(.05,.26,.05,c,x*.405,.81,.475);frus(g,.86,1,.74,.9,.1,shade(c,1.12),0,.99,0);g.box(.3,.03,.3,shade(c,.8),0,1.05,-.1);g.box(.3,.012,.2,C.rust,.14,1.046,.26);for(const x of[-1,1])g.box(.12,.07,.02,'#f0e8b0',x*.3,.3,.502)},
shelf(g,v=0){legs(g,.9,.4,1.3,C.steelD,.05);for(const y of[.2,.6,1])g.box(.9,.04,.4,C.steel,0,y,0);g.box(.9,.04,.4,C.steelL,0,1.3,0);
  [[-.28,.2,.2,.2,C.red],[.1,.2,.3,.14,C.cloth],[.2,.6,.16,.22,'#5a7a8a'],[-.2,.6,.3,.12,C.wood],[-.1,1,.14,.18,C.yel],[.24,1,.2,.1,C.white]].forEach(([x,y,w,h,c],i)=>{if((i+v)%3)g.box(w,h,.24,c,x,y+.02+h/2,0,0,i*.2)})},
old_bed(g,v=0){legs(g,.7,.96,.3,C.steelD,.05);g.box(.7,.05,.96,C.steelD,0,.28,0);g.box(.66,.12,.9,'#b4aa8c',0,.36,0,0,0,v===1?.05:0);g.box(.3,.012,.3,'#8a7a5c',.06,.425,.1,0,.5);g.box(.7,.4,.05,C.steel,0,.5,-.47);g.box(.7,.2,.05,C.steel,0,.4,.47);
  g.box(.34,.07,.2,C.white,-.1,.45,-.3,0,.2)},
table(g,v=0){tbl(g,.86,.6,.5,C.wood);if(v===1){g.cyl(.1,.1,.02,C.white,.1,.51,0,6);g.box(.05,.14,.05,'#4a6a4a',-.24,.57,.1)}if(v===2)g.box(.24,.03,.3,'#c8c2a4',-.1,.515,0,0,.3)},
chair(g,v=0){at(g,0,0,0,V(v,0,.6,-2),()=>{const c=C.wood;legs(g,.34,.34,.28,C.woodD,.045);g.box(.36,.05,.36,c,0,.3,0);g.box(.045,.42,.045,C.woodD,-.15,.52,-.155);g.box(.045,.42,.045,C.woodD,.15,.52,-.155);g.box(.36,.16,.04,shade(c,1.12),0,.66,-.155)})},
sofa(g,v=0){const c=V(v,'#5c7a70','#8a6a54','#6a6a8a');g.box(.94,.16,.46,shade(c,.7),0,.08,0);g.box(.92,.14,.14,c,0,.44,-.17);g.box(.92,.18,.14,shade(c,.9),0,.28,-.17);for(const x of[-.41,.41])g.box(.12,.3,.46,shade(c,.86),x,.3,0);
  for(const x of[-.18,.18])g.box(.34,.1,.32,shade(c,1.15),x,.22,.06,0,0,v===1&&x>0?.08:0);g.box(.14,.012,.1,shade(c,.6),.14,.275,.1)},
desk(g,v=0){const c=C.wood;g.box(.92,.06,.52,C.woodL,0,.5,0);for(const x of[-.32,.32]){g.box(.24,.47,.46,c,x,.235,0);g.box(.18,.03,.02,C.steelL,x,.36,.238);g.box(.18,.03,.02,C.steelL,x,.2,.238)}
  g.box(.3,.22,.04,C.black,-.1,.72,-.14,-.1,.2);g.box(.08,.1,.06,C.steelD,-.1,.57,-.14);g.box(.26,.012,.2,C.white,.24,.537,.06,0,-.3);if(v)g.box(.08,.1,.08,C.red,.3,.58,-.14)},
counter(g,v=0){const c=V(v,'#7c8a84','#8f6e46','#7c7c8a');g.box(.96,.08,.5,C.black,0,.04,0);g.box(.98,.52,.52,c,0,.34,0);g.box(1,.06,.58,'#cfcabc',0,.63,0);for(const x of[-.25,.25])g.box(.44,.4,.02,shade(c,1.15),x,.34,.262);
  if(v===1)g.box(.2,.14,.16,C.cloth,.2,.73,0,0,.3)},
gas_pump(g){const c=C.red;g.box(.56,.08,.42,C.conc,0,.04,0);g.box(.36,.84,.26,c,0,.5,0);g.box(.4,.24,.3,C.white,0,1.04,0);g.box(.42,.04,.32,shade(c,.8),0,1.18,0);g.box(.26,.14,.02,C.black,0,1.04,.152);g.box(.2,.05,.02,'#c8e0a0',0,1.06,.166);
  g.box(.3,.3,.02,shade(c,.7),0,.56,.132);g.box(.05,.16,.1,C.black,.2,.72,.04);limb(g,.02,.02,.5,C.black,.21,.3,.04,.1,0,4);limb(g,.02,.02,.3,C.black,.21,.3,.04,1.3,-.5,4);g.box(.2,.012,.14,C.yel,0,.925,.131)},
streetlight(g,v=0){const c='#5c666c';g.cyl(.07,.1,.24,shade(c,.8),0,.12,0,6);const p=limb(g,.03,.045,2.5,c,0,.2,0,v===2?.06:0,-H2,5);const q=limb(g,.025,.03,.36,c,...p,1.35,H2,4);g.box(.14,.06,.28,shade(c,.8),q[0],q[1],q[2]+.02);g.box(.1,.02,.2,'#f2e6a8',q[0],q[1]-.04,q[2]+.02)},
dumpster(g,v=0){const c=V(v,'#3f6a52','#4c5e7a','#6a5a3c');for(const x of[-.34,.34])for(const z of[-.2,.2])g.box(.08,.08,.08,C.black,x,.04,z);frus(g,.84,.5,.94,.6,.5,c,0,.33,0);g.box(.96,.05,.62,shade(c,.7),0,.59,0);
  g.box(.46,.03,.6,'#2c2c30',-.235,.63,0);g.box(.46,.03,.6,'#35353a',.235,.74,-.2,-.7);for(const x of[-.2,.2])g.box(.06,.4,.02,shade(c,.75),x,.33,.29);g.box(.3,.2,.02,mix(c,C.rust,.6),.1,.3,.285);if(v)g.box(.2,.14,.2,'#c8c2a4',.2,.62,.1,.2,.5)},
tent(g,v=0){const c=V(v,C.canvas,'#b06c38','#6c7a54');frus(g,.88,.92,.03,.92,.66,c,0,.33,0);frus(g,.44,.02,.02,.02,.5,'#2a2620',0,.25,.462);g.box(.035,.72,.035,C.woodD,0,.36,.47);g.box(.05,.03,.96,shade(c,.75),0,.665,0);
  for(const x of[-1,1]){g.box(.04,.1,.04,C.woodD,x*.47,.05,.42);g.box(.04,.1,.04,C.woodD,x*.47,.05,-.42)}g.box(.3,.03,.24,'#5a6a7a',.1,.02,.3,0,.2)},
sign(g,v=0){g.cyl(.025,.03,1.5,C.steel,0,.75,0,5);if(!v)g.box(.4,.4,.03,C.yel,0,1.5,.03,0,0,PI/4);else if(v===1)g.cyl(.24,.24,.03,C.red,0,1.5,.03,8,H2,0,PI/8);else g.box(.5,.34,.03,C.white,0,1.5,.03,0,0,.12);
  g.box(v===1?.3:.2,.05,.012,v===1?C.white:C.black,0,1.5,.052,0,0,v===2?.12:0);g.box(.1,.1,.012,C.rust,.1,1.4,.05)},
boulder(g,v=0){const c=V(v,C.stone,'#84807a','#94928a'),a=v*2;g.dod(.5,c,0,.42,0,.98,.95,.94,a);g.ico(.3,shade(c,.84),.2,.2,.24,1,.9,1,a);g.ico(.26,shade(c,1.12),-.24,.16,.22,1,.8,1,a+1);g.ico(.2,shade(c,.9),-.2,.75,-.1,1,.8,1,a)},
rubble(g,v=0){at(g,0,0,0,v*2.1,()=>{g.ico(.42,C.stoneD,0,.02,0,1,.5,1);g.box(.4,.2,.3,C.conc,-.1,.2,-.08,.3,.4,.2);g.box(.3,.16,.26,shade(C.conc,1.12),.2,.16,.14,-.2,1,.3);g.box(.24,.14,.2,shade(C.conc,.85),-.26,.1,.24,.1,2,-.2);
  g.box(.16,.08,.1,C.brick,.1,.32,-.14,.3,.6);g.box(.16,.08,.1,shade(C.brick,1.15),-.3,.1,-.2,0,1.2,.2);g.box(.16,.08,.1,C.brick,.3,.06,-.24,0,.2);limb(g,.014,.014,.5,C.rust,-.1,.2,0,.7,1,3);limb(g,.014,.014,.4,C.rust,.1,.2,.1,.5,4,3)})},
pallet(g,v=0){const pal=(y,c,ry,full)=>at(g,0,y,0,ry,()=>{for(const x of[-.38,0,.38])g.box(.1,.08,.84,shade(c,.75),x,.04,0);if(full)for(let i=0;i<5;i++)g.box(.88,.03,.14,shade(c,.92+(i%3)*.1),0,.095,-.35+i*.175);else g.box(.88,.03,.84,c,0,.095,0)});
  const n=V(v,3,2,4);for(let i=0;i<n;i++)pal(i*.115,i%2?C.plank:C.wood,(i*.13)%.3-.1,i===n-1)},
tank(g,v=0){const c=V(v,'#8c9aa0','#9c8a6c','#7c8c7c');g.cyl(.4,.42,.12,C.steelD,0,.06,0,10);g.cyl(.42,.42,1.14,c,0,.69,0,10);g.cyl(.2,.42,.16,shade(c,1.12),0,1.34,0,10);g.cyl(.43,.43,.06,mix(c,C.rust,.6),0,.5,0,10);g.cyl(.08,.08,.1,C.steelD,0,1.45,0,6);
  for(const x of[-.08,.08])g.box(.025,1.3,.025,C.steelD,x,.65,.445);for(let i=0;i<4;i++)g.box(.16,.025,.025,C.steelD,0,.25+i*.3,.445);g.box(.1,.1,.1,C.rust,-.42,.3,.1);g.cyl(.07,.07,.03,C.red,-.44,.38,.1,6)},
hosp_bed(g,v=0){for(const x of[-.24,.24])for(const z of[-.4,.4]){g.box(.035,.4,.035,C.steelL,x,.26,z);g.box(.05,.08,.08,C.black,x,.04,z)}g.box(.56,.04,.94,C.steel,0,.44,0);g.box(.52,.1,.9,C.white,0,.51,0);g.box(.36,.06,.2,'#f4f4f0',0,.59,-.32);
  g.box(.54,.03,.44,'#7ca8a0',0,.575,.2);for(const x of[-.28,.28])g.box(.025,.14,.5,C.steelL,x,.6,.1);g.box(.025,1.1,.025,C.steelL,.3,.95,-.44);g.box(.14,.025,.025,C.steelL,.24,1.48,-.44);g.box(.08,.14,.04,'#d8e6e8',.18,1.38,-.44)},
tombstone(g,v=0){g.ico(.3,C.dirt,0,0,.16,.8,.25,1.1);if(v<2){g.box(.34,.44,.1,C.stone,0,.22,-.16,v?-.12:0);g.cyl(.17,.17,.1,C.stoneL,0,.44,-.16-(v?.05:0),8,H2);g.box(.2,.03,.012,C.stoneD,0,.36,-.105);g.box(.14,.03,.012,C.stoneD,0,.28,-.105)}
  else{g.box(.08,.7,.08,C.wood,0,.35,-.16);g.box(.4,.08,.07,C.woodL,0,.5,-.15,0,0,.08)}g.box(.05,.05,.05,'#e8e4f0',.1,.1,.2);g.box(.05,.05,.05,C.yel,-.06,.11,.26)},
hay(g,v=0){at(g,0,0,0,v?H2:0,()=>{g.cyl(.4,.4,.8,C.straw,0,.4,0,10,0,0,H2);for(const x of[-.2,.2])g.cyl(.41,.41,.04,shade(C.straw,.7),x,.4,0,10,0,0,H2);g.cyl(.14,.14,.82,shade(C.straw,1.15),0,.4,0,6,0,0,H2);g.box(.24,.03,.1,shade(C.straw,.9),.1,.02,.4,0,.4)})},
tractor(g){const c='#a83c2c';wheel(g,-.36,.3,-.2,.3,.16,C.yel);wheel(g,.36,.3,-.2,.3,.16,C.yel);wheel(g,-.3,.16,.36,.16,.1,C.yel);wheel(g,.3,.16,.36,.16,.1,C.yel);g.box(.3,.26,.62,c,0,.46,.18);g.box(.32,.04,.5,shade(c,1.15),0,.6,.2);
  g.box(.26,.2,.03,C.black,0,.46,.495);g.box(.4,.14,.4,shade(c,.8),0,.4,-.22);g.box(.3,.06,.26,C.black,0,.56,-.26);g.box(.3,.26,.06,C.black,0,.72,-.4);for(const x of[-1,1])g.box(.2,.04,.4,c,x*.36,.63,-.2);
  g.cyl(.03,.03,.4,C.steelD,.1,.8,.3,5);limb(g,.015,.015,.3,C.steelD,0,.6,-.04,.5,-H2,4);g.cyl(.1,.1,.02,C.black,0,.87,-.19,6,.5)},
antenna(g,v=0){const c='#8c969c';g.box(.5,.08,.5,C.conc,0,.04,0);ring(3,.22,(x,z,a)=>limb(g,.02,.03,3,c,x,.08,z,.073,a+PI,3));for(const y of[.8,1.5,2.2])g.cyl(.22-y*.065,.22-y*.07,.03,C.steelD,0,y,0,3,0,-H2/3);
  g.cyl(.012,.012,.6,C.steelD,0,3.3,0,3);g.box(.05,.05,.05,C.red,0,3.62,0);g.cone(.2,.1,C.white,.14,2.4,.1,8,-H2+.3,0,-.4);g.box(.4,.02,.02,C.steelD,0,2.8,0);g.box(.02,.02,.3,C.steelD,0,2.6,0)},
lab_tank(g,v=0){const l=V(v,'#58c4a8','#7ac86a','#9a7ad8');g.cyl(.4,.42,.2,C.steelD,0,.1,0,8);g.cyl(.34,.34,.9,l,0,.65,0,8);g.cyl(.4,.4,.14,C.steel,0,1.17,0,8);g.cyl(.2,.3,.06,C.steelD,0,1.27,0,8);g.ico(.16,shade(l,.5),0,.6,0,1.1,1.6,1.1);
  for(const a of[.6,2.2,4])g.box(.04,.9,.04,C.steel,Math.cos(a)*.35,.65,Math.sin(a)*.35,0,-a);g.box(.2,.06,.012,C.yel,0,.14,.4);limb(g,.03,.03,.3,C.steelD,.2,1.24,-.1,.8,.4,4)},
spore_growth(g,v=0){const c=V(v,'#6c607c','#74648a','#645a72'),a=v*2;g.dod(.36,c,0,.2,0,1.1,.75,1,a);ring(4,.24,(x,z,b,i)=>g.ico(.2-.03*(i%2),shade(c,i%2?.82:1.14),x,.14+.1*(i%2),z,1,.8,1,b),a);g.ico(.18,shade(c,1.1),.04,.5,-.02,1,.8,1,a);
  ring(4,.22,(x,z,b,i)=>g.box(.08,.08,.08,i%2?C.violet:C.violetL,x,.44-.05*i,z,.5,b),a+.8);spike(g,.04,.2,C.grayD,.26,0,.26,1.1,.8+a,3);spike(g,.04,.2,C.grayD,-.26,0,-.2,1.1,3.6+a,3)},
ice_rock(g,v=0){at(g,0,0,0,v*1.6,()=>{g.box(.7,.7,.64,'#a8d6e8',0,.33,0,.1,.3,.08);g.box(.44,.56,.44,'#c4e6f4',.16,.5,.1,-.2,.9,.2);g.box(.4,.4,.4,'#8fc4dc',-.24,.2,.2,.3,.2,-.3);g.box(.3,.4,.3,'#dcf2fa',-.1,.8,-.1,.3,.5,.4);g.box(.3,.04,.3,C.white,.1,.85,.12,-.2,.9,.2)})},
crystal_spire(g,v=0){const c=V(v,'#8fa0f0','#9a8ae8','#84b0ec'),a=v*2;g.ico(.34,C.stoneD,0,.06,0,1.1,.5,1,a);xtal(g,.17,2,c,0,.05,0,.06,a);xtal(g,.11,1.1,shade(c,.85),.1,.05,.08,.4,a+.8);xtal(g,.1,.9,shade(c,1.12),-.08,.05,.06,.45,a+3);xtal(g,.08,.6,c,0,.05,-.12,.6,a+4.6)},
barrel_fire(g){const c='#4a3a34';g.cyl(.26,.24,.7,c,0,.35,0,8);g.cyl(.275,.275,.04,'#2c2422',0,.5,0,8);g.cyl(.22,.22,.02,C.fire,0,.705,0,8);for(const a of[.5,2.6,4.4])g.box(.06,.06,.03,C.amber,Math.cos(a)*.25,.3,Math.sin(a)*.25,0,H2-a);fire(g,0,.7,0,1.1);g.box(.3,.03,.04,C.black,.02,.72,.05,0,.6,.2)},
stump(g,v=0){const s=V(v,1,.84,1.14),a=v*2;g.cyl(.2*s,.26*s,.22,C.bark,0,.11,0,7);g.cyl(.17*s,.17*s,.02,C.woodL,0,.225,0,7);g.cyl(.07*s,.07*s,.022,C.wood,.02,.228,0,5);ring(3,.2*s,(x,z,b)=>spike(g,.07,.16,shade(C.bark,.85),x,.02,z,1.35,b,4),a);if(v===1)g.ico(.1,'#5a8a40',.14,.2,.1,1,.5,1)},
bones(g,v=0){at(g,0,0,0,v*2,()=>{const c=C.bone;g.ico(.09,c,-.2,.07,-.12,1,.9,1.1);g.box(.05,.04,.36,c,.06,.03,.02,0,.4);for(let i=0;i<4;i++)g.box(.26,.035,.03,shade(c,.92+(i%2)*.1),.02+i*.05,.06,-.1+i*.08,0,.4,.3);
  limb(g,.02,.02,.34,c,-.3,.03,.2,H2,.3,4);g.box(.06,.05,.06,c,-.3,.03,.2);g.box(.06,.05,.06,c,.02,.03,.3)})},
flowers(g,v=0){const cs=[C.yel,'#e8e4f0','#d86a8a','#7a8ae0'];ring(7,1,(x,z,a,i)=>{const r=.1+.11*(i%3),h=.14+.04*(i%3);spike(g,.03,h,'#5f8a3c',x*r,0,z*r,.1,a,3);g.box(.08,.06,.08,cs[(i+v)%4],x*r,h+.01,z*r,.4,a)},v);g.ico(.1,'#4f7a38',0,.03,0,1,.4,1)},
skeleton(g,v=0){at(g,0,0,0,V(v,.3,-.8,2.4),()=>{const c=C.bone;g.ico(.085,c,0,.07,-.36,1,.9,1.1);g.box(.04,.04,.34,c,0,.03,-.12);for(let i=0;i<3;i++)g.box(.24-i*.03,.05,.035,shade(c,.9+(i%2)*.12),0,.05,-.24+i*.08);g.box(.2,.05,.08,c,0,.04,.08);
  g.box(.04,.035,.34,c,-.09,.03,.28,0,.12);g.box(.04,.035,.34,c,.1,.03,.28,0,-.25);g.box(.035,.035,.3,c,-.2,.03,-.14,0,.5);g.box(.035,.035,.3,c,.19,.03,-.1,0,-.3)})},
snow_drift(g,v=0){at(g,0,0,0,v*2,()=>{g.sph(.42,'#eef2f4',0,.02,0,1,.42,.8);g.sph(.26,'#e0e8ee',.16,.03,.14,1,.5,1,6,4);g.sph(.2,'#f6f8fa',-.2,.02,-.1,1,.5,1,6,4)})},
puddle_tox(g,v=0){at(g,0,0,0,v*2,()=>{g.cyl(.42,.44,.015,'#4a5a2a',0,.008,0,8);g.cyl(.38,.38,.012,'#84b832',0,.02,0,8);g.cyl(.2,.2,.012,'#a8d848',.08,.027,.06,6);g.cyl(.24,.26,.015,'#4a5a2a',.3,.008,.2,6);g.cyl(.2,.2,.012,'#84b832',.3,.02,.2,6);
  g.ico(.05,'#c8f070',-.14,.03,.1);g.ico(.035,'#c8f070',.12,.03,-.16);g.ico(.03,'#e0ffa0',.3,.03,.22)},.9)},
cage(g){const c='#5c6268';g.box(.9,.06,.9,shade(c,.75),0,.03,0);for(const s of[-1,1]){g.box(.9,.06,.06,c,0,.93,s*.42);g.box(.06,.06,.78,c,s*.42,.93,0)}for(const x of[-.2,0,.2])g.box(.03,.03,.8,C.steelL,x,.93,0);legs(g,.9,.9,.84,c,.05,.06);for(let i=1;i<5;i++){const p=-.45+i*.18;for(const s of[-1,1]){g.box(.025,.84,.025,C.steelL,p,.48,s*.43);g.box(.025,.84,.025,C.steelL,s*.43,.48,p)}}
  g.box(.3,.34,.03,shade(c,.8),.1,.4,.45);g.box(.06,.08,.05,C.yel,.22,.4,.47);g.box(.5,.03,.4,C.straw,0,.075,0,0,.3)},
exit_sign(g){g.cyl(.04,.05,1.3,C.woodD,0,.65,0,5);g.box(.5,.22,.04,C.woodL,.02,1.08,.05);frus(g,.34,.04,.01,.04,.2,C.woodL,.37,1.08,.05,0,0,-H2);g.box(.3,.04,.012,C.yel,.02,1.08,.075);frus(g,.14,.012,.01,.012,.1,C.yel,.22,1.08,.075,0,0,-H2);
  g.box(.3,.14,.04,C.wood,-.04,.8,.05,0,0,.06);ring(4,.1,(x,z,a,i)=>g.ico(.07,i%2?C.stone:C.stoneD,x,.03,z,1,.7,1,a),.4)},
// ================= buildable: floors =================
floor_wood(g){g.box(1,.03,1,C.woodD,0,.015,0);for(let i=0;i<4;i++)g.box(.235,.025,.99,shade(C.plank,.9+(i*3%4)*.07),-.375+i*.25,.0385,0)},
floor_stone(g){g.box(1,.03,1,'#5a5a56',0,.015,0);[[-.2,-.255,.58,.47],[.3,-.255,.38,.47],[-.3,.245,.38,.49],[.2,.245,.58,.49]].forEach(([x,z,w,d],i)=>g.box(w,.025,d,shade(C.stone,.92+(i*3%4)*.07),x,.0385,z))},
floor_metal(g){g.box(1,.03,1,C.steelD,0,.015,0);for(const x of[-.25,.25])g.box(.485,.025,.98,shade(C.steel,x>0?1.06:.96),x,.0385,0);for(const x of[-.43,.43])for(const z of[-.43,.43])g.box(.05,.012,.05,C.steelL,x,.056,z);g.box(.6,.008,.06,shade(C.steel,.8),0,.054,0)},
// ================= walls & doors =================
wall_stick(g){for(const z of[-.33,.33])for(let i=0;i<3;i++){const k=i+(z>0?3:0),h=1.14+(k*5%4)*.05;g.cyl(.14,.165,h,shade(C.log,.86+(k*3%4)*.09),-.33+i*.33,h/2,z,5,0,k)}g.box(.98,1.08,.36,C.woodD,0,.54,0);for(const z of[-.33,.33])g.box(1,.07,.3,'#b49c6c',0,.82,z)},
wall_plank(g){for(let i=0;i<4;i++){const h=1.25-(i*3%4)*.025;g.box(.245,h,.98,shade(C.plank,.88+(i*3%4)*.08),-.375+i*.25,h/2,0)}for(const z of[-.5,.5])g.box(1.3,.1,.03,C.woodD,0,.62,z,0,0,z>0?.85:-.85);g.box(1,.1,1,C.woodD,0,1.1,0);g.box(1,.1,1,C.woodD,0,.1,0)},
wall_stone(g){for(let i=0;i<4;i++)g.box(1-(i%2)*.04,.29,1-(i%2)*.04,shade(C.stone,i%2?.84:.98),0,.145+i*.29,0);g.box(1,.09,1,C.stoneL,0,1.205,0);for(const[x,y]of[[-.28,.15],[.2,.44],[-.1,.73],[.3,1.02]])g.box(.3,.2,.02,shade(C.stone,1.12),x,y,.5)},
wall_metal(g){const c='#74828e';g.box(1,.1,1,C.steelD,0,.05,0);g.box(.96,1.1,.96,c,0,.65,0);g.box(1,.06,1,C.steelD,0,1.22,0);for(const x of[-.3,0,.3])g.box(.08,1.08,1,shade(c,1.15),x,.64,0);for(const x of[-.44,.44])for(const z of[-.44,.44])g.box(.06,.02,.06,C.steelL,x,1.258,z)},
wall_reinf(g){const t='#93a8ba';g.box(1,.5,1,C.conc,0,.25,0);g.box(1,.14,1,C.yel,0,.57,0);for(let i=0;i<4;i++)g.box(.07,.15,.02,C.black,-.36+i*.24,.57,.5,0,0,-.6);g.box(.98,.56,.98,t,0,.92,0);g.box(1,.06,1,shade(t,1.15),0,1.22,0);
  for(const x of[-.42,.42])for(const z of[-.42,.42])g.box(.08,.03,.08,C.steelD,x,1.26,z);g.box(.5,.02,.5,shade(t,.82),0,1.255,0)},
door_stick(g){for(const x of[-.42,.42])for(const z of[-.25,.25])g.cyl(.07,.085,1.25+(z>0?.05:0),shade(C.log,z>0?1:.86),x,.63,z,5);g.cyl(.06,.06,1,C.log,0,1.14,0,5,0,0,H2);g.box(.66,1.02,.05,C.woodD,0,.54,0);
  for(let i=0;i<4;i++)g.box(.13,1.06,.07,shade(C.log,.9+(i*3%4)*.08),-.24+i*.16,.55,.02);for(const y of[.3,.8])g.box(.68,.04,.1,'#b49c6c',0,y,.02);g.box(.05,.12,.05,'#b49c6c',.22,.56,.09)},
door_plank(g){door(g,1.25,C.woodD,C.plank,C.wood);for(const y of[.25,.9])g.box(.66,.09,.03,C.woodD,0,y,.07);g.box(.8,.08,.03,C.woodD,0,.575,.07,0,0,.72);g.box(.05,.14,.05,C.iron,.24,.6,.1)},
door_stone(g){door(g,1.25,C.stone,C.wood,C.stoneL);for(const y of[.2,.56,.92])g.box(.69,.07,.14,C.iron,0,y,0);g.cyl(.06,.06,.03,C.steelL,.2,.56,.085,6,H2);for(const x of[-1,1])g.box(.165,.29,.905,shade(C.stone,.84),x*.42,.435,0)},
door_metal(g){const c='#74828e';door(g,1.25,c,shade(c,1.15),C.steelD);g.box(.5,.4,.02,shade(c,.85),0,.8,.065);g.cyl(.1,.1,.04,C.steelD,0,.5,.08,6,H2);g.box(.24,.03,.03,C.steelL,0,.5,.1);g.box(.03,.24,.03,C.steelL,0,.5,.1);
  for(const x of[-.3,.3])for(const y of[.12,1])g.box(.04,.04,.03,C.steelL,x,y,.07)},
door_reinf(g){const t='#93a8ba';door(g,1.25,C.conc,t,C.yel);for(let i=0;i<4;i++)g.box(.07,.125,.02,C.black,-.36+i*.24,1.19,.2,0,0,-.6);g.box(.03,1.1,.14,C.steelD,0,.56,0);for(const y of[.3,.82])g.box(.6,.1,.03,C.steelD,0,y,.07);
  g.box(.14,.14,.04,C.yel,0,.56,.08);g.box(.06,.05,.06,C.amber,.42,1.275,.3);for(const x of[-1,1])g.box(.165,.3,.905,t,x*.42,.75,0)},
barricade(g){const c=C.log;g.cyl(.065,.065,1,c,0,.42,0,5,0,0,H2);for(const x of[-.36,.36]){limb(g,.015,.05,.95,shade(c,.86),x,0,.34,.72,-H2,4);limb(g,.015,.05,.95,shade(c,1.1),x+.03,0,-.34,.72,H2,4);g.box(.1,.08,.1,'#b49c6c',x,.42,0,.5)}
  for(const x of[-.18,0,.18])limb(g,.01,.045,.8,shade(c,.94+x),x,.04,-.28,.9,H2,4)},
barricade2(g){const c='#b49f74',bag=(x,y,z,w,d,i)=>frus(g,w,d,w*.86,d*.8,.17,shade(c,.86+(i*5%4)*.08),x,y,z,0,((i*7)%3-1)*.05);for(let i=0;i<3;i++)for(const z of[-.2,.2])bag(-.33+i*.33,.085,z,.32,.38,i+(z>0?1:4));
  for(let i=0;i<4;i++)bag(-.375+i*.25,.25,0,.24,.5,i+2);for(let i=0;i<3;i++)bag(-.33+i*.33,.41,0,.32,.34,i)},
barricade3(g){const c=C.conc;g.box(1,.14,.52,shade(c,.84),0,.07,0);frus(g,1,.52,1,.24,.3,c,0,.29,0);g.box(1,.36,.24,shade(c,1.1),0,.62,0);g.box(1.004,.1,.244,C.yel,0,.6,0);for(const x of[-.3,0,.3])g.box(.08,.102,.246,C.black,x,.6,0,0,0,.5);for(const x of[-.3,.3])g.box(.1,.04,.04,C.steelD,x,.82,0)},
// ================= stations =================
campfire(g){g.cyl(.3,.32,.03,'#3a3632',0,.015,0,7);ring(6,.29,(x,z,a,i)=>g.ico(.1,i%2?C.stone:C.stoneD,x,.05,z,1,.75,1.1,-a),.3);ring(3,.2,(x,z,a,i)=>limb(g,.035,.045,.34,i?C.woodD:C.bark,x,.03,z,.75,a+PI,4));fire(g,0,.06,0,1.15)},
stove(g){const c='#3c4046';g.box(.8,.1,.6,C.brick,0,.05,0);legs(g,.7,.5,.14,C.black,.07,.1);g.box(.74,.44,.52,c,0,.46,0);g.box(.78,.05,.56,shade(c,1.3),0,.705,0);glow(g,.2,.14,-.16,.4,.262);g.box(.22,.2,.02,shade(c,1.4),.18,.44,.262);
  for(const x of[-.18,.18])g.cyl(.11,.11,.02,C.black,x,.74,.06,7);g.cyl(.12,.1,.14,'#8a8f94',-.18,.82,.06,7);g.box(.2,.02,.03,C.black,-.18,.86,.06);g.cyl(.06,.06,.84,c,.22,1.14,-.16,6);g.cone(.1,.08,C.black,.22,1.6,-.16,6)},
workbench(g){tbl(g,.92,.56,.56,C.log,C.wood,.09);g.box(.8,.04,.44,C.woodD,0,.16,0);vice(g,-.28,.56,.14);g.box(.03,.03,.26,C.woodL,.14,.575,.02,0,.5);g.box(.1,.06,.06,C.iron,.07,.59,.12,0,.5);g.box(.26,.012,.1,C.steelL,.2,.566,-.14,0,-.2);g.box(.08,.03,.1,C.woodD,.34,.575,-.17,0,-.2);
  g.ico(.13,C.stone,-.32,.24,-.04,1,.7,1)},
workbench2(g){tbl(g,.94,.56,.56,C.plank,C.woodL,.08);g.box(.94,.6,.04,C.wood,0,.86,-.26);g.box(.94,.05,.14,C.woodD,0,1.16,-.21);for(const x of[-.26,.26])g.box(.3,.2,.5,C.wood,x,.36,0);g.box(.2,.03,.02,C.steelL,-.26,.38,.255);g.box(.2,.03,.02,C.steelL,.26,.38,.255);
  vice(g,-.3,.56,.16);g.box(.03,.26,.02,C.woodL,-.3,.9,-.23);g.box(.1,.06,.03,C.iron,-.3,1.02,-.23);g.box(.2,.1,.02,C.steelL,0,.94,-.23,0,0,.3);g.box(.03,.3,.02,C.red,.26,.9,-.23);g.box(.07,.05,.03,C.steelL,.26,1.06,-.23);g.box(.16,.12,.14,C.red,.24,.62,.04,0,.2)},
workbench3(g){const c='#6c7882';tbl(g,.96,.58,.56,c,C.steelL,.06);g.box(.96,.05,.6,C.yel,0,.5,0);for(const x of[-.3,.3])g.box(.28,.3,.5,shade(c,.84),x,.3,0);g.cyl(.04,.04,.7,C.steelD,-.3,.91,-.14,6);g.box(.16,.16,.3,'#3c8c64',-.3,1.2,-.06);g.cyl(.05,.05,.14,C.black,-.3,1.3,-.22,6);
  g.cyl(.02,.02,.16,C.steelL,-.3,1.04,.04,4);g.box(.16,.03,.16,C.steelD,-.3,.76,.04);g.box(.3,.14,.16,C.steelD,.2,.63,-.12);g.cyl(.07,.07,.04,C.steelL,.4,.67,-.12,7,0,0,H2);g.box(.2,.14,.14,C.red,.22,.63,.16,0,.2);g.cyl(.1,.1,.03,C.steel,-.02,.575,.14,7)},
sawbench(g){const c=C.log;for(const x of[-.3,.3]){for(const s of[-1,1])limb(g,.03,.04,.52,shade(c,.86),x,0,s*.2,.34,-s*H2,4);g.box(.06,.06,.44,C.woodD,x,.2,0)}g.box(.8,.07,.1,c,0,.5,0);g.cyl(.09,.1,.9,C.bark,.02,.62,.01,6,0,0,H2);
  g.box(.02,.2,.4,C.steelL,.2,.72,.04,0,.2);g.box(.03,.05,.44,C.woodL,.2,.84,.04,0,.2);g.cyl(.09,.1,.26,shade(C.bark,1.1),-.3,.09,.34,6,H2,.3);g.ico(.12,C.woodL,.3,.02,.34,1,.3,1)},
sawbench2(g){const c='#6c7882';legs(g,.86,.6,.5,C.steelD,.06);g.box(.92,.06,.66,C.steelL,0,.53,0);g.box(.3,.26,.3,'#3c8c64',-.12,.36,0);g.cyl(.2,.2,.02,'#c8d0d6',-.12,.56,0,10,0,0,H2);g.box(.06,.06,.66,C.red,.3,.59,0);g.box(.5,.03,.16,C.plank,-.2,.575,.2,0,.1);
  g.box(.14,.14,.2,C.black,.2,.3,.1);g.ico(.14,C.woodL,-.36,.02,.36,1,.35,1);g.box(.06,.1,.02,C.yel,-.12,.4,.152)},
furnace(g){const c=C.stone;g.cyl(.44,.46,.2,shade(c,.8),0,.1,0,8);g.sph(.44,c,0,.2,0,1,1.3,1,8,4);g.cyl(.12,.16,.3,C.stoneD,0,.86,-.1,6);g.cyl(.09,.09,.02,C.black,0,1.012,-.1,6);glow(g,.24,.2,0,.32,.4);ring(4,.36,(x,z,a,i)=>g.box(.14,.1,.1,i%2?C.stoneL:C.stoneD,x,.36+.1*(i%2),z,.2,-a,.3),.8);g.box(.3,.03,.08,C.stoneD,0,.19,.45)},
furnace2(g){const c=C.brick;g.box(.92,.14,.92,C.stoneD,0,.07,0);g.cyl(.34,.44,.86,c,0,.57,0,8);for(const y of[.4,.8])g.cyl(.4-(y-.4)*.11,.42-(y-.4)*.11,.06,C.iron,0,y,0,8);g.cyl(.2,.34,.2,shade(c,.85),0,1.1,0,8);g.cyl(.14,.16,.4,C.iron,0,1.4,0,6);g.cyl(.2,.2,.04,C.black,0,1.62,0,6);
  glow(g,.24,.22,0,.34,.42);g.box(.34,.05,.08,C.iron,0,.19,.455);limb(g,.04,.04,.7,C.steelD,-.4,.14,-.2,0,0,5);limb(g,.04,.04,.3,C.steelD,-.4,.84,-.2,H2,-.4,5);g.box(.16,.14,.16,C.iron,.36,.21,.3);g.box(.12,.02,.12,C.fire,.36,.285,.3)},
tannery(g){const c=C.log;for(const x of[-.42,.42]){limb(g,.03,.04,1.16,c,x,0,-.26,.22,H2,4);limb(g,.03,.04,1.16,shade(c,.85),x,0,.26,.22,-H2,4)}g.cyl(.03,.03,1,C.woodD,0,1.08,0,4,0,0,H2);g.cyl(.025,.025,.96,C.woodD,0,.3,.19,4,0,0,H2);
  at(g,0,.68,.1,0,()=>{g.box(.6,.66,.025,C.hide,0,0,0);g.box(.2,.14,.03,C.hide,-.3,.3,0,0,0,.6);g.box(.2,.14,.03,C.hide,.3,.3,0,0,0,-.6);g.box(.2,.14,.03,C.hide,-.3,-.3,0,0,0,-.6);g.box(.2,.14,.03,C.hide,.3,-.3,0,0,0,.6);g.box(.3,.4,.03,shade(C.hide,1.2),0,0,.004);g.box(.14,.1,.032,'#6a4830',.1,.14,.006)},1,-.24);
  g.cyl(.14,.12,.16,C.woodD,.2,.08,-.28,7);g.cyl(.115,.115,.012,'#6a5a3c',.2,.165,-.28,7)},
loom(g){tbl(g,.9,.56,.5,C.plank);for(const x of[-.3,.3])g.box(.05,.56,.05,C.woodD,x,.78,-.2);g.box(.66,.05,.05,C.woodD,0,1.04,-.2);g.box(.66,.04,.04,C.woodD,0,.56,-.2);g.box(.54,.4,.012,'#c8b89a',0,.8,-.2);g.box(.54,.14,.016,'#a8683c',0,.67,-.2);
  g.cyl(.08,.08,.44,'#5c7a8a',.12,.58,.1,7,0,.3,H2);g.cyl(.03,.03,.5,C.woodL,.12,.58,.1,5,0,.3,H2);g.cyl(.04,.04,.07,C.red,-.3,.535,.14,6);g.cyl(.04,.04,.07,'#d8c070',-.2,.535,.2,6);g.box(.16,.012,.03,C.steelL,-.3,.506,-.02,0,.6)},
loom2(g){const c='#6c7882';tbl(g,.92,.56,.5,c,C.woodL,.06);g.box(.14,.1,.2,C.black,-.26,.55,0);g.box(.1,.2,.1,C.black,-.26,.66,-.06);g.box(.1,.08,.26,C.black,-.26,.78,.02);g.box(.04,.12,.04,C.steelL,-.26,.68,.12);g.cyl(.07,.07,.03,C.steelL,-.26,.74,-.13,7,H2);
  g.box(.3,.012,.24,'#c8b89a',-.26,.506,.14);[['#5c7a8a',.08],['#a8683c',.2],['#6a8a5a',.32]].forEach(([k,x],i)=>g.cyl(.065,.065,.4,k,x,.565+(i===1?.1:0),-.1+(i===1?0:0),7,H2,0,0));
  g.cyl(.03,.03,.9,C.steelD,.36,.45,.16,5);g.cyl(.09,.13,.3,'#b8a888',.36,1,.16,6);g.sph(.08,'#b8a888',.36,1.2,.16,1,.6,1,6,4);g.cyl(.12,.12,.03,C.steelD,.36,.015,.16,6)},
medic(g){tbl(g,.9,.56,.5,C.plank);g.box(.26,.18,.2,C.white,-.24,.59,-.06);cross(g,-.24,.59,.042,.14);cross(g,-.24,.682,-.06,.14,1);bottle(g,.1,.5,.1,'#5a8a5a');bottle(g,.22,.5,-.04,'#8a5a3a');bottle(g,.3,.5,.14,'#5a7a9a');
  g.cyl(.07,.05,.07,C.stone,0,.535,-.12,6);limb(g,.012,.015,.14,C.woodL,0,.55,-.12,.5,1,3);for(const x of[-.4,.4])g.box(.04,.6,.04,C.woodD,x,.8,-.24);g.box(.84,.04,.04,C.woodD,0,1.1,-.24);for(const x of[-.2,0,.2])g.cone(.06,.2,x?'#5a8a4a':'#7a9a4a',x,.98,-.24,4,PI)},
medic2(g){const c='#c8d0d2';tbl(g,.92,.56,.52,c,C.white,.06);g.box(.28,.2,.22,C.white,-.26,.62,-.06);cross(g,-.26,.62,.052,.15);cross(g,-.26,.722,-.06,.15,1);g.box(.26,.2,.04,C.black,.2,.72,-.2,-.1);g.box(.22,.16,.02,'#58d0bc',.2,.722,-.176,-.1);g.box(.06,.1,.06,C.steelD,.2,.57,-.2);
  g.box(.1,.03,.12,C.steelD,.02,.535,.12);g.box(.03,.16,.03,C.steelD,.02,.61,.08);g.box(.04,.04,.12,C.steelL,.02,.68,.11,.6);bottle(g,.34,.52,.14,'#5a7a9a');g.cyl(.02,.02,1.4,C.steelL,-.42,.7,-.22,4);g.box(.16,.02,.02,C.steelL,-.36,1.4,-.22);g.box(.08,.14,.04,'#d86a6a',-.3,1.3,-.22)},
forge(g){const c=C.brick;g.box(.6,.5,.56,c,-.16,.25,-.16);g.box(.64,.06,.6,shade(c,.8),-.16,.53,-.16);g.box(.44,.04,.4,C.black,-.16,.565,-.16);g.box(.34,.03,.3,C.fire,-.16,.585,-.16);g.box(.16,.04,.14,C.flame,-.16,.6,-.16);g.box(.6,.9,.1,shade(c,.9),-.16,.95,-.41);
  frus(g,.6,.36,.3,.2,.24,C.iron,-.16,1.32,-.28);g.cyl(.08,.08,.3,C.iron,-.16,1.58,-.28,6);glow(g,.2,.14,-.16,.24,.118);g.cyl(.13,.15,.26,C.bark,.26,.13,.22,6);anvil(g,.24,.26,.22,.9);g.box(.03,.03,.26,C.woodL,.3,.53,.3,0,.4);g.box(.1,.06,.06,C.iron,.36,.53,.2,0,.4)},
forge2(g){const c='#5c6670';g.box(.94,.1,.9,C.steelD,0,.05,0);g.box(.3,1.24,.34,c,-.14,.72,-.24);g.box(.3,.26,.5,c,-.14,1.22,.02);g.box(.2,.4,.2,C.steelL,-.14,.9,.14);g.box(.24,.14,.24,C.iron,-.14,.64,.14);g.box(.34,.36,.36,C.iron,-.14,.28,.14);g.box(.2,.03,.2,C.fire,-.14,.475,.14);
  g.box(.31,.1,.35,C.yel,-.14,.3,-.24);g.cyl(.2,.2,.07,C.rust,-.33,1.1,-.24,8,0,0,H2);g.box(.2,.24,.24,'#3c8c64',.12,1.24,-.26);g.box(.34,.4,.4,C.brick,.28,.3,-.22);g.box(.26,.03,.3,C.fire,.28,.505,-.22);g.box(.12,.04,.12,C.flame,.28,.52,-.22);anvil(g,.26,.1,.26,.8)},
chem(g){const c='#5c6670';tbl(g,.92,.56,.52,c,C.steel,.06);flask(g,-.3,.52,.12,'#58c488',1.3);flask(g,-.1,.52,.16,'#5a8ad8',1);g.cyl(.07,.07,.2,C.glass,.24,.62,.1,6);g.cyl(.075,.075,.08,'#d8b050',.24,.57,.1,6);g.box(.2,.03,.14,C.iron,-.28,.535,-.14);
  g.cyl(.09,.09,.5,C.copper,-.28,.8,-.14,6);g.cone(.09,.12,C.copper,-.28,1.11,-.14,6);limb(g,.02,.02,.4,C.copper,-.28,1.1,-.14,1.9,.2,4);g.cyl(.06,.06,.16,C.glass,.1,.9,-.14,5);g.box(.04,.4,.04,C.steelD,.1,.72,-.2);g.box(.1,.1,.1,C.yel,.34,.57,-.16)},
chem2(g){const c='#7c8890';g.box(.94,.1,.9,C.steelD,0,.05,0);g.cyl(.2,.2,.8,c,-.24,.5,-.2,8);g.cyl(.1,.2,.1,shade(c,1.15),-.24,.95,-.2,8);g.cyl(.21,.21,.05,C.yel,-.24,.5,-.2,8);g.cyl(.13,.13,1.4,C.copper,.24,.8,-.22,7);for(const y of[.5,.9,1.3])g.cyl(.15,.15,.04,C.steelD,.24,y,-.22,7);
  g.cone(.13,.12,C.steelD,.24,1.56,-.22,7);limb(g,.03,.03,.5,C.steelL,-.24,1,-.2,H2,-.04,4);g.cyl(.16,.16,.34,'#5c6670',-.2,.27,.24,7);g.cyl(.17,.17,.03,C.red,-.2,.455,.24,7);limb(g,.03,.03,.44,C.steelL,-.04,.2,.24,H2,0,4);
  g.box(.24,.34,.16,'#3c8c64',.26,.27,.3);g.box(.16,.1,.02,C.black,.26,.34,.385);g.box(.05,.03,.02,C.red,.22,.2,.385);g.cyl(.06,.06,.02,C.red,.4,.3,.05,6,0,0,H2)},
gunbench(g){tbl(g,.94,.56,.52,C.wood,C.woodL,.08);g.box(.94,.44,.04,C.woodD,0,.76,-.26);longgun(g,0,.86,-.22,H2);g.box(.04,.06,.05,C.iron,-.2,.82,-.22);g.box(.04,.06,.05,C.iron,.2,.82,-.22);vice(g,-.3,.52,.12);longgun(g,0,.56,.1,H2+.2,0,C.steelD);
  g.box(.12,.08,.08,'#566238',.34,.56,-.1);g.box(.08,.06,.06,C.yel,-.06,.55,-.08);g.box(.24,.26,.48,C.wood,-.3,.3,0)},
gunbench2(g){const c='#5c6670';tbl(g,.96,.58,.52,c,C.steelL,.06);g.box(.96,.7,.04,shade(c,.8),0,.88,-.27);longgun(g,0,1.06,-.23,H2);longgun(g,0,.84,-.23,H2,0,'#566238');for(const x of[-.24,.24]){g.box(.04,.3,.05,C.steelL,x,.94,-.23)}
  g.box(.3,.26,.5,'#566238',-.3,.3,0);g.box(.3,.03,.5,C.yel,-.3,.3,.002);g.box(.14,.2,.14,C.red,.3,.62,.1);g.box(.03,.14,.03,C.steelL,.3,.79,.1);g.cyl(.03,.03,.2,C.black,-.06,.56,.12,6,H2,.5);g.cyl(.04,.04,.03,'#58a8d0',.03,.56,.2,6,H2,.5);vice(g,-.32,.52,.14)},
elec(g){tbl(g,.92,.56,.52,C.wood,C.woodL,.08);g.box(.34,.02,.26,C.green,-.2,.53,.06,0,.1);for(const[x,z]of[[-.28,.02],[-.14,.12],[-.2,-.02]])g.box(.05,.03,.05,C.black,x,.55,z);g.box(.06,.03,.03,C.yel,-.1,.55,.02);
  g.box(.26,.2,.18,'#5c6670',.24,.62,-.12);g.box(.14,.1,.02,'#58d0a0',.2,.64,-.025);limb(g,.008,.008,.7,C.steelL,.32,.72,-.14,.12,-1,3);g.box(.04,.04,.04,C.red,.36,1.42,-.2);g.torus(.06,.02,C.copper,.3,.54,.16,0,0,0,6);limb(g,.012,.016,.2,C.blue,-.02,.53,.18,1.2,-.6,3)},
elec2(g){const c='#dfe3e2';tbl(g,.94,.58,.52,c,C.white,.06);g.box(.94,.5,.04,c,0,.77,-.27);for(const x of[-.45,.45])g.box(.04,.5,.4,c,x,.77,-.07);g.box(.94,.06,.44,'#c4ccd0',0,1.05,-.07);g.box(.86,.2,.02,C.glass,0,.9,.14,.3);g.box(.6,.02,.06,'#8ad8f0',0,1.01,0);
  g.box(.3,.02,.24,C.green,-.2,.53,.02);g.box(.06,.03,.06,C.black,-.24,.55,.04);g.box(.06,.03,.03,C.yel,-.14,.55,-.02);g.box(.2,.16,.14,C.black,.24,.6,-.14);g.box(.16,.11,.02,'#58d0bc',.24,.61,-.065);g.cyl(.03,.03,.14,C.steelD,.1,.59,.12,5);g.box(.05,.05,.1,C.steelL,.1,.67,.1,.6)},
garage(g){const c=C.plank;for(const x of[-.3,.3]){g.box(.22,.04,.7,c,x,.14,-.04,.28);g.box(.22,.04,.3,shade(c,1.1),x,.235,-.36);g.box(.2,.22,.06,C.woodD,x,.11,-.3);g.box(.2,.22,.06,C.woodD,x,.11,-.46)}
  g.box(.3,.3,.2,C.wood,0,.25,-.3);g.box(.34,.03,.24,C.woodL,0,.415,-.3);g.box(.04,.04,.16,C.black,-.1,.03,-.3);g.box(.04,.04,.16,C.black,.1,.03,-.3);g.box(.12,.05,.06,C.iron,-.04,.455,-.3,0,.4);g.box(.2,.012,.03,C.steelL,.02,.44,-.26,0,-.5);
  g.cyl(.14,.14,.09,C.rubber,0,.045,.24,8);g.cyl(.14,.14,.09,C.rubber,.02,.14,.25,8);g.cyl(.07,.07,.092,C.steelD,.02,.142,.25,6)},
garage2(g){const c='#5c6670';g.box(.96,.04,.96,C.steelD,0,.02,0);for(const x of[-.42,.42]){g.box(.1,1.1,.14,C.yel,x,.59,-.1);g.box(.3,.05,.08,c,x*.64,.4,.04,0,x>0?-.5:.5);g.box(.3,.05,.08,c,x*.64,.4,-.24,0,x>0?.5:-.5);g.box(.16,.04,.2,C.black,x,.06,-.1)}
  g.box(.94,.07,.1,c,0,1.16,-.1);g.box(.3,.34,.2,C.red,.1,.27,.34);g.box(.32,.03,.22,shade(C.red,.7),.1,.455,.34);for(const y of[.2,.32])g.box(.2,.025,.02,C.steelL,.1,y,.445);g.box(.04,.08,.04,C.black,0,.04,.34);g.box(.04,.08,.04,C.black,.2,.04,.34);
  g.cyl(.13,.13,.09,C.rubber,-.26,.045,.32,8);g.cyl(.065,.065,.092,C.steelD,-.26,.047,.32,6)},
garage3(g){const c='#93a8ba';g.box(.96,.05,.96,C.steelD,0,.025,0);g.box(.6,.05,.7,C.steel,0,.09,-.04);for(const z of[-.36,.28])g.box(.6,.052,.06,C.yel,0,.09,z);for(const x of[-.43,.43])for(const z of[-.4,.4])g.box(.08,1.4,.08,c,x,.72,z);
  for(const x of[-.43,.43])g.box(.08,.08,.88,c,x,1.38,0);g.box(.94,.1,.12,C.yel,0,1.38,-.04);g.box(.16,.14,.16,C.steelD,.06,1.26,-.04);g.box(.02,.4,.02,C.steelL,.06,1,-.04);g.box(.07,.07,.03,C.steelL,.06,.78,-.04);
  g.box(.24,.3,.18,C.red,.3,.25,.36);g.box(.26,.03,.2,shade(C.red,.7),.3,.415,.36);g.cyl(.14,.14,.1,C.rubber,-.3,.1,.36,8);g.cyl(.07,.07,.102,C.steelD,-.3,.102,.36,6);g.box(.05,.05,.05,C.amber,-.43,1.46,.4)},
recycler(g){const c='#5c7068';g.box(.9,.1,.8,C.steelD,0,.05,0);g.box(.6,.5,.6,c,-.12,.35,-.06);frus(g,.3,.3,.62,.62,.34,shade(c,1.15),-.12,.86,-.06);g.box(.5,.02,.5,C.black,-.12,1.022,-.06);g.box(.6,.1,.6,C.yel,-.12,.64,-.06);
  for(const x of[-.2,-.04])g.cyl(.07,.07,.44,C.steelL,x,1,-.06,6,H2);g.box(.26,.04,.3,C.steelD,.26,.3,.06,0,0,-.5);g.box(.26,.2,.34,C.rust,.32,.1,.06);g.box(.2,.03,.28,C.steelL,.32,.2,.06);g.box(.2,.24,.2,'#3c8c64',-.26,.3,.34);g.cyl(.12,.12,.05,C.rust,.2,.5,-.2,7,0,0,H2);
  for(let i=0;i<3;i++)g.box(.08,.102,.02,C.black,-.3+i*.18,.64,.245,0,0,.5)},
// ================= storage & rest =================
box_small(g){const c=C.log;g.box(.5,.3,.4,c,0,.15,0);g.box(.54,.06,.44,shade(c,1.18),0,.33,0);for(const x of[-.2,.2])g.box(.05,.31,.41,C.woodD,x,.155,0);g.box(.16,.04,.04,'#b49c6c',0,.38,0);g.box(.04,.1,.03,'#b49c6c',0,.2,.21)},
chest(g){const c=C.wood;g.box(.78,.34,.5,c,0,.17,0);g.cyl(.25,.25,.78,shade(c,1.12),0,.34,0,8,PI/8,0,H2);for(const x of[-.3,.3]){g.box(.07,.35,.52,C.iron,x,.175,0);g.cyl(.26,.26,.07,C.iron,x,.34,0,8,PI/8,0,H2)}g.box(.1,.14,.04,C.yel,0,.3,.26);g.box(.8,.04,.52,C.woodD,0,.34,0)},
locker_big(g){const c='#74828e';g.box(.9,.06,.48,C.steelD,0,.03,0);g.box(.92,1.22,.5,c,0,.67,0);g.box(.94,.05,.52,shade(c,1.2),0,1.305,0);g.box(.02,1.16,.02,shade(c,.55),0,.67,.252);for(const x of[-.23,.23]){for(const y of[1.06,1.12,1.18])g.box(.3,.025,.02,shade(c,.62),x,y,.252);g.box(.04,.16,.04,C.steelL,x*.3,.7,.262)}
  g.box(.1,.08,.04,C.yel,0,.56,.262);g.box(.86,.012,.44,shade(c,.86),0,1.336,0)},
vault_box(g){const c='#454c56',t='#93a8ba';g.box(.94,.1,.82,'#2c3038',0,.05,0);g.box(.92,1.02,.8,c,0,.61,0);g.box(.96,.07,.84,t,0,1.15,0);for(const y of[.3,.92])g.box(.94,.07,.82,t,0,y,0);g.box(.6,.5,.04,shade(c,1.3),0,.61,.41);
  g.cyl(.16,.16,.05,C.steelL,0,.61,.44,8,H2);for(const a of[0,H2])g.box(.4,.035,.03,C.steelD,0,.61,.47,0,0,a+.4);g.box(.06,.06,.06,C.yel,0,.61,.48);for(const x of[-.4,.4])for(const z of[-.34,.34])g.box(.08,.03,.08,C.steelD,x,1.2,z);g.box(.4,.012,.3,shade(t,.8),0,1.192,0)},
bed_roll(g){const c='#6c7a54';g.box(.5,.05,.84,c,0,.025,.04);g.box(.5,.052,.1,shade(c,.7),0,.026,.2);g.cyl(.09,.09,.52,shade(c,1.15),0,.09,-.4,7,0,0,H2);for(const x of[-.14,.14])g.cyl(.095,.095,.04,'#b49c6c',x,.09,-.4,7,0,0,H2);g.box(.3,.04,.3,'#8a6a4a',0,.07,.22,0,.1)},
bed(g){const c=C.wood;legs(g,.7,.96,.24,C.woodD,.07);g.box(.7,.1,.96,c,0,.25,0);g.box(.64,.1,.88,'#d8d2c0',0,.34,.02);g.box(.66,.06,.5,'#9c4a3c',0,.385,.2);g.box(.66,.065,.06,'#c8b89a',0,.386,-.04);g.box(.36,.07,.2,C.white,0,.41,-.3);g.box(.7,.5,.06,c,0,.45,-.46);g.box(.74,.05,.08,C.woodL,0,.71,-.46);g.box(.7,.2,.05,c,0,.34,.47)},
bed2(g){const c='#5c6670';for(const x of[-.34,.34])for(const z of[-.45,.45])g.box(.06,1.3,.06,c,x,.65,z);for(const y of[.3,.92]){g.box(.7,.05,.94,c,0,y,0);g.box(.62,.09,.86,'#c8c2b0',0,y+.07,0);g.box(.64,.05,.5,y>.5?'#5c7a8a':'#8a6a4a',0,y+.12,.16);g.box(.34,.06,.18,C.white,0,y+.14,-.3)}
  for(const z of[-.45,.45])g.box(.7,.05,.05,c,0,1.24,z);for(const z of[.2,.36])g.box(.03,.9,.03,C.steelL,.37,.6,z);for(const y of[.3,.52,.74])g.box(.03,.03,.16,C.steelL,.37,y,.28)},
// ================= farm & passive =================
garden(g){gbed(g)},
garden_1(g){gbed(g);for(const x of[-.28,0,.28])for(const z of[-.28,0,.28])sprout(g,x,z,.12+.03*((x*9+z*5+3)%2),'#7ab04a',x*7+z*3)},
garden_2(g){gbed(g);for(const z of[-.28,0,.28]){sprout(g,-.28,z,.24,'#5a9a40',z*4);g.box(.08,.07,.08,C.orange,-.28,.12,z,0,.5);g.ico(.11,z?'#5a9a48':'#6aa850',0,.17,z,1,.8,1,z*5);
  limb(g,.015,.02,.42,'#7a9a40',.28,.09,z,.06,z*3,3);spike(g,.05,.26,'#8aa848',.28,.3,z,.8,z*5,3);g.box(.06,.15,.06,C.yel,.31,.32,z)}g.ico(.1,C.orange,.02,.17,.14,1,.8,1);g.box(.08,.08,.08,C.red,-.06,.2,-.2)},
collector(g){[[-.4,-.4,1],[.4,-.4,.92],[-.4,.4,.86],[.4,.4,.96]].forEach(([x,z,h])=>g.cyl(.025,.035,h,C.log,x,h/2,z,4));frus(g,.12,.12,.84,.84,.3,'#7a98ae',0,.74,0);g.box(.5,.012,.5,C.water,0,.86,0);g.box(.3,.012,.3,'#58a0c8',0,.8,0);
  g.cyl(.17,.15,.3,C.wood,0,.15,0,7);g.cyl(.175,.175,.03,C.iron,0,.22,0,7);g.cyl(.14,.14,.012,C.water,0,.3,0,7);g.cyl(.02,.02,.3,'#7a98ae',0,.46,0,4)},
well(g){g.cyl(.4,.42,.4,C.stone,0,.2,0,8);g.cyl(.42,.42,.06,C.stoneL,0,.42,0,8);g.cyl(.3,.3,.02,'#28546c',0,.455,0,8);for(const x of[-.36,.36])g.box(.07,1.1,.07,C.woodD,x,.75,0);g.cyl(.04,.04,.8,C.wood,0,.98,0,5,0,0,H2);g.box(.05,.14,.05,C.iron,.42,.93,.03);
  g.box(.015,.26,.015,'#b49c6c',-.06,.84,0);g.cyl(.07,.06,.12,C.wood,-.06,.66,0,6);frus(g,.96,.7,.96,.03,.26,'#8a5a3c',0,1.42,0);g.box(.98,.04,.06,C.woodD,0,1.56,0)},
snare(g){limb(g,.015,.02,.5,C.log,-.3,0,-.2,.9,.4,4);g.box(.01,.24,.01,'#b49c6c',.02,.18,-.07,0,0,.1);g.torus(.14,.012,'#b49c6c',.04,.04,-.06,0,0,0,7);for(const[x,z]of[[-.12,.14],[.2,.1],[.04,-.26]])spike(g,.025,.16,C.woodD,x,0,z,.2,x*9,3);
  g.box(.06,.04,.06,C.red,.04,.03,-.06);g.ico(.1,'#4f7a38',.26,.03,-.24,1,.4,1);g.ico(.08,'#5f8a40',-.2,.03,.26,1,.4,1)},
coop(g){const c=C.plank;at(g,0,0,-.1,0,()=>{legs(g,.66,.56,.24,C.woodD,.06);g.box(.72,.4,.62,c,0,.44,-.04);frus(g,.8,.72,.8,.04,.26,'#8a4a34',0,.77,-.04);g.box(.2,.24,.02,'#2a2018',-.14,.4,.275);g.box(.2,.03,.4,C.woodL,-.14,.14,.44,-.6);
  g.box(.22,.16,.02,'#3a3a34',.2,.46,.275);for(const x of[.14,.2,.26])g.box(.012,.16,.026,C.steelL,x,.46,.275);g.ico(.08,C.white,.26,.07,.4,1,1,1.2);g.box(.04,.05,.05,C.white,.26,.16,.45);g.box(.02,.03,.03,C.red,.26,.2,.45);g.box(.02,.02,.03,C.amber,.26,.16,.49);g.ico(.1,C.straw,.3,.02,.2,1,.3,1)})},
hive(g){legs(g,.5,.44,.16,C.woodD,.06);g.box(.56,.04,.5,C.wood,0,.17,0);g.box(.5,.26,.44,'#d8c070',0,.32,0);g.box(.5,.24,.44,C.white,0,.57,0);g.box(.5,.2,.44,'#d8c070',0,.79,0);g.box(.58,.05,.52,C.steelL,0,.915,0);g.box(.3,.03,.02,C.black,0,.22,.222);g.box(.16,.04,.02,C.woodD,0,.6,.222);
  for(const[x,y,z]of[[.3,.5,.26],[-.32,.8,.1],[.1,1.02,.2],[-.16,.36,.34]])g.box(.035,.035,.035,C.amber,x,y,z,.5,.5)},
fish_trap(g){g.cyl(.44,.46,.03,'#5c5040',0,.015,0,9);g.cyl(.4,.4,.02,C.water,0,.04,0,9);ring(8,.32,(x,z,a,i)=>{if(i!==2)limb(g,.02,.025,.4+.04*(i%3),i%2?C.log:C.woodD,x,0,z,.08,a,3)});for(const y of[.14,.28])g.torus(.32,.014,'#b49c6c',0,y,0,0,0,0,8);
  for(const s of[-1,1])g.box(.26,.26,.02,C.woodD,s*.12,.14,.4,0,s*.6);g.box(.1,.03,.04,'#c8d0d6',.06,.06,-.06,0,.6);g.box(.08,.03,.035,'#a8b8c0',-.1,.06,.08,0,-.4)},
compost_bin(g){for(const[x,z]of[[-.38,-.38],[.38,-.38],[-.38,.38],[.38,.38]])g.cyl(.035,.04,.62,C.log,x,.31,z,6);
  for(const y of[.14,.34,.52]){g.box(.8,.09,.03,C.plank,0,y,-.38);g.box(.03,.09,.8,C.plank,-.38,y,0);g.box(.03,.09,.8,C.woodD,.38,y,0)}g.box(.8,.09,.03,C.plank,0,.14,.38);
  g.ico(.34,'#4a3826',0,.22,0,1,.75,1,0);g.ico(.2,'#5a4630',.1,.4,-.06,1,.7,1,1);g.box(.1,.02,.06,'#6a8a3a',-.1,.49,.05,0,.6,0);g.box(.08,.02,.05,'#a8742a',.14,.54,-.02,0,1.2,0)},
scarecrow(g){g.cyl(.03,.04,1.4,C.log,0,.7,0,5);g.cyl(.025,.025,.9,C.woodD,0,1.06,0,4,0,0,H2);g.box(.36,.44,.16,'#8a4a3c',0,.9,0);g.box(.37,.06,.17,'#6a5a3c',0,.74,0);for(const x of[-1,1]){g.box(.24,.13,.13,'#8a4a3c',x*.28,1.06,0);g.ico(.07,C.straw,x*.42,1.06,0,1,.8,.8)}
  g.ico(.13,'#c8b48a',0,1.3,0,1,1.1,1);g.cyl(.24,.24,.02,C.straw,0,1.4,0,8);g.cone(.14,.16,shade(C.straw,.85),0,1.48,0,7);g.box(.03,.03,.02,C.black,-.05,1.32,.12);g.box(.03,.03,.02,C.black,.05,1.32,.12);ring(4,.09,(x,z,a)=>spike(g,.03,.16,C.straw,x,.68,z,2.6,a,3))},
// ================= defence =================
spikes(g){g.box(.8,.04,.12,C.woodD,0,.02,-.22);g.box(.8,.04,.12,C.woodD,0,.02,.22);for(let i=0;i<4;i++)for(const z of[-.22,.22]){const x=-.3+i*.2;spike(g,.045,.3,i%2?C.log:C.woodL,x,.02,z,.3,z>0?H2+(i-1.5)*.3:-H2-(i-1.5)*.3,4)}for(const x of[-.2,0,.2])spike(g,.045,.3,C.wood,x,0,0,.05,x*8,4)},
spikes2(g){const cal=(x,z,a,s)=>{spike(g,.02*s,.13*s,C.steelL,x,.035,z,0,0,3);ring(3,1,(dx,dz,b)=>spike(g,.02*s,.13*s,C.steel,x,.035,z,1.9,b,3),a)};[[0,.04,1.3],[.28,.22,1.1],[-.26,.24,1.1],[.24,-.26,1.2],[-.26,-.22,1.1],[.02,-.36,1]].forEach(([x,z,s],i)=>cal(x,z,i*1.3,s))},
spikes3(g){g.box(.92,.04,.92,'#3c424a',0,.02,0);for(const x of[-1,1])for(const z of[-1,1])g.box(.14,.045,.14,C.yel,x*.39,.02,z*.39);for(const x of[-.26,0,.26]){g.box(.04,.03,.8,C.black,x,.035,0);for(const z of[-.2,.2])g.cyl(.13,.13,.02,'#c8d0d6',x,.05,z,6,z*4+x*3,0,H2)}
  g.box(.8,.03,.04,C.red,0,.045,.42)},
barbed(g){for(const[x,z]of[[-.4,-.3],[.4,-.3],[-.4,.3],[.4,.3]])g.box(.04,.36,.04,C.woodD,x,.18,z,0,0,x*.3);for(const z of[-.3,.3])g.box(.84,.012,.012,'#8a8f94',0,.3,z);for(const x of[-.26,0,.26])g.torus(.19,.012,'#9a9fa4',x,.2,0,0,x*.6,H2,6);
  for(const[x,y,z]of[[-.13,.36,.06],[.13,.34,-.08],[.3,.2,.18],[-.3,.22,-.18],[0,.12,.2]])g.box(.04,.04,.04,C.steelL,x,y,z,.6,.6)},
bear_trap(g){g.cyl(.12,.12,.03,C.iron,0,.02,0,7);g.box(.5,.025,.06,C.steelD,0,.02,0);g.box(.1,.012,.1,C.rust,0,.04,0);for(const s of[-1,1]){for(const[x,ry]of[[-.17,-.5],[0,0],[.17,.5]])g.box(.19,.03,.03,C.steelL,x,.05,s*(.17-Math.abs(x)*.25),0,s*ry);
  for(const x of[-.2,-.07,.07,.2])g.cone(.022,.07,C.steelL,x,.09,s*(.165-Math.abs(x)*.25),3)}limb(g,.012,.012,.3,C.steelD,.25,.02,0,H2,-.6,3);g.box(.04,.12,.04,C.woodD,.48,.06,-.18)},
landmine(g){g.ico(.3,C.dirt,0,-.01,0,1,.14,1);g.cyl(.17,.19,.06,'#566238',0,.05,0,8);g.cyl(.1,.1,.03,'#3c4628',0,.09,0,6);g.box(.03,.03,.03,C.red,0,.115,0);g.box(.3,.01,.03,C.yel,0,.082,.12);g.ico(.06,C.soil,.24,.02,.14);g.ico(.05,C.soil,-.2,.02,-.2)},
tar_pit(g){g.cyl(.45,.47,.03,'#4a4238',0,.015,0,9);g.cyl(.41,.41,.02,'#17161a',0,.035,0,9);g.cyl(.16,.16,.012,'#2e2c34',-.12,.05,.1,6);g.cyl(.08,.08,.012,'#3c3a44',.18,.05,-.12,5);g.ico(.05,'#2e2c34',.1,.05,.2,1,.6,1);g.ico(.035,'#3c3a44',-.2,.05,-.16,1,.6,1);
  ring(5,.44,(x,z,a,i)=>g.box(.12,.07,.1,i%2?C.stone:C.stoneD,x,.035,z,0,-a+.4*i),.5)},
turret_xbow(g){tbase(g,C.wood);g.box(.12,.1,.9,C.woodD,0,.57,.04);g.box(.14,.06,.3,C.wood,0,.5,-.2);for(const s of[-1,1]){g.box(.4,.05,.07,C.log,s*.19,.6,.3,0,-s*.4);g.box(.012,.012,.36,'#d8d2c0',s*.19,.6,.06,0,-s*.95)}g.box(.03,.03,.56,C.woodL,0,.635,.2);g.cone(.035,.1,C.steelL,0,.635,.52,4,H2);
  g.box(.16,.05,.1,C.iron,0,.63,-.14);g.cyl(.07,.07,.2,C.hide,.2,.38,-.14,6);for(const x of[.17,.23])g.box(.015,.14,.015,C.woodL,x,.52,-.14)},
turret_gun(g){tbase(g,'#6c7882');g.box(.3,.24,.44,'#5c6670',0,.64,-.02);g.box(.32,.05,.3,C.steelL,0,.785,-.06);for(const x of[-.07,.07]){g.cyl(.03,.03,.4,C.black,x,.64,.4,6,H2);g.cyl(.04,.04,.06,C.steelD,x,.64,.58,6,H2)}g.box(.24,.1,.1,C.steelD,0,.64,.24);
  g.box(.14,.2,.24,'#566238',.22,.6,-.06);g.box(.142,.04,.242,C.yel,.22,.62,-.06);g.box(.08,.06,.04,C.red,0,.8,.1);g.box(.1,.1,.1,C.steelD,-.2,.62,-.04)},
turret_flame(g){tbase(g,'#6c7882');g.cyl(.14,.14,.4,C.red,0,.66,-.16,7,H2);g.cyl(.145,.145,.05,C.yel,0,.66,-.16,7,H2);g.box(.2,.16,.24,'#5c6670',0,.62,.1);g.cyl(.045,.045,.26,C.steelD,0,.64,.3,6,H2);g.cyl(.09,.05,.12,C.black,0,.64,.47,6,H2);
  g.cone(.04,.12,C.amber,0,.64,.58,4,H2);g.cyl(.015,.015,.24,C.copper,.08,.74,.26,3,H2);g.box(.06,.06,.06,C.copper,.08,.74,.12);g.cyl(.04,.04,.03,C.steelL,0,.82,-.16,6)},
turret_tesla(g){tbase(g,'#7c8890');g.cyl(.07,.1,.7,'#c8c2b0',0,.8,0,6);for(const y of[.6,.74,.88,1.02])g.cyl(.16-(y-.6)*.1,.17-(y-.6)*.1,.05,C.copper,0,y,0,7);g.cyl(.24,.24,.09,C.steelL,0,1.2,0,8);g.cyl(.14,.2,.05,shade(C.steelL,.8),0,1.27,0,8);g.sph(.11,'#8ad8f0',0,1.32,0,1,1,1,6,4);
  ring(3,.3,(x,z)=>g.box(.06,.2,.06,'#3c8c64',x,.24,z),.5);g.cone(.03,.16,'#8ad8f0',0,1.2,.3,4,H2)},
turret_mortar(g){g.cyl(.4,.44,.1,'#4a5058',0,.05,0,8);ring(6,.37,(x,z,a,i)=>g.ico(.13,shade('#b49f74',i%2?.9:1.05),x,.14,z,1.1,.55,.8,-a+H2),.52);g.cyl(.2,.22,.06,C.steelD,0,.13,0,7);const p=limb(g,.09,.1,.68,'#93a8ba',0,.14,-.1,.4,H2,7);
  g.cyl(.115,.115,.05,C.steelD,p[0],p[1]-.03,p[2]-.012,7,.4);g.cyl(.07,.07,.02,C.black,p[0],p[1]+.004,p[2]+.002,7,.4);for(const s of[-1,1])limb(g,.015,.02,.52,C.steelD,s*.22,.1,.28,.63,s>0?-2.356:-.785,3);
  for(const x of[-.2,-.11])g.cyl(.035,.035,.16,'#566238',x,.2,-.22,5);g.box(.05,.05,.05,C.yel,-.2,.31,-.22)},
guard_post(g){const c=C.plank;g.box(.96,.04,.96,C.woodD,0,.02,0);for(let i=0;i<4;i++)g.box(.23,.5+(i%2)*.06,.07,shade(c,.9+(i*3%4)*.07),-.36+i*.24,.29+(i%2)*.03,.44);for(const x of[-1,1]){g.box(.07,.46,.5,shade(c,x>0?1:.88),x*.445,.27,.2);g.box(.08,.7,.08,C.log,x*.44,.37,-.42)}
  g.box(.98,.06,.1,C.log,0,.38,.45);for(const x of[-.26,.02,.3])g.ico(.12,'#b49f74',x,.64,.41,1.25,.55,.8,x);g.box(.26,.24,.26,C.wood,.26,.16,-.24);g.box(.28,.03,.28,C.woodL,.26,.295,-.24);limb(g,.012,.015,.9,C.woodL,-.4,.04,-.3,.12,.4,3);g.cone(.03,.1,C.steelL,-.3,.98,-.26,3);
  g.box(.07,.1,.07,C.amber,.44,.76,-.42)},
watchtower(g){const c=C.log;for(const x of[-1,1])for(const z of[-1,1])limb(g,.035,.05,2.5,c,x*.42,0,z*.42,.045,Math.atan2(-z,-x),4);g.box(.84,.06,.84,C.plank,0,1.5,0);for(const s of[-1,1]){g.box(.84,.05,.04,C.woodD,0,1.9,s*.38);g.box(.04,.05,.8,C.woodD,s*.38,1.9,0);g.box(.8,.26,.03,C.wood,0,1.68,s*.39);g.box(.03,.26,.8,shade(C.wood,.88),s*.39,1.68,0)}
  frus(g,.98,.98,.06,.06,.4,'#8a5a3c',0,2.66,0);g.box(.9,.04,.9,C.woodD,0,2.46,0);for(const s of[-1,1])g.box(1,.05,.03,C.woodD,0,.75,s*.4,0,0,s*.75);for(const x of[.12,.3])g.box(.03,1.5,.03,C.woodL,x,.75,.46);for(let i=0;i<5;i++)g.box(.2,.03,.03,C.woodL,.21,.2+i*.28,.46);g.box(.06,.08,.06,C.amber,-.3,1.57,.3)},
// ================= utility =================
torch_stand(g){g.ico(.09,C.stoneD,.03,.03,0,1,.6,1);g.cyl(.03,.045,1.1,C.log,0,.55,0,5);g.cyl(.06,.045,.16,'#3a3028',0,1.14,0,6);g.cyl(.065,.065,.03,'#b49c6c',0,1.08,0,6);fire(g,0,1.2,0,.8)},
lamp(g){const c='#5c6670';ring(3,.18,(x,z,a)=>limb(g,.02,.025,.6,c,x,0,z,.32,a+PI,3));g.cyl(.03,.03,1.1,c,0,1.06,0,5);g.box(.5,.04,.04,c,0,1.6,0);for(const x of[-.16,.16]){g.box(.22,.18,.12,C.black,x,1.66,.04,.3);g.box(.18,.14,.02,'#fff4c0',x,1.64,.105,.3)}g.box(.1,.1,.1,C.yel,0,.56,0)},
radio(g){tbl(g,.7,.46,.46,C.plank);at(g,-.04,0,.02,0,()=>{g.box(.36,.24,.22,'#5a665e',-.06,.58,0);g.box(.14,.14,.02,C.black,-.14,.6,.112);g.box(.1,.03,.02,'#c8e0a0',.02,.64,.112);g.box(.04,.04,.03,C.red,.02,.56,.112);g.box(.04,.04,.03,C.yel,.08,.56,.112);g.box(.14,.1,.16,C.black,.24,.51,-.02)});
  const p=limb(g,.02,.04,2.4,C.steel,.34,0,-.36,.02,2,4);for(const y of[2.3,2,1.7])g.box(.3-(2.3-y)*.2,.02,.02,C.steelL,.34,y,-.36);g.box(.02,.02,.24,C.steelL,.34,2.15,-.36);g.box(.05,.05,.05,C.red,p[0],p[1]+.03,p[2]);limb(g,.006,.006,1.9,C.black,-.3,.5,-.1,.34,-.34,3)},
generator(g){const c=C.yel;for(const x of[-.3,.3])g.box(.08,.06,.74,C.black,x,.03,0);g.box(.7,.36,.5,c,0,.26,-.02);g.box(.4,.14,.36,C.red,-.12,.51,-.02);g.cyl(.04,.04,.03,C.black,-.12,.595,-.02,6);g.box(.24,.28,.4,'#3c4046',.22,.46,-.02);
  for(const z of[-.14,-.02,.1])g.box(.26,.24,.03,C.steelD,.22,.46,z);g.cyl(.035,.035,.3,C.steelD,.26,.74,-.16,5);g.box(.3,.2,.02,C.black,-.14,.28,.235);g.box(.06,.06,.03,C.red,-.22,.3,.245);g.box(.06,.06,.03,'#58d0a0',-.08,.3,.245);
  for(const x of[-.34,.34])g.box(.04,.5,.04,C.steelD,x,.31,.26);g.box(.72,.04,.04,C.steelD,0,.56,.26);limb(g,.012,.012,.2,C.black,.3,.14,.26,1.4,1,3)},
beacon(g){g.cyl(.4,.46,.3,C.stoneD,0,.15,0,8);g.cyl(.3,.38,.4,C.stone,0,.5,0,8);ring(4,.36,(x,z,a,i)=>g.box(.16,.12,.12,i%2?C.stoneL:C.stone,x,.34,z,.2,-a,.2),.4);g.cyl(.34,.22,.16,C.iron,0,.78,0,8);g.cyl(.3,.3,.02,C.fire,0,.865,0,8);
  ring(3,.14,(x,z,a,i)=>limb(g,.04,.05,.44,i?C.woodD:C.bark,x,.84,z,.7,a+PI,4));fire(g,0,.9,0,2);fire(g,.1,.9,.06,1.2)},
trade_post(g){const c=C.plank;g.box(.9,.5,.3,c,0,.25,.26);g.box(.96,.05,.36,C.woodL,0,.525,.26);for(const x of[-.44,.44]){g.box(.05,1.3,.05,C.woodD,x,.65,.4);g.box(.05,1.5,.05,C.woodD,x,.75,-.4)}
  for(let i=0;i<5;i++)g.box(.196,.03,.98,i%2?C.white:C.red,-.392+i*.196,1.42,0,.2);crateB(g,.3,.26,.3,C.wood);g.ico(.13,C.cloth,-.3,.1,-.2,1,.9,1);g.ico(.11,'#b49f74',-.14,.08,-.3,1,.8,1);g.box(.12,.1,.12,C.red,.26,.6,.26);bottle(g,-.2,.55,.26,'#5a8a5a');bottle(g,-.06,.55,.3,'#8a5a3a');
  g.box(.3,.16,.02,C.woodL,0,.3,.42);g.box(.18,.03,.022,C.yel,0,.3,.422)},
repair_bench(g){tbl(g,.9,.54,.5,C.log,C.wood,.08);for(const x of[-.34,-.16])g.box(.04,.3,.05,C.woodD,x,.62,-.04);g.cyl(.17,.17,.08,C.stoneL,-.25,.74,-.04,9,H2);g.cyl(.03,.03,.24,C.iron,-.25,.74,-.04,4,0,0,H2);g.box(.3,.012,.22,C.hide,.18,.506,.06,0,.2);
  g.box(.03,.03,.26,C.woodL,.14,.53,-.14,0,-.5);g.box(.1,.06,.06,C.iron,.24,.53,-.2,0,-.5);g.cyl(.04,.04,.06,C.red,.38,.53,.2,6);g.box(.24,.2,.24,C.wood,.2,.12,0)},
kennel(g){const c=C.plank;g.box(.74,.44,.8,c,0,.24,-.04);frus(g,.86,.9,.04,.9,.32,'#8a4a34',0,.62,-.04);g.box(.3,.34,.02,'#241c16',0,.2,.365);g.cyl(.15,.15,.02,'#241c16',0,.37,.365,8,H2);g.box(.76,.04,.82,C.woodD,0,.02,-.04);
  g.cyl(.08,.06,.05,C.steelL,.34,.025,.42,6);g.box(.14,.03,.035,C.bone,-.32,.02,.44,0,.5);g.box(.2,.06,.02,C.woodL,0,.58,.37)},
map_table(g){tbl(g,.9,.62,.5,C.wood);g.box(.7,.012,.46,'#d8c8a0',0,.506,0,0,.06);g.box(.3,.014,.2,'#9ab87a',-.14,.508,-.06,0,.3);g.box(.5,.014,.04,C.water,.04,.509,.06,0,.5);g.box(.06,.016,.06,C.red,.2,.51,-.1,0,.8);g.box(.05,.05,.05,C.glass,-.3,.535,.18);
  g.cyl(.05,.05,.02,C.yel,.3,.52,.16,7);g.cyl(.025,.025,.1,C.white,-.34,.55,-.2,5);g.cone(.02,.06,C.amber,-.34,.63,-.2,4)},
// ================= decor =================
rug(g){const c='#9c4a3c';g.box(.9,.016,.62,c,0,.008,0);g.box(.78,.02,.5,'#d8c8a0',0,.01,0);g.box(.7,.024,.42,c,0,.012,0);for(const x of[-.2,0,.2])g.box(.1,.028,.3,C.teal,x,.014,0,0,PI/4);for(const s of[-1,1])for(let i=0;i<5;i++)g.box(.03,.012,.06,'#d8c8a0',-.4+i*.2,.006,s*.33)},
planter(g){g.cyl(.22,.15,.26,'#b0623e',0,.13,0,7);g.cyl(.24,.24,.05,'#c0704a',0,.26,0,7);g.cyl(.19,.19,.012,C.soil,0,.29,0,7);g.ico(.17,'#4f8a40',0,.42,0,1,.9,1);g.ico(.11,'#5f9a48',.1,.5,.06);g.box(.06,.06,.06,'#d86a8a',-.08,.56,.08,.5,.5);g.box(.06,.06,.06,C.yel,.12,.6,0,.5,.5)},
trophy(g){const c=C.wood;for(const x of[-.36,.36])g.box(.07,.74,.07,C.woodD,x,.37,-.1);g.box(.86,.3,.05,c,0,.56,-.1);g.box(.9,.05,.1,C.woodL,0,.73,-.1);g.ico(.09,C.bone,0,.56,-.03,.9,1.2,.8);g.box(.07,.1,.06,C.bone,0,.46,-.01);
  for(const s of[-1,1]){limb(g,.012,.02,.26,C.bone,s*.06,.62,-.04,1,s>0?0:PI,3);limb(g,.01,.015,.16,C.bone,s*.2,.72,-.04,.2,0,3);limb(g,.01,.015,.14,C.bone,s*.14,.68,-.04,.1,0,3)}g.box(.5,.03,.3,C.hide,0,.05,.16,0,.1);g.box(.3,.035,.2,shade(C.hide,1.2),0,.05,.16,0,.1)},
bench_seat(g){const c=C.plank;for(const x of[-.36,.36]){g.box(.06,.26,.3,C.woodD,x,.13,0);g.box(.05,.34,.05,C.woodD,x,.45,-.15)}for(const z of[-.08,.08])g.box(.9,.04,.14,shade(c,z>0?1.1:.95),0,.28,z);g.box(.9,.12,.03,c,0,.52,-.15)},
flag(g){g.cyl(.07,.09,.1,C.stoneD,0,.05,0,6);g.cyl(.025,.03,2,C.log,0,1,0,5);g.box(.5,.03,.03,C.woodD,.2,1.9,0);g.box(.4,.7,.02,C.teal,.22,1.53,0);frus(g,.4,.02,.01,.02,.16,C.teal,.22,1.1,0,PI);g.box(.16,.16,.026,C.amber,.22,1.6,0,0,0,PI/4);g.box(.4,.06,.024,C.amber,.22,1.3,0);g.cone(.04,.1,C.yel,0,2.05,0,4)},
bookshelf(g){const c=C.wood;g.box(.9,1.3,.36,C.woodD,0,.65,-.03);for(const y of[.05,.46,.87,1.28])g.box(.92,.05,.4,c,0,y,0);for(const x of[-.45,.45])g.box(.04,1.3,.4,c,x,.65,0);
  const bc=[C.red,'#5c7a8a','#6a8a5a',C.yel,'#8a6a8a',C.cloth];[.075,.485,.895].forEach((y,r)=>{let x=-.4;for(let i=0;i<5;i++){const w=.1+((i+r)%3)*.03,h=.26+((i*2+r)%3)*.04;g.box(w,h,.24,bc[(i+r*2)%6],x+w/2,y+h/2,.04);x+=w+.012}});g.box(.2,.1,.2,C.cloth,.26,.95,.04,0,.3)},
// ================= extras =================
lootbag(g){g.ico(.16,C.cloth,0,.1,0,1.1,.75,1);g.cyl(.03,.05,.07,shade(C.cloth,.85),.02,.24,0,5);g.box(.11,.02,.11,'#6a5a3c',.02,.21,0,0,.5);g.ico(.07,shade(C.cloth,.9),.13,.05,.08)},
veh_cart(g){const c=C.plank;at(g,0,0,-.17,0,()=>{spoked(g,-.4,.24,-.1,.24);spoked(g,.4,.24,-.1,.24);g.box(.64,.05,.9,c,0,.3,-.1);for(const s of[-1,1]){g.box(.04,.22,.9,shade(c,.86),s*.32,.43,-.1);g.box(.04,.05,.6,C.woodD,s*.3,.3,.62)}g.box(.64,.22,.04,C.wood,0,.43,-.55);g.box(.64,.14,.04,C.wood,0,.39,.35);
  g.box(.66,.04,.04,C.woodD,0,.3,.9);g.box(.05,.28,.05,C.woodD,0,.14,.3);g.ico(.16,C.cloth,-.1,.44,-.2,1,.8,1);g.box(.24,.18,.24,C.wood,.14,.42,-.36,0,.2)})},
veh_bike(g){const c=C.blue;for(const z of[-.42,.42]){g.cyl(.22,.22,.04,C.rubber,0,.22,z,8,0,0,H2);g.cyl(.16,.16,.045,'#8a9096',0,.22,z,8,0,0,H2)}limb(g,.02,.02,.5,c,0,.24,-.42,.9,H2,4);limb(g,.02,.02,.44,c,0,.24,-.42,.3,H2,4);limb(g,.02,.02,.48,c,0,.66,-.28,1.5,H2,4);
  limb(g,.02,.02,.56,c,0,.22,.42,.32,-H2,4);limb(g,.02,.02,.5,c,0,.28,-.04,.9,H2,4);g.box(.1,.04,.2,C.black,0,.7,-.3);g.box(.4,.03,.03,C.steelL,0,.78,.24);g.box(.05,.05,.05,C.black,-.2,.78,.24);g.box(.05,.05,.05,C.black,.2,.78,.24);g.box(.14,.1,.2,C.hide,0,.56,-.46)},
veh_moto(g){const c=C.red;for(const z of[-.42,.46]){g.cyl(.2,.2,.12,C.rubber,0,.2,z,8,0,0,H2);g.box(.14,.14,.14,C.steel,0,.2,z,PI/4)}g.box(.2,.2,.3,'#3c4046',0,.3,0);g.box(.22,.14,.3,c,0,.52,.1);g.box(.2,.08,.36,C.black,0,.5,-.24);g.box(.16,.05,.3,c,0,.42,-.46,.2);
  limb(g,.03,.03,.46,C.steelL,-.07,.2,.46,.4,-H2,4);limb(g,.03,.03,.46,C.steelL,.07,.2,.46,.4,-H2,4);g.box(.46,.03,.03,C.steelD,0,.7,.26);g.box(.1,.1,.06,'#f0e8b0',0,.6,.36);g.cyl(.04,.04,.5,C.steelL,.13,.24,-.3,5,H2);g.box(.2,.14,.2,C.hide,0,.56,-.44)},
veh_buggy(g){const c=C.orange;for(const x of[-1,1]){wheel(g,x*.4,.2,.5,.2,.14);wheel(g,x*.4,.22,-.48,.22,.16)}g.box(.56,.1,1.3,'#3c4046',0,.24,0);g.box(.5,.12,.4,c,0,.34,.5);frus(g,.5,.2,.4,.02,.1,c,0,.42,.72);g.box(.4,.2,.3,'#5c6670',0,.4,-.48);g.box(.3,.06,.2,C.steelL,0,.53,-.48);
  for(const x of[-1,1]){g.box(.04,.44,.04,C.steelD,x*.27,.52,.26,-.3);g.box(.04,.44,.04,C.steelD,x*.27,.52,-.26,.3);g.box(.04,.04,.42,C.steelD,x*.27,.73,0)}for(const z of[-.2,.2])g.box(.58,.04,.04,C.steelD,0,.73,z);g.box(.4,.2,.1,C.black,0,.4,-.2);g.box(.4,.06,.26,C.black,0,.32,-.04);
  for(const x of[-.14,.14])g.box(.1,.08,.04,'#f0e8b0',x,.76,.22)},
veh_truck(g){const c='#5c7a6a',d=shade(c,.8);at(g,0,0,0,0,()=>{for(const x of[-1,1])for(const z of[-.5,.48])wheel(g,x*.38,.18,z,.18,.12);g.box(.8,.22,1.56,c,0,.34,0);g.box(.78,.1,.4,shade(c,1.12),0,.5,.56);frus(g,.76,.5,.66,.36,.26,'#34424c',0,.58,.12);g.box(.66,.04,.36,c,0,.73,.12);
  for(const x of[-1,1])g.box(.06,.16,.62,d,x*.37,.53,-.46);g.box(.8,.16,.06,d,0,.53,-.75);g.box(.68,.02,.6,'#3c4046',0,.46,-.45);g.box(.84,.08,.08,C.steelD,0,.26,.79);g.box(.84,.08,.06,C.steelD,0,.26,-.79);for(const x of[-.28,.28])g.box(.14,.07,.03,'#f0e8b0',x,.4,.785);
  g.box(.3,.2,.3,C.wood,-.12,.56,-.5,0,.2);g.cyl(.1,.1,.24,C.red,.2,.58,-.34,7);g.box(.5,.05,.05,C.steelD,0,.78,.12)},.96)},
ghost_tile(g){g.quad(.96,.96,'#ffffff',0,.03,0)},
};

/** Held models are authored slim in profile; `fat` widens them sideways so they still read from the high game camera. */
const fat=(g,i0,k=1.35)=>{for(let i=i0;i<g.pos.length;i+=3)g.pos[i]*=k};
export const HAND={
hatchet(g){haft(g,.52,C.wood);axehead(g,.34,'#8d8f93','#c4c8cc',1.1);g.box(.06,.05,.06,C.cloth,0,.25,0);g.box(.055,.03,.055,C.woodD,0,-.1,0)},
pick(g){haft(g,.6,C.wood);g.box(.055,.07,.12,'#8d8f93',0,.46,0);spike(g,.04,.26,'#a7adb3',0,.46,.04,H2+.25,H2,4);spike(g,.04,.26,'#a7adb3',0,.46,-.04,H2+.25,-H2,4);g.box(.06,.05,.06,C.cloth,0,.38,0)},
rod(g){const p=limb(g,.008,.02,1.05,'#9b7a4a',0,-.1,0,.14,H2,4);g.cyl(.028,.028,.2,C.hide,0,0,0,5);g.cyl(.045,.045,.035,C.steel,.04,.14,.02,6,0,0,H2);g.box(.006,.36,.006,C.white,p[0],p[1]-.18,p[2]);g.box(.035,.05,.035,C.red,p[0],p[1]-.38,p[2]);g.box(.03,.02,.03,C.white,p[0],p[1]-.345,p[2])},
crowbar(g){const c='#a83a2e';g.cyl(.02,.02,.62,c,0,.21,0,5);const p=limb(g,.02,.02,.1,c,0,.5,0,1,H2,4);limb(g,.012,.02,.1,shade(c,.8),...p,2.3,H2,4);g.box(.014,.1,.045,shade(c,.8),0,-.14,.012,-.3);g.box(.03,.03,.03,C.steelL,0,-.19,.03)},
wrench(g){const c='#9aa1a8';g.box(.022,.4,.05,c,0,.12,0);g.box(.026,.06,.13,shade(c,.85),0,.34,0);for(const z of[-.047,.047])g.box(.026,.09,.036,shade(c,1.12),0,.41,z);g.box(.026,.08,.08,shade(c,.85),0,-.1,0,PI/4);g.box(.03,.03,.03,C.black,0,-.1,0,PI/4)},
club(g){g.cyl(.065,.028,.62,'#8a5a2b',0,.21,0,6);g.box(.07,.05,.06,'#6e4622',.035,.4,.02,.4,.3);g.box(.06,.05,.06,'#6e4622',-.03,.3,-.03,.2,.8);g.box(.055,.1,.055,C.cloth,0,0,0);g.cyl(.07,.065,.03,'#6e4622',0,.535,0,6)},
spear(g){haft(g,.92,'#9b7a4a',.022,-.2);g.box(.012,.24,.07,'#5a5f66',0,.78,0);frus(g,.012,.07,.006,.008,.12,'#8d8f93',0,.96,0);g.box(.045,.07,.045,C.cloth,0,.68,0);g.box(.045,.03,.045,C.red,0,.62,0)},
knife(g){g.box(.032,.14,.045,C.hide,0,-.01,0);g.box(.036,.022,.09,C.steelD,0,.07,0);frus(g,.014,.06,.008,.014,.3,'#e4dcc6',0,.23,.005);g.box(.034,.03,.05,C.woodD,0,-.09,0)},
bat(g){g.cyl(.05,.022,.74,'#c49a5a',0,.27,0,6);g.cyl(.034,.034,.03,'#a67c42',0,-.1,0,6);g.box(.05,.14,.05,C.black,0,0,0);g.cyl(.052,.052,.03,'#a67c42',0,.63,0,6)},
machete(g){g.box(.034,.15,.05,C.black,0,-.01,0);g.box(.036,.02,.075,C.steelD,0,.075,0);frus(g,.012,.065,.012,.095,.48,'#a7adb3',0,.325,.012);frus(g,.012,.095,.008,.02,.08,'#c4c8cc',0,.605,.012);g.box(.004,.46,.016,'#dfe7ee',0,.33,.06,-.03)},
nailbat(g){g.cyl(.05,.022,.74,'#c49a5a',0,.27,0,6);g.cyl(.034,.034,.03,'#a67c42',0,-.1,0,6);g.box(.05,.14,.05,C.black,0,0,0);for(let i=0;i<6;i++)spike(g,.014,.1,'#c4c8cc',0,.4+i*.04,0,H2,i*2.4,3)},
fireaxe(g){haft(g,.86,'#c8a060',.024,-.16);g.box(.05,.2,.05,C.black,0,-.04,0);axehead(g,.6,'#c8302a','#dfe7ee',1.25);spike(g,.035,.14,'#c8302a',0,.6,-.02,H2,-H2,4);g.box(.052,.06,.052,'#c8302a',0,.5,0)},
sledge(g){haft(g,.84,C.wood,.026,-.16);g.box(.13,.14,.3,'#5f6b78',0,.66,0);for(const z of[-.155,.155])g.box(.11,.12,.02,'#a7adb3',0,.66,z);g.box(.055,.18,.055,C.black,0,-.04,0);g.box(.14,.03,.1,C.yel,0,.66,0)},
katana(g){g.cyl(.022,.022,.26,'#2a2a2a',0,.02,0,5);for(const y of[-.06,.02,.1])g.box(.05,.02,.05,C.red,0,y,0,0,PI/4);g.cyl(.055,.055,.016,'#c8a030',0,.16,0,6);g.box(.012,.36,.04,'#dfe7ee',0,.345,.004,.03);g.box(.012,.34,.038,'#dfe7ee',0,.685,.024,.09);
  frus(g,.012,.038,.006,.008,.08,'#f4f8fa',0,.885,.045,.12)},
baton(g){g.cyl(.026,.026,.5,'#26282c',0,.17,0,6);g.box(.058,.16,.058,C.black,0,0,0);g.box(.06,.03,.06,C.yel,0,.1,0);for(const y of[.3,.36])g.box(.062,.022,.062,'#3a7ad0',0,y,0);for(const z of[-.02,.02])g.box(.012,.08,.012,C.steelL,0,.45,z);g.ico(.035,'#8ad8f8',0,.49,0)},
sawmace(g){haft(g,.72,'#5f6b78',.024,-.12);g.box(.055,.18,.055,C.black,0,-.02,0);g.cyl(.16,.16,.016,'#c4c8cc',0,.6,0,8,0,0,H2);g.cyl(.16,.16,.016,'#a7adb3',0,.6,0,8,H2,PI/8);g.box(.09,.09,.09,'#c8302a',0,.6,0);g.box(.05,.04,.05,'#c8302a',0,.44,0)},
chainsaw(g){g.box(.11,.24,.18,'#d0802a',0,.1,0);g.box(.115,.07,.185,C.black,0,.03,0);g.box(.02,.52,.1,'#c4c8cc',0,.47,.01);g.box(.012,.56,.13,'#26282c',0,.48,.01);g.box(.035,.12,.05,C.black,0,-.08,-.03);g.box(.03,.03,.14,C.black,0,-.13,.02);
  g.box(.2,.025,.025,C.black,0,.2,.11);for(const x of[-.09,.09])g.box(.025,.1,.025,C.black,x,.15,.11);g.box(.05,.05,.05,C.steelL,.07,.12,-.06)},
glaive(g){haft(g,.82,'#b8c4d0',.022,-.2);g.box(.05,.2,.05,C.black,0,-.02,0);g.box(.05,.05,.07,'#8a97a6',0,.6,0);frus(g,.014,.07,.01,.12,.3,'#dfe7ee',0,.76,.02);frus(g,.01,.12,.006,.01,.12,'#f4f8fa',0,.97,.045,.25);spike(g,.025,.1,'#b8c4d0',0,.62,-.02,2,-H2,3)},
reaver(g){const c='#9a8fc0';g.cyl(.024,.024,.24,'#3a3350',0,.02,0,5);g.ico(.04,C.violetL,0,-.12,0);g.box(.04,.04,.22,'#3a3350',0,.15,0);for(const z of[-.11,.11])spike(g,.025,.1,'#3a3350',0,.15,z,.5,z>0?H2:-H2,3);frus(g,.02,.11,.014,.08,.56,c,0,.45,0);
  frus(g,.014,.08,.006,.01,.12,shade(c,1.15),0,.79,0);g.box(.026,.5,.022,C.violetL,0,.44,0)},
bow(g){const c='#8a5a2b';for(const s of[1,-1]){const up=s>0?.22:PI-.22,p=limb(g,.014,.022,.3,c,0,s*.04,.05,up,-H2,4);limb(g,.008,.014,.28,shade(c,1.15),...p,s>0?.62:PI-.62,-H2,4)}g.box(.036,.12,.045,C.hide,0,0,.05);g.box(.006,1.06,.006,'#e8e0d0',0,0,-.172);
  g.box(.012,.012,.5,C.woodL,0,.01,.1);g.cone(.022,.07,C.steelL,0,.01,.38,4,H2)},
crossbow(g){const c='#6b4226';g.box(.05,.06,.52,c,0,.04,.1);g.box(.05,.11,.14,shade(c,.85),0,.015,-.22);pgrip(g,shade(c,.8),-.04);for(const s of[-1,1]){g.box(.28,.03,.04,C.steelD,s*.13,.065,.3,0,-s*.38);g.box(.006,.006,.33,'#e8e0d0',s*.13,.08,.15,0,s*.9)}
  g.box(.014,.014,.34,C.woodL,0,.085,.22);g.cone(.022,.06,C.steelL,0,.085,.42,4,H2);g.box(.09,.012,.07,C.steelD,0,.04,.4)},
pistol(g){const c='#3a3a40';g.box(.044,.065,.26,c,0,.055,.07);barrel(g,C.steel,.016,.06,.2,.065);pgrip(g,'#6a4a2c',-.02);g.box(.014,.035,.06,C.black,0,.005,.06);g.box(.014,.02,.02,C.black,0,.098,.18);g.box(.046,.03,.08,shade(c,1.4),0,.07,-.03)},
rifle(g){const w='#6b4226';g.box(.042,.085,.2,w,0,.02,-.17,.14);g.box(.044,.05,.03,C.black,0,.0,-.27,.14);gun(g,'#3a3a40',.2,-.07,.06);g.box(.042,.045,.24,w,0,.035,.24);barrel(g,'#3a3a40',.015,.42,.13,.062);g.box(.014,.035,.06,C.black,0,.0,.02);
  g.cyl(.022,.022,.18,C.black,0,.115,.04,5,H2);g.box(.012,.03,.012,C.black,0,.085,.55)},
shotgun(g){const w='#4a3a2a';g.box(.044,.09,.2,w,0,.02,-.17,.14);gun(g,'#2e2e32',.22,-.07,.07);barrel(g,'#3a3a40',.022,.4,.15,.07,6);barrel(g,'#2e2e32',.018,.3,.15,.03);g.box(.05,.055,.14,w,0,.03,.3);g.box(.014,.035,.06,C.black,0,-.005,.02);g.box(.012,.02,.012,C.steelL,0,.1,.52)},
smg(g){const c='#3a3a40';gun(g,c,.28,-.08,.075);barrel(g,C.black,.018,.1,.2);pgrip(g);g.box(.032,.18,.045,C.black,0,-.07,.1);g.box(.014,.014,.16,C.steelD,0,.07,-.16);g.box(.02,.08,.02,C.steelD,0,.04,-.24);g.box(.02,.03,.05,C.black,0,.1,.06);g.box(.04,.04,.08,shade(c,1.4),0,.03,.18)},
carbine(g){const c='#2f3a2f';stock(g,c,-.2,.18);gun(g,'#3a3a40',.24,-.1,.07);g.box(.05,.06,.2,c,0,.05,.24);barrel(g,C.black,.015,.2,.3,.06,4);g.box(.036,.036,.05,C.black,0,.06,.5);pgrip(g);g.box(.034,.17,.055,C.black,0,-.06,.1,-.25);g.box(.014,.03,.16,C.black,0,.105,.0)},
sniper(g){const c='#2a2a30';g.box(.04,.08,.22,c,0,.02,-.2,.1);gun(g,c,.42,-.1,.065);barrel(g,C.steelD,.014,.3,.3,.065,4);g.box(.04,.04,.07,C.black,0,.065,.6);pgrip(g);
  g.cyl(.03,.03,.26,C.black,0,.125,.04,5,H2);g.box(.05,.05,.012,'#9fd0e8',0,.125,.172);for(const s of[-1,1])limb(g,.008,.01,.18,C.steelD,0,.03,.3,2.7,s>0?0:PI,3)},
flamer(g){barrel(g,C.steelD,.024,.5,-.06,.07);g.cyl(.06,.06,.26,'#c8602a',0,-.03,.24,6,H2);g.box(.1,.124,.03,C.yel,0,-.03,.24);pgrip(g);g.box(.036,.1,.04,C.black,0,.0,.4);g.cyl(.045,.026,.1,C.black,0,.07,.49,4,H2);
  g.cone(.025,.08,C.amber,0,.07,.58,4,H2);g.box(.05,.07,.12,'#3a3a40',0,.06,-.1)},
launcher(g){const c='#4a5a3a';g.box(.042,.1,.2,c,0,.02,-.22,.1);gun(g,'#3a3a40',.14,-.12,.06);g.cyl(.085,.085,.13,C.steelD,0,.04,.09,6,H2);barrel(g,c,.055,.3,.16,.06,6);g.box(.1,.13,.03,C.black,0,.06,.45);pgrip(g,C.black,-.03);g.box(.034,.1,.04,C.black,0,-.03,.3);
  g.box(.03,.03,.05,C.yel,0,.13,.3)},
minigun(g){const c='#4a4a50';g.box(.11,.13,.26,c,0,.02,.02);g.cyl(.048,.048,.5,'#6c7078',0,.02,.4,6,H2);g.cyl(.064,.064,.035,C.black,0,.02,.64,6,H2);g.box(.11,.12,.035,C.black,0,.02,.32);g.box(.02,.05,.22,C.black,0,.11,.04);
  g.box(.036,.1,.05,C.black,0,.0,-.14,.25);g.box(.1,.14,.14,'#566238',.1,-.02,.02);g.box(.102,.03,.142,C.yel,.1,.0,.02)},
lance(g){const c='#9a8fc0';g.box(.06,.09,.3,'#3a3350',0,.04,.0);pgrip(g,'#3a3350');frus(g,.07,.1,.03,.045,.44,c,0,.05,.37,H2);for(const z of[.22,.4])g.box(.08,.09-z*.06,.02,'#3a3350',0,.05,z);g.ico(.04,'#3ad0c0',0,.05,.62,1,1,1.6);
  g.box(.05,.08,.1,'#3ad0c0',0,-.02,.1);g.box(.064,.03,.12,C.violetL,0,.1,-.04);spike(g,.03,.14,c,0,.08,-.12,H2+.5,-H2,3)},
bottle(g){g.cyl(.04,.04,.13,'#5a8a5a',0,.065,0,6);g.cyl(.016,.03,.06,'#6a9a6a',0,.16,0,6);g.cyl(.03,.03,.04,'#c8602a',0,.07,0,6);g.box(.03,.07,.03,C.cloth,0,.21,0,0,0,.2);g.cone(.03,.08,C.amber,.01,.28,0,4);g.cone(.018,.05,C.flame,.01,.275,.004,4)},
grenade(g){const c='#4a5a3a';g.ico(.065,c,0,.07,0,1,1.15,1);g.cyl(.066,.066,.02,shade(c,.75),0,.07,0,6);g.cyl(.025,.025,.04,C.steelD,0,.155,0,5);g.box(.02,.1,.012,C.steelL,.035,.12,0,0,0,-.3);g.box(.04,.04,.008,C.steelL,-.045,.17,0,0,0,PI/4)},
};
for(const k in HAND){const f=HAND[k];HAND[k]=g=>{const i0=g.pos.length;f(g);fat(g,i0)}}

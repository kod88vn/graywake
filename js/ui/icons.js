// Procedural item icons. Canvas 2D only: every glyph is a small draw function working in a 0..100 box.
// GLYPHS[name](c, a, b): c = 2D context (already scaled), a = main colour, b = optional secondary colour.
// drawIcon scales the context; iconURL / iconFor render to a cached PNG data: URL.
import {ITEMS} from '../data/items.js';

// ---------- colour helpers ----------
const RGB={};
function rgb(h){let v=RGB[h];if(v)return v;let s=String(h||'').replace('#','');if(s.length===3)s=s.replace(/./g,'$&$&');
  const n=parseInt(s,16);v=s.length===6&&!isNaN(n)?[(n>>16)&255,(n>>8)&255,n&255]:[138,143,147];return RGB[h]=v}
const hex=(r,g,b)=>'#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
export function mix(h1,h2,f){const a=rgb(h1),b=rgb(h2);return hex(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,a[2]+(b[2]-a[2])*f)}
export const darken=(h,f=.3)=>mix(h,'#0b0c09',f);
export const lighten=(h,f=.3)=>mix(h,'#ffffff',f);
export function lum(h){const v=rgb(h);return(.299*v[0]+.587*v[1]+.114*v[2])/255}
/* Outline colour: a darkened fill, except for near-black fills, which get a lighter rim so they still read on the dark slot. */
export function outline(h){const l=lum(h);return l<.27?lighten(h,(.44-l)/(1-l)):darken(h,.55)}
const dk=darken,li=lighten,ol=outline;

const WOOD='#8a5a2b',WOODL='#b9854a',STEEL='#a7adb3',IRON='#5a6068',DARK='#34363b',BONE='#e4dcc6',CREAM='#ece6d6',GLASS='#cfe6ea',
  GOLD='#d0a020',RED='#c8302a',GREEN='#5aa04a',FIRE='#f08a1e',FIRE2='#ffe066',INK='#17181a';

// ---------- path helpers ----------
const TAU=Math.PI*2;
const P=d=>typeof d==='string'?new Path2D(d):d;
function rr(x,y,w,h,r=4){r=Math.max(0,Math.min(r,w/2,h/2));const p=new Path2D();p.moveTo(x+r,y);p.arcTo(x+w,y,x+w,y+h,r);p.arcTo(x+w,y+h,x,y+h,r);p.arcTo(x,y+h,x,y,r);p.arcTo(x,y,x+w,y,r);p.closePath();return p}
function el(x,y,rx,ry=rx,rot=0){const p=new Path2D();p.ellipse(x,y,rx,ry,rot,0,TAU);return p}
function ring(x,y,rx,ry,hx,hy){const p=el(x,y,rx,ry);p.moveTo(x+hx,y);p.ellipse(x,y,hx,hy,0,0,TAU);return p}
function arc(x,y,r,a0,a1){const p=new Path2D();p.arc(x,y,r,a0,a1);return p}
function star(cx,cy,ro,ri,n=5,rot=-Math.PI/2){let s='';for(let i=0;i<n*2;i++){const r=i%2?ri:ro,t=rot+i*Math.PI/n;s+=(i?'L':'M')+(cx+Math.cos(t)*r).toFixed(1)+' '+(cy+Math.sin(t)*r).toFixed(1)}return s+'Z'}
const ngon=(cx,cy,r,n,rot=0)=>star(cx,cy,r,r*Math.cos(Math.PI/n),n,rot);
function gearP(cx,cy,ro,ri,n,hole){let s='';const w=Math.PI/n;for(let i=0;i<n;i++){const t=i*TAU/n;
    [[ri,-w*.62],[ro,-w*.36],[ro,w*.36],[ri,w*.62]].forEach((q,j)=>{s+=(i||j?'L':'M')+(cx+Math.cos(t+q[1])*q[0]).toFixed(1)+' '+(cy+Math.sin(t+q[1])*q[0]).toFixed(1)})}
  const p=new Path2D(s+'Z');if(hole){p.moveTo(cx+hole,cy);p.arc(cx,cy,hole,0,TAU)}return p}

// ---------- drawing helpers ----------
let LA=0,MX=1; // rotation of the current local frame, so the light keeps coming from the top-left of the screen
/* Solid shape: fill, optional clipped inner details, highlight crescent top-left + shade crescent bottom-right (strength k), outline (width lw). */
function sh(c,d,col,inner,k=1,lw=5){const p=P(d);c.fillStyle=col;c.fill(p,'evenodd');
  if(inner||k){c.save();c.clip(p,'evenodd');if(inner)inner();
    if(k){const cs=Math.cos(LA),sn=Math.sin(LA),q=new Path2D();q.rect(-300,-300,700,700);q.addPath(p);
      const ov=(x,y,f)=>{x*=MX;c.save();c.translate(x*cs+y*sn,-x*sn+y*cs);c.fillStyle=f;c.fill(q,'evenodd');c.restore()};
      ov(-3*k,-4*k,'rgba(0,0,0,.26)');ov(2.4*k,3.2*k,'rgba(255,255,255,.28)')}
    c.restore()}
  if(lw){c.strokeStyle=ol(col);c.lineWidth=lw;c.stroke(p)}}
/* Union of overlapping shapes sharing one outline. */
function un(c,ds,col,inner,lw=5){const ps=ds.map(P);c.strokeStyle=ol(col);c.lineWidth=lw*2;for(const p of ps)c.stroke(p);c.fillStyle=col;for(const p of ps)c.fill(p);
  if(inner){const q=new Path2D();for(const p of ps)q.addPath(p);c.save();c.clip(q,'nonzero');inner();c.restore()}}
function fl(c,d,col,al=1){c.globalAlpha=al;c.fillStyle=col;c.fill(P(d),'evenodd');c.globalAlpha=1}
function ln(c,d,col,lw=3,al=1){c.globalAlpha=al;c.strokeStyle=col;c.lineWidth=lw;c.stroke(P(d));c.globalAlpha=1}
/* Outlined stroke ("tube"): rods, ropes, straps, wires. */
function tb(c,d,col,w=7,o=5){const p=P(d);ln(c,p,ol(col),w+o);ln(c,p,col,w)}
function at(c,x,y,deg,s,fn){const r=deg*Math.PI/180,o=LA;c.save();c.translate(x,y);c.rotate(r);c.scale(s,s);LA=o+r;try{fn()}finally{LA=o;c.restore()}}
/* Diagonal frame: draw the object lying left-to-right along y=50, it ends up running bottom-left to top-right. */
const dg=(c,fn,deg=-45,s=.92)=>at(c,50,50,deg,s,()=>{c.translate(-50,-50);fn()});
/* Mirror a drawing left-right (the light stays where it was). */
function mir(c,fn){c.save();c.translate(100,0);c.scale(-1,1);MX=-MX;try{fn()}finally{MX=-MX;c.restore()}}
const fat=(c,k)=>{c.translate(0,50);c.scale(1,k);c.translate(0,-50)};
/* Scale a whole drawing about the box centre. */
const zm=(c,s,fn,dx=0,dy=0)=>at(c,50+dx,50+dy,0,s,()=>{c.translate(-50,-50);fn()});
const hd=(c,x0,x1,col=WOOD,w=10,y=50)=>sh(c,rr(x0,y-w/2,x1-x0,w,w/2),col,null,.6);
/* 3D box: front face x,y,w,h with the top/side faces receding by dx,dy. */
function box3(c,x,y,w,h,dx,dy,col,inner){sh(c,`M${x} ${y}L${x+dx} ${y-dy}H${x+w+dx}V${y-dy+h}L${x+w} ${y+h}H${x}Z`,col,()=>{
  fl(c,`M${x} ${y}L${x+dx} ${y-dy}H${x+w+dx}L${x+w} ${y}Z`,li(col,.28));fl(c,`M${x+w} ${y}L${x+w+dx} ${y-dy}V${y-dy+h}L${x+w} ${y+h}Z`,dk(col,.28));
  if(inner)inner();ln(c,`M${x} ${y}H${x+w}V${y+h}M${x+w} ${y}L${x+w+dx} ${y-dy}`,ol(col),3)},0)}
function flame(c,x,y,deg,s,a=FIRE,b=FIRE2){at(c,x,y,deg,s,()=>{sh(c,'M0 -26Q16 -8 14 6Q12 20 0 22Q-13 20 -14 6Q-14 -3 -7 -10Q-5 -3 -2 -3Q-6 -14 0 -26Z',a,null,0,4);
  fl(c,'M0 -5Q8 4 6 11Q4 18 0 18Q-6 18 -6 10Q-6 3 0 -5Z',b)})}
const glint=(c,x,y,rx=7,ry=4,rot=-.6,al=.55)=>fl(c,el(x,y,rx,ry,rot),'#ffffff',al);

const G={};
// ================= materials =================
G.log=(c,a,b)=>dg(c,()=>{const e=b||li(a,.5);
  sh(c,'M12 28H84A9 22 0 0 1 84 72H12A9 22 0 0 1 12 28Z',a,()=>ln(c,'M16 40H44M30 52H62M14 62H40M54 38H72',dk(a,.35),3));
  sh(c,el(84,50,9,22),e,null,0,4);ln(c,el(84,50,4,11),dk(e,.3),2.5)},-28);
G.stick=(c,a)=>dg(c,()=>{tb(c,'M0 63L100 40',dk(a,.2),10);tb(c,'M58 47L76 26',a,8);tb(c,'M2 38L102 58',a,11);ln(c,'M8 36L96 54',li(a,.3),2.5)});
G.plank=(c,a)=>dg(c,()=>{sh(c,rr(10,52,78,18,2),dk(a,.2));sh(c,rr(4,30,90,23,2),a,()=>ln(c,'M12 37H52M34 46H86',dk(a,.28),2.5));
  fl(c,el(11,41,2.6),IRON);fl(c,el(87,41,2.6),IRON)},-40);
G.stone=(c,a,b)=>sh(c,'M16 62L26 34L50 18L78 30L88 58L70 82L34 84Z',a,()=>{fl(c,'M26 34L50 18L78 30L54 44Z',b||li(a,.25));fl(c,'M54 44L78 30L88 58L70 82L60 62Z',dk(a,.18))},1.3);
G.fiber=(c,a)=>{for(const d of['M50 60L32 88','M50 60L52 90','M50 60L70 86'])tb(c,d,dk(a,.15),7);
  for(const d of['M50 60Q26 44 18 18','M50 60Q40 36 40 10','M50 60Q60 36 64 12','M50 60Q76 46 86 24'])tb(c,d,a,7);
  ln(c,'M47 54Q38 34 39 16M53 54Q61 36 64 18',li(a,.35),2.5);sh(c,rr(37,53,26,13,4),'#b59a62',null,.6)};
G.rope=(c,a)=>{tb(c,'M78 40Q94 28 84 12',a,8);sh(c,ring(50,56,40,31,14,9),a,()=>{for(let i=0;i<14;i++){const t=i*TAU/14,x=Math.cos(t),y=Math.sin(t);
  ln(c,`M${50+x*16-y*5} ${56+y*11+x*5}L${50+x*40+y*5} ${56+y*31-x*5}`,dk(a,.35),3)}})};
G.blob=(c,a)=>{sh(c,'M18 66Q10 44 30 36Q36 14 58 22Q80 18 82 44Q96 60 80 78Q52 92 28 84Q16 78 18 66Z',a,null,1.6);glint(c,40,38,10,5,-.5,.6);glint(c,62,30,3.5,3,0,.5)};
G.brick=(c,a)=>box3(c,8,44,64,36,20,18,a,()=>{for(const x of[32,50,68])fl(c,el(x,35,5,3),dk(a,.5))});
G.hide=(c,a,b)=>sh(c,'M30 12L42 20H58L70 12L75 26L90 28L82 44V58L92 76L76 82L66 72L58 90H42L34 72L24 82L8 76L18 58V44L10 28L25 26Z',a,()=>fl(c,el(50,50,15,25),b||dk(a,.2)),1.2);
G.feather=(c,a)=>dg(c,()=>{tb(c,'M-6 50H28',dk(a,.25),4,4);sh(c,'M20 50Q34 26 70 28Q98 34 108 50Q98 64 72 70Q36 74 20 50Z',a,()=>fl(c,'M20 50H108V80H20Z',dk(a,.14)));
  ln(c,'M20 50H100',dk(a,.4),3);ln(c,'M48 30L56 46M72 70L66 54M40 67L46 54',ol(a),2.5)});
G.bone=(c,a)=>dg(c,()=>un(c,[rr(14,42,72,16,5),el(13,40,11),el(13,60,11),el(87,40,11),el(87,60,11)],a,()=>{ln(c,'M20 46H80',li(a,.5),3);fl(c,'M0 56H100V80H0Z',dk(a,.16))}));
G.cloth=(c,a,b)=>sh(c,'M10 42L48 20L90 36V62L52 86L10 66Z',a,()=>{fl(c,'M10 42L48 20L90 36L52 58Z',li(a,.3));fl(c,'M52 58L90 36V62L52 86Z',dk(a,.25));
  if(b)ln(c,'M22 35L64 51M35 27.5L77 43.5',b,5);ln(c,'M10 50L52 67L90 45M10 58L52 76L90 53.5',ol(a),2.5);ln(c,'M10 42L52 58L90 36',ol(a),3)},0);
G.scrap=(c,a)=>{sh(c,'M12 32L44 14L60 30L88 22L80 54L90 78L54 86L40 68L16 76L24 54Z',a,()=>{fl(c,'M60 30L88 22L80 54L62 50Z',dk(a,.2));fl(c,'M16 76L24 54L40 68Z','#8a5a44',.7);fl(c,'M44 14L60 30L40 40L28 26Z',li(a,.2))});
  for(const p of[[34,34],[70,66],[30,62]])fl(c,el(p[0],p[1],3.2),dk(a,.5));ln(c,'M48 50L62 62',dk(a,.4),3)};
G.nails=(c,a)=>{const n=(x,y)=>at(c,x,y,-45,1,()=>{sh(c,'M-30 -4.5H24L38 0L24 4.5H-30Z',a,null,.4,4.5);sh(c,rr(-38,-11,9,22,3),li(a,.15),null,.4,4.5)});n(36,36);n(52,50);n(68,64)};
const lump=(c,x,y,s,col,deg=0)=>at(c,x,y,deg,s,()=>sh(c,'M-21 4L-13 -17L8 -21L21 -5L15 16L-8 19Z',col,()=>fl(c,'M-13 -17L8 -21L3 -5L-10 -2Z',li(col,.3)),.9));
G.coal=(c,a)=>{lump(c,52,34,1.15,a,20);lump(c,32,64,1.2,a);lump(c,68,64,1.15,a,-35)};
G.jar=(c,a)=>{sh(c,rr(20,26,60,64,13),mix(a,'#eef6f6',.72),()=>{fl(c,rr(0,44,100,60,0),a);fl(c,rr(28,34,7,46,3.5),'#ffffff',.45)});sh(c,rr(18,10,64,18,5),'#8f8468')};
G.ore=(c,a,b)=>{const n=b||li(a,.5);sh(c,'M14 60L24 32L48 16L78 26L90 56L72 84L32 86Z',a,()=>{fl(c,'M24 32L48 16L78 26L56 40Z',li(a,.16));fl(c,'M56 40L78 26L90 56L72 84L62 60Z',dk(a,.2))},1.2);
  for(const q of[[38,50,1],[64,42,.8],[58,68,.9],[30,70,.6]])at(c,q[0],q[1],q[0]*7,q[2],()=>sh(c,'M-9 0L-3 -9L8 -6L10 5L0 10Z',n,null,.8,3.5))};
G.bar=(c,a,b)=>sh(c,'M8 76L18 46L30 28H84L94 58L84 76Z',a,()=>{fl(c,'M18 46L30 28H84L74 46Z',b||li(a,.35));fl(c,'M74 46L84 28L94 58L84 76Z',dk(a,.25));ln(c,'M18 46H74L84 76M74 46L84 28',ol(a),3)},0);
G.pile=(c,a)=>zm(c,.9,()=>{sh(c,'M52 84Q62 80 68 62Q76 48 84 62Q88 78 96 84Z',dk(a,.12));sh(c,'M4 84Q24 80 32 46Q44 20 56 46Q64 80 84 84Q44 92 4 84Z',a,()=>fl(c,'M44 30Q60 50 62 90H90V30Z',dk(a,.14)),1.2);
  for(const q of[[30,62],[44,50],[40,74],[56,70],[22,76],[70,78]])fl(c,el(q[0],q[1],2.4),q[0]%4?li(a,.4):dk(a,.3))},0,-6);
G.glass=(c,a)=>{c.globalAlpha=.85;sh(c,'M22 18L80 10L86 80L28 90Z',a,null,.8);c.globalAlpha=1;ln(c,'M36 40L56 26M36 58L72 32M50 72L74 56',lighten(a,.7),4,.9)};
G.tire=(c,a,b)=>{sh(c,ring(50,50,40,40,18,18),a,()=>{ln(c,el(50,50,27),li(a,.3),3);for(let i=0;i<12;i++){const t=i*TAU/12,x=Math.cos(t),y=Math.sin(t);ln(c,`M${50+x*33} ${50+y*33}L${50+x*42} ${50+y*42}`,ol(a),4)}});
  if(b){sh(c,ring(50,50,18,18,6,6),b,null,.6,4)}};
G.boltnut=(c,a)=>{dg(c,()=>{sh(c,rr(24,36,60,16,3),a,()=>{for(let x=44;x<84;x+=8)ln(c,`M${x} 34L${x+4} 54`,dk(a,.4),2.5)},.6);sh(c,rr(6,28,20,32,5),li(a,.08))});
  sh(c,P(ngon(72,72,17,6,.3)+'M78 72A6 6 0 1 0 66 72A6 6 0 1 0 78 72Z'),li(a,.12))};
G.pipe=(c,a)=>{tb(c,'M22 36H52Q70 36 70 54V78',a,24,5);ln(c,'M24 29H54Q77 30 77 54V76',li(a,.4),4);ln(c,'M24 44H50Q62 44 62 56V76',dk(a,.25),4);sh(c,rr(8,18,13,36,4),dk(a,.12),null,.6);sh(c,rr(52,76,36,13,4),dk(a,.12),null,.6)};
G.spring=(c,a)=>dg(c,()=>{const d='M0 50H8L16 28L28 72L40 28L52 72L64 28L76 72L88 28L94 50H102';ln(c,d,ol(a),13);ln(c,d,a,7.5);ln(c,'M28 72L40 28M52 72L64 28M76 72L88 28',dk(a,.3),7.5);ln(c,'M17 32L27 66M41 32L51 66M65 32L75 66',li(a,.45),2.5)});
G.gear=(c,a)=>sh(c,gearP(50,50,42,30,8,11),a,()=>ln(c,el(50,50,21),dk(a,.3),3));
G.wire=(c,a)=>{tb(c,'M74 62Q94 60 90 82',a,4,4);sh(c,el(50,78,34,11),'#6a5a48');sh(c,rr(24,22,52,56,5),a,()=>{for(let y=32;y<78;y+=8)ln(c,`M20 ${y}Q50 ${y+6} 80 ${y}`,dk(a,.35),2.5)});
  sh(c,el(50,22,34,11),'#8f7a5c',null,.6);fl(c,el(50,22,9,3.5),'#2a2420')};
G.fuel=(c,a)=>{sh(c,P('M26 18Q26 10 34 10H52Q60 10 60 18V30H26ZM34 18V26H52V18Z'),dk(a,.15),null,.5);sh(c,rr(62,12,14,16,3),'#e0c040',null,.5);
  sh(c,'M20 32Q20 26 26 26H64L80 40V84Q80 90 74 90H26Q20 90 20 84Z',a,()=>ln(c,'M32 44L68 80M68 44L32 80',dk(a,.3),6))};
G.tape=(c,a)=>{sh(c,'M58 70L90 74L88 92L56 86Z',li(a,.15),null,.5);sh(c,ring(46,46,36,36,15,15),a,()=>{ln(c,el(46,46,26),dk(a,.2),2.5);ln(c,el(46,46,17.5),'#8a6a4a',5)})};
G.plastic=(c,a)=>{sh(c,rr(40,6,24,12,3),'#3a7ad0',null,.5);sh(c,P('M32 32L42 22V16H62V22L78 36V84Q78 90 72 90H32Q26 90 26 84V40ZM58 44Q58 40 62 40H64Q68 40 68 44V62Q68 66 64 66H62Q58 66 58 62Z'),a,()=>ln(c,'M26 74H78',dk(a,.2),3))};
G.flask=(c,a)=>{sh(c,'M40 12H60V38L86 80Q88 90 78 90H22Q12 90 14 80L40 38Z',mix(a,'#eef6f6',.75),()=>{fl(c,rr(0,58,100,50,0),a);for(const q of[[40,72,4],[58,66,3],[52,80,2.5]])fl(c,el(q[0],q[1],q[2]),li(a,.45))});
  sh(c,rr(35,6,30,9,3),mix(a,'#eef6f6',.6),null,.4)};
G.chip=(c,a,b)=>{const t=b||GOLD;sh(c,rr(12,20,76,62,5),a,()=>{ln(c,'M22 30H40V40M78 30H62V40M22 72H40V62M78 72H62V62M12 51H34M66 51H88',t,3);for(const q of[[22,30],[78,30],[22,72],[78,72]])fl(c,el(q[0],q[1],4),t)});
  for(let i=0;i<3;i++){ln(c,`M${40+i*10} 32V70`,STEEL,3.5);ln(c,`M31 ${42+i*9}H69`,STEEL,3.5)}sh(c,rr(35,36,30,30,3),'#26282c',null,.6,4)};
G.battery=(c,a,b)=>dg(c,()=>{sh(c,rr(82,41,10,18,3),STEEL,null,.5);sh(c,rr(8,30,76,40,7),a,()=>{fl(c,rr(0,0,34,100,0),b||'#2a2a2d');fl(c,rr(74,0,30,100,0),b||'#2a2a2d');fl(c,'M56 36L46 52H54L50 64L62 48H54Z',li(a,.6))})});
G.bulb=(c,a)=>{sh(c,rr(37,62,26,26,5),STEEL,()=>ln(c,'M30 72H70M30 80H70',dk(STEEL,.35),2.5));sh(c,'M50 8Q82 8 82 38Q82 54 64 66H36Q18 54 18 38Q18 8 50 8Z',a,null,1.2);
  ln(c,'M42 64L44 42L50 50L56 42L58 64',dk(a,.5),3);glint(c,36,28,8,5)};
G.lens=(c,a,b)=>{const g=b||(lum(a)<.3?'#9fd0e8':a),h=b||lum(a)<.3?a:'#4a525a';sh(c,el(50,50,40),h,()=>ln(c,el(50,50,34),li(h,.25),3));sh(c,el(50,50,27),g,()=>{fl(c,el(58,60,20),dk(g,.25),.6);fl(c,el(40,40,13,7,-.7),'#ffffff',.65)},.6,4);fl(c,el(62,62,3.5),'#ffffff',.7)};
G.motor=(c,a)=>{sh(c,rr(72,44,22,12,3),STEEL,null,.5);sh(c,rr(22,72,50,12,3),dk(a,.3),null,.5);sh(c,rr(36,16,22,14,3),dk(a,.15),null,.5);
  sh(c,rr(12,26,66,50,11),a,()=>{for(let x=32;x<66;x+=9)ln(c,`M${x} 20V80`,dk(a,.3),3);fl(c,rr(66,20,14,60,0),'#c77a3a')});sh(c,rr(6,34,12,34,5),dk(a,.15),null,.5)};
G.engine=(c,a)=>zm(c,.95,()=>{for(let i=0;i<3;i++)sh(c,rr(16+i*19,18,15,24,3),li(a,.15),null,.6);tb(c,'M82 50H92V70',IRON,6);sh(c,rr(10,38,70,48,6),a,()=>{ln(c,'M10 54H80',dk(a,.3),3);for(const x of[20,40])fl(c,el(x,46,3),dk(a,.5))});
  sh(c,el(66,68,14),'#3a3d42',null,.6,4);fl(c,el(66,68,5),STEEL);sh(c,el(30,72,8),dk(a,.25),null,.5,3.5)},-3,0);
G.sack=(c,a)=>{sh(c,'M32 30Q24 12 38 10L50 18L62 10Q76 12 68 30Z',a,null,.6);sh(c,'M30 30Q16 52 14 76Q16 90 32 90H68Q84 90 86 76Q84 52 70 30Z',a,()=>fl(c,rr(36,52,28,22,4),dk(a,.2)),1.3);sh(c,rr(31,25,38,9,4),'#8a6a3a',null,.4,4)};
G.crystal=(c,a,b)=>{const s=b||dk(a,.3),h=li(a,.5);sh(c,'M22 38L34 52L36 88H14L10 54Z',a,()=>fl(c,'M22 38L34 52L36 88H23Z',s),0);sh(c,'M78 32L90 48L86 88H64L66 48Z',a,()=>fl(c,'M78 32L90 48L86 88H77Z',s),0);
  sh(c,'M50 6L68 28L64 90H36L32 28Z',a,()=>{fl(c,'M50 6L68 28L64 90H50Z',s);fl(c,'M50 6L32 28L50 34Z',h);ln(c,'M50 34V90',h,2.5)},0)};
G.filter=(c,a)=>{sh(c,rr(22,20,56,60,4),a,()=>{for(let x=30;x<74;x+=8)ln(c,`M${x} 10V90`,dk(a,.35),3)});sh(c,rr(16,10,68,15,6),IRON);sh(c,rr(16,75,68,15,6),IRON);fl(c,rr(38,14,24,6,3),INK)};
G.claw=(c,a)=>sh(c,'M20 22Q26 6 44 12Q76 24 82 58Q84 78 78 92Q68 68 48 54Q30 46 20 38Q14 30 20 22Z',a,()=>fl(c,'M0 0H54L30 46H0Z',mix(a,'#8a3a2a',.55)),1.2);
G.badge=(c,a)=>{tb(c,el(50,15,7),'#8a8f93',3.5,4);sh(c,'M50 22L80 32V56Q80 78 50 92Q20 78 20 56V32Z',a,null,1.2);sh(c,star(50,56,17,7.5),li(a,.45),null,0,3.5)};
G.heart=(c,a)=>{tb(c,'M42 30L36 12',dk(a,.12),9);tb(c,'M60 24L68 10',mix(a,'#3a4a9a',.4),9);sh(c,'M50 32Q58 16 74 22Q92 32 84 56Q74 78 44 92Q18 72 14 52Q10 30 30 26Q44 24 50 32Z',a,null,1.5);
  ln(c,'M50 34Q46 50 54 60Q58 68 52 78M54 60L68 52',li(a,.35),3)};
const tear=(c,x,y,deg,s,col)=>at(c,x,y,deg,s,()=>{sh(c,'M0 -16Q13 -10 13 3Q11 16 0 16Q-11 16 -13 3Q-13 -10 0 -16Z',col,()=>fl(c,el(0,-13,6,5),dk(col,.4)),1,4);glint(c,-4,2,2.5,5,.2,.45)});
G.seed=(c,a)=>{tear(c,30,36,-35,1.3,a);tear(c,68,38,50,1.3,a);tear(c,50,72,170,1.3,a)};
G.berry=(c,a)=>{tb(c,'M50 34Q50 20 62 12',dk(GREEN,.2),4,4);sh(c,'M50 26Q34 6 18 16Q28 34 50 26Z',GREEN,null,.6,4);for(const q of[[34,48],[68,50],[50,72]]){sh(c,el(q[0],q[1],19),a);glint(c,q[0]-6,q[1]-7,5,3.5)}};
G.mushroom=(c,a)=>{sh(c,'M38 50Q38 74 30 86Q50 96 70 86Q62 74 62 50Z','#eadfc4');sh(c,'M8 54Q10 12 50 12Q90 12 92 54Q50 66 8 54Z',a,()=>{for(const q of[[32,34,8],[58,26,6],[74,44,5]])fl(c,el(q[0],q[1],q[2]),li(a,.55))},1.3)};
G.leaf=(c,a,b)=>dg(c,()=>{tb(c,'M-6 50H20',dk(a,.25),5,4);sh(c,'M12 50Q34 14 72 24Q96 34 106 50Q96 66 72 76Q34 86 12 50Z',a,()=>fl(c,'M0 50H110V90H0Z',dk(a,.16)));
  ln(c,'M14 50H96M40 50L54 32M62 50L76 36M40 50L54 68M62 50L76 64',li(a,.4),3);if(b)sh(c,rr(44,22,18,56,3),b,()=>ln(c,'M44 36H62M44 50H62M44 64H62',dk(b,.2),2),.5,4)});
G.meat=(c,a,b)=>{const d='M16 46Q14 20 44 18Q78 14 86 40Q92 66 68 80Q44 92 24 76Q14 62 16 46Z';sh(c,d,a,()=>{ln(c,d,b||li(a,.6),15);ln(c,'M56 40Q68 44 70 58M52 62L60 68',li(a,.3),3)},1.2);
  sh(c,el(40,46,10),BONE,null,0,4);fl(c,el(40,46,4),mix(a,'#3a1010',.5))};
G.fish=(c,a)=>dg(c,()=>{c.translate(-4,2);sh(c,'M34 32Q48 12 64 24L56 34Z',dk(a,.2),null,.5);sh(c,'M4 50Q24 22 58 26Q72 30 80 44L100 26Q96 50 100 74L80 56Q70 72 56 74Q24 78 4 50Z',a,()=>fl(c,'M0 58Q40 68 84 52V100H0Z',li(a,.45)),1.2);
  fl(c,el(22,45,5.5),'#ffffff');fl(c,el(22,45,2.8),INK);ln(c,'M34 38Q40 50 34 62',dk(a,.4),3)},-18,.88);
G.carrot=(c,a)=>dg(c,()=>{for(const d of['M74 50L94 34','M74 50L102 50','M74 50L94 66'])tb(c,d,GREEN,8);sh(c,'M-4 52Q34 28 66 30Q82 36 82 50Q82 64 66 70Q34 70 -4 52Z',a,null,1.2);ln(c,'M30 40V48M46 58V68M58 34V46',dk(a,.35),3)});
G.potato=(c,a,b)=>{sh(c,'M12 56Q8 32 32 22Q60 12 80 30Q96 46 84 68Q70 88 42 84Q16 80 12 56Z',a,null,1.5);if(b){sh(c,'M26 52Q48 26 76 42Q56 68 26 52Z',b,null,.6,4);fl(c,rr(44,42,12,9,2),'#f0d050')}
  else for(const q of[[34,42],[60,34],[66,62],[38,68]])fl(c,el(q[0],q[1],3.5,2.5,.5),dk(a,.4))};
G.corn=(c,a)=>dg(c,()=>{sh(c,'M24 50Q28 28 56 28Q90 30 106 50Q90 70 56 72Q28 72 24 50Z',a,()=>{for(let x=36;x<100;x+=9)ln(c,`M${x} 20V80`,dk(a,.3),2.5);ln(c,'M20 43H110M20 57H110',dk(a,.3),2.5)},1.2);
  sh(c,'M-6 50Q8 28 44 22Q32 40 46 50Q32 60 44 78Q8 72 -6 50Z','#7da04a',()=>ln(c,'M2 50H40',dk('#7da04a',.3),3))});
G.bread=(c,a)=>{sh(c,'M10 62Q6 32 30 28Q50 20 70 28Q94 32 90 62Q90 80 78 80H22Q10 80 10 62Z',a,()=>fl(c,rr(0,68,100,20,0),dk(a,.25)),1.3);ln(c,'M30 38L38 54M48 34L54 52M66 36L70 54',li(a,.55),5)};
G.pumpkin=(c,a)=>{sh(c,'M45 30L42 12Q52 6 60 12L56 30Z','#6a7a3a',null,.5);un(c,[el(28,58,20,27),el(72,58,20,27),el(50,58,21,30)],a,()=>{ln(c,'M38 32Q30 58 38 86M62 32Q70 58 62 86',dk(a,.35),3);fl(c,el(40,44,6,10,.3),'#ffffff',.3);fl(c,'M64 30H100V100H64Q76 60 64 30Z',dk(a,.18),.7)})};
G.pie=(c,a,b)=>{sh(c,'M6 46H94L80 80H20Z',dk(a,.15),()=>{for(let x=18;x<90;x+=10)ln(c,`M${x} 46L${x+(x-50)*-.18} 82`,dk(a,.4),2.5)});sh(c,el(50,44,44,19),li(a,.22),()=>ln(c,el(50,44,33,12),dk(a,.12),3),.8);
  ln(c,'M38 40L44 49M52 37L56 49M66 40L62 50',b||'#8a1a3a',4.5)};
G.bowl=(c,a)=>{const w='#9a7a52';sh(c,'M6 44H94Q92 80 64 86H36Q8 80 6 44Z',w,null,1.3);sh(c,el(50,44,44,15),a,()=>{fl(c,el(36,44,7,4),li(a,.4));fl(c,el(56,50,6,3.5),dk(a,.25));fl(c,el(64,40,5,3),li(a,.4))},.6,4.5);tb(c,'M66 40L88 14',STEEL,6,4.5)};
G.egg=(c,a)=>at(c,50,50,12,1,()=>{sh(c,'M0 -40Q30 -36 32 8Q32 40 0 40Q-32 40 -32 8Q-30 -36 0 -40Z',a,null,1.8);glint(c,-11,-14,7,11,.4,.6)});
G.cactus=(c,a)=>{sh(c,el(64,32,18,22,.35),dk(a,.1));sh(c,el(42,58,29,32,-.15),a,null,1.4);sh(c,star(74,14,9,5,6),'#e06a8a',null,0,3);
  for(const q of[[30,44],[48,40],[56,58],[36,66],[48,78],[24,62],[66,26],[60,40]])ln(c,`M${q[0]-3} ${q[1]-3}L${q[0]+3} ${q[1]+3}M${q[0]+3} ${q[1]-3}L${q[0]-3} ${q[1]+3}`,'#eee8c8',2)};
G.can=(c,a)=>{sh(c,rr(20,16,60,72,7),a,()=>{fl(c,rr(0,0,100,28,0),STEEL);fl(c,rr(0,78,100,30,0),STEEL);fl(c,rr(0,42,100,20,0),li(a,.5));ln(c,'M20 28H80M20 78H80',dk(STEEL,.35),2.5)});sh(c,el(50,18,30,8),li(STEEL,.25),null,0,4);ln(c,el(50,18,18,4),dk(STEEL,.3),2)};
G.box=(c,a)=>box3(c,10,40,60,46,20,20,a,()=>{fl(c,rr(34,30,12,60,0),li(a,.4));fl(c,'M34 40L54 20H66L46 40Z',li(a,.55));fl(c,rr(14,62,14,10,2),dk(a,.3))});
G.bottle=(c,a)=>{sh(c,'M42 10H58V28Q74 36 74 52V84Q74 92 66 92H34Q26 92 26 84V52Q26 36 42 28Z',mix(a,'#eef6f6',.7),()=>{fl(c,rr(0,46,100,60,0),a);fl(c,rr(33,42,7,40,3.5),'#ffffff',.45)});sh(c,rr(39,6,22,10,3),'#8a8f93',null,.5)};
G.cup=(c,a)=>{ln(c,'M34 28Q28 20 34 12M52 28Q46 18 52 8',CREAM,4,.75);tb(c,'M68 52Q90 50 88 66Q86 80 64 78',CREAM,7);sh(c,'M14 40H74L70 82Q68 92 58 92H30Q20 92 18 82Z',CREAM,()=>fl(c,rr(0,62,100,11,0),a),1.2);sh(c,el(44,40,30,9),a,null,.5,4.5)};
// ================= medical =================
G.bandage=(c,a)=>{sh(c,'M72 44L92 52V86L72 78Z',dk(a,.08),()=>ln(c,'M72 62L92 70',dk(a,.25),2.5),.5);sh(c,'M14 34V68A30 13 0 0 0 74 68V34Z',a,()=>ln(c,'M14 50A30 13 0 0 0 74 50',dk(a,.2),2.5));
  sh(c,el(44,34,30,13),li(a,.3),()=>ln(c,el(44,34,19,8),dk(a,.2),2.5),.5);fl(c,el(44,34,8,3.5),dk(a,.55));fl(c,'M40 58H48V64H54V72H48V78H40V72H34V64H40Z',RED)};
G.medkit=(c,a)=>{tb(c,'M36 28V20Q36 13 43 13H57Q64 13 64 20V28',IRON,6);sh(c,rr(8,28,84,58,10),a,()=>{fl(c,rr(0,28,100,9,0),li(a,.25));ln(c,'M8 37H92',dk(a,.3),2.5)},1.2);
  sh(c,el(50,61,20),'#f4f0e4',null,.5,3.5);fl(c,'M45 48H55V56H63V66H55V74H45V66H37V56H45Z',a)};
G.pill=(c,a)=>{at(c,42,40,-45,1,()=>sh(c,rr(-36,-15,72,30,15),a,()=>fl(c,rr(0,-20,40,40,0),'#f4f0e4'),1.2));sh(c,el(72,74,15),lum(a)>.8?dk(a,.12):li(a,.12),()=>ln(c,'M60 86L84 62',dk(a,.35),3),.9)};
G.syringe=(c,a)=>dg(c,()=>{tb(c,'M78 50H104',STEEL,2.5,3);sh(c,rr(70,43,10,14,3),IRON,null,.5);sh(c,rr(6,45,20,10,2),STEEL,null,.5);sh(c,rr(2,34,8,32,3),IRON,null,.5);
  sh(c,rr(28,37,44,26,5),GLASS,()=>{fl(c,rr(44,30,40,40,0),a);ln(c,'M36 37V46M44 37V46M52 37V46M60 37V46',dk(a,.45),2.5)},.7);sh(c,rr(22,30,8,40,3),IRON,null,.5)});
// ================= tools and melee =================
G.axe=(c,a,b)=>dg(c,()=>{hd(c,-2,90,b||WOOD,10,60);sh(c,'M66 68H88V52Q96 40 93 24Q76 15 55 22Q60 38 66 50Z',a,()=>fl(c,'M50 0H100V32Q76 22 50 32Z',li(a,.5)),1.2)});
G.pick=(c,a,b)=>dg(c,()=>{hd(c,-10,90,b||WOOD,10);sh(c,'M64 12Q98 28 98 50Q98 72 64 88Q82 66 82 50Q82 34 64 12Z',a,null,1.1);sh(c,rr(78,41,14,18,3),dk(a,.15),null,.5)});
G.hammer=(c,a,b)=>dg(c,()=>{hd(c,-10,74,WOOD,10);sh(c,rr(62,24,28,52,5),a,()=>{fl(c,rr(0,44,100,12,0),b||dk(a,.3))},1.2);if(b)for(const y of[24,76])sh(c,`M64 ${y}L70 ${y+(y<50?-9:9)}L76 ${y}L82 ${y+(y<50?-9:9)}L88 ${y}Z`,li(a,.2),null,0,3.5)});
G.rod=(c,a)=>{dg(c,()=>{tb(c,'M18 51L112 49',dk(a,.3),5,5);hd(c,-12,28,a,11);sh(c,el(26,59,9),IRON,null,.6,4);fl(c,el(26,59,3),STEEL)});ln(c,'M92 10Q84 34 82 58',CREAM,2.5,.9);sh(c,el(82,62,8),RED,()=>fl(c,rr(70,62,24,12,0),'#f4f0e4'),.6,4);ln(c,'M82 70V80Q82 88 74 86',STEEL,3)};
G.crowbar=(c,a)=>dg(c,()=>{tb(c,'M-2 59L8 53H70Q90 53 90 37L86 25',a,10);ln(c,'M10 51H68Q84 51 86 38',li(a,.35),2.5)});
G.wrench=(c,a)=>dg(c,()=>{sh(c,P('M22 43H64Q62 34 70 28Q82 20 96 34L82 42Q76 50 82 58L96 66Q82 80 70 72Q62 66 64 57H22Q16 66 6 64Q-6 60 -6 50Q-6 40 6 36Q16 34 22 43ZM3 50A5 5 0 1 0 13 50A5 5 0 1 0 3 50Z'),a,()=>ln(c,'M26 48H60',li(a,.4),3),1)});
G.club=(c,a)=>dg(c,()=>{sh(c,'M-6 43L46 36Q76 26 96 34Q104 50 96 66Q76 74 46 64L-6 57Q-10 50 -6 43Z',a,()=>{ln(c,'M4 40V60M12 40V60M20 38V62',dk(a,.4),3);fl(c,el(72,44,5,3),dk(a,.35));fl(c,el(84,58,4,2.5),dk(a,.35))},1.3)});
G.spear=(c,a,b)=>dg(c,()=>{hd(c,-14,80,a,8);sh(c,'M72 50L84 37L112 50L84 63Z',b||'#c9d1d8',()=>fl(c,'M72 50H112L84 63Z',dk(b||'#c9d1d8',.18)),.6);tb(c,'M68 44V56M74 44V56',lum(a)>.6?IRON:'#b59a62',3,3)});
G.knife=(c,a,b)=>dg(c,()=>{sh(c,'M40 38H74Q96 40 106 54Q88 64 40 62Z',a,()=>fl(c,'M40 52H110V70H40Z',dk(a,.18)),.8);sh(c,rr(-4,40,40,20,7),b||WOOD,()=>ln(c,'M8 36V64M18 36V64M28 36V64',dk(b||WOOD,.4),3),.7);sh(c,rr(34,34,8,32,3),IRON,null,.5)});
G.bat=(c,a,b)=>dg(c,()=>{sh(c,'M-4 45L46 42Q72 36 94 36Q106 38 106 50Q106 62 94 64Q72 64 46 58L-4 55Z',a,()=>{for(let x=4;x<26;x+=7)ln(c,`M${x} 40L${x+4} 60`,dk(a,.45),3)},1.1);sh(c,rr(-12,42,9,16,3),dk(a,.2),null,.5);
  if(b)for(const q of[[74,34,-1],[88,34,-1],[80,66,1],[94,65,1]])sh(c,`M${q[0]-3} ${q[1]}L${q[0]} ${q[1]+q[2]*11}L${q[0]+3} ${q[1]}Z`,b,null,0,3)});
G.sword=(c,a,b)=>dg(c,()=>{sh(c,'M20 42H84Q102 42 112 55Q98 59 84 59H20Z',a,()=>{fl(c,'M20 52H112V64H20Z',dk(a,.2));ln(c,'M26 47H84',li(a,.5),2.5)},.6);sh(c,rr(-12,43,30,14,5),b||'#5a3a22',()=>ln(c,'M-4 40V60M4 40V60M12 40V60',li(b||'#5a3a22',.25),2.5),.6);sh(c,rr(15,33,8,34,3),b?li(b,.3):GOLD,null,.5)});
G.baton=(c,a)=>dg(c,()=>{sh(c,rr(28,44,60,12,4),DARK,()=>{fl(c,rr(46,40,6,20,0),a);fl(c,rr(60,40,6,20,0),a)},.6);sh(c,rr(-10,41,40,18,7),'#2a2a2d',()=>ln(c,'M0 38V62M9 38V62M18 38V62',IRON,3),.6);sh(c,rr(28,36,7,28,3),IRON,null,.5);
  tb(c,'M88 46H98M88 54H98',STEEL,3.5,4);ln(c,'M92 30L100 42L94 46L106 50L94 54L100 58L92 70',li(a,.55),4);ln(c,'M92 30L100 42L94 46L106 50L94 54L100 58L92 70',a,1.5)});
G.chainsaw=(c,a)=>dg(c,()=>{const d='M36 40H90Q106 40 106 53Q106 66 90 66H36Z';sh(c,d,'#cfd4d8',()=>{ln(c,d,IRON,9);ln(c,'M44 53H92',dk(STEEL,.3),3)},.5);c.setLineDash([3,5]);ln(c,d,'#17181a',5);c.setLineDash([]);
  tb(c,'M6 38Q8 20 24 20Q40 20 40 38',DARK,6);sh(c,rr(-8,46,14,18,4),DARK,null,.5);sh(c,rr(0,34,44,38,8),a,()=>{ln(c,'M10 44H24M10 52H24M10 60H24',dk(a,.4),3);fl(c,el(34,58,6),dk(a,.35))},1.2)},-35);
G.bow=(c,a)=>{ln(c,'M14 20L80 86',CREAM,2.5);tb(c,'M14 20Q86 14 80 86',a,8);ln(c,'M22 21Q76 22 77 76',li(a,.3),2.5);at(c,61,39,45,1,()=>sh(c,rr(-11,-6,22,12,4),dk(a,.35),null,.5,4))};
G.crossbow=(c,a)=>dg(c,()=>{ln(c,'M70 16L40 50L70 84',CREAM,2.5);tb(c,'M68 14Q94 50 68 86',IRON,8);sh(c,'M-4 40H16L24 43H90V57H24L14 64H-4Z',a,()=>ln(c,'M26 47H86',li(a,.3),2.5),.8);tb(c,'M42 50H92',STEEL,3,3);sh(c,'M90 43L104 50L90 57Z',STEEL,null,0,3.5);tb(c,'M30 59Q32 69 40 65',IRON,3,3)});
// ================= guns =================
G.pistol=(c,a,b)=>dg(c,()=>{const g=b||'#6b4226';tb(c,'M48 50Q50 64 62 62Q66 60 66 50',dk(a,.1),4,4);sh(c,'M20 44H48L40 88H10Z',g,()=>ln(c,'M22 58L40 60M19 68L38 70M16 78L36 80',dk(g,.4),3),.8);
  sh(c,P('M10 28Q10 22 16 22H86Q90 22 90 26V44Q90 48 86 48H16Q10 48 10 42Z'),a,()=>{fl(c,rr(52,28,20,8,2),dk(a,.45));ln(c,'M14 40H88',dk(a,.3),2.5);ln(c,'M18 28V38M24 28V38M30 28V38',dk(a,.35),2.5)},1);sh(c,rr(80,15,7,8,2),dk(a,.2),null,0,3.5)},-12);
G.smg=(c,a,b)=>dg(c,()=>{tb(c,'M22 38H5V58',IRON,5,4.5);sh(c,rr(72,36,26,10,3),IRON,null,.5);sh(c,rr(92,33,10,16,3),DARK,null,.5);at(c,56,52,8,1,()=>sh(c,rr(-7,0,14,38,3),dk(a,.25),null,.6));
  sh(c,'M24 50H40L36 76H20Z',dk(a,.15),null,.6);sh(c,rr(18,28,58,24,5),a,()=>{fl(c,rr(44,34,16,7,2),dk(a,.5));ln(c,'M20 46H76',dk(a,.35),2.5)},1);sh(c,rr(30,20,8,9,2),IRON,null,0,3.5);sh(c,rr(62,20,8,9,2),IRON,null,0,3.5)},-22);
G.rifle=(c,a,b)=>dg(c,()=>{fat(c,1.25);const sc=b&&lum(b)>.45,m=b&&!sc?b:IRON;sh(c,rr(60,43,50,8,2),m,null,.5);sh(c,rr(102,37,6,8,2),m,null,0,3.5);at(c,50,54,-10,1,()=>sh(c,rr(-5,0,11,20,2),m,null,.5));tb(c,'M28 58Q30 68 40 64',m,3,4);
  sh(c,'M-4 43L18 40L30 42H76Q80 42 80 46V53Q80 57 76 57H34L20 62L-4 62Z',a,()=>{ln(c,'M34 48H76',li(a,.3),3);ln(c,'M30 42V57',dk(a,.4),2.5)},.9);
  if(sc){sh(c,rr(36,33,6,10,1),IRON,null,0,3);sh(c,rr(56,33,6,10,1),IRON,null,0,3);sh(c,rr(26,24,44,12,5),DARK,null,.6);sh(c,rr(66,22,8,16,3),b,null,.4,3.5)}},-40);
G.shotgun=(c,a)=>dg(c,()=>{fat(c,1.15);const w=li(a,.22);sh(c,rr(46,38,60,10,3),IRON,null,.6);sh(c,rr(46,48,52,9,3),dk(IRON,.2),null,.5);tb(c,'M28 60Q30 70 40 66',IRON,3,4);sh(c,'M-4 44L18 40L30 42V60L18 60L-4 63Z',w,null,.9);
  sh(c,rr(28,37,24,23,5),DARK,null,.8);sh(c,rr(60,49,28,14,6),w,()=>{for(let x=66;x<86;x+=6)ln(c,`M${x} 46V66`,dk(w,.4),2.5)},.6)},-40);
G.flamer=(c,a)=>dg(c,()=>{flame(c,92,45,90,.78);sh(c,rr(52,41,30,9,3),DARK,null,.5);sh(c,rr(78,36,9,18,3),IRON,null,.5);tb(c,'M14 52Q6 44 12 40',DARK,4,4);sh(c,'M44 50H56L54 70H42Z',DARK,null,.5);
  sh(c,rr(4,34,52,16,5),IRON,()=>ln(c,'M10 40H50',li(IRON,.3),2.5),.7);sh(c,rr(2,52,38,24,11),a,()=>fl(c,rr(22,40,6,40,0),dk(a,.35)),1.1)},-38);
G.launcher=(c,a,b)=>dg(c,()=>{const t=b||'#c8a030';sh(c,'M90 39L106 50L90 61Z',t,null,.5,4);sh(c,'M38 58H52L50 80H36Z',dk(a,.3),null,.6);sh(c,rr(44,24,12,12,3),dk(a,.25),null,.5);
  sh(c,rr(4,35,82,28,6),a,()=>{fl(c,rr(0,39,100,6,0),li(a,.3));fl(c,rr(26,30,7,40,0),dk(a,.35));fl(c,rr(62,30,7,40,0),b||dk(a,.35))},.9);sh(c,rr(80,31,12,36,4),dk(a,.2),null,.6);sh(c,rr(-2,36,10,26,3),dk(a,.2),null,.5)},-40);
G.minigun=(c,a)=>dg(c,()=>{for(const q of[[36,62],[46,66],[56,62]])sh(c,rr(40,q[0],q[1],8,2),STEEL,null,.4,4);sh(c,rr(64,32,8,36,3),DARK,null,.5);sh(c,rr(90,34,7,32,3),DARK,null,.5);tb(c,'M10 34Q12 20 26 22',DARK,5,4);
  sh(c,rr(16,62,26,18,4),'#6a6a3a',null,.6);sh(c,rr(6,32,40,36,8),a,()=>{ln(c,'M16 40H36M16 48H36',li(a,.3),3);fl(c,rr(38,20,10,60,0),dk(a,.35))},1.1);sh(c,rr(-4,42,12,16,4),DARK,null,.5)},-40);
// ================= ammo and throwables =================
G.arrow=(c,a,b)=>dg(c,()=>{sh(c,'M-2 50L-8 39H14L24 50L14 61H-8Z',RED,()=>{fl(c,'M-10 50H30V64H-10Z',dk(RED,.25));ln(c,'M0 39L8 50L0 61M9 39L17 50L9 61',dk(RED,.45),2.5)},0,4);hd(c,2,92,a,6.5);sh(c,'M86 38L112 50L86 62Z',b||'#c9d1d8',()=>fl(c,'M86 50H112L86 62Z',dk(b||'#c9d1d8',.2)),0,4)});
const cart=(c,x,y,deg,s,cs,tp,long)=>at(c,x,y,deg,s,()=>{if(long){sh(c,'M-5 -14Q-5 -34 0 -40Q5 -34 5 -14Z',tp,null,.5,3.5);sh(c,'M-8 26V-4L-5 -14H5L8 -4V26Z',cs,null,.7,3.5)}else{sh(c,'M-8 -4Q-8 -22 0 -27Q8 -22 8 -4Z',tp,null,.5,3.5);sh(c,rr(-8,-4,16,30,1),cs,null,.7,3.5)}sh(c,rr(-9.5,24,19,6,2),dk(cs,.15),null,0,3.5)});
G.bullet=(c,a,b)=>{const cs=b||a,tp=b?a:'#b86a34';if(b){cart(c,34,55,-14,1.3,cs,tp,1);cart(c,66,55,12,1.3,cs,tp,1)}else{cart(c,26,56,-14,1.3,cs,tp);cart(c,74,56,14,1.3,cs,tp);cart(c,50,50,0,1.45,cs,tp)}};
const shel=(c,x,y,deg,s,a,b)=>at(c,x,y,deg,s,()=>{sh(c,rr(-16,-38,32,54,5),a,()=>{ln(c,'M-8 -38V-28M0 -38V-28M8 -38V-28',dk(a,.4),2.5);fl(c,rr(-20,-12,40,8,0),li(a,.3))},1);sh(c,rr(-18,12,36,26,4),b,()=>ln(c,'M-18 30H18',dk(b,.35),2.5),.8)});
G.shell=(c,a,b)=>{shel(c,68,54,12,.92,dk(a,.12),b||'#c8a030');shel(c,36,50,-10,1.05,a,b||'#c8a030')};
G.molotov=(c,a)=>at(c,48,53,14,.9,()=>{c.translate(-50,-50);flame(c,49,20,0,.85);sh(c,'M40 36L38 24L50 20L60 26L56 36Z',CREAM,null,.4,4);
  sh(c,'M41 36H57V50Q72 56 72 68V86Q72 93 65 93H33Q26 93 26 86V68Q26 56 41 50Z','#6f9a78',()=>{fl(c,rr(0,62,100,40,0),a);fl(c,rr(33,58,6,28,3),'#ffffff',.4)},1)});
G.grenade=(c,a,b)=>{tb(c,el(26,24,8),STEEL,3.5,4);sh(c,'M56 14H70Q78 16 78 28L76 52H68L68 26H56Z',STEEL,null,.5,4);sh(c,rr(38,14,24,16,4),IRON,null,.6);
  sh(c,el(48,60,29,32),a,()=>{ln(c,'M34 20V100M48 20V100M62 20V100M10 48H90M10 62H90M10 76H90',dk(a,.35),3);if(b)fl(c,rr(0,53,100,14,0),b)},1.5)};
G.lure=(c,a)=>zm(c,.92,()=>{for(const r of[14,24])ln(c,arc(68,30,r,-1.5,.1),'#f0e6a0',4);ln(c,arc(30,30,14,Math.PI-.1,Math.PI+1.5),'#f0e6a0',4);tb(c,'M76 62H88',IRON,4,4);sh(c,ring(92,62,7,9,2.5,4),IRON,null,0,3.5);
  sh(c,rr(22,34,54,56,7),STEEL,()=>{fl(c,rr(0,48,100,26,0),a);ln(c,'M22 44H76M22 80H76',dk(STEEL,.35),2.5)},1.1);sh(c,el(49,36,27,8),li(STEEL,.3),null,0,4);sh(c,el(49,61,10),CREAM,null,.4,3.5);ln(c,'M49 61V54M49 61L54 63',INK,2.5)},-4,0);
// ================= armour and packs =================
G.hat=(c,a)=>zm(c,.93,()=>{sh(c,'M20 62Q18 20 50 18Q82 20 80 62Z',a,()=>ln(c,'M50 18V60',dk(a,.25),2.5),1.3);sh(c,'M6 62Q50 46 94 62Q98 76 86 78Q50 64 14 78Q2 76 6 62Z',dk(a,.12),null,.8);ln(c,'M22 56Q50 46 78 56',li(a,.35),3)});
G.vest=(c,a)=>sh(c,'M28 12H42Q50 24 58 12H72L86 30L76 42V88H24V42L14 30Z',a,()=>{ln(c,'M50 22V90',dk(a,.4),3);for(const x of[30,56])fl(c,rr(x,58,14,16,2),dk(a,.25));fl(c,rr(28,40,16,8,2),li(a,.3));fl(c,rr(56,40,16,8,2),li(a,.3))},1.3);
G.glove=(c,a)=>sh(c,'M30 90V52L22 30Q20 20 28 20Q34 20 36 28L40 40V16Q40 8 47 8Q54 8 54 16V34V12Q54 4 61 4Q68 4 68 12V36V18Q68 10 74 10Q80 10 80 18V58Q80 72 72 80V90Z',a,()=>{fl(c,rr(28,76,46,14,3),dk(a,.3));ln(c,'M54 34V52M68 36V52',dk(a,.3),2.5)},1.3);
G.pants=(c,a)=>sh(c,'M24 10H76L84 90H56L50 42L44 90H16Z',a,()=>{fl(c,rr(0,10,100,12,0),dk(a,.3));fl(c,rr(46,12,8,8,1),GOLD);fl(c,rr(20,56,22,14,3),li(a,.25));fl(c,rr(58,56,22,14,3),li(a,.25))},1.3);
G.boots=(c,a)=>{sh(c,'M28 10H60V48Q84 52 90 68V80H22V48Z',a,()=>{fl(c,rr(0,10,100,12,0),li(a,.3));ln(c,'M46 28H60M46 38H60M50 50L62 56',CREAM,3)},1.3);sh(c,rr(18,78,76,13,4),'#2c2a28',null,.5)};
G.jacket=(c,a)=>zm(c,.94,()=>{sh(c,'M34 10L50 20L66 10L84 20L96 62L80 68L76 46V90H24V46L20 68L4 62L16 20Z',a,()=>{ln(c,'M50 20V92M24 46V30M76 46V30',dk(a,.4),3);fl(c,rr(30,62,12,12,2),dk(a,.25));fl(c,rr(58,62,12,12,2),dk(a,.25))},1.3);sh(c,'M34 10L50 20L66 10L60 30L50 22L40 30Z',li(a,.25),null,0,3.5)});
G.helmet=(c,a)=>{ln(c,'M22 68Q26 90 50 90Q74 90 78 68',ol(a),5);sh(c,'M12 62Q10 14 50 14Q90 14 88 62Z',a,()=>{fl(c,rr(44,0,12,70,0),li(a,.22));for(const x of[24,76])fl(c,el(x,52,3),dk(a,.45))},1.5);sh(c,rr(6,58,88,13,6),dk(a,.15),null,.6)};
G.mask=(c,a)=>{tb(c,'M20 38H10M80 38H90',DARK,7,4);sh(c,'M50 10Q82 10 84 44Q84 66 66 76L62 82H38L34 76Q16 66 16 44Q18 10 50 10Z',a,null,1.3);for(const x of[35,65]){sh(c,el(x,40,12),'#26282c',null,0,4);fl(c,el(x,40,8),'#9fd0e8');glint(c,x-3,37,3.5,2)}
  sh(c,el(50,74,17),IRON,()=>{for(const q of[[44,70],[56,70],[50,80],[44,80],[56,80]])fl(c,el(q[0],q[1],2.4),INK)},.8,4.5)};
const packBody=(c,a)=>{tb(c,'M20 44Q8 56 14 78M80 44Q92 56 86 78',dk(a,.35),6);sh(c,rr(18,26,64,66,15),a,()=>{fl(c,rr(0,78,100,20,0),dk(a,.2))},1.3);sh(c,rr(30,56,40,26,7),dk(a,.18),()=>ln(c,'M30 64H70',dk(a,.45),2.5),.6,4)};
G.pack=(c,a)=>{tb(c,'M40 24Q40 10 50 10Q60 10 60 24',dk(a,.35),5);packBody(c,a);sh(c,'M18 44Q18 22 50 22Q82 22 82 44Q50 56 18 44Z',li(a,.15),null,.8);sh(c,rr(45,42,10,12,2),GOLD,null,0,3.5)};
G.backpack_open=(c,a)=>{a=a||'#6b4226';sh(c,'M22 30Q24 6 50 6Q76 6 78 30Z',li(a,.15),()=>fl(c,'M30 30Q32 14 50 14Q68 14 70 30Z',dk(a,.3)),.6);packBody(c,a);sh(c,el(50,32,29,10),'#1c1a16',null,0,4.5);sh(c,rr(38,22,12,14,2),CREAM,null,.4,3.5);sh(c,rr(54,24,10,10,2),GOLD,null,.4,3.5)};
// ================= misc, keys, schematics =================
G.lantern=(c,a)=>zm(c,.94,()=>{tb(c,'M32 26Q32 6 50 6Q68 6 68 26',IRON,5);sh(c,rr(30,34,40,44,7),li(a,.55),()=>fl(c,el(50,60,16,20),a,.7),.6);flame(c,50,60,0,.62,FIRE,'#fff6c0');ln(c,'M38 34V78M62 34V78',IRON,3.5);
  sh(c,'M28 36H72L64 20H36Z',IRON,null,.6);sh(c,rr(24,76,52,14,4),IRON,null,.6)},0,2);
G.lockpick=(c,a)=>{dg(c,()=>{tb(c,'M30 50H94Q101 50 101 43',a,4,4);sh(c,rr(-4,43,40,14,5),'#2f5a8a',null,.6)},-30);dg(c,()=>{tb(c,'M28 50H96V61',li(a,.15),4,4);sh(c,rr(-4,43,38,14,5),RED,null,.6)},-62)};
G.flare=(c,a)=>dg(c,()=>{for(let i=0;i<7;i++){const t=-1.3+i*.43;ln(c,`M${84+Math.cos(t)*12} ${50+Math.sin(t)*12}L${84+Math.cos(t)*(i%2?22:28)} ${50+Math.sin(t)*(i%2?22:28)}`,FIRE2,4)}flame(c,84,50,90,.7,'#ff6a3a','#fff6c0');
  sh(c,rr(4,38,70,24,5),a,()=>{fl(c,rr(52,30,8,40,0),'#f4f0e4');fl(c,rr(0,30,22,40,0),dk(a,.4))},.9)});
G.key=(c,a)=>dg(c,()=>sh(c,P('M30 44H98V56H92V68H82V56H76V66H66V56H30Q26 70 12 70Q-6 70 -6 50Q-6 30 12 30Q26 30 30 44ZM2 50A9 9 0 1 0 20 50A9 9 0 1 0 2 50Z'),a,()=>ln(c,'M34 48H94',li(a,.45),2.5),1));
G.keycard=(c,a)=>at(c,50,50,-14,1,()=>{sh(c,rr(-40,-27,80,54,7),a,()=>{fl(c,rr(-50,-18,100,11,0),'#22242a');fl(c,rr(-50,12,100,30,0),li(a,.3));ln(c,'M-2 4H28',li(a,.6),3)},1.1);sh(c,rr(-30,0,18,14,3),GOLD,()=>ln(c,'M-30 7H-12M-21 0V14',dk(GOLD,.4),2),0,3)});
G.radio=(c,a)=>{sh(c,rr(30,8,9,26,3),DARK,null,.5);sh(c,rr(54,18,12,12,3),IRON,null,.5);sh(c,rr(22,26,56,66,8),a,()=>{for(let y=62;y<88;y+=7)ln(c,`M32 ${y}H68`,dk(a,.5),3)},1.2);sh(c,rr(30,34,40,18,3),'#9fd8a0',()=>ln(c,'M34 46L42 40L48 46L56 38L66 44',dk('#9fd8a0',.5),2.5),.4,3.5)};
G.coin=(c,a,b)=>{if(b){sh(c,rr(42,7,16,14,4),dk(a,.1),null,.5);sh(c,el(50,56,36),a,null,1.3);sh(c,el(50,56,26),b,null,.5,3.5);ln(c,'M50 56V39M50 56L61 63',INK,4.5);fl(c,el(50,56,3.5),INK)}
  else{sh(c,el(60,60,28),dk(a,.15),null,1);sh(c,el(44,44,32),a,()=>ln(c,el(44,44,24),dk(a,.35),3),1.3);sh(c,star(44,45,15,7),li(a,.45),null,0,3)}};
G.book=(c,a)=>at(c,50,50,-8,1,()=>{c.translate(-50,-50);sh(c,rr(22,74,62,14,3),CREAM,()=>ln(c,'M22 81H90',dk(CREAM,.3),2),0);sh(c,'M22 10H78Q84 10 84 16V78H26Q16 78 16 84V16Q16 10 22 10Z',a,()=>{fl(c,rr(10,0,16,100,0),dk(a,.3));fl(c,rr(34,20,40,34,3),'#2a5a8a')},1.1);
  ln(c,'M40 30H68M40 38H60M54 30V48M40 46H68',CREAM,2.5,.9);tb(c,'M16 84Q16 90 24 90H84',dk(a,.2),3,4)});
// ================= UI glyphs =================
G.hammer_build=(c,a,b)=>dg(c,()=>{hd(c,-6,80,b||WOOD,10,54);sh(c,'M68 60V42Q68 28 54 22L60 13Q88 16 88 42V60Z',a,null,.9);sh(c,rr(62,56,32,22,5),li(a,.1),null,.9)},-45,.9);
G.shield=(c,a,b)=>sh(c,'M50 8L88 20V48Q88 78 50 94Q12 78 12 48V20Z',a,()=>{fl(c,rr(50,0,50,100,0),dk(a,.18));fl(c,rr(43,0,14,100,0),b||li(a,.45));fl(c,rr(0,34,100,14,0),b||li(a,.45))},1.4);
G.skull=(c,a)=>{sh(c,'M50 8Q88 8 88 44Q88 60 76 66V80Q76 88 68 88H32Q24 88 24 80V66Q12 60 12 44Q12 8 50 8Z',a,null,1.4);fl(c,el(35,46,10,11),INK);fl(c,el(65,46,10,11),INK);fl(c,'M50 58L56 70H44Z',INK);ln(c,'M40 76V88M50 76V88M60 76V88',ol(a),3)};
G.house=(c,a,b)=>zm(c,.93,()=>{sh(c,rr(62,14,12,22,2),dk(a,.3),null,.5);sh(c,'M20 46H80V88H20Z',a,()=>fl(c,rr(0,40,100,10,0),dk(a,.25)),1);sh(c,'M4 50L50 10L96 50Z',b||'#a3482f',null,1.2);sh(c,rr(42,62,16,26,2),dk(a,.55),null,0,3.5);sh(c,rr(62,58,12,12,2),'#f0d870',null,0,3)});
G.flame=(c,a,b)=>flame(c,50,54,0,1.7,a,b||FIRE2);
G.drop=(c,a)=>{sh(c,'M50 6Q84 48 84 62Q84 92 50 92Q16 92 16 62Q16 48 50 6Z',a,null,1.6);glint(c,37,60,6,12,.4)};
G.food=(c,a)=>dg(c,()=>{un(c,[rr(6,45,36,10,3),el(4,43,8),el(4,57,8)],BONE);sh(c,'M32 50Q38 20 68 20Q102 22 102 50Q102 78 68 80Q38 80 32 50Z',a,null,1.5);glint(c,60,34,10,5,0,.35)});
G.heart_hp=(c,a)=>{sh(c,'M50 90Q8 60 8 36Q8 14 30 14Q44 14 50 28Q56 14 70 14Q92 14 92 36Q92 60 50 90Z',a,null,1.6);glint(c,30,32,8,5,-.6)};
G.tox=(c,a)=>{const ps=[0,1,2].map(i=>el(50+Math.cos(-Math.PI/2+i*TAU/3)*19,56+Math.sin(-Math.PI/2+i*TAU/3)*19,16));for(const p of ps)ln(c,p,ol(a),13);for(const p of ps)ln(c,p,a,8);sh(c,el(50,56,9),a,null,.5,4);fl(c,el(50,56,3.5),ol(a))};
G.star=(c,a)=>sh(c,star(50,54,46,19),a,null,1.4);
G.clock=(c,a)=>{sh(c,el(50,50,40),a,null,1.2);sh(c,el(50,50,30),'#f4f0e4',null,.6,3.5);ln(c,'M50 50V30M50 50L64 58',INK,5);fl(c,el(50,50,4),INK)};
G.map=(c,a)=>{sh(c,'M8 24L36 14L64 24L92 14V78L64 88L36 78L8 88Z',a,()=>{fl(c,'M36 14L64 24V88L36 78Z',dk(a,.14));c.setLineDash([5,5]);ln(c,'M20 68Q34 50 46 58Q60 66 70 44',RED,3.5);c.setLineDash([]);ln(c,'M36 14V78M64 24V88',dk(a,.35),2.5)},.8);
  ln(c,'M72 30L82 40M82 30L72 40',RED,4.5)};
G.people=(c,a)=>{const p=(x,y,s,col)=>at(c,x,y,0,s,()=>{sh(c,'M-26 34Q-26 -2 0 -2Q26 -2 26 34Z',col,null,1.1);sh(c,el(0,-20,15),col,null,1.1)});p(68,48,.9,dk(a,.25));p(36,56,1.1,a)};
G.paw=(c,a)=>{sh(c,'M50 46Q74 48 80 72Q80 90 62 86Q50 82 38 86Q20 90 20 72Q26 48 50 46Z',a,null,1.2);for(const q of[[18,44,-.4],[38,24,-.1],[62,24,.1],[82,44,.4]])sh(c,el(q[0],q[1],10,13,q[2]),a,null,.8)};
G.lock=(c,a)=>{tb(c,'M32 46V32Q32 12 50 12Q68 12 68 32V46',STEEL,8);sh(c,rr(18,42,64,48,8),a,null,1.3);fl(c,el(50,62,7),INK);fl(c,'M46 64H54L56 78H44Z',INK)};
G.tree=(c,a)=>{sh(c,rr(43,72,14,20,2),WOOD,null,.5);sh(c,'M50 38L88 80H12Z',dk(a,.12),null,.8);sh(c,'M50 22L80 60H20Z',a,null,.8);sh(c,'M50 6L72 40H28Z',li(a,.12),null,.8)};
G.rock=(c,a)=>{lump(c,72,70,1,dk(a,.12),40);sh(c,'M10 66L20 36L44 18L68 28L78 58L62 82L26 84Z',a,()=>{fl(c,'M20 36L44 18L68 28L46 42Z',li(a,.25));fl(c,'M46 42L68 28L78 58L62 82L52 62Z',dk(a,.18))},1.2)};
G.wall=(c,a)=>{for(const r of[[18,[[8,40],[52,40]]],[40,[[8,18],[30,40],[74,18]]],[62,[[8,40],[52,40]]]])for(const q of r[1])sh(c,rr(q[0],r[0],q[1],19,3),a,null,.6,4)};
G.turret=(c,a)=>{tb(c,'M50 60L26 90M50 60L74 90M50 60V88',IRON,6);sh(c,rr(60,32,34,11,3),IRON,null,.5);sh(c,rr(86,28,8,19,3),DARK,null,.5);sh(c,rr(40,54,20,12,3),DARK,null,.5);sh(c,rr(18,22,48,34,8),a,()=>fl(c,rr(0,44,100,20,0),dk(a,.2)),1.2);sh(c,el(34,36,6),RED,null,.4,3.5)};
G.trap=(c,a)=>{const jaw=()=>sh(c,'M50 82Q8 82 6 22L18 36L16 47L27 50L26 60L37 62L38 71H50Z',a,null,.8);tb(c,'M84 84Q96 82 92 94',IRON,3.5,4);sh(c,rr(12,78,76,12,5),dk(a,.3),null,.5);jaw();mir(c,jaw);sh(c,el(50,75,13,6),li(a,.25),null,.4,4)};
G.bed=(c,a)=>{sh(c,rr(8,26,12,62,3),WOOD,null,.6);sh(c,rr(82,50,10,38,3),WOOD,null,.6);sh(c,rr(16,58,70,20,4),CREAM,null,.6);sh(c,rr(22,44,24,16,7),'#f8f4ea',null,.6,4);sh(c,rr(46,48,40,30,6),a,()=>fl(c,rr(46,48,10,30,0),li(a,.35)),1)};
G.chest=(c,a)=>{const bands=()=>{fl(c,rr(22,0,10,100,0),IRON);fl(c,rr(68,0,10,100,0),IRON)};sh(c,rr(10,46,80,44,5),a,bands,1.1);sh(c,'M10 48Q10 16 30 16H70Q90 16 90 48Z',li(a,.12),bands,1.1);sh(c,rr(43,40,14,18,3),GOLD,null,.5,3.5);fl(c,el(50,50,2.5),INK)};
G.sprout=(c,a)=>{tb(c,'M50 80V44',dk(a,.15),5,4);sh(c,'M50 48Q22 46 14 20Q44 16 50 48Z',a,null,.9);sh(c,'M50 42Q78 40 88 12Q58 12 50 42Z',li(a,.15),null,.9);sh(c,'M10 90Q50 62 90 90Z','#6b4a2e',null,.8)};
G.bolt_power=(c,a)=>sh(c,'M60 6L20 54H44L34 94L82 40H56Z',a,null,1.2);
G.radio_wave=(c,a)=>{tb(c,'M50 46L36 90M50 46L64 90M40 76H60',IRON,5,4);for(const r of[20,34]){tb(c,arc(50,40,r,-.85,.85),a,5,4);tb(c,arc(50,40,r,Math.PI-.85,Math.PI+.85),a,5,4)}sh(c,el(50,40,9),a,null,.6,4)};
G.cart=(c,a)=>zm(c,.92,()=>{tb(c,'M6 16H20L32 64M32 64L28 76H82',IRON,5,4.5);sh(c,'M22 28H92L82 62H32Z',a,()=>ln(c,'M40 20V70M56 20V70M72 20V70M20 45H92',dk(a,.35),3),1);sh(c,el(36,86,8),DARK,null,.4,4);sh(c,el(74,86,8),DARK,null,.4,4)},2,-2);
G.question=(c,a)=>{tb(c,'M30 36Q30 14 50 14Q72 14 72 34Q72 46 58 52Q50 56 50 66',a,12,5);sh(c,el(50,84,8),a,null,0)};
G.check=(c,a)=>tb(c,'M16 54L40 78L86 24',a,14,5);
G.sword_cross=(c,a,b)=>{const s=()=>dg(c,()=>{sh(c,'M24 43H92L106 50L92 57H24Z',a,()=>fl(c,rr(20,50,90,10,0),dk(a,.2)),.6,4.5);sh(c,rr(-6,44,26,12,4),b||WOOD,null,.5,4.5);sh(c,rr(16,34,8,32,3),GOLD,null,.5,4.5)});mir(c,s);s()};
G.eye=(c,a)=>{sh(c,'M6 50C26 16 74 16 94 50C74 84 26 84 6 50Z','#f4f0e4',()=>{sh(c,el(50,50,20),a,null,.8,4);fl(c,el(50,50,9),INK);glint(c,43,43,5,3.5,0,.8)},.8)};

export const GLYPHS=G;
/* Colours used when a caller gives none (mainly the UI glyphs). */
export const GLYPH_COLORS={box:'#8a7a5a',hammer_build:STEEL,shield:'#5f7a9a',skull:BONE,house:'#c9b58a',flame:FIRE,drop:'#4aa0e0',food:'#b5683a',heart_hp:'#d03a3a',tox:'#8ac83a',star:'#e8c440',clock:'#7d858c',
  map:'#d8c89a',people:'#6a9ac8',paw:'#b08a5a',lock:GOLD,tree:'#3f7a3a',rock:'#8d8f93',wall:'#9a8f80',turret:'#5f6b78',trap:'#8a9098',bed:'#a04a4a',chest:WOOD,sprout:GREEN,bolt_power:'#f0d040',radio_wave:'#6ad0a0',
  cart:'#c8a030',question:'#c9c4b4',check:'#6ac04a',sword_cross:'#c9d1d8',eye:'#4a9a8a',backpack_open:'#6b4226'};

const PAD=.94; // every glyph is inset a little so nothing sits on the slot border
/* Draw a glyph into a size×size box at the context origin. Unknown glyph names draw the neutral box. */
export function drawIcon(ctx,glyph,colA,colB,size=64){const g=G[glyph]?glyph:'box',a=colA||GLYPH_COLORS[g]||'#8a8f93',o=LA;
  ctx.save();try{ctx.scale(size/100,size/100);ctx.translate(50,50);ctx.scale(PAD,PAD);ctx.translate(-50,-50);ctx.lineJoin=ctx.lineCap='round';ctx.setLineDash([]);ctx.globalAlpha=1;LA=0;G[g](ctx,a,colB||undefined)}finally{LA=o;ctx.restore()}}

const CACHE=new Map(),BLANK='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
/* Cached PNG data: URL for any glyph + colours. Never throws: a glyph that fails falls back to the box. */
export function iconFor(glyph,colA,colB,size=64){size=Math.max(1,Math.round(+size||64));const k=glyph+'|'+(colA||'')+'|'+(colB||'')+'|'+size;let u=CACHE.get(k);if(u)return u;
  try{const cv=document.createElement('canvas');cv.width=cv.height=size;const x=cv.getContext('2d');
    try{drawIcon(x,glyph,colA,colB,size)}catch(e){x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,size,size);drawIcon(x,'box',null,null,size)}
    u=cv.toDataURL('image/png')}catch(e){u=BLANK}
  CACHE.set(k,u);return u}
/* Cached PNG data: URL for an item id from ITEMS. Unknown ids get the neutral box. */
export function iconURL(itemId,size=64){const it=ITEMS[itemId],ic=it&&it.ic;return ic?iconFor(ic[0],ic[1],ic[2],size):iconFor('box',null,null,size)}

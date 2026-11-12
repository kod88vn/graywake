// Graywake procedural audio. No samples: every sound is built from oscillators and two shared noise buffers.
// Layout: helpers (O/N/FM/V/F) → SFX recipes → mixer graph → scene engine (ambience + generative music) → public Snd.
// Every recipe schedules nodes on whatever BaseAudioContext it is given, so the same code runs live and in an
// OfflineAudioContext (Snd.render / Snd.renderScene, used by tests/audio.mjs to measure levels).
const W=typeof window!=='undefined'?window:null;
const AC=W&&(W.AudioContext||W.webkitAudioContext)||null,OAC=W&&(W.OfflineAudioContext||W.webkitOfflineAudioContext)||null;
const noop=()=>{},clamp=(v,a,b)=>v<a?a:v>b?b:v,mtof=m=>440*Math.pow(2,(m-69)/12);
const link=(...n)=>{for(let i=1;i<n.length;i++)n[i-1].connect(n[i]);return n[0]};
function prng(seed){let s=seed>>>0;return()=>{s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let R=prng(1977); // module PRNG: noise offsets and small per-hit variation. Reseeded for offline renders so they repeat.

/* Shared noise, one pair per context: white (scaled so energy per Hz does not depend on the sample rate) and
   brown (white through a 40 Hz one-pole, normalised to 0.3 RMS, end cross-faded into its start so it loops cleanly). */
const BUFS=new WeakMap();
function bufs(c){
  let b=BUFS.get(c);if(b)return b;
  const sr=c.sampleRate,n=sr*2|0,xf=sr*.05|0,r=prng(7),amp=Math.sqrt(sr/44100),a=1-Math.exp(-2*Math.PI*40/sr);
  const white=c.createBuffer(1,n,sr),brown=c.createBuffer(1,n,sr),w=white.getChannelData(0),d=brown.getChannelData(0),tmp=new Float32Array(n+xf);
  let y=0,sum=0;
  for(let i=0;i<n+xf;i++){const x=r()*2-1;if(i<n)w[i]=x*amp;y+=a*(x-y);tmp[i]=y}
  for(let i=0;i<n;i++){d[i]=i<xf?tmp[i]*(i/xf)+tmp[n+i]*(1-i/xf):tmp[i];sum+=d[i]*d[i]}
  const k=.3/Math.sqrt(sum/n);for(let i=0;i<n;i++)d[i]*=k;
  BUFS.set(c,b={white,brown});return b;
}

/* ---- synthesis helpers. k is a "kit": {ctx, dest, p: pitch multiplier, v: volume trim}. ---- */
const FT={lp:'lowpass',bp:'bandpass',hp:'highpass'};
const fq=(k,f)=>Math.min(f*k.p,k.ctx.sampleRate*.45);
// envelope: linear attack → optional hold → exponential decay to silence. Returns the stop time.
function env(g,t,att,dur,vol,hold=0){vol=Math.max(vol,2e-4);g.setValueAtTime(1e-4,t);g.linearRampToValueAtTime(vol,t+att);if(hold)g.setValueAtTime(vol,t+att+hold);g.exponentialRampToValueAtTime(1e-4,t+att+hold+dur);return t+att+hold+dur+.02}
// O: oscillator blip, pitch sweeping f0→f1 over its life.
function O(k,t,type,f0,f1,dur,vol,att=.004,hold=0){
  const c=k.ctx,o=c.createOscillator(),g=c.createGain(),e=env(g.gain,t,att,dur,vol*k.v,hold);
  o.type=type;o.frequency.setValueAtTime(fq(k,f0),t);if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(fq(k,f1),e);
  link(o,g,k.dest);o.start(t);o.stop(e);
}
// N: noise burst through one filter (lp/bp/hp), cutoff sweeping f0→f1. brown=1 for the dark buffer.
function N(k,t,type,f0,f1,q,dur,vol,att=.002,brown=0,hold=0){
  const c=k.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),B=bufs(c),e=env(g.gain,t,att,dur,vol*k.v,hold);
  s.buffer=brown?B.brown:B.white;s.loop=true;f.type=FT[type];f.Q.value=q;f.frequency.setValueAtTime(fq(k,f0),t);if(f1)f.frequency.exponentialRampToValueAtTime(fq(k,f1),e);
  link(s,f,g,k.dest);s.start(t,R()*1.9);s.stop(e);
}
// FM: two-operator bell/tine. Modulation index decays, so the tone starts bright and settles to a sine.
function FM(k,t,f,ratio,idx,dur,vol,att=.003){
  const c=k.ctx,o=c.createOscillator(),m=c.createOscillator(),mg=c.createGain(),g=c.createGain(),e=env(g.gain,t,att,dur,vol*k.v);f=fq(k,f);
  o.frequency.value=f;m.frequency.value=f*ratio;mg.gain.setValueAtTime(idx*f,t);mg.gain.exponentialRampToValueAtTime(Math.max(idx*f*.02,.01),t+att+dur*.6);
  link(m,mg);mg.connect(o.frequency);link(o,g,k.dest);o.start(t);m.start(t);o.stop(e);m.stop(e);
}
// V: creature voice. Saw f0→f1, amplitude-roughened at `rough` Hz, through two formant peaks fa/fb, plus breath noise.
function V(k,t,f0,f1,dur,vol,fa,fb,rough=30,att=.05,breath=.3,hold=0){
  const c=k.ctx,o=c.createOscillator(),l=c.createOscillator(),lg=c.createGain(),am=c.createGain(),a=c.createBiquadFilter(),b=c.createBiquadFilter(),lp=c.createBiquadFilter(),g=c.createGain(),e=env(g.gain,t,att,dur,vol*k.v,hold);
  o.type='sawtooth';o.frequency.setValueAtTime(fq(k,f0),t);o.frequency.linearRampToValueAtTime(fq(k,f1),e);
  l.type='triangle';l.frequency.value=rough*(.9+R()*.2);lg.gain.value=.45;am.gain.value=.55;link(l,lg);lg.connect(am.gain);
  a.type=b.type='peaking';a.frequency.value=fq(k,fa);a.Q.value=3;a.gain.value=13;b.frequency.value=fq(k,fb);b.Q.value=5;b.gain.value=10;lp.type='lowpass';lp.frequency.value=fq(k,fb*1.7);
  link(o,am,a,b,lp,g,k.dest);o.start(t);l.start(t);o.stop(e);l.stop(e);
  if(breath){const s=c.createBufferSource(),sg=c.createGain();s.buffer=bufs(c).white;s.loop=true;sg.gain.value=breath*.35;link(s,sg,a);s.start(t,R()*1.9);s.stop(e)}
}
// F: insert a (sweeping) filter; returns a kit that feeds it.
function F(k,t,type,f0,f1,dur,q=.7){const f=k.ctx.createBiquadFilter();f.type=FT[type];f.Q.value=q;f.frequency.setValueAtTime(fq(k,f0),t);if(f1)f.frequency.exponentialRampToValueAtTime(fq(k,f1),t+dur);f.connect(k.dest);return{ctx:k.ctx,dest:f,p:k.p,v:k.v}}

/* ---- SFX recipes. def(group,{name:[seconds, (k,t)=>…, trim]}) registers SFX[name](ctx,dest,t0,opts). ----
   The trim (third entry, default 1) is the loudness correction found with tests/audio.mjs. */
const SFX={};
const def=(group,o)=>{for(const n in o){const[dur,fn,trim=1]=o[n],f=(ctx,dest,t,op)=>fn({ctx,dest,p:op&&op.pitch||1,v:trim},t);f.group=group;f.dur=dur;SFX[n]=f}};

def('ui',{
  ui_tap:[.08,(k,t)=>{O(k,t,'sine',900,640,.05,.5,.002);N(k,t,'hp',3000,0,.7,.015,.15)}],                      // soft tick
  ui_open:[.2,(k,t)=>{O(k,t,'triangle',440,520,.08,.45);O(k,t+.06,'triangle',660,790,.11,.45)}],               // two rising blips
  ui_close:[.2,(k,t)=>{O(k,t,'triangle',660,600,.08,.45);O(k,t+.06,'triangle',440,370,.11,.45)}],              // two falling blips
  error:[.3,(k,t)=>{const m=F(k,t,'lp',900);for(const d of[0,.12]){O(m,t+d,'square',155,140,.1,.4,.005);O(m,t+d,'square',164,150,.1,.3,.005)}}], // dull double buzz
  equip:[.2,(k,t)=>{N(k,t,'bp',2400,1200,2,.06,.5,.004);O(k,t,'triangle',300,220,.07,.4);N(k,t+.08,'hp',3200,0,.7,.03,.3);O(k,t+.08,'triangle',520,400,.04,.25)},1.3], // cloth rub + buckle click
  pickup:[.15,(k,t)=>{O(k,t,'sine',520,1040,.1,.5,.004);N(k,t,'hp',4000,0,.7,.03,.12)}],                       // quick upward blip
  coin:[.4,(k,t)=>{FM(k,t,1568,2.4,.5,.07,.4);FM(k,t+.07,2093,2.4,.6,.3,.45)}],                                // two bright bell pings
  craft:[.4,(k,t)=>{for(const d of[0,.11]){N(k,t+d,'bp',1800,900,2,.04,.6);O(k,t+d,'triangle',420,300,.05,.4)}O(k,t+.22,'sine',700,1050,.1,.35,.01)},1.3], // two taps and a ratchet
  build:[.35,(k,t)=>{O(k,t,'sine',140,65,.16,.7);N(k,t,'lp',900,300,.7,.09,.6);N(k,t+.13,'bp',1400,800,2,.05,.4);O(k,t+.13,'triangle',300,200,.08,.35)}], // heavy thunk, then it settles
  levelup:[1.1,(k,t)=>{[440,554,659,880].forEach((f,i)=>{const d=i*.09,l=i===3?.7:.3;O(k,t+d,'triangle',f,f,l,.32,.006);O(k,t+d,'sine',f*2,f*2,l*.6,.1,.006)})}], // rising arpeggio
  quest:[.8,(k,t)=>{FM(k,t,587,2,.7,.4,.42);FM(k,t+.14,880,2,.7,.6,.42)}],                                     // two-note chime, a fifth apart
  warning:[.6,(k,t)=>{const m=F(k,t,'lp',2600);for(let i=0;i<3;i++){O(m,t+i*.17,'square',740,740,.07,.3,.004,.05);O(m,t+i*.17+.06,'square',587,587,.06,.3,.004,.03)}},.85], // three hi-lo alarm chirps
  horde_horn:[2.2,(k,t)=>{const h=F(k,t,'lp',240,950,.8,1.4);h.dest.frequency.exponentialRampToValueAtTime(260,t+2.1); // war horn: saw root + fifth, filter opening then closing
    O(h,t,'sawtooth',74,82,.7,.5,.25,1.1);O(h,t,'sawtooth',111,123,.7,.3,.3,1.05);O(k,t,'sine',39,41,.7,.4,.3,1.05);N(h,t,'bp',400,0,.5,.6,.25,.3,0,1)},.53],
  sleep:[1.2,(k,t)=>{[523,392,330].forEach((f,i)=>O(k,t+i*.3,'sine',f,f*.985,.5,.4,.05))},.8],                    // three slow falling notes
  travel:[.8,(k,t)=>{N(k,t,'bp',350,1500,1,.45,.6,.22);O(k,t,'sine',196,392,.45,.25,.2);O(k,t+.4,'triangle',587,587,.3,.22,.01)}], // rising whoosh then an arrival note
});
def('world',{
  step:[.1,(k,t)=>{N(k,t,'lp',700,220,.8,.07,.6,.004);O(k,t,'sine',95,55,.05,.4)}],                            // soft scuff + heel
  chop:[.2,(k,t)=>{N(k,t,'bp',1500,650,1.2,.06,.8);O(k,t,'triangle',220,105,.1,.6);N(k,t,'lp',600,200,.7,.1,.4,.002,1)}], // crack + woody thock
  mine:[.2,(k,t)=>{N(k,t,'hp',3500,0,.7,.03,.3);O(k,t,'sine',1900,1700,.06,.3);O(k,t,'triangle',320,170,.05,.4);N(k,t+.01,'bp',2400,1500,2,.12,.7)},.9], // tick, ping and chips
  rustle:[.25,(k,t)=>{[0,.055,.12].forEach((d,i)=>N(k,t+d,'bp',3800+i*900,2600,.8,.06,.4,.02))},1.6],              // three leafy brushes
  open_crate:[.35,(k,t)=>{O(F(k,t,'lp',1400),t,'sawtooth',170,270,.12,.3,.03);N(k,t+.14,'bp',900,500,1.5,.06,.6);O(k,t+.14,'sine',125,75,.11,.7)}], // lid creak then thunk
  door:[.4,(k,t)=>{O(F(k,t,'bp',900,600,.2,3),t,'sawtooth',230,165,.14,.5,.04);N(k,t+.18,'hp',2600,0,.7,.02,.4);O(k,t+.19,'sine',110,65,.1,.7);N(k,t+.19,'lp',700,250,.7,.08,.4)}], // hinge creak, latch, thud
  break:[.6,(k,t)=>{N(k,t,'lp',2400,260,.7,.4,.7);O(k,t,'sine',105,42,.32,.7);[[.03,1300],[.09,850],[.16,1900],[.24,1100]].forEach(([d,f])=>N(k,t+d,'bp',f,f*.6,2,.05,.5))},.85], // collapse rumble + splintering cracks
  splash:[.5,(k,t)=>{N(k,t,'bp',800,2800,.9,.32,.6,.03);N(k,t,'lp',500,200,.7,.16,.5);O(k,t,'sine',310,115,.1,.4)},1.5], // plop + spray
  thunder:[2.4,(k,t)=>{N(k,t,'lp',2600,180,.7,.3,.7,.01);N(k,t,'lp',200,55,.7,1.9,1.6,.06,1);N(k,t+.35,'lp',130,60,.7,.7,1.1,.1,1);N(k,t+.85,'lp',110,50,.7,1.1,.9,.15,1)},.55], // crack then rolling rumble
});
def('survival',{
  eat:[.4,(k,t)=>{[0,.13,.26].forEach((d,i)=>{N(k,t+d,'bp',1300+i*150,800,.8,.12,1.2,.004);N(k,t+d,'lp',600,250,.7,.1,.9);O(k,t+d,'triangle',180,120,.04,.3)})}], // three crunches
  drink:[.4,(k,t)=>{[300,345,390].forEach((f,i)=>{O(k,t+i*.13,'sine',f,f*1.7,.07,.5,.012);N(k,t+i*.13,'lp',420,0,.7,.05,.25,.01)})}], // three gulps
  heal:[.7,(k,t)=>{O(k,t,'sine',440,660,.35,.3,.05);O(k,t+.1,'sine',660,990,.4,.25,.05);O(k,t+.22,'triangle',880,880,.4,.2,.03)},1.3], // soft rising shimmer
  hurt:[.25,(k,t)=>{O(k,t,'sine',165,58,.16,.8);N(k,t,'lp',950,220,.7,.1,.6);V(k,t,125,85,.12,.3,520,1150,45,.01,.2)},.8], // body thud with a breathy edge
  death:[1.6,(k,t)=>{O(k,t,'sine',160,60,.2,.6);O(k,t,'sine',220,38,1.3,.45,.03);O(k,t,'triangle',110,30,1.4,.4,.05);N(k,t,'lp',420,70,.7,.9,.7,.05,1)},.7], // thud and a long falling tone
});
def('combat',{
  swing:[.2,(k,t)=>{N(k,t,'bp',480,2300,1.6,.13,.9,.05)},2.2],                                                     // rising band-passed whoosh
  hit_flesh:[.15,(k,t)=>{O(k,t,'sine',145,58,.1,.8);N(k,t,'lp',1500,280,1,.07,.7)},.9],                           // dull wet smack
  hit_wood:[.12,(k,t)=>{O(k,t,'triangle',265,135,.07,.7);N(k,t,'bp',1100,700,2,.05,.7)}],                      // knock
  hit_stone:[.12,(k,t)=>{N(k,t,'bp',2600,1700,1.5,.04,.7);O(k,t,'triangle',480,290,.04,.5);N(k,t,'lp',700,300,.7,.1,.7)},1.1], // hard clack
  hit_metal:[.3,(k,t)=>{N(k,t,'hp',4000,0,.7,.02,.4);O(k,t,'sine',1240,1230,.24,.3,.002);O(k,t,'sine',1872,1860,.17,.25,.002);O(k,t,'sine',2930,2910,.1,.2,.002)},.9], // inharmonic clang
  bow:[.25,(k,t)=>{O(k,t,'triangle',185,135,.13,.6,.002);O(k,t,'sine',540,300,.04,.4,.002);N(k,t+.01,'bp',2600,900,2,.11,.5,.01)}], // string thrum + arrow hiss
  shot_pistol:[.35,(k,t)=>{N(k,t,'hp',1800,0,.7,.025,.5,.001);N(k,t,'bp',900,300,.7,.14,.7,.001);O(k,t,'sine',165,50,.1,.6,.002);N(k,t+.02,'lp',1800,380,.7,.24,.4,.01)},.85], // snap, bark, thump, short tail
  shot_rifle:[.6,(k,t)=>{N(k,t,'hp',2600,0,.7,.03,.5,.001);N(k,t,'bp',1400,240,.6,.2,.7,.001);O(k,t,'sine',135,38,.18,.6,.002);N(k,t+.03,'lp',2600,300,.7,.48,.4,.02)},.78], // sharper crack, longer tail
  shot_shotgun:[.7,(k,t)=>{N(k,t,'lp',3200,190,.7,.3,.6,.001);O(k,t,'sine',112,32,.26,.6,.002);N(k,t,'bp',1800,900,1,.05,.35,.001);N(k,t+.03,'lp',950,140,.7,.55,.5,.03,1)},.75], // wide boom
  shot_smg:[.1,(k,t)=>{N(k,t,'bp',1600,480,.8,.1,.6,.001);O(k,t,'triangle',215,78,.05,.5,.002);N(k,t,'hp',3000,0,.7,.015,.3,.001)},1.15], // light dry pop
  flame:[.22,(k,t)=>{N(k,t,'bp',480,1500,.6,.15,.8,.03);N(k,t,'lp',320,160,.7,.15,.9,.03,1)},.85],                 // breathy roar, overlaps into a stream
  explosion:[2,(k,t)=>{N(k,t,'lp',5000,280,.7,.3,.45,.002);O(k,t,'sine',92,24,1,.5,.003);N(k,t,'lp',1200,55,.7,1.6,.75,.01,1);N(k,t+.12,'bp',2000,700,1,.6,.15,.1)},.72], // crack, sub drop, rumble, debris
  zap:[.2,(k,t)=>{O(F(k,t,'hp',1500),t,'square',96,88,.16,.35,.002);N(k,t,'bp',3500,6000,1.5,.14,1);O(k,t,'sawtooth',2400,300,.07,.3,.002)}], // crackling arc
  beam:[.3,(k,t)=>{O(F(k,t,'lp',3000,900,.25),t,'sawtooth',540,300,.22,.45,.005);O(k,t,'sine',1080,600,.22,.3,.005);N(k,t,'bp',5000,2500,5,.15,.3)},1.3], // falling energy bolt
  trap_snap:[.2,(k,t)=>{N(k,t,'hp',2500,0,.7,.02,.7,.001);O(k,t,'triangle',900,480,.03,.5,.001);O(k,t,'sine',1650,1640,.12,.25,.002);O(k,t,'sine',2480,2470,.08,.2,.002);O(k,t,'sine',180,88,.06,.6)},.8], // jaws clap shut
  turret:[.25,(k,t)=>{O(F(k,t,'lp',1500),t,'sawtooth',300,520,.07,.25,.02);N(k,t+.09,'bp',1800,580,.8,.07,.9,.001);O(k,t+.09,'sine',190,68,.07,.7,.002);N(k,t+.09,'hp',3200,0,.7,.015,.4,.001)},.85], // servo whirr then a shot
  throw:[.3,(k,t)=>{N(k,t,'bp',380,1150,2,.16,.9,.09)},2.3],                                                       // slower, lower whoosh
});
def('creature',{
  groan:[1.1,(k,t)=>{V(k,t,88,68,.5,.5,480,1050,21,.3,.25,.25)},.7],                                              // idle husk: slow sagging moan
  growl:[.7,(k,t)=>{V(k,t,98,140,.3,.6,650,1400,38,.08,.4,.25)},.55],                                              // rising, rougher
  screech:[.8,(k,t)=>{V(k,t,780,1250,.3,.35,1700,3100,58,.03,.5,.4);N(k,t,'bp',2800,3600,4,.3,.2,.05,0,.3)},.6],  // screamer: high, rough and rising
  roar:[2,(k,t)=>{V(k,t,74,44,.9,.7,380,880,26,.15,.4,.8);O(k,t,'sine',56,34,.9,.5,.15,.7);N(k,t,'lp',700,200,.7,.9,.5,.2,1,.6)},.45], // boss: long, low, with sub
  bite:[.15,(k,t)=>{N(k,t,'bp',2200,1400,2,.03,.7,.001);O(k,t,'triangle',300,115,.05,.6);N(k,t+.01,'lp',900,300,.7,.1,.8)},1.2], // teeth click + wet chomp
  spit:[.2,(k,t)=>{N(k,t,'bp',1400,3600,3,.1,.8,.02);O(k,t,'sine',520,240,.07,.5,.006)},1.4],                      // wet hiss
  splat:[.5,(k,t)=>{N(k,t,'lp',2500,190,.7,.3,.8);O(k,t,'sine',185,48,.2,.8);N(k,t,'bp',800,400,.5,.25,.5,.02);O(k,t+.07,'sine',300,700,.05,.3,.01);O(k,t+.15,'sine',240,560,.05,.25,.01)},.75], // burst + bubbles
  wolf:[.6,(k,t)=>{V(k,t,165,235,.25,.5,800,2100,46,.06,.6,.2)},.7],                                              // snarl: bright and breathy
  boar:[.5,(k,t)=>{V(k,t,125,82,.16,.6,450,1200,62,.02,.4,.05);V(k,t+.22,105,74,.14,.5,430,1150,62,.02,.4)},.6],  // two short grunts
  bear:[1.3,(k,t)=>{V(k,t,76,54,.6,.7,340,780,19,.14,.3,.45);O(k,t,'sine',60,44,.6,.4,.14,.4)},.45],               // deep slow growl
});
const NAMES=Object.keys(SFX);

/* ---- mixer: sfx bus (ambience feeds it) + music bus (through a duck gain) → limiter → master. Short generated reverb as a send. ---- */
const SFX_BUS=.8,MUSIC_BUS=.3;
function graph(ctx){
  const g=v=>{const n=ctx.createGain();n.gain.value=v;return n},master=g(1),sfx=g(SFX_BUS),music=g(MUSIC_BUS),duck=g(1),amb=g(.75),mSend=g(.4),sSend=g(.08),comp=ctx.createDynamicsCompressor(),conv=ctx.createConvolver();
  comp.threshold.value=-6;comp.knee.value=4;comp.ratio.value=16;comp.attack.value=.002;comp.release.value=.12;
  const sr=ctx.sampleRate,n=sr*.8|0,ir=ctx.createBuffer(2,n,sr),r=prng(99); // 0.8 s decaying noise, slightly darkened
  for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);let p=0;for(let i=0;i<n;i++){const x=r()*2-1;d[i]=(x+p)*.5*Math.pow(1-i/n,3);p=x}}
  conv.buffer=ir;link(amb,sfx,comp,master,ctx.destination);link(music,duck,comp);link(music,mSend,conv,comp);link(sfx,sSend,conv);
  return{master,sfx,music,duck,amb};
}

/* ---- scene engine: ambience beds + events, generative music, tension layer. One instance per context. ---- */
const SCALES={dor:[0,2,3,5,7,9,10],min:[0,2,3,5,7,8,10],loc:[0,1,3,5,6,8,10],pen:[0,3,5,7,10]};
const THEME=[4,7,9,8,7,4,6,5,4,7,9,11,10,8,7,7]; // the main motif, in scale degrees of A minor
// root: MIDI note of degree 0. prog: chord roots (degrees). shape: chord tones. bar: seconds per chord. beat: motif grid.
const PAL={
  menu:{root:45,sc:'min',prog:[0,5,2,4],shape:[0,2,4],wave:'triangle',cut:1300,bar:8,pv:.3,voice:'pluck',beat:.75,prob:.5,oct:1,theme:THEME},
  forest:{root:50,sc:'dor',prog:[0,3,6,2],shape:[0,2,4],wave:'triangle',cut:1100,bar:7,pv:.3,voice:'pluck',beat:.6,prob:.4,oct:1},    // warm D dorian, soft plucks
  dust:{root:45,sc:'pen',prog:[0,2,0,4],shape:[0,3],wave:'sawtooth',cut:520,bar:9,pv:.3,voice:'twang',beat:.8,prob:.3,oct:1},          // open fifths, twangy
  city:{root:48,sc:'min',prog:[0,5,3,6],shape:[0,2,4,6],wave:'sine',cut:1500,bar:8,pv:.3,voice:'epiano',beat:.9,prob:.35,oct:1,clang:.04}, // cold sevenths, electric piano, far clangs
  frost:{root:57,sc:'min',prog:[0,5,2],shape:[0,4,8],wave:'sine',cut:3000,bar:10,pv:.3,voice:'glass',beat:1.1,prob:.35,oct:1},        // stacked fifths, glassy and high
  gray:{root:40,sc:'loc',prog:[0,4,1],shape:[0,1,4],wave:'sawtooth',cut:340,bar:9,pv:.3,voice:'bow',beat:1.5,prob:.3,oct:1},          // locrian cluster, low and uneasy
  interior:{root:48,sc:'min',prog:[0,5],shape:[0,4],wave:'sine',cut:700,bar:10,pv:.3,voice:'epiano',beat:1.2,prob:.15,oct:1},         // nearly bare
};
PAL.map=PAL.menu;
const KICK='1000100010001000',TOM='0001001000110010',SNR='0000100000001000'; // assault pattern, sixteenth steps

function Engine(ctx,mOut,aOut,rnd,tc,parts={}){
  const gn=v=>{const n=ctx.createGain();n.gain.value=v;return n};
  const bq=(type,f,q=.7)=>{const n=ctx.createBiquadFilter();n.type=type;n.frequency.value=f;n.Q.value=q;return n};
  const ten=gn(0);link(ten,mOut);
  let st=null,pal=PAL.menu,sc=SCALES.min,mix=null,mkey='',ci=0,chord=0,fresh=true,tPad=0,tMot=0,tDrum=0,tAmb=0,di=0,left=0,rest=0,walk=0,ti=0;
  const mk=v=>({ctx,dest:mix,p:1,v}),ak={ctx,dest:aOut,p:1,v:1},dk={ctx,dest:ten,p:1,v:1};
  const deg=d=>{const n=sc.length;return pal.root+12*Math.floor(d/n)+sc[(d%n+n)%n]};
  const to=(param,v,t,k=1)=>param.setTargetAtTime(v,t,tc*k);

  // ambience beds: looping noise and hum, always running, levels and colours steered by set()
  let A=null;
  if(parts.amb!==false){
    const B=bufs(ctx),loop=b=>{const s=ctx.createBufferSource();s.buffer=b;s.loop=true;s.start(0);return s},white=loop(B.white),brown=loop(B.brown);
    const lfo=(hz,depth,param)=>{const o=ctx.createOscillator(),d=gn(depth);o.frequency.value=hz;link(o,d);d.connect(param);o.start(0)};
    A={windF:bq('lowpass',400,1.1),windG:gn(0),gust:gn(1),howlF:bq('bandpass',700,9),howlG:gn(0),rainH:bq('highpass',1500),rainL:bq('lowpass',6500),rainG:gn(0),rumF:bq('lowpass',110),rumH:bq('highpass',28),rumT:gn(1),rumG:gn(0),humG:gn(0)};
    link(white,A.windF,A.windG,A.gust,aOut);lfo(.09,500,A.windF.detune);lfo(.137,.3,A.gust.gain);   // wind: low-passed noise, cutoff and level drifting
    link(white,A.howlF,A.howlG,aOut);lfo(.07,450,A.howlF.detune);lfo(.19,220,A.howlF.detune);       // howl: narrow resonant band wandering in pitch
    link(white,A.rainH,A.rainL,A.rainG,aOut);                                                       // rain: bright hiss
    link(brown,A.rumF,A.rumH,A.rumT,A.rumG,aOut);lfo(.11,.25,A.rumT.gain);                                        // rumble: sub noise, slowly breathing
    const h1=ctx.createOscillator(),h2=ctx.createOscillator(),h2g=gn(.4);h1.type='triangle';h1.frequency.value=60;h2.frequency.value=120.6;link(h1,A.humG,aOut);link(h2,h2g,A.humG);h1.start(0);h2.start(0); // mains hum
  }
  function ambSet(s,t){
    const b=s.biome,w=s.weather,ind=b==='interior';
    let wind={forest:.3,dust:.28,city:.24,interior:.08,frost:.28,gray:.22}[b]||.26,wf={forest:420,dust:950,city:300,interior:180,frost:650,gray:240}[b]||450;
    let howl=b==='frost'?.7:0,rain=0,rum=b==='gray'?.15:0,hum=b==='city'?.03:ind?.05:0;
    if(w==='rain')rain=.1;if(w==='storm'){rain=.13;wind*=1.5;rum+=.08;howl+=.25}
    if(w==='fog'){wind*=.7;wf*=.7}if(w==='snow'){wind*=1.25;wf*=.8;howl+=.3}if(w==='heat'){wind*=.7;wf*=1.3}if(w==='spores')rum+=.1;
    if(ind){rain*=.4;howl=0}if(s.night)wind*=.85;
    to(A.windF.frequency,wf,t);to(A.windG.gain,wind,t);to(A.howlG.gain,howl,t);to(A.rainG.gain,rain,t);to(A.rainL.frequency,ind?900:6500,t);to(A.rumG.gain,rum,t);to(A.humG.gain,hum,t);
  }
  // ambience events, one roll every quarter second
  function ambTick(t){
    const b=st.biome,w=st.weather,nt=st.night,wild=b==='forest'||b==='menu'||b==='map',fair=w==='clear'||w==='fog'||w==='heat',wet=w==='rain'||w==='storm';
    if(wild&&!nt&&fair&&rnd()<.11){const f=2300+rnd()*2200,n=1+(rnd()*4|0),v=.03+rnd()*.04;for(let i=0;i<n;i++)O(ak,t+i*.11,'sine',f*(1+rnd()*.3),f*(.8+rnd()*.5),.07,v,.01)} // bird phrase
    if(b==='forest'&&!nt&&fair&&rnd()<.04)N(ak,t,'bp',5200,5600,14,.5,.12,.25,0,.3);                              // insect buzz by day
    if(w==='heat'&&!nt&&rnd()<.1)N(ak,t,'bp',6100,6400,16,.6,.14,.3,0,.5);                                        // heat: cicada drone
    if((wild||b==='dust')&&nt&&fair&&rnd()<(b==='dust'?.12:.3)){const f=4100+rnd()*500;for(let i=0;i<3;i++)O(ak,t+i*.05,'sine',f,f,.03,.03,.006)} // cricket triplet
    if((b==='city'||b==='interior')&&rnd()<(wet?.2:.07))O(ak,t,'sine',1500+rnd()*700,900,.06,.06,.002);           // drip
    if(b==='city'&&rnd()<.02)FM(ak,t,170+rnd()*90,1.41,3,1.3,.05);                                                // far-off metal groan
    if(b==='frost'&&rnd()<.05)N(ak,t,'bp',450,950,4,1.4,.3,.9);                                                   // gust
    if(b==='gray'&&rnd()<.06)O(ak,t,'triangle',64,48,2,.12,1);                                                    // spore-field breath
  }

  // music: one long pad chord per bar (two detuned oscillators per note through a slowly opening low-pass)
  function pad(t){
    const P=pal,nt=st.night,len=P.bar,att=fresh?.5:len*.3,rel=len*.5,e=t+len+rel,root=P.prog[ci++%P.prog.length],cut=P.cut*(nt?.55:1),vol=P.pv*(nt?.8:1);
    let sh=P.shape;if(nt&&sh.length>2)sh=[sh[0],sh[sh.length-1]]; // night: drop the inner voices
    const f=bq('lowpass',cut*.6,.5),g=gn(0),a=g.gain;
    f.frequency.setValueAtTime(cut*.6,t);f.frequency.linearRampToValueAtTime(cut*1.25,t+len*.6);f.frequency.linearRampToValueAtTime(cut*.5,e);
    a.setValueAtTime(0,t);a.linearRampToValueAtTime(vol,t+att);a.setValueAtTime(vol,t+len);a.linearRampToValueAtTime(0,e);link(f,g,mix);
    const voice=(m,type,det,v)=>{const o=ctx.createOscillator(),og=gn(v);o.type=type;o.frequency.value=mtof(m);o.detune.value=det;link(o,og,f);o.start(t);o.stop(e+.05)};
    voice(deg(root)-12,'sine',0,.5);for(const s of sh){const m=deg(root+s);voice(m,P.wave,-6,.3);voice(m,P.wave,7,.3)}
    chord=root;fresh=false;
  }
  // motif voices, one per palette
  function play(t,f,v){
    const k=mk(v);
    switch(pal.voice){
      case'pluck':O(k,t,'triangle',f,f,1.3,.5);O(k,t,'sine',f*2,f*2,.45,.14);break;                                   // soft pluck
      case'twang':O(F(k,t,'bp',f*5,f*1.6,.5,1.2),t,'sawtooth',f*1.035,f,.9,.8);O(k,t+.012,'triangle',f*1.5,f*1.5,.7,.16);break; // bent string + its fifth
      case'epiano':FM(k,t,f,1,1.4,1.9,.42);FM(k,t,f*4,1,.3,.25,.05);break;                                            // tine
      case'glass':FM(k,t,f,3.01,.5,3.2,.3,.03);O(k,t,'sine',f*2.005,f*2,2.2,.07,.06);break;                           // struck glass
      case'bow':O(F(k,t,'lp',420,1000,1.2,1.5),t,'sawtooth',f,f*.99,1.6,.5,.7,.6);break;                              // slow bowed note, sagging flat
    }
  }
  // motif scheduler: short phrases (the theme, or a walk around the current chord) separated by rests
  function motif(t){
    const P=pal,nt=st.night;
    if(P.clang&&rnd()<P.clang)FM(mk(.5),t,150+rnd()*120,1.41,2.5,1.6,.14);                                             // distant metallic hit
    if(left<=0){if(rest-->0||rnd()>P.prob*(nt?.5:1)*(1-.7*st.danger))return;left=1+(rnd()*3|0)+(P.theme?1:0);rest=3;walk=chord+P.shape[rnd()*P.shape.length|0]}
    if(rnd()<.2)return;left--;                                                                                         // sometimes hold a beat
    let d=walk;if(P.theme)d=P.theme[ti++%P.theme.length];else walk=clamp(walk+[-2,-1,1,2][rnd()*4|0],chord-1,chord+7);
    play(t,mtof(deg(d+sc.length*P.oct)),(.55+rnd()*.3)*(nt?.7:1));
  }
  // tension layer: heartbeat → toms and a bass pulse → full assault pattern as danger rises
  function drum(t,i,d,sd){
    const b=mtof(28+(pal.root+8)%12);
    if(d>=.7){
      if(KICK[i]==='1'){O(dk,t,'sine',135,42,.22,.9,.002);N(dk,t,'lp',700,160,.7,.05,.4)}
      if(TOM[i]==='1')O(dk,t,'triangle',i>8?115:155,i>8?66:88,.14,.5,.002);
      if(SNR[i]==='1')N(dk,t,'bp',700,320,.8,.16,.7);
      if(i&1)N(dk,t,'hp',6000,0,.7,.03,.12*(d-.5));
      else O(F(dk,t,'lp',420,160,sd*1.8,2),t,'sawtooth',i%8===6?b*1.189:b,0,sd*1.8,.4,.005);
    }else{
      const h=Math.min(1,d*2.2);
      if(i===0)O(dk,t,'triangle',84,40,.2,.9*h,.003);if(i===3)O(dk,t,'triangle',74,38,.18,.6*h,.003);                 // lub-dub
      if(d>=.35){if(i===8||i===11)O(dk,t,'triangle',112,60,.14,.45,.002);if(i%8===0)O(F(dk,t,'lp',320,120,sd*6,1.5),t,'sawtooth',b,0,sd*6,.35,.02)}
    }
  }
  return{
    musicOn:parts.music!==false,
    set(s,t){
      st=s;const key=s.biome+(s.night?'N':'D');
      if(key!==mkey){ // new palette: fade the old mix out under a fresh one
        mkey=key;if(mix)mix.gain.setTargetAtTime(0,t,tc);
        mix=gn(0);link(mix,mOut);pal=PAL[s.biome]||PAL.menu;sc=SCALES[pal.sc];ci=0;fresh=true;left=0;rest=1;tPad=t;tMot=t+pal.beat;
      }
      to(mix.gain,1-.4*s.danger,t);to(ten.gain,s.danger<.04?0:.35+.9*s.danger,t,.5);
      if(A)ambSet(s,t);
    },
    run(until,now){ // schedule everything due before `until`; clocks that fell behind (hidden tab) skip ahead
      if(!st)return;
      if(A){if(tAmb<now)tAmb=now;while(tAmb<until){ambTick(tAmb);tAmb+=.25}}
      if(!this.musicOn)return;
      if(tPad<now)tPad=now;while(tPad<until){pad(tPad);tPad+=pal.bar}
      if(tMot<now)tMot=now;while(tMot<until){motif(tMot);tMot+=pal.beat}
      if(tDrum<now)tDrum=now;while(tDrum<until){const d=st.danger,sd=60/(70+62*d)/4;if(d>=.04)drum(tDrum,di,d,sd);di=di+1&15;tDrum+=sd}
    },
  };
}

/* ---- live state and the public object ---- */
let ctx=null,G=null,eng=null,timer=0,held=false,sfxOn=true,musicOn=true,volume=1,sceneKey='',voices=[];
const want={biome:'menu',night:false,weather:'clear',danger:0},last={},warned={};
const BIOMES=['forest','dust','city','frost','gray','interior','map','menu'],WEATHERS=['clear','rain','storm','fog','heat','snow','spores'];
const wake=()=>{if(ctx&&!held&&ctx.state!=='running'&&ctx.state!=='closed'){try{const p=ctx.resume();p&&p.catch&&p.catch(noop)}catch(e){}}};
const sleep=()=>{try{const p=ctx.suspend();p&&p.catch&&p.catch(noop)}catch(e){}};
const tick=()=>{if(ctx&&eng&&ctx.state==='running')eng.run(ctx.currentTime+.3,ctx.currentTime)};
const rend=c=>new Promise(ok=>{c.oncomplete=e=>ok(e.renderedBuffer.getChannelData(0));const p=c.startRendering();p&&p.catch&&p.catch(noop)});

export const Snd={
  NAMES,SFX,
  init(){
    if(!AC)return false;
    try{
      if(!ctx){
        try{ctx=new AC({latencyHint:'interactive'})}catch(e){ctx=new AC()}
        R=prng(Date.now());G=graph(ctx);G.sfx.gain.value=sfxOn?SFX_BUS:0;G.music.gain.value=musicOn?MUSIC_BUS:0;G.master.gain.value=volume;
        eng=Engine(ctx,G.music,G.amb,prng(Date.now()^0x9e3779b9),1.2);eng.musicOn=musicOn;eng.set({...want},ctx.currentTime);
        const s=ctx.createBufferSource();s.buffer=ctx.createBuffer(1,1,ctx.sampleRate);s.connect(ctx.destination);s.start(0); // iOS: a buffer started inside the gesture unlocks output
        ctx.onstatechange=()=>{if(!document.hidden)wake()};                                                              // iOS drops to "interrupted" after calls and alarms
        document.addEventListener('visibilitychange',()=>{if(document.hidden)sleep();else wake()});
        for(const ev of['pointerdown','touchend','keydown'])W.addEventListener(ev,wake,{passive:true,capture:true});     // resume needs a gesture on Safari
        timer=setInterval(tick,100);
      }
      wake();tick();
    }catch(e){console.warn('Snd.init failed',e);return false}
    return true;
  },
  sfx(name,o){
    const f=SFX[name];
    if(!f){if(!warned[name]){warned[name]=1;console.warn('Snd.sfx: unknown sound "'+name+'"')}return}
    if(!ctx||!sfxOn||held||ctx.state==='closed'||W.document.hidden)return;
    try{
      const t=ctx.currentTime,dist=o&&o.dist||0,pan=o&&o.pan||0,a=1-dist/22;
      if(a<=0||t-(last[name]||-1)<.035)return;                    // out of earshot, or the same sound retriggered too fast
      if(voices.length>=24){voices=voices.filter(e=>e>t);if(voices.length>=24)return}
      last[name]=t;voices.push(t+f.dur);
      const g=ctx.createGain();let out=g;g.gain.value=(o&&o.vol!=null?o.vol:1)*a*a;
      if(dist>3){const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1600+16000*Math.pow(a,1.5);out.connect(lp);out=lp} // far sounds lose their top
      if(pan&&ctx.createStereoPanner){const p=ctx.createStereoPanner();p.pan.value=clamp(pan,-1,1);out.connect(p);out=p}
      out.connect(G.sfx);f(ctx,g,t+.004,o);
    }catch(e){}
  },
  setSfx(on){sfxOn=!!on;if(G)G.sfx.gain.setTargetAtTime(sfxOn?SFX_BUS:0,ctx.currentTime,.03)},
  setMusic(on){musicOn=!!on;if(G){G.music.gain.setTargetAtTime(musicOn?MUSIC_BUS:0,ctx.currentTime,.08);eng.musicOn=musicOn}},
  setVolume(v){volume=clamp(+v||0,0,1);if(G)G.master.gain.setTargetAtTime(volume,ctx.currentTime,.03)},
  scene(o){
    if(o){if(BIOMES.includes(o.biome))want.biome=o.biome;if(WEATHERS.includes(o.weather))want.weather=o.weather;if(o.night!=null)want.night=!!o.night;if(o.danger!=null)want.danger=Math.round(clamp(+o.danger||0,0,1)*20)/20}
    const key=want.biome+'|'+want.night+'|'+want.weather+'|'+want.danger;
    if(key===sceneKey||!eng)return;
    sceneKey=key;try{eng.set({...want},ctx.currentTime)}catch(e){}
  },
  duck(seconds=1){if(!G)return;const g=G.duck.gain,t=ctx.currentTime;try{(g.cancelAndHoldAtTime||g.cancelScheduledValues).call(g,t);g.setTargetAtTime(.25,t,.04);g.setTargetAtTime(1,t+Math.max(.1,seconds),.35)}catch(e){}},
  suspend(){held=true;if(ctx&&ctx.state==='running')sleep()},
  resume(){held=false;wake()},
  info(name){const f=SFX[name];return f?{group:f.group,dur:f.dur}:null},
  // offline: one sfx, dry, straight to the destination (mono). Same recipe function as the live path.
  render(name,seconds=1.5,sampleRate=22050){
    const f=SFX[name];if(!OAC||!f)return Promise.resolve(new Float32Array(0));
    const c=new OAC(1,Math.ceil(seconds*sampleRate),sampleRate);R=prng(1977);f(c,c.destination,0,{});return rend(c);
  },
  // offline: ambience + music for a scene through the full mixer. opts as scene(), plus music:false / amb:false to solo a layer.
  renderScene(opts,seconds=8,sampleRate=22050){
    if(!OAC)return Promise.resolve(new Float32Array(0));
    const c=new OAC(1,Math.ceil(seconds*sampleRate),sampleRate),g=graph(c),o=opts||{};R=prng(1977);
    const e=Engine(c,g.music,g.amb,prng(4242),.02,{music:o.music,amb:o.amb});
    e.set({biome:BIOMES.includes(o.biome)?o.biome:'menu',night:!!o.night,weather:WEATHERS.includes(o.weather)?o.weather:'clear',danger:clamp(+o.danger||0,0,1)},0);e.run(seconds,0);return rend(c);
  },
};

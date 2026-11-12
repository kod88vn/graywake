#!/usr/bin/env node
// Level check for the procedural audio. Renders every sfx and a set of ambience/music scenes offline in headless
// Chrome (through tools/soundboard.html) and prints peak / RMS levels. Nobody listens here: this only proves that
// each sound exists, does not clip and sits in the same loudness window as its neighbours.
// Usage: node tests/audio.mjs [substring filter]
//   peak  highest sample, dBFS
//   rms   RMS over the audible span (first to last sample above -60 dBFS)
//   loud  RMS of the loudest 100 ms window: the figure compared against the group median, because a 30 ms tick
//         and a 2 s roar cannot be compared over their whole length
//   len   audible span in ms (flagged if it overruns the duration the module declares for voice accounting)
// Flags: SILENT peak < -40 dB, CLIP peak > -0.3 dB, LOUD/QUIET loud more than 9 dB from the group median, LONG.
import {launch} from '../tools/lib.mjs';
const q=process.argv[2]||'',WINDOW=9,SILENT=-40,CLIP=-.3;

// 1. the module must load and stay silent without an AudioContext (Node)
const {Snd:N}=await import('../js/audio.js');
let nodeErr='';
const cw=console.warn;console.warn=()=>{};
try{if(N.init()!==false)throw new Error('init() should report false in Node');N.sfx('step',{vol:1,pan:.3,pitch:1.1,dist:4});N.sfx('no_such_sound');N.setSfx(false);N.setMusic(false);N.setVolume(.5);
  N.scene({biome:'forest',night:true,weather:'rain',danger:.5});N.duck(1);N.suspend();N.resume();await N.render('step');await N.renderScene({biome:'gray'})}catch(e){nodeErr=e.message}
console.warn=cw;

// 2. offline renders in the browser; the statistics are computed in the page so only numbers cross the wire
const SCENES=[];
for(const biome of['menu','map','forest','dust','city','frost','gray','interior']){
  SCENES.push({group:'music',o:{biome,amb:false}},{group:'music',o:{biome,night:true,amb:false}},{group:'ambience',o:{biome,music:false}},{group:'ambience',o:{biome,night:true,music:false}});
}
for(const weather of['rain','storm','fog','heat','snow','spores'])SCENES.push({group:'ambience',o:{biome:'forest',weather,music:false}});
SCENES.push({group:'ambience',o:{biome:'interior',weather:'storm',music:false}},{group:'ambience',o:{biome:'frost',weather:'snow',night:true,music:false}});
for(const danger of[.2,.5,.8,1])SCENES.push({group:'tension',o:{biome:'forest',danger,amb:false}});
for(const o of[{biome:'forest'},{biome:'gray',night:true,weather:'spores'},{biome:'city',weather:'storm',danger:1},{biome:'frost',weather:'snow',danger:.5}])SCENES.push({group:'full mix',o});

const page=await launch({pathName:'/tools/soundboard.html',quiet:true});
let rows=[],live={},repeat=false;
try{
  for(let i=0;i<50&&!(await page.eval('!!(window.SOUNDBOARD&&SOUNDBOARD.ready)'));i++)await page.sleep(100);
  const out=JSON.parse(await page.eval(`(async()=>{
    const db=v=>v>1e-9?20*Math.log10(v):-180,SR=44100;
    const stat=a=>{let peak=0,first=-1,end=0,dc=0;for(let i=0;i<a.length;i++){const v=Math.abs(a[i]);dc+=a[i];if(v>peak)peak=v;if(v>.001){if(first<0)first=i;end=i}}
      let s=0;for(let i=Math.max(first,0);i<=end;i++)s+=a[i]*a[i];const rms=first<0?0:Math.sqrt(s/(end-first+1));
      const w=SR*.1|0,hop=SR*.01|0;let best=0;const pre=new Float64Array(a.length+1);for(let i=0;i<a.length;i++)pre[i+1]=pre[i]+a[i]*a[i];
      for(let i=0;i+w<=a.length;i+=hop){const e=(pre[i+w]-pre[i])/w;if(e>best)best=e}
      return{peak:db(peak),rms:db(rms),loud:db(Math.sqrt(best)),len:first<0?0:Math.round((end+1)/SR*1000),dc:db(Math.abs(dc/a.length))}};
    const rows=[];
    for(const name of Snd.NAMES.filter(n=>n.includes(${JSON.stringify(q)}))){const i=Snd.info(name);rows.push({name,group:i.group,dur:i.dur,...stat(await Snd.render(name,Math.max(1.5,i.dur+.6),SR))})}
    for(const s of ${JSON.stringify(q?[]:SCENES)}){const o=s.o,name=[o.biome,o.night?'night':'',o.weather||'',o.danger?'danger '+o.danger:''].filter(Boolean).join(' ');
      rows.push({name,group:s.group,scene:1,...stat(await Snd.renderScene(o,8,SR))})}
    const a=await Snd.renderScene({biome:'forest',danger:.5},3,22050),b=await Snd.renderScene({biome:'forest',danger:.5},3,22050);let same=a.length===b.length&&a.length>0;for(let i=0;same&&i<a.length;i++)same=Math.abs(a[i]-b[i])<1e-5; // oscillators differ in the last float bit between runs
    return JSON.stringify({rows,same});
  })()`));
  rows=out.rows;repeat=out.same;
  // 3. the live path: start a real context and fire everything once to catch exceptions the offline path cannot
  live=JSON.parse(await page.eval(`(async()=>{
    const warns=[],w=console.warn;console.warn=(...a)=>{warns.push(a.join(' '))};
    Snd.sfx('step');Snd.scene({biome:'dust'});                       // before init: must be inert
    const ok=Snd.init();Snd.init();
    for(const n of Snd.NAMES){Snd.sfx(n,{vol:.5,pan:Math.random()*2-1,pitch:.9+Math.random()*.2,dist:Math.random()*20});await new Promise(r=>setTimeout(r,12))}
    Snd.sfx('bogus');Snd.sfx('bogus');for(let i=0;i<40;i++)Snd.sfx('shot_smg');
    for(const biome of['forest','dust','city','frost','gray','interior','map','menu'])for(const weather of['clear','storm','snow']){Snd.scene({biome,weather,night:Math.random()<.5,danger:Math.random()});await new Promise(r=>setTimeout(r,60))}
    Snd.setMusic(false);Snd.setSfx(false);Snd.setMusic(true);Snd.setSfx(true);Snd.setVolume(.7);Snd.duck(.5);Snd.suspend();Snd.resume();
    await new Promise(r=>setTimeout(r,700));console.warn=w;
    return JSON.stringify({ok,warns});
  })()`));
}finally{await page.close()}

// report
const med=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const f=v=>(v<=-120?'-inf':v.toFixed(1)).padStart(7),groups=[...new Set(rows.map(r=>r.group))];
let bad=0;
console.log('\n== audio levels (dBFS; sfx dry at unity, scenes through the mixer and limiter)\n');
console.log('  '+'name'.padEnd(30)+'   peak    rms   loud   Δmed    len');
for(const g of groups){
  const rs=rows.filter(r=>r.group===g),m=med(rs.map(r=>r.loud));
  console.log(`\n  -- ${g} (${rs.length}, median loud ${m.toFixed(1)} dB)`);
  for(const r of rs){
    const flags=[];
    if(r.peak<SILENT)flags.push('SILENT');if(r.peak>CLIP)flags.push('CLIP');
    if(r.loud-m>WINDOW)flags.push('LOUD');if(r.loud-m<-WINDOW)flags.push('QUIET');
    if(!r.scene&&r.len>r.dur*1000+60)flags.push(`LONG(>${r.dur*1000|0}ms)`);
    if(r.dc>-40)flags.push('DC');
    if(flags.length)bad++;
    console.log('  '+r.name.padEnd(30)+f(r.peak)+f(r.rms)+f(r.loud)+f(r.loud-m)+String(r.scene?'':r.len).padStart(7)+(flags.length?'  << '+flags.join(' '):''));
  }
}
console.log('');
const check=(ok,msg)=>{console.log((ok?'  ok   ':'  FAIL ')+msg);if(!ok)bad++};
check(!nodeErr,'module is inert without an AudioContext (Node)'+(nodeErr?': '+nodeErr:''));
if(!q){check(rows.filter(r=>!r.scene).length===N.NAMES.length&&N.NAMES.length===56,`all ${N.NAMES.length} sfx rendered`);check(repeat,'scene renders are repeatable (seeded; within 1e-5)')}
check(live.ok===true,'live AudioContext starts');
check((live.warns||[]).length===1&&/bogus/.test(live.warns[0]),'unknown sfx warns exactly once: '+JSON.stringify(live.warns));
check(!page.errors.length,'no page errors'+(page.errors.length?': '+page.errors.join(' | '):''));
console.log(bad?`\n  ${bad} problem(s)`:'\n  passed');
process.exitCode=bad?1:0;

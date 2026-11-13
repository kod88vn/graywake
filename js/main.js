// Boot and main loop: wires the simulation to the renderer, the interface, input and sound.
import {G,VERSION,SAVE_V} from './sim/core.js';
import * as World from './sim/world.js';
import {threatNear} from './sim/actors.js';
import {BIOMES} from './data/world.js';
import {View} from './view/render.js';
import {UI} from './ui/ui.js';
import {Input} from './input.js';
import {Snd} from './audio.js';

const KEY='graywake.save.v1';
// a save about to be converted to a newer format is first copied aside, once per old format, under KEY + '.format' + its number
const keepOld=raw=>{try{const v=JSON.parse(raw).v;if(v<SAVE_V&&!localStorage.getItem(KEY+'.format'+v))localStorage.setItem(KEY+'.format'+v,raw)}catch(e){}};
const store={get(){try{return localStorage.getItem(KEY)}catch(e){return null}},set(v){try{localStorage.setItem(KEY,v);return true}catch(e){return false}},del(){try{localStorage.removeItem(KEY)}catch(e){}}};
function save(){if(!G.S||G.mode==='menu')return false;const s=World.serialize();return s?store.set(s):false}
function applySettings(){const s=G.S.set;Snd.setMusic(!!s.music);Snd.setSfx(!!s.sfx);Snd.setVolume(s.vol);View.setQuality(s.quality||'auto')}
const api={
  hasSave:()=>!!store.get(),
  newGame(){G.ev.length=0;World.newGame();applySettings();begin()},
  continueGame(){try{const raw=store.get();keepOld(raw);const S=World.deserialize(raw);G.ev.length=0;World.resume(S);applySettings();begin();return true}catch(e){console.error(e);UI.toast('That save could not be read: '+e.message,'bad');return false}},
  save,applySettings,
  exportSave:()=>{save();return store.get()||''},
  importSave(str){try{const S=World.deserialize(str.trim());store.set(str.trim());G.ev.length=0;World.resume(S);applySettings();begin();return true}catch(e){UI.toast('Not a valid save: '+e.message,'bad');return false}},
  wipe(){store.del()},
  toTitle(){save();G.mode='menu';G.Z=null;G.paused=false;View.setZone(null);UI.title()},
};
function begin(){G.paused=false;UI.start();Snd.init()}

function drain(){
  const ev=G.ev;if(!ev.length)return;const list=ev.splice(0,ev.length),p=G.Z&&G.Z.pl;
  for(const e of list){const t=e[0];
    if(t==='zone'){View.setZone(G.Z);UI.zone()}
    else if(t==='save')save();
    else if(t==='sfx'){const o=Object.assign({},e[4]);if(p&&e[2]!==undefined){const dx=e[2]-p.x,dy=e[3]-p.y;o.dist=Math.hypot(dx,dy);o.pan=Math.max(-1,Math.min(1,dx/12))}Snd.sfx(e[1],o)}
    else if(t==='obj'||t==='edge'||t==='floor'||t==='fx'||t==='shake'||t==='eq'||t==='veh'||t==='zoneDirty'){View.onEvent(e);if(t==='eq'||t==='obj')UI.dirty()}
    else UI.onEvent(e)}
}
let last=0,sceneT=0;
function loop(ts){
  requestAnimationFrame(loop);const dt=Math.min(.25,(ts-last)/1000||0);last=ts;
  Input.frame();
  if(G.mode==='play'&&G.Z){
    // the simulation keeps real time whatever the frame rate: a slow frame is split into steps of at most 1/30 s
    if(!G.paused){const n=Math.max(1,Math.ceil(dt*30)),h=dt/n;for(let i=0;i<n&&G.Z&&!G.paused&&G.mode==='play';i++)World.tick(h)}
    drain();
    if(G.Z&&G.mode==='play'){View.frame(G.paused?0:dt);UI.frame(dt)}
  }else drain();
  sceneT-=dt;if(sceneT<=0){sceneT=1;const S=G.S,Z=G.Z;
    if(G.mode==='menu')Snd.scene({biome:'menu',night:false,weather:'clear',danger:0});
    else if(!Z)Snd.scene({biome:'map',night:World.isNight(S.t),weather:'clear',danger:0});
    else{const w=S.weather.id;Snd.scene({biome:Z.dark?'interior':(BIOMES[Z.biome]||BIOMES.forest).snd,night:G.night,weather:w==='overcast'?'clear':w,danger:S.tide.live?1:Z.pl&&!Z.pl.dead&&threatNear(Z,12)?.55:0})}}
}
function boot(){
  const cv=document.getElementById('cv');
  try{View.init(cv,'auto')}catch(e){console.error(e);document.querySelector('#title .in').innerHTML='<h1>Gray<i>wake</i></h1><p>This browser could not start WebGL, which the game needs to draw its world. Try a current version of Chrome, Safari, Firefox or Edge with hardware acceleration switched on.</p>';return}
  UI.init(api);
  Input.init({hot:k=>UI.hot(k),build:(t,x,y,d)=>UI.buildPointer(t,x,y,d),gesture:()=>Snd.init()});
  addEventListener('resize',()=>{View.resize();UI.resize()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){save();Snd.suspend()}else Snd.resume()});
  addEventListener('pagehide',save);
  document.addEventListener('pointerdown',()=>Snd.init(),{once:true});
  if(window.claude&&window.claude.hot&&window.claude.hot.snapshot)try{window.claude.hot.snapshot(()=>{save();return{}})}catch(e){}
  window.GW={G,World,View,UI,Snd,api,VERSION};
  UI.title();requestAnimationFrame(loop);
}
boot();

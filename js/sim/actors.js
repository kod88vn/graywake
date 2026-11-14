// Everything that moves and fights inside a zone: the player, creatures, allies, projectiles, traps and turrets.
// Pure logic. step(dt) advances one frame; the view reads Z.actors / Z.projs / Z.areas / Z.drops afterwards.
import {ITEMS} from '../data/items.js';
import {OBJ} from '../data/objects.js';
import {sourcesOf} from '../data/sources.js';
import {FIND} from '../data/world.js';
import {WEATHER} from '../data/events.js';
import {ENEMIES,scale} from '../data/enemies.js';
import {G,gained,homeStores,emit,toast,sfx,stat,statMax,derive,perk,weaponDef,weaponItem,count,take,give,addTo,slotCount,freeSlots,roomFor,wear,findTool,wearTool,dropAt,addXp,maxHp,FIST,quickUse,EREF,edgeIdx,structAt,structXY} from './core.js';
import {collide,los,shotBlock,blockAt,playerField,field,stepOn,rollLoot,freeNear,atExit,edgeCross,edgeBetween,walkClear,pathAim} from './zone.js';
import {noteKill} from './quests.js';
import {clamp,dist,angDiff,rnd,TAU,hourOf} from './util.js';

const TOOL_NAMES={axe:'hatchet',pick:'pickaxe',rod:'fishing rod',wrench:'wrench',pry:'crowbar'},TIER_NAMES=['','','an iron','a steel','a titanium'];
const SHOT_SFX={pistol:'shot_pistol',smg:'shot_smg',rifle:'shot_rifle',carbine:'shot_rifle',sniper:'shot_rifle',minigun:'shot_smg',shotgun:'shot_shotgun',bow:'bow',crossbow:'bow',flamer:'flame',launcher:'throw',lance:'beam'};

// ---------------------------------------------------------------- spawning
export function spawnActor(Z,kind,x,y,lvl,opts){
  const def=ENEMIES[kind];if(!def)return null;const sc=scale(kind,lvl||Z.lvl,G.S?G.S.mut:0);
  const a={id:++Z.uid,kind,def,x,y,a:rnd()*TAU,r:def.r,hp:sc.hp,mhp:sc.hp,dmg:sc.dmg,xp:sc.xp,lvl:lvl||Z.lvl,team:def.ally?0:1,st:'idle',t:rnd()*3,cd:rnd(),hx:x,hy:y,
    alert:false,pt:rnd()*.3,kx:0,ky:0,stunT:0,slowT:0,burnT:0,bleedT:0,dot:0,flash:0,trapT:0,atkT:0,mv:0,vis:1,dead:false,deadT:0};
  if(def.abil)a.ab=def.abil.map(b=>b.cd*(.4+rnd()*.5));
  if(def.charge)a.chCd=def.charge.cd*rnd();if(def.call)a.callCd=2+rnd()*3;
  if(opts)Object.assign(a,opts);Z.actors.push(a);return a;
}
export function spawnPlayer(Z,x,y){
  const p={id:0,pl:true,kind:'player',team:0,x,y,a:-Math.PI/2,r:.3,cd:0,atk:null,roll:null,rollCd:0,iframe:0,slowT:0,hurtT:0,sneak:false,act:null,mv:0,stepT:0,frac:0,dead:false,auto:null,noAmmoT:0,vis:1};
  Z.pl=p;Z.actors.unshift(p);return p;
}
/** Create the creatures a generated zone asked for. Night-only ones wait for dark. */
export function populate(Z,night){
  for(const s of Z.spawns){if(s.done)continue;if(s.night&&!night)continue;if(ENEMIES[s.k].night&&!night&&!Z.dark)continue;s.done=true;spawnActor(Z,s.k,s.x,s.y,Z.lvl,s.boss?{boss:true}:null)}
}
export const enemiesAlive=Z=>{let n=0;for(const a of Z.actors)if(a.team===1&&!a.dead&&a.def.ai!=='flee')n++;return n};
export const threatNear=(Z,r=9)=>{const p=Z.pl;for(const a of Z.actors)if(a.team===1&&!a.dead&&a.alert&&a.def.ai!=='flee'&&dist(a.x,a.y,p.x,p.y)<r)return true;return false};

// ---------------------------------------------------------------- damage
export function alertActor(Z,e,quiet){
  if(e.alert||e.dead||e.team!==1)return;e.alert=true;e.lose=0;if(e.def.ai==='flee')return;e.st='chase';
  if(!quiet)sfx(e.def.rig[0]==='quad'?(e.kind==='boar'?'boar':e.kind==='bear'?'bear':'wolf'):e.def.boss?'roar':'growl',e.x,e.y);
  if(e.def.pack||e.def.human)for(const o of Z.actors)if(o!==e&&o.team===1&&!o.alert&&!o.dead&&dist(o.x,o.y,e.x,e.y)<7)alertActor(Z,o,true);
}
export function noise(Z,x,y,r){if(r>0)for(const e of Z.actors)if(e.team===1&&!e.alert&&!e.dead&&dist(e.x,e.y,x,y)<r)alertActor(Z,e,true)}
/** Damage a creature. o: {crit, kb, kx, ky, stun, bleed, burn, dot, pierce} */
export function hurt(Z,e,dmg,o={}){
  if(e.dead)return;if(e.pl)return hurtPlayer(Z,dmg,o);
  if(!o.dot&&e.def.arm&&!o.sneak)dmg*=1-e.def.arm*(o.pierce?.5:1);
  dmg=Math.max(1,Math.round(dmg));e.hp-=dmg;e.flash=.12;e.vis=1;
  if(!o.dot){emit('hit',e.x,e.y,dmg,o.crit?1:0,0);if(!o.quiet)sfx(e.def.arm?'hit_metal':'hit_flesh',e.x,e.y);emit('fx','blood',e.x,e.y,e.def.rig[1].skin||e.def.rig[1].c)}
  if(e.team===1)alertActor(Z,e,true);
  const boss=e.def.boss;
  if(o.kb&&!boss&&!e.def.rooted){e.kx+=(o.kx||0)*o.kb;e.ky+=(o.ky||0)*o.kb}
  if(o.stagger&&!boss&&e.st!=='charge'&&e.st!=='fuse'){e.stunT=Math.max(e.stunT,o.stagger);if(e.st==='wind'||e.st==='windS'){e.st='chase';e.cd=Math.max(e.cd,.25)}}
  if(o.stun)e.stunT=Math.max(e.stunT,boss?o.stun*.25:o.stun);
  if(o.bleed){e.bleedT=4;e.bleed=Math.max(e.bleed||0,o.bleed)}
  if(o.burn){e.burnT=Math.max(e.burnT,o.burn);e.burnD=Math.max(e.burnD||0,o.burnD||6)}
  if(o.slow)e.slowT=Math.max(e.slowT,o.slow);
  if(e.hp<=0)kill(Z,e);
}
export function kill(Z,e){
  if(e.dead)return;e.dead=true;e.deadT=0;e.hp=0;const S=G.S,def=e.def;
  if(e.sv&&S){const sv=S.surv.find(s=>s.id===e.sv);if(sv){sv.hurt=3;toast(sv.n+' is down. They will be carried home and laid up for three days','bad')}}
  if(e.team===1){
    addXp(S,e.xp);stat('kills');stat('k_'+e.kind);S.codex.en[e.kind]=(S.codex.en[e.kind]||0)+1;noteKill(e.kind);
    if(def.boss&&Z.def&&Z.def.lead){toast('The keys were on it: the strongroom is open','good');sfx('quest');stat('guardians')}
    if(def.boss&&!def.rescale){stat('bosses');if(S.codex.en[e.kind]===1)stat('bossKinds');toast(def.n+' is dead','good');sfx('quest')}
    const items=[],animal=def.rig[0]==='quad',mult=animal?1+G.ds.butcher:1;
    for(const[id,a,b,ch]of def.drop||[])if(rnd()<(ch||1)){let n=a+Math.floor(rnd()*(b-a+1));if(animal&&mult>1)n=Math.round(n*mult+rnd()*.5);if(n>0){const it={id,n};if(ITEMS[id].dur)it.d=Math.round(ITEMS[id].dur*(.4+rnd()*.5));items.push(it)}}
    if(!animal&&!def.boss&&rnd()<.04+Z.lt*.01)items.push({id:'old_coin',n:1});
    if(items.length)dropAt(Z,e.x,e.y,items);
    if(def.explode)Z.areas.push({kind:'fuse',x:e.x,y:e.y,r:def.explode.r,t:.35,T:.35,dmg:e.dmg*def.explode.dmg/def.dmg,tox:def.explode.tox,team:1,src:e.id});
  }
  sfx(def.explode?'splat':'death',e.x,e.y,{vol:.5});emit('fx','die',e.x,e.y);
}
export function hurtPlayer(Z,dmg,o={}){
  if(!o.dot)Z.lastHarm=Z.time;   // (a blow, not poison already in the blood: that is no sign the tide is still pressing)
  const S=G.S,p=Z.pl,ds=G.ds;if(p.dead||p.iframe>0&&!o.dot)return;
  if(!o.dot)dmg*=(1-ds.armRed);dmg*=ds.taken;dmg=Math.max(1,Math.round(dmg));
  S.p.hp-=dmg;p.hurtT=.35;p.act=null;
  emit('hit',p.x,p.y,dmg,0,1);
  if(!o.dot){sfx('hurt');emit('shake',Math.min(.5,.12+dmg/120));emit('fx','blood',p.x,p.y,'#b02a2a');
    const slots=['head','body','legs','feet','hands'].filter(s=>S.p.eq[s]);if(slots.length)wear(S,slots[Math.floor(rnd()*slots.length)],1);
    if(o.kb&&!ds.steady){p.kx=(o.kx||0)*o.kb;p.ky=(o.ky||0)*o.kb}}
  if(o.tox)S.p.tox=clamp(S.p.tox+o.tox*(1-ds.tox),0,100);
  if(o.slow)p.slowT=Math.max(p.slowT,o.slow);
  if(G.auto&&!o.dot){p.auto=null;p.alarm=Z.time}
  if(S.p.hp<=0){S.p.hp=0;p.dead=true;p.act=null;p.atk=null;sfx('death');emit('fx','die',p.x,p.y);if(G.hooks.die)G.hooks.die()}
}
/** Hurt a structure. `i` is a tile index, or EREF + edge for a wall or door. True if it was destroyed. */
export function damageObj(Z,i,dmg){
  const o=structAt(Z,i);if(!o||!(o.hp>0))return false;o.hp-=dmg;Z.lastHarm=Z.time;const[x,y]=structXY(Z,i);
  if(o.hp>0){o.hit=Z.time;emit('fx','wood',x,y);if(i>=EREF)emit('edge',i-EREF);return false}
  if(Z.tideGone)Z.tideGone.push(OBJ[o.k]?OBJ[o.k].n:o.k);
  // said as it happens (at most every few seconds), in a tide or out of one (a raid, a bear), so a gap in the wall is known while there is time to mend it
  if(Z.home&&OBJ[o.k]&&OBJ[o.k].cost&&!(Z.time-(Z.goneSaid||-9)<3)){Z.goneSaid=Z.time;toast(OBJ[o.k].n+' broken at ('+Math.floor(x)+', '+Math.floor(y)+')','bad')}
  if(i>=EREF){Z.ed[i-EREF]=null;Z.touchEdge(i-EREF);sfx('break',x,y);emit('fx','dust',x,y);emit('shake',.15);stat('lostWalls');if(Z.tideLost!==undefined)Z.tideLost++;return true}
  const d=OBJ[o.k];if(o.inv)dropAt(Z,x,y,o.inv.filter(Boolean));
  Z.obj[i]=null;Z.touch(i);sfx('break',x,y);emit('fx','dust',x,y);emit('shake',.15);stat('lostWalls');if(Z.tideLost!==undefined)Z.tideLost++;return true;
}
/** Damage every wall whose middle lies within r of a blast. */
function blastEdges(Z,x,y,r,dmg){if(!Z.ed.length)return;for(let ty=Math.floor(y-r);ty<=Math.floor(y+r)+1;ty++)for(let tx=Math.floor(x-r);tx<=Math.floor(x+r)+1;tx++){if(tx<0||ty<0||tx>=Z.w||ty>=Z.h)continue;const e=(ty*Z.w+tx)*2;if(Z.ed[e]&&dist(tx+.5,ty,x,y)<r)damageObj(Z,EREF+e,dmg);if(Z.ed[e+1]&&dist(tx,ty+.5,x,y)<r)damageObj(Z,EREF+e+1,dmg)}}
export function explode(Z,x,y,r,dmg,team,o={}){
  emit('fx',o.tox&&!o.fire?'toxburst':'explode',x,y,r);sfx(o.soft?'splat':'explosion',x,y);emit('shake',Math.min(.6,r*.12));noise(Z,x,y,r*(o.soft?2:5));   // a wet burst carries a couple of rooms; a blast wakes the block
  for(const a of Z.actors){if(a.dead)continue;const hostile=team===0?a.team===1:(a.team===0);if(!hostile&&!(team===1&&a.team===1&&o.src!==a.id&&a.def.explode))continue;
    const d=dist(a.x,a.y,x,y)-a.r;if(d>r)continue;const f=1-.5*clamp(d/r,0,1),ang=Math.atan2(a.y-y,a.x-x);
    hurt(Z,a,dmg*f,{kb:4,kx:Math.cos(ang),ky:Math.sin(ang),tox:o.tox,burn:o.burn,burnD:o.burnD,stun:o.stun,quiet:1})}
  if(team===1&&Z.home){const x0=Math.floor(x-r),x1=Math.floor(x+r),y0=Math.floor(y-r),y1=Math.floor(y+r);for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++)if(tx>=0&&ty>=0&&tx<Z.w&&ty<Z.h&&dist(tx+.5,ty+.5,x,y)<r)damageObj(Z,ty*Z.w+tx,dmg*.6);blastEdges(Z,x,y,r,dmg*.6)}
  if(o.burn&&o.fire)Z.areas.push({kind:'fire',x,y,r,t:o.burn,T:o.burn,dmg:o.burnD||8,team,tick:0});
  if(o.tox&&team===1)Z.areas.push({kind:'tox',x,y,r,t:5,T:5,dmg:0,tox:o.tox*.25,team,tick:0});
}

// ---------------------------------------------------------------- projectiles
export function shoot(Z,x,y,ang,o){
  const p={id:++Z.uid,x,y,vx:Math.cos(ang)*o.spd,vy:Math.sin(ang)*o.spd,a:ang,team:o.team,dmg:o.dmg,life:o.rng/o.spd,kind:o.kind||'bullet',pierce:o.pierce||0,hit:null,tox:o.tox,burn:o.burn,slow:o.slow,kb:o.kb||0,crit:o.crit,src:o.src,over:o.over};
  Z.projs.push(p);return p;
}
export function lob(Z,x,y,tx,ty,o){
  const d=dist(x,y,tx,ty),T=Math.max(.35,d/(o.spd||11))+(o.fuse||0);
  Z.projs.push({id:++Z.uid,x,y,sx:x,sy:y,tx,ty,t:0,T,lob:true,kind:o.kind||'nade',team:o.team,dmg:o.dmg,aoe:o.aoe,burn:o.burn,fire:o.fire,lure:o.lure,tox:o.tox,a:Math.atan2(ty-y,tx-x)});
  if(o.team===1)Z.areas.push({kind:'tele',x:tx,y:ty,r:o.aoe,t:T,T,team:1,dmg:0});
}
function stepProjs(Z,dt){
  const P=Z.projs;
  for(let i=P.length-1;i>=0;i--){const p=P[i];
    if(p.lob){p.t+=dt;const f=Math.min(1,p.t/p.T);p.x=p.sx+(p.tx-p.sx)*f;p.y=p.sy+(p.ty-p.sy)*f;p.h=Math.sin(f*Math.PI)*2.2;
      if(f>=1){P.splice(i,1);if(p.lure){Z.lure={x:p.tx,y:p.ty,t:p.lure,r:p.aoe};sfx('warning',p.tx,p.ty,{vol:.4});emit('fx','ring',p.tx,p.ty,p.aoe)}else explode(Z,p.tx,p.ty,p.aoe,p.dmg,p.team,{burn:p.burn,fire:p.fire||!!p.burn,burnD:p.dmg*.35,tox:p.tox})}
      continue}
    const steps=Math.max(1,Math.ceil(Math.hypot(p.vx,p.vy)*dt/.35));let gone=false;
    for(let s=0;s<steps&&!gone;s++){
      const px=p.x,py=p.y;p.x+=p.vx*dt/steps;p.y+=p.vy*dt/steps;
      const ec=p.over?-1:edgeCross(Z,px,py,p.x,p.y);if(ec>=0){gone=true;emit('fx',p.kind==='flame'?'fire':'spark',p.x,p.y);if(p.team===1&&Z.home)damageObj(Z,EREF+ec,p.dmg*.3);break}
      const b=shotBlock(Z,p.x,p.y);
      if(b!==-1){gone=true;if(b>=0){emit('fx',p.kind==='flame'?'fire':'spark',p.x,p.y);if(p.team===1&&Z.home)damageObj(Z,b,p.dmg*.3)}break}
      for(const a of Z.actors){if(a.dead||a.team===p.team||(p.team===0&&a.team===0)||(p.team===1&&a.team!==0))continue;if(p.hit&&p.hit.includes(a.id))continue;
        if(dist(a.x,a.y,p.x,p.y)<a.r+.18){
          hurt(Z,a,p.dmg,{crit:p.crit,kb:p.kb,kx:Math.cos(p.a),ky:Math.sin(p.a),tox:p.tox,burn:p.burn,burnD:p.dmg*.5,slow:p.slow,pierce:p.pierce>0,quiet:p.kind==='flame'});
          if(p.kind==='spit')emit('fx','tox',p.x,p.y);
          if(p.pierce>0){p.pierce--;(p.hit=p.hit||[]).push(a.id)}else{gone=true;break}}}
    }
    p.life-=dt;if(gone||p.life<=0)P.splice(i,1);
  }
}
function stepAreas(Z,dt){
  const A=Z.areas;
  for(let i=A.length-1;i>=0;i--){const ar=A[i];ar.t-=dt;
    if(ar.kind==='fire'||ar.kind==='tox'){ar.tick-=dt;if(ar.tick<=0){ar.tick=.5;
      for(const a of Z.actors){if(a.dead||dist(a.x,a.y,ar.x,ar.y)>ar.r+a.r)continue;
        if(ar.kind==='fire'){if(a.team===1||ar.team===1)hurt(Z,a,ar.dmg*.5,{dot:1,burn:1.5,burnD:ar.dmg})}
        else if(a.pl)hurtPlayer(Z,0.01,{dot:1,tox:ar.tox})}}}
    if(ar.t<=0){A.splice(i,1);
      if(ar.kind==='fuse')explode(Z,ar.x,ar.y,ar.r,ar.dmg,1,{tox:ar.tox,soft:1,src:ar.src});
      else if(ar.kind==='tele'&&ar.dmg>0){emit('fx','slam',ar.x,ar.y,ar.r);sfx('explosion',ar.x,ar.y,{vol:.7});emit('shake',.3);
        for(const a of Z.actors){if(a.dead||a.team!==0)continue;if(dist(a.x,a.y,ar.x,ar.y)<ar.r+a.r*.5){const ang=Math.atan2(a.y-ar.y,a.x-ar.x);hurt(Z,a,ar.dmg,{kb:6,kx:Math.cos(ang),ky:Math.sin(ang),tox:ar.tox,slow:ar.slow})}}
        if(Z.home){const r=ar.r;for(let ty=Math.floor(ar.y-r);ty<=Math.floor(ar.y+r);ty++)for(let tx=Math.floor(ar.x-r);tx<=Math.floor(ar.x+r);tx++)if(tx>=0&&ty>=0&&tx<Z.w&&ty<Z.h&&dist(tx+.5,ty+.5,ar.x,ar.y)<r)damageObj(Z,ty*Z.w+tx,ar.dmg*(ar.sd||1));blastEdges(Z,ar.x,ar.y,r,ar.dmg*(ar.sd||1))}}
    }
  }
  if(Z.lure){Z.lure.t-=dt;if(Z.lure.t<=0)Z.lure=null}
}

// ---------------------------------------------------------------- player: attacking
function nearestEnemy(Z,x,y,range,needLos=true,face=null){
  let best=null,bs=1e9;
  for(const e of Z.actors){if(e.dead||e.team!==1)continue;const d=dist(e.x,e.y,x,y)-e.r;if(d>range)continue;if(needLos&&!los(Z,x,y,e.x,e.y))continue;
    let s=d;if(face!==null)s+=Math.abs(angDiff(Math.atan2(e.y-y,e.x-x),face))*1.2;if(e.def.ai==='flee')s+=3;if(s<bs){bs=s;best=e}}
  return best;
}
function attackDir(Z,p,range){
  const inp=G.inp;if(inp.aim)return Math.atan2(inp.aim.y-p.y,inp.aim.x-p.x);
  const e=nearestEnemy(Z,p.x,p.y,range,true,p.a);if(e){p.tgt=e;return Math.atan2(e.y-p.y,e.x-p.x)}
  const ml=Math.hypot(inp.mx,inp.my);return ml>.2?Math.atan2(inp.my,inp.mx):p.a;
}
function tryAttack(Z,p){
  const S=G.S,ds=G.ds,w=weaponDef(S),slot=S.p.active;if(p.cd>0||p.atk||p.roll)return;
  p.act=null;const spd=w.spd/ds.haste;
  if(w.t==='gun'){
    if(count(S,w.ammo)<1){if(p.noAmmoT<=0){toast('Out of '+ITEMS[w.ammo].n,'bad');sfx('error');p.noAmmoT=1.5}return meleeSwing(Z,p,FIST,spd)}
    const ang=attackDir(Z,p,w.rng);p.a=ang;p.cd=spd;p.buf=0;p.faceT=.45;p.recoil=.12;
    const n=w.pellets||1,mx=p.x+Math.cos(ang)*.5,my=p.y+Math.sin(ang)*.5;
    for(let k=0;k<n;k++){const crit=rnd()<perk('crit'),sp=(w.spread||0)*Math.PI/180;
      shoot(Z,mx,my,ang+(rnd()-.5)*sp,{spd:w.proj==='arrow'?24:w.proj==='flame'?11:w.proj==='beam'?46:38,rng:w.rng,team:0,dmg:w.dmg*ds.ranged*(crit?2:1)*(p.sneakShot?1:1),kind:w.proj||'bullet',pierce:w.proj==='flame'?6:w.pierce||0,burn:w.burn,kb:w.kb?w.kb*.4:0,crit})}
    if(w.proj==='nade'){Z.projs.length-=1;const e=p.tgt&&!p.tgt.dead?p.tgt:null,inp=G.inp;let tx=inp.aim?inp.aim.x:e?e.x:p.x+Math.cos(ang)*w.rng*.7,ty=inp.aim?inp.aim.y:e?e.y:p.y+Math.sin(ang)*w.rng*.7;const d=dist(p.x,p.y,tx,ty);if(d>w.rng){tx=p.x+(tx-p.x)/d*w.rng;ty=p.y+(ty-p.y)/d*w.rng}lob(Z,mx,my,tx,ty,{team:0,dmg:w.dmg*ds.ranged,aoe:w.aoe,spd:16})}
    p.frac+=w.ammoPer||1;while(p.frac>=1){take(S,w.ammo,1);p.frac-=1}
    sfx(SHOT_SFX[w.mdl]||'shot_pistol',p.x,p.y);if(w.proj!=='flame'&&w.proj!=='arrow')emit('fx','muzzle',mx,my,ang);noise(Z,p.x,p.y,w.noise||0);wear(S,slot,1);return;
  }
  if(w.t==='throw'){
    const e=S.p.eq[slot],inp=G.inp,ang=attackDir(Z,p,w.rng);p.a=ang;const t=p.tgt&&!p.tgt.dead&&!inp.aim?p.tgt:null;
    let tx=inp.aim?inp.aim.x:t?t.x:p.x+Math.cos(ang)*w.rng*.6,ty=inp.aim?inp.aim.y:t?t.y:p.y+Math.sin(ang)*w.rng*.6;const d=dist(p.x,p.y,tx,ty);if(d>w.rng){tx=p.x+(tx-p.x)/d*w.rng;ty=p.y+(ty-p.y)/d*w.rng}
    lob(Z,p.x,p.y,tx,ty,{team:0,dmg:w.dmg*ds.ranged,aoe:w.aoe,burn:w.burn,fire:!!w.burn,fuse:w.fuse,lure:w.lure,kind:w.mdl});
    e.n=(e.n||1)-1;if(e.n<=0){S.p.eq[slot]=null;emit('eq')}p.cd=.7;p.buf=0;p.faceT=.45;p.atkT=.25;sfx('throw',p.x,p.y);stat('thrown');return;
  }
  meleeSwing(Z,p,w,spd);
}
/** Who a swing is meant for. With a cursor: the enemy nearest the line to the cursor, inside a forgiving cone (about 70° either side) or right under it,
 *  so a click somewhere near a thing in reach hits it and only a click the other way swings at air. Without one (touch, auto): the nearest in front. */
function meleeTarget(Z,p,range){
  const aim=G.inp.aim;if(!aim)return nearestEnemy(Z,p.x,p.y,range,true,p.a);
  const aa=Math.atan2(aim.y-p.y,aim.x-p.x);let best=null,bs=1.25;
  for(const e of Z.actors){if(e.dead||e.team!==1)continue;const d=dist(e.x,e.y,p.x,p.y)-e.r;if(d>range||edgeCross(Z,p.x,p.y,e.x,e.y)>=0)continue;
    let sc=Math.abs(angDiff(Math.atan2(e.y-p.y,e.x-p.x),aa));if(dist(e.x,e.y,aim.x,aim.y)<e.r+.45)sc=0;sc+=d*.06;if(sc<bs){bs=sc;best=e}}
  return best;
}
/** How much of a swing is wind-up before the blow lands: quick weapons snap, heavy ones take a moment, none drags. The renderer keys the swing to this. */
const hitTime=spd=>clamp(spd*.3,.12,.3);
function meleeSwing(Z,p,w,spd){
  const inp=G.inp,tg=meleeTarget(Z,p,w.rng+.9),ml=Math.hypot(inp.mx,inp.my);
  const ang=tg?Math.atan2(tg.y-p.y,tg.x-p.x):inp.aim?Math.atan2(inp.aim.y-p.y,inp.aim.x-p.x):ml>.2?Math.atan2(inp.my,inp.mx):p.a;
  if(tg)p.tgt=tg;p.a=ang;p.cd=spd;p.buf=0;p.atk={t:0,dur:spd,hitAt:hitTime(spd),done:false,w,tg};p.faceT=spd*.85+.25;
  // step into the blow when the target stands at the edge of reach or just past it (a short shove that dies away, the same way a knock-back does)
  if(tg){const gap=dist(tg.x,tg.y,p.x,p.y)-tg.r-w.rng*.9;if(gap>0){const v=6.2*Math.min(gap+.06,.7);p.kx=(p.kx||0)+Math.cos(ang)*v;p.ky=(p.ky||0)+Math.sin(ang)*v}}
  sfx('swing',p.x,p.y,{pitch:clamp(.7/spd,.7,1.6)});if(w.noise)noise(Z,p.x,p.y,w.noise);
}
function meleeHit(Z,p,w){
  const S=G.S,ds=G.ds,arc=(w.arc||80)*Math.PI/360,fx=w.fx||{},hits=[];
  for(const e of Z.actors){if(e.dead||e.team!==1)continue;const d=dist(e.x,e.y,p.x,p.y)-e.r;if(d>w.rng)continue;const da=Math.abs(angDiff(Math.atan2(e.y-p.y,e.x-p.x),p.a));if(da>arc&&d>.35)continue;if(edgeCross(Z,p.x,p.y,e.x,e.y)>=0)continue;hits.push([d,e])}
  hits.sort((a,b)=>a[0]-b[0]);if(!fx.cleave)hits.length=Math.min(hits.length,1);
  for(const h of hits){const e=h[1];let dmg=w.dmg*ds.melee,crit=rnd()<perk('crit'),sneak=false;if(crit){dmg*=2;h[2]=1}
    if(!e.alert&&e.def.ai!=='flee'){sneak=true;dmg*=2.5+(fx.sneak||0)+perk('sneak');stat('sneaks');crit=true}
    const ang=Math.atan2(e.y-p.y,e.x-p.x);hurt(Z,e,dmg,{crit,sneak,kb:(w.kb||1)+.6,kx:Math.cos(ang),ky:Math.sin(ang),stun:fx.stun,stagger:.22,bleed:fx.bleed?fx.bleed*ds.melee:0})}
  // a blow that lands holds the world for a few hundredths of a second: longer for a heavy weapon, a crit or a kill, and never more than an
  // eighth of the weapon's own rhythm (a chainsaw must not put the game into slow motion)
  if(hits.length){if(w!==FIST)wear(S,S.p.active,1);const heavy=clamp((w.spd-.3)/.9,0,1),big=hits.some(h=>h[1].dead||h[2]);
    emit('shake',.05+heavy*.07);Z.stop=Math.max(Z.stop||0,Math.min(.03+heavy*.04+(big?.02:0),w.spd*.12));return}
  // nothing alive in reach: tools still bite into trees and rock
  for(const r of[.6,1.05]){const tx=Math.floor(p.x+Math.cos(p.a)*r),ty=Math.floor(p.y+Math.sin(p.a)*r),i=ty*Z.w+tx,o=Z.obj[i];if(!o)continue;const d=OBJ[o.k];
    if(d.node&&d.node.tool&&w.tool===d.node.tool&&(w.tier||1)>=d.node.tier){nodeHit(Z,i,{it:w,ref:S.p.eq[S.p.active],where:S.p.active});return}
    if(d.solid){sfx(d.node&&d.node.tool==='axe'||d.k==='w_wood'?'hit_wood':'hit_stone',p.x,p.y,{vol:.6});emit('fx','spark',tx+.5,ty+.5);return}}
}

// ---------------------------------------------------------------- player: interacting
const GATHER_VERB={axe:'Chop',pick:'Mine',rod:'Fish',wrench:'Salvage'};
/** What pressing "interact" would do to the object on tile i: {type,label} or null. */
export function interactInfo(Z,i){
  const o=Z.obj[i];if(!o)return null;const d=OBJ[o.k];
  if(d.node){const lack=d.node.tool&&!findTool(G.S,d.node.tool,d.node.tier);return{type:'gather',label:(GATHER_VERB[d.node.tool]||(o.k==='pond'?'Fill':'Gather'))+(lack?' (needs '+(TIER_NAMES[d.node.tier]||'a')+' '+TOOL_NAMES[d.node.tool]+')':'')}}
  if(d.special==='deathbag')return{type:'loot',label:'Recover'};
  if(d.loot)return o.empty?null:{type:'loot',label:o.inv?'Search':d.lock&&!o.unlocked?(d.lock==='pry'?'Pry open':d.lock==='pick'?'Pick lock':d.lock==='guard'?(guardDown(Z)?'Open':Z.def&&Z.def.boss?'Locked: '+ENEMIES[Z.def.boss].n+' has the keys':'Barred until the place is clear'):'Unlock'):'Search'};
  if(d.special==='cage')return o.held?{type:'cage',label:'Free'}:null;
  if(!Z.home)return null;
  if(d.station)return{type:'station',label:o.out?'Collect':'Use'};
  if(d.store)return{type:'store',label:'Open'};
  if(d.bed)return{type:'bed',label:'Sleep'};
  if(d.turret)return{type:'turret',label:'Load'};
  if(d.special==='garden')return{type:'garden',label:!o.seed?'Plant':cropReady(o)?'Harvest':'Check'};
  if(d.special==='prod')return{type:'prod',label:o.stock>=1?'Collect':'Check'};
  if(['radio','generator','recycler','repair','trade','kennel','maptable','guard','beacon','tower','scarecrow'].includes(d.special))return{type:d.special,label:d.special==='generator'?'Fuel':d.special==='trade'?'Trade':'Use'};
  return null;
}
export const cropReady=o=>o.seed&&G.S.t>=o.ripe;
/** Is whoever guards this place's strongroom dead? With a boss: the boss. Without one: everything that was here. */
export const guardDown=Z=>Z.def&&Z.def.boss?!Z.spawns.some(s=>s.boss&&!s.done)&&!Z.actors.some(a=>!a.dead&&a.team===1&&a.def.boss):!!Z.cleared;
/** Is there a wall of yours between two points? Nothing is used, searched or gathered across one (a door is no bar: you walk through those). */
const walled=(Z,x0,y0,x1,y1)=>Z.ed.length>0&&edgeCross(Z,x0,y0,x1,y1,true)>=0;
export function findInteract(Z){
  const p=Z.pl,px=Math.floor(p.x),py=Math.floor(p.y);let best=null,bs=1e9;
  for(let ty=py-2;ty<=py+2;ty++)for(let tx=px-2;tx<=px+2;tx++){if(tx<0||ty<0||tx>=Z.w||ty>=Z.h)continue;const i=ty*Z.w+tx,info=interactInfo(Z,i);if(!info)continue;
    const d=dist(tx+.5,ty+.5,p.x,p.y);if(d>1.75||walled(Z,p.x,p.y,tx+.5,ty+.5))continue;// what you are standing on wins over what you happen to face; beyond that, nearer and more in front is better
    // a bed is something you lie down on, not something in the way of the box beside it: it wins only when nothing else is in reach (standing on a
    // bedroll beside a box, E still went to the bed: 0.10.46)
    const bed=OBJ[Z.obj[i].k].bed,s=(d<(bed?.4:.6)?d*.5:d+Math.abs(angDiff(Math.atan2(ty+.5-p.y,tx+.5-p.x),p.a))*.35)+(bed?1.6:0)+(info.type==='prod'&&info.label==='Check'&&d>=.4?.8:0);   // an empty snare or catcher only says 'nothing yet': it does not win over the bench beside it
    if(s<bs){bs=s;best={i,x:tx+.5,y:ty+.5,...info}}}
  if(!best||bs>1.2)for(const dr of Z.drops){const d=dist(dr.x,dr.y,p.x,p.y);if(d<1.3&&d<bs){bs=d;best={drop:dr,x:dr.x,y:dr.y,type:'drop',label:'Pick up'}}}
  return best;
}
/** Where the least tool that would do this job comes from (": made at a Workbench · found in Tool Chest"), or nothing if the tables do not say. */
function toolSource(tool,tier){
  let best=null;for(const id in ITEMS){const it=ITEMS[id];if(it.tool===tool&&(it.tier||0)>=(tier||0)&&(!best||(it.tier||0)<(ITEMS[best].tier||0)))best=id}
  const src=best?sourcesOf(best,2):'';return src?': '+src:'';
}
function toolFor(Z,i,quiet){
  const d=OBJ[Z.obj[i].k].node;if(!d.tool)return{it:null};const t=findTool(G.S,d.tool,d.tier);
  if(!t&&!quiet){toast('Needs '+(TIER_NAMES[d.tier]||'a')+' '+TOOL_NAMES[d.tool]+toolSource(d.tool,d.tier),'bad');sfx('error')}return t;
}
export function interact(Z,target){
  const S=G.S,p=Z.pl,t=target||findInteract(Z);if(!t||p.dead)return false;
  p.a=Math.atan2(t.y-p.y,t.x-p.x);
  if(t.type==='drop'){pickDrop(Z,t.drop,true);return true}
  const o=Z.obj[t.i],d=OBJ[o.k];
  if(t.type==='gather'){const tool=toolFor(Z,t.i);if(!tool)return false;const tier=tool.it?tool.it.tier:1;
    if(!d.node.give.some(g=>roomFor(S,g[0],1))){if(!G.auto||!p.fullT||Z.time-p.fullT>4){toast('Pack full: store or drop something first','bad');sfx('error')}p.fullT=Z.time;return false}
    p.act={type:'gather',i:t.i,t:0,dur:(d.node.tool?.62:.5)/(1+(tier-d.node.tier)*.15)/(d.node.tool==='axe'?1+perk('wood')*.5:1),tool:d.node.tool,mdl:tool.it?tool.it.mdl:''};return true}
  if(t.type==='loot'){
    if(d.lock&&!o.unlocked&&!o.inv){
      if(d.lock==='pry'){const tool=findTool(S,'pry');if(!tool){toast('Needs a crowbar','bad');sfx('error');return false}wearTool(S,tool,3);o.unlocked=1;sfx('break',t.x,t.y,{vol:.6});noise(Z,t.x,t.y,8)}
      else if(d.lock==='pick'){if(!take(S,'lockpick',1)){toast('Needs a lockpick','bad');sfx('error');return false}
        if(rnd()<.5+perk('lock')*.5+.0){o.unlocked=1;sfx('door',t.x,t.y)}else{toast('The pick snaps','bad');sfx('trap_snap',t.x,t.y,{vol:.5});return false}}
      else if(d.lock==='guard'){if(!guardDown(Z)){const b=Z.def&&Z.def.boss&&ENEMIES[Z.def.boss];const left=enemiesAlive(Z)+Z.spawns.filter(s=>!s.done&&!s.night).length;toast(b?'Locked. '+b.n+' carries the keys':'Barred from inside: it opens when the place is clear. '+left+' of the garrison still alive (red on the minimap)','bad');sfx('error');return false}o.unlocked=1;sfx('door',t.x,t.y);
        // in a shared world this is the deed the others are racing for: it is reported the next time the game talks to the world
        {const st=Z.site&&S.sites.find(x=>x.id===Z.site);if(st&&st.wid&&!S.deeds.leads.includes(st.wid))S.deeds.leads.push(st.wid)}}
      else{if(count(S,d.lock)<1){toast('Locked. Needs '+ITEMS[d.lock].n,'bad');sfx('error');return false}o.unlocked=1;sfx('door',t.x,t.y)}
    }
    p.act={type:'open',i:t.i,t:0,dur:o.inv?.15:.7};return true}
  if(t.type==='cage'){o.held=0;Z.touch(t.i);sfx('door',t.x,t.y);if(G.hooks.rescue)G.hooks.rescue();return true}
  if(t.type==='garden'){if(o.seed&&cropReady(o)){harvest(Z,t.i);return true}if(o.seed){const left=Math.max(0,o.ripe-S.t);toast(ITEMS[ITEMS[o.seed].crop].n+': ready in '+(left>=60?Math.ceil(left/60)+' h':Math.ceil(left)+' min'),'info');return true}}
  if(t.type==='prod'){if(o.stock>=1){collectProd(Z,t.i)}else{const pr=d.prod,wet=pr.rain&&G.S.weather&&(WEATHER[G.S.weather.id]||{}).rain,min=Math.ceil((1-(o.stock||0))*pr.every/(wet?pr.rain:1));
    toast(d.n+': nothing yet. The next '+(ITEMS[pr.item]?ITEMS[pr.item].n.toLowerCase():'one')+' in about '+(min>=90?Math.round(min/60)+' hours':min+' minutes')+(pr.rain?(wet?' (rain is filling it '+pr.rain+' times faster)':'; rain fills it '+pr.rain+' times faster'):'')+'. It holds '+pr.cap+'.','info')}return true}
  if(t.type==='station'&&o.out){/* fallthrough to UI, which shows the tray */}
  emit('ui',t.type,t.i);sfx('ui_open');return true;
}
export function openLoot(Z,i){
  const o=Z.obj[i],d=OBJ[o.k],S=G.S;if(!o)return;
  if(!o.inv){
    if(o.starter===1)o.inv=[{id:'rags',n:10},{id:'fiber',n:4},{id:'scrap',n:3},{id:'water',n:2},{id:'canned_beans',n:2},{id:'rope',n:1}];
    else if(o.starter===2)o.inv=[{id:'bandage',n:2},{id:'berries',n:5},{id:'stick',n:4},{id:'flint',n:2}];
    else{const fam=d.loot;o.inv=rollLoot(fam,Z.lt,rnd,Z.def&&Z.def.endless?1:0);if(fam==='airdrop'&&rnd()<.5)o.inv.push(...rollLoot('gear',Z.lt,rnd));
      // something to wear or to fight with: a chance in ordinary containers, and two for certain in a lead's strongroom, from a tier above the country around it
      if(d.lock==='guard'){const ft=Math.min(5,Math.max(Z.lt,1+Math.floor(Z.lvl/10))+1);for(let k=0,got=0;k<12&&got<2;k++){const f=rollLoot('finds',ft,rnd)[0];if(f&&!o.inv.some(x=>x.id===f.id)){o.inv.push(f);got++}}}   // two different pieces, always
      else if(FIND[fam]&&rnd()<FIND[fam])o.inv.push(...rollLoot('finds',Z.lt,rnd))}
    if(o.qi){o.inv.unshift({id:o.qi,n:1});S.flags[o.qf]=1;toast('Found: '+ITEMS[o.qi].n,'good');sfx('quest')}
    stat('opened');addXp(S,2+Z.lt);
  }
  sfx('open_crate',i%Z.w+.5,Math.floor(i/Z.w)+.5);
}
/** Move everything that fits from a container into the pack. Returns true when it is now empty. */
export function lootAll(Z,i){
  const o=Z.obj[i],S=G.S;if(!o||!o.inv)return false;const cap=slotCount(S);
  for(let k=0;k<o.inv.length;k++){const s=o.inv[k];if(!s)continue;const left=addTo(S.p.inv,cap,s.id,s.n,s.d);if(s.n-left>0){emit('loot',s.id,s.n-left);S.codex.it[s.id]=1;gained(S,s.id)}if(left>0)s.n=left;else o.inv[k]=null}
  // closed up in place: a dropped pack's list is the same list the place remembers it by (S.loc[..].bag, a site's bag), and a new list here would leave that one stale
  {const f=o.inv.filter(Boolean);o.inv.length=0;o.inv.push(...f)}return checkEmpty(Z,i);
}
export function checkEmpty(Z,i){
  const o=Z.obj[i];if(!o||!o.inv||o.inv.some(Boolean))return false;const d=OBJ[o.k];
  if(d.special==='deathbag'){Z.obj[i]=null;if(G.S.loc[Z.id])G.S.loc[Z.id].bag=null;const st=Z.site&&G.S.sites.find(s=>s.id===Z.site);if(st)st.bag=null;Z.touch(i);return true}
  if(d.loot&&!d.store){o.empty=1;if(!d.solid||o.k==='airdrop'||o.k==='stash'||o.k==='suitcase'||o.k==='corpse'||o.k==='ammo_box'){Z.obj[i]=null}Z.touch(i)}return true;
}
function pickDrop(Z,dr,manual){
  const S=G.S,cap=slotCount(S);let any=false;
  for(let k=0;k<dr.items.length;k++){const s=dr.items[k];const left=addTo(S.p.inv,cap,s.id,s.n,s.d);if(s.n-left>0){emit('loot',s.id,s.n-left);S.codex.it[s.id]=1;any=true;gained(S,s.id)}if(left>0)s.n=left;else dr.items[k]=null}
  dr.items=dr.items.filter(Boolean);if(any)sfx('pickup',dr.x,dr.y);else if(manual)toast('Pack full','bad');
  if(!dr.items.length)Z.drops.splice(Z.drops.indexOf(dr),1);else dr.full=Z.time;
}
function nodeHit(Z,i,tool){
  const S=G.S,o=Z.obj[i];if(!o)return;const d=OBJ[o.k],nd=d.node,x=i%Z.w+.5,y=Math.floor(i/Z.w)+.5;
  const power=tool.it?1+Math.max(0,(tool.it.tier||1)-nd.tier)*.5:1;o.n-=power;o.hit=Z.time;
  if(tool.it&&tool.ref)wearTool(S,tool,1);
  const kind=nd.tool==='axe'?'wood':nd.tool==='pick'?'stone':nd.tool==='wrench'?'spark':'leaf';
  sfx(nd.tool==='axe'?'chop':nd.tool==='pick'?'mine':nd.tool==='wrench'?'hit_metal':nd.tool==='rod'?'splash':'rustle',x,y);emit('fx',kind,x,y);emit('obj',i);
  if(nd.tool==='axe'||nd.tool==='pick'||nd.tool==='wrench')noise(Z,x,y,5);
  if(o.n>0)return;
  const mult=1+(nd.tool==='axe'?perk('wood'):nd.tool==='pick'?perk('ore'):nd.tool==='wrench'?perk('salvage'):perk('plant'))+(o.rich?.6:0);
  for(const[id,a,b,ch]of nd.give){if(ch&&rnd()>ch)continue;let n=a+Math.floor(rnd()*(b-a+1));if(n<=0)continue;n=Math.floor(n*mult+rnd());if(n>0)give(S,id,n)}
  addXp(S,nd.xp+Math.floor(Z.lt/2));stat(nd.tool==='axe'?'wood':nd.tool==='pick'?'ore':nd.tool==='rod'?'fish':'forage',nd.tool==='rod'?1:3);
  if(Z.home&&nd.regrow)S.home.regrow.push({k:o.k,i,at:S.t+nd.regrow*(.8+rnd()*.4)});
  // a bank, pool or rock that is worked out says so (and at home, that it comes back): otherwise it just vanishes from under you
  if((nd.hits>1||d===OBJ.pond)&&nd.tool!=='axe'&&!G.auto)toast(d.n+(d===OBJ.pond?' has run dry':' is used up')+(Z.home&&nd.regrow?': it comes back in about '+Math.max(1,Math.round(nd.regrow/60))+' h':''),'info');
  Z.obj[i]=null;Z.touch(i);emit('fx','dust',x,y);
}
/** Bring in a ripe bed. Composted beds give half again as much. With the replant setting on, the same seed goes straight back in if you carry one. */
export function harvest(Z,i){
  const S=G.S,o=Z.obj[i],sid=o.seed,seed=ITEMS[sid],x=i%Z.w+.5,y=Math.floor(i/Z.w)+.5;let n=seed.yield[0]+Math.floor(rnd()*(seed.yield[1]-seed.yield[0]+1));n=Math.floor(n*(1+perk('plant'))*(o.fert?1.5:1)+rnd());
  give(S,seed.crop,n);if(rnd()<.6)give(S,sid,1);stat('harvest',n);addXp(S,6);o.seed=null;o.ripe=0;o.wet=0;o.fert=0;Z.touch(i);sfx('rustle',x,y);emit('fx','leaf',x,y);
  if(S.set.replant&&count(S,sid)>0)plant(Z,i,sid);
}
export function plant(Z,i,seedId){
  const S=G.S,o=Z.obj[i];if(!o||o.seed||!ITEMS[seedId]||!take(S,seedId,1))return false;o.seed=seedId;o.t0=S.t;o.ripe=S.t+ITEMS[seedId].grow;o.wet=0;o.fert=0;stat('planted');Z.touch(i);sfx('rustle');return true;
}
function collectProd(Z,i){
  // into the pack, and what does not fit into the storage boxes at home; what fits nowhere stays where it is (it used to fall on the ground and stay in
  // the producer as well, so a full pack collected the same water twice)
  const S=G.S,o=Z.obj[i],d=OBJ[o.k].prod;const put=(id,n)=>{let left=addTo(S.p.inv,slotCount(S),id,n);if(left<n){emit('loot',id,n-left);S.codex.it[id]=1}if(left>0&&Z.home){const was=left;for(const b of homeStores(S)){left=addTo(b.inv,OBJ[b.k].store,id,left);if(!left)break}if(was>left)toast('Pack full: '+(was-left)+' '+ITEMS[id].n+' put in your storage','info')}return n-left};
  const n=Math.floor(o.stock);if(n<=0)return;const got=put(d.item,n);o.stock-=got;
  if(o.extra>0){const ge=put(d.extra[0],o.extra);o.extra-=ge}
  if(!got)toast('No room in your pack or the storage boxes: '+OBJ[o.k].n+' keeps it for now','bad');else sfx('pickup');Z.touch(i);
}

// ---------------------------------------------------------------- player: auto-gather
const JOB_NAMES={axe:'trees',pick:'rock and ore',rod:'fishing holes',wrench:'wrecks and machines'};
/** What auto-gather will and will not do here, given the tools carried: {using:[tool names], skipping:[[job, tool needed]]}. */
export function autoPlan(Z){
  const S=G.S,using=new Set(),skip=new Map();
  for(const o of Z.obj){if(!o)continue;const n=OBJ[o.k].node;if(!n||!n.tool)continue;const t=findTool(S,n.tool,n.tier);
    if(t)using.add(t.it.n);else if(!findTool(S,n.tool,0))skip.set(n.tool,JOB_NAMES[n.tool]+' (no '+TOOL_NAMES[n.tool]+')');else if(!skip.has(n.tool))skip.set(n.tool+n.tier,OBJ[o.k].n.toLowerCase()+' (needs '+(TIER_NAMES[n.tier]||'a better')+' '+TOOL_NAMES[n.tool]+')')}
  return{using:[...using],skipping:[...skip.values()]};
}
function autoTarget(Z,p){
  const S=G.S,f=field(Z,Math.floor(p.x),Math.floor(p.y),true,90),W=Z.w,held=weaponDef(S).tool||null;let best=-1,bd=80;
  const near=i=>{let m=Infinity;const x=i%W,y=(i-x)/W;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=Z.h||walled(Z,nx+.5,ny+.5,x+.5,y+.5))continue;const v=f[ny*W+nx];if(v<m)m=v}return m};
  for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(!o)continue;const d=OBJ[o.k];let ok=false;
    if(d.node){ok=(!d.node.tool||!!findTool(S,d.node.tool,d.node.tier))&&d.node.give.some(g=>roomFor(S,g[0],1))}else if(d.loot&&!o.empty&&!o.kept&&!Z.home){ok=!d.lock||o.unlocked||!!o.inv}
    if(!ok)continue;let v=near(i);if(held&&d.node&&d.node.tool===held)v-=6;if(v<bd){bd=v;best=i}}
  // loose loot comes first: anything lying within a short walk is picked up before going back to gathering (it is what a fight leaves behind)
  let drop=null,dd=Infinity;for(const dr of Z.drops){if(dr.mine||dr.full&&Z.time-dr.full<20)continue;const v=f[Math.floor(dr.y)*W+Math.floor(dr.x)];if(v<dd){dd=v;drop=dr}}
  if(drop&&(dd<26||dd<bd)){best=-2;p.autoDrop=drop}
  if(best===-1)return null;
  if(best===-2)return{drop:p.autoDrop,f:field(Z,Math.floor(p.autoDrop.x),Math.floor(p.autoDrop.y),true,120)};
  return{i:best,f:field(Z,best%W,Math.floor(best/W),true,120)};
}
/** The hostile auto mode should deal with now: the nearest one that has noticed you, within 9 tiles (16 for a few seconds after you are hit, to reach whoever is shooting). */
function autoFoe(Z,p,minR=0){
  const R=Math.max(minR,p.alarm!==undefined&&Z.time-p.alarm<6?16:9);let best=null,bd=R;
  for(const a of Z.actors){if(a.team!==1||a.dead||!a.alert||a.def.ai==='flee')continue;const d=dist(a.x,a.y,p.x,p.y)-a.r;if(d<bd){bd=d;best=a}}
  return best;
}
/** The weapon slot auto mode fights with: a loaded gun if there is one, otherwise whichever slot hits hardest. It never throws anything by itself. */
function autoWeapon(S){
  let best=S.p.active,bs=-1;
  for(const slot of['w1','w2']){const e=S.p.eq[slot],w=e?ITEMS[e.id]:FIST;let v;
    if(w.t==='throw')v=0;else if(w.t==='gun')v=count(S,w.ammo)>0?1000+(w.dmg||1)*(w.pellets||1)/(w.spd||.5):0;else v=1+(w.dmg||1)/(w.spd||.5)*(1+(w.rng||1)*.2);
    // a weapon about to break is no choice at all while the other hand holds something sound
    if(e&&w.dur&&e.d!==undefined&&e.d<w.dur*.15)v*=.2;   // (the same line as everywhere else: under 15% it is about to break)
    if(v>bs){bs=v;best=slot}}
  return best;
}
/** The nearest storage box at home that would take at least one stack of what auto mode carries as materials, or null. */
function stowTarget(Z,p){
  const mats=G.S.p.inv.filter(it=>it&&stowable(G.S,it.id));if(!mats.length)return null;let best=null,bd=1e9;
  for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(!o||!OBJ[o.k]||!OBJ[o.k].store)continue;const cap=OBJ[o.k].store,inv=o.inv||[];let free=0;for(let k=0;k<cap;k++)if(!inv[k])free++;
    if(!free&&!mats.some(m=>inv.some(s=>s&&s.id===m.id&&s.n<(ITEMS[m.id].st||1))))continue;const d=dist(i%Z.w+.5,Math.floor(i/Z.w)+.5,p.x,p.y);if(d<bd){bd=d;best={i}}}
  return best;
}
/** Where to fall back to: the reachable spot within a short run that is farthest from everything hostile (weighed against the length of the run).
 *  Used by auto mode when it is badly hurt, and by the bot's flee at home, where there is no edge to run off. Null if there is nothing to run from. */
/** Is the post inside walls (a yard)? Worked out once per post: a flood from it that crosses no wall or door and does not reach the edge of the homestead. */
/** What auto mode carries to the storage boxes when the pack fills: materials, seeds, and ammunition for nothing you carry. The rounds for a gun
 *  you hold stay in the pack (they were stowed with the nails, and the gun went into the next tide empty). */
const stowable=(S,id)=>{const t=ITEMS[id].t;if(t==='mat'||t==='seed')return true;if(t!=='ammo')return false;
  for(const s of['w1','w2']){const e=S.p.eq[s],w=e&&ITEMS[e.id];if(w&&w.ammo===id)return false}for(const it of S.p.inv){const w=it&&ITEMS[it.id];if(w&&w.t==='gun'&&w.ammo===id)return false}return true};
function postEnclosed(Z,post){
  if(post.enc!==undefined)return post.enc;const W=Z.w,H=Z.h,s=Math.floor(post.y)*W+Math.floor(post.x),seen=new Uint8Array(W*H),q=[s];seen[s]=1;let n=0;
  while(q.length){const c=q.pop(),x=c%W,y=(c-x)/W;if(x<3||y<3||x>=W-3||y>=H-3||++n>900)return post.enc=false;
    for(const[dx,dy,side]of[[1,0,1],[-1,0,3],[0,1,2],[0,-1,0]]){const nx=x+dx,ny=y+dy,j=ny*W+nx;if(seen[j])continue;if(Z.ed[edgeIdx(W,x,y,side)])continue;seen[j]=1;q.push(j)}}
  return post.enc=true;
}
export function retreatSpot(Z,p){
  const foes=Z.actors.filter(a=>a.team===1&&!a.dead&&a.def.ai!=='flee'&&(a.alert||dist(a.x,a.y,p.x,p.y)<6)&&dist(a.x,a.y,p.x,p.y)<14);if(!foes.length)return null;
  const f=field(Z,Math.floor(p.x),Math.floor(p.y),true,30);let best=null,bs=-1e9;
  for(let k=0;k<32;k++){const ang=k/32*TAU;for(const r of[3,5,7,9]){const x=Math.floor(p.x+Math.cos(ang)*r),y=Math.floor(p.y+Math.sin(ang)*r);if(x<1||y<1||x>=Z.w-1||y>=Z.h-1)continue;const c=f[y*Z.w+x];if(!(c<30))continue;
    // at home in a tide the walls are the safety: fall back towards your post, not out into the open where faster things run you down
    let near=99;for(const a of foes){const d=dist(a.x,a.y,x+.5,y+.5)*(a.def.proj?.7:1);if(d<near)near=d}const home=Z.home&&p.post&&postEnclosed(Z,p.post)?dist(x+.5,y+.5,p.post.x,p.post.y)*1.4:0,s=near*1.6-c*.35-home;if(s>bs){bs=s;best={x:x+.5,y:y+.5,near:+near.toFixed(1)}}}}
  return best;
}
/** How far from its post auto mode goes to meet something during a tide: a doorway's width or two, not the far side of the clearing. */
const POST_REACH=5.5;
/** Auto mode defends itself: draw the best weapon, close in (or hold and shoot), patch itself up from the pack, and go back to gathering when the place is clear. */
function autoFight(Z,p,e,dt){
  const S=G.S,ds=G.ds;
  if(!p.fight){p.fight={slot:S.p.active,t:Z.time,heal:0,warn:false,f:null,ft:-9};p.auto=null;p.act=null;toast('Auto: defending against '+e.def.n,'bad')}
  const F=p.fight;F.t=Z.time;
  // badly hurt with nothing left to heal with: fall back from them instead of standing to be killed, and come back when health has come up again
  // (the bots stood still and died at home: auto mode held its ground at any health)
  {const med=S.p.inv.some(it=>it&&(ITEMS[it.id].t==='med'?ITEMS[it.id].hp>0:ITEMS[it.id].t==='food'&&ITEMS[it.id].hp>=8));
    if(!F.back&&S.p.hp<ds.maxHp*.3&&!med){F.back=true;toast('Auto: badly hurt and no medicine, falling back','bad')}
    else if(F.back&&(S.p.hp>ds.maxHp*.5||med)){F.back=false;F.rs=null}
    if(F.back){if(!F.rs||Z.time-F.rt>.6||dist(p.x,p.y,F.rs.x,F.rs.y)<.7){F.rt=Z.time;F.rs=retreatSpot(Z,p);F.rf=F.rs?field(Z,Math.floor(F.rs.x),Math.floor(F.rs.y),true,60):null}
      if(F.rs){p.tgt=null;const d=pathDir(Z,p,F.rf);if(d)return d;const l=Math.hypot(F.rs.x-p.x,F.rs.y-p.y)||1;return[(F.rs.x-p.x)/l,(F.rs.y-p.y)/l]}}}
  if(S.p.hp<ds.maxHp*.45&&Z.time>=F.heal){F.heal=Z.time+2.5;const med=S.p.inv.some(it=>it&&(ITEMS[it.id].t==='med'?ITEMS[it.id].hp>0:ITEMS[it.id].t==='food'&&ITEMS[it.id].hp>=8));
    if(med)quickUse(S,'hp');else if(S.p.hp<ds.maxHp*.25&&!F.warn){F.warn=true;toast('Badly hurt and no medicine: auto is still fighting','bad');sfx('error')}}
  // a weapon the player swapped to by hand (Q) is left in hand for two game hours
  // the hand you chose is kept for a while, unless it has nothing left to give: an empty gun or a broken blade (a bot clicked an empty revolver all fight)
  {const e=S.p.eq[S.p.active],w=e&&ITEMS[e.id];if(w&&((w.t==='gun'&&count(S,w.ammo)<=0)||(w.dur&&e.d!==undefined&&e.d<=0)))S.p.chose=undefined}
  if(!p.atk&&!(S.p.chose!==undefined&&S.t-S.p.chose<120)){const slot=autoWeapon(S);if(slot!==S.p.active){S.p.active=slot;emit('eq')}}
  const w=weaponDef(S),gun=w.t==='gun'&&count(S,w.ammo)>0,thrown=w.t==='throw',d=dist(p.x,p.y,e.x,e.y),see=los(Z,p.x,p.y,e.x,e.y),ang=Math.atan2(e.y-p.y,e.x-p.x);
  const hitR=(thrown?FIST.rng:w.rng)+e.r,reach=gun?Math.min(w.rng*.8,8):hitR-.15;
  p.tgt=e;
  // once in reach, stand and fight, and stay planted until the target is well out of it: a swing steps in by itself, so there is no shuffling
  // back and forth as blows knock it away
  F.eng=see&&!p.roll&&(d<=reach||(!!F.eng&&!gun&&d<=hitR+.5));
  if(F.eng){
    // always turned to whatever is nearest, even in the middle of a wind-up: the blow that stops the closest attacker is the one that matters
    p.a=ang;if(p.atk&&!p.atk.done)p.atk.tg=e;
    if(p.cd<=0&&!p.atk){if(thrown)meleeSwing(Z,p,FIST,FIST.spd/ds.haste);else{const keep=G.inp.aim;G.inp.aim={x:e.x,y:e.y};tryAttack(Z,p);G.inp.aim=keep}}
    // with a gun, back away from anything that gets close; with a blade, stand and swing
    if(gun&&d<2.4&&!e.def.proj)return[-Math.cos(ang),-Math.sin(ang)];
    return[0,0];
  }
  // closing in: straight at it when the way is clear, otherwise along a path (a straight line runs into trees, rocks and your own walls)
  if(Z.time-(F.nt||-9)>.15){F.nt=Z.time;F.str=see&&walkClear(Z,p.x,p.y,e.x,e.y,p.r,true)}
  if(F.str)return[Math.cos(ang),Math.sin(ang)];
  if(Z.time-F.ft>.5){F.ft=Z.time;F.f=field(Z,Math.floor(e.x),Math.floor(e.y),true,90)}
  return pathDir(Z,p,F.f)||(see?[Math.cos(ang),Math.sin(ang)]:[0,0]);
}
/** The way to walk along a path field: toward the farthest point of it that can be reached in a straight line (worked out a few times a second). */
function pathDir(Z,p,f){
  const nv=p.nav||(p.nav={t:-9,f:null,x:0,y:0,ok:false});let dx=nv.x-p.x,dy=nv.y-p.y;
  if(nv.f!==f||Z.time-nv.t>.15||!nv.ok||dx*dx+dy*dy<.09){nv.f=f;nv.t=Z.time;const a=pathAim(Z,f,p.x,p.y,p.r,true);nv.ok=!!a;if(a){nv.x=a[0];nv.y=a[1];dx=nv.x-p.x;dy=nv.y-p.y}}
  if(!nv.ok)return null;const l=Math.hypot(dx,dy);return l>.01?[dx/l,dy/l]:null;
}
function autoStep(Z,p,dt){
  const S=G.S;
  // in a tide: meet whatever comes within reach of the middle; once the last wave is in, go and find the stragglers so the tide can end
  // in a tide auto mode holds a post: the spot where the player stood when the tide (or auto mode) began, which is inside their walls if they have
  // any sense. It fights what comes within a few steps of the post and goes no further; it used to hold the middle of the map and walk out of a yard
  // built anywhere else, straight into the tide (0.10.1). Once the last wave is in, it goes and finds the stragglers so the tide can end.
  // (and in the last 45 minutes before one: auto mode stops gathering and keeps to where it was switched on, instead of wandering off to chop a tree outside the walls)
  const soon=Z.home&&!S.tide.live&&S.tide.at-S.t<45,tide=Z.home&&(S.tide.live||soon);if(tide){if(!p.post||p.post.n!==S.tide.n)p.post={x:p.x,y:p.y,n:S.tide.n}}else p.post=null;
  let foe=null;
  // (what is on the far side of a wall from the post is left to the wall: auto mode used to walk out through the yard's door to meet raiders gathering
  // in the trap field, and died there twice)
  if(tide){let bd=POST_REACH;for(const a of Z.actors){if(a.team!==1||a.dead||!a.alert||a.def.ai==='flee')continue;const d=dist(a.x,a.y,p.post.x,p.post.y)-a.r;if(d<bd&&!(Z.ed.length&&edgeCross(Z,p.post.x,p.post.y,a.x,a.y,false)>=0)){bd=d;foe=a}}if(!foe&&S.tide.live&&!S.tide.live.q.length)foe=autoFoe(Z,p,400)}   // (a door counts as a wall here)
  else foe=autoFoe(Z,p,0);
  if(foe)return autoFight(Z,p,foe,dt);
  if(p.fight){if(Z.time-p.fight.t<1.5&&S.p.active!==p.fight.slot){S.p.active=p.fight.slot;emit('eq')}p.fight=null;p.auto=null;toast(Z.home&&S.tide.live?'Auto: clear for now, holding this spot':'Auto: clear, back to gathering','info')}
  // during a tide auto mode stops gathering and holds the middle of the homestead, going out only to meet what comes within reach
  if(tide){p.act=null;p.auto=null;const hx=p.post.x,hy=p.post.y;if(dist(p.x,p.y,hx,hy)<.6)return[0,0];
    if(!p.homeF||Z.time-p.homeT>1){p.homeT=Z.time;p.homeF=field(Z,Math.floor(hx),Math.floor(hy),true,120)}return pathDir(Z,p,p.homeF)||[0,0]}
  // a full pack at home: carry the materials to the nearest storage box that has room, put them in, and go back to work. Away from home, or with
  // no box that will take them, auto mode stops and says why.
  if(freeSlots(S)===0&&!p.act){
    if(Z.home){let s=p.stow;if(!s||!Z.obj[s.i]||Z.time-s.t>25){s=p.stow=stowTarget(Z,p);if(s){s.t=Z.time;s.f=field(Z,s.i%Z.w,Math.floor(s.i/Z.w),true,160)}}
      if(s){const tx=s.i%Z.w+.5,ty=Math.floor(s.i/Z.w)+.5;p.auto=null;
        if(dist(p.x,p.y,tx,ty)<1.45&&!walled(Z,p.x,p.y,tx,ty)){const o=Z.obj[s.i],cap=OBJ[o.k].store;let n=0;o.inv=o.inv||[];
          for(let k=0;k<S.p.inv.length;k++){const it=S.p.inv[k];if(!it||!stowable(S,it.id))continue;const left=addTo(o.inv,cap,it.id,it.n,it.d);if(left<it.n)n++;if(left>0)it.n=left;else S.p.inv[k]=null}
          p.stow=null;if(n){toast('Auto: put '+n+' stack'+(n>1?'s':'')+' of materials in the '+OBJ[o.k].n,'info');sfx('pickup');return[0,0]}}
        else{const dir=pathDir(Z,p,s.f);if(dir)return dir;const l=Math.hypot(tx-p.x,ty-p.y)||1;return[(tx-p.x)/l,(ty-p.y)/l]}}}
    // a full pack ends the gathering, not the defending: auto mode stays on and fights whatever comes, and says so once
    if(freeSlots(S)===0){p.auto=null;p.stow=null;if(!p.fullSaid||Z.time-p.fullSaid>60){p.fullSaid=Z.time;toast(Z.home?'Auto: pack full and no storage box has room (build another). Still on guard':'Auto: pack full, no more gathering. Still on guard','info')}return[0,0]}}
  if(p.act)return[0,0];
  let a=p.auto;
  if(a&&(a.drop?!Z.drops.includes(a.drop):(!Z.obj[a.i]||Z.obj[a.i].empty)))a=p.auto=null;
  if(!a){a=p.auto=autoTarget(Z,p);if(!a){G.auto=false;toast('Auto: nothing left to gather here','info');return[0,0]}a.stuck=0}
  const tx=a.drop?a.drop.x:a.i%Z.w+.5,ty=a.drop?a.drop.y:Math.floor(a.i/Z.w)+.5,d=dist(p.x,p.y,tx,ty);
  if(a.drop){if(d<.7&&!walled(Z,p.x,p.y,tx,ty)){pickDrop(Z,a.drop,false);p.auto=null;return[0,0]}}
  else if(d<1.45&&!walled(Z,p.x,p.y,tx,ty)){const info=interactInfo(Z,a.i);if(!info){p.auto=null;return[0,0]}
    if(info.type==='loot'){const o=Z.obj[a.i];p.a=Math.atan2(ty-p.y,tx-p.x);if(!o.inv){if(!p.act)p.act={type:'open',i:a.i,t:0,dur:.6,auto:true}}else{lootAll(Z,a.i);if(Z.obj[a.i]&&!Z.obj[a.i].empty){Z.obj[a.i].empty=1}p.auto=null}return[0,0]}
    if(!interact(Z,{i:a.i,x:tx,y:ty,...info}))p.auto=null;return[0,0]}
  a.stuck+=dt;if(a.stuck>14){p.auto=null;return[0,0]}
  const dir=pathDir(Z,p,a.f);if(dir)return dir;
  const l=Math.hypot(tx-p.x,ty-p.y)||1;return[(tx-p.x)/l,(ty-p.y)/l];
}

// ---------------------------------------------------------------- player step
function stepPlayer(Z,dt){
  const S=G.S,p=Z.pl,inp=G.inp,ds=G.ds;if(!p||p.dead)return;
  p.cd-=dt;p.rollCd-=dt;p.iframe-=dt;p.slowT-=dt;p.hurtT-=dt;p.noAmmoT-=dt;if(p.recoil>0)p.recoil-=dt;if(p.atkT>0)p.atkT-=dt;
  // a tap is remembered for a moment, so one made just before the last swing or roll has finished still counts
  p.buf=inp.tap?.3:(p.buf||0)-dt;inp.tap=false;p.rbuf=inp.dodge?.25:(p.rbuf||0)-dt;inp.dodge=false;p.faceT=(p.faceT||0)-dt;
  p.sneak=!!inp.sneak;
  let mx=inp.mx,my=inp.my,ml=Math.hypot(mx,my);if(ml>1){mx/=ml;my/=ml;ml=1}
  if(G.auto){if(ml>.3||inp.attack){G.auto=false;p.auto=null;p.fight=null}else{[mx,my]=autoStep(Z,p,dt);ml=Math.hypot(mx,my)}}
  if(p.rbuf>0){if(p.rollCd<=0&&!p.roll){p.rbuf=0;const dx=ml>.1?mx/ml:Math.cos(p.a),dy=ml>.1?my/ml:Math.sin(p.a);p.roll={t:.3,dx,dy};p.rollCd=1.5*(1-perk('dodge'));p.iframe=.34;p.act=null;p.atk=null;sfx('swing',p.x,p.y,{pitch:.7})}}
  let speed=ds.spd*(p.sneak?.5:1)*(p.slowT>0?.55:1),vx=mx*speed,vy=my*speed;
  // ease into and out of a run instead of snapping to full speed: about a tenth of a second either way
  {const k=1-Math.exp(-dt*(ml>.1?16:20));p.sx=(p.sx||0)+(vx-(p.sx||0))*k;p.sy=(p.sy||0)+(vy-(p.sy||0))*k;if(Math.abs(p.sx)+Math.abs(p.sy)<.02)p.sx=p.sy=0;vx=p.sx;vy=p.sy}
  if(p.roll){p.roll.t-=dt;vx=p.roll.dx*10;vy=p.roll.dy*10;if(p.roll.t<=0)p.roll=null}
  else if(p.atk&&!p.atk.done){vx*=.45;vy*=.45}
  if(p.kx||p.ky){vx+=p.kx;vy+=p.ky;const f=Math.pow(.002,dt);p.kx*=f;p.ky*=f;if(Math.abs(p.kx)+Math.abs(p.ky)<.2)p.kx=p.ky=0}
  const ox=p.x,oy=p.y;[p.x,p.y]=collide(Z,p.x+vx*dt,p.y+vy*dt,p.r,true);
  p.mv=Math.hypot(p.x-ox,p.y-oy)/dt;
  // a door of yours creaks as you come up to it (the renderer swings the leaf at the same distance)
  if(Z.ed.length){const cx=Math.floor(p.x),cy=Math.floor(p.y);let near=-1;for(let sd=0;sd<4;sd++){const e=edgeIdx(Z.w,cx,cy,sd),w=Z.ed[e];if(w&&OBJ[w.k].door){const[mx,my]=structXY(Z,EREF+e);if(dist(p.x,p.y,mx,my)<.95)near=e}}
    if(near!==p.door){if(near>=0&&p.door===-1)sfx('door',p.x,p.y,{vol:.4});p.door=near}}
  // keep facing the fight between swings instead of spinning to the way you are walking; during a wind-up, turn with the target
  if(p.atk&&!p.atk.done&&p.atk.tg&&!p.atk.tg.dead){const want=Math.atan2(p.atk.tg.y-p.y,p.atk.tg.x-p.x);p.a+=clamp(angDiff(want,p.a),-9*dt,9*dt)}
  if(ml>.1&&!p.roll){if(!p.atk&&!(inp.attack&&inp.aim)&&!(p.faceT>0)&&!(G.auto&&p.fight))p.a=Math.atan2(my,mx);if(p.act&&!G.auto)p.act=null;
    p.stepT-=dt*(p.sneak?.5:1);if(p.stepT<=0){p.stepT=.34;sfx('step',p.x,p.y,{vol:p.sneak?.15:.35,pitch:.9+rnd()*.25})}}
  if(inp.attack||p.buf>0)tryAttack(Z,p);
  if(p.atk){p.atk.t+=dt;if(!p.atk.done&&p.atk.t>=p.atk.hitAt){p.atk.done=true;meleeHit(Z,p,p.atk.w)}if(p.atk.t>=p.atk.dur*.85)p.atk=null}
  if(inp.interact){inp.interact=false;if(!p.act)interact(Z)}
  if(p.act){const a=p.act;a.t+=dt;const o=Z.obj[a.i];
    if(!o){p.act=null}
    else if(a.t>=a.dur){
      if(a.type==='gather'){const tool=toolFor(Z,a.i,true);if(!tool){p.act=null}else{nodeHit(Z,a.i,tool);if(Z.obj[a.i]&&(inp.hold||G.auto||true))a.t=0;else p.act=null}}
      else if(a.type==='open'){p.act=null;openLoot(Z,a.i);if(a.auto){lootAll(Z,a.i);const o2=Z.obj[a.i];if(o2)o2.empty=1;p.auto=null}else emit('ui','loot',a.i)}
    }
  }
  // loose loot
  if(S.set.autoPick)for(let k=Z.drops.length-1;k>=0;k--){const dr=Z.drops[k];dr.t+=dt;if(dr.t>.5&&!dr.mine&&dist(dr.x,dr.y,p.x,p.y)<.95&&!(dr.full&&Z.time-dr.full<4))pickDrop(Z,dr,false)}
  Z.exit=atExit(Z,Math.floor(p.x),Math.floor(p.y));
}

// ---------------------------------------------------------------- creature AI
function steer(Z,e,tx,ty,speed,dt){
  const dx=tx-e.x,dy=ty-e.y,l=Math.hypot(dx,dy)||1;e.a=Math.atan2(dy,dx);
  const ox=e.x,oy=e.y;[e.x,e.y]=collide(Z,e.x+dx/l*speed*dt,e.y+dy/l*speed*dt,Math.min(e.r,.36),e.team===0);e.mv=Math.hypot(e.x-ox,e.y-oy)/dt;
}
function breakableAt(Z,x,y){const tx=Math.floor(x),ty=Math.floor(y);if(tx<0||ty<0||tx>=Z.w||ty>=Z.h)return-1;const i=ty*Z.w+tx,o=Z.obj[i];return o&&o.hp>0&&OBJ[o.k].solid&&OBJ[o.k].cost?i:-1}
/** Walk toward a point: straight when it is in view, along the shared path field otherwise. Returns a structure index if one bars the way. */
function approach(Z,e,tx,ty,speed,dt,flow){
  // walking straight at the target and getting nowhere (a tree or a rock dead ahead): take the path field round it for a while
  e.blk=e.mv<.25&&dist(e.x,e.y,tx,ty)>2.6?(e.blk||0)+dt:Math.max(0,(e.blk||0)-dt*2);
  const direct=dist(e.x,e.y,tx,ty)<8&&los(Z,e.x,e.y,tx,ty)&&!(flow&&e.blk>.5);let gx=tx,gy=ty;
  if(!direct&&flow){const n=stepOn(Z,flow,e.x,e.y);if(n>=0){gx=n%Z.w+.5;gy=Math.floor(n/Z.w)+.5;const o=Z.obj[n];if(o&&o.hp>0&&OBJ[o.k].solid&&OBJ[o.k].cost)return n;
      const ex=Math.floor(e.x),ey=Math.floor(e.y),nx=n%Z.w,ny=Math.floor(n/Z.w);if(Z.ed.length&&(ex===nx)!==(ey===ny)){const eb=edgeBetween(Z,ex,ey,nx,ny);if(eb>=0&&OBJ[Z.ed[eb].k].cost)return EREF+eb}}}
  const ang=Math.atan2(gy-e.y,gx-e.x),b=breakableAt(Z,e.x+Math.cos(ang)*(e.r+.45),e.y+Math.sin(ang)*(e.r+.45));
  if(b>=0&&Z.home)return b;
  if(Z.home){const ec=edgeCross(Z,e.x,e.y,e.x+Math.cos(ang)*(e.r+.45),e.y+Math.sin(ang)*(e.r+.45));if(ec>=0)return EREF+ec}
  steer(Z,e,gx,gy,speed,dt);return-1;
}
function strikeTarget(Z,e,t,mult=1,o={}){
  const ang=Math.atan2(t.y-e.y,t.x-e.x);sfx(e.def.rig[0]==='quad'?'bite':'hit_flesh',e.x,e.y,{vol:.6});
  hurt(Z,t,e.dmg*mult,{kb:o.kb||2.5,kx:Math.cos(ang),ky:Math.sin(ang),tox:e.def.tox,slow:e.def.slow||o.slow});
}
function fireAt(Z,e,t){
  const pr=e.def.proj,ang=Math.atan2(t.y-e.y,t.x-e.x),n=pr.pellets||1;
  for(let k=0;k<n;k++)shoot(Z,e.x+Math.cos(ang)*.4,e.y+Math.sin(ang)*.4,ang+(rnd()-.5)*((pr.spread||5)*Math.PI/180),{spd:pr.spd,rng:pr.rng,team:e.team,dmg:e.dmg,kind:pr.kind,tox:pr.kind==='spit'?e.def.tox:0,over:e.def.ai==='guard'&&Z.home});
  sfx(pr.kind==='spit'?'spit':pr.kind==='arrow'?'bow':pr.pellets?'shot_shotgun':'shot_pistol',e.x,e.y,{vol:.7});if(pr.kind==='bullet')emit('fx','muzzle',e.x+Math.cos(ang)*.5,e.y+Math.sin(ang)*.5,ang);
}
function pickFoe(Z,e,p){
  let t=p&&!p.dead?p:null,td=t?dist(e.x,e.y,p.x,p.y):1e9;
  for(const a of Z.actors){if(a.team!==0||a.dead||a.pl||a.def.ai==='follow'||a.def.ai==='wander')continue;const d=dist(e.x,e.y,a.x,a.y);if(d<td*.7&&d<6){t=a;td=d}}
  return t;
}
function bossAbility(Z,e,t,d,dt){
  const ab=e.def.abil;
  for(let k=0;k<ab.length;k++){e.ab[k]-=dt;if(e.ab[k]>0||e.st!=='chase')continue;const b=ab[k];
    if(b.k==='slam'){if(d>b.r+1)continue;e.ab[k]=b.cd;e.st='cast';e.t=e.T=b.wind;Z.areas.push({kind:'tele',x:e.x,y:e.y,r:b.r,t:b.wind,T:b.wind,team:1,dmg:e.dmg*b.dmg,slow:b.slow,sd:e.def.sd*.5});return}
    if(b.k==='pulse'){e.ab[k]=b.cd;e.st='cast';e.t=e.T=b.wind;Z.areas.push({kind:'tele',x:e.x,y:e.y,r:b.r,t:b.wind,T:b.wind,team:1,dmg:e.dmg*b.dmg,tox:b.tox});return}
    if(b.k==='charge'){if(d<3||d>12||!los(Z,e.x,e.y,t.x,t.y))continue;e.ab[k]=b.cd;e.st='cwind';e.t=b.wind;e.ch={spd:b.spd,dmg:b.dmg};e.a=Math.atan2(t.y-e.y,t.x-e.x);sfx('roar',e.x,e.y,{vol:.6});return}
    if(b.k==='pounce'){if(d<2.5||d>b.rng)continue;e.ab[k]=b.cd;e.st='pounce';e.t=b.wind;e.px=t.x;e.py=t.y;e.sx=e.x;e.sy=e.y;e.pT=b.wind;Z.areas.push({kind:'tele',x:t.x,y:t.y,r:1.7,t:b.wind,T:b.wind,team:1,dmg:e.dmg*b.dmg});return}
    if(b.k==='summon'){let n=0;for(const a of Z.actors)if(!a.dead&&a.kind===b.kind)n++;if(n>=b.max){e.ab[k]=3;continue}e.ab[k]=b.cd;sfx(e.def.rig[0]==='quad'?'wolf':'screech',e.x,e.y);
      for(let j=0;j<b.n;j++){const[x,y]=freeNear(Z,e.x,e.y,4);const s=spawnActor(Z,b.kind,x,y,e.lvl,{alert:true,st:'chase',tide:e.tide});emit('fx','dust',x,y);if(s)s.stunT=.6}return}
    if(b.k==='howl'){e.ab[k]=b.cd;sfx('wolf',e.x,e.y);for(const a of Z.actors)if(a.team===1&&!a.dead){alertActor(Z,a,true);a.hasteT=7}emit('fx','ring',e.x,e.y,6);return}
    if(b.k==='spray'){if(d>b.rng||!los(Z,e.x,e.y,t.x,t.y))continue;e.ab[k]=b.cd;e.st='cast';e.t=e.T=b.wind;e.cast=()=>{const ang=Math.atan2(t.y-e.y,t.x-e.x);for(let j=-4;j<=4;j++)shoot(Z,e.x+Math.cos(ang)*e.r,e.y+Math.sin(ang)*e.r,ang+j*.11,{spd:9+rnd()*2,rng:b.rng,team:1,dmg:e.dmg*b.dmg*.5,kind:'spit',tox:b.tox*.3});sfx('spit',e.x,e.y)};return}
    if(b.k==='throw'){if(d>b.rng||d<3)continue;e.ab[k]=b.cd;e.atkT=.4;lob(Z,e.x,e.y,t.x+(rnd()-.5),t.y+(rnd()-.5),{team:1,dmg:e.dmg*b.dmg,aoe:b.r,spd:9,fuse:b.wind*.5});sfx('throw',e.x,e.y);return}
    if(b.k==='shards'){e.ab[k]=b.cd;e.st='cast';e.t=e.T=b.wind;e.cast=()=>{const o=rnd()*TAU;for(let j=0;j<b.n;j++)shoot(Z,e.x,e.y,o+j*TAU/b.n,{spd:8,rng:14,team:1,dmg:e.dmg*b.dmg,kind:'shard',slow:e.def.slow?1.5:0,tox:e.def.tox?6:0});sfx('zap',e.x,e.y)};emit('fx','ring',e.x,e.y,2);return}
  }
}
function stepEnemy(Z,e,dt,p,flow,night,sightMul){
  const def=e.def;e.cd-=dt;e.flash-=dt;e.trapT-=dt;if(e.atkT>0)e.atkT-=dt;e.mv=0;
  // damage over time
  if(e.burnT>0||e.bleedT>0){e.dot+=dt;if(e.burnT>0)e.burnT-=dt;if(e.bleedT>0)e.bleedT-=dt;if(e.dot>=.5){e.dot=0;const d=(e.burnT>0?e.burnD*.5:0)+(e.bleedT>0?e.bleed*.5:0);if(d>0){hurt(Z,e,d,{dot:1});if(e.burnT>0)emit('fx','fire',e.x,e.y);if(e.dead)return}}}
  if(e.kx||e.ky){[e.x,e.y]=collide(Z,e.x+e.kx*dt,e.y+e.ky*dt,Math.min(e.r,.36),false);const f=Math.pow(.02,dt);e.kx*=f;e.ky*=f;if(Math.abs(e.kx)+Math.abs(e.ky)<.15)e.kx=e.ky=0}
  if(e.stunT>0){e.stunT-=dt;return}
  if(e.slowT>0)e.slowT-=dt;if(e.hasteT>0)e.hasteT-=dt;
  let speed=def.spd*(e.slowT>0?.5:1)*(e.hasteT>0?1.3:1);
  const pd=p&&!p.dead?dist(e.x,e.y,p.x,p.y):1e9;
  if(def.stealth)e.vis=clamp(e.vis+(pd<4.5||e.flash>0||e.st==='wind'?dt*3:-dt*1.5),.08,1);
  // traps underfoot
  if(Z.home&&e.trapT<=0){const ti=Math.floor(e.y)*Z.w+Math.floor(e.x),o=Z.obj[ti];if(o){const tr=OBJ[o.k].trap;if(tr){e.trapT=tr.tick||1;o.uses=(o.uses||0)+1;const x=Math.floor(e.x)+.5,y=Math.floor(e.y)+.5;
    if(tr.aoe)explode(Z,x,y,tr.aoe,tr.dmg*(1+perk('turret')),0,{});else if(tr.dmg){hurt(Z,e,tr.dmg*(1+perk('turret')),{stun:tr.stun,quiet:1});sfx('trap_snap',x,y,{vol:.6})}
    if(tr.slow)e.slowT=Math.max(e.slowT,1.2);if(o.uses>=tr.uses){Z.obj[ti]=null;Z.touch(ti);emit('fx','wood',x,y)}else o.hit=Z.time;if(e.dead)return}}}
  if(e.slowT>0&&Z.home){const o=Z.obj[Math.floor(e.y)*Z.w+Math.floor(e.x)];if(o&&OBJ[o.k].trap&&OBJ[o.k].trap.slow)speed=def.spd*OBJ[o.k].trap.slow}
  // perception
  if(!e.alert){e.pt-=dt;if(e.pt<=0){e.pt=.25;
    if(p&&!p.dead&&def.ai!=='flee'){const sight=def.sight*sightMul*(p.sneak?.42-perk('quiet')*.4:1)*(night&&!def.night?.8:1);if(pd<sight&&(pd<1.6||los(Z,e.x,e.y,p.x,p.y))){alertActor(Z,e)}}
    for(const a of Z.actors)if(a.team===0&&!a.pl&&!a.dead&&a.def.ai!=='wander'&&dist(a.x,a.y,e.x,e.y)<5)alertActor(Z,e,true)}}
  // lures pull everything but bosses
  if(Z.lure&&!def.boss&&def.ai!=='flee'&&dist(e.x,e.y,Z.lure.x,Z.lure.y)<Z.lure.r&&!def.human){if(dist(e.x,e.y,Z.lure.x,Z.lure.y)>1)steer(Z,e,Z.lure.x,Z.lure.y,speed*.8,dt);return}
  // fleeing animals
  if(def.ai==='flee'){if(pd<def.sight*(p&&p.sneak?.5:1)||e.alert){
    // the first time an animal bolts from someone with nothing to shoot: say how hunting is done, once
    if(!e.alert&&p&&G.S&&!G.S.flags.huntHint&&weaponDef(G.S).t!=='gun'){G.S.flags.huntHint=1;toast('Animals bolt before you can reach them. Hunt with a bow (Workbench), or build Snares (Farm): they catch meat and hides by themselves','info')}e.alert=pd<def.sight*1.6;const ang=Math.atan2(e.y-p.y,e.x-p.x)+Math.sin(Z.time*2+e.id)*.6;steer(Z,e,e.x+Math.cos(ang)*3,e.y+Math.sin(ang)*3,speed,dt)}else wander(Z,e,dt,speed*.3);return}
  if(!e.alert){if(!def.rooted)wander(Z,e,dt,speed*.35);return}
  const t=pickFoe(Z,e,p);
  if(!t){e.alert=false;e.st='idle';return}
  const d=dist(e.x,e.y,t.x,t.y),reach=def.reach+e.r+(t.r||.3)*.5;
  // losing interest
  if(!e.tide&&!def.boss){if(d>def.sight*2.4){e.lose=(e.lose||0)+dt;if(e.lose>6){e.alert=false;e.st='idle';return}}else e.lose=0}
  // states with a timer
  // the blow goes where it was aimed when the wind-up began: step out of its line, or out of reach, and it misses
  if(e.st==='wind'){e.t-=dt;if(e.t<=0){e.st='chase';e.cd=def.cd;e.atkT=def.proj?.2:.3;if(def.proj){if(los(Z,e.x,e.y,t.x,t.y))fireAt(Z,e,t)}
    else if(d<=reach+.4&&(d<e.r+.55||Math.abs(angDiff(Math.atan2(t.y-e.y,t.x-e.x),e.a))<1.15)&&!(t.pl&&t.iframe>0)&&edgeCross(Z,e.x,e.y,t.x,t.y)<0)strikeTarget(Z,e,t)}return}
  if(e.st==='windS'){e.t-=dt;if(e.t<=0){e.st='chase';e.cd=def.cd;e.atkT=.3;if(structAt(Z,e.sT)){damageObj(Z,e.sT,e.dmg*(def.sd||0));sfx('hit_wood',e.x,e.y,{vol:.5})}}return}
  if(e.st==='cast'){e.t-=dt;if(e.t<=0){e.st='chase';e.atkT=.3;if(e.cast){e.cast();e.cast=null}}return}
  if(e.st==='fuse'){e.t-=dt;e.flash=.1;if(e.t<=0)kill(Z,e);return}
  if(e.st==='cwind'){e.t-=dt;e.flash=.08;if(e.t<=0){e.st='charge';e.t=1.1;e.chHit=false}return}
  if(e.st==='charge'){e.t-=dt;const ox=e.x,oy=e.y,nx=e.x+Math.cos(e.a)*e.ch.spd*dt,ny=e.y+Math.sin(e.a)*e.ch.spd*dt;[e.x,e.y]=collide(Z,nx,ny,Math.min(e.r,.36),false);e.mv=e.ch.spd;
    for(const a of Z.actors)if(a.team===0&&!a.dead&&!e.chHit&&dist(a.x,a.y,e.x,e.y)<e.r+a.r+.25&&!(a.pl&&a.iframe>0)){e.chHit=true;strikeTarget(Z,e,a,e.ch.dmg,{kb:8})}
    if(Math.hypot(e.x-nx,e.y-ny)>.05){let b=breakableAt(Z,nx+Math.cos(e.a)*.5,ny+Math.sin(e.a)*.5);if(b<0){const ec=edgeCross(Z,e.x,e.y,nx+Math.cos(e.a)*.5,ny+Math.sin(e.a)*.5);if(ec>=0)b=EREF+ec}if(b>=0)damageObj(Z,b,e.dmg*(def.sd||1)*2);e.st='chase';e.stunT=.7;emit('shake',.2);sfx('hit_stone',e.x,e.y)}
    else if(e.t<=0)e.st='chase';return}
  if(e.st==='pounce'){e.t-=dt;const f=1-Math.max(0,e.t)/e.pT;e.x=e.sx+(e.px-e.sx)*f;e.y=e.sy+(e.py-e.sy)*f;e.mv=6;if(e.t<=0){[e.x,e.y]=collide(Z,e.x,e.y,Math.min(e.r,.36),false);e.st='chase';e.cd=.5}return}
  e.st='chase';
  // special moves
  if(def.abil){bossAbility(Z,e,t,d,dt);if(e.st!=='chase')return}
  if(def.charge&&!def.abil){e.chCd-=dt;if(e.chCd<=0&&d>3&&d<9&&los(Z,e.x,e.y,t.x,t.y)){e.chCd=def.charge.cd;e.st='cwind';e.t=def.charge.wind;e.ch=def.charge;e.a=Math.atan2(t.y-e.y,t.x-e.x);sfx(def.rig[0]==='quad'?(e.kind==='bear'?'bear':'boar'):'growl',e.x,e.y);return}}
  if(def.call){e.callCd-=dt;if(e.callCd<=0&&d<12){e.callCd=def.call.cd;sfx('screech',e.x,e.y);emit('fx','ring',e.x,e.y,5);noise(Z,e.x,e.y,16);e.stunT=.5;
    let n=0;for(const a of Z.actors)if(!a.dead&&a.team===1)n++;if(n<46)for(let j=0;j<def.call.n;j++){const ang=rnd()*TAU,[x,y]=freeNear(Z,clamp(t.x+Math.cos(ang)*11,2,Z.w-2),clamp(t.y+Math.sin(ang)*11,2,Z.h-2),4);spawnActor(Z,def.call.kind,x,y,e.lvl,{alert:true,st:'chase',tide:e.tide})}return}}
  if(def.ai==='exploder'&&d<1.5){e.st='fuse';e.t=.65;sfx('groan',e.x,e.y,{pitch:1.5});return}
  if(def.aura&&p&&!p.dead&&pd<def.aura.r){e.auraT=(e.auraT||0)-dt;if(e.auraT<=0){e.auraT=1;hurtPlayer(Z,0.01,{dot:1,tox:def.aura.tox})}}
  // ranged: keep a distance, shoot when the line is clear
  if(def.proj){const clear=los(Z,e.x,e.y,t.x,t.y);
    if(clear&&d<=def.reach){e.a=Math.atan2(t.y-e.y,t.x-e.x);if(e.cd<=0){e.st='wind';e.t=def.wind;return}
      if(d<3.2&&!def.rooted){const ang=Math.atan2(e.y-t.y,e.x-t.x);steer(Z,e,e.x+Math.cos(ang)*2,e.y+Math.sin(ang)*2,speed*.8,dt);e.a=ang+Math.PI}return}
    if(def.rooted)return;const s=approach(Z,e,t.x,t.y,speed,dt,t.pl?flow:null);if(s>=0&&def.sd){if(e.cd<=0){e.st='windS';e.t=def.wind;e.sT=s}}return}
  if(def.rooted){e.a=Math.atan2(t.y-e.y,t.x-e.x);if(d<=reach&&e.cd<=0){e.st='wind';e.t=def.wind}return}
  // melee
  // a wall between attacker and target is hit first: nothing strikes through it
  const wc=d<=reach+.6?edgeCross(Z,e.x,e.y,t.x,t.y):-1;
  if(d<=reach&&wc<0){e.a=Math.atan2(t.y-e.y,t.x-e.x);if(e.cd<=0&&(d<1.2||los(Z,e.x,e.y,t.x,t.y))){e.st='wind';e.t=def.wind}return}
  const s=wc>=0&&Z.home?EREF+wc:approach(Z,e,t.x,t.y,speed,dt,t.pl?flow:null);
  if(s>=0){const[sx,sy]=structXY(Z,s);e.a=Math.atan2(sy-e.y,sx-e.x);if(def.sd&&e.cd<=0){e.st='windS';e.t=def.wind;e.sT=s}}
}
function wander(Z,e,dt,speed){
  e.t-=dt;if(e.t<=0){e.t=2+rnd()*5;if(rnd()<.6){const ang=rnd()*TAU,r=1+rnd()*3;e.wx=clamp(e.hx+Math.cos(ang)*r,2,Z.w-2);e.wy=clamp(e.hy+Math.sin(ang)*r,2,Z.h-2)}else e.wx=undefined}
  if(e.wx!==undefined&&dist(e.x,e.y,e.wx,e.wy)>.4){const ox=e.x,oy=e.y;steer(Z,e,e.wx,e.wy,speed,dt);if(Math.hypot(e.x-ox,e.y-oy)<speed*dt*.3)e.wx=undefined}
}
// ---------------------------------------------------------------- the homestead's people at work
// The user: "some animation to show the survivors doing something useful like farming or repairing something or harvesting stuff instead of wandering
// around uselessly all day". A survivor at home walks to the place their job is done and works there: a mechanic to a wall (a damaged one first, which
// they patch while they work), a farmer to the garden beds, a cook to the fire, a medic to the herbalist table; someone resting sits by the fire or
// their bed. `e.work` says what they are doing; the renderer gives them the tool and the motion. The daily output of each job is still worked out
// in world.js; this is the part you can see.
const WORK_AT={sleep:d=>!!d.bed,mech:o=>null,farm:d=>d.special==='garden',cook:d=>d.station==='campfire',medic:d=>d.station==='medic',idle:d=>!!d.bed,guard:d=>d.special==='guard'};
function workTask(Z,e,job){
  const W=Z.w,spots=[];
  if(job==='mech'){
    // walls the player built, the most damaged first; stand in the cell on the reachable side, facing the wall's middle
    const walls=[];for(let k=0;k<Z.ed.length;k++){const w=Z.ed[k];if(!w||!OBJ[w.k]||!OBJ[w.k].cost)continue;walls.push([k,(w.hp||1)/(OBJ[w.k].hp||1)])}
    if(!walls.length)return null;walls.sort((a,b)=>a[1]-b[1]);const pick=walls[Math.min(walls.length-1,Math.floor(rnd()*rnd()*walls.length))][0],t=pick>>1,west=pick&1,x=t%W,y=(t-x)/W;
    const fx=west?x:x+.5,fy=west?y+.5:y,cells=west?[[x,y],[x-1,y]]:[[x,y],[x,y-1]];const c=cells.find(([cx,cy])=>cx>=0&&cy>=0&&!(Z.obj[cy*W+cx]&&OBJ[Z.obj[cy*W+cx].k].solid))||cells[0];
    return{k:'mech',x:c[0]+.5,y:c[1]+.5,fx,fy,edge:pick,r:.55};
  }
  const want=WORK_AT[job]||WORK_AT.idle;for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(o&&OBJ[o.k]&&want(OBJ[o.k]))spots.push(i)}
  if(!spots.length){if(job==='sleep')return{k:'sleep',x:e.x,y:e.y,fx:e.x+Math.cos(e.a||0),fy:e.y+Math.sin(e.a||0),r:9};if(job!=='idle')return workTask(Z,e,'idle');return null}
  const own=job==='sleep'?G.S.surv.findIndex(s=>s.id===e.sv):-1,i=own>=0?spots[own%spots.length]:spots[Math.floor(rnd()*spots.length)],x=i%W,y=(i-x)/W,solid=OBJ[Z.obj[i].k].solid;let sx=x+.5,sy=y+.5;
  if(solid){const n=[[0,1],[1,0],[-1,0],[0,-1]].map(([dx,dy])=>[x+dx,y+dy]).find(([cx,cy])=>!Z.obj[cy*W+cx]&&cx>0&&cy>0&&cx<W-1&&cy<Z.h-1);if(n){sx=n[0]+.5;sy=n[1]+.5}}
  return{k:job==='idle'?'rest':job,x:sx,y:sy,fx:x+.5,fy:y+.5,r:solid?.5:.35,face:job==='sleep'&&!solid?Math.PI/2-(Z.obj[i].r||0)*Math.PI/2:undefined};   // (a sleeper lies along the bedroll)   // (a bedroll is lain on; a solid bed is slept beside)
}
function survivorWork(Z,e,dt){
  const S=G.S,sv=S&&S.surv.find(s=>s.id===e.sv);if(!sv){wander(Z,e,dt,e.def.spd*.3);return}
  // at night everyone off duty sleeps, in a bed if there is one (the user: "they could also be sleeping especially at night"); anything hostile close wakes them
  const h=hourOf(S.t),night=(h>=22||h<6)&&!S.tide.live&&!threatNear(Z,8);
  const job=night?'sleep':sv.hurt>0?'idle':sv.job;e.jt=(e.jt||0)-dt;
  if(!e.task||e.task.job!==job||(e.jt<=0&&(job!=='sleep'||e.stuck>4))){e.task=workTask(Z,e,job);if(e.task){e.task.job=job;e.task.f=field(Z,Math.floor(e.task.x),Math.floor(e.task.y),true,160);
      // a place they cannot get to (behind walls with no door): they do it where they stand instead of circling
      if(!(e.task.f[Math.floor(e.y)*Z.w+Math.floor(e.x)]<1e9))e.task={k:job==='sleep'?'sleep':'rest',job,x:e.x,y:e.y,fx:e.x+1,fy:e.y,r:9}}e.jt=9+rnd()*9;e.stuck=0}
  const T=e.task;if(!T){e.work=null;wander(Z,e,dt,e.def.spd*.3);return}
  const d=dist(e.x,e.y,T.x,T.y);
  if(d>T.r){e.work=null;const a=pathAim(Z,T.f,e.x,e.y,e.r,true)||[T.x,T.y],ox=e.x,oy=e.y;steer(Z,e,a[0],a[1],e.def.spd*.55,dt);
    if(Math.hypot(e.x-ox,e.y-oy)<e.def.spd*dt*.2){e.stuck+=dt;if(e.stuck>4)e.jt=0}else e.stuck=0;return}
  e.work=T.k;e.a=T.face!==undefined?T.face:Math.atan2(T.fy-e.y,T.fx-e.x);if(T.k==='sleep'&&T.face!==undefined){e.x+=(T.x-e.x)*Math.min(1,dt*3);e.y+=(T.y-e.y)*Math.min(1,dt*3)}
  // a mechanic at a damaged wall patches it while you watch
  if(T.k==='mech'){const w=Z.ed[T.edge];if(w&&OBJ[w.k]&&w.hp<OBJ[w.k].hp){w.hp=Math.min(OBJ[w.k].hp,w.hp+dt*1.5)}}
}
function stepAlly(Z,e,dt,p){
  const def=e.def;e.cd-=dt;e.flash-=dt;if(e.atkT>0)e.atkT-=dt;e.mv=0;if(e.stunT>0){e.stunT-=dt;return}
  if(e.sv&&Z.home&&def.ai==='follow'){survivorWork(Z,e,dt);return}
  if(def.ai==='wander'||def.ai==='follow'){if(def.ai==='follow'&&!e.stay&&p&&dist(e.x,e.y,p.x,p.y)>3)steer(Z,e,p.x,p.y,def.spd,dt);else wander(Z,e,dt,def.spd*.3);return}
  const range=def.ai==='guard'?def.reach*(e.far?1.3:1):7;let t=null,td=range;
  for(const a of Z.actors){if(a.team!==1||a.dead||a.def.ai==='flee'||(!a.alert&&def.ai==='pet'))continue;const d=dist(a.x,a.y,e.x,e.y);if(d<td&&(def.ai==='pet'||los(Z,e.x,e.y,a.x,a.y,def.ai==='guard'&&Z.home))){td=d;t=a}}   /* your people at home shoot over your own walls and doors: from inside a closed yard they could not see what was battering it (the user: survivors "should" help defend) */
  if(def.ai==='guard'){if(t){e.a=Math.atan2(t.y-e.y,t.x-e.x);if(e.cd<=0){e.cd=def.cd;e.atkT=.2;fireAt(Z,e,t)}}else if(e.escort&&p&&!p.dead&&dist(e.x,e.y,p.x,p.y)>2.6)steer(Z,e,p.x,p.y,def.spd*1.1,dt);return}   // the group keeps up with the player
  // pet
  if(e.st==='wind'){e.t-=dt;if(e.t<=0){e.st='idle';e.cd=def.cd;e.atkT=.3;if(t&&td<=def.reach+e.r+t.r+.4)strikeTarget(Z,e,t)}return}
  if(t&&p&&dist(t.x,t.y,p.x,p.y)<9){if(td<=def.reach+e.r+t.r){e.a=Math.atan2(t.y-e.y,t.x-e.x);if(e.cd<=0){e.st='wind';e.t=def.wind}}else steer(Z,e,t.x,t.y,def.spd,dt);return}
  if(p){const d=dist(e.x,e.y,p.x,p.y);if(d>16){[e.x,e.y]=freeNear(Z,p.x,p.y,2)}else if(d>2.2)steer(Z,e,p.x,p.y,def.spd*(d>5?1:.6),dt)}
}

// ---------------------------------------------------------------- turrets
function stepTurrets(Z,dt){
  if(Z.cacheT===undefined||Z.navDirty||Z.time-Z.cacheT>2){Z.turrets=[];Z.power=false;Z.obj.forEach((o,i)=>{if(!o)return;const d=OBJ[o.k];if(d.turret)Z.turrets.push(i);if(d.special==='generator'&&o.fuel>0)Z.power=true});Z.cacheT=Z.time}
  const S=G.S,boost=1+perk('turret');
  for(const i of Z.turrets){const o=Z.obj[i];if(!o)continue;const t=OBJ[o.k].turret;o.cd=(o.cd||0)-dt;
    if(t.power?!Z.power:!(o.ammo>=(t.per||1)))continue;
    const x=i%Z.w+.5,y=Math.floor(i/Z.w)+.5;let tg=null,td=t.rng;
    for(const a of Z.actors){if(a.team!==1||a.dead||a.def.ai==='flee')continue;const d=dist(a.x,a.y,x,y);if(d<td&&d>=(t.min||0)&&(t.proj==='nade'||los(Z,x,y,a.x,a.y))){td=d;tg=a}}
    if(!tg)continue;const ang=Math.atan2(tg.y-y,tg.x-x);o.a=ang;if(o.cd>0)continue;o.cd=t.rate;if(!t.power)o.ammo-=t.per||1;
    if(t.proj==='arc'){let cur=tg,px=x,py=y;const seen=[];for(let c=0;c<=t.chain&&cur;c++){emit('fx','arc',px,py,{x:cur.x,y:cur.y});hurt(Z,cur,t.dmg*boost*(c?.6:1),{stun:.3,quiet:1});seen.push(cur);px=cur.x;py=cur.y;let nx=null,nd=3.2;for(const a of Z.actors)if(a.team===1&&!a.dead&&!seen.includes(a)){const d=dist(a.x,a.y,px,py);if(d<nd){nd=d;nx=a}}cur=nx}sfx('zap',x,y)}
    else if(t.proj==='nade'){lob(Z,x,y,tg.x,tg.y,{team:0,dmg:t.dmg*boost,aoe:t.aoe,spd:10});sfx('throw',x,y)}
    else{shoot(Z,x+Math.cos(ang)*.5,y+Math.sin(ang)*.5,ang+(rnd()-.5)*.06,{spd:t.proj==='arrow'?24:t.proj==='flame'?10:36,rng:t.rng+1,team:0,dmg:t.dmg*boost,kind:t.proj,pierce:t.proj==='flame'?5:0,burn:t.burn});
      sfx(t.proj==='arrow'?'bow':t.proj==='flame'?'flame':'turret',x,y,{vol:.6});if(t.noise)noise(Z,x,y,t.noise)}
  }
}

// ---------------------------------------------------------------- frame
export function step(dt){
  const Z=G.Z,S=G.S;if(!Z)return;G.ds=derive(S);if(Z.stop>0){Z.stop-=dt;dt*=.1}Z.time+=dt;
  const p=Z.pl,night=G.night,sightMul=(G.sight||1)*(Z.dark?.8:1);
  stepPlayer(Z,dt);
  const flow=p&&!p.dead?playerField(Z):null;
  const A=Z.actors;let nDead=0;
  for(let i=A.length-1;i>=0;i--){const e=A[i];if(e.pl)continue;
    if(e.dead){e.deadT+=dt;if(e.deadT>(e.team===1?10:2.5)||(e.deadT>2.5&&Z.corpses>22))A.splice(i,1);else nDead++;continue}
    if(e.team===0)stepAlly(Z,e,dt,p);else stepEnemy(Z,e,dt,p,flow,night,sightMul)}
  Z.corpses=nDead;
  // keep bodies apart
  for(let i=0;i<A.length;i++){const a=A[i];if(a.dead||a.st==='pounce')continue;for(let j=i+1;j<A.length;j++){const b=A[j];if(b.dead||b.st==='pounce')continue;const dx=b.x-a.x,dy=b.y-a.y,rr=a.r+b.r;if(Math.abs(dx)>rr||Math.abs(dy)>rr)continue;const d=Math.hypot(dx,dy);if(d>=rr||d<1e-4)continue;
    const push=(rr-d)*.5,nx=dx/d,ny=dy/d,wa=a.pl?.25:a.def&&(a.def.boss||a.def.rooted)?0:1,wb=b.pl?.25:b.def&&(b.def.boss||b.def.rooted)?0:1,tot=wa+wb||1;
    // a shove never carries anyone across a wall: with walls this thin a crowd would otherwise squeeze through them
    const ax=a.x-nx*push*2*wa/tot,ay=a.y-ny*push*2*wa/tot,bx=b.x+nx*push*2*wb/tot,by=b.y+ny*push*2*wb/tot,ed=Z.ed.length>0;
    if(!ed||edgeCross(Z,a.x,a.y,ax,ay,a.team===0)<0){a.x=ax;a.y=ay}if(!ed||edgeCross(Z,b.x,b.y,bx,by,b.team===0)<0){b.x=bx;b.y=by}}}
  stepProjs(Z,dt);stepAreas(Z,dt);if(Z.home)stepTurrets(Z,dt);
  // interaction hint for the HUD
  Z.hintT=(Z.hintT||0)-dt;if(Z.hintT<=0&&p&&!p.dead){Z.hintT=.12;Z.hint=findInteract(Z)}
}

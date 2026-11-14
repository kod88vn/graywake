// The community layer. Your homestead is one settlement among several: people ask to join it, it has to be fed and watered,
// and the other communities can be traded with, allied with, paid off or fought. Pure logic, no DOM.
//   people   candidate / recruit / turnAway / dismiss · svLevel / svMult · available
//   stores   needs (meals and drinks a day against what is in storage)
//   others   known / fac / relOf · gift · callCaravan · openRoute / closeRoute · pact · askVolunteer · tribute · warParty · markCamp / campCleared
//   time     dawn (routes, raids being planned, people waiting) · tick (raids arriving)
//   farm     farm (bed summary) · harvestAll / plantAll / tendAll
// world.js hands over the functions this module needs from it with bind(), so the two files do not import each other.
import {ITEMS} from '../data/items.js';
import {OBJ} from '../data/objects.js';
import {FACTIONS,COMM,relOf} from '../data/community.js';
import {SURV_NAMES,SURV_TRAITS,JOBS} from '../data/progress.js';
import {G,toast,sfx,stat,count,take,give,homeStores,addXp,perk} from './core.js';
import {clamp,rnd,dayOf} from './util.js';

let W={};
/** world.js passes in: addSurvivor, survCap, pile, ambush, addSite, defence, raidBase, maxRegion, homeHas, harvest, plant. */
export function bind(api){W=api}
export {relOf};

// ---------------------------------------------------------------- log
/** Put a line in the community log (Camp ledger) and show it. tone: 'good' | 'bad' | 'info'. */
export function note(S,txt,tone='info'){S.clog.unshift({d:dayOf(S.t),x:txt,k:tone});if(S.clog.length>14)S.clog.length=14;toast(txt,tone)}

// ---------------------------------------------------------------- people
export const svLevel=sv=>Math.min(5,1+Math.floor(Math.sqrt((sv.xp||0)/4)));
/** How much more a practised survivor gets done: +15% a level. */
export const svMult=sv=>1+.15*(svLevel(sv)-1);
/** Fit to work or fight today: not hurt, not already out. */
export const available=sv=>!(sv.hurt>0)&&!sv.away;
const fightPower=sv=>2+.5*(svLevel(sv)-1)+(sv.trait==='shot'||sv.trait==='tough'?1:0);
/** Someone asks to join. They wait at the fence for a few days; the player decides in the Camp ledger. */
export function candidate(S,how='came in off the road'){
  if(S.wait.length>=COMM.waitMax){const gone=S.wait.shift();note(S,gone.n+' could not wait any longer and moved on','info')}
  const used=new Set([...S.surv.map(s=>s.n),...S.wait.map(s=>s.n)]),names=SURV_NAMES.filter(n=>!used.has(n)),traits=Object.keys(SURV_TRAITS);
  const c={id:++S.survN,n:names[Math.floor(rnd()*names.length)]||'Stranger',trait:traits[Math.floor(rnd()*traits.length)],until:S.t+COMM.waitDays*1440,how};
  S.wait.push(c);note(S,c.n+' '+how+' and asks to join you. '+(W.survRoom&&S.surv.length>=3?'Your homestead already has the three people it can support: they will wait a few days in case one of yours leaves.':'Decide in the Camp ledger, under People.'),'good');sfx('quest');return c;
}
export function recruit(S,cid){
  const i=S.wait.findIndex(c=>c.id===cid);if(i<0)return null;
  if(S.surv.length>=W.survRoom(S)){toast(S.surv.length>=3?'A homestead supports three people besides you, and yours is full':'No room: build a bed (Build, Base). Every bed beyond your own houses one more person, and one can sleep by the fire.','bad');sfx('error');return null}
  const c=S.wait.splice(i,1)[0],sv=W.addSurvivor(S,c);if(sv){note(S,sv.n+' joins the homestead','good');stat('recruited')}return sv;
}
export function turnAway(S,cid){const i=S.wait.findIndex(c=>c.id===cid);if(i<0)return false;const c=S.wait.splice(i,1)[0];toast(c.n+' nods and walks back down the road','info');return true}
/** Ask a survivor to leave. Their trade route, if any, closes. */
export function dismiss(S,id){
  const i=S.surv.findIndex(s=>s.id===id);if(i<0)return false;const sv=S.surv.splice(i,1)[0];endRouteOf(S,sv.id);S.morale=clamp(S.morale-3,0,100);note(S,sv.n+' packs up and leaves at your asking','info');
  if(G.Z&&G.Z.home)for(const a of G.Z.actors)if(a.sv===sv.id)a.dead=true;return true;
}
function endRouteOf(S,svId){for(const id in S.fac){const r=S.fac[id].route;if(r&&r.sv===svId){S.fac[id].route=null;note(S,'The trade route to '+FACTIONS[id].n+' has no runner and closes','bad')}}}
/** A survivor is lost for good (killed on a raid). */
function lose(S,sv){const i=S.surv.indexOf(sv);if(i>=0)S.surv.splice(i,1);endRouteOf(S,sv.id);S.morale=clamp(S.morale-8,0,100);stat('survLost')}

// ---------------------------------------------------------------- stores
const edible=(it,key)=>it.t==='food'&&!it.risk&&!it.buff&&(it[key]||0)>=8;
/** What the group eats and drinks a day against what the storage boxes hold. */
export function needs(S){
  const people=S.surv.length,meals=S.surv.reduce((a,s)=>a+(s.trait==='glutton'?2:1),0);let food=0,water=0;
  const skip={};for(const b of homeStores(S))for(const s of b.inv){if(!s)continue;const it=ITEMS[s.id];if(!it)continue;if(edible(it,'food'))food+=s.n;else if(edible(it,'water'))water+=s.n;else if(it.t==='food')skip[s.id]=(skip[s.id]||0)+s.n}
  return{people,meals,drinks:people,food,water,skip,foodDays:meals?food/meals:Infinity,waterDays:people?water/people:Infinity};
}

// ---------------------------------------------------------------- the others
/** State of one community, created the first time it is asked for. */
export function fac(S,id){const F=FACTIONS[id];if(!F)return null;return S.fac[id]||(S.fac[id]={st:F.start,str:F.str,route:null,pact:false,giftDay:-1,gift:0,raidAt:0,volAt:0,carAt:0,met:false,dead:false})}
/** Communities you have heard of: those in regions you can reach, one region further with a radio. */
export function known(S){const reach=W.maxRegion(S)+(W.homeHas(S,'radio')?1:0);return Object.keys(FACTIONS).filter(id=>FACTIONS[id].reg<=reach)}
export const atWar=fs=>!fs.dead&&fs.st<=-50;
function shift(S,id,n){
  const F=FACTIONS[id],fs=fac(S,id),was=fs.st;fs.st=clamp(Math.round((fs.st+n)*10)/10,-100,F.cap);
  if(was>-50&&fs.st<=-50)note(S,F.n+' now counts you an enemy','bad');else if(was<=-50&&fs.st>-50)note(S,F.n+' calls off its raids, for now','good');
  if(fs.pact&&fs.st<COMM.pactAt-15){fs.pact=false;note(S,'Your pact with '+F.n+' is over','bad')}
  if(fs.route&&fs.st<COMM.routeAt-15){fs.route=null;note(S,F.n+' closes its gate to your runner: the trade route is gone','bad')}
  return fs.st;
}
/** How the rest take it when you hit one of them: glad if it was a raider crew, alarmed if it was a neighbour. */
function reaction(S,id,scale=1){for(const o of known(S)){if(o===id||fac(S,o).dead)continue;shift(S,o,FACTIONS[id].hostile?4*scale:-10*scale)}}
function goToWar(S,id){const fs=fac(S,id);if(fs.st>-50){shift(S,id,Math.min(-40,-55-fs.st))}else shift(S,id,-5)}
function checkBroken(S,id){
  const F=FACTIONS[id],fs=fac(S,id);if(fs.dead||fs.str>0)return false;fs.str=0;fs.dead=true;fs.route=null;fs.pact=false;fs.raidAt=0;
  S.scrip+=60;addXp(S,300);stat('broken');note(S,F.n+' is broken. Whoever is left has scattered. +60 scrip from what they left behind.','good');reaction(S,id,2.5);return true;
}
/** Standing gained by giving a stack: its trade value, doubled for something they prize. */
export const giftWorth=(id,itemId,n)=>ITEMS[itemId].v*n*COMM.giftPerScrip*(FACTIONS[id].likes.includes(itemId)?2:1);
function takeGift(S,id,worth){
  const fs=fac(S,id),day=dayOf(S.t);if(fs.giftDay!==day){fs.giftDay=day;fs.gift=0}const room=COMM.giftDayCap-fs.gift;
  if(room<=0){toast(FACTIONS[id].n+' has taken all it will take today','info');return 0}const g=Math.min(room,worth);fs.gift+=g;shift(S,id,g);stat('gifts');sfx('coin');return g;
}
/** Give scrip (what: a number) or one stack from the pack (what: {i: pack slot}). */
export function gift(S,id,what){
  const F=FACTIONS[id],fs=fac(S,id);if(!F||fs.dead)return false;
  if(fs.gift>=COMM.giftDayCap&&fs.giftDay===dayOf(S.t)){toast(F.n+' has taken all it will take today','info');return false}
  if(typeof what==='number'){if(S.scrip<what){toast('Not enough scrip','bad');sfx('error');return false}S.scrip-=what;const g=takeGift(S,id,what*COMM.giftPerScrip);toast(F.n+': standing +'+Math.round(g*10)/10,'good');return true}
  const s=S.p.inv[what.i];if(!s)return false;const it=ITEMS[s.id];if(it.v<=0){toast('They have no use for that','info');return false}
  const g=takeGift(S,id,giftWorth(id,s.id,s.n));if(g<=0)return false;S.p.inv[what.i]=null;toast(F.n+' takes the '+it.n.toLowerCase()+': standing +'+Math.round(g*10)/10,'good');return true;
}
/** Their caravan comes to your gate: a trader with their goods, cheaper the better they like you. Once a day, from home. */
export function callCaravan(S,id){
  const F=FACTIONS[id],fs=fac(S,id);if(fs.dead||fs.st<-15||!F.stock.length){toast(F.n+' will not trade with you','bad');return false}
  if(!(G.Z&&G.Z.home)){toast('Their caravan comes to your gate: call it from home','info');return false}
  if(fs.carAt===dayOf(S.t)){toast('Their caravan has already been today','info');return false}fs.carAt=dayOf(S.t);
  const k=(1.2-fs.st/250)*(1-perk('haggle')),pool=F.stock.filter(x=>ITEMS[x]),stock=[];
  for(const x of pool){if(stock.length>=8)break;if(rnd()<.85){const v=ITEMS[x].v;stock.push({id:x,n:Math.max(1,Math.round((v<4?14:v<12?6:v<40?3:1)*(.6+rnd()*.8))),p:Math.max(1,Math.ceil(v*2.2*k))})}}
  S.trader={until:S.t+6*60,stock,fac:id};sfx('door');toast(F.n+"'s caravan is at your gate for 6 hours: trade from this sheet, or from their line in the Camp ledger",'good');return true;
}
/** Start a standing trade run to a friendly community. One survivor walks it every day and brings back goods and scrip. */
export function openRoute(S,id,svId){
  const F=FACTIONS[id],fs=fac(S,id),sv=S.surv.find(s=>s.id===svId);if(fs.dead||!F.route.length)return false;
  if(fs.route){toast('There is already a route to '+F.n,'info');return false}
  if(fs.st<COMM.routeAt){toast(F.n+' does not trust you enough yet (standing '+COMM.routeAt+')','bad');return false}
  if(!sv||!available(sv)||routeOf(S,sv.id)){toast('Pick someone who is fit and not already on a run','bad');return false}
  if(S.scrip<COMM.routeCost){toast('Opening a route costs '+COMM.routeCost+' scrip in gifts and gear','bad');sfx('error');return false}
  const was=sv.job&&sv.job!=='idle'&&JOBS[sv.job]?JOBS[sv.job].n.toLowerCase():null;S.scrip-=COMM.routeCost;fs.route={sv:svId,since:dayOf(S.t),n:0};sv.job='idle';note(S,sv.n+' starts the daily run to '+F.n+(was?', and is no longer your '+was+(was==='guard'?': nobody of yours takes that post in a tide now unless you give someone the job':''):''),was?'bad':'good');stat('routes');return true;
}
export function closeRoute(S,id){const fs=fac(S,id);if(!fs.route)return false;fs.route=null;toast('Route to '+FACTIONS[id].n+' closed','info');return true}
/** The community a survivor runs to, or null. */
export const routeOf=(S,svId)=>{for(const id in S.fac){const r=S.fac[id].route;if(r&&r.sv===svId)return id}return null};
/** Stand together: they send fighters when a tide lands on you, and will send volunteers if asked. */
export function pact(S,id){
  const F=FACTIONS[id],fs=fac(S,id);if(fs.dead||fs.pact)return false;if(fs.st<COMM.pactAt){toast(F.n+' is not ready to tie itself to you (standing '+COMM.pactAt+')','bad');return false}
  fs.pact=true;note(S,'You and '+F.n+' agree to stand together. They will send fighters when a tide lands.','good');stat('pacts');return true;
}
export function askVolunteer(S,id){
  const F=FACTIONS[id],fs=fac(S,id);if(!fs.pact){toast('Only an ally sends people','bad');return false}
  if(S.t<fs.volAt){toast(F.n+' has nobody to spare for another '+Math.ceil((fs.volAt-S.t)/1440)+' days','info');return false}
  if(S.scrip<COMM.volunteerCost){toast('They ask '+COMM.volunteerCost+' scrip for the family left behind','bad');sfx('error');return false}
  S.scrip-=COMM.volunteerCost;fs.volAt=S.t+COMM.volunteerDays*1440;candidate(S,'walked over from '+F.n);return true;
}
export const tributeCost=(S,id)=>COMM.tribute+Math.round(fac(S,id).str/2);
/** Pay an unfriendly community to back off. */
export function tribute(S,id){
  const F=FACTIONS[id],fs=fac(S,id);if(fs.dead||fs.st>=-15)return false;const c=tributeCost(S,id);if(S.scrip<c){toast('They want '+c+' scrip','bad');sfx('error');return false}
  S.scrip-=c;fs.raidAt=0;shift(S,id,COMM.tributeGain);stat('tribute',c);note(S,'You pay '+F.n+' '+c+' scrip. They take it and leave you be, for a while.','info');return true;
}
/** Send your people against another community. Takes them out for the day. Returns {won, lines} or null. */
export function warParty(S,id,n){
  const F=FACTIONS[id],fs=fac(S,id);if(fs.dead)return null;
  const pool=S.surv.filter(sv=>available(sv)&&!routeOf(S,sv.id)).sort((a,b)=>fightPower(b)-fightPower(a)),party=pool.slice(0,Math.max(0,n));
  if(!party.length){toast('Nobody is free to send','bad');sfx('error');return null}
  const power=party.reduce((a,sv)=>a+fightPower(sv),0),mine=power*(.8+rnd()*.5),theirs=fs.str/9*(.8+rnd()*.5),won=mine>=theirs,lines=[];
  goToWar(S,id);reaction(S,id);
  for(const sv of party)sv.away=1;
  if(won){const dmg=COMM.partyHit+Math.round(power);fs.str=Math.max(0,fs.str-dmg);const sc=10+Math.floor(rnd()*20);S.scrip+=sc;lines.push('+'+sc+' scrip');
    for(const[it,a,b]of F.spoils)if(rnd()<.7){const q=Math.round(a+rnd()*(b-a));W.pile(S,it,q);lines.push('+'+q+' '+ITEMS[it].n)}
    for(const sv of party)if(rnd()<COMM.partyHurtWin){sv.hurt=2;lines.push(sv.n+' came back hurt')}
    S.morale=clamp(S.morale+3,0,100);stat('warWins');note(S,'Your people hit '+F.n+' and came back with what they could carry'+(lines.length?' ('+lines.slice(0,3).join(', ')+')':''),'good');
  }else{fs.str=Math.max(0,fs.str-4);
    for(const sv of[...party]){const r=rnd();if(r<COMM.partyDie){lose(S,sv);lines.push(sv.n+' did not come back')}else if(r<COMM.partyDie+COMM.partyHurtLose){sv.hurt=3;lines.push(sv.n+' came back hurt')}}
    S.morale=clamp(S.morale-6,0,100);note(S,F.n+' drove your people off'+(lines.length?': '+lines.join(', '):''),'bad')}
  stat('warParties');checkBroken(S,id);return{won,lines};
}
/** Find their forward camp so you can hit it yourself: puts a site on the map. */
export function markCamp(S,id){
  const F=FACTIONS[id],fs=fac(S,id);if(fs.dead)return null;if(S.sites.some(s=>s.fac===id)){toast('Their camp is already marked on your map','info');return null}
  if(W.maxRegion(S)<F.reg){toast('You cannot reach '+F.n+' country yet','bad');return null}
  const s=W.addSite(S,id==='choir'?'choir_camp':'war_camp',F.reg);if(!s){toast('Your map is too crowded to follow another lead','bad');return null}
  s.fac=id;s.x=clamp(F.x+(rnd()-.5)*70,30,970);s.y=clamp(F.y+(rnd()-.5)*70,25,615);s.lvl=Math.max(s.lvl,Math.round(4+fs.str/6));toast(F.n+' forward camp marked on the map','info');return s;
}
/** Called when the player clears a marked camp. */
export function campCleared(S,id){
  const F=FACTIONS[id],fs=fac(S,id);if(fs.dead)return;goToWar(S,id);reaction(S,id);fs.str=Math.max(0,fs.str-COMM.campHit);
  for(const[it,a,b]of F.spoils)give(S,it,Math.round(a+rnd()*(b-a)));stat('campsCleared');note(S,'You burn out the '+F.n+' camp. They are weaker for it.','good');checkBroken(S,id);
}

// ---------------------------------------------------------------- time
function raidTable(S,id){
  const F=FACTIONS[id],fs=fac(S,id),m=.4+fs.str/150+dayOf(S.t)/40,t={};let tot=0;
  for(const k in F.raid){const n=Math.max(1,Math.round(F.raid[k]*m));t[k]=n;tot+=n}
  if(tot>14)for(const k in t)t[k]=Math.max(1,Math.round(t[k]*14/tot));return t;
}
function runRaid(S,id){
  const F=FACTIONS[id],fs=fac(S,id),table=raidTable(S,id);let n=0;for(const k in table)n+=table[k];
  if(G.Z&&G.Z.home&&G.Z.pl&&!G.Z.pl.dead){W.ambush(table,true);fs.str=Math.max(0,fs.str-COMM.raidHit);stat('raidsFaced');note(S,F.n+' raiders are at your fence: '+n+' of them','bad');checkBroken(S,id);return}
  const atk=n*14*(1+dayOf(S.t)*.04),ratio=atk/(W.defence(S)+8);
  if(ratio<1){fs.str=Math.max(0,fs.str-COMM.raidHit);S.morale=clamp(S.morale+2,0,100);note(S,'A '+F.n+' raid broke on your defences while you were away','good');checkBroken(S,id);return}
  let stolen=0;const want=Math.min(4,1+Math.floor(ratio));for(const b of homeStores(S))for(let i=0;i<b.inv.length&&stolen<want;i++)if(b.inv[i]&&rnd()<.5){b.inv[i]=null;stolen++}
  const lost=W.raidBase(S,clamp(ratio*.08,.02,.25),true);S.morale=clamp(S.morale-5,0,100);
  note(S,F.n+' raided the homestead while you were away: '+stolen+' stack'+(stolen===1?'':'s')+' taken'+(lost?', '+lost+' structure'+(lost===1?'':'s')+' wrecked':''),'bad');
}
/** Every dawn: people waiting give up, trade runs come home, enemies plan raids, the hurt mend. */
export function dawn(S){
  const day=dayOf(S.t);
  for(let i=S.wait.length-1;i>=0;i--)if(S.wait[i].until<=S.t){const c=S.wait.splice(i,1)[0];note(S,c.n+' gave up waiting at your fence and moved on','info')}
  const medics=S.surv.filter(s=>s.job==='medic'&&available(s)).length;
  for(const sv of S.surv){sv.away=0;if(sv.hurt>0){sv.hurt=Math.max(0,sv.hurt-1-(medics?1:0));if(!sv.hurt)toast(sv.n+' is back on their feet','good')}}
  const ids=known(S),wars=ids.filter(id=>atWar(fac(S,id))).length,guards=S.surv.filter(s=>s.job==='guard').length;
  for(const id of ids){const F=FACTIONS[id],fs=fac(S,id);
    if(!fs.met){fs.met=true;S.clog.unshift({d:day,x:'Word reaches you of '+F.n+'. '+F.d,k:'info'});toast('You hear of '+F.n+': see the Camp ledger, Neighbours','info')}
    if(fs.dead)continue;
    if(fs.route){const sv=S.surv.find(s=>s.id===fs.route.sv);
      if(!sv){fs.route=null;note(S,'The trade route to '+F.n+' has no runner and closes','bad')}
      else if(sv.hurt>0)toast(sv.n+' is laid up: no run to '+F.n+' today','info');
      else{let risk=Math.max(.02,COMM.routeRisk+wars*COMM.routeWarRisk-guards*COMM.routeGuard);if(sv.trait==='lucky')risk*=.5;
        if(rnd()<risk){S.morale=clamp(S.morale-2,0,100);stat('routeLost');if(rnd()<.5){sv.hurt=2;note(S,sv.n+' was jumped on the '+F.n+' road: the load is gone and they are hurt','bad')}else note(S,sv.n+' was jumped on the '+F.n+' road and came home empty-handed','bad')}
        else{const m=(.8+fs.st/200)*(1+S.veh*.08)*svMult(sv);let got=[];for(const[it,a,b]of F.route){const q=Math.round((a+rnd()*(b-a))*m);if(q>0){W.pile(S,it,q);got.push(q+' '+ITEMS[it].n.toLowerCase())}}
          const sc=Math.round((F.scrip[0]+rnd()*(F.scrip[1]-F.scrip[0]))*m);S.scrip+=sc;stat('earned',sc);stat('routeRuns');fs.route.n++;sv.xp=(sv.xp||0)+1;if(fs.route.n%2===0)shift(S,id,1);
          S.clog.unshift({d:day,x:sv.n+' came back from '+F.n+' with '+got.join(', ')+' and '+sc+' scrip',k:'good'})}}}
    if(fs.pact&&rnd()<.25)shift(S,id,.5);
    if(atWar(fs)&&day>=COMM.raidFrom&&!fs.raidAt&&rnd()<COMM.raidChance){fs.raidAt=S.t+120+rnd()*480;if(W.homeHas(S,'radio'))note(S,'Radio: a '+F.n+' party is on the road toward you. A few hours.','bad')}
  }
  if(S.clog.length>14)S.clog.length=14;
  const nd=needs(S);if(nd.people&&(nd.foodDays<2||nd.waterDays<2))toast('Stores are low: '+(nd.foodDays<2?'food for '+Math.floor(nd.foodDays)+' day'+(Math.floor(nd.foodDays)===1?'':'s'):'')+(nd.foodDays<2&&nd.waterDays<2?', ':'')+(nd.waterDays<2?'water for '+Math.floor(nd.waterDays)+' day'+(Math.floor(nd.waterDays)===1?'':'s'):''),'bad');
}
/** Called as the clock moves: raids that were on the road arrive. A raid waits out a tide. */
export function tick(S){
  for(const id in S.fac){const fs=S.fac[id];if(fs.raidAt&&S.t>=fs.raidAt){if(S.tide.live){fs.raidAt=S.t+120;continue}fs.raidAt=0;if(!fs.dead&&atWar(fs))runRaid(S,id)}}
}
/** Fighters an ally sends when a tide lands at home: [[community id, how many]]. */
export function allies(S){return Object.keys(S.fac).filter(id=>S.fac[id].pact&&!S.fac[id].dead).map(id=>[id,2])}

// ---------------------------------------------------------------- farm
/** A summary of the garden beds at home: counts and what is growing. */
export function farm(S){
  const out={beds:0,empty:0,growing:0,ripe:0,dry:0,unfed:0,crops:{},next:Infinity};
  S.home.obj.forEach(o=>{if(!o||!OBJ[o.k]||OBJ[o.k].special!=='garden')return;out.beds++;if(!o.seed){out.empty++;return}
    const c=out.crops[o.seed]||(out.crops[o.seed]={n:0,ripe:0});c.n++;if(S.t>=o.ripe){out.ripe++;c.ripe++}else{out.growing++;out.next=Math.min(out.next,o.ripe-S.t);if(!o.wet)out.dry++;if(!o.fert)out.unfed++}});
  return out;
}
const atHome=()=>G.Z&&G.Z.home;
const eachBed=(S,fn)=>{const Z=G.Z;for(let i=0;i<Z.obj.length;i++){const o=Z.obj[i];if(o&&OBJ[o.k]&&OBJ[o.k].special==='garden')fn(o,i)}};
export function harvestAll(S){if(!atHome()){toast('You have to be home to work the beds','info');return 0}let n=0;eachBed(S,(o,i)=>{if(o.seed&&S.t>=o.ripe){W.harvest(G.Z,i);n++}});toast(n?'Harvested '+n+' bed'+(n===1?'':'s'):'Nothing is ripe','info');return n}
export function plantAll(S,seedId){if(!atHome()){toast('You have to be home to work the beds','info');return 0}let n=0;eachBed(S,(o,i)=>{if(!o.seed&&count(S,seedId)>0&&W.plant(G.Z,i,seedId))n++});toast(n?'Planted '+n+' bed'+(n===1?'':'s')+' with '+ITEMS[seedId].n.toLowerCase():'No empty bed, or no seed','info');return n}
/** Water (a quarter off the time left) or compost (half again the yield) one bed. Once per crop each. */
export function tend(S,o,i,kind){
  if(!o.seed||S.t>=o.ripe)return false;
  if(kind==='water'){if(o.wet)return false;if(!take(S,'water',1)&&!take(S,'dirty_water',1))return false;o.wet=1;o.ripe-=(o.ripe-S.t)*.25}
  else{if(o.fert||!take(S,'compost',1))return false;o.fert=1}
  if(atHome())G.Z.touch(i);return true;
}
export function tendAll(S,kind){if(!atHome()){toast('You have to be home to work the beds','info');return 0}let n=0;eachBed(S,(o,i)=>{if(tend(S,o,i,kind))n++});
  toast(n?(kind==='water'?'Watered ':'Composted ')+n+' bed'+(n===1?'':'s'):kind==='water'?'Nothing to water, or no water in your pack':'Nothing to compost, or no compost in your pack','info');if(n)sfx('rustle');return n}

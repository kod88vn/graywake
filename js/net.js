// A shared world (docs/MULTIPLAYER.md). Off unless the page is given a world server: ?world=http://127.0.0.1:8795 (remembered in this
// browser; ?world=off forgets it). The game stays a single-player simulation: every few seconds this reports the enclave's deeds (tides held
// and lost, deaths, strongrooms opened) and takes back the world's news (stage, standings, the leads everyone hears, whether the enclave has
// fallen and been moved on). Nothing here is needed to play, and the published artifact, which has no server, never runs it.
import {G,toast} from './sim/core.js';
import * as World from './sim/world.js';
import {dayOf} from './sim/util.js';
const KEY='graywake.world',EVERY=7000;
export const Net={url:null,name:'',kind:'human',pick:'',state:'off',err:'',worlds:[],busy:false,
  init(){
    const q=new URLSearchParams(location.search);let u=q.get('world');
    try{if(u==='off'){localStorage.removeItem(KEY);u=null}else if(u)localStorage.setItem(KEY,u);else u=localStorage.getItem(KEY)}catch(e){}
    this.url=u?u.replace(/\/+$/,''):null;this.name=(q.get('enclave')||'').slice(0,24);this.kind=q.get('kind')==='bot'?'bot':'human';this.pick=q.get('join')||'';
    if(!this.url)return;this.state='joining';setInterval(()=>this.tick(),EVERY);this.list();
    // a deed is told to the world at once, not at the next round: the hold should move while the tide's last body is still warm
    setInterval(()=>{const d=G.S&&G.S.net&&G.S.net.token&&G.S.deeds;if(d&&(d.held||d.lost||d.deaths||d.leads.length))this.tick()},1200)},
  async call(path,body){const r=await fetch(this.url+path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined);if(!r.ok)throw new Error('world server said '+r.status);return r.json()},
  /** The worlds there are, for the title screen. */
  async list(){if(!this.url)return[];try{this.worlds=await this.call('/api/worlds');this.err=''}catch(e){this.err='The world server is not answering';this.worlds=[]}return this.worlds},
  /** Report and listen. Joins first if this save has no pass to a world on this server (a new game, or the world was deleted). */
  async tick(){
    const S=G.S;if(!this.url||this.busy||!S||G.mode==='menu')return;this.busy=true;
    try{
      if(!S.net||S.net.url!==this.url||!S.net.token){
        let wid=this.pick;if(wid==='new')wid=(await this.call('/api/worlds',{})).id;this.pick='';
        const j=await this.call('/api/join',{world:wid||undefined,name:this.name||(this.kind==='bot'?'Bot camp':'Your enclave'),kind:this.kind});
        S.net={url:this.url,world:j.world.id,enclave:j.enclave,token:j.token,name:j.name,kind:this.kind,heard:(S.net&&S.net.heard)||{}};S.deeds={held:0,lost:0,deaths:0,leads:[]};
        World.worldNews(S,j.world,{name:j.name,hold:60,score:0,rank:j.world.enclaves.length,of:j.world.enclaves.length});toast('You are in '+j.world.name+', with '+(j.world.enclaves.length-1)+' other enclaves. O shows the world','info');G.ev.push(['save'])}
      const d=S.deeds,sent={held:d.held,lost:d.lost,deaths:d.deaths,leads:d.leads.slice()};
      const r=await this.call('/api/sync',{world:S.net.world,enclave:S.net.enclave,token:S.net.token,report:{t:S.t,day:dayOf(S.t),level:S.p.lvl,deeds:sent}});
      if(r.gone){S.net.token=null;this.state='joining';return}
      d.held-=sent.held;d.lost-=sent.lost;d.deaths-=sent.deaths;d.leads=d.leads.filter(x=>!sent.leads.includes(x));
      // what the world has been told is written down at once, so a save never holds deeds the world has already counted
      if(sent.held||sent.lost||sent.deaths||sent.leads.length)G.ev.push(['save']);
      // the fall is written into the save at once and shown as soon as nothing else is on screen (it once arrived under a death sheet and was never applied)
      if(r.moved){Object.assign(S.net,{world:r.moved.world,enclave:r.moved.enclave,token:r.moved.token,name:r.moved.name,heard:{},exile:{from:r.moved.from,to:r.world.name,world:r.world,you:r.you}});G.ev.push(['save']);this.state='on';return}
      if(S.net.exile)return;   // nothing more from the new world until the move has been made
      World.worldNews(S,r.world,r.you);this.state='on';this.err='';
    }catch(e){this.state='down';this.err=String(e&&e.message||e)}
    finally{this.busy=false}},
};

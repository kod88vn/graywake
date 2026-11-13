#!/usr/bin/env node
// The bot's hands and eyes as MCP tools (stdio, JSON-RPC, no dependencies). Each tool call is forwarded to the running session
// (tools/bot/session.mjs) over HTTP. This is all a player model is given: it has no shell and no files.
import readline from 'node:readline';
const BASE=process.env.GRAYWAKE_BOT_URL||'http://127.0.0.1:8777';
const str=(d)=>({type:'string',description:d}),numb=(d)=>({type:'number',description:d});
const T=(name,description,properties={},required=[])=>({name,description,inputSchema:{type:'object',properties,required,additionalProperties:false}});
const DIR='One of n, ne, e, se, s, sw, w, nw. North is up the screen.';
const TOOLS=[
  T('look','Read the screen: your state, what is around you, any open sheet, and the numbered list of things you can click. Set picture to true to also get the actual picture of the screen; do that every few moves and whenever the text surprises you, because some bugs can only be seen.',{picture:{type:'boolean',description:'Also return the screenshot.'},full:{type:'boolean',description:'Longer lists and the whole text of an open sheet.'}}),
  T('walk','Hold a direction for some seconds (WASD). Stops early if something blocks you or something important happens.',{direction:str(DIR),seconds:numb('0.2 to 8. Default 1.5. You cover about 4 tiles a second.')},['direction']),
  T('goto','Walk to a tile, or to the nearest thing with a name (e.g. "birch", "crate", "campfire"), finding the way round obstacles. Stops next to solid things, ready for `use`.',{target:str('A name from the "Around you" list, or "X Y" tile numbers.')},['target']),
  T('use','Press E: gather, search, open, use whatever is in reach (the line "In reach — E would: ..." says what). Gathering keeps going until the thing is used up.',{seconds:numb('Longest time to keep gathering. Default 10.')}),
  T('attack','Fight the nearest hostile thing: walks round walls and closes to the reach of the weapon in hand, then aims the mouse at it and holds the attack button. Nothing is attacked through a wall. By default only what has noticed you (or stands within a few steps) is fought, so you are not led into a pack that has not seen you.',{seconds:numb('0.3 to 12. Default 3.'),hunt:{type:'boolean',description:'Also go after the nearest enemy that has NOT noticed you. Needed to finish clearing a place; expect its neighbours to join in.'}}),
  T('flee','Run for it. Switches Auto off, runs to the way out that is nearest and farthest from the enemy without stopping for blows, and leaves the place. Use it when health is under two fifths and the fight is not nearly won, when more come than you counted on, or when you have no medicine left. Living is worth more than any haul: the place usually stays on the map and you can come back stronger.',{}),
  T('dodge','Roll (Space), optionally in a direction. You cannot be hit during the roll.',{direction:str(DIR)}),
  T('sneak','Hold or release Shift: slower, and much harder for enemies to notice.',{on:{type:'boolean'}},['on']),
  T('key','Press a keyboard key. i pack · c craft by hand · b build mode · j journal · l camp ledger · m leave area (at the edge) · f auto mode on/off · q swap weapon · r rotate (build) · 1 2 3 4 quick heal/eat/drink/antidote · esc close · tab pack.',{key:str('One key name.'),seconds:numb('How long to let the game run afterwards. Default 0.45.')},['key']),
  T('tap','Click something from the latest "Clickable now" list, by its label text (safest: the numbers change whenever the screen changes) or by its number.',{text:str('Part of the label, enough to be the only match, e.g. "MAKE — Stone Pickaxe" or "Stick Wall".'),n:numb('Or the number in square brackets from your most recent result.')}),
  T('tile','Click the ground at a tile: in build mode this places, moves, upgrades or removes. For walls and doors give the side of the cell (n, e, s, w).',{x:numb('tile x'),y:numb('tile y'),side:str('n, e, s or w: only for walls and doors.')},['x','y']),
  T('dragtile','Press on one tile and drag to another: in build mode with a wall selected this runs a straight line of wall.',{x1:numb(''),y1:numb(''),x2:numb(''),y2:numb(''),side:str('n, e, s or w')},['x1','y1','x2','y2']),
  T('click','Click at page pixels (the screen is 1280 × 720). Only for things that have no number, such as a point on the map.',{x:numb(''),y:numb(''),button:str('left (default) or right')},['x','y']),
  T('scroll','Turn the mouse wheel: scrolls an open sheet, or zooms the camera when none is open.',{amount:numb('Positive scrolls down. Default 300.')}),
  T('wait','Let time pass without doing anything (for example while Auto mode works, or while something cooks). Ends early if something important happens.',{seconds:numb('0.5 to 30. Default 5.')}),
  T('report_bug','File a bug: something broken, wrong, stuck, impossible, misleading or ugly. The session attaches the picture, the save and your last moves by itself. Report as soon as you see it; do not wait.',{severity:{type:'string',enum:['minor','major','blocker'],description:'blocker: cannot go on. major: something does not work. minor: wrong but playable.'},title:str('One line: what is wrong.'),details:str('What you did, what you expected, what happened instead.')},['severity','title','details']),
  T('suggest','Record an idea that would make the game better: something confusing, tedious, unfair, missing or dull, and what you would change.',{text:str('The idea.')},['text']),
  T('note','Write a line in the session journal (what you are trying, what you learned). People watching read it.',{text:str('')},['text']),
  T('notebook','Your memory between shifts. With text: replace the whole notebook (what you know, where you are, what to do next: at most a page). Without: read it.',{text:str('The whole new notebook.')}),
];
const call=async(name,a)=>{
  let cmd=name,args=[];
  if(name==='look'){if(a.full)args.push('full');if(a.picture)args.push('picture')}
  else if(name==='walk')args=[a.direction,a.seconds??''];else if(name==='goto')args=String(a.target).trim().split(/[\s,]+/);else if(name==='use')args=[a.seconds??''];else if(name==='attack')args=[a.seconds??3,a.hunt?'hunt':''];
  else if(name==='dodge')args=[a.direction??''];else if(name==='sneak')args=[a.on?'on':'off'];else if(name==='key')args=[a.key,a.seconds??''];else if(name==='tap')args=a.text?[a.text]:[a.n];
  else if(name==='tile')args=[a.x,a.y,a.side??''];else if(name==='dragtile')args=[a.x1,a.y1,a.x2,a.y2,a.side??''];else if(name==='click')args=[a.x,a.y,a.button??''];else if(name==='scroll')args=[a.amount??''];else if(name==='wait')args=[a.seconds??''];
  else if(name==='report_bug'){cmd='bug';args=[a.severity,a.title+' :: '+(a.details||'')]}else if(name==='suggest'){cmd='idea';args=[a.text]}else if(name==='note')args=[a.text];else if(name==='notebook')args=a.text?[a.text]:[];
  const r=await (await fetch(BASE+'/api/cmd',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:cmd,args:args.map(String).filter((v,i,l)=>v!==''||i<l.length-1),who:'bot'})})).json();
  const content=[{type:'text',text:r.text||r.error||'(nothing)'}];if(r.image)content.push({type:'image',data:r.image,mimeType:'image/jpeg'});return{content,isError:!!r.error}};
const out=o=>process.stdout.write(JSON.stringify(o)+'\n');
readline.createInterface({input:process.stdin}).on('line',async line=>{
  let m;try{m=JSON.parse(line)}catch(e){return}
  if(m.id===undefined)return;                                  // notifications need no answer
  try{
    if(m.method==='initialize')out({jsonrpc:'2.0',id:m.id,result:{protocolVersion:m.params&&m.params.protocolVersion||'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'graywake',version:'1'}}});
    else if(m.method==='tools/list')out({jsonrpc:'2.0',id:m.id,result:{tools:TOOLS}});
    else if(m.method==='tools/call'){const t=TOOLS.find(t=>t.name===m.params.name);if(!t)return out({jsonrpc:'2.0',id:m.id,error:{code:-32602,message:'no such tool'}});
      let res;try{res=await call(m.params.name,m.params.arguments||{})}catch(e){res={content:[{type:'text',text:'The play session does not answer: '+e.message}],isError:true}}out({jsonrpc:'2.0',id:m.id,result:res})}
    else if(m.method==='ping')out({jsonrpc:'2.0',id:m.id,result:{}});
    else out({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'method not found'}});
  }catch(e){out({jsonrpc:'2.0',id:m.id,error:{code:-32603,message:String(e.message||e)}})}
});

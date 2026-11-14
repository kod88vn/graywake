#!/usr/bin/env node
// A real game page joined to a real world server: joining, the shared lead, the World sheet, a rival taking the lead, falling and moving on.
// Needs Chrome. About 40 s.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launch,reporter} from '../tools/lib.mjs';
import {makeServer,RULES} from '../tools/world/server.mjs';
const T=reporter('shared world, in the game'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'gw-net-')),S=makeServer({dir});
await new Promise(r=>S.server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+S.server.address().port;
const page=await launch({width:1280,height:720,quiet:true,pathName:'/?shots=1&world='+encodeURIComponent(url)+'&enclave=Tester&kind=bot'}),ev=js=>page.eval(js);
const until=async(js,ms=15000)=>{for(let t=0;t<ms;t+=200){if(await ev(js))return true;await page.sleep(200)}return false};
try{
  await page.sleep(800);T.ok(await until(`!!document.getElementById('t-wsel')`),'the title screen offers the shared worlds');
  await ev(`localStorage.removeItem('graywake.save.v1');GW.api.newGame()`);await until(`GW.UI.panel==='journal'`,8000);await ev(`GW.UI.close()`);
  T.ok(await until(`!!GW.G.S.world&&!!GW.G.S.net&&!!GW.G.S.net.token`),'a new game joins a world by itself');
  await until(`/HOLD/.test(document.getElementById('worldchip').textContent)`,6000);
  const w=JSON.parse(await ev(`JSON.stringify({name:GW.G.S.world.name,n:GW.G.S.world.enclaves.length,me:GW.G.S.net.name,chip:document.getElementById('worldchip').textContent})`));
  T.ok(w.n===RULES.npcs+1&&w.me==='Tester'&&w.chip.includes(w.name.toUpperCase())&&/HOLD 60/.test(w.chip),'the world has its settlements and this enclave, and the clock shows it ('+w.chip+')');
  S.DB().worlds[0].leadAt=0;   // (the first lead normally comes four hours in)
  T.ok(await until(`GW.G.S.sites.some(s=>s.wid)`,20000),"the world's first lead arrives on the radio and is on the map");
  if(await ev(`GW.UI.panel==='lead'`))await ev(`GW.UI.close()`);
  await page.key('o');await page.sleep(400);const sheet=await ev(`GW.UI.panel==='world'?document.getElementById('pb').innerText:''`);
  T.ok(/Who holds ground here/i.test(sheet)&&/Tester/.test(sheet)&&/On every radio/i.test(sheet)&&/News/i.test(sheet),'O opens the World sheet: standings, stage, shared leads, news');await page.shot('world-sheet');await ev(`GW.UI.close()`);
  // a rival gets to the lead first
  const world=S.DB().worlds[0],lead=world.leads[0],rival=world.enclaves.find(e=>e.kind==='npc');lead.by=rival.name;lead.byT=world.t;
  T.ok(await until(`!GW.G.S.sites.some(s=>s.wid)`,20000),'when a rival opens the strongroom first, the lead is struck off this map');
  // deeds reach the world
  await ev(`GW.G.S.deeds.held=1`);T.ok(await until(`GW.G.S.world.you&&GW.G.S.world.you.hold===${RULES.hold0+RULES.tideHeld}`,20000)&&world.enclaves.find(e=>e.name==='Tester').deeds.held===1,'a tide held is reported and raises the hold');
  // losing: the hold runs out
  const home0=await ev(`GW.G.S.seed`);await ev(`GW.G.S.p.lvl=7;GW.G.S.deeds.lost=3`);
  {const ok=await until(`GW.UI.panel==='exile'`,20000);T.ok(ok,'when the hold runs out the game says the enclave has fallen'+(ok?'':' '+await ev(`JSON.stringify({panel:GW.UI.panel,mode:GW.G.mode,exile:!!(GW.G.S.net&&GW.G.S.net.exile),dead:GW.G.Z&&GW.G.Z.pl&&GW.G.Z.pl.dead})`)))}
  // (it is in the save, so a reload before the move is made still makes it)
  T.ok(await ev(`!!GW.G.S.net.exile`),'the fall is written into the save until the move is made');await page.shot('world-exile');
  await page.tap('#pb .btn.go');await page.sleep(900);
  const after=JSON.parse(await ev(`JSON.stringify({seed:GW.G.S.seed,lvl:GW.G.S.p.lvl,home:!!(GW.G.Z&&GW.G.Z.home),world:GW.G.S.world&&GW.G.S.world.name,hold:GW.G.S.world&&GW.G.S.world.you&&GW.G.S.world.you.hold,tide:GW.G.S.tide.n,net:GW.G.S.net.world})`));
  T.ok(after.seed!==home0&&after.lvl===7&&after.home&&after.world&&after.world!==w.name&&after.hold===RULES.hold0&&after.tide===0,'the character starts again in another world with a new homestead, keeping its level ('+w.name+' → '+after.world+')');
  T.ok(S.DB().worlds.length===2&&S.DB().worlds.find(x=>x.id===after.net).enclaves.some(e=>e.name==='Tester'&&e.status==='holding'),'and the server has it holding ground there');
  const errs=await ev(`(window.__errors||[]).length`);T.ok(!errs,'no page errors');
}catch(e){T.ok(false,'error: '+(e.stack||e).split('\n').slice(0,3).join(' | '))}
finally{await page.close();await S.close();fs.rmSync(dir,{recursive:true,force:true})}
process.exit(T.end()?1:0);

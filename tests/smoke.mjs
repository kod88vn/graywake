#!/usr/bin/env node
// Browser smoke test: boots the real page in headless Chrome, starts a game, opens every sheet, travels, and fails on any page error.
import {launch,reporter} from '../tools/lib.mjs';
const T=reporter('browser smoke');
const page=await launch({width:1280,height:720,quiet:true});
const ev=js=>page.eval(js);
try{
  await page.sleep(800);
  T.ok(await ev(`!!window.GW`),'page boots');
  T.ok(await ev(`!document.getElementById('title').hidden`),'title screen shows');
  await ev(`localStorage.clear();GW.api.newGame()`);await page.sleep(1500);
  T.ok(await ev(`GW.G.mode==='play'&&!!GW.G.Z&&GW.G.Z.home`),'new game reaches the homestead');
  T.ok(await ev(`document.getElementById('cv').width>100`),'canvas has a size');
  await ev(`GW.UI.close()`);await page.sleep(300);
  for(const p of['inv','craft','journal','camp','menu']){await ev(`GW.UI.open('${p}')`);await page.sleep(120);T.ok(await ev(`GW.UI.panel==='${p}'&&document.getElementById('pb').innerHTML.length>50`),'sheet opens: '+p);
    if(p==='journal')for(const t of['contracts','perks','records']){await page.tap(`#tabs [data-t="${t}"]`);await page.sleep(80)}
    await ev(`GW.UI.close()`)}
  // play a little: walk, auto-gather
  await ev(`GW.G.auto=true`);await page.sleep(6000);
  T.ok(await ev(`GW.G.S.p.inv.filter(Boolean).length>2`),'auto-gather collects in the live game');
  await ev(`GW.UI.hot('build')`);await page.sleep(200);T.ok(await ev(`!document.getElementById('build').hidden`),'build bar opens');await ev(`GW.UI.hot('build')`);
  // leave, look at the map, travel
  await ev(`(()=>{const Z=GW.G.Z;GW.G.auto=false;Z.pl.x=Z.w/2;Z.pl.y=Z.h-1})()`);await page.sleep(400);
  T.ok(await ev(`!document.getElementById('travel').hidden`),'travel button appears at the edge');
  await page.tap('#travel');await page.sleep(500);T.ok(await ev(`GW.G.mode==='map'&&!document.getElementById('map').hidden`),'map opens');
  await ev(`GW.G.pending=null;GW.World.arrive('birch_hollow')`);await page.sleep(1500);
  T.ok(await ev(`GW.G.Z&&GW.G.Z.id==='birch_hollow'&&GW.G.Z.actors.length>3`),'arrive at Birch Hollow with creatures in it');
  await ev(`GW.UI.close()`);await page.sleep(1500);
  T.ok(await ev(`GW.View.fps>0`),'renderer is producing frames ('+await ev(`GW.View.fps`)+' fps on the software rasteriser)');
  // save and reload
  await ev(`GW.api.save()`);T.ok(await ev(`!!localStorage.getItem('graywake.save.v1')`),'save is written');
  T.ok(await ev(`GW.api.continueGame()`),'save loads');await page.sleep(800);
  T.ok(page.errors.length===0,'no page errors'+(page.errors.length?': '+page.errors.slice(0,6).join(' | '):''));
}catch(e){T.ok(false,'threw: '+e.message+(page.errors.length?' | page: '+page.errors.slice(0,5).join(' | '):''))}
await page.close();process.exitCode=T.end()?1:0;

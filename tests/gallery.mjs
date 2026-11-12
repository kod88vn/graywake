#!/usr/bin/env node
// Screenshots of every model into .out/shots/gallery-<set>-<page>.png. Look at them after touching js/view/props.js.
// Usage: node tests/gallery.mjs [props|hand] [substring filter]
import {launch} from '../tools/lib.mjs';
const sets=process.argv[2]?[process.argv[2]]:['props','hand'],q=process.argv[3]||'';
let bad=0;
for(const set of sets){
  let pages=1;
  for(let p=0;p<pages;p++){
    const page=await launch({width:1500,height:1000,pathName:`/tools/gallery.html?set=${set}&page=${p}&per=${set==='hand'?48:24}&q=${q}`,quiet:true});
    try{
      for(let i=0;i<50&&!(await page.eval('window.GALLERY&&GALLERY.ready'));i++)await page.sleep(100);
      const info=await page.eval('JSON.stringify(window.GALLERY||{})');const G=JSON.parse(info);pages=G.pages||1;
      await page.sleep(300);console.log('  '+await page.shot(`gallery-${set}-${p}`));
      for(const e of [...(G.errors||[]),...page.errors]){bad++;console.log('  ERROR '+e)}
    }finally{await page.close()}
  }
}
process.exitCode=bad?1:0;

// A death at home with every tile around the player taken by a tree or trap: is the pack kept? (0.10.61: it used to vanish.)
// Usage: node tools/measure/bagtest.mjs <repo root>
const root=process.argv[2],R='file://'+root+'/js/';
const {G,give}=await import(R+'sim/core.js');const World=await import(R+'sim/world.js');G.headless=true;
const S=World.newGame(11),Z=G.Z,W=Z.w;
// die at home at (3.5,40.5), every tile within three steps taken by a tree or a trap
const px=3.5,py=40.5;Z.pl.x=px;Z.pl.y=py;
for(let y=36;y<=44;y++)for(let x=1;x<=8;x++)Z.obj[y*W+x]={k:(x+y)%2?'tree_pine':'spikes',r:0,v:0,hp:60};
S.p.inv=[{id:'bandage',n:5},{id:'poultice',n:2}];
World.respawn();
const bag=G.Z.obj.find(o=>o&&o.k==='deathbag'),loose=G.Z.drops.length;
console.log('bag:',bag?bag.inv.map(i=>i.id+'x'+i.n).join(','):'none','| loose piles:',loose);

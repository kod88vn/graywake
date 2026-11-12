// Regions, locations, building templates and loot tables. Pure data.
// Map coordinates are in a 1000 × 640 space. Travel time comes from distance and the vehicle.

export const REGIONS=[
  null,
  {id:1,n:'Pinewatch Valley',veh:0,c:'#4f6a36',d:'Pine and birch, old logging roads, a lake. Home.'},
  {id:2,n:'The Dustline',veh:2,c:'#b08a5a',d:'Dry plains south of the valley. Too far to walk and get back before the tide.',heat:1},
  {id:3,n:'Harrow City',veh:3,c:'#6a6f76',d:'Two hundred thousand people lived here. Most of them still do.'},
  {id:4,n:'Frostspine',veh:4,c:'#c9d6dd',d:'High passes under permanent snow. Bring fur or freeze.',cold:1},
  {id:5,n:'The Gray',veh:5,c:'#6a5f90',d:'Where it started. The air itself is the bloom.',tox:1},
];

// Looks and ambience per biome. g/g2/g3 are ground tiles (base, patches, paths); border is the tree line drawn outside the zone.
export const BIOMES={
  forest:{g:'grass',g2:'forest',g3:'dirt',border:['tree_pine','tree_birch'],deco:{flowers:.012,stump:.004},fog:'#a9c0a0',sun:'#fff2d8',snd:'forest'},
  dust:{g:'dust',g2:'sand',g3:'dirt',border:['boulder','tree_joshua'],deco:{bones:.004},fog:'#d8c098',sun:'#ffe6b8',snd:'dust'},
  city:{g:'concrete',g2:'asphalt',g3:'dirt',border:['w_concrete','rubble'],deco:{},fog:'#9aa0a6',sun:'#eef0f2',snd:'city'},
  frost:{g:'snow',g2:'ice',g3:'snow',border:['tree_snow','ice_rock'],deco:{snow_drift:.02},fog:'#dfeaf0',sun:'#eaf4ff',snd:'frost'},
  gray:{g:'ash',g2:'moss',g3:'mud',border:['tree_gray','spore_growth'],deco:{bones:.006},fog:'#7a7490',sun:'#d8c8f0',snd:'gray'},
};

// Building templates. w/h ranges in tiles (outer size) · wall · floor ground id · in [[kind,min,max]] placed along inner walls · rooms split count
export const BLD={
  cabin:{w:[6,7],h:[5,6],wall:'w_log',floor:'boards',in:[['old_bed',1,1],['table',0,1],['chair',0,1],['cabinet',1,2],['crate',0,1]]},
  house:{w:[7,9],h:[6,7],wall:'w_wood',floor:'boards',rooms:2,in:[['sofa',0,1],['table',1,1],['cabinet',1,2],['fridge',1,1],['old_bed',1,1],['medbox',0,1],['suitcase',0,1],['chair',1,2]]},
  barn:{w:[8,10],h:[6,8],wall:'w_wood',floor:'dirt',in:[['hay',2,4],['crate',1,3],['toolbox',1,1],['tractor',0,1],['barrel',0,2]]},
  shop:{w:[7,9],h:[6,7],wall:'w_brick',floor:'tile',in:[['shelf',2,4],['counter',1,1],['register',1,1],['fridge',1,2],['vending',0,1],['crate',0,2]]},
  workshop:{w:[7,9],h:[6,7],wall:'w_metal',floor:'concrete',in:[['toolbox',1,2],['machine',1,2],['crate',1,2],['barrel',1,2],['pallet',0,2],['locker',0,1]]},
  office:{w:[7,9],h:[6,8],wall:'w_concrete',floor:'tile',rooms:2,in:[['desk',2,3],['file_cab',1,3],['chair',1,2],['locker',1,2],['safe',0,1],['cabinet',0,1]]},
  ward:{w:[8,10],h:[6,8],wall:'w_concrete',floor:'tile',rooms:2,in:[['hosp_bed',2,4],['medbox',1,3],['cabinet',1,2],['desk',0,1]]},
  armory:{w:[6,7],h:[5,6],wall:'w_concrete',floor:'concrete',in:[['crate_mil',1,2],['ammo_box',1,3],['locker',1,2],['footlocker',1,1]]},
  trailer:{w:[6,7],h:[4,5],wall:'w_metal',floor:'boards',in:[['old_bed',1,1],['cabinet',1,1],['fridge',0,1],['footlocker',0,1],['chair',0,1]]},
  warehouse:{w:[10,12],h:[7,9],wall:'w_metal',floor:'concrete',in:[['crate',3,5],['pallet',2,4],['crate_mil',0,2],['shelf',2,3],['barrel',1,2],['toolbox',0,1]]},
  lab:{w:[8,10],h:[7,8],wall:'w_lab',floor:'tile',rooms:2,in:[['lab_tank',1,3],['desk',1,2],['cabinet',1,2],['medbox',1,2],['file_cab',0,1],['locker',0,1]]},
  bunker:{w:[7,8],h:[6,7],wall:'w_concrete',floor:'concrete',in:[['crate_mil',1,3],['ammo_box',1,2],['footlocker',1,2],['shelf',1,2]]},
  lodge:{w:[9,11],h:[7,8],wall:'w_log',floor:'boards',rooms:2,in:[['old_bed',2,3],['sofa',1,1],['table',1,2],['cabinet',2,3],['fridge',1,1],['locker',1,1],['chair',1,3]]},
  icehut:{w:[5,6],h:[5,5],wall:'w_ice',floor:'ice',in:[['crate',1,2],['footlocker',0,1],['corpse',0,1]]},
  bloomhouse:{w:[7,9],h:[6,7],wall:'w_bloom',floor:'moss',in:[['spore_pod',1,3],['crate',0,2],['corpse',0,1],['cabinet',0,1]]},
};

// Locations. lay wild|town|complex · size [w,h] · lvl enemy level · lt loot tier · cool hours before it is worth returning
// nodes/props {kind:count} outdoors · bld [[template,count]] · en outdoor enemies · inn enemies inside buildings · night extra after dark
// fill (complex) {kind:count} spread across rooms · boss kind · qi [[item, story flag]] guaranteed quest item while that flag is active
const L=(id,n,reg,x,y,lvl,lay,biome,o)=>Object.assign({id,n,reg,x,y,lvl,lay,biome,lt:reg,size:[44,44],cool:10},o);
export const LOCATIONS=[
// ---------------- Pinewatch ----------------
L('home','Homestead',1,150,330,1,'home','forest',{d:'Your clearing. Everything you build stays built.',cool:0}),
L('birch_hollow','Birch Hollow',1,95,250,1,'wild','forest',{d:'Quiet stand of birch. Wood, fibre, berries. A few husks wandering between the trunks.',cool:6,
  nodes:{tree_birch:34,tree_pine:10,tree_dead:5,grass_tall:16,bush_berry:9,log_pile:9,mushrooms:5,herb_patch:3,rock:4,stone_pile:6},props:{crate:1,corpse:1,stash:1},en:{shambler:5,rabbit:3,deer:2},night:{runner:2}}),
L('flint_ridge','Flint Ridge',1,215,235,2,'wild','forest',{d:'Broken stone above the tree line. Stone, flint, clay and a little iron.',cool:6,alt:'dirt',
  nodes:{rock:26,rock_flint:10,clay_pit:8,rock_iron:5,tree_dead:6,tree_pine:6,grass_tall:6,pond:2,stone_pile:10},props:{crate:1,corpse:1,toolbox:1},en:{shambler:6,wolf:2,rabbit:2},night:{runner:2,wolf:1}}),
L('miller_farm',"Miller's Farm",1,120,430,3,'town','forest',{d:'Fields gone wild. Seeds, vegetables, a barn full of tools.',cool:10,
  nodes:{wild_crop:16,grass_tall:14,tree_oak:3,bush_berry:5,herb_patch:5,pond:2},props:{hay:5,tractor:1,crate:2,fence_wood:16,barrel:2,corpse:1},bld:[['house',1],['barn',1]],en:{shambler:6,crawler:3,boar:2},inn:{shambler:3},night:{runner:3}}),
L('gas_stop','Route 9 Fuel Stop',1,245,395,4,'town','forest',{d:'A forecourt, a diner, a line of cars that never left. Scrap, rubber, bolts.',cool:10,road:1,
  nodes:{car_hull:5,tree_pine:8,grass_tall:6,machine:1},props:{car_wreck:5,gas_pump:3,trashcan:3,barrel:3,sign:2,dumpster:1,streetlight:3},bld:[['shop',1],['workshop',1]],en:{shambler:6,runner:3},inn:{shambler:3,crawler:1},night:{runner:3}}),
L('lake_cabins','Lakeside Cabins',1,70,160,5,'wild','forest',{d:'Holiday cabins on a cold lake. Fish, lockers, somebody else\'s supplies.',cool:10,water:1,
  nodes:{tree_pine:22,tree_birch:8,fish_spot:5,grass_tall:8,bush_berry:5,log_pile:5,herb_patch:3,mushrooms:4},props:{crate:2,stash:1,corpse:2},bld:[['cabin',3]],en:{shambler:6,runner:2,bloater:1,deer:2},inn:{shambler:3},night:{runner:3,bloater:1}}),
L('sawmill','Old Sawmill',1,200,130,6,'town','forest',{d:'Machines to strip, old oak to fell. A wolf pack dens in the cutting shed.',cool:14,
  nodes:{tree_oak:8,tree_pine:14,machine:5,log_pile:10,rock_iron:3},props:{pallet:6,crate:3,barrel:2,toolbox:1},bld:[['warehouse',1],['workshop',1]],en:{wolf:5,shambler:3},inn:{shambler:3},boss:'alpha_wolf',night:{wolf:2}}),
L('ranger_station','Ranger Station',1,300,210,8,'town','forest',{d:'Radio tower, bunkhouse, a locked armoury cage. The rangers are still on duty.',cool:14,
  nodes:{tree_pine:16,rock:4,grass_tall:6,herb_patch:3},props:{antenna:1,crate:2,car_wreck:2,footlocker:1,fence_chain:14},bld:[['office',1],['cabin',1],['armory',1]],lock:{gun_cabinet:1},en:{shambler:6,runner:3,armored:1},inn:{shambler:4,armored:1},night:{runner:3},qi:[['radio_part','q_radio']]}),
// ---------------- Dustline ----------------
L('scrapyard','Rustfield Scrapyard',2,330,470,9,'wild','dust',{d:'Acres of stacked cars. Everything metal you will ever need, if you can carry it.',
  nodes:{car_hull:16,machine:6,rock:4,cactus:5,sand_pile:4},props:{car_wreck:8,crate:4,toolbox:2,barrel:4,pallet:5,dumpster:2,bus:1,fence_chain:16},bld:[['workshop',1]],en:{parched:8,runner:3,raider:2},inn:{parched:2},night:{runner:4,stalker:1}}),
L('motel','Starlite Motel',2,410,400,10,'town','dust',{d:'Twelve rooms, twelve doors. Somebody is home in most of them.',road:1,
  nodes:{cactus:6,tree_joshua:5,car_hull:3},props:{car_wreck:4,vending:2,trashcan:4,sign:2,streetlight:3,suitcase:2},bld:[['trailer',4],['shop',1],['office',1]],en:{parched:6,spitter:2,runner:2},inn:{parched:6,spitter:1},night:{runner:4,stalker:1}}),
L('quarry','Redrock Quarry',2,360,560,11,'wild','dust',{d:'Iron, copper, coal and sulfur in open benches. Something very large works the lower cut.',alt:'dirt',
  nodes:{rock_iron:16,rock_copper:12,rock_coal:12,rock_sulfur:7,rock:10,machine:3,clay_pit:4},props:{crate:3,toolbox:1,barrel:2,pallet:3},bld:[['workshop',1]],en:{parched:8,brute:1,spitter:2},night:{runner:3,brute:1}}),
L('salt_flats','Salt Flats',2,470,520,12,'wild','dust',{d:'White crust to the horizon. Salt, sand, cactus water. Nowhere to hide from the hounds.',alt:'sand',
  nodes:{rock_salt:14,sand_pile:14,cactus:12,tree_joshua:6,rock_sulfur:4,pond:2},props:{corpse:3,car_wreck:2,stash:2,bones:8},en:{parched:6,boar:3,wolf:4},night:{stalker:2,wolf:2}}),
L('trailer_park','Coyote Bend Trailers',2,520,440,13,'town','dust',{d:'Raiders hold this one. They shoot first, and they have things worth taking.',
  nodes:{cactus:5,car_hull:5,tree_joshua:4},props:{car_wreck:3,barrel_fire:3,crate:4,crate_mil:1,tent:3,barrel:3,pallet:3},bld:[['trailer',5],['workshop',1]],en:{raider:6,raider_gun:4},inn:{raider:3,raider_gun:2},night:{raider_gun:2}}),
L('pump_jack','Pump Jack 12',2,560,570,14,'wild','dust',{d:'The pump still nods. Crude oil by the barrel, and bloaters soaking in it.',alt:'mud',
  nodes:{machine:6,rock_coal:5,rock_sulfur:5,sand_pile:5,cactus:4},props:{barrel:14,tank:4,crate:3,toolbox:2,pallet:3,car_wreck:2},bld:[['workshop',1],['office',1]],en:{parched:7,bloater:5,spitter:2},inn:{bloater:1,parched:2},night:{runner:4}}),
L('sheriff',"Sheriff's Office",2,450,320,16,'complex','dust',{d:'Cells, an evidence room, and the Warden, who never stopped locking people up.',cool:20,size:[40,40],wall:'w_brick',floor:'tile',
  fill:{desk:5,file_cab:5,locker:5,footlocker:3,medbox:2,cabinet:3,ammo_box:3,chair:5,safe:1},lock:{evidence:1},props:{car_wreck:4,trashcan:3,streetlight:2},en:{parched:4,runner:2},inn:{parched:8,armored:4,runner:3},boss:'warden',qi:[['radio_part','q_signal']]}),
// ---------------- Harrow City ----------------
L('market','FreshWay Market',3,585,330,18,'complex','city',{d:'Aisles of tins nobody got to. One scream brings the whole car park in.',size:[42,40],wall:'w_brick',floor:'tile',
  fill:{shelf:16,fridge:8,counter:4,register:4,vending:3,crate:6,cabinet:3,medbox:1},props:{car_wreck:8,trashcan:5,streetlight:3,dumpster:2},en:{runner:8,shambler:6,screamer:1},inn:{shambler:10,runner:5,screamer:2,bloater:2}}),
L('apartments','Kessler Apartments',3,640,270,20,'complex','city',{d:'Forty flats, forty lives, forty fridges. Riot husks on the stairs.',size:[44,44],wall:'w_concrete',floor:'boards',
  fill:{sofa:6,old_bed:8,cabinet:10,fridge:6,table:6,medbox:4,suitcase:5,safe:2,chair:8,locker:2},props:{car_wreck:6,trashcan:4,streetlight:3,dumpster:2,bus:1},en:{runner:6,shambler:6,armored:2},inn:{shambler:10,armored:4,runner:4,screamer:1,spitter:2}}),
L('firehouse','Engine House 4',3,590,220,21,'town','city',{d:'Axes, hoses, tool chests and a garage of engines to strip.',road:1,
  nodes:{car_hull:8,machine:6},props:{car_wreck:6,toolbox:3,barrel:4,locker:3,dumpster:2,streetlight:4,trashcan:3,bus:1},bld:[['workshop',2],['office',1],['warehouse',1]],en:{runner:8,armored:3,spitter:3},inn:{shambler:6,armored:2,bloater:2},night:{stalker:3}}),
L('subway','Line 6 Tunnels',3,680,340,23,'complex','city',{d:'Pitch dark, ankle-deep in something toxic. Stalkers hunt here at any hour.',size:[46,38],wall:'w_concrete',floor:'concrete',dark:1,tox:.6,
  fill:{crate:8,locker:6,toolbox:4,machine:6,vending:3,corpse:6,barrel:5,footlocker:3,safe:1},hazard:{puddle_tox:26},props:{rubble:8,trashcan:3},en:{runner:4},inn:{stalker:7,crawler:8,spitter:4,bloater:3}}),
L('hospital',"St. Brigid's",3,720,230,25,'complex','city',{d:'Every medicine you could want, and the Matron who guards the ward.',cool:20,size:[46,46],wall:'w_concrete',floor:'tile',
  fill:{hosp_bed:12,medbox:12,cabinet:8,desk:5,file_cab:4,locker:4,fridge:3,chair:6,safe:1,lab_tank:2},props:{car_wreck:6,trashcan:4,streetlight:3,bus:1},en:{shambler:8,runner:5,spitter:2},inn:{shambler:10,crawler:8,spitter:4,bloater:3,screamer:2},boss:'matron',qi:[['cure_sample','q_cure1']]}),
L('harbor','Harbor Freight Yard',3,760,400,26,'wild','city',{d:'Stacked containers, military pallets, and Captain Voss\'s crew working through them.',water:1,alt:'asphalt',
  nodes:{machine:8,car_hull:6,fish_spot:4},props:{crate:14,crate_mil:5,pallet:10,barrel:6,tank:3,toolbox:3,dumpster:3,fence_chain:18,barrel_fire:3},bld:[['warehouse',2],['armory',1]],en:{raider:8,raider_gun:6,raider_heavy:3},inn:{raider:3,raider_gun:3},boss:'raider_boss'}),
L('factory','Voss Machine Works',3,690,150,28,'complex','city',{d:'Motors, gears, processors. The Foreman is part of the line now.',cool:20,size:[46,46],wall:'w_metal',floor:'concrete',
  fill:{machine:18,toolbox:8,crate:10,pallet:8,locker:6,barrel:6,shelf:6,footlocker:3,safe:1},props:{car_wreck:4,tank:3,dumpster:3},en:{armored:4,runner:6,brute:1},inn:{armored:8,brute:3,shambler:8,spitter:3,screamer:1},boss:'foreman',qi:[['sat_part','q_uplink']]}),
// ---------------- Frostspine ----------------
L('summit_lodge','Summit Lodge',4,330,90,30,'wild','frost',{d:'Elk on the slopes, wolves behind them. Fur for the taking.',cold:1,
  nodes:{tree_snow:30,rock:8,log_pile:6,herb_patch:3},props:{crate:3,corpse:3,stash:2,snow_drift:14},bld:[['lodge',1],['cabin',2]],en:{elk:5,snow_wolf:6,frostbitten:6},inn:{frostbitten:5},night:{stalker:3,snow_wolf:3}}),
L('mirror_lake','Mirror Lake',4,425,50,31,'wild','frost',{d:'Black ice, fishing holes and quartz along the shore.',cold:1,alt:'ice',
  nodes:{fish_spot:8,rock_quartz:12,tree_snow:14,rock:8,rock_bauxite:5},props:{ice_rock:12,corpse:3,crate:2,snow_drift:10,stash:1},bld:[['icehut',3]],en:{frostbitten:8,snow_wolf:5,elk:3,bear:1},night:{stalker:3}}),
L('deepvein','Deepvein Mine',4,490,130,33,'complex','frost',{d:'Titanium and bauxite in the dark. The shift never came back up.',cold:1,size:[46,42],wall:'w_ice',floor:'dirt',dark:1,
  fill:{rock_titan:16,rock_bauxite:16,rock_coal:10,rock_quartz:6,crate:6,toolbox:4,machine:6,barrel:4,footlocker:2},props:{ice_rock:8,pallet:4,crate:2},en:{frostbitten:5,snow_wolf:3},inn:{frostbitten:12,brute:4,crawler:8,armored:3}}),
L('radar_post','Radar Post Kilo',4,555,65,35,'town','frost',{d:'A military listening post. Crates stencilled with things worth dying for.',cold:1,
  nodes:{tree_snow:10,rock:6,machine:5,rock_titan:3},props:{antenna:3,crate_mil:5,ammo_box:4,tank:2,fence_chain:20,car_wreck:3,snow_drift:10},bld:[['bunker',2],['office',1],['armory',1]],en:{armored:8,frostbitten:6,brute:2},inn:{armored:6,frostbitten:4,screamer:1},night:{stalker:4},qi:[['sat_part','q_uplink2']]}),
L('flight_2207','Flight 2207',4,620,35,36,'wild','frost',{d:'A cargo jet opened along a ridge. Luggage and pallets for half a mile.',cold:1,
  nodes:{tree_snow:12,rock:10,rock_bauxite:6,machine:6,car_hull:4},props:{suitcase:14,crate:10,crate_mil:4,corpse:8,pallet:8,rubble:10,snow_drift:10,footlocker:3},en:{frostbitten:12,snow_wolf:6,bear:2,brute:2},night:{stalker:5}}),
L('blue_throat','The Blue Throat',4,400,150,39,'complex','frost',{d:'An ice cave that breathes. The Rime Colossus sleeps at the bottom.',cool:24,cold:1,size:[46,46],wall:'w_ice',floor:'ice',
  fill:{rock_quartz:14,rock_titan:10,ice_rock:12,crate:5,corpse:6,footlocker:3,crystal_spire:6},props:{ice_rock:10,snow_drift:10},en:{frostbitten:6,snow_wolf:4},inn:{frostbitten:14,brute:5,stalker:4},boss:'colossus'}),
// ---------------- The Gray ----------------
L('spore_fields','Spore Fields',5,830,300,42,'wild','gray',{d:'Bloomwood, crystal, resin. Every breath costs you.',tox:1,
  nodes:{tree_gray:24,bloom:18,rock_gray:10,spore_pod:8,rock:6},props:{spore_growth:14,corpse:4,crate:2,car_wreck:3,bones:8},en:{sporeling:14,bloomed:6,hound:5},night:{stalker:4,gray_knight:1}}),
L('camp_lazarus','Camp Lazarus',5,860,200,44,'town','gray',{d:'The quarantine camp. Tents, cages, medical stores, and everyone they were meant to save.',tox:1,
  nodes:{bloom:8,tree_gray:8,machine:4},props:{tent:10,cage:6,crate:6,medbox:4,crate_mil:3,fence_chain:24,spore_growth:8,corpse:8,barrel_fire:2},bld:[['ward',2],['bunker',1],['office',1]],en:{bloomed:8,sporeling:10,armored:5},inn:{bloomed:6,screamer:2,bloater:3},night:{stalker:4},qi:[['keycard_lab','q_cure2']]}),
L('biolabs','Meridian Biolabs',5,910,360,47,'complex','gray',{d:'Clean corridors gone soft with bloom. Sample vaults behind keycard doors.',cool:20,tox:1.2,size:[46,46],wall:'w_lab',floor:'tile',
  fill:{lab_tank:12,desk:8,cabinet:8,medbox:8,file_cab:6,locker:6,safe:2,spore_pod:8,machine:6},lock:{lab_vault:3},hazard:{puddle_tox:16},props:{car_wreck:3,spore_growth:8},en:{bloomed:5,sporeling:8},inn:{bloomed:12,gray_knight:3,spitter:6,sporeling:14,screamer:2},qi:[['cure_sample','q_cure2']]}),
L('cooling_station','Cooling Station 3',5,880,460,50,'complex','gray',{d:'Reactor cells still warm in their racks. Gray Knights walk the gantries.',cool:20,tox:1.4,size:[46,44],wall:'w_metal',floor:'concrete',
  fill:{machine:16,tank:6,crate_mil:6,toolbox:6,locker:6,footlocker:4,barrel:6,crate:8},lock:{gray_vault:2},hazard:{puddle_tox:20},props:{tank:4,spore_growth:8,car_wreck:2},en:{gray_knight:3,hound:6},inn:{gray_knight:8,bloomed:10,sporeling:12,brute:3}}),
L('bloom_core','The Bloom Core',5,950,260,55,'complex','gray',{d:'The first bloom. It knows you are coming.',cool:24,tox:2,size:[44,44],wall:'w_bloom',floor:'moss',
  fill:{spore_pod:14,crystal_spire:10,rock_gray:12,corpse:6,spore_growth:10},lock:{gray_vault:1},hazard:{puddle_tox:20},props:{spore_growth:12,bloom:10},en:{gray_knight:3,bloomed:6},inn:{gray_knight:6,bloomed:12,sporeling:20,hound:6},boss:'heart'}),
L('deep_gray','The Deep Gray',5,960,520,58,'complex','gray',{d:'Past the Core the bloom goes on, and down. Each descent is deeper, richer, worse.',cool:6,tox:2,size:[46,46],wall:'w_bloom',floor:'ash',endless:1,flag:'core_dead',
  fill:{spore_pod:16,crystal_spire:8,rock_gray:16,rock_titan:8,crate_mil:6,footlocker:4,corpse:8},lock:{gray_vault:2},hazard:{puddle_tox:22},props:{spore_growth:12,bloom:12},en:{gray_knight:4,hound:8,bloomed:6},inn:{gray_knight:10,bloomed:14,sporeling:22,stalker:6,brute:4}}),
];
export const LOC=Object.fromEntries(LOCATIONS.map(l=>[l.id,l]));

// Temporary map events that spawn as visitable sites. Same generator fields as locations. dur = hours on the map.
export const SITES={
  airdrop:{n:'Supply Drop',dur:14,lay:'wild',d:'A parachute came down an hour ago. You were not the only one who saw it.',nodes:{},props:{airdrop:1,crate:1},en:{runner:5,shambler:5},wave:{kind:'runner',n:4,every:40},ic:'box'},
  heli:{n:'Downed Helicopter',dur:18,lay:'wild',d:'Military bird, nose-down in the trees. The crew are still strapped in.',props:{crate_mil:2,ammo_box:2,corpse:3,rubble:6,machine:2},en:{armored:5,shambler:5},ic:'gear',minDay:6},
  convoy:{n:'Stalled Convoy',dur:20,lay:'town',road:1,d:'Six trucks nose to tail. Whatever stopped them is probably still nearby.',props:{car_wreck:7,bus:2,crate:5,crate_mil:1,suitcase:4,barrel:3},en:{shambler:8,runner:4,bloater:2},ic:'cart',minDay:4},
  bandits:{n:'Raider Camp',dur:24,lay:'wild',d:'Smoke from a cookfire. A new crew moving into the valley. Hit them before they hit you.',props:{tent:4,barrel_fire:2,crate:4,crate_mil:1,footlocker:2,pallet:3},en:{raider:6,raider_gun:3},boss:'raider_boss',bossChance:.35,ic:'skull',minDay:8,fx:{horde:6}},
  herd:{n:'Migrating Herd',dur:10,lay:'wild',d:'Deer moving through in numbers. So are the things that follow deer.',nodes:{grass_tall:14,bush_berry:8,herb_patch:5},en:{deer:8,rabbit:5,boar:3,wolf:3},ic:'paw'},
  meteor:{n:'Meteor Strike',dur:16,lay:'wild',d:'Something fell burning last night. The crater is full of ore that is not from here.',nodes:{rock_iron:8,rock_copper:5,rock_quartz:3,rock:8},props:{rubble:10},en:{shambler:6,brute:1},ic:'rock',minDay:5,rich:1},
  distress:{n:'Distress Call',dur:12,lay:'town',d:'A voice on the radio, whispering an address. Somebody is still alive in there.',props:{car_wreck:3,trashcan:2,crate:2},bld:[['house',2]],en:{shambler:6,runner:4},inn:{shambler:5},rescue:1,ic:'people',minDay:3},
  bloom_patch:{n:'Bloom Outbreak',dur:16,lay:'wild',d:'A patch of the Gray, far from where it should be. Burn it out and the next tide thins.',tox:.6,nodes:{bloom:10,mushrooms:6},props:{spore_pod:6,spore_growth:8},en:{bloater:4,spitter:4,shambler:6},ic:'tox',minDay:10,fx:{hordeWeak:.25}},
  cache:{n:'Smuggler Cache',dur:14,lay:'wild',d:'A map scratched on a tin lid turned out to be real.',props:{stash:3,footlocker:2,safe:1,crate:3},en:{shambler:4,wolf:3},ic:'lock',minDay:7},
  horde_nest:{n:'Tide Nest',dur:20,lay:'wild',d:'This is where they gather before they come for you. Thin them here and the next tide is smaller.',props:{corpse:6,bones:10,spore_growth:5,crate:2},en:{shambler:14,runner:6,brute:1,screamer:1},ic:'skull',minDay:9,fx:{hordeWeak:.35}},
};

// Loot. Each family is a list of [item, weight, min, max, firstTier=1, lastTier=5]; ROLLS gives how many picks per open.
const T=(rows)=>rows.map(r=>({i:r[0],w:r[1],a:r[2],b:r[3],t0:r[4]||1,t1:r[5]||5}));
export const LOOT={
junk:T([['log',6,1,3,1,2],['stick',5,2,4,1,2],['rope',6,1,2],['rags',8,1,3],['scrap',10,1,4],['nails',8,3,8],['plank',6,1,3,1,3],['cloth',5,1,2],['bolts',5,2,5],['pipe',3,1,1],['tape',4,1,1,2],['spring',3,1,2,2],['gear',3,1,2,2],['wire',4,1,3,2],['glass',3,1,2],['plastic',6,1,3,3],['battery',3,1,1,2],['circuit',2,1,1,3],['bulb',2,1,1,2],['rubber',3,1,2],['coal',3,1,3,2,3],['fuel',2,1,1,2],['chem',3,1,2,3],['lens',1,1,1,3],['iron_bar',3,1,2,2,4],['steel_bar',2,1,2,3],['alu_bar',2,1,2,4],['mil_parts',1,1,1,4],['insul',3,1,2,4],['spore_resin',4,1,2,5],['gray_crystal',2,1,1,5]]),
food:T([['canned_beans',8,1,2],['canned_soup',8,1,2],['water',8,1,2],['soda',5,1,2],['chips',5,1,2],['energy_bar',4,1,2,2],['mre',3,1,1,3],['coffee',2,1,1,2],['honey',1,1,1],['salt',4,1,3],['corn',2,1,3,1,2],['potato',2,1,3,1,2],['jerky',3,1,2],['moonshine',2,1,1,2],['dirty_water',3,1,2,1,2]]),
home:T([['rags',8,1,3],['cloth',6,1,2],['bandage',5,1,2],['canned_beans',4,1,1],['water',4,1,1],['old_coin',4,1,2],['gold_watch',1,1,1],['rope',3,1,2],['tape',3,1,1,2],['battery',2,1,1,2],['lockpick',2,1,2],['seed_carrot',2,1,2,1,2],['seed_potato',2,1,2,1,2],['seed_corn',2,1,2,1,3],['seed_pumpkin',1,1,1],['painkillers',2,1,1,2],['leather_boots',1,1,1,1,2],['leather_cap',1,1,1,1,2],['lantern',1,1,1,1,3],['binoculars',.5,1,1,2],['fishing_rod',1,1,1,1,2],['bp_crossbow',.6,1,1,1,2],['bp_revolver',.4,1,1,2,3],['charcoal_tabs',2,1,2],['vitamins',1,1,1,2]]),
tool:T([['nails',8,4,10],['bolts',7,2,6],['scrap',6,2,4],['tape',5,1,2],['spring',4,1,2],['gear',4,1,2],['wire',4,2,4],['pipe',4,1,2],['repair_kit',4,1,1],['lockpick',3,1,2],['glue',3,1,2],['hatchet_iron',1,1,1,1,2],['pick_iron',1,1,1,1,2],['crowbar',1.5,1,1,1,3],['wrench',2,1,1,1,3],['motor',1.5,1,1,3],['engine_part',2,1,1,2],['circuit',2,1,1,3],['hatchet_steel',.7,1,1,3,4],['pick_steel',.7,1,1,3,4],['mil_parts',2,1,2,4],['adv_circuit',1,1,1,4]]),
med:T([['bandage',10,1,3],['charcoal_tabs',5,1,2],['painkillers',4,1,2],['medkit',3,1,1,2],['antitoxin',3,1,1,2],['vitamins',3,1,1],['herb',3,1,3,1,2],['adrenaline',2,1,1,3],['first_aid',1.5,1,1,3],['chem',3,1,2,3],['stim',.7,1,1,4],['biogel',1.5,1,1,5],['moonshine',2,1,1]]),
trash:T([['rags',8,1,2],['scrap',6,1,2],['bone',3,1,2],['plastic',4,1,2,3],['glass',3,1,1],['stick',3,1,2,1,2],['old_coin',1,1,1],['chips',2,1,1],['dirty_water',2,1,1],['tape',1,1,1,2]]),
car:T([['scrap',10,2,4],['rubber',6,1,2],['bolts',6,2,5],['wire',5,1,3],['fuel',3,1,2],['tire',1.5,1,1,2],['engine_part',1.5,1,1,2],['battery',2.5,1,1,2],['rags',4,1,2],['tape',2,1,1],['water',2,1,1],['canned_beans',2,1,1],['pipe',3,1,1],['spring',2,1,1],['old_coin',1,1,2]]),
corpse:T([['rags',8,1,3],['bandage',4,1,1],['dog_tag',3,1,1],['ammo_9',3,2,6,2],['water',3,1,1],['canned_beans',2,1,1],['old_coin',3,1,2],['lockpick',2,1,1],['arrow',3,2,5,1,2],['bone_knife',.8,1,1,1,2],['machete',.5,1,1,2,3],['painkillers',1,1,1,2],['bone',4,1,3],['ammo_rifle',2,2,5,3],['gold_watch',.5,1,1]]),
barrel:T([['fuel',5,1,2,2],['oil',8,2,4,2],['dirty_water',5,1,3],['water',3,1,2],['coal',3,2,4,2],['scrap',3,1,3],['chem',3,1,2,3],['salt',2,1,3],['fat',2,1,2,1,2],['resin',2,1,2,1,2]]),
cash:T([['old_coin',10,2,5],['gold_watch',1,1,1],['tape',1,1,1],['battery',1,1,1,2]]),
paper:T([['old_coin',5,1,3],['rags',5,1,2],['lockpick',3,1,1],['bp_crossbow',1,1,1,1,2],['bp_revolver',1,1,1,2,3],['bp_shotgun',1,1,1,2,3],['bp_katana',.8,1,1,3,4],['bp_smg',.8,1,1,3,4],['bp_chainsaw',.6,1,1,3,4],['bp_tesla',.6,1,1,3,5],['bp_carbine',.8,1,1,4,5],['bp_flamer',.6,1,1,3,5],['bp_mortar',.5,1,1,4,5],['bp_launcher',.5,1,1,4,5],['battery',2,1,1,2]]),
ammo:T([['arrow',8,3,8,1,2],['xbolt',5,3,6,1,3],['ammo_9',8,4,12,2],['shell',5,2,6,2],['ammo_rifle',6,3,10,3],['gunpowder',5,2,5,2],['nade_round',1,1,2,4],['lance_cell',3,4,10,5],['pipe_bomb',1.5,1,1,2],['grenade',1.5,1,1,3]]),
gear:T([['hide_vest',3,1,1,1,1],['hide_pants',3,1,1,1,1],['club',2,1,1,1,1],['spear',3,1,1,1,1],['bat',3,1,1,1,2],['bow',3,1,1,1,2],['pack_sack',2,1,1,1,1],['leather_jacket',2,1,1,1,2],['leather_pants',2,1,1,1,2],['leather_boots',2,1,1,1,2],['scrap_helm',2,1,1,2,2],['scrap_plate',1.5,1,1,2,3],['scrap_greaves',2,1,1,2,3],['machete',3,1,1,2,3],['nail_bat',2,1,1,2,2],['pipe_pistol',2,1,1,2,2],['crossbow',1.5,1,1,2,3],['pack_small',1.5,1,1,2,2],['riot_helm',2,1,1,3,4],['riot_vest',1.2,1,1,3,4],['riot_pants',1.6,1,1,3,4],['riot_boots',2,1,1,3,4],['fire_axe',2,1,1,3,3],['revolver',1.5,1,1,3,3],['shotgun',1,1,1,3,4],['gas_mask',1.5,1,1,3,4],['pack_hiker',1,1,1,3,3],['sledge',1,1,1,3,4],['fur_coat',1.5,1,1,4,4],['fur_pants',2,1,1,4,4],['fur_hat',2,1,1,4,4],['mil_helm',1.2,1,1,4,5],['mil_pants',1.2,1,1,4,5],['mil_boots',1.2,1,1,4,5],['smg',.8,1,1,4,4],['katana',.5,1,1,4,5],['rifle',1.2,1,1,3,4],['pack_mil',.6,1,1,4,5],['haz_pants',1,1,1,5],['haz_boots',1,1,1,5],['mil_vest',1,1,1,5],['carbine',.7,1,1,5],['shock_baton',.8,1,1,5],['repair_kit',4,1,2],['rags',4,1,3],['bandage',4,1,2]]),
mil:T([['ammo_9',8,6,16],['ammo_rifle',7,5,14,3],['shell',5,3,8],['grenade',3,1,2,3],['pipe_bomb',3,1,2,2,3],['mre',6,1,2],['medkit',5,1,2],['first_aid',2,1,1,3],['mil_parts',5,1,3,3],['gunpowder',5,3,6],['weave',3,1,2,3],['revolver',1.5,1,1,2,3],['rifle',1.5,1,1,3,4],['smg',1.2,1,1,3,4],['carbine',1,1,1,4],['riot_vest',1.2,1,1,3,3],['mil_vest',1,1,1,4],['mil_helm',1,1,1,4],['optics',2,1,1,4],['adv_circuit',2,1,1,4],['bp_carbine',.6,1,1,4],['bp_sniper',.5,1,1,4],['bp_launcher',.5,1,1,4],['bp_minigun',.4,1,1,5],['nade_round',2,1,3,4],['reactor_cell',1,1,1,5],['binoculars',1,1,1,2,3]]),
vault:T([['old_coin',10,3,8],['gold_watch',5,1,2],['ammo_9',4,6,14,2],['medkit',3,1,2],['bp_revolver',1.5,1,1,1,3],['bp_shotgun',1.5,1,1,2,3],['bp_katana',1.5,1,1,3,4],['bp_smg',1.5,1,1,3,4],['bp_tesla',1.2,1,1,3,5],['bp_sniper',1,1,1,4,5],['bp_mortar',1,1,1,4,5],['bp_stim',1,1,1,4,5],['revolver',1,1,1,2,3],['painkillers',2,1,2],['stim',1,1,1,4],['adv_circuit',2,1,2,4]]),
armory:T([['ammo_9',8,10,24],['ammo_rifle',6,8,18,2],['shell',6,6,12,2],['xbolt',4,6,12,1,2],['bow',2,1,1,1,1],['crossbow',3,1,1,1,2],['pipe_pistol',3,1,1,1,2],['revolver',3,1,1,2,3],['shotgun',2,1,1,2,3],['rifle',2,1,1,2,4],['bp_shotgun',2,1,1,1,3],['bp_revolver',2,1,1,1,2],['riot_helm',2,1,1,2,3],['riot_vest',2,1,1,2,3],['medkit',3,1,2],['grenade',2,1,2,2],['pipe_bomb',3,1,2,1,2],['repair_kit',4,1,3]]),
lab:T([['chem',10,2,5],['adv_circuit',5,1,2],['biogel',5,1,2],['stim',3,1,1],['mutagen',5,1,2],['antitoxin',5,1,2],['lens',4,1,2],['optics',3,1,1],['bp_stim',1.5,1,1],['bp_tesla',1.5,1,1],['bp_lance',.8,1,1],['keycard_vault',1.5,1,1],['reactor_cell',2,1,1],['first_aid',3,1,1],['filter',5,1,3]]),
relic:T([['alloy',10,2,4],['reactor_cell',8,1,3],['gray_crystal',8,2,5],['mutagen',5,1,3],['bp_exo',2,1,1],['bp_lance',2,1,1],['bp_minigun',2,1,1],['bp_launcher',2,1,1],['adv_circuit',5,1,3],['optics',4,1,2],['stim',3,1,2],['lance_cell',5,6,14],['titan_bar',5,2,4]]),
airdrop:T([['ammo_9',8,8,18,2],['arrow',6,6,12,1,1],['xbolt',5,6,10,1,2],['ammo_rifle',6,6,14,3],['medkit',8,1,2],['bandage',6,2,4,1,2],['mre',8,1,3],['canned_beans',6,2,3,1,2],['repair_kit',6,1,2],['iron_bar',6,2,5,1,2],['steel_bar',6,2,4,3,4],['titan_bar',5,1,3,5],['machete',2,1,1,1,2],['pipe_pistol',2,1,1,1,2],['revolver',2,1,1,2,3],['rifle',2,1,1,3,4],['carbine',1.5,1,1,4,5],['grenade',3,1,2,3],['pipe_bomb',3,1,2,1,2],['bp_shotgun',1,1,1,2,3],['bp_smg',1,1,1,3,4],['bp_carbine',1,1,1,4,5],['pack_small',1.5,1,1,1,2],['pack_hiker',1,1,1,3,3],['adv_circuit',3,1,2,4],['mil_parts',4,1,3,3],['first_aid',3,1,1,3],['water',6,2,3]]),
pod:T([['spore_resin',10,1,3],['mutagen',4,1,1],['gray_crystal',4,1,2],['biogel',2,1,1],['bone',4,1,3]]),
stash:T([['old_coin',8,2,5],['ammo_9',5,3,8,2],['arrow',5,3,8,1,1],['canned_beans',6,1,2],['water',5,1,2],['bandage',6,1,2],['medkit',2,1,1,2],['lockpick',4,1,2],['gold_watch',1.5,1,1],['jerky',5,1,3],['moonshine',3,1,1],['repair_kit',3,1,1],['tape',3,1,2],['gunpowder',3,1,3,2],['painkillers',2,1,1],['bp_crossbow',.8,1,1,1,2]]),
snack:T([['soda',10,1,3],['chips',10,1,3],['energy_bar',6,1,2],['water',6,1,2],['old_coin',3,1,3]]),
};
export const ROLLS={junk:[2,4],food:[2,3],home:[2,3],tool:[2,4],med:[2,3],trash:[0,2],car:[2,3],corpse:[1,3],barrel:[1,2],cash:[1,2],paper:[1,2],ammo:[1,3],gear:[1,2],mil:[3,4],vault:[3,4],armory:[4,6],lab:[3,5],relic:[4,5],airdrop:[6,8],pod:[1,2],stash:[3,4],snack:[2,3]};

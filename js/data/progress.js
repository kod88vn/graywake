// Story, contracts, perks, achievements, survivors and trade. Pure data.

// ---------- Story ----------
// goals: {k:'have',item,n} {k:'deliver',item,n} (taken on completion) {k:'craft',id,n} {k:'build',kind|tag,n} {k:'visit',loc}
//        {k:'kill',kind?,n} {k:'boss',kind} {k:'level',n} {k:'tide',n} {k:'surv',n} {k:'veh',n} {k:'stat',s,n}
// While a quest is active its id is a story flag: locations with qi:[[item, flag]] hide that item in a container.
// rw: effects as in events.js. who: 'log' = your own journal, 'mer' = Meridian on the radio.
const Q=(id,t,x,goals,rw,who='log')=>({id,t,x,goals,rw,who});
export const STORY=[
Q('q_wake','First Light','The truck is dead and so is everyone who was in it. This clearing has water, timber and a line of sight. It will do. Start with what your hands can manage: fallen branches, loose stones, tall grass. Search the truck and the crate.',[{k:'have',item:'stick',n:6},{k:'have',item:'stone',n:5},{k:'have',item:'fiber',n:6}],[['xp',40],['item','water',2]]),
Q('q_tools','Edge and Point','Bare hands will not fell a tree or split a rock. Lash stone to wood: open Craft and make a hatchet and a pickaxe.',[{k:'craft',id:'hatchet_stone',n:1},{k:'craft',id:'pick_stone',n:1}],[['xp',60],['item','berries',6]]),
Q('q_fire','Fire','Raw meat and pond water will kill you slower than the husks, but they will kill you. Fell a few trees, build a campfire from the build menu, and boil the water from a rain pool.',[{k:'build',kind:'campfire',n:1},{k:'craft',id:'water',n:1}],[['xp',80],['item','raw_meat',2]]),
Q('q_shelter','Four Walls','They come at night. Put something between you and them: a floor, walls, a door, a place to sleep and a box for what you cannot carry.',[{k:'build',tag:'wall',n:6},{k:'build',tag:'door',n:1},{k:'build',tag:'bed',n:1},{k:'build',tag:'store',n:1}],[['xp',120],['item','rope',4],['item','rags',4]]),
Q('q_bench','A Proper Bench','A flat surface and a vice. With a workbench you can make real tools, and with a spear you can keep them at arm\'s length.',[{k:'build',tag:'workbench',n:1},{k:'craft',id:'spear',n:1}],[['xp',120],['item','bandage',2]]),
Q('q_out','Beyond the Fence','The clearing will not feed you for long. Walk to the edge and follow the trail to Birch Hollow.',[{k:'visit',loc:'birch_hollow'}],[['xp',120],['item','seed_carrot',3]]),
Q('q_garden','Something Growing','Plant what you found, and catch the rain. Food and water that come to you.',[{k:'build',kind:'garden',n:2},{k:'build',tag:'water',n:1},{k:'stat',s:'planted',n:1}],[['xp',150],['item','seed_potato',3]]),
Q('q_tide1','The First Tide','You have seen the signs: flattened grass, a smell on the wind. They gather, and then they come all at once. Set stakes. Hold.',[{k:'build',tag:'trap',n:2},{k:'tide',n:1}],[['xp',300],['item','medkit',1],['scrip',30]]),
Q('q_iron','Iron','Flint Ridge has ore. A furnace will turn it into something worth having.',[{k:'visit',loc:'flint_ridge'},{k:'build',tag:'furnace',n:1},{k:'craft',id:'iron_bar',n:4}],[['xp',300],['item','charcoal',6]]),
Q('q_mast','Is Anyone There','Wire, a battery, a mast of planks. The fuel stop on Route 9 should have what you need. Build a radio and listen.',[{k:'build',kind:'radio',n:1}],[['xp',400],['item','canned_soup',3]]),
Q('q_radio','The Coil','"...copy? This is Meridian Station. You are the first voice in four months. Your signal is weak. There is a transmitter coil in the Ranger Station east of you. Bring it home and we can talk properly."',[{k:'deliver',item:'radio_part',n:1}],[['xp',600],['scrip',80],['bp']],'mer'),
Q('q_wolf','Old Grey','"The rangers kept logs. A wolf pack took the sawmill the first winter, and the thing leading it is not quite a wolf any more. It carries the armoury key in its gut, if the logs are right. Sorry."',[{k:'boss',kind:'alpha_wolf'}],[['xp',600],['item','medkit',2]],'mer'),
Q('q_people','Not Alone','"You cannot hold a valley by yourself. Light a signal fire. People will come. Feed them and they will stay."',[{k:'build',kind:'beacon',n:1},{k:'surv',n:2}],[['xp',600],['item','seed_corn',4],['item','seed_pumpkin',2]],'mer'),
Q('q_bike','Wheels','"Everything you need next is south, on the Dustline, and it is too far to walk and be back before a tide. Build a vehicle bay. Build anything with wheels."',[{k:'build',tag:'garage',n:1},{k:'veh',n:2}],[['xp',800],['scrip',100]],'mer'),
Q('q_dust','The Dustline','"Rustfield first. Scrap by the ton. Watch for raiders: they are organised down there."',[{k:'visit',loc:'scrapyard'},{k:'visit',loc:'quarry'}],[['xp',800],['item','water',4]],'mer'),
Q('q_forge','Hammer and Heat','"Copper, coal, proper iron. Build a forge. Make armour. You are going to need it for what I ask next."',[{k:'build',tag:'forge',n:1},{k:'craft',id:'scrap_plate',n:1}],[['xp',1000],['item','leather',4]],'mer'),
Q('q_tide5','Five Tides','"They are getting bigger. You have noticed. Hold five and I will tell you why."',[{k:'tide',n:5}],[['xp',1200],['scrip',150],['bp']],'mer'),
Q('q_signal','The Warden','"Each tide follows a signal. We have triangulated a relay in the Sheriff\'s Office on the Dustline. There is a second coil there, and a thing that used to be the sheriff. Bring me the coil."',[{k:'boss',kind:'warden'},{k:'deliver',item:'radio_part',n:1}],[['xp',2000],['scrip',250],['item','bp_shotgun',1]],'mer'),
Q('q_guns','Powder','"Sulfur, salt, charcoal. You know what that makes. Build a gunsmith bench and stop bringing a spear to this."',[{k:'build',tag:'chem',n:1},{k:'build',tag:'gunbench',n:1},{k:'craft',id:'ammo_9',n:24}],[['xp',2000],['item','gunpowder',10]],'mer'),
Q('q_moto','An Engine','"Harrow City. That is where the samples are. You need an engine to get there and back."',[{k:'veh',n:3}],[['xp',2400],['item','fuel',10]],'mer'),
Q('q_city','Harrow','"Two hundred thousand people. Go quietly. Start with the market. See what a city does to you."',[{k:'visit',loc:'market'},{k:'visit',loc:'apartments'}],[['xp',2400],['item','first_aid',1]],'mer'),
Q('q_cure1','The Ward','"St. Brigid\'s took the first cases. They sealed a live bloom sample in the isolation ward. The Matron has been tending it ever since. I need that sample."',[{k:'boss',kind:'matron'},{k:'deliver',item:'cure_sample',n:1}],[['xp',4000],['scrip',400],['bp']],'mer'),
Q('q_power','Current','"You will need power: for the uplink, and for the walls. A generator. A bench for fine work. And something that shoots while you sleep."',[{k:'build',kind:'generator',n:1},{k:'build',tag:'elec',n:1},{k:'build',kind:'turret_gun',n:1}],[['xp',4000],['item','circuit',4]],'mer'),
Q('q_uplink','The Foreman','"The dish actuators were made at Voss Machine Works. The Foreman there is half machine now. Take an actuator off the line. Take it off him, if you have to."',[{k:'boss',kind:'foreman'},{k:'deliver',item:'sat_part',n:1}],[['xp',6000],['scrip',600],['item','bp_tesla',1]],'mer'),
Q('q_tide15','Fifteen','"I said I would tell you why. The tides are not random. Something in the Gray is sending them, and it is sending them at you because you are still broadcasting. Hold fifteen. I am sorry. I needed you to keep talking."',[{k:'tide',n:15}],[['xp',6000],['scrip',600],['bp']],'mer'),
Q('q_buggy','The Passes','"Frostspine. There is a military radar post up there with the second actuator. You need something that climbs, and you need fur, or the cold will finish what I started."',[{k:'veh',n:4},{k:'craft',id:'fur_coat',n:1}],[['xp',7000],['item','fuel',20]],'mer'),
Q('q_uplink2','Radar Post Kilo','"Kilo went dark the second week. Whatever is up there has had a long time to settle in. Bring the actuator home."',[{k:'deliver',item:'sat_part',n:1}],[['xp',9000],['scrip',800]],'mer'),
Q('q_colossus','The Blue Throat','"With the uplink I can see it now: a cold spot under the mountain, moving. The tides from the north start there. End it."',[{k:'boss',kind:'colossus'}],[['xp',12000],['scrip',1000],['bp']],'mer'),
Q('q_truck','Sealed','"There is only the Gray left. Nothing open-topped comes back from it. Build a sealed cab. Make a suit. Then come and find out what I am."',[{k:'veh',n:5},{k:'craft',id:'haz_suit',n:1}],[['xp',14000],['item','filter',10]],'mer'),
Q('q_cure2','Biolabs','"I am in the Biolabs. What is left of me. The keycard is in Camp Lazarus, on a doctor who did not get out. The second sample is in the vault beside the room I am speaking from. Bring it home. Do not open the door marked M."',[{k:'visit',loc:'camp_lazarus'},{k:'visit',loc:'biolabs'},{k:'deliver',item:'cure_sample',n:1}],[['xp',20000],['scrip',1500],['item','bp_exo',1]],'mer'),
Q('q_core','The Bloom Core','"Two samples. That is enough to make it stop, if you put them in the right place. The right place is the Core. I will keep it talking. Go."',[{k:'boss',kind:'heart'}],[['xp',40000],['scrip',3000],['flag','core_dead']],'mer'),
Q('q_after','After the Wake','The radio is quiet. The tides still come, smaller and stranger. Past the Core the Gray goes on, and down. Somebody should see how far.',[{k:'stat',s:'depth',n:5}],[['xp',50000],['scrip',5000],['bp']]),
Q('q_end','Wake Walker','Nobody is asking you to do this any more.',[{k:'stat',s:'depth',n:25},{k:'tide',n:60},{k:'level',n:80}],[['scrip',20000]]),
];
// Tags used by build goals: a tag matches any object whose data has that property or station name.
export const BUILD_TAGS={wall:o=>o.wall&&o.cost,door:o=>o.door,bed:o=>o.bed,store:o=>o.store,trap:o=>o.trap,water:o=>o.prod&&o.prod.item==='water',
  workbench:o=>o.station==='workbench',furnace:o=>o.station==='furnace',forge:o=>o.station==='forge',garage:o=>o.station==='garage',chem:o=>o.station==='chem',gunbench:o=>o.station==='gunbench',elec:o=>o.station==='elec'};

// ---------- Contracts (radio board) ----------
// Generated from these pools by region reached. pay is scrip per unit of difficulty.
export const CONTRACTS={
  fetch:[null,
    [['plank',20],['rope',10],['leather',6],['cooked_meat',8],['brick',12],['herb',10],['iron_bar',6],['cloth',6],['jerky',6],['water',10]],
    [['iron_bar',14],['copper_bar',10],['coal',20],['salt',14],['gunpowder',12],['fuel',8],['glass',12],['bolts',30],['rubber',10]],
    [['steel_bar',12],['plastic',24],['circuit',6],['chem',12],['medkit',5],['battery',8],['motor',3],['weave',5],['ammo_9',80]],
    [['titan_bar',8],['alu_bar',14],['fur',14],['quartz',12],['optics',4],['mil_parts',8],['adv_circuit',4],['insul',14]],
    [['alloy',6],['spore_resin',20],['gray_crystal',14],['mutagen',8],['biogel',6],['reactor_cell',3],['stim',4]]],
  hunt:[null,
    [['shambler',12],['runner',8],['wolf',6],['crawler',8],['boar',4],['bloater',3]],
    [['parched',16],['spitter',8],['brute',3],['raider',10],['raider_gun',8]],
    [['armored',12],['screamer',5],['stalker',8],['bloater',10],['raider_heavy',5],['brute',6]],
    [['frostbitten',20],['snow_wolf',12],['bear',3],['stalker',10],['brute',8]],
    [['sporeling',40],['bloomed',16],['gray_knight',8],['hound',16]]],
  // "clear" picks a random unlocked non-boss location; "tide" asks to survive the next one without losing a wall.
};
export const CONTRACT_GIVERS=['Meridian','The Walker','Tin Bell','Lazarus Remnant','Route 9 Co-op','Harbour Watch','The Trapper','Sister Agnes','Dustline Free Riders'];

// ---------- Perks ----------
// tree · max ranks · fx {key: amount per rank} read by the sim through perk(S,key)
const P=(id,n,tree,max,d,fx,ic)=>({id,n,tree,max,d,fx,ic});
export const PERKS=[
P('stomach','Iron Stomach','Survivor',5,'Hunger drains 8% slower per rank, and bad food hurts less.',{hunger:-.08,gut:.15},'food'),
P('camel','Camel','Survivor',5,'Thirst drains 8% slower per rank.',{thirst:-.08},'drop'),
P('thick','Thick Skin','Survivor',10,'+12 max health per rank.',{hp:12},'heart_hp'),
P('wind','Second Wind','Survivor',5,'Regenerate 0.25 health a second per rank when fed and watered.',{regen:.25},'heart_hp'),
P('mule','Pack Mule','Survivor',4,'+2 backpack slots per rank.',{slots:2},'pack'),
P('lungs','Filter Lungs','Survivor',5,'8% toxin resistance per rank.',{tox:.08},'tox'),
P('blood','Warm Blood','Survivor',3,'12% cold resistance per rank.',{cold:.12},'flame'),
P('scout','Pathfinder','Survivor',5,'Travel 6% faster per rank.',{travel:.06},'map'),
P('brawler','Brawler','Fighter',10,'+6% melee damage per rank.',{melee:.06},'bat'),
P('marks','Marksman','Fighter',10,'+6% ranged damage per rank.',{ranged:.06},'rifle'),
P('quick','Quick Hands','Fighter',5,'Attack 5% faster per rank.',{haste:.05},'knife'),
P('crit','Killer Instinct','Fighter',5,'+5% chance per rank to deal double damage.',{crit:.05},'skull'),
P('assassin','Shadow','Fighter',5,'Sneak attacks deal +40% per rank, and they notice you 6% later.',{sneak:.4,quiet:.06},'eye'),
P('jugger','Juggernaut','Fighter',8,'Take 3% less damage per rank.',{resist:.03},'shield'),
P('acro','Tumbler','Fighter',4,'Dodge recovers 12% faster per rank.',{dodge:.12},'boots'),
P('butcher','Butcher','Fighter',4,'+20% meat, hide and bone from animals per rank.',{butcher:.2},'meat'),
P('handy','Careful Hands','Maker',5,'Tools, weapons and armour wear 8% slower per rank.',{dur:.08},'wrench'),
P('thrift','Thrifty','Maker',5,'6% chance per rank to keep each ingredient when crafting.',{thrift:.06},'gear'),
P('learner','Fast Learner','Maker',5,'+6% experience per rank.',{xp:.06},'book'),
P('engineer','Engineer','Maker',8,'Turrets and traps deal +8% damage per rank.',{turret:.08},'turret'),
P('mason','Mason','Maker',8,'Structures have +8% health per rank.',{wallhp:.08},'wall'),
P('chemist','Chemist','Maker',4,'10% chance per rank for double output when cooking, brewing and mixing.',{double:.1},'flask'),
P('gunsmith','Reloader','Maker',4,'+10% ammunition per craft per rank.',{ammo:.1},'bullet'),
P('builder','Quartermaster','Maker',4,'Building and upgrading costs 5% less per rank.',{cheap:.05},'hammer_build'),
P('lumber','Lumberjack','Scavenger',5,'+15% wood per rank and trees fall faster.',{wood:.15},'axe'),
P('miner','Prospector','Scavenger',5,'+15% stone and ore per rank.',{ore:.15},'pick'),
P('forager','Forager','Scavenger',5,'+20% from plants and gardens per rank.',{plant:.2},'sprout'),
P('lucky','Lucky Find','Scavenger',5,'8% chance per rank for an extra item in any container.',{luck:.08},'chest'),
P('lock','Locksmith','Scavenger',4,'Lockpicks are 20% less likely to break per rank.',{lock:.2},'lockpick'),
P('haggle','Haggler','Scavenger',5,'Buy 5% cheaper and sell 8% dearer per rank.',{haggle:.05},'coin'),
P('leader','Leader','Scavenger',4,'+1 survivor per rank and morale falls slower.',{surv:1},'people'),
P('salvage','Salvager','Scavenger',5,'+15% parts from wrecks, machines and recycling per rank.',{salvage:.15},'scrap'),
];
export const PERK=Object.fromEntries(PERKS.map(p=>[p.id,p]));
export const PERK_TREES=['Survivor','Fighter','Maker','Scavenger'];

// ---------- Achievements ----------
const A=(id,n,d,s,v,rw)=>({id,n,d,s,v,rw});
export const ACHIEVEMENTS=[
A('a_kill1','Blooded','Put down 25 hostiles.','kills',25,[['scrip',20]]),A('a_kill2','Exterminator','Put down 500 hostiles.','kills',500,[['scrip',200]]),A('a_kill3','Tide Breaker','Put down 5,000 hostiles.','kills',5000,[['sp',2]]),A('a_kill4','Extinction Event','Put down 25,000 hostiles.','kills',25000,[['sp',4]]),
A('a_wood1','Woodcutter','Gather 200 wood.','wood',200,[['scrip',20]]),A('a_wood2','Clear Cut','Gather 5,000 wood.','wood',5000,[['sp',1]]),
A('a_ore1','Rockhound','Gather 200 stone and ore.','ore',200,[['scrip',20]]),A('a_ore2','Strip Miner','Gather 5,000 stone and ore.','ore',5000,[['sp',1]]),
A('a_craft1','Tinkerer','Craft 50 things.','crafted',50,[['scrip',30]]),A('a_craft2','Artisan','Craft 1,000 things.','crafted',1000,[['sp',1]]),A('a_craft3','Industry','Craft 10,000 things.','crafted',10000,[['sp',3]]),
A('a_build1','Homesteader','Build 25 structures.','built',25,[['scrip',30]]),A('a_build2','Architect','Build 300 structures.','built',300,[['sp',1]]),A('a_build3','Citadel','Build 1,500 structures.','built',1500,[['sp',2]]),
A('a_tide1','Still Standing','Survive 3 tides.','tides',3,[['scrip',50]]),A('a_tide2','Breakwater','Survive 20 tides.','tides',20,[['sp',1]]),A('a_tide3','Sea Wall','Survive 50 tides.','tides',50,[['sp',3]]),A('a_tide4','The Rock','Survive 100 tides.','tides',100,[['sp',5]]),
A('a_day1','One Week','Survive 7 days.','days',7,[['scrip',40]]),A('a_day2','Hundred Days','Survive 100 days.','days',100,[['sp',2]]),A('a_day3','A Year','Survive 365 days.','days',365,[['sp',5]]),
A('a_boss1','Giant Killer','Kill a boss.','bosses',1,[['scrip',100]]),A('a_boss2','Regicide','Kill 6 different bosses.','bossKinds',6,[['sp',3]]),A('a_boss3','Trophy Wall','Kill 40 bosses.','bosses',40,[['sp',3]]),
A('a_loc1','Wanderer','Visit 10 different places.','locs',10,[['scrip',80]]),A('a_loc2','Cartographer','Visit every place on the map.','locs',33,[['sp',3]]),
A('a_loot1','Scavenger','Open 100 containers.','opened',100,[['scrip',60]]),A('a_loot2','Picked Clean','Open 2,500 containers.','opened',2500,[['sp',2]]),
A('a_fish','Angler','Catch 100 fish.','fish',100,[['sp',1]]),A('a_farm','Green Thumb','Harvest 200 crops.','harvest',200,[['sp',1]]),
A('a_surv','Mayor','House 8 survivors at once.','survMax',8,[['sp',2]]),A('a_trade','Merchant','Earn 5,000 scrip.','earned',5000,[['sp',1]]),
A('a_sneak','Ghost','Land 200 sneak attacks.','sneaks',200,[['sp',1]]),A('a_contract','Reliable','Complete 50 contracts.','contracts',50,[['sp',2]]),
A('a_bp','Librarian','Learn 12 schematics.','schematics',12,[['sp',2]]),A('a_depth','Abyssal','Reach depth 10 in the Deep Gray.','depth',10,[['sp',4]]),
A('a_mut','Second Wake','Reach Mutation tier 3.','mutation',3,[['sp',5]]),A('a_lvl','Veteran','Reach level 50.','level',50,[['sp',3]]),
];

// ---------- Survivors ----------
export const SURV_NAMES=['Ada','Bram','Cass','Dov','Edda','Finn','Greta','Hale','Imre','Juno','Kit','Lev','Mara','Nico','Oona','Pike','Quill','Rhea','Sol','Tamsin','Ulf','Vera','Wren','Yusuf','Zed','Marlow','Tess','Odile','Garrick','Ines'];
export const SURV_TRAITS={
  strong:{n:'Strong back',d:'Forages 50% more.'},green:{n:'Green fingers',d:'Farms 50% better.'},shot:{n:'Dead shot',d:'Deals 50% more damage on guard.'},
  tinker:{n:'Tinkerer',d:'Repairs twice as much.'},cook:{n:'Camp cook',d:'Cooks twice as much.'},cheer:{n:'Good company',d:'+2 morale every day.'},
  glutton:{n:'Big appetite',d:'Eats for two.'},tough:{n:'Hard to kill',d:'Twice the health on guard.'},owl:{n:'Night owl',d:'Guards see further in the dark.'},
  lucky:{n:'Lucky',d:'Sometimes comes back with something rare.'},nurse:{n:'Field nurse',d:'Heals twice as well.'},quiet:{n:'Quiet',d:'No trouble. No complaints.'},
};
// Jobs: what one survivor does per day (before trait and morale multipliers). `needs` = structure tag that must exist at home.
// Jobs are all inside the homestead: the user's rule is that survivors "help automate things like repair, defense, farming inside base" and that the player
// travels alone. (Forager, hunter and scavenger, who went out into the valley, were removed in 0.10.4; saves holding them read as resting.)
export const JOBS={
  idle:{n:'Resting',d:'Recovers morale.',morale:1},
  farm:{n:'Farmer',d:'Tends the beds: crops grow 30% faster and are harvested and replanted for you.',needs:'garden'},
  guard:{n:'Guard',d:'Mans a guard post during tides and shoots anything that crosses the line.',needs:'guard_post'},
  cook:{n:'Cook',d:'Turns raw food from the stores into meals and stretches rations.',needs:'campfire',cook:4},
  mech:{n:'Mechanic',d:'Repairs walls and traps every morning.',repair:.12},
  medic:{n:'Medic',d:'Makes bandages and patches you up when you sleep.',needs:'medic',out:[['bandage',1,2]]},
};

// ---------- Trade ----------
// [item, weight, min, max, firstTier, lastTier]. Caravans sell at value × 2.2 and buy at value × 0.5 (Haggler improves both).
export const TRADE=[['seed_carrot',6,2,5,1,3],['seed_potato',6,2,5,1,3],['seed_corn',6,2,4,1,4],['seed_pumpkin',4,1,3,1,5],['seed_herb',5,2,4,1,5],['salt',6,4,10,1,5],['rope',5,3,6,1,2],['nails',5,10,30,1,3],['bandage',6,2,5,1,3],['medkit',4,1,3,1,5],['antitoxin',3,1,2,2,5],
  ['arrow',5,8,20,1,2],['xbolt',4,6,14,1,3],['ammo_9',6,12,40,2,5],['ammo_rifle',5,10,30,3,5],['shell',4,6,18,2,5],['gunpowder',4,4,10,2,5],['fuel',5,2,8,2,5],['iron_bar',4,2,6,1,3],['copper_bar',3,2,5,2,4],['steel_bar',4,2,6,3,5],
  ['leather',4,2,5,1,3],['cloth',4,2,6,1,3],['tape',4,1,3,1,5],['repair_kit',5,1,3,1,5],['lockpick',4,2,4,1,5],['battery',3,1,3,2,5],['circuit',3,1,3,3,5],['lantern',2,1,1,1,3],['binoculars',1.5,1,1,2,5],['flare',3,1,1,1,5],
  ['pack_small',1.5,1,1,1,2],['pack_hiker',1.2,1,1,2,4],['pack_mil',1,1,1,4,5],['machete',1.5,1,1,1,2],['crossbow',1.2,1,1,2,3],['revolver',1.2,1,1,2,4],['rifle',1,1,1,3,5],['gas_mask',1.2,1,1,3,5],['coffee',3,1,3,1,5],['honey',3,1,2,1,5],['mre',3,1,3,2,5],
  ['painkillers',3,1,3,2,5],['adrenaline',2,1,2,3,5],['stim',1,1,1,4,5],['alu_bar',3,2,5,4,5],['titan_bar',2,1,4,5,5],['mil_parts',2,1,3,4,5],['filter',3,2,5,3,5],['grenade',2,1,2,3,5],['pipe_bomb',2,1,3,2,4],['water',4,2,5,1,5]];
export const TRADE_BP={1:['bp_crossbow'],2:['bp_revolver','bp_shotgun'],3:['bp_katana','bp_smg','bp_chainsaw','bp_flamer','bp_tesla'],4:['bp_carbine','bp_sniper','bp_mortar','bp_launcher','bp_stim'],5:['bp_minigun','bp_exo','bp_lance']};

// Experience needed to go from level L to L+1.
export const xpFor=L=>Math.round(50+38*L+5.5*L*L);
export const MAX_LEVEL=100;

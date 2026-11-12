// Text events, weather and tides (home assaults). Pure data.
// Event: at 'travel'|'home' · w weight · min {day,lvl} · reg [region ids] (travel: destination region) · once:1
// t title · x text · o options [{l label, need {item:n}, r outcomes [[chance, text, effects]]}]
// Effects: ['item',id,n] ['take',id,n] ['hp',n] ['food',n] ['water',n] ['tox',n] ['time',minutes] ['xp',n] ['scrip',n]
//          ['loot',family,rolls] ['fight',{kind:n}] ['surv'] ['buff',key,amount,seconds] ['horde',hoursDelta] ['hordeWeak',fraction]
//          ['morale',n] ['site',siteId] ['weather',id] ['raid',fraction] (damage to base walls) ['bp'] (random unknown schematic)
const E=(id,at,w,t,x,o,extra)=>Object.assign({id,at,w,t,x,o},extra);

export const EVENTS=[
// ======================= on the road =======================
E('ev_stash','travel',10,'Marked Tree','Three notches cut in a pine beside the trail, and loose earth at its roots.',[
  {l:'Dig',r:[[.7,'A biscuit tin wrapped in oilcloth. Somebody meant to come back for it.',[['loot','stash',3],['time',20]]],[.3,'Empty. The notches were someone else\'s joke.',[['time',20]]]]},
  {l:'Keep walking',r:[[1,'Not everything is for you.',[]]]}]),
E('ev_stranger','travel',8,'The Walker','A woman with a pram full of jars waves you down from a safe distance. She wants to trade.',[
  {l:'Trade 2 bandages for food',need:{bandage:2},r:[[1,'She counts the bandages twice, then hands over more than you expected.',[['take','bandage',2],['item','canned_beans',2],['item','jerky',2],['item','honey',1]]]]},
  {l:'Offer water for news',need:{water:1},r:[[1,'She drinks, and marks something on your map.',[['take','water',1],['site','cache'],['xp',30]]]]},
  {l:'Move on',r:[[1,'She shrugs and pushes on.',[]]]}]),
E('ev_ambush_road','travel',9,'Bodies in the Road','Two shapes lying across the track. One of them twitches as you come close.',[
  {l:'Go around through the brush',r:[[.6,'Slow going, but you come out clean on the far side.',[['time',40]]],[.4,'The brush was not empty either.',[['fight',{shambler:3,crawler:2}]]]]},
  {l:'Go straight through',r:[[1,'They get up. There are more in the ditch.',[['fight',{shambler:5,runner:1}]]]]},
  {l:'Throw a lure and slip past',need:{lure:1},r:[[1,'The rattle draws them off into the trees. You walk past unnoticed.',[['take','lure',1],['xp',25]]]]}]),
E('ev_rain','travel',6,'Cloudburst','The sky opens without warning.',[
  {l:'Shelter under a rock shelf',r:[[1,'You fill what you can from the run-off while you wait.',[['time',50],['item','water',2]]]]},
  {l:'Push on, soaked',r:[[.7,'Cold, wet, on time.',[['hp',-4]]],[.3,'You slip on the wet scree.',[['hp',-14]]]]}],{weather:['rain','storm']}),
E('ev_deer','travel',7,'Fresh Tracks','Deer prints, minutes old, crossing your path.',[
  {l:'Stalk it',r:[[.55,'One clean chance, and you take it.',[['item','raw_meat',3],['item','hide',2],['time',45],['xp',20]]],[.45,'It hears you long before you see it.',[['time',45]]]]},
  {l:'Stalk it with a bow',need:{arrow:2},r:[[.9,'The arrow does the work quietly.',[['take','arrow',1],['item','raw_meat',4],['item','hide',2],['item','bone',2],['time',30],['xp',30]]],[.1,'Two arrows gone into the ferns.',[['take','arrow',2],['time',30]]]]},
  {l:'Leave it',r:[[1,'You have somewhere to be.',[]]]}],{reg:[1,4]}),
E('ev_wreck','travel',7,'Car in the Ditch','A hatchback on its side, doors shut, windows fogged from inside.',[
  {l:'Pry the boot',need:{crowbar:0},tool:'pry',r:[[.75,'The boot pops. The thing in the front seat never notices.',[['loot','car',3],['time',15]]],[.25,'The lock screams. So does the driver.',[['loot','car',2],['fight',{shambler:2,runner:1}]]]]},
  {l:'Smash a window',r:[[.5,'Quick hands, quick exit.',[['loot','car',2],['hp',-5]]],[.5,'It was waiting for that.',[['fight',{shambler:3}]]]]},
  {l:'Not worth it',r:[[1,'You keep to the far side of the road.',[]]]}]),
E('ev_bridge','travel',5,'Washed-out Bridge','The plank bridge is gone. The stream is fast and brown.',[
  {l:'Ford it',r:[[.6,'Waist-deep and freezing, but you keep your feet.',[['hp',-6],['time',20]]],[.4,'The current takes your legs out. You lose something off your pack.',[['hp',-16],['lose',1]]]]},
  {l:'Fell a tree across',tool:'axe',r:[[1,'Half an hour of work, and a bridge for next time.',[['time',35],['item','log',2],['xp',20]]]]},
  {l:'Walk upstream to the shallows',r:[[1,'A long detour.',[['time',80]]]]}],{reg:[1,2]}),
E('ev_grave','travel',5,'Roadside Cairn','A fresh cairn with a rifle sling tied to a cross of sticks.',[
  {l:'Pay your respects',r:[[1,'You stand a minute. It helps more than it should.',[['buff','resist',.1,300],['time',10]]]]},
  {l:'Dig',r:[[.6,'They buried the pack with him.',[['loot','corpse',3],['loot','ammo',1],['morale',-4],['time',30]]],[.4,'What is in the hole is not dead enough.',[['fight',{shambler:1,crawler:2}],['morale',-4]]]]}]),
E('ev_peddler','travel',6,'Tin Bell','You hear the bell before you see him: a peddler with a mule and a shotgun.',[
  {l:'See what he has',r:[[1,'He lays out his roll on the road.',[['trade',1]]]]},
  {l:'Wave and pass',r:[[1,'He touches his hat.',[]]]}],{min:{day:2}}),
E('ev_dogs','travel',6,'Eyes in the Scrub','Something is pacing you through the brush. More than one.',[
  {l:'Stand your ground',r:[[1,'They come out low and fast.',[['fight',{wolf:4}]]]]},
  {l:'Throw them some meat',need:{raw_meat:2},r:[[1,'They take it and let you go. One watches you leave a long time.',[['take','raw_meat',2]]]]},
  {l:'Run',r:[[.5,'You outlast them.',[['food',-8],['water',-10]]],[.5,'Nobody outruns wolves.',[['hp',-12],['fight',{wolf:3}]]]]}],{reg:[1,2,4]}),
E('ev_church','travel',4,'The Chapel','A white clapboard chapel, door chained from the outside. Something inside is singing.',[
  {l:'Break the chain',tool:'pry',r:[[.5,'A congregation of twelve. They have been waiting a long time.',[['fight',{shambler:8,screamer:1}],['loot','vault',2]]],[.5,'One old man, alive, half-mad, with a cellar full of preserves. He comes with you.',[['surv'],['item','honey',2],['item','jerky',4]]]]},
  {l:'Leave it chained',r:[[1,'The singing follows you down the road.',[]]]}],{min:{day:6},once:1}),
E('ev_heat','travel',7,'White Noon','No shade for a mile in any direction and the road is soft underfoot.',[
  {l:'Rest until it cools',r:[[1,'You lose the afternoon under a tarp.',[['time',120],['water',-6]]]]},
  {l:'Keep moving',r:[[1,'Every step costs water.',[['water',-22],['hp',-5]]]]},
  {l:'Cut open a cactus',r:[[.8,'Bitter, wet, enough.',[['water',14],['time',15]]],[.2,'Wrong kind of cactus.',[['tox',14]]]]}],{reg:[2]}),
E('ev_dust_devil','travel',5,'Dust Wall','A brown wall a mile high is coming across the flats.',[
  {l:'Lie flat and cover up',r:[[1,'It passes over like a train. You dig yourself out after.',[['time',60],['water',-8]]]]},
  {l:'Run for the gully',r:[[.6,'You make it. So did a few others.',[['fight',{parched:4}]]],[.4,'The gully is empty and almost comfortable.',[['time',40]]]]}],{reg:[2]}),
E('ev_toll','travel',7,'The Toll','A chain across the road, three raiders and a sign: PAY OR WALK BACK.',[
  {l:'Pay 40 scrip',need:{scrip:40},r:[[1,'They lower the chain. One of them even nods.',[['scrip',-40]]]]},
  {l:'Refuse',r:[[1,'They were hoping you would.',[['fight',{raider:3,raider_gun:2}]]]]},
  {l:'Sneak around at a distance',r:[[.65,'It costs an hour and nothing else.',[['time',60]]],[.35,'Their lookout is better than he looked.',[['fight',{raider:2,raider_gun:2}]]]]}],{reg:[2,3],min:{day:8}}),
E('ev_billboard','travel',4,'The Billboard','Someone has painted over a mattress advert: SAFE PLACE 3 MI WEST. FOOD. DOCTORS.',[
  {l:'Follow it',r:[[.4,'There is a place, and it is not safe, but the last people there left in a hurry.',[['loot','med',3],['loot','food',3],['time',70]]],[.6,'It is a trap, and an old one. The trappers are long dead and still hungry.',[['fight',{shambler:6,runner:2}],['loot','stash',2]]]]},
  {l:'Ignore it',r:[[1,'If it sounds too good.',[]]]}],{reg:[2,3]}),
E('ev_pileup','travel',7,'Forty-car Pile-up','The motorway is solid metal for half a mile. Over, or around.',[
  {l:'Climb over, searching as you go',r:[[.5,'Glove boxes and boots. A good haul.',[['loot','car',4],['time',50]]],[.5,'You are not the only thing moving between the cars.',[['loot','car',2],['fight',{runner:4,crawler:3}]]]]},
  {l:'Go around',r:[[1,'A long loop through the estates.',[['time',70]]]]}],{reg:[3]}),
E('ev_sniper','travel',5,'A Shot','Brick dust jumps off the wall beside your head. Then a voice: "Leave the bag."',[
  {l:'Drop some food and back off',need:{canned_beans:1},r:[[1,'"Good choice." You never see them.',[['take','canned_beans',1],['lose',1]]]]},
  {l:'Rush the building',r:[[.5,'One scared kid with an empty rifle. You take the rifle and leave him a tin.',[['item','rifle',1],['morale',3],['xp',60]]],[.5,'The second shot does not miss, but you get there.',[['hp',-30],['fight',{raider_gun:2,raider:1}]]]]},
  {l:'Go to ground and wait for dark',r:[[1,'A long, cold wait.',[['time',180],['food',-6]]]]}],{reg:[3],min:{lvl:16}}),
E('ev_pharmacy','travel',5,'Green Cross','A pharmacy with its shutter half-down and nothing visible moving behind it.',[
  {l:'Crawl under',r:[[.6,'Shelves stripped, but the dispensary door held.',[['loot','med',4],['time',20]]],[.4,'The pharmacist is in. So are his customers.',[['fight',{shambler:4,spitter:2}],['loot','med',3]]]]},
  {l:'Keep moving',r:[[1,'There will be others.',[]]]}],{reg:[3]}),
E('ev_whiteout','travel',7,'Whiteout','The wind comes up and the world goes away.',[
  {l:'Dig a snow hole and wait',r:[[1,'Hours pass. You do not die.',[['time',150],['food',-8]]]]},
  {l:'Navigate by compass and hope',r:[[.5,'You walk straight out of it.',[['time',30]]],[.5,'You walk in a circle, then off a cornice.',[['hp',-24],['time',90]]]]}],{reg:[4]}),
E('ev_avalanche','travel',4,'The Slope Lets Go','A crack like a rifle above you, and the whole slope starts to move.',[
  {l:'Run across the fall line',r:[[.6,'It thunders past behind you.',[['water',-8]]],[.4,'It clips you and takes something with it.',[['hp',-26],['lose',2]]]]},
  {l:'Get behind the rock spur',r:[[.8,'The snow parts around the rock. It leaves a frozen pack on the surface.',[['loot','gear',1],['loot','food',2]]],[.2,'The spur was not big enough.',[['hp',-34]]]]}],{reg:[4]}),
E('ev_frozen','travel',5,'The Climbers','Four people roped together, sitting in a row, frozen where they stopped to rest.',[
  {l:'Take what they carried',r:[[.7,'They do not object.',[['loot','gear',2],['loot','food',2],['morale',-3]]],[.3,'One of them was only mostly frozen.',[['fight',{frostbitten:4}],['loot','gear',2]]]]},
  {l:'Leave them',r:[[1,'You go round, giving them room.',[['morale',2]]]]}],{reg:[4]}),
E('ev_spore_wind','travel',8,'Spore Wind','The air turns the colour of dishwater and starts to taste of metal.',[
  {l:'Mask up and push through',need:{filter:1},r:[[1,'You burn through a filter. Worth it.',[['take','filter',1]]]]},
  {l:'Hold your breath and run',r:[[1,'Not far enough, not fast enough.',[['tox',28]]]]},
  {l:'Wait it out in the cab',r:[[1,'It takes most of an hour to clear.',[['time',60],['tox',6]]]]}],{reg:[5]}),
E('ev_gray_voice','travel',4,'Somebody Calling','A voice ahead, calling a name. It is your name.',[
  {l:'Answer',r:[[1,'It was never a person.',[['fight',{bloomed:3,sporeling:6}],['tox',10]]]]},
  {l:'Say nothing. Go around.',r:[[1,'It keeps calling for a long time after you are gone.',[['time',40],['morale',-3]]]]}],{reg:[5]}),
E('ev_gray_garden','travel',4,'The Garden','A ring of bloom-trees around a pool, perfectly still. Crystals the size of your arm.',[
  {l:'Harvest quickly',r:[[.6,'In and out before it notices.',[['item','gray_crystal',4],['item','spore_resin',4],['tox',14]]],[.4,'The pool stands up.',[['fight',{gray_knight:1,sporeling:8}],['item','gray_crystal',2]]]]},
  {l:'Do not touch anything',r:[[1,'You back away the way you came.',[]]]}],{reg:[5]}),
E('ev_radio_tower','travel',5,'Dead Relay','A relay mast with its cabinet hanging open. Parts inside, and a ladder to the dish.',[
  {l:'Strip the cabinet',tool:'wrench',r:[[1,'Good components, barely weathered.',[['item','wire',4],['item','circuit',1],['item','battery',1],['time',25]]]]},
  {l:'Climb and look around',r:[[.8,'From the top you can see a long way. You mark what you see.',[['site','airdrop'],['xp',40],['time',20]]],[.2,'A rung gives way.',[['hp',-20]]]]},
  {l:'Pass by',r:[[1,'Heights are not for today.',[]]]}],{min:{lvl:8}}),
E('ev_child','travel',3,'Small Footprints','Child-sized prints in the mud, going into a culvert. A candle is burning in there.',[
  {l:'Call softly and wait',r:[[.7,'A girl of about ten, with a kitchen knife and a very steady hand. She decides to trust you.',[['surv'],['time',40],['morale',6]]],[.3,'She is gone out the far end before you finish the sentence. She left something for you.',[['item','old_coin',3],['item','berries',4]]]]},
  {l:'Leave food at the entrance',need:{canned_beans:1},r:[[1,'When you pass this way again the tin will be gone, and there will be a drawing in its place.',[['take','canned_beans',1],['morale',5],['xp',40]]]]}],{min:{day:5},once:1}),
E('ev_mushroom','travel',5,'Fairy Ring','A perfect circle of fat brown mushrooms under the beeches.',[
  {l:'Pick them',r:[[.75,'Good eating.',[['item','mushroom',6]]],[.25,'Most of them are the wrong kind. You find out which later.',[['item','mushroom',3],['tox',16]]]]},
  {l:'Pick only the ones you are sure of',r:[[1,'A modest handful.',[['item','mushroom',3]]]]}],{reg:[1]}),
E('ev_beehive','travel',4,'Bee Tree','A hollow oak, humming.',[
  {l:'Smoke them and take comb',need:{charcoal:1},r:[[1,'They hardly notice.',[['take','charcoal',1],['item','honey',3]]]]},
  {l:'Just reach in',r:[[.4,'Sticky and unstung.',[['item','honey',2]]],[.6,'A lesson you will remember.',[['item','honey',1],['hp',-14]]]]},
  {l:'Leave them be',r:[[1,'They were here first.',[]]]}],{reg:[1]}),
E('ev_flat','travel',6,'Blow-out','The front tyre goes with a bang.',[
  {l:'Patch it',need:{rubber:1,tape:1},r:[[1,'Ten minutes with tape and a prayer.',[['take','rubber',1],['take','tape',1],['time',15]]]]},
  {l:'Push it the rest of the way',r:[[1,'A long, stupid walk.',[['time',110],['water',-10]]]]}],{min:{veh:2}}),
E('ev_fuel','travel',5,'Tanker','A fuel tanker jack-knifed across both lanes. Something is dripping.',[
  {l:'Fill what you can carry',r:[[.7,'It is good fuel.',[['item','fuel',4],['time',20]]],[.3,'A spark, somewhere. You run.',[['hp',-22],['item','fuel',1]]]]},
  {l:'Drive on',r:[[1,'One spark is all it would take.',[]]]}],{min:{veh:3}}),
E('ev_tide_sign','travel',6,'Trampled Ground','A swathe of flattened grass thirty yards wide, heading the same way you live.',[
  {l:'Follow it back to where they came from',r:[[1,'You find where they gather.',[['site','horde_nest'],['time',45]]]]},
  {l:'Lay false trails',r:[[.6,'It will not stop them, but it will slow them.',[['horde',5],['time',60]]],[.4,'They find you laying the trail.',[['fight',{shambler:5,runner:2}]]]]},
  {l:'Hurry home',r:[[1,'You know what it means.',[]]]}],{min:{day:4}}),
E('ev_hunter','travel',4,'The Trapper','An old man skinning a hare by a smokeless fire. He looks at your boots, then at you.',[
  {l:'Share the fire',r:[[1,'He talks about snares for an hour. You learn things.',[['xp',80],['time',60],['food',10]]]]},
  {l:'Trade hides for jerky',need:{hide:3},r:[[1,'A fair swap by his reckoning.',[['take','hide',3],['item','jerky',5],['item','leather',1]]]]},
  {l:'Ask if he wants walls around him',r:[[.35,'He thinks about it for a long time, then kicks dirt over the fire.',[['surv']]],[.65,'"Walls are where they find you." He does give you a snare.',[['item','rope',3],['item','raw_meat',2]]]]}],{reg:[1,4]}),

// ======================= at home =======================
E('home_gate','home',8,'Someone at the Fence','A man with his hands up, standing where your clearing ends. He has been walking a long time.',[
  {l:'Take him in',r:[[.85,'He eats like he has not in a week. Then he asks what needs doing.',[['surv']]],[.15,'He was the scout. His friends arrive after dark.',[['fight',{raider:3,raider_gun:1}]]]]},
  {l:'Give him food and send him on',need:{canned_beans:1},r:[[1,'He thanks you and means it.',[['take','canned_beans',1],['morale',2],['xp',20]]]]},
  {l:'Turn him away',r:[[1,'He goes without a word.',[['morale',-3]]]]}],{min:{day:2}}),
E('home_trader','home',9,'Caravan Bells','Mules, a wagon, and four people with rifles who would rather sell than shoot.',[
  {l:'Trade',r:[[1,'They set up in the clearing.',[['trade',1]]]]},
  {l:'Wave them on',r:[[1,'They will be back this way.',[]]]}],{min:{day:2}}),
E('home_crows','home',6,'Crows in the Beds','A black cloud of them settles on the garden.',[
  {l:'Run at them shouting',r:[[.6,'They lift off, complaining.',[]],[.4,'They got half of it first.',[['crop',-.5]]]]},
  {l:'Shoot a few',need:{arrow:2},r:[[1,'The rest take the hint. Crow is edible.',[['take','arrow',2],['item','raw_meat',2],['item','feather',5]]]]}],{need:'garden',noneed:'scarecrow'}),
E('home_storm','home',5,'Wind in the Night','A gale comes through after midnight and takes what was not tied down.',[
  {l:'Go out and lash things down',r:[[.7,'A wet hour, and everything holds.',[['hp',-5]]],[.3,'A branch comes down on you.',[['hp',-18]]]]},
  {l:'Stay in bed',r:[[1,'In the morning there is mending to do.',[['raid',.08]]]]}],{weather:['storm']}),
E('home_fever','home',5,'Fever','You wake shivering, with a head full of wool.',[
  {l:'Herbal tea and a day in bed',need:{herbal_tea:1},r:[[1,'By evening it has broken.',[['take','herbal_tea',1],['time',360]]]]},
  {l:'Work through it',r:[[1,'A bad idea, executed badly.',[['buff','weak',.25,600],['hp',-10]]]]},
  {l:'Sweat it out',r:[[1,'A lost day.',[['time',600],['food',-10],['water',-14]]]]}],{min:{day:5}}),
E('home_scouts','home',8,'Shapes at the Tree Line','Three of them, standing still, facing the house. Scouts for the tide.',[
  {l:'Kill them before they report',r:[[1,'They do not go quietly.',[['fight',{runner:3,shambler:2},'home'],['horde',4]]]]},
  {l:'Let them look',r:[[1,'By morning they are gone. They saw what they came to see.',[['horde',-4]]]]}],{min:{day:3}}),
E('home_broadcast','home',6,'A Voice on the Set','The radio wakes itself up at 3 a.m. Co-ordinates, repeated, then static.',[
  {l:'Write them down',r:[[.5,'A supply drop, scheduled by a machine that does not know everyone is dead.',[['site','airdrop']]],[.5,'Someone calling for help.',[['site','distress']]]]},
  {l:'Turn it off',r:[[1,'You need the sleep.',[]]]}],{need:'radio'}),
E('home_bear','home',4,'Bear at the Stores','Something very heavy is taking the lid off your food box.',[
  {l:'Drive it off',r:[[1,'It does not want to go.',[['fight',{bear:1},'home']]]]},
  {l:'Let it eat',r:[[1,'It takes what it wants and ambles off.',[['losefood',6]]]]}],{min:{day:6},reg:[1]}),
E('home_birthday','home',3,'A Good Evening','Somebody found a guitar. Somebody else found a bottle.',[
  {l:'Open the stores a little',need:{canned_beans:2},r:[[1,'For one night it almost feels like before.',[['take','canned_beans',2],['morale',12],['buff','regen',1,600]]]]},
  {l:'Early night. Work tomorrow.',r:[[1,'They understand. Mostly.',[['morale',-2]]]]}],{minSurv:2}),
E('home_argument','home',5,'Raised Voices','Two of your people are about to settle something with a shovel.',[
  {l:'Step in and hear both sides',r:[[.7,'It was about nothing. It usually is.',[['morale',5],['time',30]]],[.3,'Now they are both angry with you.',[['morale',-4]]]]},
  {l:'Let them sort it out',r:[[.5,'They do.',[['morale',2]]],[.5,'One of them packs and leaves before dawn.',[['survleave']]]]}],{minSurv:3}),
E('home_stray','home',4,'Thin Dog','A dog is watching you from under the cart. Ribs like a washboard.',[
  {l:'Put down some meat',need:{cooked_meat:1},r:[[1,'It eats, then lies down across your doorway like it has always lived here. A kennel would make it official.',[['take','cooked_meat',1],['flag','dog_met'],['morale',4]]]]},
  {l:'Shoo it',r:[[1,'It goes, looking back twice.',[]]]}],{min:{day:4},once:1}),
E('home_meteor','home',3,'Fire in the Sky','A green streak, a flash beyond the ridge, and a thump you feel in your teeth.',[
  {l:'Mark where it fell',r:[[1,'You take a bearing off the old pine.',[['site','meteor']]]]}],{min:{day:5}}),
E('home_smoke','home',5,'Smoke on the Ridge','A thin grey line where there was none yesterday. Somebody is camping within sight of your walls.',[
  {l:'Mark it and deal with them',r:[[1,'You fix the place in your mind.',[['site','bandits']]]]},
  {l:'Douse your own fire and lie low',r:[[.6,'They move on in a day or two.',[]],[.4,'They come to you instead.',[['fight',{raider:4,raider_gun:2},'home']]]]}],{min:{day:8}}),
E('home_harvest','home',4,'A Good Year','The beds are heavy. Everything came up at once.',[
  {l:'Bring it in',r:[[1,'Baskets of it.',[['item','carrot',4],['item','potato',4],['item','corn',3],['morale',4]]]]}],{need:'garden',min:{day:7}}),
E('home_migration','home',4,'Hooves','The ground is drumming. A herd is coming through the valley.',[
  {l:'Mark their path',r:[[1,'They will be grazing the east meadow for a day at least.',[['site','herd']]]]}],{min:{day:3}}),
E('home_leak','home',4,'Spoiled Stores','Damp has got into a corner of the stores.',[
  {l:'Sort through and save what you can',r:[[1,'Less lost than you feared.',[['losefood',2],['time',40]]]]},
  {l:'Salt everything down',need:{salt:3},r:[[1,'Nothing lost, and jerky made.',[['take','salt',3],['item','jerky',2]]]]}],{min:{day:6}}),
];

// Weather. Each lasts 4-10 game hours. w weight per region id (index 0 unused → default).
export const WEATHER={
  clear:{n:'Clear',w:10,ic:'sun'},
  overcast:{n:'Overcast',w:5,ic:'cloud',light:.85},
  rain:{n:'Rain',w:4,ic:'rain',light:.7,rain:1,thirst:.8,crop:1.5,sight:.85},
  storm:{n:'Thunderstorm',w:1.5,ic:'storm',light:.5,rain:2,thirst:.8,crop:1.5,sight:.7},
  fog:{n:'Fog',w:2.5,ic:'fog',light:.75,fog:1,sight:.55},
  heat:{n:'Heatwave',w:1.5,ic:'sun',light:1.1,thirst:1.7,crop:.6},
  snow:{n:'Snowfall',w:0,ic:'snow',light:.8,snow:1,sight:.8,cold:1.5},
  spores:{n:'Sporefall',w:0,ic:'tox',light:.6,spores:1,sight:.7,tox:1},
};
export const WEATHER_BY_REG={1:{},2:{rain:1,storm:.5,fog:.5,heat:6},3:{fog:4,overcast:8},4:{snow:12,rain:0,heat:0,storm:0,fog:3},5:{spores:10,fog:5,heat:0}};

// Tides: assaults on the homestead. A tide's budget buys enemies by cost; `mix` favours kinds; boss on every 5th.
export const TIDE_KINDS=[
  {id:'shamble',n:'Husk Tide',d:'A slow wall of them.',mix:{shambler:6,crawler:2,bloater:1,brute:1,armored:1}},
  {id:'sprint',n:'Sprinter Pack',d:'Fast, light, and at the walls before you hear them.',mix:{runner:8,crawler:2,screamer:1,stalker:1},min:4},
  {id:'siege',n:'Breakers',d:'Brutes come for the walls. The rest come through the holes.',mix:{brute:3,shambler:4,armored:2,bloater:1},min:5},
  {id:'spit',n:'Spitter Swarm',d:'They stand off and rain acid on everything.',mix:{spitter:6,shambler:3,bloater:2,runner:2},min:5},
  {id:'raid',n:'Raider Assault',d:'People. They want what you have, and they shoot.',mix:{raider:6,raider_gun:4,raider_heavy:1},min:7,human:1},
  {id:'night',n:'Stalker Moon',d:'They only come on the darkest nights. Light is your friend.',mix:{stalker:5,runner:4,crawler:3},min:9},
  {id:'gray',n:'Gray Tide',d:'The bloom itself, walking.',mix:{sporeling:8,bloomed:3,hound:3,gray_knight:1},min:16},
];
export const TIDE_COST={shambler:1,crawler:.8,runner:1.2,bloater:2,spitter:2,brute:6,screamer:3,armored:3.5,stalker:4,parched:1.3,frostbitten:2,sporeling:.9,bloomed:3.5,gray_knight:9,hound:2,raider:2,raider_gun:2.6,raider_heavy:6};

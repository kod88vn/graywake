// The other communities in the valley and beyond, and the numbers that govern dealing with them. Pure data.
// A community has a standing with you (-100..100) and a strength (0 = broken). See js/sim/community.js for the rules.
//   reg    region it lives in: you hear of it once you can reach that region (or one region early with a radio)
//   x,y    where it sits on the map (same 0..1000 × 0..640 space as locations)
//   start  standing when you first hear of it · cap: the best standing it will ever allow
//   likes  gifts worth double · stock: what its caravan sells · route: what a trade route brings in each day [item,min,max], plus scrip [min,max]
//   raid   creature table for one raiding party at strength 0; grows with its strength and the day · spoils: what a won fight against it brings back
export const FACTIONS={
  mill:{n:'Millrace',reg:1,x:268,y:305,c:'#d0a050',start:20,cap:100,str:45,
    d:'Sawyers and carpenters who kept the old water mill turning. Timber for food is the oldest deal in the valley, and they honour it.',
    likes:['cooked_meat','baked_potato','cornbread','honey','stew'],stock:['plank','nails','rope','seed_carrot','seed_potato','repair_kit','iron_bar','cloth'],
    route:[['plank',5,9],['nails',8,16],['rope',1,3]],scrip:[5,10],raid:{raider:3,raider_gun:1},spoils:[['plank',10,20],['nails',20,40],['iron_bar',2,5]]},
  coop:{n:'Dustline Co-op',reg:2,x:405,y:486,c:'#c8b060',start:10,cap:100,str:40,
    d:'Forty families dry-farming the plain behind a tyre wall. Short of water, long on seed, and suspicious of anyone who arrives armed.',
    likes:['water','herbal_tea','repair_kit','bandage','honey'],stock:['seed_corn','seed_pumpkin','seed_herb','seed_potato','potato','corn','salt','compost','cornbread'],
    route:[['potato',3,6],['corn',3,6],['salt',1,3],['compost',1,3]],scrip:[3,7],raid:{raider:3,raider_gun:1},spoils:[['potato',8,14],['corn',8,14],['salt',4,8],['seed_pumpkin',2,4]]},
  ward:{n:'Harrow Wardens',reg:3,x:652,y:204,c:'#7090c0',start:-5,cap:100,str:70,
    d:'What is left of the city police and the people they could not turn away, holding four blocks of Harrow. They keep lists. Get on the right one.',
    likes:['medkit','bandage','painkillers','fuel','antitoxin'],stock:['ammo_9','shell','gunpowder','steel_bar','battery','flare','medkit','filter'],
    route:[['ammo_9',6,14],['gunpowder',1,3],['steel_bar',1,2]],scrip:[8,14],raid:{raider_gun:3,raider_heavy:1},spoils:[['ammo_9',20,40],['shell',8,16],['steel_bar',3,6],['medkit',1,2]]},
  tarn:{n:'Tarn Hold',reg:4,x:502,y:62,c:'#a8d0e0',start:0,cap:100,str:35,
    d:'Trappers wintering in a dam keeper\'s house above the snow line. They speak little, pay in fur, and remember every favour.',
    likes:['coffee','salt','moonshine','stew','pie'],stock:['hide','leather','fat','jerky','bone','coffee','arrow','cloth'],
    route:[['leather',1,3],['hide',2,4],['jerky',2,4],['fat',1,2]],scrip:[4,8],raid:{raider:2,raider_gun:2},spoils:[['leather',4,8],['hide',6,10],['jerky',6,10]]},
  ledger:{n:'The Red Ledger',reg:2,x:540,y:506,c:'#d05040',start:-60,cap:20,str:60,hostile:1,
    d:'A raider crew that writes down what every settlement "owes" and comes to collect. Tribute buys quiet for a while. Breaking them buys it for good.',
    likes:['moonshine','ammo_9','fuel'],stock:['ammo_9','shell','moonshine','fuel','pipe_bomb'],
    route:[['fuel',1,2],['ammo_9',4,8]],scrip:[2,5],raid:{raider:3,raider_gun:2},spoils:[['ammo_9',15,30],['fuel',3,6],['scrap',10,20],['old_coin',3,8]]},
  choir:{n:'The Pale Choir',reg:5,x:896,y:286,c:'#b090e0',start:-40,cap:0,str:80,hostile:1,
    d:'They walked into the Gray on purpose and it let them stay. They herd the bloomed like cattle and consider your fences an insult.',
    likes:[],stock:[],route:[],scrip:[0,0],raid:{bloomed:2,sporeling:3,spitter:1},spoils:[['filter',2,4],['antitoxin',2,4],['mil_parts',1,3]]},
};
// Standing bands, lowest first: [below this value, name, colour variable]
export const RELATIONS=[[-50,'At war','var(--red)'],[-15,'Hostile','var(--red)'],[25,'Wary','var(--dim)'],[60,'Friendly','var(--green)'],[101,'Allied','var(--amber2)']];
export const relOf=st=>RELATIONS.find(r=>st<r[0])||RELATIONS[RELATIONS.length-1];
// Tunable numbers for the community layer (see docs/BALANCE.md)
export const COMM={
  waitDays:3,waitMax:4,          // how long a would-be recruit waits at the fence, and how many can wait
  giftPerScrip:.2,giftDayCap:12,  // standing per scrip of gift value, and the most one community takes in a day
  routeAt:25,routeCost:40,routeRisk:.06,routeWarRisk:.05,routeGuard:.015,   // trade routes
  pactAt:60,volunteerCost:50,volunteerDays:4,
  tribute:30,tributeGain:30,
  raidChance:.2,raidFrom:8,       // daily chance a community at war sends a party, from this day on
  partyHurtWin:.15,partyHurtLose:.45,partyDie:.08,
  campHit:35,raidHit:6,partyHit:14,
};

# Adding content

Almost everything is a row in a table under `js/data/`. After any edit run `npm run check`: it catches unknown ids, items nobody can obtain, missing models, icons and sounds.

## An item (`items.js`)

```js
smoked_fish:{n:'Smoked Fish',t:'food',ic:['fish','#8a5a30'],v:12,food:30,hp:4},
```

- `t` decides behaviour: `mat food med tool melee gun throw ammo head body legs feet pack seed bp key misc`.
- `ic` is `[glyph, colour, colour2?]`. Reuse a glyph from `js/ui/icons.js` (`tools/icons.html` shows them all) or add one there.
- It must be obtainable: give it a recipe, put it in a loot family, a creature's `drop`, a node's `give`, the trade list, or an event.
- Weapons and tools need `dur`. Held weapons need `mdl`, a key of `HAND` in `js/view/props.js`.
- Armour that should show on the character needs `look:{c:'#colour', s:'hood|cap|helm|visor|mask'}` for heads or `s:'vest|jacket|plate'` for bodies.

## Something to wear

A wearable is an item with `t` of `head`, `body`, `legs`, `feet`, `hands` or `pack` and a `look`: `{c colour, s style, c2 accent}` (packs: `{c, z}` with size `z` 1..5). The style names a drawing in `humanoid()` / `drawHead()` in `js/view/rigs.js`:

- head: `hood cap helm visor mask furhat combat gasmask exo brim skull bandana`
- body: `shirt vest jacket coat duster plate riot carrier suit exo spiked`
- legs: `pants wrap greaves guards cargo suit exo fur chaps kilt`
- feet: `boots wraps heavy rubber fur exo` · hands: `gloves wraps gauntlet exo`

To add a new style, draw it in `rigs.js` next to the others (it only runs when an item asks for it) and add its name to `STYLES` in `tools/check.mjs`. Look at `tools/rigs.html?low=1&q=<outfit>` (add the outfit to the `outfits` list there). Four pieces sharing a `set` (head, body, legs, feet) give the bonus in `SETS`; gloves carry no set.

## A recipe (`recipes.js`)

```js
R('smoked_fish',1,'tannery',1,8,60,{raw_fish:1,salt:1}),
//  output, qty, station, station tier, player level, game-minutes, inputs
```

A second recipe for the same item needs `{id:'unique_name'}`. `{bp:1}` makes it schematic-only; then some `bp_*` item must list it in `learn`.

## A buildable (`objects.js`)

```js
smokehouse:{n:'Smokehouse',solid:1,station:'tannery',sl:2,cat:'craft',lv:18,cost:{plank:20,brick:10},hp:400},
```

Give the previous tier `up:'smokehouse'` to make it an upgrade. Add a model with the same key to `PROPS` in `js/view/props.js` and look at it with `node tests/gallery.mjs props smokehouse`. A buildable with `wall` or `door` stands on a tile edge, not in a tile (see Walls on edges in `ARCHITECTURE.md`): its model runs along X from -0.5 to 0.5, about a fifth of a tile deep, with a post at each end, and a door model takes a part number (0 whole, 1 frame, 2 leaf, the leaf spanning x ±0.34). Behaviour comes from fields: `wall`, `door`, `low`, `floor`, `store`, `bed`, `station`+`sl`, `trap{}`, `turret{}`, `light`, `prod{}`, `special`.

## A creature (`enemies.js`)

Copy a row with the `ai` you want. Stats are for level 1 and scale with the zone. The body is `rig:['husk'|'human'|'quad'|'crawler'|'blob', {...colours and features}]`. To have it join tides add `tide:[weight, firstTide]` and a cost in `TIDE_COST` (`events.js`). A boss gets `boss:1` and an `abil` list; every ability needs `cd`, and the damaging ones `wind` (the tell).

## A place (`world.js`)

```js
L('old_mill','The Old Mill',1,260,300,5,'town','forest',{d:'...',nodes:{tree_oak:6},props:{crate:3},bld:[['barn',1]],en:{shambler:6},inn:{crawler:3},night:{runner:3}}),
//  id, name, region, map x, map y, level, layout, biome, generator fields
```

Layout `complex` wants `wall`, `floor` and `fill` instead of `bld`. Add `boss`, `lock:{gun_cabinet:1}`, `hazard`, `dark`, `tox`, `cold` as needed. A new building shape is a row in `BLD`. `npm run test:sim` generates every location with three seeds and fails if containers or spawns are walled off.

A temporary site is a row in `SITES` with the same generator fields plus `dur` (hours on the map).

## A text event (`events.js`)

```js
E('ev_id','travel',6,'Title','What you see.',[
  {l:'Option',need:{rope:1},r:[[.7,'It works.',[['take','rope',1],['loot','stash',2]]],[.3,'It does not.',[['hp',-10]]]]},
  {l:'Walk on',r:[[1,'You walk on.',[]]]}],{reg:[1,2],min:{day:3}}),
```

Outcome chances per option must sum to 1. The effect list is documented at the top of the file; `applyFx` in `js/sim/world.js` is where a new effect would go (and add its name to the list in `tools/check.mjs`).

## A story step, contract pool, perk, achievement (`progress.js`)

- Story steps run in order. Goals: `have deliver craft build visit kill boss level tide surv veh stat`. A location can hide a quest item while a step is active with `qi:[['item_id','quest_id']]`.
- Perks are `{fx:{key: perRank}}`; the sim reads them through `perk('key')`. A new key needs a line of code where it should apply.
- Achievements watch a counter in `S.stats`.

## A community (`community.js`)

Add a row to `FACTIONS`: name, region, map position (same space as locations; keep 50 units clear of any location), colour, starting standing, the best standing it allows (`cap`), strength, a description, `likes` (gifts worth double), `stock` (its caravan), `route` (daily goods of a trade route) and `scrip`, `raid` (creature table of one raiding party) and `spoils`. `hostile:1` marks a crew the others are glad to see hit. A community whose `cap` is under 25 can never be traded with; under 60, never allied. The tunable numbers for the whole layer are in `COMM`. `npm run check` validates every id.

## A sound, a model, an icon

- Sound: add a recipe to `SFX` in `js/audio.js`; `node tests/audio.mjs` checks its level against its group.
- Model: a function in `PROPS` or `HAND` that draws into the `Geo` it is given. Conventions are at the top of `geo.js` and `props.js`.
- Icon: a function in `GLYPHS` drawing in a 0..100 box.

## A region

Add a row to `REGIONS` (with the vehicle tier that opens it), a biome to `BIOMES` if it looks different, a weather mix to `WEATHER_BY_REG`, locations, a contract pool row in `CONTRACTS.fetch` and `.hunt`, a row in `TRADE_BP`, and the loot families need rows that reach its tier (tiers are region numbers; rows are `[item, weight, min, max, firstTier, lastTier]`). Loot tiers above 5 need the `T()` rows widened.

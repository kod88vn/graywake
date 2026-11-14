# Graywake

A top-down 3D survival game for the browser, with an automated playtester and shared worlds.

You wake in a forest clearing beside a dead truck. Gather, craft, raise walls with windows and doors, plant a garden, take in the people you rescue, and walk out past the tree line for everything else. Every third night a **tide** of husks comes for whatever you have built, harder each time and fought by you, your people and your traps. The setting, names, creatures, map and art are original.

It runs on a desktop (keyboard and mouse) and on a phone (touch). There is nothing to install, nothing to buy, no account, no energy bar and no waiting: time passes only while you play. Everything you see and hear is generated in code. The current version is **0.10.79** (`js/sim/core.js`, `CHANGELOG.md`).

- [Play](#play) · [Controls](#controls) · [How the game works](#how-the-game-works) · [Shared worlds](#shared-worlds) · [The bot playtester](#the-bot-playtester) · [Repository layout](#repository-layout) · [Commands and tests](#commands-and-tests) · [Publishing](#publishing) · [Documentation](#documentation) · [Status and honest limits](#status-and-honest-limits)

## Play

```sh
npm start        # then open http://localhost:8090 (also reachable from a phone on the same network)
```

Needs Node 22 or newer. There are no packages to install: no dependencies, no build step. three.js (r160, MIT licence) is vendored in `vendor/`. The game is also published as a private Claude artifact (see [Publishing](#publishing)); the published copy plays alone, with no world server.

## Controls

| | Keyboard and mouse | Touch |
|---|---|---|
| Move | WASD | left thumb, anywhere on the left half |
| Attack | left click (aims at the cursor) | big button (aims by itself) |
| Interact (gather, search, open, sleep) | E or right click | Use |
| Auto mode: gathers, fights back, takes loose loot, stores, defends | F | AUTO |
| Dodge / sneak | Space / Shift | Dodge / Sneak |
| Swap weapon | Q | tap the other weapon slot |
| Pack · craft · build · journal · camp ledger · world sheet · menu | I (or Tab) · C · B · J · L · O · P | buttons, top right |
| Map (leave a place) | M | the map button |
| Heal · eat · drink · antidote | 1 · 2 · 3 · 4 | tap the bar |
| In build mode: turn a piece | R or right-click | Rotate |
| Close a sheet | Esc | × |

At home M says to walk to the edge of the homestead; away from home it opens the map once you are at the edge of the place.

## How the game works

**Survival.** Health, food, water and toxin. Food and water run down in real time; you can eat and drink from the pack with 2 and 3. Medicine heals at once; most food does not. Travelling mends you on the way (it costs food and water). Dying costs your pack, which waits where you fell (a death at home drops it on the nearest free tile). Toxic air raises toxin; past 50 it stops you regenerating. Toxin clears by itself in about two real minutes at home, far slower away; Herbal Tea (campfire), Charcoal Tablets and Antitoxin (Herbalist Table) cure it faster.

**The homestead** is a 46 by 46 area you build on, and it persists. 89 buildable pieces:

- **Walls, windows and doors** stand on the *edges* of cells, never in a cell, so the cell stays usable. Five tiers of wall (stick, plank, stone, steel, reinforced) with matching doors; **windows** (plank, stone) are wall pieces that sight and arrows pass through but nobody walks through. A plain wall can be replaced by a window in place; a wall does not replace a window.
- Floors; 13 kinds of crafting station with upgrades; storage (a Small Box holds 10 slots, a Chest 20 and so on); beds; gardens, rain catchers, wells, coops, hives; traps (stakes and heavier); five turrets; guard posts; lights; a generator; a radio mast; a kennel; a vehicle bay.
- The ledger tells you whether your yard is closed, names any gap, and names furniture you cannot walk to. Placing something that would cut a station, box or bed off from the door is refused.

**Tides.** An assault on the homestead every third night, in seven flavours from one of four trails, always heavier. Fought live if you are home; resolved against walls, traps, turrets and guards if you are away. In a tide Auto mode holds a post (where you stood, or inside the yard if you were well away), fights what comes within reach of it (it leaves the yard late in a fight, when badly hurt after a breach); your fit survivors take up bows, go to the windows nearest you and shoot out. The tide sheet and messages name each wall piece that broke. A tide that has stalled (nothing killed for 90 seconds once every wave is in) ends.

**The map** has five regions and 34 places to scavenge, each generated fresh on every visit: forest, dry plains, a ruined city, snow passes and the toxic Gray. Regions open as you build vehicles, from a hand cart and a bicycle to a sealed truck. Each place shows a level, a travel time and how it compares with you; the map warns when a trip would miss the tide or outlast a lead.

**Radio leads.** The Radio Mast picks up special places (a pharmacy, a police station, a gun shop held by raiders, a hardware store, a fire station) and says the danger before you go: one to five skulls for *you as you stand* (weapon, armour, current health and medicine in your pack; medicine in a storage box does not count), who holds it, how many, what the strongroom holds and how long it lasts. A card says what the rating was worked out for and warns when the air is toxic. Several enclaves in a shared world race for the same lead; the first to open the strongroom takes it.

**People.** Rescued survivors ask to join, wait at the fence a few days (you are warned the dawn before they go), and are recruited from the Camp ledger. A homestead supports **three people besides you**, each needing a bed (one can sleep by the fire). They work only inside the base, at a job: mechanic (repairs walls and traps), farmer, guard, cook or medic, each carrying a real tool (hoe or rake, hammer or wrench, ladle, bandages, bow). They sleep at night, are laid up for three days when downed, leave if morale falls under 15 (it says who and why), and can be sent to run a trade route to a friendly community (the list says which job each would leave). The player travels alone; only on an attack on a base (a war camp, a choir camp, a bandit hold) does the group come.

**Other communities** (run by the game): standing, gifts, caravans (a called caravan stays six hours), trade routes, pacts, tribute, war parties, raids.

**Events.** 48 text events on the road and at home with choices and consequences (each choice says how long it takes and what fight it may lead to), temporary sites on the map (supply drops, distress calls, raider camps, meteor strikes), weather, and radio contracts.

**Progression.** A story in 33 steps, a perk tree, 38 achievements, and an endless descent with rising mutation tiers after the ending. 263 items, 195 recipes, 39 creatures and bosses with telegraphed attacks, ten armour sets, 14 melee and 13 ranged weapons. Wearables are drawn on your character in their own design; with nothing on, the character is bare.

## Shared worlds

An optional world server (`npm run world`, no dependencies) keeps **worlds** in which several enclaves hold ground: people, bots, and *settlements the server plays by built-in rules* (no model drives them). Each game still simulates its own valley; what is shared is who holds ground and how firmly, the radio leads, and an event track that makes tides heavier as the world's deeds add up (six stages, ×1.0 to ×1.7).

- **Hold** (0 to 100, starts at 60): a tide held +10, a strongroom opened +6, a tide that went through −25, a death −8. At 0 the enclave **falls** and moves to another world with room, keeping its level and gear but starting a new homestead.
- A world with no enclave is deleted; anyone can start a new one; a world has room for four players or bots and three settlements. When a settlement falls, newcomers settle in its place two world days later, already grown to the world's pace.
- **Settlements** are seeded from their world, live one day at a time by a plan set by their kind (builders, fighters, scavengers, farmers), raise walls (a window in every sixth piece), lay traps, arm themselves, take people in, risk only the leads the game's own rating says are fair for their leader, and in a tide everyone fights from the windows.
- Play with `http://localhost:8090/?world=http://127.0.0.1:8795`; `&enclave=Name` names the enclave, `&join=<id>` or `&join=new` picks the world. The side-by-side watch page is `http://127.0.0.1:8795/watch`.

Rules and numbers: `docs/MULTIPLAYER.md`. Not built yet: enclaves seeing each other, trading or raiding each other; the server on another machine; accounts.

## The bot playtester

`npm run bot` lets a Claude model (Haiku by default) play in a Chrome of its own while you do other things, through real keys and clicks and with game tools only (no shell, no files, no web). You watch it live at `http://127.0.0.1:8777/` (watch-only: nothing on the page plays the game), it files bugs and ideas with a picture and a saved game attached, and everything it does is kept under `.out/bot/`. Two bots can play at once on different ports and profiles, in the same shared world.

```sh
npm run bot -- --minutes 120 --world http://127.0.0.1:8795 --name "Haiku One" --goal "…"
npm run bot -- --minutes 120 --world http://127.0.0.1:8795 --name "Haiku Two" --profile haiku2 --port 8778 --goal "…"
npm run bot:status | bot:stop | bot:report          # one line of where it is · end it · the latest session as one page
node tools/bot/ctl.mjs hint --port 8777 "text"      # a line the bot reads with its next move
python3 -u tools/bot/watch-events.py                # one line per hold change, newcomer, fall, major bug, finished run
python3 tools/bot/stats.py                          # sessions, hours, cost, reports, recurring complaints
```

It uses the signed-in `claude` command and your usage allowance (measured about $2 an hour at API list prices). A run plays a frozen copy of the game taken when it starts, so you can edit and test freely; it only meets a new version when restarted. What it found, what was good and bad about the setup, and how each bug was fixed: **`harness_review.md`**. How to run it, resume it and triage it: `docs/AUTOMATION.md` and `docs/OPERATIONS.md`.

## Repository layout

```
index.html            a fragment (the artifact host wraps it): never add doctype/html/body; open it with npm start, not as a file
js/data/              content tables, pure data: items, objects, recipes, enemies, world (regions, places, leads, loot), events,
                      progress (story, perks, jobs), community, sources (where every item comes from, worked out from the tables)
js/sim/               the game, pure logic with no DOM and no three.js: core (state, inventory, crafting, building), zone (generation,
                      sight, paths), actors (player, creature AI, Auto mode, work), world (clock, tides, travel, events, saves, shared
                      worlds), quests, community
js/view/              three.js: geometry and lit materials, world and hand models, characters (one skinned body each), scenery,
                      ambient occlusion and film grade, the renderer
js/ui/                the DOM interface: HUD, build mode, every sheet, the map, icons
js/net.js             the game's client for the world server       js/audio.js procedural sound and music
js/input.js           keys, mouse, touch                            js/main.js boot and the loop
vendor/               three.js
tools/                serve.mjs check.mjs lib.mjs · bot/ (the playtester) · world/ (the world server and settlement rules) · measure/
                      (headless A/B measurements) · leadbot, tidebot, playbot · rigs.html gallery.html icons.html soundboard.html
tests/                sim, smoke, play, monkey, bot, world, net, shots, gallery, audio
docs/                 ARCHITECTURE, AUTOMATION, BALANCE, CONTENT_GUIDE, MULTIPLAYER, OPERATIONS, TESTING
CLAUDE.md             orientation and the rules that are easy to break, for whoever works on the code
CHANGELOG.md          every version, in the player's terms
harness_review.md     the bot setup reviewed: numbers, what worked, what did not, lessons, and a log of bugs found and fixed
```

`js/sim/` and `js/data/` stay pure: the sim tells the outside world things only by `emit(...)`, which is what lets the whole game run headless in Node. A save made at any version loads (migrations in `world.js`). Changing the save shape needs a `SAVE_V` bump.

## Commands and tests

| | |
|---|---|
| `npm start` | dev server on :8090 |
| `npm run check` | 1 s static checks: every id resolves, every item is obtainable, every script parses. Run after any data edit. |
| `npm test` | check, sim, smoke, play-through and monkey; about five minutes; needs Chrome |
| `npm run test:sim` | the whole game headless in Node (seeded by the clock: run it two or three times; a failure once in six runs is a failure) |
| `npm run test:smoke`, `test:play` | the real page: every sheet opens; then a full play-through by real key presses and clicks (run `test:play` after any interface or input change) |
| `npm run test:bot`, `test:world` | the bot harness; the world server then a real page against it |
| `npm run shots`, `gallery` | screenshots and a model gallery to `.out/shots/`: look at them after art or interface changes |
| `node tests/audio.mjs` | levels of every sound and music scene |
| `node tools/measure/*.mjs`, `tools/leadbot.mjs` | headless measurements of tides, Auto, survivors, settlements and leads, to compare a change against the last commit (`docs/OPERATIONS.md`) |

Run one browser test at a time: two at once collide and hang. A test that calls a function directly proves the function, not that a player can reach it: new interface work needs a step in `tests/play.mjs` that clicks it. Details: `docs/TESTING.md`.

## Publishing

The game is a private artifact at `https://claude.ai/artifact/NM8HYatScUazqswpDnonAM`. Republish to that same URL so saves survive: page `index.html`, root this repository, supporting files every file under `js/` plus `vendor/three.module.min.js` at the same relative paths. Commit first, run the tests and let them pass, then publish as its own step. The routine and what went wrong when it was not followed: `docs/OPERATIONS.md`.

## Documentation

| | |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | orientation and the rules that are easy to break |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | how the pieces fit: layers, state, events, the loop |
| [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md) | how to add items, recipes, buildings, creatures, places, leads, events and quests |
| [`docs/BALANCE.md`](docs/BALANCE.md) | the numbers, what has been measured and what has not |
| [`docs/TESTING.md`](docs/TESTING.md) | what each test shows and does not show |
| [`docs/MULTIPLAYER.md`](docs/MULTIPLAYER.md) | shared worlds: the rules, the server, settlements |
| [`docs/AUTOMATION.md`](docs/AUTOMATION.md) | the bot: how it plays, what it leaves behind, how to triage |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | resuming the whole setup: processes, commands, release routine, traps, open decisions |
| [`harness_review.md`](harness_review.md) | the bot setup reviewed, with evidence and a bug log |
| [`CHANGELOG.md`](CHANGELOG.md) | every version |

## Status and honest limits

- **Looks.** The art is generated in code: no scanned textures, sculpted models or captured animation. It aims at realism (natural proportions and colours, matte shading with surface grain, real shadows, ambient occlusion, a filmic grade) and reads as believable, not photographic: faces are simple, cloth does not fold, motion is computed. Known weak spots: mitten hands, a shoulder seam, shell hair, a fixed expression. Closer would mean authored 3D assets, a project decision.
- **Testing.** Automated tests, screenshots and about fifty hours of bot play (69 sessions, about 1,300 reports). Nobody has played it for a hundred hours: the length of the progression is designed, not measured (`docs/BALANCE.md`). The audio is level-checked but has not been heard by its author. Headless Chrome uses a software rasteriser, so nothing here measures real frame rate, phone performance, feel or fun.
- **Balance.** Late world stages (tides ×1.5 and ×1.7) overwhelm most settlements within a few tides and every enclave that is not walled in stone with windows, traps and three fit survivors. Whether to ease them is an open decision (`docs/OPERATIONS.md`).
- **Shared worlds** are the first stage: enclaves do not see, trade with or raid each other, and the server runs on one machine.
- **The bots** read text more than pictures and react in seconds, not milliseconds, so they find logic and interface faults, not faults of art, sound or feel.

The game sells nothing and has no dependencies beyond the vendored three.js (MIT licence).

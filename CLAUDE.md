# Graywake — orientation for coding sessions

Single-player top-down 3D survival game for the browser (desktop and phone). Build a homestead, scavenge the map, hold the base against "tides". Plain ES modules, no build step, no npm dependencies. three.js r160 is vendored in `vendor/`. All models, icons and audio are generated in code.

The setting, names, creatures, map and art are original. It is a game in the base-building survival genre; do not turn it into a copy of any existing game's names, characters, levels or look.

## Commands

```sh
npm start            # dev server on :8090 (also reachable from a phone on the LAN)
npm run check        # 1 s static checks: run after every data edit
npm test             # check + headless sim + smoke + real-input play-through + monkey, about 5 minutes (needs Chrome)
npm run test:play    # play-through by real key presses and clicks: run after any interface or input change
npm run test:sim     # headless simulation only (Node, no browser)
npm run shots        # 22 screenshots to .out/shots/ — look at them after art, lighting or UI changes
npm run gallery      # every model on a tile to .out/shots/gallery-*.png — look after touching js/view/props.js
node tests/audio.mjs # level table for every sound and music scene
npm run bot          # a Claude model (Haiku) plays the game by itself for 30 minutes; watch at http://127.0.0.1:8777/ (docs/AUTOMATION.md)
npm run bot:report   # the latest bot session: bugs, ideas, where it struggled
npm run test:bot     # self-test of the bot harness, no model, 40 s
npm run world        # the shared-world server on :8795; play with ?world=http://127.0.0.1:8795 (docs/MULTIPLAYER.md)
npm run test:world   # world server rules, then a real game page against it
```

## Map

- `js/data/` content tables, pure data, importable in Node. Adding content is usually a row here.
  - `items.js` `objects.js` (everything that stands on a tile: nature, containers, scenery, buildables; and the walls and doors that stand on tile edges) `recipes.js` `enemies.js` `world.js` (regions, locations, sites, buildings, loot) `events.js` (text events, weather, tides) `progress.js` (story, contracts, perks, achievements, survivors, trade) `community.js` (the other communities and the numbers for dealing with them).
- `js/sim/` the game, pure logic: no DOM, no three.js. Runs headless in Node.
  - `core.js` shared context `G`, save shape, inventory, derived stats, crafting, building.
  - `zone.js` zone generation, collision, line of sight, path fields, loot rolls.
  - `actors.js` player, creature AI, projectiles, traps, turrets, interaction, auto-gather. `step(dt)`.
  - `world.js` clock, survival, weather, tides, travel, events, survivors, trade, sleep, death, save format. `tick(dt)`.
  - `quests.js` story, contracts, achievements.
  - `community.js` recruits, the group's food and water, standing with other communities, gifts, caravans, trade routes, pacts, tribute, war parties, raids, farm orders. It does not import `world.js`; `world.js` hands it what it needs with `Community.bind()`.
- `js/view/` three.js: `geo.js` (model builder, matte lit materials), `props.js` (world and hand models), `rigs.js` (characters), `scenery.js` (procedural textures, ground clutter, wind materials), `post.js` (ambient occlusion and film grade), `render.js` (scene, instancing, lights, particles, decals, weather).
- `js/ui/` DOM interface: `ui.js` (HUD, build mode, title), `panels.js` (every sheet), `map.js`, `icons.js`, `dom.js`.
- `js/audio.js` procedural sound and music (`Snd`). `js/input.js`. `js/main.js` boot and loop.
- `index.html` is a **fragment** (the artifact host wraps it). Never add doctype, html or body tags. Never open it as a file; use `npm start`.

- `tools/bot/` automated play: `session.mjs` (a Chrome of its own, command API, live picture, logs), `page.js` (what the bot can see), `mcp.mjs` (the bot's tools), `run.mjs` (runs a model in shifts), `watch.html`, `PLAYER.md` (the bot's brief), `report.mjs`, `ctl.mjs` (the same commands by hand). Session files go to `.out/bot/`.

- `tools/world/` and `js/net.js` shared worlds: a world server (enclaves, hold, shared leads, event stages) and the game's client for it. Off unless the page is given `?world=URL`. `docs/MULTIPLAYER.md`.

Guides: `docs/OPERATIONS.md` (**read this to resume work**: what is running, the commands, the release routine, the traps, the open decisions), `docs/MULTIPLAYER.md`, `docs/ARCHITECTURE.md`, `docs/CONTENT_GUIDE.md`, `docs/BALANCE.md`, `docs/TESTING.md`, `docs/AUTOMATION.md`, and `harness_review.md` (the bot setup reviewed, with a log of every bug found and how it was fixed). `tools/measure/` holds the headless A/B measurements; `tools/bot/stats.py` and `tools/bot/watch-events.py` read and watch the bot sessions.

## Rules that are easy to break

- **`js/sim/` and `js/data/` must stay pure.** No `document`, `window`, three.js or `Snd` in them. The sim tells the outside world things only by `emit(...)` onto `G.ev`; `main.js` drains that queue to the renderer, interface and audio. The headless test depends on this.
- **Saves must survive updates.** Any change to the save shape needs a `SAVE_V` bump in `core.js` and a step in `MIGRATE` in `world.js`. New fields with defaults in `blankState()` are filled in automatically on load. Removing an item or object id that saves may reference needs a migration too (unknown ids are dropped on load, not crashed on).
- **Coordinates:** sim `(x, y)` is world `(X, Z)`; tiles are 1 unit; a sim angle `a` is `rotation.y = π/2 − a`. Models stand on `y=0`, face `+Z`, fit a 1×1 tile.
- **The look is realistic. Not blocky, not cartoon, not anime.** The user rejected box-built art ("not roblox style"), tried an anime cel-shaded style for a few versions and rejected that too ("forget anime style, go back to realistic style"), and rejected big heads and stacked-ball bodies as unrealistic. So: no outlines, no banded shading, natural colours. Every lit material comes from `matte()` in `geo.js` (smooth Lambert shading with a surface grain); `post.js` adds ambient occlusion and a filmic grade. Characters in `rigs.js` are measured from a real figure (about 7.3 heads tall) and each body is ONE skinned mesh bound to the skeleton (`seg()` draws into it and assigns bone weights; `wTorso`, `wArm`, `wLeg`), so joints bend a continuous surface: never go back to separate rigid tubes per limb or balls at the joints, which is what made the user call the body "very ugly and not appealing. I do not know anyone who would want to play this" (0.10.0 replaced a wooden-mannequin look). The head is one lofted surface with the features pressed in and tinted, eyes shaded under a lid (no staring whites), hair growing from a hairline; clothes are shells with their own hems and edges; use `g.loft`, `g.sph`, `g.limb`, not `g.box` or stacked spheres, for anything organic. `tools/rigs.html` shows every character (`?low=1&q=bare,rags,hide,leather&fov=14&pose=idle` for a close look, `ry=`/`cam=`/`look=` to move the view, `hair=1` for every hair style, `crowd=70` for frame timing, `window.TRIS` for triangle counts); look at it after touching `rigs.js`. Known weak spots: mitten hands, a visible deltoid seam close up, hair shells, an unchanging expression.
- **Movement is layered and damped, never snapped.** `pose()` in `rigs.js` builds every frame from a gait tied to distance covered, an idle layer, stances and actions keyed over their own progress, on a hips → chest skeleton. New actions get keyed curves with anticipation and follow-through; do not write `rotation = target`. `tools/rigs.html?strip=walk|run|sneak|attack|chop|die|husk|strike` shows ten successive moments of a motion: look at it after touching `pose()`.
- **What the fight shows is when it happens.** Damage lands at the moment the animation shows the blow: a player's swing through `hitAt` and `swingPhase()`, an enemy's through a wind-up that rises and `e.atkT` set when it strikes (see Melee timing in `docs/ARCHITECTURE.md`). A new attack that deals its damage at any other moment is a bug: the user called exactly that "weird and clunky" (0.8.0). After touching combat, compare with the last version by trace, not by reading: fights counted for swings, hits, stops and starts, times hurt (0.8.1 did this with a throwaway script; `tools/tidebot.mjs` covers tides), and look at `tools/rigs.html?strip=strike`.
- **In a tide Auto mode holds the player's post** (`p.post`: where they stood when the tide or Auto began, `POST_REACH` tiles around it), never the middle of the map: a bot's yard was elsewhere and Auto walked out of it into the tide (0.10.2).
- **Auto mode walks like a person.** Straight lines where the way is clear (`walkClear`, `pathDir`), never from cell centre to cell centre, and no stepping in and out at the edge of reach.
- **What is worn is what is drawn.** An empty Body, Legs or Feet slot shows skin (the character stands in underwear), and every wearable has a `look` with a style that is drawn in `rigs.js` (`npm run check` rejects unknown styles). A new wearable that looks like a recolour of another is not finished: give it its own silhouette.
- **One object per tile** (`Z.obj[i]`), plus an optional floor (`Z.fl[i]`). After changing a tile call `Z.touch(i)` (path fields and the renderer both listen); for floors `emit('floor', i)`.
- **Walls and doors the player builds are not tile objects.** They stand on cell edges in `Z.ed` (`Z.ed[tile*2]` north edge, `Z.ed[tile*2+1]` west edge; `edgeIdx()` in `core.js` names an edge from a tile and a side 0 N, 1 E, 2 S, 3 W) and never appear in `Z.obj`. After changing one call `Z.touchEdge(e)`. Where one number must name either kind of structure it is a tile index or `EREF + edge` (`structAt`, `structXY`; `damageObj`, `upgrade`, `repair`, `demolish`, `moveObj`, `rotateObj` all take that). Anything that reaches, sees, shoots or strikes from A to B must ask `edgeCross()` (or `los()`, which does) as well as looking at tiles. Walls of buildings in locations (`w_brick` and the like) and fences live in `Z.ed` too, placed by `wallOn()` in `zone.js`: they have no `hp` and no `cost`, so nothing breaks or paths through them, and a `low` one (a fence) stops feet but not sight, shots or reach. The user asked for this ("Wall does not occupied the whole cell, only 1 side and the cell should still be usable") and noticed at once when world buildings were left on the old system ("it seems like the base is still using the old wall which occupies the whole cell?"): **no wall of any kind goes into a cell**, and when a system is overhauled, say plainly which parts were left out.
- **A radio lead tells the player its danger before they go.** The user's words: "Make the difficulty known ahead of time for players." Every lead (a `SITES` row with `lead:1`) shows a threat of one to five skulls against the player's level, who holds it, about how many, what the strongroom holds and how long it lasts, on the radio sheet and on the map (`World.leadInfo`). Anything that makes a lead harder than it reads (enemies at the arrival point, more guns) is a bug: `spawnList` keeps the way in clear, and raiders add to the rating. A new lead needs only a data row (`docs/CONTENT_GUIDE.md`). The rating assumes two or three come at a time: after touching noise, sight, summons or a garrison, measure with `node tools/leadbot.mjs` (0.9.7: one loud Bloater made a two-skull Pharmacy kill half the time).
- **People at a base: at most three besides the player** (`BASE_PEOPLE`), working inside the base only (repair, defence, farming, cooking, medicine). The player travels alone; only on an attack on a base (`SITES` rows with `base:1`) do the homestead's people come along. The user's rules, 0.10.4.
- **Survivors sleep at night and all fit survivors defend in a tide** (the user asked for both, 0.10.15): `sleep` in `survivorWork`, the `sleep` pose in `rigs.js`, and the tide-start conversion to bow-armed `guard` actors (`from:'home'`) in `world.js`.
- **Survivors at home are seen working** (`survivorWork` in `actors.js`, `e.work`, the tool and motion in `render.js`): the user asked for them not to wander "uselessly all day". A new job needs a place in `WORK_AT` and a tool in the renderer.
- **Gear can be found, and what is found gets worn.** The user: "the bot is almost always naked. It should know to wear the best gears. We also need to have more useful items for it to loot, weapons and gears included." `LOOT.finds` in `js/data/world.js` holds every weapon and wearable by tier (a test fails if one is craft-only); `FIND` gives ordinary containers a chance of one, and a lead's strongroom always has two. A new weapon or wearable needs a row in `finds`. `gained()` in `core.js` puts a thing on when its slot is empty; `betterGear()` and `wearBest()` are behind the pack's Wear best button and the bot's "Wearing" line.
- **Whatever is missing, the game says where it comes from.** `js/data/sources.js` works that out from the tables; show it wherever a new "missing X" appears.
- **Bit shifts on `hash()` results use `>>>`**, never `>>`: the hash is unsigned and `>>` turns the top half negative (this once produced `undefined` model ids).
- **Publishing sends every file under `js/`**, including `js/net.js`, `js/data/community.js`, `js/data/sources.js` and `js/sim/community.js`: a new module that is left out of the publish breaks the page.
- **Every id is checked.** `npm run check` fails on an unknown item, object, creature, loot family, model, icon glyph or sound, and on any item that cannot be obtained. Run it after touching `js/data/`.
- **Feedback must be visible where the player is looking.** Toasts, the pickup feed and banners sit above sheets (`z-index` in `index.html`); a sheet must fit the screen and scroll inside `#pb`. An action that cannot complete (full pack, missing tool) refuses with a message and takes nothing.
- **The simulation runs in real time at any frame rate** (`main.js` splits slow frames into steps). Never cap `dt` in a way that slows the game down.
- **The game sells nothing:** no purchases, energy, real-time waits or ads. Time only passes while you play or travel.
- **No dependencies and no build step** without discussing it first.

- **Windows are walls that let sight and shots through** (`window:1` in `objects.js`; `edgeCross(..., sight=true)` and `los()` pass them, walking does not). In a tide fit survivors go to the windows nearest the player (`windowSpots` in `world.js`) and shoot from there: walls stop arrows. A window goes into a plain wall in place (`swaps` in `core.js`, half the old cost back); a wall does not replace a window (a drag would undo a whole row). The user's words: "walls with windows so shoot through feel more realistic. Bots need to be near a window to shoot outside. Line of sight rules still apply, window allows line of sight but block pathway."
- **Nothing the player owns is lost silently.** What does not fit the pack at home goes into the storage boxes and the game says so (`give`, `roomForHome`); a death at home always keeps the pack on the nearest empty tile (`placeBag`); a trade or sale waits for room; a survivor who leaves is logged with the morale and the body is removed. A fault of this kind outranks a balance fault: fix and test it first.
- **Auto mode in a tide**: its post is where the player stands unless that is well away from home (then a spot inside the yard, `homeAnchor`); it hunts stragglers only when three or fewer remain or all are ranged; gathering stays within fourteen tiles of the yard when a tide is under two hours off; a tide with nothing killed for 90 seconds ends. Measured with `tools/measure/yard.mjs`; read `docs/OPERATIONS.md` section 6 before changing any of it.
- **The late-stage tide stays hard.** The user: "don't make late-stage tide easy" (2026-11-14). Never lower the world stages' tide multipliers (×1.5, ×1.7) or soften late tides; help the player prepare instead.
- **Releasing**: `npm run check`, then the tests (stop on the first failure), then bump `VERSION` in `js/sim/core.js`, `package.json` and `CHANGELOG.md`, commit, and only then publish, as its own step. Publishing in the same step as a failing test run happened once (0.10.74).
- **Bot reports are leads, not verdicts**: reproduce from the report's `save.json`, then sort it into game fault, rough edge (the game is right but silent: make it say so), the bot's tools, or the bot misreading. `harness_review.md` section 7 lists examples of each.

## Bot sessions

The user runs a bot (Haiku) on the game while working on other things, watches it live, and wants both of you to spot bugs and plan improvements from what it finds. Their conditions, in their words: "I still need to do other stuff and I do not want my other activities to interfere with bot session", "I need to be able to observe too, just cannot control", "I want live observation". So:

- The bot's browser stays separate from the user's (own Chrome profile, no focus, frozen copy of the code) and the bot gets game tools only. Do not point it at the user's Chrome, the Claude-in-Chrome extension or computer use, and do not give it a shell.
- Watching stays live (a moving picture, real-time pace by default) and watch-only.
- To review a session: `npm run bot:report`, then `bugs/NNN/` under the session folder (look at `shot.jpg`; `save.json` reproduces). Sort each report into game bug, rough edge, or the bot's tools misreading the game, and say which is which. Reports from a bot are leads, not verdicts: reproduce before changing the game.
- You may start a run yourself in the background (`npm run bot -- --minutes N`); it uses the user's Claude allowance, so say so.
- Everything the bot does must go through real input. If it "cannot" do something a player can, extend `tools/bot/`, never add a cheat.

## Verifying a change

1. `npm run check`.
2. Gameplay: `npm run test:sim` (it is seeded by the clock, so run it two or three times). For tide or combat numbers also run the bot in `docs/BALANCE.md`.
3. Art, lighting, interface: `npm run shots` (and `npm run gallery` for models) and read the images. Stills do not show motion: say so.
4. Audio: `node tests/audio.mjs`. Say plainly that it has not been listened to unless a person has.
5. Headless Chrome uses a software rasteriser. Nothing here measures real frame rate, phone performance, feel or fun. Say so when reporting.

## Publishing

The game is a private Claude artifact at `https://claude.ai/artifact/NM8HYatScUazqswpDnonAM`. Republish to that same URL so saves survive: page `index.html`, supporting files every file under `js/` plus `vendor/three.module.min.js` at the same relative paths, root this repository. Commit before publishing. The artifact host has not been checked by a person yet: if module scripts fail to load there, the fallback is bundling `js/` into one classic script.

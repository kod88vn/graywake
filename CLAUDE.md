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
```

## Map

- `js/data/` content tables, pure data, importable in Node. Adding content is usually a row here.
  - `items.js` `objects.js` (everything that stands on a tile: nature, containers, scenery, buildables) `recipes.js` `enemies.js` `world.js` (regions, locations, sites, buildings, loot) `events.js` (text events, weather, tides) `progress.js` (story, contracts, perks, achievements, survivors, trade) `community.js` (the other communities and the numbers for dealing with them).
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

Guides: `docs/ARCHITECTURE.md`, `docs/CONTENT_GUIDE.md`, `docs/BALANCE.md`, `docs/TESTING.md`.

## Rules that are easy to break

- **`js/sim/` and `js/data/` must stay pure.** No `document`, `window`, three.js or `Snd` in them. The sim tells the outside world things only by `emit(...)` onto `G.ev`; `main.js` drains that queue to the renderer, interface and audio. The headless test depends on this.
- **Saves must survive updates.** Any change to the save shape needs a `SAVE_V` bump in `core.js` and a step in `MIGRATE` in `world.js`. New fields with defaults in `blankState()` are filled in automatically on load. Removing an item or object id that saves may reference needs a migration too (unknown ids are dropped on load, not crashed on).
- **Coordinates:** sim `(x, y)` is world `(X, Z)`; tiles are 1 unit; a sim angle `a` is `rotation.y = π/2 − a`. Models stand on `y=0`, face `+Z`, fit a 1×1 tile.
- **The look is realistic. Not blocky, not cartoon, not anime.** The user rejected box-built art ("not roblox style"), tried an anime cel-shaded style for a few versions and rejected that too ("forget anime style, go back to realistic style"), and rejected big heads and stacked-ball bodies as unrealistic. So: no outlines, no banded shading, natural colours. Every lit material comes from `matte()` in `geo.js` (smooth Lambert shading with a surface grain); `post.js` adds ambient occlusion and a filmic grade. Characters in `rigs.js` are about seven heads tall with skinned bodies (`g.loft` through anatomical cross-sections), a real skull shape, small facial features and natural hair; use `g.loft`, `g.sph`, `g.limb`, not `g.box` or stacked spheres, for anything organic. `tools/rigs.html` shows every character (`?low=1&q=player,survivor&surv=5&fov=17` for a close look); look at it after touching `rigs.js`.
- **Movement is layered and damped, never snapped.** `pose()` in `rigs.js` builds every frame from a gait tied to distance covered, an idle layer, stances and actions keyed over their own progress, on a hips → chest skeleton. New actions get keyed curves with anticipation and follow-through; do not write `rotation = target`. `tools/rigs.html?strip=walk|run|sneak|attack|chop|die|husk` shows ten successive moments of a motion: look at it after touching `pose()`.
- **What is worn is what is drawn.** An empty Body, Legs or Feet slot shows skin (the character stands in underwear), and every wearable has a `look` with a style that is drawn in `rigs.js` (`npm run check` rejects unknown styles). A new wearable that looks like a recolour of another is not finished: give it its own silhouette.
- **One object per tile** (`Z.obj[i]`), plus an optional floor (`Z.fl[i]`). After changing a tile call `Z.touch(i)` (path fields and the renderer both listen); for floors `emit('floor', i)`.
- **Bit shifts on `hash()` results use `>>>`**, never `>>`: the hash is unsigned and `>>` turns the top half negative (this once produced `undefined` model ids).
- **Publishing sends every file under `js/`**, including `js/data/community.js` and `js/sim/community.js`: a new module that is left out of the publish breaks the page.
- **Every id is checked.** `npm run check` fails on an unknown item, object, creature, loot family, model, icon glyph or sound, and on any item that cannot be obtained. Run it after touching `js/data/`.
- **Feedback must be visible where the player is looking.** Toasts, the pickup feed and banners sit above sheets (`z-index` in `index.html`); a sheet must fit the screen and scroll inside `#pb`. An action that cannot complete (full pack, missing tool) refuses with a message and takes nothing.
- **The simulation runs in real time at any frame rate** (`main.js` splits slow frames into steps). Never cap `dt` in a way that slows the game down.
- **The game sells nothing:** no purchases, energy, real-time waits or ads. Time only passes while you play or travel.
- **No dependencies and no build step** without discussing it first.

## Verifying a change

1. `npm run check`.
2. Gameplay: `npm run test:sim` (it is seeded by the clock, so run it two or three times). For tide or combat numbers also run the bot in `docs/BALANCE.md`.
3. Art, lighting, interface: `npm run shots` (and `npm run gallery` for models) and read the images. Stills do not show motion: say so.
4. Audio: `node tests/audio.mjs`. Say plainly that it has not been listened to unless a person has.
5. Headless Chrome uses a software rasteriser. Nothing here measures real frame rate, phone performance, feel or fun. Say so when reporting.

## Publishing

The game is a private Claude artifact at `https://claude.ai/artifact/NM8HYatScUazqswpDnonAM`. Republish to that same URL so saves survive: page `index.html`, supporting files every file under `js/` plus `vendor/three.module.min.js` at the same relative paths, root this repository. Commit before publishing. The artifact host has not been checked by a person yet: if module scripts fail to load there, the fallback is bundling `js/` into one classic script.

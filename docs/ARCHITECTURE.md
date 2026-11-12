# Architecture

Three layers, with a one-way flow between them.

```
js/data/   tables          pure data, no imports beyond each other
js/sim/    simulation      pure logic, reads data, owns all state, emits events
js/view/   three.js        reads sim state every frame, reacts to events
js/ui/     DOM             reads sim state, calls sim functions on clicks
js/audio.js, js/input.js, js/main.js
```

`main.js` runs the loop: read input into `G.inp`, `World.tick(dt)`, drain `G.ev` to the view, interface and audio, `View.frame(dt)`, `UI.frame(dt)`.

## The shared context `G` (`js/sim/core.js`)

| Field | Meaning |
|---|---|
| `G.S` | the save state: everything that persists |
| `G.Z` | the current zone, or `null` on the map |
| `G.inp` | the player's intent this frame: `mx my aim attack interact dodge sneak` |
| `G.ev` | outgoing events, drained by `main.js` |
| `G.ds` | derived stats (perks + gear + buffs), recomputed every step |
| `G.mode` | `menu`, `play` or `map` |
| `G.paused`, `G.busy` | a sheet is open; the sim does not tick |
| `G.build` | build-mode state, or `null` |
| `G.pending` | what an event set up: `{dest, fight, trade}` |
| `G.hooks` | callbacks that would otherwise be circular imports: `fx`, `die`, `rescue` |

## Events (`emit(type, ...)`)

| Type | Arguments | Consumer |
|---|---|---|
| `zone` | | view rebuilds the scene, UI rebuilds buttons |
| `obj` | tile index | view re-instances that tile |
| `floor` | tile index | view |
| `zoneDirty` | | view re-syncs every tile |
| `fx` | name, x, y, extra | view particles |
| `shake` | amount | view |
| `eq`, `veh` | | view rebuilds the player rig / parked vehicle |
| `sfx` | name, x, y, opts | audio, with distance and pan from the player |
| `hit` | x, y, damage, crit, onPlayer | UI damage numbers |
| `loot` | item id, count | UI pickup feed |
| `toast` | text, kind | UI |
| `ui` | name, arg | UI opens a sheet, banner or the map |
| `jobDone` | tile index | UI toast |
| `save` | | `main.js` writes the save |

## State

`blankState()` in `core.js` is the full shape of a save. Notable parts:

- `S.t` game minutes since the start. A day is 1440; one real second is 1.5 game minutes (`MIN_PER_SEC`), so a day is 16 real minutes of play.
- `S.p` the player: vitals, level, perks, `inv` (array of `{id, n, d?}` or `null`), `eq` (seven slots), `known` recipes, buffs.
- `S.home` the homestead: `obj` and `fl` are arrays of `HOME_W × HOME_H` tiles (saved sparse), `regrow` timers, `pile` (what survivors brought in), `report` (what a tide did while you were away).
- `S.loc[id]` per location: visits, cooldown, a dropped pack.
- `S.sites` temporary map sites. `S.tide` the next tide. `S.surv` survivors. `S.q` story index and contracts. `S.flags`, `S.stats`, `S.codex`, `S.ach`.

A save made away from home resumes at home: zones other than the homestead are regenerated, never stored.

## Zones (`js/sim/zone.js`)

A zone is `{w, h, g (ground ids), fl (floors), obj (one object per tile), actors, projs, drops, areas, spawns}`. The home zone's `obj` and `fl` are the same arrays as `S.home`. Locations are generated from a seed by one of three layouts:

- `wild`: noise-clumped scatter, optional lake, a few buildings.
- `town`: a road, buildings facing it, cars and street furniture along it.
- `complex`: one large building split into rooms by recursive partition, the boss in the room farthest from the entrance.

Indoor placement goes through `putIn`, which refuses anything that would wall off part of a room. `tests/sim.mjs` checks reachability of every container, node and spawn in every location for three seeds.

Movement is circles against tiles (`collide`). Objects are `solid: 1` (whole tile), `2` (round, radius `r`), or `0`. Doors block enemies only. `low` objects block movement but not shots or sight.

Enemies share one Dijkstra field toward the player (`playerField`), recomputed when the player changes tile or the base changes. Player-built structures are passable at a cost that grows with their health, so a horde prefers gaps and weak walls and chews through when there is no other way. Diagonal steps may pass between two round obstacles but never cut a wall corner.

## Actors (`js/sim/actors.js`)

`step(dt)`: player, creatures, body separation, projectiles, ground effects, turrets, interaction hint. Creature behaviour comes from `def.ai` in `enemies.js` (`melee`, `ranged`, `exploder`, `screamer`, `charger`, `flee`, `boss`, and allies `guard`, `pet`, `follow`). Bosses run a list of abilities with cooldowns (`slam`, `charge`, `pounce`, `summon`, `spray`, `throw`, `shards`, `pulse`, `howl`); every damaging one puts a telegraph on the ground first.

## Rendering (`js/view/render.js`)

- One shared Lambert material with vertex colours; models are baked by `Geo` into flat-shaded geometry.
- Every tile object is an instance in an `InstancedMesh` keyed by model and variant. `syncObj(i)` moves a tile between sets; `flush()` rewrites the dirty ones. Turrets are separate meshes so they can swivel.
- Characters are small jointed rigs (`rigs.js`) with their own material for hit flash and fading; the player's rig is rebuilt from equipment on `eq`.
- Projectiles, drops, health bars, particles and weather are each one instanced mesh.
- Light: a sun with a shadow map that follows the camera, a hemisphere light, a light on the player after dark, and four pooled point lights assigned to the nearest fires and lamps.
- Quality (`low`, `med`, `high`, `auto`) sets pixel ratio and shadow size; `auto` steps down if the frame rate stays under 27 for five seconds.

## Save data

`World.serialize()` writes JSON with the two home arrays made sparse. `World.deserialize()` validates, runs `MIGRATE` steps from the save's version up to `SAVE_V`, fills in any field that `blankState()` has and the save lacks, and drops references to ids that no longer exist. `main.js` keeps it in `localStorage` under `graywake.save.v1` and saves at home every 45 seconds, on every arrival and departure, on sleep, after a tide, and when the tab is hidden.

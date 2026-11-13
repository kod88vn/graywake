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
- `S.home` the homestead: `obj` and `fl` are arrays of `HOME_W × HOME_H` tiles and `ed` an array of twice that many tile edges (all saved sparse), `regrow` timers, `pile` (what survivors brought in), `report` (what a tide did while you were away).
- `S.loc[id]` per location: visits, cooldown, a dropped pack.
- `S.sites` temporary map sites. `S.tide` the next tide. `S.surv` survivors. `S.q` story index and contracts. `S.flags`, `S.stats`, `S.codex`, `S.ach`.

A save made away from home resumes at home: zones other than the homestead are regenerated, never stored.

## Zones (`js/sim/zone.js`)

A zone is `{w, h, g (ground ids), fl (floors), obj (one object per tile), ed (walls on tile edges), actors, projs, drops, areas, spawns}`. The home zone's `obj`, `fl` and `ed` are the same arrays as `S.home`. Locations are generated from a seed by one of three layouts:

- `wild`: noise-clumped scatter, optional lake, a few buildings.
- `town`: a road, buildings facing it, cars and street furniture along it.
- `complex`: one large building split into rooms by recursive partition, the boss in the room farthest from the entrance.

Indoor placement goes through `putIn`, which refuses anything that would wall off part of a room. `tests/sim.mjs` checks reachability of every container, node and spawn in every location for three seeds.

Movement is circles against tiles (`collide`). Objects are `solid: 1` (whole tile), `2` (round, radius `r`), or `0`. Doors block enemies only. `low` objects block movement but not shots or sight.

### Walls on edges

Walls and doors the player builds stand on the edge between two tiles, not in a tile. `Z.ed[tile*2]` is the wall on a tile's north edge and `Z.ed[tile*2+1]` the one on its west edge (a south edge is the north edge of the tile below, an east edge the west edge of the tile to the right); each entry is `{k, hp}`. `edgeIdx(W, x, y, side)` in `core.js` turns a tile and a side (0 north, 1 east, 2 south, 3 west) into an edge index. Where a single number has to name either a tile object or a wall (what an attacker is breaking, what a build tool points at) a wall is `EREF + edge`; `structAt` and `structXY` resolve either. `Z.touchEdge(e)` is the edge's `Z.touch`: it dirties the path fields and emits `edge` for the renderer.

- `collide` treats each wall as a box `2 × WT` thick along its grid line; allies pass doors.
- `edgeCross(Z, x0, y0, x1, y1, ally)` returns the first wall a segment crosses. `los` calls it; projectiles, melee (both sides), interaction reach, auto-gather and blasts (`blastEdges`) call it directly.
- `field` refuses allies a step across a wall that is not a door, charges attackers `3 + hp/25` to cross one, and lets nobody cut a corner a wall ends on; `stepOn(…, ally)` applies the same rule to the step taken.
- Attackers that find a wall on their next step or across their line to the target attack it (`approach`, `stepEnemy`).
- Scenery walls in locations (`w_brick` …) are ordinary `solid: 1` tile objects and are untouched by any of this.

The renderer draws walls as instanced meshes keyed `E:<kind>` at the edge midpoint, turned a quarter turn on west edges. A door's frame is instanced the same way (model part 1) and its leaf (part 2) is a mesh on a hinge that `stepDoors` swings toward open while anyone on the player's side is within a step of it.

Enemies share one Dijkstra field toward the player (`playerField`), recomputed when the player changes tile or the base changes. Player-built structures are passable at a cost that grows with their health, so a horde prefers gaps and weak walls and chews through when there is no other way. Diagonal steps may pass between two round obstacles but never cut a wall corner.

## Actors (`js/sim/actors.js`)

`step(dt)`: player, creatures, body separation, projectiles, ground effects, turrets, interaction hint. Creature behaviour comes from `def.ai` in `enemies.js` (`melee`, `ranged`, `exploder`, `screamer`, `charger`, `flee`, `boss`, and allies `guard`, `pet`, `follow`). Bosses run a list of abilities with cooldowns (`slam`, `charge`, `pounce`, `summon`, `spray`, `throw`, `shards`, `pulse`, `howl`); every damaging one puts a telegraph on the ground first.

## Community (`js/sim/community.js`, data in `js/data/community.js`)

State: `S.wait` (people asking to join: `{id, n, trait, until, how}`), `S.fac[id]` (one record per community heard of: standing `st`, strength `str`, `route {sv, since, n}`, `pact`, `raidAt`, `dead`, cooldowns), `S.clog` (the community log, newest first). Survivors gained `xp` (days worked, gives the level), `hurt` (days left) and `away` (out until dawn).

- `candidate()` puts someone at the fence; the rescue hook and the signal fire call it. `recruit()` hands them to `World.addSurvivor(S, who)`.
- `needs()` is the group's daily meals and drinks against the edible stacks in storage; it mirrors what `feedOne()` in `world.js` will actually take.
- `dawn()` runs from `World.dawn`: waiting people give up, the hurt mend, every trade route rolls for ambush or brings goods to the camp pile, communities at war may put a raid on the road (`raidAt`). `tick()` runs from `World.advance` and lands raids: live at home through `startAmbush`, otherwise against `defenceScore`.
- Standing only changes through `shift()`, which announces crossing into and out of war and ends pacts and routes that standing no longer supports. `reaction()` is how the others take an attack.
- A forward camp is a map site (`war_camp`, `choir_camp`, flagged `manual` so the random site roll skips them) with `fac` set; clearing it calls `campCleared()` from the zone-cleared branch in `World.tick`.
- The Farm tab calls `farm()`, `harvestAll()`, `plantAll()`, `tendAll()`; beds carry `wet` and `fert` until harvested.

## Rendering (`js/view/render.js`)

- Materials: every lit surface is a vertex-colour Lambert material made by `matte()` in `geo.js`, patched with a triplanar grain (fixed to the world for props, to the mesh for characters). Models are baked by `Geo`: round primitives keep smooth normals, boxes keep hard edges, `loft` skins a smooth surface through rings.
- Finishing pass (`post.js`): the scene is drawn into an off-screen target with a depth texture (floating-point colour where the device allows, otherwise 8-bit sRGB; multisampled where the quality level asks for it). A half-resolution pass computes ambient occlusion from depth alone (view position and normal are rebuilt from the depth buffer; twelve taps on a rotated spiral). The final pass blurs the occlusion with a depth-aware 3×3, applies it, and grades with a filmic curve, saturation and a vignette. If a device cannot build the target the pass falls back step by step and finally turns itself off, and the scene is drawn directly. Low quality skips the occlusion.
- Bodies are skinned with `Geo.loft` (smooth surfaces through elliptical rings: torso, pelvis, limbs), in a male or a female build.
- Characters are jointed rigs (`rigs.js`): root → body → hips (pelvis, legs) → chest (ribcage, head, arms), each with its own material for hit flash and fading; the player's rig is rebuilt from equipment on `eq`. `pose()` layers a distance-driven gait, idle motion, stances and keyed actions, and damps layer weights and joint angles.
- Projectiles, drops, health bars, particles and weather are each one instanced mesh.
- Light: a sun with a shadow map that follows the camera, a hemisphere light, a light on the player after dark, and four pooled point lights assigned to the nearest fires and lamps.
- Set dressing lives in `scenery.js`: a grain texture multiplied over the ground's vertex colours, per-biome clutter (instanced, hidden tile by tile as you build over it), and matte materials patched with a vertex-shader sway for trees, bushes and grass. Stains are an instanced ring buffer of flat discs; glows are camera-facing additive quads.
- Quality (`low`, `med`, `high`, `auto`) sets pixel ratio, shadow size, clutter density, the multisampling of the finishing pass's target and whether ambient occlusion runs; `auto` steps down if the frame rate stays under 26 for three seconds.

## Save data

`World.serialize()` writes JSON with the two home arrays made sparse. `World.deserialize()` validates, runs `MIGRATE` steps from the save's version up to `SAVE_V`, fills in any field that `blankState()` has and the save lacks, and drops references to ids that no longer exist. `main.js` keeps it in `localStorage` under `graywake.save.v1` and saves at home every 45 seconds, on every arrival and departure, on sleep, after a tide, and when the tab is hidden.

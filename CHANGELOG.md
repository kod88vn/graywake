# Changelog

## 0.3.0 — 2026-11-12

A second graphics pass, away from the block look.

- **Characters rebuilt.** People, husks and raiders are no longer made of boxes: rounded anatomy with real proportions, two-part arms and legs with elbows and knees, hands, necks, faces, three hair styles, and armour, packs, hoods, helmets and masks shaped to fit. Walk, attack, aim, crouch, crawl and fall all use the new joints. Animals have rounded bodies, necks, snouts and two-part legs.
- **Smooth shading.** Round things (trunks, crowns, rocks, barrels, pipes, limbs) are shaded smooth instead of faceted; boxes keep their edges. Tree crowns and boulders near you use finer geometry than the distant tree line.
- **Surface grain.** Every material carries fine grain and broad mottling, fixed to the world for objects and to the body for characters, so wood, stone, cloth and metal no longer look like flat paint.
- **Contact shadows.** A soft dark blob under every object and creature sits them on the ground.
- **Soft particles.** Smoke, dust, blood, sparks and embers are round soft sprites instead of cubes. Rain is finer and dims with the light.
- The camera sits a little closer.

Still generated entirely in code. This is a stylised look with natural shapes, not photorealism: see "Honest limits" in the README.

## 0.2.0 — 2026-11-12

Fixes from the first play session, and a graphics pass.

**Fixed**
- Crafting looked like it ate your materials. Three causes: messages and the pickup feed were drawn behind open sheets; with a full pack the new item was dropped at your feet; station jobs went to a tray on the station and their timer froze while the sheet was open. Now: messages show above sheets ("Made 1 × Stone Hatchet"), a full pack refuses the craft and keeps your materials, finished station jobs go straight to your pack (the tray is only used when the pack is full or you are away), and the station keeps working with a moving bar while its sheet is open.
- Long lists could not be scrolled: a sheet grew taller than the screen instead of scrolling inside itself. Sheets now stay on screen and scroll with the wheel, touch, Page Up/Down and the arrow keys. The wheel also moves the build bar sideways.
- You can put things back into any container (the starter crate, a locker in the field), not only storage boxes you built.
- Gaining a level while building closed build mode and replaced the level-up banner.
- At low frame rates the whole game ran in slow motion, so key presses seemed to do nothing. The simulation now keeps real time at any frame rate.
- Gathering with a full pack spilled the yield on the ground. It now refuses with a message, and auto-gather skips what you cannot carry.
- A home event could pop up in the minute before a tide.

**Changed**
- Auto-gather shows the right tool in your hand for each job, prefers the job that matches the tool you are holding, and says on start which tools it is using and what it is skipping for lack of one.
- The first weapon or tool you get goes straight into an empty hand.
- Starting pack is 18 slots (was 14). Recipes show how many of the result you already have.
- Tides start smaller and ramp more gently; armour counts for more; melee hits stagger; a tide-strength setting.

**Graphics**
- Textured ground with plank seams, tile grout, road markings and worn patches.
- Grass, ferns, leaf litter, twigs, pebbles, city litter, snow lumps and spore growths scattered per biome; grass and trees sway in the wind, harder in storms.
- Rippling water with highlights; cloud shadows drifting over the ground; filmic tone mapping.
- Glow around fires, lamps, loose loot, muzzle flashes and explosions; smoke and embers from every fire.
- Fireflies at night, falling leaves by day, blowing dust, drifting ash and spores; rain splashes and lightning.
- Blood and scorch marks that stay; bodies lie where they fell for a while.
- Husks vary in build, clothes, hair and wounds; everyone has hands, a neck and a belt; idle breathing; a swing arc on melee attacks; dust under running feet.

**Tooling**
- `npm run test:play`: a play-through driven by real key presses and clicks (gather, loot, craft, build, store, cook, eat, sleep, travel, fight, save, reload).
- `npm run test:monkey`: thousands of random clicks on every button in every sheet, checking for errors and corrupted state.

## 0.1.0 — 2026-11-12

First version.

- Homestead: 86 buildable pieces across shelter, stations, storage, provision, defence, utility and comfort; upgrade, repair and remove tools; structures persist and take damage.
- World: five regions, 33 locations in three layouts (wild, town, complex), ten kinds of temporary site, travel by six vehicles, 48 text events, eight kinds of weather, day and night.
- Survival: health, food, water, toxin, cold; 243 items, 176 recipes, gear with durability, eight armour sets drawn on the character.
- Combat: melee with stagger and knockback, ranged with ammunition and noise, throwables, sneak attacks, dodge; 36 creatures and six bosses with telegraphed abilities.
- Tides: seven kinds, four approach trails, live defence with traps, turrets and guards, or resolution against your defences while away; a tide-strength setting.
- People: survivors with traits and eight jobs, morale, daily upkeep, a dog.
- Progress: 33-step story, radio contracts, 32 perks, 38 achievements, schematics, an endless location and mutation tiers after the ending.
- Presentation: procedural low-poly models (199 world, 33 hand-held), 140 icon glyphs, 56 synthesised sounds, generative music per region with a danger layer, music and effects toggles.
- Tooling: data checker, headless simulation test, browser smoke test, screenshot tour, model gallery, soundboard.

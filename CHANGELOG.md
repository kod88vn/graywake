# Changelog

## 0.7.1 — 2026-11-12

- **Fixed: auto mode switched off when a tide landed.** The character then stood still and was killed. Auto mode now stays on through a tide: it stops gathering, holds the middle of the homestead, goes out to meet whatever comes within reach, and hunts down the stragglers once the last wave is in.
- **Fixed: tides that never ended.** Two causes. An attacker that lost sight of you behind your own walls went idle and never came back, and the tide waited for it; attackers now keep coming. And a herd that a home event had brought in counted as attackers; animals that only run away no longer do.
- New tool: `node tools/playbot.mjs [days] [seed]` plays a fresh character at home with only a player's moves and builds a homestead, writing a save each morning. It found the two tide bugs above.
- **Fixed: auto mode walked past loose loot.** It chose whatever was nearest, so a plant two steps away always beat a dropped bag six steps away, and loot (including what a fight leaves behind) was left lying as it wandered off. Loose loot within a short walk is now collected first.

## 0.7.0 — 2026-11-12

What you wear is what you see.

- **Bare without clothes.** With nothing in the Body, Legs and Feet slots the character has a bare chest, bare legs and bare feet, and stands in underwear. A new survivor starts that way.
- **First clothes.** Rag Shirt, Rag Trousers, Foot Wraps, Bandana and Hand Wraps are made by hand from rags and fibre. The wreck beside your clearing now holds ten rags and some fibre, enough for a shirt and trousers.
- **Every set has its own look.** Each piece is drawn on the body in its own design instead of a recolour:
  - Trapper (hide): hood, laced vest over bare arms with fur shoulders, bound leggings, wrapped feet.
  - Drifter (leather): cap, zipped jacket with a collar and hem, trousers, boots.
  - Junk Knight (scrap): crested helm, riveted chest plate with one big pauldron and rust, bracer, thigh, knee and shin plates, capped boots.
  - Line Holder (riot): visor helmet, padded vest with shoulder and elbow pads and a neck guard, leg guards.
  - Mountaineer (fur): flapped fur hat, long coat with a fur ruff and cuffs, fur-cuffed trousers and boots.
  - Operator (military): helmet with goggles, plate carrier with magazine pouches and a radio, cargo trousers with knee pads.
  - Clean Room (hazard): sealed hood, baggy suit with an air unit and hose, taped wrists, tall rubber boots.
  - Wake Walker (exo): sealed helm with a lit visor, armour over an undersuit with a lit core, pauldrons, spine and limb struts, lit knees and boots.
  - Gas mask: worn over your hair, with twin filters.
- **Two new sets.** Long Rider (Rider's Hat, Long Duster with a bandolier, Riding Chaps, Riding Boots: +10% ranged damage, +5% speed; sewn from leather and cloth around level 22) and Red Reaver (Skull Mask, Spiked Harness, War Kilt, Stomper Boots: +12% melee damage, −5% damage taken; forged from bone, scrap and leather around level 27, and dropped by raider enforcers and Captain Voss).
- **Gloves.** A new Hands slot with seven pairs, from Hand Wraps to Exo Gauntlets. They add armour, warmth or toxin resistance, show on the hands and forearms, and belong to no set.
- **Packs show their size**: the rope sack is a small bag, the hiker's pack carries a bedroll, the assault pack has side pouches, the expedition frame is tall with a pot and a pole.
- **A close look at yourself.** The Pack sheet shows your character in 3D, turning slowly, wearing exactly what is equipped and holding the active weapon.

## 0.6.0 — 2026-11-12

Back to a realistic look. The anime style is gone; the new movement and the community layer stay.

- **No cel shading, no outlines.** Surfaces are lit smoothly again, with a matte finish and a fine grain on wood, stone, cloth and skin.
- **Ambient occlusion.** A new finishing pass darkens creases, the foot of walls, the ground under canopies and the gaps between limbs, the way real outdoor light does. It is what makes objects sit on the ground instead of floating on it.
- **Film grade.** Filmic tone curve, natural saturation, a slight vignette. Natural ground, fog and prop colours are restored; the ground is grain and grass strokes again rather than flat painted patches. Smoke and dust are soft again; the impact stars are removed.
- **Realistic people.** A real skull shape (chin, jaw, cheekbones, brow, crown) with small eyes, a nose, lips and ears; natural hair in six cuts (short, cropped, collar length, ponytail, bob, bun) and natural colours; beards on some men. About seven heads tall. Natural skin and clothing colours. Husks have sunken sockets and pale eyes instead of glowing ones. Helmets, hoods, caps, visors and masks are rebuilt to fit the new head.
- The skinned bodies and the two builds from 0.5.2 stay, with smoother shoulders.
- Kept from the anime versions because they help realism: rounder trunks, logs and barrels, full-detail tree line, round conifers.

Still generated entirely in code: there are no scanned textures or sculpted models, so this is believable rather than photographic. See "Honest limits" in the README.

## 0.5.2 — 2026-11-12

- **Realistic bodies.** People, husks and raiders are no longer assembled from balls and tubes. The torso is one continuous skinned surface through real cross-sections (shoulders, ribcage, waist, hips, a neck that rises out of the shoulders); arms have a shoulder cap, a tapering upper arm, a forearm and a wrist; legs have thighs, calves and ankles; hands have a palm, fingers and a thumb; boots have a shaft, heel and sole. Clothing sits on the body: open collar, belt and buckle, cuffs, jackets with a hem over the hips, vests and plates that follow the chest.
- **Proportions.** A little over six heads tall instead of five and a half; the head is smaller against the body.
- **Two builds.** Male and female builds differ in shoulder, waist and hip width; survivors, raiders and husks are a mix of both.
- New model-builder primitive `Geo.loft` (a smooth skin through elliptical rings), which is what the bodies are made of.

## 0.5.1 — 2026-11-12

- **Fluid movement.** Characters have a real skeleton now (hips, waist, chest, with the head and arms riding on the chest), and the motion is rebuilt on it:
  - Walking and running: the stride follows the distance covered so feet do not slide; knees fold as the leg swings forward; hips and shoulders twist against each other; the body rises and falls with each step; arms swing with the elbows trailing; the head stays level. The body leans into speeding up and banks into turns.
  - Standing: breathing, weight shifting from foot to foot, looking around.
  - Melee: wind back, cut across with a step in, carry through, settle. Chopping and mining: raise, bring down, bounce. Shooting kicks. Being hit makes a figure flinch. Enemies wind up and follow through.
  - Dying: the knees go first, then the body falls and settles. Dodging tucks.
  - Animals trot on diagonal pairs and bound at a run.
  - Poses blend into each other instead of snapping, and the player eases into and out of a run over about a tenth of a second.
- **Build mode: Move and Rotate.**
  - **Move:** tap one of your structures to pick it up, tap a free tile to set it down. It is free and keeps health, contents, crops and running jobs. Esc puts it back.
  - **Rotate:** tap a structure to turn it a quarter turn where it stands. R (or right-click) turns the piece in hand while placing or carrying, and otherwise turns whatever you point at.
  - A white arrow on the placement ghost and "facing north/east/south/west" in the info line show the direction. Before this, turning only affected a piece not yet placed and nothing showed that it had turned, which is why rotate seemed not to work.

## 0.5.0 — 2026-11-12

The homestead becomes a community among other communities. All of them are run by the game: there are no other players.

- **Recruiting.** Someone you free from a cage, or who walks in to a signal fire, no longer moves in by themselves. They wait at your fence for three days and you decide in the Camp ledger (People): recruit them if there is a spare bed, or turn them away. You can also ask a survivor to leave.
- **People get better and get hurt.** A survivor gains a level in the job they do (up to V, +15% output a level). Hurt survivors rest for a few days (a medic halves it); they do not work, run routes or fight.
- **Stores.** The Camp tab shows how many meals and drinks the group takes a day, what the storage boxes hold, and how many days that lasts. You are warned at dawn when either is under two days.
- **Farm tab.** One place for all garden beds: harvest everything ripe, plant every empty bed with a chosen seed, water growing beds (one water each, a quarter off the time left) and compost them (one compost each, half again the harvest). New setting: replant the same seed after a harvest. New building: the Compost Heap.
- **Neighbours.** Six communities, each with a standing toward you and a strength: Millrace, Dustline Co-op, Harrow Wardens, Tarn Hold, The Red Ledger and The Pale Choir. You hear of them as you reach their regions (one region early with a radio). They show on the map as banners.
  - Gifts of scrip or goods raise standing (they prize certain things). Their caravan comes to your gate once a day, cheaper the better they like you.
  - **Trade routes** (standing 25, 40 scrip, one survivor as runner): goods and scrip every dawn, with a daily risk of ambush that rises with every war you are in and falls with guards.
  - **Pacts** (standing 60): two of their fighters join you when a tide lands, and they will send a volunteer for scrip.
  - **War.** At standing −50 or below a community sends raiding parties: fought live if you are home, resolved against your defences if you are not (a radio warns you). You can pay them off, send a war party of your own people (who can be hurt or killed), or find their forward camp on the map and clear it yourself. A community at no strength is broken for good. Hitting a neighbour alarms the others; hitting raiders pleases them.
- The Camp ledger has four tabs (Camp, People, Farm, Neighbours) and a community log.

Not yet measured by play: every number in this layer (see `docs/BALANCE.md`).

## 0.4.1 — 2026-11-12

- **Auto mode defends itself.** Hostiles closing in, or a hit, no longer switch auto mode off. It draws the better of your two weapons (a gun while it has ammunition, otherwise whatever hits hardest; it never throws anything), fights whatever has noticed you, backs away from melee attackers when shooting, bandages itself from the pack under 45% health, and goes back to gathering with your own weapon choice back in hand. After a hit it looks further out, to reach whoever is shooting. It still stops when you move or attack yourself, when the pack is full or when nothing is left to gather. It does not retreat: badly hurt with no medicine it warns you and keeps fighting.
- **Auto-repair tools** (Menu, Play; on by default). A tool or weapon that is nearly worn out is repaired on the spot: at home with a mending bench standing it is mended in full from materials in the pack or storage, anywhere else a repair kit is spent. With neither it tells you once, and the tool wears out as before. Armour is not touched.

## 0.4.0 — 2026-11-12

The look changes from stylised realism to cel-shaded anime in 3D.

- **Cel shading.** Sunlight falls in three flat bands (lit, half-tone, shade) instead of a smooth gradient. Shadows are cool blue-violet instead of grey. Lamps and fires still light smoothly.
- **Ink outlines.** A new pass (`js/view/post.js`) draws dark lines on silhouettes and hard edges: characters and objects are outlined everywhere they meet the ground, foliage only where clumps overlap, grass and floors not at all. Lines fade with the fog.
- **Anime characters.** Slim figures about five and a half heads tall (not chibi), big eyes with coloured irises and highlights, brows, blush, small mouths; six chunky hair styles (spiky, bob, ponytail, twin tails, long, short with a stray lock) in twelve colours; scarves that trail when running; gloves and cuffs. The player has pale spiky hair, a blue jacket and a red scarf. Husks have blank glowing eyes and teeth. Animals have large eyes with highlights.
- **Clean palette.** Ground, fog and prop colours are brighter and more saturated; the ground is painted in flat-toned patches with brush ticks instead of noise; surface grain is reduced to a faint wash. Night is moonlit blue rather than near-black.
- **Rounder props.** Trunks, logs, barrels, posts and conifers near you are drawn with twice the sides, so they read as round instead of as prisms.
- **Effects.** Smoke, dust and sparks are flat cartoon puffs; a white star flashes where a blow lands.
- Colour grading moved into the ink pass (saturation and a soft highlight shoulder) and replaces filmic tone mapping.
- The camera sits a little closer again.

**Fixed**
- Crawlers were drawn under the ground since 0.3.0, so they were invisible in play. They now crawl on it.

Still generated entirely in code and still not hand-drawn: faces are simple, and animation is posed by code.

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

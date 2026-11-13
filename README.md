# Graywake

A top-down 3D survival game for the browser, cel-shaded in an anime style. You wake in a forest clearing beside a dead truck. Fell trees, raise walls, plant a garden, and walk out past the tree line for everything else. Every third night a tide of husks comes for whatever you have built.

Runs on desktop (keyboard and mouse) and on phones (touch). No install, no accounts, no purchases. Everything you see and hear is generated in code.

## Play

```sh
npm start     # then open http://localhost:8090
```

Needs Node 22 or newer. There is nothing to install.

| | Keyboard and mouse | Touch |
|---|---|---|
| Move | WASD | left thumb, anywhere on the left half |
| Attack | left click (aims at the cursor) | big button (aims by itself) |
| Interact | E or right click | Use |
| Auto-gather (fights back if attacked) | F | AUTO |
| Dodge / sneak | Space / Shift | Dodge / Sneak |
| Swap weapon | Q | tap the other weapon slot |
| Pack, craft, build, journal, camp | I, C, B, J, L | buttons, top right |
| In build mode: turn a piece | R or right-click | Turn piece / Rotate |
| Heal, eat, drink, antidote | 1, 2, 3, 4 | tap the bar |

## What is in it

- **A homestead that persists.** 86 buildable pieces: five tiers of walls and doors, floors, 13 kinds of crafting station with upgrades, storage, beds, gardens, rain catchers, wells, coops, hives, traps, five turrets, guard posts, lights, a generator, a radio, a kennel.
- **A map of five regions** and 33 places to scavenge, each generated fresh on every visit: forest, dry plains, a ruined city, snow passes and the toxic Gray. Regions open as you build vehicles, from a hand cart to a sealed truck.
- **Tides.** Assaults on your base that grow every time, in seven flavours, down one of four trails. They are fought live if you are home and resolved against your defences if you are not.
- **243 items and 176 recipes**: tools, 14 melee weapons, 13 ranged, throwables, eight armour sets that show on your character, food, medicine, schematics.
- **36 creatures**, six bosses with telegraphed attacks, raiders who shoot back, animals to hunt.
- **A community.** People you rescue ask to join; you recruit them, house them and keep them fed and watered. Six other communities (run by the game, not by other players) can be gifted, traded with over standing routes, allied with, paid off or fought, and the hostile ones raid you.
- **Survivors** who move in, take jobs (forager, farmer, guard, cook, mechanic, medic, hunter, scavenger) and need feeding.
- **Events.** 48 text events on the road and at home with choices and consequences, ten kinds of temporary site on the map (supply drops, distress calls, raider camps, meteor strikes), weather, caravans, radio contracts.
- **A story** in 33 steps, a perk tree, 38 achievements, and an endless descent with rising mutation tiers after the ending.

## Project

- [`CLAUDE.md`](CLAUDE.md): orientation and rules for working on the code.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): how the pieces fit.
- [`docs/CONTENT_GUIDE.md`](docs/CONTENT_GUIDE.md): how to add items, recipes, buildings, creatures, places, events and quests.
- [`docs/BALANCE.md`](docs/BALANCE.md): the numbers, what has been measured, and what has not.
- [`docs/TESTING.md`](docs/TESTING.md): what each test does and does not show.
- [`CHANGELOG.md`](CHANGELOG.md)

## Honest limits

The art is generated in code: there are no scanned textures, sculpted models or motion-captured animation. The look is cel-shaded anime in 3D: flat bands of light, ink outlines, slim characters with big eyes and chunky hair, a clean saturated palette. It is not hand-drawn: faces are simple shapes and animation is posed by code. Going further (authored character models, hand-painted textures, keyframed animation) would mean bringing in asset files, which is a project decision, not a tweak.

The game has been exercised by automated tests and looked at in screenshots. Nobody has played it for a hundred hours. The length of the progression is designed, not measured; see `docs/BALANCE.md` for the reasoning and the open questions. The audio is level-checked but has not been heard by its author.

three.js (MIT licence) is vendored in `vendor/`.

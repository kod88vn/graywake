# Testing

| Command | Time | What it does |
|---|---|---|
| `npm run check` | 1 s | Static: every id used in one table exists in the table it points at; every item is obtainable; outcome chances sum to 1; every model, icon glyph and sound the game asks for is defined. |
| `npm run test:sim` | 15 s | Plays the logic in Node with no renderer: gathering, crafting, building, combat, every location generated for three seeds and checked for reachability, every location played for 12 s with all enemies awake, every outcome of every text event, two live tides, ten days passing with away tides, sleep, death, save round-trip, contracts, trade. |
| `npm run test:smoke` | 30 s | Boots the real page in headless Chrome, starts a game, opens every sheet, auto-gathers, opens build mode, leaves to the map, arrives at a location, saves and reloads. Fails on any page error. |
| `npm run shots` | 2 min | Twenty-two screenshots into `.out/shots/`: title, first minute, a furnished base by day, dusk and night, sheets, build mode, six locations, the map, an event, and a phone layout. `node tests/shots.mjs 13` shoots only names containing `13`. |
| `npm run gallery` | 1 min | Every model on a tile, lit like the game. `node tests/gallery.mjs props wall` filters. |
| `node tests/audio.mjs` | 40 s | Renders every sound and music scene offline and prints peak and loudness against its group. |
| `node tools/tidebot.mjs` | 1 min | A crude bot against tides 1-12; see `BALANCE.md`. |

`npm test` runs the first three.

## Limits

- The simulation test is seeded by the clock. Run it two or three times after a gameplay change; a failure that appears once in five runs is still a failure.
- Headless Chrome draws with a software rasteriser (about 20-30 frames a second on a laptop). It says nothing about frame rate on real hardware, and nothing at all about phones.
- Screenshots are stills. They do not show animation, camera feel or readability in motion.
- The audio test measures level, clipping and length. It cannot tell whether anything sounds right.
- No test measures whether the game is fun, fair or the right length.

## By hand, before calling a version done

- Start a new game on a desktop browser: gather by hand, craft the two tools, build a fire, boil water, wall in a bed.
- Walk to the edge, travel to Birch Hollow, fight, search a container, come back.
- Open build mode: place, upgrade, repair, remove, rotate.
- Let a tide arrive at home, and let one arrive while away.
- On a phone over the LAN (`npm start` prints the address): joystick, attack, Use, the sheets, the map, nothing under the notch or home bar.
- Toggle music and effects; lock and unlock the phone.
- Close the tab and reopen: the homestead is as you left it.

# Testing

| Command | Time | What it does |
|---|---|---|
| `npm run check` | 1 s | Static: every id used in one table exists in the table it points at; every item is obtainable; outcome chances sum to 1; every model, icon glyph and sound the game asks for is defined. |
| `npm run test:sim` | 15 s | Plays the logic in Node with no renderer: gathering, crafting, building, combat, every location generated for three seeds and checked for reachability, every location played for 12 s with all enemies awake, every outcome of every text event, two live tides, ten days passing with away tides, sleep, death, save round-trip, contracts, trade. |
| `npm run test:smoke` | 30 s | Boots the real page in headless Chrome, starts a game, opens every sheet, auto-gathers, opens build mode, leaves to the map, arrives at a location, saves and reloads. Fails on any page error. |
| `npm run test:play` | 2-3 min | The same page driven only by real key presses and mouse clicks, the way a person plays: gather by hand, search and refill the starter crate, craft, chop, mine, auto-gather, build by clicking and dragging, store and stow, cook at the fire and receive the result, eat, equip, perks, sleep, walk out, pick a place on the map, travel, resolve a road event, fight with the mouse, dodge, come home, save, quit, continue. This is the test that catches "I pressed it and nothing happened". |
| `npm run test:monkey` | 45 s | A furnished mid-game base, then random clicks on every button of every sheet, random hot-keys and build actions. Fails on any page error or broken state (NaN vitals, empty stacks, negative scrip). |
| `npm run shots` | 2 min | Twenty-two screenshots into `.out/shots/`: title, first minute, a furnished base by day, dusk and night, sheets, build mode, six locations, the map, an event, and a phone layout. `node tests/shots.mjs 13` shoots only names containing `13`. |
| `npm run test:bot` | 40 s | The bot harness (`tools/bot`): a session of its own, moves by real input, the picture stream, bug evidence, controls. No model. |
| `npm run bot` | as long as you like | Not a test with a verdict: a Claude model plays and reports. See `AUTOMATION.md`. |
| `npm run gallery` | 1 min | Every model on a tile, lit like the game. `node tests/gallery.mjs props wall` filters. |
| `tools/rigs.html` | by hand | Character sheet through the same materials and finishing pass as the game. Open it from `npm start` at `/tools/rigs.html`; `?pose=walk|idle|attack|dead`, `&q=name,name`, `&surv=5` adds survivors, `&low=1&fov=17` a low close camera for faces, `&strip=walk|run|sneak|attack|chop|die|husk` ten successive moments of one motion. |
| `node tests/audio.mjs` | 40 s | Renders every sound and music scene offline and prints peak and loudness against its group. |
| `node tools/tidebot.mjs` | 1 min | A crude bot against tides 1-12; see `BALANCE.md`. |
| `node tools/leadbot.mjs [save.json] [lead kind] [runs]` | 10 s a lead | Sends a character (from a save, e.g. the one a bot bug report carries) through a radio lead many times in Auto mode and sets the promised skulls beside who lived; see `BALANCE.md`. |
| `node tools/playbot.mjs 13 7` | 5 s | A crude player: thirteen days at home with only a player's moves (auto-gather, craft, build to a fixed plan, eat, sleep, let auto mode fight). Writes `.out/playbot/day-N.json` each morning and a log; load a snapshot in the game with Menu, Export / import. Runs differ: the game's dice are not seeded. |

`npm test` runs the first five.

## Limits

- The simulation test is seeded by the clock. Run it two or three times after a gameplay change; a failure that appears once in five runs is still a failure.
- Calling a game function directly proves the function works, not that a player can reach it. The first version passed every test and still shipped with messages hidden behind sheets and lists that could not scroll. New interface work needs a step in `tests/play.mjs` that clicks it.
- Headless Chrome draws with a software rasteriser (about 4 frames a second with the finishing pass). The simulation keeps real time, so creatures hit the player while a picture is being taken; `tests/shots.mjs` tops the player's health up for that reason. It says nothing about frame rate on real hardware, and nothing at all about phones.
- Screenshots are stills. They do not show animation, camera feel or readability in motion.
- The audio test measures level, clipping and length. It cannot tell whether anything sounds right.
- No test measures whether the game is fun, fair or the right length.

## By hand, before calling a version done

- Start a new game on a desktop browser: gather by hand, craft the two tools, build a fire, boil water, wall in a bed.
- Walk to the edge, travel to Birch Hollow, fight, search a container, come back. In the fight: tap and hold, swing with the cursor off the target, sidestep a husk's blow, fight with a slow weapon and a fast one, then let auto mode fight and watch how it moves.
- Open build mode: place, upgrade, repair, remove, rotate. Run a line of wall along the side of a row of cells by dragging, put a box in the cell behind it, walk through a door and watch it swing.
- Let a tide arrive at home, and let one arrive while away.
- On a phone over the LAN (`npm start` prints the address): joystick, attack, Use, the sheets, the map, nothing under the notch or home bar.
- Toggle music and effects; lock and unlock the phone.
- Close the tab and reopen: the homestead is as you left it.

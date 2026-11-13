# Shared worlds

Several enclaves (people, bots, and settlements the server plays) hold ground in one world, compete for the same radio leads, push the same event track along, and can lose. This is the first stage: **each game still simulates its own copy of the valley**. What is shared lives on a small server: who is in the world and how firmly they hold, the leads, the stage, the news. Enclaves do not see each other move, and cannot trade with or raid each other yet.

## Run it

```sh
npm run world                                   # the world server on http://127.0.0.1:8795 (state in .out/worlds/state.json)
npm start                                       # then play at http://localhost:8090/?world=http://127.0.0.1:8795
npm run bot -- --world http://127.0.0.1:8795 --name "Haiku One"                                  # a bot joins (port 8777, profile haiku)
npm run bot -- --world http://127.0.0.1:8795 --name "Haiku Two" --profile haiku2 --port 8778     # a second bot, its own character
open http://127.0.0.1:8795/watch                # both bots side by side with the standings above (?a=8777&b=8778 are the defaults)
npm run test:world                              # the server by itself, then a real game page against it (40 s, needs Chrome)
```

The address is remembered in the browser; `?world=off` forgets it. `&enclave=Name` names the enclave, `&join=<world id>` or `&join=new` picks the world for a new game (the title screen has a list). The published artifact has no server and plays alone.

## The rules (all in `RULES` at the top of `tools/world/server.mjs`)

| | |
|---|---|
| Hold | 0 to 100, starts at 60. Tide held at the walls +10, strongroom opened +6, tide that went through −25, death −8. |
| Losing | At hold 0 the enclave has fallen. The server moves it to another world with room (or makes one); the game shows "Your enclave has fallen" and `World.exile()` gives the character a new homestead. It keeps what it wears, carries and knows. |
| Worlds | Three server-played settlements and room for four players or bots. A world with no enclave holding is deleted; so is one nobody has played for 36 hours. Anyone can make a new one. |
| Leads | Up to two at a time per world, the first four game hours in. Everyone hears them; each game pitches the place to its own player. The first to open the strongroom takes it. |
| Event track | Six stages. A tide held is worth 2 points to the world, a strongroom 3. Each stage multiplies everyone's tide budget (×1.0, 1.1, 1.2, 1.35, 1.5, 1.7). |
| Score | Tide held 10, strongroom 15, each day 2, each level 3. It ranks the standings; it decides nothing else yet. |
| Settlements | Simulated, not rolled, and no model drives them (`tools/world/settle.mjs`). Each is seeded from its world's seed and starts like a new player: two or three people, a club, no walls. Every game day it works to a plan set by what kind of people they are (wall builders, fighters, scavengers, farmers): raise and upgrade walls, lay traps, make the next weapon and clothes its level allows, take people in. It gains levels at the world's pace. Every third day it meets a tide of the game's own strength (`tideBudget`, `tideLevel`, the world's stage) against a defence counted as the game counts a homestead (wall health, traps, guards). It goes for a radio lead only when the game's own rating (`leadOdds`) for its leader's gear is within what its kind will risk, never on a tide day, at most once in three days, and only after players have had eight hours' start. Hold, score and the world's event track move by the same numbers as for players. Measured over 120 settlements: they fall between about day 30 and day 60 as the stages make tides heavier. |

## How it fits together

- `tools/world/server.mjs`: the server. `GET /api/worlds`, `POST /api/worlds`, `POST /api/join`, `POST /api/sync`, `POST /api/leave`, `GET /api/world/:id`, `GET /watch`. It never trusts a client with more than its own deeds.
- `js/net.js`: the game's side. Every 7 s it sends `S.deeds` (what the enclave has done since last time) and hands the answer to `World.worldNews()`.
- `js/sim/world.js`: `worldNews()` (stage, standings, shared leads on and off the map), `exile()`, and `tideBudget()` reads the stage. `js/sim/` stays pure: it counts deeds into `S.deeds` whether or not anyone is listening, and never touches the network.
- The save carries `S.net` (the pass to the world), `S.world` (the last news) and `S.deeds`. A save with no `S.net` is a game played alone.
- `js/ui/panels.js`: the World sheet (`PANELS.world`, key O) and `PANELS.exile`.

## Not built yet

New settlements arriving when old ones fall (a world can end up with players only). 
Seeing each other in the same place; trade, gifts, raids and pacts between player enclaves (the single-player communities in `js/sim/community.js` are the model for these); a world's end and a winner; accounts (an enclave is whoever holds its token, which lives in the save); running the server anywhere but this machine.

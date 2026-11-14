# Operations: how to pick this project back up

Written 2026-11-14 at the end of a long session, so that the next one can resume without the conversation. It covers the agent setup (the shared-world server, two Haiku bots, the watcher, the release routine), the loop that was run all session, what was learned the hard way, and what is open. Read `CLAUDE.md` first for the rules of the code; this file is about running things and working the loop.

## 1. Resume in ten minutes

```sh
cd /Users/jayquach/dev/game-dev/graywake
git status && git log --oneline -5          # clean tree? last commit is the version in js/sim/core.js (VERSION)
npm run check                                # 1 s: every id in the data tables resolves
lsof -i :8795 -i :8777 -i :8778              # is anything already running? (world server, bot one, bot two)
pgrep -fl '^node tools/'                     # the same, by process
```

Nothing keeps running when the session that started it ends: the world server and the bots are child processes of the coding session. Everything they need to come back is on disk (section 4). To bring the setup back:

```sh
# 1. the world server (background). It loads .out/worlds/state.json by itself.
node tools/world/server.mjs --port 8795

# 2. bot one: its own Chrome, profile "haiku", watch page http://127.0.0.1:8777/
node tools/bot/run.mjs --minutes 120 --no-open --keep --world http://127.0.0.1:8795 --name "Haiku One" --goal "<what to work on: see section 5>"

# 3. bot two: profile "haiku2" on port 8778
node tools/bot/run.mjs --minutes 120 --no-open --keep --profile haiku2 --port 8778 --world http://127.0.0.1:8795 --name "Haiku Two" --goal "<...>"

# 4. both bots side by side, with the standings above:  http://127.0.0.1:8795/watch   (?a=8777&b=8778 are the defaults)

# 5. the event watcher, one line per thing worth knowing (run it under a Monitor, section 6)
python3 -u tools/bot/watch-events.py
```

Each `run.mjs` uses the user's Claude allowance (about $3.5 to $5 an hour at API list prices each, measured). Say so before starting one the user did not ask for. A run ends by itself after `--minutes`; `--keep` leaves its session and watch page up so the user can still look. To end one now: `node tools/bot/ctl.mjs end --port 8777` (it saves its notebook first, up to a minute).

A bot plays a frozen copy of the game taken when its session started (`.out/bot/sessions/<id>/game/`). **A new game version reaches a bot only when its session is restarted.** The status line shows which version and commit it is on: `node tools/bot/ctl.mjs status --port 8777`.

## 2. State at the end of the session (2026-11-14)

| | |
|---|---|
| Game | version **0.10.78**, git `main`, no remote, about 200 commits. Published to the private artifact `https://claude.ai/artifact/NM8HYatScUazqswpDnonAM` as artifact **version 103** (every game version this session was published, in order). |
| Content | 263 items, 195 recipes, 199 objects (89 buildable), 39 creatures, 34 locations, 20 sites, 48 events, 33 quests, 32 perks, 38 achievements (from `npm run check`). |
| World server | `node tools/world/server.mjs --port 8795`; two worlds on file: **Pinewatch** and **Low Water**, both at stage "The Signal" (tides ×1.7). |
| Pinewatch | Haiku One (hold 40: two more lost tides and it falls), Haiku Two (100), settlements The Granary and Brackwater. |
| Low Water | no bots; settlements Saltmarsh Chapel and Hollow Bridge (the server keeps worlds while any enclave holds ground). |
| Bot one | profile `haiku`, port 8777, name "Haiku One". Level ~27, Riot armour. |
| Bot two | profile `haiku2`, port 8778, name "Haiku Two". Level ~29. It has a Vehicle Bay at (29, 19) and is on the Wheels quest. |
| History | Both bots fell and moved at least once. Haiku One started in Low Water, fell in tide 13 and restarted in Pinewatch; Haiku Two started in Pinewatch (Cinder Yard and Tollhouse Six, since fallen), fell, spent time in Low Water, fell again, and is back in Pinewatch. Settlements fall to the late tides and are replaced two world days later. |

Worlds, holds and settlements change by the minute while a server runs; read `curl -s http://127.0.0.1:8795/api/worlds` for the real picture.

## 3. The moving parts

| Piece | Where | What it is |
|---|---|---|
| The game | `index.html`, `js/`, `vendor/` | Plain ES modules; nothing to build. `npm start` serves it on :8090. |
| World server | `tools/world/server.mjs`, `tools/world/settle.mjs`, `tools/world/watch.html` | Enclaves (players, bots, settlements), hold, shared radio leads, event stages; settlements are simulated (no model). `docs/MULTIPLAYER.md`. |
| The game's client for it | `js/net.js` | Reports deeds every 7 s; `World.worldNews()` shows the answer. Enabled with `?world=URL` (bots pass it). |
| Bot harness | `tools/bot/` (`run.mjs`, `session.mjs`, `page.js`, `mcp.mjs`, `ctl.mjs`, `report.mjs`, `watch.html`, `PLAYER.md`) | A Claude model (Haiku) plays through real input in a Chrome of its own; the user watches. `docs/AUTOMATION.md`. |
| The brief the bots play under | `tools/bot/PLAYER.md` | What to look for, how to write notes, the People / World / Stay alive / Dress sections, windows and cures. Update it when a lesson should reach every bot. |
| Event watcher | `tools/bot/watch-events.py` | Prints HOLD / NEW / GONE / BUG / BOT RUN ENDED lines. |
| Measurement scripts | `tools/measure/` | Headless A/B measurements of tides, Auto, survivors, settlements, deaths (section 8). |
| Older instruments | `tools/leadbot.mjs` (a lead against a save, in Auto), `tools/tidebot.mjs`, `tools/playbot.mjs` | `docs/BALANCE.md`, `docs/TESTING.md`. `leadbot.mjs` takes `DETAIL=1` for per-run lines. |

Ports: world server **8795**; bot one **8777**; bot two **8778**; dev server **8090**.

## 4. What is on disk (`.out/` is git-ignored; back it up if it matters)

| Path | What | If lost |
|---|---|---|
| `.out/worlds/state.json` | Every world, enclave, hold, score, settlement state, lead and the world clock. | The worlds are gone; the server makes new ones on the next join. |
| `.out/bot/profiles/haiku/`, `haiku2/` | Each bot's Chrome profile: **its saved game** (browser storage) and `notebook.md` (its only memory between shifts). | The character is gone; the bot starts fresh (`--fresh` does this on purpose). |
| `.out/bot/sessions/<date>-<profile>/` | One session: `report.md`, `bugs.jsonl` and `bugs/NNN/` (shot, save, state, last 40 moves), `ideas.jsonl`, `events.jsonl`, `shift-NNN.jsonl`, `game/` (frozen game). | Only history is lost. |
| `.out/bot/current.json` | Which session is "the one" for `ctl.mjs` without `--port`. If a session crashed and `ctl` insists it exists: delete this file. | |

Editing world state by hand (done several times this session): stop the server (a running server overwrites the file), edit `.out/worlds/state.json` with Python, start it again. Examples that were needed: put a hold back after a bug miscounted it, rename an enclave (`worlds[].enclaves[].name`; the server tracks them by id, so a rename is safe), remove a stray enclave.

The bots' notebooks are worth reading when a bot seems lost: `cat .out/bot/profiles/haiku/notebook.md`.

## 5. The goal text for a bot

`--goal` is the whole steer. A good one says: where the character is and its hold; what just changed in the game that the bot should try; the one or two things it keeps getting wrong; and "report anything broken or unclear". Template:

```
On the title screen tap CONTINUE. You hold <valley> (hold <n>), beside <rivals>. New in this version: <one or two lines>.
<What to do before the next tide>. Report anything broken or unclear, especially how <the new thing> works in a tide.
```

Rules that are not negotiable (they are in `PLAYER.md` too): **the bot taps CONTINUE, never NEW GAME or START OVER** (those wipe the character; the one exception is the "Your enclave has fallen" sheet, which the brief handles). It gets the game's tools and nothing else: no shell, no files, no web. Everything it does goes through real keys and clicks; if it "cannot" do something a player can, extend `tools/bot/`, never add a cheat.

To steer a running bot without restarting it: `node tools/bot/ctl.mjs hint --port 8777 "text"` (it reads that with its next move). Hints were used all session for: how a mechanic works, where a thing is in its save, what a message means. A hint reaches only that run; the lesson that every bot needs goes into `PLAYER.md`.

## 6. The loop that was run all session

1. A Monitor runs `python3 -u tools/bot/watch-events.py` (timeout 1800000 ms, the maximum: **it expires after 30 minutes with a notice and must be re-armed**). Its lines arrive as notifications.
2. **HOLD / NEW / GONE** lines are information: +6 a strongroom reached first, +10 a tide held, −8 a leader's death, −25 a tide lost. Report them in a sentence; act only if something is wrong (a hold that jumped for no reason, a settlement that never arrives).
3. **BUG** lines are leads, not verdicts. For each, read `bugs/NNN/report.md` and `shot.jpg` under the latest session of that profile (`.out/bot/sessions/<newest>-<profile>/bugs/<last>/`), then reproduce with `save.json` (load it in a browser with Menu, Export / import, or through `GW.api.importSave(text)` in a script). Sort it into one of four:
   - **A game bug**: reproduce, fix, add a test that fails before and passes after, bump the version.
   - **A rough edge** (the game is right but silent or misleading): make the game say it. This was the commonest outcome: "Occupied by X at (x, y)", "Missing Nails (made at a Workbench…)", what a job change costs, who left and why.
   - **The bot's tools misreading the game**: fix `tools/bot/` (`PLAYER.md`, `page.js`, `session.mjs`, `mcp.mjs`).
   - **The bot misreading itself**: check the save and the bot's own move log before concluding. Frequent ones: it reads a number from the screen taken a minute earlier; it counts stacks in its pack as stores; it says an item "vanished" that it had spent; a refiled report about something already fixed (its save predates the fix: tell it with a hint so it stops refiling). Say so plainly in the report to the user.
4. Tell the user what you found in plain words: what happened, what you checked, what changed, what tests passed, and what is still open.
5. Restart a bot onto the newest version when its run ends (or sooner if it is about to die to something just fixed): `ctl.mjs end --port N`, wait for the port to free, start it again with a fresh `--goal`.

Things the reports taught, so they need not be learned again:

- **Auto in a tide is the weak point.** It left the yard because (a) its post was wherever the player stood when the pre-tide window opened (fixed 0.10.61: walks home), (b) its "finish the stragglers" rule began when the last attacker had spawned (fixed 0.10.71: only when three or fewer remain, or all remaining are ranged), and (c) falling back when badly hurt after a breach (by design). Holding Auto inside a bare small yard measured worse than letting it fight in the open; survivors at windows and traps are what make the yard worth staying in.
- **The lead rating is honest from full health, with medicine in the pack.** Several reports said "rated fair, far harder". Each time, `tools/leadbot.mjs` on the reporting save showed the rating held when the character started whole; the differences were health, medicine moved into storage (it does not count), or toxin (the Pharmacy peaks at 100 toxin every run).
- **Toxin** was the most-reported thing. Without a mask a toxic lead pushes it to 100; it used to take 28 game hours to fall under 50 (0.10.76: ~2 real minutes at home). The cures: Herbal Tea (campfire), Charcoal Tablets and Antitoxin (Herbalist Table). The antidote key only takes a real cure.
- **Stores are the boxes.** Survivors eat from storage boxes, never the pack. The ledger now says so, names what it does not count, and the "No room" messages say what to build.
- **Plank breaks in late tides** (240 to 320 health). Stone is 650 to 850. The bots are told to upgrade.

## 7. Releasing a version (the order matters)

1. Edit. `npm run check` after any data edit.
2. Bump three things: `VERSION` in `js/sim/core.js`, `"version"` in `package.json`, and a new entry at the top of `CHANGELOG.md` (what changed in the player's terms, and what was measured). Write it so the user can read why.
3. Run the tests **and stop on the first failure**: `node tests/sim.mjs && node tests/smoke.mjs && node tests/bot.mjs && node tests/world.mjs` (add `node tests/play.mjs` after any interface or input change, `node tests/net.mjs` after anything in `js/net.js` or the server). Never run two browser tests at once: they collide and hang.
4. `git add -A && git commit` with a one-line cause and effect and the trailer the session was given (`Co-Authored-By: Claude <model> <noreply@anthropic.com>`, whatever the current reminder says).
5. **Only then publish, as a separate step.** An earlier release (0.10.74) was published in the same step as a failing test run, because the publish was chained after the tests instead of waiting for them. The Artifact call:
   - `url`: `https://claude.ai/artifact/NM8HYatScUazqswpDnonAM`
   - `file_path`: `index.html`, `root`: this repository
   - `files`: every file that changed under `js/` (the call keeps the rest from the last publish; if unsure send every file under `js/` plus `vendor/three.module.min.js`: `find js -type f | sort`)
   - `label`: the version
6. Say in the message: the version, what it fixes, how it was checked, and what was *not* checked.

Test reality (also in `docs/TESTING.md`): `tests/sim.mjs` is seeded by the clock, so run it two or three times after a gameplay change; a failure that appears once in six runs is a real failure (the "tide 15 resolves" test caught a stalled-tide fault this way, 0.10.75). `tests/play.mjs` has a known intermittent miss on the first gather or crate step: rerun it alone before calling it broken.

## 8. Measuring a change

Do not judge a gameplay change by reading it. The scripts in `tools/measure/` each take a repo root, so the same measurement runs on the working tree and on a copy of the last commit:

```sh
O=/tmp/old; rm -rf $O; mkdir -p $O; git stash -q; git archive HEAD | tar -x -C $O; git stash pop -q
(node tools/measure/yard.mjs $O 16 0 20 2 | sed 's/^/OLD /') & (node tools/measure/yard.mjs $PWD 16 0 20 2 | sed 's/^/NEW /') & wait
```

| Script | Question it answers |
|---|---|
| `yard.mjs` | Survival and time outside the walls for Auto in a tide, in a walled yard with traps and survivors. Tide 5: 12 of 16 lived with 20 traps, two survivors, windows not counted. |
| `exits.mjs` | Why Auto left the yard: logs each exit with the nearest attackers. |
| `pretide.mjs`, `leash.mjs` | Where Auto stands when a tide begins; how far it wanders in the two hours before. |
| `guardsyard.mjs` | What survivors alone do in a tide (player passive): kills and wall pieces lost, with and without windows. |
| `settlements.mjs`, `settlement-trace.mjs` | 160 settlements over 60 days against the real tide formulas; or one, day by day. |
| `bagtest.mjs`, `craftfull.mjs` | Regression checks for the lost pack on death and crafting with a full pack. |
| `tools/leadbot.mjs` | A radio lead against a save in Auto: promised skulls beside who lived. |

Noise is large: tide-5 survival swings ±3 of 16 between identical runs; use 32 runs before believing a difference smaller than that, and a bare 5×4 stone yard measured at 0 to 4 of 16 without traps. `docs/BALANCE.md` has the older numbers.

## 9. Traps in the environment (each cost time once)

- **zsh**: `echo =====` fails ("= not found"): write `echo '---'`. A failing `echo` in a chain ends the chain.
- **`pgrep -f 'tests/play.mjs'` inside an `until` loop matches the loop's own command line** and never ends. Anchor it (`'^node tests/play.mjs'`). The same anchor is in `watch-events.py`.
- A foreground command stops at 10 minutes (the play test or twelve sim runs together can pass that): run long ones in the background with output redirected to a log file, then poll the log.
- Foreground `sleep N && …` is blocked: use an `until <check>; do sleep 2; done` loop.
- Two browser tests at once collide on the browser port and hang for ever. One at a time.
- The working directory resets between commands; use absolute paths in scripts.
- A script that says "lived 0/32" at tide 5 in a bare yard is correct, not broken: the yard without traps loses.
- Comments written as `// …` at the end of a line inside a one-line function in `js/ui/panels.js` swallow the rest of the line. `npm run check` now parses every script and catches it; prefer `/* … */` there.
- Hidden test servers: `tests/*.mjs` start their own server on a free port. Do not leave a stray `node tools/serve.mjs` running on 8090 for the user.
- Respect `CLAUDE.md`'s rule on bots: the bot's browser is separate from the user's, watch-only, never the Claude-in-Chrome extension.

## 10. Open items and decisions waiting on the user

**Decision, asked repeatedly, never answered: ease the late-stage tide?** The world stage "The Signal" multiplies every tide by 1.7 (`RULES.stages` in `tools/world/server.mjs`; the tide budget is read from the world stage in `World.tideBudget`). In practice every tide at that stage costs the valley a settlement or hurts several; replacements arrive two world days after a fall, and only a bot with stone walls, windows, traps and three fit survivors is holding. Options: cap the multiplier at ×1.5, or leave it as the pressure that ends a world. The measured case for easing: a 5×4 stone yard with 20 traps and two survivors lived 12 of 16 at tide 5 (the multiplier is ×1.2 at stage 2), so at ×1.7 it is much worse. Nothing was changed without the user's say.

**Open, game:**
- Show each place's travel time on the map without selecting it (Flint Ridge looks as close as Birch Hollow and is 3 h 23 m).
- Show a lead's status to the player: open, taken by X, still yours (0.10.72 says so when a rival takes it while you are inside).
- Auto still spends 35 to 45% of a tide outside the walls, mostly after a breach with low health (it falls back by design). If wanted, a rule that keeps it inside while the door holds.
- Windows: in tide 10 a stone yard with three survivors killed 6 to 26 attackers with a window per side against 9 to 14 without; shooting over walls was stronger (16 to 36) but the user asked for windows. More windows per side, and an in-game hint to put them where tides come from, would help.
- A hurt character starting a lead (136 of 220 health) in `leadbot.mjs` stalls with enemies left standing (cleared 1 of 8, against 6 of 6 from full health). Cause not found; may be a quirk of the simulation driver (the driver turns Auto off when no enemy is close). Worth a real trace before trusting hurt-start numbers.
- From the multiplayer doc: enclaves seeing, trading with or raiding each other; the server on another machine; accounts.
- Offered to the user and unanswered: whether trade-route runners and war parties (survivors leaving the base) should exist at all given "the player must still travel alone"; whether to compensate a player who loses a lead race; mechanics rebuilding destroyed pieces.
- Body weak spots: mitten hands, a shoulder seam, shell hair, a fixed expression; motion not watched.

**Open, bot tools:** the bots' "Around you" list reaches only a few tiles, so reports like "no vehicle bay in the yard" are usually the tool; a list of every structure by name and tile would help. The bots re-report an already-fixed fault until restarted.

## 11. The user's standing wishes (so they need not be asked again)

- Full-featured games: maps, RPG systems, realistic lit art and anatomy, fluid motion, showy effects. Anime and cartoon styles were tried and rejected.
- Test through real input (a real click or key press), time the real render loop, trace feel against the last commit after movement, AI or combat changes, leave anything they will watch running and visible, and when an overhaul leaves part of a system out, say which part in the delivery message. (These are saved as separate notes in the assistant's memory.)
- The shared-world design came from the user's own words: worlds hold NPC/human/bot enclaves; an enclave that loses moves to a new world; each world has event progress; a world with no enclave is deleted; anyone can make a new one; settlements are seeded and levelled with the world by built-in rules, no model driving them; at most three people per base; survivors work, sleep at night and defend; the player travels alone.
- Windows (0.10.57): "walls with windows so shoot through feel more realistic. Bots need to be near a window to shoot outside. Line of sight rules still apply, window allows line of sight but block pathway."
- Real tools in survivors' hands (0.10.57): hoe, rake, hammer, ladle, bandages.
- Both bots side by side on one shared world, with the user watching both pages live.

## 12. What this session changed, by theme (full list in `CHANGELOG.md`, 0.9.7 to 0.10.78)

| Theme | Versions | What |
|---|---|---|
| Shared worlds | 0.10.0 on, 0.10.57, 0.10.75 | Worlds of enclaves, the world server and its watch page, exile and a new homestead, settlements that live by built-in rules, settlements that fight from windows, newcomers replacing fallen ones, stalled tides ending. |
| People | 0.10.3 to 0.10.17, 0.10.50, 0.10.77 | Cages and rescue, three people per base, work done in the base, visible work with real tools, sleep at night, everyone fit defends, jobs and trade routes made honest, departures logged. |
| Bots | all along | A second bot, `flee`, `auto`, `leave`, hints, the yard and buildings in its view, a tide-aware `wait`, a leash on `attack`, one-line fixes to its clicks and key handling, `PLAYER.md` sections. |
| Walls and the yard | 0.10.18, 0.10.35, 0.10.37, 0.10.59, 0.10.64, 0.10.65, 0.10.73 | Furniture cannot box things in or cut them off, upgrade drags keep to what they started on, the ledger says whether the yard is closed or which furniture is unreachable, windows, swaps. |
| Auto and tides | 0.10.2 to 0.10.17, 0.10.51, 0.10.58, 0.10.61, 0.10.68, 0.10.71, 0.10.75 | Posts, retreat inside walls, an empty gun is dropped, every attacker beats on a wall, Auto walks home before a tide and gathers near it, stragglers hunted only when few remain, stalled tides end. |
| Honest messages | most versions | Where a missing thing comes from, what a job change costs, who is taking up room, what broke, what is occupied and where, what a rival did, what clears toxin, how long a trip takes against a lead's time, the tide clock (one element, not two). |
| Real losses fixed | 0.10.61, 0.10.62, 0.10.33, 0.10.34 | A death at home lost the whole pack when the nearest tile was taken; a full pack blocked crafting; overflow now goes into storage and says so. |

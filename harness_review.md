# Harness review: Haiku bots and the shared-world server

Written 2026-11-14, after two days (2026-11-13 and 11-14) of running Claude Haiku as a playtester against Graywake, alone and then as two bots in shared worlds, with me (the coding agent) triaging what they reported. It records what the setup is, what was good and bad about it, what I would tell the next session, and a log of the bugs it found and how each was fixed. Numbers come from `tools/bot/stats.py` and from the session files under `.out/bot/sessions/`; the harness is described in `docs/AUTOMATION.md` and the running procedure in `docs/OPERATIONS.md`.

**What this evidence is and is not.** It is 69 sessions of one model (Haiku) on one game, judged by me. The bug log is my triage verdict, not an independent audit. Costs are the harness's own estimate at API list prices, not a bill. The theme counts are keyword matches and overlap. Nobody played the game by hand alongside the bots to check what they missed, so what the bots did *not* report is unmeasured.

## 1. Verdict

The harness is worth keeping and was cheap: about two dollars an hour of Haiku play produced a stream of faults that the test suite had not found, including losses of data (a whole pack lost on death, a death sentence by silence) and a page crash. Its weakness is not the finding but the sorting: four reports in five were minor, many of the rest were the bot misreading the game or its own tools, and the same complaint arrived many times until the bot was restarted. The most valuable habits were reproducing every report from its own saved game, measuring a fix against the committed version, and instrumenting a complaint that kept coming back. The costliest mistakes were mine and were about process, not about the game: publishing past a failing test, running two browsers at once, and drawing a conclusion from a measurement that was not representative.

Of the entries in the bug log in section 7: 43 game faults, 14 rough edges, 10 harness or bot-tool faults, 7 reports that needed no change, 5 my own process mistakes (of 79 entries).

## 2. What was set up

- **The game under test** plays in a Chrome of its own, driven over the DevTools protocol by real key presses and mouse events; the bot gets game tools and nothing else (no shell, no files, no web). Each session plays a **frozen copy** of the game taken when it started.
- **The bot** is Claude Haiku through the user's own `claude` login, playing in shifts of 50 moves with a notebook as its only memory, under the brief in `tools/bot/PLAYER.md`.
- **Two bots at once** (profiles `haiku` and `haiku2`, ports 8777 and 8778) in a **shared-world server** (port 8795), alongside settlements the server plays itself, with a side-by-side watch page.
- **Evidence per report**: a picture, the saved game (`save.json`), what the bot could see (`state.json`) and its last 40 moves.
- **Me**: a live monitor (`tools/bot/watch-events.py`) turned holds, falls, newcomers and major reports into notifications; hints (`ctl.mjs hint`) to correct a running bot; measurement scripts (`tools/measure/`); a release routine of check, tests, commit, publish.

## 3. By the numbers (`python3 tools/bot/stats.py`)

| | |
|---|---|
| Sessions | 69 (29 on 2026-11-13, 40 on 11-14); from 11-13 21:10 two bots at a time |
| Play | 2,986 minutes (49.8 hours), 73,455 moves |
| Cost | $100.87 at list prices: $2.03 an hour, $1.37 per thousand moves; a 120-minute run costs $3.6 to $5.3 |
| Reports | 1,345: 1,060 minor, 278 major, 7 blocker. 1,342 filed by a bot, 1 by the user from the watch page, 2 by the session's own checks |
| Ideas | 1,037 (almost none read one by one; a handful acted on) |
| Deaths recorded | 13 in report headers (at least) |
| Cost per major-or-blocker report | $0.35 |

Recurring complaints (title keyword matches, overlapping): pack full / no room 129; camp ledger / stores 59; Occupied / build refusal 56; esc / close sheet 39; trade route / caravan 37; toxin / cure 33; Juno / vanished survivor 33; Auto leaves the yard 30; lead rating differs from the fight 29; plural typos 18; page error 4.

## 4. What was good (with evidence)

1. **Isolation held.** Two bots played about fifty hours while I edited code, ran the sim, smoke and play tests, started dev servers, and republished the game up to artifact version 103, and I saw no run disturbed by it. Evidence: runs completed their 120 minutes (2.5k to 3.2k moves each), and the version a bot was playing stayed fixed at its start commit while the tree moved (bots ran 0.10.57, 0.10.62, 0.10.70 and 0.10.77 while later versions were published). The user said at the start that they must be able to work and watch without controlling; the setup did not need their browser, focus or save.
2. **Cheap volume.** $0.35 per major report; one two-hour run per bot produced 40 to 60 reports. A person would not click through 3,000 moves of build menus and sheets for that.
3. **A report you can reproduce in a minute.** Because each report carries its own `save.json`, nearly every fault was reproduced by loading it headless: the death bag (a save with trees around the death spot), the walled-off workbench (the ledger's "unreachable" list printed the three pieces from the bot's own yard), the null-dispose crash (reproduced by adding a wall of a never-drawn kind and clearing the zone), "the Fire Station is rated fair but harder" (`leadbot.mjs` on the save showed the stall depended on starting health).
4. **It found what the tests could not.** Faults that sat in a green suite:
   - a death among trees lost the whole pack (the sim's death test used open ground);
   - `null.dispose()` when leaving a homestead (the smoke test never cleared a zone with a fresh wall kind);
   - two elements with the id `tide` after the map was opened (no test opened the map and read the HUD again);
   - a tide that never ended because spitters stood off (the tide-15 test failed one run in four and I first called it flaky; it was real, 0.10.75);
   - a fallen enclave charged a lost tide in its new world (needed a second bot to move into a world: 0.10.21).
5. **Live pace exposes Auto.** The world does not wait for the model, so Auto's behaviour in a tide was exercised at real speed: it left the yard five different ways (a post at the map's middle, gathering into the tide, charging out when the last wave spawned, chasing beyond a wall, falling back after a breach). Turn-based tests did not reach any of these.
6. **Real input finds interface faults.** Because the bot clicks like a player: the bed taking the E key from a box beside it, the build toolbar covering the ground you build on, an upgrade drag that crossed a chest, a map place hidden under another.
7. **Two bots in one world find system faults.** The exile double charge (0.10.21), the dropped pack not carried over (0.10.22), a name collision on arrival ("Haiku One 6") and the replacement-settlement rule all came from watching the two enclaves interact.
8. **Hints are a cheap steering wheel.** A line sent to a running bot corrected a misreading without restarting it (dozens used: where its Vehicle Bay stood, what a message meant, which cure to brew).
9. **Messages the bots read are messages players read.** Most of the rough-edge fixes (a refusal that names the tile, a mending list that names where an ingredient comes from, the ledger naming what it does not count) made the game clearer for a person too, which was the point.

## 5. What was bad (with evidence)

1. **Signal to noise is low.** 79% of reports are minor (1,060 of 1,345). The same fault came back again and again: the camp-log mismatch five times, Juno's disappearance four times, toxin six or more, "Auto walks out" thirty reports across two days. Each needed reading and a verdict, though I kept a short answer for the repeats.
2. **The bot often misreads.** In the log in section 7, 7 of the entries needed no change at all, and 10 more were the tool or its reach: a vehicle bay at (29, 19) that the "Around you" list (a few steps) did not show; a character "drifting" because a key-up was lost; "boxed logs ignored" when its own log said it had spent them; "Esc does not close the sheet" when the real Esc closes all three. A report is a lead, not a verdict.
3. **The frozen copy cuts both ways.** It is what keeps the user's work and the bot apart, and it means a bot keeps filing a fault until restarted. Evidence: Juno's disappearance filed four times after the fix (the save still had the old log), the camp log five times. Restarts cost a session's momentum (a run's notebook survives, its in-progress plans mostly do not).
4. **Tool gaps look like game bugs.** `goto` refused tiles past the edge so a bot could not leave the Police Station; `tile` clicks 0.08 of a tile from a boundary landed in the next cell and put a wall outside the yard; `attack` in build mode placed traps; no list of buildings meant "the Ranger Station has no buildings". Each cost a triage round before the tool, not the game, was fixed.
5. **Haiku fights badly under pressure and does not learn within a run.** Thirteen deaths recorded; both bots died repeatedly to the same causes (toxin at 100 with no cure, leaving the yard in a tide, fleeing across the map). Hints about cures had to be repeated; a bot would arrive at a toxic lead with no cure after being told twice.
6. **Cost is real and sits on the user's allowance.** $100.87 at list prices over two days. Each 120-minute run was $3.6 to $5.3. I started runs the user had not asked for each time, but always said so.
7. **Measurement is noisy and easy to get wrong.** Tide-5 survival swings ±3 of 16 between identical runs. My first conclusion (holding Auto inside a yard is worse) came from a bare 5×4 yard with no traps or survivors and was later reversed once defences were in. `leadbot.mjs` showed a stall for a hurt starting character (1 of 8 cleared, against 6 of 6 from full health) that I could not explain and that may be an artefact of its driver.
8. **Visual faults, audio, feel and fun are unmeasured.** The bot reads text, looks at a picture every few moves, and reacts in seconds. Nothing here shows frame rate on a phone, whether a fight feels right, or whether the game is the right length. The reports do not mention art at all.
9. **Watching has overhead.** The monitor expires every 30 minutes and had to be re-armed over twenty times; each notification interrupts. A wrapper that does not expire, or a digest, would save attention.
10. **My own mistakes, which the harness made easy to make** (table X in the log): publishing in the same step as a failing test run (0.10.74); three one-line functions broken by a trailing `//` comment; a play test hung 21 minutes because two browser tests ran at once and a `pgrep -f` loop matched itself; calling toxin "slow" from a formula before measuring it.

## 6. Lessons learnt

1. **Reproduce from the report's own save before touching the game.** The Tool Chest "duplication" was Auto taking back what the bot had stored (found by loading its save, the same box, then turning Auto on, and seeing the hides return). Without the save I would have hunted a duplication bug that did not exist.
2. **When a complaint comes back, instrument it instead of guessing.** "Auto leaves the yard" had been "fixed" at 0.10.2, 0.10.9, 0.10.11, 0.10.17 and 0.10.61, and still arrived. One script that logged the circumstances of each exit (`tools/measure/exits.mjs`) showed the player stepping out at the instant the queue ran empty with twenty attackers alive, and that was the actual cause (0.10.71).
3. **Measure a fix against the committed copy, side by side, with enough runs.** `git archive HEAD` into a folder, run the same script on both. Straggler rule: 9 of 16 lived against 12; leash: 23 to 27 tiles out against 13 to 15; pre-tide post: 14.4 to 15.0 against 1.4. Use 16 to 32 runs; a difference under ±3 of 16 is noise.
4. **Most "bugs" are the game being silent.** The rough-edge fixes (14 rows in the log, together about thirty of the versions) were nearly all one sentence the game did not say: where a thing comes from, what a button will cost, who left and why, what a tide broke. Put the sentence where the player looks: the first fix (0.10.19) put a source in a message, not a tooltip, because a touch screen and a bot never see tooltips.
5. **Ask "could a person do this with these tools?" before editing the game.** Several game-looking faults were the tool (unreachable edge, a key left down, a click too close to a boundary). Fix the tool when the answer is no.
6. **Tell the bot what is resolved.** A refiled report costs a round of triage. A hint ("Juno is explained and fixed") stops it; a standing "resolved" list in `PLAYER.md` would stop it for every bot.
7. **Gate the release on the tests, and run one browser test at a time.** Publish as its own step after the commit; never chain it after a test run. Run long tests in the background with the output in a file.
8. **Check what a change does to the thing you did not touch.** Counting current health in the lead rating would have marked every settlement leader as hurt (their stand-in had the default 100 health); I ran the settlement simulation before and after to confirm it did not move.
9. **Trust a measurement over a reading.** I called toxin slow from the formula; running it showed it cancels regeneration, and what hurt was that it took 28 game hours to clear. The fix (0.10.76) came from the run.
10. **Two bots in one world find faults that one bot cannot**, because the faults sit between enclaves (a fall, a move, a name, a replacement).
11. **Say what a bot cannot see.** The reports say nothing about art, sound, feel or length. Do not read an empty list as a clean bill.


## 7. Bug log

Each row is one fault or non-fault the harness surfaced, sorted by kind. "Checked" says how the fix was confirmed. The version is the game version that carries the fix (`CHANGELOG.md` has the full text); `bot` means a change to `tools/bot/`. This is my triage verdict, not an independent audit, and it lists the faults worth recording, not all 1345 reports (most of those were duplicates, repeats of a fixed fault, or minor).


### G: Game faults (behaviour wrong, or something lost), 43

| Version | What was seen | Cause | Fix | Checked |
|---|---|---|---|---|
| 0.9.7 | Pharmacy far deadlier than its 2-skull rating | a Bloater's burst was as loud as a grenade and woke the whole building | burst noise `r*(soft?2:5)`; toxic air shown before you go | `leadbot.mjs` before and after |
| 0.9.10 | road fights (wolves, raiders) killed the bot's character | event fights were not pitched to the player the way leads are | `ambushPlan`: the fight is scaled to the player; the choice says what fight it leads to | `leadbot.mjs --ambush`, every fight an event can start |
| 0.10.1 | "Smoke on the Ridge" sent six raiders with guns at a level 13 homestead; dead in 6 s | a fight at home used the homestead's level, not the player's | home fights pitched like road fights | `leadbot.mjs --ambush` |
| 0.10.1 | Pharmacy rated 3 skulls was survived 5 times in 16 | toxic air was missing from the lead rating | toxin counted in `leadOdds` | `leadbot.mjs` 12 runs |
| 0.10.2 | Auto walked out of the yard in a tide | its post was "the middle of the map", not the player's yard | `p.post`: the spot where the player stood | `tools/tidebot.mjs` |
| 0.10.2 | loading an older save in a shared world charged the same hours twice | the world counted replayed hours again | `e.maxT`: hours already seen are not counted twice | `tests/world.mjs` |
| 0.10.5 | game froze on a black screen when a lead vanished on the road | arriving at a place that no longer existed | `arrive` handles a vanished place | `tests/sim.mjs` |
| 0.10.7 | a fallen enclave kept its old homestead | the move arrived under a death sheet and was never applied | fall saved in `S.net.exile`, shown when nothing else is on screen | `tests/net.mjs` (moved to a new world, keeps level) |
| 0.10.8 | Radio Mast quest could not be finished | it needs a battery that only dropped in a far place | batteries in cars | bot reached it on the next run |
| 0.10.8 | Wear best swapped worn clothes for weaker fresh ones | armour was marked down by wear, but clothes give full armour until they break | `gearScore` keeps clothes at full value | `node` check of scores |
| 0.10.9 | Auto wandered out to chop a tree minutes before a tide | it kept gathering until the tide began | Auto holds its post in the last 45 minutes | bot run, tide held |
| 0.10.11 | Auto walked out through the yard door to meet raiders in the trap field (died twice) | it chased what was beyond a wall | foes beyond walls and doors are left to the wall | bot run |
| 0.10.14 | collecting from a rain catcher/snare with a full pack duplicated the catch | it fell on the ground and stayed in the catcher | what does not fit stays put; says so | sim test |
| 0.10.16 | a full pack switched Auto off | Auto gave up when it could not pick up | Auto stays on guard with a full pack | bot run |
| 0.10.17 | Q-swapped weapon undone by Auto; near-broken guns still chosen | Auto swapped straight back; broken guns scored full | swap respected 2 game hours; guns under 15% count ×0.2 | sim test |
| 0.10.18 | "items moved into a Tool Chest reappear in the pack" (reported as duplication) | not duplication: Auto looted the chest the player had just stocked | a container you put something in is skipped by Auto | browser: stored hides stayed with the fix, came back without it |
| 0.10.21 | a fallen enclave lost 25 hold the moment it arrived in a new world | a tide finished while the move waited and was reported to the new world | nothing done before the move is sent to the new world | `tests/net.mjs` new step: fails before (hold 35), passes after (60) |
| 0.10.22 | the pack dropped by the death that ended an enclave was left behind | the move did not carry the bag | bag carried over the pass | `tests/net.mjs` |
| 0.10.28 | Auto re-picked the junk the bot had just dropped to make room | Auto picks up every loose pile; walking over a pile does too | piles you drop are marked and left alone | browser: bones dropped, 40 s of Auto, still on the ground |
| 0.10.35 | upgrading a line of stick walls also upgraded a chest, and plank went to stone | the drag upgraded everything it crossed and lost its side | a drag keeps to the kind and side it began on | real mouse drag: before plank, stone, chest; after plank ×4, box untouched |
| 0.10.36 | "Wear best" offered a fire axe at 0% | a broken weapon still scored | 0% scores 0 | node score check |
| 0.10.29 | caravan took scrip and left the item on the ground (pack full) | `give()` dropped the overflow | the sale is refused with no room | browser: scrip kept (500) |
| 0.10.41 | the trapper took the hides and left the jerky | the trade took first and gave second | a sure trade waits for room in the pack | node: blocked with a full pack, allowed with room |
| 0.10.46 | a box beside a bedroll could not be opened | standing on a bed always took E | a bed gives E to anything else in reach | browser: "Open · Small Box" / "Sleep · Bedroll" |
| 0.10.47 | "Wear best" put a 3% machete in hand over a 14% bat | the under-15% markdown was flat | the markdown shrinks with condition left | score table (2.2 against 6.7) |
| 0.10.51 | Auto clicked an empty revolver all fight | a hand-chosen weapon stayed chosen when it had nothing left | an empty gun or broken blade hands the choice back | sim test |
| 0.10.52 | survivors stood idle in tides; "stalled tide" test failed one run in four | arrows and sight stop at walls; spitters stood off and kept the tide alive | (later) windows 0.10.57; a stalled tide ends | 12 sim runs in a row pass; tide 8 cleared in 103 s from 153-229 s |
| 0.10.58 | crawlers and stalkers stood at the wall facing the player through it | only smashers hit walls | every attacker beats on a wall in its way | tide 5: 14 of 16 lived against 10 |
| 0.10.58 | a survivor "laid up for three days" was cooking at the fire | laid-up people kept their job and counted at it | laid up = in bed, not counted | node |
| 0.10.59 | the workbench inside a closed yard could not be reached | a bed, fire and boxes split the yard in two | placement is refused if it cuts furniture off | node: third box refused ("would cut the Workbench off") |
| 0.10.61 | a death among trees and traps lost the whole pack | the bag was only placed if the nearest tile was empty | nearest empty tile; loose drop as a last resort | `tools/measure/bagtest.mjs`: old none, new bandage×5, poultice×2 |
| 0.10.61 | Auto was 14-15 tiles outside when the tide began | the post was wherever the player stood 45 min before | if far from home the post is inside the yard | `pretide.mjs`: 14.4-15.0 before, 1.4 after (8 runs each) |
| 0.10.62 | a full pack blocked crafting at the workbench | the check ignored storage | output goes to storage at home | node: refused before, crafted into the box after |
| 0.10.64 | page error `Cannot read properties of null (reading dispose)` | clearing a zone with a never-drawn wall kind | guard on the mesh | reproduced and gone (`disp.mjs` scratch) |
| 0.10.68 | Auto gathered 23-27 tiles out an hour before a tide | the pre-tide rule only began at 45 minutes | gathering stays within 14 tiles inside 2 hours | `leash.mjs`: 23-27 before, 13-15 after (6 runs) |
| 0.10.69 | the antidote key used a Herb Poultice (−6 toxin) | it picked the best of anything with a toxin value | only a real cure (−10 or better) | node: poultice kept, tablets used |
| 0.10.71 | Auto opened the door and charged out the instant the last wave spawned | "finish the stragglers" began at queue-empty, with 20 alive | only when 3 or fewer remain (or all ranged) | `exits.mjs` log found it; tide 5: 12 of 16 against 9 |
| 0.10.73 | dragging a Stick Wall line over windows turned them all to stick | my own 0.10.65 let a wall replace a window | the swap is one-way (window into wall) | sim test |
| 0.10.75 | tide 15 test failed 2 of 6 runs, then 1 of 10 | stand-off spitters kept firing; no kills, no end | 90 s without a kill ends a stalled tide | 12 of 12 runs pass |
| 0.10.76 | toxin pinned at 100 for 90 minutes; no regeneration | natural decay 0.03 a game minute: 28 game hours to fall under 50 | 0.25 at home (3.3 game hours), 0.04 away | `node`: 133 real seconds at home |
| 0.10.77, 0.10.79 | a survivor who "joined" was gone with no word; later still standing outside | morale departure was a toast; the body was never removed | logged with morale and threshold; body removed; route closed | 30 games at morale 2: 26 left, all 26 logged, 0 bodies |
| 0.10.78 | two tide clocks an hour apart | opening the map left a second element with id `tide`, going stale | the map's line has its own id | repro: 1h 46m stale against 1h 43m; after, one element |
| 0.10.56, 0.10.50 | a guard sent on a trade route left the tide post empty; ledger and log disagreed | a runner kept their old job; the closing was a toast | giving a job brings them home; closing goes in the log | node: route closed, "Yusuf is now your mechanic" |

### R: Rough edges (the game was right but silent or misleading), 14

| Version | What was seen | Cause | Fix | Checked |
|---|---|---|---|---|
| 0.10.19 | "Missing Nails" with no way to know where nails come from | the source was only in a tooltip (no touch, no bot) | the message names the source | browser build hover |
| 0.10.20, 0.10.67, 0.10.79 | "Occupied" with nothing visible | a low trap, or a click one tile off | "Occupied by Bedroll at (26, 25)"; "There is already a Plank Window on that side" | node |
| 0.10.24 | Rain Catcher offered Collect and gave nothing; Radio Mast showed no leads | a fraction counted as stock; leads were only on the map | "Check" until a whole one; Contracts lists the leads | browser, real E key |
| 0.10.25, 0.10.66 | "food ×0" with berries and water in the pack | stores are the boxes; berries and dirty water do not count | ledger names what is not counted and what you carry | bot save, ledger text |
| 0.10.26, 0.10.31, 0.10.42 | "yard door vanished after the tide" | nothing named what a tide broke | tide-end lists pieces; each break says where, any time | real tide in the browser: "Plank Wall broken at (20, 20)" |
| 0.10.32 | "Sweat it out" silently skipped 10 hours | the cost was shown only after choosing | event choices say how long | browser: "(takes 10h)" |
| 0.10.33, 0.10.34 | "Pack full: Wild Herb dropped | picked up", snare meat "vanished" | overflow went to storage with no message | "put in your storage" says so | browser, both cases |
| 0.10.37, 0.10.64 | a bot walked its yard for a gap it could not see | the yard's state was invisible | ledger: closed/open with the gap's tile; unreachable furniture by name | real yards from reports |
| 0.10.38, 0.10.60 | no cure or repair ingredient could be found | sources were not shown there | "To get X: ..." under each missing item | bot save: Ballistic Weave, Steel Bar |
| 0.10.43, 0.10.45, 0.10.30, 0.10.72 | a called caravan "never came"; a lead "vanished"; a rival won while inside | a caravan stays 6 hours but could not be reopened; trips outlasted leads; nothing said a rival won | reopen from the ledger; trip refused if it would arrive late; messages | browser and node tests |
| 0.10.44, 0.10.74 | repair kits "wasted"; armour stayed 79 after repair | nothing said which piece, and armour does not wear down | names the piece and before/after; says armour does not wear | node: "Riot Helmet repaired: 38% → 98%" |
| 0.10.48, 0.10.40 | opening a trade route silently took the guard off his post | the warning came after, as a passing toast | each name shows the job it would leave; default is not a guard | bot save |
| 0.10.49, 0.10.70 | "rated fair, far harder" (several times) | the rating counts current health and medicine in the pack, not in boxes; toxic leads peak at 100 toxin | the card says what it was rated for and warns of toxin | `leadbot.mjs`: Pharmacy 12/12 lived, toxin 100 each run |
| 0.10.53, 0.10.64 | a full box and a crowded yard gave no way forward | message did not say what to build | names the bigger container | — |

### T: Harness or bot-tool faults (the tool misread the game), 10

| Version | What was seen | Cause | Fix | Checked |
|---|---|---|---|---|
| bot | "attack" in build mode placed Stake Traps | clicks in build mode place pieces | `attack` leaves build mode first | `tests/bot.mjs` |
| bot | a bot waited 21 s and the tide arrived | `wait` did not stop for a tide | `wait` stops an hour before and at the start | `tests/bot.mjs` |
| bot | "Fallen Branchess", "Small Boxs" | no plural rules | proper plurals | node check on 10 names |
| bot | "no buildings" at the Ranger Station | its view reaches a few steps | a list of every building with door and loot | `tests/bot.mjs` |
| bot | a bot could not leave the Police Station | no way to find the edge | `leave` walks to the nearest edge | `tests/bot.mjs` |
| bot | character kept walking after `goto` | a lost key-up left a key down | a stop releases all four keys unconditionally | `tests/bot.mjs` |
| bot | wall drag on the east side landed in the next cell | the click was 0.08 of a tile from the boundary | clicks 0.34 from centre | — |
| bot | flee ran onto the tide's side; attack chased out of the yard | flee ran from enemies, not to the yard; no leash | flee to the yard; attack stops 4 tiles from where it began in a tide | `tests/bot.mjs` |
| bot | map place under another could not be chosen | one tap, nearest only | taps step through overlapping places; the bot taps until chosen | — |
| bot | a report titled "undefined" | the model left the title out | title taken from the details | — |

### M: Reports that needed no change, 7

| Version | What was seen | Cause | Fix | Checked |
|---|---|---|---|---|
| — | "Police Station rated 2 killed a level 29 in 25 s" | the bot's own fighting; Auto cleared it 11 of 12 | none | `leadbot.mjs` |
| — | "build cost ignores logs in a box" | the bot had spent them: its own log showed have 27, then 7, 5, 1 | none | events log |
| — | "Vehicle Bay not built" quest tick | the bay stood at (29, 19), outside its "around you" list | told the bot where | save |
| — | Juno vanished (filed 4 times) | refiling an old save line after the fix | a hint so it stopped | — |
| — | "camp log disagrees with People list" (5 times) | old lines from before route closings were logged | a hint | — |
| — | "Wren left at morale 8, contradiction" | the threshold is 15; the message did not say | (part rough edge) message gives the threshold | — |
| — | "Esc does not close the Workbench sheet" | pressed through the bot's key path; real Esc works | none | real key in the browser: closed all three |

### X: My own process mistakes, 5

| Version | What was seen | Cause | Fix | Checked |
|---|---|---|---|---|
| process | 0.10.74 published with a failing test run | the publish was chained after the tests rather than gated | tests and commit first; publish as its own step | — |
| process | three syntax errors from a `//` comment at the end of a line | the comment swallowed the rest of a one-line function | `npm run check` now parses every script | a deliberately broken file is caught |
| process | a play test hung 21 minutes | two browser tests at once on the same port, and a `pgrep -f` loop matching itself | one browser test at a time; anchored `pgrep` | — |
| process | I called toxin "slow" and then measured: it cancels regeneration and clears in 28 game hours | I read the formula, not a run | measured before and after (0.10.76) | — |
| process | a first conclusion that holding Auto inside a yard was worse | measured in a bare 5×4 yard with no traps or survivors | re-measured with traps, survivors, windows | `yard.mjs`, `guardsyard.mjs` |

## 8. What I would change next

1. **A "resolved" list the bot sees at the start of every shift** (a section of `PLAYER.md` or a file the session appends to), so a fixed fault is not refiled until the bot is restarted.
2. **Cluster reports by title before triage** and show the count per cluster in `bot:report`, so five copies of the camp-log report are read once.
3. **Shorter runs, restarted more often** (30 to 60 minutes) so fixes reach the bots sooner; the cost per hour is the same and the lag between a fix and a bot seeing it falls from two hours to one.
4. **A `repro.mjs`**: load a report's `save.json` headless and print the same view the bot had (I built this by hand for nearly every report: `occ.mjs`, `unreach.mjs`, `mendsheet.mjs`).
5. **A way to see far** in the bot's view: its "Around you" list reaches a few steps, so reports about structures farther away are usually the tool. One line per structure kind with its nearest tile would remove a class of false reports.
6. **A monitor that does not expire** (or a digest every 30 minutes) instead of re-arming it by hand.
7. **Find out why a hurt character stalls in `leadbot.mjs`** (6 of 6 cleared from full health, 1 of 8 from 136 of 220), and fix the driver or the game.
8. **Play some of it by hand.** The reports cannot say whether the art, the feel or the length is right; a person's hour is worth more here than another bot-day.

## 9. Where the evidence is

| What | Where |
|---|---|
| Counts and costs | `python3 tools/bot/stats.py [--sessions]` |
| One session | `.out/bot/sessions/<date>-<profile>/` (`report.md`, `bugs.jsonl`, `bugs/NNN/{report.md,shot.jpg,save.json,state.json,events.json}`, `ideas.jsonl`, `shift-NNN.jsonl`) |
| The fix for each version | `CHANGELOG.md` (0.9.7 to 0.10.79), `git log` |
| The measurements | `tools/measure/` (`yard.mjs`, `exits.mjs`, `pretide.mjs`, `leash.mjs`, `guardsyard.mjs`, `settlements.mjs`, `bagtest.mjs`, `craftfull.mjs`) and `tools/leadbot.mjs` |
| How to run all of it | `docs/OPERATIONS.md` |

`.out/` is git-ignored: the raw sessions exist on this machine only. Copy `.out/bot/sessions/` somewhere if the evidence needs to outlive it.

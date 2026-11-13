# Automated play: a bot plays, people watch

A Claude model (Haiku by default) plays Graywake by itself in a browser of its own while you get on with something else. You watch it live, it files bugs and ideas as it goes, and everything it does is kept for review. Nothing here ships with the game: it is all under `tools/bot/`.

## Start, watch, stop

```sh
npm run bot                      # Haiku plays for 30 minutes; the watch page opens behind your other windows
npm run bot -- --minutes 120     # longer
npm run bot -- --window          # also put the real game window on your screen (see "Two ways to watch")
npm run bot -- --goal "build a walled yard with a door and survive the first tide"
npm run bot:watch                # reopen the watch page:  http://127.0.0.1:8777/
npm run bot:status               # one line of where it is, plus its last moves
npm run bot:stop                 # ask it to save its notebook, then end the session
npm run bot:report               # the latest session as one page: bugs, ideas, where it struggled
```

Needs Chrome and the `claude` command signed in (the same one Claude Code uses). No API key and no npm packages.

Options to `npm run bot --`: `--minutes N` (30), `--moves N` moves per shift (50), `--model haiku|sonnet|opus|<id>`, `--profile NAME` (which character: each profile has its own save and notebook, default `haiku`), `--fresh` (wipe that profile's save first), `--pace live|turns`, `--window`, `--sound`, `--goal "…"`, `--no-open`, `--keep` (leave the session and watch page up when the time runs out), `--port N`.

## What "your work cannot interfere" means here

| Your activity | Why it cannot touch the bot |
|---|---|
| Typing, clicking, switching windows, other browser tabs | The game runs in a separate Chrome with its own profile, driven over the DevTools protocol. It never needs focus and does not read your keyboard or mouse. |
| Your own Graywake save | The bot's save lives in its profile's browser storage (`.out/bot/profiles/NAME/`), not in your browser. |
| Editing the code, running tests, `npm start` | A session plays a frozen copy of `js/`, `vendor/` and `index.html` taken when it started (`.out/bot/sessions/ID/game/`). Change and break the working tree freely; the session says which commit it copied and whether there were uncommitted changes. |
| Covering or minimising windows | The default game browser has no window to cover. It draws on the GPU at full frame rate (about a fifth of one CPU core on the machine this was built on). |
| Sound | Muted unless you pass `--sound`. |
| The bot itself | The model is given the game tools and nothing else: no shell, no file access, no web. It cannot touch your files. |

The other direction: the bot uses some CPU and GPU and your Claude usage allowance. Measured on 2026-11-13 with Haiku: about 25 moves a minute, roughly 2.5 cents per 40-move shift at API list prices (about a dollar an hour). On a subscription it counts against usage instead.

## Two ways to watch

- **The watch page** (always there, `http://127.0.0.1:8777/`): a live moving picture of the game (about 30 frames a second), the character's health, food and water, what the bot is saying, every move it makes (click one to see the screen after it), its bug reports with pictures, its ideas, its notebook. It is watch-only by construction: there is nothing on it that plays the game. You can pause, stop, send the bot a hint, and file a bug of your own (the picture and save are attached for you).
- **The real game window** (`--window`): the actual Chrome window the bot is playing in, opened behind whatever you are doing. Real clicks and keys in it are swallowed by a shield in the page, so you cannot play by accident, and focus is emulated so switching away changes nothing. Checked: it opens without taking focus, keeps its frame rate behind other windows, and blocks stray input. Not checked: what happens if you minimise it to the Dock (Chrome may stop drawing a minimised window; leave it open, behind things).

## How the bot plays

- It acts through real input events: held WASD keys, mouse moves and presses, key presses, clicks on interface elements. It cannot set game state. Its tools are in `tools/bot/mcp.mjs`: `look` (with or without the screenshot), `walk`, `goto`, `use`, `attack`, `dodge`, `sneak`, `key`, `tap` (click numbered interface element), `tile` and `dragtile` (click the ground, for building), `click`, `scroll`, `wait`, and for writing things down `report_bug`, `suggest`, `note`, `notebook`.
- After every move it gets the screen as text (state, quest tracker, what is around with tile coordinates, the open sheet, a numbered list of what can be clicked, everything the game said since last time) and can ask for the picture. `tools/bot/page.js` builds that from the page.
- **Pace.** `live` (default): the world runs in real time and does not wait while the model thinks, as for a person. Sheets pause the game as usual. If something hostile closes in while the model is between moves, the session presses F so the game's own Auto mode defends the character, and tells the model. `turns`: the world holds still between moves (`G.hold` in `main.js`), for careful step-by-step testing; the picture then moves in bursts.
- **Shifts and the notebook.** The model plays in shifts of N moves, each a fresh conversation, so context stays small. Its notebook (`.out/bot/profiles/NAME/notebook.md`) is the only memory between shifts; it rewrites it at the end of each. The brief it plays under is `tools/bot/PLAYER.md`.

## What a session leaves behind

`.out/bot/sessions/<date-time>-<profile>/`:

| File | What |
|---|---|
| `report.md` | The page to read first (`npm run bot:report` writes and prints it). |
| `bugs.jsonl`, `bugs/NNN/` | Every report with its evidence: `shot.jpg`, `save.json` (paste into Menu → Export / import to stand where the bot stood), `state.json` (what the bot could see), `events.json` (its last 40 moves), `report.md`. Reports come from the bot, from you (watch page), and from the session's own checks: page errors, broken numbers, "undefined" in the interface. |
| `ideas.jsonl`, `journal.md`, `says.jsonl` | Suggestions, the bot's notes, what it said aloud. |
| `events.jsonl`, `shots/` | Every move and the screen after it. |
| `shift-NNN.jsonl`, `shifts.jsonl` | The model's whole conversation per shift; turns and cost per shift. |
| `game/` | The frozen copy of the game that was played. |

## Triage (for a person or for Claude)

1. `npm run bot:report`. Read Bugs, then "Where the bot struggled": repeated failures of the same move are often a real usability problem even when nobody filed it.
2. For each bug, look at `bugs/NNN/shot.jpg` and decide which of three things it is: a game bug, a rough edge worth an idea, or the bot or its tools misreading the game. All three are worth knowing; only the first two change the game. A tool problem is fixed in `tools/bot/`.
3. Reproduce with `save.json`, or drive a session by hand with the same commands the bot has: `node tools/bot/session.mjs` in one terminal, then `node tools/bot/ctl.mjs look`, `… goto crate`, `… use`, `… tap 3`.
4. After fixing, run the bot again on the same profile with a `--goal` that sends it back to the spot.

`npm run test:bot` checks the harness itself (27 checks, no model, about a minute), including that an open watch page keeps receiving the picture across a session restart.

## Limits worth knowing

- The model reacts in seconds, not milliseconds. In `live` pace it fights mostly through `attack` (the session keeps the cursor on the nearest enemy) and Auto mode. It will not find problems that need fast hands.
- Text is its main sense. It is told to look at the picture every few moves, but small visual faults will pass it by. Watch the picture yourself for those.
- Its moves are coarser than a person's (walk for N seconds, go to a tile), so "the bot could not do X" sometimes means the tool lacks a way, not that the game does.
- One session per port. Docker or anything else on 8777: pass `--port`.
- The watch page shows `live · N frames/s` in the corner of the picture. If it says the picture has not changed for a while, the game is on a still screen (a sheet is open) or the session has ended; the page reconnects by itself when a session comes back.
- The picture is not fetched while the watch tab is hidden, so a background tab costs nothing.
- First run of a session is from the title screen; later runs on the same profile continue its save.

## Changing it

- A new command: add it to `C` in `session.mjs` (it gets real-input helpers `press`, `click`, `steerKeys`, `during`) and a tool row in `mcp.mjs`.
- More for the bot to see: `observe()` in `page.js`, then `describe()` in `session.mjs`.
- What counts as a bug, how it should play: `PLAYER.md`.
- An automatic check: `check()` in `page.js`.

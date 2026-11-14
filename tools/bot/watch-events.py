#!/usr/bin/env python3
"""One line per thing worth knowing while bots play in a shared world. Meant to be run under a Monitor (or `python3 -u`), one event per line:

  HOLD  <enclave> in <world>: 60 -> 66     a hold change (the amounts say what happened: +6 strongroom, +10 tide held, -8 death, -25 tide lost)
  NEW   <enclave> settled in <world>       a settlement arrived (replacements) or a player enclave moved in
  GONE  <enclave> left <world>             an enclave fell or moved on
  BUG   <profile> [severity] <title>       a major bug report filed by a bot (minor ones are in the session report, not here)
  BOT RUN ENDED: n bot runs left           a bot's `run.mjs` has finished its minutes
  WORLD SERVER NOT ANSWERING for 60 s

Usage (from the repo root):  python3 -u tools/bot/watch-events.py [--world http://127.0.0.1:8795] [--profiles haiku,haiku2]
Run it with the shell's cwd at the repo root: it reads `.out/bot/sessions/*-<profile>/bugs.jsonl`.
It never writes anything and never touches the game or the bots.
"""
import argparse, glob, json, os, subprocess, time, urllib.request

ap = argparse.ArgumentParser()
ap.add_argument('--world', default='http://127.0.0.1:8795')
ap.add_argument('--profiles', default='haiku,haiku2')
ap.add_argument('--every', type=float, default=5)
a = ap.parse_args()
profiles = [p for p in a.profiles.split(',') if p]


def get(url):
    try:
        return json.load(urllib.request.urlopen(url, timeout=5))
    except Exception:
        return None


def bug_files():
    out = []
    for p in profiles:
        d = sorted(glob.glob('.out/bot/sessions/*-%s' % p))
        if d:
            out.append((p, d[-1] + '/bugs.jsonl'))
    return out


def bot_runs():
    # `^node tools/bot/run.mjs`: the anchor keeps the shell wrapper that carries the same text in its command line from counting
    r = subprocess.run("pgrep -f '^node tools/bot/run.mjs' | wc -l", shell=True, capture_output=True, text=True)
    return int((r.stdout or '0').strip() or 0)


seen, hold, down, runs, first = {}, {}, 0, None, True
for p, f in bug_files():
    seen[f] = sum(1 for _ in open(f)) if os.path.exists(f) else 0
while True:
    n = bot_runs()
    if runs is not None and n < runs:
        print('BOT RUN ENDED: %d bot runs left' % n)
    runs = n
    ws = get(a.world + '/api/worlds')
    if ws is None:
        down += 1
        if down == 12:
            print('WORLD SERVER NOT ANSWERING for 60 s')
            down = 0
    else:
        down = 0
        for w in ws if isinstance(ws, list) else ws.get('worlds', []):
            names = [g.get('name') for g in w.get('enclaves', [])]
            for g in w.get('enclaves', []):
                k, h = (w.get('name'), g.get('name')), g.get('hold')
                if k not in hold and not first:
                    print('NEW %s settled in %s (hold %s)' % (k[1], k[0], h))
                if k in hold and h != hold[k]:
                    print('HOLD %s in %s: %s -> %s' % (k[1], k[0], hold[k], h))
                hold[k] = h
            for k in [k for k in hold if k[0] == w.get('name') and k[1] not in names]:
                print('GONE %s left %s' % (k[1], k[0]))
                del hold[k]
        first = False
    for p, f in bug_files():
        if not os.path.exists(f):
            continue
        lines = open(f).read().splitlines()
        for l in lines[seen.get(f, 0):]:
            try:
                b = json.loads(l)
            except Exception:
                continue
            if b.get('severity') in ('major', 'critical', 'crash'):
                print('BUG %s [%s] %s' % (p, b.get('severity'), str(b.get('title', ''))[:120]))
        seen[f] = len(lines)
    time.sleep(a.every)

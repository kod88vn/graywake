#!/usr/bin/env python3
"""Numbers about every bot session on disk: how long they played, what it cost, how many reports of each severity, and which complaints recur.

Usage (from the repo root):   python3 tools/bot/stats.py [--sessions]
Reads `.out/bot/sessions/*-haiku` and `*-haiku2` (each session's `report.md`, `bugs.jsonl`, `ideas.jsonl`). Writes nothing.
The figures in `harness_review.md` come from this script. Caveats: the cost is the harness's own estimate at API list prices; "deaths" is read from
each report's header line (so a session whose report was never written counts none); the theme counts are keyword matches on the report titles and
overlap (one report can count under two themes), so read them as sizes, not exact tallies.
"""
import collections, glob, json, os, re, sys

THEMES = {
    'toxin / antidote / cure': r'toxin|antidote|cure',
    'Auto leaves the yard / chases in a tide': r'auto.*(yard|tide|walk|out)|(yard|tide).*auto',
    'camp ledger / stores / food x0': r'ledger|stores|food x0|water x0|0 days',
    'Occupied / build refusal': r'occupied|refus|cannot be placed|no reason',
    'pack full / no room / drop': r'pack (is )?full|no room|full pack|stow',
    'plural typos': r'plural|boxs|grasss|branchess|stoness',
    'Juno / survivor vanished': r'juno|vanish|left (the|their)|gave up waiting',
    'trade route / caravan': r'trade route|caravan|millrace',
    'lead rating different from the fight': r'rated|rating|threat',
    'esc / close sheet': r'esc|close the|sheet cannot|× \(close\)',
    'page error': r'page error|typeerror|cannot read',
}

sessions, titles = [], []
tot = collections.Counter()
mins = moves = deaths = ideas = 0
cost = 0.0
for d in sorted(glob.glob('.out/bot/sessions/*')):
    name = os.path.basename(d)
    if not re.search(r'-(haiku|haiku2)$', name):
        continue
    rep = open(d + '/report.md').read() if os.path.exists(d + '/report.md') else ''
    m = re.search(r'(\d+) minutes of play, (\d+) moves .*?\$([\d.]+)', rep)
    if m:
        mins += int(m.group(1)); moves += int(m.group(2)); cost += float(m.group(3))
    dm = re.search(r'deaths: (\d+)', rep)
    if dm:
        deaths += int(dm.group(1))
    bugs = []
    if os.path.exists(d + '/bugs.jsonl'):
        for l in open(d + '/bugs.jsonl'):
            try:
                bugs.append(json.loads(l))
            except Exception:
                pass
    for b in bugs:
        tot[b.get('severity')] += 1
        titles.append(b.get('title') or '')
    n_ideas = len(open(d + '/ideas.jsonl').read().splitlines()) if os.path.exists(d + '/ideas.jsonl') else 0
    ideas += n_ideas
    sessions.append((name, len(bugs), dict(collections.Counter(b.get('severity') for b in bugs)), n_ideas, m.groups() if m else None))

if '--sessions' in sys.argv:
    for s in sessions:
        print(s[0].ljust(24), 'reports', str(s[1]).rjust(3), s[2], 'ideas', s[3], 'minutes/moves/$', s[4])
hours = mins / 60 if mins else 0
print('sessions %d | %d minutes (%.1f h) | %d moves | cost $%.2f | deaths recorded %d | ideas %d' % (len(sessions), mins, hours, moves, cost, deaths, ideas))
print('reports %d: %s' % (len(titles), dict(tot)))
if hours and moves:
    print('cost per hour $%.2f | per 1000 moves $%.2f | per major-or-blocker report $%.2f' % (cost / hours, cost / moves * 1000, cost / max(1, tot['major'] + tot['blocker'])))
print('recurring themes (keyword matches on titles, overlapping):')
for k, rx in THEMES.items():
    print('  %4d  %s' % (sum(1 for t in titles if re.search(rx, t, re.I)), k))

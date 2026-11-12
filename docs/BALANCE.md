# Balance

What the numbers are, why, what has been measured and what has not.

## Time

- One real second of play is 1.5 game minutes. A day is 16 real minutes.
- Travel, sleep and some events skip the clock forward; nothing ever waits on the real clock.
- Food empties in 1.5 game days of play, water in 1. Both drain at 60% while travelling and 30% asleep.

## Player

- 100 health, +12 per rank of Thick Skin (10 ranks). Armour reduces damage by `arm / (arm + 40)`, capped at 80%: a hide set is about 20%, leather 34%, scrap 50%, riot 61%, military 71%, exo 78%.
- Experience to the next level is `50 + 38 L + 5.5 L²`: about 3,700 in total to reach level 10, 65,000 to level 30, 456,000 to level 60 and 2 million to the cap of 100. One perk point per level; the tree holds 174 ranks.
- Melee hits stagger for 0.22 s and cancel a wind-up. Sneak hits on an unaware target deal 2.5× (more with a knife or the Shadow perk).

## Creatures

At zone level L a creature has `hp × (1 + 0.2 k + 0.004 k²)` and `dmg × (1 + 0.12 k)`, `k = L − 1`. Bosses use their listed stats. Location levels: Pinewatch 1-8, Dustline 9-16, Harrow City 18-28, Frostspine 30-39, the Gray 42-55, the Deep Gray 58 + 2 per depth.

## Tides

- Tide `n` arrives three days after the last, at 21:00. Budget `(2 + 2.6 n + 0.3 n²)` in cost units (a husk is 1, a brute 6), level `1 + 1.1 (n − 1)`. Above about 70 attackers the remainder turns into extra levels. A Juggernaut leads every fifth tide.
- The setting "Tides: gentle / standard / brutal" multiplies the budget by 0.65 / 1 / 1.5.
- Away from home, strength `budget × (1 + 0.15 level) × 2` is compared with a defence score (wall health / 50, remaining trap damage / 90, loaded turret damage, 30+ per guard). The ratio decides how much of the base is damaged and whether stores are raided.

### Measured: `node tools/tidebot.mjs`

The bot is a floor, not a person: melee only, no walls, no healing, no turrets, no dodging of telegraphs, backs away between swings. Six runs each, standard tides, 2026-11-12:

| Tide | Loadout | Survived | Health left |
|---|---|---|---|
| 1 | spear, 2 stake traps, standing still | 6/6 | 87 |
| 1 | club, nothing else | 6/6 | 78 |
| 2 | spear, hide vest, 4 traps | 4/6 | 62 |
| 3 | bat, hide vest and leggings, 6 traps | 5/6 | 28 |
| 5 | machete, three leather pieces, 10 traps | 0/6 | |
| 8 | fire axe, three scrap pieces, 10 traps | 0/6 | |
| 12 | katana, full riot set, 15 traps | 0/6 | |

Reading: the first three tides can be won by someone who has done little more than follow the opening quests. From the fifth on, standing in the open with a blade is not enough, which is the intent: walls with a door, traps on the announced trail, a bolt thrower and a guard are all available by then. Whether that step is fair to a real player has not been tested by a real player.

## Length

The claim of a hundred hours is a design target, not a measurement. The reasoning:

- The story's 33 steps are gated by five vehicles, six bosses and tide counts of 1, 5 and 15 (days 3, 15 and 45: at least 12 hours of clock before the mid-game gate, more with travel).
- Level 60, where the last recipes and buildings open, needs about 456,000 experience. A kill in the Gray is worth roughly 60-130; contracts pay from about 150 in the valley to a few thousand in the Gray.
- After the ending: the Deep Gray gains two levels per descent, mutation tiers raise every creature and tide, achievements run to 100 tides and 365 days.

What could make it shorter or longer than intended is listed below.

## Open questions

1. **Mid-game tides (5-15) against a real player.** Only the crude bot has faced them.
2. **Experience pacing.** The curve was set by arithmetic. Nobody has checked how long levels 10-30 actually take.
3. **Material sinks.** Wall and station upgrade costs were not tuned against real gathering rates per trip.
4. **Durability.** Tool and weapon wear may be too fast or too slow; repair is cheap at the Mending Bench.
5. **Away resolution.** The defence-score formula is a guess that produces plausible reports in tests.
6. **Cold and toxin.** Unprotected, the Gray fills the toxin bar in about two minutes and Frostspine drains 20 health a minute. Untested for feel.
7. **Auto-gather** is strong at home (it never tires). It stops when hostiles are within nine tiles.

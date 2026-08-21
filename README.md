# ⚽ Football Life — Career Simulator

A browser football **career simulator** in the mould of Copero's *simulador de carrera*.
Rob eight legends for your attributes, sign for a club that will take a teenager, and play
the moments that actually decide a career — from your first professional contract to the day
you stop.

No build step, no dependencies, no server. Open `index.html` and play.

```bash
# just open the file…
xdg-open index.html

# …or serve it locally
python3 -m http.server 8000   # then visit http://localhost:8000
```

Your career autosaves to `localStorage` after every match, so you can close the tab and
pick it up later with **Continue Career**.

## 📱 On your phone

It is built mobile-first — designed at phone width and tested with touch input from
360×640 up to tablet size.

- Every screen is one thumb-friendly column; no pinching, no horizontal scrolling
- Tap targets are at least ~58px tall, and the bottom tab bar sits above the home indicator
  (safe-area insets are respected)
- Match choices always fit on screen: on short phones the layout tightens automatically and
  five- or six-option moments (penalty placement, celebrations) switch to a two-up grid
- Sized to the *visible* viewport (`dvh`), so a mobile URL bar never covers the controls
- No double-tap zoom delay, and pull-to-refresh won't yank the page mid-match

**Getting it onto a phone.** The GitHub app renders these files as text — it cannot run
them — so the game needs to come from somewhere that serves it as a web page:

1. **One downloadable file (no setup).** `play.html` is the entire game —
   markup, styles and all scripts inlined into a single self-contained page. The only
   external requests are the real club badges, which are hot-linked when you are online;
   offline the game falls back to its own drawn crests. Open it in a mobile browser signed
   in to GitHub, tap *Download raw file*, then open the download from Files (iOS) or
   Downloads (Android). It plays offline from then on.
2. **GitHub Pages.** `.github/workflows/pages.yml` deploys the game automatically — it
   enables Pages through the API on its first run, so there are no repository settings to
   visit from a phone. The job is skipped while the repository is private, because Pages
   for private repositories needs a paid plan; make the repository public and the next
   push publishes to `https://<user>.github.io/Football-simulator/`.
3. **Same Wi-Fi.** Run `python3 -m http.server 8000` on your computer and visit
   `http://<your-computer-ip>:8000` on your phone.

Then use **Add to Home Screen** (Share menu on iOS, browser menu on Android). It installs
with its own icon and launches fullscreen with no browser chrome — a web app manifest and
the iOS meta tags are included.

### Boss Mode

There is a hidden panel for editing a career: attributes and their ceilings, a target overall,
any of the 25 traits on or off, condition, age, squad number, position, and an instant move to
any club in the game. It is reached by tapping the overall badge five times and entering a
code, and it stays unlocked in that save until you lock it again. Typing the code on a keyboard
works too.

### Rebuilding the single file

`play.html` and `dist/artifact.html` are generated. After changing anything under `js/` or
`css/`, run:

```bash
node build.js
```

---

## What you actually do

### Create a player
Name, nationality, strong foot, squad number, and one of ten positions.

### Rob eight legends
Eight greats file past you one at a time — El Relámpago, The Wall, O Mágico, Two-Foot Tomás —
and from each you steal **exactly one attribute**. Take a number and it is gone from the board;
the next legend cannot give it to you again.

What you steal becomes your **ceiling** in that attribute. You start at roughly half of it and
spend a whole career climbing towards it, so the draft is the single most important decision
you make. Take a legend's 97 pace and you will be lightning one day. Leave defending until
last and you will be permanently uncomfortable in your own half.

Keepers rob a different set of legends, where goalkeeping replaces shooting.

The eight attributes are Copero's: **pace, shooting, passing, dribbling, defending, physical,
flair and weak foot**. Flair decides whether the outrageous option comes off. Weak foot matters
because roughly a quarter of chances fall on the wrong side.

### Pick a club
120 clubs across 10 leagues — England, Spain, Italy, Germany, France, Netherlands, Portugal,
Argentina, Brazil and MLS. Clubs above your level will not gamble on a teenager, and the better
your ceiling, the bigger the badges that will. Sign at a giant and you will spend a season
fighting a better player for the shirt.

### Play the moments, not the match
Matches simulate around you and stop for the decisions you would actually be judged on:

**52 different moments**, each with two to six real options:

| | |
|---|---|
| **Attacking** | One-on-one · edge of the box · header from a cross · volley at the back post · back to goal · tight angle on the byline · one-two on the edge · overhead kick · the keeper is stranded · rebound in the six-yard box · long range · the backheel · the flick-on · the ninety-first minute |
| **On the ball** | Isolated 1v1 · three-on-two break · switching play · pressing trigger · fifty-fifty in the middle · the nutmeg · the overlapping run |
| **Set pieces** | Penalty (six placements, including the Panenka) · free kick · corner · take it quickly · the quick throw · **shootouts you take yourself** |
| **Defending** | Last man back · aerial duel · playing out of your own box · offside trap · man-marking their best player · blocking the shot · the recovery run · protecting a lead · the goal-line clearance |
| **Goalkeeping** | One-v-one · crosses · distribution · facing a penalty · sweeping behind the line · shots from distance · setting the wall · a back pass under pressure |
| **Everything else** | Contact in the box · referee flashpoint · he's on a hat-trick · playing through a twinge · being substituted · a team-mate down · a hostile away end · your celebration |

Moments never repeat inside a match, and the game remembers the last sixteen you were shown
across matches and heavily down-weights them, so the rotation keeps turning over instead of
cycling through the same handful. The most common moment in a full career simulation accounts
for around a tenth of what you see, and the frequent ones have several different set-ups so
they do not read the same way twice.

Three, five or eight interactive moments per match, your choice. Everything else is simulated
and narrated live, and you can sim the rest at any time.

### Squads that read like squads
Every generated player's name matches where he is from, and a club's squad is mostly local
with a handful of imports along realistic routes — a Serie A side of Italians with a Dutchman
and a Serb, a Brazilian club with a couple of Argentines. 760 names across 28 nations, squad
numbers handed out by position, flags on the team sheet, and a named danger man in the
opposition before every kick-off.

On top of that, **319 real star players** anchor 89 clubs — Haaland leads the line at
Manchester City, Bellingham at Real Madrid, Messi at Inter Miami. They show up in squad
lists, the top-scorer race and the pre-match danger-man warning. Squads as of 2025-26,
best effort.

### The week in between
One session before each match, and all of it football: a specific training drill, rest,
video analysis, a word with the manager, press duty, or an afternoon with the academy.
Then the game happens to you. **44 off-field moments**, presented like the ones on the pitch —
a situation, and choices with real consequences:

| | |
|---|---|
| **Dressing room** | A row with the manager · who takes the penalties · a debut to look after · a training-ground flashpoint · the ritual is famous now |
| **Transfer** | Deadline day at 11pm · a loan offer · your agent has news · early contract talks |
| **Manager** | A change of shape · video review with the whole squad watching · the manager is sacked · a new role · the data says you don't run |
| **Media** | A rumour in the press · something private has leaked · a rival takes aim · a documentary crew · the boot deal · the cover vote · the big podcast · the ratings leak |
| **International** | Left out of the squad · two countries want you · captain your country |
| **Training ground** | Set-piece practice · the mid-season camp |
| **Club** | Derby week · the supporters' forum · the club is in trouble · the number is free · a testimonial · the tattooed fan · recruiting a wonderkid · back where it started · the hall of fame |
| **Awards, fitness, discipline** | You are nominated · the scan results are in · charged by the federation |

Some of them stick: claim the penalties and you take them for the rest of your career, win
the set-piece duel in training and dead balls come to you more often, take the free shirt
number and a team-mate swaps with you.

### Build a career
- Full league season with a live table and top-scorer race
- Domestic cup and continental competition (Champions League, Libertadores, CONCACAF)
- Knockout ties level after 90 go to a **penalty shootout you actually take**
- International call-ups, World Cups and continental championships every other summer
- A squad-mate competing for your shirt; manager trust that decides whether you start
- Injuries, suspensions, fitness, form and morale
- **Press headlines** that react to what you did — hat-tricks, red cards, transfers, titles
- **Player of the Month awards** judged on your league form, month by month
- A living football world in the news feed — rival stars score hat-tricks, record transfers
  happen and are remembered, managers get sacked and wonderkids break through
- End-of-season awards: Golden Boot, Team of the Season, Young Player, World Player of the Year
- A summer transfer window with real offers: fee, wages, contract length and a pitch
- **25 traits** earned on the pitch, including a set of style traits that sharpen one
  particular kind of moment: Finesse Expert, Power Shooter, Six-Yard Poacher, Aerial Threat,
  Visionary, Explosive, Press Resistant, Long Range Threat, Shot Stopper, Sweeper Keeper,
  Theatrical and Iron Man — plus two you would rather avoid (Glass Ankles, Hot Head).
  Each option in a moment belongs to a style, and a matching trait makes it measurably more
  likely to come off: a Power Shooter blasting a one-on-one converts 62% of the time instead
  of 77%, an Aerial Threat wins headers 15 points more often, and a Long Range Threat roughly
  doubles the odds of a worldie from thirty yards.
- **A crest for every club**, drawn from its real colours and shirt pattern — stripes, hoops,
  halves, sash — and shown on fixtures, the table, the scoreboard and every transfer offer.
  Online, the club's real badge is layered over the drawn shield (hot-linked from Wikipedia);
  offline the drawn crest is what you see.
- Retirement with the full Copero career card — appearances, goals, clubs played for,
  collective and individual titles, international record, **peak overall** and **peak market
  value** — a legacy score from Journeyman to Immortal, and a life after football

There is no money to spend, no nightclubs, no relationships. Market value exists because it is
how football measures you, not because there is a wallet to fill.

---

## Project layout

```
index.html               markup shell
play.html                generated: the whole game as one self-contained file
build.js                 inlines css + js into play.html and dist/artifact.html
tools/build-icons.js     generates js/icons.js from two open-source icon packs
tools/build-badges.js    generates js/badges.js (real club badge URLs from Wikipedia)
.github/workflows/       GitHub Pages deployment
manifest.webmanifest     add-to-home-screen / installable web app
icon.svg, *.png          app icons (SVG source + rendered PNG sizes)
css/styles.css           dark, mobile-first stylesheet
js/icons.js              generated SVG sprite — every icon in the game
js/badges.js             generated map of club -> real badge image URL
js/crest.js              draws each club's badge; layers the real badge over it when online
js/data.js               leagues, clubs, nations, positions, traits, legends, real stars
js/util.js               RNG, maths, formatting
js/state.js              world + player creation, contracts, save/load
js/scenarios.js          the interactive match moments
js/engine.js             squads, match sim, calendar, progression, transfers, awards
js/career.js             the training week, club events, legacy and retirement
js/ui.js                 screens, rendering, modals, creation wizard
js/main.js               game flow: match loop, weeks, seasons, retirement
```

Plain ES5-compatible JavaScript with no framework and no bundler — every file attaches one
global (`Icons`, `DATA`, `U`, `State`, `Scenarios`, `Engine`, `Career`, `UI`, `Game`) and the
scripts load in order.

### Icons

Every icon is an inline SVG from a generated sprite — no icon font, no CDN, nothing fetched at
runtime. To regenerate after adding one:

```bash
npm install          # dev-only: the two icon packs
node tools/build-icons.js
node build.js
```

- [Material Design Icons](https://pictogrammers.com/library/mdi/) by Pictogrammers — Apache 2.0
- [Circle Flags](https://github.com/HatScripts/circle-flags) by HatScripts — MIT

Both packs are indexed by [allsvgicons.com](https://allsvgicons.com/); the build pulls them from
the Iconify npm mirrors so it is reproducible.

Club and competition names are used for flavour; each club also has a drawn crest from its
colours, layered underneath its real badge image when one is reachable. The legends in the
draft are invented; headline real players anchor the squads while the rest of each squad,
all results and all events are generated by the simulation.

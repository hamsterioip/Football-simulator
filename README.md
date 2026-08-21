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

1. **One downloadable file (no setup, works offline).** `play.html` is the entire game —
   markup, styles and all eight scripts inlined into a single self-contained page with no
   external requests of any kind. Open it in a mobile browser signed in to GitHub, tap
   *Download raw file*, then open the download from Files (iOS) or Downloads (Android).
   It plays offline from then on.
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

| Moment | Your call |
|---|---|
| **One-on-one** | Blast it · round the keeper · dink it · square it |
| **Edge of the box** | Shoot · through ball · take a touch and beat your man · recycle |
| **Penalty** | Six placements, including the Panenka |
| **Penalty shootout** | You take your kicks. As a keeper, you pick your dive |
| **Free kick** | Curl it · drill it under the wall · whip it in · let someone else take it |
| **Corner** | Near post · back post · short · go for the Olimpico |
| **Three-on-two** | Drive at them · slip in the winger · slow it down |
| **Isolated 1v1** | Nutmeg · stepover · knock and run · keep it simple |
| **Last man back** | Slide tackle · jockey · cynical foul · shoulder him off |
| **Goalkeeper** | Spread yourself · rush out · stand tall · claim or punch the cross |
| **Contact in the box** | Go down… or stay up and finish it honestly |
| **Referee flashpoint** | Get in his face · sarcastic applause · say nothing |
| **He's on a hat-trick** | Take it yourself or roll it to him |
| **You feel a twinge** | Play through the pain or signal to the bench |
| **You scored** | Pick your celebration — shirt off costs a yellow |

Three, five or eight interactive moments per match, your choice. Everything else is simulated
and narrated live, and you can sim the rest at any time.

### The week in between
One session before each match, and all of it football: a specific training drill, rest,
video analysis, a word with the manager, press duty, or an afternoon with the academy.
Then the game happens to you — a dressing-room row, a sixteen-year-old arriving in your
position, the armband, a transfer rumour, a loan offer, the manager sacked, derby week,
a rival taking aim at you in the press.

### Build a career
- Full league season with a live table and top-scorer race
- Domestic cup and continental competition (Champions League, Libertadores, CONCACAF)
- Knockout ties level after 90 go to a **penalty shootout you actually take**
- International call-ups, World Cups and continental championships every other summer
- A squad-mate competing for your shirt; manager trust that decides whether you start
- Injuries, suspensions, fitness, form and morale
- **Press headlines** that react to what you did — hat-tricks, red cards, transfers, titles
- End-of-season awards: Golden Boot, Team of the Season, Young Player, World Player of the Year
- A summer transfer window with real offers: fee, wages, contract length and a pitch
- Traits earned on the pitch (Clinical Finisher, Ice in the Veins, Set Piece Wizard, Showman)
  and two you would rather avoid (Glass Ankles, Hot Head)
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
.github/workflows/       GitHub Pages deployment
manifest.webmanifest     add-to-home-screen / installable web app
icon.svg, *.png          app icons (SVG source + rendered PNG sizes)
css/styles.css           dark, mobile-first stylesheet
js/icons.js              generated SVG sprite — every icon in the game
js/data.js               leagues, clubs, nations, positions, traits, legends
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

Club and competition names are used for flavour. The legends in the draft are invented, and all
players, results and events are generated by the simulation.

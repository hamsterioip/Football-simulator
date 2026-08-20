# ⚽ Football Life — Career & Life Simulator

A browser football **career simulator** crossed with a **life sim**. You create one player,
choose the club that takes a chance on you, and live the whole career: the big moments on
the pitch, and everything that happens off it.

No build step, no dependencies, no server. Open `index.html` and play.

```bash
# just open the file…
xdg-open index.html

# …or serve it locally
python3 -m http.server 8000   # then visit http://localhost:8000
```

Your career autosaves to `localStorage` after every match, so you can close the tab and
pick it up later with **Continue Career**.

---

## What you actually do

### Create a player
Name, nationality, strong foot, one of ten positions (GK through ST), and a difficulty
setting — *Academy Hopeful*, *Highly Rated* or *Generational* — which decides how good
17-year-old you already is, and therefore **which clubs will sign you**. Anything above
your level is locked. Start in the Eredivisie and climb, or take the pressure at a giant
straight away.

120 clubs across 10 leagues: England, Spain, Italy, Germany, France, Netherlands,
Portugal, Argentina, Brazil and MLS.

### Play the moments, not the match
Matches are simulated around you, and when you are involved the game stops and asks you
what you do. Every choice is a real risk/reward decision resolved against your attributes,
form, fitness and the opponent's quality:

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

Each match gives you 3, 5 or 8 interactive moments (your choice in Options). Everything
else is simulated and narrated live, and you can sim the rest at any time.

### Live the life
One activity per week: extra training on a specific drill, rest, video analysis, a night
out, family time, charity work, a press conference, casino night, language classes,
gaming with the lads, or a meeting with your agent. Then the world happens to you —
tabloid stories, dressing-room rows, advert shoots, doping tests, a super-agent's call,
burnout, a wonderkid arriving in your position, a relative asking for money.

- **Relationships** — dating app, dates and gifts, proposing, marriage, children, breakups
  and (expensive) divorces
- **Money** — weekly wages, goal bonuses, prize money, sponsorship deals, tax bills,
  supercars, penthouses, private jets, a private island, investments that mature each season
- **Staff** — personal chef, private physio, mental coach, PR agency, skills coach, analyst
- **Fame & followers** — grow the brand, with diminishing returns and a spotlight that
  moves on if you stop performing

### Build a career
- Full league season (22 matches) with a live table and top-scorer race
- Domestic cup and continental competition (Champions League, Libertadores, CONCACAF)
- Knockout ties that finish level go to a **penalty shootout you actually take**
- International call-ups, World Cups and continental championships every other summer
- Competition for your shirt: a squad-mate in your position you have to keep out
- Injuries, suspensions, fitness, form, morale and the manager's trust
- End-of-season awards: Golden Boot, Team of the Season, Young Player, World Player of the Year
- Transfer window every summer — real offers with fees, wages, signing bonuses and a pitch
- Unlockable traits (Clinical Finisher, Ice in the Veins, Set Piece Wizard, Showman…)
  and two you would rather avoid (Glass Ankles, Hot Head)
- Retirement, a **legacy score** from Journeyman to Immortal, and life after football

---

## Project layout

```
index.html          markup shell
css/styles.css      dark, mobile-first stylesheet
js/data.js          leagues, clubs, nations, positions, traits, assets, sponsors
js/util.js          RNG, maths, formatting
js/state.js         world + player creation, contracts, save/load
js/scenarios.js     the interactive match moments
js/engine.js        squads, match sim, calendar, progression, transfers, awards
js/life.js          activities, relationships, money, random life events, legacy
js/ui.js            screens, rendering, modals, creation wizard
js/main.js          game flow: match loop, weeks, seasons, retirement
```

Plain ES5-compatible JavaScript with no framework and no bundler — every file attaches one
global (`DATA`, `U`, `State`, `Scenarios`, `Engine`, `Life`, `UI`, `Game`) and the scripts
load in order.

Club and competition names are used for flavour; all players, results and events are
generated by the simulation.

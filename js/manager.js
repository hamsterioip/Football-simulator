/* ==========================================================================
   manager.js — Manager Mode.

   The other side of the touchline. You take a club, you pick the eleven, you
   buy and sell, and a board that has never kicked a ball decides whether you
   are doing well enough to keep the job.

   It shares the world, the clubs, the crests and the fixture maths with the
   career game, but it keeps its own state on g.mgr and draws its own screens,
   so neither mode has to know about the other.
   ========================================================================== */
(function (global) {
  'use strict';

  const $ = id => document.getElementById(id);

  /* ---------------- shapes ---------------- */

  const FORMATIONS = {
    '4-3-3':   { name: '4-3-3',   line: ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'ST', 'LW'],
                 hint: 'Width and a front three. Attacking.' },
    '4-4-2':   { name: '4-4-2',   line: ['GK', 'RB', 'CB', 'CB', 'LB', 'RW', 'CM', 'CM', 'LW', 'ST', 'ST'],
                 hint: 'Two banks of four, two up top. Honest.' },
    '4-2-3-1': { name: '4-2-3-1', line: ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CDM', 'CAM', 'RW', 'LW', 'ST'],
                 hint: 'Solid base, one man in the hole. Modern.' },
    '3-5-2':   { name: '3-5-2',   line: ['GK', 'CB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'LB', 'ST', 'ST'],
                 hint: 'Three at the back, wing-backs flying. Bold.' },
    '5-3-2':   { name: '5-3-2',   line: ['GK', 'RB', 'CB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CM', 'ST', 'ST'],
                 hint: 'Five at the back. For when you need a point.' }
  };

  /* Where each man in FORMATIONS[f].line stands, in a 0-100 box with the goal
     you are defending at the bottom. Same order as the line, so slot i belongs
     to the shirt in xi[i] — that is what lets the pitch view and the swap
     logic agree without either knowing about the other. */
  const SLOTS = {
    '4-3-3':   [[50, 92], [90, 70], [64, 70], [36, 70], [10, 70],
                [50, 55], [74, 40], [26, 40], [86, 24], [50, 8], [14, 24]],
    '4-4-2':   [[50, 92], [90, 70], [64, 70], [36, 70], [10, 70],
                [88, 46], [63, 50], [37, 50], [12, 46], [64, 14], [36, 14]],
    '4-2-3-1': [[50, 92], [90, 70], [64, 70], [36, 70], [10, 70],
                [64, 55], [36, 55], [50, 39], [87, 30], [13, 30], [50, 8]],
    '3-5-2':   [[50, 92], [72, 72], [50, 76], [28, 72],
                [92, 50], [50, 57], [70, 41], [30, 41], [8, 50], [64, 14], [36, 14]],
    '5-3-2':   [[50, 94], [92, 62], [70, 76], [50, 79], [30, 76], [8, 62],
                [50, 50], [72, 35], [28, 35], [64, 11], [36, 11]]
  };

  const STYLES = {
    balanced: { name: 'Balanced', hint: 'No surprises either way.', att: 0, def: 0, risk: 0 },
    attack:   { name: 'Attacking', hint: 'More goals at both ends.', att: 3.5, def: -2.5, risk: 1 },
    press:    { name: 'High press', hint: 'Suffocate them, and tire.', att: 2.5, def: 1.5, risk: 2 },
    counter:  { name: 'Counter', hint: 'Sit in, hit them fast.', att: 1, def: 2, risk: -1 },
    park:     { name: 'Shut up shop', hint: 'A point is a good result.', att: -4, def: 5, risk: -2 }
  };

  const TALKS = [
    { id: 'calm',   label: 'Keep it calm', hint: 'Trust them. Steady hands.', boost: 1.2, risk: 0 },
    { id: 'fire',   label: 'Light a fire', hint: 'Loud. It works, or it backfires.', boost: 3.2, risk: 2.4 },
    { id: 'tactic', label: 'Talk them through it', hint: 'Whiteboard. Small, certain edge.', boost: 1.8, risk: .4 },
    { id: 'trust',  label: 'Say nothing', hint: 'They are professionals. Let them play.', boost: .6, risk: -.6 }
  ];

  /* ---------------- creating a job ---------------- */

  function squadFor(club, size) {
    const U = global.U, D = global.DATA, Engine = global.Engine;
    const want = size || 22;
    // the career game only needs a matchday squad; a manager needs a bench he
    // can actually rotate, so top it up with fringe players in the positions
    // the first eighteen are thinnest in
    const squad = Engine.Squad.generate(club);
    const seen = new Set(squad.map(s => s.name));
    for (let guard = 0; squad.length < want && guard < 8; guard++) {
      Engine.Squad.generate(club).forEach(s => {
        if (squad.length >= want || seen.has(s.name)) return;
        const cover = squad.filter(x => x.pos === s.pos).length;
        if (cover >= 3) return;                    // already deep enough there
        s.ovr = Math.round(U.clamp(s.ovr - U.int(2, 6), 40, 96));
        seen.add(s.name);
        squad.push(s);
      });
    }
    squad.length = Math.min(squad.length, want);
    squad.forEach((s, i) => {
      s.wage = wageFor(s);
      s.value = valueFor(s);
      s.form = U.int(45, 70);
      s.fit = U.int(88, 100);
      s.apps = 0; s.goals = 0; s.assists = 0; s.rating = 0; s.ratingSum = 0;
      s.shirt = s.shirt || i + 1;
    });
    return squad;
  }

  /* The top of the market is not a curve, it is a cliff: the gap between an 84
     and a 94 in money is far wider than the ten points suggests, which is what
     stops you buying a superstar in your first window at a mid-table club. */
  function elite(ovr, rate) { return ovr >= 84 ? Math.pow(rate, ovr - 83) : 1; }

  function valueFor(s) {
    const base = Math.pow(Math.max(s.ovr - 42, 2), 2.9) * 260;
    const age = s.age <= 23 ? 1.45 : s.age <= 27 ? 1.15 : s.age <= 30 ? 0.85 : s.age <= 33 ? 0.45 : 0.2;
    return Math.max(120000, Math.round(base * elite(s.ovr, 1.18) * age / 50000) * 50000);
  }
  function wageFor(s) {
    return Math.max(1200, Math.round(
      Math.pow(Math.max(s.ovr - 40, 2), 2.1) * 3.4 * elite(s.ovr, 1.12) / 100) * 100);
  }

  function boardTarget(club, league) {
    const rivals = league.clubs.map(id => global.State.club(id)).sort((a, b) => b.rating - a.rating);
    const rank = rivals.findIndex(c => c.id === club.id) + 1;
    const n = rivals.length;
    if (rank <= 2) return { pos: 1, text: 'Win the league. Nothing else will do.' };
    if (rank <= 4) return { pos: 4, text: 'Finish in the top four.' };
    if (rank <= 8) return { pos: Math.max(6, rank - 1), text: 'Finish in the top half and be interesting.' };
    return { pos: Math.max(3, n - 3), text: 'Stay up. That is the job.' };
  }

  function start(g, clubId) {
    const U = global.U, State = global.State, Engine = global.Engine;
    const club = State.club(clubId);
    const league = State.league(club.league);
    const target = boardTarget(club, league);

    g.mode = 'manager';
    g.mgr = {
      club: clubId,
      formation: '4-3-3',
      style: 'balanced',
      xi: [],
      budget: Math.round(Math.pow(Math.max(club.rating - 50, 3), 2.6) * 9000 / 500000) * 500000,
      wageBudget: Math.round(Math.pow(Math.max(club.rating - 45, 4), 2.2) * 62 / 1000) * 1000,
      board: { target, confidence: 62, seasons: 0 },
      window: 'summer',
      shortlist: [],
      log: [],
      results: [],
      trophies: [],
      sacked: false
    };
    g.squad = squadFor(club, 22);
    // the ceiling has to sit above the bill you inherited, or you start the job
    // already over budget and can never sign anybody
    g.mgr.wageBudget = Math.max(g.mgr.wageBudget,
      Math.round(squadWages(g) * 1.3 / 1000) * 1000);
    g.mgr.xi = autoPick(g).map(s => s.id);
    buildSeason(g);
    State.log(`You are the manager of ${club.name}. ${target.text}`, 'good');
    return g;
  }

  /* ---------------- the season ---------------- */

  function buildSeason(g) {
    const State = global.State, Engine = global.Engine, U = global.U;
    const club = State.club(g.mgr.club);
    const league = State.league(club.league);
    g.tables = g.tables || {};
    g.tables[league.id] = {};
    league.clubs.forEach(id => {
      g.tables[league.id][id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 };
    });
    const single = Engine.Season.roundRobin(league.clubs);
    const rounds = single.concat(single.map(r => r.map(pair => [pair[1], pair[0]])));
    g.mgr.rounds = rounds;
    g.mgr.round = 0;
    g.mgr.results = [];
    g.squad.forEach(s => { s.apps = 0; s.goals = 0; s.assists = 0; s.ratingSum = 0; s.form = U.int(45, 70); });
  }

  function nextFixture(g) {
    const round = g.mgr.rounds[g.mgr.round];
    if (!round) return null;
    const me = g.mgr.club;
    const pair = round.find(p => p[0] === me || p[1] === me);
    if (!pair) return null;
    return { home: pair[0] === me, oppId: pair[0] === me ? pair[1] : pair[0], round: g.mgr.round };
  }

  /* the eleven you have picked, and what it is worth */
  function xiPlayers(g) {
    return (g.mgr.xi || []).map(id => g.squad.find(s => s.id === id)).filter(Boolean);
  }
  function benchPlayers(g) {
    const inXI = {};
    (g.mgr.xi || []).forEach(id => inXI[id] = true);
    return g.squad.filter(s => !inXI[s.id]);
  }

  /* pick the best available player for each slot in the formation */
  function autoPick(g) {
    const shape = FORMATIONS[g.mgr.formation].line.slice();
    const pool = g.squad.slice().sort((a, b) => b.ovr - a.ovr);
    const used = {}, out = [];
    shape.forEach(pos => {
      let best = pool.find(s => !used[s.id] && s.pos === pos);
      if (!best) best = pool.find(s => !used[s.id] && sameGroup(s.pos, pos));
      if (!best) best = pool.find(s => !used[s.id]);
      if (best) { used[best.id] = true; out.push(best); }
    });
    return out;
  }
  function sameGroup(a, b) {
    const D = global.DATA;
    const ga = a === 'GK' ? 'GK' : (D.POSITIONS[a] || {}).group;
    const gb = b === 'GK' ? 'GK' : (D.POSITIONS[b] || {}).group;
    return ga === gb;
  }

  /* how good the eleven actually is, allowing for players out of position */
  /* An era signing carries the trait that version of him was known for. It is
     on the card, so it has to mean something on the pitch: the finishers get
     the ball in front of goal more often, and the defensive ones tighten the
     side up rather than adding to the attack. */
  const TRAIT_GOALS = {
    'Finisher': 1.35, 'Poacher': 1.45, 'Knuckleball Power Shot': 1.3, 'Power Shot': 1.25,
    'Set-Piece Specialist': 1.2, 'Late Runs': 1.25, 'Dribbler Expert': 1.15,
    'Blistering Pace': 1.15, 'Flair': 1.1, 'Playmaker': 0.95, 'Engine': 1.0,
    'Aerial Threat': 1.2, 'The Wall': 0.7, 'Shot Stopper': 0.7
  };
  const TRAIT_TEAM = {
    'Playmaker': { att: 1.1, def: 0 }, 'Engine': { att: 0.5, def: 0.5 },
    'The Wall': { att: 0, def: 1.4 }, 'Shot Stopper': { att: 0, def: 1.5 },
    'Blistering Pace': { att: 0.8, def: 0 }, 'Dribbler Expert': { att: 0.8, def: 0 },
    'Knuckleball Power Shot': { att: 0.9, def: 0 }, 'Power Shot': { att: 0.7, def: 0 },
    'Finisher': { att: 0.7, def: 0 }, 'Poacher': { att: 0.6, def: 0 },
    'Aerial Threat': { att: 0.5, def: 0.4 }, 'Late Runs': { att: 0.6, def: 0 },
    'Set-Piece Specialist': { att: 0.6, def: 0 }, 'Flair': { att: 0.5, def: 0 }
  };
  /* The version you signed carries its own trait, before you buy any era. */
  function traitOf(s) { return (s && ((s.era && s.era.trait) || s.trait)) || null; }
  function traitScoring(s) { return TRAIT_GOALS[traitOf(s)] || 1; }
  function traitBonus(g) {
    let att = 0, def = 0;
    xiPlayers(g).forEach(s => {
      const t = TRAIT_TEAM[traitOf(s)];
      if (t) { att += t.att; def += t.def; }
    });
    return { att, def };
  }

  function teamRating(g) {
    const U = global.U;
    const xi = xiPlayers(g);
    if (!xi.length) return 50;
    const shape = FORMATIONS[g.mgr.formation].line;
    let total = 0;
    xi.forEach((s, i) => {
      const want = shape[i] || s.pos;
      const fit = s.pos === want ? 1 : sameGroup(s.pos, want) ? 0.94 : 0.84;
      const cond = 0.9 + (s.fit / 100) * 0.1;
      const form = 0.94 + (s.form / 100) * 0.12;
      total += s.ovr * fit * cond * form;
    });
    return U.round(total / xi.length, 1);
  }

  function lines(g) {
    const xi = xiPlayers(g), shape = FORMATIONS[g.mgr.formation].line;
    const D = global.DATA, out = { GK: [], DEF: [], MID: [], ATT: [] };
    xi.forEach((s, i) => {
      const want = shape[i] || s.pos;
      const grp = want === 'GK' ? 'GK' : (D.POSITIONS[want] || {}).group;
      (out[grp] || out.MID).push(s.ovr);
    });
    const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0;
    return { gk: avg(out.GK), def: avg(out.DEF), mid: avg(out.MID), att: avg(out.ATT) };
  }

  /* ---------------- matchday ---------------- */

  function playRound(g, talk) {
    const U = global.U, State = global.State, Engine = global.Engine;
    const fix = nextFixture(g);
    if (!fix) return null;
    const me = State.club(g.mgr.club), opp = State.club(fix.oppId);
    const style = STYLES[g.mgr.style];
    const t = TALKS.find(x => x.id === talk) || TALKS[0];

    // a fired-up dressing room can also over-run itself
    const talkSwing = t.boost - (t.risk ? U.rnd(0, t.risk) : 0);
    const mine = teamRating(g) + (fix.home ? 2.5 : 0) + style.att * 0.35 + talkSwing;
    const theirs = opp.rating + (fix.home ? 0 : 2.5) - style.def * 0.3;

    // what the era signings in your eleven actually bring
    const tr = traitBonus(g);
    const diff = mine - theirs + tr.att * 0.5 + tr.def * 0.5;
    const la = U.clamp(1.35 + diff * 0.052 + style.att * 0.05 + tr.att * 0.055, 0.2, 4.6);
    const lb = U.clamp(1.35 - diff * 0.052 - style.def * 0.05 - tr.def * 0.06, 0.15, 4.6);
    const gf = U.poisson(la), ga = U.poisson(lb);

    // who scored them
    const xi = xiPlayers(g);
    const scorers = [];
    for (let i = 0; i < gf; i++) {
      const weights = xi.map(s => {
        const grp = s.pos === 'GK' ? 0.001 : (global.DATA.POSITIONS[s.pos] || {}).attack || 0.1;
        return [s, grp * (s.ovr / 70) * traitScoring(s)];
      });
      const who = U.weighted(weights);
      if (who) { who.goals++; scorers.push(who); }
    }
    xi.forEach(s => {
      s.apps++;
      const r = U.clamp(6.4 + (gf - ga) * 0.28 + U.rnd(-0.8, 0.9) + (s.ovr - teamRating(g)) * 0.03, 3.5, 10);
      s.ratingSum += r;
      s.rating = U.round(s.ratingSum / s.apps, 2);
      s.form = U.clamp(s.form * 0.75 + (r - 6.4) * 26 + 14, 5, 100);
      s.fit = U.clamp(s.fit - U.rnd(8, 18) + 10, 25, 100);
    });
    benchPlayers(g).forEach(s => { s.fit = U.clamp(s.fit + U.rnd(6, 14), 25, 100); });

    // the rest of the division plays too
    const league = State.league(me.league);
    const round = g.mgr.rounds[g.mgr.round] || [];
    round.forEach(pair => {
      const [A, B] = pair;
      if (A === g.mgr.club || B === g.mgr.club) {
        Engine.Season.applyTable(g.tables[league.id], fix.home ? g.mgr.club : fix.oppId,
          fix.home ? fix.oppId : g.mgr.club, fix.home ? gf : ga, fix.home ? ga : gf);
        return;
      }
      const ca = State.club(A), cb = State.club(B);
      const d = (ca.rating + 2.5) - cb.rating;
      const x = U.poisson(U.clamp(1.35 + d * 0.05, 0.2, 4.4));
      const y = U.poisson(U.clamp(1.35 - d * 0.05, 0.2, 4.4));
      Engine.Season.applyTable(g.tables[league.id], A, B, x, y);
    });

    const result = gf > ga ? 'W' : gf === ga ? 'D' : 'L';
    const entry = { round: g.mgr.round, oppId: fix.oppId, home: fix.home, gf, ga, result,
                    scorers: scorers.map(s => s.name), talk: t.id };
    g.mgr.results.push(entry);
    g.mgr.round++;

    // The board are watching, but they judge you on the table rather than on
    // the last kick: confidence drifts toward what your position deserves, with
    // a small nudge for the result so a win still feels like something. A bad
    // month costs you; it does not end you.
    const where = position(g);
    const deserved = U.clamp(80 - (where - g.mgr.board.target.pos) * 6.5, 14, 96);
    const kick = result === 'W' ? U.rnd(1.5, 3) : result === 'D' ? U.rnd(-0.5, 0.8) : -U.rnd(1.5, 3);
    g.mgr.board.confidence = U.clamp(
      g.mgr.board.confidence + (deserved - g.mgr.board.confidence) * 0.17 + kick, 0, 100);

    marketTick(g);
    me.form = (me.form || []).concat(result).slice(-5);
    State.news(`${fix.home ? me.name : opp.name} ${fix.home ? gf : ga}-${fix.home ? ga : gf} ${fix.home ? opp.name : me.name}`,
      result === 'W' ? 'good' : result === 'L' ? 'bad' : 'info', null, 'whistle');
    return entry;
  }

  function position(g) {
    const State = global.State;
    const club = State.club(g.mgr.club);
    const table = global.Engine.Season.standings(g, club.league);
    return table.findIndex(r => r.id === club.id) + 1;
  }

  function seasonOver(g) { return g.mgr.round >= (g.mgr.rounds || []).length; }

  /* ---------------- the market ---------------- */

  /* Everyone you could realistically sign: squad players from other clubs in
     the world, priced off what they are worth and who wants them. */
  /* ---------------- the ones you cannot normally have ----------------
     The best footballers alive do not turn up in a random sample of somebody's
     squad — they get their own board, their own prices, and a club that mostly
     tells you where to go. Signing one is meant to be the thing you spend
     three seasons building towards, not a Tuesday. */

  const ELITE = 88;                 // the cut for the top-players board
  const TITLE_FLOOR = 450000000;    // what two league titles are worth to a board

  /* At this level price is not a curve off the rating, it is a different market
     entirely: an 88 costs seventy million and a 95 costs three times that. And
     icons hold their value in a way ordinary players do not — a thirty-eight
     year old who still sells out the stadium is not worth a fifth of himself. */
  function eliteFee(ovr, age) {
    const base = 70000000 * Math.pow(1.176, ovr - ELITE);
    const age3 = age <= 24 ? 1.3 : age <= 28 ? 1.15 : age <= 31 ? 0.95 : age <= 34 ? 0.72 : 0.55;
    return Math.round(base * age3 / 500000) * 500000;
  }

  /* What he earns. Enormous next to the rest of your bill — which is the real
     obstacle, not the fee: you have to clear the wages to fit him in. */
  function eliteWage(ovr) {
    return Math.round(38000 * Math.pow(1.14, ovr - ELITE) / 1000) * 1000;
  }

  function topPlayers(g) {
    const State = global.State, U = global.U;
    // whoever is already in your squad is not for sale to you — the board is
    // rebuilt every summer from the world's stars and has no memory of what
    // you bought last year, so this is what stops him reappearing
    const mine = {};
    (g.squad || []).forEach(s => { mine[s.name] = true; });
    (g.mgr.hungUp || []).forEach(n => { mine[n] = true; });
    const live = list => list.filter(s => !s.signed && !s.gone && !mine[s.name]);
    if (g.mgr.topCache && g.mgr.topSeason === g.world.year) return live(g.mgr.topCache);
    const me = State.club(g.mgr.club);
    const out = [];
    Object.values(g.world.clubs).forEach(c => {
      if (c.id === me.id) return;
      const stars = global.Eras.starsFor(g, c.name);
      if (!stars) return;
      stars.forEach(st => {
        const [name, nation, pos, ovr, age] = st;
        if (ovr < ELITE) return;
        const s = {
          id: U.id(), name, nation, pos, ovr, age,
          shirt: 0, goals: 0, assists: 0, apps: 0, rel: 50, star: true, elite: true,
          fromClub: c.name, fromId: c.id
        };
        s.value = eliteFee(ovr, age);
        // they are not for sale, so the number is what it would take
        s.ask = Math.round(s.value * U.rnd(1.15, 1.55) / 500000) * 500000;
        s.wage = Math.max(wageFor(s), eliteWage(ovr));
        out.push(s);
      });
    });
    out.sort((a, b) => b.ovr - a.ovr || b.ask - a.ask);
    g.mgr.topCache = out;
    g.mgr.topSeason = g.world.year;
    return live(out);
  }

  /* One listing from a club's squad, priced. */
  function listFrom(g, c) {
    const U = global.U;
    const s = U.pick(global.Engine.Squad.generate(c));
    s.value = valueFor(s);
    s.wage = wageFor(s);
    s.fromClub = c.name;
    s.fromId = c.id;
    s.ask = Math.round(s.value * U.rnd(1.05, 1.7) / 50000) * 50000;
    // nobody wants to sell the best player they have, and they price him like
    // it — you pay a premium for taking somebody's talisman
    if (s.ovr >= c.rating + 4) {
      s.keyman = true;
      s.ask = Math.round(s.ask * 1.55 / 50000) * 50000;
    }
    return s;
  }

  /* The market is not a catalogue you come back to at your leisure. Every
     round somebody you were thinking about goes somewhere else, somebody new
     becomes available, and the asking prices move. Dither and you lose him. */
  function marketTick(g) {
    const U = global.U, State = global.State;
    if (!g.mgr.marketCache) return;
    const me = State.club(g.mgr.club);
    const others = Object.values(g.world.clubs).filter(c => c.id !== me.id);
    const live = g.mgr.marketCache.filter(s => !s.signed && !s.gone);
    g.mgr.marketNews = g.mgr.marketNews || [];

    // The board of names stays about the size it started at: if it has grown,
    // rivals move quicker and fewer new men appear, and the other way round.
    const target = g.mgr.marketSize || live.length;
    const pressure = U.clamp(live.length / Math.max(target, 1), 0.55, 1.7);

    // rivals do their business too — the better he is, the likelier he goes
    U.shuffle(live).slice(0, U.int(2, 5)).forEach(s => {
      const pull = U.clamp((0.09 + (s.ovr - 72) * 0.014) * pressure, 0.03, 0.5);
      if (!U.chance(pull)) return;
      const buyer = U.pick(others.filter(c => c.id !== s.fromId && c.rating >= s.ovr - 9)) || U.pick(others);
      s.gone = true;
      g.mgr.marketNews.unshift({ t: `${s.name} (${s.ovr}) has gone to ${buyer.name}`, k: 'gone' });
      State.news(s.free ? `${buyer.name} sign free agent ${s.name}`
        : `${buyer.name} sign ${s.name} from ${s.fromClub}`, 'info', null, 'transfer');
    });

    // and new names come onto it
    const fresh = live.length > target ? U.int(0, 1) : U.int(1, 2);
    for (let i = 0; i < fresh; i++) {
      const c = U.pick(others);
      const s = listFrom(g, c);
      if (g.mgr.marketCache.some(x => x.name === s.name)) continue;
      g.mgr.marketCache.push(s);
      if (s.ovr >= me.rating)
        g.mgr.marketNews.unshift({ t: `${s.name} (${s.pos} ${s.ovr}) available at ${s.fromClub}`, k: 'new' });
    }

    // prices drift — a good run makes a club dearer, a bad one makes them listen
    live.forEach(s => {
      if (s.free || s.gone) return;
      s.ask = Math.max(50000, Math.round(s.ask * U.rnd(0.96, 1.05) / 50000) * 50000);
    });
    g.mgr.marketNews = g.mgr.marketNews.slice(0, 8);
  }

  function market(g, filter) {
    const State = global.State, U = global.U;
    if (!g.mgr.marketCache || g.mgr.marketSeason !== g.world.year) {
      const me = State.club(g.mgr.club);
      const pool = [];
      const clubs = Object.values(g.world.clubs).filter(c => c.id !== me.id);
      g.mgr.marketNews = [];
      U.shuffle(clubs).slice(0, 26).forEach(c => {
        // whoever they happen to be willing to listen on, not simply their best
        U.shuffle(global.Engine.Squad.generate(c)).slice(0, U.int(2, 4)).forEach(s => {
          s.value = valueFor(s);
          s.wage = wageFor(s);
          s.fromClub = c.name;
          s.fromId = c.id;
          s.ask = Math.round(s.value * U.rnd(1.05, 1.7) / 50000) * 50000;
          if (s.ovr >= c.rating + 4) {
            s.keyman = true;
            s.ask = Math.round(s.ask * 1.55 / 50000) * 50000;
          }
          pool.push(s);
        });
      });
      // a handful of free agents, cheap and usually old. Built from scratch
      // rather than lifted out of a squad, so nobody real turns up unemployed
      // at an age they have never been.
      const shapes = Object.keys(global.DATA.POSITIONS);
      for (let i = 0; i < 6; i++) {
        const who = global.Names.person(me.country);
        const s = {
          id: U.id(), name: who.name, nation: who.nation,
          pos: U.pick(shapes), age: U.int(30, 36),
          ovr: U.clamp(Math.round(me.rating + U.gauss(-2, 5)), 55, 86),
          shirt: 0, goals: 0, assists: 0, apps: 0, rel: 50
        };
        s.value = valueFor(s); s.wage = wageFor(s);
        s.fromClub = 'Free agent'; s.fromId = null; s.ask = 0; s.free = true;
        pool.push(s);
      }
      g.mgr.marketCache = pool;
      g.mgr.marketSize = pool.length;
      g.mgr.marketSeason = g.world.year;
    }
    // the genuinely elite have their own board; they do not also appear here,
    // and neither does anybody already on your own books
    const mine = {};
    (g.squad || []).forEach(x => { mine[x.name] = true; });
    (g.mgr.hungUp || []).forEach(n => { mine[n] = true; });
    let list = g.mgr.marketCache.filter(s =>
      !s.signed && !s.gone && !mine[s.name] && !(s.star && s.ovr >= ELITE));
    if (filter && filter.pos) list = list.filter(s => s.pos === filter.pos);
    if (filter && filter.max) list = list.filter(s => s.ask <= filter.max);
    if (filter && filter.afford) {
      const room = g.mgr.wageBudget - squadWages(g);
      list = list.filter(s => s.ask <= g.mgr.budget && s.wage <= room);
    }
    return list.sort((a, b) => b.ovr - a.ovr);
  }

  /* Offer a fee. Selling clubs say no to lowballs and yes to silly money. */
  function bid(g, player, fee) {
    const U = global.U, State = global.State;
    if (fee > g.mgr.budget) return { ok: false, why: 'You do not have that kind of money.' };
    const wageRoom = g.mgr.wageBudget - squadWages(g);
    if (player.wage > wageRoom) return { ok: false, why: `You cannot fit ${U.cash(player.wage)}/week into the wage bill.` };

    const ratio = player.free ? 2 : fee / Math.max(player.ask, 1);
    let chance = player.free ? 0.9 : U.clamp((ratio - 0.72) * 1.9, 0.02, 0.96);
    if (player.elite) {
      // the badge has to mean something to him, and money alone will not do it
      const pull = U.clamp(0.32 + (State.club(g.mgr.club).rating - 76) * 0.045
        + (g.mgr.board.confidence - 50) * 0.002 + (g.mgr.trophies || []).length * 0.05, 0.06, 0.9);
      chance = U.clamp(chance * pull, 0.01, 0.72);
    }
    if (!U.chance(chance)) {
      if (player.elite) {
        return { ok: false, why: ratio < 0.95
          ? `${player.fromClub} did not even take the call. He is not for sale at that.`
          : `${player.name} has turned you down. He is not leaving ${player.fromClub} for this.` };
      }
      return { ok: false, why: ratio < 0.85
        ? `${player.fromClub} laughed at it. Nowhere near.`
        : `${player.fromClub} have said no. Close, but no.` };
    }
    g.mgr.budget -= fee;
    player.signed = true;
    const joined = Object.assign({}, player, { apps: 0, goals: 0, assists: 0, ratingSum: 0,
      rating: 0, form: U.int(50, 70), fit: 92, shirt: freeShirt(g),
      joined: g.world.year });
    if (global.Timeline) {
      const line = global.Timeline.for(joined);
      const now = line[line.length - 1];
      if (now && now.trait) joined.trait = now.trait;
    }
    delete joined.fromClub; delete joined.fromId; delete joined.ask; delete joined.free;
    g.squad.push(joined);
    State.news(player.elite
      ? `${State.club(g.mgr.club).name} have signed ${player.name}. ${U.cash(fee)}. Nobody saw it coming.`
      : `${State.club(g.mgr.club).name} sign ${player.name} for ${U.cash(fee)}`, 'good', null, 'transfer');
    g.mgr.log.unshift({ t: `Signed ${player.name} (${player.pos} ${player.ovr}) for ${U.cash(fee)}`, k: 'in' });
    g.mgr.board.confidence = U.clamp(g.mgr.board.confidence + (player.ovr > teamRating(g) ? 3 : 0.5), 0, 100);
    return { ok: true, player: joined };
  }

  function freeShirt(g) {
    const taken = {};
    g.squad.forEach(s => taken[s.shirt] = true);
    for (let n = 2; n < 60; n++) if (!taken[n]) return n;
    return 60;
  }

  /* Sell one of yours. Offers come in a little under value. */
  function sell(g, id) {
    const U = global.U, State = global.State;
    const idx = g.squad.findIndex(s => s.id === id);
    if (idx < 0) return null;
    const s = g.squad[idx];
    if (g.squad.length <= 14) return { ok: false, why: 'You cannot go below fourteen players.' };
    const fee = Math.round(s.value * U.rnd(0.75, 1.15) / 50000) * 50000;
    g.squad.splice(idx, 1);
    g.mgr.budget += fee;
    g.mgr.xi = (g.mgr.xi || []).filter(x => x !== id);
    if (g.mgr.xi.length < 11) g.mgr.xi = autoPick(g).map(x => x.id);
    State.news(`${s.name} leaves ${State.club(g.mgr.club).name} for ${U.cash(fee)}`, 'info', null, 'transfer');
    g.mgr.log.unshift({ t: `Sold ${s.name} (${s.pos} ${s.ovr}) for ${U.cash(fee)}`, k: 'out' });
    return { ok: true, fee };
  }

  function squadWages(g) {
    return g.squad.reduce((a, s) => a + (s.wage || 0), 0);
  }

  /* ---------------- bringing a version of him back ----------------
     You own the man as he is today. Paying for an era swaps him for the
     version of himself that played it — the rating and the age of that year.
     It costs the difference between what he is and what he was, and once you
     have paid for a version you can switch back to it for nothing. */

  /* His last era is him as he is today: always his, never charged for. */
  function eraOwned(s, era) {
    return !!era.now || (s.erasOwned || []).indexOf(era.year) >= 0;
  }

  function eraActive(s, era) {
    return s.era ? s.era.year === era.year : !!era.now;
  }

  /* What it costs to bring that version in. Nothing for one you already have. */
  function eraPrice(s, era) {
    const U = global.U;
    if (eraOwned(s, era)) return 0;
    const nowFee = eliteFee(Math.max(s.baseOvr || s.ovr, 55), s.baseAge || s.age);
    const thenFee = eliteFee(Math.max(era.ovr, 55), era.age);
    const gap = thenFee - nowFee;
    if (gap <= 0) return 0;                     // a lesser version is free to try
    return Math.max(1000000, Math.round(gap / 500000) * 500000);
  }

  function eraWage(s, era) {
    const probe = { ovr: era.ovr, age: era.age };
    return Math.max(wageFor(probe), era.ovr >= ELITE ? eliteWage(era.ovr) : 0);
  }

  /* Swap him for that version. Returns why not, if not. */
  function buyEra(g, id, era) {
    const U = global.U, State = global.State;
    const s = g.squad.find(x => x.id === id);
    if (!s) return { ok: false, why: 'He is not yours.' };

    if (eraActive(s, era)) return { ok: false, why: 'He is already this version.' };
    // going back to himself costs nothing and needs no room
    if (era.now) return Object.assign({ price: 0 }, restoreEra(g, id));
    // remember who he actually is, the first time we change him
    if (s.baseOvr == null) { s.baseOvr = s.ovr; s.baseAge = s.age; }

    const price = eraPrice(s, era);
    const wage = eraWage(s, era);
    const room = g.mgr.wageBudget - squadWages(g) + (s.wage || 0);
    if (price > g.mgr.budget) return { ok: false, why: 'You cannot afford that version of him.' };
    if (wage > room) return { ok: false, why: `He would want ${U.cash(wage)}/week. Sell someone first.` };

    g.mgr.budget -= price;
    s.erasOwned = (s.erasOwned || []);
    if (s.erasOwned.indexOf(era.year) < 0 && price > 0) s.erasOwned.push(era.year);
    s.era = { year: era.year, label: era.label, club: era.club,
              ovr: era.ovr, age: era.age, trait: era.trait || null };
    s.ovr = era.ovr;
    // Paying for a version buys the years back with it. Switching to one you
    // already own gives you the rating only — otherwise you could flip between
    // two owned eras forever and never grow old.
    s.age = price > 0 ? era.age : Math.max(s.age, era.age);
    s.wage = wage;
    s.value = era.ovr >= ELITE ? eliteFee(era.ovr, era.age) : valueFor(s);
    if (price > 0) {
      State.news(`${State.club(g.mgr.club).name} unveil the ${era.year} ${s.name}`, 'good', null, 'star');
      g.mgr.log.unshift({ t: `Brought back the ${era.year} ${s.name} (${era.ovr}) for ${U.cash(price)}`, k: 'in' });
    }
    return { ok: true, price, wage };
  }

  /* Back to the man you actually signed, free, whenever you like. */
  function restoreEra(g, id) {
    const s = g.squad.find(x => x.id === id);
    if (!s) return { ok: false, why: 'He is not yours.' };
    if (s.baseOvr == null) { s.era = null; return { ok: true }; }
    s.ovr = s.baseOvr;
    s.age = Math.max(s.age, s.baseAge);   // the years he has actually lived
    s.era = null;
    s.wage = Math.max(wageFor(s), s.ovr >= ELITE ? eliteWage(s.ovr) : 0);
    s.value = s.ovr >= ELITE ? eliteFee(s.ovr, s.age) : valueFor(s);
    return { ok: true };
  }

  /* ---------------- the board ---------------- */

  function seasonReview(g) {
    const U = global.U, State = global.State;
    const club = State.club(g.mgr.club);
    const pos = position(g);
    const target = g.mgr.board.target;
    const met = pos <= target.pos;
    const table = global.Engine.Season.standings(g, club.league);
    const champion = pos === 1;

    let verdict, swing;
    if (champion) { verdict = 'Champions. Whatever you want, ask for it.'; swing = 30; }
    else if (met) { verdict = 'Target met. The board are pleased.'; swing = 14; }
    else if (pos <= target.pos + 2) { verdict = 'Short of the target, but not by much.'; swing = -8; }
    else { verdict = 'Nowhere near what was asked of you.'; swing = -26; }

    g.mgr.board.confidence = U.clamp(g.mgr.board.confidence + swing, 0, 100);
    g.mgr.board.seasons++;
    g.mgr.board.finishes = (g.mgr.board.finishes || []).concat(pos);
    // a club that keeps finishing above itself becomes a bigger club: better
    // players start answering the phone, and the board start expecting more
    const over = target.pos - pos;
    club.drift = U.clamp((club.drift || 0) + U.clamp(over * 0.45, -2, 2), -6, 8);
    if (champion) g.mgr.trophies.push({ name: State.league(club.league).name + ' Title', year: g.world.year + 1 });

    // Nobody is sacked after one year unless it was a disaster and the board
    // have stopped defending you. After that, the confidence is the job — and
    // going down in the bottom two ends it well before it reaches zero.
    const relegated = pos >= table.length - 1;
    const conf = g.mgr.board.confidence;
    const sacked = g.mgr.board.seasons <= 1
      ? relegated && conf < 45
      : conf <= 12 || (relegated && conf < 60);
    if (sacked) g.mgr.sacked = true;
    const warned = !sacked && (conf <= 22 || relegated);
    if (warned) verdict += ' You keep the job. You will not get another year like it.';

    // next year's money follows where you finished
    const reward = champion ? 1.6 : met ? 1.25 : pos <= target.pos + 2 ? 0.95 : 0.7;
    g.mgr.budget = Math.round(g.mgr.budget * 0.4 + Math.pow(Math.max(club.rating - 50, 3), 2.6) * 9000 * reward);
    g.mgr.budget = Math.round(g.mgr.budget / 500000) * 500000;
    // wages follow the same money, but never below what you are already paying
    g.mgr.wageBudget = Math.max(
      Math.round(Math.pow(Math.max(club.rating - 45, 4), 2.2) * 62 * reward / 1000) * 1000,
      Math.round(squadWages(g) * 1.15 / 1000) * 1000);

    /* Winning changes what they will spend on you. One title and the board
       open the safe; two and the money is there to buy anybody, whoever you
       are managing and whatever the club was worth when you walked in. The
       wage ceiling has to move with it or the budget is a number you cannot
       spend — a superstar's problem is always the weekly, not the fee. */
    const titles = (g.mgr.trophies || []).length;
    let backed = false;
    if (titles >= 1) {
      const floor = titles >= 2 ? TITLE_FLOOR + (titles - 2) * 75000000 : 200000000;
      backed = floor > g.mgr.budget;
      g.mgr.budget = Math.max(g.mgr.budget, floor);
      const wageFloor = titles >= 2 ? 1.55 : 1.3;
      g.mgr.wageBudget = Math.max(g.mgr.wageBudget,
        Math.round(squadWages(g) * wageFloor / 1000) * 1000);
      if (backed && champion) {
        verdict += titles === 1 ? ` The safe is open: ${U.cash(g.mgr.budget)} to spend.`
          : titles === 2 ? ` Two titles. They will fund anybody you want — ${U.cash(g.mgr.budget)} and the wages to match.`
          : ` ${titles} titles now. Ask for whoever you like — ${U.cash(g.mgr.budget)} and the wages to match.`;
      } else if (backed) {
        verdict += ` What you have already won still counts — ${U.cash(g.mgr.budget)} to spend.`;
      }
    }

    return { pos, met, champion, verdict, sacked, warned, table, titles,
             confidence: Math.round(g.mgr.board.confidence) };
  }

  function nextSeason(g) {
    const U = global.U, State = global.State;
    g.world.year++;
    g.squad.forEach(s => {
      s.age++;
      const peak = s.age <= 24 ? U.int(1, 3) : s.age <= 29 ? U.int(0, 1) : s.age <= 32 ? -U.int(0, 2) : -U.int(1, 4);
      // 99, not 96: an era signing can be a 98 and must not be filed down to
      // the ceiling of an ordinary squad player the first time a year turns
      s.ovr = U.clamp(s.ovr + peak, 45, 99);
      s.value = s.ovr >= ELITE ? eliteFee(s.ovr, s.age) : valueFor(s);
      s.wage = Math.max(wageFor(s), s.ovr >= ELITE ? eliteWage(s.ovr) : 0);
      s.fit = 100;
    });

    /* Retirement used to be a silent age filter, which deleted the
       forty-one-year-old you had just paid nine figures for and put him
       straight back on the market to be bought again. Now it depends on
       whether he is still any good, and it is announced either way. */
    const retiring = g.squad.filter(s => {
      if (s.age < 36) return false;
      // nobody you have just signed hangs up his boots before he has played a
      // season for you — paying nine figures for a thirty-eight-year-old and
      // losing him at the first rollover is not a twist, it reads as a bug
      if (s.joined != null && g.world.year - s.joined < 2) return false;
      if (s.age >= 46) return true;
      // how good he still is matters more than the number of birthdays: an
      // ordinary thirty-six-year-old goes, a world-class one plays on for years
      const stay = U.clamp(0.25 + (s.ovr - 74) * 0.045 - (s.age - 36) * 0.022, 0.03, 0.95);
      return !U.chance(stay);
    });
    g.mgr.hungUp = g.mgr.hungUp || [];
    retiring.forEach(s => {
      State.news(`${s.name} retires at ${s.age}`, 'info', null, 'legacy');
      g.mgr.log.unshift({ t: `${s.name} (${s.pos} ${s.ovr}) retired, aged ${s.age}`, k: 'out' });
      // he has hung up his boots — he does not turn up for sale again next summer
      if (g.mgr.hungUp.indexOf(s.name) < 0) g.mgr.hungUp.push(s.name);
    });
    if (retiring.length) {
      const ids = retiring.map(s => s.id);
      g.squad = g.squad.filter(s => ids.indexOf(s.id) < 0);
      g.mgr.retired = retiring.map(s => ({ name: s.name, age: s.age, ovr: s.ovr }));
    } else g.mgr.retired = [];

    /* Somebody has to replace them. Without this the squad quietly shrank a
       man a year until you could not field a bench. */
    if (g.squad.length < 20) {
      const club = State.club(g.mgr.club);
      const need = 20 - g.squad.length;
      const seen = {};
      g.squad.forEach(s => { seen[s.name] = true; });
      const shape = g.squad.map(s => s.pos);
      const pool = squadFor(club, 22).filter(s => !seen[s.name]);
      const young = [];
      pool.forEach(s => {
        if (young.length >= need) return;
        if (seen[s.name]) return;
        s.age = U.int(17, 21);
        s.ovr = U.clamp(Math.round(club.rating - U.int(6, 14)), 45, 88);
        s.value = valueFor(s); s.wage = wageFor(s);
        s.apps = 0; s.goals = 0; s.assists = 0; s.ratingSum = 0; s.fit = 100;
        s.shirt = freeShirt(g);
        s.academy = true;
        s.joined = g.world.year;
        seen[s.name] = true;
        g.squad.push(s);
        young.push(s);
      });
      if (young.length) {
        State.news(`${young.length} from the ${club.name} academy step up to the first team`,
          'info', null, 'academy');
        g.mgr.log.unshift({ t: `${young.length} promoted from the academy`, k: 'in' });
      }
    }
    Object.values(g.world.clubs).forEach(c => {
      c.rating = U.clamp(Math.round(c.baseRating + (c.drift || 0) + U.gauss(0, 2)), 55, 93);
      c.form = [];
    });
    const club = State.club(g.mgr.club);
    // A board remembers. Beat what they asked for and that finish is the new
    // floor — nobody gets to keep being praised for the same season twice.
    const base = boardTarget(club, State.league(club.league));
    const fin = (g.mgr.board.finishes || []).slice(-2);
    let want = base.pos;
    if (fin.length) {
      const avg = Math.round(fin.reduce((a, b) => a + b, 0) / fin.length);
      want = U.clamp(Math.min(base.pos, avg + (fin.length > 1 ? 0 : 1)), 1, base.pos);
    }
    g.mgr.board.target = want === base.pos ? base : {
      pos: want,
      text: want === 1 ? 'You have made them believe they can win it. So win it.'
        : `You raised the bar yourself. Finish in the top ${want}.`
    };
    g.mgr.marketCache = null;
    g.mgr.xi = autoPick(g).map(s => s.id);
    buildSeason(g);
  }

  global.Manager = {
    FORMATIONS, STYLES, TALKS, SLOTS,
    slots(f) { return SLOTS[f] || SLOTS['4-3-3']; },
    start, buildSeason, nextFixture, xiPlayers, benchPlayers, autoPick,
    teamRating, lines, playRound, position, seasonOver,
    market, marketTick, topPlayers, ELITE, TITLE_FLOOR, bid, sell, squadWages, valueFor, wageFor,
    traitOf, traitBonus, TRAIT_GOALS,
    eraPrice, eraWage, eraOwned, eraActive, buyEra, restoreEra,
    seasonReview, nextSeason, squadFor
  };
})(window);

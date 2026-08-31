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
    entry.moments = matchMoments(g, entry, xi, scorers);
    g.mgr.results.push(entry);
    // the week's talking points, newest first
    g.mgr.news = (entry.moments.map(m => Object.assign({
      round: g.mgr.round + 1, year: g.world.year, opp: State.club(fix.oppId).name,
      score: (fix.home ? gf : ga) + '-' + (fix.home ? ga : gf), result
    }, m))).concat(g.mgr.news || []).slice(0, 60);
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

  /* ---------------- what actually happened out there ----------------
     A scoreline tells you nothing. These are the bits people talk about on the
     way home: the one from thirty yards, the header at the back post, the
     sending off, the penalty he put over the bar. Drawn from what really
     happened in the match — who scored, how many, what the keeper had to do —
     then coloured by the trait the man carries. Most matches give you one or
     two. Some give you nothing, which is also true of football. */

  const GOAL_WAYS = [
    { t: 'from fully thirty yards, and the net is still shaking', w: 6, trait: 'Power Shot' },
    { t: 'with a knuckleball from distance that moved twice in the air', w: 4, trait: 'Knuckleball Power Shot' },
    { t: 'from outside the box with the outside of his boot', w: 4, trait: 'Power Shot' },
    { t: 'with a shot so hard the keeper only heard it', w: 3, trait: 'Power Shot' },
    { t: 'from thirty-five yards after spotting the keeper off his line', w: 3, trait: 'Power Shot' },
    { t: 'with a half-volley from the edge of the D', w: 5, trait: 'Power Shot' },
    { t: 'off the underside of the bar from twenty-five yards', w: 4, trait: 'Power Shot' },
    { t: 'with a dipping effort that beat the keeper\'s fingertips', w: 4, trait: 'Knuckleball Power Shot' },
    { t: 'from distance, and nobody in the ground thought he would shoot', w: 4 },
    { t: 'after beating three men on the way into the box', w: 6, trait: 'Dribbler Expert' },
    { t: 'having carried it sixty yards from his own half', w: 4, trait: 'Dribbler Expert' },
    { t: 'after nutmegging the last defender on the way through', w: 3, trait: 'Dribbler Expert' },
    { t: 'off a drop of the shoulder that sent two of them the wrong way', w: 4, trait: 'Dribbler Expert' },
    { t: 'after riding a tackle that should have ended it', w: 4, trait: 'Dribbler Expert' },
    { t: 'having gone past the same full-back twice in one move', w: 3, trait: 'Dribbler Expert' },
    { t: 'with a free kick up and over the wall', w: 5, trait: 'Set-Piece Specialist' },
    { t: 'from a free kick that went under the wall as they jumped', w: 3, trait: 'Set-Piece Specialist' },
    { t: 'with a corner that nobody got a touch on', w: 2, trait: 'Set-Piece Specialist' },
    { t: 'from twenty yards with a free kick into the top corner', w: 4, trait: 'Set-Piece Specialist' },
    { t: 'off a short corner routine they must have worked on all week', w: 3, trait: 'Set-Piece Specialist' },
    { t: 'with a header at the back post nobody went with him for', w: 6, trait: 'Aerial Threat' },
    { t: 'with a header he hung in the air for', w: 4, trait: 'Aerial Threat' },
    { t: 'with a downward header from six yards', w: 4, trait: 'Aerial Threat' },
    { t: 'with a glancing header at the near post', w: 4, trait: 'Aerial Threat' },
    { t: 'with a header from a corner, entirely unmarked', w: 4, trait: 'Aerial Threat' },
    { t: 'racing clear of the last man and finishing calmly', w: 6, trait: 'Blistering Pace' },
    { t: 'after outrunning two of them from the halfway line', w: 4, trait: 'Blistering Pace' },
    { t: 'on the counter, three seconds from their corner to his', w: 4, trait: 'Blistering Pace' },
    { t: 'beating the offside trap by half a yard', w: 4, trait: 'Blistering Pace' },
    { t: 'arriving late in the box the way he always does', w: 5, trait: 'Late Runs' },
    { t: 'ghosting in at the back post while they watched the ball', w: 4, trait: 'Late Runs' },
    { t: 'timing his run so well the linesman had to think about it', w: 3, trait: 'Late Runs' },
    { t: 'from two yards, because that is where he lives', w: 5, trait: 'Poacher' },
    { t: 'with a tap-in after the keeper spilled it', w: 4, trait: 'Poacher' },
    { t: 'by being first to a rebound nobody else read', w: 4, trait: 'Poacher' },
    { t: 'off his shin, and he will take it', w: 3, trait: 'Poacher' },
    { t: 'with a toe-poke from close range', w: 3, trait: 'Poacher' },
    { t: 'after a one-two on the edge of the box', w: 5, trait: 'Playmaker' },
    { t: 'finishing a move that went through eleven passes', w: 3, trait: 'Playmaker' },
    { t: 'after a through ball that split them in two', w: 4, trait: 'Playmaker' },
    { t: 'with a backheel he had no right to try', w: 2, trait: 'Flair' },
    { t: 'with an overhead kick that will be on every highlight reel', w: 1, trait: 'Flair' },
    { t: 'with a rabona from the byline, of all things', w: 1, trait: 'Flair' },
    { t: 'with a chip he barely looked up for', w: 3, trait: 'Flair' },
    { t: 'with the sort of finish that makes it look easy', w: 5, trait: 'Finisher' },
    { t: 'into the far corner without breaking stride', w: 5, trait: 'Finisher' },
    { t: 'first time, across the keeper, from twelve yards', w: 4, trait: 'Finisher' },
    { t: 'with a first-time volley on the turn', w: 5 },
    { t: 'with a chip over the keeper from the edge of the area', w: 4 },
    { t: 'off the underside of the bar from a tight angle', w: 4 },
    { t: 'from the penalty spot, straight down the middle', w: 4 },
    { t: 'from the spot, sending the keeper the wrong way', w: 4 },
    { t: 'through the keeper\'s legs from twelve yards', w: 3 },
    { t: 'off a deflection he will claim for the rest of his life', w: 3 },
    { t: 'on the break, three passes from their corner flag to his', w: 4 },
    { t: 'after the keeper came for a cross and got nowhere near it', w: 3 },
    { t: 'with his weaker foot, which surprised everyone including him', w: 3 },
    { t: 'from an impossible angle by the byline', w: 3 },
    { t: 'after the ball broke to him off a defender\'s knee', w: 3 },
    { t: 'with a shot that went in off the post', w: 4 },
    { t: 'in the ninety-fourth minute, from the last attack of the game', w: 3 },
    { t: 'straight from the kick-off, inside forty seconds', w: 2 },
    { t: 'with a low drive the keeper should probably have kept out', w: 3 },
    { t: 'after a scramble nobody could describe afterwards', w: 3 },
    { t: 'from a rebound off the crossbar', w: 3 },
    { t: 'with a lob from thirty yards as the keeper backpedalled', w: 2 },
    { t: 'after being put clean through by a pass off the goalkeeper', w: 2 },
    { t: 'with a finish so calm it looked like a training drill', w: 4 },
    { t: 'having missed two easier ones in the first half', w: 3 },
    { t: 'with a shot that took a wicked bounce in front of the keeper', w: 3 },
    { t: 'off the crossbar and down over the line, eventually given', w: 2 }
  ];

  const ODD_MOMENTS = [
    { t: '{p} made a save in the last minute that won the point', w: 4, who: 'keeper', when: e => e.result === 'D' },
    { t: '{p} made a save at the end to keep it to one', w: 3, who: 'keeper', when: e => e.result === 'L' && e.ga <= 2 },
    { t: '{p} kept them out on his own for an hour', w: 4, who: 'keeper', when: e => e.ga === 0 },
    { t: '{p} had almost nothing to do and still looked the part', w: 2, who: 'keeper', when: e => e.ga === 0 && e.gf >= 3 },
    { t: '{p} saved a penalty and made sure everybody knew about it', w: 3, who: 'keeper' },
    { t: '{p} came for a cross he was never getting to', w: 3, who: 'keeper', when: e => e.ga > 0 },
    { t: '{p} tipped one onto the bar in the first minute', w: 3, who: 'keeper' },
    { t: '{p} made three saves in the same passage of play', w: 3, who: 'keeper' },
    { t: '{p} will not want to see the second goal again', w: 3, who: 'keeper', when: e => e.ga >= 2 },
    { t: '{p} played it out from the back like a midfielder all afternoon', w: 3, who: 'keeper' },
    { t: '{p} was beaten at his near post and knew it straight away', w: 2, who: 'keeper', when: e => e.ga > 0 },
    { t: '{p} kept a clean sheet and barely got his shorts dirty', w: 2, who: 'keeper', when: e => e.ga === 0 },
    { t: '{p} punched clear when he should have caught it, twice', w: 2, who: 'keeper' },
    { t: '{p} went up for a corner at the end. It nearly worked', w: 2, who: 'keeper', when: e => e.result === 'L' },
    { t: '{p} was booked for taking his shirt off. Worth it, he said', w: 2, who: 'scorer' },
    { t: '{p} got the standing ovation when he came off', w: 3, who: 'scorer' },
    { t: '{p} pointed at the away end and said nothing', w: 2, who: 'scorer' },
    { t: '{p} refused to celebrate against his old club', w: 2, who: 'scorer' },
    { t: '{p} took the ball off the designated penalty taker and scored anyway', w: 2, who: 'scorer' },
    { t: '{p} has now scored in five straight games', w: 3, who: 'scorer' },
    { t: '{p} celebrated in front of the wrong supporters and got a booking', w: 2, who: 'scorer' },
    { t: '{p} scored and immediately asked for the ball back', w: 2, who: 'scorer', when: e => e.result === 'L' },
    { t: '{p} has more goals than anyone else in the division', w: 2, who: 'scorer' },
    { t: '{p} was carried off the pitch by his own team-mates', w: 2, who: 'scorer', when: e => e.result === 'W' },
    { t: '{p} hit the bar twice and still has not scored this month', w: 3, who: 'blank' },
    { t: '{p} put a penalty over the bar and could not look up', w: 3, who: 'blank' },
    { t: '{p} played the pass of the season and nobody gambled on it', w: 3, who: 'blank' },
    { t: '{p} missed one from four yards with the goal empty', w: 3, who: 'blank' },
    { t: '{p} hit the post twice in the same half', w: 3, who: 'blank' },
    { t: '{p} had two cleared off the line and could not believe it', w: 3, who: 'blank' },
    { t: '{p} was denied by three separate saves', w: 3, who: 'blank' },
    { t: '{p} has gone nine games without a goal and it is starting to show', w: 3, who: 'blank' },
    { t: '{p} had one ruled out for offside by the length of a boot', w: 3, who: 'blank' },
    { t: '{p} made four assists\' worth of chances and got none of them', w: 2, who: 'blank' },
    { t: '{p} was hauled off after an hour and did not applaud anyone', w: 2, who: 'blank' },
    { t: '{p} skied one so badly it came back with frost on it', w: 2, who: 'blank' },
    { t: '{p} came off the bench and changed it inside ninety seconds', w: 3, who: 'bench', when: e => e.result !== 'L' },
    { t: '{p} warmed up for forty minutes and never got on', w: 3, who: 'bench' },
    { t: '{p} came on for the last ten and looked lively', w: 3, who: 'bench' },
    { t: '{p} was the only substitute not used, again', w: 2, who: 'bench' },
    { t: '{p} came on and was booked within a minute', w: 2, who: 'bench' },
    { t: '{p} went off holding his hamstring. It does not look good', w: 3 },
    { t: '{p} was sent off for a second yellow with twenty minutes left', w: 2 },
    { t: '{p} cleared one off the line with the keeper beaten', w: 4 },
    { t: '{p} argued with the referee for so long the crowd started singing about it', w: 2 },
    { t: '{p} gave the ball away for their goal and did not hide afterwards', w: 3, when: e => e.ga > 0 },
    { t: '{p} won every header he went for', w: 3 },
    { t: '{p} ran further than anyone on the pitch', w: 3 },
    { t: '{p} limped through the last twenty minutes with everything used up', w: 2 },
    { t: '{p} played the full ninety with a bandage round his head', w: 2 },
    { t: '{p} made a tackle in his own box that was worth a goal', w: 4 },
    { t: '{p} completed every pass he attempted', w: 3 },
    { t: '{p} was booked inside two minutes and had to be careful all game', w: 3 },
    { t: '{p} blocked three shots with his body in one minute', w: 3 },
    { t: '{p} shouted at his own goalkeeper for ten minutes straight', w: 2 },
    { t: '{p} played out of position and was the best man on the pitch', w: 3 },
    { t: '{p} gave away a penalty and got away with it', w: 2 },
    { t: '{p} was caught offside six times', w: 2 },
    { t: '{p} lost his boot and carried on for a full minute without it', w: 2 },
    { t: '{p} took a knock early and played through it', w: 3 },
    { t: '{p} won the ball back inside their half nine times', w: 3 },
    { t: '{p} kicked the advertising hoarding and hurt himself doing it', w: 2 },
    { t: '{p} put in a cross so good it deserved better', w: 3 },
    { t: '{p} chased a lost cause into the corner and won a throw. The crowd loved it', w: 3 },
    { t: '{p} spent the whole game marking their best player out of it', w: 3 },
    { t: '{p} was substituted at half time and nobody explained why', w: 2 },
    { t: '{p} slipped at the worst possible moment', w: 2 },
    { t: '{p} needed six stitches and wanted to come back on', w: 2 },
    { t: '{p} refused to come off when the board went up', w: 2 },
    { t: '{p} left the pitch to a standing ovation from both ends', w: 2, when: e => e.result === 'W' },
    { t: '{p} had a shocker and will know it before anyone tells him', w: 3, when: e => e.result === 'L' },
    { t: '{p} was the only one who came out of it with any credit', w: 3, when: e => e.result === 'L' },
    { t: '{p} played every minute of every game this season so far', w: 2 },
    { t: '{p} got the captain\'s armband for the first time', w: 2 },
    { t: '{p} celebrated the final whistle like it was a cup final', w: 2, when: e => e.result === 'W' },
    { t: '{p} threw his shirt into the away end afterwards', w: 2 },
    { t: '{p} stayed out on the pitch long after everyone else had gone in', w: 2, when: e => e.result === 'L' },
    { t: '{p} nutmegged the same defender three times and got booked for the fourth attempt', w: 2 },
    { t: '{p} had a goal disallowed for a foul nobody saw', w: 3 },
    { t: '{p} hit the corner flag from twelve yards', w: 2 },
    { t: '{p} got a standing ovation from the opposition supporters', w: 2 },
    { t: '{p} spent more time talking to the referee than to his team-mates', w: 2 },
    { t: '{p} tracked back sixty yards to make a tackle in the last minute', w: 3 },
    { t: '{p} put in the sort of shift you cannot coach', w: 3 },
    { t: '{p} was booed by his own supporters and answered it in the second half', w: 2 },
    { t: '{p} broke his nose in the first half and finished the game', w: 2 },
    { t: '{p} played a backpass that took ten years off everyone', w: 2 },
    { t: '{p} tried the same trick four times and it worked once', w: 2 },
    { t: '{p} looked like he had been playing there for years', w: 3 },
    { t: '{p} spent the last ten minutes at centre-half and did a job', w: 2, when: e => e.result !== 'L' },
    { t: '{p} won a free kick by falling over nothing at all', w: 2 },
    { t: '{p} took a corner so badly the ball went out for a throw', w: 2 },
    { t: '{p} came out for the second half a different player', w: 3 },
    { t: '{p} was still sprinting in the ninety-fourth minute', w: 3 },
    { t: '{p} shook hands with every ball boy on the way off', w: 2 },
    { t: '{p} left the pitch limping and waved away the physio', w: 2 },
    { t: '{p} got away with a handball on the goal line', w: 2 },
    { t: '{p} switched play twice in the same move and both worked', w: 3 },
    { t: '{p} lost a boot, a shinpad and the ball, all in the same tackle', w: 2 },
    { t: '{p} did not touch the ball for the first twenty minutes and did not sulk', w: 2 },
    { t: '{p} played a pass that had three people on their feet before it arrived', w: 3 },
    { t: '{p} was fouled eight times and never once stayed down', w: 3 },
    { t: '{p} made the run that created the space, and nobody will notice', w: 3 },
    { t: '{p} got the shirt of their best player at the whistle', w: 2 },
    { t: '{p} argued for a corner that was clearly a goal kick and won it', w: 2 },
    { t: 'Nothing much happened. Some weeks are like that', w: 4, plain: true },
    { t: 'A flat afternoon that nobody will remember by Tuesday', w: 3, plain: true },
    { t: 'The referee was the busiest man on the pitch', w: 2, plain: true },
    { t: 'Ninety minutes, no shots worth the name, and a point each', w: 2, plain: true, when: e => e.result === 'D' && e.gf === 0 },
    { t: 'The away end sang for ninety minutes regardless', w: 2, plain: true },
    { t: 'It rained from the first whistle to the last', w: 2, plain: true },
    { t: 'The pitch cut up badly and neither side could play on it', w: 2, plain: true },
    { t: 'Four minutes of stoppage time, and it felt like forty', w: 2, plain: true },
    { t: 'The linesman\'s flag decided more than either manager did', w: 2, plain: true },
    { t: 'A game of very little football and a great deal of shouting', w: 2, plain: true },
    { t: 'The crowd were on their feet at the end, for once', w: 2, plain: true, when: e => e.result === 'W' },
    { t: 'Boos at half time, applause at full time', w: 2, plain: true, when: e => e.result === 'W' },
    { t: 'You could hear the away supporters from the car park', w: 2, plain: true, when: e => e.result === 'L' },
    { t: 'Both benches were up for most of the second half', w: 2, plain: true },
    { t: 'The floodlights flickered in the second half and nobody blinked', w: 1, plain: true },
    { t: 'It finished with eleven players in the opposition box', w: 2, plain: true, when: e => e.result !== 'W' },
    { t: 'The referee\'s watch was the only thing anyone was interested in by the end', w: 2, plain: true, when: e => e.result === 'W' },
    { t: 'A cold night, a thin crowd, and three points is three points', w: 2, plain: true, when: e => e.result === 'W' }
  ];

  const SHAPE_LINES = [
    { t: '{gf}-0. They never got out of their half', when: e => e.gf >= 4 && e.ga === 0, k: 'good' },
    { t: 'Four conceded. That will take some explaining', when: e => e.ga >= 4, k: 'bad' },
    { t: 'Won it with the last kick of the game', when: e => e.result === 'W' && e.gf - e.ga === 1, k: 'good' },
    { t: 'Two goals down and level by the end. They did not stop', when: e => e.result === 'D' && e.gf >= 2, k: 'note' },
    { t: 'Comfortable in the end, though it did not look it at half time', when: e => e.result === 'W' && e.gf - e.ga >= 2, k: 'good' },
    { t: 'A goalless draw that both sides will be quietly happy with', when: e => e.result === 'D' && e.gf === 0, k: 'note' },
    { t: 'Six goals, and it could have been ten', when: e => e.gf + e.ga >= 6, k: 'note' },
    { t: 'Beaten by the only shot on target they had', when: e => e.result === 'L' && e.ga === 1, k: 'bad' },
    { t: 'Battered them and still only won by one', when: e => e.result === 'W' && e.gf - e.ga === 1 && e.gf >= 2, k: 'note' },
    { t: 'A clean sheet away from home is worth more than it looks', when: e => e.ga === 0 && !e.home, k: 'good' },
    { t: 'Three points and not a single moment of comfort', when: e => e.result === 'W' && e.ga >= 1, k: 'good' },
    { t: 'The kind of defeat that costs managers their jobs', when: e => e.result === 'L' && e.ga - e.gf >= 3, k: 'bad' },
    { t: 'Held at home by a side who came for a point and got one', when: e => e.result === 'D' && e.home, k: 'bad' },
    { t: 'Won away and made it look routine', when: e => e.result === 'W' && !e.home && e.ga === 0, k: 'good' },
    { t: 'Everything went in. Some days that happens', when: e => e.gf >= 5, k: 'good' },
    { t: 'Nine shots, one goal, and a nervous finish', when: e => e.result === 'W' && e.gf === 1, k: 'note' },
    { t: 'They scored with their first attack and defended for the rest of it', when: e => e.result === 'L' && e.gf === 0, k: 'bad' },
    { t: 'Two down at the break, level within ten minutes of the restart', when: e => e.result !== 'L' && e.ga >= 2, k: 'note' },
    { t: 'A point away from home, and the bus back will be a quiet one anyway', when: e => e.result === 'D' && !e.home, k: 'note' },
    { t: 'Scored three away from home and nobody saw it coming', when: e => e.gf >= 3 && !e.home, k: 'good' },
    { t: 'Conceded twice in four minutes and never recovered', when: e => e.result === 'L' && e.ga >= 2, k: 'bad' },
    { t: 'The clean sheet mattered more than the goal', when: e => e.result === 'W' && e.gf === 1 && e.ga === 0, k: 'good' },
    { t: 'A draw that felt like a defeat', when: e => e.result === 'D' && e.home && e.gf >= 1, k: 'bad' },
    { t: 'A draw that felt like a win', when: e => e.result === 'D' && !e.home && e.ga >= 1, k: 'good' },
    { t: 'Outplayed for an hour and won it anyway', when: e => e.result === 'W' && e.gf - e.ga === 1, k: 'good' },
    { t: 'They had eleven behind the ball and it very nearly worked', when: e => e.result === 'W' && e.gf === 1, k: 'note' },
    { t: 'Every shot on target went in. Every single one', when: e => e.gf >= 3 && e.result === 'W', k: 'good' },
    { t: 'A hammering, and nobody can pretend otherwise', when: e => e.ga - e.gf >= 4, k: 'bad' },
    { t: 'Seven goals in one afternoon, and the defending was optional', when: e => e.gf + e.ga >= 7, k: 'note' },
    { t: 'Not pretty, not close, but three points', when: e => e.result === 'W' && e.gf >= 2 && e.ga === 0, k: 'good' }
  ];

  function pickWeighted(list, filter) {
    const U = global.U;
    const ok = list.filter(x => !filter || filter(x));
    if (!ok.length) return null;
    return U.weighted(ok.map(x => [x, x.w || 1]));
  }

  /* Build the talking points for one match. */
  function matchMoments(g, entry, xi, scored) {
    const U = global.U, State = global.State;
    const out = [];
    const club = State.club(g.mgr.club);
    const keeper = xi.find(s => s.pos === 'GK');
    const cleanSheet = entry.ga === 0;

    // how many each of them got
    const tally = {};
    scored.forEach(s => { tally[s.id] = (tally[s.id] || 0) + 1; });
    const multi = Object.keys(tally).filter(id => tally[id] >= 2)
      .map(id => ({ p: scored.find(s => s.id === id), n: tally[id] }))
      .sort((a, b) => b.n - a.n);

    multi.forEach(m => {
      if (!m.p) return;
      out.push({ k: 'goal', t: m.n >= 4
        ? `${m.p.name} scored ${m.n}. Four in one game, and he wanted a fifth`
        : m.n === 3 ? `${m.p.name} took the match ball home. A hat-trick, and the third was the best of them`
        : `${m.p.name} scored twice` });
    });

    // one goal described properly, if anybody scored
    const soloScorers = scored.filter(s => (tally[s.id] || 0) === 1);
    if (soloScorers.length && U.chance(0.66)) {
      const who = U.pick(soloScorers);
      const trait = traitOf(who);
      // his trait makes its own kind of goal far likelier
      const way = pickWeighted(GOAL_WAYS, w => !w.trait || w.trait === trait || U.chance(0.28))
        || GOAL_WAYS[0];
      out.push({ k: 'goal', t: `${who.name} scored ${way.t}` });
    }

    // and something that was not a goal
    if (U.chance(0.5)) {
      const scoredIds = {};
      scored.forEach(s => { scoredIds[s.id] = true; });
      const outfield = xi.filter(x => x.pos !== 'GK');
      const blanks = outfield.filter(x => !scoredIds[x.id]);
      const bench = benchPlayers(g);
      const subjectFor = who =>
        who === 'keeper' ? keeper
        : who === 'scorer' ? (scored.length ? U.pick(scored) : null)
        : who === 'blank' ? (blanks.length ? U.pick(blanks) : null)
        : who === 'bench' ? (bench.length ? U.pick(bench) : null)
        : (outfield.length ? U.pick(outfield) : xi[0]);

      const pool = ODD_MOMENTS.filter(m =>
        (!m.when || m.when(entry)) && (m.plain || !!subjectFor(m.who)));
      const m = pickWeighted(pool);
      if (m) {
        const subject = m.plain ? null : subjectFor(m.who);
        out.push({ k: m.plain ? 'flat' : 'note',
          t: m.plain ? m.t : m.t.replace('{p}', subject ? subject.name : club.name) });
      }
    }

    // and the shape of the game itself
    if (U.chance(0.45)) {
      const fits = SHAPE_LINES.filter(m => m.when(entry));
      const m = fits.length ? U.pick(fits) : null;
      if (m) out.push({ k: m.k, t: m.t.replace('{gf}', entry.gf).replace('{ga}', entry.ga) });
    }

    return out.slice(0, 3);
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

  const TOP_TARGET = 14;            // the board never thins out below this many

  /* A trait has to suit the position — a centre-back is not a Shot Stopper. */
  const RISEN_TRAITS = {
    GK:  ['Shot Stopper'],
    DEF: ['The Wall', 'Aerial Threat', 'Engine', 'Blistering Pace'],
    MID: ['Playmaker', 'Engine', 'Late Runs', 'Set-Piece Specialist', 'Power Shot', 'Dribbler Expert'],
    ATT: ['Finisher', 'Poacher', 'Dribbler Expert', 'Blistering Pace', 'Flair', 'Power Shot']
  };
  function traitFor(pos) {
    const D = global.DATA;
    const grp = pos === 'GK' ? 'GK' : ((D.POSITIONS[pos] || {}).group || 'MID');
    return global.U.pick(RISEN_TRAITS[grp] || RISEN_TRAITS.MID);
  }

  /* Football does not run out of great players. When the ones on the board
     have retired — and if you sign them all, eventually they all will — the
     next generation comes through: kids who were nobody a few years ago and
     are now the best in the world. They age and retire in their turn, so the
     board keeps turning over instead of emptying out. */
  function riseStar(g) {
    const U = global.U, State = global.State;
    const clubs = Object.values(g.world.clubs)
      .filter(c => c.id !== g.mgr.club).sort((a, b) => b.rating - a.rating);
    const club = U.pick(clubs.slice(0, 28)) || clubs[0];
    const who = global.Names.person(club.country);
    const pos = U.pick(Object.keys(global.DATA.POSITIONS));
    return {
      name: who.name, nation: who.nation, pos,
      age: U.int(18, 23), ovr: U.int(ELITE, 93),
      club: club.name, clubId: club.id,
      trait: traitFor(pos), since: g.world.year
    };
  }

  /* Their careers run on, a year at a time, whether you sign them or not. */
  function ageRisen(g) {
    const U = global.U, State = global.State;
    if (!g.mgr.risen || !g.mgr.risen.length) return;
    const done = [];
    g.mgr.risen.forEach(r => {
      r.age++;
      r.ovr = U.clamp(r.ovr + (r.age <= 27 ? U.int(0, 2) : r.age <= 31 ? U.int(-1, 1)
        : -U.int(1, 3)), 60, 97);
      if (r.age >= 36 && !U.chance(U.clamp(0.6 - (r.age - 36) * 0.16, 0.05, 0.6))) done.push(r);
      // he has faded out of the very top bracket; the board is for the elite
      else if (r.ovr < ELITE - 3) done.push(r);
    });
    if (done.length) {
      const names = {};
      done.forEach(r => { names[r.name] = true;
        State.news(`${r.name} retires at ${r.age}`, 'info', null, 'legacy'); });
      g.mgr.risen = g.mgr.risen.filter(r => !names[r.name]);
    }
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

    if (!(g.mgr.topCache && g.mgr.topSeason === g.world.year)) {
      const me = State.club(g.mgr.club);
      const out = [];
      const add = (name, nation, pos, ovr, age, clubName, clubId, trait) => {
        const s = {
          id: U.id(), name, nation, pos, ovr, age,
          shirt: 0, goals: 0, assists: 0, apps: 0, rel: 50, star: true, elite: true,
          fromClub: clubName, fromId: clubId
        };
        if (trait) s.trait = trait;
        s.value = eliteFee(ovr, age);
        // they are not for sale, so the number is what it would take
        s.ask = Math.round(s.value * U.rnd(1.15, 1.55) / 500000) * 500000;
        s.wage = Math.max(wageFor(s), eliteWage(ovr));
        out.push(s);
      };
      Object.values(g.world.clubs).forEach(c => {
        if (c.id === me.id) return;
        const stars = global.Eras.starsFor(g, c.name);
        if (!stars) return;
        stars.forEach(st => {
          const [name, nation, pos, ovr, age] = st;
          if (ovr >= ELITE) add(name, nation, pos, ovr, age, c.name, c.id, null);
        });
      });
      (g.mgr.risen || []).forEach(r => {
        if (r.ovr >= ELITE) add(r.name, r.nation, r.pos, r.ovr, r.age, r.club, r.clubId, r.trait);
      });
      out.sort((a, b) => b.ovr - a.ovr || b.ask - a.ask);
      g.mgr.topCache = out;
      g.mgr.topSeason = g.world.year;
    }

    // if the great names have thinned out, the next lot have arrived
    let list = live(g.mgr.topCache);
    if (list.length < TOP_TARGET) {
      g.mgr.risen = g.mgr.risen || [];
      const known = {};
      g.mgr.topCache.forEach(s => { known[s.name] = true; });
      (g.squad || []).forEach(s => { known[s.name] = true; });
      let guard = 0;
      while (list.length < TOP_TARGET && guard++ < 60) {
        const r = riseStar(g);
        if (known[r.name] || mine[r.name]) continue;
        known[r.name] = true;
        g.mgr.risen.push(r);
        const before = g.mgr.topCache.length;
        const tmp = { id: U.id(), name: r.name, nation: r.nation, pos: r.pos, ovr: r.ovr,
          age: r.age, shirt: 0, goals: 0, assists: 0, apps: 0, rel: 50,
          star: true, elite: true, trait: r.trait, fromClub: r.club, fromId: r.clubId };
        tmp.value = eliteFee(r.ovr, r.age);
        tmp.ask = Math.round(tmp.value * U.rnd(1.15, 1.55) / 500000) * 500000;
        tmp.wage = Math.max(wageFor(tmp), eliteWage(r.ovr));
        g.mgr.topCache.push(tmp);
        if (g.mgr.topCache.length > before) {
          global.State.news(`${r.name} (${r.age}) has become one of the best players in the world`,
            'good', null, 'star');
        }
        list = live(g.mgr.topCache);
      }
      g.mgr.topCache.sort((a, b) => b.ovr - a.ovr || b.ask - a.ask);
      list = live(g.mgr.topCache);
    }
    return list;
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

    // the best players in the world get a year older too, whether or not they
    // ever played for you
    ageRisen(g);

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
    market, marketTick, topPlayers, ELITE, TITLE_FLOOR, TOP_TARGET, bid, sell, squadWages, valueFor, wageFor,
    matchMoments, GOAL_WAYS, ODD_MOMENTS, SHAPE_LINES,
    traitOf, traitBonus, TRAIT_GOALS,
    eraPrice, eraWage, eraOwned, eraActive, buyEra, restoreEra,
    seasonReview, nextSeason, squadFor
  };
})(window);

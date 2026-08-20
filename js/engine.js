/* ==========================================================================
   engine.js — squads, match simulation, season calendar, progression,
   transfers, awards, international football
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U, State = global.State, Scenarios = global.Scenarios;

  /* ==========================================================================
     SQUADS
     ========================================================================== */
  const FORMATION = ['GK', 'RB', 'CB', 'CB', 'LB', 'CDM', 'CM', 'CAM', 'RW', 'LW', 'ST'];

  const Squad = {
    generate(club) {
      const R = club.rating;
      const shape = FORMATION.concat(['GK', 'CB', 'CM', 'CM', 'RW', 'ST', 'LB']);
      return shape.map((pos, i) => {
        const starter = i < 11;
        const ovr = Math.round(U.clamp(R + (starter ? U.gauss(1, 3.5) : U.gauss(-7, 4)), 40, 96));
        return {
          id: U.id(),
          name: U.pick(D.FIRST_NAMES) + ' ' + U.pick(D.LAST_NAMES),
          pos, ovr, age: U.int(18, 34),
          goals: 0, assists: 0, apps: 0,
          rel: 50 // relationship with you 0-100
        };
      });
    },
    ensure(g) {
      if (!g.squad || g.squadClub !== g.player.club) {
        g.squad = Squad.generate(State.club(g.player.club));
        g.squadClub = g.player.club;
        // captain = oldest high rated
        const cap = g.squad.slice().sort((a, b) => (b.ovr + b.age) - (a.ovr + a.age))[0];
        cap.captain = true;
      }
      return g.squad;
    },
    rivalFor(g) {
      const p = g.player, sq = Squad.ensure(g);
      const same = sq.filter(s => s.pos === p.pos);
      if (!same.length) return null;
      return same.sort((a, b) => b.ovr - a.ovr)[0];
    },
    teamStrength(g) {
      const club = State.club(g.player.club);
      let s = club.rating;
      const p = g.player;
      if (g.lastLineup !== 'bench') s += (p.ovr - club.rating) * 0.13;
      if (State.hasTrait(p, 'leader')) s += 2;
      s += (club.morale - 70) * 0.05;
      return s;
    }
  };

  /* ==========================================================================
     PROGRESSION
     ========================================================================== */
  const Progress = {
    xpNeeded(p, attr) {
      const v = p.attrs[attr] || 30;
      return Math.round(6 + Math.pow(Math.max(v - 40, 0), 1.45) * 0.5);
    },
    cap(p, attr) {
      const w = D.POSITIONS[p.pos].w[attr] || 0;
      const soft = p.potential + (w > 0.2 ? 4 : -6);
      return U.clamp(Math.round(soft), 40, 99);
    },
    addXp(p, attr, amount) {
      if (!p.xp) p.xp = {};
      if (State.hasTrait(p, 'workhorse')) amount *= 1.25;
      p.xp[attr] = (p.xp[attr] || 0) + amount;
      const gains = [];
      let need = Progress.xpNeeded(p, attr);
      while (p.xp[attr] >= need && p.attrs[attr] < Progress.cap(p, attr)) {
        p.xp[attr] -= need;
        p.attrs[attr]++;
        gains.push(attr);
        need = Progress.xpNeeded(p, attr);
      }
      if (gains.length) Progress.refresh(p);
      return gains;
    },
    refresh(p) {
      const before = p.ovr;
      p.ovr = State.overall(p);
      return p.ovr - before;
    },
    ageCurve(age) {
      if (age <= 19) return 1.35;
      if (age <= 22) return 1.15;
      if (age <= 25) return 0.85;
      if (age <= 28) return 0.5;
      if (age <= 30) return 0.25;
      return 0.05;
    },
    seasonDevelopment(g) {
      const p = g.player;
      const notes = [];
      const minutesF = U.clamp(p.season.apps / 26, 0.25, 1.25);
      const gap = Math.max(0, p.potential - p.ovr);
      const rating = State.seasonRating(p);
      const perfF = U.clamp((rating - 6.3) * 0.55 + 1, 0.6, 1.7);
      let points = gap * 1.05 * Progress.ageCurve(p.age) * minutesF * perfF;
      points += U.rnd(-0.5, 2.2);
      points = Math.max(0, points);
      const w = D.POSITIONS[p.pos].w;
      const keys = D.ATTR_KEYS.filter(k => (w[k] || 0) > 0.03);
      let gained = 0;
      for (let i = 0; i < Math.round(points); i++) {
        const attr = U.weighted(keys.map(k => [k, (w[k] || 0.02) * 10]));
        if (p.attrs[attr] < Progress.cap(p, attr)) { p.attrs[attr]++; gained++; notes.push('+1 ' + D.ATTR_LABEL[attr]); }
      }
      // physical decline
      if (p.age >= 30) {
        const dec = Math.round((p.age - 29) * U.rnd(0.5, 1.4));
        for (let i = 0; i < dec; i++) {
          const attr = U.pick(['pace', 'physical', 'pace', 'dribbling']);
          if (p.attrs[attr] > 25) { p.attrs[attr]--; notes.push('−1 ' + D.ATTR_LABEL[attr]); }
        }
        if (p.age >= 32 && U.chance(0.5) && p.attrs.passing < 95) { p.attrs.passing++; notes.push('+1 Passing (experience)'); }
      }
      const delta = Progress.refresh(p);
      return { notes, delta, gained };
    }
  };

  /* ==========================================================================
     MATCH
     ========================================================================== */
  const Match = {
    interactiveCap(g) {
      const s = (g.settings && g.settings.matchLength) || 'normal';
      return s === 'quick' ? 3 : s === 'full' ? 8 : 5;
    },

    startingChance(g) {
      const p = g.player;
      const rival = Squad.rivalFor(g);
      const rivalOvr = rival ? rival.ovr : 60;
      let c = 0.5 + (p.ovr - rivalOvr) * 0.06 + (p.managerTrust - 50) * 0.008 + (p.form - 60) * 0.004;
      if (p.fitness < 55) c -= 0.25;
      if (p.age < 19) c -= 0.08;
      return U.clamp(c, 0.03, 0.97);
    },

    create(g, fixture) {
      const p = g.player;
      const myClub = State.club(p.club);
      const opp = fixture.oppId ? State.club(fixture.oppId) : { name: fixture.oppName, rating: fixture.oppRating || 70, flag: '' };
      const isHome = fixture.home;

      let role = 'start';
      if (p.suspension > 0) role = 'suspended';
      else if (p.injuries.length) role = 'injured';
      else if (!U.chance(Match.startingChance(g))) role = U.chance(0.62) ? 'bench' : 'out';

      g.lastLineup = role;
      const myStr = Squad.teamStrength(g) + (isHome ? 2.5 : 0) + (role === 'start' ? 0 : -1.5);
      const oppStr = opp.rating + (isHome ? 0 : 2.5) + (fixture.comp === 'intl' ? 0 : 0);

      const m = {
        fixture, oppName: opp.name, oppFlag: opp.flag || '', oppRating: opp.rating,
        myName: myClub.name, myFlag: myClub.flag,
        isHome, comp: fixture.comp, compLabel: fixture.label,
        role, minute: 0, us: 0, them: 0,
        myStr, oppStr,
        log: [], queue: [], idx: 0,
        stats: { goals: 0, assists: 0, rating: role === 'start' ? 6.5 : 6.4, shots: 0, key: 0,
                 card: null, minutes: 0, saves: 0 },
        interactiveLeft: (role === 'start' || role === 'bench') ? Match.interactiveCap(g) : 0,
        usedScenarios: [], finished: false, offAt: null, penaltyPending: false,
        teamBoost: 0, soloBoost: false, shootout: null, injuredDuring: false
      };

      if (role === 'suspended' || role === 'injured' || role === 'out') {
        m.interactiveLeft = 0;
      }
      Match.buildTimeline(g, m);
      return m;
    },

    buildTimeline(g, m) {
      const p = g.player;
      const diff = m.myStr - m.oppStr;
      const usChances = U.clamp(U.poisson(3.9 + diff * 0.11), 1, 13);
      const themChances = U.clamp(U.poisson(3.9 - diff * 0.11), 1, 13);
      const entry = m.role === 'bench' ? U.int(55, 80) : 0;
      m.entryMinute = m.role === 'bench' ? entry : 0;

      const moments = [];
      const involvement = { GK: 0, CB: .14, LB: .18, RB: .18, CDM: .2, CM: .3, CAM: .4, LW: .43, RW: .43, ST: .48 }[p.pos];
      const qualityBonus = U.clamp((p.ovr - State.club(p.club).rating) * 0.012, -0.12, 0.2);

      for (let i = 0; i < usChances; i++) {
        const min = U.int(2, 93);
        const involved = m.role !== 'out' && min >= entry && p.pos !== 'GK' &&
          U.chance(U.clamp(involvement + qualityBonus, 0.05, 0.85));
        moments.push({ minute: min, side: 'us', involved });
      }
      for (let i = 0; i < themChances; i++) {
        const min = U.int(2, 93);
        const involved = m.role !== 'out' && min >= entry &&
          (p.pos === 'GK' ? U.chance(0.75) : U.chance(D.POSITIONS[p.pos].group === 'DEF' ? 0.3 : 0.08));
        moments.push({ minute: min, side: 'them', involved });
      }
      // special moments
      if (m.role !== 'out') {
        if (U.chance(0.14)) moments.push({ minute: U.int(entry + 3, 90), side: 'us', involved: true, special: 'penalty' });
        if (U.chance(0.35)) moments.push({ minute: U.int(entry + 3, 90), side: 'us', involved: true, special: 'set' });
        if (U.chance(0.22)) moments.push({ minute: U.int(entry + 5, 88), side: 'none', involved: true, special: 'social' });
      }
      moments.sort((a, b) => a.minute - b.minute);
      m.queue = moments;
    },

    isPenaltyTaker(g) {
      const p = g.player;
      if (p.pos === 'GK') return false;
      const rival = Squad.ensure(g).filter(s => s.pos !== 'GK').sort((a, b) => b.ovr - a.ovr)[0];
      return p.attrs.shooting >= 62 || p.ovr >= (rival ? rival.ovr : 70) - 1 || State.hasTrait(p, 'ice');
    },

    ctxFor(g, m, extra) {
      const p = g.player;
      const oppQ = m.oppRating;
      return Object.assign({
        player: p, minute: m.minute, oppName: m.oppName,
        keeper: oppQ - 2, defender: oppQ - 1, attackerRating: oppQ + 1,
        pressure: (m.comp === 'cup' || m.comp === 'cont' || m.comp === 'intl') && m.minute > 70,
        crowdHostile: !m.isHome,
        losing: m.us < m.them,
        score: m.us + '-' + m.them
      }, extra || {});
    },

    /* returns {type:'commentary'|'scenario'|'end', ...} */
    step(g, m) {
      if (m.finished) return { type: 'end' };
      if (m.pendingCelebration) {
        m.pendingCelebration = false;
        return { type: 'scenario', scenario: Scenarios.build('celebration', Match.ctxFor(g, m)) };
      }
      if (m.penaltyPending) {
        m.penaltyPending = false;
        if (Match.isPenaltyTaker(g) && m.role !== 'out') {
          return { type: 'scenario', scenario: Scenarios.build('penalty', Match.ctxFor(g, m)) };
        }
        const scored = U.chance(0.76);
        if (scored) m.us++;
        return Match.commentary(m, scored
          ? 'Your captain steps up and buries the penalty!'
          : 'Your captain takes the penalty… and the keeper saves it!', scored ? 'good' : 'bad');
      }

      while (m.idx < m.queue.length) {
        const mom = m.queue[m.idx++];
        m.minute = mom.minute;

        if (m.offAt && mom.minute > m.offAt) continue;
        if (m.role === 'bench' && mom.minute < m.entryMinute) {
          // still auto-resolve the action while you watch from the bench
          const r = Match.autoChance(g, m, mom);
          if (r) return r;
          continue;
        }

        if (mom.involved && m.interactiveLeft > 0 && m.role !== 'out' && !m.sentOff) {
          m.interactiveLeft--;
          const ctx = Match.ctxFor(g, m);
          let scn;
          if (mom.special === 'penalty') {
            if (Match.isPenaltyTaker(g)) scn = Scenarios.build('penalty', ctx);
            else { m.penaltyPending = true; return Match.commentary(m, 'PENALTY to ' + m.myName + '!', 'good'); }
          } else if (mom.special === 'set') {
            scn = Scenarios.build(U.chance(0.5) ? 'free_kick' : 'corner', ctx);
          } else if (mom.special === 'social') {
            scn = Scenarios.random(Object.assign({}, ctx), m.usedScenarios);
          } else if (mom.side === 'them') {
            scn = Scenarios.build(g.player.pos === 'GK' ? (U.chance(0.65) ? 'gk_save' : 'gk_cross')
                                                        : (U.chance(0.6) ? 'last_ditch' : 'aerial'), ctx);
          } else {
            scn = Scenarios.random(ctx, m.usedScenarios);
          }
          if (!scn) continue;
          m.usedScenarios.push(scn.id);
          return { type: 'scenario', scenario: scn };
        }

        const res = Match.autoChance(g, m, mom);
        if (res) return res;
      }

      return Match.finish(g, m);
    },

    autoChance(g, m, mom) {
      const attacking = mom.side === 'us';
      const strDiff = attacking ? (m.myStr - m.oppStr) : (m.oppStr - m.myStr);
      const conv = U.clamp(0.245 + strDiff * 0.006 + (attacking ? m.teamBoost * 0.004 : 0), 0.08, 0.55);
      const scored = U.chance(conv);
      const squad = Squad.ensure(g);
      if (attacking) {
        if (scored) {
          m.us++;
          const scorer = U.pick(squad.filter(s => ['ST', 'LW', 'RW', 'CAM', 'CM'].indexOf(s.pos) >= 0)) || squad[10];
          scorer.goals++;
          return Match.commentary(m, `⚽ ${m.myName} score! ${scorer.name} finishes it off.`, 'good');
        }
        if (U.chance(0.45)) return null;
        return Match.commentary(m, U.pick([
          'A chance goes begging at the far post.',
          'Good move, poor final ball.',
          'Shot from distance — deflected wide.',
          'The keeper makes a routine save.'
        ]), 'neutral');
      }
      if (scored) {
        m.them++;
        if (g.player.pos === 'GK' && m.role === 'start') m.stats.rating -= 0.28;
        else if (D.POSITIONS[g.player.pos].group === 'DEF' && m.role === 'start') m.stats.rating -= 0.14;
        return Match.commentary(m, `⚽ ${m.oppName} score. ${m.myName} look shaky at the back.`, 'bad');
      }
      if (U.chance(0.5)) return null;
      return Match.commentary(m, U.pick([
        `${m.oppName} threaten but the offside flag saves you.`,
        'Your keeper makes a smart stop.',
        'A warning sign — the post is rattled!',
        'Cleared off the line! Heart-in-mouth stuff.'
      ]), 'neutral');
    },

    commentary(m, text, tone) {
      const entry = { minute: m.minute, text, tone: tone || 'neutral' };
      m.log.push(entry);
      return { type: 'commentary', entry, us: m.us, them: m.them, minute: m.minute };
    },

    applyEffects(g, m, fx) {
      const p = g.player;
      const out = [];
      if (fx.goal) {
        m.us++; m.stats.goals++; m.stats.rating += 0;
        p.season.goals++; p.career.goals++;
        m.pendingCelebration = U.chance(0.65);
        out.push('goal');
      }
      if (fx.teamGoal && !fx.goal) { m.us++; }
      if (fx.assist) { m.stats.assists++; p.season.assists++; p.career.assists++; }
      if (fx.concede) { m.them++; }
      if (fx.save) { m.stats.saves++; }
      if (fx.penalty) { m.penaltyPending = true; }
      if (fx.rating) m.stats.rating += fx.rating;
      if (fx.fitness) p.fitness = U.clamp(p.fitness + fx.fitness * (State.hasTrait(p, 'engine') ? 0.7 : 1), 0, 100);
      if (fx.fame) { State.addFame(p, fx.fame * (State.hasTrait(p, 'magnet') ? 1.5 : 1));
                     State.addFollowers(p, Math.max(0, fx.fame) * 0.012, 0); }
      if (fx.morale) p.morale = U.clamp(p.morale + fx.morale, 0, 100);
      if (fx.trust) p.managerTrust = U.clamp(p.managerTrust + fx.trust, 0, 100);
      if (fx.teamBoost) m.teamBoost += fx.teamBoost;
      if (fx.soloBoost) m.soloBoost = true;
      if (fx.crowd) { const c = State.club(p.club); c.morale = U.clamp(c.morale + fx.crowd * 0.2, 0, 100); }
      if (fx.money) State.addMoney(p, fx.money);
      if (fx.xp) Object.keys(fx.xp).forEach(k => {
        const gains = Progress.addXp(p, k, fx.xp[k] * 1.4);
        gains.forEach(gk => out.push('attr:' + gk));
      });
      if (fx.card === 'yellow') {
        m.stats.card = m.stats.card === 'yellow' ? 'red' : (m.stats.card || 'yellow');
        p.season.yellow++; p.career.yellow++;
        if (m.stats.card === 'red') { m.sentOff = true; m.offAt = m.minute; p.season.red++; p.career.red++; out.push('red'); }
      } else if (fx.card === 'red') {
        m.stats.card = 'red'; m.sentOff = true; m.offAt = m.minute;
        p.season.red++; p.career.red++; out.push('red');
      }
      if (fx.subbed) { m.offAt = m.minute; out.push('subbed'); }
      if (fx.injuryRisk && U.chance(fx.injuryRisk >= 1 ? 1 : fx.injuryRisk)) {
        Injuries.give(g, true);
        m.injuredDuring = true; m.offAt = m.minute; out.push('injury');
      }
      m.log.push({ minute: m.minute, text: fx.text, tone: fx.tone });
      return out;
    },

    simRest(g, m) {
      // resolve every remaining moment automatically
      let guard = 0;
      while (!m.finished && guard++ < 500) {
        if (m.pendingCelebration) { m.pendingCelebration = false; continue; }
        if (m.penaltyPending) {
          m.penaltyPending = false;
          const taker = Match.isPenaltyTaker(g) && m.role !== 'out' && !m.sentOff;
          const scored = U.chance(taker ? 0.78 : 0.76);
          if (scored) {
            m.us++;
            if (taker) { m.stats.goals++; g.player.season.goals++; g.player.career.goals++; m.stats.rating += 1.2; }
          } else if (taker) m.stats.rating -= 1.2;
          m.log.push({ minute: m.minute, text: scored ? 'Penalty converted.' : 'Penalty missed.', tone: scored ? 'good' : 'bad' });
          continue;
        }
        if (m.idx >= m.queue.length) { Match.finish(g, m); break; }
        const mom = m.queue[m.idx++];
        m.minute = mom.minute;
        if (m.offAt && mom.minute > m.offAt) continue;
        if (mom.involved && !m.sentOff && m.role !== 'out' && mom.minute >= m.entryMinute) {
          // auto-resolve an involvement with a fair coin weighted by ability
          Match.autoInvolvement(g, m, mom);
          continue;
        }
        Match.autoChance(g, m, mom);
      }
      return m;
    },

    autoInvolvement(g, m, mom) {
      const p = g.player;
      if (mom.side === 'them' || p.pos === 'GK') {
        const good = U.chance(U.clamp(0.45 + (p.ovr - m.oppRating) * 0.012, 0.15, 0.85));
        if (good) { m.stats.rating += 0.35; if (p.pos === 'GK') m.stats.saves++; }
        else { m.stats.rating -= 0.25; if (U.chance(0.35)) { m.them++; } }
        return;
      }
      const scoreP = U.clamp(0.16 + (p.attrs.shooting - 55) * 0.006 + D.POSITIONS[p.pos].attack * 0.25, 0.03, 0.6);
      if (U.chance(scoreP)) {
        m.us++; m.stats.goals++; p.season.goals++; p.career.goals++; m.stats.rating += 1.15;
        m.log.push({ minute: m.minute, text: '⚽ You score!', tone: 'good' });
      } else if (U.chance(0.22)) {
        m.us++; m.stats.assists++; p.season.assists++; p.career.assists++; m.stats.rating += 0.8;
        m.log.push({ minute: m.minute, text: '🅰️ You set up the goal!', tone: 'good' });
      } else {
        m.stats.rating -= 0.1;
      }
    },

    finish(g, m) {
      if (m.finished) return { type: 'end', match: m };
      m.finished = true;
      const p = g.player;
      const played = m.role === 'start' || m.role === 'bench';
      m.minute = 90;

      // shootout for knockout ties that are level
      if (played && m.fixture.knockout && m.us === m.them) {
        m.needsShootout = true;
        return { type: 'shootout', match: m };
      }
      Match.settle(g, m);
      return { type: 'end', match: m };
    },

    settle(g, m) {
      const p = g.player;
      const played = (m.role === 'start' || m.role === 'bench') && !m.dnp;
      const weekWage = p.contract ? p.contract.wage : 0;
      if (weekWage) { State.addMoney(p, weekWage); p.season.earned = (p.season.earned || 0) + weekWage; }
      let result = m.us > m.them ? 'W' : m.us === m.them ? 'D' : 'L';
      if (m.fixture.knockout && m.us === m.them && m.advanced != null) result = m.advanced ? 'W' : 'L';
      m.result = result;

      if (played) {
        const mins = m.offAt ? Math.max(1, m.offAt - m.entryMinute) : (90 - m.entryMinute);
        m.stats.minutes = mins;
        // result & clean sheet adjustments
        m.stats.rating += result === 'W' ? 0.25 : result === 'L' ? -0.2 : 0;
        if (m.them === 0 && (p.pos === 'GK' || D.POSITIONS[p.pos].group === 'DEF') && mins > 60) {
          m.stats.rating += 0.5; p.season.cleanSheets++; p.career.cleanSheets++;
        }
        m.stats.rating = U.clamp(U.round(m.stats.rating, 1), 3.0, 10);
        m.motm = m.stats.rating >= 8.2 && result !== 'L';
        if (m.motm) { p.season.motm++; p.career.motm++; }

        p.season.apps++; p.career.apps++;
        p.season.minutes += mins;
        p.season.ratingSum += m.stats.rating; p.career.ratingSum += m.stats.rating;

        p.fitness = U.clamp(p.fitness + 11, 0, 100); // the week between games
        const drain = (mins / 90) * U.rnd(16, 26) * (State.hasTrait(p, 'engine') ? 0.7 : 1)
          * (1 - (p.attrs.physical - 50) * 0.004);
        p.fitness = U.clamp(p.fitness - drain, 5, 100);
        p.form = U.clamp(p.form * 0.72 + (m.stats.rating - 6.5) * 30 + 18, 5, 100);
        p.morale = U.clamp(p.morale + (result === 'W' ? 4 : result === 'L' ? -3 : 0) + (m.stats.goals * 3), 0, 100);
        p.managerTrust = U.clamp(p.managerTrust + (m.stats.rating - 6.6) * 1.5, 0, 100);
        // wages + bonuses
        const bonus = m.stats.goals * (p.contract ? p.contract.goalBonus : 0);
        if (bonus) State.addMoney(p, bonus);
        m.bonus = bonus;
        // fame
        const fameGain = (m.stats.goals * 0.6 + m.stats.assists * 0.3 + (m.motm ? 0.5 : 0))
          * (State.hasTrait(p, 'magnet') ? 1.5 : 1) * (m.comp === 'intl' || m.comp === 'cont' ? 1.6 : 1);
        State.addFame(p, fameGain);
        State.addFollowers(p, fameGain * 0.02 + 0.0015, 300);
        // injury from fatigue
        if (!m.injuredDuring && U.chance(U.clamp(0.05 + (60 - p.fitness) * 0.0035 + (State.hasTrait(p, 'glass') ? 0.05 : 0), 0.02, 0.28))) {
          Injuries.give(g, false);
          m.postInjury = true;
        }
      } else {
        p.season.benched++;
        p.fitness = U.clamp(p.fitness + 12, 0, 100);
        p.form = U.clamp(p.form - 2, 0, 100);
        if (m.role === 'out') p.morale = U.clamp(p.morale - 3, 0, 100);
      }

      if (p.suspension > 0) p.suspension--;
      if (m.stats.card === 'red') p.suspension = U.int(1, 3);
      else if (p.season.yellow > 0 && p.season.yellow % 5 === 0 && m.stats.card === 'yellow') p.suspension = 1;

      Injuries.tick(g);
      Season.recordResult(g, m);
    }
  };

  /* ==========================================================================
     INJURIES
     ========================================================================== */
  const INJURY_TYPES = [
    ['Twisted ankle', 1, 3], ['Hamstring strain', 2, 6], ['Dead leg', 1, 2],
    ['Groin strain', 2, 5], ['Fractured metatarsal', 8, 16], ['Knee ligament damage', 14, 30],
    ['Concussion', 1, 3], ['Broken nose', 1, 2], ['Shoulder dislocation', 4, 9],
    ['Achilles trouble', 10, 22], ['Back spasm', 1, 4], ['Calf tear', 3, 8]
  ];
  const Injuries = {
    give(g, severe) {
      const p = g.player;
      const pool = severe ? INJURY_TYPES.filter(t => t[2] >= 5) : INJURY_TYPES;
      const t = U.pick(pool);
      const weeks = U.int(t[1], t[2]);
      const inj = { name: t[0], matches: Math.max(1, Math.round(weeks * 0.9)), total: weeks };
      p.injuries.push(inj);
      p.lastInjury = inj;
      p.morale = U.clamp(p.morale - Math.min(20, weeks), 0, 100);
      p.health = U.clamp(p.health - weeks * 0.6, 20, 100);
      State.log(`🩼 Injury: ${inj.name} — out for around ${weeks} week${weeks > 1 ? 's' : ''}.`, 'bad');
      State.news(`${p.firstName} ${p.lastName} suffers ${inj.name.toLowerCase()} — ${weeks} weeks out`, 'bad');
      return inj;
    },
    tick(g) {
      const p = g.player;
      p.injuries.forEach(i => i.matches--);
      const healed = p.injuries.filter(i => i.matches <= 0);
      healed.forEach(i => State.log(`✅ Recovered from ${i.name}.`, 'good'));
      p.injuries = p.injuries.filter(i => i.matches > 0);
    }
  };

  /* ==========================================================================
     SEASON / CALENDAR
     ========================================================================== */
  const Season = {
    roundRobin(ids) {
      const teams = ids.slice();
      if (teams.length % 2) teams.push(null);
      const n = teams.length, rounds = [];
      let arr = teams.slice();
      for (let r = 0; r < n - 1; r++) {
        const pairs = [];
        for (let i = 0; i < n / 2; i++) {
          const a = arr[i], b = arr[n - 1 - i];
          if (a && b) pairs.push(r % 2 ? [b, a] : [a, b]);
        }
        rounds.push(pairs);
        arr = [arr[0]].concat([arr[n - 1]], arr.slice(1, n - 1));
      }
      return rounds;
    },

    build(g) {
      const p = g.player;
      const club = State.club(p.club);
      const league = State.league(club.league);
      const meta = D.LEAGUES.find(l => l.id === league.id);

      // league table reset
      g.tables[league.id] = {};
      league.clubs.forEach(id => { g.tables[league.id][id] = { p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }; });
      g.topScorers = {};
      league.clubs.forEach(id => { if (id !== club.id) g.topScorers[id] = { name: U.pick(D.FIRST_NAMES) + ' ' + U.pick(D.LAST_NAMES), club: id, goals: 0 }; });

      const single = Season.roundRobin(league.clubs);
      const rounds = single.concat(single.map(r => r.map(pair => [pair[1], pair[0]])));

      const fixtures = [];
      rounds.forEach((pairs, i) => {
        const mine = pairs.find(pr => pr[0] === club.id || pr[1] === club.id);
        const others = pairs.filter(pr => pr !== mine);
        fixtures.push({
          comp: 'league', label: league.name, round: i + 1,
          oppId: mine ? (mine[0] === club.id ? mine[1] : mine[0]) : null,
          home: mine ? mine[0] === club.id : true,
          others, played: false
        });
      });

      // domestic cup rounds
      const cupRounds = ['Round of 32', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final'];
      g.cup = { name: meta.cup, alive: true, roundIdx: 0, rounds: cupRounds, won: false };
      cupRounds.forEach((rn, i) => {
        const at = Math.min(fixtures.length - 1, 4 + i * 4);
        fixtures.splice(at + i, 0, {
          comp: 'cup', label: meta.cup + ' · ' + rn, round: i, knockout: true,
          oppId: null, home: U.chance(0.5), played: false, cupRound: i
        });
      });

      // continental
      if (g.contQualified) {
        const c = D.CONTINENTAL[meta.cont];
        g.cont = { name: c.name, short: c.short, stage: 'group', groupPlayed: 0, groupPts: 0, alive: true, koIdx: 0,
                   rounds: ['Quarter-final', 'Semi-final', 'Final'], won: false };
        for (let i = 0; i < 6; i++) {
          const at = Math.min(fixtures.length - 1, 2 + i * 3);
          fixtures.splice(at, 0, { comp: 'cont', label: c.short + ' · Matchday ' + (i + 1), oppId: null,
                                   home: i % 2 === 0, played: false, contGroup: i });
        }
        ['Quarter-final', 'Semi-final', 'Final'].forEach((rn, i) => {
          fixtures.splice(fixtures.length - 6 + i * 2, 0, {
            comp: 'cont', label: c.short + ' · ' + rn, oppId: null, home: U.chance(0.5),
            played: false, knockout: true, contKo: i
          });
        });
      } else g.cont = null;

      // international tournament in the summer
      g.intlTournament = null;
      if (p.intl.called && !p.intl.retired) {
        const isWC = (g.world.year + 1) % 4 === 0;
        const nat = D.NATIONS.find(n => n.name === p.nation) || D.NATIONS[0];
        g.intlTournament = {
          name: isWC ? 'World Cup ' + (g.world.year + 1) : (nat.rating >= 80 ? 'Continental Championship ' : 'Continental Cup ') + (g.world.year + 1),
          stage: 0, alive: true, won: false,
          rounds: ['Group Match 1', 'Group Match 2', 'Group Match 3', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final']
        };
      }

      g.fixtures = fixtures;
      g.fixtureIndex = 0;
      g.stage = 'season';
      return fixtures;
    },

    current(g) { return g.fixtures[g.fixtureIndex] || null; },

    prepareFixture(g, f) {
      const p = g.player, club = State.club(p.club);
      if (f.oppId) return f;
      if (f.comp === 'cup') {
        const pool = State.clubsOf(club.league).filter(c => c.id !== club.id);
        const weaker = pool.filter(c => c.rating < club.rating + 4);
        const chosen = f.cupRound <= 1 && weaker.length ? U.pick(weaker) : U.pick(pool);
        f.oppId = chosen.id;
      } else if (f.comp === 'cont') {
        const meta = D.LEAGUES.find(l => l.id === club.league);
        const others = Object.values(g.world.clubs).filter(c => {
          const lm = D.LEAGUES.find(l => l.id === c.league);
          return lm && lm.cont === meta.cont && c.id !== club.id;
        });
        const strong = others.filter(c => c.rating >= club.rating - 8);
        f.oppId = (f.contKo != null && strong.length ? U.pick(strong) : U.pick(others)).id;
      }
      return f;
    },

    recordResult(g, m) {
      const club = State.club(g.player.club);
      const f = m.fixture;
      f.played = true; f.score = m.us + '-' + m.them; f.result = m.result;

      if (m.comp === 'league') {
        const t = g.tables[club.league];
        Season.applyTable(t, club.id, f.oppId, m.us, m.them);
        // other fixtures this round
        (f.others || []).forEach(pair => {
          const A = State.club(pair[0]), B = State.club(pair[1]);
          const diff = (A.rating + 2.5) - B.rating;
          const ga = U.poisson(U.clamp(1.35 + diff * 0.045, 0.25, 4));
          const gb = U.poisson(U.clamp(1.35 - diff * 0.045, 0.25, 4));
          Season.applyTable(t, A.id, B.id, ga, gb);
          if (g.topScorers[A.id] && U.chance(0.6)) g.topScorers[A.id].goals += Math.min(ga, U.int(0, 2));
          if (g.topScorers[B.id] && U.chance(0.6)) g.topScorers[B.id].goals += Math.min(gb, U.int(0, 2));
        });
      } else if (m.comp === 'cup' && g.cup) {
        if (m.result === 'L' || (m.needsShootoutLost)) { g.cup.alive = false; }
        else if (f.cupRound === 4) { g.cup.won = true; }
      } else if (m.comp === 'cont' && g.cont) {
        if (f.contGroup != null) {
          g.cont.groupPlayed++;
          g.cont.groupPts += m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0;
          if (g.cont.groupPlayed === 6) {
            g.cont.alive = g.cont.groupPts >= 8 || (g.cont.groupPts >= 6 && U.chance(0.5));
            if (!g.cont.alive) State.log(`Eliminated in the ${g.cont.short} group stage with ${g.cont.groupPts} points.`, 'bad');
            else State.log(`Through to the ${g.cont.short} knockouts with ${g.cont.groupPts} points!`, 'good');
          }
        } else if (f.contKo != null) {
          if (m.result === 'L') g.cont.alive = false;
          else if (f.contKo === 2) g.cont.won = true;
        }
      } else if (m.comp === 'intl' && g.intlTournament) {
        const t = g.intlTournament;
        if (t.stage >= 3 && m.result === 'L') t.alive = false;
        if (t.stage === 6 && m.result !== 'L') t.won = true;
        t.stage++;
      }
      club.form = (club.form || []).concat(m.result).slice(-5);
    },

    applyTable(t, aId, bId, ga, gb) {
      if (!t[aId] || !t[bId]) return;
      t[aId].p++; t[bId].p++;
      t[aId].gf += ga; t[aId].ga += gb;
      t[bId].gf += gb; t[bId].ga += ga;
      if (ga > gb) { t[aId].w++; t[aId].pts += 3; t[bId].l++; }
      else if (ga < gb) { t[bId].w++; t[bId].pts += 3; t[aId].l++; }
      else { t[aId].d++; t[bId].d++; t[aId].pts++; t[bId].pts++; }
    },

    standings(g, leagueId) {
      const t = g.tables[leagueId] || {};
      return Object.keys(t).map(id => Object.assign({ id, club: State.club(id) }, t[id]))
        .sort((a, b) => (b.pts - a.pts) || ((b.gf - b.ga) - (a.gf - a.ga)) || (b.gf - a.gf) || a.club.name.localeCompare(b.club.name));
    },

    position(g) {
      const club = State.club(g.player.club);
      const s = Season.standings(g, club.league);
      return s.findIndex(r => r.id === club.id) + 1;
    },

    // returns whether we should skip fixtures (cup out / not in squad)
    nextPlayable(g) {
      let guard = 0;
      while (g.fixtureIndex < g.fixtures.length && guard++ < 200) {
        const f = g.fixtures[g.fixtureIndex];
        if (f.comp === 'cup' && (!g.cup || !g.cup.alive)) { g.fixtureIndex++; continue; }
        if (f.comp === 'cont' && (!g.cont || (!g.cont.alive && f.contKo != null))) { g.fixtureIndex++; continue; }
        return f;
      }
      return null;
    }
  };

  /* ==========================================================================
     AWARDS + END OF SEASON
     ========================================================================== */
  const Awards = {
    leagueTopScorers(g) {
      const p = g.player;
      const list = Object.values(g.topScorers || {}).map(s => ({ name: s.name, club: State.club(s.club).name, goals: s.goals }));
      const leagueGoals = Math.round(p.season.goals * 0.72); // rough share of goals in league
      list.push({ name: p.firstName + ' ' + p.lastName, club: State.club(p.club).name, goals: leagueGoals, you: true });
      return list.sort((a, b) => b.goals - a.goals);
    },

    end(g) {
      const p = g.player, club = State.club(p.club);
      const pos = Season.position(g);
      const table = Season.standings(g, club.league);
      const results = { pos, trophies: [], awards: [], money: 0, notes: [] };
      const rating = State.seasonRating(p);

      if (pos === 1) { results.trophies.push(club.league + ' Title'); }
      if (g.cup && g.cup.won) results.trophies.push(g.cup.name);
      if (g.cont && g.cont.won) results.trophies.push(g.cont.name);
      if (g.intlTournament && g.intlTournament.won) results.trophies.push(g.intlTournament.name);

      const scorers = Awards.leagueTopScorers(g);
      if (scorers[0] && scorers[0].you) results.awards.push('Golden Boot');
      if (rating >= 7.7 && p.season.apps >= 18 && pos <= 3) results.awards.push('League Player of the Season');
      if (rating >= 7.4 && p.season.apps >= 18) results.awards.push('Team of the Season');
      if (p.age <= 21 && rating >= 7.1 && p.season.apps >= 10) results.awards.push('Young Player of the Year');
      // Ballon d'Or style
      const bdScore = p.season.goals * 2.2 + p.season.assists * 1.5 + Math.max(0, rating - 6.4) * 42
        + results.trophies.length * 16 + (g.cont && g.cont.won ? 25 : 0) + p.fame * 0.35
        + Math.max(0, p.ovr - 78) * 3;
      if (bdScore > 175 && p.ovr >= 85 && U.chance(0.8)) results.awards.push('World Player of the Year 🏆');
      else if (bdScore > 135 && p.ovr >= 80) results.awards.push('World XI Nomination');

      // money
      const prize = Math.round((13 - pos) * 400000 + (g.cont ? 6000000 : 0) + (results.trophies.length * 2500000));
      results.money = Math.max(0, prize);
      State.addMoney(p, results.money);

      results.wages = p.season.earned || 0;

      results.trophies.forEach(t => p.career.trophies.push({ name: t, year: g.world.year + 1, club: club.name }));
      results.awards.forEach(a => p.achievements.push({ name: a, year: g.world.year + 1 }));

      // development
      results.dev = Progress.seasonDevelopment(g);

      // record season history
      p.career.seasons.push({
        year: g.world.year + 1, club: club.name, league: club.league, pos,
        apps: p.season.apps, goals: p.season.goals, assists: p.season.assists,
        rating: rating, trophies: results.trophies.slice(), awards: results.awards.slice(),
        ovr: p.ovr, age: p.age
      });

      // club reaction
      if (pos <= 3 || results.trophies.length) club.morale = U.clamp(club.morale + 10, 0, 100);
      else if (pos >= 10) club.morale = U.clamp(club.morale - 12, 0, 100);

      // continental qualification for next season
      g.contQualified = pos <= 4 || (g.cont && g.cont.won) || (g.cup && g.cup.won && pos <= 7);

      // international call-up
      Intl.review(g, results);

      return results;
    }
  };

  /* ==========================================================================
     INTERNATIONAL
     ========================================================================== */
  const Intl = {
    review(g, results) {
      const p = g.player;
      if (p.intl.retired) return;
      const nat = D.NATIONS.find(n => n.name === p.nation) || D.NATIONS[0];
      const bar = nat.rating - 11;
      const wasCalled = p.intl.called;
      p.intl.called = p.ovr >= bar || (p.ovr >= bar - 4 && State.seasonRating(p) >= 7.2);
      if (p.intl.called && !wasCalled) {
        State.log(`🌍 You have been called up by ${nat.flag} ${p.nation} for the first time!`, 'good');
        State.news(`${p.lastName} earns a maiden ${p.nation} call-up`, 'good');
        results.notes.push('First international call-up!');
        p.fame = U.clamp(p.fame + 5, 0, 100);
      } else if (!p.intl.called && wasCalled) {
        State.log(`You have been dropped from the ${p.nation} squad.`, 'bad');
        results.notes.push('Dropped from the national squad.');
      }
    },
    friendlyBurst(g) {
      const p = g.player;
      if (!p.intl.called || p.intl.retired) return null;
      const caps = U.int(2, 4);
      let goals = 0;
      for (let i = 0; i < caps; i++) {
        if (U.chance(U.clamp(D.POSITIONS[p.pos].attack * (p.attrs.shooting / 100) * 1.4, 0.03, 0.6))) goals++;
      }
      p.intl.caps += caps; p.intl.goals += goals;
      return { caps, goals };
    }
  };

  /* ==========================================================================
     TRANSFERS
     ========================================================================== */
  const Transfers = {
    generateOffers(g) {
      const p = g.player, club = State.club(p.club);
      const value = State.marketValue(p);
      const rating = State.seasonRating(p);
      const offers = [];
      const all = Object.values(g.world.clubs).filter(c => c.id !== club.id);
      const interest = all.filter(c => {
        const gapOk = p.ovr >= c.rating - 9;
        const wantsYou = c.rating <= p.ovr + 7;
        return gapOk && wantsYou;
      });
      const heat = U.clamp((rating - 6.4) * 2.2 + p.fame * 0.06 + (p.ovr - club.rating) * 0.5, 0, 10);
      const n = U.clamp(Math.round(heat / 2.2) + (U.chance(0.4) ? 1 : 0), 0, 5);
      const shortlist = U.pickN(interest.sort((a, b) => Math.abs(a.rating - p.ovr) - Math.abs(b.rating - p.ovr)).slice(0, 26), n);
      shortlist.forEach(c => {
        const fee = Math.round(value * U.rnd(0.8, 1.9) / 100000) * 100000;
        const offer = Contracts.offerFor(p, c, false);
        offers.push({
          clubId: c.id, clubName: c.name, rating: c.rating, league: c.league, flag: c.flag,
          fee, wage: offer.wage, years: offer.years, signingBonus: offer.signingBonus,
          release: offer.release, goalBonus: offer.goalBonus,
          pitch: Transfers.pitch(c, p)
        });
      });
      return offers.sort((a, b) => b.rating - a.rating);
    },
    pitch(c, p) {
      if (c.rating >= 86) return 'You would be joining a genuine superclub. Trophies expected every single season.';
      if (c.rating >= 80) return 'A big club with Champions League ambitions and a passionate support.';
      if (c.rating >= 74) return 'A project on the rise. You would be the centrepiece.';
      return 'Less glamour, but you would start every week and be adored.';
    },
    renewalOffer(g) {
      const p = g.player, club = State.club(p.club);
      const base = Contracts.offerFor(p, club, false);
      const mult = U.clamp(1 + (State.seasonRating(p) - 6.6) * 0.35 + (p.managerTrust - 55) * 0.006, 0.75, 2.2);
      base.wage = Math.round(base.wage * mult / 100) * 100;
      return base;
    },
    accept(g, offer) {
      const p = g.player, oldClub = State.club(p.club), club = State.club(offer.clubId);
      Contracts.joinClub(p, club, offer);
      g.squad = null; g.squadClub = null;
      Squad.ensure(g);
      State.log(`✍️ Signed for ${club.name} for ${U.cash(offer.fee)} — ${U.cash(offer.wage)}/week.`, 'good');
      State.news(`${club.name} sign ${p.firstName} ${p.lastName} from ${oldClub.name} for ${U.cash(offer.fee)}`, 'good');
      p.fame = U.clamp(p.fame + U.clamp((club.rating - oldClub.rating) * 0.6, 0, 10) + 2, 0, 100);
      // agent fee to you
      State.addMoney(p, Math.round(offer.fee * 0.03));
    }
  };

  global.Engine = { Squad, Match, Season, Awards, Progress, Transfers, Injuries, Intl, FORMATION };
})(window);

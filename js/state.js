/* ==========================================================================
   state.js — game state: world creation, player creation, save/load, derived
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U;

  const State = {
    game: null,

    /* ---------------- world ---------------- */
    buildWorld(startYear) {
      const clubs = {};
      const leagues = D.LEAGUES.map(L => {
        const ids = L.clubs.map(([name, rating, prestige]) => {
          const id = L.id + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
          clubs[id] = {
            id, name, rating, baseRating: rating, prestige,
            league: L.id, country: L.country,
            morale: 70, form: [], trophies: 0
          };
          return id;
        });
        return { id: L.id, name: L.name, country: L.country, tier: L.tier,
                 cup: L.cup, cont: L.cont, clubs: ids };
      });
      return { year: startYear, clubs, leagues };
    },

    league(id) { return this.game.world.leagues.find(l => l.id === id); },
    club(id) { return this.game.world.clubs[id]; },
    clubsOf(leagueId) { return this.league(leagueId).clubs.map(id => this.club(id)); },

    /* ---------------- player ---------------- */

    overall(p, pos) {
      const w = D.POSITIONS[pos || p.pos].w;
      let sum = 0, total = 0;
      D.ATTR_KEYS.forEach(k => { sum += (p.attrs[k] || 0) * (w[k] || 0); total += (w[k] || 0); });
      return Math.round(U.clamp(total ? sum / total : 0, 20, 99));
    },

    // the overall you would have if every attribute reached its drafted ceiling
    potentialOverall(p) {
      return State.overall({ attrs: p.caps, pos: p.pos });
    },

    /* Build a player out of the attributes robbed during the draft.
       Each stolen number becomes the ceiling for that attribute; you start at
       roughly half of it and spend a career climbing. */
    createPlayer(opts) {
      const pos = opts.pos;
      const caps = {}, attrs = {};
      const ratio = D.CONFIG.DRAFT_START_RATIO;
      D.ATTR_KEYS.forEach(k => {
        const stolen = opts.caps && opts.caps[k];
        caps[k] = U.clamp(Math.round(stolen != null ? stolen : U.int(58, 72)), 30, 99);
        attrs[k] = U.clamp(Math.round(caps[k] * ratio + U.rnd(-3, 4)), 22, 82);
      });
      if (pos !== 'GK') { caps.gk = U.int(14, 24); attrs.gk = U.int(10, 18); }
      else if (!opts.caps || opts.caps.shooting == null) { caps.shooting = U.int(28, 44); attrs.shooting = U.int(18, 30); }

      const p = {
        firstName: opts.firstName, lastName: opts.lastName,
        nation: opts.nation, pos, foot: opts.foot || 'Right',
        shirt: opts.shirt || 10,
        age: opts.age || 17,
        height: U.int(pos === 'GK' ? 185 : 168, pos === 'GK' ? 199 : 194),
        attrs, caps,
        draft: opts.draft || [],
        traits: [],
        fitness: 100, form: 60, morale: 75, managerTrust: 55,
        reputation: 3,
        club: null, contract: null,
        season: State.blankSeason(),
        career: { apps: 0, goals: 0, assists: 0, motm: 0, yellow: 0, red: 0, cleanSheets: 0,
                  trophies: [], ratingSum: 0, seasons: [], clubs: [] },
        intl: { caps: 0, goals: 0, called: false, retired: false },
        injuries: [], suspension: 0, lastInjury: null,
        achievements: [], peakOvr: 0, peakValue: 0, legacy: 0, retired: false
      };
      p.ovr = State.overall(p);
      p.potential = State.potentialOverall(p);
      p.peakOvr = p.ovr;
      return p;
    },

    blankSeason() {
      return { apps: 0, goals: 0, assists: 0, motm: 0, yellow: 0, red: 0, cleanSheets: 0,
               ratingSum: 0, minutes: 0, benched: 0 };
    },

    seasonRating(p) {
      return p.season.apps ? U.round(p.season.ratingSum / p.season.apps, 2) : 0;
    },
    careerRating(p) {
      return p.career.apps ? U.round(p.career.ratingSum / p.career.apps, 2) : 0;
    },

    // Copero tracks what the market thinks you are worth — and your peak.
    marketValue(p) {
      const o = p.ovr, pot = State.potentialOverall(p);
      let v = Math.pow(Math.max(o - 40, 1), 3.05) * 380;
      const ageF = p.age <= 21 ? 1.55 : p.age <= 25 ? 1.3 : p.age <= 28 ? 1.0
                 : p.age <= 31 ? 0.62 : p.age <= 34 ? 0.3 : 0.12;
      v *= ageF;
      v *= 1 + Math.max(0, pot - o) * 0.022;
      v *= 0.8 + (p.form / 100) * 0.45;
      v *= 1 + p.reputation / 260;
      if (p.injuries.length) v *= 0.85;
      return Math.round(v / 10000) * 10000;
    },

    hasTrait(p, id) { return p.traits.indexOf(id) >= 0; },
    addTrait(p, id) { if (!State.hasTrait(p, id)) { p.traits.push(id); return true; } return false; },

    /* Reputation is football standing — what the game thinks of you. It comes
       from performances and trophies, never from anything off the pitch, and
       it fades if you stop earning it. */
    addReputation(p, amount) {
      const d = amount > 0 ? amount * (1 - p.reputation / 118) : amount;
      p.reputation = U.clamp(p.reputation + d, 0, 100);
      return p.reputation;
    },
    reputationBaseline(p, club) {
      return U.clamp((p.ovr - 56) * 2.6 + p.career.trophies.length * 2.5
        + (club ? club.prestige * 3 : 0) + p.career.goals * 0.05, 0, 100);
    },

    /* ---------------- new game ---------------- */
    newGame(playerOpts, clubId) {
      const world = State.buildWorld(D.CONFIG.SEASON_START_YEAR);
      const g = {
        version: 1,
        world,
        player: State.createPlayer(playerOpts),
        seasonIndex: 0,
        log: [],
        news: [],
        fixtures: [],
        fixtureIndex: 0,
        tables: {},
        cup: null,
        cont: null,
        intlTournament: null,
        weekActionsLeft: 1,
        awards: [],
        headlines: [],
        settings: { difficulty: playerOpts.difficulty || 'normal' },
        stage: 'season'
      };
      State.game = g;
      const club = world.clubs[clubId];
      Contracts.joinClub(g.player, club, Contracts.offerFor(g.player, club, true));
      return g;
    },

    log(text, kind) {
      const g = State.game; if (!g) return;
      g.log.unshift({ t: text, k: kind || 'info', season: g.world.year, id: U.id() });
      if (g.log.length > 400) g.log.length = 400;
    },
    // back-page headlines — Copero's press ticker
    news(headline, kind, source) {
      const g = State.game; if (!g) return;
      g.headlines = g.headlines || [];
      g.headlines.unshift({ t: headline, k: kind || 'info', season: g.world.year,
                            src: source || U.pick(State.PAPERS) });
      if (g.headlines.length > 80) g.headlines.length = 80;
    },
    PAPERS: ['The Back Page', 'Radio Deportiva', 'Match Weekly', 'El Diario', 'Sky Touchline',
             'The Terrace', 'Gazzetta Live', 'Kicker Daily', 'Fútbol Total'],

    /* ---------------- persistence ---------------- */
    save() {
      try {
        localStorage.setItem(D.CONFIG.SAVE_KEY, JSON.stringify(State.game));
        return true;
      } catch (e) { console.warn('save failed', e); return false; }
    },
    load() {
      try {
        const raw = localStorage.getItem(D.CONFIG.SAVE_KEY);
        if (!raw) return null;
        const g = JSON.parse(raw);
        if (!g || !g.player) return null;
        State.game = g;
        return g;
      } catch (e) { return null; }
    },
    hasSave() { try { return !!localStorage.getItem(D.CONFIG.SAVE_KEY); } catch (e) { return false; } },
    wipe() { try { localStorage.removeItem(D.CONFIG.SAVE_KEY); } catch (e) {} State.game = null; }
  };

  /* ==================== contracts & wages ==================== */
  const Contracts = {
    wageFor(p, club, rookie) {
      const gap = p.ovr - (club.rating - 6);
      let base = Math.pow(Math.max(club.rating - 45, 4), 2.3) * 14;
      base *= U.clamp(1 + gap * 0.055, 0.28, 3.4);
      base *= 1 + p.reputation / 220;
      if (rookie) base *= 0.35;
      base *= (0.85 + Math.random() * 0.3);
      return Math.max(600, Math.round(base / 100) * 100); // weekly wage
    },
    offerFor(p, club, rookie) {
      const wage = Contracts.wageFor(p, club, rookie);
      const years = rookie ? U.int(2, 3) : U.int(2, 5);
      return {
        wage, years,
        release: Math.round(State.marketValue(p) * U.rnd(1.6, 3.2) / 100000) * 100000
      };
    },
    joinClub(p, club, offer) {
      p.club = club.id;
      p.wage = offer.wage;
      p.contract = { wage: offer.wage, years: offer.years, release: offer.release,
                     signed: State.game ? State.game.world.year : 0 };
      p.managerTrust = U.clamp(52 + (p.ovr - club.rating) * 1.5, 20, 88);
      if (p.career.clubs.indexOf(club.name) < 0) p.career.clubs.push(club.name);
    }
  };

  global.State = State;
  global.Contracts = Contracts;
})(window);

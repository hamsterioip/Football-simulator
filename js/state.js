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
            league: L.id, country: L.country, flag: L.flag,
            morale: 70, form: [], trophies: 0
          };
          return id;
        });
        return { id: L.id, name: L.name, country: L.country, flag: L.flag, tier: L.tier,
                 cup: L.cup, cont: L.cont, clubs: ids };
      });
      return { year: startYear, clubs, leagues };
    },

    league(id) { return this.game.world.leagues.find(l => l.id === id); },
    club(id) { return this.game.world.clubs[id]; },
    clubsOf(leagueId) { return this.league(leagueId).clubs.map(id => this.club(id)); },

    /* ---------------- player ---------------- */
    baseAttrsFor(pos, quality) {
      // quality ~ 0..1 how good the starting kid is
      const base = 38 + quality * 22;
      const a = {};
      D.ATTR_KEYS.forEach(k => { a[k] = Math.round(U.clamp(base + U.gauss(0, 7) - 6, 20, 78)); });
      const w = D.POSITIONS[pos].w;
      // boost the position-relevant attributes
      D.ATTR_KEYS.forEach(k => {
        a[k] = Math.round(U.clamp(a[k] + (w[k] || 0) * 42, 20, 88));
      });
      if (pos !== 'GK') a.gk = U.int(8, 18);
      else { a.gk = Math.round(U.clamp(base + 12 + U.gauss(0, 5), 30, 85)); a.shooting = U.int(15, 30); }
      return a;
    },

    overall(p, pos) {
      const w = D.POSITIONS[pos || p.pos].w;
      let sum = 0;
      D.ATTR_KEYS.forEach(k => sum += (p.attrs[k] || 0) * (w[k] || 0));
      return Math.round(U.clamp(sum, 20, 99));
    },

    createPlayer(opts) {
      const pos = opts.pos;
      const quality = opts.quality != null ? opts.quality : 0.5;
      const p = {
        firstName: opts.firstName, lastName: opts.lastName,
        nation: opts.nation, pos, foot: opts.foot || 'Right',
        age: opts.age || 17,
        height: U.int(pos === 'GK' ? 185 : 168, pos === 'GK' ? 199 : 194),
        attrs: State.baseAttrsFor(pos, quality),
        traits: [],
        fitness: 100, form: 60, morale: 75, happiness: 70, managerTrust: 55,
        fame: 3, discipline: 70, health: 95, followers: 1200,
        money: 25000, wage: 0,
        club: null, contract: null,
        season: State.blankSeason(),
        career: { apps: 0, goals: 0, assists: 0, motm: 0, yellow: 0, red: 0, cleanSheets: 0,
                  trophies: [], ratingSum: 0, seasons: [] },
        intl: { caps: 0, goals: 0, called: false, retired: false },
        relationships: [], assets: [], investments: [], sponsors: [],
        injuries: [], suspension: 0, lastInjury: null,
        achievements: [], legacy: 0, retired: false
      };
      p.potential = U.clamp(State.overall(p) + U.int(12, 30) + Math.round(quality * 14), 58, 99);
      p.ovr = State.overall(p);
      return p;
    },

    blankSeason() {
      return { apps: 0, goals: 0, assists: 0, motm: 0, yellow: 0, red: 0, cleanSheets: 0,
               ratingSum: 0, minutes: 0, benched: 0, keyMoments: 0, earned: 0 };
    },

    seasonRating(p) {
      return p.season.apps ? U.round(p.season.ratingSum / p.season.apps, 2) : 0;
    },
    careerRating(p) {
      return p.career.apps ? U.round(p.career.ratingSum / p.career.apps, 2) : 0;
    },

    marketValue(p) {
      const o = p.ovr, pot = p.potential;
      let v = Math.pow(Math.max(o - 40, 1), 3.05) * 62;
      const ageF = p.age <= 21 ? 1.55 : p.age <= 25 ? 1.3 : p.age <= 28 ? 1.0
                 : p.age <= 31 ? 0.62 : p.age <= 34 ? 0.3 : 0.12;
      v *= ageF;
      v *= 1 + Math.max(0, pot - o) * 0.022;
      v *= 0.8 + (p.form / 100) * 0.45;
      v *= 1 + p.fame / 260;
      if (p.injuries.length) v *= 0.85;
      return Math.round(v / 10000) * 10000;
    },

    hasTrait(p, id) { return p.traits.indexOf(id) >= 0; },
    addTrait(p, id) { if (!State.hasTrait(p, id)) { p.traits.push(id); return true; } return false; },

    addMoney(p, amount) { p.money = Math.max(0, p.money + amount); },

    // Fame has heavy diminishing returns — going from 80 to 90 is far harder
    // than going from 10 to 20, and you cannot be famous for nothing.
    addFame(p, amount) {
      const d = amount > 0 ? amount * (1 - p.fame / 118) : amount;
      p.fame = U.clamp(p.fame + d, 0, 100);
      return p.fame;
    },
    // Follower growth saturates as the audience gets huge
    addFollowers(p, ratePct, flat) {
      const sat = 1 - U.clamp(p.followers / 90000000, 0, 0.96);
      p.followers = Math.round(p.followers * (1 + (ratePct || 0) * sat) + (flat || 0) * sat);
      return p.followers;
    },
    fameBaseline(p, club) {
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
        history: [],
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
    news(headline, kind) {
      const g = State.game; if (!g) return;
      g.news.unshift({ t: headline, k: kind || 'info', season: g.world.year });
      if (g.news.length > 60) g.news.length = 60;
    },

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
      base *= 1 + p.fame / 220;
      if (rookie) base *= 0.35;
      base *= (0.85 + Math.random() * 0.3);
      return Math.max(600, Math.round(base / 100) * 100); // weekly wage
    },
    offerFor(p, club, rookie) {
      const wage = Contracts.wageFor(p, club, rookie);
      const years = rookie ? U.int(2, 3) : U.int(2, 5);
      return {
        wage, years,
        signingBonus: Math.round(wage * U.int(4, 30)),
        release: Math.round(State.marketValue(p) * U.rnd(1.6, 3.2) / 100000) * 100000,
        goalBonus: Math.round(wage * U.rnd(0.5, 2.5))
      };
    },
    joinClub(p, club, offer) {
      p.club = club.id;
      p.wage = offer.wage;
      p.contract = { wage: offer.wage, years: offer.years, release: offer.release,
                     goalBonus: offer.goalBonus, signed: State.game ? State.game.world.year : 0 };
      p.managerTrust = U.clamp(52 + (p.ovr - club.rating) * 1.5, 20, 88);
      p.happiness = U.clamp(p.happiness + 6, 0, 100);
      if (offer.signingBonus) State.addMoney(p, offer.signingBonus);
    }
  };

  global.State = State;
  global.Contracts = Contracts;
})(window);

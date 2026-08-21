/* ==========================================================================
   state.js — game state: world creation, player creation, save/load, derived
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U;

  const State = {
    game: null,

    /* ---------------- world ---------------- */
    buildWorld(startYear, eraId) {
      const era = Eras.byId(eraId || 'modern');
      const clubs = {};
      const leagues = D.LEAGUES.map(L => {
        const ids = L.clubs.map(([name, rating, prestige]) => {
          const id = L.id + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
          const eraRating = Eras.ratingFor(era, name, rating);
          clubs[id] = {
            id, name, rating: eraRating, baseRating: eraRating, prestige,
            league: L.id, country: L.country,
            morale: 70, form: [], trophies: 0
          };
          return id;
        });
        return { id: L.id, name: L.name, country: L.country, tier: L.tier,
                 cup: L.cup, cont: L.cont, clubs: ids };
      });
      return { year: era.startYear || startYear, clubs, leagues, era: era.id };
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
      const era = (playerOpts && playerOpts.era) || 'modern';
      const world = State.buildWorld(D.CONFIG.SEASON_START_YEAR, era);
      const g = {
        version: 1,
        world, era,
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
    news(headline, kind, source, icon) {
      const g = State.game; if (!g) return;
      g.headlines = g.headlines || [];
      g.headlines.unshift({ t: headline, k: kind || 'info', season: g.world.year,
                            src: source || U.pick(State.PAPERS), ic: icon || State.newsIcon(headline) });
      if (g.headlines.length > 140) g.headlines.length = 140;
    },
    // pick an icon for a headline nobody gave one to
    newsIcon(t) {
      const s = String(t).toLowerCase();
      const MAP = [
        ['hat-trick', 'ball'], ['brace', 'ball'], ['in a row', 'ball'], ['streak', 'ball'],
        ['game running', 'ball'], ['on target', 'goal'], ['wondergoal', 'goal'],
        ['goal of the', 'goal'], ['on the scoresheet', 'goal'],
        ['done deal', 'transfer'], ['new deal', 'contract'], ['sign', 'contract'], ['loan', 'transfer'],
        ['window', 'transfer'], ['on the move', 'transfer'], ['circle', 'transfer'], ['clause', 'contract'],
        ['champions', 'trophy'], ['lifts', 'trophy'], ['title', 'trophy'], ['cup', 'trophy'],
        ['ballon', 'star'], ['world player', 'star'], ['shortlist', 'star'], ['world xi', 'star'],
        ['player of the', 'medal'], ['named', 'medal'], ['award', 'medal'], ['golden boot', 'goldenboot'],
        ['call-up', 'nation'], ['allegiance', 'nation'], ['caps', 'nation'], ['national', 'nation'],
        ['sent off', 'card'], ['seeing red', 'card'], ['red card', 'card'], ['charged', 'whistle'],
        ['suffers', 'injury'], ['injur', 'injury'], ['weeks out', 'hospital'], ['scan', 'hospital'],
        ['returns', 'fitness'], ['back in training', 'fitness'],
        ['armband', 'crown'], ['captain', 'crown'],
        ['debut', 'academy'], ['year-old', 'academy'], ['wonderkid', 'academy'],
        ['retir', 'exit'], ['hangs up', 'exit'], ['an era', 'exit'],
        ['record', 'legacy'], ['milestone', 'legacy'], ['appearances', 'legacy'], ['centur', 'legacy'],
        ['promise', 'fans'], ['fans', 'fans'], ['terrace', 'fans'], ['badge', 'fans'],
        ['sacked', 'manager'], ['manager', 'manager'],
        ['rumour', 'microphone'], ['press', 'microphone'], ['leak', 'microphone']
      ];
      for (const [k, ic] of MAP) if (s.indexOf(k) >= 0) return ic;
      return 'news';
    },
    PAPERS: ['The Back Page', 'Radio Deportiva', 'Match Weekly', 'El Diario', 'Sky Touchline',
             'The Terrace', 'Gazzetta Live', 'Kicker Daily', 'Fútbol Total'],

    /* ---------------- persistence ---------------- */    save() {
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

  /* ==================== eras ====================
     Resolves which real players belong to which club for the era being played,
     and how strong every club is in that world. */
  const Eras = {
    byId(id) { return D.ERAS.find(e => e.id === id) || D.ERAS[0]; },

    /* club name -> [[name, nation, pos, ovr, age], …] for this era.
       In the Golden Era the assigned legends are placed first, then the spares
       are dealt round-robin across every remaining club, so nowhere is easy. */
    starMap(eraId, world) {
      const era = Eras.byId(eraId);
      const base = D[era.stars] || {};
      if (!era.spare) return base;

      const map = {};
      Object.keys(base).forEach(k => { map[k] = base[k].slice(); });

      const clubs = Object.values(world.clubs).map(c => c.name);
      // biggest clubs first, so the greatest spares land where they belong
      const ranked = Object.values(world.clubs).sort((a, b) => b.rating - a.rating).map(c => c.name);
      const spare = D.GOLDEN_SPARE.slice();
      let i = 0;
      // fill every club up to six, dealing round-robin from the strongest down
      for (let pass = 0; pass < 6 && i < spare.length; pass++) {
        for (let c = 0; c < ranked.length && i < spare.length; c++) {
          const name = ranked[c];
          map[name] = map[name] || [];
          if (map[name].length > pass) continue;
          map[name].push(spare[i++]);
        }
      }
      clubs.forEach(n => { map[n] = map[n] || []; });
      return map;
    },

    // what a club is worth in this era
    ratingFor(era, clubName, baseRating) {
      if (era.id === 'classic') {
        const r = D.CLASSIC_RATINGS[clubName];
        return r != null ? r : U.clamp(Math.round(baseRating - 4), 52, 92);
      }
      if (era.id === 'golden') {
        return U.clamp(Math.round(Math.max(era.ratingFloor, baseRating + era.ratingBoost)), 60, 97);
      }
      return baseRating;
    },

    // the star list for one club, in the era the game is being played in
    starsFor(g, clubName) {
      if (!g) return (D.REAL_STARS || {})[clubName];
      if (!g._starMap || g._starMapEra !== g.era) {
        g._starMap = Eras.starMap(g.era, g.world);
        g._starMapEra = g.era;
      }
      return g._starMap[clubName];
    }
  };

  global.Eras = Eras;

  /* ==================== player names ====================
     A club's squad is mostly local with a scattering of imports, and every
     player's name matches the country he is from. That consistency is what
     makes a squad list read as real. */
  const Names = {
    pick(country) {
      const pool = D.NAMES[country] || D.NAMES.England;
      return U.pick(pool.first) + ' ' + U.pick(pool.last);
    },
    // choose where a player at this club is from
    nationFor(clubCountry) {
      const imports = D.IMPORT_POOLS[clubCountry] || [];
      const r = Math.random();
      if (r < 0.62 && D.NAMES[clubCountry]) return clubCountry;
      if (r < 0.9 && imports.length) return U.pick(imports);
      const all = Object.keys(D.NAMES);
      return U.pick(all);
    },
    // a full player identity for a squad member or a rival
    person(clubCountry) {
      const nation = Names.nationFor(clubCountry);
      return { name: Names.pick(nation), nation };
    }
  };

  global.Names = Names;

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
      // a clause always has to be worth more than the contract itself
      const floor = Math.max(wage * 52 * 3, 1000000);
      return {
        wage, years,
        release: Math.max(floor, Math.round(State.marketValue(p) * U.rnd(1.6, 3.2) / 100000) * 100000)
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

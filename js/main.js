/* ==========================================================================
   main.js — game flow controller: match loop, weeks, seasons, transfers,
   retirement
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U, State = global.State, Engine = global.Engine,
        Career = global.Career, UI = global.UI, Scenarios = global.Scenarios;
  const ico = (n, c) => global.Icons.svg(n, c);
  const $ = id => document.getElementById(id);

  /* Living world: the era data files are static, so everything that changes
     about the wider game — stars ageing, retiring, home-grown kids breaking
     through — is layered on here, at the one place the world reads its star
     lists. Press rumours, squad overlays and the social feed all flow through
     Eras.starMap, so filtering here hides a retired great from all of them.
     The mutable bits live on g.world (starAges / retiredStars / youngsters)
     so they serialise with the save. */
  const staticStarMap = global.Eras.starMap;
  global.Eras.starMap = function (eraId, world) {
    const map = staticStarMap.call(global.Eras, eraId, world);
    const g = State.game;
    if (!g || !g.world) return map;
    const off = g.world.starAges, retired = g.world.retiredStars, kids = g.world.youngsters;
    if (!off && !retired && !kids) return map;
    const out = {};
    Object.keys(map).forEach(k => {
      out[k] = (map[k] || [])
        .filter(s => !retired || retired.indexOf(s[0]) < 0)
        .map(s => {
          const extra = (off && off[s[0]]) || 0;
          if (!extra) return s;
          const c = s.slice(); c[4] += extra; return c;
        });
    });
    (kids || []).forEach(y => {
      if (!y.star || (retired && retired.indexOf(y.name) >= 0)) return;
      (out[y.club] = out[y.club] || []).push([y.name, y.nation, y.pos, y.ovr, y.age]);
    });
    return out;
  };

  const Game = {
    match: null,
    timer: null,

    /* ==================== boot ==================== */
    init() {
      global.Icons.inject();          // the SVG sprite every icon points at
      $('btn-new').onclick = () => UI.startWizard();
      $('btn-continue').onclick = () => Game.continueGame();
      $('btn-how').onclick = () => Game.howToPlay();
      const mb = $('btn-manager'); if (mb) mb.onclick = () => Game.managerStart();
      $('create-back').onclick = () => Game.wizardBack();
      $('create-next').onclick = () => Game.wizardNext();
      $('modal-back').onclick = e => { if (e.target === $('modal-back')) { /* click-off does nothing */ } };
      $('btn-continue').disabled = !State.hasSave();
      // the same button resumes either mode, so it should say which one is waiting
      try {
        const raw = localStorage.getItem(D.CONFIG.SAVE_KEY);
        if (raw && /"mode":"manager"/.test(raw)) $('btn-continue').textContent = 'Continue Managing';
      } catch (e) {}
      // the build stamp, so it is obvious which version you are playing
      const vt = document.getElementById('ver-text');
      if (vt) vt.textContent = 'v' + D.CONFIG.VERSION + ' · ' + D.CONFIG.BUILD;
      const vb = document.getElementById('btn-ver');
      if (vb) vb.onclick = () => Game.whatsNew();
      Game.startMarquee();
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') UI.closeModal();
        // typing the code anywhere also works, for anyone on a keyboard
        if (!State.game || State.game.secret) return;
        if (document.getElementById('code-in')) return;
        if (e.key && e.key.length === 1) {
          Game._typed = ((Game._typed || '') + e.key.toLowerCase()).slice(-8);
          if (Game._typed.indexOf('gkgo') >= 0) { Game._typed = ''; Game.codePrompt(); }
        }
      });
    },

    /* scrolling club-crest strips on the start screen */
    startMarquee() {
      const imgs = global.BADGE_IMGS || {};
      const keys = Object.keys(imgs);
      if (!keys.length) return;
      const shuffled = keys.slice().sort(() => Math.random() - 0.5);
      const fill = (id, list) => {
        const track = $(id);
        if (!track) return;
        // duplicate the set so the -50% scroll loops seamlessly
        track.innerHTML = list.concat(list)
          .map(k => `<img src="${imgs[k]}" alt="" loading="eager">`).join('');
      };
      fill('mq-top', shuffled.slice(0, 18));
      fill('mq-bot', shuffled.slice(18, 36));
    },

    howToPlay() {
      UI.modal({
        title: 'How to play',
        html: `<p class="muted">One player. One career. From the draft to the day you stop.</p>
        <div class="list">
          <div class="item"><div class="ic">${ico('legend')}</div><div class="tx"><b>Rob the legends</b><span>Eight greats file past you at the start. Take one attribute from each — what you take becomes your ceiling in it.</span></div></div>
          <div class="item"><div class="ic">${ico('ball')}</div><div class="tx"><b>Play the moments</b><span>Matches stop for the decisions that matter: shoot or square it, nutmeg or keep it simple, slide in or stay on your feet. You take the penalties.</span></div></div>
          <div class="item"><div class="ic">${ico('train')}</div><div class="tx"><b>Train towards your ceiling</b><span>Good decisions and hard sessions push each attribute up — but never past what you drafted.</span></div></div>
          <div class="item"><div class="ic">${ico('transfer')}</div><div class="tx"><b>Move clubs</b><span>Perform and bigger badges come calling. Every summer you choose the next chapter.</span></div></div>
          <div class="item"><div class="ic">${ico('legacy')}</div><div class="tx"><b>Leave a legacy</b><span>Titles, caps, peak rating, peak value — and how the game remembers you.</span></div></div>
        </div>
        <p class="muted" style="margin-top:14px">Or take the other seat.</p>
        <div class="list">
          <div class="item"><div class="ic">${ico('manager')}</div><div class="tx"><b>Manager Mode</b><span>Take a club, pick the shape and the eleven, sign and sell in the market, and talk to them before kick-off. The board judge you on the table — hit the target and they raise it, miss it badly enough and you are out on your ear looking for a smaller job.</span></div></div>
        </div>`,
        actions: [{ label: 'Got it' }]
      });
    },

    continueGame() {
      const g = State.load();
      if (!g) { UI.toast('No saved game found.', 'bad'); return; }
      g._starMap = null;   // rebuild star lists through the living-world filter
      if (g.mode === 'manager') {
        global.Manager.migrate(g);
        UI.show('game');
        global.MUI.tab = 'mhome';
        UI.render();
        UI.toast('Back in the dugout.', 'good');
        return;
      }
      Engine.Squad.ensure(g);
      UI.show('game');
      UI.tab = 'home';
      UI.render();
      UI.toast('Career loaded.', 'good');
    },

    /* ==================== creation wizard ==================== */
    wizardBack() {
      const w = UI.wizard;
      if (!w || w.step === 0) { UI.show('start'); return; }
      if (w.step === 3 && w.draftIndex > 0) {   // undo the last steal
        const undo = w.robbed.pop();
        if (undo) delete w.caps[undo.attr];
        w.draftIndex--;
        return UI.renderWizard();
      }
      if (w.step === 4) { w.step = 3; w.draftPool = null; return UI.renderWizard(); }
      w.step--; UI.renderWizard();
    },
    wizardNext() {
      const w = UI.wizard;
      if (w.step === 1) {
        w.firstName = (w.firstName || '').trim() || U.pick(D.FIRST_NAMES);
        w.lastName = (w.lastName || '').trim() || U.pick(D.LAST_NAMES);
      }
      if (w.step === 3) return;            // the draft advances itself, pick by pick
      if (w.step < 4) { w.step++; UI.renderWizard(); return; }
      Game.startLeagueChoice();
    },

    /* ---------- starting path ----------
       The last wizard screen lists every club that would take you; this is
       the short, story version of that choice: four of the weakest leagues,
       each a different way up. Picking one draws your first club at random
       from that league's smallest sides. */
    // the same gate the club list uses, scoped to one league's smallest clubs
    starterClubFor(world, leagueId, maxRating) {
      const league = world.leagues.find(l => l.id === leagueId);
      if (!league) return null;
      const clubs = league.clubs.map(id => world.clubs[id]).sort((a, b) => a.rating - b.rating);
      const eligible = clubs.filter(c => c.rating <= maxRating);
      return U.pick((eligible.length ? eligible : clubs).slice(0, 3));
    },

    startLeagueChoice() {
      const w = UI.wizard;
      const world = UI.previewWorld || State.buildWorld(D.CONFIG.SEASON_START_YEAR, w.era);
      UI.previewWorld = world;
      const preview = w.preview || State.createPlayer({
        firstName: w.firstName, lastName: w.lastName, nation: w.nation,
        pos: w.pos, foot: w.foot, shirt: w.shirt, age: 17, caps: w.caps, draft: w.robbed
      });
      // mirrors the wizard's club gate: how big a badge will gamble on a teenager
      const ratings = Object.values(world.clubs).map(c => c.rating);
      const lo = Math.min.apply(null, ratings), hi = Math.max.apply(null, ratings);
      const maxRating = Math.round(lo + (hi - lo) * U.clamp((State.potentialOverall(preview) - 55) / 40, 0, 1)) + 2;

      let html = '';
      if (w.clubId && world.clubs[w.clubId]) {
        const c = world.clubs[w.clubId];
        html += `<div class="item click" data-sp="keep"><div class="ic">${global.Crest.svg(c.name, 'crest-md')}</div><div class="tx">
          <b>Sign for ${U.esc(c.name)}</b><span>Your pick from the list — rated ${c.rating}.</span></div></div>`;
      }
      D.START_PATHS.forEach(sp => {
        const L = world.leagues.find(l => l.id === sp.league);
        if (!L) return;
        html += `<div class="item click" data-sp="${sp.league}"><div class="ic">${ico('club')}</div><div class="tx">
          <b>${U.esc(L.name)} — ${U.esc(L.country)}</b><span>${U.esc(sp.blurb)}</span></div></div>`;
      });

      UI.modal({
        title: 'Choose your starting path',
        html: `<p class="muted">Seven leagues, seven ways up. Pick one and one of its smaller
          clubs hands you a first contract — the rest is on you.</p><div class="list">${html}</div>`,
        actions: [{ label: 'Back', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-sp]').forEach(el => el.onclick = () => {
            const id = el.dataset.sp;
            if (id !== 'keep') {
              const club = Game.starterClubFor(world, id, maxRating);
              if (!club) return;
              w.clubId = club.id;
            }
            UI.closeModal();
            Game.startCareer();
          });
        }
      });
    },

    startCareer() {
      const w = UI.wizard;
      const g = State.newGame({
        firstName: w.firstName, lastName: w.lastName, nation: w.nation,
        pos: w.pos, foot: w.foot, shirt: w.shirt, age: 17,
        caps: w.caps, draft: w.robbed, era: w.era
      }, w.clubId);
      g.settings.matchLength = 'normal';
      g.contQualified = false;
      Engine.Squad.ensure(g);
      Engine.Season.build(g);
      g.weekActionsLeft = 1;
      const club = State.club(g.player.club);
      State.log(`You sign your first professional contract with ${club.name}.`, 'good');
      State.news(`${club.name} hand a first deal to 17-year-old ${g.player.firstName} ${g.player.lastName}`, 'good');
      State.save();
      UI.show('game');
      UI.tab = 'home';
      UI.render();
      UI.modal({
        title: 'Welcome to the first team',
        text: `${g.player.firstName} ${g.player.lastName}, ${g.player.age}, ${D.POSITIONS[g.player.pos].name} for ${club.name}.\n\nOverall ${g.player.ovr}, ceiling ${State.potentialOverall(g.player)}.\nSquad number ${g.player.shirt} · ${U.cash(g.player.contract.wage)}/week for ${g.player.contract.years} years.\n\nThe manager says you will get your chance. The rest is on you.`,
        actions: [{ label: "Let's go" }]
      });
    },

    /* ==================== the code ====================
       Five taps on the overall badge asks for a code. The right one unlocks
       Boss Mode, which then lives in the save like anything else. */
    secretTap() {
      const g = State.game;
      if (!g) return;
      if (g.secret) { UI.tab = 'secret'; UI.render(); return; }
      const now = Date.now();
      if (!Game._taps || now - Game._lastTap > 1500) Game._taps = 0;
      Game._lastTap = now;
      Game._taps++;
      if (Game._taps >= 5) { Game._taps = 0; Game.codePrompt(); }
      else if (Game._taps >= 3) UI.toast('…', '');
    },

    codePrompt() {
      UI.modal({
        title: 'Enter code',
        html: `<p class="muted">If you know it, you know it.</p>
          <input class="input" id="code-in" autocomplete="off" autocapitalize="off"
            spellcheck="false" placeholder="• • • •" maxlength="16"
            style="text-align:center;letter-spacing:4px;font-weight:700">`,
        actions: [
          { label: 'Enter', keepOpen: true, onClick: () => Game.trySecret() },
          { label: 'Cancel', cls: 'btn-ghost' }
        ],
        onRender(m) {
          const input = m.querySelector('#code-in');
          if (!input) return;
          setTimeout(() => input.focus(), 60);
          input.onkeydown = e => { if (e.key === 'Enter') Game.trySecret(); };
        }
      });
    },

    trySecret() {
      const el = document.getElementById('code-in');
      const value = (el ? el.value : '').trim().toLowerCase();
      if (value !== 'gkgo') {
        if (el) { el.value = ''; el.placeholder = 'nope'; }
        UI.toast('Wrong code.', 'bad');
        return;
      }
      UI.closeModal();
      const g = State.game;
      g.secret = true;
      State.save();
      const boss = g.mode === 'manager';
      if (boss) { global.MUI.tab = 'mboss'; global.MUI.render(); }
      else { UI.tab = 'secret'; UI.render(); }
      UI.modal({
        title: 'Boss Mode unlocked',
        text: boss
          ? 'A new tab has appeared. The money, the board, the squad, the backroom, the table — all of it is yours to change.\n\nIt stays unlocked in this save.'
          : 'A new tab has appeared. Attributes, ceilings, traits, condition, your club — all of it is yours to change.\n\nIt stays unlocked in this save.',
        actions: [{ label: 'Let me at it' }]
      });
    },

    /* ==================== the code, in the dugout ====================
       Same five taps, same code — but the badge here is the team rating, and
       what it unlocks is a manager's set of levers rather than a player's. */
    mgrSecretTap() {
      const g = State.game;
      if (!g || !g.mgr) return;
      if (g.secret) { global.MUI.tab = 'mboss'; global.MUI.render(); return; }
      const now = Date.now();
      if (!Game._taps || now - Game._lastTap > 1500) Game._taps = 0;
      Game._lastTap = now;
      Game._taps++;
      if (Game._taps >= 5) { Game._taps = 0; Game.codePrompt(); }
      else if (Game._taps >= 3) UI.toast('…', '');
    },

    /* ==================== Boss Mode, manager side ==================== */
    mgrDevAction(act, arg) {
      const g = State.game;
      const M = global.Manager;
      const club = State.club(g.mgr.club);
      const num = () => parseInt(arg, 10);
      const reprice = s => {
        s.value = M.valueFor(s);
        s.wage = M.wageFor(s);
      };
      switch (act) {
        case 'mdevBudget': g.mgr.budget = num(); break;
        case 'mdevWages': g.mgr.wageBudget = num(); break;
        case 'mdevConf': g.mgr.board.confidence = U.clamp(num(), 0, 100); break;

        case 'mdevClubRating': {
          const to = arg === 'max' ? 93 : U.clamp(club.rating + num(), 55, 93);
          club.baseRating = to;
          club.drift = 0;
          club.rating = to;
          break;
        }
        case 'mdevTarget':
          g.mgr.board.target = { pos: State.league(club.league).clubs.length,
            text: 'Nobody is asking you for anything. Enjoy yourself.' };
          UI.toast('The board have stopped asking.', 'gold');
          break;
        case 'mdevTrophy':
          g.mgr.trophies.push({ name: State.league(club.league).name + ' Title',
                                year: g.world.year + 1, kind: 'league' });
          UI.toast('Title added to the cabinet.', 'gold');
          break;
        case 'mdevAward':
          g.mgr.awards = (g.mgr.awards || []).concat({ kind: 'mots',
            name: 'Manager of the Season', who: null, year: g.world.year,
            club: club.name, note: 'Because you said so' });
          UI.toast('Award added.', 'gold');
          break;

        case 'mdevSquadOvr':
          g.squad.forEach(s => { s.ovr = U.clamp(num(), 40, 99); reprice(s); });
          UI.toast(`Every player is now ${num()}.`, 'gold');
          break;
        case 'mdevHeal':
          g.squad.forEach(s => { s.out = null; s.ban = 0; s.banWhy = null; s.yellows = 0; });
          M.repairXI(g);
          UI.toast('Treatment room empty, nobody suspended.', 'good');
          break;
        case 'mdevFresh':
          g.squad.forEach(s => { s.fit = 100; s.form = 100; });
          UI.toast('Everybody fresh and flying.', 'good');
          break;
        case 'mdevDeals':
          g.squad.forEach(s => { s.deal = M.DEAL_LONG; s.renewTries = 0; });
          UI.toast('Five years on every contract.', 'good');
          break;
        case 'mdevSettle':
          g.squad.forEach(s => { s.unsettled = 0; });
          g.mgr.bids = [];
          UI.toast('Nobody is agitating for a move.', 'good');
          break;
        case 'mdevYoung':
          g.squad.forEach(s => { s.age = 23; reprice(s); });
          UI.toast('The whole squad is 23.', 'gold');
          break;
        case 'mdevPlayer': return Game.mgrDevPlayer(arg);

        case 'mdevStaff': {
          if (arg === 'none') {
            g.mgr.staff = {};
            UI.toast('The backroom is empty.', '');
            break;
          }
          const roles = arg === 'all' ? M.STAFF_ROLES : [M.staffRole(arg)];
          roles.forEach(r => {
            const who = global.Names.person(club.country);
            g.mgr.staff = g.mgr.staff || {};
            g.mgr.staff[r.id] = { name: who.name, nation: who.nation, rating: 99,
                                  wage: 0, since: g.world.year };
          });
          UI.toast(roles.length === 1 ? `${roles[0].name} hired.` : 'Best in the world, all six.', 'gold');
          break;
        }

        case 'mdevTop':
        case 'mdevBottom': {
          const table = g.tables[club.league];
          if (!table) break;
          const rows = Object.keys(table).map(id => table[id].pts);
          const best = Math.max.apply(null, rows), worst = Math.min.apply(null, rows);
          const me = table[club.id];
          if (!me) break;
          // the table is the truth every other screen reads, so move the points
          me.pts = act === 'mdevTop' ? best + 30 : Math.max(worst - 30, 0);
          me.w = act === 'mdevTop' ? Math.max(me.w, Math.round(me.pts / 3)) : 0;
          me.gf = act === 'mdevTop' ? Math.max(me.gf, me.ga + 60) : me.gf;
          me.ga = act === 'mdevTop' ? me.ga : Math.max(me.ga, me.gf + 60);
          UI.toast(act === 'mdevTop' ? 'Top of the league.' : 'Bottom of the league.',
            act === 'mdevTop' ? 'gold' : 'bad');
          break;
        }
        case 'mdevCups': {
          const alive = (g.mgr.cups || []).filter(c => c.alive);
          alive.forEach(c => {
            c.alive = false; c.won = true;
            g.mgr.trophies.push({ name: c.name, year: g.world.year + 1, kind: 'cup' });
            State.news(`${club.name} win the ${c.name}`, 'good', null, 'trophy');
          });
          UI.toast(alive.length ? `${alive.length} cup${alive.length === 1 ? '' : 's'} won.` : 'No cups left to win.',
            alive.length ? 'gold' : '');
          break;
        }
        case 'mdevEndSeason':
          g.mgr.round = (g.mgr.calendar || []).length;
          global.MUI.tab = 'mhome';
          UI.toast('Season over. Go and see the board.', '');
          break;

        case 'mdevFreeMarket':
          M.market(g).forEach(s => { s.ask = 0; s.free = true; });
          g.mgr.marketCache = (g.mgr.marketCache || []).map(s => {
            s.ask = 0; s.free = true; return s;
          });
          UI.toast('Everybody on the market is free.', 'gold');
          break;
        case 'mdevBids': {
          let fresh = M.incomingBids(g, 3);
          /* Cheat your club to the top and your squad to 99 and nobody in the
             world qualifies to bid any more — which is correct, and useless on
             a menu whose whole job is to make things happen. So force it. */
          if (!fresh.length) {
            const buyers = Object.values(g.world.clubs)
              .filter(c => c.id !== club.id).sort((a, b) => b.rating - a.rating).slice(0, 8);
            fresh = g.squad.slice().sort((a, b) => (b.value || 0) - (a.value || 0)).slice(0, 3)
              .map((p, i) => {
                const from = buyers[i % buyers.length];
                const worth = (p.value || 1000000) * M.dealPriceMul(p);
                const open = Math.round(worth * U.rnd(0.62, 0.92) / 50000) * 50000;
                return { id: U.id(), playerId: p.id, name: p.name, pos: p.pos, ovr: p.ovr,
                  age: p.age, fromId: from.id, fromName: from.name, fromRating: from.rating,
                  fee: open, ceiling: Math.round(worth * 1.25 / 50000) * 50000,
                  wage: Math.round(p.wage * 1.4 / 1000) * 1000, want: 1.2,
                  line: U.pick(M.BID_LINES), patience: 2,
                  year: g.world.year, round: g.mgr.round };
              });
          }
          g.mgr.bids = (g.mgr.bids || []).concat(fresh);
          UI.toast(fresh.length ? `${fresh.length} offer${fresh.length === 1 ? '' : 's'} on the table.`
            : 'You have nobody to sell.', fresh.length ? 'good' : '');
          break;
        }
        case 'mdevOffers': {
          Game._mgrOffers = Object.values(g.world.clubs)
            .filter(c => c.id !== club.id)
            .sort((a, b) => b.rating - a.rating).slice(0, 5)
            .map(c => ({ clubId: c.id, name: c.name, rating: c.rating,
              league: State.league(c.league).name,
              budget: Math.round(Math.pow(Math.max(c.rating - 50, 3), 2.6) * 9000 / 500000) * 500000,
              pitch: 'They will not take no for an answer.' }));
          g.mgr.offers = Game._mgrOffers;
          State.save();
          return Game.mgrOffersModal();
        }

        case 'mdevTakeOver': {
          const to = State.club(arg);
          if (!to || to.id === g.mgr.club) break;
          M.moveTo(g, to.id, 'left');
          global.MUI.tab = 'mhome';
          UI.toast('You are the manager of ' + to.name + '.', 'good');
          break;
        }
        case 'mdevLock':
          g.secret = false;
          global.MUI.tab = 'moffice';
          UI.toast('Boss Mode locked.', '');
          break;
      }
      State.save();
      global.MUI.render();
    },

    /* One player, one dial. */
    mgrDevPlayer(id) {
      const g = State.game;
      const M = global.Manager;
      const s = g.squad.find(x => x.id === id);
      if (!s) return;
      const set = v => {
        s.ovr = U.clamp(v, 40, 99);
        s.value = M.valueFor(s);
        s.wage = M.wageFor(s);
        State.save();
        global.MUI.render();
        Game.mgrDevPlayer(id);
      };
      UI.modal({
        title: s.name,
        html: `<p class="muted">${U.esc(s.pos)} · ${s.age} · ${U.cash(s.wage)}/w · ${M.dealOf(s)} year${M.dealOf(s) === 1 ? '' : 's'} left · worth ${U.cash(s.value || 0)}</p>
          <div class="offer-row">
            <div class="offer-lab">Overall</div>
            <div class="offer-ctl">
              <button class="offer-btn" data-mdo="-1">−</button>
              <b>${s.ovr}</b>
              <button class="offer-btn" data-mdo="1">+</button>
            </div>
            <div class="offer-read">His value and his wages follow the number.</div>
          </div>
          <div class="row wrap">${[60, 70, 80, 90, 99].map(v =>
            `<button class="btn btn-ghost sm grow" data-mdset="${v}">${v}</button>`).join('')}</div>`,
        actions: [
          { label: 'Fit, available and happy', keepOpen: true, onClick: () => {
            s.out = null; s.ban = 0; s.banWhy = null; s.yellows = 0;
            s.fit = 100; s.form = 100; s.unsettled = 0; s.deal = M.DEAL_LONG;
            M.repairXI(g); State.save(); global.MUI.render();
            UI.toast(`${s.name} is fit, tied down and content.`, 'good');
          } },
          { label: 'Done', cls: 'btn-ghost' }
        ],
        onRender(m) {
          m.querySelectorAll('[data-mdo]').forEach(el =>
            el.onclick = () => set(s.ovr + (+el.dataset.mdo)));
          m.querySelectorAll('[data-mdset]').forEach(el =>
            el.onclick = () => set(+el.dataset.mdset));
        }
      });
    },

    /* ==================== Boss Mode actions ==================== */
    devAction(act, arg) {
      const g = State.game, p = g.player;
      const clampAttr = v => U.clamp(Math.round(v), 1, 99);
      switch (act) {
        case 'devAttr': {
          const [key, delta] = arg.split(':');
          if (delta === '99') { p.caps[key] = 99; p.attrs[key] = 99; }
          else p.attrs[key] = clampAttr((p.attrs[key] || 0) + parseInt(delta, 10));
          if (p.attrs[key] > (p.caps[key] || 0)) p.caps[key] = p.attrs[key];   // ceilings follow
          break;
        }
        case 'devOvr': {
          // scale every attribute until the positional overall lands on the target
          const target = parseInt(arg, 10);
          let guard = 0;
          while (State.overall(p) !== target && guard++ < 260) {
            const dir = State.overall(p) < target ? 1 : -1;
            const w = D.POSITIONS[p.pos].w;
            const keys = D.ATTR_KEYS.filter(k => (w[k] || 0) > 0.01)
              .filter(k => dir > 0 ? p.attrs[k] < 99 : p.attrs[k] > 1);
            if (!keys.length) break;
            keys.forEach(k => { p.attrs[k] = clampAttr(p.attrs[k] + dir); });
          }
          D.ATTR_KEYS.forEach(k => { if (p.attrs[k] > (p.caps[k] || 0)) p.caps[k] = p.attrs[k]; });
          break;
        }
        case 'devMaxCeilings': D.ATTR_KEYS.forEach(k => p.caps[k] = 99); break;
        case 'devFillCaps': D.ATTR_KEYS.forEach(k => p.attrs[k] = clampAttr(p.caps[k] || p.attrs[k])); break;
        case 'devTrait': {
          if (State.hasTrait(p, arg)) p.traits = p.traits.filter(t => t !== arg);
          else p.traits.push(arg);
          break;
        }
        case 'devStat': {
          const [key, val] = arg.split(':');
          p[key] = U.clamp(parseInt(val, 10), 0, 100);
          break;
        }
        case 'devAge': p.age = U.clamp(p.age + parseInt(arg, 10), 15, 45); break;
        case 'devShirt': Career.claimShirt(g, U.clamp(p.shirt + parseInt(arg, 10), 1, 99)); break;
        case 'devPos': p.pos = arg; break;
        case 'devHeal':
          p.injuries = []; p.suspension = 0; p.fitness = 100;
          UI.toast('Fit and available.', 'good');
          break;
        case 'devCallUp':
          p.intl.called = true; p.intl.retired = false;
          UI.toast('You are in the squad.', 'good');
          break;
        case 'devTrophy':
          p.career.trophies.push({ name: State.league(State.club(p.club).league).name + ' Title',
                                   year: g.world.year + 1, club: State.club(p.club).name });
          UI.toast('Title added.', 'gold');
          break;
        case 'devContract':
          p.contract.wage = Math.max(p.contract.wage, 500000);
          p.contract.years = 5;
          p.contract.release = Math.round(State.marketValue(p) * 4);
          UI.toast('Contract improved.', 'gold');
          break;
        case 'devClub': {
          const club = State.club(arg);
          if (!club) break;
          global.Contracts.joinClub(p, club, global.Contracts.offerFor(p, club, false));
          g.squad = null; g.squadClub = null;
          Engine.Squad.ensure(g);
          Engine.Season.build(g);
          State.log(`Boss Mode: signed for ${club.name}.`, 'info');
          UI.toast('Signed for ' + club.name, 'good');
          break;
        }
        case 'devLock':
          g.secret = false;
          UI.tab = 'player';
          UI.toast('Boss Mode locked.', '');
          break;
      }
      p.ovr = State.overall(p);
      p.potential = State.potentialOverall(p);
      p.peakOvr = Math.max(p.peakOvr || 0, p.ovr);
      State.save();
      UI.render();
    },

    /* ==================== action dispatcher ==================== */
    action(act, arg) {
      const g = State.game;
      if (act.indexOf('mdev') === 0) return Game.mgrDevAction(act, arg);
      if (act.indexOf('dev') === 0) return Game.devAction(act, arg);
      switch (act) {
        case 'playMatch': return Game.playMatch(true);
        case 'quickMatch': return Game.playMatch(false);
        case 'skip': case 'skipMenu': return Game.skipMenu();
        case 'resumeSkip': return Game.runSkip();
        case 'cancelSkip': State.game.skip = null; State.save(); UI.render();
          return UI.toast('Skip cancelled.', '');
        case 'openWeek': return Game.weekMenu();
        case 'doActivity': return Game.runActivity(arg);
        case 'trainMenu': return Game.trainMenu();
        case 'mediaMenu': return Game.mediaMenu();
        case 'endSeason': return Game.endSeason();
        case 'retire': return Game.confirmRetire();
        case 'retireIntl': return Game.confirmRetireIntl();
        case 'save': State.save(); return UI.toast('Career saved.', 'good');
        case 'newsView': UI.newsView = arg; return UI.render();
        case 'socialPost': return Game.socialPost();
        case 'celebrations': return Game.celebrationMenu();
        case 'mgrPlay': return Game.mgrTeamTalk();
        case 'mgrSim': return Game.mgrSimSeason();
        case 'mgrAuto': return Game.mgrAutoPick();
        case 'mgrSwap': return Game.mgrSwap(arg);
        case 'mgrRow': return Game.mgrRow(arg);
        case 'mgrFormation': return Game.mgrFormation();
        case 'mgrStyle': return Game.mgrStyle();
        case 'mgrFilter': return Game.mgrFilter(arg);
        case 'mgrTopMore': return Game.mgrTopMore();
        case 'mgrNewsMore': return Game.mgrNewsMore();
        case 'mgrWondersMore': return (State.game.mgr.wondersOpen = !State.game.mgr.wondersOpen,
          global.MUI.render());
        case 'mgrCard': return Game.mgrPlayerCard(arg);
        case 'mgrEra': return Game.mgrEra(arg);
        case 'mgrBid': return Game.mgrBid(arg);
        case 'mgrBidIn': Game._bidChain = false; return Game.mgrBidIn(arg);
        case 'mgrStaff': return Game.mgrStaff(arg);
        case 'mgrRenew': Game._runThen = null; return Game.mgrRenew(arg);
        case 'mgrSell': return Game.mgrSell(arg);
        case 'mgrReview': return Game.mgrReview();
        case 'mgrRehire': return Game.mgrRehire();
        case 'mgrOffers': return Game.mgrOffersModal();
        case 'mgrBids': return Game.mgrBidsModal();
        case 'mgrPost': return Game.mgrPost();
        case 'mgrResign': return Game.mgrResign();
        case 'mgrQuit': return Game.quit();
        case 'titles': return Game.titleMenu();
        case 'matchLength': return Game.matchLengthMenu();
        case 'quit': return Game.quit();
      }
    },

    /* ---------------- MANAGER MODE ---------------- */

    /* Choosing a club to take. Ordered by how hard it will be. */
    /* Which football are you managing in? Asked before anything else, because
       it decides the whole world — who plays for whom, and how good they are.
       A sacked manager skips this: he stays in the world he was working in. */
    managerStart() {
      if (Game._mgrRehire && Game._mgrWorld) return Game.managerLeagues();
      UI.modal({
        title: 'Which era?',
        html: `<p class="muted">Pick the football you want to manage in. It decides every squad
            in the world.</p>
          <div class="list">${D.ERAS.map(e => `
            <div class="item click" data-mera="${e.id}">
              <div class="ic">${ico(e.icon)}</div>
              <div class="tx"><b>${U.esc(e.name)} <span class="pill">${U.esc(e.years)}</span></b>
                <span>${U.esc(e.blurb)}</span></div>
            </div>`).join('')}</div>`,
        actions: [{ label: 'Cancel', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-mera]').forEach(el => el.onclick = () => {
            Game._mgrEra = el.dataset.mera;
            Game.managerJobs(true);
          });
        }
      });
    },

    /* ---------------- the job centre ----------------
       Nobody hands an unknown manager a title contender. Jobs come open when
       they come open, the big ones take months, and the ones you leave sitting
       get taken by somebody else. So you start small and climb — or you start
       a club of your own and build one. */
    managerJobs(fresh) {
      const M = global.Manager;
      const eraId = Game._mgrEra || 'modern';
      const era = D.ERAS.find(e => e.id === eraId) || D.ERAS[0];
      if (fresh || !Game._mgrWorld) Game._mgrWorld = State.buildWorld(era.startYear, eraId);
      const world = Game._mgrWorld;
      // State.club() is used all through the market, so it needs a game to read
      if (!State.game || State.game.world !== world) State.game = { world, settings: {} };
      if (fresh || !Game._jobs) {
        Game._jobs = M.jobMarket(world, Game._mgrCeiling || 0);
        M.jobTick(Game._jobs, world, true);
      }
      const jm = Game._jobs;

      UI.modal({
        title: jm.week === 0 ? 'Looking for a job' : `Week ${jm.week}`,
        html: `<p class="muted">${U.esc(era.name)} · ${U.esc(era.years)}. Nobody knows your name yet. Clubs rated up to <b>${jm.ceiling}</b> will talk to you today. Wait and better jobs come open — but the biggest ones never open to a manager who has not done it yet.</p>
          ${jm.news.length ? `<div class="jm-news">${jm.news.map(n =>
            `<div>${U.esc(n)}</div>`).join('')}</div>` : ''}
          <div class="row jm-wait">
            <button class="btn btn-ghost grow" data-wait="1">${ico('clock')} Wait a week</button>
            <button class="btn btn-ghost grow" data-wait="4">${ico('clock')} A month</button>
          </div>
          ${jm.open.length ? `<div class="list jm-list">${jm.open.map(v => `
            <div class="item click" data-club="${v.id}">
              <div class="ic">${global.Crest.svg(v.name, 'crest-sm')}</div>
              <div class="tx"><b>${U.esc(v.name)}<span class="pill">${v.rating}</span></b>
                <span>${U.esc(v.league)} · ${U.esc(v.reason)}</span>
                <span class="jm-since">${jm.week - v.since === 0 ? 'Just come open'
                  : `Open ${jm.week - v.since} week${jm.week - v.since === 1 ? '' : 's'}`}</span></div>
            </div>`).join('')}</div>`
            : '<p class="muted">Nothing at all this week. Sit tight.</p>'}`,
        actions: [
          { label: 'Start your own club', cls: 'btn-ghost', onClick: () => Game.managerFound() },
          { label: 'Back', cls: 'btn-ghost', onClick: () => Game.managerStart() }
        ],
        onRender(m) {
          m.querySelectorAll('[data-wait]').forEach(el => el.onclick = () => {
            const n = +el.dataset.wait;
            for (let i = 0; i < n; i++) M.jobTick(jm, world);
            Game.managerJobs();
          });
          m.querySelectorAll('[data-club]').forEach(el => el.onclick = () => {
            Game._jobs = null;
            Game.managerBegin(el.dataset.club);
          });
          UI.modalScrollHint && UI.modalScrollHint(m);
        }
      });
    },

    /* ---------------- a club of your own ---------------- */
    managerFound() {
      const world = Game._mgrWorld;
      UI.modal({
        title: 'Start your own club',
        html: `<p class="muted">Name it, pick a division, and take the place of the smallest
            club in it. You will start at the bottom with almost no money and a board
            that is you — nobody is sacking you for finishing last in year one.</p>
          <input class="found-name" id="found-name" type="text" maxlength="24"
            placeholder="Your club's name" autocomplete="off">
          <div class="list" id="found-leagues">${D.LEAGUES.map(l => {
            const clubs = (world.leagues.find(x => x.id === l.id) || {}).clubs || [];
            const small = clubs.map(id => world.clubs[id]).sort((a, b) => a.rating - b.rating)[0];
            return `<div class="item click" data-found="${l.id}">
              <div class="ic">${global.Icons.flag(l.country)}</div>
              <div class="tx"><b>${U.esc(l.name)}</b>
                <span>${U.esc(l.country)} · you would replace ${U.esc(small ? small.name : '—')}
                  (${small ? small.rating : '—'})</span></div>
            </div>`;
          }).join('')}</div>`,
        actions: [{ label: 'Back', cls: 'btn-ghost', onClick: () => Game.managerJobs() }],
        onRender(m) {
          const input = m.querySelector('#found-name');
          m.querySelectorAll('[data-found]').forEach(el => el.onclick = () => {
            const name = (input.value || '').trim();
            if (name.length < 3) {
              input.classList.add('bad');
              input.focus();
              return UI.toast('Give your club a name first.', '');
            }
            const club = global.Manager.foundClub(State.game, Game._mgrWorld, el.dataset.found, name);
            Game._jobs = null;
            Game.managerBegin(club.id);
          });
          UI.modalScrollHint && UI.modalScrollHint(m);
        }
      });
    },

    managerLeagues() {
      // a sacked manager keeps the world he was working in — same clubs, same
      // players, and a reputation that decides who will still take his call
      const eraId = Game._mgrEra || 'modern';
      const era = D.ERAS.find(e => e.id === eraId) || D.ERAS[0];
      const world = Game._mgrRehire && Game._mgrWorld
        ? Game._mgrWorld : State.buildWorld(era.startYear, eraId);
      Game._mgrWorld = world;
      const leagues = D.LEAGUES.map(l => l.id);
      UI.modal({
        title: 'Take a job',
        html: `<p class="muted">${U.esc(era.name)} · ${U.esc(era.years)}.
            A big club expects the title. A small one expects you to stay up.</p>
          <div class="list">${leagues.map(id => {
            const L = world.leagues.find(x => x.id === id) || State.league(id);
            const cap = Game._mgrCeiling || 99;
            const open = Object.values(world.clubs).filter(c =>
              c.league === id && c.rating <= cap && c.id !== Game._mgrLeftClub).length;
            return `<div class="item click" data-lg="${id}"><div class="ic">${global.Icons.flag(L.country)}</div>
              <div class="tx"><b>${U.esc(L.name)}</b><span>${U.esc(L.country)}${
                Game._mgrCeiling ? ' · ' + (open ? open + ' club' + (open === 1 ? '' : 's') + ' would have you'
                                                : 'nobody here wants you') : ''}</span></div></div>`;
          }).join('')}</div>`,
        actions: [{ label: Game._mgrRehire ? 'Cancel' : 'Back', cls: 'btn-ghost',
          onClick: () => { if (!Game._mgrRehire) Game.managerStart(); } }],
        onRender(m) {
          m.querySelectorAll('[data-lg]').forEach(el => el.onclick = () => Game.managerClubs(el.dataset.lg));
        }
      });
    },

    managerClubs(leagueId) {
      const world = Game._mgrWorld;
      const cap = Game._mgrCeiling || 99;
      const all = Object.values(world.clubs)
        .filter(c => c.league === leagueId && c.id !== Game._mgrLeftClub)
        .sort((a, b) => b.rating - a.rating);
      const clubs = all.filter(c => c.rating <= cap);
      const snubs = all.length - clubs.length;
      UI.modal({
        title: 'Which club?',
        html: `${snubs ? `<p class="muted">${snubs} club${snubs === 1 ? '' : 's'} in this division
            would not return your calls. That is what the last job did to your name.</p>` : ''}
          ${clubs.length ? '' : '<p class="muted">Nobody here is interested. Try a smaller division.</p>'}
          <div class="list">${clubs.map(c => `
          <div class="item click" data-club="${c.id}">
            <div class="ic">${global.Crest.svg(c.name, 'crest-sm')}</div>
            <div class="tx"><b>${U.esc(c.name)}</b><span>Rated ${c.rating} · ${
              c.rating >= 84 ? 'they expect to win it' : c.rating >= 76 ? 'a good side, and they know it'
              : c.rating >= 68 ? 'a fair job, if you are any good' : 'a proper rebuild'}</span></div>
          </div>`).join('')}</div>`,
        actions: [{ label: 'Back', cls: 'btn-ghost', onClick: () => Game.managerLeagues() }],
        onRender(m) {
          m.querySelectorAll('[data-club]').forEach(el => el.onclick = () => Game.managerBegin(el.dataset.club));
        }
      });
    },

    managerBegin(clubId) {
      const world = Game._mgrWorld;
      /* Leaving one job for another: the outgoing club goes on the CV, and
         what you won there joins the career cabinet. This runs here rather
         than when you resigned so that backing out of the job market leaves
         you exactly where you were. */
      const prev = State.game;
      if (Game._mgrLeaving && prev && prev.mgr) {
        const car = global.Manager.career(prev);
        car.trophies = car.trophies.concat(prev.mgr.trophies || []);
        car.wonders = car.wonders.concat(prev.mgr.wonders || []);
        car.seasons = (car.seasons || 0) + (prev.mgr.board.seasons || 0);
        prev.mgrHistory = (prev.mgrHistory || []).concat({
          club: State.club(prev.mgr.club).name,
          seasons: prev.mgr.board.seasons,
          finishes: (prev.mgr.board.finishes || []).slice(),
          trophies: (prev.mgr.trophies || []).length,
          sacked: Game._mgrLeaving === 'sacked',
          left: Game._mgrLeaving === 'left'
        });
        Game._mgrLeaving = null;
      }
      const past = (State.game && State.game.mgrHistory) || [];
      // what you have won and the goals worth remembering are yours, not the
      // club's — they follow you out of the door and into the next job
      const carried = (Game._mgrRehire && State.game && State.game.career) || null;
      const g = {
        version: 1, world, era: Game._mgrEra || 'modern', mode: 'manager',
        log: [], headlines: [], newsSeen: 0, tables: {}, world_year: world.year,
        mgrHistory: Game._mgrRehire ? past : [],
        career: carried || undefined,
        settings: {}
      };
      Game._mgrRehire = false;
      Game._mgrCeiling = 0;
      Game._mgrLeftClub = null;
      const cb = $('btn-continue'); if (cb) { cb.disabled = false; cb.textContent = 'Continue Managing'; }
      State.game = g;
      global.Manager.start(g, clubId);
      if (global.MSocial) { try { global.MSocial.arrived(g); } catch (e) {} }
      const club = State.club(clubId);
      UI.closeModal();
      UI.show('game');
      global.MUI.tab = 'mhome';
      UI.render();
      State.save();
      UI.modal({
        title: 'Welcome to ' + club.name,
        text: `${global.Manager.FORMATIONS[g.mgr.formation].name}, ${club.name}, and a board with an opinion.\n\n`
          + `${g.mgr.board.target.text}\n\nTransfer budget: ${U.cash(g.mgr.budget)}.`,
        actions: [{ label: 'Get to work' }]
      });
    },

    /* the only interactive beat of a matchday: what you say before it */
    mgrTeamTalk() {
      const g = State.game;
      const fix = global.Manager.nextFixture(g);
      if (!fix) return;
      const opp = State.club(fix.oppId);
      UI.modal({
        title: 'Team talk',
        html: `<p class="muted">${U.esc(opp.name)}, ${fix.neutral ? 'on neutral ground' : fix.home ? 'at home' : 'away'}.${
            fix.comp === 'cup' ? ` ${U.esc(fix.stageName)} of the ${U.esc(fix.compName)} — win it or the year is over.` : ''
          } The room is quiet and looking at you.</p>
          <div class="list">${global.Manager.TALKS.map(t => `
            <div class="item click" data-talk="${t.id}"><div class="ic">${ico('microphone')}</div>
              <div class="tx"><b>${U.esc(t.label)}</b><span>${U.esc(t.hint)}</span></div></div>`).join('')}</div>`,
        actions: [{ label: 'Cancel', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-talk]').forEach(el => el.onclick = () => {
            UI.closeModal();
            Game.mgrPlayRound(el.dataset.talk);
          });
        }
      });
    },

    mgrPlayRound(talk) {
      const g = State.game;
      const r = global.Manager.playRound(g, talk);
      State.save();
      global.MUI.render();
      if (!r) return;
      /* You do not get told you won a cup in a paragraph. You lift it. */
      if (r.lifted) {
        Game.trophyLift(r.lifted, 'Cup winners', () => Game.mgrMatchModal(r));
        return;
      }
      Game.mgrMatchModal(r);
    },

    mgrMatchModal(r) {
      const g = State.game;
      const opp = State.club(r.oppId);
      const club = State.club(g.mgr.club);
      const cupLine = r.comp !== 'cup' ? '' : r.lifted
        ? `<p class="mgr-cupline good">${ico('trophy')} ${U.esc(r.lifted)} — won.</p>`
        : r.out
          ? `<p class="mgr-cupline bad">Out of the ${U.esc(r.compName)} at the ${U.esc(String(r.stageName).toLowerCase())}.</p>`
          : `<p class="mgr-cupline good">Through in the ${U.esc(r.compName)}.</p>`;
      UI.modal({
        title: r.lifted ? 'CUP WINNERS'
          : r.comp === 'cup' ? (r.result === 'W' ? 'Through' : 'Knocked out')
          : r.result === 'W' ? 'Win' : r.result === 'D' ? 'Draw' : 'Defeat',
        html: `${r.comp === 'cup' ? `<p class="dim" style="text-align:center;margin:0 0 6px">${U.esc(r.compName)} · ${U.esc(r.stageName)}${
            r.pens ? ` · ${r.pens[0]}-${r.pens[1]} on penalties` : r.aet ? ' · after extra time' : ''}</p>` : ''}
          <div class="fx-teams" style="margin-bottom:10px">
            <div class="fx-t">${global.Crest.svg(r.home ? club.name : opp.name, 'crest-lg')}
              <span>${U.esc(r.home ? club.name : opp.name)}</span></div>
            <div class="fx-v" style="font-size:26px">${r.home ? r.gf : r.ga}–${r.home ? r.ga : r.gf}</div>
            <div class="fx-t">${global.Crest.svg(r.home ? opp.name : club.name, 'crest-lg')}
              <span>${U.esc(r.home ? opp.name : club.name)}</span></div>
          </div>
          ${cupLine}
          ${r.scorers.length ? `<p class="muted" style="text-align:center">${U.esc(r.scorers.join(', '))}</p>` : ''}
          ${(() => {
            const c = r.cas || {};
            const bits = (c.hurt || []).map(h =>
              `${U.esc(h.name)} out ${h.games} game${h.games === 1 ? '' : 's'} (${U.esc(h.label)})`)
              .concat((c.banned || []).map(b =>
                `${U.esc(b.name)} banned ${b.games} game${b.games === 1 ? '' : 's'} — ${U.esc(b.why)}`));
            return bits.length
              ? `<p class="mgr-cas">${ico('hospital')} ${bits.join('<br>')}</p>` : '';
          })()}
          ${r.award ? `<div class="aw-inline">${ico('podium')}
            <b>${U.esc(r.award.name)}</b><span>${U.esc(r.award.note || '')}</span></div>` : ''}
          ${(r.moments || []).length ? `<div class="mn-modal">${r.moments.map(m =>
            `<div class="mnews mn-${U.esc(m.k)}"><span class="mn-t">${U.esc(m.t)}</span></div>`).join('')}</div>` : ''}
          <p class="dim" style="text-align:center;margin:0">Board confidence ${Math.round(g.mgr.board.confidence)}
            · ${U.ordinal(global.Manager.position(g))} in the table</p>`,
        actions: [{ label: global.Manager.seasonOver(g) ? 'See the board' : 'Next',
          onClick: () => { if (global.Manager.seasonOver(g)) Game.mgrReview(); } }]
      });
    },

    mgrSimSeason() {
      const g = State.game;
      let n = 0;
      while (!global.Manager.seasonOver(g) && n++ < 90) global.Manager.playRound(g, 'calm');
      State.save();
      global.MUI.render();
      Game.mgrReview();
    },

    mgrReview() {
      const g = State.game;
      if (!global.Manager.seasonOver(g)) return;
      const r = global.Manager.seasonReview(g);
      const club = State.club(g.mgr.club);
      if (global.MSocial) { try { global.MSocial.season(g, r); } catch (e) {} }
      if (r.sacked && global.MSocial) { try { global.MSocial.sacked(g); } catch (e) {} }
      State.save();

      const meetTheBoard = () => UI.modal({
        title: r.champion ? 'CHAMPIONS' : r.met ? 'Target met' : 'Season over',
        html: `<div class="stat-grid">
            <div class="stat"><b>${U.ordinal(r.pos)}</b><span>Finish</span></div>
            <div class="stat"><b>${r.confidence}</b><span>Board</span></div>
            <div class="stat"><b>${U.cash(g.mgr.budget)}</b><span>Next budget</span></div>
          </div>
          ${(r.cups || []).length ? `<div class="cup-tally">${r.cups.map(c =>
            `<div class="cup-row cup-${c.won ? 'won' : 'out'}">
              <span class="cup-ic">${ico(c.won ? 'trophy' : 'exit')}</span>
              <span class="cup-n">${U.esc(c.name)}</span>
              <span class="cup-st">${c.won ? 'Won' : c.outAt ? U.esc(String(c.outAt).toLowerCase()) : '—'}</span>
            </div>`).join('')}</div>` : ''}
          <p class="muted" style="margin-top:12px">${U.esc(r.verdict)}</p>`,
        actions: [{ label: r.sacked ? 'Clear your desk' : 'Into next season', onClick: () => {
          if (r.sacked) { global.MUI.render(); return; }
          Game._mgrOffers = r.offers || [];
          /* The summer, in the order it matters. The contracts running out come
             first and come *before* the year turns, because that is the last
             week you can still do anything about them. */
          const roll = () => {
            global.Manager.nextSeason(g);
            State.save();
            global.MUI.tab = 'mmarket';
            global.MUI.render();
            // losing a player has to be something you are told, not something
            // you discover later by counting the bench
            const gone = g.mgr.retired || [];
            const walked = g.mgr.walked || [];
            const after = () => walked.length
              ? Game.mgrWalkedModal(walked, () => Game._mgrWindowNext())
              : Game._mgrWindowNext();
            if (gone.length) {
              UI.modal({
                title: gone.length === 1 ? 'He has hung up his boots' : 'Hanging up their boots',
                html: `<div class="list">${gone.map(x => `<div class="item">
                    <div class="ic">${ico('legacy')}</div>
                    <div class="tx"><b>${U.esc(x.name)}</b><span>Retired at ${x.age}, rated ${x.ovr}</span></div>
                  </div>`).join('')}</div>
                  <p class="muted">${gone.length === 1 ? 'That is him done.' : 'That is them done.'}
                    You will need to replace ${gone.length === 1 ? 'him' : 'them'}.</p>`,
                actions: [{ label: 'Anything else?', onClick: after }]
              });
            } else after();
          };
          Game._runMore = r.runningMore || 0;
          if ((r.running || []).length) return Game.mgrRunningModal(r.running, roll);
          roll();
        } }]
      });

      /* Before any of it: the best thing anybody did all year, and whatever
         they handed out afterwards. */
      const lift = () => {
        if (r.champion) Game.trophyLift(State.league(club.league).name + ' Title', 'Champions', meetTheBoard);
        else meetTheBoard();
      };
      const boardThen = () => Game.mgrAwardsModal(r.awards || [], lift);
      if (r.goalOfSeason) return Game.mgrGoalOfSeason(r.goalOfSeason, boardThen);
      if ((r.awards || []).length) return boardThen();

      // Lift it first, then go and see them. There is only one modal, so the
      // trophy used to open on top of the review and take the button that
      // starts your next season with it.
      if (r.champion) {
        Game.trophyLift(State.league(club.league).name + ' Title', 'Champions', meetTheBoard);
      } else {
        meetTheBoard();
      }
    },

    /* ---------------- goal of the season ----------------
       One goal a year is worth stopping the game for. */
    mgrGoalOfSeason(w, then) {
      const g = State.game;
      UI.modal({
        title: 'Goal of the Season',
        html: `<div class="gos gos-${U.esc(w.tier)}">
            <div class="gos-tier">${ico('goal')} ${U.esc(w.label)}</div>
            <div class="gos-who">${U.esc(w.name)}</div>
            <div class="gos-meta">${U.esc(w.club)} ${U.esc(w.line)} ${U.esc(w.opp)}
              · ${U.esc(w.comp)}${w.stage ? ' · ' + U.esc(w.stage) : ''} · ${w.year}</div>
            <p class="gos-txt">${U.esc(w.text.charAt(0).toUpperCase() + w.text.slice(1))}.</p>
            ${w.tier === 'century' ? '<div class="gos-stamp">One of those. Nobody here will forget it.</div>' : ''}
          </div>`,
        actions: [{ label: 'And the season itself', onClick: then }]
      });
    },

    /* ---------------- you, on the timeline ----------------
       A manager gets one line a week and everyone reads it. Say the right
       thing and the dressing room hears it too. */
    mgrPost() {
      const g = State.game;
      const MS = global.MSocial;
      if (!MS) return;
      if (!MS.canPost(g)) return UI.toast('You have already posted since the last game.', '');
      const kinds = [
        { k: 'calm', label: 'Keep it calm', hint: 'One game at a time. Nothing to see here.' },
        { k: 'fire', label: 'Fire them up', hint: 'Answer the doubters. The room will hear it.' },
        { k: 'honest', label: 'Take it on the chin', hint: 'That was not good enough and it starts with me.' },
        { k: 'praise', label: 'Praise a player', hint: 'Put somebody\u2019s name up in lights.' },
        { k: 'defiant', label: 'Stand your ground', hint: 'You have read what is written. It changes nothing.' }
      ];
      UI.modal({
        title: 'Say something',
        html: `<p class="muted">Everyone is reading. Pick your tone.</p>
          <div class="list">${kinds.map(t => `
            <div class="item click" data-say="${t.k}"><div class="ic">${ico('microphone')}</div>
              <div class="tx"><b>${U.esc(t.label)}</b><span>${U.esc(t.hint)}</span></div></div>`).join('')}</div>`,
        actions: [{ label: 'Not now', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-say]').forEach(el => el.onclick = () => {
            UI.closeModal();
            const post = MS.postAs(g, el.dataset.say);
            State.save();
            global.MUI.tab = 'mbuzz';
            global.MUI.render();
            if (post) UI.toast('Posted.', 'good');
          });
        }
      });
    },

    /* ---------------- the phone rings ----------------
       Being sacked was the only way out of a job. Now there is another. */
    /* What happens once the board meeting is over: your own job offers first,
       because taking one makes everything else moot, then the offers other
       clubs have put in for your players. */
    _mgrWindowNext() {
      if (Game._mgrOffers && Game._mgrOffers.length) return Game.mgrOffersModal();
      return Game.mgrBidsModal();
    },

    /* Answering one offer should hand you straight back to the rest of them,
       rather than dumping you on the market screen with three still open. */
    _bidBack() {
      const g = State.game;
      if (!Game._bidChain) return;
      if (((g.mgr && g.mgr.bids) || []).length) return Game.mgrBidsModal();
      Game._bidChain = false;
    },

    /* ---------------- the phone rings for one of yours ----------------
       You are not the only manager with a shortlist. */
    mgrBidsModal() {
      const g = State.game;
      const bids = (g.mgr && g.mgr.bids) || [];
      if (!bids.length) return UI.toast('Transfer window is open.', 'good');
      const me = State.club(g.mgr.club);
      UI.modal({
        title: bids.length === 1 ? 'An offer for one of yours'
          : `${bids.length} offers for your players`,
        html: `<p class="muted">Clubs have come in for players of yours. Take the money, tell them what he is really worth, or say no — and saying no to a club well above ${U.esc(me.name)} is not always free.</p>
          <div class="list">${bids.map(b => {
            const p = g.squad.find(x => x.id === b.playerId);
            const step = b.fromRating - me.rating;
            return `<div class="item click offer" data-bid="${b.id}">
              <div class="ic">${global.Crest.svg(b.fromName, 'crest-md')}</div>
              <div class="tx"><b>${U.esc(b.name)}<span class="pill${
                  step > 0 ? ' up' : step < 0 ? ' down' : ''}">${
                  step > 0 ? '+' + step : step}</span></b>
                <span>${U.esc(b.fromName)} · ${U.cash(b.fee)}${
                  p ? ' · worth about ' + U.cash(p.value || 0) : ''}</span>
                <span class="offer-pitch">${U.esc(b.line)}</span></div>
            </div>`; }).join('')}</div>`,
        actions: [{ label: 'Deal with it later', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-bid]').forEach(el => el.onclick = () => {
            Game._bidChain = true;
            Game.mgrBidIn(el.dataset.bid);
          });
          UI.modalScrollHint && UI.modalScrollHint(m);
        }
      });
    },

    mgrOffersModal() {
      const g = State.game;
      const offers = Game._mgrOffers || [];
      if (!offers.length) return;
      const here = State.club(g.mgr.club);
      UI.modal({
        title: offers.length === 1 ? 'Somebody wants you' : `${offers.length} clubs want you`,
        html: `<p class="muted">You are under contract at ${U.esc(here.name)} (rated ${here.rating}).
            Nobody is forcing you anywhere — but this is who called.</p>
          <div class="list">${offers.map((o, i) => {
            /* Ratings drift over the summer, between the board meeting that
               generated the offer and this screen. Read them live so the step
               up or down is the one you would actually be taking. */
            const c = State.club(o.clubId) || { rating: o.rating };
            const step = c.rating - here.rating;
            return `<div class="item click offer" data-offer="${i}">
              <div class="ic">${global.Crest.svg(o.name, 'crest-md')}</div>
              <div class="tx"><b>${U.esc(o.name)}<span class="pill${
                  step > 0 ? ' up' : step < 0 ? ' down' : ''}">${
                  step > 0 ? '+' + step : step}</span></b>
                <span>${U.esc(o.league)} · rated ${c.rating} · ${U.cash(o.budget)} to spend</span>
                <span class="offer-pitch">${U.esc(o.pitch)}</span></div>
            </div>`; }).join('')}</div>`,
        actions: [{ label: `Stay at ${here.name}`, cls: 'btn-ghost',
          onClick: () => { if ((g.mgr.bids || []).length) Game.mgrBidsModal(); } }],
        onRender(m) {
          m.querySelectorAll('[data-offer]').forEach(el => el.onclick = () =>
            Game.mgrTakeJob(offers[+el.dataset.offer]));
          UI.modalScrollHint && UI.modalScrollHint(m);
        }
      });
    },

    mgrTakeJob(o) {
      const g = State.game;
      const from = State.club(g.mgr.club);
      UI.modal({
        title: 'Leave?',
        html: `<p class="muted">You would be leaving ${U.esc(from.name)} for ${U.esc(o.name)}.
            Your squad, your budget and this club's board stay behind. What you have won,
            and the goals worth remembering, come with you.</p>
          <p class="muted">${U.esc(o.target)}</p>`,
        actions: [
          { label: `Take the ${o.name} job`, onClick: () => {
            Game._mgrOffers = [];
            global.Manager.moveTo(g, o.clubId, 'left');
            State.save();
            global.MUI.tab = 'mhome';
            global.MUI.render();
            const to = State.club(g.mgr.club);
            UI.toast(`You are the manager of ${to.name}.`, 'good');
          } },
          { label: 'Stay where you are', cls: 'btn-ghost', onClick: () => Game.mgrOffersModal() }
        ]
      });
    },

    /* You can also just walk. There is no offer on the table, and the job
       market will judge you on what you have actually done. */
    mgrResign() {
      const g = State.game;
      const club = State.club(g.mgr.club);
      const cap = global.Manager.ceilingFor(g);
      const open = Object.values(g.world.clubs).filter(c => c.id !== club.id && c.rating <= cap).length;
      UI.modal({
        title: 'Resign?',
        html: `<p class="muted">You would be walking out on ${U.esc(club.name)} with
            ${g.mgr.board.seasons} season${g.mgr.board.seasons === 1 ? '' : 's'} behind you.
            Your squad and your budget stay here. Your record comes with you.</p>
          <p class="muted">On what you have done so far, ${open} club${open === 1 ? '' : 's'}
            around the world would consider you.</p>`,
        actions: [
          { label: 'Resign and look for a job', cls: 'btn-danger', onClick: () => {
            // nothing is folded into the career until you have actually taken
            // another job — back out of the market here and you are still the
            // manager, with the cabinet counted exactly once
            Game._mgrLeaving = 'left';
            Game._mgrLeftClub = club.id;
            Game._mgrCeiling = cap;
            Game._mgrRehire = true;
            Game._mgrWorld = g.world;
            Game.managerStart();
          } },
          { label: 'Stay', cls: 'btn-ghost' }
        ]
      });
    },

    /* Sacked is not the end of a managerial career, it is most of one. You keep
       the world and the record; what you lose is who will have you. */
    mgrRehire() {
      const g = State.game;
      const club = State.club(g.mgr.club);
      // a trophy buys you another shot at that level; a sacking without one
      // drops you a rung, and a second drops you further. There is always
      // somebody desperate enough, so never price yourself out of the whole
      // game — the floor is the worst club in the world.
      const floor = Math.min.apply(null, Object.values(g.world.clubs).map(c => c.rating));
      Game._mgrCeiling = Math.max(floor, global.Manager.ceilingFor(g));
      Game._mgrLeaving = 'sacked';
      Game._mgrLeftClub = club.id;
      Game._mgrRehire = true;
      Game._mgrWorld = g.world;
      Game.managerStart();
    },

    mgrAutoPick() {
      const g = State.game;
      g.mgr.xi = global.Manager.autoPick(g).map(s => s.id);
      State.save(); global.MUI.render();
      UI.toast('Best eleven picked.', 'good');
    },

    mgrSwap(id) {
      const g = State.game;
      const xi = g.mgr.xi || [];
      const from = Game._mgrSwapFrom;
      // tapping the man you already picked puts him back down
      if (from === id) { Game._mgrSwapFrom = null; return global.MUI.render(); }
      const inXI = xi.indexOf(id) >= 0;

      const man = g.squad.find(x => x.id === id);
      if (man && !global.Manager.available(man)) {
        const why = global.Manager.unavailableWhy(man);
        UI.toast(`${man.name} is ${why.k === 'ban' ? 'suspended' : 'injured'} — ${
          why.games} game${why.games === 1 ? '' : 's'} to go.`, 'bad');
        return;
      }
      if (from && xi.indexOf(from) >= 0) {
        const i = xi.indexOf(from);
        if (inXI) {
          // two of your own starters: swap the shirts round the pitch
          const j = xi.indexOf(id);
          xi[i] = id; xi[j] = from;
        } else {
          xi[i] = id;                       // straight in for the man off
        }
        Game._mgrSwapFrom = null;
        State.save(); global.MUI.render();
        return;
      }
      if (inXI) { Game._mgrSwapFrom = id; return global.MUI.render(); }
      UI.toast('Tap someone in the eleven first.', '');
    },

    mgrFormation() {
      const g = State.game;
      UI.modal({
        title: 'Formation',
        html: `<div class="list">${Object.keys(global.Manager.FORMATIONS).map(k => {
          const f = global.Manager.FORMATIONS[k];
          return `<div class="item click cel-opt${k === g.mgr.formation ? ' on' : ''}" data-form="${k}">
            <div class="ic">${ico('tactics')}</div>
            <div class="tx"><b>${U.esc(f.name)}</b><span>${U.esc(f.hint)}</span></div>
            <div class="cel-tick">${ico('ok')}</div></div>`;
        }).join('')}</div>`,
        actions: [{ label: 'Done', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-form]').forEach(el => el.onclick = () => {
            g.mgr.formation = el.dataset.form;
            g.mgr.xi = global.Manager.autoPick(g).map(s => s.id);
            UI.closeModal(); State.save(); global.MUI.render();
          });
        }
      });
    },

    mgrStyle() {
      const g = State.game;
      UI.modal({
        title: 'Approach',
        html: `<div class="list">${Object.keys(global.Manager.STYLES).map(k => {
          const st = global.Manager.STYLES[k];
          return `<div class="item click cel-opt${k === g.mgr.style ? ' on' : ''}" data-style="${k}">
            <div class="ic">${ico('tactics')}</div>
            <div class="tx"><b>${U.esc(st.name)}</b><span>${U.esc(st.hint)}</span></div>
            <div class="cel-tick">${ico('ok')}</div></div>`;
        }).join('')}</div>`,
        actions: [{ label: 'Done', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-style]').forEach(el => el.onclick = () => {
            g.mgr.style = el.dataset.style;
            UI.closeModal(); State.save(); global.MUI.render();
          });
        }
      });
    },

    mgrFilter(pos) {
      const g = State.game;
      const f = g.mgr.filter || {};
      if (pos === 'Affordable') f.afford = !f.afford;
      else if (pos === 'All') delete f.pos;
      else f.pos = pos;
      g.mgr.filter = (f.pos || f.afford) ? f : null;
      global.MUI.render();
    },

    /* A player's own screen: who he is, and every version of him there has
       been. The timeline only opens once he is yours — that is the point of
       signing him. */
    /* A row in the squad list. Mid-swap it is the man coming on; the rest of
       the time it is the way into his card. */
    mgrRow(id) {
      if (Game._mgrSwapFrom) return Game.mgrSwap(id);
      return Game.mgrPlayerCard(id);
    },

    mgrPlayerCard(id, tab) {
      const g = State.game;
      const M = global.Manager, MUI = global.MUI;
      const mine = (g.squad || []).find(s => s.id === id);
      const p = mine || M.topPlayers(g).find(s => s.id === id)
        || M.market(g).find(s => s.id === id);
      if (!p) return;
      const owned = !!mine;
      const which = tab || 'pOverview';
      const inXI = owned && (g.mgr.xi || []).indexOf(p.id) >= 0;

      const actions = [];
      if (owned) {
        actions.push({ label: inXI ? 'Take him out of the eleven' : 'Put him in the eleven',
          onClick: () => { Game.mgrSwapVia(p.id); } });
      } else {
        actions.push({ label: 'Make an offer', onClick: () => Game.mgrBid(p.id) });
      }
      actions.push({ label: 'Close', cls: 'btn-ghost' });

      UI.modal({
        title: '',
        html: `<div class="pc-tabs">${MUI.playerTabs.map(t =>
            `<button class="pc-tab${which === t.id ? ' on' : ''}" data-ptab="${t.id}">
              ${ico(t.icon)} ${t.label}${t.id === 'pTimeline' && !owned ? ' ' + ico('lock') : ''}</button>`).join('')}</div>
          <div class="pc-pane">${which === 'pTimeline'
            ? MUI.timelineHtml(p, owned) : MUI.overviewHtml(p, owned)}</div>`,
        actions,
        onRender(m) {
          m.querySelectorAll('[data-ptab]').forEach(el => el.onclick = () => {
            Game.mgrPlayerCard(id, el.dataset.ptab);
          });
          // the era cards carry data-act, and nothing binds those inside a
          // modal unless we ask — which is why tapping one did nothing
          UI.bindActions(m);
        }
      });
    },

    /* Buying a version of him. The fee comes out of the transfer budget, and
       his wage becomes what that version would want. */
    mgrEra(arg) {
      const g = State.game, M = global.Manager, MUI = global.MUI;
      const [id, ix] = String(arg).split(':');
      const p = (g.squad || []).find(s => s.id === id);
      if (!p) return;
      const era = global.Timeline.for(p)[+ix];
      if (!era) return;
      if (M.eraActive(p, era)) return UI.toast('That is the version you already have.', '');

      const price = M.eraPrice(p, era);
      const wage = M.eraWage(p, era);
      const room = g.mgr.wageBudget - M.squadWages(g) + (p.wage || 0);
      const shortOfCash = price > g.mgr.budget;
      const shortOfRoom = wage > room;

      UI.modal({
        title: era.now ? 'Back to himself' : `The ${era.year} ${p.name}`,
        html: `<div class="fc-solo">${MUI.eraPortrait(era, p, era.ovr >= p.ovr, null)}</div>
          <div class="pc-rows" style="margin-top:10px">
            <div class="pc-row"><span>Rating</span><b>${p.ovr} → ${era.ovr}</b></div>
            <div class="pc-row"><span>Age</span><b>${p.age} → ${era.age}</b></div>
            <div class="pc-row"><span>Fee</span><b class="${shortOfCash ? 'bad' : ''}">${
              price ? U.cash(price) : 'Free'}</b></div>
            <div class="pc-row"><span>Wages</span><b class="${shortOfRoom ? 'bad' : ''}">${
              U.cash(wage)}/w</b></div>
          </div>
          ${shortOfCash ? '<p class="muted bad">More than you have in the budget.</p>' : ''}
          ${shortOfRoom ? '<p class="muted bad">His wages will not fit. Sell someone first.</p>' : ''}`,
        actions: (shortOfCash || shortOfRoom ? [] : [{
          label: price ? `Sign him for ${U.cash(price)}` : 'Bring him back',
          onClick: () => {
            const r = M.buyEra(g, id, era);
            if (!r.ok) return UI.toast(r.why || 'It did not happen.', 'bad');
            State.save();
            global.MUI.render();
            UI.toast(era.now ? `${p.name} is himself again.`
              : `${p.name} is the ${era.year} version now — ${era.ovr}.`, 'good');
            setTimeout(() => Game.mgrPlayerCard(id, 'pTimeline'), 60);
          }
        }]).concat([{ label: 'Not now', cls: 'btn-ghost',
          onClick: () => Game.mgrPlayerCard(id, 'pTimeline') }])
      });
    },

    /* Swapping from inside the card: into the eleven, or out of it. */
    mgrSwapVia(id) {
      const g = State.game;
      const xi = g.mgr.xi || [];
      const i = xi.indexOf(id);
      if (i >= 0) {
        const bench = global.Manager.benchPlayers(g);
        const best = bench.slice().sort((a, b) => b.ovr - a.ovr)[0];
        if (!best) return UI.toast('Nobody on the bench to bring on.', 'bad');
        xi[i] = best.id;
        UI.toast(`${best.name} comes in.`, 'good');
      } else {
        // straight in for whoever is weakest in his position, or weakest overall
        const shape = global.Manager.FORMATIONS[g.mgr.formation].line;
        const me = g.squad.find(s => s.id === id);
        let slot = -1, worst = 999;
        xi.forEach((sid, k) => {
          const s = g.squad.find(x => x.id === sid); if (!s) return;
          const fit = shape[k] === me.pos ? 0 : 40;   // prefer his own position
          if (s.ovr + fit < worst) { worst = s.ovr + fit; slot = k; }
        });
        if (slot < 0) return;
        const out = g.squad.find(x => x.id === xi[slot]);
        xi[slot] = id;
        UI.toast(`${me.name} in for ${out ? out.name : 'him'}.`, 'good');
      }
      State.save();
      global.MUI.render();
    },

    mgrNewsMore() {
      const g = State.game;
      g.mgr.newsOpen = !g.mgr.newsOpen;
      global.MUI.render();
    },

    mgrTopMore() {
      const g = State.game;
      g.mgr.topOpen = !g.mgr.topOpen;
      global.MUI.render();
    },

    /* ---------------- the backroom ----------------
       Six jobs. You can do all of them badly yourself for nothing, or pay
       somebody who is better at one of them out of the same wage bill that
       buys footballers. */
    mgrStaff(roleId) {
      const g = State.game;
      const M = global.Manager;
      const role = M.staffRole(roleId);
      const have = (g.mgr.staff || {})[roleId] || null;
      Game._staffList = Game._staffList || {};
      if (!Game._staffList[roleId] || Game._staffList[roleId].year !== g.world.year) {
        Game._staffList[roleId] = { year: g.world.year, list: M.staffMarket(g, roleId) };
      }
      const list = Game._staffList[roleId].list;
      const room = M.wageRoom(g) + (have ? have.wage : 0);
      UI.modal({
        title: role.name,
        html: `<p class="muted">${U.esc(role.what)}</p>
          ${have ? `<div class="st-have">${ico(role.ic)}
              <div><b>${U.esc(have.name)}</b>
                <span>${U.esc(M.staffBand(have.rating))} · rated ${have.rating} · ${U.cash(have.wage)}/w${
                  have.since != null ? ' · since ' + have.since : ''}</span></div>
            </div>` : ''}
          <div class="offer-sum" style="margin-top:0"><span>Room in the wage bill</span>
            <b class="${room < 0 ? 'bad' : ''}">${U.cash(Math.max(room, 0))}/w</b></div>
          <div class="list" style="margin-top:12px">${list.map((c, i) => {
            const afford = c.wage <= room;
            return `<div class="item click offer${afford ? '' : ' cant'}" data-hire="${i}">
              <div class="ic">${ico(role.ic)}</div>
              <div class="tx"><b>${U.esc(c.name)}<span class="pill${
                  c.rating >= 78 ? ' up' : c.rating < 55 ? ' down' : ''}">${c.rating}</span></b>
                <span>${U.esc(M.staffBand(c.rating))} · ${U.cash(c.wage)}/w${
                  afford ? '' : ' · more than you have'}</span></div>
            </div>`; }).join('')}</div>`,
        actions: (have ? [{ label: `Let ${have.name.split(' ').slice(-1)[0]} go`, cls: 'btn-danger', onClick: () => {
            const r = M.sackStaff(g, roleId);
            State.save(); global.MUI.render();
            if (r.ok) UI.toast(`${r.name} has left the club.`, '');
          } }] : []).concat([{ label: 'Leave it', cls: 'btn-ghost' }]),
        onRender(m) {
          m.querySelectorAll('[data-hire]').forEach(el => el.onclick = () => {
            const cand = list[+el.dataset.hire];
            const res = M.hireStaff(g, cand);
            if (!res.ok) return UI.toast(res.why, 'bad');
            Game._staffList[roleId].list = list.filter(c => c.id !== cand.id);
            State.save(); global.MUI.render(); UI.closeModal();
            UI.toast(`${cand.name} is your new ${role.name.toLowerCase()}.`, 'good');
          });
          UI.modalScrollHint && UI.modalScrollHint(m);
        }
      });
    },

    /* ---------------- a new deal ----------------
       You set the money and the length. He decides. Leave it long enough and
       somebody else has the conversation for you, in June, for free. */
    mgrRenew(playerId, note) {
      const g = State.game;
      const M = global.Manager;
      const s = g.squad.find(x => x.id === playerId);
      if (!s) return;
      const ask = M.renewalAsk(g, s);
      Game._deal = Game._deal || {};
      if (Game._deal.id !== playerId) {
        Game._deal = { id: playerId, wage: Math.round(ask / 100) * 100,
                       years: s.age >= 32 ? 2 : s.age <= 23 ? 5 : 3 };
      }
      const d = Game._deal;
      const step = Math.max(100, Math.round(ask * 0.06 / 100) * 100);
      const room = M.wageRoom(g) + (s.wage || 0);
      const odds = M.renewOdds(g, s, d.wage, d.years);
      const read = odds >= 0.85 ? 'He would sign that tomorrow.'
        : odds >= 0.6 ? 'That is about right. He will think about it.'
        : odds >= 0.35 ? 'Under what his people are asking. It might not be enough.'
        : 'Nowhere near it. He will say no.';
      const over = d.wage > room;
      UI.modal({
        title: `A new deal for ${s.name}`,
        html: `<p class="muted">${U.esc(s.pos)} · ${s.age} · rated <b>${s.ovr}</b> · on ${U.cash(s.wage)}/w · ${M.dealOf(s) <= 1 ? 'in the final year of his deal' : M.dealOf(s) + ' years left'}</p>
          ${note ? `<p class="offer-note">${U.esc(note)}</p>` : ''}
          ${M.dealOf(s) <= 1 ? `<p class="offer-note">Do nothing and he leaves in the summer for nothing at all.
            He is worth about ${U.cash(s.value || 0)}.</p>` : ''}
          <div class="offer-row${over ? ' over' : ''}">
            <div class="offer-lab">Weekly wage</div>
            <div class="offer-ctl">
              <button class="offer-btn" data-dwage="-1">−</button>
              <b>${U.cash(d.wage)}<span class="per">/w</span></b>
              <button class="offer-btn" data-dwage="1">+</button>
            </div>
            <div class="offer-read">${over ? '<span class="bad">More than your wage bill has room for.</span>'
              : U.esc(read)}</div>
          </div>
          <div class="offer-row">
            <div class="offer-lab">Length</div>
            <div class="offer-ctl">
              <button class="offer-btn" data-dyear="-1">−</button>
              <b>${d.years} year${d.years === 1 ? '' : 's'}</b>
              <button class="offer-btn" data-dyear="1">+</button>
            </div>
            <div class="offer-read">${s.age >= 32
              ? `He turns ${s.age + d.years} before it is up. A long one at his age is a risk you are taking, not him.`
              : s.age <= 23 ? 'A young player wants the long one. It says you mean it.'
              : 'Long enough to matter, short enough to be worth something if he goes.'}</div>
          </div>
          <div class="offer-sum">
            <span>His people are asking</span><b>${U.cash(ask)}/w</b>
            <span>Room in the wage bill</span><b class="${room < 0 ? 'bad' : ''}">${U.cash(Math.max(room, 0))}/w</b>
          </div>`,
        actions: [
          { label: 'Put it to him', onClick: () => {
            const r = M.renew(g, s.id, d.wage, d.years);
            State.save(); global.MUI.render();
            if (r.ok) {
              Game._deal = null;
              UI.toast(`${s.name} has signed for ${d.years} more year${d.years === 1 ? '' : 's'}.`, 'good');
              return Game._dealBack();
            }
            if (r.turned) {
              Game._deal.wage = Math.max(d.wage, Math.round(r.ask / 100) * 100);
              return Game.mgrRenew(s.id, r.why);
            }
            UI.toast(r.why, 'bad');
            Game._dealBack();
          } },
          { label: 'Leave it for now', cls: 'btn-ghost',
            onClick: () => { Game._deal = null; Game._dealBack(); } }
        ],
        onRender(m) {
          m.querySelectorAll('[data-dwage]').forEach(el => el.onclick = () => {
            Game._deal.wage = Math.max(100, Game._deal.wage + (+el.dataset.dwage) * step);
            Game.mgrRenew(s.id, note);
          });
          m.querySelectorAll('[data-dyear]').forEach(el => el.onclick = () => {
            Game._deal.years = U.clamp(Game._deal.years + (+el.dataset.dyear), 1, M.DEAL_LONG);
            Game.mgrRenew(s.id, note);
          });
        }
      });
    },

    /* Answering one contract hands you back the rest of them. */
    _dealBack() {
      const ctx = Game._runCtx;
      if (!ctx) return;
      Game._runCtx = null;
      Game._runMore = ctx.more;
      return Game.mgrRunningModal(ctx.list, ctx.then);
    },

    /* ---------------- the ones you are about to lose ---------------- */
    mgrRunningModal(list, then, more) {
      const g = State.game;
      list = (list || []).filter(x => {
        const s = g.squad.find(p => p.id === x.id);
        return s && global.Manager.dealOf(s) <= 1;
      });
      if (!list.length) return then ? then() : null;
      UI.modal({
        title: list.length === 1 ? 'One deal is running out' : `${list.length} deals are running out`,
        html: `<p class="muted">These men are into the last year of their contracts. Sign them again, sell them while they are still worth something, or watch them leave next summer for nothing.</p>
          <div class="list">${list.map(x => `<div class="item click offer" data-run="${x.id}">
            <div class="ic">${ico('contract')}</div>
            <div class="tx"><b>${U.esc(x.name)}<span class="pill">${x.ovr}</span></b>
              <span>${U.esc(x.pos)} · ${x.age} · worth about ${U.cash(x.worth)}</span></div>
          </div>`).join('')}</div>
          ${Game._runMore ? `<p class="dim tiny" style="margin:10px 0 0">${Game._runMore} more ${Game._runMore === 1 ? 'deal is' : 'deals are'} into a final year. Squad players mostly sign again on their own — the full list is on the contracts page in your office.</p>` : ''}`,
        actions: [{ label: 'Deal with it later', cls: 'btn-ghost',
          onClick: () => { Game._runCtx = null; if (then) then(); } }],
        onRender(m) {
          m.querySelectorAll('[data-run]').forEach(el => el.onclick = () => {
            Game._runCtx = { list, then: then || null, more: Game._runMore };
            Game.mgrRenew(el.dataset.run);
          });
          UI.modalScrollHint && UI.modalScrollHint(m);
        }
      });
    },

    /* ---------------- the ones who already have ---------------- */
    mgrWalkedModal(list, then) {
      if (!list || !list.length) return then ? then() : null;
      UI.modal({
        title: list.length === 1 ? 'Gone for nothing' : 'Gone for nothing',
        html: `<p class="muted">${list.length === 1 ? 'His contract ran out and he has signed elsewhere.' : 'Their contracts ran out and they have signed elsewhere.'} You get nothing for ${list.length === 1 ? 'him' : 'them'}.</p>
          <div class="list">${list.map(w => `<div class="item">
            <div class="ic">${ico('contract')}</div>
            <div class="tx"><b>${U.esc(w.name)}</b>
              <span>${U.esc(w.pos)} ${w.ovr} · ${w.age} · to ${U.esc(w.to)} · was worth ${U.cash(w.worth)}</span></div>
          </div>`).join('')}</div>`,
        actions: [{ label: 'Nothing to be done now', onClick: then || null }],
        onRender(m) { UI.modalScrollHint && UI.modalScrollHint(m); }
      });
    },

    /* ---------------- May ---------------- */
    mgrAwardsModal(list, then) {
      if (!list || !list.length) return then ? then() : null;
      const icOf = k => k === 'boot' ? 'goldenboot' : k === 'young' ? 'star'
        : k === 'pots' ? 'medal' : k === 'mots' ? 'crown' : 'podium';
      UI.modal({
        title: list.length === 1 ? 'An award' : 'Awards',
        html: `<div class="aw-big">${list.map(a => `<div class="aw-card aw-${U.esc(a.kind)}">
            <div class="aw-c-ic">${ico(icOf(a.kind))}</div>
            <div class="aw-c-n">${U.esc(a.name)}</div>
            <div class="aw-c-w">${U.esc(a.who || 'You')}</div>
            <div class="aw-c-m">${U.esc(a.note || '')}</div>
          </div>`).join('')}</div>`,
        actions: [{ label: 'And the season itself', onClick: then || null }]
      });
    },

    /* ---------------- somebody wants one of yours ----------------
       The mirror of the offer sheet. Their number is on the table; you can
       take it, tell them what he is actually worth, or say no — and saying no
       to a club well above you is not free. */
    mgrBidIn(bidId) {
      const g = State.game;
      const M = global.Manager;
      const bid = (g.mgr.bids || []).find(b => b.id === bidId);
      if (!bid) return;
      const p = g.squad.find(x => x.id === bid.playerId);
      if (!p) {
        g.mgr.bids = (g.mgr.bids || []).filter(b => b.id !== bidId);
        return global.MUI.render();
      }
      const me = State.club(g.mgr.club);
      const step = bid.fromRating - me.rating;
      Game._ask = Game._ask || {};
      if (Game._ask.id !== bid.id) {
        Game._ask = { id: bid.id, fee: Math.round((p.value || bid.fee) * 1.15 / 50000) * 50000 };
      }
      const askStep = Math.max(50000, Math.round((p.value || bid.fee) * 0.06 / 50000) * 50000);
      const over = Game._ask.fee / Math.max(p.value || 1, 1);
      const read = over < 1 ? 'Less than he is worth. They will take that instantly.'
        : over < 1.2 ? 'A fair price for him. They should wear it.'
        : over < 1.6 ? 'Well over the odds. Depends how badly they want him.'
        : 'A silly number. Expect them to walk.';

      UI.modal({
        title: `${bid.fromName} want ${bid.name}`,
        html: `<p class="muted">${U.esc(bid.pos)} · ${bid.age} · rated <b>${bid.ovr}</b> · worth about ${U.cash(p.value || 0)}<br>${U.esc(bid.line)}</p>
          <div class="bid-head">
            <div><span>Their offer</span><b>${U.cash(bid.fee)}</b></div>
            <div><span>Wages there</span><b>${U.cash(bid.wage)}/w</b></div>
            <div><span>Their standing</span><b class="${step > 2 ? 'up' : step < -2 ? 'down' : ''}">${
              step > 0 ? '+' + step : step}</b></div>
          </div>
          ${step > 3 ? `<p class="offer-note">${U.esc(bid.name)} knows this is a step up.
            Turning it down may not go down well with him.</p>` : ''}
          <div class="offer-row">
            <div class="offer-lab">Tell them what he is worth</div>
            <div class="offer-ctl">
              <button class="offer-btn" data-askstep="-1">−</button>
              <b>${U.cash(Game._ask.fee)}</b>
              <button class="offer-btn" data-askstep="1">+</button>
            </div>
            <div class="offer-read">${U.esc(read)}</div>
          </div>`,
        actions: [
          { label: `Accept ${U.cash(bid.fee)}`, onClick: () => {
            const res = M.acceptBid(g, bid);
            Game._ask = null;
            State.save(); global.MUI.render();
            UI.toast(res.ok ? `${bid.name} sold for ${U.cash(res.fee)}.` : res.why,
              res.ok ? 'good' : 'bad');
            Game._bidBack();
          } },
          { label: 'Ask for more', keepOpen: true, cls: 'btn-ghost', onClick: () => {
            const r = M.bidCounter(g, bid, Game._ask.fee);
            State.save();
            if (r.verdict === 'accept') {
              const res = M.acceptBid(g, bid);
              Game._ask = null;
              global.MUI.render();
              UI.closeModal();
              UI.toast(res.ok ? `${bid.name} sold for ${U.cash(res.fee)}.` : res.why,
                res.ok ? 'good' : 'bad');
              return Game._bidBack();
            }
            if (r.verdict === 'walk') {
              g.mgr.bids = (g.mgr.bids || []).filter(b => b.id !== bid.id);
              Game._ask = null;
              State.save(); global.MUI.render();
              UI.closeModal();
              UI.toast(r.why, 'bad');
              return Game._bidBack();
            }
            global.MUI.render();
            Game.mgrBidIn(bid.id);
            UI.toast(r.why, '');
          } },
          { label: 'Not for sale', cls: 'btn-danger', onClick: () => {
            const res = M.rejectBid(g, bid);
            Game._ask = null;
            State.save(); global.MUI.render();
            UI.toast(res.unsettled
              ? `${bid.name} is not happy about that.`
              : `${bid.fromName} have been told no.`, res.unsettled ? 'bad' : '');
            Game._bidBack();
          } },
          { label: 'Decide later', cls: 'btn-ghost', onClick: () => {
            Game._ask = null;
            Game._bidBack();
          } }
        ],
        onRender(m) {
          m.querySelectorAll('[data-askstep]').forEach(el => el.onclick = () => {
            Game._ask.fee = Math.max(50000, Game._ask.fee + (+el.dataset.askstep) * askStep);
            Game.mgrBidIn(bid.id);
          });
        }
      });
    },

    /* ---------------- the negotiating table ----------------
       Name your own fee and your own wage. The selling club answers, and if you
       are close they come back with a number instead of a flat no. */
    mgrBid(id) {
      const g = State.game;
      const M = global.Manager;
      const player = M.market(g).find(s => s.id === id)
        || M.topPlayers(g).find(s => s.id === id);
      if (!player) return;
      Game._offer = {
        player: player,
        fee: player.free ? 0 : player.ask,
        wage: Math.round(player.wage * 1.05 / 1000) * 1000
      };
      Game.mgrOfferSheet();
    },

    /* The sheet itself. Redrawn in place as you move the numbers. */
    mgrOfferSheet(note) {
      const g = State.game;
      const M = global.Manager;
      const o = Game._offer;
      if (!o) return;
      const p = o.player;
      const feeStep = Math.max(50000, Math.round(p.ask * 0.05 / 50000) * 50000);
      const wageStep = Math.max(1000, Math.round(p.wage * 0.05 / 1000) * 1000);

      const view = M.clubView(p, o.fee);
      const clubRead = p.free ? 'Nothing to pay. He is a free agent.'
        : view.mood === 'keen' ? 'Over the odds. They would bite your hand off.'
        : view.mood === 'fair' ? 'At or about the asking price. They will listen.'
        : view.mood === 'close' ? 'Under the asking price. They may come back with a number.'
        : view.mood === 'low' ? 'Well under. Expect them to name their own price.'
        : 'They will not take this seriously.';

      const wr = o.wage / Math.max(p.wage, 1);
      const playerRead = wr < 0.95 ? 'A pay cut. He will need convincing.'
        : wr < 1.08 ? 'About what he earns now.'
        : wr < 1.35 ? 'A rise. That will get his attention.'
        : 'Far more than he is on. Hard to say no to.';

      const overCash = o.fee > g.mgr.budget;
      const overWage = o.wage > (g.mgr.wageBudget - M.squadWages(g));

      UI.modal({
        title: 'Make an offer',
        html: `<p class="muted">${U.esc(p.name)} · ${U.esc(p.pos)} · ${p.age} · rated <b>${p.ovr}</b><br>
            ${U.esc(p.fromClub)} want ${p.free ? 'nothing' : U.cash(p.ask)}.
            He is on ${U.cash(p.wage)}/week.</p>
          ${note ? `<p class="offer-note">${U.esc(note)}</p>` : ''}

          <div class="offer-row${overCash ? ' over' : ''}">
            <div class="offer-lab">Transfer fee</div>
            <div class="offer-ctl">
              <button class="offer-btn" data-feestep="-1" ${p.free ? 'disabled' : ''}>−</button>
              <b>${p.free ? 'Free' : U.cash(o.fee)}</b>
              <button class="offer-btn" data-feestep="1" ${p.free ? 'disabled' : ''}>+</button>
            </div>
            <div class="offer-read">${overCash
              ? `<span class="bad">More than your ${U.cash(g.mgr.budget)} budget.</span>`
              : U.esc(clubRead)}</div>
          </div>

          <div class="offer-row${overWage ? ' over' : ''}">
            <div class="offer-lab">Wages offered</div>
            <div class="offer-ctl">
              <button class="offer-btn" data-wagestep="-1">−</button>
              <b>${U.cash(o.wage)}<span class="per">/w</span></b>
              <button class="offer-btn" data-wagestep="1">+</button>
            </div>
            <div class="offer-read">${overWage
              ? `<span class="bad">Over your wage room of ${U.cash(Math.max(g.mgr.wageBudget - M.squadWages(g), 0))}.</span>`
              : U.esc(playerRead)}</div>
          </div>

          <div class="offer-sum">
            <span>Budget after</span><b>${U.cash(Math.max(g.mgr.budget - o.fee, 0))}</b>
            <span>Wage room after</span><b>${U.cash(Math.max(g.mgr.wageBudget - M.squadWages(g) - o.wage, 0))}</b>
          </div>`,
        actions: [
          { label: 'Send the offer', onClick: () => Game.mgrSendOffer() },
          { label: 'Walk away', cls: 'btn-ghost', onClick: () => { Game._offer = null; } }
        ],
        onRender(m) {
          m.querySelectorAll('[data-feestep]').forEach(el => el.onclick = () => {
            const dir = +el.dataset.feestep;
            o.fee = Math.max(0, o.fee + dir * feeStep);
            Game.mgrOfferSheet(note);
          });
          m.querySelectorAll('[data-wagestep]').forEach(el => el.onclick = () => {
            const dir = +el.dataset.wagestep;
            o.wage = Math.max(1000, o.wage + dir * wageStep);
            Game.mgrOfferSheet(note);
          });
        }
      });
    },

    mgrSendOffer() {
      const g = State.game;
      const M = global.Manager;
      const o = Game._offer;
      if (!o) return;
      const out = M.offerOutcome(g, o.player, o.fee, o.wage);

      if (out.verdict === 'accept') {
        const res = M.completeSigning(g, o.player, o.fee, o.wage);
        Game._offer = null;
        State.save(); global.MUI.render();
        if (res && res.ok) {
          UI.toast(`${res.player.name} has signed.`, 'good');
          Game.mgrPlayerCard(res.player.id);
        }
        return;
      }
      if (out.verdict === 'counter') {
        // their number, on the table, one tap away
        return UI.modal({
          title: 'They have come back',
          html: `<p class="muted">${U.esc(out.why)}</p>
            <p class="muted">Wages would stay at ${U.cash(o.wage)}/week.</p>`,
          actions: [
            { label: `Pay ${U.cash(out.counter)}`, onClick: () => {
              if (out.counter > g.mgr.budget) {
                return UI.toast('You cannot afford their number.', 'bad');
              }
              o.fee = out.counter;
              // their own number: the club is settled, only the player is left
              const again = M.offerOutcome(g, o.player, o.fee, o.wage, true);
              if (again.verdict === 'accept') {
                const res = M.completeSigning(g, o.player, o.fee, o.wage);
                Game._offer = null;
                State.save(); global.MUI.render();
                if (res && res.ok) {
                  UI.toast(`${res.player.name} has signed.`, 'good');
                  Game.mgrPlayerCard(res.player.id);
                }
              } else {
                Game.mgrOfferSheet(again.why);
              }
            } },
            { label: 'Keep talking', cls: 'btn-ghost', onClick: () => Game.mgrOfferSheet(out.why) },
            { label: 'Walk away', cls: 'btn-ghost', onClick: () => { Game._offer = null; } }
          ]
        });
      }
      // no, for one reason or another — the sheet stays open so you can move
      Game.mgrOfferSheet(out.why);
    },

    mgrSell(id) {
      const g = State.game;
      const s = g.squad.find(x => x.id === id);
      if (!s) return;
      UI.modal({
        title: 'Sell ' + s.name + '?',
        text: `${s.pos} · ${s.age} · rated ${s.ovr}. Valued at ${U.cash(s.value)}.\n\n`
          + `${s.apps} appearances, ${s.goals} goals for you.`,
        actions: [
          { label: 'Take the money', cls: 'btn-danger', onClick: () => {
            const r = global.Manager.sell(g, id);
            State.save(); global.MUI.render();
            UI.toast(r && r.ok ? `Sold for ${U.cash(r.fee)}.` : (r && r.why) || 'No deal.', r && r.ok ? 'good' : 'bad');
          } },
          { label: 'Keep him', cls: 'btn-ghost' }
        ]
      });
    },

    /* The names the timeline has given you. Wear whichever one you like. */
    titleMenu() {
      const g = State.game, p = g.player, St = global.Status;
      const have = p.titles || [];
      const mine = St.TITLES.filter(t => have.indexOf(t.id) >= 0);
      const locked = St.TITLES.filter(t => have.indexOf(t.id) < 0);
      UI.modal({
        title: 'What they call you',
        html: (mine.length
            ? `<p class="muted">Tap one to wear it under your name.</p>
               <div class="list">${mine.map(t => `
                 <div class="item click cel-opt${t.id === p.title ? ' on' : ''}" data-title="${t.id}">
                   <div class="ic">${ico('star')}</div>
                   <div class="tx"><b>${U.esc(t.name)}</b><span>Coined by ${U.esc(t.by)}</span></div>
                   <div class="cel-tick">${ico('ok')}</div></div>`).join('')}
                 <div class="item click cel-opt${p.title ? '' : ' on'}" data-title="">
                   <div class="ic">${ico('no')}</div>
                   <div class="tx"><b>No name</b><span>Just your name. Let the football talk.</span></div>
                   <div class="cel-tick">${ico('ok')}</div></div>
               </div>`
            : `<p class="muted">Nobody has come up with anything yet. Keep playing.</p>`)
          + `<div class="section-title">Still out there</div>
             <div class="list">${locked.map(t => `
               <div class="item locked-title"><div class="ic">${ico('star')}</div>
                 <div class="tx"><b>${U.esc(t.name)}</b><span>${U.esc(t.hint)}</span></div></div>`).join('')}</div>`,
        actions: [{ label: 'Done', cls: 'btn-ghost' }],
        onRender(mEl) {
          mEl.querySelectorAll('[data-title]').forEach(el => el.onclick = () => {
            p.title = el.dataset.title || null;
            mEl.querySelectorAll('.cel-opt').forEach(o =>
              o.classList.toggle('on', (o.dataset.title || '') === (p.title || '')));
            State.save();
            UI.render();
          });
        }
      });
    },

    /* Pick what you do when one goes in. Tapping a routine plays it in the
       preview above, so you can see it before you commit to it. */
    celebrationMenu() {
      const g = State.game, p = g.player;
      const list = global.Pitch.CELEBRATIONS;
      UI.modal({
        title: 'Celebration',
        html: `<div class="cel-preview">${global.Pitch.view({ aim: false })}</div>
          <p class="muted cel-note" id="cel-note">Tap one to watch it.</p>
          <div class="list cel-list">${list.map(c => `
            <div class="item click cel-opt${c.id === (p.celebration || 'slide') ? ' on' : ''}" data-cel="${c.id}">
              <div class="ic">${ico(c.icon)}</div>
              <div class="tx"><b>${U.esc(c.name)}</b><span>${U.esc(c.hint)}</span></div>
              <div class="cel-tick">${ico('ok')}</div>
            </div>`).join('')}</div>`,
        actions: [{ label: 'Done', cls: 'btn-ghost' }],
        onRender(mEl) {
          const root = mEl.querySelector('.goal-view');
          const note = mEl.querySelector('#cel-note');
          if (root) global.Pitch.reset(root);
          mEl.querySelectorAll('[data-cel]').forEach(el => el.onclick = () => {
            const id = el.dataset.cel;
            p.celebration = id;
            mEl.querySelectorAll('.cel-opt').forEach(o => o.classList.toggle('on', o.dataset.cel === id));
            const c = global.Pitch.celebrationById(id);
            if (note) note.textContent = c.name + ' — yours now.';
            // celebrate() swaps in the corner scene, so re-query every tap
            const cur = mEl.querySelector('.goal-view');
            if (cur) global.Pitch.celebrate(cur, { style: id, side: 'left' }, () => {});
            State.save();
          });
        }
      });
    },

    /* What changed in this build, and the ones before it. */
    whatsNew() {
      const log = D.CONFIG.CHANGELOG || [];
      UI.modal({
        title: 'What\'s new',
        html: `<p class="muted">You are playing <b>v${U.esc(D.CONFIG.VERSION)}</b>, built ${U.esc(D.CONFIG.BUILD)}.</p>` +
          log.map((rel, i) => `<div class="rel${i ? ' old' : ''}">
            <div class="rel-h"><b>v${U.esc(rel.v)}</b><span>${U.esc(rel.when)}</span>${i ? '' : '<em>this build</em>'}</div>
            <ul class="rel-list">${rel.items.map(t => `<li>${U.esc(t)}</li>`).join('')}</ul>
          </div>`).join(''),
        actions: [{ label: 'Close', cls: 'btn-ghost' }]
      });
    },

    /* Your own account. One post a week, and the room answers back. */
    socialPost() {
      const g = State.game, S = global.Social;
      if (!S.canPost(g)) {
        return UI.toast('You have already posted this week. Let it breathe.', '');
      }
      UI.modal({
        title: 'Post something',
        html: `<p class="muted">${U.esc(S.compact(S.followers(g)))} people are about to read this.</p>
          <div class="list">${S.POST_STYLES.map(st =>
            `<div class="item click" data-ps="${st.id}"><div class="ic">${ico(st.icon)}</div>
              <div class="tx"><b>${U.esc(st.label)}</b><span>${U.esc(st.hint)}</span></div></div>`).join('')}</div>`,
        actions: [{ label: 'Not now', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-ps]').forEach(el => el.onclick = () => {
            UI.closeModal();
            const post = S.postAs(g, el.dataset.ps);
            UI.tab = 'news'; UI.newsView = 'feed';
            State.save();
            UI.render();
            if (post) UI.toast('Posted. ' + S.compact(post.likes) + ' likes already.', 'good');
          });
        }
      });
    },

    /* You won something. Somebody lifts it. Works from either seat: in a career
       it is your club and your name under the cup, in Manager Mode it is the
       club you manage — a manager game has no g.player at all, which is why
       winning the league used to throw here instead of showing the trophy. */
    trophyLift(name, subtitle, then) {
      const g = State.game;
      const mgr = g.mode === 'manager';
      const club = State.club(mgr ? g.mgr.club : g.player.club);
      const kit = global.Crest.accent(club.name) || '#2ae67e';
      const trim = global.Crest.accent2(club.name) || 'rgba(255,255,255,.55)';
      const who = mgr ? `${club.name} — your team.`
        : `${g.player.firstName} ${g.player.lastName} — a winner.`;
      UI.modal({
        html: `<div class="lift-title">${U.esc(subtitle || 'Champions')}</div>
          <div class="lift-wrap">${global.Trophies.liftScene(name, kit, trim)}</div>
          <div class="lift-name">${U.esc(name)}</div>
          <div class="lift-sub">${U.esc(who)}</div>`,
        actions: [{ label: 'Get the medal', onClick: () => { if (then) then(); } }],
        onRender(mEl) {
          const root = mEl.querySelector('.lift-view');
          global.Trophies.playLift(root, () => {});
        }
      });
    },

    /* Did this match just win us something? */
    trophyFromMatch(m) {
      const g = State.game;
      if (m.comp === 'cup' && g.cup && g.cup.won && !g.cup.lifted) { g.cup.lifted = true; return g.cup.name; }
      if (m.comp === 'cont' && g.cont && g.cont.won && !g.cont.lifted) { g.cont.lifted = true; return g.cont.name; }
      if (m.comp === 'intl' && g.intlTournament && g.intlTournament.won && !g.intlTournament.lifted) {
        g.intlTournament.lifted = true; return g.intlTournament.name;
      }
      return null;
    },

    simpleResult(res) {
      if (!res) return;
      UI.modal({ title: res.title || '', text: res.text, actions: [{ label: 'OK' }] });
      State.save();
      UI.render();
    },

    quit() {
      UI.modal({
        title: 'Quit to menu?', text: 'Your career is saved automatically and will be here when you return.',
        actions: [
          { label: 'Quit', cls: 'btn-danger', onClick: () => { State.save(); UI.show('start'); $('btn-continue').disabled = false; } },
          { label: 'Stay', cls: 'btn-ghost' }
        ]
      });
    },

    matchLengthMenu() {
      const g = State.game;
      UI.modal({
        title: 'Match length',
        text: 'How many interactive moments do you want per match?',
        actions: [
          { label: 'Quick — 3 moments', cls: 'btn-ghost', onClick: () => { g.settings.matchLength = 'quick'; UI.toast('Quick matches', 'good'); } },
          { label: 'Normal — 5 moments', cls: 'btn-ghost', onClick: () => { g.settings.matchLength = 'normal'; UI.toast('Normal matches', 'good'); } },
          { label: 'Full — 8 moments', cls: 'btn-ghost', onClick: () => { g.settings.matchLength = 'full'; UI.toast('Full matches', 'good'); } }
        ]
      });
    },

    /* ==================== week activities ==================== */
    weekMenu() {
      const g = State.game;
      if (g.weekActionsLeft <= 0) { UI.toast('No time left this week.', 'bad'); return; }
      const acts = Career.activities(g);
      UI.modal({
        title: 'The week before the match',
        html: `<div class="list">` + acts.map(a =>
          `<div class="item click" data-a="${a.id}"><div class="ic">${ico(a.icon)}</div>
            <div class="tx"><b>${U.esc(a.name)}</b><span>${U.esc(a.desc)}</span></div></div>`).join('') + `</div>`,
        actions: [{ label: 'Cancel', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-a]').forEach(el => el.onclick = () => {
            UI.closeModal();
            Game.runActivity(el.dataset.a);
          });
        }
      });
    },

    runActivity(id) {
      const g = State.game;
      if (id === 'train') return Game.trainMenu();
      if (id === 'media') return Game.mediaMenu();
      Game.spendWeek(() => Career.doActivity(g, id));
    },

    trainMenu() {
      const g = State.game, p = g.player;
      const drills = D.TRAINING
        .filter(t => t.attr !== 'gk' || p.pos === 'GK')
        .filter(t => t.attr !== 'shooting' || p.pos !== 'GK');
      UI.modal({
        title: 'Pick a drill',
        html: `<div class="list">` + drills.map(t => {
          const cap = Engine.Progress.cap(p, t.attr), at = p.attrs[t.attr], maxed = at >= cap;
          return `<div class="item click" data-t="${t.id}"><div class="ic">${ico(t.icon)}</div>
            <div class="tx"><b>${U.esc(t.name)}</b><span>${D.ATTR_LABEL[t.attr]} ${at} / ceiling ${cap}${maxed ? ' — maxed out' : ''} · −${t.fatigue}% fitness</span></div>
            ${maxed ? '<span class="pill green">MAX</span>' : ''}</div>`;
        }).join('') + `</div>`,
        actions: [{ label: 'Cancel', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-t]').forEach(el => el.onclick = () => {
            UI.closeModal();
            Game.spendWeek(() => Career.doActivity(g, 'train', el.dataset.t));
          });
        }
      });
    },

    mediaMenu() {
      const g = State.game;
      const tones = [
        ['humble', '"Credit to the team"', 'Straight bat. The staff approve.'],
        ['ambitious', '"We should be winning this league"', 'Reputation up, risk up.'],
        ['teammates', 'Defend your team-mates', 'Take the heat for the dressing room.'],
        ['bland', 'Say nothing at all', 'Perfectly safe, perfectly forgettable.']
      ];
      UI.modal({
        title: 'Press conference',
        html: `<div class="list">` + tones.map(k =>
          `<div class="item click" data-m="${k[0]}"><div class="ic">${ico('press')}</div>
            <div class="tx"><b>${U.esc(k[1])}</b><span>${U.esc(k[2])}</span></div></div>`).join('') + `</div>`,
        actions: [{ label: 'Cancel', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-m]').forEach(el => el.onclick = () => {
            UI.closeModal();
            Game.spendWeek(() => Career.pressDuty(g, el.dataset.m));
          });
        }
      });
    },

    spendWeek(fn, free) {
      const g = State.game;
      if (!free && g.weekActionsLeft <= 0) { UI.toast('You have no time left this week.', 'bad'); return; }
      const res = fn();
      if (!free && res && res.tone !== undefined) g.weekActionsLeft--;
      else if (!free) g.weekActionsLeft--;
      UI.modal({
        title: (res && res.title) || 'This week',
        text: (res && res.text) || '',
        actions: [{ label: 'Continue' }]
      });
      State.save();
      UI.render();
    },

    /* ==================== SKIPPING AHEAD ====================
       Sim forward several weeks at once, the way a manager holds down
       "continue". It stops early the moment something wants your attention:
       a bad injury, a moment off the pitch, the end of the season. */
    SKIPS: [
      { id: 'month', label: 'One month', weeks: 4, hint: 'About four matches' },
      { id: 'quarter', label: 'Three months', weeks: 13, hint: 'A third of a season' },
      { id: 'season', label: 'Rest of the season', weeks: 999, hint: 'Straight to the end-of-season review' },
      { id: 'year', label: 'A full year', weeks: 46, hint: 'Through the summer and into next season' }
    ],

    skipMenu() {
      const g = State.game;
      UI.modal({
        title: 'Skip ahead',
        html: `<p class="muted">${Math.max(0, g.fixtures.length - g.fixtureIndex)} fixture(s) left this season.
          Matches are simulated and you train in between. It stops early if anything needs you.</p>
          <div class="list">${Game.SKIPS.map(sk =>
            `<div class="item click" data-sk="${sk.id}"><div class="ic">${ico('sim')}</div>
              <div class="tx"><b>${U.esc(sk.label)}</b><span>${U.esc(sk.hint)}</span></div></div>`).join('')}</div>`,
        actions: [{ label: 'Cancel', cls: 'btn-ghost' }],
        onRender(m) {
          m.querySelectorAll('[data-sk]').forEach(el => el.onclick = () => {
            UI.closeModal();
            Game.startSkip(el.dataset.sk);
          });
        }
      });
    },

    startSkip(id) {
      const g = State.game;
      const sk = Game.SKIPS.find(x => x.id === id) || Game.SKIPS[0];
      g.skip = {
        id: sk.id, label: sk.label, remaining: sk.weeks,
        digest: { played: 0, w: 0, d: 0, l: 0, goals: 0, assists: 0, motm: 0,
                  ratingSum: 0, cards: 0, startOvr: g.player.ovr, seasons: 0,
                  results: [], notes: [] }
      };
      Game.runSkip();
    },

    // choose the week's session for you: recover if you need to, otherwise train
    autoWeek(g) {
      const p = g.player;
      if (g.weekActionsLeft <= 0) return;
      let res;
      if (p.injuries.length) res = Career.doActivity(g, 'rehab');
      else if (p.fitness < 58) res = Career.doActivity(g, 'rest');
      else {
        // train whichever key attribute has the most room left below its ceiling
        const w = D.POSITIONS[p.pos].w;
        const drills = D.TRAINING
          .filter(t => (w[t.attr] || 0) > 0.05 || t.attr === 'weakFoot')
          .filter(t => t.attr !== 'gk' || p.pos === 'GK')
          .filter(t => t.attr !== 'shooting' || p.pos !== 'GK')
          .map(t => ({ t, room: Engine.Progress.cap(p, t.attr) - p.attrs[t.attr] }))
          .filter(x => x.room > 0)
          .sort((a, b) => b.room - a.room);
        res = drills.length ? Career.doActivity(g, 'train', drills[0].t.id)
                            : Career.doActivity(g, 'rest');
      }
      g.weekActionsLeft--;
      return res;
    },

    runSkip() {
      const g = State.game, sk = g.skip;
      if (!sk) return;
      const dg = sk.digest;
      let stop = null, guard = 0;

      while (sk.remaining > 0 && guard++ < 200) {
        const f = Engine.Season.nextPlayable(g);
        if (!f) { stop = 'The season is over.'; break; }

        const injuriesBefore = g.player.injuryCount || 0;
        const suspensionBefore = g.player.suspension;
        Game.autoWeek(g);
        Engine.Season.prepareFixture(g, f);
        const m = Engine.Match.create(g, f);
        Engine.Match.simRest(g, m);
        if (m.needsShootout) Game.autoShootout(m);
        if (!m.result) Engine.Match.settle(g, m);

        dg.played++;
        dg.results.push(m.result);
        if (m.result === 'W') dg.w++; else if (m.result === 'D') dg.d++; else dg.l++;
        if (m.role === 'start' || m.role === 'bench') {
          dg.goals += m.stats.goals; dg.assists += m.stats.assists;
          dg.ratingSum += m.stats.rating; dg.rated = (dg.rated || 0) + 1;
          if (m.motm) dg.motm++;
          if (m.stats.card) dg.cards++;
        }

        g.fixtureIndex++;
        g.weekActionsLeft = 1;
        sk.remaining--;
        Game.checkTraits();
        // the rest of the world keeps playing and the press keeps writing
        if (Engine.Press.buzz) Engine.Press.buzz(g);
        if (Engine.Press.world) Engine.Press.world(g);
        if (global.Social) global.Social.weekly(g);
        if (global.Career && Career.weeklyFlagEffects) Career.weeklyFlagEffects(g);

        // stop for things that are new, not for a state you are already in —
        // otherwise one long injury halts the skip on every single match
        if ((g.player.injuryCount || 0) > injuriesBefore) {
          const bad = g.player.injuries[g.player.injuries.length - 1];
          if (bad && bad.matches >= 3) { stop = `You picked up a serious injury: ${bad.name}.`; break; }
        }
        if (g.player.suspension > 0 && suspensionBefore === 0) { stop = 'You have been suspended.'; break; }

        const ev = U.chance(0.3) ? Career.rollEvent(g) : null;
        if (ev) { g.pendingEvent = ev; stop = 'Something needs your attention.'; break; }
      }

      if (sk.remaining <= 0) stop = stop || `${sk.label} done.`;
      State.save();
      UI.show('game');
      UI.tab = 'home';
      UI.render();
      Game.skipSummary(stop);
    },

    skipSummary(stop) {
      const g = State.game, sk = g.skip, dg = sk ? sk.digest : null;
      if (!dg) return;
      const p = g.player;
      const avg = dg.rated ? U.round(dg.ratingSum / dg.rated, 2) : '—';
      const ovrDelta = p.ovr - dg.startOvr;
      const seasonOver = !Engine.Season.nextPlayable(g);
      const done = sk.remaining <= 0 || seasonOver;

      const html = `
        <div class="skip-line">${ico('calendar')} <span>${U.esc(stop || '')}</span></div>
        <div class="stat-grid" style="margin-top:12px">
          <div class="stat"><b>${dg.played}</b><span>Matches</span></div>
          <div class="stat"><b>${dg.w}-${dg.d}-${dg.l}</b><span>W-D-L</span></div>
          <div class="stat"><b>${dg.goals}</b><span>Goals</span></div>
          <div class="stat"><b>${dg.assists}</b><span>Assists</span></div>
          <div class="stat"><b>${avg}</b><span>Avg rating</span></div>
          <div class="stat"><b>${ovrDelta >= 0 ? '+' : ''}${ovrDelta}</b><span>Overall</span></div>
        </div>
        ${dg.results.length ? `<div class="form-guide" style="margin-top:12px;flex-wrap:wrap">${
          dg.results.slice(-14).map(r => `<span class="fg ${r === 'W' ? 'w' : r === 'D' ? 'd' : 'l'}">${r}</span>`).join('')
        }</div>` : ''}
        ${(g.headlines || []).length ? `<div class="section-title">While you were away</div>` +
          (g.headlines || []).slice(0, 4).map(h => `<div class="headline ${h.k}">
            <div class="hl-src">${U.esc(h.src || '')}</div><div class="hl-t">${U.esc(h.t)}</div></div>`).join('') : ''}`;

      const actions = [];
      if (!done && sk.remaining > 0) {
        actions.push({ label: `Keep skipping (${sk.remaining} to go)`, onClick: () => Game.runSkip() });
      }
      actions.push({ label: done ? 'Continue' : 'Stop here', cls: done ? 'btn-primary' : 'btn-ghost',
        onClick: () => { if (done) g.skip = null; Game.afterSkip(); } });

      UI.modal({ title: 'Skipped ' + dg.played + ' week' + (dg.played === 1 ? '' : 's'), html, actions });
    },

    // whatever interrupted the skip gets dealt with now
    afterSkip() {
      const g = State.game;
      if (g.pendingEvent) {
        const ev = g.pendingEvent;
        g.pendingEvent = null;
        Game.showEvent(ev);   // the home screen behind it offers to resume the skip
        return;
      }
      UI.render();
    },

    /* ==================== MATCH ==================== */
    playMatch(interactive) {
      const g = State.game;
      const f = Engine.Season.nextPlayable(g) || g.pendingIntlFixture;
      if (!f) { UI.toast('No fixture to play.', 'bad'); return; }
      Engine.Season.prepareFixture(g, f);
      const m = Engine.Match.create(g, f);
      Game.match = m;

      if (!interactive) {
        Engine.Match.simRest(g, m);
        if (m.needsShootout) { Game.autoShootout(m); }
        Engine.Match.settle(g, m);
        Game.matchSummary(m, true);
        return;
      }

      UI.show('match');
      $('match-feed').innerHTML = '';
      UI.renderScoreboard(m);
      const news = m.role === 'start' ? 'Team news: you start.'
        : m.role === 'bench' ? 'Team news: you are among the substitutes.'
        : m.role === 'injured' ? 'Team news: you are injured and not involved.'
        : m.role === 'suspended' ? 'Team news: you are suspended.'
        : 'Team news: you have not made the squad.';
      UI.pushEvent(news, 'neutral', null, true);
      if (f.star) UI.pushEvent(`Watch out for ${f.star.name} (${f.star.ovr}).`, 'neutral', null, true);
      Game.teamSheet(true);
    },

    /* Both team sheets before kick-off — and again from the touchline button
       at any point during the match. */
    teamSheet(preMatch) {
      const g = State.game, m = Game.match;
      if (!m) return;
      const buttons = preMatch
        ? [{ label: '▶ Kick off', onClick: () => Game.kickOff() },
           { label: '⏩ Quick sim', cls: 'btn-ghost', onClick: () => {
             Engine.Match.simRest(g, m);
             if (m.needsShootout) { Game.autoShootout(m); }
             Engine.Match.settle(g, m);
             Game.matchSummary(m, true);
           } }]
        : [{ label: 'Back to the match', onClick: () => Game.resumeFromSheet() }];
      UI.renderTeamSheet(m, buttons);
    },

    kickOff() {
      const m = Game.match;
      const intro = m.role === 'start' ? 'You are in the starting eleven.'
        : m.role === 'bench' ? 'You start on the bench. Stay ready.'
        : m.role === 'injured' ? 'You watch from the stands in a club tracksuit.'
        : m.role === 'suspended' ? 'Suspended. You watch it from the directors\' box.'
        : 'You are not in the squad today. Brutal.';
      UI.pushEvent(intro, 'neutral', 0, true);
      Game.runMatch();
    },

    /* Put the match back the way the team sheet found it. */
    resumeFromSheet() {
      const g = State.game, m = Game.match;
      if (Game.sheetResume) { const fn = Game.sheetResume; Game.sheetResume = null; fn(); return; }
      Game.runMatch();
    },

    runMatch() {
      const g = State.game, m = Game.match;
      const r = Engine.Match.step(g, m);
      UI.renderScoreboard(m);
      if (r.type === 'commentary') {
        UI.pushEvent(r.entry.text, r.entry.tone, r.entry.minute);
        UI.renderMatchButtons([
          { label: '⏩ Sim to the end', cls: 'btn-ghost', onClick: () => Game.simRest() },
          { label: '👥 Team sheets', cls: 'btn-ghost', onClick: () => {
            clearTimeout(Game.timer);
            Game.sheetResume = () => Game.runMatch();
            Game.teamSheet(false);
          } }
        ]);
        Game.timer = setTimeout(() => Game.runMatch(), 850);
        return;
      }
      if (r.type === 'scenario') {
        if (r.scenario.id === 'penalty') {
          UI.renderPenalty(r.scenario, (zone, root) => Game.takePenalty(r.scenario, zone, root, () => Game.runMatch()));
          return;
        }
        if (r.scenario.id === 'gk_penalty') {
          UI.renderKeeperCall(r.scenario, (i, root) => Game.keeperCall(r.scenario, i, root, () => Game.runMatch()));
          return;
        }
        UI.renderScenario(r.scenario, (i, root) => Game.choose(r.scenario, i, root));
        return;
      }
      if (r.type === 'shootout') { Game.startShootout(); return; }
      if (r.type === 'end') { Game.matchSummary(m); return; }
    },

    /* Aim, watch the kick, then apply what it did. `after` is what to do once
       the animation and the outcome have been shown. */
    takePenalty(scn, zone, root, after) {
      const g = State.game, m = Game.match;
      const label = global.Pitch.ZONES[zone].label;
      const index = scn.options.findIndex(o => o.label === label);
      if (index < 0) return;
      const opt = scn.options[index];
      const fx = Scenarios.resolve(scn, index);
      const how = fx.how || (fx.goal ? 'goal' : 'saved');
      const dive = Game.keeperGuess(zone, how);
      g.player.penTaken = (g.player.penTaken || 0) + 1;
      if (how === 'goal') g.player.penScored = (g.player.penScored || 0) + 1;
      else g.player.penMissed = (g.player.penMissed || 0) + 1;
      UI.verdict('', '');
      global.Pitch.kick(root, zone, dive, how, () => {
        UI.verdict(how === 'goal' ? 'GOAL' : how === 'saved' ? 'SAVED' : 'MISSED', how);
        const out = Engine.Match.applyEffects(g, m, fx, Scenarios.styleOf(scn, opt));
        UI.pushEvent(`${opt.label} → ${fx.text}`, fx.tone, m.minute, true);
        UI.renderScoreboard(m);
        out.forEach(o => {
          if (o.indexOf('attr:') === 0) UI.toast(`${D.ATTR_LABEL[o.slice(5)]} improved!`, 'good');
          if (o === 'red') UI.toast('SENT OFF', 'bad');
        });
        if (fx.goal) UI.toast('GOAL!', 'gold');
        if (how === 'goal') {
          global.Pitch.celebrate(root, { style: g.player.celebration || 'slide',
            side: zone.slice(-1) === 'R' ? 'right' : 'left' }, () => setTimeout(after, 300));
        } else setTimeout(after, 700);
      });
    },

    // where the keeper went, chosen to match what actually happened
    keeperGuess(zone, how) {
      const side = zone === 'TL' || zone === 'BL' ? 'left'
                 : zone === 'TR' || zone === 'BR' ? 'right' : 'centre';
      if (how === 'saved') return side === 'centre' ? 'centre' : side;
      // beaten: he commits the wrong way, which is what the commentary says he did
      if (side === 'centre') return U.chance(0.5) ? 'left' : 'right';
      return side === 'left' ? 'right' : 'left';
    },

    keeperCall(scn, index, root, after) {
      const g = State.game, m = Game.match;
      const opt = scn.options[index];
      const fx = Scenarios.resolve(scn, index);
      const saved = !!fx.save;
      const dive = /left/i.test(opt.label) ? 'left' : /right/i.test(opt.label) ? 'right' : 'centre';
      // if he saved it the ball went where he dived; if not, the other way
      const zone = saved
        ? (dive === 'left' ? U.pick(['TL', 'BL']) : dive === 'right' ? U.pick(['TR', 'BR']) : U.pick(['TC', 'BC']))
        : (dive === 'left' ? U.pick(['TR', 'BR']) : dive === 'right' ? U.pick(['TL', 'BL']) : U.pick(['TL', 'TR', 'BL', 'BR']));
      UI.verdict('', '');
      global.Pitch.kick(root, zone, dive, saved ? 'saved' : 'goal', () => {
        UI.verdict(saved ? 'SAVED' : 'GOAL', saved ? 'goal' : 'saved');
        Engine.Match.applyEffects(g, m, fx, Scenarios.styleOf(scn, opt));
        UI.pushEvent(`${opt.label} → ${fx.text}`, fx.tone, m.minute, true);
        UI.renderScoreboard(m);
        setTimeout(after, 700);
      });
    },

    choose(scn, index, root, next) {
      next = next || (() => Game.runMatch());
      const g = State.game, m = Game.match;
      const opt = scn.options[index];
      const fx = Scenarios.resolve(scn, index);
      const out = Engine.Match.applyEffects(g, m, fx, Scenarios.styleOf(scn, opt));
      UI.pushEvent(`${opt.label} → ${fx.text}`, fx.tone, m.minute, true);
      UI.renderScoreboard(m);
      out.forEach(o => {
        if (o.indexOf('attr:') === 0) UI.toast(`${D.ATTR_LABEL[o.slice(5)]} improved!`, 'good');
        if (o === 'red') UI.toast('SENT OFF', 'bad');
        if (o === 'injury') UI.toast('You are injured', 'bad');
      });
      if (fx.goal) UI.toast('GOAL!', 'gold');
      // picking the signature celebration plays it out on the goal view
      const signature = scn.id === 'celebration' && opt.label === 'Signature celebration' && root;
      const playOn = () => UI.renderMatchButtons([{ label: 'Play on ▶', onClick: next }]);
      if (signature) {
        $('match-action').querySelectorAll('.choice').forEach(c => c.disabled = true);
        global.Pitch.celebrate(root, { style: g.player.celebration || 'slide',
          side: U.chance(0.5) ? 'left' : 'right' }, () => setTimeout(playOn, 250));
      } else playOn();
    },

    simRest() {
      clearTimeout(Game.timer);
      const g = State.game, m = Game.match;
      Engine.Match.simRest(g, m);
      if (m.needsShootout) { Game.startShootout(); return; }
      UI.renderScoreboard(m);
      m.log.slice(-6).forEach(l => UI.pushEvent(l.text, l.tone, l.minute));
      Game.matchSummary(m);
    },

    /* ---------- penalty shootout ---------- */
    startShootout() {
      const m = Game.match;
      m.shootout = { us: 0, them: 0, round: 0, sudden: false, kicks: [] };
      UI.pushEvent('Ninety minutes and extra time could not separate them. PENALTY SHOOTOUT.', 'neutral', 120, true);
      UI.renderScoreboard(m);
      Game.shootoutNext();
    },

    /* Is the shootout over? Best of five until both have taken five, then
       sudden death — and a shootout can never finish level. */
    shootoutDecided(s) {
      const us = s.usKicks || 0, them = s.themKicks || 0;
      if (us < 5 || them < 5) {
        // an unassailable lead with kicks still to come
        const usLeft = Math.max(0, 5 - us), themLeft = Math.max(0, 5 - them);
        if (s.us > s.them + themLeft) return true;
        if (s.them > s.us + usLeft) return true;
        return false;
      }
      // sudden death: only once both have taken the same number of kicks
      return us === them && s.us !== s.them;
    },

    shootoutNext() {
      const g = State.game, m = Game.match, s = m.shootout;
      s.usKicks = s.usKicks || 0; s.themKicks = s.themKicks || 0;

      if (Game.shootoutDecided(s)) return Game.endShootout();

      const ourTurn = s.usKicks <= s.themKicks;
      if (ourTurn) {
        const playerTakes = m.role !== 'out' && !m.sentOff && g.player.pos !== 'GK'
          ? (s.usKicks % 2 === 0) : false;
        if (playerTakes) {
          const ctx = Engine.Match.ctxFor(g, m, { pressure: true });
          const kick = Scenarios.shootoutKick(Object.assign(ctx, {
            shootoutSub: `Shootout ${s.us}–${s.them}. Kick ${s.usKicks + 1}. Eighty thousand people are watching you.`
          }));
          UI.renderPenalty(kick, (zone, root) => {
            const label = global.Pitch.ZONES[zone].label;
            const i = kick.options.findIndex(o => o.label === label);
            if (i < 0) return;
            const fx = Scenarios.resolve(kick, i);
            const how = fx.how || (fx.goal ? 'goal' : 'saved');
            s.usKicks++;
            if (fx.goal) { s.us++; g.player.penScored = (g.player.penScored || 0) + 1; }
            global.Pitch.kick(root, zone, Game.keeperGuess(zone, how), how, () => {
              UI.verdict(how === 'goal' ? 'SCORED' : how === 'saved' ? 'SAVED' : 'MISSED', how);
              UI.pushEvent(`${kick.options[i].label} → ${fx.text}`, fx.tone, null, true);
              Game.shootoutScore();
              // the kick that wins a shootout deserves the full celebration
              if (how === 'goal' && Game.shootoutDecided(s) && s.us > s.them) {
                UI.verdict('WE HAVE WON IT', 'goal');
                global.Pitch.celebrate(root, { style: g.player.celebration || 'slide',
                  side: zone.slice(-1) === 'R' ? 'right' : 'left' },
                  () => setTimeout(() => Game.shootoutNext(), 400));
              } else setTimeout(() => Game.shootoutNext(), 900);
            });
          });
          return;
        }
        const scored = U.chance(0.74);
        s.usKicks++;
        if (scored) s.us++;
        UI.pushEvent(`${m.myName}: ${scored ? 'Scored.' : 'MISSED!'}`, scored ? 'good' : 'bad');
      } else {
        if (g.player.pos === 'GK' && m.role !== 'out' && !m.sentOff) {
          const ctx = Engine.Match.ctxFor(g, m, { pressure: true });
          const dive = {
            title: 'Their kick — pick your dive',
            sub: `Shootout ${s.us}–${s.them}. Read him. Be a hero.`,
            art: 'save',
            options: [
              { label: 'Dive left', hint: 'Commit early.', tag: 'Guess' },
              { label: 'Dive right', hint: 'Commit early.', tag: 'Guess' },
              { label: 'Stay central', hint: 'If he goes down the middle you look like a genius.', tag: 'Nerve' },
              { label: 'Wait and react', hint: 'Reactions over guesswork.', tag: 'Reflex' }
            ]
          };
          UI.renderKeeperCall(dive, (i, root) => {
            const gk = g.player.attrs.gk;
            let saveP = i === 3 ? 0.14 + (gk - 60) * 0.004 : i === 2 ? 0.13 : 0.24 + (gk - 60) * 0.003;
            const saved = U.chance(U.clamp(saveP, 0.05, 0.55));
            s.themKicks++;
            if (!saved) s.them++;
            if (saved) m.stats.saves++;
            const label = dive.options[i].label;
            const way = /left/i.test(label) ? 'left' : /right/i.test(label) ? 'right' : 'centre';
            const zone = saved
              ? (way === 'left' ? U.pick(['TL', 'BL']) : way === 'right' ? U.pick(['TR', 'BR']) : U.pick(['TC', 'BC']))
              : (way === 'left' ? U.pick(['TR', 'BR']) : way === 'right' ? U.pick(['TL', 'BL']) : U.pick(['TL', 'TR', 'BL', 'BR']));
            global.Pitch.kick(root, zone, way, saved ? 'saved' : 'goal', () => {
              UI.verdict(saved ? 'SAVED' : 'HE SCORES', saved ? 'goal' : 'saved');
              UI.pushEvent(saved ? `${label} — SAVED! You are a hero.` : `${label} — he scores.`,
                saved ? 'good' : 'bad', null, true);
              Game.shootoutScore();
              setTimeout(() => Game.shootoutNext(), 900);
            });
          });
          return;
        }
        const scored = U.chance(0.76);
        s.themKicks++;
        if (scored) s.them++;
        UI.pushEvent(`${m.oppName}: ${scored ? 'Scored.' : 'MISSED! Your keeper guesses right!'}`, scored ? 'bad' : 'good');
      }
      Game.shootoutScore();
      UI.renderMatchButtons([{ label: 'Next kick ▶', onClick: () => Game.shootoutNext() }]);
    },

    shootoutScore() {
      const m = Game.match, s = m.shootout;
      $('scoreboard').insertAdjacentHTML('beforeend',
        '');
      UI.renderScoreboard(m);
      const sb = $('scoreboard');
      sb.insertAdjacentHTML('beforeend',
        `<div class="sb-min gold">Shootout: ${s.us} – ${s.them}</div>`);
    },

    endShootout() {
      const g = State.game, m = Game.match, s = m.shootout;
      m.advanced = s.us > s.them;
      UI.pushEvent(m.advanced ? `You win the shootout ${s.us}–${s.them}! Absolute scenes.`
                              : `You lose the shootout ${s.us}–${s.them}. Devastating.`,
        m.advanced ? 'good' : 'bad', null, true);
      Engine.Match.settle(g, m);
      Game.matchSummary(m);
    },

    autoShootout(m) {
      let us = 0, them = 0;
      for (let i = 0; i < 5; i++) { if (U.chance(0.75)) us++; if (U.chance(0.75)) them++; }
      while (us === them) { const a = U.chance(0.75), b = U.chance(0.75); if (a) us++; if (b) them++; }
      m.shootout = { us, them };
      m.advanced = us > them;
    },

    /* ---------- post match ---------- */
    matchSummary(m, quick) {
      const g = State.game, p = g.player;
      const lines = [];
      lines.push(`${m.isHome ? m.myName : m.oppName} ${m.isHome ? m.us : m.them} – ${m.isHome ? m.them : m.us} ${m.isHome ? m.oppName : m.myName}`);
      if (m.shootout) lines.push(`Shootout: ${m.shootout.us} – ${m.shootout.them}`);
      if (m.role === 'start' || m.role === 'bench') {
        lines.push(`Your rating: ${U.round(m.stats.rating, 1)}${m.motm ? '  ·  MAN OF THE MATCH' : ''}`);
        const bits = [];
        if (m.stats.goals) bits.push(`${m.stats.goals} goal${m.stats.goals > 1 ? 's' : ''}`);
        if (m.stats.assists) bits.push(`${m.stats.assists} assist${m.stats.assists > 1 ? 's' : ''}`);
        if (m.stats.saves) bits.push(`${m.stats.saves} save${m.stats.saves > 1 ? 's' : ''}`);
        if (m.stats.card) bits.push(m.stats.card === 'red' ? 'sent off' : 'booked');
        if (bits.length) lines.push(bits.join(' · '));
        lines.push(`${m.stats.minutes} minutes played · fitness now ${Math.round(p.fitness)}%`);
      } else {
        lines.push(m.role === 'out' ? 'You did not make the squad.' :
                   m.role === 'injured' ? 'You watched, injured.' : 'You watched, suspended.');
      }
      if (m.postInjury) lines.push(`You picked up a knock: ${p.injuries.length ? p.injuries[p.injuries.length - 1].name : 'a strain'}.`);

      const finish = () => Game.afterMatch(m);
      if (quick) {
        UI.modal({ title: m.result === 'W' ? 'Win' : m.result === 'D' ? 'Draw' : 'Defeat',
          text: lines.join('\n'), actions: [{ label: 'Continue', onClick: finish }] });
      } else {
        UI.renderScoreboard(m);
        UI.renderMatchButtons([{ label: 'Full time — continue', onClick: () => {
          UI.modal({ title: m.result === 'W' ? 'Win' : m.result === 'D' ? 'Draw' : 'Defeat',
            text: lines.join('\n'), actions: [{ label: 'Continue', onClick: finish }] });
        } }]);
      }
    },

    afterMatch(m) {
      const g = State.game, p = g.player;

      // a final just won: lift it before anything else happens
      const won = Game.trophyFromMatch(m);
      if (won) {
        return Game.trophyLift(won, m.comp === 'intl' ? 'World champions' : 'Cup winners',
          () => { m._lifted = true; Game.afterMatch(m); });
      }

      if (m.comp === 'intl') {
        // move the stats from club season to international record
        if (m.role === 'start' || m.role === 'bench') {
          p.season.apps = Math.max(0, p.season.apps - 1);
          p.season.goals = Math.max(0, p.season.goals - m.stats.goals);
          p.season.assists = Math.max(0, p.season.assists - m.stats.assists);
          p.intl.caps++; p.intl.goals += m.stats.goals;
        }
        State.save();
        return Game.intlNext();
      }

      g.fixtureIndex++;
      g.weekActionsLeft = 1;
      Game.checkTraits();
      UI.show('game');
      UI.tab = 'home';
      UI.render();
      State.save();

      const ev = Career.rollEvent(g);
      if (ev) Game.showEvent(ev);
      else Engine.Press.buzz(g);
      Engine.Press.world(g);
      if (global.Social) global.Social.weekly(g);
      if (global.Career && Career.weeklyFlagEffects) Career.weeklyFlagEffects(g);
    },

    /* An off-field moment, presented like an on-pitch one: a card with the
       situation and a set of tagged choices. */
    showEvent(ev) {
      const g = State.game;
      UI.modal({
        title: ev.title,
        html: `<div class="ev-card">
            <div class="ev-top">${ico(ev.icon || 'club', 'ev-icon')}
              <span class="ev-cat">${U.esc(ev.cat || 'Club')}</span></div>
            <p class="ev-text">${U.esc(ev.text)}</p>
          </div>
          <div class="choices${ev.options.length >= 5 ? ' cols' : ''}">
            ${ev.options.map((o, i) => `<button class="choice" data-ev="${i}">
              <div class="cb"><b>${U.esc(o.label)}</b><span>${U.esc(o.hint || '')}</span></div>
              ${o.tag ? `<span class="tag">${U.esc(o.tag)}</span>` : ''}</button>`).join('')}
          </div>`,
        actions: [],
        onRender(m) {
          m.querySelectorAll('[data-ev]').forEach(btn => btn.onclick = () => {
            const opt = ev.options[+btn.dataset.ev];
            const res = opt.run(g);
            UI.closeModal();
            UI.modal({
              title: opt.label,
              html: `<p class="ev-outcome ${res.tone || ''}">${U.esc(res.text)}</p>`,
              actions: [{ label: 'Continue' }]
            });
            State.save(); UI.render();
          });
        }
      });
    },

    checkTraits() {
      const g = State.game, p = g.player;
      const unlock = (id, cond) => {
        if (cond && !State.hasTrait(p, id)) {
          State.addTrait(p, id);
          const t = D.TRAITS[id];
          UI.toast(`New trait: ${t.name}`, t.bad ? 'bad' : 'gold');
          State.log(`${t.icon} Trait unlocked: ${t.name} — ${t.desc}`, t.bad ? 'bad' : 'good');
        }
      };
      unlock('clinical', p.career.goals >= 30 && p.attrs.shooting >= 76);
      unlock('ice', (p.penScored || 0) >= 4);
      unlock('engine', p.career.apps >= 60 && p.attrs.physical >= 74);
      unlock('idol', p.reputation >= 45);
      unlock('leader', p.age >= 25 && p.managerTrust >= 78 && p.career.apps >= 80);
      unlock('wizard', p.attrs.passing >= 80 && p.career.assists >= 25);
      unlock('tank', p.attrs.defending >= 80 && p.career.apps >= 50);
      unlock('showman', p.attrs.flair >= 82);
      unlock('workhorse', p.career.apps >= 40 && p.managerTrust >= 72);
      unlock('lucky', p.career.trophies.length >= 3 && U.chance(0.5));
      unlock('twofooted', p.attrs.weakFoot >= 85);
      // style traits: earned by being genuinely good at that part of the game
      unlock('finesse',   p.attrs.shooting >= 78 && p.attrs.flair >= 70);
      unlock('power',     p.attrs.shooting >= 78 && p.attrs.physical >= 78);
      unlock('poacher',   p.career.goals >= 40 && D.POSITIONS[p.pos].attack >= 0.4);
      unlock('aerial',    p.attrs.physical >= 80 && p.career.apps >= 40);
      unlock('visionary', p.attrs.passing >= 84 && p.career.assists >= 20);
      unlock('burst',     p.attrs.pace >= 88);
      unlock('pressres',  p.attrs.dribbling >= 80 && p.attrs.passing >= 76);
      unlock('longrange', p.attrs.shooting >= 82 && p.career.goals >= 25);
      unlock('shotstop',  p.pos === 'GK' && p.attrs.gk >= 82);
      unlock('sweeperk',  p.pos === 'GK' && p.attrs.passing >= 76 && p.attrs.pace >= 70);
      unlock('theatrical', (p.divesWon || 0) >= 3);
      unlock('ironman',   p.career.apps >= 120 && (p.injuryCount || 0) <= 1);
      unlock('glass', (p.injuryCount || 0) >= 4);
      unlock('hothead', p.career.red >= 3 || p.career.yellow >= 22);
    },

    /* ==================== INTERNATIONAL TOURNAMENT ==================== */
    startIntl(onDone) {
      const g = State.game, p = g.player;
      g.intlDone = onDone;
      const nat = D.NATIONS.find(n => n.name === p.nation) || D.NATIONS[0];
      const isWC = (g.world.year + 1) % 4 === 0;
      g.intlRun = {
        name: isWC ? 'World Cup ' + (g.world.year + 1) : 'Continental Championship ' + (g.world.year + 1),
        stage: 0, alive: true, won: false, nat,
        rounds: ['Group Match 1', 'Group Match 2', 'Group Match 3', 'Round of 16', 'Quarter-final', 'Semi-final', 'Final']
      };
      UI.modal({
        title: g.intlRun.name,
        text: `${p.nation} have named their squad and you are in it.\n\nSeven games from immortality.`,
        actions: [{ label: 'Report for duty', onClick: () => Game.intlNext() }]
      });
    },

    intlNext() {
      const g = State.game, p = g.player, run = g.intlRun;
      if (!run) { return Game.afterIntl(); }
      if (!run.alive || run.stage >= run.rounds.length) return Game.afterIntl();

      const opponents = D.NATIONS.filter(n => n.name !== p.nation);
      const pool = run.stage < 3 ? opponents.filter(n => Math.abs(n.rating - run.nat.rating) < 12)
                                 : opponents.filter(n => n.rating >= run.nat.rating - 8);
      const opp = U.pick(pool.length ? pool : opponents);
      const f = {
        comp: 'intl', label: run.name + ' · ' + run.rounds[run.stage],
        oppId: null, oppName: opp.name, oppRating: opp.rating,
        home: false, knockout: run.stage >= 3, played: false
      };
      g.pendingIntlFixture = f;

      UI.modal({
        title: run.rounds[run.stage],
        text: `${p.nation}  v  ${opp.name}`,
        actions: [
          { label: '▶ Play match', onClick: () => Game.playIntl(f, true) },
          { label: '⏩ Quick sim', cls: 'btn-ghost', onClick: () => Game.playIntl(f, false) }
        ]
      });
    },

    playIntl(f, interactive) {
      const g = State.game;
      const m = Engine.Match.create(g, f);
      // you are always in the squad for your country if fit
      if (m.role === 'out') m.role = 'bench';
      Game.match = m;
      Engine.Match.buildTimeline(g, m);
      m.interactiveLeft = (m.role === 'start' || m.role === 'bench') ? Engine.Match.interactiveCap(g) : 0;

      if (!interactive) {
        Engine.Match.simRest(g, m);
        if (m.needsShootout) Game.autoShootout(m);
        Engine.Match.settle(g, m);
        Game.intlRecord(m);
        Game.matchSummary(m, true);
        return;
      }
      UI.show('match');
      $('match-feed').innerHTML = '';
      UI.renderScoreboard(m);
      UI.renderTeamSheet(m, [
        { label: '▶ Kick off', onClick: () => {
          UI.pushEvent('The anthems are sung. Here we go.', 'neutral', 0, true);
          Game.runMatchIntl();
        } },
        { label: '⏩ Quick sim', cls: 'btn-ghost', onClick: () => {
          Engine.Match.simRest(g, m);
          if (m.needsShootout) Game.autoShootout(m);
          Engine.Match.settle(g, m);
          Game.intlRecord(m);
          Game.matchSummary(m, true);
        } }
      ]);
    },

    runMatchIntl() {
      // identical loop, but records tournament progress at the end
      const g = State.game, m = Game.match;
      const r = Engine.Match.step(g, m);
      UI.renderScoreboard(m);
      if (r.type === 'commentary') {
        UI.pushEvent(r.entry.text, r.entry.tone, r.entry.minute);
        UI.renderMatchButtons([{ label: '⏩ Sim to the end', cls: 'btn-ghost', onClick: () => {
          clearTimeout(Game.timer);
          Engine.Match.simRest(g, m);
          if (m.needsShootout) { Game.startShootout(); return; }
          Game.intlRecord(m); Game.matchSummary(m);
        } }]);
        Game.timer = setTimeout(() => Game.runMatchIntl(), 850);
        return;
      }
      if (r.type === 'scenario') {
        if (r.scenario.id === 'penalty') {
          UI.renderPenalty(r.scenario, (zone, root) => Game.takePenalty(r.scenario, zone, root, () => Game.runMatchIntl()));
          return;
        }
        if (r.scenario.id === 'gk_penalty') {
          UI.renderKeeperCall(r.scenario, (i, root) => Game.keeperCall(r.scenario, i, root, () => Game.runMatchIntl()));
          return;
        }
        UI.renderScenario(r.scenario, (i, root) => Game.choose(r.scenario, i, root, () => Game.runMatchIntl()));
        return;
      }
      if (r.type === 'shootout') { Game.startShootout(); return; }
      if (r.type === 'end') { Game.intlRecord(m); Game.matchSummary(m); }
    },

    intlRecord(m) {
      const g = State.game, run = g.intlRun;
      if (!run) return;
      if (run.stage >= 3 && m.result === 'L') run.alive = false;
      if (run.stage === 6 && m.result !== 'L') { run.won = true; }
      if (run.stage < 3) run.groupPts = (run.groupPts || 0) + (m.result === 'W' ? 3 : m.result === 'D' ? 1 : 0);
      run.stage++;
      if (run.stage === 3 && (run.groupPts || 0) < 3) {
        run.alive = false;
        State.log(`Knocked out in the ${run.name} group stage.`, 'bad');
      }
    },

    afterIntl() {
      const g = State.game, p = g.player, run = g.intlRun;
      if (run) {
        if (run.won) {
          p.career.trophies.push({ name: run.name, year: g.world.year + 1, club: p.nation });
          State.addReputation(p, 16);
          p.morale = U.clamp(p.morale + 20, 0, 100);
          State.log(`YOU WON THE ${run.name.toUpperCase()}!`, 'good');
          State.news(`${p.nation.toUpperCase()} ARE CHAMPIONS — ${p.lastName} lifts the ${run.name}`, 'good');
          UI.modal({ title: 'CHAMPIONS OF THE WORLD', text: `${p.nation} win the ${run.name}.\n\nYou will never buy a drink in your home town again.`,
            actions: [{ label: 'Unbelievable', onClick: () => Game.finishIntl() }] });
          g.intlRun = null;
          return;
        }
        UI.modal({ title: run.name + ' over',
          text: `Your tournament ends at the ${run.rounds[Math.min(run.stage, 6)]} stage. ${p.intl.caps} caps, ${p.intl.goals} international goals so far.`,
          actions: [{ label: 'Back to club football', onClick: () => Game.finishIntl() }] });
        g.intlRun = null;
        return;
      }
      Game.finishIntl();
    },

    finishIntl() {
      const g = State.game;
      g.pendingIntlFixture = null;
      UI.show('game');
      UI.render();
      const done = g.intlDone; g.intlDone = null;
      if (done) done();
    },

    /* ==================== END OF SEASON ==================== */
    endSeason() {
      const g = State.game, p = g.player;
      const results = Engine.Awards.end(g);
      const club = State.club(p.club);

      // a league title is decided by the table, not by one match — lift it here
      if (results.pos === 1 && g._titleLifted !== g.world.year) {
        g._titleLifted = g.world.year;
        const title = State.league(club.league).name + ' Title';
        return Game.trophyLift(title, 'Champions', () => Game.endSeasonReview(results));
      }
      return Game.endSeasonReview(results);
    },

    endSeasonReview(results) {
      const g = State.game, p = g.player;
      const club = State.club(p.club);

      let html = `<div class="stat-grid">
        <div class="stat"><b>${U.ordinal(results.pos)}</b><span>Finish</span></div>
        <div class="stat"><b>${p.season.apps}</b><span>Apps</span></div>
        <div class="stat"><b>${p.season.goals}</b><span>Goals</span></div>
        <div class="stat"><b>${p.season.assists}</b><span>Assists</span></div>
        <div class="stat"><b>${State.seasonRating(p) || '—'}</b><span>Rating</span></div>
      </div>`;
      if (results.trophies.length) html += `<div style="margin-top:12px">` +
        results.trophies.map(t => UI.trophyChip(t)).join('') + `</div>`;
      if (results.awards.length) html += `<div style="margin-top:6px">` +
        results.awards.map(a => UI.trophyChip(a)).join('') + `</div>`;
      html += `<div class="divider"></div><div class="dim">
        Market value ${U.cash(results.value)} · overall ${p.ovr}</div>`;
      if (results.dev.notes.length) {
        html += `<div class="divider"></div><b>Development</b><div class="dim">${results.dev.notes.join(' · ')}<br>
          Overall ${results.dev.delta >= 0 ? '+' : ''}${results.dev.delta} → <b class="good">${p.ovr}</b></div>`;
      }
      results.notes.forEach(n => html += `<div class="dim" style="margin-top:6px">${U.esc(n)}</div>`);

      UI.modal({
        title: `Season ${g.world.year}/${(g.world.year + 1) % 100} review`,
        html,
        actions: [{ label: 'Continue', onClick: () => Game.seasonMarket() }]
      });
    },

    seasonMarket() {
      const g = State.game, p = g.player;
      const notes = Career.seasonUpkeep(g);
      UI.modal({
        title: 'Where you stand',
        html: `<div class="center card" style="margin-bottom:12px"><span class="dim">MARKET VALUE</span>
          <div class="big-num gold">${U.cash(State.marketValue(p))}</div>
          <div class="dim">Peak ${U.cash(p.peakValue || 0)} · best overall ${p.peakOvr || p.ovr}</div></div>` +
          `<div class="dim">${notes.map(U.esc).join('<br>')}</div>`,
        actions: [{ label: 'Continue', onClick: () => Game.summerIntl() }]
      });
    },

    summerIntl() {
      const g = State.game, p = g.player;
      const tournamentYear = (g.world.year + 1) % 2 === 0;
      if (p.intl.called && !p.intl.retired && tournamentYear && p.injuries.length === 0) {
        Game.startIntl(() => Game.transferWindow());
        return;
      }
      if (p.intl.called && !p.intl.retired) {
        const b = Engine.Intl.friendlyBurst(g);
        if (b) {
          UI.modal({ title: 'International duty',
            text: `${b.caps} caps this season for ${p.nation}${b.goals ? `, and ${b.goals} goal${b.goals > 1 ? 's' : ''}` : ''}. Career total: ${p.intl.caps} caps, ${p.intl.goals} goals.`,
            actions: [{ label: 'Continue', onClick: () => Game.transferWindow() }] });
          return;
        }
      }
      Game.transferWindow();
    },

    transferWindow() {
      const g = State.game, p = g.player, club = State.club(p.club);
      p.contract.years--;
      const expiring = p.contract.years <= 0;
      const offers = Engine.Transfers.generateOffers(g);
      const renewal = Engine.Transfers.renewalOffer(g);
      const wantsToRenew = p.managerTrust > 35 || State.seasonRating(p) > 6.5;

      let html = `<p class="muted">Market value: <b>${U.cash(State.marketValue(p))}</b> · Current deal: ${U.cash(p.contract.wage)}/wk`
        + (expiring ? ' <b class="bad">(EXPIRED)</b>' : ` (${p.contract.years} year${p.contract.years === 1 ? '' : 's'} left)`) + `</p>`;
      html += `<div class="list">`;
      if (wantsToRenew) {
        html += `<div class="item click" data-r="1"><div class="ic">${global.Crest.svg(club.name, 'crest-md')}</div><div class="tx">
          <b>Stay at ${U.esc(club.name)}</b><span>${expiring ? 'New deal: ' : 'Improved terms: '}${U.cash(renewal.wage)}/wk for ${renewal.years} years · signing bonus ${U.cash(renewal.signingBonus)}</span></div></div>`;
      }
      offers.forEach((o, i) => {
        html += `<div class="item click" data-o="${i}"><div class="ic">${global.Crest.svg(o.clubName, 'crest-md')}</div><div class="tx">
          <b>${U.esc(o.clubName)} — ${U.cash(o.fee)}</b>
          <span>Rating ${o.rating} · ${U.cash(o.wage)}/wk for ${o.years} years · bonus ${U.cash(o.signingBonus)}<br>${U.esc(o.pitch)}</span></div></div>`;
      });
      if (!offers.length) html += `<div class="item"><div class="ic">${ico('no')}</div><div class="tx"><b>No offers</b>
        <span>Nobody is knocking this summer. Time to prove them wrong.</span></div></div>`;
      html += `</div>`;

      const actions = [];
      if (!expiring) actions.push({ label: 'Stay and see out my contract', cls: 'btn-ghost', onClick: () => Game.nextSeason() });

      UI.modal({
        title: 'Transfer window', html, actions,
        onRender(m) {
          m.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
            UI.closeModal();
            global.Contracts.joinClub(p, club, renewal);
            State.log(`Signed a new contract at ${club.name}: ${U.cash(renewal.wage)}/week for ${renewal.years} years.`, 'good');
            Game.nextSeason();
          });
          m.querySelectorAll('[data-o]').forEach(el => el.onclick = () => {
            const o = offers[+el.dataset.o];
            UI.closeModal();
            UI.modal({
              title: 'Sign for ' + o.clubName + '?',
              text: `${o.pitch}\n\n${U.cash(o.wage)} per week for ${o.years} years.\nSigning bonus ${U.cash(o.signingBonus)}.\nYour agent takes his cut of the ${U.cash(o.fee)} fee — and so do you.`,
              actions: [
                { label: 'Sign the contract', onClick: () => { Engine.Transfers.accept(g, o); Game.nextSeason(); } },
                { label: 'Think again', cls: 'btn-ghost', onClick: () => Game.transferWindow() }
              ]
            });
          });
          if (!m.querySelector('[data-r]') && !offers.length) {
            // nobody wants you and you have no club — free agent fallback
            if (p.contract.years <= 0) {
              const all = Object.values(g.world.clubs).sort((a, b) => a.rating - b.rating);
              const pool = all.filter(c => c.rating <= p.ovr + 6);
              const fallback = pool[pool.length - 1] || all[0];
              const el = document.createElement('div');
              el.className = 'item click';
              el.innerHTML = `<div class="ic">${ico('transfer')}</div><div class="tx"><b>Free transfer to ${U.esc(fallback.name)}</b>
                <span>They will take you on a modest deal. A career is a career.</span></div>`;
              el.onclick = () => {
                UI.closeModal();
                global.Contracts.joinClub(p, fallback, global.Contracts.offerFor(p, fallback, false));
                g.squad = null; Engine.Squad.ensure(g);
                State.log(`Signed for ${fallback.name} on a free transfer.`, 'info');
                Game.nextSeason();
              };
              m.querySelector('.list').appendChild(el);
            }
          }
        }
      });
    },

    /* ==================== LIVING WORLD ====================
       Runs once per season rollover. The static data never changes — every
       wrinkle lives on g.world so it saves with the career:
         starAges     star name -> extra years on top of the data-file age
         retiredStars names the press and the squad overlays stop mentioning
         youngsters   home-grown kids who age, then break through as stars
         club.drift   a ±6 nudge on top of baseRating that survives the reroll */
    worldTurn(g) {
      const W = g.world;
      W.starAges = W.starAges || {};
      W.retiredStars = W.retiredStars || [];
      W.youngsters = W.youngsters || [];
      g.worldMoves = g.worldMoves || {};

      // --- the greats get older, and eventually they stop
      const map = global.Eras.starMap(g.era, W);   // already aged + filtered
      let retiredNow = 0;
      Object.keys(map).forEach(cn => map[cn].forEach(s => {
        const age = s[4] + 1;
        W.starAges[s[0]] = (W.starAges[s[0]] || 0) + 1;
        if (age >= 35 && (age >= 38 || U.chance((age - 34) * 0.25))) {
          W.retiredStars.push(s[0]);
          retiredNow++;
          State.news(`${s[0]} announces he will hang up his boots at ${age} — end of an era at ${g.worldMoves[s[0]] || cn}`, 'info', null, 'exit');
        }
      }));
      if (retiredNow) g._starMap = null;   // make the squad-overlay cache rebuild

      // --- last year's kids get older; after ~4 seasons they become stars
      W.youngsters.forEach(k => {
        k.age++;
        if (!k.star && k.age >= 20) {
          k.star = true;
          k.ovr = U.int(82, 88);
          g._starMap = null;
          State.news(`${k.name} is the real deal — the ${k.club} ${D.POSITIONS[k.pos].name} is already among the best young players in the world`, 'info', null, 'star');
        }
      });

      // --- new kids arrive
      for (let i = 0, n = U.int(1, 2); i < n; i++) {
        const c = U.pick(Object.values(W.clubs));
        const who = global.Names.person(c.country);
        const kid = { name: who.name, nation: who.nation, club: c.name,
                      pos: U.pick(Object.keys(D.POSITIONS)), age: U.int(16, 17),
                      ovr: U.int(64, 72), star: false };
        W.youngsters.push(kid);
        State.news(`${kid.age}-year-old ${kid.name} scores on his debut for ${c.name} — remember the name`, 'info', null, 'academy');
      }

      // --- real transfers between the clubs you are not watching
      const pool = [];
      Object.keys(map).forEach(cn => map[cn].forEach(s => {
        if (s[3] >= 84 && W.retiredStars.indexOf(s[0]) < 0)
          pool.push({ name: s[0], ovr: s[3], from: g.worldMoves[s[0]] || cn });
      }));
      for (let i = 0, n = Math.min(U.int(3, 6), pool.length); i < n; i++) {
        const mv = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        const from = Object.values(W.clubs).find(c => c.name === mv.from);
        const dests = Object.values(W.clubs).filter(c => c.name !== mv.from && (!from || c.rating >= from.rating - 8));
        if (!from || !dests.length) continue;
        const dest = U.pick(dests);
        g.worldMoves[mv.name] = dest.name;
        from.drift = U.clamp((from.drift || 0) - 1, -6, 6);
        dest.drift = U.clamp((dest.drift || 0) + 1, -6, 6);
        from.rating = U.clamp(from.rating - 1, 55, 93);
        dest.rating = U.clamp(dest.rating + 1, 55, 93);
        State.news(`DONE DEAL: ${mv.name} leaves ${from.name} for ${dest.name} in a ${U.cash((U.int(30, 60) + mv.ovr) * 1000000)} move`, 'info', null, 'transfer');
      }

      // --- every league gets one story: money in, or trouble
      W.leagues.forEach(L => {
        const c = W.clubs[U.pick(L.clubs)];
        if (!c) return;
        const invest = U.chance(0.5);
        c.drift = U.clamp((c.drift || 0) + (invest ? 2 : -2), -6, 6);
        c.rating = U.clamp(c.rating + (invest ? 2 : -2), 55, 93);
        State.news(invest
          ? `New investment at ${c.name} — a wealthy backer promises a ${L.name} title challenge`
          : `Crisis at ${c.name} — debts mount and the dressing room wants out`,
          invest ? 'good' : 'bad', null, invest ? 'club' : 'manager');
      });
    },

    nextSeason() {
      const g = State.game, p = g.player;
      p.age++;
      g.world.year++;
      p.season = State.blankSeason();
      p.fitness = 100;
      p.form = U.clamp(p.form * 0.6 + 30, 30, 85);
      p.suspension = 0;
      p.injuries = [];
      g.weekActionsLeft = 1;

      // club ratings drift a little, around a base that itself now moves
      Object.values(g.world.clubs).forEach(c => {
        c.rating = U.clamp(Math.round(c.baseRating + (c.drift || 0) + U.gauss(0, 2)), 55, 93);
        c.form = [];
      });

      // the rest of the world moves on too: stars age and retire, kids
      // emerge, transfers happen, money comes and goes
      Game.worldTurn(g);

      // a farewell season ends at the testimonial, before any ageing check
      if (p.farewell) {
        const club = State.club(p.club);
        State.news(`The testimonial: ${club.name} legends return for ${p.lastName}'s farewell match`, 'good', null, 'legacy');
        UI.modal({
          title: 'The testimonial',
          text: `A guard of honour, a legends XI, your name sung for ninety minutes. The ${club.name} end will not sit down.\n\nThis is how it ends — and it is a good way to end.`,
          actions: [{ label: 'Hang up the boots', cls: 'btn-danger', onClick: () => Game.retire(false) }]
        });
        return;
      }

      // ageing / forced retirement
      if (p.age >= 41 || (p.age >= 36 && p.ovr < 58)) {
        UI.modal({ title: 'Time is up',
          text: `At ${p.age}, the body has made the decision for you. It is time to retire.`,
          actions: [{ label: 'Hang up the boots', onClick: () => Game.retire(true) }] });
        return;
      }

      Engine.Squad.ensure(g);
      Engine.Season.build(g);
      State.save();
      UI.show('game');
      UI.tab = 'home';
      UI.render();
      // a "full year" skip carries on through the summer into the new season
      if (g.skip && g.skip.remaining > 0) {
        g.skip.digest.seasons++;
        UI.modal({
          title: `Season ${g.world.year}/${(g.world.year + 1) % 100}`,
          text: `A new season begins and you are still skipping ahead — ${g.skip.remaining} week(s) left.`,
          actions: [
            { label: 'Keep skipping', onClick: () => Game.runSkip() },
            { label: 'Stop here', cls: 'btn-ghost', onClick: () => { g.skip = null; UI.render(); } }
          ]
        });
        return;
      }
      UI.modal({
        title: `Season ${g.world.year}/${(g.world.year + 1) % 100}`,
        text: `${p.age} years old · ${State.club(p.club).name} · Overall ${p.ovr}\n\n${g.contQualified ? 'You are in continental competition this season.' : 'League and cup football this season.'}\n\nPre-season is done. Let's go again.`,
        actions: [{ label: 'Kick off' }]
      });
    },

    /* ==================== RETIREMENT ==================== */
    confirmRetire() {
      const p = State.game.player;
      const actions = [
        { label: 'Retire at once', cls: 'btn-danger', onClick: () => Game.retire(false) },
        { label: 'Play on', cls: 'btn-ghost' }
      ];
      // announce now, bow out at the end of the season with a testimonial
      if (!p.farewell) actions.splice(1, 0,
        { label: 'Announce a farewell season', cls: 'btn-gold', onClick: () => Game.farewellSeason() });
      UI.modal({
        title: 'Retire?',
        text: `You are ${p.age}. ${p.career.apps} appearances, ${p.career.goals} goals.` +
          (p.farewell ? '\n\nYou have already announced this is your final season — the testimonial awaits.' :
          '\n\nRetire at once and it ends today. Announce a farewell season and every ground gets to say goodbye before the testimonial.') +
          '\n\nOnce you retire, this career is over for good.',
        actions
      });
    },

    farewellSeason() {
      const g = State.game, p = g.player;
      p.farewell = true;
      p.morale = U.clamp(p.morale + 3, 0, 100);
      const you = p.firstName + ' ' + p.lastName;
      State.news(`"ONE LAST DANCE": ${you} announces he will retire at the end of the season`, 'info', null, 'legacy');
      State.news(`${State.club(p.club).name} confirm a testimonial for ${p.lastName} — legends XI to return`, 'good', null, 'club');
      State.save();
      UI.modal({
        title: 'The announcement',
        text: `Cameras, a lump in the throat. "This is my last season," you say, and the room goes quiet.\n\nEvery away end will applaud you off from here to May. Then the testimonial, then the rest of your life.`,
        actions: [{ label: 'Make it count' }]
      });
      UI.render();
    },

    confirmRetireIntl() {
      const p = State.game.player;
      UI.modal({
        title: 'International retirement?',
        text: `${p.intl.caps} caps, ${p.intl.goals} goals for ${p.nation}.\n\nStep away from the national team and the summers become yours again — no more call-ups, no more tournaments. The club career goes on.`,
        actions: [
          { label: 'Retire from internationals', cls: 'btn-danger', onClick: () => Game.retireIntl() },
          { label: 'Keep answering the call', cls: 'btn-ghost' }
        ]
      });
    },

    retireIntl() {
      const g = State.game, p = g.player;
      p.intl.retired = true;
      p.morale = U.clamp(p.morale + 2, 0, 100);
      State.news(`${p.lastName} calls time on ${p.nation}: ${p.intl.caps} caps, ${p.intl.goals} goals — "the shirt deserved my freshest legs"`, 'info', null, 'nation');
      State.save();
      UI.toast('International career over. The club grind goes on.', 'good');
      UI.render();
    },

    retire(forced) {
      const g = State.game, p = g.player;
      p.retired = true;
      const score = Career.legacyScore(g);
      const rank = Career.legacyRank(score);
      p.legacy = score;

      // the back pages say goodbye
      const you = p.firstName + ' ' + p.lastName;
      State.news(forced
        ? `TIME CALLED: ${you} forced to hang up his boots at ${p.age}`
        : `END OF AN ERA: ${you} announces his retirement from football`, 'info');
      State.news(`Tributes pour in for ${p.lastName}: ${p.career.apps} games, ${p.career.goals} goals, ${p.career.trophies.length} trophies`, 'good', null, 'legacy');
      if (global.Social) global.Social.retire(g);
      if (p.career.clubs.length > 1)
        State.news(`From ${p.career.clubs[0]} to ${p.career.clubs[p.career.clubs.length - 1]}: ${p.lastName}'s journey in shirts`, 'info', null, 'shirt');
      if (p.intl.caps > 0)
        State.news(`${p.nation} salute a servant — ${p.lastName} retires with ${p.intl.caps} caps`, 'good', null, 'nation');

      // the honours a club hands out on a day like this, scaled to the career
      const honors = [];
      if (score >= 1400) honors.push(`A statue of ${p.lastName} is commissioned outside the ground`);
      if (score >= 1000) honors.push(`${State.club(p.club).name} rename a stand in ${p.lastName}'s honour`);
      if (score >= 700) honors.push(`The no. ${p.shirt} shirt is retired — nobody wears it again`);
      if (score >= 450) honors.push(`${p.lastName} enters the club's hall of fame, first ballot`);
      honors.forEach(h => State.news(h, 'good', null, 'legacy'));
      State.save();

      UI.modal({
        title: 'The final whistle',
        html: `<div class="center"><div class="big-num gold">${score}</div>
          <div class="gold" style="font-weight:800;letter-spacing:1px">${rank.title}</div>
          <div class="dim" style="margin:8px 0 14px">${U.esc(rank.desc)}</div></div>
          <div class="stat-grid">
            <div class="stat"><b>${p.career.apps}</b><span>Apps</span></div>
            <div class="stat"><b>${p.career.goals}</b><span>Goals</span></div>
            <div class="stat"><b>${p.career.assists}</b><span>Assists</span></div>
            <div class="stat"><b>${p.career.trophies.length}</b><span>Titles</span></div>
            <div class="stat"><b>${p.intl.caps}</b><span>Caps</span></div>
            <div class="stat"><b>${p.intl.goals}</b><span>Intl Goals</span></div>
            <div class="stat"><b>${p.peakOvr || p.ovr}</b><span>Peak OVR</span></div>
            <div class="stat"><b>${U.cash(p.peakValue || 0)}</b><span>Peak Value</span></div>
            <div class="stat"><b>${State.careerRating(p) || '—'}</b><span>Rating</span></div>
          </div>
          <div class="divider"></div>
          ${honors.length ? `<h3 style="margin:0 0 8px">${ico('trophy')} The club honours you</h3>
            <div class="list">` + honors.map(h => `<div class="item tight-item"><div class="ic">${ico('medal')}</div>
              <div class="tx"><b>${U.esc(h)}</b></div></div>`).join('') + `</div><div class="divider"></div>` : ''}
          <div class="dim">Clubs: ${p.career.clubs.map(U.esc).join(' · ') || '—'}</div>
          <div class="divider"></div>
          <h3 style="margin:0 0 8px">${ico('trophy')} The cabinet</h3>
          ${UI.cabinetHtml(global.Trophies.cabinet(p))}`,
        actions: [{ label: 'What next?', onClick: () => Game.postCareer() }]
      });
    },

    postCareer() {
      const g = State.game, p = g.player;
      const paths = Career.POST_CAREER.filter(o => o.id !== 'ntcoach' || p.intl.caps >= 40);
      UI.modal({
        title: 'Life after football',
        html: `<div class="list">` + paths.map(o =>
          `<div class="item click" data-p="${o.id}"><div class="ic">${ico(o.icon)}</div>
            <div class="tx"><b>${U.esc(o.name)}</b></div></div>`).join('') + `</div>`,
        actions: [],
        onRender(m) {
          m.querySelectorAll('[data-p]').forEach(el => el.onclick = () => {
            const opt = Career.POST_CAREER.find(o => o.id === el.dataset.p);
            UI.closeModal();
            UI.modal({
              title: opt.name, text: opt.text,
              actions: [{ label: 'Start a new career', onClick: () => { State.wipe(); UI.show('start');
                document.getElementById('btn-continue').disabled = true; } }]
            });
          });
        }
      });
    }
  };

  global.Game = Game;
  document.addEventListener('DOMContentLoaded', Game.init);
  if (document.readyState !== 'loading') Game.init();
})(window);

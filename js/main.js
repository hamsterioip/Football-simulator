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

  const Game = {
    match: null,
    timer: null,

    /* ==================== boot ==================== */
    init() {
      global.Icons.inject();          // the SVG sprite every icon points at
      $('btn-new').onclick = () => UI.startWizard();
      $('btn-continue').onclick = () => Game.continueGame();
      $('btn-how').onclick = () => Game.howToPlay();
      $('create-back').onclick = () => Game.wizardBack();
      $('create-next').onclick = () => Game.wizardNext();
      $('modal-back').onclick = e => { if (e.target === $('modal-back')) { /* click-off does nothing */ } };
      $('btn-continue').disabled = !State.hasSave();
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') UI.closeModal();
      });
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
        </div>`,
        actions: [{ label: 'Got it' }]
      });
    },

    continueGame() {
      const g = State.load();
      if (!g) { UI.toast('No saved career found.', 'bad'); return; }
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
      if (w.step === 2 && w.draftIndex > 0) {   // undo the last steal
        const undo = w.robbed.pop();
        if (undo) delete w.caps[undo.attr];
        w.draftIndex--;
        return UI.renderWizard();
      }
      if (w.step === 3) { w.step = 2; w.draftPool = null; return UI.renderWizard(); }
      w.step--; UI.renderWizard();
    },
    wizardNext() {
      const w = UI.wizard;
      if (w.step === 0) {
        w.firstName = (w.firstName || '').trim() || U.pick(D.FIRST_NAMES);
        w.lastName = (w.lastName || '').trim() || U.pick(D.LAST_NAMES);
      }
      if (w.step === 2) return;            // the draft advances itself, pick by pick
      if (w.step < 3) { w.step++; UI.renderWizard(); return; }
      if (!w.clubId) { UI.toast('Pick a club to start at.', 'bad'); return; }
      Game.startCareer();
    },

    startCareer() {
      const w = UI.wizard;
      const g = State.newGame({
        firstName: w.firstName, lastName: w.lastName, nation: w.nation,
        pos: w.pos, foot: w.foot, shirt: w.shirt, age: 17,
        caps: w.caps, draft: w.robbed
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

    /* ==================== action dispatcher ==================== */
    action(act, arg) {
      const g = State.game;
      switch (act) {
        case 'playMatch': return Game.playMatch(true);
        case 'quickMatch': return Game.playMatch(false);
        case 'openWeek': return Game.weekMenu();
        case 'doActivity': return Game.runActivity(arg);
        case 'trainMenu': return Game.trainMenu();
        case 'mediaMenu': return Game.mediaMenu();
        case 'endSeason': return Game.endSeason();
        case 'retire': return Game.confirmRetire();
        case 'save': State.save(); return UI.toast('Career saved.', 'good');
        case 'matchLength': return Game.matchLengthMenu();
        case 'quit': return Game.quit();
      }
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
      const intro = m.role === 'start' ? 'You are in the starting eleven.'
        : m.role === 'bench' ? 'You start on the bench. Stay ready.'
        : m.role === 'injured' ? 'You watch from the stands in a club tracksuit.'
        : m.role === 'suspended' ? 'Suspended. You watch it from the directors\' box.'
        : 'You are not in the squad today. Brutal.';
      UI.pushEvent(intro, 'neutral', 0, true);
      Game.runMatch();
    },

    runMatch() {
      const g = State.game, m = Game.match;
      const r = Engine.Match.step(g, m);
      UI.renderScoreboard(m);
      if (r.type === 'commentary') {
        UI.pushEvent(r.entry.text, r.entry.tone, r.entry.minute);
        UI.renderMatchButtons([{ label: '⏩ Sim to the end', cls: 'btn-ghost', onClick: () => Game.simRest() }]);
        Game.timer = setTimeout(() => Game.runMatch(), 850);
        return;
      }
      if (r.type === 'scenario') {
        UI.renderScenario(r.scenario, i => Game.choose(r.scenario, i));
        return;
      }
      if (r.type === 'shootout') { Game.startShootout(); return; }
      if (r.type === 'end') { Game.matchSummary(m); return; }
    },

    choose(scn, index) {
      const g = State.game, m = Game.match;
      const opt = scn.options[index];
      const fx = opt.run();
      const out = Engine.Match.applyEffects(g, m, fx);
      UI.pushEvent(`${opt.label} → ${fx.text}`, fx.tone, m.minute, true);
      UI.renderScoreboard(m);
      out.forEach(o => {
        if (o.indexOf('attr:') === 0) UI.toast(`${D.ATTR_LABEL[o.slice(5)]} improved!`, 'good');
        if (o === 'red') UI.toast('SENT OFF', 'bad');
        if (o === 'injury') UI.toast('You are injured', 'bad');
      });
      if (fx.goal) UI.toast('GOAL!', 'gold');
      UI.renderMatchButtons([{ label: 'Play on ▶', onClick: () => Game.runMatch() }]);
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

    shootoutDecided(s) {
      const remainingUs = Math.max(0, 5 - s.round - (s.pendingUs ? 0 : 0));
      if (s.round >= 5) {
        if (s.usKicks === s.themKicks && s.us !== s.them) return true;
        return false;
      }
      const usLeft = 5 - (s.usKicks || 0), themLeft = 5 - (s.themKicks || 0);
      if (s.us > s.them + themLeft) return true;
      if (s.them > s.us + usLeft) return true;
      return false;
    },

    shootoutNext() {
      const g = State.game, m = Game.match, s = m.shootout;
      s.usKicks = s.usKicks || 0; s.themKicks = s.themKicks || 0;

      if (Game.shootoutDecided(s)) return Game.endShootout();
      if (s.usKicks >= 5 && s.themKicks >= 5 && s.usKicks === s.themKicks && s.us !== s.them) return Game.endShootout();

      const ourTurn = s.usKicks <= s.themKicks;
      if (ourTurn) {
        const playerTakes = m.role !== 'out' && !m.sentOff && g.player.pos !== 'GK'
          ? (s.usKicks % 2 === 0) : false;
        if (playerTakes) {
          const ctx = Engine.Match.ctxFor(g, m, { pressure: true });
          const kick = Scenarios.shootoutKick(Object.assign(ctx, {
            shootoutSub: `Shootout ${s.us}–${s.them}. Kick ${s.usKicks + 1}. Eighty thousand people are watching you.`
          }));
          UI.renderScenario(kick, i => {
            const fx = kick.options[i].run();
            s.usKicks++;
            if (fx.goal) { s.us++; g.player.penScored = (g.player.penScored || 0) + 1; }
            UI.pushEvent(`${kick.options[i].label} → ${fx.text}`, fx.tone, null, true);
            Game.shootoutScore();
            setTimeout(() => Game.shootoutNext(), 500);
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
          UI.renderScenario(dive, i => {
            const gk = g.player.attrs.gk;
            let saveP = i === 3 ? 0.14 + (gk - 60) * 0.004 : i === 2 ? 0.13 : 0.24 + (gk - 60) * 0.003;
            const saved = U.chance(U.clamp(saveP, 0.05, 0.55));
            s.themKicks++;
            if (!saved) s.them++;
            UI.pushEvent(saved ? `${dive.options[i].label} — SAVED! You are a hero.` : `${dive.options[i].label} — he scores.`,
              saved ? 'good' : 'bad', null, true);
            if (saved) m.stats.saves++;
            Game.shootoutScore();
            setTimeout(() => Game.shootoutNext(), 500);
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
      if (ev) {
        UI.modal({
          title: (ev.icon ? ico(ev.icon) + ' ' : '') + ev.title, text: ev.text,
          actions: ev.options.map(o => ({
            label: o.label, cls: 'btn-ghost',
            onClick: () => {
              const res = o.run(g);
              UI.modal({ title: '', text: res.text, actions: [{ label: 'Continue' }] });
              State.save(); UI.render();
            }
          }))
        });
      }
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
      UI.pushEvent('The anthems are sung. Here we go.', 'neutral', 0, true);
      Game.runMatchIntl();
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
      if (r.type === 'scenario') { UI.renderScenario(r.scenario, i => { Game.choose(r.scenario, i);
        UI.renderMatchButtons([{ label: 'Play on ▶', onClick: () => Game.runMatchIntl() }]); }); return; }
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

      let html = `<div class="stat-grid">
        <div class="stat"><b>${U.ordinal(results.pos)}</b><span>Finish</span></div>
        <div class="stat"><b>${p.season.apps}</b><span>Apps</span></div>
        <div class="stat"><b>${p.season.goals}</b><span>Goals</span></div>
        <div class="stat"><b>${p.season.assists}</b><span>Assists</span></div>
        <div class="stat"><b>${State.seasonRating(p) || '—'}</b><span>Rating</span></div>
      </div>`;
      if (results.trophies.length) html += `<div style="margin-top:12px">` +
        results.trophies.map(t => `<span class="trophy">${ico('trophy')} ${U.esc(t)}</span>`).join('') + `</div>`;
      if (results.awards.length) html += `<div style="margin-top:6px">` +
        results.awards.map(a => `<span class="trophy">${ico('medal')} ${U.esc(a)}</span>`).join('') + `</div>`;
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
        html += `<div class="item click" data-r="1"><div class="ic">${ico('agent')}</div><div class="tx">
          <b>Stay at ${U.esc(club.name)}</b><span>${expiring ? 'New deal: ' : 'Improved terms: '}${U.cash(renewal.wage)}/wk for ${renewal.years} years · signing bonus ${U.cash(renewal.signingBonus)}</span></div></div>`;
      }
      offers.forEach((o, i) => {
        html += `<div class="item click" data-o="${i}"><div class="ic">${ico('club')}</div><div class="tx">
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

      // club ratings drift a little
      Object.values(g.world.clubs).forEach(c => {
        c.rating = U.clamp(Math.round(c.baseRating + U.gauss(0, 2)), 55, 93);
        c.form = [];
      });

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
      UI.modal({
        title: `Season ${g.world.year}/${(g.world.year + 1) % 100}`,
        text: `${p.age} years old · ${State.club(p.club).name} · Overall ${p.ovr}\n\n${g.contQualified ? 'You are in continental competition this season.' : 'League and cup football this season.'}\n\nPre-season is done. Let's go again.`,
        actions: [{ label: 'Kick off' }]
      });
    },

    /* ==================== RETIREMENT ==================== */
    confirmRetire() {
      const p = State.game.player;
      UI.modal({
        title: 'Retire?',
        text: `You are ${p.age}. ${p.career.apps} appearances, ${p.career.goals} goals.\n\nOnce you retire, this career is over for good.`,
        actions: [
          { label: 'Retire', cls: 'btn-danger', onClick: () => Game.retire(false) },
          { label: 'One more season', cls: 'btn-ghost' }
        ]
      });
    },

    retire(forced) {
      const g = State.game, p = g.player;
      p.retired = true;
      const score = Career.legacyScore(g);
      const rank = Career.legacyRank(score);
      p.legacy = score;

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
          <div class="dim">Clubs: ${p.career.clubs.map(U.esc).join(' · ') || '—'}</div>
          ${p.career.trophies.length ? '<div style="margin-top:10px">' + p.career.trophies.map(t =>
            `<span class="trophy">${ico('trophy')} ${U.esc(UI.trophyLabel(t))}</span>`).join('') + '</div>' : ''}`,
        actions: [{ label: 'What next?', onClick: () => Game.postCareer() }]
      });
    },

    postCareer() {
      const g = State.game;
      UI.modal({
        title: 'Life after football',
        html: `<div class="list">` + Career.POST_CAREER.map(o =>
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

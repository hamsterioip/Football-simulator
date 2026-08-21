/* ==========================================================================
   ui.js — screens, rendering, modals, the creation wizard
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U, State = global.State, Engine = global.Engine;
  const $ = id => document.getElementById(id);
  const esc = U.esc;
  const ico = (name, cls, label) => global.Icons.svg(name, cls, label);
  const flag = (country, cls) => global.Icons.flag(country, cls);

  const UI = {
    tab: 'home',
    wizard: null,

    /* ---------------- screens ---------------- */
    show(name) {
      ['start', 'create', 'game', 'match'].forEach(s => {
        const el = $('screen-' + s);
        if (el) el.classList.toggle('active', s === name);
      });
    },

    toast(text, kind) {
      const el = document.createElement('div');
      el.className = 'toast ' + (kind || '');
      el.textContent = text;
      $('toasts').appendChild(el);
      setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 2400);
      setTimeout(() => el.remove(), 2900);
    },

    modal(opts) {
      const m = $('modal');
      let html = '';
      if (opts.title) html += `<h2>${opts.title}</h2>`;
      if (opts.text) html += `<p>${esc(opts.text)}</p>`;
      if (opts.html) html += opts.html;
      html += '<div class="modal-actions">';
      (opts.actions || [{ label: 'Continue' }]).forEach((a, i) => {
        html += `<button class="btn ${a.cls || 'btn-primary'}" data-mi="${i}">${a.label}</button>`;
      });
      html += '</div>';
      m.innerHTML = html;
      m.querySelectorAll('[data-mi]').forEach(btn => {
        btn.onclick = () => {
          const a = (opts.actions || [{}])[+btn.dataset.mi];
          if (!a || !a.keepOpen) UI.closeModal();
          if (a && a.onClick) a.onClick();
        };
      });
      if (opts.onRender) opts.onRender(m);
      $('modal-back').classList.add('on');
    },
    closeModal() { $('modal-back').classList.remove('on'); },

    /* ---------------- small render helpers ---------------- */
    trophyLabel(t) { return /\d{4}$/.test(t.name) ? t.name : t.name + ' ' + t.year; },
    bar(label, value, color) {
      const v = U.clamp(value, 0, 100);
      return `<div class="bar"><div class="bar-l"><span>${label}</span><span>${Math.round(v)}</span></div>
        <div class="bar-t"><div class="bar-f" style="width:${v}%;background:${color}"></div></div></div>`;
    },
    attrRow(p, key) {
      const v = p.attrs[key] || 0;
      const cap = Engine.Progress.cap(p, key);
      const xp = (p.xp && p.xp[key]) || 0;
      const need = Engine.Progress.xpNeeded(p, key);
      return `<div class="attr">
        <div class="attr-h"><span>${D.ATTR_LABEL[key]}</span><b>${v}${xp > 0 ? ` <span class="dim">+${Math.round(xp / need * 100)}%</span>` : ''}</b></div>
        <div class="attr-t"><div class="attr-f" style="width:${v}%"></div>
          <div class="attr-cap" style="left:${U.clamp(cap, 0, 100)}%"></div></div></div>`;
    },

    /* ==========================================================================
       CREATION WIZARD — identity, position, the draft, then a club
       ========================================================================== */
    startWizard() {
      UI.wizard = {
        step: 0,
        firstName: U.pick(D.FIRST_NAMES),
        lastName: U.pick(D.LAST_NAMES),
        nation: 'England',
        foot: 'Right',
        shirt: U.pick([7, 9, 10, 11, 8, 14, 21, 23, 1]),
        pos: 'ST',
        clubId: null,
        draftPool: null, draftIndex: 0, caps: {}, robbed: []
      };
      UI.show('create');
      UI.renderWizard();
    },

    STEPS: ['Identity', 'Position', 'The Draft', 'Club'],

    startDraft() {
      const w = UI.wizard;
      const gk = w.pos === 'GK';
      const pool = gk ? D.LEGENDS_GK : D.LEGENDS;
      w.draftPool = U.pickN(pool, Math.min(D.CONFIG.DRAFT_PICKS, pool.length));
      w.draftAttrs = (gk ? D.DRAFT_ATTRS_GK : D.DRAFT_ATTRS).slice();
      w.draftIndex = 0;
      w.caps = {};
      w.robbed = [];
    },

    renderWizard() {
      const w = UI.wizard;
      $('create-steps').innerHTML = UI.STEPS.map((_, i) =>
        `<div class="${i <= w.step ? 'on' : ''}"></div>`).join('');
      const body = $('create-body');

      if (w.step === 0) {
        body.innerHTML = `
          <h2 class="wz-h">Who are you?</h2>
          <p class="wz-p">Every career starts with a name on a team sheet.</p>
          <div class="row"><div class="field grow"><label>First name</label>
            <input class="input" id="w-first" maxlength="14" value="${esc(w.firstName)}"></div>
            <div class="field grow"><label>Surname</label>
            <input class="input" id="w-last" maxlength="16" value="${esc(w.lastName)}"></div></div>
          <div class="field"><label>Nationality</label>
            <select class="input" id="w-nat">${D.NATIONS.map(n =>
              `<option value="${esc(n.name)}" ${n.name === w.nation ? 'selected' : ''}>${esc(n.name)}</option>`).join('')}</select></div>
          <div class="row">
            <div class="field grow"><label>Strong foot</label>
              <div class="opt-grid two" data-group="foot">${['Left', 'Right'].map(f =>
                `<div class="opt ${w.foot === f ? 'sel' : ''}" data-val="${f}">${f}</div>`).join('')}</div></div>
            <div class="field" style="width:120px"><label>Shirt number</label>
              <input class="input" id="w-shirt" type="number" min="1" max="99" value="${w.shirt}"></div>
          </div>`;
        body.querySelector('#w-first').oninput = e => w.firstName = e.target.value;
        body.querySelector('#w-last').oninput = e => w.lastName = e.target.value;
        body.querySelector('#w-nat').onchange = e => w.nation = e.target.value;
        body.querySelector('#w-shirt').oninput = e => w.shirt = U.clamp(parseInt(e.target.value, 10) || 10, 1, 99);
        UI.optGroup(body, 'foot', v => { w.foot = v; UI.renderWizard(); });

      } else if (w.step === 1) {
        body.innerHTML = `
          <h2 class="wz-h">Pick your position</h2>
          <p class="wz-p">This decides the moments you will face — and what you will be judged on.</p>
          <div class="opt-grid" data-group="pos">${Object.keys(D.POSITIONS).map(k =>
            `<div class="opt ${w.pos === k ? 'sel' : ''}" data-val="${k}"><b>${k}</b><small>${D.POSITIONS[k].name}</small></div>`).join('')}</div>
          <div class="card" style="margin-top:16px">
            <h3>${D.POSITIONS[w.pos].name}</h3>
            <p class="dim" style="margin:0">Judged on: ${Object.keys(D.POSITIONS[w.pos].w)
              .filter(k => D.POSITIONS[w.pos].w[k] >= 0.15).map(k => D.ATTR_LABEL[k]).join(', ')}</p>
          </div>`;
        UI.optGroup(body, 'pos', v => { w.pos = v; w.draftPool = null; UI.renderWizard(); });

      } else if (w.step === 2) {
        if (!w.draftPool) UI.startDraft();
        const legend = w.draftPool[w.draftIndex];
        const done = w.draftIndex >= w.draftPool.length;
        if (done || !legend) { w.step = 3; return UI.renderWizard(); }
        const takenAttrs = w.robbed.map(r => r.attr);
        body.innerHTML = `
          <h2 class="wz-h">Rob a legend</h2>
          <p class="wz-p">Eight greats walk past you, one at a time. Take exactly one attribute from each —
            what you take becomes your <b>ceiling</b> in it. You will start at about half, and spend a career climbing.</p>
          <div class="legend-card">
            <div class="legend-top">
              ${flag(legend.nation, 'lg')}
              <div class="legend-id">
                <b>${esc(legend.name)}</b>
                <span>${esc(legend.role)} · ${esc(legend.nation)} · ${esc(legend.era)}</span>
              </div>
              <div class="legend-count">${w.draftIndex + 1}<span>/${w.draftPool.length}</span></div>
            </div>
            <p class="legend-note">"${esc(legend.note)}"</p>
            <div class="steal-grid">
              ${w.draftAttrs.map(a => {
                const taken = takenAttrs.indexOf(a) >= 0;
                const v = legend.attrs[a] || 50;
                const grade = v >= 90 ? 'elite' : v >= 78 ? 'good' : v >= 62 ? 'ok' : 'poor';
                return `<button class="steal ${grade} ${taken ? 'taken' : ''}" ${taken ? 'disabled' : ''} data-steal="${a}">
                  ${ico(a)}<b>${v}</b><span>${D.ATTR_LABEL[a]}</span>
                  ${taken ? '<em>taken</em>' : ''}</button>`;
              }).join('')}
            </div>
          </div>
          ${w.robbed.length ? `<div class="robbed"><span class="dim">Stolen so far</span>
            <div>${w.robbed.map(r => `<span class="rob-chip">${ico(r.attr)}${D.ATTR_LABEL[r.attr]} <b>${r.value}</b></span>`).join('')}</div>
          </div>` : ''}`;
        body.querySelectorAll('[data-steal]').forEach(btn => {
          btn.onclick = () => {
            const a = btn.dataset.steal;
            w.caps[a] = legend.attrs[a];
            w.robbed.push({ attr: a, value: legend.attrs[a], from: legend.name });
            w.draftIndex++;
            if (w.draftIndex >= w.draftPool.length) w.step = 3;
            UI.renderWizard();
          };
        });

      } else {
        // preview the player the draft produced, then offer clubs that would take him
        const preview = State.createPlayer({
          firstName: w.firstName, lastName: w.lastName, nation: w.nation,
          pos: w.pos, foot: w.foot, shirt: w.shirt, age: 17, caps: w.caps, draft: w.robbed
        });
        w.preview = preview;
        const potential = State.potentialOverall(preview);
        const maxRating = Math.round(U.clamp(46 + potential * 0.5, 62, 93));
        const world = State.buildWorld(D.CONFIG.SEASON_START_YEAR);
        UI.previewWorld = world;
        body.innerHTML = `
          <h2 class="wz-h">Sign your first contract</h2>
          <div class="card tight preview-card">
            <div class="row" style="align-items:center;gap:12px">
              <div class="hud-avatar"><span class="shirt-no">${preview.shirt}</span></div>
              <div class="grow"><b>${esc(preview.firstName)} ${esc(preview.lastName)}</b>
                <div class="dim">${preview.pos} · 17 · ${esc(preview.nation)}</div></div>
              <div class="prev-ovr"><b>${preview.ovr}</b><span>NOW</span></div>
              <div class="prev-ovr pot"><b>${potential}</b><span>CEILING</span></div>
            </div>
          </div>
          <p class="wz-p">Clubs above your level will not gamble on a teenager. Sign low and climb,
            or take the biggest badge you can and fight for a shirt.</p>
          <div class="field"><label>League</label>
            <select class="input" id="w-league">${world.leagues.map(l =>
              `<option value="${l.id}">${esc(l.name)} — ${esc(l.country)}</option>`).join('')}</select></div>
          <div class="club-list" id="w-clubs"></div>`;
        const renderClubs = () => {
          const lid = body.querySelector('#w-league').value;
          const league = world.leagues.find(l => l.id === lid);
          $('w-clubs').innerHTML = league.clubs.map(id => {
            const c = world.clubs[id];
            const locked = c.rating > maxRating;
            const tough = !locked && c.rating > preview.ovr + 26;
            return `<div class="club ${locked ? 'locked' : ''} ${w.clubId === id ? 'sel' : ''}" data-club="${id}" ${locked ? 'data-locked="1"' : ''}>
              <b>${esc(c.name)}</b><span>${locked ? 'Out of your league' : 'Rated ' + c.rating + (tough ? ' · you will have to wait for a shirt' : '')}</span></div>`;
          }).join('');
          $('w-clubs').querySelectorAll('.club').forEach(el => {
            el.onclick = () => {
              if (el.dataset.locked) { UI.toast('They will not take a chance on you yet.', 'bad'); return; }
              w.clubId = el.dataset.club; renderClubs();
            };
          });
        };
        body.querySelector('#w-league').onchange = renderClubs;
        renderClubs();
      }

      $('create-back').textContent = w.step === 0 ? 'Cancel' : 'Back';
      $('create-next').textContent = w.step === 3 ? 'Start Career' : 'Next';
      $('create-next').classList.toggle('hidden', w.step === 2);
    },

    optGroup(root, group, cb) {
      root.querySelectorAll(`[data-group="${group}"] .opt`).forEach(el => {
        el.onclick = () => cb(el.dataset.val);
      });
    },

    /* ==========================================================================
       HUD + TABS
       ========================================================================== */
    renderHUD() {
      const g = State.game, p = g.player, club = State.club(p.club);
      $('hud').innerHTML = `
        <div class="hud-top">
          <div class="hud-avatar"><span class="shirt-no">${p.shirt}</span></div>
          <div class="hud-id">
            <div class="hud-name">${esc(p.firstName)} ${esc(p.lastName)}</div>
            <div class="hud-meta">${flag(p.nation, 'sm')} ${p.pos} · ${p.age}y · ${esc(club.name)}</div>
          </div>
          <div class="hud-ovr"><b>${p.ovr}</b><span>OVR</span></div>
        </div>
        <div class="hud-bars">
          ${UI.bar('Fit', p.fitness, 'linear-gradient(90deg,#12b45f,#22e07a)')}
          ${UI.bar('Form', p.form, 'linear-gradient(90deg,#3d8bff,#5aa8ff)')}
          ${UI.bar('Mood', p.morale, 'linear-gradient(90deg,#b483ff,#d9b6ff)')}
          ${UI.bar('Rep', p.reputation, 'linear-gradient(90deg,#f5b224,#ffd977)')}
        </div>`;
    },

    TABS: [
      { id: 'home', icon: 'career', label: 'Career' },
      { id: 'club', icon: 'club', label: 'Club' },
      { id: 'player', icon: 'player', label: 'Player' },
      { id: 'news', icon: 'news', label: 'Press' },
      { id: 'legacy', icon: 'legacy', label: 'Legacy' }
    ],

    renderTabs() {
      $('tabbar').innerHTML = UI.TABS.map(t =>
        `<button class="${UI.tab === t.id ? 'on' : ''}" data-tab="${t.id}">${ico(t.icon)}${t.label}</button>`).join('');
      $('tabbar').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { UI.tab = b.dataset.tab; UI.render(); });
    },

    render() {
      if (!State.game) return;
      UI.renderHUD();
      UI.renderTabs();
      const c = $('content');
      c.innerHTML = UI['tab_' + UI.tab] ? UI['tab_' + UI.tab]() : '';
      c.scrollTop = 0;
      UI.bindActions(c);
    },

    bindActions(root) {
      root.querySelectorAll('[data-act]').forEach(el => {
        el.onclick = () => global.Game.action(el.dataset.act, el.dataset.arg);
      });
    },

    /* ---------------- CAREER (home) ---------------- */
    tab_home() {
      const g = State.game, p = g.player;
      const f = Engine.Season.nextPlayable(g);
      let html = '';

      if (!f) {
        html += `<div class="card center"><h3>Season complete</h3>
          <p class="muted">Every fixture played. Time to look back at it.</p>
          <button class="btn btn-primary btn-block" data-act="endSeason">End of Season Review</button></div>`;
      } else {
        Engine.Season.prepareFixture(g, f);
        const opp = f.oppId ? State.club(f.oppId) : { name: f.oppName || 'TBC' };
        const me = State.club(p.club);
        html += `<div class="fixture">
          <div class="comp">${esc(f.label)}</div>
          <div class="teams">
            <div class="team">${f.home ? esc(me.name) : esc(opp.name)}</div>
            <div class="vs">V</div>
            <div class="team">${f.home ? esc(opp.name) : esc(me.name)}</div>
          </div>
          <div class="venue">${ico(f.home ? 'home' : 'away')} ${f.home ? 'Home' : 'Away'}
            · Match ${g.fixtureIndex + 1} of ${g.fixtures.length}</div>
        </div>`;

        const blocked = p.suspension > 0 ? `Suspended for ${p.suspension} more match(es).`
          : p.injuries.length ? `${p.injuries[0].name} — ${p.injuries[0].matches} match(es) left.` : null;
        if (blocked) html += `<div class="card tight warn">${ico('alert')} <b>${esc(blocked)}</b>
          <div class="dim">You will not feature, but the match still has to be played.</div></div>`;

        html += `<div class="row" style="margin-bottom:12px">
          <button class="btn btn-primary grow" data-act="playMatch">${ico('play')} Play Match</button>
          <button class="btn btn-ghost" data-act="quickMatch">${ico('sim')} Quick Sim</button>
        </div>`;

        if (g.weekActionsLeft > 0) {
          html += `<div class="card gold-edge">
            <h3 class="gold">${ico('calendar')} The week before</h3>
            <p class="dim" style="margin:0 0 10px">One session, one decision. Choose before kick-off.</p>
            <button class="btn btn-gold btn-block" data-act="openWeek">Choose</button></div>`;
        }
      }

      const club = State.club(p.club);
      const table = Engine.Season.standings(g, club.league);
      const anyPlayed = table.some(r => r.p > 0);
      const pos = Engine.Season.position(g);
      html += `<div class="card"><h3>Season ${g.world.year}/${(g.world.year + 1) % 100}</h3>
        <div class="stat-grid">
          <div class="stat"><b>${anyPlayed ? U.ordinal(pos) : '—'}</b><span>${esc(State.league(club.league).name.split(' ')[0])}</span></div>
          <div class="stat"><b>${p.season.apps}</b><span>Apps</span></div>
          <div class="stat"><b>${p.season.goals}</b><span>Goals</span></div>
          <div class="stat"><b>${p.season.assists}</b><span>Assists</span></div>
          <div class="stat"><b>${State.seasonRating(p) || '—'}</b><span>Avg Rating</span></div>
        </div></div>`;

      const comps = [];
      if (g.cup) comps.push([g.cup.won ? 'trophy' : g.cup.alive ? 'ok' : 'no', g.cup.name]);
      if (g.cont) comps.push([g.cont.won ? 'trophy' : g.cont.alive ? 'ok' : 'no',
        g.cont.name + (g.cont.stage === 'group' ? ' (' + g.cont.groupPts + ' pts)' : '')]);
      if (comps.length) html += `<div class="card tight"><h3>Competitions</h3>` +
        comps.map(c => `<div class="comp-row">${ico(c[0])} ${esc(c[1])}</div>`).join('') + `</div>`;

      if (g.log.length) {
        html += `<div class="section-title">Latest</div><div class="card news">` +
          g.log.slice(0, 8).map(l => `<div class="n ${l.k}">${esc(l.t)}</div>`).join('') + `</div>`;
      }
      return html;
    },

    /* ---------------- CLUB ---------------- */
    tab_club() {
      const g = State.game, p = g.player, club = State.club(p.club);
      const league = State.league(club.league);
      const table = Engine.Season.standings(g, club.league);
      const squad = Engine.Squad.ensure(g);
      const rival = Engine.Squad.rivalFor(g);
      const startChance = Engine.Match.startingChance(g);

      let html = `<div class="card">
        <h3>${flag(club.country, 'sm')} ${esc(club.name)}</h3>
        <div class="stat-grid">
          <div class="stat"><b>${club.rating}</b><span>Squad</span></div>
          <div class="stat"><b>${club.prestige}</b><span>Prestige</span></div>
          <div class="stat"><b>${Math.round(p.managerTrust)}</b><span>Trust</span></div>
          <div class="stat"><b>${Math.round(startChance * 100)}%</b><span>Start XI</span></div>
        </div>
        <div class="kv">${ico('contract')} <span>${U.cash(p.contract.wage)}/week · ${p.contract.years} year(s) left
          · release clause ${U.cash(p.contract.release)}</span></div>
        <div class="kv">${ico('value')} <span>Market value <b>${U.cash(State.marketValue(p))}</b></span></div>
        ${rival ? `<div class="kv">${ico('shirt')} <span>Competing for your shirt: <b>${esc(rival.name)}</b> (${rival.ovr})</span></div>` : ''}
        ${p.captain ? `<div class="kv">${ico('crown')} <span>You wear the armband.</span></div>` : ''}
      </div>`;

      html += `<div class="card"><h3>${esc(league.name)}</h3><div class="scroll-x"><table class="tbl">
        <tr><th>#</th><th>Club</th><th class="num">P</th><th class="num">W</th><th class="num">D</th>
        <th class="num">L</th><th class="num">GD</th><th class="num">Pts</th></tr>` +
        table.map((r, i) => {
          const cls = i < 4 ? 'ucl' : i >= table.length - 2 ? 'rel' : '';
          return `<tr class="${r.id === club.id ? 'me' : ''}">
            <td><span class="pos-chip ${cls}">${i + 1}</span></td><td>${esc(r.club.name)}</td>
            <td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.d}</td>
            <td class="num">${r.l}</td><td class="num">${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
            <td class="num"><b>${r.pts}</b></td></tr>`;
        }).join('') + `</table></div></div>`;

      const scorers = Engine.Awards.leagueTopScorers(g).slice(0, 6);
      html += `<div class="card"><h3>Top scorers</h3><table class="tbl">` +
        scorers.map((sc, i) => `<tr class="${sc.you ? 'me' : ''}"><td>${i + 1}</td><td>${esc(sc.name)}</td>
          <td class="dim">${esc(sc.club)}</td><td class="num"><b>${sc.goals}</b></td></tr>`).join('') + `</table></div>`;

      html += `<div class="card"><h3>Squad</h3><div class="list">` +
        squad.slice(0, 14).map(sq => `<div class="item">
          <div class="ic">${ico(sq.pos === p.pos ? 'shirt' : 'player')}</div>
          <div class="tx"><b>${esc(sq.name)}${sq.captain ? ' (C)' : ''}</b>
          <span>${sq.pos} · ${sq.age}y · ${sq.goals} goals this season</span></div>
          <div class="pill ${sq.ovr > p.ovr ? 'red' : 'green'}">${sq.ovr}</div></div>`).join('') + `</div></div>`;
      return html;
    },

    /* ---------------- PLAYER ---------------- */
    tab_player() {
      const g = State.game, p = g.player;
      const keys = D.ATTR_KEYS.filter(k => k !== 'gk' || p.pos === 'GK')
                              .filter(k => k !== 'shooting' || p.pos !== 'GK');
      let html = `<div class="card">
        <h3>Attributes</h3>
        ${keys.map(k => UI.attrRow(p, k)).join('')}
        <div class="dim">The marker on each bar is the ceiling you stole in the draft.
          Overall ceiling: <b>${State.potentialOverall(p)}</b>.</div>
      </div>`;

      if (p.draft && p.draft.length) {
        html += `<div class="card"><h3>What you stole</h3><div class="list">` +
          p.draft.map(r => `<div class="item tight-item"><div class="ic">${ico(r.attr)}</div>
            <div class="tx"><b>${D.ATTR_LABEL[r.attr]} ${r.value}</b><span>from ${esc(r.from)}</span></div>
            <div class="pill ${p.attrs[r.attr] >= r.value ? 'green' : ''}">${p.attrs[r.attr]}/${r.value}</div></div>`).join('') +
          `</div></div>`;
      }

      html += `<div class="card"><h3>This season</h3><div class="stat-grid">
        <div class="stat"><b>${p.season.apps}</b><span>Apps</span></div>
        <div class="stat"><b>${p.season.goals}</b><span>Goals</span></div>
        <div class="stat"><b>${p.season.assists}</b><span>Assists</span></div>
        <div class="stat"><b>${p.season.motm}</b><span>MOTM</span></div>
        <div class="stat"><b>${State.seasonRating(p) || '—'}</b><span>Rating</span></div>
        <div class="stat"><b>${p.season.yellow}/${p.season.red}</b><span>Cards</span></div>
      </div></div>`;

      html += `<div class="card"><h3>Career totals</h3><div class="stat-grid">
        <div class="stat"><b>${p.career.apps}</b><span>Apps</span></div>
        <div class="stat"><b>${p.career.goals}</b><span>Goals</span></div>
        <div class="stat"><b>${p.career.assists}</b><span>Assists</span></div>
        <div class="stat"><b>${State.careerRating(p) || '—'}</b><span>Rating</span></div>
        <div class="stat"><b>${p.intl.caps}</b><span>Caps</span></div>
        <div class="stat"><b>${p.intl.goals}</b><span>Intl Goals</span></div>
      </div></div>`;

      html += `<div class="card"><h3>Traits</h3>`;
      html += p.traits.length
        ? p.traits.map(t => { const tr = D.TRAITS[t];
            return `<div class="trait ${tr.bad ? 'bad' : ''}"><div class="ic">${ico(tr.icon)}</div>
              <div><b>${esc(tr.name)}</b><span>${esc(tr.desc)}</span></div></div>`; }).join('')
        : `<p class="dim" style="margin:0">None yet. Deliver in the big moments and they will come.</p>`;
      html += `</div>`;

      if (p.injuries.length) {
        html += `<div class="card warn"><h3 class="bad">Injuries</h3>` +
          p.injuries.map(i => `<div class="item"><div class="ic">${ico('injury')}</div>
            <div class="tx"><b>${esc(i.name)}</b><span>${i.matches} match(es) remaining</span></div></div>`).join('') + `</div>`;
      }

      html += `<div class="card"><h3>Condition</h3>
        ${UI.bar('Fitness', p.fitness, '#22e07a')}${UI.bar('Form', p.form, '#5aa8ff')}
        ${UI.bar('Morale', p.morale, '#b483ff')}${UI.bar('Reputation', p.reputation, '#f5b224')}</div>`;

      if (p.age >= D.CONFIG.RETIRE_MIN_AGE) {
        html += `<button class="btn btn-danger btn-block" data-act="retire">Retire from football</button>`;
      }
      return html;
    },

    /* ---------------- PRESS ---------------- */
    tab_news() {
      const g = State.game, p = g.player;
      const heads = g.headlines || [];
      let html = `<div class="card tight"><h3>${ico('news')} Back pages</h3>
        <p class="dim" style="margin:0">What the press made of your career, season by season.</p></div>`;
      if (!heads.length) {
        html += `<div class="card center"><p class="dim" style="margin:0">Nobody has written about you yet.
          Do something worth reporting.</p></div>`;
        return html;
      }
      let season = null;
      heads.forEach(h => {
        if (h.season !== season) {
          season = h.season;
          html += `<div class="section-title">${season}/${(season + 1) % 100}</div>`;
        }
        html += `<div class="headline ${h.k}">
          <div class="hl-src">${esc(h.src || 'The Back Page')}</div>
          <div class="hl-t">${esc(h.t)}</div></div>`;
      });
      return html;
    },

    /* ---------------- LEGACY ---------------- */
    tab_legacy() {
      const g = State.game, p = g.player;
      const Career = global.Career;
      const score = Career.legacyScore(g);
      const rank = Career.legacyRank(score);
      let html = `<div class="card center">
        <span class="dim">LEGACY SCORE</span>
        <div class="big-num">${score}</div>
        <div class="gold rank-title">${rank.title}</div>
        <div class="dim" style="margin-top:6px">${esc(rank.desc)}</div>
      </div>`;

      html += `<div class="card"><h3>Career at a glance</h3><div class="stat-grid">
        <div class="stat"><b>${p.career.apps}</b><span>Apps</span></div>
        <div class="stat"><b>${p.career.goals}</b><span>Goals</span></div>
        <div class="stat"><b>${p.career.assists}</b><span>Assists</span></div>
        <div class="stat"><b>${p.peakOvr || p.ovr}</b><span>Peak OVR</span></div>
        <div class="stat"><b>${U.cash(p.peakValue || State.marketValue(p))}</b><span>Peak Value</span></div>
        <div class="stat"><b>${p.career.clubs.length}</b><span>Clubs</span></div>
      </div></div>`;

      html += `<div class="card"><h3>Trophy cabinet</h3>`;
      html += p.career.trophies.length
        ? p.career.trophies.map(t => `<span class="trophy">${ico('trophy')} ${esc(UI.trophyLabel(t))}</span>`).join('')
        : `<p class="dim" style="margin:0">Empty. For now.</p>`;
      html += `</div>`;

      if (p.achievements.length) {
        html += `<div class="card"><h3>Individual honours</h3>` +
          p.achievements.map(a => `<span class="trophy">${ico('medal')} ${esc(a.name)} ${a.year}</span>`).join('') + `</div>`;
      }

      html += `<div class="card"><h3>Season by season</h3>`;
      if (p.career.seasons.length) {
        html += p.career.seasons.slice().reverse().map(sn => `<div class="season-row">
          <div class="yr">${String(sn.year).slice(2)}/${String(sn.year + 1).slice(2)}</div>
          <div class="grow"><b>${esc(sn.club)}</b> <span class="dim">· ${U.ordinal(sn.pos)} · OVR ${sn.ovr}</span>
            <div class="dim">${sn.apps} apps · ${sn.goals} goals · ${sn.assists} assists · ${sn.rating} avg
              ${sn.trophies.length ? ' · ' + sn.trophies.map(esc).join(', ') : ''}</div></div>
        </div>`).join('');
      } else html += `<p class="dim" style="margin:0">Your first season is still being written.</p>`;
      html += `</div>`;

      html += `<div class="card"><h3>Options</h3><div class="row wrap">
        <button class="btn btn-ghost" data-act="save">${ico('disk')} Save now</button>
        <button class="btn btn-ghost" data-act="matchLength">${ico('settings')} Match length</button>
        <button class="btn btn-danger" data-act="quit">${ico('exit')} Quit to menu</button>
      </div></div>`;
      return html;
    },

    /* ==========================================================================
       MATCH RENDERING
       ========================================================================== */
    renderScoreboard(m) {
      const g = State.game, p = g.player;
      const me = m.myName, them = m.oppName;
      const homeName = m.isHome ? me : them, awayName = m.isHome ? them : me;
      const homeScore = m.isHome ? m.us : m.them, awayScore = m.isHome ? m.them : m.us;
      const chips = [];
      if (m.role === 'start') chips.push('<span class="pill green">Starting XI</span>');
      if (m.role === 'bench') chips.push(`<span class="pill blue">On the bench${m.entryMinute && m.minute >= m.entryMinute ? ' → on at ' + m.entryMinute + "'" : ''}</span>`);
      if (m.role === 'out') chips.push('<span class="pill red">Not in the squad</span>');
      if (m.role === 'injured') chips.push('<span class="pill red">Injured</span>');
      if (m.role === 'suspended') chips.push('<span class="pill red">Suspended</span>');
      if (m.stats.goals) chips.push(`<span class="pill gold">${ico('goal')} ${m.stats.goals}</span>`);
      if (m.stats.assists) chips.push(`<span class="pill gold">${ico('assist')} ${m.stats.assists}</span>`);
      if (m.stats.saves) chips.push(`<span class="pill blue">${ico('save')} ${m.stats.saves}</span>`);
      if (m.stats.card) chips.push(`<span class="pill ${m.stats.card === 'red' ? 'red' : 'yellow'}">${ico('card')}</span>`);
      if (m.role === 'start' || m.role === 'bench') chips.push(`<span class="pill">Rating ${U.round(U.clamp(m.stats.rating, 3, 10), 1)}</span>`);

      $('scoreboard').innerHTML = `
        <div class="sb-comp">${esc(m.compLabel || 'Match')}</div>
        <div class="sb-main">
          <div class="sb-team">${esc(homeName)}</div>
          <div class="sb-score">${homeScore} – ${awayScore}</div>
          <div class="sb-team">${esc(awayName)}</div>
        </div>
        <div class="sb-min">${m.finished ? 'Full time' : m.minute + "'"}</div>
        <div class="sb-you">${chips.join('')}</div>`;
    },

    pushEvent(text, tone, minute, you) {
      const feed = $('match-feed');
      const el = document.createElement('div');
      el.className = 'ev ' + (you ? 'you ' : '') + (tone || '');
      el.innerHTML = `<div class="m">${minute != null ? minute + "'" : ''}</div><div class="t">${esc(text)}</div>`;
      feed.appendChild(el);
      feed.scrollTop = feed.scrollHeight;
    },

    renderScenario(scn, onChoose) {
      $('match-action').innerHTML = `<div class="scn">
        <div class="scn-h"><div class="art">${ico(scn.art || 'ball')}</div><b>${esc(scn.title)}</b></div>
        <div class="scn-sub">${esc(scn.sub || '')}</div>
        <div class="choices${scn.options.length >= 5 ? ' cols' : ''}">${scn.options.map((o, i) => `<button class="choice" data-ci="${i}">
          <div class="cb"><b>${esc(o.label)}</b><span>${esc(o.hint || '')}</span></div>
          ${o.tag ? `<span class="tag">${esc(o.tag)}</span>` : ''}</button>`).join('')}</div></div>`;
      $('match-action').querySelectorAll('[data-ci]').forEach(b => {
        b.onclick = () => onChoose(+b.dataset.ci);
      });
    },

    renderMatchButtons(buttons) {
      $('match-action').innerHTML = `<div class="row">` + buttons.map((b, i) =>
        `<button class="btn ${b.cls || 'btn-primary'} grow" data-bi="${i}">${b.label}</button>`).join('') + `</div>`;
      $('match-action').querySelectorAll('[data-bi]').forEach(b => {
        b.onclick = () => buttons[+b.dataset.bi].onClick();
      });
    }
  };

  global.UI = UI;
})(window);

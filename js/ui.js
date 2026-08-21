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
  const crest = (clubName, cls) => global.Crest.svg(clubName, cls);

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
    /* The grouped trophy cabinet: one shelf per family, one plinth per honour. */
    cabinetHtml(cab) {
      if (!cab.total) return `<p class="dim" style="margin:0">Empty. For now. Go and win something.</p>`;
      return `<div class="cabinet">` + cab.shelves.map(sh => {
        const n = sh.rows.reduce((a, r) => a + r.count, 0);
        return `<div class="shelf">
          <div class="shelf-head"><span class="shelf-label">${esc(sh.label)}</span>
            <span class="shelf-n">${n}</span></div>
          <div class="shelf-row">${sh.rows.map(r => `<div class="tro">
            <div class="tro-art">${global.Trophies.svg(r.art)}${r.count > 1 ? `<span class="tro-x">&times;${r.count}</span>` : ''}</div>
            <div class="tro-n">${esc(r.name)}</div>
            <div class="tro-y">${UI.yearList(r.years)}</div>
          </div>`).join('')}</div>
          <div class="shelf-plank"></div>
        </div>`;
      }).join('') + `</div>`;
    },
    yearList(years) {
      const ys = years.slice().sort((a, b) => a - b).map(y => "'" + String(y).slice(2));
      return ys.length <= 4 ? ys.join(' ') : ys.slice(0, 3).join(' ') + ' +' + (ys.length - 3);
    },
    /* A small inline chip with the real trophy drawing, for summaries. */
    trophyChip(name, year) {
      const c = global.Trophies.classify(name);
      return `<span class="trophy">${global.Trophies.svg(c.art, 'tiny')} ${esc(name)}${year ? ' ' + year : ''}</span>`;
    },
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
        era: 'modern',
        firstName: U.pick(D.NAMES.England.first),
        lastName: U.pick(D.NAMES.England.last),
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

    STEPS: ['Era', 'Identity', 'Position', 'The Draft', 'Club'],

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
          <h2 class="wz-h">Pick your era</h2>
          <p class="wz-p">Which football world do you want to be born into? It decides who you
            play alongside, who you play against, and how hard all of it is.</p>
          <div class="era-list">${D.ERAS.map(e => `
            <div class="era ${w.era === e.id ? 'sel' : ''}" data-era="${e.id}">
              <div class="era-top">${ico(e.icon, 'era-icon')}
                <div><b>${esc(e.name)}</b><span>${esc(e.years)}</span></div>
              </div>
              <p>${esc(e.blurb)}</p>
            </div>`).join('')}</div>`;
        body.querySelectorAll('[data-era]').forEach(el => el.onclick = () => {
          w.era = el.dataset.era; UI.renderWizard();
        });

      } else if (w.step === 1) {
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
        body.querySelector('#w-nat').onchange = e => {
          w.nation = e.target.value;
          // suggest a name that fits where you are from
          const pool = D.NAMES[w.nation];
          if (pool) { w.firstName = U.pick(pool.first); w.lastName = U.pick(pool.last); }
          UI.renderWizard();
        };
        body.querySelector('#w-shirt').oninput = e => w.shirt = U.clamp(parseInt(e.target.value, 10) || 10, 1, 99);
        UI.optGroup(body, 'foot', v => { w.foot = v; UI.renderWizard(); });

      } else if (w.step === 2) {
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

      } else if (w.step === 3) {
        if (!w.draftPool) UI.startDraft();
        const legend = w.draftPool[w.draftIndex];
        const done = w.draftIndex >= w.draftPool.length;
        if (done || !legend) { w.step = 4; return UI.renderWizard(); }
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
            if (w.draftIndex >= w.draftPool.length) w.step = 4;
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
        const world = State.buildWorld(D.CONFIG.SEASON_START_YEAR, w.era);
        UI.previewWorld = world;
        // Which clubs would take a teenager depends on the world you are in: in the
        // Golden Era the weakest club on earth is rated 84, so the gate is relative
        // to what this era actually contains rather than an absolute number.
        const allRatings = Object.values(world.clubs).map(c => c.rating);
        const lo = Math.min.apply(null, allRatings), hi = Math.max.apply(null, allRatings);
        const frac = U.clamp((potential - 55) / 40, 0, 1);
        const maxRating = Math.round(lo + (hi - lo) * frac) + 2;
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
      $('create-next').textContent = w.step === 4 ? 'Start Career' : 'Next';
      $('create-next').classList.toggle('hidden', w.step === 3);
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
            <div class="hud-meta">${flag(p.nation, 'sm')} ${p.pos} · ${p.age}y</div>
          </div>
          <div class="hud-club">${crest(club.name, 'crest-md')}</div>
          <div class="hud-ovr" id="hud-ovr"><b>${p.ovr}</b><span>OVR</span></div>
        </div>
        <div class="hud-bars">
          ${UI.bar('Fit', p.fitness, 'linear-gradient(90deg,#12b45f,#22e07a)')}
          ${UI.bar('Form', p.form, 'linear-gradient(90deg,#3d8bff,#5aa8ff)')}
          ${UI.bar('Mood', p.morale, 'linear-gradient(90deg,#b483ff,#d9b6ff)')}
          ${UI.bar('Rep', p.reputation, 'linear-gradient(90deg,#f5b224,#ffd977)')}
        </div>`;
      const badge = $('hud-ovr');
      if (badge) badge.onclick = () => global.Game.secretTap();
    },

    TABS: [
      { id: 'home', icon: 'career', label: 'Career' },
      { id: 'club', icon: 'club', label: 'Club' },
      { id: 'player', icon: 'player', label: 'Player' },
      { id: 'news', icon: 'news', label: 'News' },
      { id: 'legacy', icon: 'legacy', label: 'Legacy' }
    ],

    renderTabs() {
      const g = State.game;
      const unread = g ? Math.max(0, (g.headlines || []).length - (g.newsSeen || 0)) : 0;
      $('tabbar').innerHTML = UI.tabsFor().map(t =>
        `<button class="${UI.tab === t.id ? 'on' : ''}" data-tab="${t.id}">${ico(t.icon)}${t.label}` +
        (t.id === 'news' && unread > 0 ? `<span class="tab-badge">${unread > 99 ? '99+' : unread}</span>` : '') +
        `</button>`).join('');
      $('tabbar').querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
        UI.tab = b.dataset.tab;
        if (UI.tab === 'news' && g) g.newsSeen = (g.headlines || []).length;
        UI.render();
      });
    },

    tabsFor() {
      const g = State.game;
      return (g && g.secret) ? UI.TABS.concat([{ id: 'secret', icon: 'settings', label: 'Boss' }]) : UI.TABS;
    },

    render() {
      if (!State.game) return;
      UI.renderHUD();
      UI.renderTabs();
      const c = $('content');
      c.innerHTML = UI['tab_' + UI.tab] ? UI['tab_' + UI.tab]() : '';
      c.scrollTop = 0;
      UI.bindActions(c);
      if (UI.tab === 'secret') UI.renderDevClubs();
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
        const homeName = f.home ? me.name : opp.name, awayName = f.home ? opp.name : me.name;
        html += `<div class="fixture" style="--home:${global.Crest.accent(homeName)};--away:${global.Crest.accent(awayName)}">
          <div class="comp">${esc(f.label)}</div>
          <div class="teams">
            <div class="team">${crest(homeName, 'crest-lg')}${esc(homeName)}</div>
            <div class="vs">V</div>
            <div class="team">${crest(awayName, 'crest-lg')}${esc(awayName)}</div>
          </div>
          <div class="venue">${ico(f.home ? 'home' : 'away')} ${f.home ? 'Home' : 'Away'}
            · Match ${g.fixtureIndex + 1} of ${g.fixtures.length}
            ${opp.rating ? '· opposition rated ' + opp.rating : ''}</div>
          ${UI.formGuide(me)}
          ${UI.oddsBar(g, f)}
        </div>`;
        if (f.star) {
          html += `<div class="card tight danger-man">
            <div class="item tight-item" style="border:none;background:none;padding:0">
              <div class="ic">${ico('alert')}</div>
              <div class="tx"><b>Danger man: ${flag(f.star.nation, 'sm')} ${esc(f.star.name)}</b>
                <span>${f.star.pos} · the one they will look for</span></div>
              <div class="pill ${f.star.ovr > p.ovr ? 'red' : ''}">${f.star.ovr}</div>
            </div></div>`;
        }

        const blocked = p.suspension > 0 ? `Suspended for ${p.suspension} more match(es).`
          : p.injuries.length ? `${p.injuries[0].name} — ${p.injuries[0].matches} match(es) left.` : null;
        if (blocked) html += `<div class="card tight warn">${ico('alert')} <b>${esc(blocked)}</b>
          <div class="dim">You will not feature, but the match still has to be played.</div></div>`;

        html += `<div class="row" style="margin-bottom:12px">
          <button class="btn btn-primary grow" data-act="playMatch">${ico('play')} Play Match</button>
          <button class="btn btn-ghost" data-act="quickMatch">${ico('sim')} Quick Sim</button>
          <button class="btn btn-ghost" data-act="skipMenu">${ico('clock')} Skip</button>
        </div>`;
        if (g.skip && g.skip.remaining > 0) {
          html += `<div class="row" style="margin-bottom:12px">
            <button class="btn btn-gold grow" data-act="resumeSkip">${ico('sim')} Resume skip — ${g.skip.remaining} week${g.skip.remaining === 1 ? '' : 's'} left</button>
            <button class="btn btn-ghost" data-act="cancelSkip">${ico('no')}</button>
          </div>`;
        }

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

      const next = f ? UI.upcoming(g, 4) : [];
      if (next.length) {
        html += `<div class="card"><h3>Coming up</h3><div class="list">` + next.map(nf => {
          const o = nf.oppId ? State.club(nf.oppId) : null;
          return `<div class="item tight-item">
            <div class="ic">${o ? crest(o.name, 'crest-sm') : ico('calendar')}</div>
            <div class="tx"><b>${o ? esc(o.name) : 'To be confirmed'}</b>
              <span>${esc(nf.label)} · ${nf.home ? 'home' : 'away'}</span></div>
            ${o ? `<div class="pill">${o.rating}</div>` : ''}</div>`;
        }).join('') + `</div></div>`;
      }

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

    // last five results as W/D/L pills
    formGuide(club) {
      const f = (club.form || []).slice(-5);
      if (!f.length) return '';
      return `<div class="form-guide">${f.map(r =>
        `<span class="fg ${r === 'W' ? 'w' : r === 'D' ? 'd' : 'l'}">${r}</span>`).join('')}</div>`;
    },

    // win/draw/loss probability bar for the upcoming fixture
    oddsBar(g, f) {
      const o = Engine.Match.odds(g, f);
      if (!o) return '';
      const pct = v => Math.round(v * 100) + '%';
      const me = State.club(g.player.club).name;
      const opp = f.oppId ? State.club(f.oppId).name : 'them';
      return `<div class="odds">
        <div class="odds-bar">
          <span class="odds-w" style="width:${pct(o.win)}"></span><span class="odds-d" style="width:${pct(o.draw)}"></span><span class="odds-l" style="width:${pct(o.loss)}"></span>
        </div>
        <div class="odds-labels">
          <span>${esc(me)} <b>${pct(o.win)}</b></span>
          <span>Draw <b>${pct(o.draw)}</b></span>
          <span>${esc(opp)} <b>${pct(o.loss)}</b></span>
        </div></div>`;
    },

    // the next few fixtures after this one
    upcoming(g, n) {
      const out = [];
      for (let i = g.fixtureIndex + 1; i < g.fixtures.length && out.length < n; i++) {
        const f = g.fixtures[i];
        if (f.comp === 'cup' && (!g.cup || !g.cup.alive)) continue;
        if (f.comp === 'cont' && (!g.cont || (!g.cont.alive && f.contKo != null))) continue;
        out.push(f);
      }
      return out;
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
        <div class="club-line" style="margin-bottom:12px">
          ${crest(club.name, 'crest-xl')}
          <div class="grow"><b style="font-size:18px">${esc(club.name)}</b>
            <div class="dim">${flag(club.country, 'sm')} ${esc(State.league(club.league).name)}</div>
            ${(() => { const e = global.Eras.byId(g.era);
              return e.id === 'modern' ? '' : `<span class="era-badge">${ico(e.icon)} ${esc(e.name)} · ${esc(e.years)}</span>`; })()}
            ${UI.formGuide(club)}</div>
        </div>
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

      const titleOdds = Engine.Season.titleOdds(g);
      html += `<div class="card"><h3>${ico('table')} ${esc(league.name)}</h3><div class="scroll-x"><table class="tbl">
        <tr><th>#</th><th>Club</th><th class="num">P</th><th class="num">W</th><th class="num">D</th>
        <th class="num">L</th><th class="num">GD</th><th class="num">Pts</th>${titleOdds ? '<th class="num">Title</th>' : ''}</tr>` +
        table.map((r, i) => {
          const cls = i < 4 ? 'ucl' : i >= table.length - 2 ? 'rel' : '';
          const tp = titleOdds && titleOdds[r.id] >= 0.005
            ? `<td class="num title-odds">${Math.round(titleOdds[r.id] * 100)}%</td>` : (titleOdds ? '<td class="num dim">—</td>' : '');
          return `<tr class="${r.id === club.id ? 'me' : ''}">
            <td><span class="pos-chip ${cls}">${i + 1}</span></td>
            <td>${crest(r.club.name, 'crest-sm')}${esc(r.club.name)}</td>
            <td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.d}</td>
            <td class="num">${r.l}</td><td class="num">${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
            <td class="num"><b>${r.pts}</b></td>${tp}</tr>`;
        }).join('') + `</table></div></div>`;

      const scorers = Engine.Awards.leagueTopScorers(g).slice(0, 6);
      html += `<div class="card"><h3>${ico('goldenboot')} Top scorers</h3><table class="tbl">` +
        scorers.map((sc, i) => `<tr class="${sc.you ? 'me' : ''}"><td>${i + 1}</td>
          <td>${sc.nation ? flag(sc.nation, 'sm') + ' ' : ''}${esc(sc.name)}</td>
          <td class="dim">${crest(sc.club, 'crest-sm')}${esc(sc.club)}</td><td class="num"><b>${sc.goals}</b></td></tr>`).join('') + `</table></div>`;

      html += `<div class="card"><h3>${crest(club.name, 'crest-sm')} Squad</h3><div class="list">
          <div class="item tight-item you-row">
            <div class="sq-no">${p.shirt}</div>
            <div class="tx"><b>${flag(p.nation, 'sm')} ${esc(p.firstName)} ${esc(p.lastName)}${p.captain ? ' (C)' : ''}</b>
            <span>${p.pos} · ${p.age}y · ${p.season.goals}g ${p.season.assists}a · you</span></div>
            <div class="pill green">${p.ovr}</div></div>` +
        squad.slice(0, 18).map(sq => `<div class="item tight-item">
          <div class="sq-no">${sq.shirt || '—'}</div>
          <div class="tx"><b>${flag(sq.nation, 'sm')} ${esc(sq.name)}${sq.captain ? ' (C)' : ''}</b>
          <span>${sq.pos}${sq.pos === p.pos ? ' · your position' : ''} · ${sq.age}y · ${sq.goals}g ${sq.assists}a · gets on with you ${Math.round(sq.rel)}%</span></div>
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
          <div class="ic hl-ic">${ico(h.ic || 'news')}</div>
          <div class="hl-body"><div class="hl-src">${esc(h.src || 'The Back Page')}</div>
          <div class="hl-t">${esc(h.t)}</div></div></div>`;
      });
      return html;
    },

    /* ---------------- LEGACY ---------------- */
    tab_legacy() {
      const g = State.game, p = g.player;
      const Career = global.Career;
      const score = Career.legacyScore(g);
      const rank = Career.legacyRank(score);
      const era = global.Eras.byId(g.era);
      let html = `<div class="card center">
        <span class="dim">LEGACY SCORE</span>
        <div class="big-num">${score}</div>
        <div class="gold rank-title">${rank.title}</div>
        <div class="dim" style="margin-top:6px">${esc(rank.desc)}</div>
        <div style="margin-top:9px"><span class="era-badge">${ico(era.icon)} ${esc(era.name)} era · ${esc(era.years)}</span></div>
      </div>`;

      html += `<div class="card"><h3>Career at a glance</h3><div class="stat-grid">
        <div class="stat"><b>${p.career.apps}</b><span>Apps</span></div>
        <div class="stat"><b>${p.career.goals}</b><span>Goals</span></div>
        <div class="stat"><b>${p.career.assists}</b><span>Assists</span></div>
        <div class="stat"><b>${p.peakOvr || p.ovr}</b><span>Peak OVR</span></div>
        <div class="stat"><b>${U.cash(p.peakValue || State.marketValue(p))}</b><span>Peak Value</span></div>
        <div class="stat"><b>${p.career.clubs.length}</b><span>Clubs</span></div>
      </div></div>`;

      const cab = global.Trophies.cabinet(p);
      html += `<div class="card"><h3>${ico('trophy')} Trophy cabinet
        ${cab.total ? `<span class="pill-count">${cab.total}</span>` : ''}</h3>`;
      html += UI.cabinetHtml(cab);
      html += `</div>`;

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

    /* ---------------- BOSS MODE (secret) ---------------- */
    tab_secret() {
      const g = State.game, p = g.player;
      const keys = D.ATTR_KEYS.filter(k => k !== 'gk' || p.pos === 'GK')
                              .filter(k => k !== 'shooting' || p.pos !== 'GK');
      let html = `<div class="card secret-head">
        <h3 class="gold">${ico('settings')} Boss Mode</h3>
        <p class="dim" style="margin:0">Unlocked with the code. Everything here is a cheat —
          change what you like, it saves like any other career.</p></div>`;

      // ---- overall ----
      html += `<div class="card"><h3>Overall</h3>
        <div class="row" style="align-items:center;gap:10px;margin-bottom:10px">
          <div class="prev-ovr"><b>${p.ovr}</b><span>NOW</span></div>
          <div class="prev-ovr pot"><b>${State.potentialOverall(p)}</b><span>CEILING</span></div>
          <div class="grow dim">Setting an overall scales every attribute to match it, ceilings included.</div>
        </div>
        <div class="row wrap">
          ${[60, 70, 80, 85, 90, 95, 99].map(v =>
            `<button class="btn btn-ghost sm" data-act="devOvr" data-arg="${v}">${v}</button>`).join('')}
        </div></div>`;

      // ---- attributes ----
      html += `<div class="card"><h3>Attributes</h3>`;
      keys.forEach(k => {
        const cap = Engine.Progress.cap(p, k);
        html += `<div class="dev-attr">
          <div class="dev-attr-h">${ico(k)} <b>${D.ATTR_LABEL[k]}</b>
            <span class="grow"></span><em>${p.attrs[k]}<span class="dim"> / ${cap}</span></em></div>
          <div class="row">
            <button class="btn btn-ghost sm" data-act="devAttr" data-arg="${k}:-10">−10</button>
            <button class="btn btn-ghost sm" data-act="devAttr" data-arg="${k}:-1">−1</button>
            <button class="btn btn-ghost sm grow" data-act="devAttr" data-arg="${k}:+1">+1</button>
            <button class="btn btn-ghost sm" data-act="devAttr" data-arg="${k}:+10">+10</button>
            <button class="btn btn-gold sm" data-act="devAttr" data-arg="${k}:99">99</button>
          </div></div>`;
      });
      html += `<div class="row wrap" style="margin-top:10px">
        <button class="btn btn-ghost" data-act="devMaxCeilings">Raise every ceiling to 99</button>
        <button class="btn btn-ghost" data-act="devFillCaps">Fill attributes to their ceiling</button>
      </div></div>`;

      // ---- traits ----
      html += `<div class="card"><h3>Traits — tap to toggle</h3><div class="dev-traits">` +
        Object.keys(D.TRAITS).map(id => {
          const t = D.TRAITS[id], on = State.hasTrait(p, id);
          return `<button class="dev-trait ${on ? 'on' : ''} ${t.bad ? 'bad' : ''}" data-act="devTrait" data-arg="${id}">
            ${ico(t.icon)}<b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`;
        }).join('') + `</div></div>`;

      // ---- condition ----
      html += `<div class="card"><h3>Condition</h3>
        ${[['fitness', 'Fitness'], ['form', 'Form'], ['morale', 'Morale'],
           ['reputation', 'Reputation'], ['managerTrust', 'Manager trust']].map(([k, label]) =>
          `<div class="dev-attr"><div class="dev-attr-h"><b>${label}</b><span class="grow"></span>
            <em>${Math.round(p[k])}</em></div>
            <div class="row">
              <button class="btn btn-ghost sm" data-act="devStat" data-arg="${k}:0">0</button>
              <button class="btn btn-ghost sm grow" data-act="devStat" data-arg="${k}:50">50</button>
              <button class="btn btn-gold sm" data-act="devStat" data-arg="${k}:100">100</button>
            </div></div>`).join('')}
      </div>`;

      // ---- career ----
      html += `<div class="card"><h3>Career</h3>
        <div class="dev-attr"><div class="dev-attr-h"><b>Age</b><span class="grow"></span><em>${p.age}</em></div>
          <div class="row">
            <button class="btn btn-ghost sm grow" data-act="devAge" data-arg="-1">−1 year</button>
            <button class="btn btn-ghost sm grow" data-act="devAge" data-arg="1">+1 year</button>
          </div></div>
        <div class="dev-attr"><div class="dev-attr-h"><b>Squad number</b><span class="grow"></span><em>${p.shirt}</em></div>
          <div class="row">
            <button class="btn btn-ghost sm grow" data-act="devShirt" data-arg="-1">−1</button>
            <button class="btn btn-ghost sm grow" data-act="devShirt" data-arg="1">+1</button>
          </div></div>
        <div class="dev-attr"><div class="dev-attr-h"><b>Position</b><span class="grow"></span><em>${p.pos}</em></div>
          <div class="opt-grid" style="grid-template-columns:repeat(5,1fr);margin-top:6px">
            ${Object.keys(D.POSITIONS).map(k =>
              `<div class="opt ${p.pos === k ? 'sel' : ''}" data-act="devPos" data-arg="${k}">${k}</div>`).join('')}
          </div></div>
        <div class="row wrap" style="margin-top:10px">
          <button class="btn btn-ghost" data-act="devHeal">Heal everything</button>
          <button class="btn btn-ghost" data-act="devCallUp">Force a call-up</button>
          <button class="btn btn-ghost" data-act="devTrophy">Add a title</button>
          <button class="btn btn-ghost" data-act="devContract">Top contract</button>
        </div></div>`;

      // ---- move club ----
      html += `<div class="card"><h3>Sign for anyone</h3>
        <div class="field"><label>League</label>
          <select class="input" id="dev-league">${g.world.leagues.map(l =>
            `<option value="${l.id}" ${l.id === State.club(p.club).league ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
        <div class="club-list" id="dev-clubs"></div></div>`;

      html += `<div class="card"><button class="btn btn-danger btn-block" data-act="devLock">Lock Boss Mode again</button></div>`;
      return html;
    },

    renderDevClubs() {
      const g = State.game, sel = $('dev-league');
      if (!sel) return;
      const league = State.league(sel.value);
      const list = $('dev-clubs');
      list.innerHTML = league.clubs.map(id => {
        const c = State.club(id);
        return `<div class="club ${c.id === g.player.club ? 'sel' : ''}" data-act="devClub" data-arg="${id}">
          <b>${esc(c.name)}</b><span>Rated ${c.rating}</span></div>`;
      }).join('');
      UI.bindActions(list);
      sel.onchange = () => UI.renderDevClubs();
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
          <div class="sb-team">${global.Crest.svg(homeName, 'crest-md')}${esc(homeName)}</div>
          <div class="sb-score">${homeScore} – ${awayScore}</div>
          <div class="sb-team">${global.Crest.svg(awayName, 'crest-md')}${esc(awayName)}</div>
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

    /* A penalty is aimed at the goal rather than picked from a list. */
    renderPenalty(scn, onAim) {
      $('match-action').innerHTML = `<div class="scn">
        <div class="scn-h"><div class="art">${ico(scn.art || 'penalty')}</div><b>${esc(scn.title)}</b></div>
        <div class="scn-sub">${esc(scn.sub || '')}</div>
        <div class="goal-wrap">${global.Pitch.view({ aim: true })}</div>
        <p class="goal-hint">Pick your corner. Top of the goal is harder to reach — and harder to save.</p>
        <div class="goal-verdict" id="goal-verdict"></div>
      </div>`;
      const root = $('match-action').querySelector('.goal-view');
      global.Pitch.reset(root);
      global.Pitch.onAim(root, zone => onAim(zone, root));
    },

    // the same goal, watched from the keeper's end
    renderKeeperCall(scn, onChoose) {
      $('match-action').innerHTML = `<div class="scn">
        <div class="scn-h"><div class="art">${ico(scn.art || 'save')}</div><b>${esc(scn.title)}</b></div>
        <div class="scn-sub">${esc(scn.sub || '')}</div>
        <div class="goal-wrap">${global.Pitch.view({ aim: false })}</div>
        <div class="choices${scn.options.length >= 5 ? ' cols' : ''}">${scn.options.map((o, i) =>
          `<button class="choice" data-ci="${i}">
            <div class="cb"><b>${esc(o.label)}</b><span>${esc(o.hint || '')}</span></div>
            ${o.tag ? `<span class="tag">${esc(o.tag)}</span>` : ''}</button>`).join('')}</div>
        <div class="goal-verdict" id="goal-verdict"></div>
      </div>`;
      const root = $('match-action').querySelector('.goal-view');
      global.Pitch.reset(root);
      $('match-action').querySelectorAll('[data-ci]').forEach(b => {
        b.onclick = () => {
          $('match-action').querySelectorAll('.choice').forEach(c => c.disabled = true);
          onChoose(+b.dataset.ci, root);
        };
      });
    },

    verdict(text, kind) {
      const el = $('goal-verdict');
      if (el) { el.textContent = text; el.className = 'goal-verdict ' + (kind || ''); }
      const hint = document.querySelector('.goal-hint');
      if (hint && text) hint.style.display = 'none';
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

/* ==========================================================================
   ui.js — screens, rendering, modals, the creation wizard
   ========================================================================== */
(function (global) {
  'use strict';
  const D = global.DATA, U = global.U, State = global.State, Engine = global.Engine, Life = global.Life;
  const $ = id => document.getElementById(id);
  const esc = U.esc;

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
       CREATION WIZARD
       ========================================================================== */
    startWizard() {
      UI.wizard = {
        step: 0,
        firstName: U.pick(D.FIRST_NAMES),
        lastName: U.pick(D.LAST_NAMES),
        nation: 'England',
        foot: 'Right',
        pos: 'ST',
        talent: 'normal',
        clubId: null
      };
      UI.show('create');
      UI.renderWizard();
    },

    talentPresets: {
      hard:   { label: 'Academy Hopeful', quality: 0.30, money: 5000,  max: 70, desc: 'Raw. Unfancied. You will have to earn everything.' },
      normal: { label: 'Highly Rated',    quality: 0.55, money: 25000, max: 80, desc: 'A proper prospect with a big future.' },
      easy:   { label: 'Generational',    quality: 0.85, money: 90000, max: 92, desc: 'The best teenager in the world. Everyone wants you.' }
    },

    renderWizard() {
      const w = UI.wizard;
      $('create-steps').innerHTML = [0, 1, 2, 3].map(i => `<div class="${i <= w.step ? 'on' : ''}"></div>`).join('');
      const body = $('create-body');
      if (w.step === 0) {
        body.innerHTML = `
          <h2 style="margin:0 0 4px">Who are you?</h2>
          <p class="muted" style="margin:0 0 18px">Every career starts with a name on a team sheet.</p>
          <div class="row"><div class="field grow"><label>First name</label>
            <input class="input" id="w-first" maxlength="14" value="${esc(w.firstName)}"></div>
            <div class="field grow"><label>Surname</label>
            <input class="input" id="w-last" maxlength="16" value="${esc(w.lastName)}"></div></div>
          <div class="field"><label>Nationality</label>
            <select class="input" id="w-nat">${D.NATIONS.map(n =>
              `<option value="${esc(n.name)}" ${n.name === w.nation ? 'selected' : ''}>${n.flag} ${esc(n.name)}</option>`).join('')}</select></div>
          <div class="field"><label>Strong foot</label>
            <div class="opt-grid" data-group="foot">${['Left', 'Right', 'Both'].map(f =>
              `<div class="opt ${w.foot === f ? 'sel' : ''}" data-val="${f}">${f}</div>`).join('')}</div></div>`;
        body.querySelector('#w-first').oninput = e => w.firstName = e.target.value;
        body.querySelector('#w-last').oninput = e => w.lastName = e.target.value;
        body.querySelector('#w-nat').onchange = e => w.nation = e.target.value;
        UI.optGroup(body, 'foot', v => { w.foot = v; UI.renderWizard(); });
      } else if (w.step === 1) {
        body.innerHTML = `
          <h2 style="margin:0 0 4px">Pick your position</h2>
          <p class="muted" style="margin:0 0 18px">This shapes the moments you will face on the pitch — and the ones you will be judged on.</p>
          <div class="opt-grid" data-group="pos">${Object.keys(D.POSITIONS).map(k =>
            `<div class="opt ${w.pos === k ? 'sel' : ''}" data-val="${k}"><b>${k}</b><small>${D.POSITIONS[k].name}</small></div>`).join('')}</div>
          <div class="card" style="margin-top:16px">
            <h3>${D.POSITIONS[w.pos].name}</h3>
            <p class="dim" style="margin:0">Key attributes: ${Object.keys(D.POSITIONS[w.pos].w)
              .filter(k => D.POSITIONS[w.pos].w[k] >= 0.18).map(k => D.ATTR_LABEL[k]).join(', ')}</p>
          </div>`;
        UI.optGroup(body, 'pos', v => { w.pos = v; UI.renderWizard(); });
      } else if (w.step === 2) {
        body.innerHTML = `
          <h2 style="margin:0 0 4px">How good are you already?</h2>
          <p class="muted" style="margin:0 0 18px">This is your difficulty setting. It decides who will sign a 17-year-old you.</p>
          <div class="opt-grid" data-group="talent" style="grid-template-columns:1fr">
            ${Object.keys(UI.talentPresets).map(k => { const t = UI.talentPresets[k];
              return `<div class="opt ${w.talent === k ? 'sel' : ''}" data-val="${k}" style="text-align:left;padding:14px">
                <b>${t.label}</b><small>${t.desc} · Starting bank ${U.cash(t.money)}</small></div>`; }).join('')}
          </div>`;
        UI.optGroup(body, 'talent', v => { w.talent = v; w.clubId = null; UI.renderWizard(); });
      } else {
        const preset = UI.talentPresets[w.talent];
        const world = State.buildWorld(D.CONFIG.SEASON_START_YEAR);
        UI.previewWorld = world;
        body.innerHTML = `
          <h2 style="margin:0 0 4px">Choose your first club</h2>
          <p class="muted" style="margin:0 0 14px">Clubs above your level will not take a chance on you yet. Start low and climb, or take the pressure now.</p>
          <div class="field"><label>League</label>
            <select class="input" id="w-league">${world.leagues.map(l =>
              `<option value="${l.id}">${l.flag} ${esc(l.name)} — ${esc(l.country)}</option>`).join('')}</select></div>
          <div class="club-list" id="w-clubs"></div>`;
        const renderClubs = () => {
          const lid = body.querySelector('#w-league').value;
          const league = world.leagues.find(l => l.id === lid);
          $('w-clubs').innerHTML = league.clubs.map(id => {
            const c = world.clubs[id];
            const locked = c.rating > preset.max;
            return `<div class="club ${locked ? 'locked' : ''} ${w.clubId === id ? 'sel' : ''}" data-club="${id}" ${locked ? 'data-locked="1"' : ''}>
              <b>${esc(c.name)}</b><span>${locked ? '🔒 Out of your league' : 'Squad rating ' + c.rating + ' · ' + '★'.repeat(c.prestige)}</span></div>`;
          }).join('');
          $('w-clubs').querySelectorAll('.club').forEach(el => {
            el.onclick = () => {
              if (el.dataset.locked) { UI.toast('They will not sign you… yet.', 'bad'); return; }
              w.clubId = el.dataset.club; renderClubs();
            };
          });
        };
        body.querySelector('#w-league').onchange = renderClubs;
        renderClubs();
      }
      $('create-back').textContent = w.step === 0 ? 'Cancel' : 'Back';
      $('create-next').textContent = w.step === 3 ? 'Start Career' : 'Next';
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
      const init = (p.firstName[0] || '?') + (p.lastName[0] || '');
      $('hud').innerHTML = `
        <div class="hud-top">
          <div class="hud-avatar">${esc(init.toUpperCase())}</div>
          <div>
            <div class="hud-name">${esc(p.firstName)} ${esc(p.lastName)}</div>
            <div class="hud-meta">${p.pos} · ${p.age}y · ${club.flag} ${esc(club.name)}</div>
          </div>
          <div class="hud-ovr"><b>${p.ovr}</b><span>OVR</span></div>
        </div>
        <div class="hud-bars">
          ${UI.bar('Fit', p.fitness, 'linear-gradient(90deg,#12b45f,#22e07a)')}
          ${UI.bar('Form', p.form, 'linear-gradient(90deg,#3d8bff,#5aa8ff)')}
          ${UI.bar('Mood', p.morale, 'linear-gradient(90deg,#b483ff,#d9b6ff)')}
          ${UI.bar('Fame', p.fame, 'linear-gradient(90deg,#f5b224,#ffd977)')}
        </div>`;
    },

    TABS: [
      { id: 'home', icon: '🏠', label: 'Career' },
      { id: 'club', icon: '🏟️', label: 'Club' },
      { id: 'player', icon: '👤', label: 'Player' },
      { id: 'life', icon: '💞', label: 'Life' },
      { id: 'money', icon: '💰', label: 'Money' },
      { id: 'legacy', icon: '🏆', label: 'Legacy' }
    ],

    renderTabs() {
      $('tabbar').innerHTML = UI.TABS.map(t =>
        `<button class="${UI.tab === t.id ? 'on' : ''}" data-tab="${t.id}"><i>${t.icon}</i>${t.label}</button>`).join('');
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

    /* ---------------- HOME ---------------- */
    tab_home() {
      const g = State.game, p = g.player;
      const f = Engine.Season.nextPlayable(g);
      let html = '';

      if (!f) {
        html += `<div class="card center"><h3>Season complete</h3>
          <p class="muted">All fixtures played. Time to review the season.</p>
          <button class="btn btn-primary btn-block" data-act="endSeason">End of Season Review</button></div>`;
      } else {
        Engine.Season.prepareFixture(g, f);
        const opp = f.oppId ? State.club(f.oppId) : { name: f.oppName || 'TBC', flag: '' };
        const me = State.club(p.club);
        html += `<div class="fixture">
          <div class="comp">${esc(f.label)}</div>
          <div class="teams">
            <div class="team">${f.home ? esc(me.name) : esc(opp.name)}</div>
            <div class="vs">V</div>
            <div class="team">${f.home ? esc(opp.name) : esc(me.name)}</div>
          </div>
          <div class="venue">${f.home ? '🏠 Home' : '✈️ Away'} · Match ${g.fixtureIndex + 1} of ${g.fixtures.length}</div>
        </div>`;

        const blocked = p.suspension > 0 ? `You are suspended for ${p.suspension} more match(es).`
          : p.injuries.length ? `Injured: ${p.injuries[0].name} (${p.injuries[0].matches} match(es) left).` : null;
        if (blocked) html += `<div class="card tight" style="border-color:var(--red)"><b class="bad">⚠️ ${esc(blocked)}</b>
          <div class="dim">You will not feature, but the match still has to be played.</div></div>`;

        html += `<div class="row" style="margin-bottom:12px">
          <button class="btn btn-primary grow" data-act="playMatch">▶ Play Match</button>
          <button class="btn btn-ghost" data-act="quickMatch">⏩ Quick Sim</button>
        </div>`;

        if (g.weekActionsLeft > 0) {
          html += `<div class="card" style="border-color:var(--gold)">
            <h3 style="color:var(--gold)">This week — 1 action left</h3>
            <p class="dim" style="margin:0 0 10px">Train, rest, or live your life. Choose one before kick-off.</p>
            <button class="btn btn-gold btn-block" data-act="openWeek">Choose Activity</button></div>`;
        }
      }

      // season snapshot
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

      // competitions
      const comps = [];
      if (g.cup) comps.push(`${g.cup.won ? '🏆' : g.cup.alive ? '🟢' : '🔴'} ${esc(g.cup.name)}`);
      if (g.cont) comps.push(`${g.cont.won ? '🏆' : g.cont.alive ? '🟢' : '🔴'} ${esc(g.cont.name)}${g.cont.stage === 'group' ? ' (' + g.cont.groupPts + ' pts)' : ''}`);
      if (comps.length) html += `<div class="card tight"><h3>Competitions</h3>${comps.map(c => `<div>${c}</div>`).join('')}</div>`;

      // news
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
        <h3>${esc(club.name)}</h3>
        <div class="stat-grid">
          <div class="stat"><b>${club.rating}</b><span>Squad</span></div>
          <div class="stat"><b>${'★'.repeat(club.prestige)}</b><span>Prestige</span></div>
          <div class="stat"><b>${Math.round(p.managerTrust)}</b><span>Trust</span></div>
          <div class="stat"><b>${Math.round(startChance * 100)}%</b><span>Start XI</span></div>
        </div>
        <div class="dim" style="margin-top:10px">Contract: ${U.cash(p.contract.wage)}/week · ${p.contract.years} year(s) left
          · Release clause ${U.cash(p.contract.release)}</div>
        ${rival ? `<div class="dim">Main competition for your shirt: <b>${esc(rival.name)}</b> (${rival.ovr} OVR)</div>` : ''}
      </div>`;

      html += `<div class="card"><h3>${esc(league.name)}</h3><div class="scroll-x"><table class="tbl">
        <tr><th>#</th><th>Club</th><th class="num">P</th><th class="num">W</th><th class="num">D</th>
        <th class="num">L</th><th class="num">GD</th><th class="num">Pts</th></tr>` +
        table.map((r, i) => {
          const cls = i === 0 ? 'ucl' : i < 4 ? 'ucl' : i >= table.length - 2 ? 'rel' : '';
          return `<tr class="${r.id === club.id ? 'me' : ''}">
            <td><span class="pos-chip ${cls}">${i + 1}</span></td><td>${esc(r.club.name)}</td>
            <td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.d}</td>
            <td class="num">${r.l}</td><td class="num">${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</td>
            <td class="num"><b>${r.pts}</b></td></tr>`;
        }).join('') + `</table></div></div>`;

      const scorers = Engine.Awards.leagueTopScorers(g).slice(0, 6);
      html += `<div class="card"><h3>Top scorers</h3><table class="tbl">` +
        scorers.map((s, i) => `<tr class="${s.you ? 'me' : ''}"><td>${i + 1}</td><td>${esc(s.name)}</td>
          <td class="dim">${esc(s.club)}</td><td class="num"><b>${s.goals}</b></td></tr>`).join('') + `</table></div>`;

      html += `<div class="card"><h3>Squad</h3><div class="list">` +
        squad.slice(0, 14).map(s => `<div class="item">
          <div class="ic">${s.pos === p.pos ? '🔁' : '👤'}</div>
          <div class="tx"><b>${esc(s.name)} ${s.captain ? '(C)' : ''}</b>
          <span>${s.pos} · ${s.age}y · ${s.goals} goals this season · relationship ${Math.round(s.rel)}%</span></div>
          <div class="pill ${s.ovr > p.ovr ? 'red' : 'green'}">${s.ovr}</div></div>`).join('') + `</div></div>`;
      return html;
    },

    /* ---------------- PLAYER ---------------- */
    tab_player() {
      const g = State.game, p = g.player;
      let html = `<div class="card">
        <h3>Attributes</h3>
        ${D.ATTR_KEYS.filter(k => k !== 'gk' || p.pos === 'GK').map(k => UI.attrRow(p, k)).join('')}
        <div class="dim">The white marker is your realistic ceiling in this attribute. Potential: ${p.potential}</div>
      </div>`;

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
      if (p.traits.length) {
        html += p.traits.map(t => { const tr = D.TRAITS[t];
          return `<div class="trait ${tr.bad ? 'bad' : ''}"><div class="ic">${tr.icon}</div>
            <div><b>${esc(tr.name)}</b><span>${esc(tr.desc)}</span></div></div>`; }).join('');
      } else html += `<p class="dim" style="margin:0">No traits yet. Perform in big moments and they will come.</p>`;
      html += `</div>`;

      if (p.injuries.length) {
        html += `<div class="card" style="border-color:var(--red)"><h3 class="bad">Injuries</h3>` +
          p.injuries.map(i => `<div class="item"><div class="ic">🩹</div><div class="tx"><b>${esc(i.name)}</b>
            <span>${i.matches} match(es) remaining</span></div></div>`).join('') + `</div>`;
      }

      html += `<div class="card"><h3>Condition</h3>
        ${UI.bar('Health', p.health, '#22e07a')}${UI.bar('Happiness', p.happiness, '#b483ff')}
        ${UI.bar('Discipline', p.discipline, '#5aa8ff')}
        <div class="dim" style="margin-top:8px">Market value <b>${U.cash(State.marketValue(p))}</b> ·
          Followers <b>${U.money(p.followers)}</b></div></div>`;

      if (p.age >= D.CONFIG.RETIRE_MIN_AGE) {
        html += `<button class="btn btn-danger btn-block" data-act="retire">Retire from football</button>`;
      }
      return html;
    },

    /* ---------------- LIFE ---------------- */
    tab_life() {
      const g = State.game, p = g.player;
      const partner = Life.partner(g);
      let html = `<div class="card"><h3>Relationship</h3>`;
      if (partner) {
        html += `<div class="item"><div class="ic">${partner.status === 'married' ? '💍' : partner.status === 'engaged' ? '💎' : '💘'}</div>
          <div class="tx"><b>${esc(partner.name)}</b><span>${esc(partner.job)} · ${partner.status} · since ${partner.since}</span></div></div>
          ${UI.bar('Relationship', partner.level, 'linear-gradient(90deg,#ff6b9d,#ffa8c5)')}
          <div class="row wrap" style="margin-top:12px">
            <button class="btn btn-ghost" data-act="rel" data-arg="date">🍷 Date night</button>
            <button class="btn btn-ghost" data-act="rel" data-arg="gift">🎁 Buy a gift</button>
            ${partner.status === 'dating' ? '<button class="btn btn-ghost" data-act="rel" data-arg="propose">💍 Propose</button>' : ''}
            ${partner.status === 'engaged' ? '<button class="btn btn-gold" data-act="rel" data-arg="marry">💒 Get married</button>' : ''}
            <button class="btn btn-ghost" data-act="rel" data-arg="child">👶 Start a family</button>
            <button class="btn btn-danger" data-act="rel" data-arg="breakup">💔 End it</button>
          </div>`;
      } else {
        html += `<p class="dim">You are single. Football is a lonely business.</p>
          <button class="btn btn-primary btn-block" data-act="dating">📲 Open the dating app</button>`;
      }
      html += `</div>`;

      if ((p.children || []).length) {
        html += `<div class="card"><h3>Family</h3><div class="list">` + p.children.map(c =>
          `<div class="item"><div class="ic">🧒</div><div class="tx"><b>${esc(c.name)}</b>
            <span>Born ${c.year} · age ${g.world.year - c.year}</span></div></div>`).join('') + `</div></div>`;
      }

      html += `<div class="card"><h3>Lifestyle</h3><div class="stat-grid">
        <div class="stat"><b>${Math.round(p.fame)}</b><span>Fame</span></div>
        <div class="stat"><b>${U.money(p.followers)}</b><span>Followers</span></div>
        <div class="stat"><b>${Math.round(p.happiness)}</b><span>Happiness</span></div>
        <div class="stat"><b>${p.languages || 1}</b><span>Languages</span></div>
      </div></div>`;

      html += `<div class="card"><h3>Do something</h3><div class="list">
        <div class="item click" data-act="socialMenu"><div class="ic">📱</div><div class="tx"><b>Post on social media</b><span>Grow the brand — or start a fire</span></div></div>
        <div class="item click" data-act="mediaMenu"><div class="ic">🎙️</div><div class="tx"><b>Give an interview</b><span>Humble, bold, or burn it all down</span></div></div>
        <div class="item click" data-act="doActivity" data-arg="charity"><div class="ic">❤️</div><div class="tx"><b>Charity work</b><span>Costs money. Worth it.</span></div></div>
        <div class="item click" data-act="doActivity" data-arg="casino"><div class="ic">🎰</div><div class="tx"><b>Casino night</b><span>High risk, higher regret</span></div></div>
      </div><div class="dim" style="margin-top:8px">These use your week action if you have one left.</div></div>`;

      if (p.achievements.length) {
        html += `<div class="card"><h3>Achievements</h3>` +
          p.achievements.map(a => `<span class="trophy">🏅 ${esc(a.name)} ${a.year}</span>`).join('') + `</div>`;
      }
      return html;
    },

    /* ---------------- MONEY ---------------- */
    tab_money() {
      const g = State.game, p = g.player;
      const sponsorOffers = Life.sponsorOffers(g);
      let html = `<div class="card center">
        <span class="dim">BANK BALANCE</span>
        <div class="big-num gold">${U.cash(p.money)}</div>
        <div class="dim" style="margin-top:6px">${U.cash(p.contract.wage)}/week · ${U.cash(p.contract.wage * 52)}/year before tax</div>
      </div>`;

      if (p.sponsors.length) {
        html += `<div class="card"><h3>Sponsorships</h3><div class="list">` + p.sponsors.map(s =>
          `<div class="item"><div class="ic">${s.icon}</div><div class="tx"><b>${esc(s.name)}</b>
            <span>${U.cash(s.annual)}/year · ${s.years} year(s) left</span></div></div>`).join('') + `</div></div>`;
      }
      if (sponsorOffers.length) {
        html += `<div class="card" style="border-color:var(--gold)"><h3 class="gold">Offers on the table</h3><div class="list">` +
          sponsorOffers.map(o => `<div class="item click" data-act="signSponsor" data-arg="${o.id}">
            <div class="ic">${o.icon}</div><div class="tx"><b>${esc(o.name)}</b>
            <span>${U.cash(o.annual)}/year for ${o.years} years — tap to sign</span></div></div>`).join('') + `</div></div>`;
      }

      html += `<div class="card"><h3>Buy something ridiculous</h3><div class="list">` +
        D.ASSETS.map(a => { const owned = p.assets.some(x => x.id === a.id);
          return `<div class="item ${owned ? '' : 'click'}" ${owned ? '' : `data-act="buyAsset" data-arg="${a.id}"`}>
            <div class="ic">${a.icon}</div><div class="tx"><b>${esc(a.name)}</b><span>${U.cash(a.cost)}${owned ? ' · owned' : ''}</span></div>
            ${owned ? '<span class="pill green">Owned</span>' : (p.money >= a.cost ? '<span class="pill gold">Buy</span>' : '<span class="pill red">Too rich</span>')}</div>`;
        }).join('') + `</div></div>`;

      html += `<div class="card"><h3>Investments</h3>`;
      if (p.investments.length) {
        html += `<div class="list" style="margin-bottom:10px">` + p.investments.map(i =>
          `<div class="item"><div class="ic">${i.icon}</div><div class="tx"><b>${esc(i.name)}</b>
            <span>${U.cash(i.amount)} invested · matures at end of season</span></div></div>`).join('') + `</div>`;
      }
      html += `<div class="list">` + D.INVESTMENTS.map(i =>
        `<div class="item click" data-act="investMenu" data-arg="${i.id}"><div class="ic">${i.icon}</div>
          <div class="tx"><b>${esc(i.name)}</b><span>Min ${U.cash(i.min)} · risk ${Math.round(i.risk * 100)}% · up to ${i.mult[1]}×</span></div></div>`
      ).join('') + `</div></div>`;

      html += `<div class="card"><h3>Your team of people</h3><div class="list">` +
        Life.PERKS.map(pk => { const has = Life.hasPerk(g, pk.id);
          return `<div class="item ${has ? '' : 'click'}" ${has ? '' : `data-act="buyPerk" data-arg="${pk.id}"`}>
            <div class="ic">${pk.icon}</div><div class="tx"><b>${esc(pk.name)}</b><span>${esc(pk.desc)} · ${U.cash(pk.cost)}</span></div>
            ${has ? '<span class="pill green">Hired</span>' : ''}</div>`; }).join('') + `</div>
        <div class="dim" style="margin-top:8px">Staff cost 40% of their fee again in wages every season.</div></div>`;

      if (p.assets.length) {
        html += `<div class="card"><h3>Your things</h3>` + p.assets.map(a =>
          `<span class="trophy">${a.icon} ${esc(a.name)}</span>`).join('') + `</div>`;
      }
      return html;
    },

    /* ---------------- LEGACY ---------------- */
    tab_legacy() {
      const g = State.game, p = g.player;
      const score = Life.legacyScore(g);
      const rank = Life.legacyRank(score);
      let html = `<div class="card center">
        <span class="dim">LEGACY SCORE</span>
        <div class="big-num">${score}</div>
        <div class="gold" style="font-weight:800;letter-spacing:1px;margin-top:4px">${rank.title}</div>
        <div class="dim" style="margin-top:6px">${esc(rank.desc)}</div>
      </div>`;

      html += `<div class="card"><h3>Trophy cabinet</h3>`;
      html += p.career.trophies.length
        ? p.career.trophies.map(t => `<span class="trophy">🏆 ${esc(UI.trophyLabel(t))}</span>`).join('')
        : `<p class="dim" style="margin:0">Empty. For now.</p>`;
      html += `</div>`;

      html += `<div class="card"><h3>Season by season</h3>`;
      if (p.career.seasons.length) {
        html += p.career.seasons.slice().reverse().map(s => `<div class="season-row">
          <div class="yr">${String(s.year).slice(2)}/${String(s.year + 1).slice(2)}</div>
          <div class="grow"><b>${esc(s.club)}</b> <span class="dim">· ${U.ordinal(s.pos)} · OVR ${s.ovr}</span>
            <div class="dim">${s.apps} apps · ${s.goals} goals · ${s.assists} assists · ${s.rating} avg
              ${s.trophies.length ? ' · 🏆 ' + s.trophies.map(esc).join(', ') : ''}</div></div>
        </div>`).join('');
      } else html += `<p class="dim" style="margin:0">Your first season is still being written.</p>`;
      html += `</div>`;

      html += `<div class="card"><h3>Options</h3><div class="row wrap">
        <button class="btn btn-ghost" data-act="save">💾 Save now</button>
        <button class="btn btn-ghost" data-act="matchLength">⚙️ Match length</button>
        <button class="btn btn-danger" data-act="quit">🚪 Quit to menu</button>
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
      if (m.stats.goals) chips.push(`<span class="pill gold">⚽ ${m.stats.goals}</span>`);
      if (m.stats.assists) chips.push(`<span class="pill gold">🅰️ ${m.stats.assists}</span>`);
      if (m.stats.saves) chips.push(`<span class="pill blue">🧤 ${m.stats.saves}</span>`);
      if (m.stats.card) chips.push(`<span class="pill red">${m.stats.card === 'red' ? '🟥' : '🟨'}</span>`);
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
        <div class="scn-h"><div class="art">${scn.art || '⚽'}</div><b>${esc(scn.title)}</b></div>
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

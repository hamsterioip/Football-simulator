/* ==========================================================================
   manager-ui.js — the screens for Manager Mode.

   Reuses the game screen's header, content and tab bar, so the mode gets the
   same chrome as the career game without a second set of markup.
   ========================================================================== */
(function (global) {
  'use strict';

  const $ = id => document.getElementById(id);

  const U = () => global.U;
  const State = () => global.State;
  const M = () => global.Manager;
  const esc = t => global.U.esc(t);
  const ico = (n, c) => global.Icons.svg(n, c);
  const crest = (n, c) => global.Crest.svg(n, c);

  const TABS = [
    { id: 'mhome', icon: 'career', label: 'Match' },
    { id: 'msquad', icon: 'squad', label: 'Squad' },
    { id: 'mmarket', icon: 'transfer', label: 'Market' },
    { id: 'mtable', icon: 'table', label: 'Table' },
    { id: 'moffice', icon: 'contract', label: 'Office' }
  ];

  const MUI = {
    tab: 'mhome',

    render() {
      const g = State().game;
      if (!g || !g.mgr) return;
      MUI.renderHUD();
      MUI.renderTabs();
      const c = $('content');
      c.innerHTML = MUI['tab_' + MUI.tab] ? MUI['tab_' + MUI.tab]() : '';
      c.scrollTop = 0;
      global.UI.bindActions(c);
    },

    renderHUD() {
      const g = State().game, club = State().club(g.mgr.club);
      const conf = Math.round(g.mgr.board.confidence);
      const pos = M().position(g);
      $('hud').innerHTML = `
        <div class="hud-top">
          <div class="hud-club mgr-badge">${crest(club.name, 'crest-md')}</div>
          <div class="hud-id">
            <div class="hud-name">${esc(club.name)}</div>
            <div class="hud-meta">${ico('manager')} Manager · ${esc(State().league(club.league).name)}</div>
          </div>
          <div class="hud-ovr"><b>${M().teamRating(g)}</b><span>TEAM</span></div>
        </div>
        <div class="hud-bars">
          ${MUI.bar('Board', conf, conf >= 60 ? 'var(--green)' : conf >= 30 ? 'var(--gold)' : 'var(--red)')}
          ${MUI.bar('Position', Math.max(0, 100 - (pos - 1) * 9), 'var(--blue)', pos ? U().ordinal(pos) : '—')}
          ${MUI.bar('Budget', Math.min(100, g.mgr.budget / 1000000), 'var(--purple)', U().cash(g.mgr.budget))}
        </div>`;
    },

    bar(label, v, colour, text) {
      const val = global.U.clamp(v, 0, 100);
      return `<div class="hb"><div class="hb-l"><span>${label}</span><b>${text != null ? esc(text) : Math.round(val)}</b></div>
        <div class="hb-t"><i style="width:${val}%;background:${colour}"></i></div></div>`;
    },

    renderTabs() {
      $('tabbar').innerHTML = TABS.map(t =>
        `<button class="${MUI.tab === t.id ? 'on' : ''}" data-mtab="${t.id}">${ico(t.icon)}${t.label}</button>`).join('');
      $('tabbar').querySelectorAll('[data-mtab]').forEach(b => b.onclick = () => {
        MUI.tab = b.dataset.mtab; MUI.render();
      });
    },

    /* ---------------- matchday ---------------- */
    tab_mhome() {
      const g = State().game, club = State().club(g.mgr.club);
      const fix = M().nextFixture(g);
      const l = M().lines(g);
      let html = '';

      if (g.mgr.sacked) {
        const won = (g.mgr.trophies || []).length;
        return `<div class="card center"><h3>${ico('exit')} You were sacked</h3>
          <p class="dim">${esc(club.name)} have relieved you of your duties after
            ${g.mgr.board.seasons} season${g.mgr.board.seasons === 1 ? '' : 's'}${won ? ` and ${won} trophy${won === 1 ? '' : 's'}` : ''}.
            It happens to everyone eventually. Somebody else will be in touch.</p>
          <div class="row" style="margin-top:12px">
            <button class="btn btn-primary grow" data-act="mgrRehire">${ico('manager')} Take another job</button>
          </div>
          <div class="row" style="margin-top:8px">
            <button class="btn btn-ghost grow" data-act="mgrQuit">Back to the menu</button>
          </div>
        </div>` + MUI.cvCard(g);
      }

      if (!fix) {
        html += `<div class="card center"><h3>${ico('trophy')} Season over</h3>
          <p class="dim" style="margin:0 0 12px">Thirty-something games, and the table does not lie.</p>
          <button class="btn btn-primary btn-lg" data-act="mgrReview">See the board</button></div>`;
        return html + MUI.formCard(g);
      }

      const opp = State().club(fix.oppId);
      html += `<div class="card fixture-card">
        <div class="fx-comp">${esc(State().league(club.league).name)} · Match ${g.mgr.round + 1} of ${g.mgr.rounds.length}</div>
        <div class="fx-teams">
          <div class="fx-t">${crest(fix.home ? club.name : opp.name, 'crest-lg')}
            <span>${esc(fix.home ? club.name : opp.name)}</span></div>
          <div class="fx-v">V</div>
          <div class="fx-t">${crest(fix.home ? opp.name : club.name, 'crest-lg')}
            <span>${esc(fix.home ? opp.name : club.name)}</span></div>
        </div>
        <div class="fx-meta">${fix.home ? ico('home') + ' Home' : ico('away') + ' Away'} ·
          opposition rated ${opp.rating}</div>
      </div>`;

      html += `<div class="card"><h3>${ico('tactics')} Your plan</h3>
        <div class="mgr-plan">
          <button class="plan-btn" data-act="mgrFormation">
            <span class="dim">Formation</span><b>${g.mgr.formation}</b></button>
          <button class="plan-btn" data-act="mgrStyle">
            <span class="dim">Approach</span><b>${esc(M().STYLES[g.mgr.style].name)}</b></button>
        </div>
        <div class="mgr-lines">
          ${['gk', 'def', 'mid', 'att'].map(k => `<div class="ml"><span>${k.toUpperCase()}</span><b>${l[k] || '—'}</b></div>`).join('')}
        </div>
        <div class="row" style="margin-top:12px">
          <button class="btn btn-primary grow" data-act="mgrPlay">${ico('play')} Team talk & kick off</button>
        </div>
        <div class="row" style="margin-top:8px">
          <button class="btn btn-ghost grow" data-act="mgrSim">${ico('sim')} Sim to the end of the season</button>
        </div>
      </div>`;

      return html + MUI.formCard(g);
    },

    /* Every job you have had, which is the only real record a manager keeps. */
    cvCard(g) {
      const past = (g.mgrHistory || []);
      if (!past.length) return '';
      return `<div class="card"><h3>${ico('legacy')} Your record</h3>
        ${past.map(j => `<div class="res-row">
          ${crest(j.club, 'crest-sm')}
          <span class="res-n">${esc(j.club)}</span>
          <span class="sq-meta">${j.seasons} yr${j.seasons === 1 ? '' : 's'}${
            j.trophies ? ' · ' + j.trophies + ' won' : ''}${
            j.finishes && j.finishes.length ? ' · best ' + U().ordinal(Math.min.apply(null, j.finishes)) : ''}</span>
          <span class="res-b ${j.sacked ? 'res-L' : 'res-D'}">${j.sacked ? 'sacked' : 'left'}</span>
        </div>`).join('')}</div>`;
    },

    formCard(g) {
      const res = (g.mgr.results || []).slice(-6).reverse();
      if (!res.length) return '';
      return `<div class="card"><h3>${ico('table')} Recent results</h3>
        ${res.map(r => {
          const opp = State().club(r.oppId);
          return `<div class="res-row res-${r.result}">
            <span class="res-b">${r.result}</span>
            ${crest(opp.name, 'crest-sm')}
            <span class="res-n">${r.home ? 'v' : 'at'} ${esc(opp.name)}</span>
            <b>${r.gf}–${r.ga}</b>
          </div>`;
        }).join('')}</div>`;
    },

    /* ---------------- squad ---------------- */
    tab_msquad() {
      const g = State().game;
      const shape = M().FORMATIONS[g.mgr.formation].line;
      const xi = M().xiPlayers(g), bench = M().benchPlayers(g);
      const row = (s, i, inXI) => `<div class="sq-row${inXI ? ' in' : ''}" data-act="mgrSwap" data-arg="${s.id}">
        <span class="sq-pos">${esc(inXI ? shape[i] : s.pos)}</span>
        <span class="sq-sh">${s.shirt}</span>
        <span class="sq-n">${esc(s.name)}${inXI && s.pos !== shape[i] ? ' <em class="oop">out of position</em>' : ''}</span>
        <span class="sq-meta">${s.age} · ${U().cash(s.wage)}/w</span>
        <span class="sq-o ${s.ovr >= 82 ? 'hi' : s.ovr >= 72 ? 'mid' : ''}">${s.ovr}</span>
      </div>`;

      return `<div class="card"><h3>${ico('squad')} Starting eleven
          <span class="pill">${M().teamRating(g)}</span></h3>
        <p class="dim" style="margin:0 0 10px">Tap a player to swap him with someone on the bench.</p>
        ${xi.map((s, i) => row(s, i, true)).join('')}
        <div class="row" style="margin-top:10px">
          <button class="btn btn-ghost grow" data-act="mgrAuto">${ico('ok')} Pick the best eleven</button>
          <button class="btn btn-ghost grow" data-act="mgrFormation">${ico('tactics')} ${g.mgr.formation}</button>
        </div>
      </div>
      <div class="card"><h3>Substitutes and reserves</h3>
        ${bench.length ? bench.map(s => row(s, 0, false)).join('')
          : '<p class="dim" style="margin:0">Nobody left on the bench.</p>'}
      </div>`;
    },

    /* ---------------- market ---------------- */
    tab_mmarket() {
      const g = State().game;
      const list = M().market(g, g.mgr.filter).slice(0, 40);
      const wageRoom = g.mgr.wageBudget - M().squadWages(g);
      const positions = ['All'].concat(Object.keys(global.DATA.POSITIONS));

      return `<div class="card tight">
        <div class="mk-money">
          <div><span class="dim">Transfer budget</span><b>${U().cash(g.mgr.budget)}</b></div>
          <div><span class="dim">Wage room</span><b class="${wageRoom < 0 ? 'bad' : ''}">${U().cash(wageRoom)}/w</b></div>
        </div>
        <div class="mk-filter">
          <button class="mk-f${g.mgr.filter && g.mgr.filter.afford ? ' on' : ''}"
            data-act="mgrFilter" data-arg="Affordable">Can afford</button>
          ${positions.map(p => `
          <button class="mk-f${(g.mgr.filter && g.mgr.filter.pos) === (p === 'All' ? undefined : p) ? ' on' : ''}"
            data-act="mgrFilter" data-arg="${p}">${p}</button>`).join('')}</div>
      </div>
      <div class="card"><h3>${ico('transfer')} Available</h3>
        ${list.length ? list.map(s => `
          <div class="mk-row" data-act="mgrBid" data-arg="${s.id}">
            <span class="sq-pos">${esc(s.pos)}</span>
            <span class="sq-n">${esc(s.name)}<em>${esc(s.fromClub)} · ${s.age}${
              s.keyman ? ' · <b class="mk-star">star man</b>' : ''}</em></span>
            <span class="mk-ask">${s.free ? 'Free' : U().cash(s.ask)}<em>${U().cash(s.wage)}/w</em></span>
            <span class="sq-o ${s.ovr >= 82 ? 'hi' : s.ovr >= 72 ? 'mid' : ''}">${s.ovr}</span>
          </div>`).join('')
          : '<p class="dim" style="margin:0">Nobody matches that filter.</p>'}
      </div>
      <div class="card"><h3>Sell</h3>
        <p class="dim" style="margin:0 0 9px">Tap one of yours to take the money.</p>
        ${g.squad.slice().sort((a, b) => b.value - a.value).map(s => `
          <div class="mk-row" data-act="mgrSell" data-arg="${s.id}">
            <span class="sq-pos">${esc(s.pos)}</span>
            <span class="sq-n">${esc(s.name)}<em>${s.age} · ${s.apps} apps, ${s.goals} goals</em></span>
            <span class="mk-ask">${U().cash(s.value)}</span>
            <span class="sq-o ${s.ovr >= 82 ? 'hi' : s.ovr >= 72 ? 'mid' : ''}">${s.ovr}</span>
          </div>`).join('')}
      </div>`;
    },

    /* ---------------- table ---------------- */
    tab_mtable() {
      const g = State().game, club = State().club(g.mgr.club);
      const table = global.Engine.Season.standings(g, club.league);
      const target = g.mgr.board.target;
      return `<div class="card"><h3>${ico('table')} ${esc(State().league(club.league).name)}</h3>
        <div class="tb-head"><span>#</span><span></span><span class="tb-n">Club</span>
          <span>P</span><span>GD</span><span>Pts</span></div>
        ${table.map((r, i) => `<div class="tb-row${r.id === club.id ? ' me' : ''}${i + 1 <= target.pos ? ' tgt' : ''}">
          <span>${i + 1}</span>
          ${crest(r.club.name, 'crest-sm')}
          <span class="tb-n">${esc(r.club.name)}</span>
          <span>${r.p}</span><span>${r.gf - r.ga > 0 ? '+' : ''}${r.gf - r.ga}</span>
          <b>${r.pts}</b>
        </div>`).join('')}
        <p class="dim" style="margin:10px 0 0">The board asked for ${U().ordinal(target.pos)} or better.</p>
      </div>`;
    },

    /* ---------------- office ---------------- */
    tab_moffice() {
      const g = State().game, club = State().club(g.mgr.club);
      const conf = Math.round(g.mgr.board.confidence);
      const wages = M().squadWages(g);
      const scorers = g.squad.slice().filter(s => s.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 5);
      return `<div class="card"><h3>${ico('manager')} The board</h3>
        <div class="board-conf">
          <div class="bc-num ${conf >= 60 ? 'good' : conf >= 30 ? 'warn' : 'bad'}">${conf}</div>
          <div class="bc-tx"><b>${conf >= 75 ? 'Delighted' : conf >= 55 ? 'Content' : conf >= 32 ? 'Watching closely'
            : conf >= 15 ? 'Losing patience' : 'One more bad week'}</b>
            <span>${esc(g.mgr.board.target.text)}</span></div>
        </div>
      </div>
      <div class="card"><h3>${ico('value')} Finances</h3>
        <div class="stat-grid">
          <div class="stat"><b>${U().cash(g.mgr.budget)}</b><span>Transfer budget</span></div>
          <div class="stat"><b>${U().cash(wages)}</b><span>Wage bill /w</span></div>
          <div class="stat"><b>${U().cash(g.mgr.wageBudget)}</b><span>Wage ceiling</span></div>
          <div class="stat"><b>${g.squad.length}</b><span>Squad size</span></div>
        </div>
      </div>
      ${scorers.length ? `<div class="card"><h3>${ico('goal')} Top scorers</h3>
        ${scorers.map(s => `<div class="res-row"><span class="sq-pos">${esc(s.pos)}</span>
          <span class="res-n">${esc(s.name)}</span><b>${s.goals}</b></div>`).join('')}</div>` : ''}
      ${g.mgr.trophies.length ? `<div class="card"><h3>${ico('trophy')} Won as manager</h3>
        ${g.mgr.trophies.map(t => `<span class="trophy">${global.Trophies.svg(global.Trophies.classify(t.name).art, 'tiny')} ${esc(t.name)} ${t.year}</span>`).join('')}</div>` : ''}
      ${g.mgr.log.length ? `<div class="card"><h3>${ico('transfer')} Transfer log</h3>
        ${g.mgr.log.slice(0, 12).map(l => `<div class="res-row"><span class="res-b ${l.k === 'in' ? 'res-W' : 'res-L'}">${l.k === 'in' ? '↓' : '↑'}</span>
          <span class="res-n">${esc(l.t)}</span></div>`).join('')}</div>` : ''}
      ${MUI.cvCard(g)}
      <div class="card"><h3>Options</h3><div class="row wrap">
        <button class="btn btn-ghost" data-act="save">${ico('disk')} Save now</button>
        <button class="btn btn-danger" data-act="mgrQuit">${ico('exit')} Quit to menu</button>
      </div></div>`;
    }
  };

  global.MUI = MUI;
})(window);

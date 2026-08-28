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
    TOKEN: 0.86,          // token scale — the slot spacing in manager.js assumes it

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
    /* ---------------- the team, laid out on grass ----------------
       A team sheet is a list; a line-up is a shape. This draws the eleven
       where they actually stand, so you can see at a glance that you have
       nobody on the left wing and two number tens. Tapping a shirt is the
       same swap as tapping a row was. */

    /* Surname only — a full name never fits under a shirt. */
    shortName(name) {
      const parts = String(name || '').trim().split(/\s+/);
      const last = parts[parts.length - 1];
      return last.length > 13 ? last.slice(0, 12) + '.' : last;
    },

    pitchSvg() {
      // Drawn once, behind the shirts: touchline, halfway, centre circle, both
      // boxes. Mown stripes give it depth without an image.
      const L = 'rgba(255,255,255,.30)';
      let stripes = '';
      for (let i = 0; i < 10; i++) {
        stripes += `<rect x="0" y="${i * 44}" width="320" height="44" fill="${
          i % 2 ? 'rgba(255,255,255,.030)' : 'rgba(0,0,0,.045)'}"/>`;
      }
      return `<rect x="0" y="0" width="320" height="440" rx="10" fill="#0f6a3d"/>
        ${stripes}
        <g fill="none" stroke="${L}" stroke-width="1.6">
          <rect x="10" y="10" width="300" height="420" rx="3"/>
          <line x1="10" y1="220" x2="310" y2="220"/>
          <circle cx="160" cy="220" r="42"/>
          <rect x="70" y="10" width="180" height="62"/>
          <rect x="114" y="10" width="92" height="26"/>
          <rect x="70" y="368" width="180" height="62"/>
          <rect x="114" y="404" width="92" height="26"/>
        </g>
        <circle cx="160" cy="220" r="2.6" fill="${L}"/>
        <circle cx="160" cy="58" r="2.2" fill="${L}"/>
        <circle cx="160" cy="382" r="2.2" fill="${L}"/>`;
    },

    /* One man: a shirt in the club's colours, his number on it, his name and
       rating underneath on a plate dark enough to read against grass. */
    shirtToken(s, slotPos, x, y, kit, picked) {
      const [c1, c2] = kit;
      const oop = s.pos !== slotPos;
      const ink = MUI.readable(c1);
      const short = MUI.shortName(s.name);
      // a long surname shrinks to fit rather than getting chopped into an
      // abbreviation nobody can read
      const size = short.length > 12 ? 6.8 : short.length > 10 ? 7.3 : short.length > 8 ? 8 : 9;
      const name = esc(short);
      const cls = 'lu-man' + (picked ? ' picked' : '') + (oop ? ' oop' : '');
      // scaled a touch under 1 so a holding midfielder still fits cleanly
      // between the back four and the men ahead of him
      return `<g class="${cls}" data-act="mgrSwap" data-arg="${s.id}"
          transform="translate(${x} ${y}) scale(${MUI.TOKEN})" role="button" tabindex="0"
          aria-label="${esc(s.name)}, ${esc(slotPos)}, rated ${s.ovr}">
        <ellipse cx="0" cy="15" rx="14" ry="4" fill="rgba(0,0,0,.28)"/>
        <g class="lu-kit">
          <path d="M-11-13 -4-16 0-13 4-16 11-13 14-6 9-3 9 14 -9 14 -9-3 -14-6Z"
            fill="${c1}" stroke="rgba(0,0,0,.55)" stroke-width="1"/>
          <path d="M-4-16 0-13 4-16 4-11 0-8 -4-11Z" fill="${c2}"/>
          <text x="0" y="7" text-anchor="middle" font-size="10" font-weight="800"
            fill="${ink}" font-family="Inter,Helvetica,Arial,sans-serif">${s.shirt || ''}</text>
        </g>
        <g class="lu-plate" transform="translate(0 20)">
          <rect x="-28" y="0" width="56" height="23" rx="5" fill="rgba(6,12,10,.80)"/>
          <text x="0" y="9.5" text-anchor="middle" font-size="${size}" font-weight="700"
            fill="#eef4f2" font-family="Inter,Helvetica,Arial,sans-serif">${name}</text>
          <text x="0" y="19" text-anchor="middle" font-size="8.5" font-weight="800"
            fill="${s.ovr >= 82 ? '#ffc94d' : s.ovr >= 72 ? '#eef4f2' : '#93a5ab'}"
            font-family="Inter,Helvetica,Arial,sans-serif">${esc(slotPos)} · ${s.ovr}</text>
        </g>
        ${oop ? '<circle class="lu-warn" cx="13" cy="-14" r="5" fill="#ff5a6a"/>'
              + '<text x="13" y="-11" text-anchor="middle" font-size="8" font-weight="800"'
              + ' fill="#0b0f14" font-family="Inter,Helvetica,Arial,sans-serif">!</text>' : ''}
      </g>`;
    },

    /* black or white, whichever you can actually read on this colour */
    readable(hex) {
      const h = String(hex || '#888').replace('#', '');
      const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
      const r = parseInt(n.slice(0, 2), 16) || 0, gg = parseInt(n.slice(2, 4), 16) || 0,
            bl = parseInt(n.slice(4, 6), 16) || 0;
      return (r * 299 + gg * 587 + bl * 114) / 1000 > 145 ? '#101820' : '#ffffff';
    },

    lineup(g) {
      const club = State().club(g.mgr.club);
      const kit = global.Crest.kitFor(club.name);
      const shape = M().FORMATIONS[g.mgr.formation].line;
      const slots = M().slots(g.mgr.formation);
      const xi = M().xiPlayers(g);
      const picked = global.Game && global.Game._mgrSwapFrom;
      const men = xi.map((s, i) => {
        const [px, py] = slots[i] || [50, 50];
        // 0-100 in, pixels out, with a margin so nobody's name plate is clipped
        return MUI.shirtToken(s, shape[i], 24 + px * 2.72, 34 + py * 3.5, kit, picked === s.id);
      }).join('');
      return `<div class="lineup"><svg viewBox="0 0 320 440" class="lu-svg"
        role="group" aria-label="Starting eleven on the pitch">
        ${MUI.pitchSvg()}${men}
      </svg></div>`;
    },

    tab_msquad() {
      const g = State().game;
      const shape = M().FORMATIONS[g.mgr.formation].line;
      const xi = M().xiPlayers(g), bench = M().benchPlayers(g);
      const picked = global.Game && global.Game._mgrSwapFrom;
      const oop = xi.filter((s, i) => s.pos !== shape[i]).length;
      const row = (s, i, inXI) => `<div class="sq-row${inXI ? ' in' : ''}${
          picked === s.id ? ' picked' : ''}" data-act="mgrSwap" data-arg="${s.id}">
        <span class="sq-pos">${esc(inXI ? shape[i] : s.pos)}</span>
        <span class="sq-sh">${s.shirt}</span>
        <span class="sq-n">${esc(s.name)}${inXI && s.pos !== shape[i] ? ' <em class="oop">out of position</em>' : ''}</span>
        <span class="sq-meta">${s.age} · ${U().cash(s.wage)}/w</span>
        <span class="sq-o ${s.ovr >= 82 ? 'hi' : s.ovr >= 72 ? 'mid' : ''}">${s.ovr}</span>
      </div>`;

      return `<div class="card tight"><h3>${ico('squad')} ${esc(g.mgr.formation)}
          <span class="pill">${M().teamRating(g)}</span></h3>
        ${MUI.lineup(g)}
        <p class="dim lu-hint">${picked
          ? 'Now tap whoever takes his place.'
          : oop ? `Tap a shirt to swap him. ${oop} ${oop === 1 ? 'man is' : 'men are'} out of position.`
          : 'Tap a shirt to swap him with someone on the bench.'}</p>
        <div class="row">
          <button class="btn btn-ghost grow" data-act="mgrAuto">${ico('ok')} Pick the best eleven</button>
          <button class="btn btn-ghost grow" data-act="mgrFormation">${ico('tactics')} ${g.mgr.formation}</button>
        </div>
      </div>
      <div class="card"><h3>The eleven</h3>
        ${xi.map((s, i) => row(s, i, true)).join('')}
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
      ${(g.mgr.marketNews || []).length ? `<div class="card"><h3>${ico('trend')} The market this week</h3>
        ${g.mgr.marketNews.slice(0, 4).map(n => `<div class="res-row">
          <span class="res-b ${n.k === 'gone' ? 'res-L' : 'res-W'}">${n.k === 'gone' ? '→' : '+'}</span>
          <span class="res-n wrap">${esc(n.t)}</span></div>`).join('')}
        <p class="dim" style="margin:8px 0 0">Names come and go every week. If you want him, go now.</p>
      </div>` : ''}
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

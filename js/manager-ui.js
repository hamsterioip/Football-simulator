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

      return html + MUI.newsCard(g) + MUI.formCard(g);
    },

    /* What people are actually talking about — the hat-trick, the one from
       thirty yards, the penalty he put over the bar. */
    newsCard(g) {
      const feed = (g.mgr.news || []).slice(0, g.mgr.newsOpen ? 24 : 6);
      if (!feed.length) return '';
      const dot = k => k === 'goal' ? 'goal' : k === 'good' ? 'up'
        : k === 'bad' ? 'down' : k === 'flat' ? 'clock' : 'quote';
      return `<div class="card"><h3>${ico('news')} The talk</h3>
        ${feed.map(n => `<div class="mnews mn-${esc(n.k)}">
          <span class="mn-ic">${ico(dot(n.k))}</span>
          <span class="mn-t">${esc(n.t)}</span>
          <span class="mn-w">${esc(n.score)} ${esc(n.opp)}</span>
        </div>`).join('')}
        ${(g.mgr.news || []).length > 6 ? `<button class="btn btn-ghost btn-sm"
          data-act="mgrNewsMore" style="margin-top:8px;width:100%">${
            g.mgr.newsOpen ? 'Show less' : 'Everything that has happened'}</button>` : ''}
      </div>`;
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
          picked === s.id ? ' picked' : ''}" data-act="mgrRow" data-arg="${s.id}">
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
          : 'Tap a shirt to swap him. Tap a name below to open his card.'}</p>
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
      ${MUI.topBoard(g)}
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

    /* The best players alive, with what it would take. Almost all of them are
       out of reach — that is the point of showing them. */
    topBoard(g) {
      const budget = g.mgr.budget, room = g.mgr.wageBudget - M().squadWages(g);
      const f = g.mgr.filter || {};
      const within = s => s.ask <= budget && s.wage <= room;
      let all = M().topPlayers(g);
      let list = all;
      if (f.pos) list = list.filter(s => s.pos === f.pos);
      if (f.afford) list = list.filter(within);
      // a filter with no matches is not the same as an empty world — never let
      // the whole board disappear without saying why
      if (!list.length) {
        return `<div class="card top-card"><h3>${ico('crown')} Top players</h3>
          <p class="dim" style="margin:0">${all.length
            ? 'None of the best in the world match that filter.'
            : 'Every great player has retired. Give it a season — somebody always comes through.'}</p>
        </div>`;
      }
      const shown = (g.mgr.topOpen ? list : list.slice(0, 6));
      const reach = list.filter(within).length;
      return `<div class="card top-card"><h3>${ico('crown')} Top players
          <span class="pill gold">world class</span></h3>
        <p class="dim" style="margin:0 0 10px">The best in the world. None of them are for
          sale — these are the numbers it would take.</p>
        ${shown.map(s => {
          const canFee = s.ask <= budget, canWage = s.wage <= room;
          return `<div class="mk-row top-row${canFee && canWage ? '' : ' outofreach'}"
              data-act="mgrCard" data-arg="${s.id}">
            <span class="top-ovr">${s.ovr}</span>
            ${crest(s.fromClub, 'crest-sm')}
            <span class="sq-n">${esc(s.name)}<em>${esc(s.pos)} · ${s.age} · ${esc(s.fromClub)}</em></span>
            <span class="mk-ask">${U().cash(s.ask)}<em class="${canWage ? '' : 'bad'}">${U().cash(s.wage)}/w</em></span>
          </div>`;
        }).join('')}
        ${list.length > 6 ? `<button class="btn btn-ghost btn-sm" data-act="mgrTopMore"
          style="margin-top:8px;width:100%">${g.mgr.topOpen ? 'Show fewer'
            : 'Show all ' + list.length}</button>` : ''}
        <p class="dim top-foot">${reach
          ? `${reach} of them ${reach === 1 ? 'is' : 'are'} within reach right now.`
          : 'Not one of them is within reach yet. Win things and the money follows — and selling clears the wages to fit him in.'}</p>
      </div>`;
    },

    /* ---------------- a player, and every version of him ----------------
       The peak era gets the treatment: a card that actually moves, because
       the best version of a great player should not sit still on the page. */

    /* Fixed positions rather than random ones, so the sparkle never lands on
       the rating and never moves between renders. */
    STARS: [[9, 26, 1.0, 0], [21, 68, .62, .7], [35, 14, .78, 1.5], [11, 88, .55, .35],
            [78, 34, .9, 2.1], [69, 62, .68, 1.1], [80, 18, .82, .55], [90, 70, .6, 1.8],
            [94, 40, .74, 2.6], [13, 48, .5, 2.3], [62, 10, .58, 1.35], [26, 40, .46, 3]],

    eraStars() {
      return `<div class="era-stars" aria-hidden="true">${MUI.STARS.map(([x, y, sc, d], i) =>
        `<i class="${i % 3 === 2 ? 'sp' : ''}" style="left:${x}%;top:${y}%;--s:${sc};--d:${d}s"></i>`
      ).join('')}</div>`;
    },

    /* ---------------- the portrait card ----------------
       Laid out the way a collectible card is: the rating shouting from the
       top-left, the man in the middle, his name across the bottom, and his
       country and his club under that. Drawn rather than photographed —
       everything in this game is. */

    /* "Cristiano Ronaldo" -> "C. RONALDO" */
    cardName(name) {
      const parts = String(name || '').trim().split(/\s+/);
      const last = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
      const initial = parts.length > 1 ? parts[0][0] + '. ' : '';
      const full = (initial + last).toUpperCase();
      return full.length > 15 ? last.toUpperCase() : full;
    },

    /* The man himself, in his kit, from the thighs up. */
    cardFigure(kit, trim, ink, num) {
      // A bust, cropped at the waist by the name plate. Every shape carries a
      // thin dark edge, because half the kits in this game are white and would
      // otherwise dissolve into one another and into the background.
      const edge = 'rgba(0,0,0,.34)';
      const arm = side => `<path d="M${side * 12.6} -17
          q${side * 7} 1.6 ${side * 7.8} 8.4 l${side * 1.2} 22
          q${side * -3.8} 1.8 ${side * -7.4} 0 l${side * -2.4} -18 Z"
        fill="${kit}" stroke="${edge}" stroke-width=".8" stroke-linejoin="round"/>
        <path d="M${side * 12.6} -17 q${side * 7} 1.6 ${side * 7.8} 8.4 l${side * .6} 10 q${side * -4} -8 ${side * -8.4} -12 Z" fill="rgba(0,0,0,.11)"/>
        <circle cx="${side * 21}" cy="19" r="3.5" fill="#e8b892" stroke="${edge}" stroke-width=".45"/>`;
      return `<g class="fc-man" transform="translate(105 184) scale(3.0)">
        <ellipse cx="0" cy="30" rx="27" ry="8" fill="rgba(0,0,0,.28)"/>
        <path d="M-5.6 -24 h11.2 l.4 6.5 h-12 Z" fill="#dda87f"/>
        <circle cx="-9.5" cy="-29.5" r="2" fill="#e3b088"/>
        <circle cx="9.5" cy="-29.5" r="2" fill="#e3b088"/>
        <circle cx="0" cy="-30" r="9.7" fill="#f0c69f"/>
        <path d="M-9.7 -31.8 q0 -10.6 9.7 -10.6 9.7 0 9.7 10.6 -2.2 -4 -5.5 -5.3
          -5.5 1.8 -13.9 5.3 Z" fill="#2f2018"/>
        ${arm(-1)}${arm(1)}
        <path d="M-12.6 -17 q12.6 -6.4 25.2 0 l3 48 h-31.2 Z"
          fill="${kit}" stroke="${edge}" stroke-width=".55" stroke-linejoin="round"/>
        <path d="M-12.6 -17 q12.6 -6.4 25.2 0 l-.6 4 q-12 -4.4 -24 0 Z" fill="${trim}"/>
        <path d="M-5.8 -17.6 L0 -10 L5.8 -17.6 q-5.8 -1.9 -11.6 0 Z"
          fill="${trim}" stroke="${edge}" stroke-width=".4"/>
        <path d="M-12.6 -17 q12.6 -6.4 25.2 0 l.6 8 q-13.2 -5.2 -26.4 0 Z"
          fill="rgba(0,0,0,.13)"/>
        <text x="0" y="9" text-anchor="middle" font-size="7" font-weight="800"
          fill="${ink}" opacity=".7" font-family="Inter,Helvetica,Arial,sans-serif">${num || ''}</text>
      </g>`;
    },

    /* Embers for the peak card — fixed lanes, staggered clocks. */
    fcDust() {
      const d = [[10, 0, 3.4, 0], [24, 1.2, 4.2, 1], [38, .5, 3.7, 0], [52, 2.1, 4.6, 1],
                 [64, .9, 3.5, 0], [78, 2.6, 4.9, 1], [88, 1.6, 3.8, 0], [46, 3.1, 5.2, 1]];
      return `<div class="fc-dust" aria-hidden="true">${d.map(([x, dl, du, v]) =>
        `<i class="${v ? 'vio' : ''}" style="left:${x}%;--dl:${dl}s;--du:${du}s"></i>`).join('')}</div>`;
    },

    eraPortrait(e, p, best, buy) {
      const uid = 'fc' + (MUI._fc = (MUI._fc || 0) + 1);
      const kit = e.club ? global.Crest.kitFor(e.club) : ['#5a6a76', '#93a5ab'];
      const ink = MUI.readable(kit[0]);
      const act = buy ? ` data-act="mgrEra" data-arg="${p.id}:${e.index}"` : '';
      // big background stars, placed by hand so none of them sit on his face
      const stars = [[18, 46, 26, -14], [186, 74, 34, 12], [30, 250, 30, 8],
                     [176, 232, 22, -8], [104, 22, 18, 0], [12, 158, 16, 10],
                     [196, 160, 18, -12]];
      const star = (x, y, r, rot, fill, op) =>
        `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${r / 50})" opacity="${op}" fill="${fill}"
          d="M0 -50 C6 -18 18 -6 50 0 18 6 6 18 0 50 -6 18 -18 6 -50 0 -18 -6 -6 -18 0 -50 Z"/>`;

      return `<div class="fc-wrap">
        <div class="fc-card${best ? ' fc-best' : ''}${buy && buy.active ? ' fc-on' : ''}"${act}
            role="${act ? 'button' : 'img'}" ${act ? 'tabindex="0"' : ''}
            aria-label="${esc(p.name)}, ${e.year}, rated ${e.ovr}">
          <svg class="fc-art" viewBox="0 0 210 310" aria-hidden="true">
            <defs>
              <linearGradient id="${uid}bg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="${best ? '#2f1656' : '#1a1b34'}"/>
                <stop offset=".45" stop-color="${best ? '#6d31a6' : '#2b2a53'}"/>
                <stop offset="1" stop-color="${best ? '#1c0f3c' : '#131228'}"/>
              </linearGradient>
              <radialGradient id="${uid}burst" cx=".5" cy=".42" r=".62">
                <stop offset="0" stop-color="${best ? 'rgba(255,214,150,.46)' : 'rgba(168,150,255,.28)'}"/>
                <stop offset="1" stop-color="rgba(255,255,255,0)"/>
              </radialGradient>
              <linearGradient id="${uid}frame" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#fdf6e2"/><stop offset=".28" stop-color="#c9b47e"/>
                <stop offset=".5" stop-color="#fffdf6"/><stop offset=".72" stop-color="#b79ad8"/>
                <stop offset="1" stop-color="#f6ecff"/>
              </linearGradient>
              <clipPath id="${uid}clip"><rect x="5" y="5" width="200" height="300" rx="17"/></clipPath>
              <radialGradient id="${uid}spot" cx=".5" cy=".45" r=".5">
                <stop offset="0" stop-color="${best ? 'rgba(255,232,180,.36)' : 'rgba(190,178,255,.26)'}"/>
                <stop offset="1" stop-color="rgba(255,255,255,0)"/>
              </radialGradient>
              <linearGradient id="${uid}fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="rgba(6,8,16,0)"/>
                <stop offset=".24" stop-color="rgba(6,8,16,.78)"/>
                <stop offset="1" stop-color="rgba(6,8,16,.88)"/>
              </linearGradient>
            </defs>
            <g clip-path="url(#${uid}clip)">
              <rect x="5" y="5" width="200" height="300" fill="url(#${uid}bg)"/>
              <ellipse cx="105" cy="130" rx="120" ry="120" fill="url(#${uid}burst)"/>
              ${stars.map(([x, y, r, rot], i) =>
                star(x, y, r, rot, best ? '#ffd873' : '#c3b4ff', best ? (i % 2 ? .24 : .32) : (i % 2 ? .13 : .18))).join('')}
              <g class="fc-rays" opacity="${best ? .34 : .16}">
                ${[0, 1, 2, 3, 4, 5].map(i =>
                  `<path d="M105 118 L${-40 + i * 60} 310 L${-4 + i * 60} 310 Z" fill="#fff" opacity=".35"/>`).join('')}
              </g>
              <ellipse cx="105" cy="150" rx="74" ry="86" fill="url(#${uid}spot)"/>
              ${MUI.cardFigure(kit[0], kit[1], ink, p.shirt)}
              <g class="fc-front">
                ${star(30, 116, 40, -18, best ? '#ffd873' : '#c3b4ff', best ? .30 : .17)}
                ${star(184, 178, 46, 14, best ? '#ffe6a8' : '#d6cbff', best ? .26 : .14)}
                ${star(150, 62, 22, 6, '#ffffff', best ? .5 : .3)}
              </g>
              <rect x="5" y="206" width="200" height="99" fill="url(#${uid}fade)"/>
              <rect x="30" y="224" width="150" height="1.3" fill="${best ? 'rgba(255,216,115,.75)' : 'rgba(255,255,255,.35)'}"/>
            </g>
            <rect x="5" y="5" width="200" height="300" rx="17" fill="none"
              stroke="url(#${uid}frame)" stroke-width="3"/>
            <rect x="8.5" y="8.5" width="193" height="293" rx="14" fill="none"
              stroke="rgba(0,0,0,.35)" stroke-width="1.2"/>
          </svg>

          <div class="fc-rating"><b>${e.ovr}</b><span>${esc(p.pos)}</span></div>
          <div class="fc-year">${e.year}</div>
          <div class="fc-name">${esc(MUI.cardName(p.name))}</div>
          ${e.trait ? `<div class="fc-trait">${esc(e.trait)}</div>` : ''}
          <div class="fc-foot">
            ${global.Icons.flag(p.nation, 'sm')}
            <span class="fc-dot"></span>
            ${e.club ? crest(e.club, 'crest-sm') : '<span class="fc-dot"></span>'}
          </div>
          ${best ? MUI.fcDust() + '<div class="fc-shine"></div>' + MUI.eraStars()
            + '<div class="fc-ring" aria-hidden="true"><i></i></div>'
            + '<div class="fc-glint g1" aria-hidden="true"></div>'
            + '<div class="fc-glint g2" aria-hidden="true"></div>'
            + '<div class="fc-tag">PEAK</div>' : ''}
        </div>
        ${buy ? `<div class="era-buy ${buy.active ? 'on' : buy.owned ? 'owned' : ''}">${
          buy.active ? ico('ok') + ' In your squad'
            : buy.owned ? 'Switch back — free'
            : buy.price ? U().cash(buy.price)
            : 'Free'}</div>` : ''}
        <div class="fc-label">${esc(e.label)}</div>
      </div>`;
    },

    timelineHtml(p, owned) {
      const eras = global.Timeline.for(p);
      if (!eras.length) return '<p class="dim">Nothing on record.</p>';
      const best = global.Timeline.peakIndex(eras);
      if (!owned) {
        return `<div class="tl-locked">
          <div class="tl-lock">${ico('lock')}</div>
          <p class="muted">Sign him and his whole career opens up here —
            every version of him there has ever been, and the best one of the lot.</p>
          <p class="dim">${eras.length} eras on record.</p>
        </div>`;
      }
      const g = State().game;
      const budget = g.mgr.budget;
      const room = g.mgr.wageBudget - M().squadWages(g) + (p.wage || 0);
      const info = eras.map(e => ({
        active: M().eraActive(p, e), owned: M().eraOwned(p, e),
        price: M().eraPrice(p, e), wage: M().eraWage(p, e)
      }));
      const canAny = info.some(b => !b.active && (b.owned || b.price <= budget) && b.wage <= room);
      return `<div class="fc-rail">
        ${eras.map((e, i) => MUI.eraPortrait(e, p, global.Timeline.isPeak(eras, i), info[i])).join('')}
      </div>
      <p class="dim tl-foot">Tap an era to bring that version of him back — it comes out of the
        transfer budget, and once you have paid for a version you can switch to it for nothing.
        ${canAny ? '' : 'Nothing here is within your budget yet.'}</p>
      <p class="dim tl-foot">${global.Timeline.curated(p)
        ? 'Clubs and years are a matter of record. The ratings are this game’s opinion.'
        : 'Reconstructed from his age and what he is now — no club history on file for him.'}</p>`;
    },

    playerTabs: [
      { id: 'pOverview', label: 'Player', icon: 'player' },
      { id: 'pTimeline', label: 'Timeline', icon: 'clock' }
    ],

    overviewHtml(p, owned) {
      const rows = [
        ['Position', p.pos], ['Age', p.age], ['Rating', p.ovr],
        ['Nation', p.nation || '—'],
        ['Wages', U().cash(p.wage || 0) + '/week'],
        owned ? ['Shirt', p.shirt || '—'] : ['Club', p.fromClub || '—'],
        owned ? ['Appearances', p.apps || 0] : ['Asking price', U().cash(p.ask || p.value || 0)],
        owned ? ['Goals', p.goals || 0] : ['Value', U().cash(p.value || 0)]
      ];
      return `<div class="pc-head">
          ${global.Icons.flag(p.nation, 'lg')}
          <div><div class="pc-name">${esc(p.name)}</div>
            <div class="dim">${esc(p.pos)} · ${p.age} · rated <b>${p.ovr}</b></div></div>
        </div>
        <div class="pc-rows">${rows.map(([k, v]) =>
          `<div class="pc-row"><span>${esc(k)}</span><b>${esc(String(v))}</b></div>`).join('')}</div>`;
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

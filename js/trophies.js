/* ==========================================================================
   trophies.js — the trophy cabinet.

   Real trophy designs are protected artwork, so the game draws its own: each
   competition family gets a silhouette you can tell apart at a glance — the
   globe held aloft, the big-eared cup, the tall domestic cup, the golden ball.
   Inline SVG, so it works offline and at any size.
   ========================================================================== */
(function (global) {
  'use strict';

  const GOLD = `<linearGradient id="tg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe9a8"/><stop offset=".45" stop-color="#f2b829"/>
      <stop offset="1" stop-color="#b8791a"/></linearGradient>
    <linearGradient id="tgs" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff6d8"/><stop offset="1" stop-color="#e0a726"/></linearGradient>`;

  const PLINTH = '<rect x="14" y="49" width="20" height="4.5" rx="1.4" class="t-base"/>' +
                 '<rect x="10.5" y="53" width="27" height="6" rx="2.5" class="t-base"/>';

  /* Each drawing is 48x64 with the plinth at the bottom. */
  const ART = {
    // World Cup: a globe held aloft by two curling figures
    world: `<path d="M21 45C15.5 38 15.5 27 20.6 21.4" stroke="url(#tg)" stroke-width="5.4" fill="none" stroke-linecap="round"/>
      <path d="M27 45C32.5 38 32.5 27 27.4 21.4" stroke="url(#tg)" stroke-width="5.4" fill="none" stroke-linecap="round"/>
      <circle cx="24" cy="13.4" r="7.2" fill="url(#tgs)"/>
      <path d="M16.8 13.4h14.4M24 6.2c3.8 4 3.8 10.4 0 14.4M24 6.2c-3.8 4-3.8 10.4 0 14.4"
        stroke="#9a6a12" stroke-width=".95" fill="none"/>
      <ellipse cx="24" cy="46.5" rx="9.5" ry="3.4" fill="url(#tgs)"/>
      ${PLINTH}`,
    // Champions League: the big ears
    bigears: `<path d="M15.5 16C8.5 8.5 3 15 4.6 23.6 6 30.4 10.4 33.6 14.6 34.4" stroke="url(#tg)" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M32.5 16C39.5 8.5 45 15 43.4 23.6 42 30.4 37.6 33.6 33.4 34.4" stroke="url(#tg)" stroke-width="3.4" fill="none" stroke-linecap="round"/>
      <path d="M14 13.6h20v9.4a10 10 0 0 1-20 0z" fill="url(#tg)"/>
      <path d="M14 13.6h20v2.2H14z" fill="#fff3cf"/>
      <rect x="22" y="32.4" width="4" height="10.6" fill="url(#tg)"/>
      <ellipse cx="24" cy="45" rx="9" ry="3.4" fill="url(#tgs)"/>
      ${PLINTH}`,
    // Domestic cup: tall and slender, with a domed lid and a finial
    domestic: `<circle cx="24" cy="4.6" r="2" fill="url(#tgs)"/>
      <path d="M18 11c0-3.6 2.7-5 6-5s6 1.4 6 5z" fill="url(#tgs)"/>
      <path d="M17.6 11h12.8l-.9 3.4H18.5z" fill="url(#tg)"/>
      <path d="M18.4 15.6h11.2l-1.3 12.4a4.6 4.6 0 0 1-8.6 0z" fill="url(#tg)"/>
      <path d="M18 17.6c-4.2 1-5.4 5-3.2 8 1.3 1.8 3.1 2.4 4.5 2.4" stroke="url(#tg)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M30 17.6c4.2 1 5.4 5 3.2 8-1.3 1.8-3.1 2.4-4.5 2.4" stroke="url(#tg)" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <rect x="22.6" y="32" width="2.8" height="11" fill="url(#tg)"/>
      <ellipse cx="24" cy="45" rx="7.6" ry="3" fill="url(#tgs)"/>
      ${PLINTH}`,
    // League title: a broad, open two-handled cup — no lid
    league: `<path d="M12.5 14h23l-2.6 11.6A9.2 9.2 0 0 1 24 32a9.2 9.2 0 0 1-8.9-6.4z" fill="url(#tg)"/>
      <path d="M12.5 14h23v2.8h-23z" fill="url(#tgs)"/>
      <path d="M13.4 18c-4.8 1-6.2 5.4-3.6 8.4 1.4 1.6 3.2 2.2 4.8 2.2" stroke="url(#tg)" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <path d="M34.6 18c4.8 1 6.2 5.4 3.6 8.4-1.4 1.6-3.2 2.2-4.8 2.2" stroke="url(#tg)" stroke-width="2.8" fill="none" stroke-linecap="round"/>
      <rect x="21.6" y="32" width="4.8" height="9" fill="url(#tg)"/>
      <ellipse cx="24" cy="44.6" rx="10" ry="3.6" fill="url(#tgs)"/>
      ${PLINTH}`,
    // Libertadores: a small chalice on a tall stepped pedestal
    libertadores: `<path d="M16.4 8.6h15.2l-2.4 5.2H18.8z" fill="url(#tgs)"/>
      <path d="M19 13.8h10l-1.5 8.8a3.6 3.6 0 0 1-7 0z" fill="url(#tg)"/>
      <path d="M21.5 10.6h5" stroke="#9a6a12" stroke-width=".9"/>
      <rect x="22.4" y="22.6" width="3.2" height="9.4" fill="url(#tg)"/>
      <ellipse cx="24" cy="33" rx="6.4" ry="2.4" fill="url(#tgs)"/>
      <rect x="16.4" y="34.4" width="15.2" height="4.6" rx="1.2" fill="url(#tg)"/>
      <rect x="12.8" y="39.2" width="22.4" height="5.6" rx="1.6" fill="url(#tgs)"/>
      ${PLINTH}`,
    // CONCACAF: an angular, faceted modern cup
    concacaf: `<path d="M11.5 12h25l-9.5 15h-6z" fill="url(#tg)"/>
      <path d="M11.5 12h25l-2.4 3.8H13.9z" fill="url(#tgs)"/>
      <path d="M18 12.4l3.6 14.4M30 12.4l-3.6 14.4M24 12.4V27" stroke="#9a6a12" stroke-width=".8"/>
      <rect x="21.8" y="26.4" width="4.4" height="7.4" fill="url(#tg)"/>
      <path d="M14.2 33.4h19.6l-2.8 11.4H17z" fill="url(#tgs)"/>
      <path d="M14.2 33.4h19.6l-.6 2.4H14.8z" fill="url(#tg)"/>
      ${PLINTH}`,
    // Ballon d'Or: the golden ball
    ball: `<circle cx="24" cy="21" r="11.6" fill="url(#tgs)"/>
      <path d="M24 13.4l4.5 3.3-1.7 5.3h-5.6l-1.7-5.3z" fill="#9a6a12"/>
      <path d="M24 9.4v4M12.8 19.6l3.8 1.6M35.2 19.6l-3.8 1.6M17.2 30.6l2.4-3.4M30.8 30.6l-2.4-3.4"
        stroke="#9a6a12" stroke-width="1.1"/>
      <rect x="22" y="32.6" width="4" height="10" fill="url(#tg)"/>
      <ellipse cx="24" cy="45" rx="8.4" ry="3.2" fill="url(#tgs)"/>
      ${PLINTH}`,
    // Golden Boot
    boot: `<path d="M12 19h9.5c1 5.2 3.2 6.2 8.3 7.3 4.8 1 6.9 2.7 6.9 6.4V36H12z" fill="url(#tg)"/>
      <path d="M12 36h24.7v3.6H12z" fill="url(#tgs)"/>
      <path d="M15.2 23h4.2M15.2 27.2h3.2" stroke="#9a6a12" stroke-width="1.1"/>
      <rect x="21.5" y="39.6" width="5" height="6" fill="url(#tg)"/>
      ${PLINTH}`,
    // Everything else: a ribboned medal
    medal: `<path d="M16 9l5.6 13.4 3.6-1.6L19.6 9z" fill="#5aa8ff"/>
      <path d="M32 9l-5.6 13.4-3.6-1.6L28.4 9z" fill="#ff5a6a"/>
      <circle cx="24" cy="34" r="12.4" fill="url(#tgs)"/>
      <circle cx="24" cy="34" r="8.4" fill="none" stroke="#9a6a12" stroke-width="1.2"/>
      <path d="M24 27.6l2 4.1 4.5.6-3.3 3.2.8 4.5-4-2.1-4 2.1.8-4.5-3.3-3.2 4.5-.6z" fill="#9a6a12"/>`
  };

  /* Which drawing, which shelf, for a given honour. */
  const SHELVES = [
    { id: 'intl', label: 'International' },
    { id: 'continental', label: 'Continental' },
    { id: 'league', label: 'League titles' },
    { id: 'cup', label: 'Domestic cups' },
    { id: 'individual', label: 'Individual honours' }
  ];

  /* Real trophy photographs, hot-linked from Wikimedia Commons and layered
     over the drawn artwork — online you see the actual cup, offline or on a
     failed request the drawing shows through. Same pattern as club badges. */
  const WMC = 'https://upload.wikimedia.org/wikipedia/commons';
  const PHOTOS = [
    [/world cup/i, 'worldcup', WMC + '/thumb/c/ce/FIFA_World_Cup_Trophy_photo_by_Djuradj_Vujcic.jpg/500px-FIFA_World_Cup_Trophy_photo_by_Djuradj_Vujcic.jpg'],
    [/continental championship/i, 'euros', WMC + '/thumb/8/81/Coupe_Henri_Delaunay_2017.jpg/500px-Coupe_Henri_Delaunay_2017.jpg'],
    [/continental cup/i, 'copaamerica', WMC + '/thumb/9/97/Copa_america_trofeo.jpg/500px-Copa_america_trofeo.jpg'],
    [/champions league/i, 'ucl', WMC + '/1/18/Coppacampioni_%28closer%29.png'],
    [/europa league/i, 'uel', WMC + '/thumb/4/42/Europa_league_trophy.jpg/500px-Europa_league_trophy.jpg'],
    [/libertadores/i, 'libertadores', WMC + '/7/7a/328-3287452_copa-libertadores-primer-trofeo-hd-png-download.png'],
    [/concacaf/i, 'concacaf', WMC + '/thumb/d/de/CONCACAF_Champions_League_Cup.svg/500px-CONCACAF_Champions_League_Cup.svg.png'],
    [/premier league/i, 'pl', WMC + '/thumb/f/f2/Premier_League_Trophy_at_Manchester%27s_National_Football_Museum_%28Ank_Kumar%29_01.jpg/500px-Premier_League_Trophy_at_Manchester%27s_National_Football_Museum_%28Ank_Kumar%29_01.jpg'],
    [/la liga/i, 'laliga', WMC + '/thumb/d/d3/Trofeo_de_La_Liga_9900.jpg/500px-Trofeo_de_La_Liga_9900.jpg'],
    [/serie a/i, 'seriea', WMC + '/thumb/a/ae/Coppa_Campioni_d%27Italia_%28Serie_A%29.png/330px-Coppa_Campioni_d%27Italia_%28Serie_A%29.png'],
    [/bundesliga/i, 'bundesliga', WMC + '/thumb/f/f9/Trophy_of_Fu%C3%9Fball-Bundesliga_in_Singapore%2C_2023.jpg/500px-Trophy_of_Fu%C3%9Fball-Bundesliga_in_Singapore%2C_2023.jpg'],
    [/ligue 1/i, 'ligue1', WMC + '/5/5a/Hexagoal.jpg'],
    [/fa cup/i, 'facup', WMC + '/thumb/3/3f/The_FA_Cup_Trophy.jpg/500px-The_FA_Cup_Trophy.jpg'],
    [/copa del rey/i, 'copadelrey', WMC + '/thumb/a/a4/Copa_del_Rey_Trophy.png/500px-Copa_del_Rey_Trophy.png'],
    [/coppa italia/i, 'coppaitalia', WMC + '/thumb/2/29/Coppa_Italia_trophy_icon.jpg/330px-Coppa_Italia_trophy_icon.jpg'],
    [/dfb-pokal/i, 'dfbpokal', WMC + '/d/d8/DFB_Pokal_Trophy.png'],
    [/coupe de france/i, 'coupefrance', WMC + '/thumb/1/1f/Coupe_de_France_trophy.png/500px-Coupe_de_France_trophy.png'],
    [/knvb/i, 'knvb', WMC + '/d/d2/Gouden_KNVB_beker.png'],
    [/taça de portugal|taca de portugal/i, 'taca', WMC + '/7/70/Ta%C3%A7a_de_Portugal_Trophy.png'],
    [/world player|ballon/i, 'ballondor', WMC + '/thumb/0/04/2016_Ballon_dOr_CR7Museum.jpg/500px-2016_Ballon_dOr_CR7Museum.jpg'],
    [/golden boot|golden shoe/i, 'goldenshoe', 'https://upload.wikimedia.org/wikipedia/en/2/2b/Golden_Shoe%2C_Lionel_Messi_2012-2013.jpg']
  ];

  const CUP_WORDS = /(cup|copa|coppa|pokal|coupe|beker|taça|taca|trophy|shield)/i;

  function classify(name) {
    const n = String(name);
    if (/world cup/i.test(n)) return { art: 'world', shelf: 'intl' };
    if (/continental (championship|cup)/i.test(n)) return { art: 'world', shelf: 'intl' };
    if (/champions league/i.test(n)) return { art: 'bigears', shelf: 'continental' };
    if (/libertadores/i.test(n)) return { art: 'libertadores', shelf: 'continental' };
    if (/concacaf/i.test(n)) return { art: 'concacaf', shelf: 'continental' };
    if (/world player of the year|world xi/i.test(n)) return { art: 'ball', shelf: 'individual' };
    if (/golden boot/i.test(n)) return { art: 'boot', shelf: 'individual' };
    if (/player of the (season|year)|team of the season|young player/i.test(n))
      return { art: 'medal', shelf: 'individual' };
    if (/title$/i.test(n)) return { art: 'league', shelf: 'league' };
    if (CUP_WORDS.test(n)) return { art: 'domestic', shelf: 'cup' };
    return { art: 'medal', shelf: 'individual' };
  }

  const Trophies = {
    SHELVES, classify,
    GOLD,                                   // the shared gold gradients
    body(art) { return ART[art] || ART.medal; },

    svg(art, cls) {
      const body = ART[art] || ART.medal;
      return `<svg class="trophy-art ${cls || ''}" viewBox="0 0 48 64" aria-hidden="true">
        <defs>${GOLD}</defs>${body}</svg>`;
    },

    // the real photograph of this competition's trophy, when we have one
    photo(name) {
      const n = String(name);
      for (const [re, , url] of PHOTOS) if (re.test(n)) return url;
      return null;
    },

    // which embedded cut-out (js/trophy-imgs.js) belongs to this honour
    photoId(name) {
      const n = String(name);
      for (const [re, id] of PHOTOS) if (re.test(n)) return id;
      return null;
    },

    /* What the cabinet shows. Best: the embedded transparent cut-out of the
       real trophy. Then: a hot-linked photo on a card. Last: the drawing. */
    figure(name, cls) {
      const art = classify(name).art;
      const drawn = Trophies.svg(art, cls);
      const id = Trophies.photoId(name);
      if (!id) return drawn;
      const data = (global.TROPHY_IMGS || {})[id];
      if (data) return `<img class="tro-cut ${cls || ''}" src="${data}" alt="" loading="lazy"
        onerror="this.outerHTML=window.Trophies.svg('${art}')"/>`;
      const url = Trophies.photo(name);
      if (!url) return drawn;
      return `<span class="tro-fig">${drawn}<img src="${url}" alt="" loading="lazy" onerror="this.remove()"/></span>`;
    },

    /* Group a career's honours: one row per competition, with how many and when.
       Returns [{ shelf, label, rows: [{name, art, years[], count}] }] */
    cabinet(player) {
      const all = (player.career.trophies || []).map(t => ({ name: t.name, year: t.year, club: t.club }))
        .concat((player.achievements || []).map(a => ({ name: a.name, year: a.year })));
      const byName = {};
      all.forEach(t => {
        /* "World Cup 2031" -> "World Cup" + 2031, "Player of the Month — May" -> one row */
        const m = /^(.*?)[\s,]+(\d{4})$/.exec(String(t.name));
        const key = (m ? m[1] : String(t.name)).replace(/\s+[—–-]\s+.*$/, '').trim();
        const year = m ? +m[2] : t.year;
        if (!byName[key]) {
          const c = classify(key);
          byName[key] = { name: key, art: c.art, shelf: c.shelf, years: [], clubs: {} };
        }
        byName[key].years.push(year);
        if (t.club) byName[key].clubs[t.club] = true;
      });
      const shelves = SHELVES.map(sh => ({
        shelf: sh.id, label: sh.label,
        rows: Object.values(byName).filter(r => r.shelf === sh.id)
          .map(r => ({ name: r.name, art: r.art, count: r.years.length,
                       years: r.years.slice().sort((a, b) => a - b),
                       clubs: Object.keys(r.clubs) }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      })).filter(sh => sh.rows.length);
      return { shelves, total: all.length };
    }
  };


  /* ==========================================================================
     THE LIFT — you won it, so somebody has to get it above their head.

     A night in a stadium: the team in a huddle on the podium, the captain
     hoisting whatever you just won, ticker tape, flashbulbs and a stand that
     will not sit down. Same drawn trophies as the cabinet.
     ========================================================================== */
  const LW = 320, LH = 220;

  function lrnd(seed) {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }

  const LIFT_CROWD = (() => {
    const rnd = lrnd(5150501);
    const tones = ['#1b2b45', '#22364f', '#37414f', '#14202f', '#404a5c', '#d8dee9', '#1f7a4d', '#2c1f3a'];
    let out = '';
    for (let row = 0; row < 16; row++) {
      const y = 2 + row * 4.1;
      const jitter = row % 2 ? 1.7 : 0;
      for (let x = -2; x < LW + 4; x += 3.3) {
        out += `<rect x="${(x + jitter).toFixed(1)}" y="${y.toFixed(1)}" width="2.2" height="2.9" rx="1"
          fill="${tones[Math.floor(rnd() * tones.length)]}" opacity="${(0.3 + rnd() * 0.6).toFixed(2)}"/>`;
      }
    }
    return out;
  })();

  /* one team-mate, seen from behind, arms up */
  function mate(x, y, scale, kit, trim, flip) {
    return `<g class="lf-mate" transform="translate(${x} ${y}) scale(${(flip ? -scale : scale).toFixed(2)} ${scale})">
      <ellipse cx="0" cy="1" rx="11" ry="2.8" fill="rgba(0,0,0,.4)"/>
      <path d="M-7 -13 h14 v9 q0 4 -3.2 4 h-2.4 q-2.2 0 -2.2 -2.8 v-5.6 h-1.9 v5.6 q0 2.8 -2.2 2.8 h-2.4 q-3.2 0 -3.2 -4 Z" fill="#0e2033"/>
      <path d="M-8 -31 q8 -4 16 0 l2.1 18 q-10.1 3.6 -20.2 0 Z" fill="${kit}"/>
      <path d="M-8 -31 q8 -4 16 0 l.5 3.9 q-8.5 -3 -17 0 Z" fill="${trim}"/>
      <rect x="-21" y="-36" width="14" height="5.4" rx="2.7" fill="${kit}" transform="rotate(-38 -8 -30)"/>
      <rect x="7" y="-36" width="14" height="5.4" rx="2.7" fill="${kit}" transform="rotate(38 8 -30)"/>
      <circle cx="0" cy="-36" r="5.4" fill="#e8b98d"/>
      <path d="M-5.4 -38.2 a5.4 5.4 0 0 1 10.8 0 q-5.4 -3 -10.8 0 Z" fill="#2b1d13"/>
    </g>`;
  }

  Trophies.LIFT_W = LW;
  Trophies.LIFT_H = LH;

  /* The scene. `name` picks the trophy; `kit`/`trim` colour the shirts. */
  Trophies.liftScene = function (name, kit, trim) {
    const art = classify(name).art;
    kit = kit || '#2ae67e'; trim = trim || 'rgba(255,255,255,.55)';
    const mates = [
      mate(58, 196, .78, kit, trim, false), mate(96, 202, .88, kit, trim, true),
      mate(226, 202, .88, kit, trim, false), mate(264, 196, .78, kit, trim, true),
      mate(134, 208, .95, kit, trim, true), mate(190, 208, .95, kit, trim, false)
    ].join('');
    return `<svg class="lift-view" viewBox="0 0 ${LW} ${LH}" role="img" aria-label="Lifting the ${esc(name)}">
      <defs>
        <linearGradient id="lf-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#050b12"/><stop offset="1" stop-color="#0a1a24"/>
        </linearGradient>
        <linearGradient id="lf-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#04231596"/><stop offset="1" stop-color="#0d5334"/>
        </linearGradient>
        <radialGradient id="lf-glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="rgba(255,220,140,.85)"/>
          <stop offset=".55" stop-color="rgba(255,201,77,.22)"/>
          <stop offset="1" stop-color="rgba(255,201,77,0)"/>
        </radialGradient>
        <radialGradient id="lf-beam" cx=".5" cy="0" r="1">
          <stop offset="0" stop-color="rgba(220,255,235,.20)"/>
          <stop offset="1" stop-color="rgba(220,255,235,0)"/>
        </radialGradient>
        ${Trophies.GOLD}
      </defs>
      <g class="lf-cam">
        <rect width="${LW}" height="${LH}" fill="url(#lf-night)"/>
        <g class="lf-stand">${LIFT_CROWD}</g>
        <g class="lf-flashes"></g>
        <path d="M-10 0 L80 0 L160 150 L-40 150 Z" fill="url(#lf-beam)"/>
        <path d="M${LW - 80} 0 L${LW + 10} 0 L${LW + 40} 150 L${LW - 160} 150 Z" fill="url(#lf-beam)"/>
        <rect x="-4" y="66" width="${LW + 8}" height="10" rx="2" fill="#0d1a26"/>
        <rect x="-4" y="74" width="${LW + 8}" height="2" fill="rgba(255,201,77,.4)"/>
        <rect x="0" y="76" width="${LW}" height="${LH - 76}" fill="url(#lf-grass)"/>

        <circle class="lf-glow" cx="160" cy="176" r="72" fill="url(#lf-glow)" opacity="0"/>

        <g class="lf-mates">${mates}</g>

        <!-- the captain, and what he is holding up -->
        <g class="lf-hero" transform="translate(160 214)">
          <ellipse cx="0" cy="1" rx="15" ry="3.6" fill="rgba(0,0,0,.45)"/>
          <path d="M-9 -17 h18 v12 q0 5 -4 5 h-3 q-2.8 0 -2.8 -3.5 v-7 h-2.4 v7 q0 3.5 -2.8 3.5 h-3 q-4 0 -4 -5 Z" fill="#0e2033"/>
          <path d="M-10.5 -40 q10.5 -5 21 0 l2.7 23 q-13.2 4.6 -26.4 0 Z" fill="${kit}"/>
          <path d="M-10.5 -40 q10.5 -5 21 0 l.7 5 q-11.2 -4 -22.4 0 Z" fill="${trim}"/>
          <g class="lf-arm-l"><rect x="-24" y="-47" width="15" height="6" rx="3" fill="${kit}"/></g>
          <g class="lf-arm-r"><rect x="9" y="-47" width="15" height="6" rx="3" fill="${kit}"/></g>
          <circle cx="0" cy="-47" r="7" fill="#e8b98d"/>
          <path d="M-7 -49.6 a7 7 0 0 1 14 0 q-7 -3.8 -14 0 Z" fill="#2b1d13"/>
        </g>
        <g class="lf-trophy" style="transform:translate(160px,190px) scale(.75)">
          <g class="lf-trophy-in">
            <g transform="translate(-20.4 -54.4) scale(.85)">${Trophies.body(art)}</g>
          </g>
        </g>

        <g class="lf-tape"></g>
      </g>
    </svg>`;
  };

  /* Run it. Returns nothing; calls done when the party is under way. */
  Trophies.playLift = function (root, done) {
    if (!root) { if (done) done(); return; }
    const q = s => root.querySelector(s);
    const reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hero = q('.lf-hero'), trophy = q('.lf-trophy'), glow = q('.lf-glow');
    const tape = q('.lf-tape'), flashes = q('.lf-flashes');

    // flashbulbs all around the ground
    if (flashes) {
      let f = '';
      const rnd = lrnd(90210);
      for (let i = 0; i < 22; i++)
        f += `<circle class="lf-flash" cx="${(6 + rnd() * (LW - 12)).toFixed(1)}"
          cy="${(4 + rnd() * 60).toFixed(1)}" r="1.7" style="animation-delay:${(rnd() * 2.4).toFixed(2)}s"/>`;
      flashes.innerHTML = f;
    }

    if (reduce) {
      if (trophy) trophy.style.transform = 'translate(160px, 150px)';
      if (glow) glow.style.opacity = '1';
      if (done) done();
      return;
    }

    // ticker tape, endlessly
    if (tape) {
      let t = '';
      const rnd = lrnd(31337);
      const cols = ['#2ae67e', '#ffffff', '#ffc94d', '#5aa8ff', '#ff7a92'];
      for (let i = 0; i < 54; i++)
        t += `<rect x="${(-6 + rnd() * (LW + 12)).toFixed(1)}" y="${(-14 - rnd() * 90).toFixed(1)}"
          width="${(3 + rnd() * 3).toFixed(1)}" height="${(6 + rnd() * 6).toFixed(1)}" rx="1.2"
          fill="${cols[i % cols.length]}" opacity=".95"/>`;
      tape.innerHTML = t;
      Array.prototype.forEach.call(tape.children, (bit, i) => {
        const drift = (Math.random() - .5) * 60;
        bit.animate([
          { transform: 'translate(0,0) rotate(0deg)' },
          { transform: `translate(${drift}px, ${LH + 120}px) rotate(${360 + Math.random() * 540}deg)` }
        ], { duration: 2600 + Math.random() * 1800, delay: Math.random() * 1600,
             iterations: Infinity, easing: 'linear' });
      });
    }

    // he crouches, then drives it up over his head
    if (hero) hero.animate([
      { transform: 'translate(160px, 218px) scale(.98)' },
      { transform: 'translate(160px, 220px) scale(.96)', offset: .18 },
      { transform: 'translate(160px, 212px) scale(1.01)', offset: .55 },
      { transform: 'translate(160px, 214px) scale(1)' }
    ], { duration: 1100, easing: 'cubic-bezier(.3,.7,.35,1)', fill: 'forwards' });

    ['.lf-arm-l', '.lf-arm-r'].forEach((sel, i) => {
      const arm = q(sel);
      if (arm) arm.animate([
        { transform: 'rotate(0deg)' },
        { transform: `rotate(${i ? -14 : 14}deg)`, offset: .18 },
        { transform: `rotate(${i ? -52 : 52}deg)` }
      ], { duration: 1100, easing: 'cubic-bezier(.3,.7,.35,1)', fill: 'forwards' });
    });

    if (trophy) {
      trophy.animate([
        { transform: 'translate(160px, 190px) scale(.75)', opacity: .9 },
        { transform: 'translate(160px, 196px) scale(.76)', opacity: 1, offset: .18 },
        { transform: 'translate(160px, 143px) scale(1.06)', offset: .62 },
        { transform: 'translate(160px, 153px) scale(1)', offset: .82 },
        { transform: 'translate(160px, 150px) scale(1.01)' }
      ], { duration: 1200, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'forwards' });
      const inner = q('.lf-trophy-in');
      if (inner) inner.animate([
        { transform: 'rotate(-4deg)' }, { transform: 'rotate(4deg)' }
      ], { duration: 2600, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' });
    }

    if (glow) glow.animate([
      { opacity: 0, transform: 'translate(0,0) scale(.4)' },
      { opacity: .85, transform: 'translate(0,-48px) scale(1)', offset: .7 },
      { opacity: .7, transform: 'translate(0,-52px) scale(1.03)' }
    ], { duration: 1300, easing: 'ease-out', fill: 'forwards' });

    // the mates bounce, out of time with each other, like real people
    root.querySelectorAll('.lf-mate').forEach((el, i) => {
      el.animate([
        { transform: el.getAttribute('transform') + ' translate(0,0)' },
        { transform: el.getAttribute('transform') + ' translate(0,-5px)' },
        { transform: el.getAttribute('transform') + ' translate(0,0)' }
      ], { duration: 620 + i * 55, iterations: Infinity, easing: 'ease-in-out', delay: i * 90 });
    });

    const stand = q('.lf-stand');
    if (stand) stand.animate([
      { transform: 'translateY(0)' }, { transform: 'translateY(-2.5px)' }, { transform: 'translateY(0)' }
    ], { duration: 760, iterations: Infinity, easing: 'ease-in-out' });

    const cam = q('.lf-cam');
    if (cam) cam.animate([
      { transform: 'scale(1.06)' }, { transform: 'scale(1)' }
    ], { duration: 1400, easing: 'ease-out', fill: 'forwards' });

    setTimeout(() => { if (done) done(); }, 1300);
  };

  function esc(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  global.Trophies = Trophies;
})(window);

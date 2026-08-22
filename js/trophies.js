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
    [/world cup/i, WMC + '/thumb/1/15/FIFA_World_Cup_Trophy_%28Ank_Kumar%2C_Infosys_Limited%29_01.jpg/500px-FIFA_World_Cup_Trophy_%28Ank_Kumar%2C_Infosys_Limited%29_01.jpg'],
    [/continental championship/i, WMC + '/thumb/8/81/Coupe_Henri_Delaunay_2017.jpg/500px-Coupe_Henri_Delaunay_2017.jpg'],
    [/continental cup/i, WMC + '/thumb/9/97/Copa_america_trofeo.jpg/500px-Copa_america_trofeo.jpg'],
    [/champions league/i, WMC + '/c/c5/Trofeo_UEFA_Champions_League.jpg'],
    [/europa league/i, WMC + '/thumb/4/42/Europa_league_trophy.jpg/500px-Europa_league_trophy.jpg'],
    [/libertadores/i, WMC + '/thumb/b/b1/Final_de_la_Copa_CONMEBOL_Libertadores_en_el_Estadio_Centenario_-_20211127dicimouyap0852.jpg/500px-Final_de_la_Copa_CONMEBOL_Libertadores_en_el_Estadio_Centenario_-_20211127dicimouyap0852.jpg'],
    [/concacaf/i, WMC + '/thumb/3/3e/CONCACAF_Champions_Cup_logo.svg/500px-CONCACAF_Champions_Cup_logo.svg.png'],
    [/premier league/i, WMC + '/thumb/f/f2/Premier_League_Trophy_at_Manchester%27s_National_Football_Museum_%28Ank_Kumar%29_01.jpg/500px-Premier_League_Trophy_at_Manchester%27s_National_Football_Museum_%28Ank_Kumar%29_01.jpg'],
    [/la liga/i, WMC + '/thumb/d/d3/Trofeo_de_La_Liga_9900.jpg/500px-Trofeo_de_La_Liga_9900.jpg'],
    [/serie a/i, WMC + '/thumb/8/8e/Juventus_FC_-_Serie_A_champions_2016-17_%28edited%29.jpg/500px-Juventus_FC_-_Serie_A_champions_2016-17_%28edited%29.jpg'],
    [/bundesliga/i, WMC + '/thumb/f/f9/Trophy_of_Fu%C3%9Fball-Bundesliga_in_Singapore%2C_2023.jpg/500px-Trophy_of_Fu%C3%9Fball-Bundesliga_in_Singapore%2C_2023.jpg'],
    [/fa cup/i, WMC + '/thumb/3/3f/The_FA_Cup_Trophy.jpg/500px-The_FA_Cup_Trophy.jpg'],
    [/copa del rey/i, WMC + '/thumb/a/a4/Copa_del_Rey_Trophy.png/500px-Copa_del_Rey_Trophy.png'],
    [/coppa italia/i, WMC + '/thumb/2/23/The_Coppa_Italia_trophy.jpg/500px-The_Coppa_Italia_trophy.jpg'],
    [/dfb-pokal/i, WMC + '/d/d8/DFB_Pokal_Trophy.png'],
    [/coupe de france/i, WMC + '/thumb/1/1f/Coupe_de_France_trophy.png/500px-Coupe_de_France_trophy.png'],
    [/knvb/i, WMC + '/thumb/d/d7/KNVB_Beker.svg/500px-KNVB_Beker.svg.png'],
    [/taça de portugal|taca de portugal/i, WMC + '/7/70/Ta%C3%A7a_de_Portugal_Trophy.png'],
    [/world player|ballon/i, WMC + '/thumb/0/04/2016_Ballon_dOr_CR7Museum.jpg/500px-2016_Ballon_dOr_CR7Museum.jpg'],
    [/golden boot|golden shoe/i, 'https://upload.wikimedia.org/wikipedia/en/2/2b/Golden_Shoe%2C_Lionel_Messi_2012-2013.jpg']
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

    svg(art, cls) {
      const body = ART[art] || ART.medal;
      return `<svg class="trophy-art ${cls || ''}" viewBox="0 0 48 64" aria-hidden="true">
        <defs>${GOLD}</defs>${body}</svg>`;
    },

    // the real photograph of this competition's trophy, when we have one
    photo(name) {
      const n = String(name);
      for (const [re, url] of PHOTOS) if (re.test(n)) return url;
      return null;
    },

    /* The drawn trophy with the real photograph layered on top when known;
       the photo removes itself on error and the drawing remains. */
    figure(name, cls) {
      const drawn = Trophies.svg(classify(name).art, cls);
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

  global.Trophies = Trophies;
})(window);

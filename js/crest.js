/* ==========================================================================
   crest.js — every club gets its own badge, drawn rather than borrowed.

   Each club is rendered as a shield in its real colours and shirt pattern
   with its initials on it. Pure inline SVG: no images, no requests, scales
   to any size.

   When the club's real badge is known (js/badges.js, hot-linked from
   Wikipedia), it is layered on top of the shield: online you see the real
   thing, offline or on a failed request the drawn shield shows through.
   ========================================================================== */
(function (global) {
  'use strict';

  const SHIELD = 'M2 2 h28 v17 c0 7-8 11-14 13 C10 30 2 26 2 19 Z';

  // A club with no kit on file still gets a stable identity from its name.
  function fallbackKit(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    const hues = [4, 28, 48, 96, 140, 172, 200, 224, 264, 300, 330];
    const hue = hues[h % hues.length];
    return ['hsl(' + hue + ',62%,45%)', 'hsl(' + ((hue + 40) % 360) + ',55%,88%)', 'plain'];
  }

  // "Manchester United" -> MU, "Ajax" -> AJA, "Inter" -> INT
  function initials(name) {
    const words = String(name).replace(/[^A-Za-zÀ-ÿ ]/g, '').split(/\s+/).filter(Boolean);
    const skip = { de: 1, do: 1, of: 1, the: 1, fc: 1, cf: 1, sc: 1, ac: 1 };
    const useful = words.filter(w => !skip[w.toLowerCase()]);
    if (useful.length >= 2) return (useful[0][0] + useful[1][0]).toUpperCase();
    const w = useful[0] || words[0] || '?';
    return w.slice(0, 3).toUpperCase();
  }

  function readable(hex) {
    const c = String(hex).replace('#', '');
    if (c.length < 6) return '#0b1220';
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    // relative luminance, good enough to pick black or white text
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#10192b' : '#ffffff';
  }

  function pattern(kind, a, bCol) {
    switch (kind) {
      case 'stripes':
        return `<rect width="32" height="32" fill="${a}"/>`
          + [6, 14, 22].map(x => `<rect x="${x}" y="0" width="4.5" height="32" fill="${bCol}"/>`).join('');
      case 'hoops':
        return `<rect width="32" height="32" fill="${a}"/>`
          + [5, 13, 21].map(y => `<rect x="0" y="${y}" width="32" height="4.5" fill="${bCol}"/>`).join('');
      case 'halves':
        return `<rect width="16" height="32" fill="${a}"/><rect x="16" width="16" height="32" fill="${bCol}"/>`;
      case 'quarters':
        return `<rect width="32" height="32" fill="${a}"/>`
          + `<rect x="16" width="16" height="16" fill="${bCol}"/><rect y="16" width="16" height="16" fill="${bCol}"/>`;
      case 'sash':
        return `<rect width="32" height="32" fill="${a}"/>`
          + `<path d="M-4 26 L26 -4 L34 4 L4 34 Z" fill="${bCol}"/>`;
      case 'sleeve':
        return `<rect width="32" height="32" fill="${a}"/>`
          + `<rect x="0" y="0" width="5" height="32" fill="${bCol}"/><rect x="27" y="0" width="5" height="32" fill="${bCol}"/>`;
      default:
        return `<rect width="32" height="32" fill="${a}"/>`;
    }
  }

  let seq = 0;

  const Crest = {
    kitFor(clubName) {
      const D = global.DATA;
      return (D && D.CLUB_KIT && D.CLUB_KIT[clubName]) || fallbackKit(clubName || '?');
    },

    /* Markup for one club badge. `cls` sizes it via CSS (.crest-sm/-md/-lg).
       The real badge image (when known) floats over the drawn shield; if it
       fails to load it removes itself and the shield remains. */
    svg(clubName, cls) {
      const kit = Crest.kitFor(clubName);
      const [a, b, kind] = kit;
      const uid = 'cr' + (++seq);
      const text = initials(clubName);
      // the outline behind the initials guarantees contrast on any pattern
      const ink = readable(a);
      const size = text.length > 2 ? 11 : 13;
      const label = String(clubName).replace(/[<>&"]/g, '') + ' crest';
      const shield = `<svg viewBox="0 0 32 32" role="img" aria-label="${label}">
        <defs><clipPath id="${uid}"><path d="${SHIELD}"/></clipPath></defs>
        <g clip-path="url(#${uid})">${pattern(kind, a, b)}</g>
        <path d="${SHIELD}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.6"/>
        <path d="${SHIELD}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".7"/>
        <text x="16" y="19" text-anchor="middle" font-size="${size}" font-weight="800"
          font-family="Inter,Helvetica,Arial,sans-serif" fill="${ink}"
          stroke="rgba(0,0,0,.35)" stroke-width=".4" paint-order="stroke">${text}</text>
      </svg>`;
      const badge = (global.BADGES || {})[clubName];
      if (!badge) return shield.replace('<svg ', '<svg class="crest ' + (cls || '') + '" ');
      return `<span class="crest ${cls || ''} crest-badge">${shield}` +
        `<img src="${badge}" alt="" loading="lazy" onerror="this.remove()"/></span>`;
    },

    // the colour to tint a panel with for this club
    accent(clubName) { return Crest.kitFor(clubName)[0]; },
    accent2(clubName) { return Crest.kitFor(clubName)[1]; },

    /* Real trophy photographs, hot-linked from Wikimedia Commons (the same
       pattern as the club badges: layer the photo over a drawn icon, drop it
       on error). Matched by competition name — anything unmapped falls back
       to the drawn trophy. */
    trophyUrl(name) {
      for (const [re, url] of TROPHY_IMGS) if (re.test(name)) return url;
      return null;
    },

    /* A trophy photo on a light card, or the drawn icon when unmapped/offline.
       fallbackIcon picks the icon ('trophy' for cups, 'medal' for awards). */
    trophy(name, cls, fallbackIcon) {
      const url = Crest.trophyUrl(name);
      const fb = global.Icons.svg(fallbackIcon || 'trophy');
      if (!url) return `<span class="trophy-ph ${cls || ''}">${fb}</span>`;
      return `<span class="trophy-ph ${cls || ''}">${fb}` +
        `<img src="${url}" alt="" loading="lazy" onerror="this.remove()"/></span>`;
    }
  };

  const W = 'https://upload.wikimedia.org/wikipedia/commons';
  const TROPHY_IMGS = [
    [/world cup/i, W + '/thumb/1/15/FIFA_World_Cup_Trophy_%28Ank_Kumar%2C_Infosys_Limited%29_01.jpg/400px-FIFA_World_Cup_Trophy_%28Ank_Kumar%2C_Infosys_Limited%29_01.jpg'],
    [/champions league/i, W + '/c/c5/Trofeo_UEFA_Champions_League.jpg'],
    [/europa league/i, W + '/thumb/4/42/Europa_league_trophy.jpg/400px-Europa_league_trophy.jpg'],
    [/libertadores/i, W + '/thumb/b/b1/Final_de_la_Copa_CONMEBOL_Libertadores_en_el_Estadio_Centenario_-_20211127dicimouyap0852.jpg/400px-Final_de_la_Copa_CONMEBOL_Libertadores_en_el_Estadio_Centenario_-_20211127dicimouyap0852.jpg'],
    [/concacaf/i, W + '/thumb/3/3e/CONCACAF_Champions_Cup_logo.svg/400px-CONCACAF_Champions_Cup_logo.svg.png'],
    [/continental championship/i, W + '/thumb/8/81/Coupe_Henri_Delaunay_2017.jpg/400px-Coupe_Henri_Delaunay_2017.jpg'],
    [/continental cup/i, W + '/thumb/9/97/Copa_america_trofeo.jpg/400px-Copa_america_trofeo.jpg'],
    [/premier league/i, W + '/thumb/f/f2/Premier_League_Trophy_at_Manchester%27s_National_Football_Museum_%28Ank_Kumar%29_01.jpg/400px-Premier_League_Trophy_at_Manchester%27s_National_Football_Museum_%28Ank_Kumar%29_01.jpg'],
    [/la liga/i, W + '/thumb/d/d3/Trofeo_de_La_Liga_9900.jpg/400px-Trofeo_de_La_Liga_9900.jpg'],
    [/serie a/i, W + '/thumb/8/8e/Juventus_FC_-_Serie_A_champions_2016-17_%28edited%29.jpg/400px-Juventus_FC_-_Serie_A_champions_2016-17_%28edited%29.jpg'],
    [/bundesliga/i, W + '/thumb/f/f9/Trophy_of_Fu%C3%9Fball-Bundesliga_in_Singapore%2C_2023.jpg/400px-Trophy_of_Fu%C3%9Fball-Bundesliga_in_Singapore%2C_2023.jpg'],
    [/fa cup/i, W + '/thumb/3/3f/The_FA_Cup_Trophy.jpg/400px-The_FA_Cup_Trophy.jpg'],
    [/copa del rey/i, W + '/thumb/a/a4/Copa_del_Rey_Trophy.png/400px-Copa_del_Rey_Trophy.png'],
    [/coppa italia/i, W + '/thumb/2/23/The_Coppa_Italia_trophy.jpg/400px-The_Coppa_Italia_trophy.jpg'],
    [/dfb-pokal/i, W + '/d/d8/DFB_Pokal_Trophy.png'],
    [/coupe de france/i, W + '/thumb/1/1f/Coupe_de_France_trophy.png/400px-Coupe_de_France_trophy.png'],
    [/knvb/i, W + '/thumb/d/d7/KNVB_Beker.svg/400px-KNVB_Beker.svg.png'],
    [/world player|ballon/i, W + '/thumb/0/04/2016_Ballon_dOr_CR7Museum.jpg/400px-2016_Ballon_dOr_CR7Museum.jpg'],
    [/golden boot|golden shoe/i, 'https://upload.wikimedia.org/wikipedia/en/2/2b/Golden_Shoe%2C_Lionel_Messi_2012-2013.jpg']
  ];

  global.Crest = Crest;
})(window);

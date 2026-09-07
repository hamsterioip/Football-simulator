/* ==========================================================================
   crest.js — every club's real badge.

   Each of the 194 clubs the game can name has its own badge embedded in
   js/badge-imgs.js as a data URI: trimmed, centred and sized to one height.
   Nothing is fetched at runtime, so a badge cannot fail to load, arrive late,
   or go stale behind a dead hotlink — which is why there is no drawn shield
   underneath any more. tools/build-badge-imgs.py builds the set and build.js
   refuses to ship a club without one.

   The club's kit colours are still here: they tint panels and headers around
   the badge (Crest.accent / accent2).
   ========================================================================== */
(function (global) {
  'use strict';

  // A club with no kit on file still gets a stable identity from its name.
  function fallbackKit(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
    const hues = [4, 28, 48, 96, 140, 172, 200, 224, 264, 300, 330];
    const hue = hues[h % hues.length];
    return ['hsl(' + hue + ',62%,45%)', 'hsl(' + ((hue + 40) % 360) + ',55%,88%)', 'plain'];
  }

  /* ---------------- a shield for a club we have no badge for ---------------- */
  const SHIELD = 'M2 2 h28 v17 c0 7-8 11-14 13 C10 30 2 26 2 19 Z';
  let seq = 0;

  // "Riverside Rovers" -> RR, "Ajax" -> AJA
  function initials(name) {
    const words = String(name).replace(/[^A-Za-z\u00C0-\u00FF ]/g, '').split(/\s+/).filter(Boolean);
    const skip = { de: 1, do: 1, of: 1, the: 1, fc: 1, cf: 1, sc: 1, ac: 1, united: 0 };
    const useful = words.filter(w => !skip[w.toLowerCase()]);
    if (useful.length >= 2) return (useful[0][0] + useful[1][0]).toUpperCase();
    const w = useful[0] || words[0] || '?';
    return w.slice(0, 3).toUpperCase();
  }
  function readable(hex) {
    const c = String(hex).replace('#', '');
    if (c.length < 6) return '#0b1220';
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#10192b' : '#ffffff';
  }
  function drawn(clubName, cls) {
    const kit = Crest.kitFor(clubName);
    const a = kit[0], b = kit[1];
    const uid = 'cr' + (++seq);
    const text = initials(clubName);
    const ink = readable(a);
    const label = String(clubName == null ? '' : clubName).replace(/[<>&"]/g, '') + ' crest';
    return `<svg class="crest ${cls || ''}" viewBox="0 0 32 32" role="img" aria-label="${label}">
      <defs><clipPath id="${uid}"><path d="${SHIELD}"/></clipPath></defs>
      <g clip-path="url(#${uid})"><rect width="32" height="32" fill="${a}"/>
        <rect x="0" y="0" width="5" height="32" fill="${b}"/>
        <rect x="27" y="0" width="5" height="32" fill="${b}"/></g>
      <path d="${SHIELD}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1.6"/>
      <path d="${SHIELD}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".7"/>
      <text x="16" y="19" text-anchor="middle" font-size="${text.length > 2 ? 11 : 13}"
        font-weight="800" font-family="Inter,Helvetica,Arial,sans-serif" fill="${ink}"
        stroke="rgba(0,0,0,.35)" stroke-width=".4" paint-order="stroke">${text}</text>
    </svg>`;
  }

  const Crest = {
    kitFor(clubName) {
      const D = global.DATA;
      return (D && D.CLUB_KIT && D.CLUB_KIT[clubName]) || fallbackKit(clubName || '?');
    },

    /* Markup for one club badge. `cls` sizes it via CSS (.crest-sm/-md/-lg). */
    svg(clubName, cls) {
      const badge = (global.BADGE_IMGS || {})[clubName];
      const label = String(clubName == null ? '' : clubName).replace(/[<>&"]/g, '');
      if (!badge) {
        /* No club shipped with the game reaches this — the build fails if one
           has no badge. A club *you* invent does, so it gets a drawn shield in
           its own colours with its initials on it, the way every club here
           looked before the real badges arrived. */
        return drawn(clubName, cls);
      }
      // no loading="lazy": a data URI has nothing to fetch, and deferring it
      // only stops the browser decoding a badge that is about to be on screen
      return `<img class="crest ${cls || ''}" src="${badge}" alt="${label} crest" decoding="async">`;
    },

    // the colour to tint a panel with for this club
    accent(clubName) { return Crest.kitFor(clubName)[0]; },
    accent2(clubName) { return Crest.kitFor(clubName)[1]; }
  };

  global.Crest = Crest;
})(window);

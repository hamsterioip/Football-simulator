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
    accent2(clubName) { return Crest.kitFor(clubName)[1]; }
  };

  global.Crest = Crest;
})(window);

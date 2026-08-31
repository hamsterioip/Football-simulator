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
        // Nothing in the game reaches this: the build fails if a club has no
        // badge. It is here so an unknown name leaves a gap of the right size
        // rather than collapsing the row it sits in.
        return `<span class="crest ${cls || ''}" role="img" aria-label="${label}"></span>`;
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

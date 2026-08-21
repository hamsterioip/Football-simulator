/* ==========================================================================
   pitch.js — the goalmouth: a drawn goal you aim at, and the kick you watch.

   Used for penalty shootouts, in-match penalties, and for goalkeepers picking
   a dive. Pure inline SVG animated with the Web Animations API — no images,
   no libraries. Honours prefers-reduced-motion by jumping to the outcome.
   ========================================================================== */
(function (global) {
  'use strict';

  const W = 300, H = 190;
  const GOAL = { x: 34, y: 26, w: 232, h: 104 };   // inside of the posts
  const SPOT = { x: W / 2, y: 172 };

  /* The six places you can put a penalty, as a 3x2 grid across the goal.
     Each maps to one of the options the scenario already offers. */
  const ZONES = {
    TL: { col: 0, row: 0, label: 'Top left' },
    TC: { col: 1, row: 0, label: 'Panenka' },
    TR: { col: 2, row: 0, label: 'Top right' },
    BL: { col: 0, row: 1, label: 'Bottom left' },
    BC: { col: 1, row: 1, label: 'Straight down the middle' },
    BR: { col: 2, row: 1, label: 'Bottom right' }
  };
  // label used by the scenario -> zone key
  const LABEL_ZONE = {
    'Top left': 'TL', 'Top right': 'TR', 'Panenka': 'TC',
    'Bottom left': 'BL', 'Bottom right': 'BR', 'Straight down the middle': 'BC'
  };

  function zoneRect(key) {
    const z = ZONES[key];
    const cw = GOAL.w / 3, ch = GOAL.h / 2;
    return { x: GOAL.x + z.col * cw, y: GOAL.y + z.row * ch, w: cw, h: ch,
             cx: GOAL.x + z.col * cw + cw / 2, cy: GOAL.y + z.row * ch + ch / 2 };
  }

  function reduced() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  const netLines = (() => {
    let out = '';
    for (let x = GOAL.x; x <= GOAL.x + GOAL.w; x += 11)
      out += `<line x1="${x}" y1="${GOAL.y}" x2="${x}" y2="${GOAL.y + GOAL.h}"/>`;
    for (let y = GOAL.y; y <= GOAL.y + GOAL.h; y += 11)
      out += `<line x1="${GOAL.x}" y1="${y}" x2="${GOAL.x + GOAL.w}" y2="${y}"/>`;
    return out;
  })();

  const Pitch = {
    ZONES, LABEL_ZONE,
    zoneFor(label) { return LABEL_ZONE[label] || 'BC'; },

    /* The goal, the keeper, the ball and (optionally) six tappable targets. */
    view(opts) {
      opts = opts || {};
      const targets = opts.aim === false ? '' : Object.keys(ZONES).map(k => {
        const r = zoneRect(k);
        return `<g class="pz" data-zone="${k}" role="button" tabindex="0" aria-label="${ZONES[k].label}">
          <rect x="${r.x + 1.5}" y="${r.y + 1.5}" width="${r.w - 3}" height="${r.h - 3}" rx="5"/>
          <circle class="pz-dot" cx="${r.cx}" cy="${r.cy}" r="3.5"/>
        </g>`;
      }).join('');

      return `<svg class="goal-view" viewBox="0 0 ${W} ${H}" role="img" aria-label="Penalty goalmouth">
        <defs>
          <linearGradient id="pg-grass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#126b3f"/><stop offset="1" stop-color="#0a4a2c"/>
          </linearGradient>
        </defs>
        <rect class="pg-sky" x="0" y="0" width="${W}" height="${GOAL.y + GOAL.h}" />
        <rect x="0" y="${GOAL.y + GOAL.h - 6}" width="${W}" height="${H - GOAL.y - GOAL.h + 6}" fill="url(#pg-grass)"/>
        <path class="pg-box" d="M18 ${H - 26} L18 ${GOAL.y + GOAL.h + 4} L${W - 18} ${GOAL.y + GOAL.h + 4} L${W - 18} ${H - 26}"/>
        <g class="pg-net">${netLines}</g>
        <g class="pg-frame">
          <rect x="${GOAL.x - 6}" y="${GOAL.y - 6}" width="6" height="${GOAL.h + 6}"/>
          <rect x="${GOAL.x + GOAL.w}" y="${GOAL.y - 6}" width="6" height="${GOAL.h + 6}"/>
          <rect x="${GOAL.x - 6}" y="${GOAL.y - 6}" width="${GOAL.w + 12}" height="6"/>
        </g>
        <g class="pg-keeper">
          <g class="pg-keeper-body">
            <circle cx="0" cy="-26" r="7.5" class="pg-head"/>
            <rect x="-9" y="-19" width="18" height="26" rx="6" class="pg-kit"/>
            <rect class="pg-arm pg-arm-l" x="-23" y="-18" width="14" height="6" rx="3"/>
            <rect class="pg-arm pg-arm-r" x="9" y="-18" width="14" height="6" rx="3"/>
            <rect x="-8" y="6" width="6" height="16" rx="3" class="pg-leg"/>
            <rect x="2" y="6" width="6" height="16" rx="3" class="pg-leg"/>
          </g>
        </g>
        <ellipse class="pg-shadow" cx="${SPOT.x}" cy="${SPOT.y + 6}" rx="7" ry="2.5"/>
        <g class="pg-ball">
          <circle r="6.5" class="pg-ball-o"/>
          <path class="pg-ball-p" d="M0 -3.6 L3.4 -1.1 L2.1 2.9 L-2.1 2.9 L-3.4 -1.1 Z"/>
        </g>
        <g class="pg-targets">${targets}</g>
      </svg>`;
    },

    /* Put the keeper on his line and the ball on the spot. */
    reset(root) {
      const keeper = root.querySelector('.pg-keeper');
      const ball = root.querySelector('.pg-ball');
      if (keeper) keeper.setAttribute('transform', `translate(${W / 2} ${GOAL.y + GOAL.h - 22})`);
      if (ball) ball.setAttribute('transform', `translate(${SPOT.x} ${SPOT.y})`);
      if (keeper) keeper.style.transform = '';
      if (ball) ball.style.transform = '';
      const shadow = root.querySelector('.pg-shadow');
      if (shadow) { shadow.style.opacity = ''; shadow.getAnimations().forEach(a => a.cancel()); }
      [keeper, ball].forEach(el => el && el.getAnimations().forEach(a => a.cancel()));
      root.classList.remove('is-goal', 'is-saved', 'is-missed');
      const t = root.querySelector('.pg-targets');
      if (t) t.style.display = '';
    },

    /* Play the kick.
       shot   — zone key the ball is aimed at
       dive   — 'left' | 'right' | 'centre', where the keeper goes
       result — 'goal' | 'saved' | 'missed'
       done   — called once it has finished (or immediately if motion is reduced) */
    kick(root, shot, dive, result, done) {
      const ball = root.querySelector('.pg-ball');
      const keeper = root.querySelector('.pg-keeper');
      const net = root.querySelector('.pg-net');
      const targets = root.querySelector('.pg-targets');
      if (targets) targets.style.display = 'none';
      if (!ball || !keeper) { if (done) done(); return; }

      const r = zoneRect(shot);
      let endX = r.cx, endY = r.cy;
      if (result === 'missed') {                    // wide or over, never on target
        if (shot === 'TC' || shot === 'BC') endY = GOAL.y - 24;
        else endX = r.cx < W / 2 ? GOAL.x - 26 : GOAL.x + GOAL.w + 26;
      }

      const baseX = W / 2, baseY = GOAL.y + GOAL.h - 22;
      const diveX = dive === 'left' ? -74 : dive === 'right' ? 74 : 0;
      const diveY = dive === 'centre' ? -6 : -14;
      const tilt = dive === 'left' ? -62 : dive === 'right' ? 62 : 0;

      if (reduced()) {
        keeper.style.transform = `translate(${baseX + diveX}px, ${baseY + diveY}px) rotate(${tilt}deg)`;
        ball.style.transform = `translate(${endX}px, ${endY}px)`;
        const sh = root.querySelector('.pg-shadow');
        if (sh) sh.style.opacity = '0';
        root.classList.add('is-' + result);
        if (done) done();
        return;
      }

      const chip = shot === 'TC';                 // a Panenka floats in slowly
      const flight = chip ? 900 : 620;

      keeper.animate([
        { transform: `translate(${baseX}px, ${baseY}px) rotate(0deg)` },
        { transform: `translate(${baseX + diveX * 0.35}px, ${baseY + diveY}px) rotate(${tilt * 0.4}deg)`, offset: 0.45 },
        { transform: `translate(${baseX + diveX}px, ${baseY + diveY}px) rotate(${tilt}deg)` }
      ], { duration: 560, delay: chip ? 120 : 90, easing: 'cubic-bezier(.3,.7,.4,1)', fill: 'forwards' });

      const midY = chip ? Math.min(SPOT.y, endY) - 54 : (SPOT.y + endY) / 2 - 16;
      const frames = [
        { transform: `translate(${SPOT.x}px, ${SPOT.y}px) scale(1)`, offset: 0 },
        { transform: `translate(${(SPOT.x + endX) / 2}px, ${midY}px) scale(.86)`, offset: .55 },
        { transform: `translate(${endX}px, ${endY}px) scale(.72)`, offset: 1 }
      ];
      const shadow = root.querySelector('.pg-shadow');
      if (shadow) shadow.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: 280, delay: 160, easing: 'ease-out', fill: 'forwards' });

      const anim = ball.animate(frames, {
        duration: flight, delay: 160,
        easing: chip ? 'cubic-bezier(.2,.6,.5,1)' : 'cubic-bezier(.35,.15,.5,1)',
        fill: 'forwards'
      });

      anim.onfinish = () => {
        root.classList.add('is-' + result);
        if (result === 'goal' && net) {
          net.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.035)' }, { transform: 'scale(1)' }],
            { duration: 420, easing: 'ease-out', transformOrigin: 'center' });
        }
        if (result === 'saved') {
          // punched clear, back out towards the corner it came from
          ball.animate([
            { transform: `translate(${endX}px, ${endY}px) scale(.72)` },
            { transform: `translate(${endX + (endX < W / 2 ? -46 : 46)}px, ${endY + 42}px) scale(.9)` }
          ], { duration: 380, easing: 'ease-out', fill: 'forwards' });
        }
        setTimeout(() => { if (done) done(); }, result === 'saved' ? 380 : 260);
      };
    },

    // wire the six targets up; cb gets the zone key
    onAim(root, cb) {
      root.querySelectorAll('.pz').forEach(g => {
        const fire = e => { e.preventDefault(); cb(g.dataset.zone); };
        g.addEventListener('click', fire);
        g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') fire(e); });
      });
    }
  };

  global.Pitch = Pitch;
})(window);

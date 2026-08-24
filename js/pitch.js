/* ==========================================================================
   pitch.js — the goalmouth: a drawn goal you aim at, and the kick you watch.

   Used for penalty shootouts, in-match penalties, and for goalkeepers picking
   a dive. Pure inline SVG animated with the Web Animations API — no images,
   no libraries.

   The scene is drawn in perspective from behind the ball: a floodlit stand,
   an advertising hoarding, mown stripes converging on a vanishing point, and
   a goal with real depth (a smaller back plane, netting stretched between).
   A boot swings in and strikes, the camera punches, the keeper springs, and
   the net takes the hit.

   Honours prefers-reduced-motion by jumping straight to the outcome.
   ========================================================================== */
(function (global) {
  'use strict';

  const W = 320, H = 210;
  const GOAL = { x: 44, y: 60, w: 232, h: 92 };      // the mouth, front plane
  const BACK = { x: 76, y: 48, w: 168, h: 66 };      // back of the net
  const SPOT = { x: 160, y: 186 };                   // the penalty spot
  const HIP  = { x: 198, y: 252 };                   // the taker's hip, off-frame
  const VP   = { x: 160, y: 30 };                    // vanishing point

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

  /* rotate/scale about a point, written the long way so it behaves the same
     in every browser regardless of transform-box support */
  function about(x, y, rot, scale) {
    return `translate(${x}px, ${y}px) rotate(${rot || 0}deg) scale(${scale == null ? 1 : scale}) translate(${-x}px, ${-y}px)`;
  }
  function place(x, y, rot, scale) {
    return `translate(${x}px, ${y}px) rotate(${rot || 0}deg) scale(${scale == null ? 1 : scale})`;
  }
  /* camera: put scene point (px,py) at the middle of the frame, zoomed s */
  function focus(px, py, s) {
    return `translate(${(160 - px * s).toFixed(1)}px, ${(105 - py * s).toFixed(1)}px) scale(${s})`;
  }

  /* ---------- the crowd, generated once and kept stable ---------- */
  function seeded(seed) {
    let s = seed;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  }
  const CROWD = (() => {
    const rnd = seeded(20260823);
    const tones = ['#1b2b45', '#22364f', '#2c1f3a', '#37414f', '#14202f', '#404a5c', '#d8dee9', '#1f7a4d'];
    let out = '';
    for (let row = 0; row < 10; row++) {
      const y = 4 + row * 3.7;
      const jitter = row % 2 ? 1.6 : 0;
      for (let x = -2; x < W + 4; x += 3.2) {
        const c = tones[Math.floor(rnd() * tones.length)];
        const o = 0.35 + rnd() * 0.55;
        out += `<rect x="${(x + jitter).toFixed(1)}" y="${y.toFixed(1)}" width="2.1" height="2.7" rx="1" fill="${c}" opacity="${o.toFixed(2)}"/>`;
      }
    }
    return out;
  })();

  const FLASHES = (() => {
    const rnd = seeded(77123);
    let out = '';
    for (let i = 0; i < 14; i++) {
      const x = 8 + rnd() * (W - 16), y = 5 + rnd() * 34;
      out += `<circle class="pg-flash" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.5"
        style="animation-delay:${(rnd() * 4).toFixed(2)}s"/>`;
    }
    return out;
  })();

  /* the corner scene's crowd: two close tiers over a walkway, plus its flashes */
  const CROWD2 = (() => {
    const rnd = seeded(91517);
    const tones = ['#1b2b45', '#22364f', '#2c1f3a', '#37414f', '#14202f', '#404a5c', '#d8dee9', '#1f7a4d'];
    let out = '';
    for (let row = 0; row < 10; row++) {
      const tier = row < 4 ? 0 : 1;                    // four rows up top, six below
      const y = (tier ? 56 : 4) + (tier ? row - 4 : row) * 10.6;
      const jitter = row % 2 ? 2.2 : 0;
      for (let x = -4; x < W + 6; x += 4.6) {
        const c = tones[Math.floor(rnd() * tones.length)];
        const o = 0.4 + rnd() * 0.55;
        out += `<rect x="${(x + jitter).toFixed(1)}" y="${y.toFixed(1)}" width="3.4" height="7" rx="1.5" fill="${c}" opacity="${o.toFixed(2)}"/>`;
      }
    }
    return out;
  })();

  const FLASHES2 = (() => {
    const rnd = seeded(41209);
    let out = '';
    for (let i = 0; i < 22; i++) {
      const x = 6 + rnd() * (W - 12), y = 4 + rnd() * 82;
      out += `<circle class="pg-flash" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6"
        style="animation-delay:${(rnd() * 3).toFixed(2)}s"/>`;
    }
    return out;
  })();

  /* side-on mown bands for the corner scene's grass */
  const BANDS = (() => {
    let out = '';
    for (let i = 0; i < 8; i += 2)
      out += `<rect x="0" y="${108 + i * 13}" width="${W}" height="13" fill="rgba(255,255,255,.03)"/>`;
    return out;
  })();

  /* mown stripes: bands that narrow a little towards the horizon */
  const HORIZON = 52;
  const STRIPES = (() => {
    let out = '';
    for (let i = -4; i < 5; i++) {
      if (i % 2) continue;
      const nearL = W / 2 + i * 46, nearR = W / 2 + (i + 1) * 46;
      const farL = VP.x + (nearL - VP.x) * 0.62, farR = VP.x + (nearR - VP.x) * 0.62;
      out += `<path d="M${nearL} ${H} L${nearR} ${H} L${farR.toFixed(1)} ${HORIZON} L${farL.toFixed(1)} ${HORIZON} Z"/>`;
    }
    return out;
  })();

  const Pitch = {
    ZONES, LABEL_ZONE,
    zoneFor(label) { return LABEL_ZONE[label] || 'BC'; },

    /* The whole scene. opts.aim === false hides the six tappable targets. */
    view(opts) {
      opts = opts || {};
      const targets = opts.aim === false ? '' : Object.keys(ZONES).map(k => {
        const r = zoneRect(k);
        return `<g class="pz" data-zone="${k}" role="button" tabindex="0" aria-label="${ZONES[k].label}">
          <rect x="${r.x + 2}" y="${r.y + 2}" width="${r.w - 4}" height="${r.h - 4}" rx="7"/>
          <g class="pz-mark" transform="translate(${r.cx} ${r.cy})">
            <circle class="pz-ring" r="7.5"/>
            <circle class="pz-dot" r="2.6"/>
            <path class="pz-cross" d="M-11 0h5M6 0h5M0 -11v5M0 6v5"/>
          </g>
        </g>`;
      }).join('');

      // netting, drawn as a pattern so the mesh stays crisp at any size
      const defs = `
        <linearGradient id="pg-nightg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#050b12"/><stop offset="1" stop-color="#0a1620"/>
        </linearGradient>
        <linearGradient id="pg-grassg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#03170f"/><stop offset=".28" stop-color="#0a3f28"/>
          <stop offset=".7" stop-color="#12653f"/><stop offset="1" stop-color="#0c4d31"/>
        </linearGradient>
        <linearGradient id="pg-postg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e6edf7"/>
          <stop offset="1" stop-color="#9fb0c6"/>
        </linearGradient>
        <radialGradient id="pg-lamp" cx=".5" cy="0" r="1">
          <stop offset="0" stop-color="rgba(200,255,228,.16)"/>
          <stop offset="1" stop-color="rgba(190,255,220,0)"/>
        </radialGradient>
        <radialGradient id="pg-washg" cx=".5" cy=".52" r=".62">
          <stop offset="0" stop-color="currentColor" stop-opacity=".55"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="pg-bulgeg" cx=".5" cy=".5" r=".5">
          <stop offset="0" stop-color="rgba(255,255,255,.55)"/>
          <stop offset=".65" stop-color="rgba(255,255,255,.16)"/>
          <stop offset="1" stop-color="rgba(255,255,255,0)"/>
        </radialGradient>
        <pattern id="pg-mesh" width="9" height="9" patternUnits="userSpaceOnUse">
          <path d="M9 0V9M0 9H9" stroke="rgba(226,240,255,.30)" stroke-width=".7" fill="none"/>
        </pattern>
        <pattern id="pg-meshd" width="7" height="7" patternUnits="userSpaceOnUse">
          <path d="M7 0V7M0 7H7" stroke="rgba(226,240,255,.16)" stroke-width=".6" fill="none"/>
        </pattern>
        <clipPath id="pg-push">
          <circle class="pg-pushc" cx="0" cy="0" r="30"/>
        </clipPath>
        <clipPath id="pg-mouth">
          <rect x="${GOAL.x}" y="${GOAL.y}" width="${GOAL.w}" height="${GOAL.h}"/>
        </clipPath>`;

      // the four surfaces inside the goal: roof, floor, and two side walls
      const roof = `M${GOAL.x} ${GOAL.y} L${GOAL.x + GOAL.w} ${GOAL.y} L${BACK.x + BACK.w} ${BACK.y} L${BACK.x} ${BACK.y} Z`;
      const floor = `M${GOAL.x} ${GOAL.y + GOAL.h} L${GOAL.x + GOAL.w} ${GOAL.y + GOAL.h} L${BACK.x + BACK.w} ${BACK.y + BACK.h} L${BACK.x} ${BACK.y + BACK.h} Z`;
      const sideL = `M${GOAL.x} ${GOAL.y} L${BACK.x} ${BACK.y} L${BACK.x} ${BACK.y + BACK.h} L${GOAL.x} ${GOAL.y + GOAL.h} Z`;
      const sideR = `M${GOAL.x + GOAL.w} ${GOAL.y} L${BACK.x + BACK.w} ${BACK.y} L${BACK.x + BACK.w} ${BACK.y + BACK.h} L${GOAL.x + GOAL.w} ${GOAL.y + GOAL.h} Z`;

      return `<svg class="goal-view" viewBox="0 0 ${W} ${H}" role="img" aria-label="Penalty goalmouth">
        <defs>${defs}</defs>
        <g class="pg-cam">

          <rect x="0" y="0" width="${W}" height="${H}" fill="url(#pg-nightg)"/>
          <g class="pg-stand">${CROWD}</g>
          <g class="pg-flashes">${FLASHES}</g>
          <path class="pg-lampL" d="M-10 0 L70 0 L150 130 L-30 130 Z" fill="url(#pg-lamp)"/>
          <path class="pg-lampR" d="M${W - 70} 0 L${W + 10} 0 L${W + 30} 130 L${W - 150} 130 Z" fill="url(#pg-lamp)"/>
          <rect class="pg-hoard" x="-4" y="41" width="${W + 8}" height="11" rx="2"/>
          <rect class="pg-hoard-lip" x="-4" y="50" width="${W + 8}" height="2"/>

          <rect x="0" y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#pg-grassg)"/>
          <g class="pg-stripes">${STRIPES}</g>
          <g class="pg-lines">
            <path d="M0 152 H${W}"/>
            <path d="M${GOAL.x + 14} 152 L${GOAL.x - 2} 172 H${GOAL.x + GOAL.w + 2} L${GOAL.x + GOAL.w - 14} 152"/>
          </g>
          <ellipse class="pg-spot" cx="${SPOT.x}" cy="${SPOT.y}" rx="3.4" ry="1.3"/>

          <g class="pg-goalbody">
            <path class="pg-inside" d="${roof}"/>
            <path class="pg-inside" d="${floor}"/>
            <path class="pg-inside pg-inside-dark" d="${sideL}"/>
            <path class="pg-inside pg-inside-dark" d="${sideR}"/>
            <path class="pg-netdepth" d="${roof}"/>
            <path class="pg-netdepth" d="${floor}"/>
            <path class="pg-netdepth" d="${sideL}"/>
            <path class="pg-netdepth" d="${sideR}"/>
            <rect class="pg-netback" x="${BACK.x}" y="${BACK.y}" width="${BACK.w}" height="${BACK.h}"/>
          </g>

          <g class="pg-net">
            <rect x="${GOAL.x}" y="${GOAL.y}" width="${GOAL.w}" height="${GOAL.h}"/>
          </g>
          <g clip-path="url(#pg-mouth)">
            <g clip-path="url(#pg-push)">
              <rect class="pg-netpush" x="${GOAL.x}" y="${GOAL.y}" width="${GOAL.w}" height="${GOAL.h}" opacity="0"/>
            </g>
            <circle class="pg-bulge" r="26" cx="0" cy="0" fill="url(#pg-bulgeg)" opacity="0"/>
          </g>

          <g class="pg-keeper">
            <ellipse class="pg-kshadow" cx="0" cy="1" rx="13" ry="3.2"/>
            <g class="pg-keeper-body">
              <path class="pg-leg" d="M-8 -15 h16 v10 q0 4.5 -3.6 4.5 h-2.8 q-2.6 0 -2.6 -3.2 v-6.6 h-2 v6.6
                q0 3.2 -2.6 3.2 h-2.8 q-3.6 0 -3.6 -4.5 Z"/>
              <path class="pg-kit" d="M-9.5 -34 q9.5 -4.5 19 0 l2.5 20 q-12 4 -24 0 Z"/>
              <path class="pg-kit-trim" d="M-9.5 -34 q9.5 -4.5 19 0 l.6 4.4 q-10 -3.6 -20.2 0 Z"/>
              <text class="pg-num" x="0" y="-19" text-anchor="middle">1</text>
              <g class="pg-arm-l">
                <path class="pg-sleeve" d="M-9 -33.5 l-11 5.5 a3.1 3.1 0 0 0 2.8 5.6 l11 -5.5 Z"/>
                <rect class="pg-glove" x="-25.5" y="-28.5" width="7.5" height="9" rx="3.4" transform="rotate(-24 -21.7 -24)"/>
              </g>
              <g class="pg-arm-r">
                <path class="pg-sleeve" d="M9 -33.5 l11 5.5 a3.1 3.1 0 0 1 -2.8 5.6 l-11 -5.5 Z"/>
                <rect class="pg-glove" x="18" y="-28.5" width="7.5" height="9" rx="3.4" transform="rotate(24 21.7 -24)"/>
              </g>
              <circle class="pg-head" cx="0" cy="-41" r="6.2"/>
              <path class="pg-hair" d="M-6.2 -43.5 a6.2 6.2 0 0 1 12.4 0 q-6.2 -3.4 -12.4 0 Z"/>
            </g>
          </g>

          <g class="pg-frame">
            <rect x="${GOAL.x - 5}" y="${GOAL.y - 5}" width="${GOAL.w + 10}" height="5" rx="2" fill="url(#pg-postg)"/>
            <rect class="pg-post pg-post-l" x="${GOAL.x - 5}" y="${GOAL.y - 5}" width="5" height="${GOAL.h + 5}" rx="2" fill="url(#pg-postg)"/>
            <rect class="pg-post pg-post-r" x="${GOAL.x + GOAL.w}" y="${GOAL.y - 5}" width="5" height="${GOAL.h + 5}" rx="2" fill="url(#pg-postg)"/>
          </g>

          <ellipse class="pg-shadow" cx="0" cy="0" rx="8" ry="2.6"/>
          <g class="pg-trail">
            <circle class="pg-gh pg-gh1" r="7"/><circle class="pg-gh pg-gh2" r="6"/><circle class="pg-gh pg-gh3" r="5"/>
          </g>
          <g class="pg-ball">
            <g class="pg-ball-in">
              <circle class="pg-ball-o" r="8.5"/>
              <path class="pg-ball-p" d="M0 -4.6 L4.4 -1.4 L2.7 3.7 L-2.7 3.7 L-4.4 -1.4 Z"/>
              <path class="pg-ball-s" d="M0 -8.5 v3.9 M-8.1 -2.6 l3.7 1.2 M8.1 -2.6 l-3.7 1.2 M-5 6.9 l2.3 -3.2 M5 6.9 l-2.3 -3.2"/>
            </g>
          </g>

          <!-- the taker's leg, hinged at a hip just off the bottom of the frame -->
          <g class="pg-boot">
            <rect class="pg-thigh" x="${HIP.x - 7}" y="${HIP.y - 46}" width="14" height="48" rx="7"/>
            <rect class="pg-shin"  x="${HIP.x - 5.5}" y="${HIP.y - 74}" width="11" height="32" rx="5.5"/>
            <rect class="pg-sock"  x="${HIP.x - 6}" y="${HIP.y - 64}" width="12" height="11" rx="3.5"/>
            <path class="pg-cleat" d="M${HIP.x - 5.5} ${HIP.y - 78}
              h11 q1.5 0 1.5 1.5 v4 q0 2.5 -3 3.5 l-13 4 q-3 .9 -4 -1.6 l-1 -2.6 q-.8 -2.2 1.6 -3 l6.9 -2.4 Z"/>
          </g>

          <!-- team-mates, for the celebrations that need a crowd -->
          <g class="pg-mates">
            <g class="pg-mate"><ellipse class="pg-m-sh" cy="1" rx="10" ry="2.6"/>
              <path class="pg-m-legs" d="M-7 -13 h14 v9 q0 4 -3.2 4 h-2.4 q-2.2 0 -2.2 -2.8 v-5.6 h-1.9 v5.6 q0 2.8 -2.2 2.8 h-2.4 q-3.2 0 -3.2 -4 Z"/>
              <path class="pg-m-kit" d="M-8.5 -32 q8.5 -4 17 0 l2.2 19 q-10.7 3.8 -21.4 0 Z"/>
              <rect class="pg-m-arm" x="-22" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(-42 -8 -31)"/>
              <rect class="pg-m-arm" x="8" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(42 8 -31)"/>
              <circle class="pg-m-head" cx="0" cy="-37" r="5.6"/></g>
            <g class="pg-mate"><ellipse class="pg-m-sh" cy="1" rx="10" ry="2.6"/>
              <path class="pg-m-legs" d="M-7 -13 h14 v9 q0 4 -3.2 4 h-2.4 q-2.2 0 -2.2 -2.8 v-5.6 h-1.9 v5.6 q0 2.8 -2.2 2.8 h-2.4 q-3.2 0 -3.2 -4 Z"/>
              <path class="pg-m-kit" d="M-8.5 -32 q8.5 -4 17 0 l2.2 19 q-10.7 3.8 -21.4 0 Z"/>
              <rect class="pg-m-arm" x="-22" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(-42 -8 -31)"/>
              <rect class="pg-m-arm" x="8" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(42 8 -31)"/>
              <circle class="pg-m-head" cx="0" cy="-37" r="5.6"/></g>
            <g class="pg-mate"><ellipse class="pg-m-sh" cy="1" rx="10" ry="2.6"/>
              <path class="pg-m-legs" d="M-7 -13 h14 v9 q0 4 -3.2 4 h-2.4 q-2.2 0 -2.2 -2.8 v-5.6 h-1.9 v5.6 q0 2.8 -2.2 2.8 h-2.4 q-3.2 0 -3.2 -4 Z"/>
              <path class="pg-m-kit" d="M-8.5 -32 q8.5 -4 17 0 l2.2 19 q-10.7 3.8 -21.4 0 Z"/>
              <rect class="pg-m-arm" x="-22" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(-42 -8 -31)"/>
              <rect class="pg-m-arm" x="8" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(42 8 -31)"/>
              <circle class="pg-m-head" cx="0" cy="-37" r="5.6"/></g>
          </g>

          <!-- the corner flag, planted where he is heading when he scores -->
          <g class="pg-flag">
            <ellipse class="pg-flag-sh" cx="0" cy="1" rx="4" ry="1.2"/>
            <rect class="pg-flag-pole" x="-1" y="-27" width="2" height="28" rx="1"/>
            <path class="pg-flag-cloth" d="M1 -27 h12 l-2.6 4.5 l2.6 4.5 h-12 Z"/>
            <circle class="pg-flag-top" cx="0" cy="-27.5" r="1.6"/>
          </g>

          <!-- the scorer, for when it goes in -->
          <g class="pg-scorer">
            <ellipse class="pg-sc-shadow" cx="0" cy="2" rx="14" ry="3.4"/>
            <g class="pg-sc-body">
              <path class="pg-sc-legs" d="M-9 -16 h18 v11 q0 5 -4 5 h-3 q-2.8 0 -2.8 -3.4 v-7 h-2.4 v7
                q0 3.4 -2.8 3.4 h-3 q-4 0 -4 -5 Z"/>
              <path class="pg-sc-kit" d="M-10 -38 q10 -5 20 0 l2.6 22 q-12.6 4.4 -25.2 0 Z"/>
              <path class="pg-sc-trim" d="M-10 -38 q10 -5 20 0 l.7 4.8 q-10.7 -3.8 -21.4 0 Z"/>
              <g class="pg-sc-arm-l"><rect x="-26" y="-37.5" width="17" height="6.5" rx="3.2"/></g>
              <g class="pg-sc-arm-r"><rect x="9" y="-37.5" width="17" height="6.5" rx="3.2"/></g>
              <circle class="pg-sc-head" cx="0" cy="-45" r="6.6"/>
              <path class="pg-sc-hair" d="M-6.6 -47.6 a6.6 6.6 0 0 1 13.2 0 q-6.6 -3.6 -13.2 0 Z"/>
              <g class="pg-sc-props">
                <path class="prop-heart" d="M0 -60.5 c-2.6 -3.4 -7.4 -2.2 -7.4 1.8 0 3.4 4.2 6.4 7.4 8.8
                  3.2 -2.4 7.4 -5.4 7.4 -8.8 0 -4 -4.8 -5.2 -7.4 -1.8 Z"/>
                <rect class="prop-hush" x="-1.6" y="-49" width="3.2" height="7" rx="1.6"/>
                <circle class="prop-crest" cx="-3.4" cy="-31" r="3"/>
              </g>
            </g>
          </g>
          <g class="pg-burst">
            <circle class="pg-ring" r="6" fill="none"/>
            <g class="pg-bits">
              <ellipse class="pg-bit" rx="2.4" ry="1.2"/><ellipse class="pg-bit" rx="2" ry="1"/>
              <ellipse class="pg-bit" rx="2.6" ry="1.1"/><ellipse class="pg-bit" rx="1.8" ry="1"/>
              <ellipse class="pg-bit" rx="2.2" ry="1.1"/>
            </g>
          </g>

          <g class="pg-targets">${targets}</g>
          <g class="pg-confetti"></g>
          <rect class="pg-wash" x="0" y="0" width="${W}" height="${H}" fill="url(#pg-washg)" opacity="0"/>
        </g>
      </svg>`;
    },

    /* The corner, close up: two tiers of crowd right on top of the flag,
       hoardings, the corner arc — and nobody else. This is where the
       celebrations happen; there is no goal and no keeper here. */
    cornerView(opts) {
      opts = opts || {};
      const toLeft = opts.side !== 'right';
      const d = toLeft ? 1 : -1;                        // the pitch runs this way from the flag
      const cx = toLeft ? 34 : W - 34;                  // the corner point
      const defs = `
        <linearGradient id="pc-nightg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#04090f"/><stop offset="1" stop-color="#0a141d"/>
        </linearGradient>
        <linearGradient id="pc-grassg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#0d5a37"/><stop offset=".55" stop-color="#0f6b40"/>
          <stop offset="1" stop-color="#0a4529"/>
        </linearGradient>
        <radialGradient id="pc-lamp" cx=".5" cy="0" r="1">
          <stop offset="0" stop-color="rgba(200,255,228,.20)"/>
          <stop offset="1" stop-color="rgba(190,255,220,0)"/>
        </radialGradient>
        <radialGradient id="pc-washg" cx=".5" cy=".52" r=".62">
          <stop offset="0" stop-color="currentColor" stop-opacity=".55"/>
          <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
        </radialGradient>`;

      return `<svg class="goal-view cel-corner" viewBox="0 0 ${W} ${H}" role="img" aria-label="The corner flag">
        <defs>${defs}</defs>
        <g class="pg-cam">

          <rect x="0" y="0" width="${W}" height="${H}" fill="url(#pc-nightg)"/>
          <g class="pg-stand">${CROWD2}</g>
          <rect x="0" y="49.5" width="${W}" height="4" fill="#0a141d"/>
          <rect x="0" y="52.8" width="${W}" height="1" fill="rgba(226,240,255,.14)"/>
          <g class="pg-flashes">${FLASHES2}</g>
          <path d="M-10 0 L70 0 L150 130 L-30 130 Z" fill="url(#pc-lamp)"/>
          <path d="M${W - 70} 0 L${W + 10} 0 L${W + 30} 130 L${W - 150} 130 Z" fill="url(#pc-lamp)"/>
          <rect class="pg-hoard" x="-4" y="96" width="${W + 8}" height="12" rx="2"/>
          <rect class="pg-hoard-lip" x="-4" y="106" width="${W + 8}" height="2"/>

          <rect x="0" y="108" width="${W}" height="${H - 108}" fill="url(#pc-grassg)"/>
          <g>${BANDS}</g>
          <g class="pg-lines">
            <path d="M${cx} 194 H${toLeft ? W + 4 : -4}"/>
            <path d="M${cx} 194 L${cx + d * 7} 110"/>
            <path d="M${cx + d * 26} 194 A26 26 0 0 ${toLeft ? 0 : 1} ${cx + d * 6.6} 168.4"/>
          </g>

          <g class="pg-flag" style="opacity:1" transform="translate(${cx} 194)">
            <ellipse class="pg-flag-sh" cx="0" cy="1" rx="5" ry="1.5"/>
            <rect class="pg-flag-pole" x="-1.1" y="-38" width="2.2" height="39" rx="1.1"/>
            <path class="pg-flag-cloth" d="M1.1 -38 h16 l-3.4 5.6 l3.4 5.6 h-16 Z"/>
            <circle class="pg-flag-top" cx="0" cy="-38.6" r="1.9"/>
          </g>

          <g class="pg-turf" opacity="0">
            <rect class="pg-tbit" x="-2" y="-2" width="4.5" height="2.6" rx="1"/>
            <rect class="pg-tbit" x="-2" y="-2" width="3.6" height="2.2" rx="1"/>
            <rect class="pg-tbit" x="-2" y="-2" width="4" height="2.4" rx="1"/>
            <rect class="pg-tbit" x="-2" y="-2" width="3.2" height="2" rx="1"/>
          </g>

          <g class="pg-mates">
            <g class="pg-mate" opacity="0"><ellipse class="pg-m-sh" cy="1" rx="10" ry="2.6"/>
              <path class="pg-m-legs" d="M-7 -13 h14 v9 q0 4 -3.2 4 h-2.4 q-2.2 0 -2.2 -2.8 v-5.6 h-1.9 v5.6 q0 2.8 -2.2 2.8 h-2.4 q-3.2 0 -3.2 -4 Z"/>
              <path class="pg-m-kit" d="M-8.5 -32 q8.5 -4 17 0 l2.2 19 q-10.7 3.8 -21.4 0 Z"/>
              <rect class="pg-m-arm" x="-22" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(-42 -8 -31)"/>
              <rect class="pg-m-arm" x="8" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(42 8 -31)"/>
              <circle class="pg-m-head" cx="0" cy="-37" r="5.6"/></g>
            <g class="pg-mate" opacity="0"><ellipse class="pg-m-sh" cy="1" rx="10" ry="2.6"/>
              <path class="pg-m-legs" d="M-7 -13 h14 v9 q0 4 -3.2 4 h-2.4 q-2.2 0 -2.2 -2.8 v-5.6 h-1.9 v5.6 q0 2.8 -2.2 2.8 h-2.4 q-3.2 0 -3.2 -4 Z"/>
              <path class="pg-m-kit" d="M-8.5 -32 q8.5 -4 17 0 l2.2 19 q-10.7 3.8 -21.4 0 Z"/>
              <rect class="pg-m-arm" x="-22" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(-42 -8 -31)"/>
              <rect class="pg-m-arm" x="8" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(42 8 -31)"/>
              <circle class="pg-m-head" cx="0" cy="-37" r="5.6"/></g>
            <g class="pg-mate" opacity="0"><ellipse class="pg-m-sh" cy="1" rx="10" ry="2.6"/>
              <path class="pg-m-legs" d="M-7 -13 h14 v9 q0 4 -3.2 4 h-2.4 q-2.2 0 -2.2 -2.8 v-5.6 h-1.9 v5.6 q0 2.8 -2.2 2.8 h-2.4 q-3.2 0 -3.2 -4 Z"/>
              <path class="pg-m-kit" d="M-8.5 -32 q8.5 -4 17 0 l2.2 19 q-10.7 3.8 -21.4 0 Z"/>
              <rect class="pg-m-arm" x="-22" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(-42 -8 -31)"/>
              <rect class="pg-m-arm" x="8" y="-38" width="14" height="5.6" rx="2.8" transform="rotate(42 8 -31)"/>
              <circle class="pg-m-head" cx="0" cy="-37" r="5.6"/></g>
          </g>

          <g class="pg-scorer" opacity="0">
            <ellipse class="pg-sc-shadow" cx="0" cy="2" rx="14" ry="3.4"/>
            <g class="pg-sc-body">
              <path class="pg-sc-legs" d="M-9 -16 h18 v11 q0 5 -4 5 h-3 q-2.8 0 -2.8 -3.4 v-7 h-2.4 v7
                q0 3.4 -2.8 3.4 h-3 q-4 0 -4 -5 Z"/>
              <path class="pg-sc-kit" d="M-10 -38 q10 -5 20 0 l2.6 22 q-12.6 4.4 -25.2 0 Z"/>
              <path class="pg-sc-trim" d="M-10 -38 q10 -5 20 0 l.7 4.8 q-10.7 -3.8 -21.4 0 Z"/>
              <g class="pg-sc-arm-l"><rect x="-26" y="-37.5" width="17" height="6.5" rx="3.2"/></g>
              <g class="pg-sc-arm-r"><rect x="9" y="-37.5" width="17" height="6.5" rx="3.2"/></g>
              <circle class="pg-sc-head" cx="0" cy="-45" r="6.6"/>
              <path class="pg-sc-hair" d="M-6.6 -47.6 a6.6 6.6 0 0 1 13.2 0 q-6.6 -3.6 -13.2 0 Z"/>
              <g class="pg-sc-props">
                <path class="prop-heart" d="M0 -60.5 c-2.6 -3.4 -7.4 -2.2 -7.4 1.8 0 3.4 4.2 6.4 7.4 8.8
                  3.2 -2.4 7.4 -5.4 7.4 -8.8 0 -4 -4.8 -5.2 -7.4 -1.8 Z"/>
                <rect class="prop-hush" x="-1.6" y="-49" width="3.2" height="7" rx="1.6"/>
                <circle class="prop-crest" cx="-3.4" cy="-31" r="3"/>
              </g>
            </g>
          </g>

          <g class="pg-confetti"></g>
          <rect class="pg-wash" x="0" y="0" width="${W}" height="${H}" fill="url(#pc-washg)" opacity="0"/>
        </g>
      </svg>`;
    },

    /* Keeper on his line, ball on the spot, boot cocked, nothing playing. */
    reset(root) {
      if (!root) return;
      const q = s => root.querySelector(s);
      const all = ['.pg-keeper', '.pg-ball', '.pg-boot', '.pg-cam', '.pg-shadow', '.pg-bulge',
                   '.pg-ring', '.pg-wash', '.pg-net', '.pg-stand', '.pg-post-l', '.pg-post-r']
        .map(q).filter(Boolean);
      all.forEach(el => el.getAnimations().forEach(a => a.cancel()));
      root.querySelectorAll('.pg-gh, .pg-bit, .pg-arm-l, .pg-arm-r, .pg-keeper-body, .pg-kshadow, .pg-scorer, .pg-sc-body, .pg-sc-arm-l, .pg-sc-arm-r, .pg-mate')
        .forEach(el => el.getAnimations().forEach(a => a.cancel()));

      const keeper = q('.pg-keeper'), ball = q('.pg-ball'), boot = q('.pg-boot');
      if (keeper) keeper.style.transform = place(W / 2, GOAL.y + GOAL.h - 2);
      const kbody = q('.pg-keeper-body'); if (kbody) kbody.style.transform = '';
      const ksh = q('.pg-kshadow'); if (ksh) { ksh.style.transform = ''; ksh.style.opacity = ''; }
      if (ball) ball.style.transform = place(SPOT.x, SPOT.y, 0, 1);
      if (boot) { boot.style.transform = about(HIP.x, HIP.y, 40); boot.style.opacity = '0'; }
      const sh = q('.pg-shadow');
      if (sh) { sh.style.opacity = '.5'; sh.style.transform = place(SPOT.x, SPOT.y + 7, 0, 1); }
      const bulge = q('.pg-bulge'); if (bulge) bulge.style.opacity = '0';
      const push = q('.pg-netpush'); if (push) { push.style.opacity = '0'; push.style.transform = ''; }
      const bin = q('.pg-ball-in'); if (bin) { bin.style.transform = ''; bin.getAnimations().forEach(a => a.cancel()); }
      const ring = q('.pg-ring'); if (ring) ring.style.opacity = '0';
      const wash = q('.pg-wash'); if (wash) wash.style.opacity = '0';
      root.querySelectorAll('.pg-gh').forEach(g => g.style.opacity = '0');
      root.querySelectorAll('.pg-bit').forEach(g => g.style.opacity = '0');
      const cam = q('.pg-cam'); if (cam) cam.style.transform = '';
      const sc = q('.pg-scorer');
      if (sc) { sc.style.opacity = '0'; sc.style.transform = place(SPOT.x, H + 40); }
      const conf = q('.pg-confetti'); if (conf) { conf.innerHTML = ''; }
      const flag = q('.pg-flag');
      if (flag) { flag.style.opacity = '0'; flag.getAnimations().forEach(a => a.cancel()); }
      const cloth = q('.pg-flag-cloth'); if (cloth) cloth.getAnimations().forEach(a => a.cancel());
      root.querySelectorAll('.pg-mate').forEach(m => { m.style.opacity = '0'; m.style.transform = ''; });
      const props = q('.pg-sc-props'); if (props) props.setAttribute('class', 'pg-sc-props');
      root.classList.remove('is-party');
      root.classList.remove('is-goal', 'is-saved', 'is-missed', 'is-live');
      const t = q('.pg-targets'); if (t) t.style.display = '';

      // he does not stand still while he waits for you
      if (!reduced() && keeper) {
        keeper.animate([
          { transform: place(W / 2 - 5, GOAL.y + GOAL.h - 2) },
          { transform: place(W / 2 + 5, GOAL.y + GOAL.h - 3) },
          { transform: place(W / 2 - 5, GOAL.y + GOAL.h - 2) }
        ], { duration: 2600, iterations: Infinity, easing: 'ease-in-out' });
        const body = q('.pg-keeper-body');
        if (body) body.animate([
          { transform: 'scaleY(1)' }, { transform: 'scaleY(.965)' }, { transform: 'scaleY(1)' }
        ], { duration: 900, iterations: Infinity, easing: 'ease-in-out' });
      }
    },

    /* Play the kick.
       shot   — zone key the ball is aimed at
       dive   — 'left' | 'right' | 'centre', where the keeper goes
       result — 'goal' | 'saved' | 'missed'
       done   — called once it has finished (or immediately if motion is reduced) */
    kick(root, shot, dive, result, done) {
      const q = s => root && root.querySelector(s);
      const ball = q('.pg-ball'), keeper = q('.pg-keeper'), boot = q('.pg-boot');
      const targets = q('.pg-targets');
      if (targets) targets.style.display = 'none';
      if (!ball || !keeper) { if (done) done(); return; }

      const r = zoneRect(shot);
      let endX = r.cx, endY = r.cy;
      if (result === 'missed') {                    // wide or over, never on target
        if (shot === 'TC' || shot === 'BC') endY = GOAL.y - 34;
        else endX = r.cx < W / 2 ? GOAL.x - 30 : GOAL.x + GOAL.w + 30;
      }
      if (result === 'saved') {                     // he gets a hand there, not the net
        endX = endX + (endX < W / 2 ? 5 : -5);
        endY = endY + 3;
      }

      const line = GOAL.y + GOAL.h - 2;
      const diveX = dive === 'left' ? -72 : dive === 'right' ? 72 : 0;
      const diveY = dive === 'centre' ? -14 : -22;
      const tilt = dive === 'left' ? -68 : dive === 'right' ? 68 : 0;
      const chip = shot === 'TC';

      if (reduced()) {
        keeper.getAnimations().forEach(a => a.cancel());
        const body = q('.pg-keeper-body');
        if (body) body.getAnimations().forEach(a => a.cancel());
        keeper.style.transform = place(W / 2 + diveX, line + diveY);
        if (body) body.style.transform = `rotate(${tilt}deg)`;
        ball.style.transform = place(endX, endY, 0, .5);
        const sh = q('.pg-shadow'); if (sh) sh.style.opacity = '0';
        if (result === 'goal') { const bl = q('.pg-bulge'); if (bl) { bl.style.transform = place(endX, endY); bl.style.opacity = '.9'; } }
        root.classList.add('is-' + result);
        if (done) done();
        return;
      }

      root.classList.add('is-live');
      keeper.getAnimations().forEach(a => a.cancel());
      const body = q('.pg-keeper-body');
      if (body) body.getAnimations().forEach(a => a.cancel());

      const RUN = 280;                              // boot swings in and connects
      const flight = chip ? 700 : 400;
      const contact = RUN;

      /* --- the strike ------------------------------------------------ */
      if (boot) {
        // the leg reaches the ball at exactly `contact`, then follows through
        const swing = RUN + 190, hit = RUN / swing;
        boot.animate([
          { transform: about(HIP.x, HIP.y, 40), offset: 0 },
          { transform: about(HIP.x, HIP.y, 52), offset: hit * .48 },   // backlift
          { transform: about(HIP.x, HIP.y, -28), offset: hit },        // contact
          { transform: about(HIP.x, HIP.y, -48), offset: 1 }
        ], { duration: swing, easing: 'cubic-bezier(.45,.05,.3,1)', fill: 'forwards' });
        boot.animate([
          { opacity: 0, offset: 0 }, { opacity: 1, offset: .12 },
          { opacity: 1, offset: .74 }, { opacity: 0, offset: 1 }
        ], { duration: RUN + 430, fill: 'forwards' });
      }

      /* --- camera: a small settle, then a punch on contact ------------ */
      const cam = q('.pg-cam');
      if (cam) {
        cam.animate([
          { transform: about(160, 150, 0, 1), offset: 0 },
          { transform: about(160, 150, 0, 1.012), offset: .55 },
          { transform: about(160, 150, 0, 1.055), offset: .62 },
          { transform: `${about(160, 150, 0, 1.03)} translate(2px,-1px)`, offset: .68 },
          { transform: `${about(160, 150, 0, 1.02)} translate(-2px,1px)`, offset: .74 },
          { transform: about(160, 150, 0, 1.008), offset: 1 }
        ], { duration: contact + flight, easing: 'ease-out', fill: 'forwards' });
      }

      /* --- the keeper goes, a beat after the ball is struck ----------- */
      const dopts = { duration: 520, delay: contact - 40, easing: 'cubic-bezier(.24,.72,.3,1)', fill: 'forwards' };
      keeper.animate([
        { transform: place(W / 2, line), offset: 0 },
        { transform: place(W / 2, line + 3), offset: .18 },                       // load
        { transform: place(W / 2 + diveX * .42, line + diveY * .55), offset: .55 },
        { transform: place(W / 2 + diveX, line + diveY), offset: .88 },
        { transform: place(W / 2 + diveX * 1.03, line + diveY + 3), offset: 1 }
      ], dopts);
      if (body) body.animate([
        { transform: 'rotate(0deg) scaleY(1)' },
        { transform: 'rotate(0deg) scaleY(.94)', offset: .18 },                   // crouch
        { transform: `rotate(${tilt * .35}deg) scaleY(1.04)`, offset: .55 },
        { transform: `rotate(${tilt}deg) scaleY(1)`, offset: .88 },
        { transform: `rotate(${tilt}deg) scaleY(1)` }
      ], dopts);
      const kshadow = q('.pg-kshadow');
      if (kshadow) kshadow.animate([
        { transform: 'scale(1)', opacity: .45 },
        { transform: `translate(${diveX * .5}px, 2px) scale(1.25, .8)`, opacity: .3, offset: .55 },
        { transform: `translate(${diveX}px, 4px) scale(1.6, .6)`, opacity: .22 }
      ], dopts);

      // arms lead the dive
      const lead = dive === 'left' ? '.pg-arm-l' : dive === 'right' ? '.pg-arm-r' : null;
      if (lead) {
        const arm = q(lead);
        if (arm) arm.animate([
          { transform: 'rotate(0deg)' },
          { transform: `rotate(${dive === 'left' ? -26 : 26}deg)` }
        ], { duration: 380, delay: contact - 20, easing: 'ease-out', fill: 'forwards' });
      } else {
        ['.pg-arm-l', '.pg-arm-r'].forEach((s, i) => {
          const arm = q(s);
          if (arm) arm.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${i ? -34 : 34}deg)` }],
            { duration: 300, delay: contact - 20, easing: 'ease-out', fill: 'forwards' });
        });
      }

      /* --- the flight ------------------------------------------------ */
      const midX = SPOT.x + (endX - SPOT.x) * .5;
      const midY = chip ? Math.min(SPOT.y, endY) - 46 : SPOT.y + (endY - SPOT.y) * .5 - 12;
      const spin = chip ? 260 : 760;
      const frames = [
        { transform: place(SPOT.x, SPOT.y, 0, 1), offset: 0 },
        { transform: place(midX, midY, spin * .45, .74), offset: .5 },
        { transform: place(endX, endY, spin, .48), offset: 1 }
      ];
      const anim = ball.animate(frames, {
        duration: flight, delay: contact,
        easing: chip ? 'cubic-bezier(.25,.5,.45,1)' : 'cubic-bezier(.28,.5,.42,1)',
        fill: 'forwards'
      });

      // the ball's shadow races along the ground and fades as it climbs
      const shadow = q('.pg-shadow');
      if (shadow) {
        shadow.animate([
          { transform: place(SPOT.x, SPOT.y + 7, 0, 1), opacity: .5 },
          { transform: place(midX, 150, 0, .6), opacity: .22, offset: .5 },
          { transform: place(endX, 132, 0, .35), opacity: 0 }
        ], { duration: flight, delay: contact, easing: 'ease-out', fill: 'forwards' });
      }

      // a short motion trail behind it
      ['.pg-gh1', '.pg-gh2', '.pg-gh3'].forEach((sel, i) => {
        const gh = q(sel);
        if (!gh) return;
        gh.animate([
          { transform: place(SPOT.x, SPOT.y, 0, .95), opacity: 0 },
          { transform: place(SPOT.x, SPOT.y, 0, .95), opacity: .3 - i * .07, offset: .08 },
          { transform: place(midX, midY, 0, .7), opacity: .18 - i * .05, offset: .5 },
          { transform: place(endX, endY, 0, .45), opacity: 0 }
        ], { duration: flight, delay: contact + 26 + i * 30, easing: 'cubic-bezier(.28,.5,.42,1)', fill: 'forwards' });
      });

      // struck: the ball flattens against the boot for a frame, then rounds out
      const ballIn = q('.pg-ball-in');
      if (ballIn) ballIn.animate([
        { transform: 'scale(1)' },
        { transform: 'scale(.72, 1.2)', offset: .12 },
        { transform: 'scale(1.14, .9)', offset: .34 },
        { transform: 'scale(1)' }
      ], { duration: 260, delay: contact - 20, easing: 'ease-out' });

      /* --- contact: scuffed grass and a shock ring -------------------- */
      const ring = q('.pg-ring');
      if (ring) {
        ring.style.transform = place(SPOT.x, SPOT.y);
        ring.animate([
          { opacity: .7, transform: place(SPOT.x, SPOT.y, 0, .3) },
          { opacity: 0, transform: place(SPOT.x, SPOT.y, 0, 1.9) }
        ], { duration: 240, delay: contact, easing: 'ease-out', fill: 'forwards' });
      }
      root.querySelectorAll('.pg-bit').forEach((bit, i) => {
        const ang = -160 + i * 26, rad = ang * Math.PI / 180, dist = 16 + i * 4;
        bit.animate([
          { opacity: .8, transform: place(SPOT.x, SPOT.y + 4, 0, 1) },
          { opacity: 0, transform: place(SPOT.x + Math.cos(rad) * dist, SPOT.y + 4 + Math.sin(rad) * dist * .5, ang, .5) }
        ], { duration: 380, delay: contact, easing: 'ease-out', fill: 'forwards' });
      });

      /* --- what happens when it gets there --------------------------- */
      anim.onfinish = () => {
        root.classList.add('is-' + result);
        const wash = q('.pg-wash');
        const net = q('.pg-net');

        if (result === 'goal') {
          // the net takes it: a bulge at the point of impact, then the ball drops
          const bulge = q('.pg-bulge');
          if (bulge) bulge.animate([
            { opacity: 0, transform: place(endX, endY, 0, .3) },
            { opacity: 1, transform: place(endX, endY, 0, 1.15), offset: .35 },
            { opacity: .55, transform: place(endX, endY, 0, .9), offset: .6 },
            { opacity: 0, transform: place(endX, endY, 0, 1) }
          ], { duration: 620, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
          if (ballIn) ballIn.animate([
            { transform: 'scale(1)' },
            { transform: 'scale(1.25, .78)', offset: .18 },
            { transform: 'scale(.92, 1.08)', offset: .45 },
            { transform: 'scale(1)' }
          ], { duration: 340, easing: 'ease-out' });
          const push = q('.pg-netpush'), pushc = q('.pg-pushc');
          if (pushc) pushc.style.transform = `translate(${endX}px, ${endY}px)`;
          if (push) push.animate([
            { opacity: 0, transform: about(endX, endY, 0, 1) },
            { opacity: 1, transform: about(endX, endY, 0, 1.45), offset: .3 },
            { opacity: .7, transform: about(endX, endY, 0, 1.2), offset: .58 },
            { opacity: 0, transform: about(endX, endY, 0, 1) }
          ], { duration: 620, easing: 'cubic-bezier(.2,.9,.3,1)', fill: 'forwards' });
          if (net) net.animate([
            { transform: about(160, 106, 0, 1) },
            { transform: about(160, 106, 0, 1.045), offset: .28 },
            { transform: about(160, 106, 0, .985), offset: .58 },
            { transform: about(160, 106, 0, 1) }
          ], { duration: 620, easing: 'ease-out' });
          ball.animate([
            { transform: place(endX, endY, spin, .48) },
            { transform: place(endX + (endX < W / 2 ? 6 : -6), Math.min(endY + 30, GOAL.y + GOAL.h - 6), spin + 160, .44) }
          ], { duration: 520, easing: 'cubic-bezier(.4,0,.7,1)', fill: 'forwards' });
          if (wash) wash.animate([{ opacity: 0 }, { opacity: .5, offset: .16 }, { opacity: 0 }],
            { duration: 620, easing: 'ease-out' });
          // the stand comes up off its seat
          const stand = q('.pg-stand');
          if (stand) stand.animate([
            { transform: 'translateY(0)' }, { transform: 'translateY(-2.5px)', offset: .3 },
            { transform: 'translateY(0)', offset: .6 }, { transform: 'translateY(-1.5px)', offset: .8 },
            { transform: 'translateY(0)' }
          ], { duration: 900, easing: 'ease-out' });
          if (cam) cam.animate([
            { transform: about(160, 150, 0, 1.008) },
            { transform: about(160, 150, 0, 1.045), offset: .2 },
            { transform: about(160, 150, 0, 1.01) }
          ], { duration: 620, easing: 'ease-out', fill: 'forwards' });

        } else if (result === 'saved') {
          // pushed away, spinning off towards the corner flag
          ball.animate([
            { transform: place(endX, endY, spin, .48) },
            { transform: place(endX + (endX < W / 2 ? -30 : 30), endY - 12, spin + 200, .56), offset: .35 },
            { transform: place(endX + (endX < W / 2 ? -66 : 66), endY + 46, spin + 520, .78) }
          ], { duration: 560, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
          if (shadow) shadow.animate([{ opacity: 0 }, { opacity: .4 }],
            { duration: 400, delay: 160, fill: 'forwards' });
          if (wash) wash.animate([{ opacity: 0 }, { opacity: .42, offset: .18 }, { opacity: 0 }],
            { duration: 520, easing: 'ease-out' });
          if (cam) cam.animate([
            { transform: about(160, 150, 0, 1.008) },
            { transform: `${about(160, 150, 0, 1.03)} translate(-3px,0)`, offset: .12 },
            { transform: `${about(160, 150, 0, 1.02)} translate(3px,0)`, offset: .24 },
            { transform: about(160, 150, 0, 1.01) }
          ], { duration: 460, easing: 'ease-out', fill: 'forwards' });

        } else {
          // missed: it keeps going, out of the picture
          ball.animate([
            { transform: place(endX, endY, spin, .48), opacity: 1 },
            { transform: place(endX + (endX - SPOT.x) * .45, endY - 34, spin + 420, .3), opacity: 0 }
          ], { duration: 520, easing: 'ease-in', fill: 'forwards' });
          if (wash) wash.animate([{ opacity: 0 }, { opacity: .34, offset: .18 }, { opacity: 0 }],
            { duration: 520, easing: 'ease-out' });
          // if it went close to a post, rattle it
          const nearPost = Math.abs(endX - GOAL.x) < 34 ? '.pg-post-l'
            : Math.abs(endX - (GOAL.x + GOAL.w)) < 34 ? '.pg-post-r' : null;
          if (nearPost) {
            const post = q(nearPost);
            if (post) post.animate([
              { transform: 'translateX(0)' }, { transform: 'translateX(1.6px)', offset: .2 },
              { transform: 'translateX(-1.2px)', offset: .45 }, { transform: 'translateX(.6px)', offset: .7 },
              { transform: 'translateX(0)' }
            ], { duration: 420, easing: 'ease-out' });
          }
        }

        setTimeout(() => { if (done) done(); }, result === 'goal' ? 400 : 360);
      };
    },

    /* Everything he might do when it goes in. Each routine returns how long
       it needs; the shared bits — ticker tape, the crowd, the camera — are the
       same whichever one you have picked. */
    CELEBRATIONS: [
      { id: 'slide',   name: 'Knee slide',    icon: 'celebrate', hint: 'Away to the corner and down on the knees. The classic.' },
      { id: 'leap',    name: 'The leap',      icon: 'up',        hint: 'Sprint, jump, spin, land facing the crowd.' },
      { id: 'wings',   name: 'Arms wide',     icon: 'away',      hint: 'Off round the pitch like an aeroplane.' },
      { id: 'shush',   name: 'Shush them',    icon: 'no',        hint: 'Finger to the lips, straight at the home end. Not for the faint-hearted.' },
      { id: 'heart',   name: 'Heart hands',   icon: 'morale',    hint: 'Hands into a heart, held up to somebody who matters.' },
      { id: 'badge',   name: 'Kiss the badge',icon: 'club',      hint: 'Both hands to the crest, then point at the fans.' },
      { id: 'ice',     name: 'Ice cold',      icon: 'fitness',   hint: 'Arms folded. Not a flicker. Let everyone else lose it.' },
      { id: 'mobbed',  name: 'Get mobbed',    icon: 'squad',     hint: 'Stand still and let the whole team bury you.' },
      { id: 'random',  name: 'Whatever comes','icon': 'flair',   hint: 'A different one every time. Never plan a celebration.' }
    ],

    celebrationById(id) {
      return Pitch.CELEBRATIONS.find(c => c.id === id) || Pitch.CELEBRATIONS[0];
    },

    /* He scored. The goal scene is swapped for the corner — two tiers of
       crowd right on top of the flag, no goal, no keeper — and the picked
       routine plays out big. opts.style picks the routine, opts.side the corner. */
    celebrate(root, opts, done) {
      opts = opts || {};
      let style = opts.style || 'slide';
      if (style === 'random') {
        const pool = Pitch.CELEBRATIONS.filter(c => c.id !== 'random');
        style = pool[Math.floor(Math.random() * pool.length)].id;
      }
      const toLeft = opts.side !== 'right';
      const d = toLeft ? 1 : -1;                          // the pitch lies this way from the flag
      const wrap = root && root.parentNode;
      if (wrap) {
        wrap.innerHTML = Pitch.cornerView({ side: opts.side });
        root = wrap.querySelector('.goal-view');
      }
      const q = s => root && root.querySelector(s);
      const sc = q('.pg-scorer'), body = q('.pg-sc-body'), conf = q('.pg-confetti');
      if (!sc) { if (done) done(); return; }

      const cx = toLeft ? 34 : W - 34;                    // the flag's feet
      const at = { x: cx + d * 30, y: 192 };              // where he pulls up
      const look = { x: at.x + d * 6, y: 150 };           // the point the camera centres on
      const S = 1.3;                                      // his size in this scene
      const armL = q('.pg-sc-arm-l'), armR = q('.pg-sc-arm-r');
      const shadow = q('.pg-sc-shadow');
      const props = q('.pg-sc-props');
      const flag = q('.pg-flag');
      const cam = q('.pg-cam');

      if (reduced()) {
        sc.style.opacity = '1';
        sc.style.transform = place(at.x, at.y, 0, S);
        if (cam) cam.style.transform = focus(look.x, look.y, 1.14);
        if (done) done();
        return;
      }

      if (props) props.setAttribute('class', 'pg-sc-props prop-' + style);
      sc.style.opacity = '1';
      root.classList.add('is-party');

      // the scene lands with a camera-flash wash
      const wash = q('.pg-wash');
      if (wash) wash.animate([{ opacity: .55 }, { opacity: 0 }],
        { duration: 420, easing: 'ease-out', fill: 'forwards' });

      /* ---- ticker tape and the noise, whichever routine it is ---- */
      if (conf) {
        const bits = [];
        for (let i = 0; i < 44; i++) {
          const x = -6 + Math.random() * (W + 12);
          const y = -6 - Math.random() * 46;
          const c = ['#2ae67e', '#ffffff', '#ffc94d', '#5aa8ff', '#ff7a92'][i % 5];
          bits.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(3 + Math.random() * 2.5).toFixed(1)}"
            height="${(6 + Math.random() * 5).toFixed(1)}" rx="1.2" fill="${c}" opacity=".95"/>`);
        }
        conf.innerHTML = bits.join('');
        Array.prototype.forEach.call(conf.children, bit => {
          const drift = (Math.random() - .5) * 50;
          bit.animate([
            { transform: 'translate(0,0) rotate(0deg)', opacity: .95 },
            { transform: `translate(${drift * .5}px, ${(H + 80) * .5}px) rotate(${180 + Math.random() * 180}deg)`, offset: .55 },
            { transform: `translate(${drift}px, ${H + 90}px) rotate(${360 + Math.random() * 360}deg)`, opacity: .6 }
          ], { duration: 1600 + Math.random() * 900, delay: Math.random() * 260, easing: 'cubic-bezier(.35,.15,.7,1)', fill: 'forwards' });
        });
      }

      const stand = q('.pg-stand');
      if (stand) stand.animate([
        { transform: 'translateY(0)' }, { transform: 'translateY(-3px)', offset: .2 },
        { transform: 'translateY(0)', offset: .42 }, { transform: 'translateY(-2px)', offset: .62 },
        { transform: 'translateY(0)', offset: .8 }, { transform: 'translateY(-1px)', offset: .9 },
        { transform: 'translateY(0)' }
      ], { duration: 1600, easing: 'ease-out' });

      const cloth = q('.pg-flag-cloth');
      if (cloth) cloth.animate([
        { transform: 'rotate(0deg)' }, { transform: 'rotate(7deg)' },
        { transform: 'rotate(-4deg)' }, { transform: 'rotate(0deg)' }
      ], { duration: 640, iterations: Infinity, easing: 'ease-in-out' });

      const flagWobble = delay => {
        if (flag) flag.animate([
          { transform: place(cx, 194, 0) },
          { transform: place(cx, 194, -d * 12), offset: .28 },
          { transform: place(cx, 194, d * 7), offset: .55 },
          { transform: place(cx, 194, -d * 3), offset: .78 },
          { transform: place(cx, 194, 0) }
        ], { duration: 700, delay, easing: 'ease-out', fill: 'forwards' });
      };

      const turf = q('.pg-turf');
      const turfOut = delay => {
        if (!turf) return;
        turf.style.opacity = '1';
        Array.prototype.forEach.call(turf.children, (b, i) => {
          b.animate([
            { transform: place(cx + d * 4, 194, 0, 1), opacity: 1 },
            { transform: place(cx - d * (10 + i * 8), 184 - (i % 2) * 7, -d * 50, 1), offset: .5 },
            { transform: place(cx - d * (20 + i * 11), 199, -d * 110, .9), opacity: 0 }
          ], { duration: 540, delay: delay + i * 34, easing: 'ease-out', fill: 'forwards' });
        });
      };

      const arms = (frames, opt) => {
        if (armL) armL.animate(frames.map(f => ({ transform: `rotate(${f[0]}deg)`, offset: f[2] })), opt);
        if (armR) armR.animate(frames.map(f => ({ transform: `rotate(${f[1]}deg)`, offset: f[2] })), opt);
      };
      const ease = 'cubic-bezier(.25,.7,.35,1)';

      /* ---- phase one: he arrives at a sprint, camera swinging with him ---- */
      const RUN = 780;
      sc.animate([
        { transform: place(at.x + d * 300, 208, 0, S * .8) },
        { transform: place(at.x + d * 140, 199, -d * 4, S * .93), offset: .46 },
        { transform: place(at.x + d * 44, 195, -d * 2, S * 1.02), offset: .82 },
        { transform: place(at.x, at.y, 0, S) }
      ], { duration: RUN, easing: ease, fill: 'forwards' });
      if (body) body.animate([                        // leaning into it
        { transform: 'rotate(0deg)' },
        { transform: `rotate(${-d * 10}deg)`, offset: .35 },
        { transform: `rotate(${-d * 7}deg)`, offset: .8 },
        { transform: 'rotate(0deg)' }
      ], { duration: RUN, easing: ease, fill: 'forwards' });
      arms([[0, 0, 0], [-34, 34, .3], [28, -28, .62], [-14, 14, 1]],
        { duration: RUN, easing: 'ease-in-out', fill: 'forwards' });   // pumping
      if (shadow) shadow.animate([
        { transform: 'scale(.8,1)', opacity: .36 },
        { transform: 'scale(1.1,1)', opacity: .34 }
      ], { duration: RUN, fill: 'forwards' });
      if (cam) cam.animate([
        { transform: focus(at.x + d * 110, 150, .95) },
        { transform: focus(look.x, look.y, 1.12) }
      ], { duration: RUN + 140, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'forwards' });

      /* ---- phase two: the routine, big at the flag ---- */
      let dur = RUN + 800, camTo = 1.22;
      const rOpt = extra => Object.assign({ delay: RUN, easing: 'ease-out', fill: 'forwards' }, extra || {});

      if (style === 'slide') {
        // drops to his knees and skids into the flag, turf flying
        sc.animate([
          { transform: place(at.x, at.y, 0, S) },
          { transform: place(at.x - d * 8, at.y + 4, 0, S), offset: .55 },
          { transform: place(at.x - d * 12, at.y + 6, 0, S * .99) }
        ], rOpt({ duration: 640, easing: ease }));
        if (body) body.animate([
          { transform: 'rotate(0deg) scaleY(1)' },
          { transform: `rotate(${d * 9}deg) scaleY(.97)`, offset: .3 },
          { transform: `rotate(${d * 21}deg) scaleY(.84)`, offset: .72 },
          { transform: `rotate(${d * 17}deg) scaleY(.87)` }
        ], rOpt({ duration: 640, easing: ease }));
        arms([[-14, 14, 0], [-16, 16, .3], [-44, 44, 1]], rOpt({ duration: 640 }));
        if (shadow) shadow.animate([{ transform: 'scale(1.1,1)', opacity: .34 },
          { transform: 'scale(1.7,.72)', opacity: .26 }], rOpt({ duration: 640 }));
        turfOut(RUN + 200);
        flagWobble(RUN + 260);
        dur = RUN + 820; camTo = 1.26;

      } else if (style === 'leap') {
        sc.animate([
          { transform: place(at.x, at.y, 0, S) },
          { transform: place(at.x, at.y + 4, 0, S * .97), offset: .16 },              // loads the legs
          { transform: place(at.x - d * 6, at.y - 46, 360, S * 1.12), offset: .58 },  // up and round
          { transform: place(at.x - d * 8, at.y + 4, 360, S), offset: .86 },
          { transform: place(at.x - d * 8, at.y, 360, S) }
        ], rOpt({ duration: 920, easing: 'cubic-bezier(.3,.65,.3,1)' }));
        arms([[-14, 14, 0], [-20, 20, .16], [-48, 48, .5], [22, -22, .84], [6, -6, 1]], rOpt({ duration: 920 }));
        if (shadow) shadow.animate([
          { transform: 'scale(1.05)', opacity: .36 },
          { transform: 'scale(.5)', opacity: .12, offset: .58 },
          { transform: 'scale(1.2)', opacity: .36 }
        ], rOpt({ duration: 920 }));
        flagWobble(RUN + 560);
        dur = RUN + 1080; camTo = 1.27;

      } else if (style === 'wings') {
        // the aeroplane, banking a full lap round the flag
        sc.animate([
          { transform: place(at.x, at.y, 0, S) },
          { transform: place(cx + d * 6, at.y - 6, -d * 5, S * 1.03), offset: .38 },
          { transform: place(cx - d * 16, at.y + 2, -d * 2, S), offset: .76 },
          { transform: place(cx - d * 12, at.y + 3, 0, S) }
        ], rOpt({ duration: 950, easing: 'linear' }));
        if (body) body.animate([
          { transform: 'rotate(0deg)' },
          { transform: `rotate(${d * 13}deg)`, offset: .45 },
          { transform: `rotate(${d * 9}deg)` }
        ], rOpt({ duration: 950, easing: 'ease-in-out' }));
        arms([[-14, 14, 0], [-74, 74, .25], [-80, 80, 1]], rOpt({ duration: 950 }));
        flagWobble(RUN + 420);
        dur = RUN + 1080;

      } else if (style === 'shush') {
        sc.animate([
          { transform: place(at.x, at.y, 0, S) },
          { transform: place(at.x, at.y + 12, 0, S * 1.3), offset: .55 },   // right into the lens
          { transform: place(at.x, at.y + 15, 0, S * 1.42) }
        ], rOpt({ duration: 950 }));
        arms([[-14, 14, 0], [-30, 4, .35], [-96, 6, .62], [-96, 6, 1]], rOpt({ duration: 950 }));
        if (shadow) shadow.animate([{ transform: 'scale(1.1,1)', opacity: .34 },
          { transform: 'scale(1.35,1)', opacity: .3 }], rOpt({ duration: 950 }));
        dur = RUN + 1100; camTo = 1.3;

      } else if (style === 'heart') {
        sc.animate([
          { transform: place(at.x, at.y, 0, S) },
          { transform: place(at.x, at.y - 8, 0, S * 1.03), offset: .5 },   // the little hop
          { transform: place(at.x, at.y, 0, S * 1.03) }
        ], rOpt({ duration: 720 }));
        arms([[-14, 14, 0], [-40, 40, .35], [-104, 104, .68], [-100, 100, 1]],
          rOpt({ duration: 920, easing: 'cubic-bezier(.3,1.4,.5,1)' }));
        dur = RUN + 1080; camTo = 1.28;

      } else if (style === 'badge') {
        sc.animate([
          { transform: place(at.x, at.y, 0, S) },
          { transform: place(at.x, at.y + 1, 0, S * 1.02) }
        ], rOpt({ duration: 500 }));
        // hands to the crest, then one arm flung out at the crowd
        arms([[-14, 14, 0], [-58, 58, .35], [-58, 58, .58], [-58, -104, 1]], rOpt({ duration: 1000 }));
        dur = RUN + 1080; camTo = 1.28;

      } else if (style === 'ice') {
        sc.animate([
          { transform: place(at.x, at.y, 0, S) },
          { transform: place(at.x, at.y, 0, S) }
        ], rOpt({ duration: 500 }));
        arms([[-14, 14, 0], [-58, 58, .5], [-62, 62, 1]], rOpt({ duration: 700 }));   // folded
        dur = RUN + 1150; camTo = 1.34;                        // slow push while he does nothing

      } else if (style === 'mobbed') {
        sc.animate([
          { transform: place(at.x, at.y, 0, S) },
          { transform: place(at.x, at.y + 2, 0, S * .97), offset: .7 },
          { transform: place(at.x, at.y + 1, 0, S * .98) }
        ], rOpt({ duration: 900 }));
        arms([[-14, 14, 0], [-46, 46, .4], [-34, 34, 1]], rOpt({ duration: 900 }));
        // two off the pitch, one coming round the flag
        root.querySelectorAll('.pg-mate').forEach((mate, i) => {
          const from = i === 2 ? -d : d;
          mate.style.opacity = '1';
          mate.animate([
            { transform: place(at.x + from * (150 + i * 40), 204, 0, S * .6), opacity: 0 },
            { transform: place(at.x + from * (150 + i * 40), 204, 0, S * .66), opacity: 1, offset: .12 },
            { transform: place(at.x + from * (18 + i * 10), at.y + 1, 0, S * .86), offset: .72 },
            { transform: place(at.x + from * (15 + i * 10), at.y + 3, 0, S * .88) }
          ], { duration: 1000, delay: RUN + 160 + i * 130, easing: 'cubic-bezier(.3,.7,.35,1)', fill: 'forwards' });
        });
        flagWobble(RUN + 720);
        dur = RUN + 1300; camTo = 1.2;
      }

      // camera: settles on him at the flag, then a slow punch in
      if (cam) cam.animate([
        { transform: focus(look.x, look.y, 1.12) },
        { transform: focus(look.x, look.y, camTo), offset: .5 },
        { transform: focus(look.x, look.y, camTo - .02) }
      ], { duration: dur - RUN + 220, delay: RUN, easing: 'ease-out', fill: 'forwards' });

      setTimeout(() => { if (done) done(); }, dur);
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

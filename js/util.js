/* ==========================================================================
   util.js — random helpers, formatting, small maths
   ========================================================================== */
(function (global) {
  'use strict';

  const U = {
    rnd(min, max) { return Math.random() * (max - min) + min; },
    int(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
    chance(p) { return Math.random() < p; },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    pickN(arr, n) {
      const copy = arr.slice(); const out = [];
      while (out.length < n && copy.length) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
      return out;
    },
    weighted(pairs) { // [[value, weight], ...]
      let total = 0; pairs.forEach(p => total += p[1]);
      let r = Math.random() * total;
      for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
      return pairs[pairs.length - 1][0];
    },
    clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); },
    round(v, dp) { const m = Math.pow(10, dp || 0); return Math.round(v * m) / m; },
    // Gaussian-ish via sum of uniforms
    gauss(mean, sd) {
      let s = 0; for (let i = 0; i < 6; i++) s += Math.random();
      return mean + ((s - 3) / 1.2) * sd;
    },
    poisson(lambda) {
      const L = Math.exp(-lambda); let k = 0, p = 1;
      do { k++; p *= Math.random(); } while (p > L);
      return k - 1;
    },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    },
    money(v) {
      const n = Math.round(v);
      const abs = Math.abs(n);
      if (abs >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, '') + 'B';
      if (abs >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, '') + 'M';
      if (abs >= 1e3) return (n / 1e3).toFixed(0) + 'K';
      return String(n);
    },
    cash(v) { return '$' + U.money(v); },
    ordinal(n) {
      const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    },
    pct(v) { return Math.round(v * 100) + '%'; },
    esc(str) {
      return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    },
    id() { return Math.random().toString(36).slice(2, 10); }
  };

  global.U = U;
})(window);

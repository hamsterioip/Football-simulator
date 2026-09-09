#!/usr/bin/env node
/* ==========================================================================
   tools/build-icons.js — generate js/icons.js
   Pulls the exact icons the game uses out of two open-source packs and emits
   a self-contained SVG sprite, so the game ships no icon dependency and makes
   no network requests at runtime.
     Material Design Icons (Pictogrammers)  — Apache 2.0
     Circle Flags (HatScripts)              — MIT
   Both packs are indexed by allsvgicons.com; here they come from the Iconify
   npm mirrors so the build is reproducible.
     npm install && node tools/build-icons.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const mdi = require('@iconify-json/mdi/icons.json');
const flags = require('@iconify-json/circle-flags/icons.json');

/* --- semantic name -> Material Design Icons name ------------------------- */
const ICONS = {
  // navigation
  'career': 'soccer-field', 'club': 'shield', 'player': 'account',
  'news': 'newspaper-variant-outline', 'legacy': 'trophy-variant',
  // match
  'ball': 'soccer', 'goal': 'soccer', 'net': 'goal', 'assist': 'bullseye-arrow',
  'save': 'glove', 'home': 'home', 'away': 'airplane', 'play': 'play-circle',
  'sim': 'fast-forward', 'whistle': 'whistle', 'stadium': 'stadium',
  'card': 'crop-portrait', 'wall': 'wall', 'corner': 'flag', 'header': 'human-handsup',
  'dive': 'drama-masks', 'celebrate': 'party-popper', 'rebound': 'flash',
  'counter': 'run-fast', 'duel': 'shoe-print', 'block': 'shield-half-full',
  'keeper': 'hand-back-right', 'penalty': 'bullseye-arrow',
  // attributes
  'pace': 'run-fast', 'shooting': 'target', 'passing': 'sign-direction',
  'dribbling': 'shoe-print', 'defending': 'shield-half-full', 'physical': 'arm-flex',
  'flair': 'auto-fix', 'weakFoot': 'shoe-cleat', 'gk': 'glove',
  // career
  'trophy': 'trophy', 'medal': 'medal', 'podium': 'podium', 'crown': 'crown',
  'star': 'star', 'shirt': 'tshirt-crew', 'squad': 'account-group',
  'manager': 'account-tie', 'nation': 'earth', 'calendar': 'calendar',
  'contract': 'file-document-edit', 'lock': 'lock', 'unlocked': 'lock-open-variant', 'transfer': 'swap-horizontal', 'value': 'cash',
  'fans': 'bullhorn', 'academy': 'school', 'legend': 'account-star',
  // condition
  'fitness': 'heart-pulse', 'form': 'chart-line', 'morale': 'fire',
  'injury': 'bandage', 'hospital': 'hospital-box', 'rest': 'bed',
  'train': 'dumbbell', 'video': 'video', 'press': 'microphone', 'agent': 'handshake',
  'tactics': 'clipboard-text',
  // ui chrome
  'alert': 'alert', 'ok': 'check-circle', 'no': 'close-circle', 'back': 'arrow-left',
  'next': 'chevron-right', 'settings': 'cog', 'disk': 'content-save', 'exit': 'logout',
  'up': 'trending-up', 'down': 'trending-down', 'info': 'information', 'clock': 'clock-outline',
  // extras
  'goldenboot': 'trophy-award', 'sub': 'swap-horizontal-bold', 'varscreen': 'monitor',
  'table': 'table-large', 'microphone': 'microphone-variant',
  // the social feed
  'like': 'heart', 'reply': 'comment-outline', 'repost': 'repeat-variant',
  'verified': 'check-decagram', 'hash': 'pound', 'send': 'send',
  'feed': 'at', 'eye': 'eye-outline', 'trend': 'trending-up', 'quote': 'format-quote-close'
};

/* --- nations / league countries -> Circle Flags name --------------------- */
const FLAGS = {
  'England': 'gb-eng', 'Scotland': 'gb-sct', 'France': 'fr', 'Brazil': 'br',
  'Argentina': 'ar', 'Spain': 'es', 'Germany': 'de', 'Italy': 'it',
  'Portugal': 'pt', 'Netherlands': 'nl', 'Belgium': 'be', 'Croatia': 'hr',
  'Uruguay': 'uy', 'Colombia': 'co', 'Mexico': 'mx', 'USA': 'us',
  'Morocco': 'ma', 'Senegal': 'sn', 'Nigeria': 'ng', 'Japan': 'jp',
  'South Korea': 'kr', 'Norway': 'no', 'Sweden': 'se', 'Poland': 'pl',
  'Serbia': 'rs', 'Turkey': 'tr', 'Australia': 'au', 'Canada': 'ca',
  'Ireland': 'ie', 'Ghana': 'gh',
  'Saudi Arabia': 'sa', 'Qatar': 'qa', 'UAE': 'ae', 'Bolivia': 'bo',
  // extra nations needed by the real star players
  'Denmark': 'dk', 'Wales': 'gb-wls', 'Egypt': 'eg', 'Algeria': 'dz',
  'Georgia': 'ge', 'Ecuador': 'ec', 'Slovenia': 'si', 'Switzerland': 'ch',
  'Czechia': 'cz', 'Guinea': 'gn', 'Hungary': 'hu', 'Austria': 'at',
  'Iceland': 'is', 'Ivory Coast': 'ci', 'Mali': 'ml', 'Chile': 'cl',
  'Paraguay': 'py', 'Slovakia': 'sk', 'Jamaica': 'jm', 'Israel': 'il',
  'Russia': 'ru', 'Venezuela': 've', 'Ukraine': 'ua', 'Cameroon': 'cm',
  'Gabon': 'ga', 'Greece': 'gr',
  // era legends reach further back and wider still
  'Bulgaria': 'bg', 'Northern Ireland': 'gb-nir', 'Liberia': 'lr', 'Bosnia': 'ba',
  'Romania': 'ro', 'Peru': 'pe', 'Togo': 'tg', 'DR Congo': 'cd', 'Tunisia': 'tn',
  'South Africa': 'za', 'Finland': 'fi', 'Montenegro': 'me', 'Albania': 'al',
  'North Macedonia': 'mk', 'Armenia': 'am', 'Costa Rica': 'cr', 'Iran': 'ir'
};

function lookup(pack, name) {
  const direct = pack.icons[name];
  if (direct) return direct;
  const alias = pack.aliases && pack.aliases[name];
  if (alias && pack.icons[alias.parent]) return pack.icons[alias.parent];
  throw new Error('icon not found: ' + name);
}

const symbols = [];
const seen = new Set();

Object.keys(ICONS).forEach(key => {
  const src = lookup(mdi, ICONS[key]);
  const w = src.width || mdi.width || 24, h = src.height || mdi.height || 24;
  const id = 'i-' + key;
  if (seen.has(id)) return;
  seen.add(id);
  symbols.push(`<symbol id="${id}" viewBox="0 0 ${w} ${h}">${src.body}</symbol>`);
});

Object.keys(FLAGS).forEach(country => {
  const src = lookup(flags, FLAGS[country]);
  const w = src.width || flags.width || 512, h = src.height || flags.height || 512;
  const id = 'f-' + FLAGS[country];
  if (seen.has(id)) return;
  seen.add(id);
  symbols.push(`<symbol id="${id}" viewBox="0 0 ${w} ${h}">${src.body}</symbol>`);
});

const flagMap = JSON.stringify(FLAGS, null, 0);

const out = `/* ==========================================================================
   icons.js — GENERATED by tools/build-icons.js. Do not edit by hand.

   An inline SVG sprite: no icon font, no network request, no dependency at
   runtime. Icons inherit the surrounding text colour via currentColor.

   Material Design Icons by Pictogrammers — Apache 2.0
   Circle Flags by HatScripts — MIT
   ========================================================================== */
(function (global) {
  'use strict';

  const SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">'
    + ${JSON.stringify(symbols.join(''))} + '</svg>';

  const FLAG_OF = ${flagMap};

  let injected = false;
  function inject() {
    if (injected) return;
    const holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.innerHTML = SPRITE;
    document.body.insertBefore(holder, document.body.firstChild);
    injected = true;
  }

  const Icons = {
    inject,
    // markup for an icon; decorative by default, name it when it carries meaning
    svg(name, cls, label) {
      const id = 'i-' + name;
      return '<svg class="ic ' + (cls || '') + '"'
        + (label ? ' role="img" aria-label="' + label + '"' : ' aria-hidden="true"')
        + '><use href="#' + id + '"/></svg>';
    },
    // a country's flag, or a neutral globe when the pack has no flag for it
    flag(country, cls) {
      const code = FLAG_OF[country];
      if (!code) return Icons.svg('nation', cls);
      return '<svg class="fl ' + (cls || '') + '" role="img" aria-label="'
        + String(country).replace(/[<>&"]/g, '') + '"><use href="#f-' + code + '"/></svg>';
    },
    has(name) { return SPRITE.indexOf('id="i-' + name + '"') >= 0; }
  };

  global.Icons = Icons;
})(window);
`;

fs.writeFileSync(path.join(__dirname, '..', 'js', 'icons.js'), out);
console.log('js/icons.js written — ' + symbols.length + ' symbols, '
  + (out.length / 1024).toFixed(0) + 'KB');

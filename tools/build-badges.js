#!/usr/bin/env node
/* ==========================================================================
   tools/build-badges.js — generate js/badges.js

   Finds every club's real badge image. Freely-licensed crests come from the
   club's Wikipedia article page image; the rest (en-wiki excludes non-free
   logos) come from TheSportsDB's free team API. The game layers the image
   over its own drawn crest — online you get the real badge, offline or on a
   miss you get the drawn shield. Nothing is downloaded or bundled. Re-runs
   keep what is already resolved and only fill the gaps.

     node tools/build-badges.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

// pull the club list straight out of data.js rather than duplicating it
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
const DATA = new Function('window', src + '\nreturn window.DATA;')({});

const clubs = [];
DATA.LEAGUES.forEach(l => l.clubs.forEach(c => clubs.push(c[0])));

/* club name -> search query, where the plain name is ambiguous or missing */
const QUERY = {
  'Inter': 'Inter Milan', 'Roma': 'AS Roma', 'Monaco': 'AS Monaco FC',
  'Paris SG': 'Paris Saint-Germain FC', 'PSV': 'PSV Eindhoven', 'Ajax': 'AFC Ajax',
  'Sevilla': 'Sevilla FC', 'Valencia': 'Valencia CF', 'Villarreal': 'Villarreal CF',
  'Girona': 'Girona FC', 'Celta Vigo': 'RC Celta de Vigo', 'Osasuna': 'CA Osasuna',
  'Athletic Club': 'Athletic Bilbao',
  'Tottenham': 'Tottenham Hotspur F.C.', 'Newcastle': 'Newcastle United F.C.',
  'West Ham': 'West Ham United F.C.', 'Brighton': 'Brighton & Hove Albion F.C.',
  'Nottingham Forest': 'Nottingham Forest F.C.',
  'Mainz': '1. FSV Mainz 05', 'Wolfsburg': 'VfL Wolfsburg', 'Stuttgart': 'VfB Stuttgart',
  'Freiburg': 'SC Freiburg', 'Augsburg': 'FC Augsburg', 'Hoffenheim': 'TSG 1899 Hoffenheim',
  'Werder Bremen': 'SV Werder Bremen', 'Bayer Leverkusen': 'Bayer 04 Leverkusen',
  'Utrecht': 'FC Utrecht', 'Twente': 'FC Twente', 'Groningen': 'FC Groningen',
  'NEC': 'NEC Nijmegen', 'Heerenveen': 'SC Heerenveen', 'Vitesse': 'SBV Vitesse',
  'Sparta Rotterdam': 'Sparta Rotterdam', 'Go Ahead Eagles': 'Go Ahead Eagles',
  'AZ Alkmaar': 'AZ Alkmaar', 'Feyenoord': 'Feyenoord',
  'Porto': 'FC Porto', 'Benfica': 'S.L. Benfica', 'Sporting CP': 'Sporting CP',
  'Braga': 'S.C. Braga', 'Vitória Guimarães': 'Vitória S.C.', 'Boavista': 'Boavista F.C.',
  'Famalicão': 'F.C. Famalicão', 'Rio Ave': 'Rio Ave F.C.', 'Gil Vicente': 'Gil Vicente F.C.',
  'Casa Pia': 'Casa Pia A.C.', 'Arouca': 'F.C. Arouca', 'Estoril': 'G.D. Estoril Praia',
  'Lens': 'RC Lens', 'Lille': 'Lille OSC', 'Nice': 'OGC Nice',
  'Lyon': 'Olympique Lyonnais', 'Marseille': 'Olympique de Marseille',
  'Rennes': 'Stade Rennais FC', 'Strasbourg': 'RC Strasbourg Alsace',
  'Nantes': 'FC Nantes', 'Toulouse': 'Toulouse FC', 'Brest': 'Stade Brestois 29',
  'Torino': 'Torino FC', 'Genoa': 'Genoa CFC', 'Udinese': 'Udinese Calcio',
  'Fiorentina': 'ACF Fiorentina', 'Atalanta': 'Atalanta BC', 'Bologna': 'Bologna FC 1909',
  'Lazio': 'SS Lazio', 'Napoli': 'SSC Napoli',
  'River Plate': 'Club Atlético River Plate', 'Racing Club': 'Racing Club de Avellaneda',
  'Estudiantes': 'Estudiantes de La Plata', 'Talleres': 'Talleres de Córdoba',
  'Newell’s': "Newell's Old Boys", 'Vélez Sarsfield': 'Club Atlético Vélez Sarsfield',
  'San Lorenzo': 'San Lorenzo de Almagro', 'Argentinos Juniors': 'Argentinos Juniors',
  'São Paulo': 'São Paulo FC', 'Flamengo': 'CR Flamengo', 'Palmeiras': 'SE Palmeiras',
  'Botafogo': 'Botafogo de Futebol e Regatas', 'Fluminense': 'Fluminense FC',
  'Corinthians': 'Sport Club Corinthians Paulista', 'Atlético Mineiro': 'Clube Atlético Mineiro',
  'Grêmio': 'Grêmio FBPA', 'Internacional': 'Sport Club Internacional',
  'Fortaleza': 'Fortaleza Esporte Clube', 'Bahia': 'Esporte Clube Bahia',
  'Inter Miami': 'Inter Miami CF', 'LAFC': 'Los Angeles FC',
  'Seattle Sounders': 'Seattle Sounders FC', 'NY Red Bulls': 'New York Red Bulls',
  'Portland Timbers': 'Portland Timbers', 'Chicago Fire': 'Chicago Fire FC'
};

const API = 'https://en.wikipedia.org/w/api.php';
const HEADERS = { 'User-Agent': 'football-life-badge-builder/1.0 (personal game project; contact: local build script)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Wikipedia rate-limits bursts (429), so every call retries with backoff
async function apiJson(params) {
  const url = API + '?' + new URLSearchParams(Object.assign({ format: 'json' }, params));
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res.json();
    if (res.status !== 429 || attempt >= 4) throw new Error('HTTP ' + res.status);
    await sleep(2500 * Math.pow(2, attempt));
  }
}

async function titleFor(club) {
  const q = QUERY[club] || club;
  const search = await apiJson({ action: 'query', list: 'search', srlimit: 1,
                                 srsearch: '"' + q + '" football club' });
  const hit = search.query && search.query.search && search.query.search[0];
  return hit ? hit.title : null;
}

// page images for up to 50 titles per request — a handful of calls total
async function thumbnailsFor(titles) {
  const map = {};
  for (let i = 0; i < titles.length; i += 50) {
    const pages = await apiJson({ action: 'query', prop: 'pageimages', piprop: 'thumbnail',
                                  pithumbsize: 128, redirects: 1,
                                  titles: titles.slice(i, i + 50).join('|') });
    Object.values(pages.query.pages).forEach(p => {
      if (p.thumbnail && p.thumbnail.source) map[p.title] = p.thumbnail.source;
    });
    // map redirects back to the title we asked for
    (pages.query.redirects || []).forEach(r => {
      if (map[r.to] && !map[r.from]) map[r.from] = map[r.to];
    });
    if (i + 50 < titles.length) await sleep(1000);
  }
  return map;
}

/* Hand-pinned URLs for clubs the APIs rate-limit or misname. Sources:
   TheSportsDB (r2.thesportsdb.com) and Wikimedia Commons (upload.wikimedia.org). */
const OVERRIDES = {
  'Corinthians': 'https://r2.thesportsdb.com/images/media/team/badge/vvuvps1473538042.png',
  'Inter Miami': 'https://r2.thesportsdb.com/images/media/team/badge/m4it3e1602103647.png',
  'Rosario Central': 'https://r2.thesportsdb.com/images/media/team/badge/y6q1ds1769660256.png',
  'Seattle Sounders': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/MLS_crest_logo_RGB_-_Seattle_Sounders_FC_2024.svg/250px-MLS_crest_logo_RGB_-_Seattle_Sounders_FC_2024.svg.png',
  'Atlanta United': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/MLS_crest_logo_RGB_-_Atlanta_United_FC.svg/250px-MLS_crest_logo_RGB_-_Atlanta_United_FC.svg.png',
  'NY Red Bulls': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/MLS_crest_logo_RGB_-_New_York_Red_Bulls.svg/250px-MLS_crest_logo_RGB_-_New_York_Red_Bulls.svg.png',
  'Philadelphia Union': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/MLS_crest_logo_RGB_-_Philadelphia_Union_2018.svg/250px-MLS_crest_logo_RGB_-_Philadelphia_Union_2018.svg.png',
  'Austin FC': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/95/MLS_crest_logo_RGB_-_Austin_FC.svg/250px-MLS_crest_logo_RGB_-_Austin_FC.svg.png'
};

(async () => {
  // merge with what a previous run already resolved — re-runs only fill gaps
  const badges = {};
  const prevFile = path.join(__dirname, '..', 'js', 'badges.js');
  if (fs.existsSync(prevFile)) {
    const prev = fs.readFileSync(prevFile, 'utf8').match(/global\.BADGES = (\{[\s\S]*?\n\});/);
    if (prev) Object.assign(badges, JSON.parse(prev[1]));
    console.log('starting with ' + Object.keys(badges).length + ' badges from previous run');
  }
  Object.assign(badges, OVERRIDES);
  const todo = clubs.filter(c => !badges[c]);

  // pass 1: batch-guess the Wikipedia article title for every unresolved club
  const guesses = {};
  todo.forEach(c => { guesses[c] = QUERY[c] || (/ (F\.?C\.?|CF|AC|SC|SSC|SS|AS)$/.test(c) ? c : c + ' F.C.'); });
  let thumbs = await thumbnailsFor([...new Set(Object.values(guesses))]);
  const missing = [];
  todo.forEach(c => {
    const t = thumbs[guesses[c]];
    if (t) badges[c] = t; else missing.push(c);
  });
  console.log('pass 1: ' + Object.keys(badges).length + '/' + clubs.length + ' badges');

  // pass 2: plain name for the misses (e.g. article is just "Sevilla FC")
  if (missing.length) {
    thumbs = await thumbnailsFor(missing.map(c => (QUERY[c] || c).replace(/ F\.C\.$/, ' FC')));
    const still = [];
    missing.forEach(c => {
      const guess = (QUERY[c] || c).replace(/ F\.C\.$/, ' FC');
      if (thumbs[guess]) badges[c] = thumbs[guess]; else still.push(c);
    });
    console.log('pass 2: +' + (missing.length - still.length) + ' badges');
    missing.length = 0; missing.push(...still);
  }

  // pass 3: TheSportsDB free API — carries the crests Wikipedia won't serve
  // (en-wiki page images exclude non-free logos; most club crests are non-free)
  const failed = [];
  for (const club of missing) {
    try {
      const url = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t='
        + encodeURIComponent(club);
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const d = await res.json();
      const teams = (d.teams || []).filter(t => t.strSport === 'Soccer' && t.strBadge);
      if (!teams.length) { failed.push(club); continue; }
      badges[club] = teams[0].strBadge;
      process.stdout.write('.');
    } catch (e) {
      failed.push(club);
      console.error('[' + club + '] ' + e.message);
      process.stdout.write('!');
    }
    await sleep(1500);
  }
  console.log('\npass 3 done — total ' + Object.keys(badges).length + '/' + clubs.length);

  const out = `/* ==========================================================================
   badges.js — GENERATED by tools/build-badges.js. Do not edit by hand.

   Real club badge images, hot-linked from Wikipedia/TheSportsDB at runtime
   and layered over the game's own drawn crests. Offline (or on a failed
   request) the drawn shield underneath shows through instead — see crest.js.
   ========================================================================== */
(function (global) {
  'use strict';
  global.BADGES = ${JSON.stringify(badges, null, 2)};
})(window);
`;
  fs.writeFileSync(path.join(__dirname, '..', 'js', 'badges.js'), out);
  console.log('js/badges.js written — ' + Object.keys(badges).length + ' badges, '
    + (out.length / 1024).toFixed(0) + 'KB');
  if (failed.length) console.log('no badge found for: ' + failed.join(', '));
})().catch(e => { console.error(e.message); process.exit(1); });

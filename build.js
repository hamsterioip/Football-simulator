#!/usr/bin/env node
/* ==========================================================================
   build.js — inline every stylesheet and script into single-file builds.
     play.html          standalone page: download it, open it, play offline
     dist/artifact.html body-only variant for hosts that supply their own shell
   Run with:  node build.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const CSS = ['css/styles.css'];
const JS = ['js/icons.js', 'js/data.js', 'js/badge-imgs.js', 'js/trophy-imgs.js', 'js/crest.js', 'js/pitch.js', 'js/trophies.js', 'js/util.js', 'js/state.js', 'js/scenarios.js',
            'js/engine.js', 'js/career.js', 'js/status.js', 'js/timeline.js', 'js/manager.js', 'js/manager-ui.js', 'js/social.js', 'js/social-mgr.js', 'js/ui.js', 'js/main.js'];

// An inline emoji favicon keeps the build dependency-free (no icon files needed).
const FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
  + "<text y='.9em' font-size='90'>%E2%9A%BD</text></svg>";

function guard(src, file) {
  // inlining would break out of the script element early
  if (/<\/script/i.test(src)) throw new Error('cannot inline ' + file + ': contains "</script"');
  return src;
}

/* ---------- cache busting ----------
   index.html loads sixteen separate files. Browsers (and GitHub Pages) hold on
   to them, so a fresh deploy can be served from a stale cache and look exactly
   like the old one. Stamping every URL with the version means a release always
   fetches new files. */
let BADGE_COUNT = 0;
const VERSION = (read('js/data.js').match(/const VERSION = '([^']+)'/) || [])[1];
if (!VERSION) throw new Error('could not read VERSION out of js/data.js');

function stampAssets(html) {
  return html
    .replace(/(<script src="js\/[^"?]+)(\?v=[^"]*)?"/g, `$1?v=${VERSION}"`)
    .replace(/(<link rel="stylesheet" href="css\/[^"?]+)(\?v=[^"]*)?"/g, `$1?v=${VERSION}"`);
}
{
  const before = read('index.html');
  const after = stampAssets(before);
  if (after !== before) fs.writeFileSync(path.join(ROOT, 'index.html'), after);
}

/* ---------- the two lists must agree ----------
   play.html is built from the JS array above; the deployed site is index.html
   and loads its own <script> tags. Adding a file to one and forgetting the
   other ships a site where that module simply does not exist — which is how
   Manager Mode reached production with Manager undefined: every screen drew,
   and picking a club threw. The build now refuses to produce that. */
{
  const tags = [];
  read('index.html').replace(/<script src="(js\/[^"?]+)/g, (_, f) => { tags.push(f); return _; });
  const missing = JS.filter(f => tags.indexOf(f) < 0);
  const extra = tags.filter(f => JS.indexOf(f) < 0);
  const problems = [];
  if (missing.length) problems.push('index.html is missing: ' + missing.join(', '));
  if (extra.length) problems.push('index.html loads files build.js does not: ' + extra.join(', '));
  // load order matters — each module attaches a global the next one may use
  const shared = tags.filter(f => JS.indexOf(f) >= 0);
  const wanted = JS.filter(f => tags.indexOf(f) >= 0);
  if (!problems.length && shared.join('|') !== wanted.join('|'))
    problems.push('index.html loads the scripts in a different order than build.js:\n  index.html: '
      + shared.join(' ') + '\n  build.js:   ' + wanted.join(' '));
  if (problems.length) {
    console.error('\nbuild failed — index.html and build.js disagree:\n  ' + problems.join('\n  ') + '\n');
    process.exit(1);
  }
}

/* ---------- every club must have a badge ----------
   crest.js draws no fallback shield any more: the badge in js/badge-imgs.js
   is the crest. A club added to data.js (or a club named in a player's
   timeline) without a badge would render a hole, so the build refuses it.
   Fix by adding the source to tools/build-badge-imgs.py and re-running it. */
{
  const sandbox = { window: null };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  ['js/data.js', 'js/timeline.js', 'js/badge-imgs.js']
    .forEach(f => vm.runInContext(read(f), sandbox, { filename: f }));
  const need = new Set();
  sandbox.DATA.LEAGUES.forEach(l => l.clubs.forEach(c => need.add(c[0])));
  Object.keys(sandbox.Timeline.PLAYER_ERAS).forEach(name =>
    sandbox.Timeline.PLAYER_ERAS[name].forEach(row => { if (row[1]) need.add(row[1]); }));
  const missing = [...need].filter(n => !sandbox.BADGE_IMGS[n]);
  if (missing.length) {
    console.error('\nbuild failed — these clubs have no badge:\n  ' + missing.join('\n  ') + '\n');
    process.exit(1);
  }
  BADGE_COUNT = need.size;
}

const styles = CSS.map(f => `/* ${f} */\n` + read(f)).join('\n');
const scripts = JS.map(f => `<script>\n/* ${f} */\n` + guard(read(f), f) + '\n</script>').join('\n');

// the shared markup: everything in index.html between <body> and </body>
const index = read('index.html');
const body = index.split(/<body[^>]*>/i)[1].split(/<\/body>/i)[0]
  .replace(/<script src="[^"]*"><\/script>\s*/g, '')
  .trim();

// the page's name, not a description of it — this is what a browser tab,
// a home-screen shortcut and any gallery listing shows
const TITLE = 'Football Life';
const DESC = 'A football career simulator: rob eight legends for your attributes, choose your club, '
  + 'and play the moments that matter.';

/* ---------- standalone ---------- */
const standalone = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="theme-color" content="#080d16" />
<title>${TITLE}</title>
<meta name="description" content="${DESC}" />
<link rel="icon" href="${FAVICON}" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Football Life" />
<style>
${styles}
</style>
</head>
<body>
${body}
${scripts}
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'play.html'), standalone);

/* ---------- body-only (host supplies doctype/head/body) ---------- */
const embedded = `<title>${TITLE}</title>
<style>
${styles}
</style>
${body}
${scripts}
`;
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/artifact.html'), embedded);

const kb = n => (n / 1024).toFixed(0) + 'KB';
console.log('v' + VERSION + ' — ' + BADGE_COUNT + ' club badges');
console.log('play.html          ' + kb(standalone.length));
console.log('dist/artifact.html ' + kb(embedded.length));

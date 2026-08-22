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

const ROOT = __dirname;
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const CSS = ['css/styles.css'];
const JS = ['js/icons.js', 'js/data.js', 'js/badges.js', 'js/crest.js', 'js/pitch.js', 'js/trophies.js', 'js/util.js', 'js/state.js', 'js/scenarios.js',
            'js/engine.js', 'js/career.js', 'js/social.js', 'js/ui.js', 'js/main.js'];

// An inline emoji favicon keeps the build dependency-free (no icon files needed).
const FAVICON = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>"
  + "<text y='.9em' font-size='90'>%E2%9A%BD</text></svg>";

function guard(src, file) {
  // inlining would break out of the script element early
  if (/<\/script/i.test(src)) throw new Error('cannot inline ' + file + ': contains "</script"');
  return src;
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
console.log('play.html          ' + kb(standalone.length));
console.log('dist/artifact.html ' + kb(embedded.length));

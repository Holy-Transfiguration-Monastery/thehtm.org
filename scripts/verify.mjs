// Checks the build before launch.
//
//   node scripts/verify.mjs              check ./dist offline
//   node scripts/verify.mjs <base-url>   also request every old URL from a deployed preview
//
// 1. Every URL in the live Weebly sitemap must map to a built page or a redirect.
// 2. Every internal link and image in the built HTML must point at a real file.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist');
const base = process.argv[2]?.replace(/\/$/, '');
let failures = 0;
const fail = (msg) => { failures++; console.log('  ✗ ' + msg); };

// Redirect rules from public/_redirects (exact paths and trailing /* wildcards).
const rules = fs.readFileSync(path.join(ROOT, 'public/_redirects'), 'utf8')
  .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split(/\s+/));
const redirectFor = (p) => rules.find(([from]) => from === p || (from.endsWith('/*') && p.startsWith(from.slice(0, -1))))?.[1];

// How Cloudflare resolves a path against the built files.
function resolves(p) {
  p = decodeURIComponent(p.split('#')[0].split('?')[0]);
  if (p === '/' || p === '') return fs.existsSync(path.join(DIST, 'index.html'));
  const clean = p.replace(/\/$/, '').replace(/\.html$/, '');
  return [p, clean + '.html', path.join(clean, 'index.html')].some((c) => {
    const f = path.join(DIST, c);
    return fs.existsSync(f) && fs.statSync(f).isFile();
  }) || Boolean(redirectFor(p) && resolves(redirectFor(p)));
}

// ---- 1. old URLs
console.log('Old sitemap URLs');
const sitemap = await (await fetch('https://www.thehtm.org/sitemap.xml')).text();
const oldUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
oldUrls.push('/greek.html', '/english.html', '/news/archives/04-2021', '/1/post/2021/04/eight-canons.html');
for (const u of oldUrls) if (!resolves(u)) fail(`${u} has no page or redirect`);
console.log(`  checked ${oldUrls.length}`);

// ---- 2. internal links in the build
console.log('Internal links and images');
const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory() && e.name !== 'pagefind') walk(f);
    else if (e.name.endsWith('.html')) pages.push(f);
  }
})(DIST);
const seen = new Set();
let pdfs = 0;
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (!url.startsWith('/') || url.startsWith('//')) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    if (url.endsWith('.pdf')) pdfs++;
    if (!resolves(url)) fail(`${url} (linked from ${path.relative(DIST, page)})`);
  }
}
console.log(`  checked ${seen.size} unique links across ${pages.length} pages (${pdfs} PDFs)`);

// ---- 3. optional: live check against a deployed preview
if (base) {
  console.log(`Requesting old URLs from ${base}`);
  for (const u of oldUrls) {
    const res = await fetch(base + u, { redirect: 'follow' });
    if (!res.ok) fail(`${u} -> ${res.status}`);
  }
}

console.log(failures ? `\n${failures} problem(s) found` : '\nAll good');
process.exit(failures ? 1 : 0);

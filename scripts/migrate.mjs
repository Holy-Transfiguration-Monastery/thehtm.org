// One-time migration from the Weebly site export to Astro content files.
//
// Usage: node scripts/migrate.mjs <path-to-unzipped-weebly-export>
//
// Writes:
//   public/uploads/...         every legacy upload, at its original path
//   src/content/pages/*.md     Home and Information
//   src/content/music/*.md     the music pages (menu position in frontmatter)
//   src/content/albums/*.yml   photo albums
//   src/content/news/*.md      News posts
//   src/content/reading/*.md   Spiritual Reading posts
//   public/_redirects          old Weebly URLs -> new ones
//
// Images referenced by the pages but missing from the export are fetched from
// the live site (they still exist at the same paths there).

import fs from 'node:fs';
import path from 'node:path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import YAML from 'yaml';

const LIVE = 'https://www.thehtm.org';
const SRC = process.argv[2];
if (!SRC || !fs.existsSync(path.join(SRC, 'index.html'))) {
  console.error('Usage: node scripts/migrate.mjs <unzipped-export-dir>');
  process.exit(1);
}
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = (...p) => path.join(ROOT, ...p);
const read = (f) => fs.readFileSync(path.join(SRC, f), 'utf8');
const write = (file, text) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

// Pages handled specially (not music pages).
const ALBUMS = ['htm-roses-june-2018', 'blizzard-2015', 'apparently-spring-not-been-cancelled', 'summer-2011'];
const SKIP = new Set(['index', 'information', 'photos', 'news', 'spiritual-reading', 'greek', 'english', ...ALBUMS]);

// ---------------------------------------------------------------- helpers

const neededAssets = new Set();

function normUrl(href) {
  if (href == null) return href;
  let h = href.trim().replace(/^http:\/\/UNSET\/?/, '/');
  if (h === '' || h === 'index.html') return '/';
  if (/^(https?:|mailto:|tel:|#)/.test(h)) return h;
  if (h.startsWith('uploads/') || h.startsWith('/uploads/')) {
    h = '/' + h.replace(/^\//, '').replace(/[?].*$/, '');
    neededAssets.add(h);
    return h;
  }
  if (!h.startsWith('/')) h = '/' + h;
  // Cloudflare serves pages without ".html", so link to the clean address.
  return h.replace(/\.html(#.*)?$/, '$1');
}

const cleanText = (s) => s.replace(/[​﻿]/g, '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

// Turn Weebly's element soup into simple semantic HTML.
function simplify(html) {
  const $ = cheerio.load(`<div id="root">${html}</div>`, null, false);
  const root = $('#root');
  root.find('.wsite-spacer, script, style, noscript, .blog-social, .blog-comments-bottom').remove();
  root.find('fb\\:like').remove();

  // Flatten multi-column tables, innermost first.
  for (let guard = 0; guard < 20; guard++) {
    const tables = root.find('table.wsite-multicol-table').filter((_, t) => $(t).find('table.wsite-multicol-table').length === 0);
    if (!tables.length) break;
    tables.each((_, t) => {
      const parts = $(t).find('td.wsite-multicol-col').map((_, td) => $(td).html()).get();
      const wrap = $(t).closest('.wsite-multicol').parent();
      (wrap.length ? wrap : $(t)).replaceWith(parts.map((p) => `<div>${p}</div>`).join('\n'));
    });
  }

  // Floated images in older posts carry their caption in a separate span.
  root.find('.wsite-caption').each((_, el) => {
    const text = cleanText($(el).text());
    $(el).replaceWith(text ? `<p><em>${text}</em></p>` : '');
  });
  root.find('.imgPusher').remove();

  // Images: keep src + caption.
  root.find('.wsite-image').each((_, el) => {
    const img = $(el).is('img') ? $(el) : $(el).find('img').first();
    const caption = cleanText($(el).text());
    const src = normUrl(img.attr('src'));
    const alt = img.attr('alt') && img.attr('alt') !== 'Picture' ? img.attr('alt') : '';
    $(el).replaceWith(`<p><img src="${src}" alt="${alt}"></p>${caption ? `<p><em>${caption}</em></p>` : ''}`);
  });

  // YouTube embeds: keep as privacy-friendly iframes.
  root.find('.wsite-youtube').each((_, el) => {
    const src = $(el).find('iframe').attr('src') || '';
    const id = (src.match(/embed\/([\w-]+)/) || [])[1];
    $(el).replaceWith(id ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="YouTube video" loading="lazy" allowfullscreen></iframe></div>` : '');
  });

  root.find('a').each((_, a) => {
    const href = $(a).attr('href');
    if (href === undefined) { $(a).replaceWith($(a).html()); return; }
    $(a).attr('href', normUrl(href));
    $(a).removeAttr('target').removeAttr('title').removeAttr('rel');
  });
  root.find('img').each((_, img) => $(img).attr('src', normUrl($(img).attr('src'))));

  // Unwrap presentational tags.
  root.find('font, span').each((_, el) => $(el).replaceWith($(el).html() ?? ''));

  // Paragraph divs: a double <br> means a new paragraph.
  root.find('div.paragraph').each((_, el) => {
    const inner = ($(el).html() || '').split(/(?:\s*<br\s*\/?>\s*){2,}/i).filter((p) => cleanText(cheerio.load(p).text()) || /<img|<iframe/.test(p));
    $(el).replaceWith(inner.map((p) => `<p>${p.replace(/^(\s*<br\s*\/?>)+|(<br\s*\/?>\s*)+$/gi, '')}</p>`).join('\n'));
  });

  return root.html()
    .replace(/[​﻿]/g, '')
    .replace(/(&nbsp;| )(\s|&nbsp;| )+/g, ' ');
}

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '_', hr: '---' });
td.keep(['iframe']);
td.addRule('videoWrap', {
  filter: (n) => n.nodeName === 'DIV' && n.getAttribute('class') === 'video',
  replacement: (_, n) => `\n\n<div class="video">${n.innerHTML}</div>\n\n`,
});

function toMarkdown(html) {
  return td.turndown(simplify(html))
    .replace(/[ \t]+$/gm, (m) => (m.length >= 2 ? '  ' : ''))
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

const fm = (data, body = '') => `---\n${YAML.stringify(data).trim()}\n---\n\n${body}`;

// Pull a page title out of the body (h2 title or a giant-font paragraph) and remove it.
function takeTitle($els) {
  let title = '';
  const h = $els.find('h2.wsite-content-title').first();
  if (h.length && cleanText(h.text())) { title = cleanText(h.text()); h.remove(); }
  else {
    const big = $els.find('font[size="7"]').first();
    if (big.length) { title = cleanText(big.text()); big.closest('.paragraph').remove(); }
  }
  return title;
}

// ---------------------------------------------------------------- 1. uploads

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b); else fs.copyFileSync(a, b);
  }
}
copyDir(path.join(SRC, 'uploads'), out('public', 'uploads'));
// Weebly's stock theme background (a burger photo), never shown on the site.
fs.rmSync(out('public/uploads/1/2/0/1/120141198/background-images'), { recursive: true, force: true });
console.log('copied uploads');

// ---------------------------------------------------------------- 2. menu tree

const $home = cheerio.load(read('index.html'));
function walk($ul, parent, depth, acc) {
  $ul.children('li').each((i, li) => {
    const a = $home(li).children('a').first();
    const label = cleanText(a.text()).replace(/\s*>$/, "");
    const href = a.attr('href');
    const id = href ? href.replace(/\.html$/, '') : `__${label.toLowerCase()}`;
    acc.push({ id, label, parent, order: i + 1, depth });
    const sub = $home(li).find('> .wsite-menu-wrap > ul.wsite-menu');
    if (sub.length) walk(sub, id, depth + 1, acc);
  });
  return acc;
}
const menu = walk($home('#navigation > ul.wsite-menu-default'), null, 0, []);
const menuById = Object.fromEntries(menu.map((m) => [m.id, m]));
// Which top branch (Greek / English) a page falls under.
function sectionOf(id) {
  let m = menuById[id];
  while (m && m.parent && !m.parent.startsWith('__')) m = menuById[m.parent];
  return m?.parent === '__greek' ? 'greek' : m?.parent === '__english' ? 'english' : null;
}

// ---------------------------------------------------------------- 3. music pages

const htmlFiles = fs.readdirSync(SRC).filter((f) => f.endsWith('.html'));
let musicCount = 0;
for (const f of htmlFiles) {
  const id = f.replace(/\.html$/, '');
  if (SKIP.has(id)) continue;
  const $ = cheerio.load(read(f));
  const $els = $('#wsite-content .wsite-section-elements');
  const title = takeTitle($els) || menuById[id]?.label || id;
  const m = menuById[id];
  const data = {
    title,
    menuTitle: m?.label ?? null,
    section: id === 'music' ? 'index' : (sectionOf(id) ?? (id.endsWith('1') && id.startsWith('cherubic') ? 'greek' : 'english')),
    parent: m?.parent && !m.parent.startsWith('__') && m.parent !== 'music' ? m.parent : null,
    order: m?.order ?? 99,
    inMenu: Boolean(m),
  };
  // Greek cherubic hymns are only linked from the Greek Divine Liturgy page.
  if (id === 'cherubic-hymns-and-anaphora1') data.parent = 'divine-liturgy';
  write(out('src/content/music', `${id}.md`), fm(data, toMarkdown($els.html() || '')));
  musicCount++;
}
console.log(`music pages: ${musicCount}`);

// ---------------------------------------------------------------- 4. home + information

{
  const $ = cheerio.load(read('information.html'));
  const $els = $('#wsite-content .wsite-section-elements');
  write(out('src/content/pages/information.md'), fm({ title: 'Information' }, toMarkdown($els.html())));

  const $h = cheerio.load(read('index.html'));
  const $he = $h('#wsite-content .wsite-section-elements');
  write(out('src/content/pages/home.md'), fm({ title: 'Our Community' }, toMarkdown($he.html())));
  // Logo and banner photo live outside the content area.
  neededAssets.add('/uploads/1/2/0/1/120141198/published/logo.png');
  neededAssets.add('/uploads/1/2/0/1/120141198/editor/cropped-house-back_1.jpg');
}

// ---------------------------------------------------------------- 5. albums

ALBUMS.forEach((id, i) => {
  const $ = cheerio.load(read(`${id}.html`));
  const $els = $('#wsite-content .wsite-section-elements');
  const title = takeTitle($els) || menuById[id]?.label || id;
  const photos = [];
  $els.find('.imageGallery a').each((_, a) => {
    const full = normUrl($(a).attr('href'));
    const thumb = normUrl($(a).find('img').attr('src'));
    const caption = cleanText($(a).closest('[id$="-insideImageContainer' + '"]').text() || '');
    photos.push({ src: full, thumb, caption: caption || '' });
  });
  // Any loose text on the album page.
  $els.find('.imageGallery').remove();
  const intro = cleanText($els.text());
  write(out('src/content/albums', `${id}.yml`), YAML.stringify({ title, order: i + 1, intro: intro || '', cover: photos[0]?.thumb ?? '', photos }));
  console.log(`album ${id}: ${photos.length} photos`);
});

// ---------------------------------------------------------------- 6. posts

const redirects = [];
for (const [listing, dir, base] of [['news.html', 'news', '/news'], ['spiritual-reading.html', 'reading', '/spiritual-reading']]) {
  const $ = cheerio.load(read(listing));
  $('.blog-post').each((_, p) => {
    const link = $(p).find('a.blog-title-link');
    const title = cleanText(link.text());
    const slug = link.attr('href').split('/').pop();
    const [mo, d, y] = cleanText($(p).find('.date-text').text()).split('/');
    const date = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const body = toMarkdown($(p).find('.blog-content').html() || '');
    write(out('src/content', dir, `${slug}.md`), fm({ title, date }, body));
    // Weebly's older permalink format, e.g. /1/post/2021/04/eight-canons.html
    const legacy = ($(p).find('fb\\:like').attr('href') || '').replace(/^http:\/\/UNSET/, '');
    if (legacy && legacy !== `${base}/${slug}`) redirects.push(`${legacy} ${base}/${slug} 301`);
  });
  console.log(`${dir}: ${$('.blog-post').length} posts`);
}

// ---------------------------------------------------------------- 7. redirects

write(out('public/_redirects'), [
  '# Old Weebly addresses -> new pages',
  '/greek.html /music 301',
  '/english.html /music 301',
  '/greek /music 301',
  '/english /music 301',
  '/news/archives/* /news 301',
  '/news/category/* /news 301',
  '/spiritual-reading/archives/* /spiritual-reading 301',
  '/spiritual-reading/category/* /spiritual-reading 301',
  '/1/feed /news/rss.xml 301',
  ...redirects,
  '',
].join('\n'));

// ---------------------------------------------------------------- 8. missing assets

let fetched = 0;
for (const a of neededAssets) {
  const dest = out('public', a);
  if (fs.existsSync(dest)) continue;
  const res = await fetch(LIVE + a);
  if (!res.ok) { console.warn(`  could not fetch ${a}: ${res.status}`); continue; }
  write(dest, Buffer.from(await res.arrayBuffer()));
  fetched++;
}
console.log(`fetched ${fetched} missing assets from the live site`);

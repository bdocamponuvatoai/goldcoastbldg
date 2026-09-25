/**
 * Post-build checks. Exits non-zero on any failure, so CI can gate on it.
 * Port of the Python verify.py.
 *
 *   node verify.mjs
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const DIST = 'dist';
const SITE = 'https://goldcoastbld.com';

const REQUIRED_HEAD = [
  'charset="utf-8"', 'name="viewport"', 'rel="canonical"',
  'og:image', 'og:url', 'twitter:card', 'application/ld+json',
  'apple-touch-icon', 'favicon.ico',
];
const REQUIRED_FILES = [
  'index.html', '404.html', 'robots.txt', 'sitemap.xml', 'favicon.ico',
  'assets/og-image.jpg', 'assets/apple-touch-icon.png', 'assets/logo.png',
];

const fails = [];
const check = (cond, msg) => { if (!cond) fails.push(msg); };

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const pages = [];
for await (const f of walk(DIST)) if (extname(f) === '.html') pages.push(f);
pages.sort();
check(pages.length > 0, 'no HTML was generated');

const resolves = (url) => {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean.startsWith('/')) return true;
  const t = join(DIST, clean);
  return existsSync(t) || existsSync(join(t, 'index.html'));
};

for (const file of pages) {
  const rel = relative(DIST, file).replace(/\\/g, '/');
  const s = await readFile(file, 'utf8');

  // every internal reference resolves, including each srcset candidate
  const urls = [...s.matchAll(/(?:href|src|data-full)="(\/[^"]*)"/g)].map((m) => m[1]);
  for (const m of s.matchAll(/srcset="([^"]+)"/g)) {
    for (const cand of m[1].split(',')) urls.push(cand.trim().split(/\s+/)[0]);
  }
  for (const u of urls) check(resolves(u), `${rel} -> broken reference ${u}`);

  // structure and accessibility
  check((s.match(/<h1[ >]/g) || []).length === 1, `${rel}: needs exactly one <h1>`);
  check(s.includes('<html lang='), `${rel}: missing lang attribute`);

  const imgs = s.match(/<img\b[^>]*>/g) || [];
  check(!imgs.some((i) => !i.includes('alt=')), `${rel}: <img> without alt`);
  // the lightbox placeholder is intentionally bare; everything else is sized
  const sized = imgs.filter((i) => !/^<img alt=""\s*\/?>$/.test(i.trim()));
  check(
    !sized.some((i) => !(i.includes('width=') && i.includes('height='))),
    `${rel}: <img> without width/height`,
  );

  const ids = [...s.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
  check(dupes.length === 0, `${rel}: duplicate id ${[...new Set(dupes)]}`);

  const buttons = s.match(/<button\b[^>]*>/g) || [];
  check(!buttons.some((b) => !b.includes('type=')), `${rel}: <button> without explicit type`);

  // security
  for (const a of s.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []) {
    check(a.includes('noopener'), `${rel}: target=_blank without rel=noopener`);
  }

  for (const tag of REQUIRED_HEAD) check(s.includes(tag), `${rel}: <head> missing ${tag}`);

  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch (e) { fails.push(`${rel}: JSON-LD does not parse (${e.message})`); }
    // a raw '<' means the block could be closed early by its own content
    check(!m[1].includes('<'), `${rel}: JSON-LD contains an unescaped "<"`);
  }
}

for (const name of REQUIRED_FILES) {
  check(existsSync(join(DIST, name)), `missing output file: ${name}`);
}

// sitemap points only at pages that exist, and never at the 404
const sm = await readFile(join(DIST, 'sitemap.xml'), 'utf8');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
check(locs.length > 0, 'sitemap.xml has no <loc> entries');
check(!sm.includes('404'), 'sitemap.xml lists the 404 page');
for (const loc of locs) {
  const p = loc.replace(SITE, '').replace(/^\/|\/$/g, '');
  check(
    existsSync(join(DIST, p, 'index.html')),
    `sitemap lists a page that was not built: ${loc}`,
  );
}

// canonical host matches the sitemap host
for (const file of pages) {
  const m = (await readFile(file, 'utf8')).match(/rel="canonical" href="([^"]+)"/);
  if (m) {
    check(
      m[1].startsWith(SITE),
      `${relative(DIST, file).replace(/\\/g, '/')}: canonical host is not ${SITE}`,
    );
  }
}

const assetCount = (await readdir(join(DIST, 'assets'))).length;
console.log(`checked ${pages.length} pages, ${assetCount} assets`);
if (fails.length) {
  console.log(`\nFAILED (${fails.length}):`);
  for (const f of fails) console.log('  -', f);
  process.exit(1);
}
console.log('all checks passed');

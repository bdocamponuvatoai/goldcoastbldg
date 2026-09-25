"""Post-build checks. Exits non-zero on any failure, so CI can gate on it.

Run after build.py:   python verify.py
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

D = Path(__file__).parent / 'dist'
SITE = 'https://goldcoastbld.com'

REQUIRED_HEAD = [
    'charset="utf-8"', 'name="viewport"', 'rel="canonical"',
    'og:image', 'og:url', 'twitter:card', 'application/ld+json',
    'apple-touch-icon', 'favicon.ico',
]
REQUIRED_FILES = [
    'index.html', '404.html', 'style.css', 'app.js',
    'robots.txt', 'sitemap.xml', 'favicon.ico',
    'assets/og-image.jpg', 'assets/apple-touch-icon.png',
]

fails = []


def check(cond, msg):
    if not cond:
        fails.append(msg)


pages = sorted(D.rglob('*.html'))
check(pages, 'no HTML was generated')

for f in pages:
    rel = f.relative_to(D).as_posix()
    s = f.read_text(encoding='utf-8')

    # every internal reference resolves, including each srcset candidate
    urls = re.findall(r'(?:href|src|data-full)="(/[^"]*)"', s)
    for m in re.findall(r'srcset="([^"]+)"', s):
        urls += [x.strip().rsplit(' ', 1)[0] for x in m.split(',')]
    for u in urls:
        u = u.split('#')[0].split('?')[0]
        t = D / u.lstrip('/')
        check(t.is_file() or (t / 'index.html').is_file(),
              '%s -> broken reference %s' % (rel, u))

    # structure and accessibility
    check(len(re.findall(r'<h1[ >]', s)) == 1, '%s: needs exactly one <h1>' % rel)
    check('<html lang=' in s, '%s: missing lang attribute' % rel)

    imgs = re.findall(r'<img\b[^>]*>', s)
    check(not [i for i in imgs if 'alt=' not in i], '%s: <img> without alt' % rel)
    # the lightbox placeholder is intentionally bare; everything else is sized
    sized = [i for i in imgs if i != '<img alt="">']
    check(not [i for i in sized if not ('width=' in i and 'height=' in i)],
          '%s: <img> without width/height' % rel)

    ids = re.findall(r'\bid="([^"]+)"', s)
    dupes = [k for k, v in Counter(ids).items() if v > 1]
    check(not dupes, '%s: duplicate id %s' % (rel, dupes))

    check(not [b for b in re.findall(r'<button\b[^>]*>', s) if 'type=' not in b],
          '%s: <button> without explicit type' % rel)

    # security
    for a in re.findall(r'<a\b[^>]*target="_blank"[^>]*>', s):
        check('noopener' in a, '%s: target=_blank without rel=noopener' % rel)

    for tag in REQUIRED_HEAD:
        check(tag in s, '%s: <head> missing %s' % (rel, tag))

    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            json.loads(block)
        except ValueError as e:
            fails.append('%s: JSON-LD does not parse (%s)' % (rel, e))
        # a raw '<' means the block could be closed early by its own content
        check('<' not in block, '%s: JSON-LD contains an unescaped "<"' % rel)

# required files
for name in REQUIRED_FILES:
    check((D / name).is_file(), 'missing output file: %s' % name)

# sitemap points only at pages that exist, and never at the 404
sm = (D / 'sitemap.xml').read_text(encoding='utf-8')
locs = re.findall(r'<loc>([^<]+)</loc>', sm)
check(locs, 'sitemap.xml has no <loc> entries')
check('404' not in sm, 'sitemap.xml lists the 404 page')
for loc in locs:
    p = loc.replace(SITE, '').strip('/')
    check((D / p / 'index.html').is_file() if p else (D / 'index.html').is_file(),
          'sitemap lists a page that was not built: %s' % loc)

# canonical host matches the sitemap host
for f in pages:
    m = re.search(r'rel="canonical" href="([^"]+)"', f.read_text(encoding='utf-8'))
    if m:
        check(m.group(1).startswith(SITE),
              '%s: canonical host is not %s' % (f.relative_to(D).as_posix(), SITE))

print('checked %d pages, %d assets' % (len(pages), len(list((D / 'assets').iterdir()))))
if fails:
    print('\nFAILED (%d):' % len(fails))
    for x in fails:
        print('  -', x)
    sys.exit(1)
print('all checks passed')

"""Photography: curation, responsive variants, and the markup that shows them.

Images are read from src/assets (the source of truth) and written to
dist/assets as a set of width variants, so a phone downloads a 480px file
instead of the 2500px original. Every <img> carries width/height taken from
the real file, so the browser reserves the right box before the bytes land.
"""
from pathlib import Path
from PIL import Image
from html import escape

ROOT = Path(__file__).parent
SRC = ROOT / 'src' / 'assets'
OUT = ROOT / 'dist' / 'assets'

# Rendered widths worth generating. A variant is only produced when it is
# actually narrower than the source, so nothing is ever upscaled.
WIDTHS = [480, 768, 1200, 1800]
JPEG_QUALITY = 82

# How wide the image will be drawn, per layout slot. These mirror the
# breakpoints in src/style.css; getting them roughly right is what lets the
# browser pick the small file on a phone.
SIZES = {
    'hero': '100vw',
    'half': '(min-width:1051px) 50vw, (min-width:761px) 50vw, 100vw',
    'lead': '(min-width:761px) 680px, 100vw',
    'card': '(min-width:761px) 600px, 100vw',
}

# Curated original photographs: no shared-building amenities or duplicate views.
SELECTIONS = [[(8, 'Living room & city views'), (10, 'Kitchen cabinetry & finishes'), (11, 'Bathroom'), (9, 'Lake Michigan outlook')], [(1, 'Exterior architecture'), (0, 'Kitchen'), (2, 'Cabinetry & surface details'), (4, 'Kitchen & living connection')], [(0, 'Exterior architecture'), (2, 'Kitchen & gathering space'), (1, 'Entry hall'), (4, 'Cabinetry detail')], [(0, 'Exterior architecture'), (4, 'Open living spaces'), (3, 'Kitchen island'), (1, 'Entry approach')], [(1, 'Exterior architecture'), (0, 'Kitchen & living room'), (3, 'Staircase detailing')], [(0, 'Front elevation'), (1, 'Covered entrance'), (3, 'Exterior perspective'), (4, 'Street view')], [(0, 'Townhome exterior'), (2, 'Kitchen & dining'), (3, 'Living room'), (1, 'Staircase')]]

_size_cache = {}
_built = set()
_built_map = {}


def _rel(src):
    """'/assets/x.jpg' -> 'x.jpg'"""
    return src.split('/')[-1]


def size(src):
    """Intrinsic pixel size of a source image."""
    name = _rel(src)
    if name not in _size_cache:
        with Image.open(SRC / name) as im:
            _size_cache[name] = im.size
    return _size_cache[name]


def build_variants(src):
    """Write the resized files for one image; return [(url, width), ...]
    widest last, always including the original."""
    name = _rel(src)
    if name in _built:
        return _built_map[name]
    stem, ext = name.rsplit('.', 1)
    w0, h0 = size(src)
    OUT.mkdir(parents=True, exist_ok=True)

    made = []
    with Image.open(SRC / name) as im:
        im = im.convert('RGB') if ext.lower() in ('jpg', 'jpeg') else im
        for w in WIDTHS:
            if w >= w0:
                continue
            target = OUT / f'{stem}-{w}.{ext}'
            if not target.exists():
                h = round(h0 * w / w0)
                im.resize((w, h), Image.LANCZOS).save(
                    target, quality=JPEG_QUALITY, optimize=True, progressive=True)
            made.append((f'/assets/{stem}-{w}.{ext}', w))

    # The full-resolution original is always shipped, because the lightbox
    # links straight to it via data-full. It only joins the srcset when it is
    # no wider than the cap -- inline slots never need more than WIDTHS[-1],
    # so a desktop visitor is not made to download a 2500px file to fill a
    # 600px card.
    original = OUT / name
    if not original.exists():
        original.write_bytes((SRC / name).read_bytes())
    if w0 <= WIDTHS[-1]:
        made.append((f'/assets/{name}', w0))

    _built.add(name)
    _built_map[name] = made
    return made



def photo(src, alt, lazy=True, slot='half'):
    """A complete <img>: real dimensions, a srcset of width variants, and a
    sizes hint so the browser can choose before layout."""
    w, h = size(src)
    variants = build_variants(src)
    srcset = ', '.join(f'{u} {vw}w' for u, vw in variants)
    # Fallback src for engines without srcset: the middle variant, never the
    # untouched original.
    fallback = min(variants, key=lambda v: abs(v[1] - 1200))[0]
    bits = [
        f'src="{fallback}"',
        f'srcset="{srcset}"',
        f'sizes="{SIZES.get(slot, SIZES["half"])}"',
        f'alt="{escape(alt, quote=True)}"',
        f'width="{w}"', f'height="{h}"',
        f'loading="{"lazy" if lazy else "eager"}"',
        'decoding="async"',
    ]
    if not lazy:
        bits.append('fetchpriority="high"')
    return '<img ' + ' '.join(bits) + '>'


def cover(p, i):
    return p['local'][SELECTIONS[i][0][0]]


def card(p, i, featured=False):
    return (f'<a class="project-card {"featured" if featured else ""}" data-category="{p["category"]}" href="{p["path"]}/"><div class="image">'
            + photo(cover(p, i), p['short'] + ' — ' + p['location'], slot='card')
            + f'<span class="view" aria-hidden="true">↗</span></div><div class="meta"><div><div class="eyebrow">{p["location"]}</div><h3>{p["short"]}</h3></div><p>{"Renovation" if i == 0 else "Residential"}</p></div></a>')


def project(p, i, notes):
    selected = SELECTIONS[i]
    lead = cover(p, i)
    lead_width = size(lead)[0]
    body = (f'<section class="project-opening"><div class="wrap"><a class="project-back" href="/projects/">← All projects</a><div class="project-opening-grid"><div class="project-title"><div class="eyebrow">{p["location"]}</div><h1>{p["short"]}</h1><p>{p["desc"]}</p><a class="text-link" href="#project-gallery">Explore the photographs <span>↓</span></a></div><figure style="max-width:{min(680, lead_width)}px">'
            + photo(lead, p['short'] + ' — ' + selected[0][1], False, slot='lead')
            + f'<figcaption>{selected[0][1]}<span>01 / {len(selected):02}</span></figcaption></figure></div></div></section>')
    body += ('<section class="project-photography"><div class="wrap">' + notes
             + f'<div class="gallery-heading" id="project-gallery"><div><div class="eyebrow">A closer look</div><h2>Inside the project.</h2></div><p>{len(selected):02} photographs · Select an image to enlarge</p></div><div class="gallery curated-gallery">')
    for j, (idx, label) in enumerate(selected):
        src = p['local'][idx]
        w, h = size(src)
        body += (f'<figure class="gallery-item {"portrait" if h > w else "landscape"}"><button type="button" data-full="{src}" data-caption="{escape(label, quote=True)}" aria-label="Enlarge {escape(label, quote=True)}">'
                 + photo(src, p['short'] + ' — ' + label)
                 + f'<span class="enlarge-label" aria-hidden="true">View photograph ↗</span></button><figcaption><span>{label}</span><span>{j+1:02} / {len(selected):02}</span></figcaption></figure>')
    body += '</div></div></section><dialog class="lightbox" aria-label="Project photographs"><div class="viewer-toolbar"><span class="viewer-caption"></span><button type="button" class="viewer-close" aria-label="Close photograph">Close ✕</button></div><div class="viewer-image"><img alt=""></div><div class="viewer-controls"><button type="button" class="viewer-prev" aria-label="Previous photograph">← Previous</button><span class="viewer-count" aria-live="polite"></span><button type="button" class="viewer-next" aria-label="Next photograph">Next →</button></div></dialog>'
    return body

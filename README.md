# Gold Coast Build

Marketing site for Gold Coast Build, a Chicago residential and commercial
construction company.

Built with [Astro](https://astro.build). Static output — no server, no
database, and no JavaScript framework shipped to the browser. The only
client-side script is 5 KB of progressive enhancement.

| | |
|---|---|
| Framework | Astro 7 (static output) |
| Runtime | Node 20+ |
| Output | 15 HTML pages, 152 asset files, 18.9 MB |
| Build time | ~17s cold, ~2s warm (images are cached) |
| Hosting | Vercel (see [DEPLOY.md](DEPLOY.md)) |

## Quick start

```bash
npm ci
npm run dev          # http://localhost:4321
```

```bash
npm run build        # astro build + prune unreferenced assets
npm run verify       # gate: must print "all checks passed"
npm run preview      # serve the built output
```

## Layout

```
astro.config.mjs        site URL, trailing slashes, image defaults
src/
  data/site.json        all content: projects, FAQ, journey, capabilities
  layouts/Base.astro    <head>, schema, header, footer
  components/           one per section of the site
  pages/                one file per route; [slug].astro fans out the projects
  assets/               original photographs — the source of truth
  styles/style.css      mobile-first stylesheet
  scripts/app.js        nav, project filter, gallery lightbox
public/                 copied verbatim: icons, og image, _headers
scripts/prune.mjs       deletes build assets nothing references
verify.mjs              post-build checks; exits non-zero on failure
dist/                   generated output; safe to delete at any time
```

`dist/` is disposable and git-ignored. Never edit anything inside it.

## Content

Everything editable lives in **`src/data/site.json`** — project names,
locations, descriptions, photo selections, per-project notes, the FAQ, the
process steps and the service capability rows. Components read from it, so a
copy change is a JSON edit rather than a template edit.

Longer prose that only appears once (the About statement, the partnership
section, the editorial feature) lives in its own component under
`src/components/`.

### Adding a photograph

Drop the file in `src/assets/` and reference it from the relevant project's
`images` array in `src/data/site.json`, then add its index and caption to
that project's `selections`. Photographs that are not selected are never
shipped — `scripts/prune.mjs` removes them from the build.

## Images

`src/components/Photo.astro` wraps Astro's `<Image>`. It reads the intrinsic
dimensions, writes `width`/`height` so the layout does not shift, emits a
`srcset` at 480/768/1200/1800 (never wider than the source), and converts to
WebP at quality 72.

`sizes` is set per layout slot — `hero`, `half`, `lead`, `card` — and those
values mirror the breakpoints in `src/styles/style.css`. If you change the
layout widths, change them there too or the browser will pick the wrong file.

## Stylesheet

`src/styles/style.css` is mobile-first: rules outside any media query
describe the phone layout, and `min-width` queries add tablet (761px),
desktop (1051px) and wide (1700px) on top. Two `max-height` tiers compress
the hero on short viewports so the call-to-action clears the fold.

Add new rules in that structure rather than appending an override block at
the end.

## Verification

`npm run verify` is the gate, and CI runs it on every push:

- every internal link and every `srcset` candidate resolves
- exactly one `<h1>` per page, `alt` on every image, no duplicate ids
- canonical, Open Graph, Twitter and JSON-LD present and parsing
- no `target="_blank"` without `rel="noopener"`
- JSON-LD contains no unescaped `<` that could close its own `<script>`
- the sitemap lists only pages that were actually built

## Deployment

See **[DEPLOY.md](DEPLOY.md)** — the full runbook, including the Squarespace
to Vercel migration and the Cloudflare DNS cutover.

The production domain is set once, as `site` in `astro.config.mjs`, and
mirrored in `src/data/site.json`. It drives canonical tags, Open Graph URLs,
`robots.txt` and `sitemap.xml`.

## Security

See **[SECURITY.md](SECURITY.md)**. The site is static with no forms, no user
input, no cookies and no server-side code. Security headers ship in
`vercel.json`, and in `public/_headers` for Netlify or Cloudflare Pages.

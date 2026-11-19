# Security

## Reporting a vulnerability

Email **Office@GoldCoastBld.com** with the details and steps to reproduce.
Please do not open a public issue for a security report.

## Attack surface

This is a static site. There is no server-side code, no database, no user
accounts and no forms. The build runs on a developer machine or in CI;
nothing dynamic runs in production.

Client-side state is limited to the analytics consent choice: one
`localStorage` entry (`gcb:consent`), plus Google Analytics cookies (`_ga*`)
only after a visitor accepts, and only on the live domain.

That removes most of the usual categories — SQL injection, SSRF, session
handling, authentication and file upload are all out of scope because none
of those mechanisms exist.

What remains:

| Surface | Handling |
|---|---|
| Content injection | All page copy is authored in the repository, never user-supplied |
| JSON-LD | `<`, `>` and `&` are escaped to `\u00XX`, so content cannot close its own `<script>` |
| External links | Every `target="_blank"` carries `rel="noopener"`; enforced by `verify.mjs` |
| Third-party origins | Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`); after analytics consent only, Google Tag Manager and GA4 |
| Tag Manager container | `GTM-MMDC2KTN`. **Anyone with Publish rights on it can run script on every page.** Treat that access like commit access, and review the container's users |
| Dependencies | Astro and sharp, build-time only, pinned by `package-lock.json` |

## Response headers

Set in `vercel.json` and applied to every response:

- `Content-Security-Policy` — `default-src 'self'` plus Google Fonts and
  Google's published source list for Tag Manager, GA4 (without Ads
  features) and GTM Preview mode; `frame-ancestors 'none'`,
  `object-src 'none'`, `form-action 'none'`. No `'unsafe-inline'` or
  `'unsafe-eval'` for scripts: every script ships as a file, and
  `verify.mjs` fails the build on an inline one. A tag that needs another
  origin (Ads, Google signals, any other vendor) shows up in Tag Assistant
  under "Page issues" and must be added here and in `public/_headers`.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

`public/_headers` carries the same set in Netlify / Cloudflare Pages format
and is copied into the build. It is **ignored by Vercel**, which reads
`vercel.json` instead.

### Known weakening

`style-src` includes `'unsafe-inline'`. This is required by one inline
`max-width` on the project lead photograph. Removing that inline style —
by generating a class per project instead — would allow a strict
`style-src 'self'`.

## Dependencies

All dependencies are build-time only; none reach the browser. The site ships
no framework JavaScript, only `src/scripts/app.js` and `public/consent.js`.
`@playwright/test` is a dev dependency for the browser tests.

`sharp` processes the photographs committed to this repository and never
untrusted input, so image-parsing CVEs have no reachable path in production.

Keep the tree current and pinned:

```bash
npm audit
npm ci          # installs exactly what package-lock.json specifies
```

Use `npm ci` rather than `npm install` in CI so the lockfile is authoritative.

## Secrets

The repository contains no credentials. Deployment tokens belong in CI
secrets (`secrets.VERCEL_TOKEN`), never in the repository.

Nothing in `dist/` or `node_modules/` is committed; both are git-ignored.

## Things that look like secrets but are not

The business phone number, email address and street address appear in the
page source. They are published contact details for a construction company
and are meant to be public.

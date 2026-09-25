# Security

## Reporting a vulnerability

Email **Office@GoldCoastBld.com** with the details and steps to reproduce.
Please do not open a public issue for a security report.

## Attack surface

This is a static site. There is no server-side code, no database, no user
accounts, no forms, no cookies and no client-side storage. The build runs
on a developer machine or in CI; nothing dynamic runs in production.

That removes most of the usual categories — SQL injection, SSRF, session
handling, authentication and file upload are all out of scope because none
of those mechanisms exist.

What remains:

| Surface | Handling |
|---|---|
| Content injection | All page copy is authored in the repository, never user-supplied |
| JSON-LD | `<`, `>` and `&` are escaped to `\u00XX`, so content cannot close its own `<script>` |
| External links | Every `target="_blank"` carries `rel="noopener"`; enforced by `verify.py` |
| Third-party origins | Google Fonts only (`fonts.googleapis.com`, `fonts.gstatic.com`) |
| Dependencies | Pillow, build-time only, pinned `>=12.3.0` |

## Response headers

Set in `vercel.json` and applied to every response:

- `Content-Security-Policy` — `default-src 'self'` plus Google Fonts;
  `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'none'`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`

`dist/_headers` carries the same set in Netlify / Cloudflare Pages format.
It is **ignored by Vercel**, which reads `vercel.json` instead.

### Known weakening

`style-src` includes `'unsafe-inline'`. This is required by one inline
`max-width` on the project lead photograph. Removing that inline style —
by generating a class per project instead — would allow a strict
`style-src 'self'`.

## Dependencies

Pillow is the only dependency and runs at build time against photographs
committed to this repository. It never processes untrusted input, so
image-parsing CVEs have no reachable path in production. It is still kept
current:

```bash
pip install -U -r requirements.txt
```

`requirements.txt` pins `Pillow>=12.3.0`. Versions below that are affected
by CVE-2026-59203.

## Secrets

The repository contains no credentials. Deployment tokens belong in CI
secrets (`secrets.VERCEL_TOKEN`), never in the repository.

Nothing in `dist/` is committed; it is generated output and git-ignored.

## Things that look like secrets but are not

The business phone number, email address and street address appear in the
page source. They are published contact details for a construction company
and are meant to be public.

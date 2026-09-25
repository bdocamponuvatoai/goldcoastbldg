# Deployment runbook

Moving `goldcoastbld.com` from Squarespace to Vercel, keeping Cloudflare as
the DNS host and Google Workspace as the mail host.

Read this end to end before starting. Steps 1–7 are safe and reversible —
nothing public changes until step 8.

---

## 0. What you are working with

A static site built with Astro. No server, no database, and no JavaScript
framework in the browser — the output in `dist/` is plain files.

| Requirement | Value |
|---|---|
| Node | 20 or newer |
| Install | `npm ci` |
| Build | `npm run build` then `npm run verify` |
| Output | `dist/` |
| Build time | ~17s cold, ~2s warm (image renders are cached) |

**Access you need before starting**

- Write access to the Git remote
- Vercel account with permission to create a project
- Cloudflare dashboard access for the `goldcoastbld.com` zone
- Squarespace login — do not cancel it until step 10 is signed off

---

## 1. Get the code under version control

The repository currently has **zero commits**. Everything exists only on
one machine. Do this first — every later step assumes a remote.

```bash
git add -A
git commit -m "Gold Coast Build site generator"
git branch -M main
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```

`.gitignore` already excludes `dist/` and `__pycache__/`. The build output
is generated, never committed.

---

## 2. Verify locally before anything else

```bash
npm ci
npm run build
npm run verify
```

`npm run verify` must print `all checks passed` and exit 0. It checks every
internal link and `srcset` candidate resolves, one `<h1>` per page, alt
text, canonical and Open Graph tags, JSON-LD validity, `rel="noopener"`
on external links, and that the sitemap only lists pages that were built.

If it fails, stop. It exits non-zero precisely so nothing downstream runs.

Preview it:

```bash
npm run preview
```

---

## 3. Confirm the build is reproducible

```bash
rm -rf dist && npm run build && mv dist dist-a
npm run build && diff -r dist-a dist && echo OK
rm -rf dist-a
```

Two clean builds must be byte-identical. If they are not, something is
reading the clock or the filesystem order — fix it before deploying, or
every deploy will show a spurious diff.

---

## 4. CI

`.github/workflows/ci.yml` runs on every push and pull request: `npm ci`,
`npm run build`, then `npm run verify`.

Confirm it goes green on `main` before touching Vercel. CI is what stops a
broken build reaching production once other people start committing.

---

## 5. Create the Vercel project

1. **New Project** → import the repository.
2. **Framework Preset:** `Astro` (Vercel detects this automatically).
3. Vercel reads `vercel.json` from the repo root, which already sets:
   - `buildCommand`: `npm run build && npm run verify`
   - `outputDirectory`: `dist`
   - security headers and cache policy (see step 6)
4. Deploy.

Node is Vercel's native runtime, so there is no interpreter to provision.
The earlier Python build failed here twice — first on PEP 668
(`externally-managed-environment`), then because the build image ships
Python without `ensurepip`. Neither applies now.

---

## 6. Check the headers landed

`dist/_headers` is **Netlify/Cloudflare Pages format — Vercel ignores it.**
On Vercel the headers come from `vercel.json`. Against the preview URL:

```bash
curl -sI https://<preview>.vercel.app/ | grep -iE \
  'content-security-policy|strict-transport|x-frame|x-content-type|referrer'
```

All five must be present. Also confirm caching is split correctly —
`/assets/*` immutable for a year, HTML `must-revalidate`:

```bash
curl -sI https://<preview>.vercel.app/assets/og-image.jpg | grep -i cache-control
curl -sI https://<preview>.vercel.app/ | grep -i cache-control
```

---

## 7. Set the production domain and rebuild

`site` in `astro.config.mjs` is `https://goldcoastbld.com`, mirrored by
`site.url` in `src/data/site.json`. Together they feed the canonical tags,
Open Graph URLs, `robots.txt` and `sitemap.xml`. Change both.

While you are testing on a `*.vercel.app` URL those tags still claim
`goldcoastbld.com`. That is correct for the final state and wrong for a
long-lived staging site — if this will sit on a preview URL for more than a
day or two, point `SITE` at the preview host, and remember to change it
back before cutover.

Walk the preview: all 7 project pages, the gallery lightbox, the mobile
nav, the contact links. Check the Open Graph card renders
(`/assets/og-image.jpg`, 1200x630).

---

## 8. DNS cutover

Current live state, confirmed by lookup:

```
nameservers   demi.ns.cloudflare.com, dilbert.ns.cloudflare.com
@       A      198.49.23.145            -> Squarespace
www     CNAME  ext-sq.squarespace.com   -> Squarespace
MX      aspmx.l.google.com (+4)         -> Google Workspace
TXT     v=spf1 include:_spf.google.com ~all
TXT     google-site-verification=0D5aAzwl...
CAA     none set
```

Two facts that make this straightforward: every record is **DNS-only (grey
cloud)** — Cloudflare is not proxying, so there is no CDN to untangle — and
there is **no CAA record**, so nothing blocks Vercel from issuing the
certificate.

You keep Cloudflare. You do **not** move nameservers to Vercel.

**Sequence**

1. In Cloudflare, set the TTL on `@` and `www` to **60 seconds**. Wait for
   the previous TTL to expire before continuing. Skipping this wait is what
   leaves visitors stranded on Squarespace for hours.
2. In Vercel, add `goldcoastbld.com` and `www.goldcoastbld.com` to the
   project. Vercel shows the exact records on the domain card.
3. In Cloudflare, change:
   - `@` A record → the IP on the Vercel domain card
   - `www` CNAME → the target on the Vercel domain card

   **Use the values from your own domain card.** Vercel now issues
   per-project records from an anycast pool — newer projects get addresses
   like `216.198.79.1` and CNAMEs like `d1d4fc829fe7bc7c.vercel-dns-017.com`.
   The old `76.76.21.21` and `cname.vercel-dns.com` still resolve but are
   legacy; do not copy them from a tutorial.
4. Keep both records on **DNS only (grey cloud)**. Cloudflare may flip the
   toggle to orange when you edit a record. Orange in front of Vercel gives
   you two stacked CDNs, and in Cloudflare's "Flexible" SSL mode a redirect
   loop.
5. Wait for Vercel's domain card to read **Valid Configuration** and the
   certificate to issue — usually a minute or two.
6. Restore the TTL to Auto.

**Do not touch** the five `MX` records, the `v=spf1` TXT, or the
`google-site-verification` TXT. Changing any of them takes down company
email. They are unrelated to where the website is hosted.

---

## 9. Verify the cutover

```bash
# DNS now answers with Vercel, not 198.49.23.145
curl -s -H 'accept: application/dns-json' \
  'https://cloudflare-dns.com/dns-query?name=goldcoastbld.com&type=A'

# both hostnames serve over HTTPS
curl -sI https://goldcoastbld.com/       | head -1
curl -sI https://www.goldcoastbld.com/   | head -1

# email is untouched
dig +short MX goldcoastbld.com
```

Then by hand:

- A project page and its gallery lightbox
- `/404.html` returns a real 404, not a 200
- `https://goldcoastbld.com/sitemap.xml` loads
- `https://goldcoastbld.com/robots.txt` points at that sitemap

---

## 10. After go-live

- Submit `https://goldcoastbld.com/sitemap.xml` in Google Search Console.
- Watch Search Console coverage for a week. The live Squarespace sitemap was
  compared against this site: 13 of 16 URLs are unchanged, and `vercel.json`
  already 301s the two that moved (`/home` and the one blog article).
  `/broken-link-404-page` needs nothing — it was Squarespace's 404 template.
  Add redirects for anything else that shows up as a 404.
- Test the gallery on a real iOS device. The lightbox uses `<dialog>`,
  which falls back to opening the photograph directly below Safari 15.4.
- Only once all of the above is clean: cancel Squarespace.

---

## Rollback

Nothing here is one-way.

**Bad deploy, DNS already moved** — Vercel keeps every previous deployment.
Open the project's Deployments tab, find the last good one, **Promote to
Production**. Takes effect in seconds, no DNS involved.

**Need to go back to Squarespace entirely** — restore the two Cloudflare
records:

```
@     A      198.49.23.145
www   CNAME  ext-sq.squarespace.com
```

Both DNS-only. This is why step 8.1 lowers the TTL first and step 10 keeps
the Squarespace account open: with a 60s TTL, reverting propagates in about
a minute.

---

## Routine changes after launch

Content lives in `src/data/site.json` and the components under
`src/components/`; photographs in `src/assets/`. Never edit anything in
`dist/` — it is regenerated.

```bash
# edit source, then
npm run build && npm run verify
git commit -am "..." && git push
```

Push to `main` deploys to production. Open a pull request instead and
Vercel builds a preview URL for review first.

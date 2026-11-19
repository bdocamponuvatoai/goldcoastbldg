import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { BrowserContext } from '@playwright/test';

/** Where tests/global-setup.ts builds the site. */
export const SITE_DIR = '.test-dist';

/** The storage key from src/lib/analytics.ts. */
export const CONSENT_KEY = 'gcb:consent';

/** Every request that reaches Google from the page. */
export const GOOGLE = /googletagmanager\.com|google-analytics\.com/;

/** GA4 hits, wherever Google sends them. */
export const COLLECT = /google-analytics\.com\/g\/collect|\/g\/collect\?|\/ccm\/collect/;

/** Every page in the build, plus one that 404s. */
const data = JSON.parse(readFileSync('src/data/site.json', 'utf8')) as {
  projects: { path: string }[];
};
export const PAGES = [
  '/',
  '/about/',
  '/projects/',
  '/residential-construction/',
  '/commercial-construction/',
  '/blog/',
  '/contact/',
  ...data.projects.map((p) => p.path),
  '/no-such-page/',
];

// The headers vercel.json sends with every response, CSP included, so a
// policy violation shows up here as a console error before it ships.
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  headers: { source: string; headers: { key: string; value: string }[] }[];
};
const HEADERS = Object.fromEntries(
  (vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []).map((h) => [h.key, h.value]),
);

/**
 * Serve the build at `origin` and answer GA's collect requests locally.
 * Requests to googletagmanager.com go to the network: the real, published
 * container is what is under test.
 */
export async function serveSite(context: BrowserContext, origin: string) {
  await context.route(COLLECT, (route) => route.fulfill({ status: 204, body: '' }));
  await context.route(`${origin}/**`, async (route) => {
    const path = decodeURIComponent(new URL(route.request().url()).pathname);
    let file = join(SITE_DIR, path);
    if (path.endsWith('/')) file = join(file, 'index.html');
    let status = 200;
    if (!existsSync(file) || statSync(file).isDirectory()) {
      file = join(SITE_DIR, '404.html');
      status = 404;
    }
    await route.fulfill({ status, path: file, headers: HEADERS });
  });
}

/**
 * Store a choice before any page script runs, as a returning visitor would
 * have. Init scripts run on every navigation, so it only writes when nothing
 * is stored yet; a choice made during the test is never overwritten.
 */
export async function seedChoice(
  context: BrowserContext,
  analytics: 'granted' | 'denied',
  { v = 1, ageMs = 0 } = {},
) {
  await context.addInitScript(
    ([key, value]) => {
      try {
        if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
      } catch { /* storage blocked */ }
    },
    [CONSENT_KEY, JSON.stringify({ v, analytics, at: Date.now() - ageMs })] as const,
  );
}

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { SITE_DIR } from './site';

/**
 * Build the site as a Vercel production build would, so the GTM container is
 * on the page, into its own directory. Set SKIP_BUILD=1 to reuse the last one.
 */
export default function globalSetup() {
  if (!process.env.SKIP_BUILD) {
    execSync(`npx astro build --outDir ${SITE_DIR}`, {
      stdio: 'inherit',
      env: { ...process.env, VERCEL_ENV: 'production' },
    });
  }
  const html = readFileSync(`${SITE_DIR}/index.html`, 'utf8');
  if (!/data-gtm-id="GTM-[A-Z0-9]+"/.test(html)) {
    throw new Error(`${SITE_DIR}/ is not a production build: no GTM ID on the page`);
  }
}

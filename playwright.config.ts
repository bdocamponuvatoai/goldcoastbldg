import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests for the analytics consent card (tests/consent.spec.ts).
 *
 * The global setup builds the site with VERCEL_ENV=production into .test-dist/
 * (dist/ is left alone), and tests/site.ts serves that build at the real
 * production hostname by intercepting requests, with the headers from
 * vercel.json, CSP included. Nothing is deployed and no local server runs.
 *
 *   npm run test:e2e
 */
export default defineConfig({
  testDir: 'tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'https://goldcoastbld.com',
    launchOptions: {
      // Safety net under the routes in tests/site.ts, which answer GA's
      // collect requests locally: even a request they missed could never
      // resolve, so test runs never count as visits on the live property.
      args: ['--host-resolver-rules=MAP *.google-analytics.com ~NOTFOUND, MAP google-analytics.com ~NOTFOUND'],
    },
  },
});

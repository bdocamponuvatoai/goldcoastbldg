/**
 * Google Tag Manager, loaded by public/consent.js only after the visitor
 * accepts analytics cookies.
 *
 * Production only, enforced twice:
 *
 * 1. At build time. Vercel sets VERCEL_ENV=production only when building a
 *    production deployment. Preview deployments, CI, `npm run build` and
 *    `astro dev` get an empty ID, so their HTML never names the container.
 * 2. At run time. consent.js loads the container only when the page is served
 *    from one of PRODUCTION_HOSTS, so a production build opened anywhere else
 *    (its *.vercel.app URL before the DNS cutover, `astro preview`) never
 *    reports to the live GA4 property.
 *
 * Anyone with Publish rights on this container can run script on every page
 * of the site. Treat access to it like commit access to this repository.
 */
export const GTM_ID = process.env.VERCEL_ENV === 'production' ? 'GTM-MMDC2KTN' : '';

/** The live site. Keep in step with `site` in astro.config.mjs. */
export const PRODUCTION_HOSTS = ['goldcoastbld.com', 'www.goldcoastbld.com'];

/** localStorage key for the visitor's choice. The schema version lives in consent.js. */
export const CONSENT_STORAGE_KEY = 'gcb:consent';

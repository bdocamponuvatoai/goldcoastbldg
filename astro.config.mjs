// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://goldcoastbld.com',

  // The existing site serves /about/ -> /about/index.html and has those URLs
  // indexed, so the directory format and trailing slashes are kept exactly.
  trailingSlash: 'always',
  build: { format: 'directory', assets: 'assets' },

  // sitemap.xml is hand-rolled in src/pages/sitemap.xml.ts rather than using
  // @astrojs/sitemap, which emits sitemap-index.xml. The old URL is already
  // in Search Console and in robots.txt.

  image: {
    // Sharp is the default; JPEG is kept as the output format so the images
    // stay byte-comparable with the previous build. Switching to webp/avif is
    // a one-line change here once it has been eyeballed.
    responsiveStyles: false,
  },

  devToolbar: { enabled: false },

  vite: {
    build: {
      // Astro inlines any script under 4 KB into the page, and the CSP
      // (script-src 'self', no 'unsafe-inline') then blocks it, which left the
      // nav, project filter and lightbox dead in production. Scripts always
      // ship as files; everything else keeps the default (undefined).
      assetsInlineLimit: (file) => (file.endsWith('.js') ? false : undefined),
    },
  },
});

// Hand-rolled rather than @astrojs/sitemap, which emits sitemap-index.xml.
// /sitemap.xml is the URL already in robots.txt and Search Console.
import type { APIRoute } from 'astro';
import data from '../data/site.json';

const SITE = data.site.url;

const paths = [
  '/', '/about/', '/projects/', '/residential-construction/',
  '/commercial-construction/', '/contact/', '/blog/',
  ...data.projects.map((p) => p.path),
];

export const GET: APIRoute = () => {
  const today = new Date().toISOString().slice(0, 10);
  const urls = paths
    .map(
      (u) =>
        `<url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod>` +
        `<changefreq>monthly</changefreq>` +
        `<priority>${u === '/' ? '1.0' : '0.7'}</priority></url>`,
    )
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};

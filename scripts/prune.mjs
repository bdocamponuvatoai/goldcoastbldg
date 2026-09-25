/**
 * Delete build assets nothing references.
 *
 * Vite emits the untouched original for every image reachable from an
 * `import.meta.glob`, whether or not a processed variant is what actually
 * gets used — and the glob matches all 49 source photographs, including the
 * ~20 that only exist as the curation pool. That is ~18MB of files no page
 * links to. The Python build pruned the same way.
 */
import { readdir, readFile, stat, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DIST = 'dist';
const SCAN = new Set(['.html', '.css', '.xml', '.txt', '.js']);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// every /assets/<file> mentioned anywhere in the built output
const referenced = new Set();
for await (const file of walk(DIST)) {
  if (!SCAN.has(extname(file))) continue;
  const text = await readFile(file, 'utf8');
  for (const m of text.matchAll(/\/assets\/([A-Za-z0-9._-]+)/g)) referenced.add(m[1]);
}

const assetDir = join(DIST, 'assets');
let removed = 0;
let freed = 0;
for (const name of await readdir(assetDir)) {
  if (referenced.has(name)) continue;
  const p = join(assetDir, name);
  freed += (await stat(p)).size;
  await unlink(p);
  removed++;
}

const kept = (await readdir(assetDir)).length;
console.log(
  `pruned ${removed} unreferenced asset(s), freed ${(freed / 1048576).toFixed(1)} MB; ` +
    `${kept} files remain`,
);

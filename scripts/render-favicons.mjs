// Renders raster favicons from docs/public/favicon.svg at every size major
// platforms want to see explicitly (Google SERP, iOS home screen, Chrome/Android
// PWA install, Windows tiles). This is a one-shot regeneration script and NOT
// wired into the site build: PNGs are committed in docs/public/ alongside the
// SVG. Rerun this only when favicon.svg changes.
//
// Uses @resvg/resvg-wasm, already a transitive dep via
// @nolebase/vitepress-plugin-og-image. No native compilation, works everywhere
// the site build works.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(root, 'docs', 'public');

const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm');
await initWasm(await readFile(wasmPath));

const svg = await readFile(path.join(publicDir, 'favicon.svg'), 'utf8');

// Sizes chosen to match:
// - Google SERP favicon (48-multiple, 96/192 satisfy the guideline)
// - iOS/iPadOS apple-touch-icon (180)
// - Android/Chrome PWA install (192, 512)
// - Legacy favicon.ico fallback (generated separately, see below)
const targets = [
  { size: 96, name: 'favicon-96.png' },
  { size: 192, name: 'favicon-192.png' },
  { size: 512, name: 'favicon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
];

for (const { size, name } of targets) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  await writeFile(path.join(publicDir, name), png);
  console.log(`  wrote ${name} (${size}x${size}, ${png.length} bytes)`);
}

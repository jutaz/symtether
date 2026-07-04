/**
 * Post-tsc build step: copy grammars into `grammars/` and produce a
 * single-file bundle at `dist/cli.js`. Both run from one node process
 * so `npm run build` stays `tsc && node scripts/bundle-cli.mjs` (each
 * extra `node` invocation costs ~80ms of boot).
 *
 * Why bundle: bundling our own `src/**` into one file lets Node parse
 * a single module instead of walking our internal graph on every CLI
 * invocation. It also lets us keep source-map-linked stack traces and
 * a legal-comments sidecar without shipping the whole tsc-emitted tree.
 *
 * What stays external is everything in `dependencies`:
 * - Runtime deps (commander, globby, remark, unified, picocolors, and so
 *   on) resolve from the installed `node_modules` at runtime, exactly like
 *   `dist/index.js` (the library entry) already does. This keeps the
 *   `dependencies` block in package.json meaningful and avoids shipping
 *   a second inlined copy of every runtime dep inside `dist/cli.js`.
 * - `web-tree-sitter` in particular uses `import.meta.url` to locate its
 *   sibling `.wasm`, and bundling would need file-loader gymnastics anyway.
 * - Node builtins. Never bundle these.
 *
 * The externals list is derived from `package.json.dependencies` so it
 * stays in sync automatically; adding a runtime dep is enough, no edit
 * here required.
 *
 * The output lands at `dist/cli.js`, replacing the tsc-emitted CLI file.
 * That path is deliberate: `bin` in package.json, tests, and the
 * package-root discovery in `src/languages/index.ts` (relative to
 * `import.meta.url`) all keep working unchanged.
 */
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import './copy-grammars.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Derive runtime externals from package.json so the list can't drift.
// Match both bare specifiers (`commander`) and deep subpath imports
// (`unist-util-visit/do`) with the `pkg/*` companion entry, because
// esbuild's external matcher treats them as separate patterns.
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
const runtimeDeps = Object.keys(pkg.dependencies ?? {});
const external = runtimeDeps.flatMap((name) => [name, `${name}/*`]);

const result = await build({
  entryPoints: [path.join(ROOT, 'src/cli.ts')],
  outfile: path.join(ROOT, 'dist/cli.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  // Node 20 is the floor for the published package (see package.json
  // engines). Anything newer would drop syntax support on old runners.
  target: 'node20',
  // The shebang from src/cli.ts is preserved by esbuild automatically.
  // `import.meta.url` stays intact under `platform: node` (used by our
  // own path math in languages/index.ts to locate `../grammars/`).
  //
  // Runtime `dependencies` are kept external (resolved from
  // node_modules at runtime), so the `require` calls that some CJS deps
  // do internally no longer land in the bundle. The `createRequire`
  // shim below is retained defensively in case a future refactor pulls
  // a CJS module back into the bundled `src/**` graph.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  external,
  // Sourcemaps land at `dist/cli.js.map` and reference `src/**` files so
  // stack traces in production stay actionable.
  sourcemap: true,
  sourcesContent: false,
  // Minifying doesn't help startup meaningfully once the file is in the
  // Node code cache; it hurts stack traces. Skip it.
  minify: false,
  // Legal comments (mostly upstream license blocks) go to a sidecar so
  // the CLI stays readable. We keep the bundle license-compliant this way.
  legalComments: 'linked',
  // Log a summary so builds are auditable.
  logLevel: 'info',
  metafile: true,
});

// Print a size summary so regressions are obvious in build output.
const { outputs } = result.metafile;
const bundle =
  outputs[path.relative(process.cwd(), path.join(ROOT, 'dist/cli.js'))];
if (bundle) {
  const kb = (bundle.bytes / 1024).toFixed(0);
  const inputCount = Object.keys(bundle.inputs).length;
  console.log(`bundled ${inputCount} modules into dist/cli.js (${kb} kB)`);
}

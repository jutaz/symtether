/**
 * Post-tsc build step: copy grammars into `grammars/` and produce a
 * single-file bundle at `dist/cli.js`. Both run from one node process
 * so `npm run build` stays `tsc && node scripts/bundle-cli.mjs` (each
 * extra `node` invocation costs ~80ms of boot).
 *
 * Why bundle: every subprocess pays the module-graph traversal cost of
 * ~180 files (globby, unified, remark-parse, mdast-util-*, micromark-*,
 * commander, picocolors, plus our src/ tree). Cold `node dist/cli.js
 * --version` was ~150ms of pure module loading. Bundling collapses this
 * to one file that Node parses once, saving ~70-100ms per subprocess in
 * exchange for a build step.
 *
 * What stays external:
 * - `web-tree-sitter` — uses `import.meta.url` to locate its sibling
 *   `.wasm`; bundling would either need file-loader gymnastics or a
 *   runtime patch, and the win is small (its module-load cost is
 *   already dominated by the WASM instantiation we can't avoid).
 * - Node builtins — never bundle these.
 *
 * The output lands at `dist/cli.js`, replacing the tsc-emitted CLI file.
 * That path is deliberate: `bin` in package.json, tests, and the
 * package-root discovery in `src/languages/index.ts` (relative to
 * `import.meta.url`) all keep working unchanged.
 */
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import './copy-grammars.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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
  // Some CJS deps (commander, mdast-util-*) call `require()` for lazy
  // internal loads. When esbuild emits ESM, those calls have no
  // `require` in scope and fail at runtime. Inject a `createRequire`
  // shim so bundled CJS runs correctly. Standard pattern documented in
  // esbuild's ESM/Node section.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  // Keep web-tree-sitter external; see file header.
  external: ['web-tree-sitter'],
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

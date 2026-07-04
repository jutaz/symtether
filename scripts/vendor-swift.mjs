// Re-vendors the Swift grammar into vendor/grammars/. Needs Docker: the
// tree-sitter CLI compiles WASM through an emscripten image. Regular builds
// never run this, because copy-grammars.mjs picks up the committed
// artifacts.
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'vendor', 'grammars');
const swiftDir = path.dirname(
  require.resolve('tree-sitter-swift/package.json'),
);

const work = await mkdtemp(path.join(tmpdir(), 'symtether-vendor-'));
try {
  const wasm = path.join(work, 'swift.wasm');
  execFileSync(
    'npx',
    ['tree-sitter-cli@0.25.10', 'build', '--wasm', '-o', wasm, swiftDir],
    { stdio: 'inherit' },
  );
  await copyFile(wasm, path.join(out, 'swift.wasm'));
  await copyFile(
    path.join(swiftDir, 'queries', 'tags.scm'),
    path.join(out, 'swift.tags.scm'),
  );
  console.log('vendored swift.wasm + swift.tags.scm');
} finally {
  await rm(work, { recursive: true, force: true });
}

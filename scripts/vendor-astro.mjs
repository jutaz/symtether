// Re-vendors the Astro grammar into vendor/grammars/. Needs Docker: the
// tree-sitter CLI compiles WASM through an emscripten image. Regular builds
// never run this, because copy-grammars.mjs picks up the committed
// artifacts.
//
// Unlike Swift, upstream publishes no npm package at all, so the grammar is
// cloned from git at a pinned revision. The checked-out tree predates
// tree-sitter.json, which the CLI now requires, so we write a minimal one.
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'https://github.com/virchau13/tree-sitter-astro.git';
const REVISION = '213f6e6973d9b456c6e50e86f19f66877e7ef0ee';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'vendor', 'grammars');

const TREE_SITTER_JSON = JSON.stringify(
  {
    grammars: [
      {
        name: 'astro',
        camelcase: 'Astro',
        scope: 'source.astro',
        path: '.',
        'file-types': ['astro'],
        'injection-regex': 'astro',
      },
    ],
    metadata: {
      version: '0.0.1',
      license: 'MIT',
      description: 'Astro grammar for tree-sitter',
      authors: [{ name: 'virchau13' }],
      links: { repository: 'https://github.com/virchau13/tree-sitter-astro' },
    },
  },
  null,
  2,
);

const work = await mkdtemp(path.join(tmpdir(), 'symtether-vendor-'));
try {
  const src = path.join(work, 'tree-sitter-astro');
  execFileSync('git', ['clone', '--quiet', REPO, src], { stdio: 'inherit' });
  execFileSync('git', ['checkout', '--quiet', REVISION], {
    cwd: src,
    stdio: 'inherit',
  });
  await writeFile(path.join(src, 'tree-sitter.json'), TREE_SITTER_JSON);

  const wasm = path.join(work, 'astro.wasm');
  execFileSync(
    'npx',
    ['tree-sitter-cli@0.25.10', 'build', '--wasm', '-o', wasm, src],
    { stdio: 'inherit' },
  );
  await copyFile(wasm, path.join(out, 'astro.wasm'));
  console.log(`vendored astro.wasm from ${REVISION.slice(0, 7)}`);
} finally {
  await rm(work, { recursive: true, force: true });
}

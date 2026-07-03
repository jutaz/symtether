// Copies tree-sitter WASM grammars and their tags.scm queries out of the
// grammar dev-dependencies into grammars/, which ships with the npm package.
// Grammar packages are devDependencies on purpose: their `install` scripts
// run node-gyp for the *native* bindings, which we never use — the published
// package carries only the prebuilt WASM (no native compilation, ever).
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'grammars');

const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`));

// [source package, wasm file in package, output basename]
const grammars = [
  ['tree-sitter-typescript', 'tree-sitter-typescript.wasm', 'typescript'],
  ['tree-sitter-typescript', 'tree-sitter-tsx.wasm', 'tsx'],
  ['tree-sitter-javascript', 'tree-sitter-javascript.wasm', 'javascript'],
  ['tree-sitter-python', 'tree-sitter-python.wasm', 'python'],
];

await mkdir(outDir, { recursive: true });

for (const [pkg, wasm, out] of grammars) {
  const dir = pkgDir(pkg);
  await copyFile(path.join(dir, wasm), path.join(outDir, `${out}.wasm`));
  await copyFile(
    path.join(dir, 'queries', 'tags.scm'),
    path.join(outDir, `${out}.tags.scm`),
  );
}

console.log(`Copied ${grammars.length} grammars to grammars/`);

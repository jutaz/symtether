// Copies tree-sitter WASM grammars and their tags.scm queries out of the
// grammar dev-dependencies into grammars/, which ships with the npm package.
// Grammar packages are devDependencies on purpose: their `install` scripts
// run node-gyp for the *native* bindings, which we never use — the published
// package carries only the prebuilt WASM (no native compilation, ever).
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outDir = path.join(root, 'grammars');

const pkgDir = (name) => path.dirname(require.resolve(`${name}/package.json`));

// [source package, wasm file in package, output basename, extra-query basenames]
// Extras live in queries/*.extra.scm and cover definitions the upstream
// tags.scm misses (const/let/var, TS namespaces, Python class attributes).
const grammars = [
  // The resolver concatenates javascript.tags.scm with typescript.tags.scm
  // at load time, so the JS extras must appear only in the JS file —
  // duplicated patterns would produce duplicate matches and skew hashes.
  [
    'tree-sitter-typescript',
    'tree-sitter-typescript.wasm',
    'typescript',
    ['typescript'],
  ],
  ['tree-sitter-typescript', 'tree-sitter-tsx.wasm', 'tsx', ['typescript']],
  [
    'tree-sitter-javascript',
    'tree-sitter-javascript.wasm',
    'javascript',
    ['javascript'],
  ],
  ['tree-sitter-python', 'tree-sitter-python.wasm', 'python', ['python']],
  ['tree-sitter-go', 'tree-sitter-go.wasm', 'go', ['go']],
  ['tree-sitter-rust', 'tree-sitter-rust.wasm', 'rust', ['rust']],
  ['tree-sitter-java', 'tree-sitter-java.wasm', 'java', ['java']],
  ['tree-sitter-ruby', 'tree-sitter-ruby.wasm', 'ruby', ['ruby']],
  // Full PHP grammar (not php_only): real .php files embed HTML.
  ['tree-sitter-php', 'tree-sitter-php.wasm', 'php', ['php']],
  ['tree-sitter-c', 'tree-sitter-c.wasm', 'c', ['c']],
  ['tree-sitter-cpp', 'tree-sitter-cpp.wasm', 'cpp', ['cpp']],
  ['tree-sitter-c-sharp', 'tree-sitter-c_sharp.wasm', 'c_sharp', ['c_sharp']],
  // Kotlin and Bash ship no upstream tags.scm — our extras ARE the query.
  [
    '@tree-sitter-grammars/tree-sitter-kotlin',
    'tree-sitter-kotlin.wasm',
    'kotlin',
    ['kotlin'],
  ],
  ['tree-sitter-bash', 'tree-sitter-bash.wasm', 'bash', ['bash']],
  ['tree-sitter-scala', 'tree-sitter-scala.wasm', 'scala', []],
  ['tree-sitter-elixir', 'tree-sitter-elixir.wasm', 'elixir', []],
  [
    '@tree-sitter-grammars/tree-sitter-lua',
    'tree-sitter-lua.wasm',
    'lua',
    ['lua'],
  ],
];

await mkdir(outDir, { recursive: true });

for (const [pkg, wasm, out, extras] of grammars) {
  const dir = pkgDir(pkg);
  await copyFile(path.join(dir, wasm), path.join(outDir, `${out}.wasm`));
  const upstream = await readFile(
    path.join(dir, 'queries', 'tags.scm'),
    'utf8',
  ).catch(() => ''); // no upstream tags.scm: extras are the whole query
  const extraSources = await Promise.all(
    extras.map((e) =>
      readFile(path.join(root, 'queries', `${e}.extra.scm`), 'utf8'),
    ),
  );
  await writeFile(
    path.join(outDir, `${out}.tags.scm`),
    [upstream, ...extraSources].join('\n'),
  );
}

console.log(`Copied ${grammars.length} grammars to grammars/`);

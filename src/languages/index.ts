import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Language, Parser, Query } from 'web-tree-sitter';
import type { SymbolKind } from '../types.js';

/**
 * Grammar registry: file extension -> lazily-loaded tree-sitter language
 * plus its tags query. Grammars are WASM files bundled in `grammars/`;
 * languages are data, matching logic lives in the resolver (§6).
 */

/**
 * Locate our package root by walking up from this module's on-disk
 * location until we find a directory that contains both `package.json`
 * (a Node package boundary) and `grammars/` (our marker). The published
 * layout is `<pkgroot>/dist/**` with grammars at `<pkgroot>/grammars/`,
 * and this walk works regardless of how deep the caller sits under
 * `dist/`:
 *
 *   - `dist/languages/index.js` (tsc per-file output)
 *   - `dist/cli.js`             (esbuild single-file bundle)
 *   - `dist/index.js`           (library entry)
 *
 * Requiring **both** markers together is what makes this robust in
 * monorepos and pnpm workspaces: an intermediate `package.json` that
 * isn't ours (a workspace root, a hoisted dep's parent) is skipped
 * because it has no `grammars/` sibling; the walk continues until it
 * finds our own root.
 *
 * Not depth-capped: filesystem walks always terminate at the root, and
 * an environment where our own package root isn't findable is a
 * packaging bug that should surface as a clear error rather than a
 * silent fallback to a wrong path.
 */
export function findGrammarDir(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (
      existsSync(path.join(dir, 'package.json')) &&
      existsSync(path.join(dir, 'grammars'))
    ) {
      return path.join(dir, 'grammars');
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `symtether: could not locate grammars/ directory by walking up from ${startDir}. ` +
          `Expected <pkgroot>/grammars/ as a sibling of <pkgroot>/package.json. ` +
          `This is a packaging bug. Verify the installed package includes the grammars/ folder.`,
      );
    }
    dir = parent;
  }
}

// Resolved lazily on first grammar load, not at module init: `existsSync`
// I/O has no business on the import path, and lazy resolution keeps a
// natural hook for a future env-var override without churn.
let GRAMMAR_DIR: string | null = null;
function grammarDir(): string {
  GRAMMAR_DIR ??= findGrammarDir(path.dirname(fileURLToPath(import.meta.url)));
  return GRAMMAR_DIR;
}

interface GrammarSpec {
  /** Grammar/wasm basename in grammars/. */
  grammar: string;
  /**
   * tags.scm basenames to concatenate. The TS grammar's own tags query only
   * covers TS-specific nodes and is meant to extend the JS one. Same
   * layering GitHub code navigation uses.
   */
  tags: string[];
}

const SPECS: Record<string, GrammarSpec> = {
  '.ts': { grammar: 'typescript', tags: ['javascript', 'typescript'] },
  '.mts': { grammar: 'typescript', tags: ['javascript', 'typescript'] },
  '.cts': { grammar: 'typescript', tags: ['javascript', 'typescript'] },
  '.tsx': { grammar: 'tsx', tags: ['javascript', 'tsx'] },
  '.js': { grammar: 'javascript', tags: ['javascript'] },
  '.mjs': { grammar: 'javascript', tags: ['javascript'] },
  '.cjs': { grammar: 'javascript', tags: ['javascript'] },
  '.jsx': { grammar: 'javascript', tags: ['javascript'] },
  '.py': { grammar: 'python', tags: ['python'] },
  '.go': { grammar: 'go', tags: ['go'] },
  '.rs': { grammar: 'rust', tags: ['rust'] },
  '.java': { grammar: 'java', tags: ['java'] },
  '.rb': { grammar: 'ruby', tags: ['ruby'] },
  '.php': { grammar: 'php', tags: ['php'] },
  '.c': { grammar: 'c', tags: ['c'] },
  '.h': { grammar: 'c', tags: ['c'] },
  '.cpp': { grammar: 'cpp', tags: ['cpp'] },
  '.cc': { grammar: 'cpp', tags: ['cpp'] },
  '.cxx': { grammar: 'cpp', tags: ['cpp'] },
  '.hpp': { grammar: 'cpp', tags: ['cpp'] },
  '.hh': { grammar: 'cpp', tags: ['cpp'] },
  '.cs': { grammar: 'c_sharp', tags: ['c_sharp'] },
  '.kt': { grammar: 'kotlin', tags: ['kotlin'] },
  '.kts': { grammar: 'kotlin', tags: ['kotlin'] },
  '.sh': { grammar: 'bash', tags: ['bash'] },
  '.bash': { grammar: 'bash', tags: ['bash'] },
  '.scala': { grammar: 'scala', tags: ['scala'] },
  '.sc': { grammar: 'scala', tags: ['scala'] },
  '.ex': { grammar: 'elixir', tags: ['elixir'] },
  '.exs': { grammar: 'elixir', tags: ['elixir'] },
  '.lua': { grammar: 'lua', tags: ['lua'] },
  '.swift': { grammar: 'swift', tags: ['swift'] },
};

/**
 * Maps `#sym:` kind disambiguators (SPEC §5.1's closed set) to the
 * tags.scm capture kinds (`@definition.<kind>`) that satisfy them.
 * Capture kinds absent from a row never satisfy that `<kind>` filter.
 *
 * Exported as the single source of truth: the kind-mapping appendix in
 * docs/guide.md is asserted against this table by test/languages.test.ts.
 * Change one and the test forces you to change the other.
 */
export const KIND_MAP: Readonly<Record<SymbolKind, readonly string[]>> = {
  fn: ['function', 'method', 'macro'],
  class: ['class', 'struct', 'object'],
  type: ['interface', 'type', 'enum', 'module', 'class', 'struct', 'object'],
  const: ['constant', 'field', 'property', 'variable'],
};

export function kindSatisfies(
  refKind: string,
  definitionKind: string,
): boolean {
  return KIND_MAP[refKind as SymbolKind]?.includes(definitionKind) ?? false;
}

/** Extensions with a bundled grammar, for docs and tooling. */
export function supportedExtensions(): string[] {
  return Object.keys(SPECS).sort();
}

export interface LoadedLanguage {
  language: Language;
  tagsQuery: Query;
  newParser(): Parser;
}

let parserInitialized: Promise<void> | null = null;
const cache = new Map<string, Promise<LoadedLanguage | null>>();

/** Load the grammar for a file extension, or `null` when unsupported (tier 2). */
export function loadLanguage(ext: string): Promise<LoadedLanguage | null> {
  const key = ext.toLowerCase();
  let loaded = cache.get(key);
  if (!loaded) {
    loaded = load(SPECS[key]);
    cache.set(key, loaded);
  }
  return loaded;
}

export function isSupportedExtension(ext: string): boolean {
  return ext.toLowerCase() in SPECS;
}

async function load(
  spec: GrammarSpec | undefined,
): Promise<LoadedLanguage | null> {
  if (!spec) return null;
  parserInitialized ??= Parser.init();
  await parserInitialized;

  const dir = grammarDir();
  const language = await Language.load(path.join(dir, `${spec.grammar}.wasm`));
  const tagsSources = await Promise.all(
    spec.tags.map((t) => readFile(path.join(dir, `${t}.tags.scm`), 'utf8')),
  );
  const tagsQuery = new Query(language, tagsSources.join('\n'));

  return {
    language,
    tagsQuery,
    newParser() {
      const parser = new Parser();
      parser.setLanguage(language);
      return parser;
    },
  };
}

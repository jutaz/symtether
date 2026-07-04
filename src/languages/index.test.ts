import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findGrammarDir } from './index.js';

/**
 * Package-root discovery for `grammars/`. The rules that matter:
 *   - the returned path is `<pkgroot>/grammars` where <pkgroot> also
 *     carries a `package.json`;
 *   - the walk succeeds regardless of how deep under `dist/` we start
 *     (per-file tsc output vs. single-file bundle);
 *   - an intermediate `package.json` that isn't ours (no `grammars/`
 *     sibling) doesn't confuse the lookup — this is the monorepo /
 *     pnpm-workspace case;
 *   - a missing `grammars/` sibling throws a clear packaging-bug error
 *     rather than silently returning a wrong path.
 */
describe('findGrammarDir', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'symtether-grammar-test-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function makePkg(dir: string, withGrammars: boolean): void {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'package.json'), '{}');
    if (withGrammars) mkdirSync(path.join(dir, 'grammars'));
  }

  it('finds grammars/ from the same directory as package.json', () => {
    makePkg(root, true);
    expect(findGrammarDir(root)).toBe(path.join(root, 'grammars'));
  });

  it('finds grammars/ from a nested dist/ subtree (tsc layout)', () => {
    makePkg(root, true);
    const nested = path.join(root, 'dist', 'languages');
    mkdirSync(nested, { recursive: true });
    expect(findGrammarDir(nested)).toBe(path.join(root, 'grammars'));
  });

  it('finds grammars/ from dist/ directly (bundled layout)', () => {
    makePkg(root, true);
    const nested = path.join(root, 'dist');
    mkdirSync(nested, { recursive: true });
    expect(findGrammarDir(nested)).toBe(path.join(root, 'grammars'));
  });

  it('skips an intermediate package.json without a grammars/ sibling', () => {
    // Simulates a monorepo: workspace root has package.json but no
    // grammars/; our package is a nested folder that has both.
    makePkg(root, false); // workspace root
    const pkg = path.join(root, 'packages', 'symtether');
    makePkg(pkg, true); // our real package root
    const nested = path.join(pkg, 'dist', 'languages');
    mkdirSync(nested, { recursive: true });
    expect(findGrammarDir(nested)).toBe(path.join(pkg, 'grammars'));
  });

  it('throws a packaging-bug error when no matching root exists', () => {
    // No package.json + grammars/ pair anywhere above `start`.
    const start = path.join(root, 'nested', 'deep');
    mkdirSync(start, { recursive: true });
    expect(() => findGrammarDir(start)).toThrow(/could not locate grammars/);
  });
});

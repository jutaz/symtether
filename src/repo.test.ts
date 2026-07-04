import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRepoRoot, resolveTarget, toPosix } from './repo.js';

describe('findRepoRoot', () => {
  it('falls back to the given cwd when no .git exists anywhere above', () => {
    const root = findRepoRoot('/tmp');
    expect(path.isAbsolute(root)).toBe(true);
  });
});

describe('resolveTarget', () => {
  it('rejects escape via just enough ../ segments', () => {
    expect(resolveTarget('/repo', 'docs/a.md', '../../x.ts')).toBeNull();
    // Exactly to the root is fine:
    expect(resolveTarget('/repo', 'docs/a.md', '../x.ts')).toBe('x.ts');
  });

  it('treats /-prefix as repo root even from deeply nested docs', () => {
    expect(resolveTarget('/repo', 'a/b/c/d.md', '/src/x.ts')).toBe('src/x.ts');
  });
});

describe('toPosix', () => {
  it('is identity for already-posix paths', () => {
    expect(toPosix('a/b/c.ts')).toBe('a/b/c.ts');
  });
});

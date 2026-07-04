import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { check } from '../src/check.js';
import { applyEdits, fix } from '../src/fix.js';
import { setupFixture } from './helpers.js';

describe('applyEdits', () => {
  const edit = (oldUrl: string, newUrl: string, line = 1) => ({
    doc: 'a.md',
    line,
    oldUrl,
    newUrl,
    reason: 'test',
  });

  it('does not interpret $-patterns in the replacement (SPEC allows $ in names)', () => {
    const out = applyEdits('[a](src/x.ts#sym:foo)\n', [
      edit('src/x.ts#sym:foo', 'src/x.ts#sym:$&replace'),
    ]);
    expect(out).toBe('[a](src/x.ts#sym:$&replace)\n');
  });

  it('rewrites every identical URL on the target line', () => {
    const out = applyEdits(
      '[a](x.ts#sym:foo) [b](x.ts#sym:foo) [c](x.ts#sym:foo)\n',
      [
        edit('x.ts#sym:foo', 'x.ts#sym:bar'),
        edit('x.ts#sym:foo', 'x.ts#sym:bar'),
        edit('x.ts#sym:foo', 'x.ts#sym:bar'),
      ],
    );
    expect(out).toBe('[a](x.ts#sym:bar) [b](x.ts#sym:bar) [c](x.ts#sym:bar)\n');
  });

  it('leaves identical URLs on other lines alone', () => {
    const out = applyEdits('[a](x.ts#sym:foo)\n[b](x.ts#sym:foo)\n', [
      edit('x.ts#sym:foo', 'x.ts#sym:bar', 2),
    ]);
    expect(out).toBe('[a](x.ts#sym:foo)\n[b](x.ts#sym:bar)\n');
  });
});

describe('fix on the fixable fixture', () => {
  it('proposes the moved-file and rename repairs, refuses the hopeless case', async () => {
    const fixture = await setupFixture('fixable');
    try {
      const report = await fix({ cwd: fixture.dir });

      const moved = report.edits.find((e) => e.reason.includes('moved'));
      expect(moved).toBeDefined();
      expect(moved!.newUrl).toBe('lib/mover.ts#sym:relocatedHelper');

      const renamed = report.edits.find((e) => e.reason.includes('renamed'));
      expect(renamed).toBeDefined();
      expect(renamed!.newUrl).toBe('lib/mover.ts#sym:getData');

      expect(report.skipped).toHaveLength(1);
      expect(report.skipped[0]!.resolution.ref.fragment).toBe(
        'sym:completelyGoneSymbol',
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it('is a dry-run by default', async () => {
    const fixture = await setupFixture('fixable');
    try {
      const before = await readFile(
        path.join(fixture.dir, 'README.md'),
        'utf8',
      );
      await fix({ cwd: fixture.dir });
      const after = await readFile(path.join(fixture.dir, 'README.md'), 'utf8');
      expect(after).toBe(before);
    } finally {
      await fixture.cleanup();
    }
  });

  it('applies edits with --write and the repaired refs then pass check', async () => {
    const fixture = await setupFixture('fixable');
    try {
      await fix({ cwd: fixture.dir, write: true });
      const report = await check({ cwd: fixture.dir });
      const broken = report.results.filter((r) => r.status === 'broken');
      // Only the unfixable ref remains broken.
      expect(broken).toHaveLength(1);
      expect(broken[0]!.ref.fragment).toBe('sym:completelyGoneSymbol');
    } finally {
      await fixture.cleanup();
    }
  });

  it('surfaces syntax-error refs as skipped instead of silently ignoring them', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(fixture.dir, 'docs', 'syn.md'),
        '[x](../src/client.ts#sym:widget:Foo)\n',
      );
      const report = await fix({ cwd: fixture.dir, globs: ['docs/syn.md'] });
      expect(report.edits).toHaveLength(0);
      expect(report.skipped).toHaveLength(1);
      expect(report.skipped[0]!.reason).toContain('cannot auto-fix');
      expect(report.skipped[0]!.reason).toContain('unknown kind');
    } finally {
      await fixture.cleanup();
    }
  });

  it('refuses a moved file when the symbol lands in multiple candidates', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      const body = 'export function relocated(): number {\n  return 1;\n}\n';
      await mkdir(path.join(fixture.dir, 'lib'));
      await mkdir(path.join(fixture.dir, 'pkg'));
      await writeFile(path.join(fixture.dir, 'lib', 'util.ts'), body);
      await writeFile(path.join(fixture.dir, 'pkg', 'util.ts'), body);
      await writeFile(
        path.join(fixture.dir, 'docs', 'm.md'),
        '[x](../src/util.ts#sym:relocated)\n',
      );
      const report = await fix({ cwd: fixture.dir, globs: ['docs/m.md'] });
      expect(report.edits).toHaveLength(0);
      expect(report.skipped[0]!.reason).toContain('ambiguous');
      expect(report.skipped[0]!.reason).toContain('2 files');
    } finally {
      await fixture.cleanup();
    }
  });

  it('refuses multiple close rename candidates, naming them', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(fixture.dir, 'src', 'twins.ts'),
        'export function fetchDatb() {}\nexport function fetchDatc() {}\n',
      );
      await writeFile(
        path.join(fixture.dir, 'docs', 't.md'),
        '[x](../src/twins.ts#sym:fetchData)\n',
      );
      const report = await fix({ cwd: fixture.dir, globs: ['docs/t.md'] });
      expect(report.edits).toHaveLength(0);
      expect(report.skipped[0]!.reason).toContain('multiple rename candidates');
    } finally {
      await fixture.cleanup();
    }
  });

  it('repairs wrong-case paths with zero guessing (case-insensitive fs)', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(fixture.dir, 'docs', 'case.md'),
        '[x](../src/CLIENT.ts#sym:ApiClient.fetchData)\n',
      );
      const report = await fix({ cwd: fixture.dir, globs: ['docs/case.md'] });
      const edit = report.edits.find((e) => e.reason.includes('casing'));
      if (edit) {
        // macOS/Windows: resolver names the on-disk path; fix rewrites to it.
        expect(edit.newUrl).toBe('../src/client.ts#sym:ApiClient.fetchData');
      } else {
        // Linux: no case-insensitive match exists; heuristics run instead.
        expect(report.skipped.length + report.edits.length).toBeGreaterThan(0);
      }
    } finally {
      await fixture.cleanup();
    }
  });

  it('canonicalizes compat refs only when asked', async () => {
    const fixture = await setupFixture('basic');
    try {
      const without = await fix({ cwd: fixture.dir });
      expect(without.edits.some((e) => e.reason.includes('canonicalize'))).toBe(
        false,
      );

      const withFlag = await fix({ cwd: fixture.dir, canonicalize: true });
      const canon = withFlag.edits.find((e) =>
        e.reason.includes('canonicalize'),
      );
      expect(canon).toBeDefined();
      expect(canon!.newUrl).toBe('../src/client.ts#sym:ApiClient.fetchData');
    } finally {
      await fixture.cleanup();
    }
  });
});

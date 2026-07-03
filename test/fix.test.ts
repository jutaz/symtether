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

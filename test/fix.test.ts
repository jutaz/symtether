import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { check } from '../src/check.js';
import { fix } from '../src/fix.js';
import { setupFixture } from './helpers.js';

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

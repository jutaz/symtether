import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatSumFile, parseSumFile, sumKey } from '../src/sumfile.js';
import { update } from '../src/update.js';
import { setupFixture } from './helpers.js';

describe('sumfile format', () => {
  it('round-trips entries', () => {
    const entries = [
      {
        target: 'src/config.ts#fn:parseConfig',
        hash: 'ast:sha256:1c88d0e2bb40f915',
        date: '2026-07-03',
      },
      {
        target: 'src/api/client.ts#ApiClient.fetchData',
        hash: 'ast:sha256:9f2ab41c0e11d3a7',
        date: '2026-07-03',
      },
    ];
    const parsed = parseSumFile(formatSumFile(entries));
    expect(parsed.size).toBe(2);
    expect(parsed.get('src/api/client.ts#ApiClient.fetchData')?.hash).toBe(
      'ast:sha256:9f2ab41c0e11d3a7',
    );
  });

  it('sorts by target for merge-friendliness', () => {
    const out = formatSumFile([
      { target: 'z.ts#Z', hash: 'ast:sha256:00', date: '2026-01-01' },
      { target: 'a.ts#A', hash: 'ast:sha256:11', date: '2026-01-01' },
    ]);
    const lines = out.trim().split('\n');
    expect(lines[0]).toMatch(/^a\.ts#A/);
    expect(lines[1]).toMatch(/^z\.ts#Z/);
  });

  it('tolerates junk lines (derived data is regenerable)', () => {
    const parsed = parseSumFile(
      '# comment\n\nnot a valid line\na.ts#A  ast:sha256:11  2026-01-01\n',
    );
    expect(parsed.size).toBe(1);
  });

  it('builds kind-independent keys (§9.1: one entry per unique target)', () => {
    expect(sumKey('src/a.ts', ['Api', 'fetch'])).toBe('src/a.ts#Api.fetch');
    // #sym:fn:parse, #sym:parse, and compat #parse all share one key.
    expect(sumKey('src/a.ts', ['parse'])).toBe('src/a.ts#parse');
  });

  it('round-trips targets containing spaces', () => {
    const entries = [
      {
        target: 'my docs/x.ts#parseConfig',
        hash: 'ast:sha256:1c88d0e2bb40f915',
        date: '2026-07-03',
      },
    ];
    const parsed = parseSumFile(formatSumFile(entries));
    expect(parsed.get('my docs/x.ts#parseConfig')?.hash).toBe(
      'ast:sha256:1c88d0e2bb40f915',
    );
  });

  it('formats fixed two-space separators, no alignment (snapshot)', () => {
    // No column alignment on purpose: aligned columns would rewrite every
    // line whenever a longer entry lands, amplifying merge conflicts. The
    // opposite of §9.1's intent.
    const out = formatSumFile([
      {
        target: 'src/api/client.ts#ApiClient.fetchData',
        hash: 'ast:sha256:9f2ab41c0e11d3a7',
        date: '2026-07-03',
      },
      {
        target: 'src/config.ts#parseConfig',
        hash: 'ast:sha256:1c88d0e2bb40f915',
        date: '2026-07-03',
      },
      {
        target: 'scripts/deploy.sh#main',
        hash: 'lex:sha256:aa11bb22cc33dd44',
        date: '2026-07-01',
      },
    ]);
    expect(out).toMatchInlineSnapshot(`
      "scripts/deploy.sh#main  lex:sha256:aa11bb22cc33dd44  2026-07-01
      src/api/client.ts#ApiClient.fetchData  ast:sha256:9f2ab41c0e11d3a7  2026-07-03
      src/config.ts#parseConfig  ast:sha256:1c88d0e2bb40f915  2026-07-03
      "
    `);
  });

  it('formats an empty sum file as an empty string', () => {
    expect(formatSumFile([])).toBe('');
  });

  it('parses CRLF sum files (e.g. after core.autocrlf checkout)', () => {
    const parsed = parseSumFile(
      'a.ts#A  ast:sha256:11  2026-01-01\r\nb.ts#B  ast:sha256:22  2026-01-01\r\n',
    );
    expect(parsed.size).toBe(2);
    expect(parsed.get('a.ts#A')?.hash).toBe('ast:sha256:11');
  });
});

describe('update output snapshot', () => {
  beforeEach(() => {
    // Fake only Date, because faking the full timer set stalls async fs/wasm work.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-07-03T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('produces a byte-stable symtether.sum for the basic fixture', async () => {
    const fixture = await setupFixture('basic');
    try {
      await update({ cwd: fixture.dir });
      const sum = await readFile(
        path.join(fixture.dir, 'symtether.sum'),
        'utf8',
      );
      // File snapshot: locks format, sorting, dedup, hash inputs, and
      // alignment all at once. A grammar upgrade that changes AST shapes
      // will surface here as a deliberate snapshot update.
      await expect(sum).toMatchFileSnapshot('__snapshots__/basic.sum');
    } finally {
      await fixture.cleanup();
    }
  });

  it('is idempotent: a second update run is byte-identical', async () => {
    const fixture = await setupFixture('basic');
    const sumPath = path.join(fixture.dir, 'symtether.sum');
    try {
      await update({ cwd: fixture.dir });
      const first = await readFile(sumPath, 'utf8');
      await update({ cwd: fixture.dir });
      const second = await readFile(sumPath, 'utf8');
      expect(second).toBe(first);
    } finally {
      await fixture.cleanup();
    }
  });
});

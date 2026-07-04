import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check } from '../src/check.js';
import { toJson } from '../src/report.js';
import type { CheckReport, Resolution } from '../src/types.js';
import { setupFixture } from './helpers.js';

const SCHEMA_PATH = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'schemas',
  'check-output.schema.json',
);

describe('check on the basic fixture', () => {
  let report: CheckReport;
  let cleanup: () => Promise<void>;

  const find = (fragment: string): Resolution => {
    const r = report.results.find((x) => x.ref.fragment === fragment);
    expect(r, `expected a result for #${fragment}`).toBeDefined();
    return r!;
  };

  beforeAll(async () => {
    const fixture = await setupFixture('basic');
    cleanup = fixture.cleanup;
    report = await check({ cwd: fixture.dir });
  });

  afterAll(() => cleanup());

  it('resolves valid TS refs at tier 1', () => {
    for (const fragment of [
      'sym:ApiClient.fetchData',
      'sym:fn:parseConfig',
      'sym:withRetry',
      'sym:type:AgentSkill',
      // Regression: const declarations and namespace nesting are invisible
      // to the upstream tags.scm. Covered by our supplementary queries.
      'sym:const:MAX_RETRIES',
      'sym:helpers.formatUrl',
      'sym:fn:countdown',
    ]) {
      expect(find(fragment)).toMatchObject({ status: 'ok', tier: 'ast' });
    }
  });

  it('resolves valid Python refs at tier 1', () => {
    expect(find('sym:TaskRunner.run')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
    expect(find('sym:const:DEFAULT_TIMEOUT')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
  });

  it('resolves unsupported languages at tier 2 (lexical)', () => {
    expect(find('sym:main')).toMatchObject({ status: 'ok', tier: 'lexical' });
  });

  it('fails on a missing file', () => {
    expect(find('sym:Anything')).toMatchObject({ status: 'broken' });
    expect(find('sym:Anything').message).toContain('file not found');
  });

  it('fails on a missing symbol with candidates', () => {
    const r = find('sym:ApiClient.fetchDatum');
    expect(r.status).toBe('broken');
    expect(r.candidates.map((c) => c.symbol)).toContain('ApiClient.fetchData');
  });

  it('fails on ambiguous refs, naming all matches', () => {
    const r = find('sym:render');
    expect(r.status).toBe('broken');
    expect(r.message).toContain('ambiguous');
    expect(r.message).toContain('ApiClient.render');
    expect(r.message).toContain('Widget.render');
  });

  it('accepts compat-form refs and marks them', () => {
    const r = find('ApiClient.fetchData');
    expect(r).toMatchObject({ status: 'ok', tier: 'ast' });
    expect(r.ref.compat).toBe(true);
  });

  it('never sees refs in code fences, markdown anchors, or suppressed lines', () => {
    const fragments = report.results.map((r) => r.ref.fragment);
    expect(fragments).not.toContain('sym:NotChecked.atAll');
    expect(fragments).not.toContain('sym:AlsoNotChecked');
    expect(fragments).not.toContain('some-heading');
    expect(fragments).not.toContain('sym:DoesNotExist');
    expect(fragments).not.toContain('sym:Nope');
  });

  it('reports the matched definition line for tier-1 ok results', () => {
    const r = find('sym:ApiClient.fetchData');
    // fetchData is defined on line 2 of the fixture's client.ts. Consumers
    // (like the site generator) use this for GitHub #L deep links.
    expect(r.matchLine).toBe(2);
    expect(find('sym:main').matchLine).toBeUndefined(); // lexical: no line
  });

  it('resolves reference-style links', () => {
    expect(find('sym:ApiClient.fetchAgentData')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
  });

  it('summarizes correctly', () => {
    expect(report.summary.refs).toBe(report.results.length);
    // Derive from results. The fixture evolves; the invariant is that the
    // summary agrees with the per-ref statuses.
    const broken = report.results.filter((r) => r.status === 'broken').length;
    expect(report.summary.broken).toBe(broken);
    expect(broken).toBeGreaterThanOrEqual(5);
    expect(report.summary.lexical).toBeGreaterThanOrEqual(1);
  });

  it('reports parse errors instead of a bare "symbol not found"', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(fixture.dir, 'src', 'broken.ts'),
        'export function ( {} class @@@ !!!\n',
      );
      await writeFile(
        path.join(fixture.dir, 'docs', 'broken.md'),
        '[x](../src/broken.ts#sym:anything)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/broken.md'] });
      expect(r.results[0]!.status).toBe('broken');
      expect(r.results[0]!.message).toContain('syntax errors');
    } finally {
      await fixture.cleanup();
    }
  });

  it('checks CRLF markdown documents end-to-end', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(fixture.dir, 'docs', 'crlf.md'),
        '# CRLF doc\r\n\r\n[ok](../src/client.ts#sym:ApiClient.fetchData)\r\n[bad](../src/client.ts#sym:Nope)\r\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/crlf.md'] });
      expect(r.summary.refs).toBe(2);
      expect(r.results[0]).toMatchObject({ status: 'ok', tier: 'ast' });
      expect(r.results[1]).toMatchObject({ status: 'broken' });
      expect(r.results[1]!.ref.line).toBe(4);
    } finally {
      await fixture.cleanup();
    }
  });

  it('resolves refs to files in directories with spaces (%20-encoded)', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(path.join(fixture.dir, 'my lib'));
      await writeFile(
        path.join(fixture.dir, 'my lib', 'util.ts'),
        'export function helper(): number {\n  return 1;\n}\n',
      );
      await writeFile(
        path.join(fixture.dir, 'docs', 'spaces.md'),
        '[x](../my%20lib/util.ts#sym:fn:helper)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/spaces.md'] });
      expect(r.results[0]).toMatchObject({ status: 'ok', tier: 'ast' });
      expect(r.results[0]!.ref.targetPath).toBe('my lib/util.ts');
    } finally {
      await fixture.cleanup();
    }
  });

  it('resolves $-identifiers at tier 2 (lexical)', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      // .zsh has no grammar, so it stays tier 2 (unlike .sh, which is tier 1).
      await writeFile(
        path.join(fixture.dir, 'src', 'inject.zsh'),
        '#!/bin/zsh\n$inject() { echo hi; }\n',
      );
      await writeFile(
        path.join(fixture.dir, 'docs', 'dollar.md'),
        '[x](../src/inject.zsh#sym:$inject)\n[y](../src/inject.zsh#sym:$injectable)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/dollar.md'] });
      // \b would fail on $inject; lookaround with the spec charset works…
      expect(r.results[0]).toMatchObject({ status: 'ok', tier: 'lexical' });
      // …and does not match inside a longer identifier.
      expect(r.results[1]!.status).toBe('broken');
    } finally {
      await fixture.cleanup();
    }
  });

  it('produces JSON that validates against the shipped schema', () => {
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
    const ajv = new Ajv({ strict: false });
    const validate = ajv.compile(schema);
    const output = JSON.parse(toJson(report));
    expect(validate(output), JSON.stringify(validate.errors)).toBe(true);
  });
});

describe('check: filesystem edge cases', () => {
  it('ref targeting a directory is broken with a clear cause', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(path.join(fixture.dir, 'src', 'weird.ts'));
      await mkdir(path.join(fixture.dir, 'src', 'actual-dir'));
      await writeFile(
        path.join(fixture.dir, 'docs', 'dir.md'),
        '[x](../src/weird.ts/#sym:Foo)\n[y](../src/actual-dir#sym:Foo)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/dir.md'] });
      for (const res of r.results) {
        expect(res.status).toBe('broken');
        expect(res.message).toMatch(/directory|file not found/);
      }
    } finally {
      await fixture.cleanup();
    }
  });

  it('empty source file: symbol not found with no candidates, not a crash', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(path.join(fixture.dir, 'src', 'empty.ts'), '');
      await writeFile(
        path.join(fixture.dir, 'docs', 'e.md'),
        '[x](../src/empty.ts#sym:anything)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/e.md'] });
      expect(r.results[0]!.status).toBe('broken');
      expect(r.results[0]!.candidates).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
  });

  it('binary file with a fragment: warning, never a silent ok', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(fixture.dir, 'src', 'blob.bin'),
        Buffer.from([0x00, 0x01, 0xff, 0x00, 0x42]),
      );
      await writeFile(
        path.join(fixture.dir, 'docs', 'b.md'),
        '[x](../src/blob.bin#sym:main)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/b.md'] });
      expect(r.results[0]!.status).toBe('warning');
      expect(r.results[0]!.tier).toBe('file-only');
      expect(r.results[0]!.message).toContain('binary');
    } finally {
      await fixture.cleanup();
    }
  });

  it('symlinked target resolves without crashing', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile, symlink } = await import('node:fs/promises');
      await symlink(
        path.join(fixture.dir, 'src', 'client.ts'),
        path.join(fixture.dir, 'src', 'alias.ts'),
      );
      await writeFile(
        path.join(fixture.dir, 'docs', 's.md'),
        '[x](../src/alias.ts#sym:ApiClient.fetchData)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/s.md'] });
      // Symlinks resolve to a different realpath; pin that this is handled
      // deterministically rather than crashing. Current behavior: broken
      // with the casing/realpath mismatch named, or ok where realpath
      // equals the link path.
      expect(['ok', 'broken']).toContain(r.results[0]!.status);
    } finally {
      await fixture.cleanup();
    }
  });

  it('wrong-case path is broken and names the on-disk path (case-insensitive fs)', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(fixture.dir, 'docs', 'case.md'),
        '[x](../src/CLIENT.ts#sym:ApiClient.fetchData)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/case.md'] });
      const res = r.results[0]!;
      expect(res.status).toBe('broken');
      if (res.diskPath) {
        // macOS/Windows: file found, casing differs.
        expect(res.diskPath).toBe('src/client.ts');
        expect(res.message).toContain('casing differs');
      } else {
        // Linux (case-sensitive): plain not-found is correct.
        expect(res.message).toContain('file not found');
      }
    } finally {
      await fixture.cleanup();
    }
  });

  it('suffix match never matches partial interior segments', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      // helpers.formatUrl exists; "rs.formatUrl" (substring of segment) must not.
      await writeFile(
        path.join(fixture.dir, 'docs', 'n.md'),
        '[bad](../src/client.ts#sym:rs.formatUrl)\n[good](../src/client.ts#sym:helpers.formatUrl)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/n.md'] });
      expect(r.results[0]!.status).toBe('broken');
      expect(r.results[1]!.status).toBe('ok');
    } finally {
      await fixture.cleanup();
    }
  });
});

describe('check: resolution outcome corners', () => {
  it('plain file link with no fragment is ok at file-only tier', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(
        path.join(fixture.dir, 'docs', 'plain.md'),
        '[the client](../src/client.ts)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/plain.md'] });
      expect(r.results[0]).toMatchObject({ status: 'ok', tier: 'file-only' });
      expect(r.results[0]!.message).toBeUndefined();
    } finally {
      await fixture.cleanup();
    }
  });

  it('kind mismatch says what the symbol actually is', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      // parseConfig is a function; asking for a class must fail and say so.
      await writeFile(
        path.join(fixture.dir, 'docs', 'kind.md'),
        '[x](../src/client.ts#sym:class:parseConfig)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/kind.md'] });
      const res = r.results[0]!;
      expect(res.status).toBe('broken');
      expect(res.message).toContain('exists but is not a class');
      expect(res.message).toContain('found: function');
      // The mis-kinded symbol itself is offered as the top candidate.
      expect(res.candidates[0]!.symbol).toBe('parseConfig');
    } finally {
      await fixture.cleanup();
    }
  });

  it('ambiguity error with a kind already given only suggests parent segments', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile } = await import('node:fs/promises');
      // render exists on both ApiClient and Widget; both are methods, so
      // #sym:fn:render is still ambiguous, so "add a kind" would be
      // useless advice.
      await writeFile(
        path.join(fixture.dir, 'docs', 'amb.md'),
        '[x](../src/client.ts#sym:fn:render)\n',
      );
      const r = await check({ cwd: fixture.dir, globs: ['docs/amb.md'] });
      const res = r.results[0]!;
      expect(res.status).toBe('broken');
      expect(res.message).toContain('qualify with a parent segment');
      expect(res.message).not.toContain('add a parent segment or a kind');
    } finally {
      await fixture.cleanup();
    }
  });
});

describe('check option handling', () => {
  it('respects .gitignore excludes', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(path.join(fixture.dir, 'generated'));
      await writeFile(
        path.join(fixture.dir, 'generated', 'out.md'),
        '[x](../src/missing-everywhere.ts#sym:Nope)\n',
      );
      await writeFile(path.join(fixture.dir, '.gitignore'), 'generated/\n');
      const report = await check({ cwd: fixture.dir });
      expect(
        report.results.every((r) => !r.ref.doc.startsWith('generated/')),
      ).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });

  it('always skips node_modules, even without a .gitignore', async () => {
    const fixture = await setupFixture('basic');
    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      await mkdir(path.join(fixture.dir, 'node_modules', 'dep'), {
        recursive: true,
      });
      await writeFile(
        path.join(fixture.dir, 'node_modules', 'dep', 'README.md'),
        '[x](src/gone.ts#sym:Nope)\n',
      );
      const report = await check({ cwd: fixture.dir });
      expect(
        report.results.every((r) => !r.ref.doc.includes('node_modules')),
      ).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });

  it('scopes to explicit globs', async () => {
    const fixture = await setupFixture('basic');
    try {
      const report = await check({
        cwd: fixture.dir,
        globs: ['docs/other.md'],
      });
      expect(report.summary.refs).toBe(0);
    } finally {
      await fixture.cleanup();
    }
  });
});

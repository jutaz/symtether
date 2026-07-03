import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { check } from '../src/check.js';
import { fix } from '../src/fix.js';
import { toJson } from '../src/report.js';
import { update } from '../src/update.js';
import { UsageError } from '../src/types.js';
import { setupFixture } from './helpers.js';

const SCHEMA_PATH = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'schemas',
  'check-output.schema.json',
);

/**
 * The reformat-vs-change edge (§9.1): identical token stream, different
 * layout. Note: no added trailing commas — those are new tokens and *should*
 * change the hash.
 */
const REFORMATTED = `export class ApiClient {
  fetchData(
    url: string
  ): Promise<string> {
    return Promise.resolve(
      url
    );
  }

  fetchAgentData(id: string): Promise<string> {
    return Promise.resolve(id);
  }

  render(): void {}
}
`;

describe('update + check --strict', () => {
  it('strict without a sum file is a usage error', async () => {
    const fixture = await setupFixture('basic');
    try {
      await expect(check({ cwd: fixture.dir, strict: true })).rejects.toThrow(
        UsageError,
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it('update stamps resolvable refs, skips broken, dedups targets', async () => {
    const fixture = await setupFixture('basic');
    try {
      const result = await update({ cwd: fixture.dir });
      expect(result.skippedBroken).toBeGreaterThan(0);
      const sum = await readFile(
        path.join(fixture.dir, 'symtether.sum'),
        'utf8',
      );
      expect(sum).toContain('src/client.ts#ApiClient.fetchData');
      // Keys are kind-independent (§9.1): #sym:fn:parseConfig → #parseConfig.
      expect(sum).toContain('src/client.ts#parseConfig');
      expect(sum).toMatch(/src\/deploy\.sh#main\s+lex:sha256:/);
      // Canonical and compat refs to the same target share one entry (§9.1).
      const entries = sum
        .trim()
        .split('\n')
        .filter((l) => l.includes('#ApiClient.fetchData'));
      expect(entries).toHaveLength(1);
    } finally {
      await fixture.cleanup();
    }
  });

  it('freshly stamped repo has zero stale refs under strict', async () => {
    const fixture = await setupFixture('basic');
    try {
      await update({ cwd: fixture.dir });
      const report = await check({ cwd: fixture.dir, strict: true });
      expect(report.summary.stale).toBe(0);
    } finally {
      await fixture.cleanup();
    }
  });

  it('reformatting never triggers staleness (normalized hash)', async () => {
    const fixture = await setupFixture('basic');
    const clientPath = path.join(fixture.dir, 'src', 'client.ts');
    try {
      await update({ cwd: fixture.dir });
      const original = await readFile(clientPath, 'utf8');
      // Reformat the whole class body without changing any tokens.
      const reformatted = original.replace(
        /export class ApiClient \{[\s\S]*?\n\}/,
        REFORMATTED.trimEnd(),
      );
      expect(reformatted).not.toBe(original);
      await writeFile(clientPath, reformatted);

      const report = await check({ cwd: fixture.dir, strict: true });
      const fetchData = report.results.find(
        (r) => r.ref.fragment === 'sym:ApiClient.fetchData',
      );
      expect(fetchData?.status).toBe('ok');
    } finally {
      await fixture.cleanup();
    }
  });

  it('an implementation change marks the ref stale and lists referencing docs', async () => {
    const fixture = await setupFixture('basic');
    const clientPath = path.join(fixture.dir, 'src', 'client.ts');
    try {
      await update({ cwd: fixture.dir });
      const original = await readFile(clientPath, 'utf8');
      await writeFile(
        clientPath,
        original.replace(
          'return Promise.resolve(url);',
          'return Promise.reject(new Error(url));',
        ),
      );

      const report = await check({ cwd: fixture.dir, strict: true });
      const stale = report.results.filter((r) => r.status === 'stale');
      expect(stale.length).toBeGreaterThan(0);
      expect(stale[0]!.message).toContain('docs/guide.md');
      expect(stale[0]!.message).toContain('symtether update');
      // Broken refs stay broken; stale only replaces ok.
      expect(report.summary.broken).toBe(5);

      // Stale output must still satisfy the stable JSON contract.
      const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
      const ajv = new Ajv({ strict: false });
      const validate = ajv.compile(schema);
      const output = JSON.parse(toJson(report));
      expect(validate(output), JSON.stringify(validate.errors)).toBe(true);
      const staleJson = output.results.find(
        (r: { status: string }) => r.status === 'stale',
      );
      expect(staleJson.fix).toContain('symtether update');
    } finally {
      await fixture.cleanup();
    }
  });

  it('re-running update clears staleness', async () => {
    const fixture = await setupFixture('basic');
    const clientPath = path.join(fixture.dir, 'src', 'client.ts');
    try {
      await update({ cwd: fixture.dir });
      const original = await readFile(clientPath, 'utf8');
      await writeFile(
        clientPath,
        original.replace(
          'return Promise.resolve(url);',
          'return url as never;',
        ),
      );
      await update({ cwd: fixture.dir });
      const report = await check({ cwd: fixture.dir, strict: true });
      expect(report.summary.stale).toBe(0);
    } finally {
      await fixture.cleanup();
    }
  });

  it('scope matching respects path boundaries (src/task does not match src/tasks.py)', async () => {
    const fixture = await setupFixture('basic');
    const tasksPath = path.join(fixture.dir, 'src', 'tasks.py');
    try {
      await update({ cwd: fixture.dir });
      const original = await readFile(tasksPath, 'utf8');
      await writeFile(
        tasksPath,
        original.replace('return task', 'return None'),
      );
      // `src/task` is a prefix of `src/tasks.py` but not a path boundary —
      // it must NOT re-stamp tasks.py, so staleness must survive.
      await update({ cwd: fixture.dir, targets: ['src/task'] });
      const report = await check({ cwd: fixture.dir, strict: true });
      expect(report.summary.stale).toBeGreaterThan(0);
      // The exact file path DOES re-stamp.
      await update({ cwd: fixture.dir, targets: ['src/tasks.py'] });
      const after = await check({ cwd: fixture.dir, strict: true });
      expect(after.summary.stale).toBe(0);
    } finally {
      await fixture.cleanup();
    }
  });

  it('scoped update carries forward stamps of out-of-scope broken targets', async () => {
    const fixture = await setupFixture('basic');
    const clientPath = path.join(fixture.dir, 'src', 'client.ts');
    try {
      await update({ cwd: fixture.dir });
      const original = await readFile(clientPath, 'utf8');
      // Break withRetry (delete it), then run a scoped update elsewhere:
      // the old stamp must survive — the sum file is a shadow, and only a
      // full-scope update prunes.
      await writeFile(
        clientPath,
        original.replace(
          'export const withRetry = (attempts: number) => attempts;',
          '',
        ),
      );
      await update({ cwd: fixture.dir, targets: ['src/tasks.py'] });
      const sum = await readFile(
        path.join(fixture.dir, 'symtether.sum'),
        'utf8',
      );
      expect(sum).toContain('src/client.ts#withRetry');
    } finally {
      await fixture.cleanup();
    }
  });

  it('scoped update leaves out-of-scope stamps untouched', async () => {
    const fixture = await setupFixture('basic');
    const clientPath = path.join(fixture.dir, 'src', 'client.ts');
    try {
      await update({ cwd: fixture.dir });
      const original = await readFile(clientPath, 'utf8');
      await writeFile(
        clientPath,
        original.replace(
          'return Promise.resolve(url);',
          'return url as never;',
        ),
      );
      // Stamp only tasks.py — client.ts staleness must survive.
      await update({ cwd: fixture.dir, targets: ['src/tasks.py'] });
      const report = await check({ cwd: fixture.dir, strict: true });
      expect(report.summary.stale).toBeGreaterThan(0);
    } finally {
      await fixture.cleanup();
    }
  });
});

describe('update --check (CI mode)', () => {
  it('passes when the sum file is current, without touching it', async () => {
    const fixture = await setupFixture('basic');
    const sumPath = path.join(fixture.dir, 'symtether.sum');
    try {
      await update({ cwd: fixture.dir });
      const before = await readFile(sumPath, 'utf8');
      const result = await update({ cwd: fixture.dir, check: true });
      expect(result.upToDate).toBe(true);
      expect(result.changed).toEqual([]);
      expect(await readFile(sumPath, 'utf8')).toBe(before);
    } finally {
      await fixture.cleanup();
    }
  });

  it('fails with named targets when implementations changed', async () => {
    const fixture = await setupFixture('basic');
    const clientPath = path.join(fixture.dir, 'src', 'client.ts');
    try {
      await update({ cwd: fixture.dir });
      const original = await readFile(clientPath, 'utf8');
      await writeFile(
        clientPath,
        original.replace(
          'return Promise.resolve(url);',
          'return url as never;',
        ),
      );
      const result = await update({ cwd: fixture.dir, check: true });
      expect(result.upToDate).toBe(false);
      expect(
        result.changed!.some((c) =>
          c.includes('src/client.ts#ApiClient.fetchData'),
        ),
      ).toBe(true);
      expect(result.changed![0]).toContain('hash differs');
    } finally {
      await fixture.cleanup();
    }
  });

  it('fails when the sum file is missing entries for new refs', async () => {
    const fixture = await setupFixture('basic');
    try {
      await update({ cwd: fixture.dir });
      await writeFile(
        path.join(fixture.dir, 'docs', 'new-ref.md'),
        '[schedule](../src/tasks.py#sym:fn:schedule)\n',
      );
      const result = await update({ cwd: fixture.dir, check: true });
      expect(result.upToDate).toBe(false);
      expect(
        result.changed!.some(
          (c) => c.includes('schedule') && c.includes('missing'),
        ),
      ).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });

  it('fails on orphaned entries and never fails on date-only differences', async () => {
    const fixture = await setupFixture('basic');
    const sumPath = path.join(fixture.dir, 'symtether.sum');
    try {
      await update({ cwd: fixture.dir });
      // Date column is informational (§9.1) — rewriting it must not fail CI.
      const dated = (await readFile(sumPath, 'utf8')).replace(
        /\d{4}-\d{2}-\d{2}/g,
        '1999-01-01',
      );
      await writeFile(sumPath, dated);
      const ok = await update({ cwd: fixture.dir, check: true });
      expect(ok.upToDate).toBe(true);

      // An entry whose target no doc references anymore is orphaned.
      await writeFile(
        sumPath,
        dated + 'src/gone.ts#nothing  ast:sha256:00  1999-01-01\n',
      );
      const stale = await update({ cwd: fixture.dir, check: true });
      expect(stale.upToDate).toBe(false);
      expect(stale.changed!.some((c) => c.includes('orphaned'))).toBe(true);
    } finally {
      await fixture.cleanup();
    }
  });
});

describe('hash-verified renames in fix', () => {
  it('detects a rename of a RECURSIVE function (self-references masked)', async () => {
    const fixture = await setupFixture('basic');
    const clientPath = path.join(fixture.dir, 'src', 'client.ts');
    try {
      await update({ cwd: fixture.dir });
      const original = await readFile(clientPath, 'utf8');
      // countdown calls itself in its body; if only the signature name were
      // masked, the body occurrence would change the hash and this rename
      // would be undetectable.
      await writeFile(clientPath, original.replaceAll('countdown', 'ticker'));

      const report = await fix({ cwd: fixture.dir });
      const verified = report.edits.filter(
        (e) =>
          e.reason.includes('content-verified') && e.newUrl.includes('ticker'),
      );
      expect(verified.length).toBeGreaterThan(0);
    } finally {
      await fixture.cleanup();
    }
  });

  it('finds the stamp for compat-form refs (kind-independent key)', async () => {
    const fixture = await setupFixture('basic');
    const clientPath = path.join(fixture.dir, 'src', 'client.ts');
    const docPath = path.join(fixture.dir, 'docs', 'compat-rename.md');
    try {
      await update({ cwd: fixture.dir });
      // A compat-form ref written after stamping; the stamp key came from
      // the canonical #sym:fn:parseConfig ref — same key either way.
      await writeFile(docPath, '[cfg](../src/client.ts#parseConfig)\n');
      const original = await readFile(clientPath, 'utf8');
      await writeFile(
        clientPath,
        original.replaceAll('parseConfig', 'loadConfiguration'),
      );

      const report = await fix({ cwd: fixture.dir });
      const verified = report.edits.filter(
        (e) =>
          e.reason.includes('content-verified') &&
          e.doc === 'docs/compat-rename.md',
      );
      expect(verified).toHaveLength(1);
      expect(verified[0]!.newUrl).toContain('loadConfiguration');
    } finally {
      await fixture.cleanup();
    }
  });

  it('detects a rename by identical content hash, beating edit distance', async () => {
    const fixture = await setupFixture('basic');
    const clientPath = path.join(fixture.dir, 'src', 'client.ts');
    try {
      await update({ cwd: fixture.dir });
      const original = await readFile(clientPath, 'utf8');
      // Rename fetchData -> retrieveRemotePayload: edit distance is huge,
      // heuristics would never touch it; the hash identifies it exactly.
      await writeFile(
        clientPath,
        original.replaceAll('fetchData', 'retrieveRemotePayload'),
      );

      const report = await fix({ cwd: fixture.dir });
      const verified = report.edits.filter((e) =>
        e.reason.includes('content-verified'),
      );
      expect(verified.length).toBeGreaterThan(0);
      expect(verified[0]!.newUrl).toContain(
        'sym:ApiClient.retrieveRemotePayload',
      );
    } finally {
      await fixture.cleanup();
    }
  });
});

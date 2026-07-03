import { describe, expect, it } from 'vitest';
import { toHuman, toJson } from '../src/report.js';
import type { CheckReport, Resolution } from '../src/types.js';

function res(partial: Partial<Resolution> & { status: Resolution['status'] }) {
  return {
    ref: {
      doc: 'docs/guide.md',
      line: 3,
      rawTarget: '../src/a.ts',
      targetPath: 'src/a.ts',
      fragment: 'sym:Foo.bar',
      dotpath: ['Foo', 'bar'],
      compat: false,
      ...partial.ref,
    },
    tier: 'ast' as const,
    candidates: [],
    ...partial,
  } satisfies Resolution;
}

function report(results: Resolution[]): CheckReport {
  const summary = {
    refs: results.length,
    ast: results.filter((r) => r.status === 'ok' && r.tier === 'ast').length,
    lexical: results.filter((r) => r.status === 'ok' && r.tier === 'lexical')
      .length,
    fileOnly: results.filter((r) => r.status === 'warning').length,
    broken: results.filter((r) => r.status === 'broken').length,
    stale: results.filter((r) => r.status === 'stale').length,
  };
  return { summary, results };
}

describe('toHuman (Law 8: failures must be actionable)', () => {
  it('broken output carries doc, line, cause, candidates, and fix command', () => {
    const out = toHuman(
      report([
        res({
          status: 'broken',
          message: 'file OK; symbol not found',
          candidates: [{ symbol: 'Foo.baz', kind: 'method', confidence: 0.9 }],
        }),
      ]),
    );
    expect(out).toContain('docs/guide.md');
    expect(out).toContain('line 3');
    expect(out).toContain('file OK; symbol not found');
    expect(out).toContain('Foo.baz (method)');
    expect(out).toContain('symtether fix docs/guide.md');
  });

  it('stale output points at the update command', () => {
    const out = toHuman(
      report([res({ status: 'stale', message: 'implementation changed' })]),
    );
    expect(out).toContain('STALE');
    expect(out).toContain('symtether update src/a.ts');
  });

  it('ok refs show their tier; compat refs are marked', () => {
    const out = toHuman(
      report([
        res({ status: 'ok' }),
        res({
          status: 'ok',
          tier: 'lexical',
          ref: { compat: true } as Resolution['ref'],
        }),
      ]),
    );
    expect(out).toContain('ast');
    expect(out).toContain('lexical');
    expect(out).toContain('(compat)');
  });

  it('quiet mode hides ok refs but keeps warnings and failures', () => {
    const out = toHuman(
      report([
        res({ status: 'ok' }),
        res({ status: 'warning', message: 'fragment not checkable' }),
        res({ status: 'broken', message: 'file not found' }),
      ]),
      true,
    );
    expect(out).not.toContain('✓');
    expect(out).toContain('file-only');
    expect(out).toContain('BROKEN');
  });

  it('summary line reports all non-zero categories', () => {
    const out = toHuman(
      report([
        res({ status: 'ok' }),
        res({ status: 'stale' }),
        res({ status: 'warning' }),
        res({ status: 'broken' }),
      ]),
    );
    const summary = out.trim().split('\n').at(-1)!;
    expect(summary).toContain('4 refs');
    expect(summary).toContain('1 stale');
    expect(summary).toContain('1 file-only');
    expect(summary).toContain('1 broken');
  });
});

describe('toJson', () => {
  it('rounds confidence to two decimals and includes fix for stale', () => {
    const parsed = JSON.parse(
      toJson(
        report([
          res({
            status: 'broken',
            candidates: [
              { symbol: 'Foo.baz', kind: 'method', confidence: 0.8666666 },
            ],
          }),
          res({ status: 'stale' }),
        ]),
      ),
    );
    expect(parsed.results[0].candidates[0].confidence).toBe(0.87);
    expect(parsed.results[0].fix).toBe('symtether fix docs/guide.md');
    expect(parsed.results[1].fix).toBe('symtether update src/a.ts');
  });

  it('omits message when absent, never emits undefined', () => {
    const out = toJson(report([res({ status: 'ok' })]));
    expect(out).not.toContain('undefined');
    expect(JSON.parse(out).results[0]).not.toHaveProperty('message');
  });
});

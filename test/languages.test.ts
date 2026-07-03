import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check } from '../src/check.js';
import type { CheckReport, Resolution } from '../src/types.js';
import { setupFixture } from './helpers.js';

/**
 * Tier-1 coverage across every bundled grammar, driven by the
 * fixtures/basic/docs/languages.md fixture.
 */
describe('tier-1 language coverage', () => {
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
    report = await check({ cwd: fixture.dir, globs: ['docs/languages.md'] });
  });

  afterAll(() => cleanup());

  it.each([
    // [language, fragment]
    ['go method on receiver', 'sym:Server.Start'],
    ['go function', 'sym:fn:NewServer'],
    ['go const', 'sym:const:MaxConnections'],
    ['go type', 'sym:type:Config'],
    ['go struct field', 'sym:Config.Timeout'],
    ['rust impl method', 'sym:Parser.parse'],
    ['rust function', 'sym:fn:tokenize'],
    ['rust const', 'sym:const:MAX_DEPTH'],
    ['rust enum', 'sym:type:Token'],
    ['java method', 'sym:Engine.rev'],
    ['java nested interface', 'sym:type:Listener'],
    ['java static final field', 'sym:const:MAX_RPM'],
    ['ruby instance method', 'sym:Worker.perform'],
    ['ruby module method', 'sym:fn:enqueue'],
    ['ruby constant', 'sym:const:RETRY_LIMIT'],
    ['c function', 'sym:fn:buffer_append'],
    ['c static function', 'sym:buffer_grow'],
    ['cpp class method', 'sym:Matrix.transpose'],
    ['cpp free function', 'sym:fn:identity'],
    ['csharp method', 'sym:Cache.Set'],
    ['csharp interface', 'sym:type:IEvictionPolicy'],
    ['php class method', 'sym:Router.dispatch'],
    ['php function', 'sym:fn:make_router'],
  ])('resolves %s at tier 1', (_language, fragment) => {
    expect(find(fragment)).toMatchObject({ status: 'ok', tier: 'ast' });
  });

  it('reports symbol-level breakage per language, not file-level', () => {
    for (const fragment of ['sym:Restart', 'sym:Parser.reset']) {
      const r = find(fragment);
      expect(r.status).toBe('broken');
      expect(r.tier).toBe('ast');
      expect(r.message).toContain('symbol not found');
    }
  });

  it('suffix-matches receiver methods per SPEC §5.2 (Go Server.Start)', () => {
    // Server.Start matches a method with receiver *Server — the language-
    // agnostic dotpath form, not Go's own syntax.
    expect(find('sym:Server.Start').status).toBe('ok');
  });

  it('summary: every valid ref is ast-tier, none fell to lexical', () => {
    expect(report.summary.lexical).toBe(0);
    expect(report.summary.broken).toBe(2);
  });
});

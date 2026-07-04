import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check } from '../src/check.js';
import { KIND_MAP, supportedExtensions } from '../src/languages/index.js';
import type { CheckReport, Resolution } from '../src/types.js';
import { setupFixture } from './helpers.js';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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
    ['c struct field', 'sym:buf.len'],
    ['cpp class method', 'sym:Matrix.transpose'],
    ['cpp free function', 'sym:fn:identity'],
    ['cpp namespace', 'sym:type:math'],
    ['cpp namespace-qualified method', 'sym:math.Matrix.rows'],
    ['csharp method', 'sym:Cache.Set'],
    ['csharp interface', 'sym:type:IEvictionPolicy'],
    ['csharp private field', 'sym:const:_capacity'],
    ['csharp constructor', 'sym:fn:Cache.Cache'],
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

describe('language registry invariants', () => {
  it('ships a wasm + tags.scm pair for every registered grammar', async () => {
    const files = await readdir(path.join(repoRoot, 'grammars'));
    const grammars = new Set(
      files.filter((f) => f.endsWith('.wasm')).map((f) => f.slice(0, -5)),
    );
    for (const g of grammars) {
      expect(files, `${g}.tags.scm must ship with ${g}.wasm`).toContain(
        `${g}.tags.scm`,
      );
    }
    // Every registered extension should be loadable end-to-end.
    expect(supportedExtensions().length).toBeGreaterThanOrEqual(14);
  });

  it('KIND_MAP covers every @definition kind our shipped queries emit', async () => {
    const files = await readdir(path.join(repoRoot, 'grammars'));
    const emitted = new Set<string>();
    for (const f of files.filter((f) => f.endsWith('.tags.scm'))) {
      const content = await readFile(
        path.join(repoRoot, 'grammars', f),
        'utf8',
      );
      for (const m of content.matchAll(/@definition\.([a-z_]+)/g)) {
        emitted.add(m[1]!);
      }
    }
    const mapped = new Set(Object.values(KIND_MAP).flat());
    // Every emitted kind must be reachable through at least one <kind>
    // filter — otherwise refs like #sym:const:X silently can't match
    // definitions a grammar legitimately produces.
    for (const kind of emitted) {
      expect(
        mapped.has(kind),
        `tags.scm emits @definition.${kind} but no #sym: kind maps to it`,
      ).toBe(true);
    }
  });

  it('the docs kind-mapping appendix matches KIND_MAP (anti-drift)', async () => {
    const guide = await readFile(
      path.join(repoRoot, 'docs', 'guide.md'),
      'utf8',
    );
    for (const [kind, accepts] of Object.entries(KIND_MAP)) {
      // Each row of the appendix table must list exactly the map's kinds.
      const row = guide
        .split('\n')
        .find((l) => l.startsWith(`| \`${kind}\` |`));
      expect(row, `docs/guide.md must document kind "${kind}"`).toBeDefined();
      for (const accepted of accepts) {
        expect(
          row,
          `docs row for "${kind}" must mention "${accepted}"`,
        ).toContain(accepted);
      }
    }
  });
});

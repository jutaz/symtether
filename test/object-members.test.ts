import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check } from '../src/check.js';
import { Resolver } from '../src/resolve.js';
import type { CheckReport, Resolution } from '../src/types.js';
import { setupFixture } from './helpers.js';

/**
 * Object-literal members of an exported const are definitions nested in the
 * parent name, so `#sym:imports.createImportLink` and bare
 * `#sym:createImportLink` both resolve (the Astro-actions / SvelteKit
 * pattern). These tests pin the deliberately narrow boundary: exported only,
 * top level of the literal only, plain identifier keys only, and
 * function-valued members keep their upstream `fn` kind.
 */
describe('object-literal members as definitions', () => {
  let report: CheckReport;
  let fixtureDir: string;
  let cleanup: () => Promise<void>;

  const find = (fragment: string): Resolution => {
    const r = report.results.find((x) => x.ref.fragment === fragment);
    expect(r, `expected a result for #${fragment}`).toBeDefined();
    return r!;
  };

  beforeAll(async () => {
    const fixture = await setupFixture('object-members');
    fixtureDir = fixture.dir;
    cleanup = fixture.cleanup;
    report = await check({ cwd: fixture.dir });
  });

  afterAll(() => cleanup());

  it('resolves a bare exported object member, dotted and bare', () => {
    expect(find('sym:imports.createImportLink')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
    expect(find('sym:createImportLink')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
    expect(find('sym:imports.listImports')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
  });

  it('captures members through `as const` and `satisfies` (TS-only) wrappers', () => {
    expect(find('sym:templates')).toMatchObject({ status: 'ok', tier: 'ast' });
    expect(find('sym:templates.welcome')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
    expect(find('sym:config.retries')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
  });

  it('keeps function-valued members as fn, not const', () => {
    expect(find('sym:fn:config.onClick')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
    // The pair pattern must not shadow the upstream function capture.
    expect(find('sym:const:config.onClick').status).toBe('broken');
  });

  it('does not define members of a non-exported const', () => {
    expect(find('sym:internal.secret').status).toBe('broken');
  });

  it('does not recurse into nested objects', () => {
    expect(find('sym:tree.top')).toMatchObject({ status: 'ok', tier: 'ast' });
    expect(find('sym:tree.outer')).toMatchObject({ status: 'ok', tier: 'ast' });
    expect(find('sym:tree.outer.inner').status).toBe('broken');
  });

  it('captures only plain identifier keys', () => {
    expect(find('sym:weird.plain')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
  });

  it('reports a pair key colliding with a top-level function as ambiguous', () => {
    const r = find('sym:foo');
    expect(r.status).toBe('broken');
    expect(r.message).toContain('ambiguous');
    expect(r.message).toContain('cfg.foo');
    expect(r.message).toContain('foo');
    // The kind disambiguator rescues both colliding definitions.
    expect(find('sym:fn:foo')).toMatchObject({ status: 'ok', tier: 'ast' });
    expect(find('sym:const:foo')).toMatchObject({ status: 'ok', tier: 'ast' });
  });

  it('still captures JS object members through the JS grammar', () => {
    expect(find('sym:legacy.createThing')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
    expect(find('sym:fn:legacy.onReady')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
  });

  it('builds the expected chains and kinds', async () => {
    const resolver = new Resolver(fixtureDir);
    const defs = await resolver.definitionsForFile('src/actions.ts');
    expect(defs).not.toBeNull();
    const kinds = new Map(
      defs!.map((d) => [d.chain.join('.'), d.kinds] as const),
    );

    expect(kinds.get('imports.createImportLink')).toEqual(['constant']);
    // The upstream function pair stays `function`, nested one level deeper.
    expect(kinds.get('imports.createImportLink.handler')).toEqual(['function']);
    expect(kinds.get('config.onClick')).toEqual(['function']);
    expect(kinds.get('templates.welcome')).toEqual(['constant']);
    expect(kinds.get('tree.outer')).toEqual(['constant']);

    // Boundary: not captured.
    expect(kinds.has('internal.secret')).toBe(false);
    expect(kinds.has('tree.outer.inner')).toBe(false);
    expect(kinds.has('weird.kebab-key')).toBe(false);
  });
});

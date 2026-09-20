import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check } from '../src/check.js';
import { isSupportedExtension } from '../src/languages/index.js';
import type { CheckReport, Resolution } from '../src/types.js';
import { setupFixture } from './helpers.js';

/**
 * Svelte and Astro keep their script bodies opaque to their own grammars, so
 * the resolver re-parses those byte ranges with the TypeScript grammar. These
 * tests pin the tier flip (lexical -> ast) and the injection boundary.
 */
describe('embedded-language coverage', () => {
  let report: CheckReport;
  let cleanup: () => Promise<void>;

  const find = (fragment: string): Resolution => {
    const r = report.results.find((x) => x.ref.fragment === fragment);
    expect(r, `expected a result for #${fragment}`).toBeDefined();
    return r!;
  };

  beforeAll(async () => {
    const fixture = await setupFixture('embedded');
    cleanup = fixture.cleanup;
    report = await check({ cwd: fixture.dir, globs: ['docs/embedded.md'] });
  });

  afterAll(() => cleanup());

  it.each([
    // [language, fragment] — svelte script bodies.
    ['svelte class method', 'sym:UserCard.render'],
    ['svelte class', 'sym:class:UserCard'],
    ['svelte function', 'sym:fn:makeCard'],
    ['svelte const', 'sym:const:MAX_CARDS'],
    // Svelte module script + plain-JS instance script, in one file.
    ['svelte module const', 'sym:const:increments'],
    ['svelte plain-js class method', 'sym:Counter.reset'],
    ['svelte plain-js function', 'sym:fn:increment'],
    // Astro frontmatter.
    ['astro frontmatter class method', 'sym:Widget.render'],
    ['astro frontmatter function', 'sym:fn:buildWidget'],
    // Astro <script> tag.
    ['astro script const', 'sym:const:WIDGET_ID'],
    ['astro script function', 'sym:fn:mountClient'],
  ])('resolves %s at tier 1', (_language, fragment) => {
    expect(find(fragment)).toMatchObject({ status: 'ok', tier: 'ast' });
  });

  it('marks .svelte and .astro as grammar-backed extensions', () => {
    expect(isSupportedExtension('.svelte')).toBe(true);
    expect(isSupportedExtension('.astro')).toBe(true);
  });

  it('reports a genuinely missing symbol as broken at the ast tier', () => {
    const r = find('sym:renderEverything');
    expect(r.status).toBe('broken');
    expect(r.tier).toBe('ast');
    expect(r.message).toContain('symbol not found');
    // The rich markup around the script parses cleanly, so the locator's
    // parse state must not masquerade as a script syntax error.
    expect(r.message).not.toContain('syntax errors');
  });

  it('trusts the injected script parse, not the outer locator parse', () => {
    // The outer Svelte grammar errors on the unterminated <div>, but the
    // script block is valid, so the definition is still found.
    expect(find('sym:fn:survivor')).toMatchObject({
      status: 'ok',
      tier: 'ast',
    });
    // A missing symbol in that file is a plain not-found, not a syntax error:
    // the locator's parse state says nothing about the script.
    const ghost = find('sym:ghost');
    expect(ghost.status).toBe('broken');
    expect(ghost.tier).toBe('ast');
    expect(ghost.message).toContain('symbol not found');
    expect(ghost.message).not.toContain('syntax errors');
  });

  it('still reports a broken script body as a syntax error', () => {
    const r = find('sym:oops');
    expect(r.status).toBe('broken');
    expect(r.tier).toBe('ast');
    expect(r.message).toContain('syntax errors');
  });
});

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { check } from '../src/check.js';
import { isSupportedExtension } from '../src/languages/index.js';
import { Resolver } from '../src/resolve.js';
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
    // Svelte, TypeScript script: every construct the TS tags query captures.
    ['svelte interface', 'sym:type:CardProps'],
    ['svelte type alias', 'sym:type:CardId'],
    ['svelte enum', 'sym:type:CardState'],
    ['svelte enum member', 'sym:CardState.Expanded'],
    ['svelte zero-valued enum member', 'sym:CardState.Collapsed'],
    ['svelte namespace', 'sym:type:cards'],
    ['svelte namespace function', 'sym:cards.describe'],
    ['svelte class', 'sym:class:UserCard'],
    ['svelte static field', 'sym:const:UserCard.VERSION'],
    ['svelte instance field', 'sym:const:UserCard.limit'],
    ['svelte arrow-function field', 'sym:fn:UserCard.onSelect'],
    ['svelte accessor', 'sym:UserCard.state'],
    ['svelte class method', 'sym:UserCard.render'],
    ['svelte async method', 'sym:UserCard.load'],
    ['svelte generator method', 'sym:UserCard.walk'],
    ['svelte static method', 'sym:UserCard.create'],
    ['svelte function', 'sym:fn:makeCard'],
    ['svelte async function', 'sym:fn:fetchCard'],
    ['svelte generator function', 'sym:fn:cardIds'],
    ['svelte arrow const', 'sym:fn:buildCard'],
    ['svelte object literal', 'sym:const:cardActions'],
    ['svelte object member', 'sym:const:cardActions.open'],
    ['svelte function-valued member', 'sym:fn:cardActions.close'],
    ['svelte as const object', 'sym:const:CARD_DEFAULTS'],
    ['svelte as const member', 'sym:const:CARD_DEFAULTS.theme'],
    ['svelte const', 'sym:const:MAX_CARDS'],
    // Svelte module script + plain-JS instance script, in one file.
    ['svelte module const', 'sym:const:increments'],
    ['svelte module function', 'sym:fn:describeModule'],
    ['svelte plain-js class', 'sym:class:Counter'],
    ['svelte plain-js static field', 'sym:const:Counter.STEP'],
    ['svelte plain-js field', 'sym:const:Counter.total'],
    ['svelte plain-js arrow field', 'sym:fn:Counter.onTick'],
    ['svelte plain-js class method', 'sym:Counter.reset'],
    ['svelte plain-js async method', 'sym:Counter.flush'],
    ['svelte plain-js object literal', 'sym:const:counterActions'],
    ['svelte plain-js object member', 'sym:const:counterActions.bump'],
    ['svelte plain-js fn member', 'sym:fn:counterActions.clear'],
    ['svelte plain-js function', 'sym:fn:increment'],
    // Astro frontmatter: the same construct matrix.
    ['astro frontmatter interface', 'sym:type:Props'],
    ['astro frontmatter type alias', 'sym:type:WidgetId'],
    ['astro frontmatter enum', 'sym:type:WidgetState'],
    ['astro frontmatter enum member', 'sym:WidgetState.Busy'],
    ['astro frontmatter zero enum member', 'sym:WidgetState.Idle'],
    ['astro frontmatter namespace', 'sym:type:widgets'],
    ['astro frontmatter namespace fn', 'sym:widgets.describe'],
    ['astro frontmatter class', 'sym:class:Widget'],
    ['astro frontmatter static field', 'sym:const:Widget.VERSION'],
    ['astro frontmatter field', 'sym:const:Widget.size'],
    ['astro frontmatter arrow field', 'sym:fn:Widget.onTap'],
    ['astro frontmatter accessor', 'sym:Widget.state'],
    ['astro frontmatter class method', 'sym:Widget.render'],
    ['astro frontmatter async method', 'sym:Widget.hydrate'],
    ['astro frontmatter static method', 'sym:Widget.create'],
    ['astro frontmatter function', 'sym:fn:buildWidget'],
    ['astro frontmatter async fn', 'sym:fn:fetchWidget'],
    ['astro frontmatter generator', 'sym:fn:widgetIds'],
    ['astro frontmatter arrow const', 'sym:fn:makeWidget'],
    ['astro frontmatter object literal', 'sym:const:widgetActions'],
    ['astro frontmatter object member', 'sym:const:widgetActions.show'],
    ['astro frontmatter fn member', 'sym:fn:widgetActions.hide'],
    ['astro frontmatter as const object', 'sym:const:WIDGET_DEFAULTS'],
    ['astro frontmatter as const member', 'sym:const:WIDGET_DEFAULTS.theme'],
    // Astro <script> tag, resolved independently of the frontmatter.
    ['astro script const', 'sym:const:WIDGET_ID'],
    ['astro script class', 'sym:class:ClientWidget'],
    ['astro script method', 'sym:ClientWidget.mount'],
    ['astro script function', 'sym:fn:mountClient'],
  ])('resolves %s at tier 1', (_language, fragment) => {
    expect(find(fragment)).toMatchObject({ status: 'ok', tier: 'ast' });
  });

  /**
   * Guards the construct matrix above: if a query change starts capturing a
   * new definition in these fixtures, it must gain a ref rather than go
   * silently unverified. Local variables are incidental captures, not
   * constructs a doc would ever point at.
   */
  it('references every definition the fixtures expose', async () => {
    const fixture = await setupFixture('embedded');
    try {
      const resolver = new Resolver(fixture.dir);
      const doc = await readFile(
        path.join(fixture.dir, 'docs', 'embedded.md'),
        'utf8',
      );
      const localVariables = new Set([
        'count',
        'node',
        'mountClient.mounted',
        'ClientWidget.mount.mounted',
      ]);

      const unreferenced: string[] = [];
      for (const file of [
        'UserCard.svelte',
        'Counter.svelte',
        'Widget.astro',
      ]) {
        const defs = await resolver.definitionsForFile(`src/${file}`);
        expect(defs, `expected definitions in ${file}`).not.toBeNull();
        for (const def of defs!) {
          const chain = def.chain.join('.');
          if (localVariables.has(chain)) continue;
          if (!doc.includes(`:${chain})`))
            unreferenced.push(`${file} ${chain}`);
        }
      }

      expect(unreferenced).toEqual([]);
    } finally {
      await fixture.cleanup();
    }
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

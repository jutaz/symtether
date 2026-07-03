import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { globby } from 'globby';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';
// The site build dogfoods the library itself (Law 9): every #sym: ref in the
// docs is resolved through the real Resolver; broken refs fail the build.
// Requires `npm run build` first (imports from dist/).
import { extractRefs, Resolver } from '../../dist/index.js';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const GITHUB = 'https://github.com/jutaz/symtether';

/**
 * Pre-resolve all #sym: refs in the source markdown files and build an
 * href -> GitHub deep link map. Pre-computed because markdown-it rules are
 * synchronous while resolution is async. Keyed by raw href: all our docs
 * write refs from repo-root context, so hrefs are unambiguous.
 */
async function buildRefRewrites(): Promise<Map<string, string>> {
  const resolver = new Resolver(repoRoot);
  const rewrites = new Map<string, string>();
  const failures: string[] = [];

  // Every markdown file that can render on the site, discovered — never
  // hardcoded, so a new docs page with a broken ref fails the build instead
  // of shipping unverified. SPEC.md is @include'd into docs/spec/index.md.
  const sources = [
    'SPEC.md',
    ...(await globby('docs/**/*.md', { cwd: repoRoot })).sort(),
  ];

  for (const doc of sources) {
    const abs = path.join(repoRoot, doc);
    const content = await readFile(abs, 'utf8').catch(() => null);
    if (content === null) continue;
    // Refs in included files resolve relative to where they were AUTHORED
    // (README.md sits at the repo root), which is what extractRefs gets.
    for (const ref of extractRefs(repoRoot, doc, content)) {
      const href = ref.fragment
        ? `${ref.rawTarget}#${ref.fragment}`
        : ref.rawTarget;
      // Keyed by raw href as written. `src/x.ts#…` and `/src/x.ts#…` are
      // distinct keys that resolve to the same rewrite — harmless.
      if (rewrites.has(href)) continue;
      const resolution = await resolver.resolve(ref);
      if (resolution.status === 'broken') {
        failures.push(`${doc}:${ref.line} ${href} — ${resolution.message}`);
        continue;
      }
      const anchor = resolution.matchLine ? `#L${resolution.matchLine}` : '';
      rewrites.set(href, `${GITHUB}/blob/main/${ref.targetPath}${anchor}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `site build aborted — broken #sym: refs:\n  ${failures.join('\n  ')}`,
    );
  }
  return rewrites;
}

const refRewrites = await buildRefRewrites();

export default defineConfig({
  title: 'symtether',
  description:
    'Stateless linter for symbol references in markdown — referential integrity for the docs AI agents treat as executable context.',
  cleanUrls: true,
  srcExclude: [],

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide' },
      { text: 'Spec', link: '/spec/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/symtether' },
    ],
    sidebar: [
      { text: 'Guide', link: '/guide' },
      { text: 'The #sym: syntax (SPEC v1)', link: '/spec/' },
    ],
    socialLinks: [{ icon: 'github', link: GITHUB }],
    outline: { level: [2, 3] },
    search: { provider: 'local' },
    footer: {
      message:
        'Refs on this site are verified by symtether itself at build time.',
      license: 'MIT',
    },
  },

  markdown: {
    config(md) {
      // Rewrite verified #sym: refs (and repo file links) to GitHub deep
      // links with #L anchors from the resolver's matchLine.
      // Ordering matters: VitePress installs its own link plugin BEFORE this
      // config callback runs, so `defaultOpen` wraps it and rewritten hrefs
      // are classified (external attrs, dead-link check) correctly. Don't
      // move this into a markdown-it plugin registered earlier.
      const defaultOpen =
        md.renderer.rules.link_open ??
        ((tokens, idx, options, _env, self) =>
          self.renderToken(tokens, idx, options));
      md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
        const token = tokens[idx]!;
        const href = token.attrGet('href');
        if (href) {
          const rewritten = refRewrites.get(href);
          if (rewritten) token.attrSet('href', rewritten);
        }
        return defaultOpen(tokens, idx, options, env, self);
      };
    },
  },

  async buildEnd(siteConfig) {
    // Plain-text routes for fetching agents (§13): /spec.md and /llms.txt.
    await copyFile(
      path.join(repoRoot, 'SPEC.md'),
      path.join(siteConfig.outDir, 'spec.md'),
    );
    await writeFile(
      path.join(siteConfig.outDir, 'llms.txt'),
      `# symtether

> Stateless linter for #sym: symbol references in markdown. Links like
> [x](path/file.ts#sym:Class.method) point at a symbol in that file;
> \`npx symtether check\` fails CI when a reference is broken.

## Docs

- [Spec](https://symtether.dev/spec.md): the #sym: reference syntax — canonical form, compat forms, matching semantics
- [README](https://github.com/jutaz/symtether#readme): commands, resolution tiers, staleness workflow
`,
    );
  },
});

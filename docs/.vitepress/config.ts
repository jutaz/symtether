import { execFileSync } from 'node:child_process';
import { copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { globby } from 'globby';
import { fileURLToPath } from 'node:url';
import { buildEndGenerateOpenGraphImages } from '@nolebase/vitepress-plugin-og-image/vitepress';
import { defineConfig } from 'vitepress';
import llmstxt from 'vitepress-plugin-llms';
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
 * Deep links pin to the ref being built, never a branch. Line anchors
 * computed against `main` would drift as soon as the next commit shifts
 * lines in the target file — the exact rot this tool exists to catch.
 *
 * Resolution order:
 * 1. an exact tag (release builds link to blob/v0.2.0/… — as immutable
 *    as a SHA, and the URL says which release the docs describe)
 * 2. the commit SHA (Workers Builds sets WORKERS_CI_COMMIT_SHA; GitHub
 *    Actions sets GITHUB_SHA; local builds ask git)
 * 3. `main` (no git at all, e.g. a tarball build)
 */
function buildRef(): string {
  const git = (...args: string[]): string | null => {
    try {
      return execFileSync('git', args, {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };

  // CI tag builds: GitHub Actions exposes the tag name directly.
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME) {
    return process.env.GITHUB_REF_NAME;
  }
  // Workers Builds / local: HEAD may sit exactly on a tag.
  const tag = git('describe', '--exact-match', '--tags', 'HEAD');
  if (tag) return tag;

  const sha = process.env.WORKERS_CI_COMMIT_SHA ?? process.env.GITHUB_SHA;
  if (sha) return sha;
  return git('rev-parse', 'HEAD') ?? 'main';
}

const COMMIT = buildRef();

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
      rewrites.set(href, `${GITHUB}/blob/${COMMIT}/${ref.targetPath}${anchor}`);
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

const SITE = 'https://symtether.dev';
const DESCRIPTION =
  'symtether checks the symbol references in your markdown against the code itself and fails CI when they break. Built for AGENTS.md and the docs coding agents read as instructions.';

export default defineConfig({
  title: 'symtether',
  description: DESCRIPTION,
  cleanUrls: true,
  srcExclude: [],
  lastUpdated: true,
  sitemap: { hostname: SITE },

  head: [
    ['link', { rel: 'canonical', href: SITE }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#0B0E13' }],
    // Open Graph / Twitter: link previews in Slack, X, Discord, etc.
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'symtether' }],
    [
      'meta',
      {
        property: 'og:title',
        content: 'symtether — docs that point at real code',
      },
    ],
    ['meta', { property: 'og:description', content: DESCRIPTION }],
    ['meta', { property: 'og:url', content: SITE }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    [
      'meta',
      {
        name: 'twitter:title',
        content: 'symtether — docs that point at real code',
      },
    ],
    ['meta', { name: 'twitter:description', content: DESCRIPTION }],
    // Structured data: software application, for rich results.
    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'symtether',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Linux, macOS, Windows',
        description: DESCRIPTION,
        url: SITE,
        downloadUrl: 'https://www.npmjs.com/package/symtether',
        license: 'https://opensource.org/licenses/MIT',
        offers: { '@type': 'Offer', price: '0' },
      }),
    ],
  ],

  vite: {
    plugins: [
      // Generates /llms.txt (index) and /llms-full.txt (all pages inlined)
      // plus per-page .md routes — the llmstxt.org convention.
      llmstxt({
        domain: 'https://symtether.dev',
        description:
          'Stateless linter for #sym: symbol references in markdown. ' +
          'Links like [x](path/file.ts#sym:Class.method) point at a symbol ' +
          'in that file; `npx symtether check` fails CI when a reference is broken.',
      }),
    ],
  },

  themeConfig: {
    logo: { src: '/logo-mark.svg', width: 38, height: 24, alt: 'symtether' },
    nav: [
      { text: 'Guide', link: '/guide' },
      { text: 'Spec', link: '/spec/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/symtether' },
    ],
    sidebar: [
      // 'Home' also opts the landing page into og-image generation — the
      // plugin only renders cards for pages present in the sidebar.
      { text: 'Home', link: '/' },
      { text: 'Guide', link: '/guide' },
      { text: 'Adding a language', link: '/adding-a-language' },
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
    // Root-level /spec.md alias (§13): the plugin already emits per-page
    // .md routes, but the spec URL is baked into third-party AGENTS.md
    // files — keep the stable short path serving the file verbatim.
    await copyFile(
      path.join(repoRoot, 'SPEC.md'),
      path.join(siteConfig.outDir, 'spec.md'),
    );
    // Social cards: renders docs/public/og-template.svg per page (satori/
    // resvg WASM — no native deps) and rewrites og:image/twitter:image.
    await buildEndGenerateOpenGraphImages({
      baseUrl: SITE,
      category: { byPathPrefix: [{ prefix: '/', text: 'symtether' }] },
    })(siteConfig);
  },
});

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
 * lines in the target file, which is the exact breakage this tool exists
 * to catch.
 *
 * Resolution order:
 * 1. an exact tag (release builds link to blob/v0.2.0/..., as immutable
 *    as a SHA, and the URL says which release the docs describe),
 * 2. the commit SHA (Workers Builds sets WORKERS_CI_COMMIT_SHA, GitHub
 *    Actions sets GITHUB_SHA, and local builds ask git),
 * 3. `main` (no git at all, e.g. a tarball build).
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

  // Every markdown file that can render on the site is discovered rather
  // than hardcoded, so a new docs page with a broken ref fails the build
  // instead of shipping unverified. SPEC.md is @include'd into
  // docs/spec/index.md.
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
      // Keyed by raw href as written. `src/x.ts#...` and `/src/x.ts#...` are
      // distinct keys that resolve to the same rewrite, which is harmless.
      if (rewrites.has(href)) continue;
      const resolution = await resolver.resolve(ref);
      if (resolution.status === 'broken') {
        failures.push(`${doc}:${ref.line} ${href}: ${resolution.message}`);
        continue;
      }
      const anchor = resolution.matchLine ? `#L${resolution.matchLine}` : '';
      rewrites.set(href, `${GITHUB}/blob/${COMMIT}/${ref.targetPath}${anchor}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `site build aborted, broken #sym: refs:\n  ${failures.join('\n  ')}`,
    );
  }
  return rewrites;
}

const refRewrites = await buildRefRewrites();

const SITE = 'https://symtether.dev';
const DESCRIPTION =
  "Broken URLs 404. Broken code references don't. #sym: verifies markdown references against the code itself, and fails CI when they break.";

// Structured data (JSON-LD): a linked graph of the entities that describe
// symtether. Cross-referenced by @id so knowledge-graph consumers (Google,
// LLM crawlers like GPTBot / ClaudeBot / PerplexityBot / Google-Extended)
// see one coherent entity, not four disconnected copies.
//
// - Organization: symtether as an authoring entity, wired to the GitHub
//   org and to the SoftwareApplication as author.
// - WebSite: enables Google's sitelinks searchbox, and marks /llms.txt as
//   the LLM-friendly index for crawler discovery.
// - SoftwareApplication: the npm package with pricing (free) and OS.
// - FAQPage: five load-bearing Q&As lifted from the docs (installation,
//   config, language coverage, how staleness works, CI integration).
//   These map directly to questions LLMs get asked and let the model
//   cite structured answers instead of paraphrasing.
const ORGANIZATION_ID = `${SITE}/#organization`;
const WEBSITE_ID = `${SITE}/#website`;
const SOFTWARE_ID = `${SITE}/#software`;

const organizationSchema = {
  '@type': 'Organization',
  '@id': ORGANIZATION_ID,
  name: 'symtether',
  url: SITE,
  logo: {
    '@type': 'ImageObject',
    url: `${SITE}/favicon-512.png`,
    width: 512,
    height: 512,
  },
  sameAs: [GITHUB, 'https://www.npmjs.com/package/symtether'],
};

const websiteSchema = {
  '@type': 'WebSite',
  '@id': WEBSITE_ID,
  url: SITE,
  name: 'symtether',
  description: DESCRIPTION,
  inLanguage: 'en',
  publisher: { '@id': ORGANIZATION_ID },
  // Sitelinks searchbox: powers the Google in-SERP search UI, and hints at
  // the URL scheme for crawlers that build site indexes.
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE}/?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

const softwareApplicationSchema = {
  '@type': 'SoftwareApplication',
  '@id': SOFTWARE_ID,
  name: 'symtether',
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Linux, macOS, Windows',
  description: DESCRIPTION,
  url: SITE,
  downloadUrl: 'https://www.npmjs.com/package/symtether',
  license: 'https://opensource.org/licenses/MIT',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  softwareRequirements: 'Node.js >= 20',
  author: { '@id': ORGANIZATION_ID },
  publisher: { '@id': ORGANIZATION_ID },
  sameAs: [GITHUB, 'https://www.npmjs.com/package/symtether'],
};

// FAQ entities: high-signal answers to the questions LLMs and search users
// most often ask about symtether. Kept short and factual so a model can
// quote them verbatim without paraphrase drift.
const faqSchema = {
  '@type': 'FAQPage',
  '@id': `${SITE}/#faq`,
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is symtether?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'symtether is a one-page open spec for #sym:, a portable markdown link fragment that points at a named symbol in source code, plus the reference toolkit that enforces it. When you write [fetchData](src/client.ts#sym:ApiClient.fetchData), the CLI verifies that ApiClient.fetchData still exists in src/client.ts, and fails CI when a reference is broken. The spec is open so other tools can implement it independently.',
      },
    },
    {
      '@type': 'Question',
      name: 'How do I install symtether?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You do not have to install symtether. Run `npx symtether check` in any repo. There is no config file, no repo indexing, no native compile, and exclusions come from your .gitignore.',
      },
    },
    {
      '@type': 'Question',
      name: 'Which languages does symtether support?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Eighteen languages resolve at the AST tier via tree-sitter: TypeScript, TSX, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C, C++, C#, Scala, Elixir, Lua, and Bash. Every other text file falls back to lexical (word-boundary) search, and file-only when the fragment cannot be checked. Every reference reports the tier it resolved at.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does symtether detect stale documentation?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '`symtether update` writes a symtether.sum file that stores a normalized, name-independent SHA-256 content hash of every referenced target. Reformatting does not change a hash. Renaming does not either. `symtether check --strict` flags refs whose target hash no longer matches, and lists every doc that references the changed target. The sum file is optional.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does symtether integrate with CI and coding agents?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '`npx symtether init --ci` scaffolds a GitHub Actions workflow that runs `symtether check` on every pull request. `npx symtether init` also adds a short managed block to AGENTS.md that tells coding agents (Claude Code, Zed, Cursor, etc.) to resolve refs by grepping, run check and fix after renaming symbols, and prefer #sym: refs over line numbers.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does symtether need a database or repo index?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. symtether is stateless. It reads the markdown file, resolves each ref against the referenced source file on disk, and exits. No database, no daemon, no repo indexing, no per-repo learning. The symtether.sum file, when it exists, only stores derived hashes and is regenerable at any time.',
      },
    },
  ],
};

export default defineConfig({
  title: 'symtether',
  description: DESCRIPTION,
  cleanUrls: true,
  srcExclude: [],
  lastUpdated: true,
  sitemap: { hostname: SITE },

  head: [
    // Canonical is set per-page in transformHead below so /guide and /spec
    // point at themselves, not the home page.
    // Icons: Google SERP prefers raster PNGs advertised at 48-multiple sizes
    // (developers.google.com/search/docs/appearance/favicon-in-search).
    // Chrome picks the largest matching size; Safari uses the SVG when
    // available. apple-touch-icon covers iOS home-screen and share sheets.
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '96x96',
        href: '/favicon-96.png',
      },
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '192x192',
        href: '/favicon-192.png',
      },
    ],
    [
      'link',
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '512x512',
        href: '/favicon-512.png',
      },
    ],
    [
      'link',
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
    ],
    // PWA manifest: Chrome / Android install prompt + richer install UX.
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],
    ['meta', { name: 'theme-color', content: '#0B0E13' }],
    ['meta', { name: 'color-scheme', content: 'dark light' }],
    // Preconnect to Google Fonts origins so the CSS + WOFF2 handshakes
    // start alongside the HTML request, not after the CSS parser sees the
    // @font-face rule. crossorigin is required for gstatic (font files).
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    [
      'link',
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    ],
    // Open Graph / Twitter: link previews in Slack, X, Discord, iMessage,
    // Telegram, LinkedIn, Facebook, and most LLM chat surfaces that hydrate
    // link cards (ChatGPT, Claude, Perplexity, Discord bots). og:image is
    // the single most important tag for these surfaces. Provide an explicit
    // og:image at the root so crawlers that don't follow to per-page cards
    // still see a good preview; per-page cards are generated by the plugin
    // in buildEnd and override this one on each page.
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'symtether' }],
    ['meta', { property: 'og:locale', content: 'en_US' }],
    [
      'meta',
      {
        property: 'og:title',
        content: 'symtether: docs that point at real code',
      },
    ],
    ['meta', { property: 'og:description', content: DESCRIPTION }],
    ['meta', { property: 'og:url', content: SITE }],
    ['meta', { property: 'og:image', content: `${SITE}/og-index.png` }],
    ['meta', { property: 'og:image:type', content: 'image/png' }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content:
          'symtether: docs that point at real code. A neon [fetchData](src/client.ts#sym:ApiClient.fetchData) reference on a terminal-dark background.',
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    [
      'meta',
      {
        name: 'twitter:title',
        content: 'symtether: docs that point at real code',
      },
    ],
    ['meta', { name: 'twitter:description', content: DESCRIPTION }],
    ['meta', { name: 'twitter:image', content: `${SITE}/og-index.png` }],
    [
      'meta',
      {
        name: 'twitter:image:alt',
        content:
          'symtether: docs that point at real code. A neon [fetchData](src/client.ts#sym:ApiClient.fetchData) reference on a terminal-dark background.',
      },
    ],
    // Structured data: one linked graph so Google, GPTBot, ClaudeBot,
    // PerplexityBot, and Google-Extended see a single coherent entity
    // rather than four disconnected copies. Includes:
    //   Organization. Authoring entity.
    //   WebSite. Site plus sitelinks searchbox.
    //   SoftwareApplication. The npm package.
    //   FAQPage. Six Q&As LLMs commonly get asked.
    [
      'script',
      { type: 'application/ld+json' },
      JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          organizationSchema,
          websiteSchema,
          softwareApplicationSchema,
          faqSchema,
        ],
      }),
    ],
  ],

  // Per-page structured data + canonical URL. Runs for every page in the
  // build so /guide, /adding-a-language, and /spec/ each get their own
  // TechArticle + BreadcrumbList schema, and their own canonical link.
  //
  // TechArticle (vs Article) is the right subtype for developer docs: it
  // is the schema.org type Google surfaces in the 'Developer docs' UI
  // treatment, and it lets LLM crawlers understand the page is
  // reference/how-to material rather than news.
  //
  // BreadcrumbList lifts the sidebar hierarchy into structured data so
  // Google can render breadcrumbs in the SERP and LLMs can reason about
  // the doc's place in the site.
  transformHead({ pageData }) {
    const relPath = pageData.relativePath
      .replace(/\.md$/, '')
      .replace(/\/index$/, '/');
    const pageUrl =
      relPath === '' || relPath === '/'
        ? SITE
        : `${SITE}/${relPath.replace(/^\/+/, '')}`;
    const isHome = relPath === '' || relPath === '/';
    const head: Array<
      | [string, Record<string, string>]
      | [string, Record<string, string>, string]
    > = [['link', { rel: 'canonical', href: pageUrl }]];
    if (!isHome) {
      // Human-readable title without the ' | symtether' suffix, matched
      // to the H1 or frontmatter title. pageData.title is what VitePress
      // renders as <title>, which already strips the site suffix.
      const title = pageData.title || 'symtether';
      const description = pageData.description || DESCRIPTION;
      const dateModified = pageData.lastUpdated
        ? new Date(pageData.lastUpdated).toISOString()
        : undefined;
      // Map each doc page onto its sidebar section for accurate
      // breadcrumbs. Home > Docs > <page>.
      const breadcrumbItems = [
        { name: 'Home', url: SITE },
        { name: 'Docs', url: `${SITE}/guide` },
        { name: title, url: pageUrl },
      ];
      const techArticleSchema = {
        '@type': 'TechArticle',
        headline: title,
        description,
        url: pageUrl,
        inLanguage: 'en',
        isPartOf: { '@id': WEBSITE_ID },
        about: { '@id': SOFTWARE_ID },
        author: { '@id': ORGANIZATION_ID },
        publisher: { '@id': ORGANIZATION_ID },
        image: `${SITE}/og-index.png`,
        ...(dateModified && { dateModified }),
        mainEntityOfPage: pageUrl,
      };
      const breadcrumbSchema = {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((item, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: item.name,
          item: item.url,
        })),
      };
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({
          '@context': 'https://schema.org',
          '@graph': [techArticleSchema, breadcrumbSchema],
        }),
      ]);
    }
    return head;
  },

  vite: {
    plugins: [
      // Generates /llms.txt (index) and /llms-full.txt (all pages inlined)
      // plus per-page .md routes, following the llmstxt.org convention.
      llmstxt({
        domain: 'https://symtether.dev',
        description:
          "Broken URLs 404. Broken code references don't. " +
          '#sym: verifies markdown references against the code itself, ' +
          'and fails CI when they break. Links like ' +
          '`[x](path/file.ts#sym:Class.method)` point at a symbol in that ' +
          'file; `npx symtether check` fails CI when a reference is broken.',
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
      // Grouped so vitepress-plugin-llms emits a named '### Docs' section
      // in llms.txt instead of a single '### Other' bucket. 'Home' also
      // opts the landing page into og-image generation, because the
      // plugin only renders cards for pages present in the sidebar.
      { text: 'Home', link: '/' },
      {
        text: 'Docs',
        items: [
          { text: 'Guide', link: '/guide' },
          { text: 'Adding a language', link: '/adding-a-language' },
          { text: 'The #sym: syntax (SPEC v1)', link: '/spec/' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: GITHUB }],
    outline: { level: [2, 3] },
    search: { provider: 'local' },
    footer: {
      // Machine-friendly index for LLMs / agents. Emitted by
      // vitepress-plugin-llms; linking it visibly makes it discoverable
      // from every page, not only crawlable from the root.
      message:
        'Refs on this site are verified by symtether itself at build time. ' +
        'LLM-friendly index: <a href="/llms.txt">/llms.txt</a> · ' +
        '<a href="/llms-full.txt">/llms-full.txt</a>.',
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
    // files, so we keep the stable short path serving the file verbatim.
    await copyFile(
      path.join(repoRoot, 'SPEC.md'),
      path.join(siteConfig.outDir, 'spec.md'),
    );
    // The og-image plugin reads the sidebar item's `text` as the page title
    // it renders into the OG card. The home sidebar entry is 'Home' by
    // design (users see it in the doc sidebar), but 'Home' is a useless
    // preview in Slack / X / iMessage / ChatGPT. Swap it to a tagline for
    // the OG render only, then restore. `line1\nline2` renders on two
    // lines in og-template.svg (each line under the 17-char plugin wrap).
    const themeConfig = siteConfig.site.themeConfig as {
      sidebar?: Array<{ text?: string; link?: string }>;
    };
    const homeItem = themeConfig.sidebar?.find(
      (item) => item.link === '/' && item.text === 'Home',
    );
    const savedHomeText = homeItem?.text;
    if (homeItem) homeItem.text = 'Docs that point\nat real code';
    try {
      // Social cards: renders docs/public/og-template.svg per page (satori
      // and resvg WASM, no native deps) and rewrites og:image/twitter:image.
      await buildEndGenerateOpenGraphImages({
        baseUrl: SITE,
        category: { byPathPrefix: [{ prefix: '/', text: 'symtether' }] },
      })(siteConfig);
    } finally {
      if (homeItem && savedHomeText !== undefined)
        homeItem.text = savedHomeText;
    }
  },
});

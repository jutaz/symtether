# AGENTS.md

Instructions for coding agents working in this repository.

## Project

symtether is a stateless linter for `#sym:` symbol references in markdown.
`handoff.md` is the v0.1 design source of truth — when in doubt, defer to it.
`SPEC.md` is the normative reference syntax spec and must stay in sync with
the resolver's behavior.

## Layout

- [extract.ts](src/extract.ts#sym:fn:extractRefs) — markdown → `Ref[]`
- [resolve.ts](src/resolve.ts#sym:class:Resolver) — `Ref` → `Resolution` (three tiers: ast, lexical, file-only)
- [languages/](src/languages/index.ts#sym:fn:loadLanguage) — grammar registry; languages are data, matching logic lives in the resolver
- [check.ts](src/check.ts#sym:fn:check) / [fix.ts](src/fix.ts#sym:fn:fix) / [init.ts](src/init.ts#sym:fn:init) / [update.ts](src/update.ts#sym:fn:update) — the four commands, also the library API
- [checksum.ts](src/checksum.ts#sym:fn:hashDefinition) — normalized, name-independent AST hashes; [sumfile.ts](src/sumfile.ts#sym:fn:parseSumFile) — `symtether.sum` (derived, regenerable, never a source of truth)
- `src/cli.ts` — thin commander shell; exit codes 0/1/2
- `test/fixtures/` — small fake repos with intentionally broken refs; excluded from dogfood checks

## Commands

- `npm test` — build + full vitest suite (build first: tests exercise `grammars/`)
- `npm run lint` — eslint + prettier check
- `npm run build` — tsc + copy WASM grammars into `grammars/`
- `node dist/cli.js check --strict --exclude 'test/fixtures/**'` — dogfood check (CI runs this)
- `node dist/cli.js update --exclude 'test/fixtures/**'` — re-stamp `symtether.sum` after reviewing docs whose refs went stale
- `npm run build:site` / `npm run dev:site` — VitePress site (symtether.dev)
  from `docs/`; the config resolves every `#sym:` ref through the library and
  fails the build on broken ones. Deployed by Cloudflare Workers Builds
  (native Git integration, dashboard-configured — fork PRs never build there);
  `wrangler.jsonc` serves `docs/.vitepress/dist` as static assets.

## Rules

- Design laws in `handoff.md` §4 are non-negotiable: stateless, zero-config,
  markdown links as sole source of truth, no native compilation, no repo
  indexing, spec stays one page.
- Deviation on record: file exclusion uses the repo's `.gitignore` (via
  globby) instead of a hardcoded exclude list — assume nothing about project
  layout beyond what git knows.
- Deviation on record: sum-file keys are kind-independent (`path#dotpath`,
  no `fn:` prefix) — §9.1 requires one entry per unique target, and
  `#sym:fn:parse` / `#sym:parse` / compat `#parse` are the same target.
- Deviation on record: sum-file lines use fixed two-space separators, not
  aligned columns — alignment would rewrite every line when a longer entry
  lands, amplifying the merge conflicts §9.1 exists to avoid.
- Deviation on record: hashes are full SHA-256, not §9.1's 16-hex
  truncation — the only cost is line width in a derived file, and the
  `sha256:` prefix should mean sha256.
- `queries/*.extra.scm` supplement the upstream tags.scm (const/let/var,
  TS namespaces/type/enum, Python class attributes, JS private methods);
  `copy-grammars.mjs` concatenates them at build time. Never duplicate a
  pattern across javascript.extra.scm and typescript.extra.scm — the
  resolver already layers the JS query under the TS one.
- Grammar packages are devDependencies only; the published package ships
  prebuilt WASM copied at build time by `scripts/copy-grammars.mjs`.
- Every failure message must give an agent enough to act: doc + line, cause,
  candidates, and the fix command.
- Fixture-test every edge case you touch; keep `--json` output stable against
  `schemas/check-output.schema.json`.

<!-- symtether:begin v1 (managed by `symtether init` — do not edit) -->
## Code references
Links like `[x](path/file.ts#sym:Class.method)` point at a symbol in that file.
- Resolve: grep the symbol name in the file; read the surrounding code.
- After renaming/moving symbols: run `npx symtether check`, repair refs (`npx symtether fix`).
- When writing docs/skills, prefer `#sym:` refs over line numbers or pasted snippets.
- On stale refs: re-read the doc prose against the current code; fix the doc or run `npx symtether update <target>`.
Spec: https://symtether.dev/spec
<!-- symtether:end -->

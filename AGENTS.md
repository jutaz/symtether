# AGENTS.md

Instructions for coding agents working in this repository.

## Project

symtether is a one-page open spec for `#sym:` symbol references in
markdown, plus the stateless reference toolkit that enforces it.
`SPEC.md` is the normative reference syntax spec and must stay in
sync with the resolver's behavior.

## Layout

- [extract.ts](src/extract.ts#sym:fn:extractRefs). markdown to [`Ref`](src/types.ts#sym:type:Ref)`[]`.
- [resolve.ts](src/resolve.ts#sym:class:Resolver). [`Ref`](src/types.ts#sym:type:Ref) to [`Resolution`](src/types.ts#sym:type:Resolution), in three tiers: ast, lexical, file-only.
- [languages/](src/languages/index.ts#sym:fn:loadLanguage). Grammar registry. Languages are data, matching logic lives in the resolver.
- [check.ts](src/check.ts#sym:fn:check), [fix.ts](src/fix.ts#sym:fn:fix), [init.ts](src/init.ts#sym:fn:init), [update.ts](src/update.ts#sym:fn:update). The four commands, also the library API.
- [checksum.ts](src/checksum.ts#sym:fn:hashDefinition). Normalized, name-independent AST hashes.
- [sumfile.ts](src/sumfile.ts#sym:fn:parseSumFile). `symtether.sum` (derived, regenerable, never a source of truth).
- `src/cli.ts`. Thin commander shell. Exit codes 0, 1, 2.
- `test/fixtures/`. Small fake repos with intentionally broken refs. Excluded from dogfood checks.

## Commands

- `npm test`. Build plus the full vitest suite. Build first, because tests exercise `grammars/`.
- `npm run lint`. Runs eslint and the prettier check.
- `npm run build`. Runs tsc and copies WASM grammars into `grammars/`.
- `node dist/cli.js check --strict --exclude 'test/fixtures/**'`. Dogfood check. CI runs this.
- `node dist/cli.js update --exclude 'test/fixtures/**'`. Re-stamp `symtether.sum` after reviewing docs whose refs went stale.
- `node dist/cli.js update --check --exclude 'test/fixtures/**'`. CI gate. Fails when `symtether.sum` is out of date. Also runs in the dogfood job.
- `npm run build:site` and `npm run dev:site`. VitePress site (symtether.dev)
  from `docs/`. The config resolves every `#sym:` ref through the library and
  fails the build on broken ones. Deployed by Cloudflare Workers Builds
  through its native Git integration, and configured in the dashboard, so
  fork PRs never build there. `wrangler.jsonc` serves
  `docs/.vitepress/dist` as static assets.
- `npm run favicons:build`. Regenerates PNG favicons and apple-touch-icon
  under `docs/public/` from `docs/public/favicon.svg` via `@resvg/resvg-wasm`.
  Committed artifacts, not part of `build:site`. Rerun only when the SVG
  changes.

## Rules

- Design laws: stateless, zero-config, markdown links as sole source of
  truth, no native compilation, no repo indexing, spec stays one page.
  Do not trade these away for features.
- Deviation on record: file exclusion uses the repo's `.gitignore` (via
  globby) instead of a hardcoded exclude list. Assume nothing about
  project layout beyond what git knows.
- Deviation on record: sum-file keys are kind-independent (`path#dotpath`,
  no `fn:` prefix), because §9.1 requires one entry per unique target, and
  `#sym:fn:parse` and `#sym:parse` and compat `#parse` are the same target.
- Deviation on record: sum-file lines use fixed two-space separators, not
  aligned columns. Alignment would rewrite every line whenever a longer
  entry lands, which is exactly the merge-conflict amplification the
  line-oriented format is meant to avoid.
- Deviation on record: hashes are full SHA-256, not 16-hex truncation.
  The only cost is line width in a derived file.
- `queries/*.extra.scm` supplement the upstream tags.scm (const/let/var,
  TS namespaces/type/enum, Python class attributes, JS private methods),
  and `copy-grammars.mjs` concatenates them at build time. Never duplicate
  a pattern across javascript.extra.scm and typescript.extra.scm, because
  the resolver already layers the JS query under the TS one.
- `.npmrc` sets `ignore-scripts=true`, because grammar packages would
  otherwise node-gyp-compile native bindings we never use, which breaks
  on hosts that run plain `npm ci` (Cloudflare Workers Builds). One
  consequence is that `prepublishOnly` does not fire, so the publish
  workflow builds and tests explicitly.
- Grammar packages are devDependencies only. The published package ships
  prebuilt WASM copied at build time by `scripts/copy-grammars.mjs`.
  Swift's WASM is compiled by us and committed under `vendor/grammars/`
  because upstream publishes none. Re-vendor with `npm run vendor:swift`
  (needs Docker). Regular builds never do.
- Failure messages must include the doc and line, the cause, the
  candidate matches, and the fix command.
- Fixture-test every edge case you touch, and keep `--json` output stable
  against `schemas/check-output.schema.json`.

<!-- symtether:begin v1 (managed by `symtether init` — do not edit) -->
## Code references
Links like `[x](path/file.ts#sym:Class.method)` point at a symbol in that file.
- Resolve: grep the symbol name in the file; read the surrounding code.
- After renaming/moving symbols: run `npx symtether check`, repair refs (`npx symtether fix`).
- When writing docs/skills, prefer `#sym:` refs over line numbers or pasted snippets.
- On stale refs: re-read the doc prose against the current code; fix the doc or run `npx symtether update <target>`.
Spec: https://symtether.dev/spec
<!-- symtether:end -->

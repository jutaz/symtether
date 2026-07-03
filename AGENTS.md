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

## Rules

- Design laws in `handoff.md` §4 are non-negotiable: stateless, zero-config,
  markdown links as sole source of truth, no native compilation, no repo
  indexing, spec stays one page.
- Deviation on record: file exclusion uses the repo's `.gitignore` (via
  globby) instead of a hardcoded exclude list — assume nothing about project
  layout beyond what git knows.
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

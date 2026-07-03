# Guide

symtether validates *symbol references* in markdown — links that point not
just at a source file, but at a specific function, class, method, type, or
constant inside it — and fails CI when one breaks.

## Install & first run

No install needed:

```console
npx symtether check
```

Exit codes: `0` all refs pass · `1` broken refs (or stale under `--strict`) ·
`2` usage or runtime error.

Default scope is every `**/*.md` in the repo; exclusions come straight from
your `.gitignore` ([GLOB_OPTIONS](/src/check.ts#sym:const:GLOB_OPTIONS)).

## Commands

```console
npx symtether check [globs…]       # validate refs; exit 1 on broken
npx symtether check --json         # stable machine output
npx symtether fix [globs…]         # propose repairs (dry-run)
npx symtether fix --write          # apply them
npx symtether fix --canonicalize   # also rewrite compat-form refs to #sym:
npx symtether init                 # install the agent block into AGENTS.md
npx symtether init --ci            # + a GitHub Actions workflow
npx symtether update [targets…]    # stamp review: write symtether.sum hashes
npx symtether check --strict       # also fail when stamped targets changed
npx symtether check --strict=warn  # …or just report staleness
```

The CLI is a thin shell over the library:

```ts
import { check } from 'symtether';
const report = await check({ cwd: '/path/to/repo' });
```

## Resolution tiers

Every ref resolves at exactly one tier, always reported — a ref symtether
couldn't fully verify is never silently passed
([Resolver](/src/resolve.ts#sym:class:Resolver)):

| Tier | When | Meaning |
|---|---|---|
| `ast` | TypeScript, TSX, JavaScript, Python | Symbol verified against the parsed AST |
| `lexical` | any other text file | Word-boundary match for the symbol name |
| `file-only` | fragment not checkable | Path existence only, reported as a warning |

More tier-1 languages (Go, Rust, Java) land on request — each is roughly a
grammar import plus fixtures
([loadLanguage](/src/languages/index.ts#sym:fn:loadLanguage)).

## Teaching your agents

```console
npx symtether init
```

installs a short managed block into `AGENTS.md` (idempotent — re-running
updates it in place, never duplicates). The block teaches agents to resolve
refs by grepping, to run `check`/`fix` after renaming symbols, and to prefer
`#sym:` refs over line numbers when writing docs. CI is the backstop:

```console
npx symtether init --ci
```

## Staleness — opt-in, never a treadmill

By default `check` fails only on *broken* refs. To also learn when the
*implementation behind* a ref changes:

1. `npx symtether update` writes `symtether.sum` — normalized content hashes
   ([hashDefinition](/src/checksum.ts#sym:fn:hashDefinition)) for every
   resolvable ref. Reformatting never changes a hash; renaming doesn't
   either — hashes are name-independent, which is what makes
   content-verified rename autofix possible.
2. `npx symtether check --strict` marks refs stale when their target's hash
   no longer matches, and lists every doc referencing the changed target.
   `--strict=warn` reports without failing.
3. Re-read the prose, fix it or confirm it, then re-stamp with
   `npx symtether update <target>`.

The sum file is a shadow, never a source of truth — think `go.sum`, not
`package-lock.json`. Delete it: `check` passes/fails identically; `update`
regenerates it losslessly.

## Honest limits

- **Referential integrity, not semantic accuracy.** symtether guarantees the
  pointer resolves; it does not guarantee the prose around it is still true.
  The `--strict` layer surfaces semantic-drift *candidates*; judging them is
  delegated to humans and agents.
- **Lexical presence of a definition, not type resolution.** No import
  following, no re-export chasing. A symbol re-exported (but not defined) in
  the linked file is correctly broken — link to the defining file instead.

# symtether

> Checks that symbol references in your markdown still point at real code.
> Built for `AGENTS.md` and the other docs coding agents read as instructions.

[![CI](https://github.com/jutaz/symtether/actions/workflows/ci.yml/badge.svg)](https://github.com/jutaz/symtether/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/symtether)](https://www.npmjs.com/package/symtether)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**symtether** is a stateless, zero-config linter for links that point at a
specific function, class, method, type, or constant inside a source file:

```markdown
Follow the fetch pattern in [ApiClient.fetchData](src/api/client.ts#sym:ApiClient.fetchData).
```

`symtether check` resolves each reference against the code (tree-sitter
ASTs where supported, lexical search everywhere else) and fails CI when one
breaks — file moved, symbol renamed or deleted. `symtether fix` repairs the
common cases. `symtether init` adds a short section to `AGENTS.md` so
coding agents keep the references working.

Think eslint, but for code references in markdown.

## Why

`AGENTS.md`, `CLAUDE.md`, and skill files get read by coding agents as
instructions, and the most useful thing you can put in them is a pointer to
existing code: "follow the pattern in X." Those pointers rot. Nothing in a
standard toolchain fails when the referenced symbol gets renamed, so an
agent pointed at a deleted pattern wastes tokens hunting for it and then
imitates whatever it finds instead.

The `#sym:` convention helps even before you install anything. An agent
reading `src/client.ts#sym:ApiClient.fetchData` has the file path and an
exact string to grep, which beats a bare file link (read 400 lines and
hope) or a line-number link (read the wrong 20 lines after the file
shifts). symtether is what makes the convention enforceable.

## 30 seconds

```console
$ npx symtether check
docs/agents/fetching.md
  ✗ src/api/client.ts#sym:ApiClient.fetchData   BROKEN (line 14)
      file OK; symbol not found
      closest in file: ApiClient.fetchAgentData (method)
      → symtether fix docs/agents/fetching.md

$ npx symtether fix --write
$ npx symtether check && echo green
green
```

There is no config file and no lockfile. The markdown links are the only
state; exclusions come from your `.gitignore`
([GLOB_OPTIONS](src/check.ts#sym:const:GLOB_OPTIONS)).

## Usage

```console
npx symtether check [globs…]     # validate refs; exit 1 on broken
npx symtether check --json       # stable machine output (schemas/check-output.schema.json)
npx symtether fix [globs…]       # propose repairs (dry-run)
npx symtether fix --write        # apply them
npx symtether fix --canonicalize # also rewrite compat-form refs to #sym:
npx symtether init               # install the agent block into AGENTS.md
npx symtether init --ci          # + a GitHub Actions workflow
npx symtether update [targets…]  # stamp review: (re)generate symtether.sum
npx symtether update --check     # CI: fail if symtether.sum is out of date
npx symtether check --strict     # also fail when stamped targets changed
npx symtether check --strict=warn  # …or just report staleness
```

Exit codes: `0` all refs pass · `1` broken refs (or stale under `--strict`) · `2` usage or runtime error.

Or as a library — the CLI is a thin shell over
[check](src/check.ts#sym:fn:check), [fix](src/fix.ts#sym:fn:fix),
[init](src/init.ts#sym:fn:init), and [update](src/update.ts#sym:fn:update):

```ts
import { check } from 'symtether';
const report = await check({ cwd: '/path/to/repo' });
```

## The syntax

Full spec: [SPEC.md](SPEC.md). The short version:

```markdown
[text](path/to/file.ts#sym:Class.method)
[text](path/to/file.ts#sym:fn:parseConfig)      ← optional kind: fn | class | type | const
[text](/src/from-repo-root.ts#sym:Widget)
```

The dotpath is a suffix match against the definition's nesting chain, so the
natural short form works across languages. Exactly one match passes; zero is
broken; two or more is ambiguous and asks you to qualify.

## Resolution tiers

Every ref resolves at one of three tiers, and the tier is part of the
output — anything that couldn't be fully verified shows up as `lexical` or
`file-only` rather than passing quietly (see
[Resolver](src/resolve.ts#sym:class:Resolver)):

| Tier | When | Meaning |
|---|---|---|
| `ast` | TypeScript, TSX, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C, C++, C#, Scala, Elixir, Lua, Bash | Symbol verified against the parsed AST |
| `lexical` | any other text file | Word-boundary match for the symbol name |
| `file-only` | fragment not checkable | Path existence only, reported as a warning |

Adding a tier-1 language is mostly a grammar import plus fixtures (see the
registry in [loadLanguage](src/languages/index.ts#sym:fn:loadLanguage)) —
open an issue if yours is missing.

## Staleness detection

By default `check` fails only on broken refs. To also find out when the
implementation behind a ref changes:

1. `npx symtether update` writes `symtether.sum`: a normalized content hash
   ([hashDefinition](src/checksum.ts#sym:fn:hashDefinition)) for every
   resolvable ref. Reformatting doesn't change a hash. Renaming doesn't
   either — hashes are name-independent, which is what lets `fix` detect
   renames by content.
2. `npx symtether check --strict` marks refs stale when their target's
   hash no longer matches, and lists every doc referencing the changed
   target. `--strict=warn` reports without failing.
3. Re-read the prose, fix it or confirm it, then re-stamp with
   `npx symtether update <target>`.

The sum file works like `go.sum`, not `package-lock.json`
([sumfile.ts](src/sumfile.ts#sym:fn:parseSumFile)): it holds derived
checksums, not decisions. Delete it and `check` passes or fails exactly as
before; `update` writes it back. A repo that never runs `update` gives up
staleness detection and content-verified renames, nothing else.

One accepted trade-off: entries are per-target
([sumKey](src/sumfile.ts#sym:fn:sumKey) is deliberately kind-independent),
so re-stamping a target clears staleness for *all* docs that reference it —
which is why stale output lists every referencing doc for review.

## Limits

- symtether guarantees the pointer resolves. It does not guarantee the
  prose around the pointer is still true — `--strict` surfaces candidates
  for that kind of drift, but judging them is up to you (or your agents).
- Resolution checks that a definition exists in the linked file. There is
  no import following or re-export chasing, so a symbol re-exported (but
  not defined) in the linked file counts as broken — link to the defining
  file instead.

## Prior art

Other tools attack the same problem from different angles:

| Tool | Mechanism | Difference |
|---|---|---|
| [Fiberplane Drift](https://github.com/fiberplane/drift) | Stateful binder: `drift link` writes bindings + AST fingerprints into `drift.lock` | Lockfile is the source of truth; refs aren't clickable markdown; every intentional change needs re-stamping |
| [docref](https://github.com/supersterling/docref) | Closest mechanical prior art: markdown `path#Symbol` links, tree-sitter, `.docref.lock` | Also lockfile-first and staleness-first; cargo-only; no agent orientation. It independently invented much of this mechanism first — credit where due |
| [Roam-Code](https://github.com/Cranot/roam-code) | Codebase-intelligence platform with a SQLite symbol index | Platform-weight; doc checking is one feature among hundreds |
| [AgentLinter](https://github.com/seojoonkim/agentlinter) | Lints AGENTS.md structure, token budget, stale *file* refs | File-level only — complementary; a repo can run both |

What symtether does differently: no lockfile or index to maintain, ordinary
clickable markdown links as the only source of truth, and checking that
fails only when a ref is actually broken — staleness detection stays
opt-in. Drift's guarantees without Drift's ceremony.

## License

MIT © Justas Brazauskas

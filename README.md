# symtether

> Docs that point at real code — and fail CI when they stop.
> Built for `AGENTS.md` and the other docs coding agents read as instructions.

[![CI](https://github.com/jutaz/symtether/actions/workflows/ci.yml/badge.svg)](https://github.com/jutaz/symtether/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/symtether)](https://www.npmjs.com/package/symtether)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Your `AGENTS.md` says *"follow the pattern in `fetchData`."* Three sprints
later `fetchData` is gone — renamed, moved, refactored away. Nothing fails.
The doc still reads fine, and everyone it points at code that no longer
exists finds out the hard way.

Broken URLs 404. Broken code references don't:

```markdown
<!-- The file exists, so every link checker passes this — -->
<!-- but fetchData was renamed two weeks ago. -->
Follow the fetch pattern in [fetchData](src/api/client.ts#L42).
```

A link checker verifies the file. Nothing verifies the *symbol* — and the
`#L42` makes it worse by silently pointing at whatever moved into line 42.

**symtether** fixes this by making the reference name the symbol, then
checking it against the code itself:

```markdown
Follow the fetch pattern in [ApiClient.fetchData](src/api/client.ts#sym:ApiClient.fetchData).
```

Still a plain markdown link — renders and clicks on GitHub. But now
`symtether check` can resolve it against the AST and fail CI the moment the
symbol moves, gets renamed, or disappears. `symtether fix` repairs the
common cases automatically. Think eslint, but for the code references in
your markdown.

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

The rename that used to rot silently is a red build with the fix one
command away. There is no config file and no lockfile. The markdown links
are the only state; exclusions come from your `.gitignore`, plus
`node_modules`, which is always skipped
([GLOB_OPTIONS](src/check.ts#sym:const:GLOB_OPTIONS)).

## Why this matters more with agents

Coding agents read `AGENTS.md`, `CLAUDE.md`, and skill files as
instructions, and the highest-value instruction is a pointer to real code:
*"do it like X."* An agent pointed at a deleted symbol doesn't shrug like a
human — it searches, guesses, and confidently imitates whatever it finds
instead. Agents cause the rot too: every refactor an agent lands can break
the pointers the next session depends on.

The `#sym:` convention pays off even before the tool is installed. An agent
reading `src/client.ts#sym:ApiClient.fetchData` has the file path and an
exact string to grep, which beats a bare file link (read 400 lines and
hope) or a line-number link (read the wrong 20 lines with confidence).
symtether makes the convention enforceable: `check` in CI catches what
agents and humans break, `fix` repairs it, and `init` installs a short
managed block that teaches agents to keep refs working themselves.

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

Exit codes: `0` all refs pass · `1` broken refs (stale under `--strict`, or
an outdated sum file under `update --check`) · `2` usage or runtime error.

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

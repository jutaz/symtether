# symtether

> Referential integrity for code references in markdown — especially the docs
> AI agents treat as executable context.

[![CI](https://github.com/jutaz/symtether/actions/workflows/ci.yml/badge.svg)](https://github.com/jutaz/symtether/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/symtether)](https://www.npmjs.com/package/symtether)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**symtether** is a stateless, zero-config linter that validates *symbol
references* in plain markdown — links that point not just at a source file,
but at a specific function, class, method, type, or constant inside it:

```markdown
Follow the fetch pattern in [ApiClient.fetchData](src/api/client.ts#sym:ApiClient.fetchData).
```

`symtether check` resolves every such reference against your actual code
(tree-sitter ASTs where supported, lexical search everywhere else) and fails
CI when a reference is broken — the file moved, the symbol was renamed or
deleted. `symtether fix` repairs the common cases. `symtether init` teaches
your AI coding agents to read, write, and maintain these references.

Elevator pitch: **eslint for code references in markdown.**

## Why

`AGENTS.md`, `CLAUDE.md`, and skill files are read by coding agents and
treated as authoritative instructions. Their highest-leverage content is
pointers to existing code — *"follow the pattern in X."* But those pointers
rot silently: nothing in a standard toolchain fails when a referenced symbol
is renamed. An agent pointed at a deleted pattern burns tokens hunting for
it, or confidently imitates something else. The context file meant to prevent
bad code becomes a vector for it.

Even without symtether installed, a `#sym:` ref beats alternatives: an agent
reading `src/client.ts#sym:ApiClient.fetchData` has a file path *and* an
exact string to grep. The syntax has standalone value at zero installs; the
tool upgrades convention into guarantee.

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

No config, no lockfile, no index. Markdown links are the sole source of
truth; exclusions come straight from your `.gitignore`.

## Usage

```console
npx symtether check [globs…]     # validate refs; exit 1 on broken
npx symtether check --json       # stable machine output (schemas/check-output.schema.json)
npx symtether fix [globs…]       # propose repairs (dry-run)
npx symtether fix --write        # apply them
npx symtether fix --canonicalize # also rewrite compat-form refs to #sym:
npx symtether init               # install the agent block into AGENTS.md
npx symtether init --ci          # + a GitHub Actions workflow
npx symtether update [targets…]  # stamp review: write symtether.sum hashes
npx symtether check --strict     # also fail when stamped targets changed
npx symtether check --strict=warn# …or just report staleness
```

Exit codes: `0` all refs pass · `1` broken refs (or stale under `--strict`) · `2` usage or runtime error.

Or as a library — the CLI is a thin shell over
[check](src/check.ts#sym:fn:check), [fix](src/fix.ts#sym:fn:fix), and
[init](src/init.ts#sym:fn:init):

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

Every ref resolves at exactly one tier, always reported — a ref symtether
couldn't fully verify is never silently passed (see
[Resolver](src/resolve.ts#sym:class:Resolver)):

| Tier | When | Meaning |
|---|---|---|
| `ast` | TypeScript, TSX, JavaScript, Python | Symbol verified against the parsed AST |
| `lexical` | any other text file | Word-boundary match for the symbol name |
| `file-only` | fragment not checkable | Path existence only, reported as a warning |

More tier-1 languages (Go, Rust, Java) land on request — each is roughly a
grammar import plus fixtures.

## Staleness — opt-in, never a treadmill

By default `check` fails only on *broken* refs. If you want to know when the
*implementation behind* a ref changes, opt in:

1. `npx symtether update` writes `symtether.sum` — normalized content hashes
   ([hashDefinition](src/checksum.ts#sym:fn:hashDefinition)) for every
   resolvable ref. Reformatting never changes a hash; renaming doesn't
   either (hashes are name-independent — that's what makes
   content-verified rename autofix possible).
2. `npx symtether check --strict` marks refs stale when their target's
   hash no longer matches, and lists every doc referencing the changed
   target. `--strict=warn` reports without failing.
3. Re-read the prose, fix it or confirm it, then re-stamp with
   `npx symtether update <target>`.

The sum file is a shadow, never a source of truth — think `go.sum`, not
`package-lock.json` ([sumfile.ts](src/sumfile.ts#sym:fn:parseSumFile)).
Delete it: `check` passes/fails identically; `update` regenerates it
losslessly. A repo that never runs `update` loses nothing but staleness
detection and rename certainty.

One accepted trade-off: entries are per-target, so re-stamping a target
clears staleness for *all* docs that reference it — which is why stale
output lists every referencing doc for review.

## Honest limits

- **Referential integrity, not semantic accuracy.** symtether guarantees the
  pointer resolves; it does not guarantee the prose around it is still true.
- **Lexical presence of a definition, not type resolution.** No import
  following, no re-export chasing. A symbol re-exported (but not defined) in
  the linked file is correctly broken — link to the defining file.

## Prior art

The niche is real and forming — these tools approach the same rot from
different corners, and credit is due:

| Tool | Mechanism | Difference |
|---|---|---|
| [Fiberplane Drift](https://github.com/fiberplane/drift) | Stateful binder: `drift link` writes bindings + AST fingerprints into `drift.lock` | Lockfile is the source of truth; refs aren't clickable markdown; every intentional change needs re-stamping |
| [docref](https://github.com/supersterling/docref) | Closest mechanical prior art: markdown `path#Symbol` links, tree-sitter, `.docref.lock` | Also lockfile-first and staleness-first; cargo-only; no agent orientation. It independently invented much of this mechanism first — credit where due |
| [Roam-Code](https://github.com/Cranot/roam-code) | Codebase-intelligence platform with a SQLite symbol index | Platform-weight; doc checking is one feature among hundreds |
| [AgentLinter](https://github.com/seojoonkim/agentlinter) | Lints AGENTS.md structure, token budget, stale *file* refs | File-level only — complementary; a repo can run both |

symtether's corner: **stateless · zero-config · standard clickable markdown
links as the sole source of truth · existence-checking by default ·
npx-native · agent-first.** Drift's guarantees without Drift's ceremony.

## License

MIT © Justas Brazauskas

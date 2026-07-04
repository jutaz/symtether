<p align="center">
  <img src="https://raw.githubusercontent.com/jutaz/symtether/main/docs/public/wordmark-dark.svg" alt="#sym:tether" width="420">
</p>

<p align="center"><em>Tethered Docs. Real Code. Zero Hallucinations.</em></p>

<p align="center">
  <a href="https://github.com/jutaz/symtether/actions/workflows/ci.yml"><img src="https://github.com/jutaz/symtether/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/symtether"><img src="https://img.shields.io/npm/v/symtether" alt="npm"></a>
  <a href="https://www.npmjs.com/package/symtether"><img src="https://img.shields.io/npm/dm/symtether" alt="downloads"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/symtether" alt="node"></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/symtether" alt="license"></a>
</p>

<p align="center">
  <a href="https://symtether.dev">Website</a>
  &nbsp;·&nbsp;
  <a href="https://symtether.dev/guide">Guide</a>
  &nbsp;·&nbsp;
  <a href="https://symtether.dev/spec">Spec</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/jutaz/symtether/discussions">Discussions</a>
</p>

# symtether

> Docs that point at real code, and fail CI when they stop.
> Built for `AGENTS.md` and the other docs coding agents read as instructions.

Your `AGENTS.md` says *"follow the pattern in `fetchData`."* Three sprints
later someone renames `fetchData` and nothing fails. The doc still reads
fine, and everyone who follows the pointer finds out the hard way that the
code is gone.

Broken URLs 404. Broken code references don't:

```markdown
<!-- The file exists, so every link checker passes this, -->
<!-- but fetchData was renamed two weeks ago. -->
Follow the fetch pattern in [fetchData](src/api/client.ts#L42).
```

A link checker verifies the file. Nothing verifies the symbol inside it.
The `#L42` makes things worse, because after the file shifts it points at
whatever code moved into line 42.

**symtether** fixes this. The reference names the symbol, and the tool
checks it against the code itself:

```markdown
Follow the fetch pattern in [ApiClient.fetchData](src/api/client.ts#sym:ApiClient.fetchData).
```

This is still a plain markdown link, so it renders and clicks on GitHub.
But now `symtether check` can resolve it against the AST and fail CI when
the symbol moves or disappears. `symtether fix` repairs the common cases
automatically. Think eslint, but for the code references in your markdown.

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

A rename that used to rot silently is now a red build, and the fix is one
command away. There is no config file and no lockfile. The markdown links
are the only state. Exclusions come from your `.gitignore`, and
`node_modules` is always skipped
([GLOB_OPTIONS](src/check.ts#sym:const:GLOB_OPTIONS)).

## Why this matters more with agents

Coding agents read `AGENTS.md`, `CLAUDE.md`, and skill files as
instructions. The most useful instruction in these files is a pointer to
existing code, e.g., "follow the pattern in `fetchData`". An agent pointed
at a deleted symbol searches for it, guesses, and then imitates whatever it
finds instead. Agents also cause the rot, because every refactor an agent
lands can break the pointers the next session depends on.

The `#sym:` convention helps even before the tool is installed. An agent
reading `src/client.ts#sym:ApiClient.fetchData` has the file path and an
exact string to grep. That beats a bare file link, where the agent reads
hundreds of lines hoping to spot the pattern, and it beats a line link,
where the agent reads the wrong lines after the file shifts. symtether
makes the convention enforceable. `check` in CI catches what agents and
humans break, `fix` repairs it, and `init` installs a short managed block
that teaches agents to keep refs working themselves.

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

You can also use symtether as a library. The CLI is a thin shell over
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

The dotpath is a suffix match against the definition's nesting chain, so
the natural short form works across languages. Exactly one match passes.
Zero matches is broken. Two or more matches is ambiguous, and the error
asks you to qualify the ref.

## Resolution tiers

Every ref resolves at one of three tiers, and the tier is part of the
output. Anything that could not be fully verified shows up as `lexical` or
`file-only` rather than passing quietly (see
[Resolver](src/resolve.ts#sym:class:Resolver)):

| Tier | When | Meaning |
|---|---|---|
| `ast` | TypeScript, TSX, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C, C++, C#, Scala, Elixir, Lua, Bash | Symbol verified against the parsed AST |
| `lexical` | any other text file | Word-boundary match for the symbol name |
| `file-only` | fragment not checkable | Path existence only, reported as a warning |

Adding a tier-1 language is mostly a grammar import plus fixtures (see the
registry in [loadLanguage](src/languages/index.ts#sym:fn:loadLanguage)).
Open an issue if yours is missing.

## Staleness detection

By default `check` fails only on broken refs. To also find out when the
implementation behind a ref changes:

1. `npx symtether update` writes `symtether.sum`, which holds a normalized
   content hash ([hashDefinition](src/checksum.ts#sym:fn:hashDefinition))
   for every resolvable ref. Reformatting does not change a hash. Renaming
   does not either, because the hash excludes the symbol's own name. That
   is what lets `fix` detect renames by content.
2. `npx symtether check --strict` marks refs stale when their target's
   hash no longer matches, and lists every doc referencing the changed
   target. `--strict=warn` reports without failing.
3. Re-read the prose, fix it or confirm it, then re-stamp with
   `npx symtether update <target>`.

The sum file holds derived checksums, not decisions, in the same way
`go.sum` does ([sumfile.ts](src/sumfile.ts#sym:fn:parseSumFile)). Delete it
and `check` passes or fails exactly as before, and `update` writes it back.
A repo that never runs `update` gives up staleness detection and
content-verified renames, nothing else.

There is one accepted trade-off. Entries are stored per target
([sumKey](src/sumfile.ts#sym:fn:sumKey) ignores the written kind), so
re-stamping a target clears staleness for every doc that references it.
This is why stale output lists every referencing doc for review.

## Limits

- symtether guarantees the pointer resolves. It does not guarantee the
  prose around the pointer is still true. `--strict` flags refs whose
  implementation changed, but you or your agents judge whether the prose
  still holds.
- Resolution checks that a definition exists in the linked file. There is
  no import following or re-export chasing, so a symbol re-exported but
  not defined in the linked file counts as broken. Link to the defining
  file instead.

## Prior art

Other tools attack the same problem from different angles:

| Tool | Mechanism | Difference |
|---|---|---|
| [Fiberplane Drift](https://github.com/fiberplane/drift) | Stateful binder. `drift link` writes bindings and AST fingerprints into `drift.lock` | The lockfile is the source of truth, and every intentional change needs re-stamping |
| [docref](https://github.com/supersterling/docref) | Early exploration of markdown `path#Symbol` links plus tree-sitter and `.docref.lock` | Lockfile-first, cargo-only, and never released. Credit for prototyping the direction |
| [Roam-Code](https://github.com/Cranot/roam-code) | A codebase intelligence platform with a SQLite symbol index | Requires indexing, and doc checking is one feature among hundreds |
| [AgentLinter](https://github.com/seojoonkim/agentlinter) | Lints AGENTS.md structure, token budget, and file-level references | Overlaps with symtether's `file-only` tier; symtether adds AST symbol resolution. A repo can run both |
| [lychee](https://github.com/lycheeverse/lychee), [markdown-link-check](https://github.com/tcort/markdown-link-check) | HTTP/filesystem link checkers | Verify that URLs 200 and files exist. Neither reads the code, so `#L42` and `#sym:` fragments pass as long as the file does. Complementary |

symtether differs in that there is no lockfile or index to maintain,
ordinary clickable markdown links are the only source of truth, and
checking fails only when a ref is actually broken. Staleness detection
stays opt-in. Drift's guarantees without Drift's ceremony.

## License

MIT © Justas Brazauskas

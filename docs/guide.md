# Guide

symtether validates `#sym:` references in markdown — links that point at a
specific function, class, method, type, or constant in a source file — and
fails CI when one breaks.

## Install & first run

No install needed:

```console
npx symtether check
```

Exit codes: `0` all refs pass · `1` broken refs (stale under `--strict`, or
an outdated sum file under `update --check`) · `2` usage or runtime error.

Default scope is every `**/*.md` in the repo. Exclusions come from your
`.gitignore`, plus `node_modules`, which is always skipped
([GLOB_OPTIONS](/src/check.ts#sym:const:GLOB_OPTIONS)).

## Commands

```console
npx symtether check [globs…]       # validate refs; exit 1 on broken
npx symtether check --json         # stable machine output
npx symtether fix [globs…]         # propose repairs (dry-run)
npx symtether fix --write          # apply them
npx symtether fix --canonicalize   # also rewrite compat-form refs to #sym:
npx symtether init                 # install the agent block into AGENTS.md
npx symtether init --ci            # + a GitHub Actions workflow
npx symtether update [targets…]    # stamp review: (re)generate symtether.sum
npx symtether update --check       # CI: fail if symtether.sum is out of date
npx symtether check --strict       # also fail when stamped targets changed
npx symtether check --strict=warn  # …or just report staleness
```

The CLI is a thin shell over the library:

```ts
import { check } from 'symtether';
const report = await check({ cwd: '/path/to/repo' });
```

## Resolution tiers

Every ref resolves at one of three tiers, and the tier is part of the
output — anything that couldn't be fully verified shows up as `lexical` or
`file-only` rather than passing quietly
([Resolver](/src/resolve.ts#sym:class:Resolver)):

| Tier | When | Meaning |
|---|---|---|
| `ast` | TypeScript, TSX, JavaScript, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C, C++, C#, Scala, Elixir, Lua, Bash | Symbol verified against the parsed AST |
| `lexical` | any other text file | Word-boundary match for the symbol name |
| `file-only` | fragment not checkable | Path existence only, reported as a warning |

Adding a tier-1 language is mostly a grammar import plus fixtures
([loadLanguage](/src/languages/index.ts#sym:fn:loadLanguage)); open an
issue if yours is missing. The prerequisite is a WASM build of the grammar.
Most ship prebuilt on npm; Swift's doesn't, so we compile and vendor it
ourselves. Dart currently has neither, so it resolves at tier 2 — renames
and deletions still get caught, just without nesting-chain awareness.

### Kind mapping

The optional `<kind>` disambiguator (`#sym:fn:parse`) filters matches by
what the definition is. The four kinds are deliberately coarse; they exist
to break ties, not to classify. Each accepts these definition kinds from
the underlying grammars
([KIND_MAP](/src/languages/index.ts#sym:const:KIND_MAP)):

| `<kind>` | Accepts | Examples |
|---|---|---|
| `fn` | function, method, macro | a Go func, a Python method, a Rust `macro_rules!` |
| `class` | class, struct, object | a TS class, a C struct, a Kotlin object, a C# record |
| `type` | interface, type, enum, module, class, struct, object | a TS interface, a Rust enum, a Go type, a C++ namespace |
| `const` | constant, field, property, variable | a Go const, a Java field, a Scala val, a Python class attribute |

The overlaps are intentional. `class` and `type` both accept classes and
structs, since a class is a type. Languages also disagree about what counts
as a "constant" versus a "field", so `const` accepts both rather than
making authors guess which capture kind a grammar emits. If a kind filter
eliminates every match, the error names the kinds that do exist:

```
✗ src/server.go#sym:class:NewServer   BROKEN (line 3)
    file OK; "NewServer" exists but is not a class (found: function)
```

## Teaching your agents

```console
npx symtether init
```

installs a short managed block into `AGENTS.md`. Re-running it updates the
block in place without duplicating it or touching anything outside the
markers. The block tells agents to resolve refs by grepping, to run
`check`/`fix` after renaming symbols, and to prefer `#sym:` refs over line
numbers when writing docs. CI is the backstop:

```console
npx symtether init --ci
```

## Staleness detection

By default `check` fails only on broken refs. To also find out when the
implementation behind a ref changes:

1. `npx symtether update` writes `symtether.sum`: a normalized content hash
   ([hashDefinition](/src/checksum.ts#sym:fn:hashDefinition)) for every
   resolvable ref. Reformatting doesn't change a hash. Renaming doesn't
   either — hashes are name-independent, which is what lets `fix` detect
   renames by content.
2. `npx symtether check --strict` marks refs stale when their target's hash
   no longer matches, and lists every doc referencing the changed target.
   `--strict=warn` reports without failing.
3. Re-read the prose, fix it or confirm it, then re-stamp with
   `npx symtether update <target>`.

The sum file works like `go.sum`, not `package-lock.json`: derived
checksums, not decisions. Delete it and `check` passes or fails exactly as
before; `update` writes it back.

## Limits

- symtether guarantees the pointer resolves. It does not guarantee the
  prose around the pointer is still true — `--strict` surfaces candidates
  for that kind of drift, but judging them is up to you or your agents.
- Resolution checks that a definition exists in the linked file. There is
  no import following or re-export chasing, so a symbol re-exported (but
  not defined) in the linked file counts as broken — link to the defining
  file instead.

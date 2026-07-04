# Adding a language

symtether resolves refs at three tiers. A file whose grammar is not
bundled falls back to tier 2, and tier 2 still catches renames and
deletions. Adding a tier-1 grammar takes four steps.

The grammar registry lives in
[loadLanguage](/src/languages/index.ts#sym:fn:loadLanguage). Every
language is data in the same file, and the resolver has no
per-language logic. The steps to reach tier 1 are:

1. add a dev-dependency for the grammar,
2. teach [`scripts/copy-grammars.mjs`](/scripts/copy-grammars.mjs#sym:const:grammars)
   how to copy the WASM and the tags query,
3. register the extension in the [`SPECS`](/src/languages/index.ts#sym:const:SPECS) table,
4. add test fixtures.

## Prerequisites

The grammar package must ship a prebuilt WASM. Most tree-sitter
grammars on npm do. If yours does not, the tool would have to compile
the grammar at install time, and this project does not do that (see
the design laws in AGENTS.md). You have two options.

- **Vendor the WASM under `vendor/grammars/`** and register it in the
  [`vendored`](/scripts/copy-grammars.mjs#sym:const:vendored) list in
  `scripts/copy-grammars.mjs`. Swift takes this route because upstream
  publishes no WASM. The vendor script builds the grammar in Docker and
  commits the artifact.
- **Skip the language.** Tier 2 already catches most breakage in docs.

## 1. Add the grammar as a dev-dependency

Grammars go in `devDependencies`, never in `dependencies`. Their
`install` scripts run `node-gyp` to build native bindings that this
project never uses, and running that step on Cloudflare Workers Builds
breaks the build. The `.npmrc` sets `ignore-scripts=true` so the
native step is skipped. The published symtether package then ships
only the WASM, which is why the grammar can be a dev-dependency.
[copy-grammars.mjs](/scripts/copy-grammars.mjs#sym:const:grammars)
extracts the WASM at build time and writes it into `grammars/`.

```sh
npm install --save-dev --ignore-scripts tree-sitter-<yours>
```

## 2. Copy the grammar at build time

Edit
[copy-grammars.mjs](/scripts/copy-grammars.mjs#sym:const:grammars)
and add a row to the `grammars` array. The row has four fields, in
this order: package name, WASM filename, output basename, extra query
names.

```js
['tree-sitter-<yours>', 'tree-sitter-<yours>.wasm', '<yours>', ['<yours>']],
```

The output basename is what the runtime looks up. Keep it short and
lowercase. Include an entry in the extra query names only if you need
a supplemental `queries/<yours>.extra.scm` file. The upstream
grammar's own `tags.scm` is used automatically. If the upstream
grammar ships no `tags.scm` at all (Kotlin and Bash), then your
`.extra.scm` becomes the whole query.

## 3. Register the extension

Add one line to the [`SPECS`](/src/languages/index.ts#sym:const:SPECS)
table inside
[src/languages/index.ts](/src/languages/index.ts#sym:fn:loadLanguage).

```ts
'.<ext>': { grammar: '<yours>', tags: ['<yours>'] },
```

The `tags` array is a chain. Each entry names a `<name>.tags.scm` file
in `grammars/`, and the resolver concatenates them in order at load
time. The TypeScript entries chain `['javascript', 'typescript']`
because the TS `tags.scm` is authored as a supplement to the JS one.
Only chain like this when your language has an equivalent inheritance.

## 4. Cover the four `#sym:` kinds

The `<kind>` disambiguator (`#sym:fn:foo`) filters by capture kind.
The mapping table is
[KIND_MAP](/src/languages/index.ts#sym:const:KIND_MAP).

| `<kind>` | Accepts |
|---|---|
| `fn` | function, method, macro |
| `class` | class, struct, object |
| `type` | interface, type, enum, module, class, struct, object |
| `const` | constant, field, property, variable |

Your `tags.scm` (or the supplemental `queries/<yours>.extra.scm`) has
to emit `@definition.<capture-kind>` captures that match one of these
four kinds. If the upstream grammar only emits `@definition.function`
for methods and you want to tell methods and functions apart, add a
supplemental query. See
[queries/kotlin.extra.scm](https://github.com/jutaz/symtether/blob/main/queries/kotlin.extra.scm)
for a short example.

## 5. Add fixtures

The tier-1 coverage test in
[test/languages.test.ts](https://github.com/jutaz/symtether/blob/main/test/languages.test.ts)
drives every bundled grammar through the same fixture layout.

```
test/fixtures/basic/
  src/<yourfile>.<ext>       # a small source file with a few definitions
  docs/languages.md          # ref lines pointing at the definitions
```

Add a source file that contains at least:

- one function,
- one class-like definition,
- one constant,
- one nested definition.

Then add ref lines to `docs/languages.md`, one for each `#sym:` shape
you want to prove:

- a bare name,
- a dotpath,
- each kind filter (`fn`, `class`, `type`, `const`) that your language
  supports.

The test asserts that every ref resolves at the `ast` tier. A
`lexical` or `broken` result fails the run.

## 6. Verify and dogfood

```sh
npm run build              # copies your WASM into grammars/
npx vitest run             # tier-1 coverage plus every other test
node dist/cli.js check     # smoke check against the repo
```

If your language now resolves at `ast`, update the language list in
two places when you send the PR:

- the guide table and the
  [registry snippet](/src/languages/index.ts#sym:fn:loadLanguage),
- the [Guide's Resolution tiers section](./guide.md).

## Grammars that need vendoring

symtether never compiles a grammar. Users pull the prebuilt WASM that
we already prepared, and the build in this repo does the same. The
one exception is Swift, which uses the vendor path. See
[scripts/vendor-swift.mjs](https://github.com/jutaz/symtether/blob/main/scripts/vendor-swift.mjs).
Grammars whose npm package emits no WASM cannot be added unless you
vendor a prebuilt artifact the same way.

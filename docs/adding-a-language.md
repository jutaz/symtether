# Adding a language

symtether resolves refs at three tiers. Anything without a bundled
tree-sitter grammar falls back to tier 2 (`lexical`) and still catches
renames and deletions — just without awareness of nesting. Adding a
tier-1 grammar takes four small steps and one round of test fixtures.

The grammar registry lives in
[loadLanguage](/src/languages/index.ts#sym:fn:loadLanguage). Every
language is data in the same file; there is no per-language matching
logic in the resolver. The path to tier 1 is:

1. add a dev-dependency for the grammar,
2. teach `scripts/copy-grammars.mjs` how to copy its WASM + tags query,
3. register the extension in the `SPECS` table,
4. add fixtures and let the coverage test drive them.

## Prerequisites

The grammar package must ship a prebuilt WASM. Most tree-sitter
grammars on npm do; if yours doesn't, the tool has to compile it, which
this project refuses to do at install time (design law: no native
compilation). Two escape hatches exist:

- **Vendor the WASM under `vendor/grammars/`** and register it in the
  `vendored` list in `scripts/copy-grammars.mjs`. Swift takes this
  route because upstream publishes no WASM — the vendor script builds
  the grammar in Docker and commits the artifact.
- **Skip the language.** Tier 2 already catches most doc rot.

## 1. Add the grammar as a dev-dependency

Grammars go in `devDependencies` (never `dependencies`) — their
`install` scripts run `node-gyp` to build native bindings that the
project never uses, and running them on hosts like Cloudflare Workers
Builds breaks. `.npmrc` has `ignore-scripts=true` so the native step is
skipped; the published symtether package ships only the WASM that
[copy-grammars.mjs](https://github.com/jutaz/symtether/blob/main/scripts/copy-grammars.mjs)
extracts at build time.

```sh
npm install --save-dev --ignore-scripts tree-sitter-<yours>
```

## 2. Copy the grammar at build time

Edit
[copy-grammars.mjs](https://github.com/jutaz/symtether/blob/main/scripts/copy-grammars.mjs)
and add a row to the `grammars` array. The shape is
`[packageName, wasmFilename, outputBasename, extraQueryNames]`:

```js
['tree-sitter-<yours>', 'tree-sitter-<yours>.wasm', '<yours>', ['<yours>']],
```

The output basename is what the runtime looks up — keep it short and
lowercase. Include an entry in `extraQueryNames` only if you need a
supplemental `queries/<yours>.extra.scm` file; the upstream grammar's
own `tags.scm` is used automatically. If upstream ships no `tags.scm`
at all (Kotlin, Bash) your `.extra.scm` becomes the whole query.

## 3. Register the extension

Add one line to the `SPECS` table inside
[src/languages/index.ts](/src/languages/index.ts#sym:fn:loadLanguage):

```ts
'.<ext>': { grammar: '<yours>', tags: ['<yours>'] },
```

The `tags` array is a chain: each entry names a `<n>.tags.scm` in
`grammars/`, and the resolver concatenates them in order at load
time. The TypeScript entries chain `['javascript', 'typescript']`
because the TS `tags.scm` is authored as a supplement to the JS one —
mirror this only when you have an equivalent inheritance in your
language.

## 4. Cover the four `#sym:` kinds

The `<kind>` disambiguator (`#sym:fn:foo`) filters by capture kind. The
mapping table is
[KIND_MAP](/src/languages/index.ts#sym:const:KIND_MAP):

| `<kind>` | Accepts |
|---|---|
| `fn` | function, method, macro |
| `class` | class, struct, object |
| `type` | interface, type, enum, module, class, struct, object |
| `const` | constant, field, property, variable |

Your `tags.scm` (or the supplemental `queries/<yours>.extra.scm`) has
to emit `@definition.<capture-kind>` captures that fit one of these
buckets. If upstream only emits `@definition.function` for methods and
you want method-vs-function distinction, add a supplemental query.
Kotlin's is a good short example — see
[queries/kotlin.extra.scm](https://github.com/jutaz/symtether/blob/main/queries/kotlin.extra.scm).

## 5. Add fixtures

The tier-1 coverage test in
[test/languages.test.ts](https://github.com/jutaz/symtether/blob/main/test/languages.test.ts)
drives every bundled grammar through the same fixture layout:

```
test/fixtures/basic/
  src/<yourfile>.<ext>       # a small source file with a few definitions
  docs/languages.md          # ref lines pointing at the definitions
```

Add a source file with at least: one function, one class-like, one
constant, and one nested definition. Then add ref lines to
`docs/languages.md` — one per `#sym:` shape you want to prove (bare
name, dotpath, each kind). The test asserts every ref resolves at the
`ast` tier; a `lexical` or `broken` result fails the run.

## 6. Verify and dogfood

```sh
npm run build              # copies your WASM into grammars/
npx vitest run             # tier-1 coverage plus every other test
node dist/cli.js check     # smoke check against the repo
```

If your language now resolves at `ast`, the guide table and the
[registry snippet](/src/languages/index.ts#sym:fn:loadLanguage) in the
[Guide's Resolution tiers section](./guide.md) both need a mention.
Update the language list in both places when you send the PR.

## Nothing to compile, ever

symtether does not run native compilation on install (users pull WASM
that we already prepared) and does not run it in this repo's build
either (grammars ship their own prebuilt WASM). The one exception is
Swift, which uses the vendor path — see
[scripts/vendor-swift.mjs](https://github.com/jutaz/symtether/blob/main/scripts/vendor-swift.mjs).
Grammars whose npm package emits no WASM cannot be added unless you're
willing to vendor a prebuilt artifact the same way.

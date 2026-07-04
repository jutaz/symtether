# Vendored grammars

WASM grammars that upstream npm packages don't ship prebuilt, compiled by us
and committed so that `npm run build` never needs the emscripten toolchain.

| Grammar | Source package | Why vendored |
| ------- | -------------- | ------------ |
| `swift.wasm` + `swift.tags.scm` | `tree-sitter-swift` | Publishes tags.scm and native prebuilds but no WASM |

To re-vendor after a grammar upgrade (requires Docker — the tree-sitter CLI
uses an emscripten image):

```console
npm run vendor:swift
```

Then run the language test suite; the fixture will catch node-type drift:

```console
npm test -- test/languages.test.ts
```

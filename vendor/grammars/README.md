# Vendored grammars

WASM grammars that upstream npm packages do not ship prebuilt, compiled by
us and committed so that `npm run build` never needs the emscripten
toolchain.

| Grammar | Source package | Why vendored |
| ------- | -------------- | ------------ |
| `swift.wasm` and `swift.tags.scm` | `tree-sitter-swift` | Publishes tags.scm and native prebuilds but no WASM |

To re-vendor after a grammar upgrade (requires Docker, because the
tree-sitter CLI uses an emscripten image):

```console
npm run vendor:swift
```

Then run the language test suite. The fixture will catch node-type drift:

```console
npm test -- test/languages.test.ts
```

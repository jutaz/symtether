# Vendored grammars

WASM grammars that upstream npm packages do not ship prebuilt, compiled by
us and committed so that `npm run build` never needs the emscripten
toolchain.

| Grammar | Source package | Why vendored |
| ------- | -------------- | ------------ |
| `swift.wasm` and `swift.tags.scm` | `tree-sitter-swift` | Publishes tags.scm and native prebuilds but no WASM |
| `astro.wasm` | [`virchau13/tree-sitter-astro`](https://github.com/virchau13/tree-sitter-astro) at `213f6e6` | Publishes no npm package at all, so the grammar is cloned from git at a pinned revision |

Astro ships no `tags.scm`: the grammar only locates the frontmatter and
`<script>` blocks, which the resolver re-parses as TypeScript. The pinned
revision is recorded in `scripts/vendor-astro.mjs`; bump it there.

To re-vendor after a grammar upgrade (requires Docker, because the
tree-sitter CLI uses an emscripten image):

```console
npm run vendor:swift
npm run vendor:astro
```

Then run the language test suite. The fixture will catch node-type drift:

```console
npm test -- test/languages.test.ts
```

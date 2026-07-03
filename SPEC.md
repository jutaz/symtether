# The `#sym:` reference syntax — SPEC v1

A `#sym:` reference is a standard relative markdown link whose fragment names
a symbol inside the target source file. It renders and clicks like any other
link on GitHub; symtether upgrades the convention into a guarantee by
verifying each reference against the code.

## Canonical form

```
[link text](<relative-path>#sym:<dotpath>)
[link text](<relative-path>#sym:<kind>:<dotpath>)
```

- `<relative-path>` — a standard markdown relative path to a source file,
  resolved **relative to the markdown file's own directory** (identical to
  GitHub rendering semantics). Paths beginning with `/` resolve from the
  repository root. Repo root = nearest ancestor containing `.git`, else the
  working directory.
- `<dotpath>` — one or more identifiers joined by `.`, e.g. `parseConfig`,
  `ApiClient.fetchData`, `ns.Widget.render`. Identifier charset:
  `[A-Za-z0-9_$]+` per segment. Case-sensitive exact match per segment.
- `<kind>` — optional disambiguator from a **closed set**: `fn`, `class`,
  `type`, `const`. (Reserved for future versions: `region`.) Unknown kinds
  are a lint error, not ignored.

Examples:

```markdown
[fetch pattern](../src/api/client.ts#sym:ApiClient.fetchData)
[config parsing](src/config.ts#sym:fn:parseConfig)
[shared types](/packages/core/src/types.ts#sym:type:AgentSkill)
```

## Matching semantics

The dotpath is a **suffix match against the definition's nesting chain**,
not a language-exact qualified name.

- The resolver extracts all named definitions in the target file as
  `(name, kind, nesting-chain, range)` tuples.
- A ref matches a definition if the dotpath segments equal the *trailing*
  segments of that definition's nesting chain. `ApiClient.fetchData` matches
  a method `fetchData` nested in class `ApiClient`, even if `ApiClient` is
  itself inside a namespace.
- If `<kind>` is present, the matched definition's kind must also map to it.
- **Exactly one match = pass. Zero matches = broken. Two or more matches =
  ambiguous**, an error instructing the author to qualify further (add a
  parent segment or a kind).

## Compatibility (lenient) forms — read-accepted, never written

On links whose target path resolves to a non-markdown source file, these
fragments are accepted with identical semantics and reported with a `compat`
note:

- `#Symbol` (bare)
- `#Type.method` (bare dotpath)

`symtether fix --canonicalize` rewrites them to `#sym:` form. Fragments on
links targeting **markdown** files are heading anchors — never treated as
symbol refs, never validated by symtether.

## Out of scope, permanently

Line numbers or ranges (`#L10`), query parameters, version/commit pins,
multiple symbols per link, wildcards, regex.

## Where refs are recognized

- Inline links and reference-style links (`[text][id]` + `[id]: path#sym:X`)
  in `.md` files.
- **Ignored:** links inside fenced code blocks and inline code spans, image
  links (`![]()`), autolinks, external URLs (any scheme), `mailto:`, and
  pure-fragment links (`#heading`).
- Escape hatch: `<!-- symtether-disable-next-line -->` suppresses checking
  for refs on the following line; `<!-- symtether-disable -->` /
  `<!-- symtether-enable -->` for blocks.

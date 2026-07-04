# The `#sym:` reference syntax (SPEC v1)

A `#sym:` reference is a standard relative markdown link whose fragment
names a symbol inside the target source file. It renders and clicks like
any other link on GitHub, and symtether verifies each reference against
the code.

## Canonical form

```
[link text](<relative-path>#sym:<dotpath>)
[link text](<relative-path>#sym:<kind>:<dotpath>)
```

- `<relative-path>` is a standard markdown relative path to a source file,
  resolved **relative to the markdown file's own directory** (identical to
  GitHub rendering semantics). Paths beginning with `/` resolve from the
  repository root. The repo root is the nearest ancestor containing
  `.git`, or the working directory when there is none.
- `<dotpath>` is one or more identifiers joined by `.`, e.g.
  `ApiClient.fetchData`. Each segment must match `[A-Za-z0-9_$]+` and is
  compared case-sensitively.
- `<kind>` is an optional disambiguator from a **closed set**: `fn`,
  `class`, `type`, `const`. (`region` is reserved for future versions.)
  An unknown kind is a lint error, not ignored.

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
- **Exactly one match passes. Zero matches is broken. Two or more matches
  is ambiguous**, an error instructing the author to qualify further by
  adding a parent segment or a kind.

## Compatibility (lenient) forms, read-accepted and never written

On links whose target path resolves to a non-markdown source file, these
fragments are accepted with identical semantics and reported with a `compat`
note:

- `#Symbol` (bare)
- `#Type.method` (bare dotpath)

`symtether fix --canonicalize` rewrites them to `#sym:` form. Fragments on
links targeting **markdown** files are heading anchors and are never
treated as symbol refs.

## Out of scope

Line numbers or ranges (`#L10`), query parameters, version/commit pins,
multiple symbols per link, wildcards, regex.

## Where refs are recognized

- Inline links and reference-style links (`[text][id]` + `[id]: path#sym:X`)
  in `.md` files.
- **Ignored:** links inside fenced code blocks and inline code spans, image
  links (`![]()`), autolinks, external URLs (any scheme), `mailto:`, and
  pure-fragment links (`#heading`).
- `<!-- symtether-disable-next-line -->` suppresses checking for refs on
  the following line. `<!-- symtether-disable -->` and
  `<!-- symtether-enable -->` suppress and restore checking for a block.

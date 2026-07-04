---
layout: home

hero:
  name: symtether
  text: eslint for code references in markdown
  tagline: A stateless linter that checks the symbol references in your docs still point at real code. No config, and ordinary markdown links are the only state.
  actions:
    - theme: brand
      text: Get started
      link: /guide
    - theme: alt
      text: "The #sym: syntax"
      link: /spec/

features:
  - title: Nothing to set up
    details: npx symtether check works on an unmodified repo. Exclusions come from your .gitignore.
  - title: Checked against the AST
    details: Eighteen languages resolve through tree-sitter (TS, JS, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C, C++, C#, Scala, Elixir, Lua, Bash). Everything else falls back to lexical search, and every ref reports which tier it resolved at.
  - title: Built for agents
    details: symtether init adds a short managed section to AGENTS.md so coding agents read, write, and repair refs as part of normal work.
  - title: Staleness detection when you want it
    details: symtether update stamps content hashes; check --strict flags refs whose implementation changed since. Skip it entirely and check still works.
---

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

A `#sym:` ref is a plain markdown link that names a symbol:

```markdown
Follow the fetch pattern in [ApiClient.fetchData](src/api/client.ts#sym:ApiClient.fetchData).
```

It renders and clicks on GitHub, and an agent reading it has both a file
path and an exact string to grep — which works even where symtether isn't
installed.

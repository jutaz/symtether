---
layout: home

hero:
  name: symtether
  text: eslint for code references in markdown
  tagline: Stateless, zero-config referential integrity for the docs AI agents treat as executable context. Standard clickable markdown links are the sole source of truth.
  actions:
    - theme: brand
      text: Get started
      link: /guide
    - theme: alt
      text: "The #sym: syntax"
      link: /spec/

features:
  - title: Zero ceremony
    details: npx symtether check works on an unmodified repo. No config, no lockfile, no index — exclusions come straight from your .gitignore.
  - title: Verified against the AST
    details: Refs resolve through tree-sitter for eighteen languages — TS, JS, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C, C++, C#, Scala, Elixir, Lua, Bash — and degrade loudly, never silently, everywhere else.
  - title: Agent-first
    details: symtether init installs a short managed block into AGENTS.md that teaches coding agents to read, write, and repair refs themselves.
  - title: Staleness is opt-in
    details: symtether update stamps content hashes; check --strict flags refs whose implementation changed. No snapshot-test treadmill.
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

It renders and clicks on GitHub. An agent reading it has a file path *and* an
exact string to grep — useful even with symtether never installed. The tool
upgrades the convention into a guarantee.

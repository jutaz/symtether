---
layout: home
title: symtether, a linter that keeps the code references in your docs from rotting
titleTemplate: false
description: Stateless linter that validates #sym: code references in markdown against the AST and fails CI when they break. Built for the humans and agents who read your docs.

hero:
  name: symtether
  text: "Docs that point at real code — and fail CI when they stop."
  tagline: Tethered Docs. Real Code. Zero Hallucinations.
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
    details: Eighteen languages resolve through tree-sitter (TS, TSX, JS, Python, Go, Rust, Java, Kotlin, Swift, Ruby, PHP, C, C++, C#, Scala, Elixir, Lua, Bash). Everything else falls back to lexical search, and every ref reports which tier it resolved at.
  - title: Built for agents
    details: symtether init adds a short managed section to AGENTS.md so coding agents read, write, and repair refs as part of normal work.
  - title: Staleness detection when you want it
    details: symtether update stamps content hashes for every ref, and check --strict flags refs whose implementation has changed since the last stamp. Skip the whole feature and check still works.
---

## The problem

Your `AGENTS.md` says *"follow the pattern in `fetchData`."* Three sprints
later someone renames `fetchData` and nothing fails. The doc still reads
fine. Every agent session and every new teammate now follows a pointer to
code that does not exist, and they find out only after they have spent time
hunting for it or have imitated the wrong thing.

Broken URLs 404. Broken code references don't. A link checker verifies
that the file exists, and nothing in a standard toolchain notices that the
symbol inside it vanished:

```markdown
<!-- The file still exists, so every link checker passes this, -->
<!-- but fetchData was renamed two weeks ago. -->
Follow the fetch pattern in [fetchData](src/api/client.ts#L42).
```

Line numbers make things worse, because after the file shifts the `#L42`
points at whatever code moved into line 42.

## What symtether does

Write the reference to the symbol instead:

```markdown
Follow the fetch pattern in [ApiClient.fetchData](src/api/client.ts#sym:ApiClient.fetchData).
```

This is still a plain markdown link, so it renders and clicks on GitHub.
But now it names the thing it points at, so it can be checked:

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

A rename that used to rot silently now fails CI, and the fix is one
command away.

## Why this matters more with agents

Coding agents read `AGENTS.md`, `CLAUDE.md`, and skill files as
instructions. The most useful instruction in these files is a pointer to
existing code, e.g., "follow the pattern in `fetchData`". An agent pointed
at a deleted symbol searches for it, guesses, and then imitates whatever it
finds instead. Agents also cause the rot, because every refactor an agent
lands can break the pointers the next session depends on.

The `#sym:` convention helps even before the tool is installed. An agent
reading `src/client.ts#sym:ApiClient.fetchData` has a file path and an
exact string to grep. That beats a bare file link, where the agent reads
hundreds of lines hoping to spot the pattern, and it beats a line link,
where the agent reads the wrong lines after the file shifts. symtether
makes the convention enforceable. `check` in CI catches what agents and
humans break, `fix` repairs it, and
[a short managed block](./guide.md#teaching-your-agents) teaches agents to
keep refs working themselves.

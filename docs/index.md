---
layout: home
title: symtether — keep the code references in your docs from rotting
titleTemplate: false
description: >-
  symtether checks the symbol references in your markdown against the code
  itself and fails CI when they break. Built for AGENTS.md, CLAUDE.md, and
  every doc your coding agents read as instructions.

hero:
  name: symtether
  text: Docs that point at real code
  tagline: symtether checks the symbol references in your markdown against the code itself — and fails CI when they break. No config, no lockfile; plain markdown links are the only state.
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
    details: symtether update stamps content hashes; check --strict flags refs whose implementation changed since. Skip it entirely and check still works.
---

## The problem

Your `AGENTS.md` says *"follow the pattern in `fetchData`."* Three sprints
later `fetchData` is gone — renamed, moved, refactored away. Nothing fails.
The doc still reads fine. Every agent session and every new teammate now
gets pointed at code that doesn't exist, and they don't find out until
they've burned time hunting for it — or worse, imitated the wrong thing.

Broken URLs 404. Broken code references don't. A link checker verifies the
*file* exists; nothing in a standard toolchain notices the *symbol* inside
it vanished:

```markdown
<!-- The file still exists, so every link checker passes this — -->
<!-- but fetchData was renamed two weeks ago. -->
Follow the fetch pattern in [fetchData](src/api/client.ts#L42).
```

Line numbers make it worse: `#L42` silently points at whatever moved into
line 42.

## What symtether does

Write the reference to the *symbol* instead:

```markdown
Follow the fetch pattern in [ApiClient.fetchData](src/api/client.ts#sym:ApiClient.fetchData).
```

Still a plain markdown link — it renders and clicks on GitHub. But now it
names the thing it points at, so it can be checked:

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

The rename that used to rot silently is now a red build with the fix one
command away.

## Why this matters more with agents

Coding agents read `AGENTS.md`, `CLAUDE.md`, and skill files as
instructions, and the highest-value instruction is a pointer to real code:
*"do it like X."* An agent pointed at a deleted symbol doesn't shrug like a
human — it searches, guesses, and confidently imitates whatever it finds
instead. And agents *cause* the rot too: every refactor an agent lands can
break the pointers the next session depends on.

The `#sym:` convention pays off even before the tool is installed: an agent
reading `src/client.ts#sym:ApiClient.fetchData` has a file path **and** an
exact string to grep — better than a bare file link (read 400 lines and
hope) or a line link (read the wrong 20 lines with confidence). symtether
makes the convention enforceable: `check` in CI catches what agents and
humans break, `fix` repairs it, and
[a short managed block](./guide.md#teaching-your-agents) teaches agents to
keep refs working themselves.

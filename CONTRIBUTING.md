# Contributing to symtether

Thanks for helping. This file covers the short version. `AGENTS.md`
has the deeper technical rules for anyone (human or agent) making
code changes.

## The one-line summary

Prefer a discussion over an issue. Prefer an issue over a pull
request. If you open a PR, keep it small and pointed at a discussed
problem.

## Where to start

- **Questions, ideas, and bug reports go to
  [Discussions](https://github.com/jutaz/symtether/discussions).**
  This is the front door. Bugs get discussed here first; if they turn
  out to be actionable, a maintainer converts the discussion to an
  issue.
- **Issues are for confirmed, actionable work.** Opening an issue
  without a prior discussion may get closed with a link back to the
  right place.
- **Pull requests should reference the discussion or issue that
  authorized the work.** Drive-by PRs against unfamiliar behavior are
  much less likely to land.

## Development

Requirements:

- Node 20 or newer.
- `npm ci --ignore-scripts` to install (the tree-sitter grammar
  packages have native build steps we intentionally skip; see
  AGENTS.md for why).

Commands:

- `npm run build`. Builds the CLI bundle and copies grammar WASM
  into `grammars/`. Required before running the CLI or the tests.
- `npm test`. Runs the full test suite.
- `npm run lint`. Runs eslint on `src/` and prettier on the whole tree.
- `npm run typecheck`. Runs the TypeScript compiler without emitting
  files.
- `npm run dev:site`. Starts the VitePress dev server for the
  documentation site.

Before opening a PR:

1. `npm run lint` clean.
2. `npm test` passes locally (216 tests as of writing).
3. Dogfood check clean:
   `node dist/cli.js check --strict --exclude 'test/fixtures/**'`.

## Commit messages

Use Conventional Commits. The release notes on GitHub are generated
from PR titles, and the categories are driven by the prefix.

Common prefixes:

- `feat:`. A new feature.
- `fix:`. A bug fix.
- `docs:`. Documentation only.
- `perf:`. A performance improvement.
- `chore:`. Housekeeping, e.g., dependency bumps or tool config.
- `refactor:`. A code change that neither fixes a bug nor adds a
  feature.
- `test:`. Tests only.

Breaking changes get an exclamation mark before the colon, e.g.,
`feat!: rename the check command`. A `BREAKING CHANGE:` footer in the
commit body is also acceptable and preferred if the breakage needs
explanation.

## Adding a language

If you want to add tree-sitter grammar support for a new language,
see [docs/adding-a-language.md](./docs/adding-a-language.md). This is
one of the highest-value contribution paths.

## AI and agent contributions

Fine, with rules:

- **Disclose it.** A PR that was written by an agent should say so in
  the description. This is a request for honesty so reviewers know
  what they are reviewing.
- **Understand the code you submit.** If you cannot explain a change
  when asked, do not submit it.
- **Follow AGENTS.md.** The rules in that file are the same rules a
  human maintainer would apply. Agents are held to the same standard.
- **No AI-generated release notes, and no AI-generated commit messages
  that read as filler.** GitHub's release-notes generator does the
  formatting, and humans or agents write the actual PR titles.

## Security

Do not open a public issue or discussion for a vulnerability. See
[SECURITY.md](./SECURITY.md) for how to report privately through
GitHub.

## Release process

Contributors do not cut releases. If you land a change that should
ship, it will go out in the next release. See
[RELEASING.md](./RELEASING.md) for the mechanics.

## License

By contributing you agree that your contribution is licensed under
the same MIT license as the project.

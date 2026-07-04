# Security Policy

## Reporting a vulnerability

Please do not report security issues in public GitHub issues or
discussions. Report them privately through GitHub's private
vulnerability reporting:

<https://github.com/jutaz/symtether/security/advisories/new>

You should receive a first response within seven days. Once we have
confirmed the issue we will work with you on a fix and coordinate
disclosure.

## Scope

symtether is the reference toolkit for the `#sym:` spec. It parses
markdown and reads source files from a repository. Vulnerabilities in
scope include:

- Any issue that lets a malicious source file execute code outside the
  intended parse-and-report boundary.
- Any issue in the CLI or library that leaks contents of files that
  are outside the configured glob scope.
- Any issue that allows a malicious `symtether.sum` file to affect the
  behavior of `check` or `fix` in ways not intended by the spec.
- Supply-chain issues in this repository's build or publish pipeline.

Out of scope:

- Vulnerabilities in tree-sitter grammars themselves. Please report
  those upstream to the grammar's maintainers.
- Denial-of-service via very large markdown or source files. Use
  reasonable input sizes.

## Supported versions

Only the latest published version on npm is supported. Fixes ship in
a new release.

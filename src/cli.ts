#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import pc from 'picocolors';
import { check } from './check.js';
import { fix } from './fix.js';
import { init } from './init.js';
import { toHuman, toJson } from './report.js';
import { update } from './update.js';
import { UsageError } from './types.js';

/** Exit codes (§7.1): 0 = pass, 1 = broken refs, 2 = usage/runtime error. */
const EXIT_OK = 0;
const EXIT_BROKEN = 1;
const EXIT_ERROR = 2;

const pkg = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'package.json',
    ),
    'utf8',
  ),
) as { version: string };

const program = new Command();

program
  .name('symtether')
  .description(
    `Referential integrity for #sym: symbol refs in markdown.

A #sym: ref is a standard markdown link that names a symbol in a source file:
  [fetch pattern](src/api/client.ts#sym:ApiClient.fetchData)
  [config parsing](src/config.ts#sym:fn:parseConfig)

check resolves every ref against the actual code and fails when one is
broken; fix repairs the common cases; update stamps content hashes so
check --strict can flag refs whose implementation changed.

Exit codes: 0 = all refs pass · 1 = broken (or stale under --strict=fail,
or sum file outdated under update --check) · 2 = usage or runtime error.

Spec: https://symtether.dev/spec (plain text: https://symtether.dev/spec.md)`,
  )
  .version(pkg.version)
  .exitOverride();

program
  .command('check', { isDefault: false })
  .description('validate all #sym: refs in markdown files')
  .argument('[globs...]', 'markdown globs (default: **/*.md, minus .gitignore)')
  .option(
    '--json',
    'stable machine-readable output (schema: check-output.schema.json)',
  )
  .option('--include <globs...>', 'extra include globs')
  .option('--exclude <globs...>', 'extra exclude globs')
  .option('--quiet', 'errors only')
  .option(
    '--strict [mode]',
    'also flag stamped refs whose implementation changed: fail (exit 1) or warn (exit 0); requires symtether.sum',
  )
  .addHelpText(
    'after',
    `
Every ref resolves at a reported tier: ast (grammar-verified), lexical
(word-boundary text search), or file-only (path existence only).

Examples:
  symtether check                      # whole repo, zero config
  symtether check docs/ --json         # one directory, for machines
  symtether check --strict             # + staleness (run update first)
  symtether check --strict=warn        # report staleness, never fail`,
  )
  .action(async (globs: string[], opts) => {
    // --strict / --strict=fail exit 1 on stale; --strict=warn reports only.
    const strictMode =
      opts.strict === true || opts.strict === ''
        ? 'fail'
        : (opts.strict as string | undefined);
    if (strictMode && strictMode !== 'fail' && strictMode !== 'warn') {
      // Commander's optional-value options consume the next positional, so
      // `--strict docs/x.md` lands here — point at the correct spelling.
      const hint = /[/*.]/.test(strictMode)
        ? ` — to pass globs, put them before the flag or use --strict=fail|warn`
        : '';
      throw new UsageError(
        `invalid --strict mode "${strictMode}" (fail|warn)${hint}`,
      );
    }
    const report = await check({
      globs,
      include: opts.include,
      exclude: opts.exclude,
      strict: Boolean(strictMode),
    });
    console.log(
      opts.json ? toJson(report) : toHuman(report, Boolean(opts.quiet)),
    );
    const failed =
      report.summary.broken > 0 ||
      (strictMode === 'fail' && report.summary.stale > 0);
    process.exitCode = failed ? EXIT_BROKEN : EXIT_OK;
  });

program
  .command('fix')
  .description('propose (and with --write, apply) repairs for broken refs')
  .argument('[globs...]', 'markdown globs (default: **/*.md, minus .gitignore)')
  .option('--write', 'apply changes (default: dry-run showing a diff)')
  .option(
    '--canonicalize',
    'also rewrite compat-form refs (#Symbol) to #sym: form',
  )
  .addHelpText(
    'after',
    `
Repairs, in order of confidence:
  1. content-verified renames — near-certain, needs symtether.sum
  2. moved files — symbol found in exactly one other file
  3. renamed symbols — single close candidate in the same file
Everything else is reported with candidates and left untouched.

Examples:
  symtether fix                        # dry-run: show proposed rewrites
  symtether fix --write                # apply them
  symtether fix docs/guide.md --write  # scope to one doc`,
  )
  .action(async (globs: string[], opts) => {
    const report = await fix({
      globs,
      write: Boolean(opts.write),
      canonicalize: Boolean(opts.canonicalize),
    });

    for (const edit of report.edits) {
      console.log(`${pc.bold(edit.doc)}:${edit.line}  ${edit.reason}`);
      console.log(pc.red(`  - ${edit.oldUrl}`));
      console.log(pc.green(`  + ${edit.newUrl}`));
    }
    for (const s of report.skipped) {
      console.log(
        `${pc.bold(s.resolution.ref.doc)}:${s.resolution.ref.line}  ${pc.yellow('skipped')}: ${s.reason}`,
      );
    }

    if (report.edits.length === 0 && report.skipped.length === 0) {
      console.log('nothing to fix');
    } else if (!opts.write && report.edits.length > 0) {
      console.log(pc.dim('\ndry-run — pass --write to apply'));
    }
    process.exitCode = report.skipped.length > 0 ? EXIT_BROKEN : EXIT_OK;
  });

program
  .command('update')
  .description(
    'stamp review: (re)generate symtether.sum content hashes for resolvable refs',
  )
  .argument(
    '[targets...]',
    'target file paths or directory prefixes to re-stamp (default: all)',
  )
  .option('--exclude <globs...>', 'extra doc-glob excludes')
  .option(
    '--check',
    'CI mode: write nothing; exit 1 if symtether.sum is missing entries or out of date',
  )
  .addHelpText(
    'after',
    `
The sum file is derived and regenerable — never a source of truth. Running
update with no arguments regenerates it completely (stamping every
resolvable ref, pruning entries no doc references anymore). Scoped runs
(update src/api.ts) re-stamp only that target and leave the rest untouched.

Examples:
  symtether update                     # (re)generate the whole sum file
  symtether update src/api/client.ts   # re-stamp one reviewed target
  symtether update --check             # CI: fail if the file is outdated`,
  )
  .action(async (targets: string[], opts) => {
    const result = await update({
      targets,
      exclude: opts.exclude,
      check: Boolean(opts.check),
    });

    if (opts.check) {
      if (result.upToDate) {
        console.log(`${result.file} is up to date (${result.written} entries)`);
        process.exitCode = EXIT_OK;
      } else {
        console.log(`${result.file} is out of date:`);
        for (const c of result.changed ?? []) console.log(`  ${c}`);
        console.log(
          pc.dim('\n→ review the affected docs, then: symtether update'),
        );
        process.exitCode = EXIT_BROKEN;
      }
      return;
    }

    const parts = [`${result.file}: ${result.written} entries`];
    if (result.pruned) parts.push(`${result.pruned} pruned`);
    if (result.skippedBroken)
      parts.push(`${result.skippedBroken} broken refs not stamped (fix first)`);
    console.log(parts.join(' · '));
    process.exitCode = result.skippedBroken > 0 ? EXIT_BROKEN : EXIT_OK;
  });

program
  .command('init')
  .description(
    'install the managed agent block into AGENTS.md (and optionally a CI workflow)',
  )
  .option('--file <name>', 'target file inside the repo', 'AGENTS.md')
  .option('--ci', 'also write .github/workflows/symtether.yml')
  .addHelpText(
    'after',
    `
Inserts a short block bounded by markers:
  <!-- symtether:begin v1 (managed by \`symtether init\` — do not edit) -->
  …
  <!-- symtether:end -->
Idempotent: re-running updates the block in place, never duplicates, and
never touches content outside the markers.`,
  )
  .action(async (opts) => {
    const result = await init({ file: opts.file, ci: Boolean(opts.ci) });
    console.log(`${result.file} ${result.action}`);
    if (result.workflow) console.log(`${result.workflow} written`);
  });

try {
  await program.parseAsync();
} catch (err) {
  // commander throws on --help/--version with exitOverride; those are fine.
  const code = (err as { code?: string }).code;
  if (code === 'commander.helpDisplayed' || code === 'commander.version') {
    process.exit(EXIT_OK);
  }
  // Commander already printed its own usage error to stderr — don't repeat it.
  if (!code?.startsWith('commander.')) {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
  }
  process.exit(EXIT_ERROR);
}

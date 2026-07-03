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
  .description('Referential integrity for symbol refs in markdown.')
  .version(pkg.version)
  .exitOverride();

program
  .command('check', { isDefault: false })
  .description('validate all #sym: refs in markdown files')
  .argument('[globs...]', 'markdown globs (default: **/*.md)')
  .option('--json', 'machine-readable output')
  .option('--include <globs...>', 'extra include globs')
  .option('--exclude <globs...>', 'extra exclude globs')
  .option('--quiet', 'errors only')
  .option(
    '--strict [mode]',
    'also report refs whose target changed since the last update stamp (fail|warn)',
  )
  .action(async (globs: string[], opts) => {
    // --strict / --strict=fail exit 1 on stale; --strict=warn reports only.
    const strictMode =
      opts.strict === true || opts.strict === ''
        ? 'fail'
        : (opts.strict as string | undefined);
    if (strictMode && strictMode !== 'fail' && strictMode !== 'warn') {
      throw new UsageError(`invalid --strict mode "${strictMode}" (fail|warn)`);
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
  .argument('[globs...]', 'markdown globs (default: **/*.md)')
  .option('--write', 'apply changes (default: dry-run)')
  .option('--canonicalize', 'also rewrite compat-form refs to #sym:')
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
    'stamp review: write/refresh symtether.sum hashes for resolvable refs',
  )
  .argument('[targets...]', 'target paths or prefixes (default: all)')
  .option('--exclude <globs...>', 'extra doc-glob excludes')
  .action(async (targets: string[], opts) => {
    const result = await update({ targets, exclude: opts.exclude });
    const parts = [`${result.file}: ${result.written} entries`];
    if (result.pruned) parts.push(`${result.pruned} pruned`);
    if (result.skippedBroken)
      parts.push(`${result.skippedBroken} broken refs not stamped (fix first)`);
    console.log(parts.join(' · '));
    process.exitCode = result.skippedBroken > 0 ? EXIT_BROKEN : EXIT_OK;
  });

program
  .command('init')
  .description('install the managed agent block (and optionally a CI workflow)')
  .option('--file <name>', 'target file', 'AGENTS.md')
  .option('--ci', 'write .github/workflows/symtether.yml')
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

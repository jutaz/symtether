import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { globby } from 'globby';
import { extractRefs } from './extract.js';
import { findRepoRoot, toPosix } from './repo.js';
import { Resolver } from './resolve.js';
import { readSumFile, sumKey } from './sumfile.js';
import type { CheckOptions, CheckReport, Resolution } from './types.js';
import { UsageError } from './types.js';

/**
 * Glob options shared by every repo scan. Exclusions come from the repo's
 * own `.gitignore` files — we assume nothing about project layout beyond
 * what git already knows (Law 2: zero config). `node_modules` is the one
 * hardcoded exclude: repos without a `.gitignore` must still be safe to
 * check, and third-party package docs are never ours to lint.
 */
export const GLOB_OPTIONS: {
  gitignore: boolean;
  ignore: string[];
  dot: boolean;
  followSymbolicLinks: boolean;
} = {
  gitignore: true,
  ignore: ['**/node_modules/**'],
  dot: false,
  followSymbolicLinks: false,
};

/**
 * Check all symbol refs in the repo's markdown files.
 * Library entry point — the CLI is a thin shell around this.
 */
export async function check(options: CheckOptions = {}): Promise<CheckReport> {
  const repoRoot = findRepoRoot(options.cwd ?? process.cwd());
  const globs = options.globs?.length ? options.globs : ['**/*.md'];

  const docs = await globby([...globs, ...(options.include ?? [])], {
    ...GLOB_OPTIONS,
    cwd: repoRoot,
    ignore: [...GLOB_OPTIONS.ignore, ...(options.exclude ?? [])],
  });
  docs.sort();

  const resolver = new Resolver(repoRoot);
  const results: Resolution[] = [];
  for (const doc of docs) {
    const docPath = toPosix(doc);
    const content = await readFile(path.join(repoRoot, doc), 'utf8');
    for (const ref of extractRefs(repoRoot, docPath, content)) {
      results.push(await resolver.resolve(ref));
    }
  }

  if (options.strict) {
    await applyStrict(repoRoot, results);
  }

  return { summary: summarize(results), results };
}

/**
 * Strict mode (§9.2): recompute hashes and mark refs whose target's
 * implementation changed since the last `update` stamp. Broken stays broken;
 * only ok refs can become stale. Targets missing from the sum file are left
 * ok — staleness is opt-in per target, established by stamping.
 *
 * Accepted trade-off (§9.3): entries are per-target, so one re-stamp clears
 * staleness for every doc referencing that target. Mitigation: all
 * referencing docs are listed on the stale result.
 */
async function applyStrict(
  repoRoot: string,
  results: Resolution[],
): Promise<void> {
  const entries = await readSumFile(repoRoot);
  if (entries === null) {
    throw new UsageError(
      `--strict requires ${'symtether.sum'} — run \`symtether update\` first`,
    );
  }

  const staleTargets = new Map<string, Resolution[]>();
  for (const r of results) {
    if (r.status !== 'ok' || !r.hash || r.ref.dotpath.length === 0) continue;
    const key = sumKey(r.ref.targetPath, r.ref.dotpath);
    const entry = entries.get(key);
    if (entry && entry.hash !== r.hash) {
      const group = staleTargets.get(key) ?? [];
      group.push(r);
      staleTargets.set(key, group);
    }
  }

  for (const [key, group] of staleTargets) {
    // Reverse lookup: every doc referencing the changed target (§9.3).
    const docs = [...new Set(group.map((r) => r.ref.doc))].sort();
    for (const r of group) {
      r.status = 'stale';
      r.message =
        `implementation changed since last review stamp; ` +
        `re-read the prose in: ${docs.join(', ')}; ` +
        `then run \`symtether update ${key.split('#')[0]}\``;
    }
  }
}

function summarize(results: Resolution[]): CheckReport['summary'] {
  const summary = {
    refs: results.length,
    ast: 0,
    lexical: 0,
    fileOnly: 0,
    broken: 0,
    stale: 0,
  };
  for (const r of results) {
    if (r.status === 'broken') summary.broken++;
    else if (r.status === 'stale') summary.stale++;
    else if (r.tier === 'ast') summary.ast++;
    else if (r.tier === 'lexical') summary.lexical++;
    else summary.fileOnly++;
  }
  return summary;
}

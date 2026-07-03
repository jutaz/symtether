import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { globby } from 'globby';
import { GLOB_OPTIONS } from './check.js';
import { extractRefs } from './extract.js';
import { findRepoRoot, toPosix } from './repo.js';
import { Resolver } from './resolve.js';
import { readSumFile, sumKey, writeSumFile, SUM_FILE } from './sumfile.js';
import type { SumEntry } from './sumfile.js';

export interface UpdateOptions {
  cwd?: string;
  /**
   * Target paths (or path prefixes) to stamp. Empty = stamp every currently
   * resolvable ref in the repo.
   */
  targets?: string[];
  /** Extra doc-glob excludes (mirrors `check --exclude`). */
  exclude?: string[];
}

export interface UpdateResult {
  /** Entries written to the sum file. */
  written: number;
  /** Entries removed because no doc references the target anymore. */
  pruned: number;
  /** Refs that could not be stamped because they're broken. */
  skippedBroken: number;
  file: string;
}

/**
 * Write/refresh sum-file entries (design doc §7.5, §9).
 *
 * Named `update`, not `link`, deliberately: it stamps *review*, it does not
 * create bindings — bindings don't exist as a concept in symtether. The sum
 * file is derived and regenerable: entries come only from refs that exist in
 * docs right now; entries for targets no docs reference anymore are pruned.
 */
export async function update(
  options: UpdateOptions = {},
): Promise<UpdateResult> {
  const repoRoot = findRepoRoot(options.cwd ?? process.cwd());
  const docs = await globby(['**/*.md'], {
    ...GLOB_OPTIONS,
    cwd: repoRoot,
    ignore: [...GLOB_OPTIONS.ignore, ...(options.exclude ?? [])],
  });
  docs.sort();

  const resolver = new Resolver(repoRoot);
  const previous = (await readSumFile(repoRoot)) ?? new Map();
  const next = new Map<string, SumEntry>();
  const today = new Date().toISOString().slice(0, 10);
  const targetFilter = options.targets ?? [];
  let skippedBroken = 0;

  for (const doc of docs) {
    const docPath = toPosix(doc);
    const content = await readFile(path.join(repoRoot, doc), 'utf8');
    for (const ref of extractRefs(repoRoot, docPath, content)) {
      if (ref.dotpath.length === 0) continue; // file-only refs carry no hash
      const key = sumKey(ref.targetPath, ref.dotpath);
      if (next.has(key)) continue; // dedup across docs (§9.1)

      const inScope =
        targetFilter.length === 0 ||
        targetFilter.some((t) => pathInScope(ref.targetPath, toPosix(t)));

      const resolution = await resolver.resolve(ref);
      if (resolution.status === 'ok' && resolution.hash) {
        if (inScope) {
          next.set(key, { target: key, hash: resolution.hash, date: today });
        } else {
          // Out of scope: carry the previous stamp forward unchanged, or
          // stamp fresh if it never existed (a sum file must cover every
          // resolvable ref, or --strict would silently skip some).
          const prev = previous.get(key);
          next.set(
            key,
            prev ?? { target: key, hash: resolution.hash, date: today },
          );
        }
      } else {
        if (resolution.status === 'broken') skippedBroken++;
        // Broken or unverifiable refs never get a fresh stamp, but a scoped
        // run must not silently discard existing stamps either — the sum
        // file is a shadow; only a full-scope run prunes.
        const prev = previous.get(key);
        if (prev && !inScope) next.set(key, prev);
      }
    }
  }

  await writeSumFile(repoRoot, next.values());

  let pruned = 0;
  for (const key of previous.keys()) {
    if (!next.has(key)) pruned++;
  }

  return { written: next.size, pruned, skippedBroken, file: SUM_FILE };
}

/** `src/foo` matches `src/foo.ts`? No — only exact paths or directory prefixes. */
function pathInScope(targetPath: string, scope: string): boolean {
  const clean = scope.replace(/\/+$/, '');
  return targetPath === clean || targetPath.startsWith(`${clean}/`);
}

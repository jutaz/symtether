import { globby } from 'globby';
import { GLOB_OPTIONS, loadDocs } from './check.js';
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
  /**
   * CI mode: compute the sum file but write nothing; report whether the
   * on-disk file matches. Like `terraform plan` or `prettier --check`.
   */
  check?: boolean;
}

export interface UpdateResult {
  /** Entries written (or, under check, that would be written). */
  written: number;
  /** Entries removed because no doc references the target anymore. */
  pruned: number;
  /** Refs that could not be stamped because they're broken. */
  skippedBroken: number;
  /** Under check: true when the on-disk sum file already matches. */
  upToDate?: boolean;
  /** Under check: targets whose entries differ / are missing / are orphaned. */
  changed?: string[];
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

  const loaded = await loadDocs(repoRoot, docs);

  for (const { refs } of loaded) {
    for (const ref of refs) {
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

  let pruned = 0;
  for (const key of previous.keys()) {
    if (!next.has(key)) pruned++;
  }

  if (options.check) {
    // Compare keys + hashes only — the date column is informational (§9.1)
    // and must never fail CI by itself.
    const changed: string[] = [];
    for (const [key, entry] of next) {
      const prev = previous.get(key);
      if (!prev) changed.push(`${key} (missing — not stamped)`);
      else if (prev.hash !== entry.hash) changed.push(`${key} (hash differs)`);
    }
    for (const key of previous.keys()) {
      if (!next.has(key))
        changed.push(`${key} (orphaned — no doc references it)`);
    }
    changed.sort();
    return {
      written: next.size,
      pruned,
      skippedBroken,
      upToDate: changed.length === 0,
      changed,
      file: SUM_FILE,
    };
  }

  await writeSumFile(repoRoot, next.values());

  return { written: next.size, pruned, skippedBroken, file: SUM_FILE };
}

/** `src/foo` matches `src/foo.ts`? No — only exact paths or directory prefixes. */
function pathInScope(targetPath: string, scope: string): boolean {
  const clean = scope.replace(/\/+$/, '');
  return targetPath === clean || targetPath.startsWith(`${clean}/`);
}

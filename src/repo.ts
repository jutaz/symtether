import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Repo root = nearest ancestor containing `.git`, else the working
 * directory (SPEC §5.1).
 */
export function findRepoRoot(cwd: string): string {
  let dir = path.resolve(cwd);
  for (;;) {
    if (existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return path.resolve(cwd);
    dir = parent;
  }
}

/** Normalize a path to `/` separators for output and matching (§11). */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Resolve a link target written in a markdown doc to a repo-relative posix
 * path. Relative targets resolve from the doc's own directory; `/`-prefixed
 * targets resolve from the repo root. Both match GitHub rendering
 * semantics (SPEC §5.1).
 *
 * Returns `null` when the target escapes the repo root (path traversal).
 */
export function resolveTarget(
  repoRoot: string,
  docPath: string,
  target: string,
): string | null {
  const abs = target.startsWith('/')
    ? path.join(repoRoot, target)
    : path.resolve(repoRoot, path.dirname(docPath), target);
  const rel = path.relative(repoRoot, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return toPosix(rel);
}

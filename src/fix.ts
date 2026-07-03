import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { globby } from 'globby';
import { GLOB_OPTIONS } from './check.js';
import { extractRefs } from './extract.js';
import { findRepoRoot, toPosix } from './repo.js';
import { Resolver, similarity } from './resolve.js';
import { readSumFile, sumKey } from './sumfile.js';
import type { SumEntry } from './sumfile.js';
import type { Ref, Resolution } from './types.js';

export interface FixEdit {
  doc: string;
  line: number;
  /** Link URL as written in the doc. */
  oldUrl: string;
  newUrl: string;
  reason: string;
}

export interface FixReport {
  edits: FixEdit[];
  /** Broken refs we refused to touch, with why. */
  skipped: Array<{ resolution: Resolution; reason: string }>;
}

export interface FixOptions {
  cwd?: string;
  globs?: string[];
  /** Apply edits to disk. Default is dry-run (§7.2). */
  write?: boolean;
  /** Also rewrite compat-form refs to canonical `#sym:` (SPEC §5.3). */
  canonicalize?: boolean;
}

/** Similarity threshold for the rename heuristic (edit distance ≤ 2 on short names). */
const RENAME_CONFIDENCE = 0.75;

export async function fix(options: FixOptions = {}): Promise<FixReport> {
  const repoRoot = findRepoRoot(options.cwd ?? process.cwd());
  const globs = options.globs?.length ? options.globs : ['**/*.md'];

  const docs = await globby(globs, { ...GLOB_OPTIONS, cwd: repoRoot });
  docs.sort();

  const resolver = new Resolver(repoRoot);
  // Sum file presence upgrades rename detection to content-verified (§9.2);
  // absence degrades gracefully to heuristics, never blocks.
  const sumEntries = await readSumFile(repoRoot);
  // Memoize the moved-file candidate search: many broken refs to the same
  // moved file must not re-glob the whole repo each time.
  const basenameMatches = new Map<string, Promise<string[]>>();
  const edits: FixEdit[] = [];
  const skipped: FixReport['skipped'] = [];

  for (const doc of docs) {
    const docPath = toPosix(doc);
    const abs = path.join(repoRoot, doc);
    const content = await readFile(abs, 'utf8');
    const docEdits: FixEdit[] = [];

    for (const ref of extractRefs(repoRoot, docPath, content)) {
      const resolution = await resolver.resolve(ref);

      if (resolution.status === 'broken' && !ref.syntaxError) {
        const edit = await proposeFix(
          repoRoot,
          resolver,
          ref,
          resolution,
          sumEntries,
          basenameMatches,
        );
        if ('edit' in edit) docEdits.push(edit.edit);
        else skipped.push({ resolution, reason: edit.reason });
      } else if (
        options.canonicalize &&
        ref.compat &&
        resolution.status === 'ok'
      ) {
        docEdits.push({
          doc: docPath,
          line: ref.line,
          oldUrl: `${ref.rawTarget}#${ref.fragment}`,
          newUrl: `${ref.rawTarget}#sym:${ref.fragment}`,
          reason: 'canonicalize compat form',
        });
      }
    }

    if (options.write && docEdits.length > 0) {
      await writeFile(abs, applyEdits(content, docEdits), 'utf8');
    }
    edits.push(...docEdits);
  }

  return { edits, skipped };
}

type Proposal = { edit: FixEdit } | { reason: string };

async function proposeFix(
  repoRoot: string,
  resolver: Resolver,
  ref: Ref,
  resolution: Resolution,
  sumEntries: Map<string, SumEntry> | null,
  basenameMatches: Map<string, Promise<string[]>>,
): Promise<Proposal> {
  const fragment = `#${ref.fragment}`;

  // Case 1 — moved file: target path is gone, but exactly one file in the
  // repo has the same basename and still contains the symbol (§7.2).
  if (resolution.message === 'file not found') {
    const basename = path.basename(ref.targetPath);
    let matchesPromise = basenameMatches.get(basename);
    if (!matchesPromise) {
      matchesPromise = globby(`**/${basename}`, {
        ...GLOB_OPTIONS,
        cwd: repoRoot,
      });
      basenameMatches.set(basename, matchesPromise);
    }
    const matches = await matchesPromise;
    const confirmed: string[] = [];
    for (const m of matches) {
      const candidate = {
        ...ref,
        targetPath: toPosix(m),
        syntaxError: undefined,
      };
      const res = await resolver.resolve(candidate);
      if (res.status === 'ok') confirmed.push(toPosix(m));
    }
    if (confirmed.length === 1) {
      return {
        edit: {
          doc: ref.doc,
          line: ref.line,
          oldUrl: `${ref.rawTarget}${fragment}`,
          newUrl: `${relativeUrl(ref, confirmed[0]!)}${fragment}`,
          reason: `file moved to ${confirmed[0]}`,
        },
      };
    }
    return {
      reason:
        confirmed.length === 0
          ? 'file not found and no unique relocation candidate'
          : `ambiguous: symbol found in ${confirmed.length} files (${confirmed.join(', ')})`,
    };
  }

  // Case 2a — hash-verified rename (§9.2), the near-certain path: the old
  // symbol's stamped hash matches exactly one definition in the same file
  // under a new name. Content-identity beats string-similarity guessing.
  if (sumEntries) {
    const stamped = sumEntries.get(sumKey(ref.targetPath, ref.dotpath));
    if (stamped) {
      const defs = await resolver.definitionsForFile(ref.targetPath);
      const sameHash = (defs ?? []).filter((d) => d.hash === stamped.hash);
      if (sameHash.length === 1) {
        const renamed = sameHash[0]!;
        const kindPrefix = ref.kind ? `${ref.kind}:` : '';
        return {
          edit: {
            doc: ref.doc,
            line: ref.line,
            oldUrl: `${ref.rawTarget}${fragment}`,
            newUrl: `${ref.rawTarget}#sym:${kindPrefix}${renamed.chain.join('.')}`,
            reason: `content-verified rename to ${renamed.chain.join('.')}`,
          },
        };
      }
    }
  }

  // Case 2b — heuristic rename: single close candidate in the same file.
  const wanted = ref.dotpath[ref.dotpath.length - 1] ?? '';
  const close = resolution.candidates.filter(
    (c) =>
      similarity(wanted, c.symbol.split('.').pop() ?? '') >= RENAME_CONFIDENCE,
  );
  if (close.length === 1) {
    const kindPrefix = ref.kind ? `${ref.kind}:` : '';
    return {
      edit: {
        doc: ref.doc,
        line: ref.line,
        oldUrl: `${ref.rawTarget}${fragment}`,
        newUrl: `${ref.rawTarget}#sym:${kindPrefix}${close[0]!.symbol}`,
        reason: `symbol renamed to ${close[0]!.symbol}`,
      },
    };
  }
  return {
    reason:
      close.length === 0
        ? 'no confident rename candidate'
        : `multiple rename candidates: ${close.map((c) => c.symbol).join(', ')}`,
  };
}

/** Rewrite the target preserving the ref's addressing style (root vs relative). */
function relativeUrl(ref: Ref, newRepoRelPath: string): string {
  if (ref.rawTarget.startsWith('/')) return `/${newRepoRelPath}`;
  const rel = path.posix.relative(path.posix.dirname(ref.doc), newRepoRelPath);
  return rel;
}

/**
 * Replace old link URLs with new ones, scoped to the recorded line so an
 * identical URL elsewhere in the doc is left alone. split/join instead of
 * String.replace: replacement strings must never interpret `$&`/`$$`
 * patterns — `$` is legal in symbol names (SPEC §5.1) — and identical URLs
 * repeated on one line must all be rewritten.
 */
export function applyEdits(content: string, edits: FixEdit[]): string {
  const lines = content.split('\n');
  for (const edit of edits) {
    const i = edit.line - 1;
    if (lines[i] !== undefined) {
      lines[i] = lines[i]!.split(edit.oldUrl).join(edit.newUrl);
    }
  }
  return lines.join('\n');
}

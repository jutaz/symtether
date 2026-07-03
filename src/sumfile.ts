import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * `symtether.sum` — the optional derived-state layer (design doc §9).
 *
 * Governing law: the sum file is a shadow, never a source of truth. Markdown
 * links are the sole declaration; this file stores only derived hashes about
 * refs that already exist in docs. Delete it and `check` passes/fails
 * identically; `update` regenerates it losslessly.
 *
 * Format: line-oriented, sorted by target, one entry per unique target
 * (deduplicated across all docs referencing it):
 *
 *   src/api/client.ts#ApiClient.fetchData  ast:sha256:9f2ab41c0e11d3a7  2026-07-03
 */

export const SUM_FILE = 'symtether.sum';

export interface SumEntry {
  /** `path#dotpath` or `path#kind:dotpath` — fragment without `sym:`. */
  target: string;
  /** `ast:sha256:<16hex>` or `lex:sha256:<16hex>`. */
  hash: string;
  /** ISO date of the last `update` stamp. Informational only. */
  date: string;
}

export function parseSumFile(content: string): Map<string, SumEntry> {
  const entries = new Map<string, SumEntry>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const fields = trimmed.split(/\s+/);
    if (fields.length !== 3) continue; // tolerate junk; derived data is regenerable
    const [target, hash, date] = fields as [string, string, string];
    entries.set(target, { target, hash, date });
  }
  return entries;
}

export function formatSumFile(entries: Iterable<SumEntry>): string {
  const sorted = [...entries].sort((a, b) =>
    a.target < b.target ? -1 : a.target > b.target ? 1 : 0,
  );
  if (sorted.length === 0) return '';
  const width = Math.max(...sorted.map((e) => e.target.length));
  const hashWidth = Math.max(...sorted.map((e) => e.hash.length));
  return (
    sorted
      .map(
        (e) =>
          `${e.target.padEnd(width + 2)}${e.hash.padEnd(hashWidth + 2)}${e.date}`,
      )
      .join('\n') + '\n'
  );
}

export async function readSumFile(
  repoRoot: string,
): Promise<Map<string, SumEntry> | null> {
  const content = await readFile(path.join(repoRoot, SUM_FILE), 'utf8').catch(
    () => null,
  );
  return content === null ? null : parseSumFile(content);
}

export async function writeSumFile(
  repoRoot: string,
  entries: Iterable<SumEntry>,
): Promise<void> {
  await writeFile(
    path.join(repoRoot, SUM_FILE),
    formatSumFile(entries),
    'utf8',
  );
}

/** Canonical sum-file key for a ref: `path#dotpath`, kind included if written. */
export function sumKey(
  targetPath: string,
  dotpath: string[],
  kind?: string,
): string {
  const prefix = kind ? `${kind}:` : '';
  return `${targetPath}#${prefix}${dotpath.join('.')}`;
}

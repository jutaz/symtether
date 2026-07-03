import { createHash } from 'node:crypto';
import type { Node } from 'web-tree-sitter';

/**
 * Content hashes for sum-file entries (design doc §9.1).
 *
 * Tier 1: SHA-256 over the normalized AST subtree of the matched definition —
 * named node kinds + leaf token text, positions and whitespace stripped —
 * truncated to 16 hex chars. Normalization means reformatting never triggers
 * staleness.
 *
 * Two deliberate choices on top of the spec:
 * - Comment nodes are skipped: a comment edit is prose, not implementation.
 * - The definition's *own name token* is replaced with a placeholder. This is
 *   what makes hash-verified rename detection (§9.2) possible at all — if the
 *   name participated in the hash, renaming would change it and "identical
 *   body hash under a new name" could never occur.
 */
export function hashDefinition(
  node: Node,
  nameStart: number,
  nameEnd: number,
): string {
  const parts: string[] = [];
  collect(node, nameStart, nameEnd, parts);
  return `ast:sha256:${digest(parts.join('\u0000'))}`;
}

/** Combine hashes of multiple definitions (overloads/merged declarations). */
export function combineHashes(hashes: string[]): string {
  if (hashes.length === 1) return hashes[0]!;
  return `ast:sha256:${digest(hashes.slice().sort().join('\u0000'))}`;
}

/** Tier 2: hash of the matched line's trimmed text, prefixed `lex:` (§9.1). */
export function hashLexicalLine(lineText: string): string {
  return `lex:sha256:${digest(lineText.trim())}`;
}

function collect(
  node: Node,
  nameStart: number,
  nameEnd: number,
  parts: string[],
): void {
  if (node.type === 'comment') return;
  if (node.childCount === 0) {
    // Leaf: token text — with the definition's name identifier masked.
    const isNameToken =
      node.startIndex === nameStart && node.endIndex === nameEnd;
    parts.push(node.type, isNameToken ? '\u0001NAME' : node.text);
    return;
  }
  if (node.isNamed) parts.push(node.type);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) collect(child, nameStart, nameEnd, parts);
  }
}

function digest(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16);
}

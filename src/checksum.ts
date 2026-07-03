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
 * - Every token whose text equals the definition's name is replaced with a
 *   placeholder — not just the name in the signature but also recursive
 *   self-references in the body. This is what makes hash-verified rename
 *   detection (§9.2) possible: rename `fact` → `gamma` in a recursive
 *   function and the hash is unchanged. The trade-off (an unrelated local
 *   variable that happens to share the definition's name is also masked) is
 *   harmless: masking is deterministic on both sides of the comparison.
 */
export function hashDefinition(node: Node, name: string): string {
  const parts: string[] = [];
  collect(node, name, parts);
  return `ast:sha256:${digest(parts.join('\u0000'))}`;
}

/** Combine hashes of multiple definitions (overloads/merged declarations). */
export function combineHashes(hashes: string[]): string {
  if (hashes.length === 1) return hashes[0]!;
  return `ast:sha256:${digest(hashes.slice().sort().join('\u0000'))}`;
}

/**
 * Tier 2: hash of the matched lines' text, prefixed `lex:` (§9.1).
 * Each line is trimmed individually so reindentation never triggers
 * staleness — the closest tier-2 analogue of tier-1's normalization.
 */
export function hashLexicalLine(lineText: string): string {
  const normalized = lineText
    .split('\n')
    .map((l) => l.trim())
    .join('\n');
  return `lex:sha256:${digest(normalized)}`;
}

function collect(node: Node, name: string, parts: string[]): void {
  if (node.type === 'comment') return;
  if (node.childCount === 0) {
    parts.push(node.type, node.text === name ? '\u0001NAME' : node.text);
    return;
  }
  if (node.isNamed) parts.push(node.type);
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i);
    if (child) collect(child, name, parts);
  }
}

function digest(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 16);
}

import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { combineHashes, hashDefinition, hashLexicalLine } from './checksum.js';
import {
  isSupportedExtension,
  kindSatisfies,
  loadLanguage,
} from './languages/index.js';
import type { Candidate, Definition, Ref, Resolution, Tier } from './types.js';

interface ExtractedDefinitions {
  definitions: Definition[];
  /** Tree-sitter recovered from syntax errors while parsing the file. */
  hasParseErrors: boolean;
}

/** Caches parses and file reads per run (§11 performance). */
export class Resolver {
  private readonly definitions = new Map<
    string,
    Promise<ExtractedDefinitions | null>
  >();
  private readonly contents = new Map<string, Promise<string | null>>();

  constructor(private readonly repoRoot: string) {}

  async resolve(ref: Ref): Promise<Resolution> {
    if (ref.syntaxError) {
      return broken(ref, 'file-only', `invalid reference: ${ref.syntaxError}`);
    }

    const abs = path.join(this.repoRoot, ref.targetPath);
    const fileStat = await stat(abs).catch(() => null);
    if (fileStat?.isDirectory()) {
      return broken(
        ref,
        'file-only',
        'target is a directory, not a file — point the ref at the source file that defines the symbol',
      );
    }
    if (!fileStat?.isFile()) {
      return broken(ref, tierFor(ref), 'file not found');
    }

    // Case-insensitive filesystems (macOS, Windows) resolve CLIENT.ts to
    // client.ts locally, then the ref breaks on Linux CI. Compare the
    // on-disk casing with what the doc wrote (§11).
    const caseMismatch = await this.checkCase(abs, ref.targetPath);
    if (caseMismatch) {
      return {
        ref,
        status: 'broken',
        tier: tierFor(ref),
        message: `file found but casing differs: doc says "${ref.targetPath}", disk says "${caseMismatch}" — this breaks on case-sensitive filesystems`,
        candidates: [],
        diskPath: caseMismatch,
      };
    }

    // Plain file link to an existing source file: nothing more to verify.
    if (ref.dotpath.length === 0) {
      return {
        ref,
        status: ref.fragment ? 'warning' : 'ok',
        tier: 'file-only',
        message: ref.fragment
          ? `fragment "#${ref.fragment}" is not checkable`
          : undefined,
        candidates: [],
      };
    }

    const extracted = await this.definitionsFor(abs);
    if (extracted !== null) return this.resolveAst(ref, extracted);
    return this.resolveLexical(ref, abs);
  }

  /** Tier 1: suffix-match the dotpath against definition nesting chains (SPEC §5.2). */
  private resolveAst(ref: Ref, extracted: ExtractedDefinitions): Resolution {
    const defs = extracted.definitions;
    const nameMatches = defs.filter((d) => chainEndsWith(d.chain, ref.dotpath));
    const matches = ref.kind
      ? nameMatches.filter((d) =>
          d.kinds.some((k) => kindSatisfies(ref.kind!, k)),
        )
      : nameMatches;

    if (matches.length === 1) {
      return {
        ref,
        status: 'ok',
        tier: 'ast',
        candidates: [],
        hash: matches[0]!.hash,
        matchLine: matches[0]!.line,
      };
    }

    if (matches.length > 1) {
      const chains = matches.map((m) => m.chain.join('.')).join(', ');
      const hint = ref.kind
        ? 'qualify with a parent segment'
        : 'add a parent segment or a kind to qualify';
      return broken(
        ref,
        'ast',
        `ambiguous: ${matches.length} definitions match (${chains}); ${hint}`,
        matches.map((m) => ({
          symbol: m.chain.join('.'),
          kind: m.kinds[0] ?? 'unknown',
          confidence: 1,
        })),
      );
    }

    if (ref.kind && nameMatches.length > 0) {
      const kinds = [...new Set(nameMatches.flatMap((d) => d.kinds))].join(
        ', ',
      );
      return broken(
        ref,
        'ast',
        `file OK; "${ref.dotpath.join('.')}" exists but is not a ${ref.kind} (found: ${kinds})`,
        candidatesFor(ref, nameMatches),
      );
    }

    // A file that failed to parse may be missing definitions the query
    // would otherwise find — say so instead of a misleading "not found"
    // (Law 8: an agent needs the real cause to act).
    if (extracted.hasParseErrors) {
      return broken(
        ref,
        'ast',
        'file OK but has syntax errors; symbol not found (fix the target file, then re-check)',
        candidatesFor(ref, defs),
      );
    }

    return broken(
      ref,
      'ast',
      'file OK; symbol not found',
      candidatesFor(ref, defs),
    );
  }

  /** Tier 2: word-boundary search for the final dotpath segment (§6). */
  private async resolveLexical(ref: Ref, abs: string): Promise<Resolution> {
    const content = await this.contentFor(abs);
    if (content === null) {
      return {
        ref,
        status: 'warning',
        tier: 'file-only',
        message: 'fragment not checkable (binary file)',
        candidates: [],
      };
    }

    const name = ref.dotpath[ref.dotpath.length - 1]!;
    // Not \b: `$` is legal in identifiers (SPEC §5.1) but is not a regex
    // word character, so \b$inject\b can never match. Use lookaround with
    // the spec's own identifier charset as the boundary.
    const pattern = new RegExp(
      `(?<![A-Za-z0-9_$])${escapeRegExp(name)}(?![A-Za-z0-9_$])`,
    );
    const matchedLines = content
      .split('\n')
      .filter((lineText) => pattern.test(lineText));
    if (matchedLines.length > 0) {
      return {
        ref,
        status: 'ok',
        tier: 'lexical',
        candidates: [],
        // Hash every matching line, not just the first. A lexical stamp
        // can't know which line is "the definition" in an unknown language;
        // what it can attest is "the set of lines mentioning this symbol" —
        // exactly the lines an agent following the ref would grep to.
        hash: hashLexicalLine(matchedLines.join('\n')),
      };
    }
    return broken(ref, 'lexical', 'file OK; symbol not found (lexical search)');
  }

  /**
   * Returns the on-disk repo-relative path when its casing differs from
   * the written one, or null when they agree. realpath resolves the true
   * casing on case-insensitive filesystems; on case-sensitive ones a
   * mismatched path already failed the stat, so this never fires.
   */
  private async checkCase(
    abs: string,
    written: string,
  ): Promise<string | null> {
    try {
      const [realAbs, realRoot] = await Promise.all([
        realpath(abs),
        this.realRepoRoot(),
      ]);
      const onDisk = path.relative(realRoot, realAbs).split(path.sep).join('/');
      // Only a pure case difference is an error — a symlink legitimately
      // resolves to a different path and must not be flagged.
      if (
        onDisk !== written &&
        onDisk.toLowerCase() === written.toLowerCase()
      ) {
        return onDisk;
      }
      return null;
    } catch {
      return null; // realpath failure: don't invent errors stat didn't find
    }
  }

  private realRepoRoot(): Promise<string> {
    this.realRoot ??= realpath(this.repoRoot).catch(() => this.repoRoot);
    return this.realRoot;
  }

  private realRoot: Promise<string> | undefined;

  /** Public lookup for fix's hash-verified rename detection (§9.2). */
  async definitionsForFile(repoRelPath: string): Promise<Definition[] | null> {
    const extracted = await this.definitionsFor(
      path.join(this.repoRoot, repoRelPath),
    );
    return extracted?.definitions ?? null;
  }

  private definitionsFor(abs: string): Promise<ExtractedDefinitions | null> {
    let defs = this.definitions.get(abs);
    if (!defs) {
      defs = this.extractDefinitions(abs);
      this.definitions.set(abs, defs);
    }
    return defs;
  }

  private async extractDefinitions(
    abs: string,
  ): Promise<ExtractedDefinitions | null> {
    const lang = await loadLanguage(path.extname(abs));
    if (!lang) return null;
    const content = await this.contentFor(abs);
    if (content === null) return null;

    const parser = lang.newParser();
    try {
      const tree = parser.parse(content);
      if (!tree) return null;

      interface RawDef {
        name: string;
        kind: string;
        start: number;
        end: number;
        line: number;
        hash: string;
        /** Chain prefix from an explicit @receiver capture (Go/Rust). */
        receiver?: string;
      }
      const raw: RawDef[] = [];
      for (const match of lang.tagsQuery.matches(tree.rootNode)) {
        const def = match.captures.find((c) =>
          c.name.startsWith('definition.'),
        );
        const name = match.captures.find((c) => c.name === 'name');
        if (!def || !name) continue;
        // @receiver ties a method to its type when nesting isn't lexical:
        // Go receivers and Rust impl blocks (our queries/*.extra.scm).
        const receiver = match.captures.find((c) => c.name === 'receiver');
        raw.push({
          name: name.node.text,
          kind: def.name.slice('definition.'.length),
          start: def.node.startIndex,
          end: def.node.endIndex,
          line: name.node.startPosition.row + 1,
          hash: hashDefinition(def.node, name.node.text),
          receiver: receiver?.node.text,
        });
      }

      // The upstream query and a receiver-aware extra can capture the same
      // definition node; keep only the receiver-aware one — it produces the
      // richer chain (Server.Start), and the plain one would pollute
      // matching with a duplicate short chain.
      const byRange = new Map<string, RawDef>();
      for (const d of raw) {
        const key = `${d.start}:${d.end}:${d.name}`;
        const existing = byRange.get(key);
        if (!existing || (d.receiver && !existing.receiver)) {
          byRange.set(key, d);
        }
      }
      const deduped = [...byRange.values()];

      const hasParseErrors = tree.rootNode.hasError;

      // Nesting chain = names of strictly-enclosing definitions, outermost
      // first. Overloads / merged declarations with an identical chain
      // collapse into one Definition (§11).
      const merged = new Map<string, Definition & { hashes: string[] }>();
      for (const d of deduped) {
        const enclosing = deduped
          .filter((o) => o !== d && o.start <= d.start && o.end >= d.end)
          .sort((a, b) => a.start - b.start || b.end - a.end);
        // Dotted names split into segments: Elixir's `defmodule Broker.Consumer`
        // captures one name "Broker.Consumer", but the chain must be
        // [Broker, Consumer] so `Consumer.poll` suffix-matches (SPEC §5.2).
        const chain = [
          ...enclosing.flatMap((o) => o.name.split('.')),
          ...(d.receiver ? d.receiver.split('.') : []),
          ...d.name.split('.'),
        ];
        const key = chain.join('.');
        const existing = merged.get(key);
        if (existing) {
          if (!existing.kinds.includes(d.kind)) existing.kinds.push(d.kind);
          if (!existing.hashes.includes(d.hash)) existing.hashes.push(d.hash);
        } else {
          merged.set(key, {
            name: d.name,
            chain,
            kinds: [d.kind],
            line: d.line,
            hash: d.hash,
            hashes: [d.hash],
          });
        }
      }
      return {
        definitions: [...merged.values()].map(({ hashes, ...def }) => ({
          ...def,
          hash: combineHashes(hashes),
        })),
        hasParseErrors,
      };
    } finally {
      parser.delete();
    }
  }

  private contentFor(abs: string): Promise<string | null> {
    let content = this.contents.get(abs);
    if (!content) {
      content = readTextFile(abs);
      this.contents.set(abs, content);
    }
    return content;
  }
}

async function readTextFile(abs: string): Promise<string | null> {
  const buf = await readFile(abs).catch(() => null);
  if (buf === null || buf.includes(0)) return null; // NUL byte ≈ binary
  return buf.toString('utf8');
}

function tierFor(ref: Ref): Tier {
  if (ref.dotpath.length === 0) return 'file-only';
  return isSupportedExtension(path.extname(ref.targetPath)) ? 'ast' : 'lexical';
}

function chainEndsWith(chain: string[], suffix: string[]): boolean {
  if (suffix.length === 0 || suffix.length > chain.length) return false;
  const offset = chain.length - suffix.length;
  return suffix.every((seg, i) => chain[offset + i] === seg);
}

function broken(
  ref: Ref,
  tier: Tier,
  message: string,
  candidates: Candidate[] = [],
): Resolution {
  return { ref, status: 'broken', tier, message, candidates };
}

/** Rank a file's definitions by similarity to the ref's final segment. */
function candidatesFor(ref: Ref, defs: Definition[]): Candidate[] {
  const wanted = ref.dotpath[ref.dotpath.length - 1]!;
  return defs
    .map((d) => ({
      symbol: d.chain.join('.'),
      kind: d.kinds[0] ?? 'unknown',
      confidence: similarity(wanted, d.name),
    }))
    .filter((c) => c.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/** Normalized edit-distance similarity in [0, 1]. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}

function editDistance(a: string, b: string): number {
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

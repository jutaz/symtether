/** Resolution confidence tier (design doc §6). Always reported, never hidden. */
export type Tier = 'ast' | 'lexical' | 'file-only';

/** Per-ref outcome. `stale` is reserved for v0.2 `--strict`. */
export type RefStatus = 'ok' | 'broken' | 'stale' | 'warning';

/** Closed set of kind disambiguators (SPEC §5.1). */
export type SymbolKind = 'fn' | 'class' | 'type' | 'const';

export const SYMBOL_KINDS: readonly SymbolKind[] = [
  'fn',
  'class',
  'type',
  'const',
];

/** A symbol reference extracted from a markdown file, before resolution. */
export interface Ref {
  /** Repo-relative posix path of the markdown file. */
  doc: string;
  /** 1-based line of the link in the doc. */
  line: number;
  /** Link target path exactly as written. */
  rawTarget: string;
  /** Repo-relative posix path the target resolves to. */
  targetPath: string;
  /** Fragment without the leading `#`, e.g. `sym:ApiClient.fetchData`. */
  fragment: string;
  /** Dotpath segments, e.g. `['ApiClient', 'fetchData']`. Empty for plain file links. */
  dotpath: string[];
  /** Optional kind disambiguator. */
  kind?: SymbolKind;
  /** True when written in a lenient (non-`#sym:`) compat form. */
  compat: boolean;
  /** Set when the ref itself is malformed (unknown kind, bad charset, path escape). */
  syntaxError?: string;
}

/** A named definition extracted from a source file. */
export interface Definition {
  name: string;
  /** Enclosing definition names, outermost first, ending with `name`. */
  chain: string[];
  /** Kinds seen for this chain (overloads/merged declarations collapse to one). */
  kinds: string[];
  /** 1-based start line in the source file. */
  line: number;
  /**
   * Normalized content hash (`ast:sha256:<16hex>`), name-independent so
   * renames are detectable by identical hash (§9.2). Overloads/merged
   * declarations combine into one hash.
   */
  hash: string;
}

export interface Candidate {
  symbol: string;
  kind: string;
  confidence: number;
}

/** Outcome of resolving one ref. */
export interface Resolution {
  ref: Ref;
  status: RefStatus;
  tier: Tier;
  /** Human-readable explanation for non-ok outcomes. */
  message?: string;
  /** Closest symbols in the target file, best first (broken refs only). */
  candidates: Candidate[];
  /**
   * Content hash of what the ref resolved to (ok results only):
   * the matched definition at tier 1, the matched line at tier 2.
   */
  hash?: string;
  /**
   * 1-based line of the matched definition in the target file (tier-1 ok
   * results only) — lets consumers deep-link, e.g. GitHub `#L<n>` anchors.
   */
  matchLine?: number;
  /**
   * On-disk path when it differs from the written one only by casing
   * (broken refs on case-insensitive filesystems). Lets fix rewrite the
   * path without guessing.
   */
  diskPath?: string;
}

export interface CheckSummary {
  refs: number;
  ast: number;
  lexical: number;
  fileOnly: number;
  broken: number;
  stale: number;
}

export interface CheckReport {
  summary: CheckSummary;
  results: Resolution[];
}

export interface CheckOptions {
  /** Directory to treat as the repo. Defaults to the discovered repo root of cwd. */
  cwd?: string;
  /** Markdown globs to check. Defaults to `**\/*.md`. */
  globs?: string[];
  /** Extra include globs (added to defaults). */
  include?: string[];
  /** Extra exclude globs (added to default excludes). */
  exclude?: string[];
  /**
   * Compare resolved refs against `symtether.sum` and mark changed targets
   * `stale`. Requires the sum file (run `symtether update`). Whether stale
   * fails or warns is exit-code policy and lives in the CLI.
   */
  strict?: boolean;
}

/** Invalid invocation (missing prerequisites, bad flags) — CLI exit code 2. */
export class UsageError extends Error {}

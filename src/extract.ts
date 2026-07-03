import path from 'node:path';
import type { Html, Root } from 'mdast';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import { resolveTarget } from './repo.js';
import type { Ref, SymbolKind } from './types.js';
import { SYMBOL_KINDS } from './types.js';

/** Markdown targets carry heading anchors, not symbol refs — never ours (SPEC §5.3). */
const MARKDOWN_EXTS = new Set(['.md', '.mdx', '.markdown', '.mdown']);
const IDENT = /^[A-Za-z0-9_$]+$/;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;
/** GitHub line anchors (`#L10`, `#L10-L20`) — permanently out of scope (SPEC §5.4). */
const LINE_ANCHOR = /^L\d+(?:-L\d+)?$/;

const parser = unified().use(remarkParse);

/**
 * Extract candidate refs from one markdown document.
 *
 * Recognized: inline links and reference-style link definitions. Ignored:
 * code fences/spans (never link nodes in mdast), images, autolinks and any
 * URL with a scheme, pure-fragment links, and links to markdown files.
 */
export function extractRefs(
  repoRoot: string,
  docPath: string,
  content: string,
): Ref[] {
  const tree = parser.parse(content) as Root;
  const suppressed = collectSuppressions(tree);
  const refs: Ref[] = [];

  visit(tree, ['link', 'definition'], (node) => {
    if (!('url' in node) || !node.position) return;
    const line = node.position.start.line;
    if (suppressed(line)) return;
    const ref = buildRef(repoRoot, docPath, node.url, line);
    if (ref) refs.push(ref);
  });

  return refs;
}

function buildRef(
  repoRoot: string,
  docPath: string,
  url: string,
  line: number,
): Ref | null {
  if (!url || url.startsWith('#') || HAS_SCHEME.test(url)) return null;
  // CommonMark soft line breaks can leak literal newlines into link URLs;
  // never let control characters flow into paths or error messages.
  if (/[\n\r\t]/.test(url)) return null;

  const hash = url.indexOf('#');
  const rawTarget = hash === -1 ? url : url.slice(0, hash);
  const fragment = hash === -1 ? '' : url.slice(hash + 1);
  if (!rawTarget) return null;

  const decodedTarget = tryDecode(rawTarget);
  // Directory-ish targets (`.`, `..`, trailing slash) can never contain a
  // symbol — skip them; they're navigation links, not code refs.
  const lastSegment = path.posix.basename(decodedTarget);
  if (
    lastSegment === '.' ||
    lastSegment === '..' ||
    lastSegment === '' ||
    decodedTarget.endsWith('/')
  )
    return null;
  if (MARKDOWN_EXTS.has(path.extname(decodedTarget).toLowerCase())) return null;

  const base: Ref = {
    doc: docPath,
    line,
    rawTarget,
    targetPath: decodedTarget.replace(/^\//, ''),
    fragment,
    dotpath: [],
    compat: false,
  };

  const resolved = resolveTarget(repoRoot, docPath, decodedTarget);
  if (resolved === null) {
    return { ...base, syntaxError: 'path escapes the repository root' };
  }
  base.targetPath = resolved;

  if (!fragment) return base;

  if (fragment.startsWith('sym:')) {
    return parseSymFragment(base, fragment.slice('sym:'.length));
  }

  // Line anchors and non-identifier fragments stay file-level; bare
  // dotpaths are the docref-compat form (SPEC §5.3).
  if (LINE_ANCHOR.test(fragment)) return base;
  const segments = fragment.split('.');
  if (segments.every((s) => IDENT.test(s))) {
    return { ...base, dotpath: segments, compat: true };
  }
  return base;
}

function parseSymFragment(base: Ref, body: string): Ref {
  let kind: SymbolKind | undefined;
  let dotpathText = body;

  const colon = body.indexOf(':');
  if (colon !== -1) {
    const kindText = body.slice(0, colon);
    dotpathText = body.slice(colon + 1);
    if (!(SYMBOL_KINDS as readonly string[]).includes(kindText)) {
      return {
        ...base,
        syntaxError: `unknown kind "${kindText}" (expected one of: ${SYMBOL_KINDS.join(', ')})`,
      };
    }
    kind = kindText as SymbolKind;
  }

  const segments = dotpathText.split('.');
  if (!dotpathText || !segments.every((s) => IDENT.test(s))) {
    return {
      ...base,
      syntaxError: `invalid dotpath "${dotpathText}" (segments must match [A-Za-z0-9_$]+)`,
    };
  }

  return { ...base, dotpath: segments, kind };
}

/**
 * Anchored directive form: the whole comment must be the directive — a
 * prose comment that merely *mentions* "symtether-disable" must never
 * suppress checking.
 */
const DIRECTIVE = /^<!--\s*symtether-(disable-next-line|disable|enable)\s*-->$/;

/**
 * Build a line-suppression predicate from `<!-- symtether-disable* -->`
 * comments (SPEC §5.5). Comments inside code fences are `code` nodes in
 * mdast, so examples never suppress anything.
 */
function collectSuppressions(tree: Root): (line: number) => boolean {
  const nextLines = new Set<number>();
  const ranges: Array<[number, number]> = [];
  let openRange: number | null = null;

  visit(tree, 'html', (node: Html) => {
    if (!node.position) return;
    const directive = DIRECTIVE.exec(node.value.trim())?.[1];
    if (directive === 'disable-next-line') {
      nextLines.add(node.position.end.line + 1);
    } else if (directive === 'enable') {
      if (openRange !== null) {
        ranges.push([openRange, node.position.start.line]);
        openRange = null;
      }
    } else if (directive === 'disable') {
      openRange ??= node.position.end.line;
    }
  });
  if (openRange !== null) ranges.push([openRange, Infinity]);

  return (line) =>
    nextLines.has(line) || ranges.some(([a, b]) => line >= a && line <= b);
}

function tryDecode(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

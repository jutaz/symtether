import pc from 'picocolors';
import type { CheckReport, Resolution } from './types.js';

/** JSON output per the stable §7.4 contract. */
export function toJson(report: CheckReport): string {
  return JSON.stringify(
    {
      version: 1,
      summary: report.summary,
      results: report.results.map((r) => ({
        doc: r.ref.doc,
        line: r.ref.line,
        target: r.ref.targetPath,
        fragment: r.ref.fragment,
        status: r.status,
        tier: r.tier,
        compat: r.ref.compat,
        ...(r.message ? { message: r.message } : {}),
        candidates: r.candidates.map((c) => ({
          symbol: c.symbol,
          kind: c.kind,
          confidence: Number(c.confidence.toFixed(2)),
        })),
        ...(r.status === 'broken'
          ? { fix: `symtether fix ${r.ref.doc}` }
          : r.status === 'stale'
            ? { fix: `symtether update ${r.ref.targetPath}` }
            : {}),
      })),
    },
    null,
    2,
  );
}

/**
 * Human output — designed for CI logs read by humans *and* agents (Law 8):
 * every failure carries location, cause, candidates, and the fix command.
 */
export function toHuman(report: CheckReport, quiet = false): string {
  const lines: string[] = [];
  const byDoc = new Map<string, Resolution[]>();
  for (const r of report.results) {
    if (quiet && r.status === 'ok') continue;
    const group = byDoc.get(r.ref.doc) ?? [];
    group.push(r);
    byDoc.set(r.ref.doc, group);
  }

  for (const [doc, results] of byDoc) {
    lines.push(pc.bold(doc));
    const width = Math.max(...results.map((r) => refLabel(r).length), 0);
    for (const r of results) {
      lines.push(formatResult(r, width));
      if (r.message && r.status !== 'ok') {
        lines.push(`      ${r.message}`);
      }
      if (r.status === 'broken' && r.candidates.length > 0) {
        const names = r.candidates
          .map((c) => `${c.symbol} (${c.kind})`)
          .join(', ');
        lines.push(`      closest in file: ${names}`);
      }
      if (r.status === 'broken') {
        lines.push(pc.dim(`      → symtether fix ${r.ref.doc}`));
      }
      if (r.status === 'stale') {
        lines.push(
          pc.dim(`      → review, then: symtether update ${r.ref.targetPath}`),
        );
      }
    }
    lines.push('');
  }

  const s = report.summary;
  const parts = [`${s.refs} refs`, `${s.ast} ast`, `${s.lexical} lexical`];
  if (s.fileOnly) parts.push(`${s.fileOnly} file-only`);
  if (s.stale) parts.push(`${s.stale} stale`);
  parts.push(s.broken ? pc.red(`${s.broken} broken`) : pc.green('0 broken'));
  lines.push(parts.join(' · '));
  return lines.join('\n');
}

function refLabel(r: Resolution): string {
  const frag = r.ref.fragment ? `#${r.ref.fragment}` : '';
  return `${r.ref.targetPath}${frag}`;
}

function formatResult(r: Resolution, width: number): string {
  const label = refLabel(r).padEnd(width + 2);
  const compat = r.ref.compat ? ' (compat)' : '';
  switch (r.status) {
    case 'broken':
      return `  ${pc.red('✗')} ${label} ${pc.red('BROKEN')} (line ${r.ref.line})`;
    case 'warning':
      return `  ${pc.yellow('!')} ${label} ${pc.yellow('file-only')}${compat}`;
    case 'stale':
      return `  ${pc.yellow('~')} ${label} ${pc.yellow('STALE')} (line ${r.ref.line})`;
    default:
      return r.tier === 'lexical'
        ? `  ${pc.yellow('~')} ${label} ${pc.dim('lexical')}${compat}`
        : `  ${pc.green('✓')} ${label} ${pc.dim(r.tier)}${compat}`;
  }
}

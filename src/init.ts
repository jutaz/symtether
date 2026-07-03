import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { findRepoRoot } from './repo.js';
import { SUM_FILE } from './sumfile.js';
import { UsageError } from './types.js';

const BEGIN =
  '<!-- symtether:begin v1 (managed by `symtether init` — do not edit) -->';
const END = '<!-- symtether:end -->';

/**
 * The stale-handling line, included only in sum-file repos (§10): it closes
 * the agent review loop — stale means "re-judge the prose, then stamp".
 */
const STALE_LINE =
  '- On stale refs: re-read the doc prose against the current code; fix the doc or run `npx symtether update <target>`.';

/** Exact managed block (design doc §8). Hard budget: ≤ 80 tokens. */
export function managedBlock(withStaleLine = false): string {
  return `${BEGIN}
## Code references
Links like \`[x](path/file.ts#sym:Class.method)\` point at a symbol in that file.
- Resolve: grep the symbol name in the file; read the surrounding code.
- After renaming/moving symbols: run \`npx symtether check\`, repair refs (\`npx symtether fix\`).
- When writing docs/skills, prefer \`#sym:\` refs over line numbers or pasted snippets.${
    withStaleLine ? `\n${STALE_LINE}` : ''
  }
Spec: https://symtether.dev/spec
${END}`;
}

/** v0.1-compatible export: the block without the stale line. */
export const MANAGED_BLOCK = managedBlock(false);

const WORKFLOW = `name: symtether
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npx symtether check
`;

export interface InitOptions {
  cwd?: string;
  /** Target file for the managed block. Default: AGENTS.md. */
  file?: string;
  /** Also write .github/workflows/symtether.yml. */
  ci?: boolean;
}

export interface InitResult {
  file: string;
  action: 'created' | 'updated' | 'unchanged';
  workflow?: string;
}

/**
 * Insert or update the managed block. Idempotent via the marker comments:
 * re-running updates in place, never duplicates, never touches content
 * outside the markers (§7.3).
 */
export async function init(options: InitOptions = {}): Promise<InitResult> {
  const repoRoot = findRepoRoot(options.cwd ?? process.cwd());
  const fileName = options.file ?? 'AGENTS.md';
  const target = path.resolve(repoRoot, fileName);
  const rel = path.relative(repoRoot, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new UsageError(
      `--file must stay inside the repository (got "${fileName}")`,
    );
  }

  // Sum-file repos get the stale-handling line (§10). Re-running init after
  // the first `update` upgrades the block in place.
  const block = managedBlock(existsSync(path.join(repoRoot, SUM_FILE)));

  const existing = await readFile(target, 'utf8').catch(() => null);
  let action: InitResult['action'];
  let next: string;

  if (existing === null) {
    next = `${block}\n`;
    action = 'created';
  } else {
    const beginIdx = existing.indexOf('<!-- symtether:begin');
    // Search END only after BEGIN so a stray end-marker earlier in the file
    // can't produce a negative-length block.
    const endIdx = beginIdx === -1 ? -1 : existing.indexOf(END, beginIdx);
    if (beginIdx !== -1 && endIdx !== -1) {
      const tail = existing.slice(endIdx + END.length);
      if (tail.includes('<!-- symtether:begin')) {
        throw new UsageError(
          `${fileName} contains multiple symtether blocks — remove the extras, then re-run init`,
        );
      }
      next = existing.slice(0, beginIdx) + block + tail;
      action = next === existing ? 'unchanged' : 'updated';
    } else {
      const sep = existing.endsWith('\n') ? '\n' : '\n\n';
      next = `${existing}${sep}${block}\n`;
      action = 'updated';
    }
  }

  if (action !== 'unchanged') await writeFile(target, next, 'utf8');

  const result: InitResult = { file: fileName, action };

  if (options.ci) {
    const workflowPath = path.join(repoRoot, '.github', 'workflows');
    await mkdir(workflowPath, { recursive: true });
    await writeFile(path.join(workflowPath, 'symtether.yml'), WORKFLOW, 'utf8');
    result.workflow = '.github/workflows/symtether.yml';
  }

  return result;
}

import { cp, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
);

/**
 * Copy a fixture to a temp dir and mark it as a repo root with an empty
 * `.git`. Isolates tests from symtether's own repo (fixtures have no `.git`
 * of their own, because it can't be committed) and lets `fix --write` mutate freely.
 */
export async function setupFixture(name: string): Promise<{
  dir: string;
  cleanup: () => Promise<void>;
}> {
  const dir = await mkdtemp(path.join(tmpdir(), `symtether-${name}-`));
  await cp(path.join(FIXTURES, name), dir, { recursive: true });
  await mkdir(path.join(dir, '.git'), { recursive: true });
  return {
    dir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

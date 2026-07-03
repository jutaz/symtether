import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { init, MANAGED_BLOCK } from '../src/init.js';
import { UsageError } from '../src/types.js';
import { setupFixture } from './helpers.js';

describe('init', () => {
  it('creates AGENTS.md when absent', async () => {
    const fixture = await setupFixture('basic');
    try {
      const result = await init({ cwd: fixture.dir });
      expect(result).toMatchObject({ file: 'AGENTS.md', action: 'created' });
      const content = await readFile(
        path.join(fixture.dir, 'AGENTS.md'),
        'utf8',
      );
      expect(content).toContain('symtether:begin');
      expect(content).toContain('symtether:end');
    } finally {
      await fixture.cleanup();
    }
  });

  it('is idempotent: 3 runs, block appears once, byte-identical', async () => {
    const fixture = await setupFixture('basic');
    try {
      await init({ cwd: fixture.dir });
      const first = await readFile(path.join(fixture.dir, 'AGENTS.md'), 'utf8');
      await init({ cwd: fixture.dir });
      await init({ cwd: fixture.dir });
      const third = await readFile(path.join(fixture.dir, 'AGENTS.md'), 'utf8');
      expect(third).toBe(first);
      expect(third.match(/symtether:begin/g)).toHaveLength(1);
    } finally {
      await fixture.cleanup();
    }
  });

  it('preserves user content outside the markers', async () => {
    const fixture = await setupFixture('basic');
    const agentsPath = path.join(fixture.dir, 'AGENTS.md');
    try {
      await writeFile(
        agentsPath,
        `# My rules\n\nAlways use tabs.\n\n${MANAGED_BLOCK}\n\n## More rules\n\nNever use tabs.\n`,
      );
      const result = await init({ cwd: fixture.dir });
      expect(result.action).toBe('unchanged');
      const content = await readFile(agentsPath, 'utf8');
      expect(content).toContain('# My rules');
      expect(content).toContain('## More rules');
      expect(content.match(/symtether:begin/g)).toHaveLength(1);
    } finally {
      await fixture.cleanup();
    }
  });

  it('updates an outdated block in place', async () => {
    const fixture = await setupFixture('basic');
    const agentsPath = path.join(fixture.dir, 'AGENTS.md');
    try {
      await writeFile(
        agentsPath,
        '<!-- symtether:begin v0 (managed by `symtether init` — do not edit) -->\nold content\n<!-- symtether:end -->\n',
      );
      const result = await init({ cwd: fixture.dir });
      expect(result.action).toBe('updated');
      const content = await readFile(agentsPath, 'utf8');
      expect(content).not.toContain('old content');
      expect(content).toContain('## Code references');
    } finally {
      await fixture.cleanup();
    }
  });

  it('targets another file with --file', async () => {
    const fixture = await setupFixture('basic');
    try {
      const result = await init({ cwd: fixture.dir, file: 'CLAUDE.md' });
      expect(result.file).toBe('CLAUDE.md');
      const content = await readFile(
        path.join(fixture.dir, 'CLAUDE.md'),
        'utf8',
      );
      expect(content).toContain('symtether:begin');
    } finally {
      await fixture.cleanup();
    }
  });

  it('rejects --file paths escaping the repo', async () => {
    const fixture = await setupFixture('basic');
    try {
      await expect(
        init({ cwd: fixture.dir, file: '../../outside.md' }),
      ).rejects.toThrow(UsageError);
      expect(existsSync(path.join(fixture.dir, '..', 'outside.md'))).toBe(
        false,
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it('refuses files with multiple managed blocks instead of guessing', async () => {
    const fixture = await setupFixture('basic');
    const agentsPath = path.join(fixture.dir, 'AGENTS.md');
    try {
      await writeFile(agentsPath, `${MANAGED_BLOCK}\n\n${MANAGED_BLOCK}\n`);
      await expect(init({ cwd: fixture.dir })).rejects.toThrow(
        /multiple symtether blocks/,
      );
    } finally {
      await fixture.cleanup();
    }
  });

  it('handles a stray end-marker before the real block', async () => {
    const fixture = await setupFixture('basic');
    const agentsPath = path.join(fixture.dir, 'AGENTS.md');
    try {
      await writeFile(
        agentsPath,
        `some text with <!-- symtether:end --> in prose\n\n${MANAGED_BLOCK}\n`,
      );
      const result = await init({ cwd: fixture.dir });
      expect(result.action).toBe('unchanged');
      const content = await readFile(agentsPath, 'utf8');
      expect(content.match(/symtether:begin/g)).toHaveLength(1);
    } finally {
      await fixture.cleanup();
    }
  });

  it('writes the CI workflow with --ci', async () => {
    const fixture = await setupFixture('basic');
    try {
      const result = await init({ cwd: fixture.dir, ci: true });
      expect(result.workflow).toBe('.github/workflows/symtether.yml');
      const content = await readFile(
        path.join(fixture.dir, '.github', 'workflows', 'symtether.yml'),
        'utf8',
      );
      expect(content).toContain('npx symtether check');
    } finally {
      await fixture.cleanup();
    }
  });
});

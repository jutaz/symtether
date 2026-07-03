import { describe, expect, it } from 'vitest';
import { extractRefs } from './extract.js';

const ROOT = '/repo';

function refs(markdown: string, doc = 'docs/guide.md') {
  return extractRefs(ROOT, doc, markdown);
}

describe('extractRefs', () => {
  it('parses a canonical #sym: ref', () => {
    const [ref] = refs('[x](../src/client.ts#sym:ApiClient.fetchData)');
    expect(ref).toMatchObject({
      targetPath: 'src/client.ts',
      fragment: 'sym:ApiClient.fetchData',
      dotpath: ['ApiClient', 'fetchData'],
      compat: false,
      line: 1,
    });
    expect(ref!.kind).toBeUndefined();
  });

  it('parses a kind disambiguator', () => {
    const [ref] = refs('[x](../src/config.ts#sym:fn:parseConfig)');
    expect(ref).toMatchObject({ kind: 'fn', dotpath: ['parseConfig'] });
  });

  it('flags unknown kinds as syntax errors, not ignored', () => {
    const [ref] = refs('[x](../src/a.ts#sym:widget:Foo)');
    expect(ref!.syntaxError).toContain('unknown kind "widget"');
  });

  it('flags invalid dotpath charset', () => {
    const [ref] = refs('[x](../src/a.ts#sym:Foo-Bar)');
    expect(ref!.syntaxError).toContain('invalid dotpath');
  });

  it('resolves /-prefixed targets from the repo root', () => {
    const [ref] = refs('[x](/packages/core/types.ts#sym:AgentSkill)');
    expect(ref!.targetPath).toBe('packages/core/types.ts');
  });

  it('resolves relative targets from the doc directory', () => {
    const [ref] = refs('[x](./a.ts#sym:Foo)', 'docs/nested/guide.md');
    expect(ref!.targetPath).toBe('docs/nested/a.ts');
  });

  it('flags path traversal escaping the repo root', () => {
    const [ref] = refs('[x](../../../etc/passwd#sym:root)');
    expect(ref!.syntaxError).toContain('escapes the repository root');
  });

  it('treats bare dotpath fragments as compat form', () => {
    const [ref] = refs('[x](../src/client.ts#ApiClient.fetchData)');
    expect(ref).toMatchObject({
      compat: true,
      dotpath: ['ApiClient', 'fetchData'],
    });
  });

  it('ignores markdown targets (heading anchors)', () => {
    expect(refs('[x](./other.md#some-heading)')).toHaveLength(0);
  });

  it('ignores external URLs, mailto, and pure fragments', () => {
    const md = [
      '[a](https://example.com/x.ts#sym:Foo)',
      '[b](mailto:x@example.com)',
      '[c](#heading)',
    ].join('\n');
    expect(refs(md)).toHaveLength(0);
  });

  it('ignores images', () => {
    expect(refs('![alt](../assets/diagram.ts#sym:Foo)')).toHaveLength(0);
  });

  it('ignores links inside fenced code blocks and inline code', () => {
    const md = [
      '```markdown',
      '[a](../src/a.ts#sym:Foo)',
      '```',
      'and `[b](../src/b.ts#sym:Bar)` inline',
    ].join('\n');
    expect(refs(md)).toHaveLength(0);
  });

  it('extracts reference-style link definitions', () => {
    const md = ['See [the helper][h].', '', '[h]: ../src/a.ts#sym:helper'].join(
      '\n',
    );
    const result = refs(md);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ dotpath: ['helper'], line: 3 });
  });

  it('keeps plain file links (no fragment) as file-only refs', () => {
    const [ref] = refs('[x](../src/client.ts)');
    expect(ref).toMatchObject({ fragment: '', dotpath: [] });
  });

  it('treats GitHub line anchors as file-level, not symbol refs', () => {
    const [ref] = refs('[x](../src/client.ts#L10-L20)');
    expect(ref).toMatchObject({ dotpath: [], compat: false });
  });

  it('honors symtether-disable-next-line', () => {
    const md = [
      '<!-- symtether-disable-next-line -->',
      '[x](../src/a.ts#sym:Suppressed)',
      '[y](../src/a.ts#sym:Checked)',
    ].join('\n');
    const result = refs(md);
    expect(result).toHaveLength(1);
    expect(result[0]!.dotpath).toEqual(['Checked']);
  });

  it('honors disable/enable block comments', () => {
    const md = [
      '<!-- symtether-disable -->',
      '[a](../src/a.ts#sym:One)',
      '[b](../src/a.ts#sym:Two)',
      '<!-- symtether-enable -->',
      '[c](../src/a.ts#sym:Three)',
    ].join('\n');
    const result = refs(md);
    expect(result).toHaveLength(1);
    expect(result[0]!.dotpath).toEqual(['Three']);
  });

  it('supports $ and _ in identifiers', () => {
    const [ref] = refs('[x](../src/a.ts#sym:$inject._private)');
    expect(ref!.dotpath).toEqual(['$inject', '_private']);
    expect(ref!.syntaxError).toBeUndefined();
  });

  it('normalizes Windows backslash separators in targets', () => {
    const [ref] = refs('[x](..\\src\\client.ts#sym:ApiClient.fetchData)');
    expect(ref).toMatchObject({
      targetPath: 'src/client.ts',
      dotpath: ['ApiClient', 'fetchData'],
    });
    expect(ref!.syntaxError).toBeUndefined();
  });

  it('ignores Windows drive-letter absolutes like external URLs', () => {
    // `C:` parses as a URL scheme — same bucket as https:, never a repo path.
    expect(refs('[x](C:\\Program%20Files\\x.ts#sym:Foo)')).toHaveLength(0);
  });

  it('extracts refs from CRLF documents with correct line numbers', () => {
    const md = '# Title\r\n\r\n[x](../src/a.ts#sym:Foo)\r\n';
    const result = refs(md);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ line: 3, dotpath: ['Foo'] });
  });

  it('ignores directory-ish targets (., .., trailing slash)', () => {
    const md = [
      '[a](.#sym:Foo)',
      '[b](..#sym:Foo)',
      '[c](./#sym:Foo)',
      '[d](../src/#sym:Foo)',
    ].join('\n');
    expect(refs(md)).toHaveLength(0);
  });

  it('ignores link URLs containing newlines (CommonMark soft breaks)', () => {
    const md = '[x](../src/a.ts\\\n#sym:Foo)';
    const result = refs(md);
    expect(result.every((r) => !/[\n\r]/.test(r.targetPath + r.fragment))).toBe(
      true,
    );
  });

  it('does not suppress on comments that merely mention the directive', () => {
    const md = [
      '<!-- TODO: we used to use symtether-disable but rolled our own -->',
      '[x](../src/a.ts#sym:Checked)',
    ].join('\n');
    const result = refs(md);
    expect(result).toHaveLength(1);
    expect(result[0]!.dotpath).toEqual(['Checked']);
  });

  it('accepts directives with flexible interior whitespace only', () => {
    const md = [
      '<!--symtether-disable-next-line-->',
      '[x](../src/a.ts#sym:Suppressed)',
    ].join('\n');
    expect(refs(md)).toHaveLength(0);
  });
});

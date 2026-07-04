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

describe('extractRefs: hostile and malformed input', () => {
  it('empty document, whitespace-only document, BOM-only document', () => {
    expect(refs('')).toEqual([]);
    expect(refs('   \n\t\n  ')).toEqual([]);
    expect(refs('\uFEFF')).toEqual([]);
  });

  it('empty #sym: fragment is a syntax error, not a silent pass', () => {
    const [ref] = refs('[x](../src/a.ts#sym:)');
    expect(ref!.syntaxError).toContain('invalid dotpath ""');
  });

  it('kind present but dotpath empty (#sym:fn:) is a syntax error', () => {
    const [ref] = refs('[x](../src/a.ts#sym:fn:)');
    expect(ref!.syntaxError).toContain('invalid dotpath');
  });

  it('double dots, leading dots, trailing dots in dotpath all error', () => {
    for (const frag of ['a..b', '.a', 'a.', '.']) {
      const [ref] = refs(`[x](../src/a.ts#sym:${frag})`);
      expect(ref!.syntaxError, `#sym:${frag}`).toContain('invalid dotpath');
    }
  });

  it('doubled colon picks the first as kind: #sym:fn:fn:x errors on dotpath', () => {
    // kind = "fn", dotpath = "fn:x" — colon is not in the identifier charset.
    const [ref] = refs('[x](../src/a.ts#sym:fn:fn:x)');
    expect(ref!.syntaxError).toContain('invalid dotpath "fn:x"');
  });

  it('unicode identifiers are NOT supported (spec charset is ASCII)', () => {
    // SPEC §5.1 pragmatically limits the charset; pin the rejection.
    for (const name of ['café', '日本', 'ステータス', 'naïve']) {
      const [ref] = refs(`[x](../src/a.ts#sym:${name})`);
      expect(ref!.syntaxError, name).toContain('invalid dotpath');
    }
  });

  it('a 100-segment dotpath extracts fine (no arbitrary limits)', () => {
    const dotpath = Array.from({ length: 100 }, (_, i) => `s${i}`).join('.');
    const [ref] = refs(`[x](../src/a.ts#sym:${dotpath})`);
    expect(ref!.dotpath).toHaveLength(100);
    expect(ref!.syntaxError).toBeUndefined();
  });

  it('percent-encoding that decodes to traversal is still caught', () => {
    const [ref] = refs('[x](..%2F..%2F..%2Fetc%2Fpasswd#sym:root)');
    expect(ref!.syntaxError).toContain('escapes the repository root');
  });

  it('malformed percent-encoding falls back to the raw string', () => {
    // decodeURIComponent throws on lone %; we keep the raw target.
    const [ref] = refs('[x](../src/100%file.ts#sym:x)');
    expect(ref!.targetPath).toBe('src/100%file.ts');
  });

  it('HTML <a href> links are out of scope (documented v0.1 limit)', () => {
    const md = '<a href="../src/a.ts#sym:Foo">manual anchor</a>';
    expect(refs(md)).toEqual([]);
  });

  it('image with a #sym: fragment stays ignored even for source targets', () => {
    expect(refs('![diagram](../src/a.ts#sym:Foo)')).toEqual([]);
  });

  it('link inside blockquote inside list inside table cell still extracts', () => {
    const md = [
      '> - | cell |',
      '>   | ---- |',
      '>   | [x](../src/a.ts#sym:Foo) |',
    ].join('\n');
    const result = refs(md);
    expect(result).toHaveLength(1);
    expect(result[0]!.dotpath).toEqual(['Foo']);
  });

  it('reference-style definition with a title still parses the url', () => {
    const md = '[use][id]\n\n[id]: ../src/a.ts#sym:Foo "a title"';
    const result = refs(md);
    expect(result).toHaveLength(1);
    expect(result[0]!.dotpath).toEqual(['Foo']);
  });

  it('same URL twice on one line yields two refs at the same line', () => {
    const md = '[a](../src/a.ts#sym:Foo) and [b](../src/a.ts#sym:Foo)';
    const result = refs(md);
    expect(result).toHaveLength(2);
    expect(result[0]!.line).toBe(1);
    expect(result[1]!.line).toBe(1);
  });

  it('disable-next-line at the last line of the file suppresses nothing (no crash)', () => {
    const md = '[x](../src/a.ts#sym:Foo)\n<!-- symtether-disable-next-line -->';
    expect(refs(md)).toHaveLength(1);
  });

  it('unclosed disable block suppresses to EOF', () => {
    const md = [
      '[before](../src/a.ts#sym:Before)',
      '<!-- symtether-disable -->',
      '[a](../src/a.ts#sym:One)',
      '[b](../src/a.ts#sym:Two)',
    ].join('\n');
    const result = refs(md);
    expect(result.map((r) => r.dotpath[0])).toEqual(['Before']);
  });

  it('enable without disable is a no-op', () => {
    const md = ['<!-- symtether-enable -->', '[x](../src/a.ts#sym:Foo)'].join(
      '\n',
    );
    expect(refs(md)).toHaveLength(1);
  });
});

describe('extractRefs: unsupported forms (pinned behavior)', () => {
  it('no wildcards or regex in dotpaths', () => {
    for (const frag of ['Api*', 'fetch.*', '[A-Z]+']) {
      const [ref] = refs(`[x](../src/a.ts#sym:${frag})`);
      // Either syntax error or (for charset-legal parts) plain no-match —
      // never a pattern match.
      if (ref!.syntaxError === undefined) {
        expect(ref!.dotpath.join('.')).toBe(frag);
      }
    }
  });

  it('no line numbers combined with symbols', () => {
    const [ref] = refs('[x](../src/a.ts#sym:Foo:L10)');
    expect(ref!.syntaxError).toBeDefined();
  });

  it('no query parameters', () => {
    const [ref] = refs('[x](../src/a.ts?plain=1#sym:Foo)');
    // The ? stays in the path; resolution will fail on a nonexistent file.
    // Pinned: we do not strip query strings.
    expect(ref!.targetPath).toContain('?');
  });

  it('.mdx targets are treated as markdown (heading anchors), not source', () => {
    expect(refs('[x](../notes/page.mdx#sym:Foo)')).toEqual([]);
  });
});

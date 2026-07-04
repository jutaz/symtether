import { describe, expect, it } from 'vitest';
import { combineHashes, hashLexicalLine } from './checksum.js';
import { similarity } from './resolve.js';

describe('combineHashes', () => {
  it('is identity on singletons', () => {
    expect(combineHashes(['h1'])).toBe('h1');
  });

  it('is order-independent', () => {
    expect(combineHashes(['a', 'b'])).toBe(combineHashes(['b', 'a']));
    expect(combineHashes(['a', 'b', 'c'])).toBe(combineHashes(['c', 'b', 'a']));
  });
});

describe('hashLexicalLine', () => {
  it('normalizes per-line indentation only', () => {
    expect(hashLexicalLine('  foo bar  ')).toBe(hashLexicalLine('foo bar'));
    expect(hashLexicalLine('a\n  b')).toBe(hashLexicalLine('  a\nb'));
    expect(hashLexicalLine('a b')).not.toBe(hashLexicalLine('ab'));
  });
});

describe('similarity', () => {
  it('empty strings, identical strings, disjoint strings', () => {
    expect(similarity('', '')).toBe(1);
    expect(similarity('abc', 'abc')).toBe(1);
    expect(similarity('abc', 'xyz')).toBe(0);
    expect(similarity('', 'abc')).toBe(0);
  });

  it('is symmetric', () => {
    expect(similarity('fetchData', 'getData')).toBe(
      similarity('getData', 'fetchData'),
    );
  });
});

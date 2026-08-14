import { describe, it, expect } from 'vitest';
import {
  countText, titleCase, sentenceCase, camelCase, pascalCase, snakeCase, kebabCase, constantCase,
  trimLines, collapseSpaces, removeBlankLines, removeLineBreaks, stripHtml, removeAccents,
  dedupeLines, sortLines, cleanup,
} from './text.lib';

describe('countText', () => {
  it('counts an empty string as all zero', () => {
    expect(countText('')).toMatchObject({ characters: 0, words: 0, sentences: 0, paragraphs: 0, lines: 0 });
  });

  it('counts words and characters', () => {
    const s = countText('Hello world');
    expect(s).toMatchObject({ characters: 11, charactersNoSpaces: 10, words: 2, sentences: 1, lines: 1 });
  });

  it('counts sentences and paragraphs', () => {
    expect(countText('One. Two! Three?').sentences).toBe(3);
    expect(countText('para one\n\npara two').paragraphs).toBe(2);
    expect(countText('a\nb\nc').lines).toBe(3);
  });

  it('estimates reading time at ~200 wpm', () => {
    expect(countText(Array(200).fill('w').join(' ')).readingMinutes).toBe(1);
  });
});

describe('case conversion', () => {
  it.each([
    [titleCase, 'hELLO world', 'Hello World'],
    [sentenceCase, 'hello world. bye now.', 'Hello world. Bye now.'],
    [camelCase, 'hello world-foo_bar', 'helloWorldFooBar'],
    [pascalCase, 'hello world', 'HelloWorld'],
    [snakeCase, 'helloWorld foo', 'hello_world_foo'],
    [kebabCase, 'Hello World', 'hello-world'],
    [constantCase, 'hello world', 'HELLO_WORLD'],
  ])('%o converts correctly', (fn, input, expected) => {
    expect((fn as (s: string) => string)(input)).toBe(expected);
  });
});

describe('cleanup ops', () => {
  it('trims lines', () => expect(trimLines('  a  \n  b ')).toBe('a\nb'));
  it('collapses spaces', () => expect(collapseSpaces('a    b')).toBe('a b'));
  it('removes blank lines', () => expect(removeBlankLines('a\n\n\nb')).toBe('a\nb'));
  it('removes line breaks', () => expect(removeLineBreaks('a\nb\nc')).toBe('a b c'));
  it('strips HTML', () => expect(stripHtml('<p>hi <b>there</b></p>')).toBe('hi there'));
  it('removes accents', () => expect(removeAccents('café résumé')).toBe('cafe resume'));
  it('dedupes lines preserving order', () => expect(dedupeLines('a\nb\na\nc\nb')).toBe('a\nb\nc'));
  it('sorts lines', () => expect(sortLines('c\na\nb')).toBe('a\nb\nc'));

  it('applies ops in order via cleanup()', () => {
    expect(cleanup('  a  \n\n  a  ', ['trimLines', 'removeBlankLines', 'dedupeLines'])).toBe('a');
  });
});

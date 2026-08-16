import { describe, it, expect } from 'vitest';
import { compareChars, netWpm, grossWpm, accuracy, typingStats } from './typing.lib';

describe('compareChars', () => {
  it('counts correct and incorrect against the target', () => {
    expect(compareChars('hello', 'hallo')).toEqual({ correct: 4, incorrect: 1 });
  });
  it('counts characters typed past the target end as incorrect', () => {
    expect(compareChars('hi', 'hix')).toEqual({ correct: 2, incorrect: 1 });
  });
  it('empty input is all zero', () => {
    expect(compareChars('hello', '')).toEqual({ correct: 0, incorrect: 0 });
  });
});

describe('wpm', () => {
  it('net WPM uses correct chars / 5 per minute', () => {
    expect(netWpm(25, 60000)).toBe(5);
    expect(netWpm(250, 60000)).toBe(50);
  });
  it('gross WPM uses all typed chars', () => {
    expect(grossWpm(300, 60000)).toBe(60);
  });
  it('is zero when no time has elapsed', () => {
    expect(netWpm(25, 0)).toBe(0);
  });
});

describe('accuracy', () => {
  it('is a rounded percentage of correct over total', () => {
    expect(accuracy(45, 50)).toBe(90);
  });
  it('is 100 when nothing has been typed', () => {
    expect(accuracy(0, 0)).toBe(100);
  });
});

describe('typingStats', () => {
  it('integrates comparison, wpm and accuracy', () => {
    const s = typingStats('hello world', 'hello world', 60000);
    expect(s.correctChars).toBe(11);
    expect(s.incorrectChars).toBe(0);
    expect(s.accuracy).toBe(100);
    expect(s.wpm).toBe(Math.round((11 / 5)));
  });
});

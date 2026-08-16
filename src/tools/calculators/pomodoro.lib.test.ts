import { describe, it, expect } from 'vitest';
import { formatClock, phaseDuration, nextPhase, type PomodoroConfig } from './pomodoro.lib';

const CFG: PomodoroConfig = { workMin: 25, shortMin: 5, longMin: 15, rounds: 4 };

describe('formatClock', () => {
  it('formats MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(65)).toBe('01:05');
    expect(formatClock(1500)).toBe('25:00');
  });
  it('adds hours when needed', () => {
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3661)).toBe('1:01:01');
  });
  it('clamps negatives to zero', () => {
    expect(formatClock(-10)).toBe('00:00');
  });
});

describe('phaseDuration', () => {
  it('returns seconds for each phase', () => {
    expect(phaseDuration('work', CFG)).toBe(1500);
    expect(phaseDuration('short', CFG)).toBe(300);
    expect(phaseDuration('long', CFG)).toBe(900);
  });
});

describe('nextPhase', () => {
  it('work → short break, incrementing completed work', () => {
    expect(nextPhase('work', 0, CFG)).toEqual({ phase: 'short', completedWork: 1 });
  });
  it('every Nth work → long break', () => {
    expect(nextPhase('work', 3, CFG)).toEqual({ phase: 'long', completedWork: 4 });
  });
  it('short break → work, completed unchanged', () => {
    expect(nextPhase('short', 2, CFG)).toEqual({ phase: 'work', completedWork: 2 });
  });
  it('long break → work, completed unchanged', () => {
    expect(nextPhase('long', 4, CFG)).toEqual({ phase: 'work', completedWork: 4 });
  });
});

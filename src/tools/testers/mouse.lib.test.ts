import { describe, it, expect } from 'vitest';
import { buttonName, distance, isDoubleClick, scrollDirection } from './mouse.lib';

describe('mouse', () => {
  it('names buttons', () => {
    expect(buttonName(0)).toBe('Left');
    expect(buttonName(1)).toBe('Middle');
    expect(buttonName(2)).toBe('Right');
    expect(buttonName(9)).toBe('Button 9');
  });

  it('computes distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('detects a clean double-click', () => {
    expect(isDoubleClick(0, 200, { x: 10, y: 10 }, { x: 12, y: 11 })).toBe(true);
  });

  it('rejects clicks too far apart in time', () => {
    expect(isDoubleClick(0, 900, { x: 10, y: 10 }, { x: 10, y: 10 })).toBe(false);
  });

  it('rejects clicks that drift too far (dying mouse)', () => {
    expect(isDoubleClick(0, 100, { x: 10, y: 10 }, { x: 40, y: 40 })).toBe(false);
  });

  it('reads scroll direction', () => {
    expect(scrollDirection(-3)).toBe(-1);
    expect(scrollDirection(3)).toBe(1);
    expect(scrollDirection(0)).toBe(0);
  });
});

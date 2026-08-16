import { describe, it, expect } from 'vitest';
import { parseGedcom, displayName } from './gedcom.lib';

const SAMPLE = `0 HEAD
1 SOUR Test
0 @I1@ INDI
1 NAME John /Smith/
1 SEX M
1 BIRT
2 DATE 1 JAN 1900
2 PLAC London
1 DEAT
2 DATE 1970
1 FAMS @F1@
0 @I2@ INDI
1 NAME Mary /Jones/
1 SEX F
0 @I3@ INDI
1 NAME Baby /Smith/
0 @F1@ FAM
1 HUSB @I1@
1 WIFE @I2@
1 CHIL @I3@
0 TRLR`;

describe('parseGedcom', () => {
  it('extracts individuals with name, sex and events', () => {
    const g = parseGedcom(SAMPLE);
    expect(g.individuals.size).toBe(3);
    const i1 = g.individuals.get('@I1@')!;
    expect(displayName(i1)).toBe('John Smith');
    expect(i1.sex).toBe('M');
    expect(i1.birth?.date).toBe('1 JAN 1900');
    expect(i1.birth?.place).toBe('London');
    expect(i1.death?.date).toBe('1970');
  });

  it('extracts families with husband, wife and children', () => {
    const g = parseGedcom(SAMPLE);
    const f1 = g.families.get('@F1@')!;
    expect(f1.husband).toBe('@I1@');
    expect(f1.wife).toBe('@I2@');
    expect(f1.children).toEqual(['@I3@']);
  });

  it('handles empty input', () => {
    const g = parseGedcom('');
    expect(g.individuals.size).toBe(0);
    expect(g.families.size).toBe(0);
  });
});

describe('displayName', () => {
  it('strips the surname slashes', () => {
    expect(displayName({ id: 'x', name: 'Anna /Van Dam/', sex: '' })).toBe('Anna Van Dam');
  });
  it('falls back to the id-less placeholder when no name', () => {
    expect(displayName({ id: '@I9@', name: '', sex: '' })).toBe('(unknown)');
  });
});

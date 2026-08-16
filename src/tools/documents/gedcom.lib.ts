/**
 * Pure GEDCOM (family-tree) parser. GEDCOM is a line-based format:
 * `LEVEL [@XREF@] TAG [VALUE]`. We extract INDI (individual) and FAM (family)
 * records — enough to render a readable tree. No I/O.
 */

export interface GedEvent { date?: string; place?: string; }

export interface Individual {
  id: string;
  name: string;
  sex: string;
  birth?: GedEvent;
  death?: GedEvent;
}

export interface Family {
  id: string;
  husband?: string;
  wife?: string;
  children: string[];
}

export interface Gedcom {
  individuals: Map<string, Individual>;
  families: Map<string, Family>;
}

interface Line { level: number; xref?: string; tag: string; value: string; }

function parseLine(raw: string): Line | null {
  const m = /^\s*(\d+)\s+(@[^@]+@\s+)?(\S+)(?:\s(.*))?$/.exec(raw);
  if (!m) return null;
  return {
    level: Number(m[1]),
    xref: m[2] ? m[2].trim() : undefined,
    tag: m[3],
    value: (m[4] ?? '').trim(),
  };
}

export function parseGedcom(text: string): Gedcom {
  const individuals = new Map<string, Individual>();
  const families = new Map<string, Family>();
  const lines = text.split(/\r?\n/).map(parseLine).filter((l): l is Line => l !== null);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.level !== 0 || !line.xref) { i++; continue; }

    // Collect this record's child lines (level > 0 until the next level-0 line).
    const start = i + 1;
    let end = start;
    while (end < lines.length && lines[end].level > 0) end++;
    const body = lines.slice(start, end);

    if (line.tag === 'INDI') {
      const indi: Individual = { id: line.xref, name: '', sex: '' };
      let event: 'birth' | 'death' | null = null;
      for (const b of body) {
        if (b.level === 1) {
          event = null;
          if (b.tag === 'NAME') indi.name = b.value;
          else if (b.tag === 'SEX') indi.sex = b.value;
          else if (b.tag === 'BIRT') { indi.birth = {}; event = 'birth'; }
          else if (b.tag === 'DEAT') { indi.death = {}; event = 'death'; }
        } else if (b.level === 2 && event) {
          const target = event === 'birth' ? indi.birth! : indi.death!;
          if (b.tag === 'DATE') target.date = b.value;
          else if (b.tag === 'PLAC') target.place = b.value;
        }
      }
      individuals.set(indi.id, indi);
    } else if (line.tag === 'FAM') {
      const fam: Family = { id: line.xref, children: [] };
      for (const b of body) {
        if (b.level !== 1) continue;
        if (b.tag === 'HUSB') fam.husband = b.value;
        else if (b.tag === 'WIFE') fam.wife = b.value;
        else if (b.tag === 'CHIL') fam.children.push(b.value);
      }
      families.set(fam.id, fam);
    }
    i = end;
  }

  return { individuals, families };
}

/** Human-readable name: drop the GEDCOM surname slashes; placeholder if empty. */
export function displayName(indi: Pick<Individual, 'id' | 'name' | 'sex'>): string {
  const clean = indi.name.replace(/\//g, '').replace(/\s+/g, ' ').trim();
  return clean || '(unknown)';
}

import { useMemo, useState } from 'react';
import { Dropzone } from '@/components/ui/Dropzone';
import { Alert } from '@/components/ui/Alert';
import { parseGedcom, displayName, type Gedcom, type Individual } from '@/tools/documents/gedcom.lib';
import type { Lang } from '@/i18n/config';

const TR: Record<Lang, Record<string, string>> = {
  en: {
    intro: 'Open a GEDCOM family-tree file (.ged) and browse it privately. Search people, and click anyone to see their parents, spouse and children. Your file is read in your browser and never uploaded.',
    drop: 'Drop a .ged file or click to browse', dropSub: 'Opened on your device',
    failed: 'Could not read this GEDCOM file.', search: 'Search people…', people: 'people',
    born: 'Born', died: 'Died', parents: 'Parents', spouse: 'Spouse', children: 'Children', none: 'No records found.',
  },
  id: {
    intro: 'Buka berkas silsilah keluarga GEDCOM (.ged) dan telusuri secara privat. Cari orang, dan klik siapa pun untuk melihat orang tua, pasangan, dan anak. Berkas Anda dibaca di browser dan tidak pernah diunggah.',
    drop: 'Letakkan berkas .ged atau klik untuk memilih', dropSub: 'Dibuka di perangkat Anda',
    failed: 'Tidak dapat membaca berkas GEDCOM ini.', search: 'Cari orang…', people: 'orang',
    born: 'Lahir', died: 'Wafat', parents: 'Orang tua', spouse: 'Pasangan', children: 'Anak', none: 'Tidak ada data.',
  },
};

export default function GedcomViewer({ lang = 'en' }: { lang?: Lang }) {
  const t = TR[lang] ?? TR.en;
  const [ged, setGed] = useState<Gedcom | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const onDrop = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError('');
    try {
      const text = await f.text();
      const g = parseGedcom(text);
      setGed(g);
      setSelected(g.individuals.keys().next().value ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
    }
  };

  const list = useMemo(() => {
    if (!ged) return [];
    const q = query.trim().toLowerCase();
    return [...ged.individuals.values()]
      .filter(i => !q || displayName(i).toLowerCase().includes(q))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [ged, query]);

  const person = selected && ged ? ged.individuals.get(selected) : null;

  const relations = useMemo(() => {
    if (!ged || !person) return null;
    const parents: Individual[] = [];
    const spouses: Individual[] = [];
    const children: Individual[] = [];
    for (const fam of ged.families.values()) {
      if (fam.husband === person.id || fam.wife === person.id) {
        const other = fam.husband === person.id ? fam.wife : fam.husband;
        if (other && ged.individuals.has(other)) spouses.push(ged.individuals.get(other)!);
        for (const c of fam.children) if (ged.individuals.has(c)) children.push(ged.individuals.get(c)!);
      }
      if (fam.children.includes(person.id)) {
        for (const p of [fam.husband, fam.wife]) if (p && ged.individuals.has(p)) parents.push(ged.individuals.get(p)!);
      }
    }
    return { parents, spouses, children };
  }, [ged, person]);

  const chip = (i: Individual) => (
    <button key={i.id} onClick={() => setSelected(i.id)}
      className="border-2 border-border px-2 py-1 text-sm hover:shadow-brutal">{displayName(i)}</button>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t.intro}</p>

      {!ged && (
        <Dropzone onDrop={onDrop} accept=".ged,text/plain" multiple={false}>
          <div className="space-y-1">
            <p className="text-lg font-bold">{t.drop}</p>
            <p className="text-sm text-muted-foreground">{t.dropSub}</p>
          </div>
        </Dropzone>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {ged && (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t.search}
              className="w-full border-2 border-border bg-muted p-2 text-sm" />
            <div className="text-xs text-muted-foreground">{list.length} {t.people}</div>
            <div className="max-h-[60vh] divide-y-2 divide-border overflow-auto border-2 border-border">
              {list.map(i => (
                <button key={i.id} onClick={() => setSelected(i.id)} aria-pressed={selected === i.id}
                  className={`block w-full px-3 py-2 text-left text-sm ${selected === i.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'}`}>
                  <span className="font-semibold">{displayName(i)}</span>
                  {i.birth?.date && <span className="text-xs text-muted-foreground"> · {i.birth.date}</span>}
                </button>
              ))}
              {list.length === 0 && <div className="p-3 text-sm text-muted-foreground">{t.none}</div>}
            </div>
          </div>

          {person && relations && (
            <div className="space-y-4">
              <div className="border-2 border-border p-4 shadow-brutal">
                <div className="text-2xl font-black">{displayName(person)}</div>
                <div className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                  {person.birth && <div>{t.born}: {person.birth.date}{person.birth.place ? `, ${person.birth.place}` : ''}</div>}
                  {person.death && <div>{t.died}: {person.death.date}{person.death.place ? `, ${person.death.place}` : ''}</div>}
                </div>
              </div>
              {relations.parents.length > 0 && (
                <div><div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.parents}</div>
                  <div className="flex flex-wrap gap-2">{relations.parents.map(chip)}</div></div>
              )}
              {relations.spouses.length > 0 && (
                <div><div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.spouse}</div>
                  <div className="flex flex-wrap gap-2">{relations.spouses.map(chip)}</div></div>
              )}
              {relations.children.length > 0 && (
                <div><div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t.children}</div>
                  <div className="flex flex-wrap gap-2">{relations.children.map(chip)}</div></div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Pure vCard ⇄ CSV conversion for a contacts subset. */

export interface Contact {
  name: string;
  email: string;
  phone: string;
  org: string;
  title: string;
  url: string;
}

export const CONTACT_FIELDS: (keyof Contact)[] = ['name', 'email', 'phone', 'org', 'title', 'url'];

function emptyContact(): Contact {
  return { name: '', email: '', phone: '', org: '', title: '', url: '' };
}

/** Parse one-or-more VCARD blocks into contacts. */
export function parseVcards(vcf: string): Contact[] {
  const out: Contact[] = [];
  const blocks = vcf.split(/BEGIN:VCARD/i).slice(1);
  for (const block of blocks) {
    const body = block.split(/END:VCARD/i)[0];
    const c = emptyContact();
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.trim();
      const idx = line.indexOf(':');
      if (idx < 0) continue;
      const base = line.slice(0, idx).toUpperCase().split(';')[0];
      const val = line.slice(idx + 1).trim();
      if (base === 'FN') c.name = val;
      else if (base === 'N' && !c.name) c.name = val.split(';').filter(Boolean).reverse().join(' ');
      else if (base === 'EMAIL' && !c.email) c.email = val;
      else if (base === 'TEL' && !c.phone) c.phone = val;
      else if (base === 'ORG' && !c.org) c.org = val.replace(/;/g, ' ').trim();
      else if (base === 'TITLE') c.title = val;
      else if (base === 'URL') c.url = val;
    }
    if (CONTACT_FIELDS.some(f => c[f])) out.push(c);
  }
  return out;
}

/** Serialize contacts as vCard 3.0. */
export function buildVcards(contacts: Contact[]): string {
  return contacts.map(c => {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    if (c.name) { lines.push(`FN:${c.name}`); lines.push(`N:${c.name};;;;`); }
    if (c.org) lines.push(`ORG:${c.org}`);
    if (c.title) lines.push(`TITLE:${c.title}`);
    if (c.phone) lines.push(`TEL:${c.phone}`);
    if (c.email) lines.push(`EMAIL:${c.email}`);
    if (c.url) lines.push(`URL:${c.url}`);
    lines.push('END:VCARD');
    return lines.join('\n');
  }).join('\n');
}

const escapeCsv = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Contacts → CSV with a fixed header row. */
export function contactsToCsv(contacts: Contact[]): string {
  const header = CONTACT_FIELDS.join(',');
  const rows = contacts.map(c => CONTACT_FIELDS.map(f => escapeCsv(c[f])).join(','));
  return [header, ...rows].join('\n');
}

/** Minimal RFC-4180 CSV row parser (handles quotes, escaped quotes, newlines). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(c => c !== ''));
}

/** CSV → contacts, mapping columns by the header names. */
export function csvToContacts(csv: string): Contact[] {
  const rows = parseCsv(csv);
  if (rows.length === 0) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(r => {
    const c = emptyContact();
    header.forEach((h, i) => {
      const key = CONTACT_FIELDS.find(f => f === h);
      if (key) c[key] = (r[i] ?? '').trim();
    });
    return c;
  }).filter(c => CONTACT_FIELDS.some(f => c[f]));
}

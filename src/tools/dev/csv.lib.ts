/** Parse delimited text (RFC 4180 quoting) into rows of fields. */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      field = '';
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.length > 1 || r[0] !== '');
}

export function csvToJson(text: string, delimiter = ','): string {
  const rows = parseCsv(text, delimiter);
  if (rows.length === 0) return '[]';
  const [header, ...body] = rows;
  const records = body.map(cells => {
    const record: Record<string, string> = {};
    header.forEach((key, index) => {
      record[key] = cells[index] ?? '';
    });
    return record;
  });
  return JSON.stringify(records, null, 2);
}

/** A field needs quoting if it contains a quote, newline, or the delimiter. */
function escapeCsvField(value: unknown, delimiter: string): string {
  const str = value == null ? '' : String(value);
  const needsQuote =
    str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(delimiter);
  return needsQuote ? `"${str.replace(/"/g, '""')}"` : str;
}

export function jsonToCsv(text: string, delimiter = ','): string {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) throw new Error('JSON must be an array of objects');
  if (data.length === 0) return '';

  const headers = Array.from(
    data.reduce((set: Set<string>, item) => {
      Object.keys(item ?? {}).forEach(key => set.add(key));
      return set;
    }, new Set<string>())
  );

  const lines = [headers.map(h => escapeCsvField(h, delimiter)).join(delimiter)];
  for (const item of data) {
    lines.push(headers.map(key => escapeCsvField(item?.[key], delimiter)).join(delimiter));
  }
  return lines.join('\n');
}

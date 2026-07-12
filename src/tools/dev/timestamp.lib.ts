export interface Parsed {
  unixSeconds: number;
  unixMillis: number;
  iso: string;
  utc: string;
  local: string;
}

export function describeDate(date: Date): Parsed {
  return {
    unixSeconds: Math.floor(date.getTime() / 1000),
    unixMillis: date.getTime(),
    iso: date.toISOString(),
    utc: date.toUTCString(),
    local: date.toString(),
  };
}

export function parseTimestamp(input: string): Date | null {
  const trimmed = input.trim();
  let date: Date;
  if (/^\d+$/.test(trimmed)) {
    // Numeric: treat 10-digit as seconds, 13-digit as milliseconds.
    const num = Number(trimmed);
    date = new Date(trimmed.length <= 10 ? num * 1000 : num);
  } else {
    date = new Date(trimmed);
  }

  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

import { parse, stringify } from 'smol-toml';

/** Convert a JSON string to TOML. TOML's top level must be a table (object). */
export function jsonToToml(input: string): string {
  const data = JSON.parse(input);
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('TOML requires a top-level object (table). Wrap arrays or values in an object first.');
  }
  return stringify(data).trimEnd();
}

/** Convert a TOML string to pretty JSON. */
export function tomlToJson(input: string): string {
  const data = parse(input);
  return JSON.stringify(data, null, 2);
}

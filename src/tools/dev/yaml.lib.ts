import { parse, stringify } from 'yaml';

/** Convert a JSON string to YAML. */
export function jsonToYaml(input: string): string {
  const data = JSON.parse(input);
  return stringify(data).trimEnd();
}

/** Convert a YAML string to pretty JSON. */
export function yamlToJson(input: string): string {
  const data = parse(input);
  return JSON.stringify(data, null, 2);
}

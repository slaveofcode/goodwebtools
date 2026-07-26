import { XMLParser, XMLBuilder } from 'fast-xml-parser';

const builder = new XMLBuilder({
  format: true,
  indentBy: '  ',
  ignoreAttributes: false,
  suppressEmptyNode: true,
});

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

/**
 * Convert a JSON string to XML. XML needs a single root element, so:
 * single-key objects are used as-is; arrays are wrapped as <root><item>…;
 * everything else is wrapped in <root>.
 */
export function jsonToXml(input: string): string {
  const data = JSON.parse(input);
  const isPlainObject = data !== null && typeof data === 'object' && !Array.isArray(data);
  let toBuild: unknown;
  if (isPlainObject && Object.keys(data).length === 1) {
    toBuild = data;
  } else if (Array.isArray(data)) {
    toBuild = { root: { item: data } };
  } else {
    toBuild = { root: data };
  }
  return (builder.build(toBuild) as string).trimEnd();
}

/** Convert an XML string to pretty JSON. */
export function xmlToJson(input: string): string {
  const data = parser.parse(input);
  return JSON.stringify(data, null, 2);
}

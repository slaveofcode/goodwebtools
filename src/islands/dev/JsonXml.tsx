import { BiConverter } from '@/components/dev/BiConverter';
import { jsonToXml, xmlToJson } from '@/tools/dev/xml.lib';

export default function JsonXml() {
  return (
    <BiConverter
      leftLabel="JSON"
      rightLabel="XML"
      toRight={jsonToXml}
      toLeft={xmlToJson}
      placeholder={'{\n  "person": {\n    "name": "Alice",\n    "age": 30\n  }\n}'}
    />
  );
}

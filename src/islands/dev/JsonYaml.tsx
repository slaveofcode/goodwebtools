import { BiConverter } from '@/components/dev/BiConverter';
import { jsonToYaml, yamlToJson } from '@/tools/dev/yaml.lib';

export default function JsonYaml() {
  return (
    <BiConverter
      leftLabel="JSON"
      rightLabel="YAML"
      toRight={jsonToYaml}
      toLeft={yamlToJson}
      placeholder={'{\n  "name": "Alice",\n  "age": 30,\n  "tags": ["a", "b"]\n}'}
    />
  );
}

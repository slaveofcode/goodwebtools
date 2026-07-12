import { BiConverter } from '@/components/dev/BiConverter';
import { jsonToToml, tomlToJson } from '@/tools/dev/toml.lib';

export default function JsonToml() {
  return (
    <BiConverter
      leftLabel="JSON"
      rightLabel="TOML"
      toRight={jsonToToml}
      toLeft={tomlToJson}
      placeholder={'{\n  "title": "demo",\n  "count": 3,\n  "tags": ["a", "b"]\n}'}
      fileAccept=".json,.toml,application/json,application/toml,text/plain"
      rightExts={['toml']}
    />
  );
}

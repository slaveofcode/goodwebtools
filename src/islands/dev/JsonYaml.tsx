import { BiConverter } from '@/components/dev/BiConverter';
import { jsonToYaml, yamlToJson } from '@/tools/dev/yaml.lib';
import type { Lang } from '@/i18n/config';

export default function JsonYaml({ lang = 'en' }: { lang?: Lang }) {
  return (
    <BiConverter
      lang={lang}
      leftLabel="JSON"
      rightLabel="YAML"
      toRight={jsonToYaml}
      toLeft={yamlToJson}
      placeholder={'{\n  "name": "Alice",\n  "age": 30,\n  "tags": ["a", "b"]\n}'}
      fileAccept=".json,.yaml,.yml,application/json,text/yaml,application/x-yaml,text/plain"
      rightExts={['yaml', 'yml']}
      rightLang="yaml"
    />
  );
}

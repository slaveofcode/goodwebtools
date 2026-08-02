import { BiConverter } from '@/components/dev/BiConverter';
import { jsonToToml, tomlToJson } from '@/tools/dev/toml.lib';
import type { Lang } from '@/i18n/config';

export default function JsonToml({ lang = 'en' }: { lang?: Lang }) {
  return (
    <BiConverter
      lang={lang}
      leftLabel="JSON"
      rightLabel="TOML"
      toRight={jsonToToml}
      toLeft={tomlToJson}
      placeholder={'{\n  "title": "demo",\n  "count": 3,\n  "tags": ["a", "b"]\n}'}
      fileAccept=".json,.toml,application/json,application/toml,text/plain"
      rightExts={['toml']}
      rightLang="ini"
    />
  );
}

import { BiConverter } from '@/components/dev/BiConverter';
import { jsonToXml, xmlToJson } from '@/tools/dev/xml.lib';
import type { Lang } from '@/i18n/config';

export default function JsonXml({ lang = 'en' }: { lang?: Lang }) {
  return (
    <BiConverter
      lang={lang}
      leftLabel="JSON"
      rightLabel="XML"
      toRight={jsonToXml}
      toLeft={xmlToJson}
      placeholder={'{\n  "person": {\n    "name": "Alice",\n    "age": 30\n  }\n}'}
      fileAccept=".json,.xml,application/json,text/xml,application/xml,text/plain"
      rightExts={['xml']}
      rightLang="xml"
    />
  );
}

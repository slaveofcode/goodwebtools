import DataViewer from './DataViewer';
import type { Lang } from '@/i18n/config';

export default function TomlViewer({ lang = 'en' }: { lang?: Lang }) {
  return <DataViewer lang={lang} initialFormat="toml" />;
}

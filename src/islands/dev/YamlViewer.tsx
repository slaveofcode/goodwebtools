import DataViewer from './DataViewer';
import type { Lang } from '@/i18n/config';

export default function YamlViewer({ lang = 'en' }: { lang?: Lang }) {
  return <DataViewer lang={lang} initialFormat="yaml" />;
}

/**
 * Code beautifier backed by Prettier's standalone build. Prettier and its
 * language plugins are dynamic-imported (and per-language) so they stay out of
 * the island's initial chunk and only load when actually used.
 */

export type BeautifyLang = 'js' | 'ts' | 'css' | 'scss' | 'html' | 'json' | 'markdown' | 'yaml';

export const BEAUTIFY_LANGS: { id: BeautifyLang; label: string }[] = [
  { id: 'js', label: 'JavaScript' },
  { id: 'ts', label: 'TypeScript' },
  { id: 'css', label: 'CSS' },
  { id: 'scss', label: 'SCSS' },
  { id: 'html', label: 'HTML' },
  { id: 'json', label: 'JSON' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'yaml', label: 'YAML' },
];

const PARSER: Record<BeautifyLang, string> = {
  js: 'babel', ts: 'typescript', css: 'css', scss: 'scss',
  html: 'html', json: 'json', markdown: 'markdown', yaml: 'yaml',
};

// Prettier v3 plugins are passed as their whole module namespace.
async function loadPlugins(lang: BeautifyLang): Promise<unknown[]> {
  const babel = () => import('prettier/plugins/babel');
  const estree = () => import('prettier/plugins/estree');
  const postcss = () => import('prettier/plugins/postcss');
  const html = () => import('prettier/plugins/html');
  const typescript = () => import('prettier/plugins/typescript');
  const markdown = () => import('prettier/plugins/markdown');
  const yaml = () => import('prettier/plugins/yaml');

  switch (lang) {
    case 'js':
    case 'json':
      return [await babel(), await estree()];
    case 'ts':
      return [await typescript(), await estree(), await babel()];
    case 'css':
    case 'scss':
      return [await postcss()];
    case 'html':
      return [await html(), await babel(), await estree(), await postcss()];
    case 'markdown':
      return [await markdown()];
    case 'yaml':
      return [await yaml()];
  }
}

/** Format `code` for the given language. Throws on unparseable input. */
export async function beautify(code: string, lang: BeautifyLang): Promise<string> {
  const prettier = await import('prettier/standalone');
  const plugins = await loadPlugins(lang);
  return prettier.format(code, { parser: PARSER[lang], plugins, tabWidth: 2, semi: true });
}

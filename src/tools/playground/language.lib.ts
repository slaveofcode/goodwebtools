const MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  mjs: 'javascript', cjs: 'javascript',
  json: 'json', jsonc: 'json',
  html: 'html', htm: 'html',
  css: 'css', scss: 'scss', less: 'less',
  md: 'markdown', markdown: 'markdown',
  sql: 'sql',
  py: 'python',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', hpp: 'cpp',
  cs: 'csharp',
  rb: 'ruby',
  php: 'php',
  sh: 'shell', bash: 'shell', zsh: 'shell',
  yaml: 'yaml', yml: 'yaml',
  xml: 'xml',
  toml: 'ini', ini: 'ini',
  txt: 'plaintext',
};

/** Monaco language id for a filename, by its extension. Unknown → 'plaintext'. */
export function extensionToLanguage(filename: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop()! : '';
  return MAP[ext.toLowerCase()] ?? 'plaintext';
}

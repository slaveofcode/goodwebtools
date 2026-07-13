import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

let done = false;

/** One-time, idempotent Monaco setup: self-hosted workers + Neo-Brutalism themes. */
export function setupMonaco(): void {
  if (done) return;
  done = true;

  // Self-host workers (no CDN) so the no-external-requests promise holds.
  (self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
      if (label === 'json') return new jsonWorker();
      if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
      if (label === 'typescript' || label === 'javascript') return new tsWorker();
      return new editorWorker();
    },
  };

  monaco.editor.defineTheme('gwt-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#faf7f0',
      'editor.foreground': '#0a0a0a',
      'editorLineNumber.foreground': '#9b9689',
      'editor.selectionBackground': '#c4b5fd',
      'editorCursor.foreground': '#7c3aed',
    },
  });
  monaco.editor.defineTheme('gwt-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0a0a0a',
      'editor.foreground': '#faf7f0',
      'editorCursor.foreground': '#a78bfa',
    },
  });
}

export function isDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
}

export { monaco };

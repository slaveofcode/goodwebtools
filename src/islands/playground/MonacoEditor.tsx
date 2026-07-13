import { useEffect, useRef } from 'react';
import type * as Monaco from 'monaco-editor';

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  onMount?: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
  readOnly?: boolean;
  options?: Monaco.editor.IStandaloneEditorConstructionOptions;
  height?: string;
}

export default function MonacoEditor({
  value, language, onChange, onMount, readOnly, options, height = '60vh',
}: MonacoEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Create the editor once. Monaco is imported dynamically so this island stays
  // SSR-safe (it renders via client:load, which also runs on the server build).
  useEffect(() => {
    let disposed = false;
    let sub: Monaco.IDisposable | undefined;
    let observer: MutationObserver | undefined;
    void (async () => {
      const { monaco, setupMonaco, isDark } = await import('./monaco-setup');
      if (disposed || !hostRef.current) return;
      monacoRef.current = monaco;
      setupMonaco();
      const editor = monaco.editor.create(hostRef.current, {
        value,
        language,
        readOnly,
        theme: isDark() ? 'gwt-dark' : 'gwt-light',
        automaticLayout: true,
        minimap: { enabled: true },
        fontSize: 13,
        scrollBeyondLastLine: false,
        ...options,
      });
      editorRef.current = editor;
      sub = editor.onDidChangeModelContent(() => onChangeRef.current?.(editor.getValue()));
      onMount?.(editor);

      observer = new MutationObserver(() =>
        monaco.editor.setTheme(isDark() ? 'gwt-dark' : 'gwt-light')
      );
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    })();

    return () => {
      disposed = true;
      sub?.dispose();
      observer?.disconnect();
      editorRef.current?.dispose();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push external value changes into the editor without moving the cursor.
  useEffect(() => {
    const editor = editorRef.current;
    if (editor && value !== editor.getValue()) editor.setValue(value);
  }, [value]);

  // Update language when the active file/tab changes.
  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (model && monacoRef.current) monacoRef.current.editor.setModelLanguage(model, language);
  }, [language]);

  return <div ref={hostRef} className="w-full border-2 border-border" style={{ height }} />;
}

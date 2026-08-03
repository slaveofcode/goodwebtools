import { useEffect, useRef } from 'react';
import type * as Monaco from 'monaco-editor';
import { editorKeybindings } from '@/tools/playground/editor-actions.lib';

interface MonacoEditorProps {
  value: string;
  language: string;
  onChange?: (value: string) => void;
  onMount?: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
  /** Cmd/Ctrl+S inside the editor (falls back to VS Code-style save). */
  onSave?: () => void;
  /** Cmd/Ctrl+O inside the editor. */
  onOpen?: () => void;
  readOnly?: boolean;
  options?: Monaco.editor.IStandaloneEditorConstructionOptions;
  height?: string;
}

export default function MonacoEditor({
  value, language, onChange, onMount, onSave, onOpen, readOnly, options, height = '60vh',
}: MonacoEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  // Latest value/language, so the async editor creation uses whatever the props
  // are by the time Monaco finishes loading (props can change during the await).
  const valueRef = useRef(value);
  valueRef.current = value;
  const languageRef = useRef(language);
  languageRef.current = language;

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
        value: valueRef.current,
        language: languageRef.current,
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

      // Re-assert the VS Code multi-cursor binding AND surface it in the
      // right-click menu, so "select all occurrences" stays reachable even when
      // the browser or an extension swallows Cmd/Ctrl+Shift+L. Also wire the
      // VS Code-style Save / Open shortcuts to the host's file handlers.
      const kb = editorKeybindings(monaco);
      editor.addAction({
        id: 'gwt.selectAllOccurrences',
        label: 'Select All Occurrences',
        keybindings: [kb.selectAllOccurrences],
        contextMenuGroupId: '9_cutcopypaste',
        contextMenuOrder: 1.5,
        run: (ed) => { void ed.getAction('editor.action.selectHighlights')?.run(); },
      });
      if (onSaveRef.current) {
        editor.addCommand(kb.save, () => onSaveRef.current?.());
      }
      if (onOpenRef.current) {
        editor.addCommand(kb.open, () => onOpenRef.current?.());
      }

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

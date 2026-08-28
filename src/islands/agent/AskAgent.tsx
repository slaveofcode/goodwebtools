import { useRef, useState } from 'react';
import { useAgentChat } from '@/hooks/useAgentChat';
import {
  hasWebGPU, CLOUD_PRESETS, ONDEVICE_MODELS,
  createCloudProvider, createOnDeviceProvider, deleteModelCache,
  type AgentProvider, type OnDeviceProvider,
} from '@/services/agent/provider';

const TR = {
  en: {
    h1: 'Ask Agent',
    intro: 'Tell the agent what you want — it runs the right tools in your browser. On-device (private) or your own API key.',
    hint: 'Try: "encode base64 of hello", "make a qr for my site", "compress this image to 100kb", or just say hi.',
  },
  id: {
    h1: 'Tanya Agen',
    intro: 'Beritahu agen apa yang Anda mau — ia menjalankan tool yang tepat di browser Anda. On-device (privat) atau dengan API key Anda sendiri.',
    hint: 'Coba: "encode base64 dari hello", "buat qr untuk situs saya", "kompres gambar ini ke 100kb", atau cukup sapa saja.',
  },
} as const;

export default function AskAgent({ lang = 'en' }: { lang?: 'en' | 'id' }) {
  const tr = TR[lang] ?? TR.en;
  const [source, setSource] = useState<'ondevice' | 'cloud'>('ondevice');
  const [ondeviceModel, setOndeviceModel] = useState(ONDEVICE_MODELS[0].id);
  const [cloudPreset, setCloudPreset] = useState('openai');
  const [cloudModel, setCloudModel] = useState(CLOUD_PRESETS.openai.model);
  const [useProxy, setUseProxy] = useState(!!CLOUD_PRESETS.openai.proxied);
  const [apiKey, setApiKey] = useState(() => (typeof localStorage !== 'undefined' ? localStorage.getItem('gwt-agent-key') || '' : ''));
  const [provider, setProvider] = useState<AgentProvider | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [input, setInput] = useState('');
  const ondeviceRef = useRef<OnDeviceProvider | null>(null);

  const { turns, busy, pendingFile, pendingInput, send, provideFile, cancelFile, provideInput, cancelInput } = useAgentChat(provider);
  const [inputValue, setInputValue] = useState('');

  const loadOndevice = async () => {
    setLoading(true); setProgressText('');
    try {
      const p = await createOnDeviceProvider(ondeviceModel, (pr, text) => { setProgress(pr); setProgressText(text); });
      ondeviceRef.current = p;
      setProvider(p);
    } catch (e) {
      setProgressText('Load failed: ' + (e as Error).message);
    } finally { setLoading(false); }
  };

  const deleteModel = async () => {
    setLoading(true); setProgressText('');
    try {
      await ondeviceRef.current?.unload();
      ondeviceRef.current = null; setProvider(null);
      await deleteModelCache(ondeviceModel);
      setProgressText('Deleted the cached model — storage freed.');
    } catch (e) {
      setProgressText('Delete failed: ' + (e as Error).message);
    } finally { setLoading(false); }
  };

  const redownload = async () => {
    try { await ondeviceRef.current?.unload(); ondeviceRef.current = null; setProvider(null); await deleteModelCache(ondeviceModel); }
    catch { /* best-effort; fresh load follows */ }
    await loadOndevice();
  };

  const useCloud = () => {
    if (!apiKey.trim()) { setProgressText('Enter an API key.'); return; }
    localStorage.setItem('gwt-agent-key', apiKey);
    const p = CLOUD_PRESETS[cloudPreset];
    setProvider(createCloudProvider({ kind: p.kind, baseUrl: p.baseUrl, model: cloudModel, apiKey, proxy: useProxy }));
    setProgressText('');
  };

  const loaded = provider !== null;
  const inputCls = 'border-2 border-border bg-muted px-2 py-1.5 text-sm';

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-black uppercase tracking-tight">{tr.h1}</h1>
        <p className="text-sm text-muted-foreground">{tr.intro}</p>
      </header>

      <div className="space-y-3 border-2 border-border bg-muted p-4">
        <div className="flex gap-1 text-sm">
          {(['ondevice', 'cloud'] as const).map(s => (
            <button key={s} onClick={() => { setSource(s); setProvider(null); }} aria-pressed={source === s}
              className={`border-2 px-3 py-1 font-bold uppercase ${source === s ? 'border-border bg-accent text-accent-foreground' : 'border-border'}`}>
              {s === 'ondevice' ? 'On-device' : 'Cloud (API key)'}
            </button>
          ))}
        </div>

        {source === 'ondevice' ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={ondeviceModel} onChange={e => { setOndeviceModel(e.target.value); setProvider(null); }} className={inputCls}>
              {ONDEVICE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
            <button onClick={loadOndevice} disabled={loading} className="border-2 border-border bg-accent px-3 py-1.5 text-sm font-bold uppercase text-accent-foreground press-brutal disabled:opacity-50">
              {loaded ? 'Reload' : loading ? 'Loading…' : 'Load model'}
            </button>
            <button onClick={redownload} disabled={loading} title="Delete cached weights and download fresh" className="border-2 border-border bg-muted px-3 py-1.5 text-sm font-bold uppercase press-brutal disabled:opacity-50">Redownload</button>
            <button onClick={deleteModel} disabled={loading} title="Delete the cached model to free storage" className="border-2 border-border bg-rose-200 px-3 py-1.5 text-sm font-bold uppercase text-black press-brutal disabled:opacity-50 dark:bg-rose-900/40 dark:text-white">Delete cache</button>
            {loading && <span className="font-mono text-xs text-muted-foreground">{Math.round(progress * 100)}% {progressText}</span>}
            {!loading && progressText && <span className="font-mono text-xs text-red-600">{progressText}</span>}
            {!hasWebGPU() && <span className="text-xs text-amber-700 dark:text-amber-400">Your browser has no WebGPU — use Cloud (API key), or the ⌘K search.</span>}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {useProxy
                ? '⚠ This provider blocks direct browser calls, so the request is routed through GoodWebTools’ edge (your key + conversation are forwarded to the provider, never stored). On-device keeps everything fully private.'
                : '⚠ Cloud mode sends your conversation to the provider using your key (direct from your browser, no GoodWebTools server). On-device keeps everything private.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={cloudPreset} onChange={e => { const k = e.target.value; setCloudPreset(k); setCloudModel(CLOUD_PRESETS[k].model); setUseProxy(!!CLOUD_PRESETS[k].proxied); setProvider(null); }} className={inputCls}>
                {Object.entries(CLOUD_PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <input value={cloudModel} onChange={e => setCloudModel(e.target.value)} placeholder="model" className={`${inputCls} w-48`} />
              <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="API key" className={`${inputCls} w-56`} />
              <button onClick={useCloud} className="border-2 border-border bg-accent px-3 py-1.5 text-sm font-bold uppercase text-accent-foreground press-brutal">Use</button>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={useProxy} onChange={e => { setUseProxy(e.target.checked); setProvider(null); }} className="h-3.5 w-3.5" />
              Route through GoodWebTools (needed for providers that block direct browser calls, e.g. OpenCode)
            </label>
            {progressText && <span className="font-mono text-xs text-red-600">{progressText}</span>}
          </div>
        )}
      </div>

      {loaded && (
        <>
          <div className="min-h-[200px] space-y-2 border-2 border-border bg-muted p-3">
            {turns.length === 0 && <p className="text-sm text-muted-foreground">{tr.hint}</p>}
            {turns.map((t, i) => (
              <div key={i} className={t.role === 'user' ? 'text-right' : ''}>
                <span className={`inline-block max-w-[90%] border-2 border-border px-3 py-2 text-left text-sm ${t.role === 'user' ? 'bg-background' : 'bg-accent/20'}`}>
                  <span className="whitespace-pre-wrap break-words font-mono">{t.text}</span>
                  {t.imgUrl && <img src={t.imgUrl} alt="" className="mt-2 max-h-64 max-w-full border-2 border-border bg-white object-contain" />}
                  {(t.blobUrl || t.imgUrl) && (
                    <a href={t.blobUrl || t.imgUrl} download={t.filename || 'download'} className="ml-2 inline-block border-2 border-border bg-accent px-2 py-0.5 text-xs font-bold uppercase text-accent-foreground">Download</a>
                  )}
                  {t.href && <a href={t.href} className="ml-2 inline-block border-2 border-border bg-accent px-2 py-0.5 text-xs font-bold uppercase text-accent-foreground">Open</a>}
                </span>
              </div>
            ))}
            {busy && !pendingFile && <p className="text-sm text-muted-foreground">thinking…</p>}
            {pendingFile && (
              <div className="border-2 border-dashed border-accent p-4 text-center">
                <p className="mb-2 text-sm font-bold">The agent needs a file: {pendingFile.label}</p>
                <input type="file" onChange={e => { const f = e.target.files?.[0]; if (f) provideFile(f); }} className="text-sm" />
                <button onClick={cancelFile} className="ml-2 border-2 border-border bg-muted px-2 py-0.5 text-xs font-bold uppercase press-brutal">Cancel</button>
              </div>
            )}
            {pendingInput && (
              <div className="border-2 border-dashed border-accent p-4">
                <p className="mb-2 text-sm font-bold">{pendingInput.label}</p>
                <div className="flex gap-2">
                  <input autoFocus value={inputValue}
                    onChange={e => setInputValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && inputValue.trim()) { provideInput(inputValue.trim()); setInputValue(''); } }}
                    placeholder={pendingInput.label} className="flex-1 border-2 border-border bg-background px-2 py-1.5 text-sm outline-none" />
                  <button onClick={() => { if (inputValue.trim()) { provideInput(inputValue.trim()); setInputValue(''); } }} className="border-2 border-border bg-accent px-3 py-1.5 text-xs font-bold uppercase text-accent-foreground press-brutal">OK</button>
                  <button onClick={() => { cancelInput(); setInputValue(''); }} className="border-2 border-border bg-muted px-2 py-1.5 text-xs font-bold uppercase press-brutal">Cancel</button>
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { send(input); setInput(''); } }}
              placeholder="Tell the agent what you want…" className="flex-1 border-2 border-border bg-muted p-3 outline-none focus:shadow-brutal-sm" />
            <button onClick={() => { send(input); setInput(''); }} disabled={busy || !input.trim()} className="border-2 border-border bg-accent px-4 font-bold uppercase text-accent-foreground press-brutal disabled:opacity-50">Send</button>
          </div>
        </>
      )}
    </div>
  );
}

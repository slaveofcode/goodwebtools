import { useRef, useState } from 'react';
import { classifyIntent } from '@/tools/agent/intent';
import { executorFor, AGENT_EXECUTORS } from '@/tools/agent/executors';
import { buildSystemPrompt, parseAction, recoverContentAction, type LoopTool } from '@/tools/agent/loop.lib';
import { emptySession, recordUser, applyResolution, historyForPrompt } from '@/tools/agent/session.lib';
import { prefillUrl, extractParams } from '@/tools/agent/router.lib';
import { buildToolChoicePrompt, parseToolChoice } from '@/tools/agent/select.lib';
import { getToolById } from '@/registry/tools';
import type { AgentProvider, ChatMessage, ToolSpec, ToolMsg } from '@/services/agent/provider';

export interface ChatUiTurn {
  role: 'user' | 'assistant';
  text: string;
  blobUrl?: string;
  imgUrl?: string;
  filename?: string;
  href?: string;
}

const CHAT_SYSTEM = [
  "You are GoodWebTools' assistant. GoodWebTools is a free site with 190+ privacy-first tools that run entirely in the browser (image/PDF/video/audio editing, converters, dev utilities, and more).",
  'Reply in 1–2 short, friendly sentences.',
  "NEVER recommend external or competitor websites, apps, or software (e.g. Photoshop, Canva, iLoveIMG, Photopea) — and don't give generic OS/phone instructions. If the user wants to DO something, assume GoodWebTools has a tool for it and offer to open it (tell them to just ask, e.g. \"want me to crop it?\").",
  'If you are unsure whether a tool exists, say you can look for one rather than sending them elsewhere.',
].join(' ');

/**
 * Guess a content value from the user's message for a tool arg a weak model left
 * empty — e.g. "format this json: {ac:1}" → "{ac:1}", or a quoted string. Falls
 * back to the router's residual-text extraction. So a small model that calls the
 * right tool but forgets the arg doesn't re-ask for content already in the message.
 */
function guessContent(q: string): string {
  // Content after the FIRST ':' (a colon inside the value, e.g. JSON, must not
  // split it) — "format json: {a:1}" → "{a:1}".
  const colon = q.indexOf(':');
  if (colon >= 0) { const after = q.slice(colon + 1).trim(); if (after) return after; }
  const quoted = q.match(/["'`]([^"'`]{2,})["'`]/);
  if (quoted) return quoted[1];
  const residual = extractParams(q).text;
  return residual ? residual.trim() : '';
}

/**
 * Orchestrates one agent conversation over any `AgentProvider`:
 * intent gate (chat / open / task) → runtime-scoped agentic loop → session.
 * The runtime, not the model, decides scope, so a tiny model can't mis-pick.
 */
export function useAgentChat(provider: AgentProvider | null) {
  const [turns, setTurns] = useState<ChatUiTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ label: string } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<{ label: string } | null>(null);
  const [pendingInput, setPendingInput] = useState<{ label: string } | null>(null);
  const sessionRef = useRef(emptySession());
  const fileResolver = useRef<((f: File) => void) | null>(null);
  const fileRejecter = useRef<((e: Error) => void) | null>(null);
  const filesResolver = useRef<((f: File[]) => void) | null>(null);
  const filesRejecter = useRef<((e: Error) => void) | null>(null);
  const inputResolver = useRef<((v: string) => void) | null>(null);
  const inputRejecter = useRef<((e: Error) => void) | null>(null);
  // Files the user already uploaded this session, keyed by file-slot. Reused on a
  // follow-up ("make it 50kb") so the agent doesn't re-ask for the same image.
  const lastFilesRef = useRef<Record<string, File>>({});
  // Files attached to the current message (via the paperclip) — consumed by tools
  // that need a file before falling back to a dropzone prompt.
  const attachedRef = useRef<File[]>([]);

  const push = (t: ChatUiTurn) => setTurns(x => [...x, t]);
  // Rewrite the most recent turn's text — used to animate a running executor's
  // progress on its "→ tool" line (no other turn is pushed while it runs).
  const updateLastText = (text: string) => setTurns(x => {
    if (!x.length) return x;
    const copy = x.slice();
    copy[copy.length - 1] = { ...copy[copy.length - 1], text };
    return copy;
  });

  const requestFile = (label: string): Promise<File> => {
    setPendingFile({ label });
    return new Promise((res, rej) => { fileResolver.current = res; fileRejecter.current = rej; });
  };
  const clearFileWaiters = () => { setPendingFile(null); fileResolver.current = null; fileRejecter.current = null; };
  const provideFile = (f: File) => { const r = fileResolver.current; clearFileWaiters(); r?.(f); };
  /** Abandon a pending file request (user chose not to upload). Unwinds the loop. */
  const cancelFile = () => { const r = fileRejecter.current; clearFileWaiters(); r?.(new Error('__cancelled__')); };

  // Variable-count file request (e.g. "merge these PDFs").
  const requestFiles = (label: string): Promise<File[]> => {
    setPendingFiles({ label });
    return new Promise((res, rej) => { filesResolver.current = res; filesRejecter.current = rej; });
  };
  const clearFilesWaiters = () => { setPendingFiles(null); filesResolver.current = null; filesRejecter.current = null; };
  const provideFiles = (fs: File[]) => { const r = filesResolver.current; clearFilesWaiters(); r?.(fs); };
  const cancelFiles = () => { const r = filesRejecter.current; clearFilesWaiters(); r?.(new Error('__cancelled__')); };

  // Ask the user for a required text value the model couldn't fill (e.g. what a
  // QR should encode) — the text equivalent of requestFile.
  const requestInput = (label: string): Promise<string> => {
    setPendingInput({ label });
    return new Promise((res, rej) => { inputResolver.current = res; inputRejecter.current = rej; });
  };
  const clearInputWaiters = () => { setPendingInput(null); inputResolver.current = null; inputRejecter.current = null; };
  const provideInput = (v: string) => { const r = inputResolver.current; clearInputWaiters(); r?.(v); };
  const cancelInput = () => { const r = inputRejecter.current; clearInputWaiters(); r?.(new Error('__cancelled__')); };

  const send = async (text: string, attached: File[] = []) => {
    const q = text.trim();
    if (!q || !provider || busy) return;
    attachedRef.current = [...attached];
    push({ role: 'user', text: q + (attached.length ? ` 📎 ${attached.map(f => f.name).join(', ')}` : '') });
    sessionRef.current = recordUser(sessionRef.current, q);
    setBusy(true);
    try {
      const intent = classifyIntent(q, sessionRef.current.activeToolId);

      if (intent.mode === 'chat') {
        const history = historyForPrompt(sessionRef.current, 6).map(t => ({ role: t.role, content: t.text }));
        const reply = await provider.chat([{ role: 'system', content: CHAT_SYSTEM }, ...history]);
        const clean = reply.trim() || 'Hi! How can I help — compress an image, make a QR code, hash or encode some text?';
        push({ role: 'assistant', text: clean });
        sessionRef.current = applyResolution(sessionRef.current, { toolId: null, params: {}, reply: clean });
        return;
      }

      if (intent.mode === 'open') {
        const cands = intent.candidates;
        let chosen = cands[0];
        // A clear top match opens directly (instant, no model call). When a 2nd
        // candidate is nearly as strong, the router is unsure — let the model
        // pick within the shortlist (it can only choose an id we offered).
        const ambiguous = cands.length > 1 && cands[1].confidence >= 0.6;
        if (ambiguous) {
          const choices = cands.map(c => ({ id: c.id, name: c.name, summary: getToolById(c.id)?.summary ?? '', category: c.category }));
          const raw = await provider.chat([{ role: 'system', content: buildToolChoicePrompt(choices) }, { role: 'user', content: q }]);
          const pick = parseToolChoice(raw, cands.map(c => c.id));
          if (pick === 'none') {
            const msg = "I'm not sure which tool fits — could you say a bit more about what you'd like to do?";
            push({ role: 'assistant', text: msg });
            sessionRef.current = applyResolution(sessionRef.current, { toolId: null, params: {}, reply: msg });
            return;
          }
          if (pick) chosen = cands.find(c => c.id === pick) ?? chosen;
        }
        push({ role: 'assistant', text: `Opening ${chosen.name} for you.`, href: prefillUrl(chosen.route, intent.params) });
        sessionRef.current = applyResolution(sessionRef.current, { toolId: chosen.id, params: {}, reply: `Opening ${chosen.name}` });
        return;
      }

      // TASK mode. A capable cloud model gets the FULL tool catalog so it can plan
      // and CHAIN tools (the output of one feeds the next) like an MCP toolset; a
      // tiny on-device model gets only the keyword-scoped subset so it can't mis-pick.
      const capable = provider.capable === true;
      const offered = capable ? AGENT_EXECUTORS : intent.executors;
      const offeredIds = offered.map(e => e.toolId);
      // Files available to this task: seeded from a prior turn on a continuation.
      const loopFiles: Record<string, File> = intent.continued ? { ...lastFilesRef.current } : {};
      let chainFile: File | null = null; // last tool OUTPUT, piped into the next tool
      let produced = false;
      const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

      // Run ONE executor call: collect files (chaining/upload) + required params
      // (asking the user for hallucinated/empty ones), execute, show the result,
      // and pipe its output. Shared by both the native and prompt loops.
      const runExecutor = async (exec: (typeof AGENT_EXECUTORS)[number], argsIn: Record<string, string | number>): Promise<{ ok: boolean; resultText: string; cancelled?: boolean }> => {
        push({ role: 'assistant', text: `→ ${exec.toolId}` });
        const files: Record<string, File> = {};
        for (const fs of exec.files) {
          const piped = chainFile; // prefer the previous tool's output (chaining)
          const cached = piped ?? loopFiles[fs.key];
          let f: File;
          if (cached) { f = cached; }
          else if (attachedRef.current.length) { f = attachedRef.current.shift()!; } // use an attached file
          else {
            try { f = await requestFile(fs.label); }
            catch { updateLastText(`✗ ${exec.toolId} — cancelled`); return { ok: false, resultText: 'cancelled', cancelled: true }; }
          }
          files[fs.key] = f;
          if (!piped) { loopFiles[fs.key] = f; lastFilesRef.current[fs.key] = f; } // remember only real uploads
        }
        let fileList: File[] | undefined;
        if (exec.multiFile) {
          if (attachedRef.current.length) { fileList = attachedRef.current.splice(0); } // use attached files
          else {
            try { fileList = await requestFiles(exec.multiFile.label); }
            catch { updateLastText(`✗ ${exec.toolId} — cancelled`); return { ok: false, resultText: 'cancelled', cancelled: true }; }
          }
        }
        const params: Record<string, string | number> = { ...argsIn };
        const singleContentParam = exec.params.filter(p => p.default === undefined).length === 1;
        for (const ps of exec.params) {
          if (ps.default !== undefined) continue;
          const raw = params[ps.key] == null ? '' : String(params[ps.key]).trim();
          const echoed = raw !== '' && (raw.toLowerCase() === q.trim().toLowerCase() || (wordCount(raw) <= 3 && exec.match(raw)));
          if (raw === '' || raw.toUpperCase() === 'UPLOAD' || echoed) {
            // For a single-content tool, recover the value from the message before
            // asking — a weak model often calls the right tool but omits the arg.
            const guess = singleContentParam ? guessContent(q) : '';
            if (guess && guess.toLowerCase() !== q.trim().toLowerCase() && !(wordCount(guess) <= 3 && exec.match(guess))) {
              params[ps.key] = guess;
            } else {
              try { params[ps.key] = await requestInput(ps.label); }
              catch { updateLastText(`✗ ${exec.toolId} — cancelled`); return { ok: false, resultText: 'cancelled', cancelled: true }; }
            }
          }
        }
        try {
          const result = await exec.execute({ files, params, fileList }, p => updateLastText(`→ ${exec.toolId} — ${Math.round(p * 100)}%`));
          const blobUrl = result.blob ? URL.createObjectURL(result.blob) : undefined;
          push({ role: 'assistant', text: `✓ ${exec.toolId}: ${result.text ?? 'produced a file'}`, blobUrl, imgUrl: result.dataUrl, filename: result.filename });
          if (result.blob) chainFile = new File([result.blob], result.filename ?? 'output', { type: result.blob.type });
          sessionRef.current = applyResolution(sessionRef.current, { toolId: exec.toolId, params, reply: result.text ?? 'done' });
          produced = true;
          return { ok: true, resultText: result.text ? result.text.slice(0, 400) : 'produced a file for the user' };
        } catch (e) {
          push({ role: 'assistant', text: `✗ ${exec.toolId} error: ${(e as Error).message}` });
          return { ok: false, resultText: `error: ${(e as Error).message}` };
        }
      };

      // --- Native function-calling loop (cloud): the provider's real tools API ---
      const chatTools = provider.chatTools;
      if (chatTools) {
        const tools: ToolSpec[] = offered.map(e => ({
          name: e.toolId,
          description: e.description,
          parameters: {
            type: 'object',
            properties: {
              ...Object.fromEntries(e.files.map(f => [f.key, { type: 'string', description: `${f.label} — pass the string "UPLOAD" and the app will ask the user for the file` }])),
              ...(e.multiFile ? { [e.multiFile.key]: { type: 'string', description: `${e.multiFile.label} — pass "UPLOAD"; the app will let the user pick several files` } } : {}),
              ...Object.fromEntries(e.params.map(p => [p.key, { type: p.type === 'number' ? 'number' : 'string', description: p.label }])),
            },
            required: [...e.files.map(f => f.key), ...(e.multiFile ? [e.multiFile.key] : []), ...e.params.filter(p => p.default === undefined).map(p => p.key)],
          },
        }));
        const sys = "You are GoodWebTools' agent. Use the tools to fulfil the user's request. You can call several tools in sequence — each tool's output file automatically becomes the next tool's input, so you can chain them. For a file argument pass the string \"UPLOAD\". When the task is done, reply with a short final message and no tool call.";
        const msgs: ToolMsg[] = [{ role: 'system', content: sys }, { role: 'user', content: q }];
        const done = new Set<string>();
        for (let iter = 0; iter < 8; iter++) {
          const turn = await chatTools(msgs, tools);
          if (!turn.calls.length) {
            const r = turn.text || (produced ? 'Done.' : 'Okay.');
            push({ role: 'assistant', text: r });
            sessionRef.current = applyResolution(sessionRef.current, { toolId: null, params: {}, reply: r });
            break;
          }
          msgs.push({ role: 'assistant', content: turn.text, toolCalls: turn.calls });
          let stop = false;
          for (const call of turn.calls) {
            const exec = executorFor(call.name);
            if (!exec) { msgs.push({ role: 'tool', toolCallId: call.id, content: `unknown tool ${call.name}` }); continue; }
            const key = call.name + JSON.stringify(call.args);
            if (done.has(key)) { msgs.push({ role: 'tool', toolCallId: call.id, content: 'already done — reply with a final message' }); continue; }
            const res = await runExecutor(exec, call.args);
            if (res.cancelled) { stop = true; break; }
            done.add(key);
            msgs.push({ role: 'tool', toolCallId: call.id, content: res.resultText });
          }
          if (stop) break;
          if (iter === 7) push({ role: 'assistant', text: produced ? 'Done — anything else?' : "I couldn't finish that." });
        }
        return;
      }

      // --- Prompt-based loop (on-device / no tools API): JSON action protocol ---
      const loopTools: LoopTool[] = offered.map(e => ({
        name: e.toolId,
        description: e.description,
        args: [
          ...e.files.map(f => ({ name: f.key, type: 'file' as const, required: true })),
          ...e.params.map(p => ({ name: p.key, type: p.type, required: p.default === undefined })),
        ],
      }));
      const convo: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(loopTools) }, { role: 'user', content: q }];
      const doneKeys = new Set<string>();
      const ranTools = new Set<string>(); // weak models re-run a tool on its own output (base64→base64→…) — cap at one run per tool
      for (let iter = 0; iter < 8; iter++) {
        const raw = await provider.chat(convo);
        const act = parseAction(raw) ?? recoverContentAction(raw, offeredIds);
        if (!act) { push({ role: 'assistant', text: produced ? 'Done — anything else?' : "I didn't quite catch that. Could you rephrase what you'd like to do?" }); break; }
        if (act.action === 'final') {
          const r = act.text || (produced ? 'Done.' : '(done)');
          push({ role: 'assistant', text: r });
          sessionRef.current = applyResolution(sessionRef.current, { toolId: null, params: {}, reply: r });
          break;
        }
        const key = act.tool + JSON.stringify(act.args);
        if (doneKeys.has(key)) { push({ role: 'assistant', text: 'Done — anything else?' }); break; }
        const exec = executorFor(act.tool);
        if (!exec) { convo.push({ role: 'assistant', content: raw }, { role: 'user', content: `TOOL_ERROR: unknown tool ${act.tool}` }); continue; }
        if (ranTools.has(exec.toolId)) { push({ role: 'assistant', text: 'Done — anything else?' }); break; }
        const res = await runExecutor(exec, act.args);
        if (res.cancelled) break;
        if (res.ok) ranTools.add(exec.toolId);
        doneKeys.add(key);
        convo.push({ role: 'assistant', content: raw }, { role: 'user', content: `TOOL_RESULT ${exec.toolId}: ${res.resultText}. Respond with a "final" action now unless the user asked for more.` });
        if (iter === 7) push({ role: 'assistant', text: produced ? 'Done — anything else?' : "I couldn't finish that — try rephrasing, or a bigger model." });
      }
    } catch (e) {
      push({ role: 'assistant', text: 'Error: ' + (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return { turns, busy, pendingFile, pendingFiles, pendingInput, send, provideFile, cancelFile, provideFiles, cancelFiles, provideInput, cancelInput };
}

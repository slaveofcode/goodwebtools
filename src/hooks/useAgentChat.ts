import { useRef, useState } from 'react';
import { classifyIntent } from '@/tools/agent/intent';
import { executorFor } from '@/tools/agent/executors';
import { buildSystemPrompt, parseAction, type LoopTool } from '@/tools/agent/loop.lib';
import { emptySession, recordUser, applyResolution, historyForPrompt } from '@/tools/agent/session.lib';
import { prefillUrl } from '@/tools/agent/router.lib';
import { buildToolChoicePrompt, parseToolChoice } from '@/tools/agent/select.lib';
import { getToolById } from '@/registry/tools';
import type { AgentProvider, ChatMessage } from '@/services/agent/provider';

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
 * Orchestrates one agent conversation over any `AgentProvider`:
 * intent gate (chat / open / task) → runtime-scoped agentic loop → session.
 * The runtime, not the model, decides scope, so a tiny model can't mis-pick.
 */
export function useAgentChat(provider: AgentProvider | null) {
  const [turns, setTurns] = useState<ChatUiTurn[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ label: string } | null>(null);
  const [pendingInput, setPendingInput] = useState<{ label: string } | null>(null);
  const sessionRef = useRef(emptySession());
  const fileResolver = useRef<((f: File) => void) | null>(null);
  const fileRejecter = useRef<((e: Error) => void) | null>(null);
  const inputResolver = useRef<((v: string) => void) | null>(null);
  const inputRejecter = useRef<((e: Error) => void) | null>(null);
  // Files the user already uploaded this session, keyed by file-slot. Reused on a
  // follow-up ("make it 50kb") so the agent doesn't re-ask for the same image.
  const lastFilesRef = useRef<Record<string, File>>({});

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

  // Ask the user for a required text value the model couldn't fill (e.g. what a
  // QR should encode) — the text equivalent of requestFile.
  const requestInput = (label: string): Promise<string> => {
    setPendingInput({ label });
    return new Promise((res, rej) => { inputResolver.current = res; inputRejecter.current = rej; });
  };
  const clearInputWaiters = () => { setPendingInput(null); inputResolver.current = null; inputRejecter.current = null; };
  const provideInput = (v: string) => { const r = inputResolver.current; clearInputWaiters(); r?.(v); };
  const cancelInput = () => { const r = inputRejecter.current; clearInputWaiters(); r?.(new Error('__cancelled__')); };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || !provider || busy) return;
    push({ role: 'user', text: q });
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

      // TASK mode: the model may only call the scoped executors.
      const loopTools: LoopTool[] = intent.executors.map(e => ({
        name: e.toolId,
        description: e.description,
        args: [
          ...e.files.map(f => ({ name: f.key, type: 'file' as const, required: true })),
          ...e.params.map(p => ({ name: p.key, type: p.type, required: p.default === undefined })),
        ],
      }));
      const convo: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(loopTools) }, { role: 'user', content: q }];
      // Files available to this task: seeded from a prior turn on a continuation,
      // and accumulated within the loop so a repeated call never re-prompts.
      const loopFiles: Record<string, File> = intent.continued ? { ...lastFilesRef.current } : {};
      const doneKeys = new Set<string>();
      let produced = false;
      for (let iter = 0; iter < 8; iter++) {
        const raw = await provider.chat(convo);
        const act = parseAction(raw);
        if (!act) {
          // Unparseable turn (small models emit junk). If we already handed the
          // user a result, just close out cleanly — never dump raw JSON to chat.
          push({ role: 'assistant', text: produced ? 'Done — anything else?' : "I didn't quite catch that. Could you rephrase what you'd like to do?" });
          break;
        }
        if (act.action === 'final') {
          const r = act.text || (produced ? 'Done.' : '(done)');
          push({ role: 'assistant', text: r });
          sessionRef.current = applyResolution(sessionRef.current, { toolId: null, params: {}, reply: r });
          break;
        }

        const key = act.tool + JSON.stringify(act.args);
        if (doneKeys.has(key)) {
          // Model re-issued a call it already completed — the result is already
          // shown. Stop instead of re-running (or re-prompting for the file).
          push({ role: 'assistant', text: 'Done — anything else?' });
          break;
        }

        const exec = executorFor(act.tool);
        if (!exec) {
          convo.push({ role: 'assistant', content: raw }, { role: 'user', content: `TOOL_ERROR: unknown tool ${act.tool}` });
          continue;
        }
        push({ role: 'assistant', text: `→ ${exec.toolId}` });

        const files: Record<string, File> = {};
        let cancelled = false;
        for (const fs of exec.files) {
          // Reuse a file already provided this task (or carried from the previous
          // turn on a continuation) instead of prompting again.
          const cached = loopFiles[fs.key];
          try {
            const f = cached ?? await requestFile(fs.label);
            files[fs.key] = f;
            loopFiles[fs.key] = f;
            lastFilesRef.current[fs.key] = f;
          } catch {
            cancelled = true; // user dismissed the file request
            break;
          }
        }
        if (cancelled) { updateLastText(`✗ ${exec.toolId} — cancelled`); break; }

        // Fill any required text param the model left empty — OR hallucinated —
        // by asking the user. A tiny model often echoes the command itself as the
        // value ("QR" → a QR of the word "QR"); treat as missing when the value is
        // empty, equals the whole query, or is a short phrase that itself triggers
        // this same tool (a command word, not content).
        const params: Record<string, string | number> = { ...act.args };
        const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
        for (const ps of exec.params) {
          if (ps.default !== undefined) continue; // optional / has a default
          const raw = params[ps.key] == null ? '' : String(params[ps.key]).trim();
          const echoed = raw !== '' && (raw.toLowerCase() === q.trim().toLowerCase() || (wordCount(raw) <= 3 && exec.match(raw)));
          if (raw === '' || raw.toUpperCase() === 'UPLOAD' || echoed) {
            try { params[ps.key] = await requestInput(ps.label); }
            catch { cancelled = true; break; }
          }
        }
        if (cancelled) { updateLastText(`✗ ${exec.toolId} — cancelled`); break; }

        try {
          const result = await exec.execute({ files, params }, p => {
            updateLastText(`→ ${exec.toolId} — ${Math.round(p * 100)}%`);
          });
          const blobUrl = result.blob ? URL.createObjectURL(result.blob) : undefined;
          push({ role: 'assistant', text: `✓ ${exec.toolId}: ${result.text ?? 'produced a file'}`, blobUrl, imgUrl: result.dataUrl, filename: result.filename });
          sessionRef.current = applyResolution(sessionRef.current, { toolId: exec.toolId, params, reply: result.text ?? 'done' });
          doneKeys.add(key);
          produced = true;
          convo.push({ role: 'assistant', content: raw }, { role: 'user', content: `TOOL_RESULT ${exec.toolId}: ${result.text ? result.text.slice(0, 400) : 'produced a file for the user'}. Respond with a "final" action now unless the user asked for more.` });
        } catch (e) {
          push({ role: 'assistant', text: `✗ ${exec.toolId} error: ${(e as Error).message}` });
          convo.push({ role: 'assistant', content: raw }, { role: 'user', content: `TOOL_ERROR ${exec.toolId}: ${(e as Error).message}` });
        }
        // Ran out of iterations mid-task: close out rather than leave it hanging.
        if (iter === 7) push({ role: 'assistant', text: produced ? 'Done — anything else?' : "I couldn't finish that — try rephrasing, or a bigger model." });
      }
    } catch (e) {
      push({ role: 'assistant', text: 'Error: ' + (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return { turns, busy, pendingFile, pendingInput, send, provideFile, cancelFile, provideInput, cancelInput };
}

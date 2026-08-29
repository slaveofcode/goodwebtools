import type { AgentProvider, ChatMessage, ToolMsg, ToolSpec, ToolTurn } from './provider';

export type ScriptStep =
  | { chat: string }
  | { calls: { name: string; args: Record<string, unknown> }[]; text?: string }
  | { text: string; calls?: undefined };

/**
 * A deterministic, dev/test-only AgentProvider that replays a fixed script.
 * `chat` steps feed the prompt loop / chat-mode; `calls`/`text` steps feed the
 * native tools loop. Once the script is exhausted, chatTools returns an empty
 * final turn and chat returns '' so the agent loop terminates cleanly.
 */
export function createScriptedProvider(steps: ScriptStep[], opts: { capable?: boolean } = {}): AgentProvider {
  let i = 0;
  let callSeq = 0;
  return {
    capable: opts.capable,
    async chat(_messages: ChatMessage[]): Promise<string> {
      const step = steps[i++];
      if (step && 'chat' in step) return step.chat;
      if (step && 'text' in step && typeof step.text === 'string') return step.text;
      return '';
    },
    async chatTools(_messages: ToolMsg[], _tools: ToolSpec[]): Promise<ToolTurn> {
      const step = steps[i++];
      if (step && 'calls' in step && step.calls) {
        return {
          text: step.text ?? '',
          calls: step.calls.map(c => ({
            id: `e2e-${++callSeq}`,
            name: c.name,
            args: c.args as Record<string, string | number>,
          })),
        };
      }
      if (step && 'text' in step && typeof step.text === 'string') return { text: step.text, calls: [] };
      return { text: '', calls: [] };
    },
  };
}

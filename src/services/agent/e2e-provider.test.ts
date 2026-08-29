import { describe, it, expect } from 'vitest';
import { createScriptedProvider } from './e2e-provider';

describe('createScriptedProvider', () => {
  it('replays chatTools steps in order, then ends with an empty final turn', async () => {
    const p = createScriptedProvider(
      [{ calls: [{ name: 'base64', args: { text: 'hi' } }] }],
      { capable: true },
    );
    expect(p.capable).toBe(true);
    const t1 = await p.chatTools!([], []);
    expect(t1.calls.map(c => c.name)).toEqual(['base64']);
    expect(t1.calls[0].id).toBeTruthy();            // an id is generated
    const t2 = await p.chatTools!([], []);           // steps exhausted
    expect(t2.calls).toEqual([]);                    // -> final, loop can stop
  });

  it('replays chat() steps as raw strings', async () => {
    const p = createScriptedProvider([{ chat: 'Hello there!' }], { capable: false });
    expect(p.capable).toBe(false);
    expect(await p.chat([])).toBe('Hello there!');
    expect(await p.chat([])).toBe('');               // exhausted -> empty
  });

  it('supports a final text-only tools turn', async () => {
    const p = createScriptedProvider([{ text: 'done', calls: [] }], { capable: true });
    const t = await p.chatTools!([], []);
    expect(t).toEqual({ text: 'done', calls: [] });
  });
});

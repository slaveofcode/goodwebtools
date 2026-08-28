import { describe, it, expect } from 'vitest';
import { emptySession, recordUser, applyResolution, historyForPrompt } from './session.lib';

describe('session reducer', () => {
  it('records a user turn', () => {
    const s = recordUser(emptySession(), 'compress my video');
    expect(s.turns).toEqual([{ role: 'user', text: 'compress my video' }]);
  });
  it('sets the active tool and accumulates params on the same tool', () => {
    let s = applyResolution(emptySession(), { toolId: 'video-compress', params: { size: '8MB' }, reply: 'ok' });
    expect(s.activeToolId).toBe('video-compress');
    s = applyResolution(s, { toolId: 'video-compress', params: { size: '5MB' }, reply: 'smaller' });
    expect(s.activeParams).toEqual({ size: '5MB' });
    expect(s.turns.at(-1)).toEqual({ role: 'assistant', text: 'smaller', toolId: 'video-compress' });
  });
  it('resets params when the tool switches', () => {
    let s = applyResolution(emptySession(), { toolId: 'video-compress', params: { size: '8MB' }, reply: 'a' });
    s = applyResolution(s, { toolId: 'qr-gen', params: { text: 'hi' }, reply: 'b' });
    expect(s.activeToolId).toBe('qr-gen');
    expect(s.activeParams).toEqual({ text: 'hi' });
  });
  it('windows history to the last N turns', () => {
    let s = emptySession();
    for (let i = 0; i < 5; i++) s = recordUser(s, `m${i}`);
    expect(historyForPrompt(s, 2).map(t => t.text)).toEqual(['m3', 'm4']);
  });
});

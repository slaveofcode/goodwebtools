import { describe, it, expect } from 'vitest';
import { classifyIntent } from './intent';

describe('classifyIntent', () => {
  it('chats when the router finds no tool', () => {
    expect(classifyIntent('hi there how are you').mode).toBe('chat');
  });
  it('tasks when an executor matches', () => {
    const i = classifyIntent('make a qr for hello');
    expect(i.mode).toBe('task');
    if (i.mode === 'task') expect(i.executors.map(e => e.toolId)).toContain('qr-gen');
  });
  it('opens a tool page when the router matches but no executor exists', () => {
    const i = classifyIntent('open a whiteboard to draw');
    expect(i.mode).toBe('open');
    if (i.mode === 'open') {
      expect(i.candidates.length).toBeGreaterThan(0);
      expect(i.candidates[0].route).toMatch(/^\/tools\//);
    }
  });

  it('chats about the agent itself instead of routing to a tool', () => {
    for (const q of [
      'what model are you', 'what models are u?', 'which model r you',
      'who are you', 'who r u', 'what can you do', 'what can u do',
      'are you an ai', 'are u chatgpt', 'whats your name',
    ]) {
      expect(classifyIntent(q).mode, q).toBe('chat');
    }
  });
  it('opens the image crop tool for "how to crop image" (not the media trimmer)', () => {
    const i = classifyIntent('how to crop image');
    expect(i.mode).toBe('open');
    if (i.mode === 'open') expect(i.candidates[0].id).toBe('image-crop');
  });
  it('continues the active executor on a param-only follow-up ("50kb")', () => {
    // No "image" word → would otherwise mis-route to pdf-compress. With an active
    // image-compress task, a size tweak stays on it.
    const i = classifyIntent('i want compressed to 50kb, possible?', 'image-compress');
    expect(i.mode).toBe('task');
    if (i.mode === 'task') {
      expect(i.executors.map(e => e.toolId)).toEqual(['image-compress']);
      expect(i.continued).toBe(true);
    }
  });

  it('does NOT continue when the follow-up scopes to a different tool', () => {
    const i = classifyIntent('make a qr for hello', 'image-compress');
    expect(i.mode).toBe('task');
    if (i.mode === 'task') {
      expect(i.executors.map(e => e.toolId)).toContain('qr-gen');
      expect(i.continued).toBeFalsy();
    }
  });

  it('does NOT continue small talk even with an active tool', () => {
    expect(classifyIntent('thanks, that is great', 'image-compress').mode).toBe('chat');
  });

  it('ignores active context when there is no continuation signal', () => {
    // No number/size/tweak phrase → normal routing, not a forced continuation.
    const i = classifyIntent('open a whiteboard to draw', 'image-compress');
    expect(i.mode).toBe('open');
  });
});

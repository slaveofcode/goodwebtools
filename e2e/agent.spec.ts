import path from 'node:path';
import { test, expect } from '@playwright/test';
import { installAgent, send } from './helpers';

test('chat mode: small talk gets a reply, no tool runs', async ({ page }) => {
  await installAgent(page, { steps: [{ chat: 'Hi! How can I help?' }], capable: false });
  await send(page, 'hello there');
  await expect(page.getByTestId('agent-messages')).toContainText('Hi! How can I help?');
  await expect(page.getByTestId('agent-messages')).not.toContainText('→ ');
});

test('runs base64 and shows the result line', async ({ page }) => {
  await installAgent(page, {
    steps: [{ calls: [{ name: 'base64', args: { text: 'hi' } }] }, { text: 'Done.' }],
    capable: true,
  });
  await send(page, 'base64 encode this');
  await expect(page.getByTestId('agent-messages')).toContainText('✓ base64:');
  await expect(page.getByTestId('agent-messages')).toContainText('aGk='); // base64("hi")
});

test('formats JSON via a scripted tool call', async ({ page }) => {
  await installAgent(page, {
    steps: [{ calls: [{ name: 'json-format', args: { text: '{"a":1}' } }] }, { text: 'Done.' }],
    capable: true,
  });
  await send(page, 'format this json');
  await expect(page.getByTestId('agent-messages')).toContainText('✓ json-format:');
});

// Weak-model deterministic path: a single scoped tool runs WITHOUT the model
// emitting JSON (the 0.5B "didn't quite catch that" fix). capable:false, and the
// script's chat is intentionally never consumed because the shortcut bypasses it.
test('single-candidate shortcut runs the tool with no model JSON', async ({ page }) => {
  await installAgent(page, { steps: [{ chat: 'garbage that would not parse' }], capable: false });
  await send(page, 'terbilang 1500000');
  await expect(page.getByTestId('agent-messages')).toContainText('✓ terbilang:');
  await expect(page.getByTestId('agent-messages')).not.toContainText('quite catch');
});

test('consumes an attached CSV and dedupes it', async ({ page }) => {
  await installAgent(page, {
    steps: [{ calls: [{ name: 'csv-dedupe', args: {} }] }, { text: 'Done.' }],
    capable: true,
  });
  await page.getByTestId('agent-attach-input').setInputFiles(path.join(__dirname, 'fixtures/sample.csv'));
  await expect(page.getByText('sample.csv')).toBeVisible();       // attach state settled
  await send(page, 'remove duplicate rows from this csv');
  await expect(page.getByTestId('agent-messages')).toContainText('✓ csv-dedupe:');
  await expect(page.getByTestId('agent-messages')).toContainText('removed 1 duplicate row');
  await expect(page.getByRole('link', { name: /download/i })).toBeVisible();
});

test('multi-file tool asks for several files', async ({ page }) => {
  await installAgent(page, {
    steps: [{ calls: [{ name: 'pdf-merge', args: {} }] }, { text: 'Done.' }],
    capable: true,
  });
  await send(page, 'merge these pdfs into one');
  // With no attachment, the app prompts with a visible multiple file input.
  await expect(page.locator('input[type="file"][multiple]:visible')).toBeVisible();
});

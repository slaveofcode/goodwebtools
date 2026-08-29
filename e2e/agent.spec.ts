import { test, expect } from '@playwright/test';
import { installAgent, send } from './helpers';

test('chat mode: small talk gets a reply, no tool runs', async ({ page }) => {
  await installAgent(page, { steps: [{ chat: 'Hi! How can I help?' }], capable: false });
  await send(page, 'hello there');
  await expect(page.getByTestId('agent-messages')).toContainText('Hi! How can I help?');
  await expect(page.getByTestId('agent-messages')).not.toContainText('→ ');
});

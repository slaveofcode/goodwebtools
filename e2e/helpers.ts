import type { Page } from '@playwright/test';

export type ScriptStep =
  | { chat: string }
  | { calls: { name: string; args: Record<string, unknown> }[]; text?: string }
  | { text: string };

/** Inject the scripted provider BEFORE navigation, then open /ask-agent. */
export async function installAgent(page: Page, script: { steps: ScriptStep[]; capable?: boolean }) {
  await page.addInitScript(s => { (window as unknown as { __E2E_AGENT__: unknown }).__E2E_AGENT__ = s; }, script);
  await page.goto('/ask-agent');
  // The panel installs the scripted provider on mount; the input is always present.
  await page.getByTestId('agent-input').waitFor();
}

/** Type a message and send it. */
export async function send(page: Page, text: string) {
  await page.getByTestId('agent-input').fill(text);
  await page.getByTestId('agent-send').click();
}

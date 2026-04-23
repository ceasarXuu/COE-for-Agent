import type { Page } from '@playwright/test';

export async function clickGraphNode(page: Page, nodeId: string) {
  await clickByTestId(page, `graph-node-${nodeId}`);
}

export async function clickByTestId(page: Page, testId: string) {
  const locator = page.getByTestId(testId);
  await locator.waitFor({ state: 'visible' });
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLElement)) {
      throw new Error('Element is not clickable');
    }

    element.click();
  });
}

export async function setControlValue(page: Page, testId: string, value: string) {
  const locator = page.getByTestId(testId);
  await locator.waitFor({ state: 'visible' });
  await locator.evaluate((element, nextValue) => {
    if (element instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(element, nextValue);
    } else if (element instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(element, nextValue);
    } else {
      throw new Error('Control is not text-editable');
    }

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

export async function invokeConsoleTool<T = unknown>(page: Page, toolName: string, payload: Record<string, unknown>) {
  return page.evaluate(async ({ toolName, payload }) => {
    const sessionResponse = await fetch('/api/session');
    if (!sessionResponse.ok) {
      throw new Error(await sessionResponse.text());
    }

    const session = await sessionResponse.json() as { sessionToken: string };
    const response = await fetch(`/api/tools/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': session.sessionToken
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return response.json() as Promise<T>;
  }, { toolName, payload });
}
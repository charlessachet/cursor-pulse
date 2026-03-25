import * as vscode from 'vscode';
import type { SessionTokenStore } from '../infra/secrets';
import { parseSessionToken } from '../infra/secrets';

export async function runSetTokenCommand(tokenStore: SessionTokenStore): Promise<boolean> {
  await vscode.env.openExternal(vscode.Uri.parse('https://www.cursor.com/settings'));

  const input = await vscode.window.showInputBox({
    title: 'CursorPulse: Set Session Token',
    prompt:
      'Chrome/Arc/Brave: DevTools > Application > Cookies > https://www.cursor.com > WorkosCursorSessionToken. Paste the value or a Cookie header containing it.',
    placeHolder: 'WorkosCursorSessionToken=... or just the raw token value',
    ignoreFocusOut: true,
    password: true,
    validateInput(value) {
      return parseSessionToken(value) ? null : 'Paste a valid token or Cookie header containing WorkosCursorSessionToken.';
    },
  });

  if (!input) {
    return false;
  }

  const token = parseSessionToken(input);
  if (!token) {
    await vscode.window.showErrorMessage('CursorPulse could not parse a session token from that input.');
    return false;
  }

  await tokenStore.setToken(token);
  await vscode.window.showInformationMessage('CursorPulse session token saved securely.');
  return true;
}

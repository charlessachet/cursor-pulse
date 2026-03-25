import * as vscode from 'vscode';
import type { SessionTokenStore } from '../infra/secrets';

export async function runClearTokenCommand(tokenStore: SessionTokenStore): Promise<void> {
  await tokenStore.clearToken();
  await vscode.window.showInformationMessage('CursorPulse session token cleared.');
}


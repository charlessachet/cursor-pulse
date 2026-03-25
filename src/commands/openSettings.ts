import * as vscode from 'vscode';

export async function runOpenSettingsCommand(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.openSettings', 'cursorPulse');
}


import * as vscode from 'vscode';
import type { CursorPulseViewState } from '../client/types';
import type { UsageService } from '../services/usageService';

export async function runExportDiagnosticsCommand(
  usageService: UsageService,
  currentState: CursorPulseViewState,
): Promise<void> {
  const defaultUri = vscode.Uri.file(
    `${vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd()}/cursor-pulse-diagnostics.json`,
  );

  const targetUri = await vscode.window.showSaveDialog({
    defaultUri,
    filters: {
      JSON: ['json'],
    },
    saveLabel: 'Export CursorPulse Diagnostics',
  });

  if (!targetUri) {
    return;
  }

  const report = await usageService.buildDiagnosticsReport(currentState);
  const content = `${JSON.stringify(report, null, 2)}\n`;

  await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(content));
  await vscode.window.showInformationMessage(`CursorPulse diagnostics exported to ${targetUri.fsPath}`);
}

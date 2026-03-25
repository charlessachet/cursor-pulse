import * as vscode from 'vscode';
import { CursorClient } from './client/cursorClient';
import { CursorPulseConfig, CursorPulseViewState, RefreshResult } from './client/types';
import { runClearTokenCommand } from './commands/clearToken';
import { runExportDiagnosticsCommand } from './commands/exportDiagnostics';
import { runOpenSettingsCommand } from './commands/openSettings';
import { runSetTokenCommand } from './commands/setToken';
import { createDiagnostics, type Diagnostics } from './infra/diagnostics';
import { RefreshScheduler } from './infra/scheduler';
import { SessionTokenStore } from './infra/secrets';
import { UsageService } from './services/usageService';
import { applyStatusBarState } from './ui/statusBar';
import { renderTooltip } from './ui/tooltip';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const runtime = await createExtensionRuntime(context);
  context.subscriptions.push(runtime);
}

export function deactivate(): void {}

export async function createExtensionRuntime(
  context: vscode.ExtensionContext,
  dependencies?: {
    diagnostics?: Diagnostics;
    tokenStore?: SessionTokenStore;
    client?: CursorClient;
    usageService?: UsageService;
  },
): Promise<vscode.Disposable> {
  const diagnostics = dependencies?.diagnostics ?? createDiagnostics();
  const tokenStore = dependencies?.tokenStore ?? new SessionTokenStore(context.secrets);
  const client = dependencies?.client ?? new CursorClient(diagnostics);
  const usageService =
    dependencies?.usageService ?? new UsageService(context, tokenStore, client, diagnostics);
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);

  let currentState: CursorPulseViewState = await usageService.getInitialState();

  const getConfig = (): CursorPulseConfig => ({
    pollMinutes: vscode.workspace.getConfiguration().get<number>('cursorPulse.pollMinutes', 15),
    displayMode: 'compact',
    showUnlimitedActivity: vscode.workspace
      .getConfiguration()
      .get<boolean>('cursorPulse.showUnlimitedActivity', true),
    showModelAnalytics: vscode.workspace
      .getConfiguration()
      .get<boolean>('cursorPulse.showModelAnalytics', true),
    warningThresholdSpend: vscode.workspace
      .getConfiguration()
      .get<number>('cursorPulse.warningThresholdSpend', 0.8),
    warningThresholdIncluded: vscode.workspace
      .getConfiguration()
      .get<number>('cursorPulse.warningThresholdIncluded', 0.1),
  });

  const render = (): void => {
    const config = getConfig();
    applyStatusBarState(statusBarItem, currentState, config);
    statusBarItem.tooltip = renderTooltip(currentState, config);
    statusBarItem.show();
  };

  const refresh = async (): Promise<RefreshResult> => {
    currentState = {
      ...currentState,
      hasToken: currentState.hasToken,
      snapshot: currentState.hasToken
        ? {
            source: 'personal',
            fetchedAt: new Date().toISOString(),
            included: currentState.snapshot?.included ?? {},
            spend: currentState.snapshot?.spend ?? {},
            activity: currentState.snapshot?.activity ?? {},
            analytics: currentState.snapshot?.analytics,
            status: 'loading',
          }
        : undefined,
    };
    render();

    const result = await usageService.refresh();
    currentState = result.state;
    render();
    return result;
  };

  const scheduler = new RefreshScheduler(getConfig, refresh, diagnostics);

  const refreshCommand = vscode.commands.registerCommand('cursorPulse.refresh', async () => {
    await scheduler.triggerImmediate();
  });

  const setTokenCommand = vscode.commands.registerCommand('cursorPulse.setSessionToken', async () => {
    const saved = await runSetTokenCommand(tokenStore);
    if (saved) {
      await scheduler.triggerImmediate();
      scheduler.restart();
    }
  });

  const clearTokenCommand = vscode.commands.registerCommand('cursorPulse.clearSessionToken', async () => {
    await runClearTokenCommand(tokenStore);
    await usageService.clearCachedSnapshot();
    currentState = await usageService.getInitialState();
    render();
    scheduler.restart();
  });

  const openSettingsCommand = vscode.commands.registerCommand(
    'cursorPulse.openSettings',
    runOpenSettingsCommand,
  );
  const exportDiagnosticsCommand = vscode.commands.registerCommand(
    'cursorPulse.exportDiagnostics',
    async () => {
      await runExportDiagnosticsCommand(usageService, currentState);
    },
  );

  const configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('cursorPulse')) {
      render();
      scheduler.restart();
    }
  });

  render();
  scheduler.start();
  if (currentState.hasToken && currentState.snapshot?.status === 'loading') {
    await scheduler.triggerImmediate();
  }

  return new vscode.Disposable(() => {
    scheduler.stop();
    statusBarItem.dispose();
    refreshCommand.dispose();
    setTokenCommand.dispose();
    clearTokenCommand.dispose();
    openSettingsCommand.dispose();
    exportDiagnosticsCommand.dispose();
    configListener.dispose();
    diagnostics.dispose();
  });
}

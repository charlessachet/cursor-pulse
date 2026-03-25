import * as vscode from 'vscode';
import { CursorPulseConfig, CursorPulseViewState } from '../client/types';

export function applyStatusBarState(
  item: vscode.StatusBarItem,
  state: CursorPulseViewState,
  config: CursorPulseConfig,
): void {
  item.command = getStatusBarCommand(state);
  item.text = renderStatusBarText(state, config);
  item.tooltip = undefined;
  item.show();
}

export function getStatusBarCommand(state: CursorPulseViewState): string {
  if (!state.hasToken) {
    return 'cursorPulse.setSessionToken';
  }

  if (state.snapshot?.status === 'auth_error') {
    return 'cursorPulse.setSessionToken';
  }

  return 'cursorPulse.refresh';
}

export function renderStatusBarText(state: CursorPulseViewState, _config: CursorPulseConfig): string {
  if (!state.hasToken) {
    return 'CursorPulse: connect';
  }

  const snapshot = state.snapshot;
  if (!snapshot || snapshot.status === 'loading') {
    return 'CursorPulse: syncing';
  }

  if (snapshot.status === 'auth_error') {
    return 'CursorPulse: reconnect';
  }

  if (snapshot.status === 'fetch_error') {
    return 'CursorPulse: unavailable';
  }

  const includedRemaining = snapshot.included.remaining;
  const spendUsed = snapshot.spend.used ?? 0;
  const icon = getSeverityIcon(snapshot, _config);

  return `${icon} ${formatIncluded(includedRemaining, snapshot.included.unit)} | ${formatCurrency(spendUsed)}`;
}

function getSeverityIcon(snapshot: NonNullable<CursorPulseViewState['snapshot']>, config: CursorPulseConfig): string {
  if (snapshot.included.remaining === 0 || snapshot.spend.remaining === 0) {
    return '◆';
  }

  const lowIncluded =
    snapshot.included.remaining !== undefined &&
    snapshot.included.total !== undefined &&
    snapshot.included.total > 0 &&
    snapshot.included.remaining / snapshot.included.total <= config.warningThresholdIncluded;
  const highSpend =
    snapshot.spend.percentUsed !== undefined && snapshot.spend.percentUsed >= config.warningThresholdSpend;

  if (lowIncluded || highSpend) {
    return '▲';
  }

  return '◈';
}

function formatIncluded(value: number | undefined, unit: 'requests' | 'usd' | undefined): string {
  if (value === undefined) {
    return '?';
  }

  if (unit === 'usd') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  return Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

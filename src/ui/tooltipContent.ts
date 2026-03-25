import { CursorPulseConfig, CursorPulseViewState } from '../client/types';

export function buildTooltipMarkdown(
  state: CursorPulseViewState,
  config: CursorPulseConfig,
): string {
  let markdown = '**CursorPulse**\n';
  markdown += 'Personal-first Cursor usage, right where you work.\n\n';

  if (!state.hasToken) {
    markdown += 'Connect your Cursor session to start tracking included usage and on-demand spend.\n';
    markdown += 'Click the status bar item or run `CursorPulse: Set Session Token`.\n';
    return markdown;
  }

  const snapshot = state.snapshot;
  if (!snapshot || snapshot.status === 'loading') {
    markdown += 'Syncing your latest Cursor usage snapshot.\n';
    return markdown;
  }

  if (snapshot.status === 'auth_error') {
    markdown += 'Your saved session expired.\n\n';
    markdown += 'Click the status bar item or run `CursorPulse: Set Session Token` to reconnect.\n';
    return markdown;
  }

  if (snapshot.status === 'fetch_error') {
    markdown += `${state.message ?? "CursorPulse couldn't read the latest usage response."}\n`;
    return markdown;
  }

  if (snapshot.status === 'stale') {
    markdown += 'Using your last good snapshot while Cursor sync catches up.\n';
    markdown += `Last good update was ${relativeMinutes(snapshot.fetchedAt)} ago.\n\n`;
  }

  markdown += '**Included left**\n';
  markdown += formatIncludedLine(snapshot.included.remaining, snapshot.included.total, snapshot.included.unit);
  if (snapshot.included.used !== undefined) {
    if (snapshot.included.total !== undefined) {
      markdown += `${formatIncludedValue(snapshot.included.used, snapshot.included.unit)} used this cycle\n`;
    } else if (snapshot.included.unit === 'usd') {
      markdown += `Included usage spent this cycle: ${formatCurrency(snapshot.included.used)}\n`;
    } else {
      markdown += `Used this cycle: ${formatIncludedValue(snapshot.included.used, snapshot.included.unit)}\n`;
    }
  }
  markdown += '\n';

  markdown += '**On-demand spend**\n';
  if (snapshot.spend.unlimited) {
    markdown += `${formatCurrency(snapshot.spend.used)} / Unlimited\n`;
    markdown += 'Spend cap: Unlimited\n\n';
  } else {
    markdown += `${formatCurrency(snapshot.spend.used)} / ${formatCurrency(snapshot.spend.limit)}\n`;
    markdown += `Remaining budget: ${formatCurrency(snapshot.spend.remaining)}\n\n`;
  }

  if (
    config.showUnlimitedActivity &&
    (snapshot.activity.avgPerDay !== undefined ||
      snapshot.activity.beyondIncludedCount !== undefined ||
      snapshot.activity.projectedExhaustionDate)
  ) {
    markdown += '**Activity signal**\n';
    if (snapshot.activity.avgPerDay !== undefined) {
      markdown += `Average daily use: ${formatDecimal(snapshot.activity.avgPerDay)}\n`;
    }
    if (snapshot.activity.beyondIncludedCount !== undefined) {
      markdown += `Beyond included quota: ${formatWhole(snapshot.activity.beyondIncludedCount)} requests\n`;
    }
    if (snapshot.activity.projectedExhaustionDate) {
      markdown += `Estimated quota exhaustion: ${formatDate(snapshot.activity.projectedExhaustionDate)}\n`;
    }
    markdown += '\n';
  }

  markdown += '**Resets**\n';
  markdown += `${formatDate(snapshot.included.resetDate)}\n\n`;

  markdown += '**Updated**\n';
  markdown += `${formatTime(snapshot.fetchedAt)}\n`;
  markdown += `Billing source: ${snapshot.source === 'team' ? 'Team' : 'Personal'}\n`;
  return markdown;
}

function formatCurrency(value: number | undefined): string {
  if (value === undefined) {
    return '?';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatWhole(value: number | undefined): string {
  if (value === undefined) {
    return '?';
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatIncludedValue(value: number | undefined, unit: 'requests' | 'usd' | undefined): string {
  return unit === 'usd' ? formatCurrency(value) : formatWhole(value);
}

function formatDecimal(value: number | undefined): string {
  if (value === undefined) {
    return '?';
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string | undefined): string {
  if (!value) {
    return '?';
  }

  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function relativeMinutes(value: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function formatIncludedLine(
  remaining: number | undefined,
  total: number | undefined,
  unit: 'requests' | 'usd' | undefined,
): string {
  if (remaining === undefined && total === undefined) {
    return '? remaining\n';
  }

  if (remaining !== undefined && total === undefined) {
    return `${formatIncludedValue(remaining, unit)} remaining\n`;
  }

  return `${formatIncludedValue(remaining, unit)} of ${formatIncludedValue(total, unit)} remaining\n`;
}

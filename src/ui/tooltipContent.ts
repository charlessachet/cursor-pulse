import { CursorPulseConfig, CursorPulseViewState } from '../client/types';

export function buildTooltipMarkdown(
  state: CursorPulseViewState,
  config: CursorPulseConfig,
): string {
  let markdown = sectionTitle('CursorPulse');

  if (!state.hasToken) {
    markdown += line('Connect your Cursor session to start tracking included usage and on-demand spend.');
    markdown += line('Click the status bar item or run `CursorPulse: Set Session Token`.');
    return markdown;
  }

  const snapshot = state.snapshot;
  if (!snapshot || snapshot.status === 'loading') {
    markdown += line('Syncing your latest Cursor usage snapshot.');
    return markdown;
  }

  if (snapshot.status === 'auth_error') {
    markdown += line('Your saved session expired.');
    markdown += blankLine();
    markdown += line('Click the status bar item or run `CursorPulse: Set Session Token` to reconnect.');
    return markdown;
  }

  if (snapshot.status === 'fetch_error') {
    markdown += line(state.message ?? "CursorPulse couldn't read the latest usage response.");
    return markdown;
  }

  if (snapshot.status === 'stale') {
    markdown += line('Using your last good snapshot while Cursor sync catches up.');
    markdown += line(`Last good update was ${relativeMinutes(snapshot.fetchedAt)} ago.`);
    markdown += blankLine();
  }

  markdown += sectionTitle('Included left');
  markdown += formatIncludedLine(snapshot.included.remaining, snapshot.included.total, snapshot.included.unit);
  if (snapshot.included.used !== undefined) {
    if (snapshot.included.total !== undefined) {
      markdown += line(`${formatIncludedValue(snapshot.included.used, snapshot.included.unit)} used this cycle`);
    } else if (snapshot.included.unit === 'usd') {
      markdown += line(`Included usage spent this cycle: ${formatCurrency(snapshot.included.used)}`);
    } else {
      markdown += line(`Used this cycle: ${formatIncludedValue(snapshot.included.used, snapshot.included.unit)}`);
    }
  }
  markdown += blankLine();

  markdown += sectionTitle('On-demand spend');
  if (snapshot.spend.unlimited) {
    markdown += line(`${formatCurrency(snapshot.spend.used)} / Unlimited`);
    markdown += line('Spend cap: Unlimited');
  } else {
    markdown += line(`${formatCurrency(snapshot.spend.used)} / ${formatCurrency(snapshot.spend.limit)}`);
    markdown += line(`Remaining budget: ${formatCurrency(snapshot.spend.remaining)}`);
  }
  markdown += blankLine();

  if (
    config.showUnlimitedActivity &&
    (snapshot.activity.avgPerDay !== undefined ||
      snapshot.activity.beyondIncludedCount !== undefined ||
      snapshot.activity.projectedExhaustionDate)
  ) {
    markdown += sectionTitle('Activity signal');
    if (snapshot.activity.avgPerDay !== undefined) {
      markdown += line(`Average daily use: ${formatDecimal(snapshot.activity.avgPerDay)}`);
    }
    if (snapshot.activity.beyondIncludedCount !== undefined) {
      markdown += line(`Beyond included quota: ${formatWhole(snapshot.activity.beyondIncludedCount)} requests`);
    }
    if (snapshot.activity.projectedExhaustionDate) {
      markdown += line(`Estimated quota exhaustion: ${formatDate(snapshot.activity.projectedExhaustionDate)}`);
    }
    markdown += blankLine();
  }

  if (config.showModelAnalytics) {
    markdown += sectionTitle('Today by model');
    if (!snapshot.analytics || !snapshot.analytics.available) {
      markdown += line('Daily model breakdown unavailable for this account.');
      markdown += blankLine();
    } else {
      for (const row of snapshot.analytics.topModels) {
        markdown += line(`${formatModelName(row.model)}: ${formatAnalyticsRow(row.spend, row.requests)}`);
      }
      if (
        snapshot.analytics.totalSpend !== undefined ||
        snapshot.analytics.totalRequests !== undefined
      ) {
        markdown += line(`Today total: ${formatAnalyticsRow(
          snapshot.analytics.totalSpend,
          snapshot.analytics.totalRequests,
        )}`);
      }
      if (
        snapshot.analytics.averageDailySpend !== undefined ||
        snapshot.analytics.averageDailyRequests !== undefined
      ) {
        markdown += line(`Average day this cycle: ${formatAnalyticsRow(
          snapshot.analytics.averageDailySpend,
          snapshot.analytics.averageDailyRequests,
        )}`);
      }
      markdown += blankLine();
    }
  }

  markdown += line(
    `Reset: ${formatDate(snapshot.included.resetDate)} • Updated: ${formatTime(snapshot.fetchedAt)} • Source: ${
      snapshot.source === 'team' ? 'Team' : 'Personal'
    }`,
  );
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
    return line('? remaining');
  }

  if (remaining !== undefined && total === undefined) {
    return line(`${formatIncludedValue(remaining, unit)} remaining`);
  }

  return line(`${formatIncludedValue(remaining, unit)} of ${formatIncludedValue(total, unit)} remaining`);
}

function formatAnalyticsRow(spend: number | undefined, requests: number | undefined): string {
  if (spend !== undefined && requests !== undefined) {
    return `${formatCurrency(spend)} • ${formatAnalyticsRequests(requests)}`;
  }

  if (spend !== undefined) {
    return formatCurrency(spend);
  }

  if (requests !== undefined) {
    return formatAnalyticsRequests(requests);
  }

  return '?';
}

function formatAnalyticsRequests(value: number): string {
  return Number.isInteger(value) ? `${formatWhole(value)} req` : `${formatDecimal(value)} req`;
}

function sectionTitle(value: string): string {
  return `**${value}**  \n`;
}

function line(value: string): string {
  return `${value}  \n`;
}

function blankLine(): string {
  return '\n';
}

function formatModelName(model: string): string {
  switch (model) {
    case 'composer-2':
      return 'Composer 2';
    case 'default':
      return 'Default';
    case 'claude-4.6-opus-high-thinking':
      return 'Claude 4.6 Opus Thinking';
    default:
      return model;
  }
}

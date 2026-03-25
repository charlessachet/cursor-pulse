import {
  CursorInvoiceItem,
  CursorInvoiceUsageEvent,
  CursorPersonalUsagePayload,
  CursorPulseSnapshot,
  CursorUsageBucket,
  CursorUsageResponse,
} from '../client/types';

export function mapUsagePayloadToSnapshot(
  payload: CursorPersonalUsagePayload,
  fetchedAt: Date = new Date(),
): CursorPulseSnapshot {
  const cycleStart = payload.cycleStart ? new Date(payload.cycleStart) : undefined;
  const primaryBucket = findPrimaryIncludedBucket(payload.usage);
  const teamMember = payload.team?.member;
  const includedUnit =
    finiteNumber(teamMember?.includedSpendCents) !== undefined &&
    finiteNumber(teamMember?.fastPremiumRequests) === undefined &&
    finiteNumber(primaryBucket?.maxRequestUsage) === undefined
      ? 'usd'
      : 'requests';

  const includedTotal =
    includedUnit === 'requests' ? finiteNumber(primaryBucket?.maxRequestUsage) : undefined;
  const includedUsed =
    includedUnit === 'usd'
      ? roundCurrency((teamMember?.includedSpendCents ?? 0) / 100)
      : finiteNumber(teamMember?.fastPremiumRequests) ??
        finiteNumber(primaryBucket?.numRequests ?? primaryBucket?.numRequestsTotal);

  const spendUsed =
    roundCurrency(
      finiteNumber(teamMember?.spendCents) !== undefined
        ? (teamMember?.spendCents ?? 0) / 100
        : sumUsageSpend(payload.invoice.items ?? []),
    );
  const includedRemaining =
    includedTotal !== undefined && includedUsed !== undefined
      ? Math.max(0, includedTotal - includedUsed)
      : spendUsed !== undefined && spendUsed > 0
        ? 0
        : undefined;
  const spendLimit =
    finiteNumber(teamMember?.hardLimitOverrideDollars) ??
    finiteNumber(payload.hardLimit.hardLimitPerUser) ??
    finiteNumber(payload.hardLimit.hardLimit);
  const spendUnlimited = payload.hardLimit.noUsageBasedAllowed === true && spendLimit === undefined;
  const spendRemaining =
    spendLimit !== undefined && spendUsed !== undefined
      ? roundCurrency(Math.max(0, spendLimit - spendUsed))
      : undefined;

  const beyondIncludedCount =
    includedUnit === 'requests' ? sumBeyondIncludedCount(payload.invoice.items ?? []) : undefined;
  const totalActivity =
    includedUnit === 'requests'
      ? includedUsed !== undefined && beyondIncludedCount !== undefined
        ? includedUsed + beyondIncludedCount
        : includedUsed ?? beyondIncludedCount
      : undefined;
  const avgPerDay =
    cycleStart && totalActivity !== undefined
      ? round1(totalActivity / Math.max(1, daysSince(cycleStart, fetchedAt)))
      : undefined;
  const projectedExhaustionDate =
    includedRemaining !== undefined && avgPerDay && avgPerDay > 0
      ? new Date(fetchedAt.getTime() + (includedRemaining / avgPerDay) * 24 * 60 * 60 * 1000)
      : undefined;
  const analytics = buildDailyAnalytics(payload, fetchedAt);

  return {
    source: teamMember ? 'team' : 'personal',
    fetchedAt: fetchedAt.toISOString(),
    included: {
      unit: includedUnit,
      total: includedTotal,
      remaining: includedRemaining,
      used: includedUsed,
      percentUsed:
        includedTotal !== undefined && includedUsed !== undefined && includedTotal > 0
          ? includedUsed / includedTotal
          : undefined,
      resetDate: cycleStart ? addOneMonth(cycleStart).toISOString() : undefined,
    },
    spend: {
      used: spendUsed,
      limit: spendLimit,
      unlimited: spendUnlimited,
      remaining: spendRemaining,
      percentUsed:
        spendLimit !== undefined && spendUsed !== undefined && spendLimit > 0
          ? spendUsed / spendLimit
          : undefined,
    },
    activity: {
      avgPerDay,
      beyondIncludedCount,
      projectedExhaustionDate: projectedExhaustionDate?.toISOString(),
    },
    analytics,
    status: 'ok',
  };
}

function buildDailyAnalytics(
  payload: CursorPersonalUsagePayload,
  fetchedAt: Date,
): CursorPulseSnapshot['analytics'] {
  const day = formatLocalDayKey(fetchedAt);
  const usageEvents = extractUsageEvents(payload.invoice);
  if (usageEvents.length === 0) {
    return {
      available: false,
      day,
      topModels: [],
    };
  }

  const cycleStart = payload.cycleStart ? new Date(payload.cycleStart) : undefined;
  const byModel = new Map<string, { spend: number; requests: number }>();

  let todaySpend = 0;
  let todayRequests = 0;
  let cycleSpend = 0;
  let cycleRequests = 0;
  let hasSpendDimension = false;
  let hasRequestDimension = false;

  for (const event of usageEvents) {
    const normalized = normalizeUsageEvent(event);
    if (!normalized) {
      continue;
    }

    if (normalized.spend !== undefined) {
      hasSpendDimension = true;
    }
    if (normalized.requests !== undefined) {
      hasRequestDimension = true;
    }

    cycleSpend += normalized.spend ?? 0;
    cycleRequests += normalized.requests ?? 0;

    if (formatLocalDayKey(normalized.timestamp) !== day) {
      continue;
    }

    todaySpend += normalized.spend ?? 0;
    todayRequests += normalized.requests ?? 0;

    const existing = byModel.get(normalized.model) ?? { spend: 0, requests: 0 };
    existing.spend += normalized.spend ?? 0;
    existing.requests += normalized.requests ?? 0;
    byModel.set(normalized.model, existing);
  }

  const topModels = [...byModel.entries()]
    .map(([model, totals]) => ({
      model,
      spend: totals.spend > 0 ? roundCurrency(totals.spend) : undefined,
      requests: totals.requests > 0 ? totals.requests : undefined,
    }))
    .sort((left, right) => {
      const spendDelta = (right.spend ?? 0) - (left.spend ?? 0);
      if (spendDelta !== 0) {
        return spendDelta;
      }

      const requestDelta = (right.requests ?? 0) - (left.requests ?? 0);
      if (requestDelta !== 0) {
        return requestDelta;
      }

      return left.model.localeCompare(right.model);
    })
    .slice(0, 3);

  const elapsedDays = cycleStart ? Math.max(1, daysSince(cycleStart, fetchedAt)) : 1;

  return {
    available:
      topModels.length > 0 ||
      todaySpend > 0 ||
      todayRequests > 0 ||
      cycleSpend > 0 ||
      cycleRequests > 0,
    day,
    totalSpend: hasSpendDimension ? roundCurrency(todaySpend) : undefined,
    totalRequests: hasRequestDimension ? todayRequests : undefined,
    averageDailySpend: hasSpendDimension ? roundCurrency(cycleSpend / elapsedDays) : undefined,
    averageDailyRequests: hasRequestDimension ? round1(cycleRequests / elapsedDays) : undefined,
    topModels,
  };
}

function findPrimaryIncludedBucket(usage: CursorUsageResponse): CursorUsageBucket | undefined {
  const buckets = Object.entries(usage)
    .filter((entry): entry is [string, CursorUsageBucket] => isUsageBucket(entry[1]))
    .sort(([leftKey, leftBucket], [rightKey, rightBucket]) => {
      const leftScore = bucketPriority(leftKey, leftBucket);
      const rightScore = bucketPriority(rightKey, rightBucket);
      return rightScore - leftScore;
    });

  return buckets[0]?.[1];
}

function bucketPriority(key: string, bucket: CursorUsageBucket): number {
  const limit = finiteNumber(bucket.maxRequestUsage) ?? 0;
  const preferredKeyBoost = key === 'gpt-4' ? 10_000 : 0;
  return preferredKeyBoost + limit;
}

function isUsageBucket(value: unknown): value is CursorUsageBucket {
  return typeof value === 'object' && value !== null && ('numRequests' in value || 'maxRequestUsage' in value);
}

function finiteNumber(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function extractUsageEvents(invoice: CursorPersonalUsagePayload['invoice']): CursorInvoiceUsageEvent[] {
  if (Array.isArray(invoice.usageEvents)) {
    return invoice.usageEvents;
  }

  if (Array.isArray(invoice.events)) {
    return invoice.events;
  }

  return [];
}

function normalizeUsageEvent(
  event: CursorInvoiceUsageEvent,
): { timestamp: Date; model: string; spend?: number; requests?: number } | undefined {
  const timestampValue = pickString(event.timestamp, event.createdAt, event.occurredAt);
  if (!timestampValue) {
    return undefined;
  }

  const timestamp = new Date(timestampValue);
  if (Number.isNaN(timestamp.getTime())) {
    return undefined;
  }

  const model = pickString(
    event.model,
    event.modelName,
    event.modelId,
    nestedString(event, ['usage', 'model']),
    nestedString(event, ['metadata', 'model']),
  );
  if (!model) {
    return undefined;
  }

  const spendCents = pickNumber(
    event.cents,
    event.costCents,
    event.spendCents,
    event.amountCents,
    nestedNumber(event, ['cost', 'cents']),
    nestedNumber(event, ['amount', 'cents']),
  );
  const requestCount = pickNumber(
    event.numRequests,
    event.requests,
    event.requestCount,
    event.quantity,
    nestedNumber(event, ['usage', 'requests']),
    nestedNumber(event, ['metadata', 'requestCount']),
  );

  if (spendCents === undefined && requestCount === undefined) {
    return undefined;
  }

  return {
    timestamp,
    model,
    spend: spendCents !== undefined ? spendCents / 100 : undefined,
    requests: requestCount,
  };
}

function pickString(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim();
}

function pickNumber(...values: Array<number | undefined>): number | undefined {
  return values.find((value) => typeof value === 'number' && Number.isFinite(value));
}

function nestedString(value: unknown, path: string[]): string | undefined {
  const nested = nestedValue(value, path);
  return typeof nested === 'string' ? nested : undefined;
}

function nestedNumber(value: unknown, path: string[]): number | undefined {
  const nested = nestedValue(value, path);
  return typeof nested === 'number' && Number.isFinite(nested) ? nested : undefined;
}

function nestedValue(value: unknown, path: string[]): unknown {
  let current: unknown = value;

  for (const segment of path) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function sumUsageSpend(items: CursorInvoiceItem[]): number | undefined {
  const relevant = items.filter(isUsageChargeItem);
  if (relevant.length === 0) {
    return 0;
  }

  return relevant.reduce((sum, item) => sum + ((item.cents ?? 0) / 100), 0);
}

function sumBeyondIncludedCount(items: CursorInvoiceItem[]): number | undefined {
  const relevant = items
    .filter(isUsageChargeItem)
    .map((item) => extractRequestCount(item.description ?? ''))
    .filter((value): value is number => value !== undefined);

  if (relevant.length === 0) {
    return 0;
  }

  return relevant.reduce((sum, value) => sum + value, 0);
}

function isUsageChargeItem(item: CursorInvoiceItem): boolean {
  if (typeof item.cents !== 'number' || item.cents <= 0) {
    return false;
  }

  const description = (item.description ?? '').toLowerCase();
  if (!description) {
    return false;
  }

  if (
    description.includes('mid-month usage paid') ||
    description.includes('payment') ||
    description.includes('credit') ||
    description.includes('tax') ||
    description.includes('refund') ||
    description.includes('subscription')
  ) {
    return false;
  }

  return /^\d+/.test(description) || description.includes('token-based usage calls');
}

function extractRequestCount(description: string): number | undefined {
  const tokenMatch = description.match(/^(\d+)\s+token-based usage calls/i);
  if (tokenMatch?.[1]) {
    return Number.parseInt(tokenMatch[1], 10);
  }

  const leadingMatch = description.match(/^(\d+)/);
  if (leadingMatch?.[1]) {
    return Number.parseInt(leadingMatch[1], 10);
  }

  return undefined;
}

function daysSince(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
}

function addOneMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + 1);
  return result;
}

function roundCurrency(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value * 100) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatLocalDayKey(value: Date): string {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

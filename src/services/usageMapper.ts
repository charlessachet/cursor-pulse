import {
  CursorInvoiceItem,
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
    status: 'ok',
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

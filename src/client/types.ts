export type CursorPulseSource = 'personal' | 'team';

export type CursorPulseSnapshotStatus =
  | 'ok'
  | 'loading'
  | 'auth_error'
  | 'fetch_error'
  | 'stale';

export type CursorPulseSnapshot = {
  source: CursorPulseSource;
  fetchedAt: string;
  included: {
    unit?: 'requests' | 'usd';
    total?: number;
    remaining?: number;
    used?: number;
    percentUsed?: number;
    resetDate?: string;
  };
  spend: {
    used?: number;
    limit?: number;
    unlimited?: boolean;
    remaining?: number;
    percentUsed?: number;
  };
  activity: {
    avgPerDay?: number;
    beyondIncludedCount?: number;
    projectedExhaustionDate?: string;
  };
  analytics?: {
    available: boolean;
    day: string;
    totalSpend?: number;
    totalRequests?: number;
    averageDailySpend?: number;
    averageDailyRequests?: number;
    topModels: Array<{
      model: string;
      spend?: number;
      requests?: number;
    }>;
  };
  status: CursorPulseSnapshotStatus;
};

export interface CursorPulseViewState {
  hasToken: boolean;
  snapshot?: CursorPulseSnapshot;
  message?: string;
}

export interface CursorPulseConfig {
  pollMinutes: number;
  displayMode: 'compact';
  showUnlimitedActivity: boolean;
  showModelAnalytics: boolean;
  warningThresholdSpend: number;
  warningThresholdIncluded: number;
}

export interface CursorUsageBucket {
  numRequests?: number;
  numRequestsTotal?: number;
  numTokens?: number;
  maxRequestUsage?: number | null;
  maxTokenUsage?: number | null;
}

export interface CursorUsageResponse {
  startOfMonth?: string;
  [key: string]: CursorUsageBucket | string | undefined;
}

export interface CursorHardLimitResponse {
  hardLimit?: number;
  hardLimitPerUser?: number;
  noUsageBasedAllowed?: boolean;
}

export interface CursorInvoiceItem {
  description?: string;
  cents?: number;
}

export interface CursorInvoiceResponse {
  items?: CursorInvoiceItem[];
  usageEvents?: CursorInvoiceUsageEvent[];
  events?: CursorInvoiceUsageEvent[];
  hasUnpaidMidMonthInvoice?: boolean;
  [key: string]: unknown;
}

export interface CursorInvoiceUsageEvent {
  timestamp?: string;
  timestampMs?: number | string;
  createdAt?: string;
  occurredAt?: string;
  model?: string;
  modelName?: string;
  modelId?: string;
  kind?: string;
  cents?: number;
  costCents?: number;
  spendCents?: number;
  amountCents?: number;
  chargedCents?: number;
  usageBasedCosts?: string;
  requestsCosts?: number;
  numRequests?: number;
  requests?: number;
  requestCount?: number;
  quantity?: number;
  [key: string]: unknown;
}

export interface CursorAuthMeResponse {
  id?: number;
  email?: string;
  sub?: string;
  name?: string;
}

export interface CursorTeam {
  id: number;
  name?: string;
}

export interface CursorTeamsResponse {
  teams?: CursorTeam[];
}

export interface CursorTeamDetailsResponse {
  userId?: number;
}

export interface CursorTeamMemberSpend {
  userId?: number;
  email?: string;
  name?: string;
  fastPremiumRequests?: number;
  spendCents?: number;
  includedSpendCents?: number;
  hardLimitOverrideDollars?: number;
}

export interface CursorTeamSpendResponse {
  teamMemberSpend?: CursorTeamMemberSpend[];
}

export interface CursorPersonalUsagePayload {
  usage: CursorUsageResponse;
  hardLimit: CursorHardLimitResponse;
  invoice: CursorInvoiceResponse;
  filteredUsageEvents?: CursorFilteredUsageEventsResponse;
  auth?: CursorAuthMeResponse;
  cycleStart?: string;
  team?: {
    id: number;
    member?: CursorTeamMemberSpend;
  };
}

export interface CursorFilteredUsageEventsResponse {
  totalUsageEventsCount?: number;
  usageEventsDisplay?: CursorInvoiceUsageEvent[];
  rows?: CursorInvoiceUsageEvent[];
  usageEvents?: CursorInvoiceUsageEvent[];
  events?: CursorInvoiceUsageEvent[];
  items?: CursorInvoiceUsageEvent[];
  results?: CursorInvoiceUsageEvent[];
  data?: CursorInvoiceUsageEvent[] | { rows?: CursorInvoiceUsageEvent[]; events?: CursorInvoiceUsageEvent[]; items?: CursorInvoiceUsageEvent[] };
  [key: string]: unknown;
}

export type CursorClientErrorKind = 'auth' | 'network' | 'http' | 'parse';

export class CursorClientError extends Error {
  public readonly kind: CursorClientErrorKind;
  public readonly statusCode?: number;

  public constructor(kind: CursorClientErrorKind, message: string, statusCode?: number) {
    super(message);
    this.name = 'CursorClientError';
    this.kind = kind;
    this.statusCode = statusCode;
  }
}

export interface RefreshResult {
  state: CursorPulseViewState;
  retryAfterMs?: number;
}

export interface CursorPulseDiagnosticsReport {
  exportedAt: string;
  hasToken: boolean;
  currentState?: CursorPulseViewState;
  lastSuccessfulSnapshot?: CursorPulseSnapshot;
  lastRawPayload?: CursorPersonalUsagePayload;
  lastError?: {
    kind: 'cursor_client' | 'unexpected';
    message: string;
    statusCode?: number;
  };
}

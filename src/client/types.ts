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
  hasUnpaidMidMonthInvoice?: boolean;
}

export interface CursorAuthMeResponse {
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
  auth?: CursorAuthMeResponse;
  cycleStart?: string;
  team?: {
    id: number;
    member?: CursorTeamMemberSpend;
  };
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

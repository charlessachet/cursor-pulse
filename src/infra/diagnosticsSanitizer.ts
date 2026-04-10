const REDACTED = '<redacted>';

const SAFE_KEYS = new Set([
  'source',
  'fetchedat',
  'included',
  'unit',
  'total',
  'remaining',
  'used',
  'percentused',
  'resetdate',
  'spend',
  'limit',
  'unlimited',
  'activity',
  'avgperday',
  'beyondincludedcount',
  'projectedexhaustiondate',
  'analytics',
  'available',
  'day',
  'totalspend',
  'totalrequests',
  'averagedailyspend',
  'averagedailyrequests',
  'topmodels',
  'model',
  'requests',
  'status',
  'hastoken',
  'message',
  'numrequests',
  'numrequeststotal',
  'numtokens',
  'maxrequestusage',
  'maxtokenusage',
  'startofmonth',
  'hardlimit',
  'hardlimitperuser',
  'nousagebasedallowed',
  'items',
  'description',
  'cents',
  'usageevents',
  'events',
  'timestamp',
  'timestampms',
  'createdat',
  'occurredat',
  'modelname',
  'modelid',
  'kind',
  'costcents',
  'spendcents',
  'amountcents',
  'chargedcents',
  'usagebasedcosts',
  'requestscosts',
  'requestcount',
  'quantity',
  'id',
  'teams',
  'fastpremiumrequests',
  'includedspendcents',
  'hardlimitoverridedollars',
  'usage',
  'invoice',
  'filteredusageevents',
  'cyclestart',
  'team',
  'member',
  'totalusageeventscount',
  'usageeventsdisplay',
  'rows',
  'results',
  'data',
  'exportedat',
  'currentstate',
  'lastsuccessfulsnapshot',
  'lastrawpayload',
  'lasterror',
  'statuscode',
  'nested',
  'error',
  'auth',
  'userid',
  'sub',
  'email',
  'name',
  // Known model names to keep usage metrics useful in diagnostics
  'gpt-4',
  'gpt-4-0613',
  'gpt-4-32k',
  'gpt-4-1106-preview',
  'gpt-4-vision-preview',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-3.5-turbo',
  'gpt-3.5-turbo-0125',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-0613',
  'claude-3-5-sonnet',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'claude-2.1',
  'claude-2.0',
  'claude-instant-1.2',
  'claude-4-sonnet',
  'gpt-4.1',
  'default',
]);

export function sanitizeDiagnosticsValue<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDiagnosticsValue(item)) as T;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value).map(([key, nestedValue]) => {
      if (shouldRedactKey(key)) {
        return [key, REDACTED];
      }

      return [key, sanitizeDiagnosticsValue(nestedValue)];
    });

    return Object.fromEntries(entries) as T;
  }

  if (typeof value === 'string') {
    return value.replace(
      /WorkosCursorSessionToken=[^;\s"]+/gi,
      'WorkosCursorSessionToken=<redacted>',
    ) as T;
  }

  return value;
}

function shouldRedactKey(key: string): boolean {
  const normalized = key.toLowerCase();
  // Always redact known sensitive fields even if they are in the allowlist
  // (though they shouldn't be, this is defense in depth)
  if (
    normalized === 'email' ||
    normalized === 'name' ||
    normalized === 'picture' ||
    normalized === 'sub' ||
    normalized === 'userid' ||
    normalized === 'user_id' ||
    normalized === 'token' ||
    normalized === 'sessiontoken' ||
    normalized === 'session_token' ||
    normalized === 'cookie'
  ) {
    return true;
  }

  return !SAFE_KEYS.has(normalized);
}

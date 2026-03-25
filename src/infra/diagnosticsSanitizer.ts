const REDACTED = '<redacted>';

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
  return (
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
  );
}

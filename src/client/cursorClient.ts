import {
  CursorAuthMeResponse,
  CursorClientError,
  CursorHardLimitResponse,
  CursorInvoiceResponse,
  CursorPersonalUsagePayload,
  CursorTeamDetailsResponse,
  CursorTeamSpendResponse,
  CursorTeamsResponse,
  CursorUsageResponse,
} from './types';
import type { Diagnostics } from '../infra/diagnostics';

const CURSOR_BASE_URL = 'https://cursor.com';

export class CursorClient {
  public constructor(private readonly diagnostics: Diagnostics) {}

  public async fetchPersonalUsage(token: string): Promise<CursorPersonalUsagePayload> {
    const auth = await this.requestJson<CursorAuthMeResponse>('/api/auth/me', token, {
      method: 'GET',
    });
    const userId = auth.sub ?? extractUserIdFromToken(token);

    this.diagnostics.info('Fetching personal Cursor usage.');

    const usage = await this.requestJson<CursorUsageResponse>(
      `/api/usage?user=${encodeURIComponent(userId)}`,
      token,
      {
        method: 'GET',
      },
    );

    const cycleStart = typeof usage.startOfMonth === 'string' ? usage.startOfMonth : undefined;
    const cycleDate = cycleStart ? new Date(cycleStart) : new Date();

    const hardLimit = await this.requestJson<CursorHardLimitResponse>(
      '/api/dashboard/get-hard-limit',
      token,
      {
        method: 'POST',
        body: {},
      },
    );

    const invoice = await this.requestJson<CursorInvoiceResponse>(
      '/api/dashboard/get-monthly-invoice',
      token,
      {
        method: 'POST',
        body: {
          month: cycleDate.getMonth() + 1,
          year: cycleDate.getFullYear(),
          includeUsageEvents: false,
        },
      },
    );

    const team = await this.tryFetchTeamUsage(token);

    return {
      auth,
      usage,
      hardLimit,
      invoice,
      cycleStart,
      team,
    };
  }

  private async requestJson<T>(
    path: string,
    token: string,
    options: {
      method: 'GET' | 'POST';
      body?: Record<string, unknown>;
    },
  ): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${CURSOR_BASE_URL}${path}`, {
        method: options.method,
        headers: buildHeaders(token),
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (error) {
      throw new CursorClientError('network', `Network error while calling ${path}: ${String(error)}`);
    }

    if (response.status === 401 || response.status === 403) {
      throw new CursorClientError('auth', `Authentication failed for ${path}.`, response.status);
    }

    if (!response.ok) {
      throw new CursorClientError('http', `Cursor returned ${response.status} for ${path}.`, response.status);
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      throw new CursorClientError('parse', `Unable to parse JSON from ${path}: ${String(error)}`);
    }
  }

  private async tryFetchTeamUsage(
    token: string,
  ): Promise<CursorPersonalUsagePayload['team'] | undefined> {
    try {
      const teams = await this.requestJson<CursorTeamsResponse>('/api/dashboard/teams', token, {
        method: 'POST',
        body: {},
      });
      const teamId = teams.teams?.[0]?.id;
      if (!teamId) {
        return undefined;
      }

      const details = await this.requestJson<CursorTeamDetailsResponse>(
        '/api/dashboard/team',
        token,
        {
          method: 'POST',
          body: { teamId },
        },
      );
      const userId = details.userId;
      if (!userId) {
        return { id: teamId };
      }

      const spend = await this.requestJson<CursorTeamSpendResponse>(
        '/api/dashboard/get-team-spend',
        token,
        {
          method: 'POST',
          body: { teamId },
        },
      );
      const member = spend.teamMemberSpend?.find((entry) => entry.userId === userId);

      return {
        id: teamId,
        member,
      };
    } catch (error) {
      this.diagnostics.info('Team usage was unavailable; continuing with personal usage only.', {
        error: String(error),
      });
      return undefined;
    }
  }
}

function buildHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Cookie: `WorkosCursorSessionToken=${token}`,
    Origin: CURSOR_BASE_URL,
    Pragma: 'no-cache',
    Referer: `${CURSOR_BASE_URL}/settings`,
  };
}

export function extractUserIdFromToken(token: string): string {
  const separator = token.indexOf('%3A%3A');
  if (separator <= 0) {
    throw new CursorClientError('parse', 'Session token format is invalid.');
  }

  return token.slice(0, separator);
}

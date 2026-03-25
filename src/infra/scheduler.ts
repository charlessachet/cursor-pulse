import type { CursorPulseConfig, RefreshResult } from '../client/types';
import type { Diagnostics } from './diagnostics';

type RefreshCallback = () => Promise<RefreshResult>;

export class RefreshScheduler {
  private intervalHandle: NodeJS.Timeout | undefined;
  private retryHandle: NodeJS.Timeout | undefined;

  public constructor(
    private readonly getConfig: () => CursorPulseConfig,
    private readonly refresh: RefreshCallback,
    private readonly diagnostics: Diagnostics,
  ) {}

  public start(): void {
    this.stop();
    this.scheduleInterval();
  }

  public async triggerImmediate(): Promise<void> {
    const result = await this.refresh();
    this.scheduleRetry(result.retryAfterMs);
  }

  public restart(): void {
    this.start();
  }

  public stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = undefined;
    }

    if (this.retryHandle) {
      clearTimeout(this.retryHandle);
      this.retryHandle = undefined;
    }
  }

  private scheduleInterval(): void {
    const intervalMs = Math.max(1, this.getConfig().pollMinutes) * 60_000;
    this.intervalHandle = setInterval(() => {
      void this.runTick();
    }, intervalMs);
    this.diagnostics.info(`Scheduled refresh every ${intervalMs / 60_000} minute(s).`);
  }

  private async runTick(): Promise<void> {
    const result = await this.refresh();
    this.scheduleRetry(result.retryAfterMs);
  }

  private scheduleRetry(retryAfterMs: number | undefined): void {
    if (this.retryHandle) {
      clearTimeout(this.retryHandle);
      this.retryHandle = undefined;
    }

    if (!retryAfterMs) {
      return;
    }

    this.retryHandle = setTimeout(() => {
      this.retryHandle = undefined;
      void this.runTick();
    }, retryAfterMs);
  }
}


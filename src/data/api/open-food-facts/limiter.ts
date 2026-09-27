// Sliding-window request budget (PROV-04). Callers retain only the latest query while `tryTake` is false.
export class RequestLimiter {
  private readonly timestamps: number[] = [];
  private cooldownUntil = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  tryTake(): boolean {
    const time = this.now();
    while (this.timestamps[0] !== undefined && this.timestamps[0]! <= time - this.windowMs) this.timestamps.shift();
    if (time < this.cooldownUntil || this.timestamps.length >= this.limit) return false;
    this.timestamps.push(time);
    return true;
  }

  /** Wait for a slot while preserving cancellation of stale Food Search requests (PROV-04/10). */
  async take(signal: AbortSignal): Promise<void> {
    if (signal.aborted) throw signal.reason;
    while (!this.tryTake()) {
      const delay = this.nextWaitMs();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          signal.removeEventListener('abort', abort);
          resolve();
        }, delay);
        const abort = () => {
          clearTimeout(timer);
          signal.removeEventListener('abort', abort);
          reject(signal.reason);
        };
        signal.addEventListener('abort', abort, { once: true });
      });
      if (signal.aborted) throw signal.reason;
    }
  }

  private nextWaitMs(): number {
    const time = this.now();
    const firstExpiry = this.timestamps[0] === undefined ? time : this.timestamps[0] + this.windowMs;
    return Math.max(1, Math.max(firstExpiry, this.cooldownUntil) - time);
  }

  cooldown(durationMs: number): void {
    this.cooldownUntil = Math.max(this.cooldownUntil, this.now() + Math.max(0, durationMs));
  }
}

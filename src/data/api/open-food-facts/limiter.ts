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

  cooldown(durationMs: number): void {
    this.cooldownUntil = Math.max(this.cooldownUntil, this.now() + Math.max(0, durationMs));
  }
}

import { RequestLimiter } from '../limiter';

describe('PROV-04 / PROV-10: OFF request budget and cooldown', () => {
  it('never exceeds its sliding-window budget and resumes after expiry', () => {
    let time = 0;
    const limiter = new RequestLimiter(2, 60_000, () => time);
    expect([limiter.tryTake(), limiter.tryTake(), limiter.tryTake()]).toEqual([true, true, false]);
    time = 60_000;
    expect(limiter.tryTake()).toBe(true);
  });

  it('pauses both request kinds while a provider cooldown is active', () => {
    let time = 1_000;
    const limiter = new RequestLimiter(8, 60_000, () => time);
    limiter.cooldown(5_000);
    expect(limiter.tryTake()).toBe(false);
    time = 6_000;
    expect(limiter.tryTake()).toBe(true);
  });
});

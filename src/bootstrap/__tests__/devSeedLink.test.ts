import { redirectSystemPath } from '@/app/+native-intent';

import { isDevSeedLink, onDevSeedRequest, requestDevSeed } from '../devSeedLink';

describe('ARCH-18 dev-only seed link', () => {
  it('matches only the dev-seed link', () => {
    expect(isDevSeedLink('calorietracker://dev-seed')).toBe(true);
    expect(isDevSeedLink('calorietracker:///dev-seed/')).toBe(true);
    expect(isDevSeedLink('/dev-seed?x=1')).toBe(true);
    expect(isDevSeedLink('calorietracker://diary')).toBe(false);
    expect(isDevSeedLink('calorietracker://dev-seeder')).toBe(false);
    expect(isDevSeedLink('exp+calorie-tracker://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081')).toBe(
      false,
    );
  });

  it('queues a request that arrives before startup, then runs each later one', () => {
    const seed = jest.fn();
    requestDevSeed();
    const unsubscribe = onDevSeedRequest(seed);
    expect(seed).toHaveBeenCalledTimes(1);
    requestDevSeed();
    expect(seed).toHaveBeenCalledTimes(2);
    unsubscribe();
    requestDevSeed(); // pending again, not delivered to the unsubscribed seeder
    expect(seed).toHaveBeenCalledTimes(2);
    const next = jest.fn();
    onDevSeedRequest(next)();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('native intent: the seed link keeps the current screen; other links pass through', () => {
    const seed = jest.fn();
    const unsubscribe = onDevSeedRequest(seed);
    expect(redirectSystemPath({ path: 'calorietracker://dev-seed', initial: false })).toBeNull();
    expect(seed).toHaveBeenCalledTimes(1);
    expect(redirectSystemPath({ path: 'calorietracker://diary', initial: false })).toBe('calorietracker://diary');
    unsubscribe();
  });
});

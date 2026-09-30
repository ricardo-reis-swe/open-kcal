import { redirectSystemPath } from '@/app/+native-intent';

import { isWidgetLink, onWidgetTodayRequest, requestWidgetToday } from '../widgetLink';

describe('NAV-10: widget link', () => {
  it('matches the widget link with or without scheme, slashes or query', () => {
    for (const path of ['calorietracker://diary/today', '/diary/today', 'diary/today/', 'diary/today?from=widget']) {
      expect(isWidgetLink(path)).toBe(true);
    }
    for (const path of ['/diary', '/diary/food-search', 'diary/todayx', '/profile/today']) {
      expect(isWidgetLink(path)).toBe(false);
    }
  });

  it('cold start → the Diary root; no request (a fresh launch is already today, NAV-05)', () => {
    const listener = jest.fn();
    const off = onWidgetTodayRequest(listener);
    expect(redirectSystemPath({ path: 'calorietracker://diary/today', initial: true })).toBe('/diary');
    expect(listener).not.toHaveBeenCalled();
    off();
  });

  it('warm → keeps the current screen and asks the Diary root', () => {
    const listener = jest.fn();
    const off = onWidgetTodayRequest(listener);
    expect(redirectSystemPath({ path: 'calorietracker://diary/today', initial: false })).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    requestWidgetToday(); // nothing mounted: dropped
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('leaves other links unchanged', () => {
    expect(redirectSystemPath({ path: '/diary/food-search', initial: false })).toBe('/diary/food-search');
  });
});

import { i18next, initI18n } from '@/shared/i18n/i18n';

import { caloriesLeftView } from '../caloriesLeftViewModel';

const t = i18next.t;

describe('UX-22: widget view model', () => {
  beforeEach(() => {
    initI18n({ language: 'en', formattingLocale: 'en-US', regionCode: 'US' });
  });

  it('shows the remaining calories, grouped like the Diary', () => {
    expect(caloriesLeftView({ goalKcal: 2400, eatenKcal: 669, unit: 'kcal' }, t, 'en-US')).toEqual({
      kind: 'left',
      value: '1,731',
      label: 'kcal left',
      a11y: '1,731 kcal left',
    });
  });

  it('shows 0 left at exactly the goal, and the amount over past it', () => {
    expect(caloriesLeftView({ goalKcal: 2000, eatenKcal: 2000, unit: 'kcal' }, t, 'en-US')).toMatchObject({
      kind: 'left',
      value: '0',
    });
    expect(caloriesLeftView({ goalKcal: 2000, eatenKcal: 2250, unit: 'kcal' }, t, 'en-US')).toEqual({
      kind: 'over',
      value: '250',
      label: 'kcal over',
      a11y: '250 kcal over',
    });
  });

  it('shows what was eaten when no goal applies to today (DATA-09)', () => {
    expect(caloriesLeftView({ goalKcal: null, eatenKcal: 450, unit: 'kcal' }, t, 'en-US')).toMatchObject({
      kind: 'eaten',
      value: '450',
      label: 'kcal eaten',
    });
  });

  it('follows the energy unit (kJ)', () => {
    expect(caloriesLeftView({ goalKcal: 2000, eatenKcal: 1000, unit: 'kJ' }, t, 'en-US')).toMatchObject({
      value: '4,184',
      label: 'kJ left',
    });
  });

  it('shows the unavailable state without data', () => {
    expect(caloriesLeftView(null, t, 'en-US')).toEqual({
      kind: 'unavailable',
      label: 'Open Calorie Tracker',
      a11y: 'Open Calorie Tracker',
    });
  });

  it('translates to pt-PT with Portuguese number formatting', () => {
    initI18n({ language: 'pt-PT', formattingLocale: 'pt-PT', regionCode: 'PT' });
    expect(caloriesLeftView({ goalKcal: 12000, eatenKcal: 669, unit: 'kcal' }, t, 'pt-PT')).toMatchObject({
      value: new Intl.NumberFormat('pt-PT').format(11331), // grouped with a narrow no-break space
      label: 'kcal restantes',
    });
    expect(caloriesLeftView(null, t, 'pt-PT').label).toBe('Abrir o Calorie Tracker');
  });
});

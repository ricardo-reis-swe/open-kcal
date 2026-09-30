// UX-22 widget states, from today's goal and consumed energy. Pure: the task handler supplies data, `t` and locale.
import type { TFunction } from 'i18next';

import type { EnergyUnit } from '@/domain/units/units';
import { formatEnergy } from '@/shared/i18n/format';

export type WidgetDay = {
  /** `null` when no goal applies to today yet (DATA-09). */
  goalKcal: number | null;
  eatenKcal: number;
  unit: EnergyUnit;
};

export type CaloriesLeftView =
  | { kind: 'left' | 'over' | 'eaten'; value: string; label: string; a11y: string }
  | { kind: 'unavailable'; label: string; a11y: string };

/** Same values and labels as the Diary ring (DS-08); `null` data → the unavailable state. */
export function caloriesLeftView(day: WidgetDay | null, t: TFunction, locale: string): CaloriesLeftView {
  if (!day) {
    const label = t('widget.unavailable');
    return { kind: 'unavailable', label, a11y: label };
  }
  const unit = t(`diary.units.${day.unit}`);
  const view = (
    kind: 'left' | 'over' | 'eaten',
    kcal: number,
    key: 'diary.ring.left' | 'diary.ring.over' | 'diary.ring.eatenNoGoal',
  ) => {
    const value = formatEnergy(kcal, day.unit, locale);
    const label = t(key, { unit });
    return { kind, value, label, a11y: `${value} ${label}` };
  };
  if (day.goalKcal === null) return view('eaten', day.eatenKcal, 'diary.ring.eatenNoGoal');
  if (day.eatenKcal > day.goalKcal) return view('over', day.eatenKcal - day.goalKcal, 'diary.ring.over');
  return view('left', day.goalKcal - day.eatenKcal, 'diary.ring.left');
}

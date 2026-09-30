import { isValidElement, type ReactElement } from 'react';

import { darkColors, lightColors } from '@/shared/theme/tokens';

import { CaloriesLeftWidget, renderCaloriesLeftWidget } from '../CaloriesLeftWidget';
import type { CaloriesLeftView } from '../caloriesLeftViewModel';

const view: CaloriesLeftView = { kind: 'over', value: '250', label: 'kcal over', a11y: '250 kcal over' };

type Props = { style: { backgroundColor?: string; color?: string }; children?: ReactElement[] };
const colorsOf = (element: ReactElement) => {
  const root = (CaloriesLeftWidget as (p: object) => ReactElement<Props>)(element.props as object);
  const [number, label] = root.props.children!.filter(Boolean) as ReactElement<Props>[];
  return {
    background: root.props.style.backgroundColor,
    number: number!.props.style.color,
    label: label!.props.style.color,
  };
};

describe('DS-14 / UX-23: widget theme', () => {
  it('System hands the launcher a light and a dark version', () => {
    const rendered = renderCaloriesLeftWidget(view, 'system') as { light: ReactElement; dark: ReactElement };
    expect(colorsOf(rendered.light)).toEqual({
      background: lightColors.surface,
      number: lightColors.warning,
      label: lightColors.textSecondary,
    });
    expect(colorsOf(rendered.dark)).toEqual({
      background: darkColors.surface,
      number: darkColors.warning,
      label: darkColors.textSecondary,
    });
  });

  it('a forced Light or Dark draws only that scheme', () => {
    const dark = renderCaloriesLeftWidget(view, 'dark');
    const light = renderCaloriesLeftWidget(view, 'light');
    expect(isValidElement(dark) && colorsOf(dark).background).toBe(darkColors.surface);
    expect(isValidElement(light) && colorsOf(light).background).toBe(lightColors.surface);
  });
});

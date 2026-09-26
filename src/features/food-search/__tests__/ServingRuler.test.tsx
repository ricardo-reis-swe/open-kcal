import { fireEvent, screen } from '@testing-library/react-native';

import type { FoodServing } from '@/data/db/repositories/foodsRepository';
import { renderWithProviders } from '@/shared/testing/render';

import { ServingRuler } from '../components/ServingRuler';

const egg: FoodServing = {
  id: 'egg',
  label: 'egg',
  quantity: 1,
  unit: 'egg',
  basisMultiplier: 0.5,
  isDefault: true,
  sortOrder: 0,
};

describe('UX-05 / DS-09 / DS-11: ServingRuler', () => {
  it('is adjustable, announces serving nutrition, and moves exactly one step', async () => {
    const onChange = jest.fn();
    const onHaptic = jest.fn();
    await renderWithProviders(
      <ServingRuler
        quantity={2}
        serving={egg}
        energyKcal={156}
        energyUnit="kcal"
        onChange={onChange}
        onOpenNumeric={jest.fn()}
        onHaptic={onHaptic}
      />,
    );
    const ruler = screen.getByRole('adjustable');
    expect(ruler.props.accessibilityLabel).toBe('Serving, 2, egg, 156 kilocalories');
    fireEvent(ruler, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenCalledWith(2.25);
    expect(onHaptic).not.toHaveBeenCalled();
  });

  it('never decrements below one step and opens direct numeric entry from the chip', async () => {
    const onChange = jest.fn();
    const onOpenNumeric = jest.fn();
    await renderWithProviders(
      <ServingRuler
        quantity={0.25}
        serving={egg}
        energyKcal={19.5}
        energyUnit="kcal"
        onChange={onChange}
        onOpenNumeric={onOpenNumeric}
      />,
    );
    fireEvent(screen.getByRole('adjustable'), 'accessibilityAction', {
      nativeEvent: { actionName: 'decrement' },
    });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('serving-ruler-value'));
    expect(onOpenNumeric).toHaveBeenCalledTimes(1);
  });
});

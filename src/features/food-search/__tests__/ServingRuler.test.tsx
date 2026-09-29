import { useState } from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { FoodServing } from '@/data/db/repositories/foodsRepository';
import { renderWithProviders } from '@/shared/testing/render';

import { RULER_DECELERATION_RATE, ServingRuler } from '../components/ServingRuler';

// Stand-in exposing the props ServingRuler passes; the real picker renders in FoodDetailScreen tests.
jest.mock('react-native-legend-ruler-picker', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { RulerPicker: (props: object) => createElement(View, { ...props, testID: 'serving-ruler-picker' }) };
});
const picker = () => screen.getByTestId('serving-ruler-picker');

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
  it('maps picker step indexes to snapped quantities without compounding parent updates', async () => {
    function ControlledRuler() {
      const [quantity, setQuantity] = useState(2);
      return (
        <ServingRuler
          quantity={quantity}
          serving={egg}
          energyKcal={quantity * 78}
          energyUnit="kcal"
          onChange={setQuantity}
          onOpenNumeric={jest.fn()}
        />
      );
    }
    await renderWithProviders(<ControlledRuler />);
    // Index 0 = one step (0.25 egg); index 13 = 3.5 egg.
    expect(picker().props.initialValue).toBe(7);
    await act(async () => picker().props.onValueChange('13'));
    await waitFor(() => expect(screen.getByTestId('serving-ruler-value')).toHaveTextContent(/3\.50\s*egg/));
    expect(picker().props.initialValue).toBe(7);
  });

  it('remounts the picker at the new index when the value is set from outside the ruler', async () => {
    let setQuantity: (quantity: number) => void = () => undefined;
    function ExternalRuler() {
      const [quantity, set] = useState(2);
      setQuantity = set;
      return (
        <ServingRuler
          quantity={quantity}
          serving={egg}
          energyKcal={quantity * 78}
          energyUnit="kcal"
          onChange={set}
          onOpenNumeric={jest.fn()}
        />
      );
    }
    await renderWithProviders(<ExternalRuler />);
    await act(async () => setQuantity(5));
    await waitFor(() => expect(picker().props.initialValue).toBe(19));
  });

  it('uses the tuned fling deceleration', async () => {
    await renderWithProviders(
      <ServingRuler
        quantity={2}
        serving={egg}
        energyKcal={156}
        energyUnit="kcal"
        onChange={jest.fn()}
        onOpenNumeric={jest.fn()}
      />,
    );
    expect(picker().props.decelerationRate).toBe(RULER_DECELERATION_RATE);
  });

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
    expect(screen.getByTestId('serving-ruler-value')).toHaveTextContent(/2\.00\s*egg/);
    expect(screen.getByTestId('serving-ruler-value').props.accessibilityLabel).toBe(
      'Enter serving value, current value 2 egg',
    );
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

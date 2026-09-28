import { useState } from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { FoodServing } from '@/data/db/repositories/foodsRepository';
import { renderWithProviders } from '@/shared/testing/render';

import { rulerIndexForOffset, ServingRuler } from '../components/ServingRuler';

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
  it('tracks multi-step drags from the gesture start without compounding parent updates', async () => {
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
    const list = screen.getByTestId('serving-ruler-list');
    list.props.onScrollBeginDrag({ nativeEvent: { contentOffset: { x: 126, y: 0 } } });
    list.props.onScroll({ nativeEvent: { contentOffset: { x: 234, y: 0 } } });
    await waitFor(() => expect(screen.getByTestId('serving-ruler-value')).toHaveTextContent(/3\.50\s*egg/));
  });

  it('changes value only as a tick crosses the fixed center pointer', () => {
    expect(rulerIndexForOffset(143.9, 126, 100)).toBe(7);
    expect(rulerIndexForOffset(144, 143.9, 100)).toBe(8);
    expect(rulerIndexForOffset(126.1, 144, 100)).toBe(8);
    expect(rulerIndexForOffset(126, 126.1, 100)).toBe(7);
  });

  it('uses native fast deceleration and exact tick snapping', async () => {
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
    expect(screen.getByTestId('serving-ruler-list').props.decelerationRate).toBe('fast');
    expect(screen.getByTestId('serving-ruler-list').props.snapToInterval).toBe(18);
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

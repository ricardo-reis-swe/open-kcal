import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { WeightGoalScreen } from '../WeightGoalScreen';

afterEach(async () => {
  await cleanup();
});

describe('UX-18 Weight Goal', () => {
  it('UX-00: validates 20–500 kg in the display unit (lb) and stores canonical kg (DATA-04)', async () => {
    const { services } = await createTestServices();
    await services.settings.updateUnits({ weightUnit: 'lb' });
    const onSaved = jest.fn();
    await renderWithServices(<WeightGoalScreen onSaved={onSaved} onBack={jest.fn()} />, services);
    const field = await screen.findByLabelText('Goal weight, lb');
    expect(screen.queryByTestId('weight-goal-clear')).toBeNull();
    await fireEvent.changeText(field, '44');
    await fireEvent(field, 'blur');
    expect(screen.getByText('Enter a weight from 44.1 to 1,102.3 lb.')).toBeOnTheScreen();
    expect(screen.getByTestId('weight-goal-save')).toBeDisabled();
    await fireEvent.changeText(field, '165');
    expect(screen.queryByText(/Enter a weight/)).toBeNull();
    await fireEvent.press(screen.getByTestId('weight-goal-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect((await services.settings.get()).goalWeightKg).toBeCloseTo(165 * 0.45359237, 6);
  });

  it('edit mode: shows the goal, Save waits for a change, Clear goal sets NULL', async () => {
    const { services } = await createTestServices();
    await services.settings.setGoalWeightKg(75);
    const onSaved = jest.fn();
    await renderWithServices(<WeightGoalScreen onSaved={onSaved} onBack={jest.fn()} />, services);
    expect((await screen.findByLabelText('Goal weight, kg')).props.value).toBe('75');
    expect(screen.getByTestId('weight-goal-save')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('weight-goal-clear'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect((await services.settings.get()).goalWeightKg).toBeNull();
  });

  it('ARCH-22: pt-PT smoke render', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<WeightGoalScreen onSaved={jest.fn()} onBack={jest.fn()} />, services, {
      language: 'pt-PT',
    });
    expect(await screen.findByRole('header', { name: 'Objetivo de peso' })).toBeOnTheScreen();
    expect(await screen.findByLabelText('Peso objetivo, kg')).toBeOnTheScreen();
    expect(screen.getByTestId('weight-goal-save')).toHaveAccessibleName('Guardar');
  });
});

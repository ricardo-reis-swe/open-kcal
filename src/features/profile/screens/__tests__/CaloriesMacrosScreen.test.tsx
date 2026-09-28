import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import type { AppServices } from '@/bootstrap/services';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { CaloriesMacrosScreen } from '../CaloriesMacrosScreen';

const CONFIRMED = { calorieTargetKcal: 1800, carbohydrateTargetG: 200, proteinTargetG: 120, fatTargetG: 60 };

async function setup(options: { confirmed?: boolean; kJ?: boolean; now?: string } = {}) {
  const { services, clock } = await createTestServices();
  if (options.confirmed) await services.goals.save(CONFIRMED);
  if (options.kJ) await services.settings.updateUnits({ energyUnit: 'kJ' });
  if (options.now) clock.set(options.now);
  const onSaved = jest.fn();
  const onCancel = jest.fn();
  await renderWithServices(<CaloriesMacrosScreen onSaved={onSaved} onCancel={onCancel} />, services);
  await screen.findByTestId('goals-save');
  return { services, onSaved, onCancel };
}

const input = (label: string) => screen.getByLabelText(label);

afterEach(async () => {
  await cleanup();
});

describe('UX-16 / NAV-06: Calories & Macros', () => {
  it('UX-16: loads the current goal with the 4/4/9 helpers under each macro', async () => {
    await setup();
    expect(input('Calories, kcal').props.value).toBe('2000');
    expect(input('Carbs, g').props.value).toBe('250');
    expect(screen.getByText('≈ 1,000 kcal · 50%')).toBeOnTheScreen();
    expect(screen.getByText('≈ 400 kcal · 20%')).toBeOnTheScreen();
    expect(screen.getByText('≈ 603 kcal · 30%')).toBeOnTheScreen();
  });

  it('UX-01: while provisional, saving unchanged confirms the defaults in place (from day one), then → Profile', async () => {
    const { services, onSaved } = await setup({ now: '2026-09-27T10:00:00.000Z' });
    const [provisional] = await services.goals.list();
    expect(screen.queryByTestId('goals-footnote')).toBeNull();
    expect(screen.getByTestId('goals-save')).toBeEnabled();
    await fireEvent.changeText(input('Protein, g'), '130');
    await fireEvent.press(screen.getByTestId('goals-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    const goals = await services.goals.list();
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      id: provisional!.id,
      effectiveFrom: provisional!.effectiveFrom,
      proteinTargetG: 130,
    });
    expect(await services.goals.isProvisional()).toBe(false);
  });

  it('DATA-09: once confirmed, Save waits for a change and a save applies from today (past days keep theirs)', async () => {
    const { services, onSaved } = await setup({ confirmed: true, now: '2026-09-27T10:00:00.000Z' });
    expect(screen.getByText('Changes apply from today. Past days keep their goals.')).toBeOnTheScreen();
    expect(screen.getByTestId('goals-save')).toBeDisabled();
    await fireEvent.changeText(input('Calories, kcal'), '2100');
    expect(screen.getByText('≈ 800 kcal · 38%')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('goals-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect((await services.goals.goalFor('2026-09-27'))?.calorieTargetKcal).toBe(2100);
    expect((await services.goals.goalFor('2026-09-26'))?.calorieTargetKcal).toBe(1800);
  });

  it('UX-00: out-of-range values show their message on blur and disable Save until fixed', async () => {
    await setup();
    await fireEvent.changeText(input('Calories, kcal'), '400');
    await fireEvent(input('Calories, kcal'), 'blur');
    expect(screen.getByText('Enter calories from 500 to 10,000 kcal.')).toBeOnTheScreen();
    await fireEvent.changeText(input('Fat, g'), '1001');
    await fireEvent(input('Fat, g'), 'blur');
    expect(screen.getByText('Enter a whole number from 0 to 1,000 g.')).toBeOnTheScreen();
    expect(screen.getByTestId('goals-save')).toBeDisabled();
    await fireEvent.changeText(input('Calories, kcal'), '1500');
    await fireEvent.changeText(input('Fat, g'), '50');
    expect(screen.queryByText(/^Enter /)).toBeNull();
    expect(screen.getByTestId('goals-save')).toBeEnabled();
  });

  it('UX-00: energy follows energy_unit (kJ); an untouched Calories field keeps the stored kcal', async () => {
    const { services, onSaved } = await setup({ confirmed: true, kJ: true });
    expect(input('Calories, kJ').props.value).toBe('7531');
    expect(screen.getByText('≈ 3,347 kJ · 44%')).toBeOnTheScreen();
    await fireEvent.changeText(input('Fat, g'), '65');
    await fireEvent.press(screen.getByTestId('goals-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(await services.goals.goalFor('2026-09-25')).toMatchObject({ calorieTargetKcal: 1800, fatTargetG: 65 });
  });

  it('UX-00 / UX-19: back on a dirty form asks Discard changes?; Keep editing stays, Discard leaves', async () => {
    const { onCancel } = await setup();
    await fireEvent.changeText(input('Carbs, g'), '220');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByText('Discard changes?')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(input('Carbs, g').props.value).toBe('220');
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it('UX-00: back on a clean form leaves without asking', async () => {
    const { onCancel } = await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });

  it('UX-00: a failed save stays on the screen with the input and an inline error', async () => {
    const { services, onSaved } = await setup();
    (services as AppServices).goals.save = jest.fn().mockRejectedValue(new Error('disk'));
    await fireEvent.changeText(input('Carbs, g'), '230');
    await fireEvent.press(screen.getByTestId('goals-save'));
    expect(await screen.findByText("Couldn't save. Try again.")).toBeOnTheScreen();
    expect(onSaved).not.toHaveBeenCalled();
    expect(input('Carbs, g').props.value).toBe('230');
  });
});

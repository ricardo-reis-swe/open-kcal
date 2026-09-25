import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import type { AppServices } from '@/bootstrap/services';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { DiaryDateProvider } from '../hooks/DiaryDateContext';
import { QuickCaloriesScreen, type QuickCaloriesMode } from '../screens/QuickCaloriesScreen';

// Component tests render the screen without a navigator; routing is covered by quick-calories.nav.test.tsx.
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), dismissTo: jest.fn(), push: jest.fn(), navigate: jest.fn() },
}));

const TODAY = '2026-09-25';

async function setup(options: { language?: 'en' | 'pt-PT'; prepare?: (s: AppServices) => Promise<void> } = {}) {
  const { services } = await createTestServices({ now: `${TODAY}T10:00:00.000Z` });
  await options.prepare?.(services);
  const lunch = (await services.meals.list())[1]!;
  const mode: QuickCaloriesMode = { kind: 'add', mealId: lunch.id, date: TODAY, origin: 'diary' };
  await renderWithServices(
    <DiaryDateProvider>
      <QuickCaloriesScreen mode={mode} />
    </DiaryDateProvider>,
    services,
    { language: options.language },
  );
  return { services, lunch };
}

beforeEach(() => jest.clearAllMocks());

describe('UX-07: Quick Calories form', () => {
  it('UX-07: shows meal, calories (focused), note and the display-only date', async () => {
    await setup();
    expect(await screen.findByRole('header', { name: 'Quick calories' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Meal, Lunch' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories, kcal').props.autoFocus).toBe(true);
    expect(screen.getByLabelText('Calories, kcal').props.keyboardType).toBe('number-pad');
    expect(screen.getByLabelText('Note').props.maxLength).toBe(80);
    expect(screen.getByLabelText('Date, Fri, Sep 25')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Delete entry' })).toBeNull();
  });

  it.each(['0', '10001', '12.5', 'abc'])(
    'UX-00: %s kcal is invalid; the message shows on blur and Add stays off',
    async (value) => {
      await setup();
      const field = await screen.findByLabelText('Calories, kcal');
      await fireEvent.changeText(field, value);
      expect(screen.queryByText('Enter a whole number from 1 to 10,000 kcal.')).toBeNull();
      await fireEvent(field, 'blur');
      expect(screen.getByText('Enter a whole number from 1 to 10,000 kcal.')).toBeOnTheScreen();
      expect(screen.getByTestId('quick-calories-submit')).toBeDisabled();
      // The message clears as soon as the value is valid (UX-00).
      await fireEvent.changeText(field, '10000');
      expect(screen.queryByText('Enter a whole number from 1 to 10,000 kcal.')).toBeNull();
      expect(screen.getByTestId('quick-calories-submit')).toBeEnabled();
    },
  );

  it('UX-00: in kJ the field and the range follow the energy unit; kcal is stored canonically', async () => {
    const { services, lunch } = await setup({
      prepare: (s) => s.settings.updateUnits({ energyUnit: 'kJ' }).then(() => undefined),
    });
    const field = await screen.findByLabelText('Calories, kJ');
    await fireEvent.changeText(field, '4');
    await fireEvent(field, 'blur');
    expect(screen.getByText('Enter a whole number from 5 to 41,840 kJ.')).toBeOnTheScreen();
    await fireEvent.changeText(field, '4184');
    await fireEvent.press(screen.getByTestId('quick-calories-submit'));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/diary'));
    const day = await services.diary.loadDay(TODAY);
    const entry = day.meals.find((m) => m.meal.id === lunch.id)!.entries[0]!;
    expect(entry.nutrients.energyKcal).toBeCloseTo(1000, 9);
  });

  it('UX-00: a save failure stays on the screen, keeps the input and shows the inline error', async () => {
    const { services } = await setup();
    jest.spyOn(services.diary, 'addQuickCalories').mockRejectedValueOnce(new Error('disk full'));
    await fireEvent.changeText(await screen.findByLabelText('Calories, kcal'), '450');
    await fireEvent.press(screen.getByTestId('quick-calories-submit'));
    expect(await screen.findByText("Couldn't save. Try again.")).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories, kcal').props.value).toBe('450');
    expect(router.dismissTo).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });

  it('ARCH-22: pt-PT smoke render', async () => {
    await setup({ language: 'pt-PT' });
    expect(await screen.findByRole('header', { name: 'Calorias rápidas' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: /^Refeição, / })).toBeOnTheScreen();
    expect(screen.getByLabelText('Nota')).toBeOnTheScreen();
    expect(screen.getByTestId('quick-calories-submit')).toHaveAccessibleName('Adicionar');
  });
});

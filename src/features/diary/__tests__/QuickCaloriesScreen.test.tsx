import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
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

type SetupOptions = {
  language?: 'en' | 'pt-PT';
  prepare?: (s: AppServices) => Promise<void>;
  /** Edit mode for the entry this returns; add mode on Lunch when omitted. */
  editEntry?: (s: AppServices, lunchId: string) => Promise<string>;
  origin?: 'diary' | 'mealDetail';
};

async function setup(options: SetupOptions = {}) {
  const { services } = await createTestServices({ now: `${TODAY}T10:00:00.000Z` });
  await options.prepare?.(services);
  const lunch = (await services.meals.list())[1]!;
  const origin = options.origin ?? 'diary';
  const mode: QuickCaloriesMode = options.editEntry
    ? { kind: 'edit', entryId: await options.editEntry(services, lunch.id), origin }
    : { kind: 'add', mealId: lunch.id, date: TODAY, origin };
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
    expect(screen.getByLabelText('Date, Fri 25 Sep')).toBeOnTheScreen();
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

const addLunchEntry = (energyKcal: number, note?: string) => async (s: AppServices, lunchId: string) =>
  (await s.diary.addQuickCalories({ diaryDate: TODAY, mealId: lunchId, energyKcal, note })).id;

describe('UX-07: Edit quick calories', () => {
  it('UX-07: shows the stored values and Delete entry; Save stays off until something changes', async () => {
    await setup({ editEntry: addLunchEntry(450, 'Canteen') });
    expect(await screen.findByRole('header', { name: 'Edit quick calories' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: 'Meal, Lunch' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Calories, kcal').props.value).toBe('450');
    expect(screen.getByLabelText('Note').props.value).toBe('Canteen');
    expect(screen.getByLabelText('Date, Fri 25 Sep')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete entry' })).toBeOnTheScreen();
    expect(screen.getByTestId('quick-calories-submit')).toBeDisabled();
    expect(screen.getByTestId('quick-calories-submit')).toHaveAccessibleName('Save');
  });

  it('UX-00: in kJ, an untouched Calories field keeps the stored kcal exactly', async () => {
    const { services } = await setup({
      prepare: (s) => s.settings.updateUnits({ energyUnit: 'kJ' }).then(() => undefined),
      editEntry: addLunchEntry(450),
    });
    // 450 kcal shows as 1,883 kJ; re-parsing that would store 450.05 kcal.
    expect((await screen.findByLabelText('Calories, kJ')).props.value).toBe('1883');
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Soup');
    await fireEvent.press(screen.getByTestId('quick-calories-submit'));
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    const entry = (await services.diary.loadDay(TODAY)).meals.flatMap((m) => m.entries)[0]!;
    expect(entry.nutrients.energyKcal).toBe(450);
    expect(entry.note).toBe('Soup');
  });

  it('NAV-04: a meal change from Meal Detail lands on the Diary instead of going back', async () => {
    await setup({ editEntry: addLunchEntry(450), origin: 'mealDetail' });
    await fireEvent.press(await screen.findByRole('button', { name: 'Meal, Lunch' }));
    await fireEvent.press(within(await screen.findByTestId('meal-picker')).getByRole('button', { name: 'Dinner' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Meal, Dinner' })).toBeOnTheScreen());
    await fireEvent.press(screen.getByTestId('quick-calories-submit'));
    await waitFor(() => expect(router.dismissTo).toHaveBeenCalledWith('/diary'));
    expect(router.back).not.toHaveBeenCalled();
  });

  it('UX-00 / NAV-08: a delete failure stays on the screen and shows the inline error', async () => {
    const { services } = await setup({ editEntry: addLunchEntry(450) });
    jest.spyOn(services.diary, 'deleteEntry').mockRejectedValueOnce(new Error('disk full'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete entry' }));
    await fireEvent.press(
      within(screen.getByTestId('quick-calories-delete-dialog')).getByRole('button', { name: 'Delete entry' }),
    );
    expect(await screen.findByText("Couldn't delete. Try again.")).toBeOnTheScreen();
    expect(router.back).not.toHaveBeenCalled();
    expect((await services.diary.loadDay(TODAY)).meals.flatMap((m) => m.entries)).toHaveLength(1);
  });

  it('UX-00: a food entry ID shows not found (only Quick Calories entries open here)', async () => {
    await setup({
      editEntry: async (s, lunchId) => {
        const food = await s.foods.createCustom({
          name: 'Rice',
          basisQuantity: 100,
          basisUnit: 'g',
          nutrients: { energyKcal: 130, carbohydrateG: 28, proteinG: 2.7, fatG: 0.3 },
          servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
        });
        const entry = await s.diary.addFoodEntry({
          diaryDate: TODAY,
          mealId: lunchId,
          foodId: food.id,
          servingId: food.servings[0]!.id,
          quantity: 100,
        });
        return entry.id;
      },
    });
    expect(await screen.findByText('This item no longer exists.')).toBeOnTheScreen();
    expect(screen.queryByLabelText('Calories, kcal')).toBeNull();
  });
});

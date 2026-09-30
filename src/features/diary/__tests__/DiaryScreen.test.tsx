import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { AppServices } from '@/bootstrap/services';
import { addDays, localDateTime } from '@/shared/dates';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { DiaryDateProvider } from '../hooks/DiaryDateContext';
import { DiaryScreen } from '../screens/DiaryScreen';
import { shouldOpenDeleteAction } from '@/shared/components/SwipeToDelete';

// Component tests render the screen without a navigator; tab presses are covered by diary-date.nav.test.tsx.
jest.mock('expo-router', () => {
  const navigation = { getParent: () => undefined, isFocused: () => true };
  return { ...jest.requireActual('expo-router'), useNavigation: () => navigation };
});

jest.mock('@react-native-community/datetimepicker', () => jest.requireActual('@/shared/testing/datePickerMock'));

const TODAY = '2026-09-25';

async function setup(seed?: (services: AppServices) => Promise<void>, language?: 'en' | 'pt-PT') {
  const { services } = await createTestServices({ now: `${TODAY}T10:00:00.000Z` });
  await seed?.(services);
  await renderWithServices(
    <DiaryDateProvider>
      <DiaryScreen />
    </DiaryDateProvider>,
    services,
    { language },
  );
  return services;
}

const active = () => within(screen.getByTestId('diary-page-active'));

async function addEggs(services: AppServices, date: string, mealIndex: number, quantity: number) {
  const meals = await services.meals.list();
  const food = await services.foods.createCustom({
    name: 'Scrambled eggs',
    basisQuantity: 100,
    basisUnit: 'g',
    nutrients: { energyKcal: 149, carbohydrateG: 1.6, proteinG: 10, fatG: 11 },
    servings: [{ label: 'egg', quantity: 1, unit: 'egg', basisMultiplier: 0.67, isDefault: true }],
  });
  await services.diary.addFoodEntry({
    diaryDate: date,
    mealId: meals[mealIndex]!.id,
    foodId: food.id,
    servingId: food.servings[0]!.id,
    quantity,
  });
  return meals;
}

describe('UX-02 Diary', () => {
  it('UX-02: an empty day shows every meal with 0 kcal, its header +, and a compact empty line', async () => {
    await setup();
    for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
      expect(await active().findByRole('header', { name: `${meal}, 0 kilocalories` })).toBeOnTheScreen();
      expect(active().getByRole('button', { name: `Add food to ${meal}` })).toBeOnTheScreen();
    }
    expect(active().getAllByText('No foods logged')).toHaveLength(4);
    expect(active().queryByRole('button', { name: 'Add food' })).toBeNull();
    expect(active().getByLabelText('Calories remaining, 2,000 of 2,000 kilocalories. 0 eaten.')).toBeOnTheScreen();
    expect(active().queryByText('0 eaten')).toBeNull();
    await fireEvent.press(active().getByTestId('calorie-ring'));
    expect(active().getByText('Consumed')).toBeOnTheScreen();
    expect(active().getByText('0/2,000 kcal')).toBeOnTheScreen();
  });

  it('UX-02 / DS-08: entries render under their meal with one coherent label', async () => {
    const services = await setup(async (s) => void (await addEggs(s, TODAY, 0, 2)));
    const entry = (await services.diary.loadDay(TODAY)).meals[0]!.entries[0]!;
    expect(await active().findByLabelText('Scrambled eggs, 2 × egg, 200 kilocalories')).toBeOnTheScreen();
    expect(active().getByRole('header', { name: 'Breakfast, 200 kilocalories' })).toBeOnTheScreen();
    expect(active().getByTestId(`diary-entry-${entry.id}-details`)).toHaveTextContent('2 × egg200 kcal');
  });

  it('DS-08: a released swipe opens the Delete action past half its width or on a left fling', () => {
    expect(shouldOpenDeleteAction(-43, 0)).toBe(false);
    expect(shouldOpenDeleteAction(-44, 0)).toBe(true);
    expect(shouldOpenDeleteAction(-10, -800)).toBe(true);
    expect(shouldOpenDeleteAction(-80, 800)).toBe(false);
  });

  it('UX-02: a swipe reveals Delete; tapping it deletes and offers Undo', async () => {
    const services = await setup(async (s) => void (await addEggs(s, TODAY, 0, 2)));
    const entry = (await services.diary.loadDay(TODAY)).meals[0]!.entries[0]!;
    const swipe = `diary-entry-${entry.id}-swipe`;
    await active().findByTestId(`diary-entry-${entry.id}`);
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`${swipe}-pan`), [
        { state: State.BEGAN, translationX: 0, velocityX: 0 },
        { state: State.ACTIVE, translationX: -20, velocityX: -200 },
        { state: State.ACTIVE, translationX: -80, velocityX: -200 },
        { state: State.END, translationX: -80, velocityX: -200 },
      ]);
    });
    // Revealing alone deletes nothing.
    expect(active().getByTestId(`diary-entry-${entry.id}`)).toBeOnTheScreen();
    await fireEvent.press(active().getByTestId(`${swipe}-delete`));
    await waitFor(() => expect(screen.queryByTestId(`diary-entry-${entry.id}`)).toBeNull());
    expect(screen.getByTestId('diary-delete-undo')).toHaveTextContent('Scrambled eggs deletedUndo');
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(await active().findByTestId(`diary-entry-${entry.id}`)).toBeOnTheScreen();
  });

  it('UX-02: tapping an open row closes it without opening the entry', async () => {
    const services = await setup(async (s) => void (await addEggs(s, TODAY, 0, 2)));
    const entry = (await services.diary.loadDay(TODAY)).meals[0]!.entries[0]!;
    const swipe = `diary-entry-${entry.id}-swipe`;
    await active().findByTestId(`diary-entry-${entry.id}`);
    await act(async () => {
      fireGestureHandler(getByGestureTestId(`${swipe}-pan`), [
        { state: State.BEGAN, translationX: 0, velocityX: 0 },
        { state: State.ACTIVE, translationX: -20, velocityX: -200 },
        { state: State.ACTIVE, translationX: -80, velocityX: -200 },
        { state: State.END, translationX: -80, velocityX: -200 },
      ]);
    });
    await fireEvent.press(active().getByTestId(`${swipe}-close`));
    expect(active().queryByTestId(`${swipe}-close`)).toBeNull();
    expect(active().getByTestId(`diary-entry-${entry.id}`)).toBeOnTheScreen();
  });

  it('UX-02: the delete accessibility action deletes immediately and offers Undo', async () => {
    const services = await setup(async (s) => void (await addEggs(s, TODAY, 0, 2)));
    const entry = (await services.diary.loadDay(TODAY)).meals[0]!.entries[0]!;
    const row = await active().findByTestId(`diary-entry-${entry.id}`);
    await fireEvent.press(active().getByTestId(`diary-entry-${entry.id}-menu`));
    expect(await screen.findByRole('button', { name: 'Copy item' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByTestId('diary-actions-sheet')).toBeNull());

    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    await waitFor(() => expect(screen.queryByTestId(`diary-entry-${entry.id}`)).toBeNull());
    expect(screen.getByTestId('diary-delete-undo')).toHaveTextContent('Scrambled eggs deletedUndo');
    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(await active().findByTestId(`diary-entry-${entry.id}`)).toBeOnTheScreen();
  });

  it('UX-12: Copy item selects the date and then the destination meal', async () => {
    const services = await setup(async (s) => void (await addEggs(s, TODAY, 0, 2)));
    const entry = (await services.diary.loadDay(TODAY)).meals[0]!.entries[0]!;
    await fireEvent.press(await active().findByTestId(`diary-entry-${entry.id}-menu`));
    await fireEvent.press(await screen.findByRole('button', { name: 'Copy item' }));
    expect(await screen.findByRole('header', { name: 'Copy Scrambled eggs to' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Tomorrow ·/ }));
    const mealPicker = await screen.findByTestId('meal-picker');
    await fireEvent.press(within(mealPicker).getByRole('button', { name: 'Lunch' }));
    expect(await screen.findByText(/^Copied 1 item to Lunch/)).toBeOnTheScreen();
    // DS-10: the confirmation is a transient toast, not a status left above the meal.
    expect(screen.getByTestId('diary-toast')).toHaveTextContent(/^Copied 1 item to Lunch/);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    const tomorrow = await services.diary.loadDay(addDays(TODAY, 1));
    expect(tomorrow.meals[1]!.entries).toEqual([expect.objectContaining({ name: 'Scrambled eggs' })]);
  });

  it('UX-02: a failed delete keeps the row and shows a transient error without Undo', async () => {
    const services = await setup(async (s) => void (await addEggs(s, TODAY, 0, 2)));
    const entry = (await services.diary.loadDay(TODAY)).meals[0]!.entries[0]!;
    jest.spyOn(services.diary, 'deleteEntry').mockRejectedValueOnce(new Error('disk'));
    const row = await active().findByTestId(`diary-entry-${entry.id}`);
    await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
    expect(await screen.findByTestId('diary-toast')).toHaveTextContent("Couldn't delete. Try again.");
    expect(active().getByTestId(`diary-entry-${entry.id}`)).toBeOnTheScreen();
  });

  it('DS-08: Quick Calories rows show the note first and state unknown macros', async () => {
    await setup(async (s) => {
      const [, lunch] = await s.meals.list();
      await s.diary.addQuickCalories({ diaryDate: TODAY, mealId: lunch!.id, energyKcal: 650, note: 'Canteen lunch' });
    });
    expect(
      await active().findByLabelText('Canteen lunch, Quick Calories, 650 kilocalories. Macros unknown.'),
    ).toBeOnTheScreen();
    // Product choice: show the known sum as 0 while retaining the incomplete-data explanation.
    expect(active().getByLabelText('Protein, 0 of 100 grams. Some entries have unknown protein.')).toBeOnTheScreen();
    expect(active().getByText('0/100 g')).toBeOnTheScreen();
  });

  it('DATA-06: a mix of known and unknown macros is a partial total, stated in the label', async () => {
    await setup(async (s) => {
      const meals = await addEggs(s, TODAY, 0, 2);
      await s.diary.addQuickCalories({ diaryDate: TODAY, mealId: meals[1]!.id, energyKcal: 300 });
    });
    expect(
      await active().findByLabelText('Protein, 13 of 100 grams. Some entries have unknown protein.'),
    ).toBeOnTheScreen();
    expect(active().getByText('13/100 g')).toBeOnTheScreen();
  });

  it('DS-08 / DS-03: over goal shows the amount over, not a bare red ring', async () => {
    await setup(async (s) => {
      const [, , dinner] = await s.meals.list();
      await s.diary.addQuickCalories({ diaryDate: TODAY, mealId: dinner!.id, energyKcal: 2450 });
    });
    expect(
      await active().findByLabelText('Over calorie goal by 450 kilocalories. Goal 2,000, 2,450 eaten.'),
    ).toBeOnTheScreen();
    expect(active().getByText('kcal over')).toBeOnTheScreen();
  });

  it('UX-01: the default-goals row shows while goals are provisional', async () => {
    await setup();
    expect(await active().findByText('Using default goals')).toBeOnTheScreen();
  });

  it('UX-01: the default-goals row disappears after the first goal save', async () => {
    await setup(async (s) => {
      await s.goals.save({ calorieTargetKcal: 2200, carbohydrateTargetG: 250, proteinTargetG: 120, fatTargetG: 70 });
    });
    expect(await active().findByLabelText(/Calories remaining, 2,200 of 2,200/)).toBeOnTheScreen();
    expect(active().queryByText('Using default goals')).toBeNull();
  });

  it('DATA-09: a date before any goal shows eaten calories and no target', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Previous day, Yesterday' }));
    expect(await active().findByLabelText('Calories eaten, 0 kilocalories.')).toBeOnTheScreen();
    expect(active().queryByText('No goal for this date')).toBeNull();
    expect(active().getByLabelText('Carbs, 0 grams.')).toBeOnTheScreen();
  });

  it('UX-02 / NAV-05: prev/next move one day; Today shows only off today and returns', async () => {
    await setup(async (s) => void (await addEggs(s, addDays(TODAY, 1), 1, 1)));
    expect(screen.getByLabelText('Showing Today')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Go to today' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Next day, Tomorrow' }));
    expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();
    expect(await active().findByRole('header', { name: 'Lunch, 100 kilocalories' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: /^Next day, / }));
    expect(screen.getByLabelText(/^Showing Sun 27 Sep/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Go to today' }));
    expect(screen.getByLabelText('Showing Today')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Go to today' })).toBeNull();
  });

  it('UX-02: the overview chevrons select adjacent days without a swipe pager', async () => {
    await setup(async (s) => void (await addEggs(s, addDays(TODAY, -1), 0, 1)));
    expect(screen.queryByLabelText('Scrambled eggs, 1 × egg, 100 kilocalories')).toBeNull();
    await fireEvent.press(await active().findByTestId('diary-overview-previous'));
    expect(await screen.findByLabelText('Scrambled eggs, 1 × egg, 100 kilocalories')).toBeOnTheScreen();
  });

  it('UX-02: a DB load failure is full-screen with Retry', async () => {
    const services = await setup(async (s) => {
      const loadDay = s.diary.loadDay.bind(s.diary);
      let failedToday = false;
      s.diary.loadDay = async (date) => {
        if (date === TODAY && !failedToday) {
          failedToday = true;
          throw new Error('disk I/O error');
        }
        return loadDay(date);
      };
    });
    expect(await active().findByText("Couldn't load this day.")).toBeOnTheScreen();
    await fireEvent.press(active().getByRole('button', { name: 'Retry' }));
    expect(await active().findByRole('header', { name: 'Breakfast, 0 kilocalories' })).toBeOnTheScreen();
    expect(services).toBeDefined();
  });

  it('keeps the immediately previous and next days mounted for instant navigation', async () => {
    await setup();
    expect(
      screen.getByTestId(`diary-page-preloaded-${addDays(TODAY, -1)}`, { includeHiddenElements: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByTestId(`diary-page-preloaded-${addDays(TODAY, 1)}`, { includeHiddenElements: true }),
    ).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Next day, Tomorrow' }));
    expect(
      screen.getByTestId(`diary-page-preloaded-${addDays(TODAY, 2)}`, { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  it('ARCH-22: pt-PT smoke render', async () => {
    await setup(undefined, 'pt-PT');
    expect(await active().findAllByText('Sem alimentos registados')).toHaveLength(4);
    expect(screen.getByLabelText('A mostrar Hoje')).toBeOnTheScreen();
    expect(active().getByText('A usar objetivos predefinidos')).toBeOnTheScreen();
  });

  it('UX-02 / NAV-05: Choose date opens the picker on the active date; Done shows that date', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Next day, Tomorrow' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose date' }));
    const calendar = await screen.findByTestId('date-picker-calendar');
    expect(calendar.props.value).toEqual(localDateTime('2026-09-26', 12));
    await fireEvent(calendar, 'onChange', { type: 'set' }, localDateTime('2027-03-01', 12));
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByLabelText(/^Showing Mon,? (1 Mar|Mar 1),? 2027$/)).toBeOnTheScreen();
    expect(await active().findByRole('header', { name: 'Breakfast, 0 kilocalories' })).toBeOnTheScreen();
  });

  it('NAV-05: in the picker, Cancel keeps the date and Today is the Today action', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Next day, Tomorrow' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Choose date' }));
    await fireEvent.press(await screen.findByTestId('date-picker-cancel'));
    expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Choose date' }));
    await fireEvent.press(await screen.findByTestId('date-picker-today'));
    expect(screen.getByLabelText('Showing Today')).toBeOnTheScreen();
  });

  it('UX-02 / DS-08: the chevron opens the nutrient panel with the day totals and remembers it', async () => {
    const services = await setup(async (s) => {
      const [breakfast, lunch] = await s.meals.list();
      const oats = await s.foods.createCustom({
        name: 'Oats',
        basisQuantity: 100,
        basisUnit: 'g',
        nutrients: { energyKcal: 380, carbohydrateG: 60, proteinG: 13, fatG: 7, extra: { fibre: 10, salt: 0.1 } },
        servings: [{ label: 'g', quantity: 1, unit: 'g', basisMultiplier: 0.01, isDefault: true }],
      });
      await s.diary.addFoodEntry({
        diaryDate: TODAY,
        mealId: breakfast!.id,
        foodId: oats.id,
        servingId: oats.servings[0]!.id,
        quantity: 50,
      });
      await s.diary.addQuickCalories({ diaryDate: TODAY, mealId: lunch!.id, energyKcal: 300 });
    });
    const toggle = await active().findByRole('button', { name: 'Show more nutrients' });
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
    expect(active().queryByTestId('nutrient-panel')).toBeNull();
    await fireEvent.press(toggle);
    const panel = await active().findByTestId('nutrient-panel');
    // DATA-21 default order; the Quick Calories entry makes every total partial (DATA-06).
    expect(
      within(panel)
        .getAllByTestId(/^nutrient-panel-/)
        .map((item) => item.props.testID),
    ).toEqual(['nutrient-panel-fibre', 'nutrient-panel-sugars', 'nutrient-panel-saturated_fat', 'nutrient-panel-salt']);
    expect(within(panel).getByTestId('nutrient-panel-fibre')).toHaveTextContent('Fibre5 g');
    expect(within(panel).getByLabelText("Fibre, 5 grams. Some entries don't list it.")).toBeOnTheScreen();
    expect(active().getByRole('button', { name: 'Hide more nutrients' }).props.accessibilityState).toMatchObject({
      expanded: true,
    });
    await waitFor(async () => expect(await services.settings.getDashboardNutrientsOpen()).toBe(true));
  });

  it('DS-08: no visible dashboard nutrients → no chevron and no panel', async () => {
    await setup(async (s) => {
      const none = (await s.settings.getDashboardNutrients()).map(({ id }) => ({ id, visible: false }));
      await s.settings.setDashboardNutrients(none);
      await s.settings.setDashboardNutrientsOpen(true);
    });
    await active().findByTestId('macro-strip');
    expect(active().queryByTestId('diary-nutrients-toggle')).toBeNull();
    expect(active().queryByTestId('nutrient-panel')).toBeNull();
  });
});

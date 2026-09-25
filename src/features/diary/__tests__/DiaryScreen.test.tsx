import { fireEvent, screen, within } from '@testing-library/react-native';

import type { AppServices } from '@/bootstrap/services';
import { addDays, localDateTime } from '@/shared/dates';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { DiaryDateProvider } from '../hooks/DiaryDateContext';
import { DiaryScreen } from '../screens/DiaryScreen';

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
  it('UX-02: an empty day shows every meal with 0 kcal and an Add food row', async () => {
    await setup();
    for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snacks']) {
      expect(await active().findByRole('header', { name: `${meal}, 0 kilocalories` })).toBeOnTheScreen();
      expect(active().getByRole('button', { name: `Add food to ${meal}` })).toBeOnTheScreen();
    }
    expect(active().getAllByRole('button', { name: 'Add food' })).toHaveLength(4);
    expect(active().getByLabelText('Calories remaining, 2,000 of 2,000 kilocalories. 0 eaten.')).toBeOnTheScreen();
  });

  it('UX-02 / DS-08: entries render under their meal with one coherent label', async () => {
    await setup(async (s) => void (await addEggs(s, TODAY, 0, 2)));
    expect(await active().findByLabelText('Scrambled eggs, 2 × egg, 200 kilocalories')).toBeOnTheScreen();
    expect(active().getByRole('header', { name: 'Breakfast, 200 kilocalories' })).toBeOnTheScreen();
    expect(active().getByText('2 × egg')).toBeOnTheScreen();
  });

  it('DS-08: Quick Calories rows show the note first and state unknown macros', async () => {
    await setup(async (s) => {
      const [, lunch] = await s.meals.list();
      await s.diary.addQuickCalories({ diaryDate: TODAY, mealId: lunch!.id, energyKcal: 650, note: 'Canteen lunch' });
    });
    expect(
      await active().findByLabelText('Canteen lunch, Quick Calories, 650 kilocalories. Macros unknown.'),
    ).toBeOnTheScreen();
    // DATA-06: the macro totals are partial, which the strip states for each macro.
    expect(active().getByLabelText('Protein, 0 of 100 grams. Some entries have unknown protein.')).toBeOnTheScreen();
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
    expect(await active().findByLabelText('Calories eaten, 0 kilocalories. No goal for this date.')).toBeOnTheScreen();
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
    expect(screen.getByLabelText(/^Showing Sun,? (27 Sep|Sep 27)/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Go to today' }));
    expect(screen.getByLabelText('Showing Today')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Go to today' })).toBeNull();
  });

  it('UX-02: adjacent days are pre-rendered', async () => {
    await setup(async (s) => void (await addEggs(s, addDays(TODAY, -1), 0, 1)));
    // The previous page is mounted (with its data) before any swipe.
    expect(await screen.findByLabelText('Scrambled eggs, 1 × egg, 100 kilocalories')).toBeOnTheScreen();
  });

  it('UX-02: a DB load failure is full-screen with Retry', async () => {
    const services = await setup(async (s) => {
      const loadDay = s.diary.loadDay.bind(s.diary);
      let failures = 3; // the selected day and both pre-rendered neighbours
      s.diary.loadDay = async (date) => {
        if (failures > 0) {
          failures -= 1;
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

  it('ARCH-22: pt-PT smoke render', async () => {
    await setup(undefined, 'pt-PT');
    expect(await active().findAllByRole('button', { name: 'Adicionar alimento' })).toHaveLength(4);
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
});

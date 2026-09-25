import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useState } from 'react';

import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { GlobalAddFlow } from '../components/GlobalAddFlow';
import { DiaryDateProvider } from '../hooks/DiaryDateContext';

// The multi-meal picker path and the routes it ends on are covered by quick-calories.nav.test.tsx.
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { back: jest.fn(), dismissTo: jest.fn(), push: jest.fn(), navigate: jest.fn() },
}));

const TODAY = '2026-09-25';

function Harness() {
  const [open, setOpen] = useState(true);
  return <GlobalAddFlow open={open} onClose={() => setOpen(false)} />;
}

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('UX-10: Meal Picker skip', () => {
  it('UX-10: with exactly one meal, Quick calories skips the Meal Picker and opens the form for that meal', async () => {
    const { services } = await createTestServices({ now: `${TODAY}T10:00:00.000Z` });
    const [breakfast, ...rest] = await services.meals.list();
    for (const meal of rest) await services.meals.delete(meal.id, null);
    expect(await services.meals.list()).toHaveLength(1);

    jest.useFakeTimers();
    await renderWithServices(
      <DiaryDateProvider>
        <Harness />
      </DiaryDateProvider>,
      services,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Quick calories' }));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({ params: expect.objectContaining({ mealId: breakfast!.id, date: TODAY }) }),
      ),
    );
    expect(screen.queryByTestId('meal-picker')).toBeNull();
  });
});

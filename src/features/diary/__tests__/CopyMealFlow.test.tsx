import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { CopyMealFlow } from '../components/CopyMealFlow';

jest.mock('@react-native-community/datetimepicker', () => jest.requireActual('@/shared/testing/datePickerMock'));

const TODAY = '2026-09-25';

async function setup(language: 'en' | 'pt-PT', mealId?: string) {
  const { services } = await createTestServices({ now: `${TODAY}T10:00:00.000Z` });
  const lunch = (await services.meals.list())[1]!;
  const onCopied = jest.fn();
  const onError = jest.fn();
  function Harness() {
    const [visible, setVisible] = useState(true);
    return (
      <CopyMealFlow
        visible={visible}
        mealId={mealId ?? lunch.id}
        mealName={lunch.name}
        date={TODAY}
        today={TODAY}
        onClose={() => setVisible(false)}
        onCopied={onCopied}
        onError={onError}
      />
    );
  }
  await renderWithServices(<Harness />, services, { language });
  return { onCopied, onError };
}

describe('UX-12 Copy Meal Sheet', () => {
  it('UX-12: absolute Today / Tomorrow rows with short dates', async () => {
    await setup('en');
    expect(await screen.findByRole('header', { name: 'Copy Lunch to' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Today · Fri 25 Sep' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tomorrow · Sat 26 Sep' })).toBeOnTheScreen();
  });

  it('ARCH-22: pt-PT smoke render', async () => {
    await setup('pt-PT');
    expect(await screen.findByRole('header', { name: 'Copiar Lunch para' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Hoje · / })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^Amanhã · / })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Escolher data…' })).toBeOnTheScreen();
  });

  it('UX-00: a failed copy (meal no longer exists) reports an error, not success', async () => {
    const { onCopied, onError } = await setup('en', 'no-such-meal');
    await fireEvent.press(await screen.findByTestId('copy-meal-tomorrow'));
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      });
    }
    expect(onError).toHaveBeenCalledWith("Couldn't copy. Try again.");
    expect(onCopied).not.toHaveBeenCalled();
  });
});

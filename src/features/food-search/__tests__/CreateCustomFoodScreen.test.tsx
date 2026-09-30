import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { CreateCustomFoodScreen } from '../screens/CreateCustomFoodScreen';

async function setup(options: { initialName?: string; language?: 'en' | 'pt-PT' } = {}) {
  const { services } = await createTestServices();
  const onSaved = jest.fn();
  await renderWithServices(
    <CreateCustomFoodScreen initialName={options.initialName} onCancel={jest.fn()} onSaved={onSaved} />,
    services,
    { language: options.language },
  );
  return { services, onSaved };
}

describe('UX-08: Create Custom Food', () => {
  it('renders the prefilled, accessible form with its required nutrition guidance', async () => {
    await setup({ initialName: 'Eggs' });
    expect(await screen.findByRole('header', { name: 'New food' })).toBeTruthy();
    expect(screen.getByTestId('custom-food-name').props.value).toBe('Eggs');
    expect(screen.getByRole('radio', { name: 'g' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByRole('radio', { name: 'Other…' })).toBeTruthy();
    expect(screen.getByText('As on EU labels (fibre not included)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState.disabled).toBe(true);
  });

  it('ARCH-22: renders the form in pt-PT', async () => {
    await setup({ language: 'pt-PT' });
    expect(await screen.findByRole('header', { name: 'Novo alimento' })).toBeTruthy();
    expect(screen.getByText('Como nos rótulos da UE (fibra não incluída)')).toBeTruthy();
  });

  it('UX-08: More nutrients is collapsed, opens grouped optional fields, and saves them with the food', async () => {
    const { services, onSaved } = await setup({ initialName: 'Oat bar' });
    const toggle = await screen.findByTestId('custom-food-more-nutrients');
    expect(toggle.props.accessibilityState).toMatchObject({ expanded: false });
    expect(screen.queryByTestId('custom-food-nutrients')).toBeNull();
    await fireEvent.press(toggle);
    const section = screen.getByTestId('custom-food-nutrients');
    expect(within(section).getByRole('header', { name: 'Minerals' })).toBeTruthy();
    expect(screen.queryByTestId('custom-food-nutrient-sodium')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('custom-food-serving'), '40');
    await fireEvent.changeText(screen.getByTestId('custom-food-energy'), '160');
    await fireEvent.changeText(screen.getByTestId('custom-food-nutrient-fibre'), '2');
    await fireEvent.changeText(screen.getByTestId('custom-food-nutrient-salt'), '0.2');
    await waitFor(() => expect(screen.getByTestId('custom-food-save')).toBeEnabled());
    await fireEvent.press(screen.getByTestId('custom-food-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const saved = await services.foods.get(onSaved.mock.calls[0][0].id);
    // Per the 40 g serving; sodium derived from salt (DATA-20).
    expect(saved.nutrients.extra).toEqual({ fibre: 2, salt: 0.2, sodium: 80 });
  });

  it('UX-08: an out-of-range nutrient blocks Save and explains the range in its unit', async () => {
    await setup({ initialName: 'Oat bar' });
    await fireEvent.press(await screen.findByTestId('custom-food-more-nutrients'));
    await fireEvent.changeText(screen.getByTestId('custom-food-serving'), '40');
    await fireEvent.changeText(screen.getByTestId('custom-food-energy'), '160');
    await fireEvent.changeText(screen.getByTestId('custom-food-nutrient-iron'), '2000000');
    await fireEvent(screen.getByTestId('custom-food-nutrient-iron'), 'blur');
    expect(await screen.findByText('Enter an amount from 0 to 1,000,000 mg.')).toBeTruthy();
    expect(screen.getByTestId('custom-food-save')).toBeDisabled();
  });
});

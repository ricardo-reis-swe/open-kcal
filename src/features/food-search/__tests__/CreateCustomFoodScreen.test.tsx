import { screen } from '@testing-library/react-native';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { CreateCustomFoodScreen } from '../screens/CreateCustomFoodScreen';

async function setup(options: { initialName?: string; language?: 'en' | 'pt-PT' } = {}) {
  const { services } = await createTestServices();
  await renderWithServices(
    <CreateCustomFoodScreen initialName={options.initialName} onCancel={jest.fn()} onSaved={jest.fn()} />,
    services,
    { language: options.language },
  );
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
});

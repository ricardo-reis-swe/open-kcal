import { cleanup, fireEvent, screen } from '@testing-library/react-native';

import type { CredentialsService } from '@/data/secure-storage/credentialsService';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { ProfileScreen, type ProfileNavigation } from '../ProfileScreen';

async function setup(options: { weightKg?: number; goalKg?: number; usda?: boolean; lb?: boolean } = {}) {
  const { services } = await createTestServices();
  services.credentials = { hasUsdaApiKey: async () => options.usda ?? false } as CredentialsService;
  if (options.weightKg) await services.weight.add({ localDate: '2026-09-25', weightKg: options.weightKg });
  if (options.goalKg) await services.settings.setGoalWeightKg(options.goalKg);
  if (options.lb) await services.settings.updateUnits({ weightUnit: 'lb', energyUnit: 'kJ' });
  return services;
}

afterEach(async () => {
  await cleanup();
});

describe('UX-15 / NAV-06: Profile hub', () => {
  it('UX-15: empty states for weight and goal', async () => {
    const services = await setup();
    await renderWithServices(<ProfileScreen />, services);
    expect(await screen.findByText('No weight logged yet')).toBeTruthy();
    expect(screen.getByText('Goal —')).toBeTruthy();
    expect(await screen.findByText('USDA off')).toBeTruthy();
    expect(await screen.findByText('System')).toBeTruthy(); // DATA-23 default
  });

  it('UX-15: summary and row values follow the configured units (DATA-04)', async () => {
    const services = await setup({ weightKg: 82.4, goalKg: 75, usda: true, lb: true });
    const meals = await services.meals.list();
    const goal = await services.goals.goalFor('2026-09-25');
    await renderWithServices(<ProfileScreen />, services);
    expect(await screen.findByText('Current 181.7 lb')).toBeTruthy();
    expect(screen.getByText('Goal 165.3 lb')).toBeTruthy();
    expect(await screen.findByText(`${meals.length} meals`)).toBeTruthy();
    expect(screen.getByText('lb · g · kJ · ml')).toBeTruthy();
    expect(await screen.findByText('USDA on')).toBeTruthy();
    expect(screen.getByText('4 shown')).toBeTruthy(); // DATA-21 default
    expect(screen.getAllByText('None')).toHaveLength(2); // DATA-25 / DATA-28: no custom foods or recipes yet
    const kj = new Intl.NumberFormat('en-GB').format(Math.round(goal!.calorieTargetKcal * 4.184));
    expect(screen.getByText(`${kj} kJ`)).toBeTruthy();
  });

  it('NAV-06: each wired row opens its sub-screen', async () => {
    const services = await setup();
    const nav: Required<ProfileNavigation> = {
      onUpdateWeight: jest.fn(),
      onWeightHistory: jest.fn(),
      onCaloriesMacros: jest.fn(),
      onWeightGoal: jest.fn(),
      onMeals: jest.fn(),
      onUnits: jest.fn(),
      onDashboardNutrients: jest.fn(),
      onMyFoods: jest.fn(),
      onMyRecipes: jest.fn(),
      onFoodDatabases: jest.fn(),
      onTheme: jest.fn(),
    };
    await renderWithServices(<ProfileScreen {...nav} />, services);
    await fireEvent.press(await screen.findByTestId('profile-update-weight'));
    for (const id of [
      'weight-history',
      'calories-macros',
      'weight-goal',
      'meals',
      'units',
      'dashboard-nutrients',
      'my-foods',
      'my-recipes',
      'food-databases',
      'theme',
    ]) {
      await fireEvent.press(screen.getByTestId(`profile-${id}`));
    }
    for (const handler of Object.values(nav)) expect(handler).toHaveBeenCalledTimes(1);
  });

  it('NAV-06: rows without a destination are not buttons (no placeholder screens)', async () => {
    const services = await setup();
    await renderWithServices(<ProfileScreen onFoodDatabases={jest.fn()} />, services);
    await screen.findByText('USDA off');
    expect(screen.queryByTestId('profile-update-weight')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('ARCH-22: pt-PT smoke render', async () => {
    const services = await setup();
    await renderWithServices(<ProfileScreen />, services, { language: 'pt-PT' });
    expect(await screen.findByText('Ainda sem peso registado')).toBeOnTheScreen();
    expect(screen.getByText('Calorias e macros')).toBeOnTheScreen();
    expect(await screen.findByText('USDA inativo')).toBeOnTheScreen();
  });
});

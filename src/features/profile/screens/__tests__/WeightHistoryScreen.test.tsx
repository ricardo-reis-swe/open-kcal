import { cleanup, screen } from '@testing-library/react-native';

import { DiaryDateProvider } from '@/features/diary/hooks/DiaryDateContext';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { WeightHistoryScreen } from '../WeightHistoryScreen';

afterEach(async () => {
  await cleanup();
});

describe('UX-18 Weight History', () => {
  it('ARCH-22: pt-PT smoke render', async () => {
    const { services } = await createTestServices();
    await services.weight.add({ localDate: '2026-09-24', weightKg: 82.4 });
    await services.weight.add({ localDate: '2026-09-25', weightKg: 82 });
    await renderWithServices(
      <DiaryDateProvider>
        <WeightHistoryScreen onBack={jest.fn()} onAdd={jest.fn()} onEdit={jest.fn()} />
      </DiaryDateProvider>,
      services,
      { language: 'pt-PT' },
    );
    expect(await screen.findByRole('header', { name: 'Histórico de peso' })).toBeOnTheScreen();
    expect(await screen.findByTestId('weight-history-row-1')).toBeOnTheScreen();
    expect(screen.getByTestId('weight-history-add')).toHaveAccessibleName('Atualizar peso');
  });
});

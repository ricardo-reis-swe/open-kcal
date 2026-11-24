import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WEIGHT_HISTORY_PAGE } from '@/data/db/repositories/weightRepository';
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

  it('ARCH-19: loads older rows as the list scrolls; the last loaded row keeps its change', async () => {
    const { services } = await createTestServices();
    const total = WEIGHT_HISTORY_PAGE + 2;
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < total; i++) {
      const localDate = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      await services.weight.add({ localDate, weightKg: 70 + (i % 7) });
    }
    await renderWithServices(
      <DiaryDateProvider>
        <WeightHistoryScreen onBack={jest.fn()} onAdd={jest.fn()} onEdit={jest.fn()} />
      </DiaryDateProvider>,
      services,
    );
    // The FlatList only mounts the first rows, so read the row model from its data prop.
    const list = await screen.findByTestId('weight-history-list');
    expect(list.props.data).toHaveLength(WEIGHT_HISTORY_PAGE);
    expect(list.props.data[WEIGHT_HISTORY_PAGE - 1].changeKg).not.toBeNull(); // not the `rowFirst` form
    fireEvent(list, 'endReached');
    await waitFor(() => expect(screen.getByTestId('weight-history-list').props.data).toHaveLength(total));
    const all = screen.getByTestId('weight-history-list').props.data;
    expect(all[total - 1].changeKg).toBeNull();
  });
});

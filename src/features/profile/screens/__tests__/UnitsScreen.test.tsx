import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { UnitsScreen } from '../UnitsScreen';

afterEach(async () => {
  await cleanup();
});

describe('UX-18 Units', () => {
  it('each segmented change saves immediately (no Save button)', async () => {
    const { services } = await createTestServices();
    await renderWithServices(<UnitsScreen onBack={jest.fn()} />, services);
    expect(await screen.findByTestId('units-foodWeightUnit-g')).toBeSelected();
    await fireEvent.press(screen.getByTestId('units-foodWeightUnit-oz'));
    await fireEvent.press(screen.getByTestId('units-volumeUnit-fl_oz'));
    await waitFor(() => expect(screen.getByTestId('units-volumeUnit-fl_oz')).toBeSelected());
    expect(screen.getByTestId('units-foodWeightUnit-oz')).toBeSelected();
    expect(await services.settings.get()).toMatchObject({ foodWeightUnit: 'oz', volumeUnit: 'fl_oz' });
    expect(screen.queryByText('Save')).toBeNull();
  });
});

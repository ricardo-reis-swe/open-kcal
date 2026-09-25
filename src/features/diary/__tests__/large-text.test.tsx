import { screen } from '@testing-library/react-native';

import { renderWithProviders } from '@/shared/testing/render';

import { DiaryDateStrip } from '../components/DiaryDateStrip';

// RN's Jest setup reports fontScale 2, so each case sets the window explicitly.
const mockWindow = jest.fn();
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockWindow(),
}));
const withFontScale = (fontScale: number) =>
  mockWindow.mockReturnValue({ width: 360, height: 760, scale: 2, fontScale });

const strip = () => <DiaryDateStrip date="2026-09-26" today="2026-09-25" onChange={() => undefined} />;

describe('DS-11 large text', () => {
  it('DS-07: at default text the neighbours are named', async () => {
    withFontScale(1);
    await renderWithProviders(strip());
    expect(screen.getByText('‹ Today')).toBeOnTheScreen();
  });

  it('DS-11: at large text the neighbours become chevrons; labels stay full and nothing is truncated', async () => {
    withFontScale(2);
    await renderWithProviders(strip());
    expect(screen.getByRole('button', { name: 'Previous day, Today' })).toBeOnTheScreen();
    expect(screen.queryByText('‹ Today')).toBeNull();
    expect(screen.getByText('Tomorrow')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go to today' })).toBeOnTheScreen();
  });
});

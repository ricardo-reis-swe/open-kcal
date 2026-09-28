import { fireEvent, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';

import { sizes } from '@/shared/theme/tokens';
import { renderWithProviders, TestProviders } from '@/shared/testing/render';

import { DiaryDateStrip } from '../components/DiaryDateStrip';
import { centerOffset, RADIUS } from '../components/dateStripWindow';

const TODAY = '2026-09-28';
const LIST_WIDTH = 300;

async function setup(date = TODAY) {
  const onChange = jest.fn();
  const scrollToOffset = jest.spyOn(FlatList.prototype, 'scrollToOffset').mockImplementation(() => undefined);
  const view = await renderWithProviders(<DiaryDateStrip date={date} today={TODAY} onChange={onChange} />);
  await fireEvent(screen.getByTestId('diary-date-strip-list'), 'layout', {
    nativeEvent: { layout: { width: LIST_WIDTH, height: 44, x: 0, y: 0 } },
  });
  return { onChange, scrollToOffset, view };
}

describe('UX-02 scrollable date strip', () => {
  afterEach(() => jest.restoreAllMocks());

  it('UX-02: labels days relative to today; neighbours are prev/next buttons', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Showing Today', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Previous day, Yesterday' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Next day, Tomorrow' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Wed 30 Sep' })).toBeOnTheScreen();
  });

  it('UX-02: scrolling the strip does not change the day; tapping a day selects it', async () => {
    const { onChange } = await setup();
    await fireEvent.scroll(screen.getByTestId('diary-date-strip-list'), {
      nativeEvent: {
        contentOffset: { x: 2000, y: 0 },
        contentSize: { width: 20000, height: 44 },
        layoutMeasurement: { width: LIST_WIDTH, height: 44 },
      },
    });
    expect(onChange).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Wed 30 Sep' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-09-30');
  });

  it('UX-02 / DS-11: the selected day has increment/decrement actions', async () => {
    const { onChange } = await setup();
    const selected = screen.getByTestId('diary-selected-day');
    await fireEvent(selected, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-09-29');
    await fireEvent(selected, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });
    expect(onChange).toHaveBeenLastCalledWith('2026-09-27');
  });

  it('UX-02: centers the selected day, animating on every selection change', async () => {
    const { scrollToOffset, view } = await setup();
    const center = (index: number) => centerOffset(index, sizes.dateStripItem, LIST_WIDTH);
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: center(RADIUS), animated: false });
    await view.rerender(
      <TestProviders>
        <DiaryDateStrip date="2026-09-29" today={TODAY} onChange={jest.fn()} />
      </TestProviders>,
    );
    expect(scrollToOffset).toHaveBeenLastCalledWith({ offset: center(RADIUS + 1), animated: true });
    expect(screen.getByRole('button', { name: 'Showing Tomorrow' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go to today' })).toBeOnTheScreen();
  });
});

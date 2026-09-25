import { fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderWithProviders } from '@/shared/testing/render';

import { DiaryPager } from '../components/DiaryPager';

const WIDTH = 750; // RN's Jest window width
const scrollEnd = (page: number) => ({ nativeEvent: { contentOffset: { x: page * WIDTH, y: 0 } } });

async function setup() {
  const onChange = jest.fn();
  await renderWithProviders(
    <DiaryPager date="2026-09-25" onChange={onChange} renderDay={(day) => <Text>{day}</Text>} />,
  );
  return { onChange, scroller: screen.getByTestId('diary-pager-scroll') };
}

describe('UX-02 swipe pager', () => {
  it('UX-02: pre-renders the previous, selected and next day', async () => {
    await setup();
    for (const day of ['2026-09-24', '2026-09-25', '2026-09-26']) expect(screen.getByText(day)).toBeOnTheScreen();
  });

  it('UX-02: a swipe to either neighbour selects it', async () => {
    const { onChange, scroller } = await setup();
    await fireEvent(scroller, 'scrollBeginDrag');
    await fireEvent(scroller, 'momentumScrollEnd', scrollEnd(2));
    expect(onChange).toHaveBeenLastCalledWith('2026-09-26');
    await fireEvent(scroller, 'scrollBeginDrag');
    await fireEvent(scroller, 'momentumScrollEnd', scrollEnd(0));
    expect(onChange).toHaveBeenLastCalledWith('2026-09-24');
  });

  it('UX-02: a duplicate momentum end (Android) or the re-center never moves another day', async () => {
    const { onChange, scroller } = await setup();
    await fireEvent(scroller, 'scrollBeginDrag');
    await fireEvent(scroller, 'momentumScrollEnd', scrollEnd(2));
    await fireEvent(scroller, 'momentumScrollEnd', scrollEnd(2));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('UX-02: a drag that settles back on the selected page changes nothing', async () => {
    const { onChange, scroller } = await setup();
    await fireEvent(scroller, 'scrollBeginDrag');
    await fireEvent(scroller, 'momentumScrollEnd', scrollEnd(1));
    expect(onChange).not.toHaveBeenCalled();
  });
});

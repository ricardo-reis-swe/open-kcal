import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { RulerPicker } from 'react-native-ruler-picker';

// Keep both the picker and FlashList real: mocking either hides native scroll configuration.
describe('DS-09: ruler native momentum', () => {
  it('snaps to ticks without anchoring recycled views during a fling', async () => {
    const onValueChangeEnd = jest.fn();
    await render(
      <RulerPicker
        min={0}
        max={2000}
        initialValue={100}
        fractionDigits={0}
        stepWidth={1}
        gapBetweenSteps={23}
        onValueChangeEnd={onValueChangeEnd}
      />,
    );
    const scrollViews = screen.container.queryAll(
      (node) => node.props.horizontal === true && typeof node.props.onScroll === 'function',
    );
    expect(scrollViews).toHaveLength(1);
    const scroll = scrollViews[0];
    if (!scroll) throw new Error('Missing native ruler scroll view');
    expect(scroll.props.snapToOffsets.slice(0, 3)).toEqual([0, 24, 48]);
    // Native anchoring adjusts the offset when a recycled child moves, fighting the fling.
    expect(scroll.props.maintainVisibleContentPosition).toBeUndefined();
    // The first tick sits under the pointer at offset zero, with no scrollable space before it.
    expect(scroll.props.bounces).toBe(false);
    expect(scroll.props.alwaysBounceHorizontal).toBe(false);
    expect(scroll.props.overScrollMode).toBe('never');
    expect(scroll.props.contentInsetAdjustmentBehavior).toBe('never');
    // Positioning at initialValue (a remount after a serving change) is not a user choice, so it reports nothing;
    // otherwise the mount's offset-0 event set the serving to the first tick (2 nuts → 1 g).
    await fireEvent(scroll, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(onValueChangeEnd).not.toHaveBeenCalled();
    await fireEvent(scroll, 'scrollBeginDrag');
    // Settle in both directions and at zero; horizontal zero must never fall back to y.
    for (const index of [150, 50, 0]) {
      await fireEvent(scroll, 'momentumScrollEnd', {
        nativeEvent: { contentOffset: { x: index * 24, y: 24 } },
      });
      expect(onValueChangeEnd).toHaveBeenLastCalledWith(String(index));
    }
  });
});

describe('DS-09: ruler opens at its initial value', () => {
  afterEach(() => jest.useRealTimers());

  it('keeps positioning until the user drags, so a scroll dropped while the screen opens is retried', async () => {
    jest.useFakeTimers();
    const scrollTo = ScrollView.prototype.scrollTo as jest.Mock;
    scrollTo.mockClear();
    await render(
      <RulerPicker min={0} max={2000} initialValue={100} fractionDigits={0} stepWidth={1} gapBetweenSteps={23} />,
    );
    // Opening a recent food at 100 g: the native view never reports offset 2400, so the ruler tries again.
    await act(() => jest.advanceTimersByTime(200));
    const attempts = scrollTo.mock.calls.length;
    expect(attempts).toBeGreaterThan(1);
    expect(scrollTo).toHaveBeenLastCalledWith({ x: 100 * 24, y: 0, animated: false });

    const scroll = screen.container.queryAll(
      (node) => node.props.horizontal === true && typeof node.props.onScroll === 'function',
    )[0]!;
    await fireEvent(scroll, 'scrollBeginDrag');
    await act(() => jest.advanceTimersByTime(1_000));
    // A drag is the user's choice; the initial value must not pull the ruler back.
    expect(scrollTo).toHaveBeenCalledTimes(attempts);
  });
});

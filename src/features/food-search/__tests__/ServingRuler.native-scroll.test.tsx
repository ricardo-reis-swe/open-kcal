import { fireEvent, render, screen } from '@testing-library/react-native';
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
    // Settle in both directions and at zero; horizontal zero must never fall back to y.
    for (const index of [150, 50, 0]) {
      await fireEvent(scroll, 'momentumScrollEnd', {
        nativeEvent: { contentOffset: { x: index * 24, y: 24 } },
      });
      expect(onValueChangeEnd).toHaveBeenLastCalledWith(String(index));
    }
  });
});

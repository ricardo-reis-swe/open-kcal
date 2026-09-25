import { act, fireEvent, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { renderWithProviders } from '@/shared/testing/render';

import { AppText, BottomSheet } from '..';
import { shouldDismissSheet } from '../BottomSheet';

describe('ARCH-06 / NAV-03: BottomSheet swipe-down dismiss', () => {
  it('scales the distance with a short sheet and accepts a flick', () => {
    // 60 pt sheet (handle + empty content): 30% = 18 pt, well inside the physical travel near the screen edge.
    expect(shouldDismissSheet(20, 0, 60)).toBe(true);
    expect(shouldDismissSheet(10, 0, 60)).toBe(false);
    // Tall sheets cap the distance at 80 pt.
    expect(shouldDismissSheet(79, 0, 600)).toBe(false);
    expect(shouldDismissSheet(81, 0, 600)).toBe(true);
    // A flick dismisses regardless of distance.
    expect(shouldDismissSheet(5, 600, 600)).toBe(true);
  });

  async function renderSheet(onClose = jest.fn()) {
    await renderWithProviders(
      <BottomSheet visible onClose={onClose} accessibilityLabel="Add actions" closeLabel="Close" testID="sheet">
        <AppText>Row</AppText>
      </BottomSheet>,
    );
    await fireEvent(screen.getByTestId('sheet'), 'layout', { nativeEvent: { layout: { height: 120 } } });
    return onClose;
  }

  function drag(translationY: number, velocityY: number) {
    fireGestureHandler(getByGestureTestId('sheet-pan'), [
      { state: State.BEGAN, translationY: 0, velocityY: 0 },
      { state: State.ACTIVE, translationY: translationY / 2, velocityY },
      { state: State.ACTIVE, translationY, velocityY },
      { state: State.END, translationY, velocityY },
    ]);
  }

  it('a slow drag past the scaled distance runs the cancel path', async () => {
    const onClose = await renderSheet();
    await act(async () => drag(60, 100));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a short slow drag springs back without closing', async () => {
    const onClose = await renderSheet();
    await act(async () => drag(15, 50));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('DS-11: announces the sheet name when it opens and exposes the handle as Close', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => undefined);
    const onClose = await renderSheet();
    expect(announce).toHaveBeenCalledWith('Add actions');
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

import { act, fireEvent, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { renderWithProviders } from '@/shared/testing/render';

import { AppText, BottomSheet, ConfirmationDialog } from '..';

describe('DS-12: BottomSheet', () => {
  function Harness({ onClose }: { onClose: () => void }) {
    return (
      <BottomSheet visible onClose={onClose} accessibilityLabel="Add" closeLabel="Close" testID="sheet">
        <AppText>Sheet content</AppText>
      </BottomSheet>
    );
  }

  it('renders its content when visible', async () => {
    await renderWithProviders(<Harness onClose={jest.fn()} />);
    expect(screen.getByText('Sheet content')).toBeOnTheScreen();
  });

  it('NAV-03: onDismissed fires once after a shown sheet closes, never for the initial hidden mount', async () => {
    jest.useFakeTimers();
    const onDismissed = jest.fn();
    function Toggle() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <AppText onPress={() => setOpen((o) => !o)}>Toggle</AppText>
          <BottomSheet
            visible={open}
            onClose={() => setOpen(false)}
            onDismissed={onDismissed}
            accessibilityLabel="Add"
            closeLabel="Close"
            testID="sheet"
          >
            <AppText>Sheet content</AppText>
          </BottomSheet>
        </>
      );
    }
    await renderWithProviders(<Toggle />);
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onDismissed).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Toggle'));
    await fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onDismissed).not.toHaveBeenCalled(); // still animating out
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(onDismissed).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Sheet content')).toBeNull();
    jest.useRealTimers();
  });

  it('renders nothing when not visible', async () => {
    await renderWithProviders(
      <BottomSheet visible={false} onClose={jest.fn()} accessibilityLabel="Add" closeLabel="Close">
        <AppText>Sheet content</AppText>
      </BottomSheet>,
    );
    expect(screen.queryByText('Sheet content')).toBeNull();
  });

  it('ARCH-06: backdrop tap runs the cancel path', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<Harness onClose={onClose} />);
    await fireEvent.press(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ARCH-06: system back (onRequestClose) runs the cancel path', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<Harness onClose={onClose} />);
    await fireEvent(screen.getByTestId('sheet-modal'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ARCH-06: screen-reader escape runs the cancel path', async () => {
    const onClose = jest.fn();
    await renderWithProviders(<Harness onClose={onClose} />);
    await fireEvent(screen.getByTestId('sheet'), 'accessibilityEscape');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  afterEach(() => jest.useRealTimers());

  it('unmounts after the close animation', async () => {
    jest.useFakeTimers();
    function Toggle() {
      const [open, setOpen] = useState(true);
      return (
        <BottomSheet visible={open} onClose={() => setOpen(false)} accessibilityLabel="Add" closeLabel="Close">
          <AppText>Sheet content</AppText>
        </BottomSheet>
      );
    }
    await renderWithProviders(<Toggle />);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText('Sheet content')).toBeNull();
  });
});

describe('DS-12: ConfirmationDialog', () => {
  const props = {
    visible: true,
    title: 'Delete Scrambled eggs?',
    body: 'Removes it from Breakfast on 25 Sep.',
    confirmLabel: 'Delete entry',
    cancelLabel: 'Cancel',
    destructive: true,
    testID: 'dialog',
  };

  it('UX-19: shows title, body and two explicit actions', async () => {
    await renderWithProviders(<ConfirmationDialog {...props} onConfirm={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Delete Scrambled eggs?' })).toBeOnTheScreen();
    expect(screen.getByText('Removes it from Breakfast on 25 Sep.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete entry' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeOnTheScreen();
  });

  it('NAV-08: confirm and cancel call their handlers', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderWithProviders(<ConfirmationDialog {...props} onConfirm={onConfirm} onCancel={onCancel} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Delete entry' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('ARCH-06: system back cancels', async () => {
    const onCancel = jest.fn();
    await renderWithProviders(<ConfirmationDialog {...props} onConfirm={jest.fn()} onCancel={onCancel} />);
    await fireEvent(screen.getByTestId('dialog-modal'), 'requestClose');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when hidden', async () => {
    await renderWithProviders(
      <ConfirmationDialog {...props} visible={false} onConfirm={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(screen.queryByText('Delete Scrambled eggs?')).toBeNull();
  });
});

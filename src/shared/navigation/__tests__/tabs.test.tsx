import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router, type Href } from 'expo-router';
import { Keyboard, Platform } from 'react-native';
import { MockDeepScreen, renderApp } from '@/shared/testing/appRoutes';

// Test-only route, so it isn't in the generated typed-route union.
const DEEP = '/diary/deep' as Href;
const render = (url: string) => renderApp(url, { '(tabs)/diary/deep': MockDeepScreen });

async function flush() {
  await act(async () => {
    jest.runOnlyPendingTimers();
  });
}

afterEach(() => {
  jest.useRealTimers();
});

describe('NAV-01 / NAV-02: tabs', () => {
  it('NAV-01: launches to the Diary', async () => {
    const app = await render('/');
    expect(app.getPathname()).toBe('/diary');
    expect(screen.getByRole('header', { name: 'Diary' })).toBeOnTheScreen();
  });

  it('NAV-02: the bar has exactly Diary, + and Profile; Diary is selected', async () => {
    await render('/diary');
    const bar = screen.getByTestId('tab-bar');
    const tabs = within(bar).getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Diary', 'Profile']);
    expect(
      within(bar)
        .getAllByRole('button')
        .map((b) => b.props.accessibilityLabel),
    ).toEqual(['Add']);
    expect(screen.getByRole('tab', { name: 'Diary' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Profile' })).not.toBeSelected();
  });

  it('NAV-02: switching to Profile selects it', async () => {
    const app = await render('/diary');
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    expect(app.getPathname()).toBe('/profile');
    expect(screen.getByRole('header', { name: 'Profile' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Profile' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Diary' })).not.toBeSelected();
  });

  it('DS-07: hides the bottom bar while the keyboard is open and restores it after close', async () => {
    const listeners = new Map<string, (() => void)[]>();
    const isVisibleSpy = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
    const addListenerSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener as () => void]);
      return { remove: jest.fn() } as unknown as ReturnType<typeof Keyboard.addListener>;
    });

    try {
      await render('/diary');
      expect(screen.getByTestId('tab-bar')).toBeOnTheScreen();

      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      await act(async () => listeners.get(showEvent)?.forEach((listener) => listener()));
      expect(screen.queryByTestId('tab-bar')).toBeNull();

      await act(async () => listeners.get(hideEvent)?.forEach((listener) => listener()));
      expect(screen.getByTestId('tab-bar')).toBeOnTheScreen();
    } finally {
      isVisibleSpy.mockRestore();
      addListenerSpy.mockRestore();
    }
  });

  it('NAV-02: each tab keeps its own stack when switching tabs', async () => {
    const app = await render('/diary');
    await act(async () => router.push(DEEP));
    await flush();
    expect(app.getPathname()).toBe('/diary/deep');
    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    expect(app.getPathname()).toBe('/profile');
    await fireEvent.press(screen.getByRole('tab', { name: 'Diary' }));
    expect(app.getPathname()).toBe('/diary/deep');
  });

  it('NAV-02: tapping the selected tab while deeper pops it to root', async () => {
    const app = await render('/diary');
    await act(async () => router.push(DEEP));
    await flush();
    expect(app.getPathname()).toBe('/diary/deep');
    await fireEvent.press(screen.getByRole('tab', { name: 'Diary' }));
    await flush();
    expect(app.getPathname()).toBe('/diary');
  });
});

describe('NAV-03: + Add Action Sheet', () => {
  it.each(['/diary', '/profile'])('opens from %s without changing route or selection', async (url) => {
    const app = await render(url);
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByTestId('add-action-sheet')).toBeOnTheScreen();
    expect(app.getPathname()).toBe(url);
  });

  it('ARCH-06: backdrop closes it', async () => {
    await render('/diary');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(screen.getByTestId('add-action-sheet-backdrop'));
    await flush();
    expect(screen.queryByTestId('add-action-sheet')).toBeNull();
  });

  it('ARCH-06: the handle (Close) closes it', async () => {
    await render('/diary');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    await flush();
    expect(screen.queryByTestId('add-action-sheet')).toBeNull();
  });

  it('ARCH-06: system back closes it', async () => {
    const app = await render('/diary');
    await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
    await fireEvent(screen.getByTestId('add-action-sheet-modal'), 'requestClose');
    await flush();
    expect(screen.queryByTestId('add-action-sheet')).toBeNull();
    expect(app.getPathname()).toBe('/diary');
  });
});

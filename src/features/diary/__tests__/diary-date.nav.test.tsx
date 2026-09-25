import { fireEvent, screen } from '@testing-library/react-native';
import { FlatList } from 'react-native';

import { renderApp } from '@/shared/testing/appRoutes';

describe('NAV-05: selected diary date', () => {
  it('NAV-05: fresh launch is today, and the selected date survives a tab switch', async () => {
    await renderApp('/diary');
    expect(await screen.findByLabelText('Showing Today')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Next day, Tomorrow' }));
    expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Diary' }));
    expect(screen.getByLabelText('Showing Tomorrow')).toBeOnTheScreen();
  });

  it('NAV-02: the Diary tab tapped at the Diary root scrolls the day to the top', async () => {
    const scroll = jest.spyOn(FlatList.prototype, 'scrollToOffset');
    await renderApp('/diary');
    expect(await screen.findByLabelText('Showing Today')).toBeOnTheScreen();
    await screen.findAllByRole('header', { name: /^Breakfast, / });

    await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
    await fireEvent.press(screen.getByRole('tab', { name: 'Diary' }));
    expect(scroll).not.toHaveBeenCalledWith({ offset: 0, animated: true }); // switching tabs doesn't scroll

    await fireEvent.press(screen.getByRole('tab', { name: 'Diary' }));
    expect(scroll).toHaveBeenCalledWith({ offset: 0, animated: true });
    scroll.mockRestore();
  });
});

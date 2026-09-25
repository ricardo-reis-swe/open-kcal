import { renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import Index from '@/app/index';

describe('app root', () => {
  it('renders the initial route', async () => {
    await renderRouter({ _layout: RootLayout, index: Index });
    expect(await screen.findByText('Calorie Tracker')).toBeOnTheScreen();
  });
});

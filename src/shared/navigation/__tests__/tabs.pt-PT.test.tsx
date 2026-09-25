import { screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { appRoutes } from '@/shared/testing/appRoutes';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'pt-PT', languageCode: 'pt', regionCode: 'PT' }],
}));

describe('ARCH-22: pt-PT smoke', () => {
  it('renders the tab shell in European Portuguese', async () => {
    await renderRouter(appRoutes(), { initialUrl: '/diary' });
    expect(screen.getByRole('header', { name: 'Diário' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Diário' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Perfil' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeOnTheScreen();
  });
});

import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import { appRoutes } from '@/shared/testing/appRoutes';

jest.mock('expo-localization', () => {
  const locales = [{ languageTag: 'pt-PT', languageCode: 'pt', regionCode: 'PT' }];
  return { getLocales: () => locales, useLocales: () => locales };
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ARCH-22: pt-PT smoke', () => {
  it('renders the tab shell in European Portuguese', async () => {
    await renderRouter(appRoutes(), { initialUrl: '/diary' });
    expect(screen.getByRole('header', { name: 'Diário' })).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Diário' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Perfil' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeOnTheScreen();
  });

  it('renders Profile and the Add sheet in European Portuguese', async () => {
    await renderRouter(appRoutes(), { initialUrl: '/diary' });
    await fireEvent.press(screen.getByRole('tab', { name: 'Perfil' }));
    await act(async () => jest.runOnlyPendingTimers());
    expect(screen.getByRole('header', { name: 'Perfil' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar' }));
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeOnTheScreen();
  });
});

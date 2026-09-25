import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { sequentialIds } from '@/data/db/ids';
import { parseConfig } from '@/shared/config/env';
import { fixedClock } from '@/shared/dates';
import { DatabaseError, MigrationError } from '@/shared/errors';
import { initI18n } from '@/shared/i18n/i18n';
import { renderWithProviders } from '@/shared/testing/render';

import { diagnosticInfo, RecoveryScreen } from '../RecoveryScreen';
import { useServices, type AppServices } from '../services';
import { startServices } from '../start-services';
import { StartupGate } from '../StartupGate';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function MealCount() {
  const services = useServices();
  return <Text>{services ? 'services ready' : 'no services'}</Text>;
}

describe('ARCH-17: startServices', () => {
  // In the app, initializeApp() runs i18n before this async step.
  beforeAll(() => initI18n({ language: 'en', formattingLocale: 'en', regionCode: 'US' }));

  it('opens SQLite, migrates and seeds, then builds the services', async () => {
    const services = await startServices({ clock: fixedClock('2026-09-25T10:00:00.000Z'), ids: sequentialIds() });
    expect((await services.meals.list()).map((m) => m.name)).toEqual(['Breakfast', 'Lunch', 'Dinner', 'Snacks']);
    const day = await services.diary.loadDay('2026-09-25');
    expect(day.goal).toMatchObject({ calorieTargetKcal: 2000 });
    expect(await services.goals.isProvisional()).toBe(true);
  });
});

describe('ARCH-17 / UX-20: StartupGate', () => {
  it('holds the launch screen until startup succeeds, then mounts the app', async () => {
    const start = deferred<AppServices>();
    await renderWithProviders(
      <StartupGate start={() => start.promise} appVersion="0.1.0" copyText={jest.fn()}>
        <MealCount />
      </StartupGate>,
    );
    expect(screen.getByLabelText('Opening your diary')).toBeOnTheScreen();
    expect(screen.queryByText('services ready')).toBeNull();
    const services = await startServices({ ids: sequentialIds() });
    await act(async () => start.resolve(services));
    expect(screen.getByText('services ready')).toBeOnTheScreen();
    expect(screen.queryByTestId('launch-screen')).toBeNull();
  });

  it('shows the recovery screen on failure; Retry runs startup again (never a reset)', async () => {
    const services = await startServices({ ids: sequentialIds() });
    const start = jest
      .fn<Promise<AppServices>, []>()
      .mockRejectedValueOnce(new MigrationError('Migration failed', 2))
      .mockResolvedValueOnce(services);
    await renderWithProviders(
      <StartupGate start={start} appVersion="0.1.0" copyText={jest.fn()}>
        <MealCount />
      </StartupGate>,
    );
    await act(async () => undefined);
    expect(screen.getByRole('header', { name: "Couldn't open your diary." })).toBeOnTheScreen();
    expect(screen.queryByText('Migration failed')).toBeNull(); // no internals on screen
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await act(async () => undefined);
    expect(start).toHaveBeenCalledTimes(2);
    expect(screen.getByText('services ready')).toBeOnTheScreen();
  });
});

describe('ARCH-13 / ROAD-02 M1: an invalid config shows the recovery screen, not a crash', () => {
  const badConfig = () => parseConfig({ EXPO_PUBLIC_USDA_BASE_URL: 'http://insecure.example' }, '0.1.0');

  it('startServices rejects with a typed ValidationError naming keys only', async () => {
    const error = await startServices({ ids: sequentialIds(), loadConfig: badConfig }).catch((e: unknown) => e);
    expect(error).toMatchObject({ category: 'validation' });
    expect((error as { fields: string[] }).fields).toContain('EXPO_PUBLIC_USDA_BASE_URL');
    expect((error as Error).message).not.toContain('insecure.example');
  });

  it('StartupGate renders the recovery screen with category-only diagnostics', async () => {
    const copyText = jest.fn();
    await renderWithProviders(
      <StartupGate
        start={() => startServices({ ids: sequentialIds(), loadConfig: badConfig })}
        appVersion="0.1.0"
        copyText={copyText}
      >
        <MealCount />
      </StartupGate>,
    );
    await act(async () => undefined);
    expect(screen.getByRole('header', { name: "Couldn't open your diary." })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Copy diagnostic info' }));
    expect(copyText.mock.calls[0][0]).toMatch(/error validation$/);
    expect(copyText.mock.calls[0][0]).not.toMatch(/insecure|EXPO_PUBLIC/);
  });
});

describe('UX-20: RecoveryScreen', () => {
  const error = new MigrationError('SQLITE_CORRUPT near "meals": syntax error', 3);

  it('diagnostic info holds versions and the error category only (ARCH-15)', () => {
    const info = diagnosticInfo(error, { appVersion: '0.1.0', schemaVersion: 1 });
    expect(info).toMatch(/^app 0\.1\.0 · schema 1 · (ios|android) .+ · error migration \(v3\)$/);
    expect(info).not.toMatch(/SQLITE|meals/);
    expect(diagnosticInfo(new DatabaseError('x'), { appVersion: '0.1.0', schemaVersion: 1 })).toMatch(
      /error database$/,
    );
  });

  it('Copy diagnostic info copies versions + category; Retry retries', async () => {
    const copyText = jest.fn();
    const onRetry = jest.fn();
    await renderWithProviders(
      <RecoveryScreen
        error={error}
        diagnostics={{ appVersion: '0.1.0', schemaVersion: 1 }}
        onRetry={onRetry}
        copyText={copyText}
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Copy diagnostic info' }));
    expect(copyText).toHaveBeenCalledWith(expect.stringContaining('error migration (v3)'));
    expect(copyText.mock.calls[0][0]).not.toMatch(/SQLITE|meals/);
    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ARCH-22: renders in European Portuguese', async () => {
    await renderWithProviders(
      <RecoveryScreen
        error={error}
        diagnostics={{ appVersion: '0.1.0', schemaVersion: 1 }}
        onRetry={jest.fn()}
        copyText={jest.fn()}
      />,
      { language: 'pt-PT' },
    );
    expect(screen.getByRole('header', { name: 'Não foi possível abrir o seu diário.' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Copiar informações de diagnóstico' })).toBeOnTheScreen();
  });
});

import { act, fireEvent, screen } from '@testing-library/react-native';
import { useQueryClient } from '@tanstack/react-query';
import fs from 'node:fs';
import { Text } from 'react-native';

import { sequentialIds } from '@/data/db/ids';
import { exportDirectory } from '@/data/db/transfer/exportDatabase';
import * as files from '@/data/db/transfer/files';
import { closeForSwap, swapIn } from '@/data/db/transfer/replaceDatabase';
import { importDirectory, stageImport } from '@/data/db/transfer/validateImport';
import { settingsKeys } from '@/features/diary/diary.queries';
import { parseConfig } from '@/shared/config/env';
import { fixedClock } from '@/shared/dates';
import { DatabaseError, MigrationError } from '@/shared/errors';
import { initI18n } from '@/shared/i18n/i18n';
import * as appNotice from '@/shared/notices/appNotice';
import { renderWithProviders } from '@/shared/testing/render';
import { makeDbFile, makeTempDir, queryFile } from '@/shared/testing/transferFixtures';

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

  it('UX-23: the stored theme is in the query cache when the app mounts (no flash of the other scheme)', async () => {
    const services = await startServices({ ids: sequentialIds() });
    await services.settings.setThemePreference('dark');
    function ThemeOnMount() {
      const client = useQueryClient();
      return <Text>{`theme ${String(client.getQueryData(settingsKeys.themePreference))}`}</Text>;
    }
    await renderWithProviders(
      <StartupGate start={async () => services} appVersion="0.1.0" copyText={jest.fn()}>
        <ThemeOnMount />
      </StartupGate>,
    );
    await act(async () => undefined);
    expect(screen.getByText('theme dark')).toBeOnTheScreen();
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

describe('DATA-32 / ARCH-17: launch recovery of an interrupted import', () => {
  let dir: string;
  const clock = fixedClock('2026-09-25T10:00:00.000Z');
  const logger = { info: () => undefined, error: () => undefined };
  beforeAll(() => initI18n({ language: 'en', formattingLocale: 'en', regionCode: 'US' }));
  beforeEach(() => {
    dir = makeTempDir();
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
    await files.removeDir(importDirectory());
    await files.removeDir(exportDirectory());
  });

  /** An app that "died" right after the swap: marker + safety copy + the imported file as the database. */
  async function interruptedImport() {
    const location = { directory: dir, name: 'calorie-tracker.db' };
    const live = await startServices({ location, clock, ids: sequentialIds() });
    const source = await makeDbFile(dir, 'export.db', { mealName: 'Ceia' });
    const { stagedPath } = await stageImport(files.toUri(source), { clock, logger });
    await closeForSwap(live.db);
    await swapIn(location, stagedPath);
    return location;
  }

  it('a marker rolls the import back, announces importInterrupted once and opens the original data', async () => {
    const location = await interruptedImport();
    const announce = jest.spyOn(appNotice, 'announceAppNotice');
    const services = await startServices({ location, clock, ids: sequentialIds() });
    expect((await services.meals.list())[0]?.name).toBe('Breakfast');
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith('importInterrupted');
    expect(fs.existsSync(`${dir}/import-pending`)).toBe(false);
    expect(fs.existsSync(`${dir}/calorie-tracker.pre-import.db`)).toBe(false);
    await services.db.close();
  });

  it('a normal start announces nothing and removes stale export/ and import/ folders', async () => {
    await files.ensureDir(exportDirectory());
    await files.ensureDir(importDirectory());
    fs.writeFileSync(`${exportDirectory()}/open-kcal-2026-09-24.db`, 'x');
    const announce = jest.spyOn(appNotice, 'announceAppNotice');
    const services = await startServices({ location: { directory: dir, name: 'calorie-tracker.db' }, clock });
    expect(announce).not.toHaveBeenCalled();
    expect(fs.existsSync(exportDirectory())).toBe(false);
    expect(fs.existsSync(importDirectory())).toBe(false);
    await services.db.close();
  });

  it('a recovery failure rejects startup and the gate shows the recovery screen (never a reset)', async () => {
    const location = await interruptedImport();
    jest.spyOn(files, 'move').mockRejectedValue(new DatabaseError('File operation failed'));
    await expect(startServices({ location, clock })).rejects.toBeInstanceOf(DatabaseError);
    await renderWithProviders(
      <StartupGate start={() => startServices({ location, clock })} appVersion="0.1.0" copyText={jest.fn()}>
        <MealCount />
      </StartupGate>,
    );
    await act(async () => undefined);
    expect(screen.getByRole('header', { name: "Couldn't open your diary." })).toBeOnTheScreen();
    // The imported file is still the database and the marker is still there for the next Retry.
    expect(fs.existsSync(`${dir}/import-pending`)).toBe(true);
    expect(queryFile(`${dir}/calorie-tracker.pre-import.db`, 'SELECT name FROM meals LIMIT 1')).toHaveLength(1);
  });
});

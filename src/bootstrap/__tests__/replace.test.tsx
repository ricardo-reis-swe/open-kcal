import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen } from '@testing-library/react-native';
import fs from 'node:fs';
import { useEffect, useState } from 'react';
import { BackHandler, Text } from 'react-native';

import { exportDirectory } from '@/data/db/transfer/exportDatabase';
import * as files from '@/data/db/transfer/files';
import { importDirectory } from '@/data/db/transfer/validateImport';
import * as refresh from '@/features/widget/refreshWidget';
import { sequentialIds } from '@/data/db/ids';
import { fixedClock } from '@/shared/dates';
import { initI18n } from '@/shared/i18n/i18n';
import * as appNotice from '@/shared/notices/appNotice';
import { renderWithProviders } from '@/shared/testing/render';
import { makeDbFile, makeTempDir } from '@/shared/testing/transferFixtures';

import { useReplaceDatabase } from '../databaseReplace';
import { useServices, type AppServices } from '../services';
import { startServices, type StartOptions } from '../start-services';
import { StartupGate } from '../StartupGate';

const clock = fixedClock('2026-09-25T10:00:00.000Z');

describe('DATA-32 / NAV-11 / ARCH-25: StartupGate replaces the database', () => {
  let dir: string;
  let services: AppServices | null;
  let clients: QueryClient[];
  let mounts: number;
  let start: (options?: { afterImport?: boolean }) => Promise<AppServices>;

  beforeAll(() => initI18n({ language: 'en', formattingLocale: 'en', regionCode: 'US' }));
  beforeEach(() => {
    dir = makeTempDir();
    services = null;
    clients = [];
    mounts = 0;
    start = (options) =>
      startServices({
        ...(options as StartOptions),
        location: { directory: dir, name: 'calorie-tracker.db' },
        clock,
        ids: sequentialIds(),
      });
    jest.spyOn(refresh, 'refreshWidget').mockImplementation(() => undefined);
    jest.spyOn(appNotice, 'announceAppNotice');
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await services?.db.close().catch(() => undefined);
    fs.rmSync(dir, { recursive: true, force: true });
    await files.removeDir(importDirectory());
    await files.removeDir(exportDirectory());
  });

  function Probe({ stagedPath }: { stagedPath: () => string }) {
    const current = useServices();
    const client = useQueryClient();
    const replace = useReplaceDatabase();
    const [meal, setMeal] = useState('…');
    useEffect(() => {
      services = current;
      mounts += 1;
      clients.push(client);
      void current.meals.list().then((meals) => setMeal(meals[0]?.name ?? 'none'));
    }, [current, client]);
    return (
      <>
        <Text>{`first meal: ${meal}`}</Text>
        <Text onPress={() => replace(stagedPath())}>Replace now</Text>
      </>
    );
  }

  async function stagedExport() {
    const source = await makeDbFile(dir, 'export.db', { mealName: 'Ceia', entries: 3 });
    const picked = `${dir}/picked.db`;
    fs.copyFileSync(source, picked);
    return (await services!.transfer.stageImport(files.toUri(picked))).stagedPath;
  }

  async function renderGate() {
    let staged = '';
    await renderWithProviders(
      <StartupGate start={(o) => start(o)} appVersion="0.1.0" copyText={jest.fn()}>
        <Probe stagedPath={() => staged} />
      </StartupGate>,
    );
    await act(async () => undefined);
    expect(await screen.findByText('first meal: Breakfast')).toBeOnTheScreen();
    staged = await stagedExport();
  }

  it('shows Importing…, unmounts the app, then remounts it on the imported data with a new Query client', async () => {
    await renderGate();
    const firstClient = clients[0];
    const firstServices = services;
    await fireEvent.press(screen.getByText('Replace now'));
    await act(async () => undefined);
    expect(await screen.findByText('first meal: Ceia')).toBeOnTheScreen();
    expect(screen.queryByTestId('import-replacing')).toBeNull();
    expect(mounts).toBe(2);
    expect(services).not.toBe(firstServices);
    expect(clients[clients.length - 1]).not.toBe(firstClient);
    expect(refresh.refreshWidget).toHaveBeenCalledTimes(2); // the first start and the import
    expect(appNotice.announceAppNotice).toHaveBeenCalledWith('dataImported');
    expect(fs.existsSync(`${dir}/import-pending`)).toBe(false);
    expect(fs.existsSync(`${dir}/calorie-tracker.pre-import.db`)).toBe(false);
  });

  it('a failure in step 6 restores the original data and reports importFailed', async () => {
    await renderGate();
    const real = start;
    let failed = false;
    start = async (options) => {
      if (options?.afterImport && !failed) {
        failed = true;
        throw new Error('start failed');
      }
      return real(options);
    };
    await fireEvent.press(screen.getByText('Replace now'));
    await act(async () => undefined);
    expect(await screen.findByText('first meal: Breakfast')).toBeOnTheScreen();
    expect(failed).toBe(true);
    expect(appNotice.announceAppNotice).toHaveBeenCalledWith('importFailed');
    expect(appNotice.announceAppNotice).not.toHaveBeenCalledWith('dataImported');
    expect(refresh.refreshWidget).toHaveBeenCalledTimes(2); // also redrawn after a rollback
    expect(fs.existsSync(`${dir}/import-pending`)).toBe(false);
  });

  it('a marker that cannot be removed after a good swap rolls back, so a later launch cannot undo newer data', async () => {
    await renderGate();
    const realRemove = files.remove;
    let failedOnce = false;
    jest.spyOn(files, 'remove').mockImplementation((target) => {
      if (target.endsWith('/import-pending') && !failedOnce) {
        failedOnce = true;
        return Promise.reject(new Error('cannot remove'));
      }
      return realRemove(target);
    });
    await fireEvent.press(screen.getByText('Replace now'));
    await act(async () => undefined);
    expect(await screen.findByText('first meal: Breakfast')).toBeOnTheScreen();
    expect(failedOnce).toBe(true);
    expect(appNotice.announceAppNotice).toHaveBeenCalledWith('importFailed');
    expect(appNotice.announceAppNotice).not.toHaveBeenCalledWith('dataImported');
    expect(fs.existsSync(`${dir}/import-pending`)).toBe(false);
    expect(fs.existsSync(`${dir}/calorie-tracker.pre-import.db`)).toBe(false);
  });

  it('shows the recovery screen when the rollback itself cannot start', async () => {
    await renderGate();
    start = async (options) => {
      if (options?.afterImport) throw new Error('start failed');
      return startServices({ location: { directory: dir, name: 'calorie-tracker.db' }, clock });
    };
    await fireEvent.press(screen.getByText('Replace now'));
    await act(async () => undefined);
    expect(await screen.findByRole('header', { name: "Couldn't open your diary." })).toBeOnTheScreen();
  });

  it('NAV-11: the Android back button is consumed while replacing', async () => {
    await renderGate();
    const handlers: Parameters<typeof BackHandler.addEventListener>[1][] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler);
      return { remove: () => void handlers.splice(handlers.lastIndexOf(handler), 1) };
    });
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const real = start;
    start = async (options) => {
      if (options?.afterImport) await held;
      return real(options);
    };
    await fireEvent.press(screen.getByText('Replace now'));
    await act(async () => undefined);
    expect(screen.getByTestId('import-replacing')).toBeOnTheScreen();
    expect(screen.getByText('Importing…')).toBeOnTheScreen();
    let handled = false;
    await act(async () => {
      handled = [...handlers].reverse().some((h) => h({ type: 'hardwareBackPress', timeStamp: Date.now() }));
    });
    expect(handled).toBe(true);
    release();
    expect(await screen.findByText('first meal: Ceia')).toBeOnTheScreen();
    expect(handlers).toHaveLength(0); // the listener is removed once the app is back
  });
});

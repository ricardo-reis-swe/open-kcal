import { act, fireEvent, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import fs from 'node:fs';
import path from 'node:path';

import { RootLayoutView } from '@/app/_layout';
import { startServices } from '@/bootstrap/start-services';
import type { DatabaseLocation } from '@/data/db/database';
import { exportDirectory } from '@/data/db/transfer/exportDatabase';
import { removeDir, toUri } from '@/data/db/transfer/files';
import { importDirectory } from '@/data/db/transfer/validateImport';
import { fixedClock } from '@/shared/dates';
import { routes } from '@/shared/navigation/routes';
import { renderApp } from '@/shared/testing/appRoutes';
import { __resetFileTransfer, __setPickResult } from '@/shared/testing/fileTransferMock';
import { makeDbFile, makeTempDir } from '@/shared/testing/transferFixtures';

// Route tests run the real app over real SQLite files in a temp dir (ARCH-25): export file, staged copy, swap.

const clock = fixedClock('2026-09-25T10:00:00.000Z');

async function flush() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
  }
}

const activeDay = () => within(screen.getByTestId('diary-page-active'));

let location: DatabaseLocation;
function TestRootLayout() {
  return <RootLayoutView start={(options) => startServices({ ...options, location, clock })} />;
}

describe('NAV-06 / NAV-11 / UX-29: Export & Import routes', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempDir();
    __resetFileTransfer();
    location = { directory: dir, name: 'calorie-tracker.db' };
  });
  afterEach(async () => {
    jest.useRealTimers();
    fs.rmSync(dir, { recursive: true, force: true });
    await removeDir(importDirectory());
    await removeDir(exportDirectory());
  });

  const render = (url: string) => renderApp(url, { _layout: TestRootLayout });

  async function openDataTransfer() {
    await fireEvent.press(await screen.findByTestId('profile-data-transfer'));
    await flush();
  }

  it('NAV-06: Profile → Export & import → back → Profile', async () => {
    const app = await render('/profile');
    await openDataTransfer();
    expect(app.getPathname()).toBe('/profile/data-transfer');
    expect(await screen.findByTestId('data-transfer-export')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    await flush();
    expect(app.getPathname()).toBe('/profile');
  });

  it('UX-29: a rejected file shows its message inline and stays on the screen', async () => {
    const app = await render('/profile');
    await openDataTransfer();
    const junk = path.join(dir, 'junk.db');
    fs.writeFileSync(junk, Buffer.from(Array.from({ length: 2048 }, (_, i) => (i * 31 + 7) % 251)));
    __setPickResult({ uri: toUri(junk) });
    await fireEvent.press(await screen.findByTestId('data-transfer-import'));
    await flush();
    expect(await screen.findByText("This file isn't an Open Kcal export.")).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/profile/data-transfer');
    expect(screen.queryByText('Replace all data?')).toBeNull();
  });

  it('NAV-11 / DATA-32: a confirmed import lands on the Diary root on today with the toast, every stack reset', async () => {
    const source = await makeDbFile(makeTempDir(), 'export.db', { version: 5, entries: 3, mealName: 'Ceia' });
    const app = await render('/diary');
    // Browse to a past day, so "today" after the import is a visible reset.
    await fireEvent.press(await screen.findByTestId('diary-day-2026-09-23'));
    await flush();
    expect(await screen.findByTestId('diary-go-today')).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('tab-profile'));
    await flush();
    await openDataTransfer();
    __setPickResult({ uri: toUri(source) });
    await fireEvent.press(await screen.findByTestId('data-transfer-import'));
    await flush();
    expect(await screen.findByText('Replace all data?')).toBeOnTheScreen();
    expect(screen.getByText(/\(3 entries, latest /)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Replace data' }));
    await flush();

    expect(await screen.findByText('Data imported.')).toBeOnTheScreen();
    expect(app.getPathname()).toBe('/diary');
    expect(screen.queryByTestId('diary-go-today')).toBeNull(); // the Diary is on today again
    expect(await activeDay().findByText('Ceia')).toBeOnTheScreen(); // the imported meal
    // The Profile tab is back at its root, not on Export & import.
    await fireEvent.press(screen.getByTestId('tab-profile'));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(await screen.findByTestId('profile-data-transfer')).toBeOnTheScreen();
    expect(fs.existsSync(path.join(dir, 'import-pending'))).toBe(false);
    expect(fs.existsSync(path.join(dir, 'calorie-tracker.pre-import.db'))).toBe(false);
  });

  it('NAV-11: unsaved edits elsewhere are discarded without a Discard changes? dialog', async () => {
    const source = await makeDbFile(makeTempDir(), 'export.db', { entries: 1 });
    const app = await render('/profile');
    await fireEvent.press(await screen.findByTestId('profile-calories-macros'));
    await flush();
    await fireEvent.changeText(await screen.findByLabelText('Fat, g'), '70'); // dirty form, left open
    await act(async () => router.push(routes.dataTransfer()));
    await flush();
    expect(app.getPathname()).toBe('/profile/data-transfer');
    __setPickResult({ uri: toUri(source) });
    await fireEvent.press(await screen.findByTestId('data-transfer-import'));
    await flush();
    await fireEvent.press(await screen.findByRole('button', { name: 'Replace data' }));
    await flush();

    expect(await screen.findByText('Data imported.')).toBeOnTheScreen();
    expect(screen.queryByText('Discard changes?')).toBeNull();
    await fireEvent.press(screen.getByTestId('tab-profile'));
    await flush();
    expect(app.getPathname()).toBe('/profile');
    expect(screen.queryByLabelText('Fat, g')).toBeNull();
    expect(await screen.findByTestId('profile-data-transfer')).toBeOnTheScreen();
  });
});

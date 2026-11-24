import { act, fireEvent, screen } from '@testing-library/react-native';

import { DatabaseReplaceContext } from '@/bootstrap/databaseReplace';
import type { ImportSummary } from '@/data/db/transfer/validateImport';
import { DatabaseError, ValidationError, type ImportRejectReason } from '@/shared/errors';
import { pickFile, shareFile } from '@/shared/files/fileTransfer';
import { __resetFileTransfer, __setPickResult, __setShareAvailable } from '@/shared/testing/fileTransferMock';
import { createTestServices, renderWithServices } from '@/shared/testing/services';

import { DataTransferScreen } from '../DataTransferScreen';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const summary = (over: Partial<ImportSummary> = {}): ImportSummary => ({
  schemaVersion: 7,
  entryCount: 3,
  latestDiaryDate: '2025-11-14',
  ...over,
});
const fullDate = (iso: string) =>
  new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(iso),
  );

async function setup(options: { language?: 'en' | 'pt-PT' } = {}) {
  const { services } = await createTestServices();
  const replace = jest.fn();
  const onBack = jest.fn();
  const view = await renderWithServices(
    <DatabaseReplaceContext.Provider value={replace}>
      <DataTransferScreen onBack={onBack} />
    </DatabaseReplaceContext.Provider>,
    services,
    options,
  );
  return { services, replace, onBack, view };
}

const reject = (reason: ImportRejectReason) => new ValidationError('Import rejected', [], { reason });

beforeEach(() => __resetFileTransfer());
afterEach(() => jest.restoreAllMocks());

describe('UX-29: Export & Import screen', () => {
  it('shows the intro, both sections and the helper texts, with no primary action', async () => {
    await setup();
    expect(screen.getByText('Export & import')).toBeOnTheScreen();
    expect(screen.getByText(/Your data is stored only on this phone/)).toBeOnTheScreen();
    expect(screen.getByText('Export data')).toBeOnTheScreen();
    expect(screen.getByText(/Creates one file with all your data/)).toBeOnTheScreen();
    expect(screen.getByText(/The file isn't encrypted/)).toBeOnTheScreen();
    expect(screen.getByText('Import data')).toBeOnTheScreen();
    expect(screen.getByText(/Replaces all data on this phone/)).toBeOnTheScreen();
    expect(screen.queryByTestId('data-transfer-checking')).toBeNull();
  });

  describe('DATA-30 export', () => {
    it('prepares the file, then opens the share sheet with open-kcal-<date>.db', async () => {
      const { services } = await setup();
      const snapshot = deferred<{ uri: string; bytes: number }>();
      jest.spyOn(services.transfer, 'exportSnapshot').mockReturnValue(snapshot.promise);
      await fireEvent.press(screen.getByTestId('data-transfer-export'));
      expect(screen.getByText('Preparing file…')).toBeOnTheScreen();
      expect(screen.getByTestId('data-transfer-export')).toBeDisabled();
      expect(screen.getByTestId('data-transfer-import')).toBeDisabled();
      await act(async () => snapshot.resolve({ uri: 'file:///cache/export/open-kcal-2026-09-25.db', bytes: 1 }));
      expect(shareFile).toHaveBeenCalledWith('file:///cache/export/open-kcal-2026-09-25.db', {
        dialogTitle: 'Export Open Kcal data',
      });
      expect(screen.queryByText('Preparing file…')).toBeNull();
      expect(screen.queryByTestId('data-transfer-export-error')).toBeNull(); // dismissing the sheet shows nothing
      expect(screen.getByTestId('data-transfer-export')).toBeEnabled();
    });

    it('exports a real snapshot of the diary', async () => {
      await setup();
      await fireEvent.press(screen.getByTestId('data-transfer-export'));
      await act(async () => undefined);
      expect(shareFile).toHaveBeenCalledTimes(1);
      expect((shareFile as jest.Mock).mock.calls[0][0]).toMatch(/^file:\/\/.*open-kcal-2026-09-25\.db$/);
    });

    it('says so when sharing is unavailable', async () => {
      __setShareAvailable(false);
      await setup();
      await fireEvent.press(screen.getByTestId('data-transfer-export'));
      await act(async () => undefined);
      expect(await screen.findByText("Sharing isn't available on this device.")).toBeOnTheScreen();
    });

    it('shows an inline error when the export fails', async () => {
      const { services } = await setup();
      jest.spyOn(services.transfer, 'exportSnapshot').mockRejectedValue(new DatabaseError('x'));
      await fireEvent.press(screen.getByTestId('data-transfer-export'));
      await act(async () => undefined);
      expect(await screen.findByText("Couldn't export. Try again.")).toBeOnTheScreen();
      expect(screen.getByTestId('data-transfer-export')).toBeEnabled();
    });
  });

  describe('DATA-31 import', () => {
    it('a cancelled picker shows nothing', async () => {
      const { services } = await setup();
      const stage = jest.spyOn(services.transfer, 'stageImport');
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      expect(pickFile).toHaveBeenCalledTimes(1);
      expect(stage).not.toHaveBeenCalled();
      expect(screen.queryByTestId('data-transfer-import-error')).toBeNull();
      expect(screen.queryByTestId('data-transfer-checking')).toBeNull();
      expect(screen.getByTestId('data-transfer-import')).toBeEnabled();
    });

    it('a picker that fails to copy shows errorReadFailed', async () => {
      const { services } = await setup();
      const stage = jest.spyOn(services.transfer, 'stageImport');
      (pickFile as jest.Mock).mockRejectedValueOnce(new DatabaseError('File operation failed'));
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      expect(stage).not.toHaveBeenCalled();
      expect(screen.getByTestId('data-transfer-import-error')).toHaveTextContent(/read the file/);
    });

    it('leaving while the picker is open removes the picked file', async () => {
      const { services, view } = await setup();
      const picker = deferred<{ canceled: false; uri: string; size: number | null }>();
      (pickFile as jest.Mock).mockReturnValueOnce(picker.promise);
      const stage = jest.spyOn(services.transfer, 'stageImport');
      const discardPicked = jest.spyOn(services.transfer, 'discardPicked').mockResolvedValue();
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await view.unmount();
      await act(async () => picker.resolve({ canceled: false, uri: 'file:///cache/picked.db', size: 5 }));
      expect(stage).not.toHaveBeenCalled();
      expect(discardPicked).toHaveBeenCalledWith('file:///cache/picked.db');
    });

    it('shows Checking file… while validating, then the confirm dialog with count and latest date', async () => {
      const { services } = await setup();
      const staged = deferred<{ stagedPath: string; summary: ImportSummary }>();
      const stage = jest.spyOn(services.transfer, 'stageImport').mockReturnValue(staged.promise);
      __setPickResult({ uri: 'file:///cache/picked.db', size: 1234 });
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      expect(screen.getByText('Checking file…')).toBeOnTheScreen();
      expect(stage).toHaveBeenCalledWith('file:///cache/picked.db', 1234);
      await act(async () => staged.resolve({ stagedPath: '/cache/import/staged.db', summary: summary() }));
      expect(screen.getByText('Replace all data?')).toBeOnTheScreen();
      expect(
        screen.getByText(
          `This phone's diary, foods, recipes, meals, goals and weight will be replaced by the file (3 entries, latest ${fullDate('2025-11-14')}). This can't be undone.`,
        ),
      ).toBeOnTheScreen();
      expect(screen.getByText('Replace data')).toBeOnTheScreen();
    });

    it('uses the singular for one entry and a no-entries variant for an empty diary', async () => {
      const { services } = await setup();
      const stage = jest.spyOn(services.transfer, 'stageImport');
      __setPickResult({ uri: 'file:///cache/picked.db' });
      stage.mockResolvedValueOnce({ stagedPath: '/s.db', summary: summary({ entryCount: 1 }) });
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      expect(screen.getByText(/\(1 entry, latest /)).toBeOnTheScreen();
      await fireEvent.press(screen.getByText('Cancel'));
      stage.mockResolvedValueOnce({ stagedPath: '/s.db', summary: summary({ entryCount: 0, latestDiaryDate: null }) });
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      expect(screen.getByText(/\(no diary entries\)/)).toBeOnTheScreen();
    });

    it.each([
      [reject('empty'), 'This file is empty.'],
      [reject('tooLarge'), 'This file is too large to be an Open Kcal export.'],
      [reject('notSqlite'), "This file isn't an Open Kcal export."],
      [reject('notOpenKcal'), "This file isn't an Open Kcal export."],
      [reject('corrupt'), "This file is damaged and can't be imported."],
      [reject('newerVersion'), 'This file comes from a newer version of Open Kcal. Update the app, then try again.'],
      [reject('migrationFailed'), "Couldn't import. Your data wasn't changed."],
      [new DatabaseError('File operation failed'), "Couldn't read the file. Try again."],
      [new Error('boom'), "Couldn't import. Your data wasn't changed."],
    ])('shows the message for %p inline under the row', async (error, message) => {
      const { services, replace } = await setup();
      jest.spyOn(services.transfer, 'stageImport').mockRejectedValue(error);
      __setPickResult({ uri: 'file:///cache/picked.db' });
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      expect(await screen.findByText(message)).toBeOnTheScreen();
      expect(screen.queryByText('Replace all data?')).toBeNull();
      expect(replace).not.toHaveBeenCalled();
      expect(screen.getByTestId('data-transfer-import')).toBeEnabled();
    });

    it('Cancel discards the staged copy and shows nothing', async () => {
      const { services, replace } = await setup();
      jest.spyOn(services.transfer, 'stageImport').mockResolvedValue({ stagedPath: '/s.db', summary: summary() });
      const discard = jest.spyOn(services.transfer, 'discardStaged').mockResolvedValue();
      __setPickResult({ uri: 'file:///cache/picked.db' });
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      await fireEvent.press(screen.getByText('Cancel'));
      expect(discard).toHaveBeenCalledTimes(1);
      expect(replace).not.toHaveBeenCalled();
      expect(screen.queryByText('Replace all data?')).toBeNull();
      expect(screen.getByTestId('data-transfer-import')).toBeEnabled();
    });

    it('Replace data hands the staged path to the gate', async () => {
      const { services, replace, view } = await setup();
      // The gate unmounts the screen as part of the same call: that must not discard the file the swap will use.
      replace.mockImplementation(() => void view.unmount());
      jest
        .spyOn(services.transfer, 'stageImport')
        .mockResolvedValue({ stagedPath: '/cache/import/staged.db', summary: summary() });
      const discard = jest.spyOn(services.transfer, 'discardStaged').mockResolvedValue();
      __setPickResult({ uri: 'file:///cache/picked.db' });
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      await fireEvent.press(screen.getByText('Replace data'));
      expect(replace).toHaveBeenCalledWith('/cache/import/staged.db');
      expect(discard).not.toHaveBeenCalled();
    });

    it('leaving during Checking file… discards the staged copy once it finishes', async () => {
      const { services, view } = await setup();
      const staged = deferred<{ stagedPath: string; summary: ImportSummary }>();
      jest.spyOn(services.transfer, 'stageImport').mockReturnValue(staged.promise);
      const discard = jest.spyOn(services.transfer, 'discardStaged').mockResolvedValue();
      __setPickResult({ uri: 'file:///cache/picked.db' });
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      await view.unmount();
      expect(discard).toHaveBeenCalledTimes(1);
      await act(async () => staged.resolve({ stagedPath: '/s.db', summary: summary() }));
      expect(discard).toHaveBeenCalledTimes(2); // the late result is discarded too
    });

    it('leaving with the dialog open discards the staged copy', async () => {
      const { services, view } = await setup();
      jest.spyOn(services.transfer, 'stageImport').mockResolvedValue({ stagedPath: '/s.db', summary: summary() });
      const discard = jest.spyOn(services.transfer, 'discardStaged').mockResolvedValue();
      __setPickResult({ uri: 'file:///cache/picked.db' });
      await fireEvent.press(screen.getByTestId('data-transfer-import'));
      await act(async () => undefined);
      await view.unmount();
      expect(discard).toHaveBeenCalledTimes(1);
    });
  });

  it('ARCH-22: pt-PT smoke render', async () => {
    await setup({ language: 'pt-PT' });
    expect(screen.getByText('Exportar e importar')).toBeOnTheScreen();
    expect(screen.getByText('Exportar dados')).toBeOnTheScreen();
    expect(screen.getByText('Importar dados')).toBeOnTheScreen();
    expect(screen.getByText(/O ficheiro não está encriptado/)).toBeOnTheScreen();
  });
});

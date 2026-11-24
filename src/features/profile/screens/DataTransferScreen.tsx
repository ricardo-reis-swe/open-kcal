import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useReplaceDatabase } from '@/bootstrap/databaseReplace';
import { useServices } from '@/bootstrap/services';
import type { ImportSummary } from '@/data/db/transfer/validateImport';
import { AppBar, AppText, ConfirmationDialog, InlineStatus, ListRow, SectionHeader } from '@/shared/components';
import { DatabaseError, ValidationError } from '@/shared/errors';
import { pickFile, shareFile } from '@/shared/files/fileTransfer';
import { formatFullDate } from '@/shared/i18n/format';
import { useFormattingLocale } from '@/shared/i18n/useFormattingLocale';
import { useTheme } from '@/shared/theme';

type Props = { onBack: () => void };

type Phase =
  | { kind: 'idle' }
  | { kind: 'exporting' }
  | { kind: 'checking' }
  | { kind: 'confirm'; stagedPath: string; summary: ImportSummary }
  | { kind: 'importing' };

type ErrorKey =
  | 'exportFailed'
  | 'shareUnavailable'
  | 'errorEmpty'
  | 'errorTooLarge'
  | 'errorNotOpenKcal'
  | 'errorCorrupt'
  | 'errorNewerVersion'
  | 'errorReadFailed'
  | 'importFailed';

/** DATA-31: one message per rejection reason (ARCH-02: exhaustive over the union). */
function importErrorKey(error: unknown): ErrorKey {
  if (error instanceof ValidationError && error.reason) {
    switch (error.reason) {
      case 'empty':
        return 'errorEmpty';
      case 'tooLarge':
        return 'errorTooLarge';
      case 'notSqlite':
      case 'notOpenKcal':
        return 'errorNotOpenKcal';
      case 'corrupt':
        return 'errorCorrupt';
      case 'newerVersion':
        return 'errorNewerVersion';
      case 'migrationFailed':
        return 'importFailed';
    }
  }
  return error instanceof DatabaseError ? 'errorReadFailed' : 'importFailed';
}

/**
 * UX-29 Export & Import (SCOPE-14). Two actions with helper text; no primary action. Export hands one file to the
 * share sheet (DATA-30); Import picks, validates on a staged copy (DATA-31), confirms, then asks StartupGate to
 * replace the database (DATA-32), which unmounts this screen (NAV-11).
 */
export function DataTransferScreen({ onBack }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const locale = useFormattingLocale();
  const { transfer } = useServices();
  const replaceDatabase = useReplaceDatabase();
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [exportError, setExportError] = useState<ErrorKey | null>(null);
  const [importError, setImportError] = useState<ErrorKey | null>(null);
  // The latest phase, readable from the unmount cleanup; every change goes through `changePhase`.
  const phaseRef = useRef<Phase>(phase);
  const changePhase = (next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  };
  const active = useRef(true);

  // UX-29: leaving during `Checking file…` or the dialog discards the staged copy (DATA-32). `importing` keeps it:
  // the gate is using it.
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      const kind = phaseRef.current.kind;
      if (kind === 'checking' || kind === 'confirm') void transfer.discardStaged().catch(() => undefined);
    };
  }, [transfer]);

  const idle = phase.kind === 'idle';

  const exportData = async () => {
    setExportError(null);
    setImportError(null);
    changePhase({ kind: 'exporting' });
    try {
      const { uri } = await transfer.exportSnapshot();
      const result = await shareFile(uri, { dialogTitle: t('dataTransfer.shareTitle') });
      if (active.current && result === 'unavailable') setExportError('shareUnavailable');
    } catch {
      if (active.current) setExportError('exportFailed');
    }
    // Dismissing or cancelling the share sheet is not an error (DATA-30).
    if (active.current) changePhase({ kind: 'idle' });
  };

  const importData = async () => {
    setExportError(null);
    setImportError(null);
    changePhase({ kind: 'checking' });
    try {
      const picked = await pickFile();
      if (picked.canceled) {
        if (active.current) changePhase({ kind: 'idle' });
        return;
      }
      if (!active.current) {
        void transfer.discardPicked(picked.uri).catch(() => undefined); // DATA-32: the cache copy doesn't linger
        return;
      }
      const staged = await transfer.stageImport(picked.uri, picked.size);
      if (!active.current) {
        void transfer.discardStaged().catch(() => undefined);
        return;
      }
      changePhase({ kind: 'confirm', stagedPath: staged.stagedPath, summary: staged.summary });
    } catch (error) {
      if (!active.current) return;
      setImportError(importErrorKey(error));
      changePhase({ kind: 'idle' });
    }
  };

  const cancelImport = () => {
    void transfer.discardStaged().catch(() => undefined);
    changePhase({ kind: 'idle' });
  };

  const confirmImport = () => {
    if (phase.kind !== 'confirm') return;
    const { stagedPath } = phase;
    // The gate unmounts this screen in the same batch, before it re-renders: the ref must already say `importing`, so
    // the unmount cleanup doesn't discard the staged copy the swap is about to use.
    changePhase({ kind: 'importing' });
    replaceDatabase(stagedPath); // the gate unmounts this screen; nothing runs after this call
  };

  const confirming = phase.kind === 'confirm' ? phase : null;
  const confirmBody = confirming
    ? confirming.summary.entryCount > 0 && confirming.summary.latestDiaryDate
      ? t('dataTransfer.confirmBody', {
          count: confirming.summary.entryCount,
          date: formatFullDate(confirming.summary.latestDiaryDate, locale),
        })
      : t('dataTransfer.confirmBodyEmpty')
    : undefined;

  const helper = (key: 'exportHelp' | 'exportPrivacy' | 'importHelp') => (
    <AppText variant="compact" color="textSecondary" style={{ paddingHorizontal: theme.spacing[4] }}>
      {t(`dataTransfer.${key}`)}
    </AppText>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('dataTransfer.title')} back={{ label: t('common.back'), onPress: onBack }} />
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing[8], gap: theme.spacing[2] }}>
        <AppText color="textSecondary" style={{ padding: theme.spacing[4] }}>
          {t('dataTransfer.intro')}
        </AppText>

        <SectionHeader label={t('dataTransfer.exportSection')} uppercase />
        <ListRow
          label={t('dataTransfer.export')}
          onPress={() => void exportData()}
          disabled={!idle}
          testID="data-transfer-export"
        />
        {helper('exportHelp')}
        {helper('exportPrivacy')}
        {phase.kind === 'exporting' ? (
          <InlineStatus tone="loading" message={t('dataTransfer.exporting')} testID="data-transfer-exporting" />
        ) : null}
        {exportError ? (
          <InlineStatus tone="error" message={t(`dataTransfer.${exportError}`)} testID="data-transfer-export-error" />
        ) : null}

        <SectionHeader label={t('dataTransfer.importSection')} uppercase />
        <ListRow
          label={t('dataTransfer.import')}
          onPress={() => void importData()}
          disabled={!idle}
          testID="data-transfer-import"
        />
        {helper('importHelp')}
        {phase.kind === 'checking' ? (
          <InlineStatus tone="loading" message={t('dataTransfer.checking')} testID="data-transfer-checking" />
        ) : null}
        {importError ? (
          <InlineStatus tone="error" message={t(`dataTransfer.${importError}`)} testID="data-transfer-import-error" />
        ) : null}
      </ScrollView>
      <ConfirmationDialog
        visible={confirming !== null}
        title={t('dataTransfer.confirmTitle')}
        body={confirmBody}
        confirmLabel={t('dataTransfer.confirmAction')}
        cancelLabel={t('common.cancel')}
        destructive
        onCancel={cancelImport}
        onConfirm={confirmImport}
        testID="data-transfer-confirm"
      />
    </View>
  );
}

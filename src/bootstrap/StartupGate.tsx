// ARCH-17: the launch screen stays until config + migrations succeed, then services, Query and the Router mount.
// A failure shows the recovery screen (UX-20); Retry runs the same startup again. Never a reset.
import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, View } from 'react-native';

import { LATEST_SCHEMA_VERSION } from '@/data/db/migrations';
import { closeForSwap, commitImport, rollbackImport, swapIn } from '@/data/db/transfer/replaceDatabase';
import { discardStagedImport } from '@/data/db/transfer/validateImport';
import { settingsKeys } from '@/features/diary/diary.queries';
import { refreshWidget } from '@/features/widget/refreshWidget';
import { AppText } from '@/shared/components';
import { toAppError, type AppError } from '@/shared/errors';
import { logger } from '@/shared/logging/logger';
import { announceAppNotice } from '@/shared/notices/appNotice';
import { useTheme } from '@/shared/theme';

import { DatabaseReplaceContext } from './databaseReplace';
import { seedDevFoodSearch } from './devSeed';
import { onDevSeedRequest } from './devSeedLink';
import { configureOnlineManager, createQueryClient } from './query-client';
import { RecoveryScreen } from './RecoveryScreen';
import { ServicesProvider, type AppServices } from './services';

type Ready = { services: AppServices; queryClient: ReturnType<typeof createQueryClient> };
type State =
  | { status: 'starting'; attempt: number }
  | { status: 'ready'; ready: Ready }
  | { status: 'replacing'; previous: Ready; stagedPath: string }
  | { status: 'failed'; error: AppError; attempt: number };

export type StartupGateProps = {
  /** `afterImport` is DATA-32 step 6: the start that follows a database swap or rollback. */
  start: (options?: { afterImport?: boolean }) => Promise<AppServices>;
  appVersion: string;
  copyText: (text: string) => Promise<void> | void;
  children: ReactNode;
};

export function StartupGate({ start, appVersion, copyText, children }: StartupGateProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: 'starting', attempt: 0 });
  const attempt = state.status === 'ready' || state.status === 'replacing' ? -1 : state.attempt;
  const starting = state.status === 'starting';

  useEffect(() => configureOnlineManager(), []);

  // Query client + theme preload, the same path for the first start and for every restart after an import.
  const finishStart = useCallback(async (services: AppServices): Promise<Ready> => {
    const queryClient = createQueryClient();
    // UX-23: the theme is read before the Router mounts, so the app never flashes the other scheme. A failed
    // read leaves the query to fetch normally (the app follows the system until then).
    await services.settings.getThemePreference().then(
      (preference) => queryClient.setQueryData(settingsKeys.themePreference, preference),
      () => undefined,
    );
    return { services, queryClient };
  }, []);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!starting) return;
    let cancelled = false;
    start().then(
      async (services) => {
        const ready = await finishStart(services);
        if (cancelled) return;
        setState({ status: 'ready', ready });
        refreshWidget(); // DATA-22: after migrations, so a widget left unavailable by an app update recovers.
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'failed', error: toAppError(error), attempt });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [start, starting, attempt, finishStart]);

  // DATA-32: stop → swap → restart. The Router, services and Query client are already unmounted when this runs.
  const replacing = state.status === 'replacing' ? state : null;
  const replacingHandled = useRef<object | null>(null);
  useEffect(() => {
    if (!replacing || replacingHandled.current === replacing) return;
    replacingHandled.current = replacing;
    const { previous, stagedPath } = replacing;
    const location = previous.services.databaseLocation;
    const started = Date.now();
    const go = (ready: Ready, notice: 'dataImported' | 'importFailed') => {
      if (!mounted.current) return;
      announceAppNotice(notice); // before the Diary mounts, so its toast shows once
      setState({ status: 'ready', ready });
      refreshWidget(); // DATA-22/DATA-32: not a mutation, so redraw explicitly (also after a rollback)
    };
    void (async () => {
      await previous.queryClient.cancelQueries().catch(() => undefined);
      previous.queryClient.clear();
      // Step 2: checkpoint + close. A failure (e.g. busy) means nothing has been touched.
      try {
        await closeForSwap(previous.services.db);
      } catch (error) {
        logger.warn('import stopped before the swap', { code: toAppError(error).category });
        await previous.services.db.close().catch(() => undefined);
        await discardStagedImport().catch(() => undefined);
        try {
          go(await finishStart(await start()), 'importFailed');
        } catch (restartError) {
          if (mounted.current) setState({ status: 'failed', error: toAppError(restartError), attempt: 0 });
        }
        logger.info('import finished', { outcome: 'failed', durationMs: Date.now() - started });
        return;
      }
      try {
        await swapIn(location, stagedPath);
        const services = await start({ afterImport: true });
        try {
          // A marker that can't be removed would let a later launch roll back this successful import (DATA-32).
          await commitImport(location);
        } catch (commitError) {
          await services.db.close().catch(() => undefined);
          throw commitError;
        }
        const ready = await finishStart(services);
        logger.info('import finished', { outcome: 'imported', durationMs: Date.now() - started });
        go(ready, 'dataImported');
      } catch (swapError) {
        logger.error('import failed, rolling back', toAppError(swapError), { code: toAppError(swapError).category });
        try {
          await rollbackImport(location);
          const ready = await finishStart(await start({ afterImport: true }));
          logger.info('import finished', { outcome: 'rolledBack', durationMs: Date.now() - started });
          go(ready, 'importFailed');
        } catch (rollbackError) {
          // UX-20 recovery; its Retry runs the normal start, which retries the rollback if the marker is still there.
          logger.info('import finished', { outcome: 'failed', durationMs: Date.now() - started });
          if (mounted.current) setState({ status: 'failed', error: toAppError(rollbackError), attempt: 0 });
        }
      }
    })();
  }, [replacing, start, finishStart]);

  // ARCH-18: the dev-only `calorietracker://dev-seed` link seeds the local Maestro fixtures once services are up.
  const ready = state.status === 'ready' ? state.ready : undefined;
  useEffect(() => {
    if (!__DEV__ || !ready) return;
    return onDevSeedRequest(() => {
      seedDevFoodSearch(ready.services).then(
        () => {
          refreshWidget(); // DATA-22: the dev seed isn't a mutation.
          return ready.queryClient.invalidateQueries();
        },
        (error: unknown) => logger.warn('dev seed failed', { code: toAppError(error).category }),
      );
    });
  }, [ready]);

  const retry = useCallback(() => setState({ status: 'starting', attempt: attempt + 1 }), [attempt]);

  const readyForReplace = state.status === 'ready' ? state.ready : null;
  const replaceDatabase = useCallback(
    (stagedPath: string) => {
      if (readyForReplace) setState({ status: 'replacing', previous: readyForReplace, stagedPath });
    },
    [readyForReplace],
  );

  if (state.status === 'ready') {
    return (
      <DatabaseReplaceContext.Provider value={replaceDatabase}>
        <ServicesProvider services={state.ready.services}>
          <QueryClientProvider client={state.ready.queryClient}>{children}</QueryClientProvider>
        </ServicesProvider>
      </DatabaseReplaceContext.Provider>
    );
  }
  if (state.status === 'replacing') return <ReplacingView />;
  if (state.status === 'failed') {
    return (
      <RecoveryScreen
        error={state.error}
        diagnostics={{ appVersion, schemaVersion: LATEST_SCHEMA_VERSION }}
        onRetry={retry}
        copyText={copyText}
      />
    );
  }
  // Continues the native launch screen (plain canvas) while SQLite opens; announced for screen readers.
  return (
    <View
      testID="launch-screen"
      accessible
      accessibilityLabel={t('startup.loading')}
      style={{ flex: 1, backgroundColor: theme.colors.canvas }}
    />
  );
}

/** NAV-11: shown while an import replaces the data. Back is consumed: the Router is gone, so back would leave the app. */
function ReplacingView() {
  const { t } = useTranslation();
  const theme = useTheme();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);
  return (
    <View
      testID="import-replacing"
      accessibilityLiveRegion="polite"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing[4],
        backgroundColor: theme.colors.canvas,
      }}
    >
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <AppText>{t('dataTransfer.importing')}</AppText>
    </View>
  );
}

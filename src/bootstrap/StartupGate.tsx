// ARCH-17: the launch screen stays until config + migrations succeed, then services, Query and the Router mount.
// A failure shows the recovery screen (UX-20); Retry runs the same startup again. Never a reset.
import { QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { LATEST_SCHEMA_VERSION } from '@/data/db/migrations';
import { refreshWidget } from '@/features/widget/refreshWidget';
import { toAppError, type AppError } from '@/shared/errors';
import { logger } from '@/shared/logging/logger';
import { useTheme } from '@/shared/theme';

import { seedDevFoodSearch } from './devSeed';
import { onDevSeedRequest } from './devSeedLink';
import { configureOnlineManager, createQueryClient } from './query-client';
import { RecoveryScreen } from './RecoveryScreen';
import { ServicesProvider, type AppServices } from './services';

type Ready = { services: AppServices; queryClient: ReturnType<typeof createQueryClient> };
type State =
  | { status: 'starting'; attempt: number }
  | { status: 'ready'; ready: Ready }
  | { status: 'failed'; error: AppError; attempt: number };

export type StartupGateProps = {
  start: () => Promise<AppServices>;
  appVersion: string;
  copyText: (text: string) => Promise<void> | void;
  children: ReactNode;
};

export function StartupGate({ start, appVersion, copyText, children }: StartupGateProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [state, setState] = useState<State>({ status: 'starting', attempt: 0 });
  const attempt = state.status === 'ready' ? -1 : state.attempt;
  const starting = state.status === 'starting';

  useEffect(() => configureOnlineManager(), []);

  useEffect(() => {
    if (!starting) return;
    let cancelled = false;
    start().then(
      (services) => {
        if (cancelled) return;
        setState({ status: 'ready', ready: { services, queryClient: createQueryClient() } });
        refreshWidget(); // DATA-22: after migrations, so a widget left unavailable by an app update recovers.
      },
      (error: unknown) => {
        if (!cancelled) setState({ status: 'failed', error: toAppError(error), attempt });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [start, starting, attempt]);

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

  if (state.status === 'ready') {
    return (
      <ServicesProvider services={state.ready.services}>
        <QueryClientProvider client={state.ready.queryClient}>{children}</QueryClientProvider>
      </ServicesProvider>
    );
  }
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

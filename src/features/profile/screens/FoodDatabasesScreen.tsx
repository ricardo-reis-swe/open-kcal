import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Linking, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useServices } from '@/bootstrap/services';
import { ProviderConfigurationError, RateLimitError, ValidationError } from '@/shared/errors';
import { validateUsdaApiKey } from '@/data/secure-storage/credentialsService';
import { UsdaClient } from '@/data/api/usda/client';
import {
  AppBar,
  AppText,
  ConfirmationDialog,
  FormField,
  InlineStatus,
  ListRow,
  PrimaryButton,
  TextAction,
} from '@/shared/components';
import { useOnlineStatus } from '@/features/food-search/food-search.queries';
import { credentialKeys } from '@/features/profile/profile.queries';
import { useTheme } from '@/shared/theme';

type Status = 'notSet' | 'saved' | 'active' | 'rejected';

/** UX-18 / PROV-11. The candidate key only exists in this input and request header. */
export function FoodDatabasesScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const services = useServices();
  const online = useOnlineStatus();
  const client = useQueryClient();
  // UX-15: the Profile row shows whether a key is saved.
  const refreshProfile = () => client.invalidateQueries({ queryKey: credentialKeys.usdaConfigured });
  const [hint, setHint] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('notSet');
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const load = useCallback(async () => {
    const value = await services.credentials.getUsdaApiKeyHint();
    setHint(value);
    setStatus(value ? 'saved' : 'notSet');
  }, [services.credentials]);
  useEffect(() => {
    // Resolve on the next turn so the initial paint is not synchronously cascaded by secure storage.
    void Promise.resolve().then(load);
  }, [load]);

  const check = async (candidate: string): Promise<'active' | 'saved' | 'rejected' | 'rateLimited'> => {
    if (!online) return 'saved';
    // Do not mutate the credentials service for a replacement until the key is accepted (PROV-11).
    const client = new UsdaClient(services.config, { getUsdaApiKeyForRequest: async () => candidate });
    try {
      await client.search('apple', 1, new AbortController().signal);
      return 'active';
    } catch (cause) {
      if (cause instanceof RateLimitError) return 'rateLimited';
      if (cause instanceof ProviderConfigurationError) return 'rejected';
      return 'saved';
    }
  };
  const save = async () => {
    setError(null);
    setMessage(null);
    let candidate: string;
    try {
      candidate = validateUsdaApiKey(key);
    } catch (cause) {
      setError(
        cause instanceof ValidationError && key.trim() === 'DEMO_KEY'
          ? t('foodDatabases.demoKey')
          : t('foodDatabases.keyError'),
      );
      return;
    }
    setBusy(true);
    try {
      const outcome = await check(candidate);
      if (outcome === 'rejected') {
        setStatus('rejected');
        setError(t('foodDatabases.rejected'));
        return;
      }
      await services.credentials.saveUsdaApiKey(candidate);
      void refreshProfile();
      setHint(await services.credentials.getUsdaApiKeyHint());
      setStatus(outcome === 'rateLimited' ? 'active' : outcome);
      setEditing(false);
      setKey('');
      setMessage(
        outcome === 'active'
          ? t('foodDatabases.keyWorks')
          : outcome === 'rateLimited'
            ? t('foodDatabases.keyRateLimited')
            : t('foodDatabases.savedOffline'),
      );
    } finally {
      setBusy(false);
    }
  };
  const test = async () => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const existing = await services.credentials.getUsdaApiKeyForRequest();
      if (!existing) return;
      const outcome = await check(existing);
      if (outcome === 'rejected') {
        setStatus('rejected');
        setError(t('foodDatabases.rejected'));
      } else if (outcome === 'active' || outcome === 'rateLimited') {
        setStatus('active');
        setMessage(outcome === 'active' ? t('foodDatabases.keyWorks') : t('foodDatabases.keyRateLimited'));
      } else {
        // PROV-11: a reachability failure does not change the session status of a stored key.
        setError(t('foodDatabases.testFailed'));
      }
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setConfirmRemove(false);
    setBusy(true);
    try {
      await services.credentials.removeUsdaApiKey();
      void refreshProfile();
      setHint(null);
      setStatus('notSet');
      setMessage(null);
      setError(null);
    } finally {
      setBusy(false);
    }
  };
  const statusText =
    status === 'notSet'
      ? t('foodDatabases.notSet')
      : status === 'active'
        ? t('foodDatabases.active')
        : status === 'rejected'
          ? t('foodDatabases.rejectedStatus')
          : t('foodDatabases.saved');
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar title={t('foodDatabases.title')} back={{ label: t('common.back'), onPress: onBack }} />
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing[4], gap: theme.spacing[3] }}
        keyboardDismissMode="on-drag"
      >
        <ListRow label={t('foodDatabases.openFoodFacts')} value={t('foodDatabases.alwaysOn')} />
        <ListRow label={t('foodDatabases.usda')} value={statusText} testID="usda-status" />
        {hint ? <AppText color="textSecondary">{hint}</AppText> : null}
        {error ? <InlineStatus tone="error" message={error} /> : null}
        {message ? <InlineStatus tone="info" message={message} /> : null}
        {editing ? (
          <>
            <FormField
              label={t('foodDatabases.key')}
              value={key}
              onChangeText={setKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              testID="usda-key-input"
            />
            <TextAction
              icon="open-outline"
              label={t('foodDatabases.signup')}
              onPress={() => void Linking.openURL('https://api.data.gov/signup/')}
            />
            <PrimaryButton
              label={busy ? t('foodDatabases.testing') : t('foodDatabases.saveKey')}
              onPress={() => void save()}
              disabled={busy}
              testID="usda-save-key"
            />
          </>
        ) : hint ? (
          <>
            <TextAction
              icon="create-outline"
              label={t('foodDatabases.replaceKey')}
              onPress={() => {
                setEditing(true);
                setError(null);
                setMessage(null);
              }}
            />
            <TextAction
              icon="refresh"
              label={busy ? t('foodDatabases.testing') : t('foodDatabases.testKey')}
              onPress={() => void test()}
              disabled={!online || busy}
            />
            {!online ? (
              <AppText variant="compact" color="textSecondary">
                {t('foodDatabases.connectToTest')}
              </AppText>
            ) : null}
            <TextAction
              icon="trash-outline"
              label={t('foodDatabases.removeKey')}
              onPress={() => setConfirmRemove(true)}
            />
          </>
        ) : (
          <TextAction icon="add" label={t('foodDatabases.addKey')} onPress={() => setEditing(true)} />
        )}
      </ScrollView>
      <ConfirmationDialog
        visible={confirmRemove}
        title={t('foodDatabases.removeTitle')}
        body={t('foodDatabases.removeBody')}
        cancelLabel={t('common.cancel')}
        confirmLabel={t('foodDatabases.removeKey')}
        destructive
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() => void remove()}
      />
    </View>
  );
}

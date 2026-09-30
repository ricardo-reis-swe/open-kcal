import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { useServices } from '@/bootstrap/services';
import type { Food } from '@/data/db/repositories/foodsRepository';
import { displayBarcode, toGtin14, type Gtin14 } from '@/domain/food/barcode';
import {
  AppBar,
  AppText,
  FormField,
  InlineStatus,
  PressableIcon,
  PrimaryButton,
  TextAction,
} from '@/shared/components';
import { useTheme } from '@/shared/theme';

import { lookupBarcode, type BarcodeLookupResult, type BarcodeProvider } from '../barcodeLookup';
import { BarcodeCamera, isCameraAvailable, useCameraPermission } from '../components/BarcodeCamera';
import { foodSearchKeys, useFoodSearchSections, useOnlineStatus } from '../food-search.queries';

type Props = {
  onBack: () => void;
  /** NAV-04: replaces the scanner with Food Detail. */
  onFound: (food: Food) => void;
  /** NAV-04: replaces the scanner with Create Custom Food, keeping the barcode (DATA-24). */
  onCreateCustom: (gtin: Gtin14) => void;
};

type NotFound = Extract<BarcodeLookupResult, { kind: 'notFound' }>;
type Phase =
  { kind: 'scanning' } | { kind: 'lookingUp'; gtin: Gtin14 } | { kind: 'notFound'; gtin: Gtin14; result: NotFound };

/** UX-24 Barcode Scanner: camera or manual code → PROV-15 lookup → Food Detail, or the not-found choices. */
export function BarcodeScannerScreen({ onBack, onFound, onCreateCustom }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const services = useServices();
  const client = useQueryClient();
  const sections = useFoodSearchSections();
  const online = useOnlineStatus();
  const [permission, requestPermission] = useCameraPermission();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' });
  const [torch, setTorch] = useState(false);
  const [manual, setManual] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | undefined>();
  const lookup = useRef<AbortController | null>(null);
  const asked = useRef(false);

  useEffect(() => {
    let active = true;
    void isCameraAvailable().then((value) => active && setAvailable(value));
    return () => {
      active = false;
      lookup.current?.abort(); // UX-24: leaving mid-lookup cancels it
    };
  }, []);
  // UX-24: the system prompt shows on open, once.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      void requestPermission();
    }
  }, [permission, requestPermission]);

  const run = async (gtin: Gtin14) => {
    if (!sections.data) return;
    lookup.current?.abort();
    const controller = new AbortController();
    lookup.current = controller;
    setPhase({ kind: 'lookingUp', gtin });
    try {
      const result = await lookupBarcode(services, gtin, {
        sections: sections.data,
        online,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (result.kind === 'found') {
        void client.invalidateQueries({ queryKey: foodSearchKeys.all });
        onFound(result.food);
      } else setPhase({ kind: 'notFound', gtin, result });
    } catch {
      if (controller.signal.aborted) return;
      setPhase({
        kind: 'notFound',
        gtin,
        result: { kind: 'notFound', checked: [], failed: [], offline: !online, hidden: [] },
      });
    }
  };
  const scanned = (gtin: Gtin14) => {
    if (process.env.NODE_ENV !== 'test') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // DS-10
    void run(gtin);
  };
  const submitManual = () => {
    const gtin = toGtin14(code.replace(/\s+/g, ''));
    if (!gtin) {
      setCodeError(t('barcode.invalidCode'));
      return;
    }
    setCodeError(undefined);
    void run(gtin);
  };
  const scanAgain = () => {
    setPhase({ kind: 'scanning' });
    setCode('');
    setCodeError(undefined);
  };

  const cameraReady = available === true && permission?.granted === true;
  // Undetermined = the system prompt is still pending; anything else not granted is a refusal.
  const cameraBlocked = permission !== null && !permission.granted && permission.status !== 'undetermined';
  const providerName = (provider: BarcodeProvider) =>
    t(provider === 'usda' ? 'foodSearch.usda' : 'foodSearch.openFoodFacts');

  let panel: React.ReactNode;
  if (phase.kind === 'lookingUp') {
    panel = (
      <InlineStatus
        tone="loading"
        message={t('barcode.lookingUp', { code: displayBarcode(phase.gtin) })}
        testID="barcode-looking-up"
      />
    );
  } else if (phase.kind === 'notFound') {
    const { result, gtin } = phase;
    const sources = [t('barcode.savedFoods'), ...result.checked.map(providerName)].join(', ');
    const hiddenNote = result.offline
      ? t('barcode.offline')
      : result.hidden.length === 2
        ? t('barcode.hiddenBoth')
        : result.hidden.length === 1
          ? t('barcode.hiddenOne', { provider: providerName(result.hidden[0]!) })
          : null;
    panel = (
      <View style={{ gap: theme.spacing[3] }} testID="barcode-not-found">
        <AppText variant="bodyStrong">{t('barcode.notFound', { code: displayBarcode(gtin) })}</AppText>
        <AppText color="textSecondary">{t('barcode.checked', { sources })}</AppText>
        {hiddenNote ? <InlineStatus tone={result.offline ? 'offline' : 'info'} message={hiddenNote} /> : null}
        {result.failed.map((provider) => (
          <InlineStatus
            key={provider}
            tone="error"
            message={t('barcode.failed', { provider: providerName(provider) })}
            action={{ label: t('barcode.retry'), onPress: () => void run(gtin) }}
            testID={`barcode-failed-${provider}`}
          />
        ))}
        <PrimaryButton
          label={t('barcode.createCustom')}
          onPress={() => onCreateCustom(gtin)}
          fullWidth
          testID="barcode-create-custom"
        />
        <TextAction label={t('barcode.scanAgain')} onPress={scanAgain} testID="barcode-scan-again" />
      </View>
    );
  } else {
    const blockedStatus = cameraBlocked ? (
      <InlineStatus
        tone="warning"
        message={t('barcode.permissionDenied')}
        action={
          permission?.canAskAgain
            ? { label: t('barcode.allowCamera'), onPress: () => void requestPermission() }
            : { label: t('barcode.openSettings'), onPress: () => void Linking.openSettings() }
        }
        testID="barcode-permission-denied"
      />
    ) : available === false ? (
      <InlineStatus tone="warning" message={t('barcode.cameraUnavailable')} testID="barcode-camera-unavailable" />
    ) : null;
    panel = (
      <View style={{ gap: theme.spacing[3] }}>
        {blockedStatus}
        {cameraReady && !manual ? <AppText color="textSecondary">{t('barcode.hint')}</AppText> : null}
        {manual || !cameraReady ? (
          <>
            <FormField
              label={t('barcode.manualLabel')}
              value={code}
              onChangeText={(value) => {
                setCode(value);
                if (codeError) setCodeError(undefined);
              }}
              error={codeError}
              keyboardType="number-pad"
              returnKeyType="search"
              onSubmitEditing={submitManual}
              maxLength={16}
              autoFocus={manual}
              testID="barcode-manual-input"
            />
            <PrimaryButton label={t('barcode.lookUp')} onPress={submitManual} testID="barcode-look-up" />
          </>
        ) : (
          <TextAction label={t('barcode.manualEntry')} onPress={() => setManual(true)} testID="barcode-manual-entry" />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      <AppBar
        title={t('barcode.title')}
        back={{ label: t('common.back'), onPress: onBack }}
        actions={
          cameraReady ? (
            <PressableIcon
              icon={torch ? 'flashlight' : 'flashlight-outline'}
              accessibilityLabel={t(torch ? 'barcode.torchOff' : 'barcode.torchOn')}
              onPress={() => setTorch((current) => !current)}
              color="onAppBar"
              testID="barcode-torch"
            />
          ) : null
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {cameraReady ? (
          <View style={styles.preview}>
            <BarcodeCamera
              scanning={phase.kind === 'scanning' && !manual}
              torch={torch}
              onCode={scanned}
              onUnavailable={() => setAvailable(false)}
            />
            {/* DS-09 Scanner: a white frame guide over a dimmed surround; no text over the camera image. */}
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[styles.flex, { backgroundColor: theme.colors.scrim }]} />
              <View style={styles.frameRow}>
                <View style={[styles.flex, { backgroundColor: theme.colors.scrim }]} />
                <View style={[styles.frame, { borderRadius: theme.radii.medium }]} />
                <View style={[styles.flex, { backgroundColor: theme.colors.scrim }]} />
              </View>
              <View style={[styles.flex, { backgroundColor: theme.colors.scrim }]} />
            </View>
          </View>
        ) : null}
        <ScrollView
          style={[cameraReady ? styles.panelBelowCamera : styles.flex, { backgroundColor: theme.colors.surface }]}
          contentContainerStyle={{ padding: theme.spacing[4] }}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
        >
          {panel}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  preview: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  frameRow: { flexDirection: 'row', height: 150 },
  frame: { width: '70%', borderWidth: 2, borderColor: '#FFFFFF' },
  panelBelowCamera: { flexGrow: 0, maxHeight: '50%' },
});

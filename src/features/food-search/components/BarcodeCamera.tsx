// ARCH-24: the only module that imports expo-camera. It reports a code only once it passes the DATA-24 check digit.
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';

import { toGtin14, type BarcodeType, type Gtin14 } from '@/domain/food/barcode';

const BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];

/** Platforms spell symbologies differently (`upc_e`, `org.gs1.UPC-E`); only UPC-E changes how 8 digits are read. */
function scannedType(raw: string): BarcodeType | undefined {
  const compact = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  return compact.endsWith('upce') ? 'upc_e' : undefined;
}

type Props = {
  /** While false the camera stays on but ignores codes (UX-24 looking up, manual entry, results). */
  scanning: boolean;
  torch: boolean;
  onCode: (gtin: Gtin14) => void;
  onUnavailable: () => void;
};

/** Camera permission state + request (the system prompt), for UX-24's permission states. */
export const useCameraPermission = useCameraPermissions;

/**
 * `false` → UX-24 camera unavailable. `isAvailableAsync` exists on web only and throws on iOS/Android (found on the
 * Zenfone, 2026-09-30), so native assumes a camera; a missing one reports through `onMountError` instead.
 */
export async function isCameraAvailable(): Promise<boolean> {
  try {
    return await CameraView.isAvailableAsync();
  } catch {
    return true;
  }
}

export function BarcodeCamera({ scanning, torch, onCode, onUnavailable }: Props) {
  // The camera reports the same code many times a second; accept one per scanning period.
  const accepted = useRef(false);
  useEffect(() => {
    if (scanning) accepted.current = false;
  }, [scanning]);
  return (
    <CameraView
      style={StyleSheet.absoluteFill}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
      onBarcodeScanned={
        scanning
          ? ({ data, type }: { data: string; type: string }) => {
              if (accepted.current) return;
              const gtin = toGtin14(data, scannedType(type));
              if (!gtin) return; // UX-24: a misread fails the check digit; keep scanning
              accepted.current = true;
              onCode(gtin);
            }
          : undefined
      }
      onMountError={onUnavailable}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      testID="barcode-camera"
    />
  );
}

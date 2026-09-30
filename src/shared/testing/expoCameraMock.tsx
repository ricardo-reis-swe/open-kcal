// ARCH-24: expo-camera has no native module in Jest. Tests drive the preview through `onBarcodeScanned` with
// `fireEvent(getByTestId('barcode-camera'), 'barcodeScanned', { type, data })`, and set permissions on `cameraMock`.
import { useState } from 'react';
import { View, type ViewProps } from 'react-native';

type Permission = { granted: boolean; canAskAgain: boolean; status: 'granted' | 'denied' | 'undetermined' };

export const GRANTED: Permission = { granted: true, canAskAgain: true, status: 'granted' };
export const UNDETERMINED: Permission = { granted: false, canAskAgain: true, status: 'undetermined' };
export const BLOCKED: Permission = { granted: false, canAskAgain: false, status: 'denied' };

export const cameraMock = {
  permission: GRANTED as Permission | null,
  afterRequest: GRANTED as Permission,
  requests: 0,
  reset() {
    this.permission = GRANTED;
    this.afterRequest = GRANTED;
    this.requests = 0;
  },
};

export function CameraView(props: ViewProps & Record<string, unknown>) {
  return <View {...props} />;
}
// Like native expo-camera, where only web implements `isAvailableAsync`: tests without a camera fire `mountError`.
CameraView.isAvailableAsync = async (): Promise<boolean> => {
  throw new Error('The method or property expo-camera.isAvailableAsync is not available on android');
};

export function useCameraPermissions() {
  const [permission, setPermission] = useState(cameraMock.permission);
  const request = async () => {
    cameraMock.requests += 1;
    setPermission(cameraMock.afterRequest);
    return cameraMock.afterRequest;
  };
  return [permission, request, request] as const;
}

import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { useReducedMotion } from '../useReducedMotion';

describe('DS-10: useReducedMotion', () => {
  it('reads the OS setting and follows changes', async () => {
    let listener: ((value: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((
      _event: string,
      handler: (v: boolean) => void,
    ) => {
      listener = handler;
      return { remove: jest.fn() };
    }) as unknown as typeof AccessibilityInfo.addEventListener);

    const { result } = await renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    await act(async () => listener?.(false));
    expect(result.current).toBe(false);
  });
});

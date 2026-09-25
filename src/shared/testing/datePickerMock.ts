// Jest stand-in for @react-native-community/datetimepicker (native UI). Use with:
// jest.mock('@react-native-community/datetimepicker', () => jest.requireActual('@/shared/testing/datePickerMock'));
import { createElement } from 'react';
import { View, type ViewProps } from 'react-native';

export const DateTimePickerAndroid = { open: jest.fn(), dismiss: jest.fn() };

/** Renders a View carrying the picker props, so tests can fire `onChange` on it. */
export default function DateTimePicker(props: ViewProps & Record<string, unknown>) {
  return createElement(View, props);
}

import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { logger } from '@/shared/logging/logger';

import { refreshWidget, WIDGET_NAME } from '../refreshWidget';

const request = jest.mocked(requestWidgetUpdate);
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('DATA-22: refreshWidget', () => {
  beforeEach(() => request.mockClear());

  it('asks Android to redraw the CaloriesLeft widget', () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    refreshWidget();
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ widgetName: WIDGET_NAME }));
    expect(WIDGET_NAME).toBe('CaloriesLeft'); // app.json plugin config
  });

  it('does nothing on iOS', () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    refreshWidget();
    expect(request).not.toHaveBeenCalled();
  });

  it('logs a failed request instead of throwing', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
    request.mockRejectedValueOnce(new Error('no widget module'));
    refreshWidget();
    await flush();
    expect(warn).toHaveBeenCalledWith('widget refresh failed', { code: 'unexpected' });
    warn.mockRestore();
  });
});

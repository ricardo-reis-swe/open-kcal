// T2 SPIKE (ARCH-23): proves the headless task can open the app's SQLite DB. Replaced by the real handler in T3.
import { openDatabaseAsync } from 'expo-sqlite';
import { FlexWidget, TextWidget, type WidgetTaskHandlerProps } from 'react-native-android-widget';

import { DATABASE_NAME } from '@/data/db/database';

async function readSpikeText(): Promise<string> {
  try {
    const db = await openDatabaseAsync(DATABASE_NAME);
    const version = await db.getFirstAsync<{ v: number }>('SELECT MAX(version) AS v FROM schema_version');
    const entries = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM diary_entries');
    return `v${version?.v ?? '?'} · ${entries?.n ?? '?'} entries · ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function widgetTaskHandler({ widgetAction, renderWidget }: WidgetTaskHandlerProps): Promise<void> {
  if (widgetAction === 'WIDGET_DELETED') return;
  const text = await readSpikeText();
  renderWidget(
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        justifyContent: 'center',
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'calorietracker://diary/today' }}
    >
      <TextWidget text={text} style={{ fontSize: 14, color: '#151A17' }} />
    </FlexWidget>,
  );
}

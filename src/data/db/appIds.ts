// The app's record-ID source (DATA-03): cryptographically random v4 UUIDs from expo-crypto (M1-Q1).
import { randomUUID } from 'expo-crypto';

import type { IdGenerator } from './ids';

export const appIds: IdGenerator = { newId: () => randomUUID() };

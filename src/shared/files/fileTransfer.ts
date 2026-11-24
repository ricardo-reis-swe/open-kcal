// ARCH-25: the only importer of `expo-sharing` / `expo-document-picker`. Both are system UI (share sheet, document
// picker), so no permissions or config plugins. Never log the uri or name (ARCH-15).
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { DatabaseError } from '@/shared/errors';

/** DATA-30: hands a file to the OS share sheet. Dismissing or cancelling resolves too; that isn't an error. */
export async function shareFile(
  uri: string,
  { dialogTitle }: { dialogTitle: string },
): Promise<'shared' | 'unavailable'> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(uri, { mimeType: 'application/vnd.sqlite3', UTI: 'public.database', dialogTitle });
  return 'shared';
}

export type PickedFile = { canceled: true } | { canceled: false; uri: string; size: number | null };

// DATA-31: pick any file, copied into the app cache. Any MIME type, because providers report `.db` as octet-stream.
export async function pickFile(): Promise<PickedFile> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  } catch (cause) {
    // The copy into the cache failed or the URI was unreadable: the screen shows `errorReadFailed`. No uri or name.
    throw new DatabaseError('File operation failed', { cause });
  }
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { canceled: true };
  return { canceled: false, uri: asset.uri, size: asset.size ?? null };
}

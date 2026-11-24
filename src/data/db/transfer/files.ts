// ARCH-25: the only importer of `expo-file-system`. Plain absolute paths in and out, because `expo-sqlite` and
// `VACUUM INTO` take paths, not URIs. Every failure becomes `DatabaseError` (ARCH-13); the message never holds a
// path (ARCH-15), the native error stays on `cause`.
import { Directory, File, Paths } from 'expo-file-system';

import { DatabaseError } from '@/shared/errors';

export function toPath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ''));
}

export function toUri(path: string): string {
  return 'file://' + encodeURI(path);
}

export function cacheDirectory(): string {
  return toPath(Paths.cache.uri).replace(/\/+$/, '');
}

async function wrap<T>(task: () => T | Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (cause) {
    throw new DatabaseError('File operation failed', { cause });
  }
}

const file = (path: string) => new File(toUri(path));
const directory = (path: string) => new Directory(toUri(path));

export const exists = (path: string): Promise<boolean> => wrap(() => file(path).exists);

export const size = (path: string): Promise<number> => wrap(() => file(path).size);

/** The first `n` bytes of a file (fewer if it is shorter). */
export const readHead = (path: string, n: number): Promise<Uint8Array> =>
  wrap(() => {
    const handle = file(path).open();
    try {
      return handle.readBytes(n);
    } finally {
      handle.close();
    }
  });

export const copy = (from: string, to: string): Promise<void> =>
  wrap(() => file(from).copy(file(to), { overwrite: true }));

export const move = (from: string, to: string): Promise<void> =>
  wrap(() => file(from).move(file(to), { overwrite: true }));

/** No-op when the file is missing. */
export const remove = (path: string): Promise<void> =>
  wrap(() => {
    const target = file(path);
    if (target.exists) target.delete();
  });

export const ensureDir = (path: string): Promise<void> =>
  wrap(() => directory(path).create({ intermediates: true, idempotent: true }));

/** No-op when the directory is missing. */
export const removeDir = (path: string): Promise<void> =>
  wrap(() => {
    const target = directory(path);
    if (target.exists) target.delete();
  });

export const writeText = (path: string, text: string): Promise<void> => wrap(() => file(path).write(text));

// The app's record-ID source (DATA-03). Uses `crypto.getRandomValues` when the runtime has it; Hermes on SDK 57
// doesn't, so it falls back to Math.random bytes. Interim until M1-Q1 (expo-crypto) is decided: the swap is local
// to this file and doesn't touch stored data (IDs are opaque UUID strings either way).
import { uuidV4FromBytes, type IdGenerator } from './ids';

function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  const cryptoApi = (globalThis as { crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array } }).crypto;
  if (cryptoApi?.getRandomValues) return cryptoApi.getRandomValues(bytes);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

export const appIds: IdGenerator = { newId: () => uuidV4FromBytes(randomBytes()) };

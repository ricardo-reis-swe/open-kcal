// Record IDs are app-generated UUID strings (DATA-03). Generation sits behind an interface so tests are
// deterministic and the platform source can change without touching repositories.

export interface IdGenerator {
  newId(): string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Formats 16 random bytes as an RFC 9562 version-4 UUID. */
export function uuidV4FromBytes(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new RangeError('Expected 16 bytes');
  const b = Uint8Array.from(bytes);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministic IDs for tests: `00000000-0000-4000-8000-000000000001`, … */
export function sequentialIds(start = 1): IdGenerator {
  let next = start;
  return {
    newId: () => `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`,
  };
}

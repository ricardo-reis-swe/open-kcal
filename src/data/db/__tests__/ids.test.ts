import { isUuid, sequentialIds, uuidV4FromBytes } from '../ids';

describe('DATA-03: UUID ids', () => {
  it('formats random bytes as a version-4 UUID', () => {
    const id = uuidV4FromBytes(new Uint8Array(16).fill(0xff));
    expect(id).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    expect(isUuid(id)).toBe(true);
    expect(isUuid(uuidV4FromBytes(new Uint8Array(16)))).toBe(true);
    expect(() => uuidV4FromBytes(new Uint8Array(15))).toThrow(RangeError);
  });

  it('sequential test ids are valid and distinct', () => {
    const ids = sequentialIds();
    const a = ids.newId();
    const b = ids.newId();
    expect(a).toBe('00000000-0000-4000-8000-000000000001');
    expect(isUuid(a) && isUuid(b) && a !== b).toBe(true);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});

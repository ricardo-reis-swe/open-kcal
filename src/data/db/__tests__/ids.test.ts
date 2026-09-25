import { appIds } from '../appIds';
import { isUuid, sequentialIds } from '../ids';

describe('DATA-03: UUID ids', () => {
  it('the app generates distinct v4 UUIDs', () => {
    const a = appIds.newId();
    const b = appIds.newId();
    expect(isUuid(a)).toBe(true);
    expect(isUuid(b)).toBe(true);
    expect(a).not.toBe(b);
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

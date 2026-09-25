// Record IDs are app-generated UUID strings (DATA-03). Generation sits behind an interface so tests are
// deterministic and the platform source can change without touching repositories.

export interface IdGenerator {
  newId(): string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** Deterministic IDs for tests: `00000000-0000-4000-8000-000000000001`, … */
export function sequentialIds(start = 1): IdGenerator {
  let next = start;
  return {
    newId: () => `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`,
  };
}

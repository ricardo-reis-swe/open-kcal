// Jest stand-in for src/shared/files/fileTransfer.ts (ARCH-25): the share sheet and picker are system UI, so tests
// drive them through these controls.
type PickResult = { canceled: true } | { canceled: false; uri: string; size: number | null };

let pickResult: PickResult = { canceled: true };
let shareAvailable = true;

export const shareFile = jest.fn(
  async (_uri: string, _options: { dialogTitle: string }): Promise<'shared' | 'unavailable'> =>
    shareAvailable ? 'shared' : 'unavailable',
);

export const pickFile = jest.fn(async (): Promise<PickResult> => pickResult);

export function __setPickResult(result: { canceled: true } | { uri: string; size?: number | null }): void {
  pickResult = 'canceled' in result ? result : { canceled: false, uri: result.uri, size: result.size ?? null };
}

export function __setShareAvailable(available: boolean): void {
  shareAvailable = available;
}

export function __resetFileTransfer(): void {
  pickResult = { canceled: true };
  shareAvailable = true;
  shareFile.mockClear();
  pickFile.mockClear();
}

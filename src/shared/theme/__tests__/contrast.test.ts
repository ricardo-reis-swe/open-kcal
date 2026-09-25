import { darkColors, lightColors, type ThemeColors } from '../tokens';

// DS-11 contrast guard for the token pairs components rely on. Device testing is still required.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const textPairs: [keyof ThemeColors, keyof ThemeColors][] = [
  ['textPrimary', 'canvas'],
  ['textPrimary', 'surface'],
  ['textPrimary', 'surfaceSubtle'],
  ['textSecondary', 'surface'],
  ['textSecondary', 'canvas'],
  ['primary', 'surface'],
  ['danger', 'surface'],
  ['warning', 'surface'],
  ['danger', 'dangerTint'],
  ['danger', 'surfaceSubtle'],
  ['textSecondary', 'surfaceSubtle'],
  ['textPrimary', 'primaryTint'],
  ['textPrimary', 'dangerTint'],
];

// Pairs primitives render that currently fail in light mode (M0-Q1). Each is its own `.failing` case so a fix flips it red.
const lightTextFailures: [keyof ThemeColors, keyof ThemeColors][] = [
  ['primary', 'primaryTint'], // pressed TextAction / tab label, InlineStatus success
  ['primary', 'canvas'], // TextAction on the canvas
  ['warning', 'warningTint'], // InlineStatus warning
];

// Essential boundaries (DS-11 ≥3:1): FormField input border, BottomSheet handle.
const boundaryPairs: [keyof ThemeColors, keyof ThemeColors][] = [
  ['borderStrong', 'surfaceSubtle'],
  ['borderStrong', 'surface'],
];

describe('DS-11: token contrast', () => {
  it.each([
    ['light', lightColors],
    ['dark', darkColors],
  ] as const)('%s text pairs reach 4.5:1', (_name, colors) => {
    for (const [fg, bg] of textPairs) {
      expect({ pair: `${fg}/${bg}`, ok: contrast(colors[fg], colors[bg]) >= 4.5 }).toEqual({
        pair: `${fg}/${bg}`,
        ok: true,
      });
    }
  });

  it('dark primary/primaryTint, primary/canvas and warning/warningTint reach 4.5:1', () => {
    for (const [fg, bg] of lightTextFailures) {
      expect(contrast(darkColors[fg], darkColors[bg])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.failing.each(lightTextFailures)('light %s on %s reaches 4.5:1 (M0-Q1)', (fg, bg) => {
    expect(contrast(lightColors[fg], lightColors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.failing.each(
    (['light', 'dark'] as const).flatMap((mode) => boundaryPairs.map(([fg, bg]) => [mode, fg, bg] as const)),
  )('%s boundary %s on %s reaches 3:1 (M0-Q1)', (mode, fg, bg) => {
    const colors = mode === 'light' ? lightColors : darkColors;
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(3);
  });

  it('dark textTertiary on surface reaches 4.5:1', () => {
    expect(contrast(darkColors.textTertiary, darkColors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  // Open question M0-Q1 (docs/progress.md): light textTertiary is 3.87:1 on surface. `.failing` flips to red once fixed.
  it.failing('light textTertiary on surface reaches 4.5:1', () => {
    expect(contrast(lightColors.textTertiary, lightColors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it('dark onPrimary (canvas) on the dark primary reaches 4.5:1', () => {
    expect(contrast(darkColors.canvas, darkColors.primary)).toBeGreaterThanOrEqual(4.5);
  });

  it('white text on the light primary and app bar reaches 4.5:1', () => {
    expect(contrast('#FFFFFF', lightColors.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFFFFF', lightColors.appBar)).toBeGreaterThanOrEqual(4.5);
  });
});

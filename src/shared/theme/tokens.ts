// Design tokens (DS doc). Feature components consume semantic tokens via the theme, never raw palette values (DS-12).
// Units are pt/dp. All combinations must be contrast-tested on device before release (DS-11).

export const palette = {
  green50: '#EAF8EF', // selected tint, quiet success surface
  green100: '#D3F1DD', // soft progress / focus background
  green300: '#70D68D', // decorative progress, charts
  green500: '#3DBD63', // brand accent, non-text progress
  green600: '#238447', // brand green; the light `primary` token is a slightly darker #207941 for text contrast
  green700: '#1D713D', // light-mode app bar
  green800: '#185C34', // light pressed controls, high-contrast green text
} as const;

export const lightColors = {
  canvas: '#F6F8F6',
  surface: '#FFFFFF',
  surfaceSubtle: '#F0F3F1', // inputs, grouped headers, quiet status
  textPrimary: '#151A17',
  textSecondary: '#606A63',
  textTertiary: '#687169', // nonessential; 5.05 surface · 4.74 canvas · 4.52 surfaceSubtle (M0-Q1)
  divider: '#E0E5E1',
  borderStrong: '#878E89', // inputs, sheet handle; ≥3:1 on surface + surfaceSubtle (M0-Q1)
  primary: '#207941', // ≥4.5:1 as text on canvas, subtle and tinted surfaces (M0-Q1)
  primaryPressed: palette.green800,
  primaryTint: '#EAF8EF',
  warning: '#A06000',
  warningTint: '#FFF2D9',
  danger: '#B83245',
  dangerTint: '#FCE8EB',
  focus: '#1769D2',
  scrim: 'rgba(10, 18, 13, 0.46)',
  appBar: palette.green700,
  macroCarbs: '#2676C9',
  macroProtein: '#7450B8',
  macroFat: '#B86800',
} as const;

export type ColorToken = keyof typeof lightColors;
export type ThemeColors = Record<ColorToken, string>; // type both themes against this, not typeof lightColors

export const darkColors: ThemeColors = {
  canvas: '#101411',
  surface: '#171C18',
  surfaceSubtle: '#202722',
  textPrimary: '#F2F6F3',
  textSecondary: '#B8C2BA',
  textTertiary: '#99A39B',
  divider: '#303832',
  borderStrong: '#68726B',
  primary: '#62D683',
  primaryPressed: '#82E29B',
  primaryTint: '#183D25',
  warning: '#E6A348',
  warningTint: '#3E2B10',
  danger: '#F0818F',
  dangerTint: '#461C24',
  focus: '#72AAFF',
  scrim: 'rgba(0, 0, 0, 0.68)',
  appBar: '#171C18', // dark surface + green accent unless testing shows a green bar is comfortable
  macroCarbs: '#6AACEE',
  macroProtein: '#AD91E2',
  macroFat: '#E6A348',
};

// System font (SF / Roboto). Progress, kcal, macro, weight and ruler values use tabular figures (fontVariant: ['tabular-nums']).
export const typography = {
  displayNumber: { fontSize: 32, lineHeight: 36, fontWeight: '400' }, // kcal remaining, current weight
  screenTitle: { fontSize: 21, lineHeight: 26, fontWeight: '600' }, // screen title
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600' }, // major section headings
  body: { fontSize: 16, lineHeight: 21, fontWeight: '400' }, // primary rows, form values
  bodyStrong: { fontSize: 16, lineHeight: 21, fontWeight: '600' }, // meal names, emphasized values
  compact: { fontSize: 14, lineHeight: 18, fontWeight: '400' }, // servings, secondary values
  compactStrong: { fontSize: 14, lineHeight: 18, fontWeight: '600' }, // macro values, compact actions
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' }, // field and section labels
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '500' }, // rare nonessential metadata only
} as const;

export const spacing = { 0: 0, 0.5: 2, 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 } as const;

export const radii = { small: 6, medium: 10, large: 16, pill: 999 } as const;

// Default visual heights excluding safe areas. Targets, not hard limits; become minimums under large text.
export const sizes = {
  appBar: 52,
  dateStrip: 42,
  dateStripItem: 104, // fixed width of one scrollable date-strip day (UX-02)
  diaryOverview: [210, 224], // ring + macros
  calorieRing: { diameter: [136, 148], stroke: [8, 10] },
  macroTrack: 4,
  mealHeader: 44,
  mealMarker: 28,
  foodRowSingle: 48,
  foodRowDouble: [52, 56],
  settingsRow: [48, 52],
  bottomNav: 56, // + safe area
  centerAction: 48, // rises ≤ 8 above bar
  centerActionRise: 8,
  sheetRow: 48,
  sheetHandle: { width: 36, height: 4 },
  button: [44, 48],
  input: 48,
  searchField: 48,
  searchResult: [56, 64],
  ruler: { summary: [56, 64], valueChip: { width: 64, height: 42 }, field: [108, 120], unitStrip: [42, 44], total: [196, 218] },
  icon: { inline: 20, standard: [22, 24], centerAction: 28, stroke: [1.75, 2] },
  touchMin: { ios: 44, android: 48 }, // minimum hit area where possible (not a visual size)
  focusRing: 2,
} as const;

export const motionMs = {
  press: [100, 150],
  rowInsertRemove: [180, 220],
  sheet: [220, 300],
  progress: [250, 400],
} as const;

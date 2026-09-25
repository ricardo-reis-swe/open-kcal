// Node has a native Intl.PluralRules, so a plain import would test Node's ICU. Remove it first to mirror Hermes,
// then load the app's real polyfill module and its locale data (review R1-8).
const nativePluralRules = Intl.PluralRules;

type PolyfilledPluralRules = typeof Intl.PluralRules & { polyfilled?: boolean };

describe('ARCH-22: plural rules polyfill (Hermes has no Intl.PluralRules)', () => {
  let PluralRules: PolyfilledPluralRules;

  beforeAll(() => {
    delete (Intl as { PluralRules?: unknown }).PluralRules;
    jest.isolateModules(() => {
      // Must load after the delete above; Jest's dynamic import needs --experimental-vm-modules.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('@/bootstrap/polyfills');
    });
    PluralRules = Intl.PluralRules as PolyfilledPluralRules;
  });

  afterAll(() => {
    Object.defineProperty(Intl, 'PluralRules', { value: nativePluralRules, configurable: true, writable: true });
  });

  it('installs the formatjs polyfill when the engine lacks it', () => {
    expect(PluralRules).not.toBe(nativePluralRules);
    expect(PluralRules.polyfilled).toBe(true);
  });

  it('uses European Portuguese rules (0 is "other" in pt-PT, "one" in pt)', () => {
    expect(new PluralRules('pt-PT').select(0)).toBe('other');
    expect(new PluralRules('pt-PT').select(1)).toBe('one');
    expect(new PluralRules('pt').select(0)).toBe('one');
    expect(new PluralRules('en').select(1)).toBe('one');
    expect(new PluralRules('en').select(2)).toBe('other');
  });
});

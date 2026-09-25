import '@/bootstrap/polyfills';

describe('ARCH-22: plural rules', () => {
  it('uses European Portuguese rules (0 is "other" in pt-PT, "one" in pt)', () => {
    expect(new Intl.PluralRules('pt-PT').select(0)).toBe('other');
    expect(new Intl.PluralRules('pt-PT').select(1)).toBe('one');
    expect(new Intl.PluralRules('en').select(1)).toBe('one');
    expect(new Intl.PluralRules('en').select(2)).toBe('other');
  });
});

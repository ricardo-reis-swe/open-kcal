import { matchesFoodQuery } from '../foodQuery';

describe('UX-04 / PROV-08: matchesFoodQuery', () => {
  const bar = { name: 'Barra de cereais', brand: 'Marca' };

  it('needs every token in the name or brand, case-insensitively', () => {
    expect(matchesFoodQuery(bar, ' barra  MARCA ')).toBe(true);
    expect(matchesFoodQuery(bar, 'cereais chocolate')).toBe(false);
    expect(matchesFoodQuery({ name: 'Egg', brand: null }, 'egg')).toBe(true);
  });

  it('an empty query matches everything', () => {
    expect(matchesFoodQuery(bar, '  ')).toBe(true);
  });
});

import en from '../locales/en.json';
import ptPT from '../locales/pt-PT.json';

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

const enKeys = flatten(en);
const ptKeys = flatten(ptPT);

function placeholders(value: string): string[] {
  return [...value.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1] ?? '').sort();
}

describe('ARCH-22: locale files', () => {
  it('en and pt-PT have identical key sets', () => {
    expect(Object.keys(ptKeys).sort()).toEqual(Object.keys(enKeys).sort());
  });

  it('every string is non-empty', () => {
    for (const [key, value] of Object.entries({ ...enKeys, ...ptKeys })) {
      expect({ key, empty: value.trim() === '' }).toEqual({ key, empty: false });
    }
  });

  it('translations keep the same interpolation placeholders', () => {
    for (const [key, value] of Object.entries(enKeys)) {
      expect({ key, placeholders: placeholders(ptKeys[key] ?? '') }).toEqual({
        key,
        placeholders: placeholders(value),
      });
    }
  });
});

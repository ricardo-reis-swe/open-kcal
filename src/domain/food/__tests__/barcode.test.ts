import {
  barcodeFromProvider,
  displayBarcode,
  expandUpcE,
  hasValidCheckDigit,
  toGtin14,
  usdaBarcodeQuery,
} from '../barcode';

describe('DATA-24 barcodes', () => {
  it('checks GS1 check digits', () => {
    expect(hasValidCheckDigit('5601009983179')).toBe(true);
    expect(hasValidCheckDigit('5601009983178')).toBe(false);
    expect(hasValidCheckDigit('96385074')).toBe(true);
    expect(hasValidCheckDigit('031200037206')).toBe(true);
    expect(hasValidCheckDigit('12a4')).toBe(false);
  });

  it('expands UPC-E to UPC-A', () => {
    expect(expandUpcE('04252614')).toBe('042100005264');
    expect(expandUpcE('01234531')).toBe('012300000451'); // s6 = 3
    expect(expandUpcE('01234541')).toBe('012340000051'); // s6 = 4
    expect(expandUpcE('01234565')).toBe('012345000065'); // s6 = 5–9
    expect(expandUpcE('24252614')).toBeNull(); // number system must be 0 or 1
  });

  it('normalizes every supported length to one GTIN-14 key', () => {
    expect(toGtin14('5601009983179')).toBe('05601009983179');
    // A UPC-A and the same product's EAN-13 with a leading 0 are one key.
    expect(toGtin14('031200037206')).toBe('00031200037206');
    expect(toGtin14('0031200037206')).toBe('00031200037206');
    expect(toGtin14('00031200037206')).toBe('00031200037206');
    expect(toGtin14('96385074')).toBe('00000096385074');
    expect(toGtin14(' 5601009983179 ')).toBe('05601009983179');
  });

  it('expands 8-digit UPC-E when the scanner says so, or when it is not a valid EAN-8', () => {
    expect(toGtin14('04252614', 'upc_e')).toBe('00042100005264');
    expect(toGtin14('04252614')).toBe('00042100005264'); // 04252614 fails as EAN-8
  });

  it('rejects bad check digits, wrong lengths and non-digits', () => {
    expect(toGtin14('5601009983178')).toBeNull();
    expect(toGtin14('1234567')).toBeNull();
    expect(toGtin14('123456789012345')).toBeNull();
    expect(toGtin14('56010099831x9')).toBeNull();
    expect(toGtin14('')).toBeNull();
  });

  it('reads provider codes as GTINs only when valid', () => {
    expect(barcodeFromProvider('0894700010137')).toBe('00894700010137');
    expect(barcodeFromProvider('96385074')).toBe('00000096385074');
    expect(barcodeFromProvider('12345')).toBeNull();
    expect(barcodeFromProvider(null)).toBeNull();
  });

  it('formats the display / OFF code and the USDA query (PROV-15)', () => {
    expect(displayBarcode('05601009983179')).toBe('5601009983179');
    expect(displayBarcode('00000096385074')).toBe('96385074');
    expect(usdaBarcodeQuery('00031200037206')).toBe('031200037206');
    expect(usdaBarcodeQuery('05601009983179')).toBe('5601009983179');
  });
});

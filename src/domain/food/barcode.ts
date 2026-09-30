// DATA-24 barcode rules: check digits, UPC-E expansion and the GTIN-14 key that saved foods are matched on.

/** 14 digits, the code zero-padded on the left (DATA-24). */
export type Gtin14 = string;

/** The symbologies UX-24 reads (ARCH-24). */
export type BarcodeType = 'ean13' | 'ean8' | 'upc_a' | 'upc_e';

const digitsOnly = /^\d+$/;

/** GS1 mod-10: weights 3, 1, 3… from the digit left of the check digit. */
export function hasValidCheckDigit(code: string): boolean {
  if (!digitsOnly.test(code) || code.length < 8) return false;
  let sum = 0;
  for (let i = code.length - 2, weight = 3; i >= 0; i -= 1, weight = weight === 3 ? 1 : 3)
    sum += Number(code[i]) * weight;
  return (10 - (sum % 10)) % 10 === Number(code[code.length - 1]);
}

/** UPC-E (8 digits: number system 0/1, six digits, check) → UPC-A (12 digits), or `null` when it isn't one. */
export function expandUpcE(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [n, s1, s2, s3, s4, s5, s6, check] = code.split('');
  let body: string;
  if (s6 === '0' || s6 === '1' || s6 === '2') body = `${s1}${s2}${s6}0000${s3}${s4}${s5}`;
  else if (s6 === '3') body = `${s1}${s2}${s3}00000${s4}${s5}`;
  else if (s6 === '4') body = `${s1}${s2}${s3}${s4}00000${s5}`;
  else body = `${s1}${s2}${s3}${s4}${s5}0000${s6}`;
  return `${n}${body}${check}`;
}

/**
 * A scanned or typed code → its GTIN-14, or `null` when the check digit fails. Eight digits are EAN-8 unless the
 * scanner reported UPC-E (EAN-8 first for typed codes: the main market is Portugal, SCOPE-12).
 */
export function toGtin14(raw: string, type?: BarcodeType): Gtin14 | null {
  const code = raw.trim();
  if (!digitsOnly.test(code)) return null;
  let gtin: string | null = null;
  if (code.length === 8) {
    const upcA = type === 'upc_e' || !hasValidCheckDigit(code) ? expandUpcE(code) : null;
    gtin = upcA ?? code;
  } else if (code.length === 12 || code.length === 13 || code.length === 14) gtin = code;
  if (!gtin || !hasValidCheckDigit(gtin)) return null;
  return gtin.padStart(14, '0');
}

/** A stored or provider code (e.g. OFF `code`, USDA `gtinUpc`) → GTIN-14 when it's a valid GTIN, else `null`. */
export function barcodeFromProvider(code: string | null | undefined): Gtin14 | null {
  if (!code) return null;
  const trimmed = code.trim();
  return trimmed.length === 8 ? toGtin14(trimmed, 'ean8') : toGtin14(trimmed);
}

/** UX-24 display and the OFF product-read code (PROV-15): EAN-8 when padded from 8 digits, else GTIN-13. */
export function displayBarcode(gtin: Gtin14): string {
  return gtin.startsWith('000000') ? gtin.slice(6) : gtin.slice(1);
}

/** PROV-15 USDA query: the 12-digit UPC-A when the GTIN-14 starts with `00`, else the 13-digit form. */
export function usdaBarcodeQuery(gtin: Gtin14): string {
  return gtin.startsWith('00') ? gtin.slice(2) : gtin.slice(1);
}

/** ISRC: CC-XXX-YY-NNNNN. Se guarda sin guiones y en mayúsculas. */
export const normalizeIsrc = (s: string) => s.replace(/[\s-]/g, '').toUpperCase();
export const isValidIsrc = (s: string) => /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(normalizeIsrc(s));

const iswcDigits = (s: string) => s.replace(/[^0-9]/g, '');

/** ISWC con dígito verificador: T-123.456.789-C, C = (10 − (1 + Σ i·dᵢ) mod 10) mod 10. */
export function isValidIswc(s: string): boolean {
  if (!/^T-?\d{3}\.?\d{3}\.?\d{3}-?\d$/i.test(s.trim())) return false;
  const d = iswcDigits(s).split('').map(Number);
  const sum = 1 + d.slice(0, 9).reduce((acc, n, i) => acc + (i + 1) * n, 0);
  return (10 - (sum % 10)) % 10 === d[9];
}

export function normalizeIswc(s: string): string {
  const d = iswcDigits(s);
  return `T-${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Número IPI (Name Number): 9 a 11 dígitos; se completa a 11 con ceros a la izquierda. */
export const normalizeIpi = (s: string) => s.replace(/\D/g, '').padStart(11, '0');
export const isValidIpi = (s: string) => /^\d{9,11}$/.test(s.replace(/\D/g, ''));

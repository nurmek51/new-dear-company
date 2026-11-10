export const PHONE_ERROR = 'enter a phone number with country code (9–15 digits).';

/** Empty is allowed for optional fields; null means an invalid number. */
export function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, '');
  if (!value.trim()) return '';
  if (!/^\+?[1-9]\d{8,14}$/.test(compact)) return null;
  return compact.startsWith('+') ? compact : `+${compact}`;
}

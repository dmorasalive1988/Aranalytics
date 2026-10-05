/** Mayoría de edad por país de residencia (configurable; 18 por defecto). */
export const AGE_OF_MAJORITY: Record<string, number> = { DEFAULT: 18 };

export function ageOn(birthDate: string, today: Date): number {
  const [y, m, d] = birthDate.split('-').map(Number) as [number, number, number];
  let age = today.getUTCFullYear() - y;
  const beforeBirthday = today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function isMinor(birthDate: string, country: string, today: Date): boolean {
  const majority = AGE_OF_MAJORITY[country] ?? AGE_OF_MAJORITY.DEFAULT ?? 18;
  return ageOn(birthDate, today) < majority;
}

/** Sociedades de gestión del onboarding. */
export const PRO_SOCIETIES = [
  { code: 'SAYCO', country: 'CO' },
  { code: 'SACM', country: 'MX' },
  { code: 'APDAYC', country: 'PE' },
  { code: 'SAYCE', country: 'EC' },
  { code: 'ASCAP', country: 'US' },
  { code: 'BMI', country: 'US' },
  { code: 'UBC', country: 'BR' },
] as const;

/** Países del lanzamiento (orden de la lista en el onboarding). */
export const LAUNCH_COUNTRIES = ['CO', 'MX', 'US', 'BR', 'PE', 'EC', 'AR', 'CL', 'PR', 'DO', 'VE', 'GT', 'CR', 'PA', 'UY', 'PY', 'BO', 'SV', 'HN', 'NI', 'ES'] as const;

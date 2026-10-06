/** Nombre del idioma en el idioma de la interfaz, con mayúscula inicial ("Español", "Inglês"). */
export function languageNames(locale: string) {
  const d = new Intl.DisplayNames([locale], { type: 'language' });
  return { of: (code: string) => { const n = d.of(code) ?? code; return n.charAt(0).toLocaleUpperCase(locale) + n.slice(1); } };
}

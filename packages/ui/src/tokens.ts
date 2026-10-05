/**
 * Tokens de color de Pluma (docs/05-sistema-de-diseno.md). Fuente de verdad para la prueba de
 * contraste; styles.css debe declarar exactamente estos valores (la prueba lo verifica).
 */
export const brand = {
  tinta: '#0E1020',
  noche: '#1B1E33',
  papel: '#F4EFE6',
  ambar: '#F2A541',
  coral: '#FF6B57',
  verde: '#7BD389',
  niebla: '#A8A6B8',
} as const;

export const derived = {
  nav: '#14172A',
  linea: '#23263D',
  elevado: '#2A2D45',
  borde: '#3A3D57',
  bordeCampo: '#6B6E8C',
  papel2: '#C9C6D6',
  ambarHover: '#FFD08A',
  alertaFondo: '#2A1A22',
  okFondo: '#17301F',
} as const;

export const light = {
  fondo: '#F4EFE6',
  tarjeta: '#FFFFFF',
  texto: '#0E1020',
  texto2: '#55536A',
  borde: '#D9D3C7',
  bordeTabla: '#E6E0D4',
  bordeFila: '#F0EBE1',
  ambarTexto: '#9A5B00',
  coralTexto: '#C23A28',
} as const;

/** Pares texto/fondo que el producto usa. Todos deben cumplir 4,5:1 (o 3:1 los contornos de UI). */
export const CONTRAST_PAIRS: { name: string; fg: string; bg: string; min: number }[] = [
  { name: 'texto sobre fondo', fg: brand.papel, bg: brand.tinta, min: 4.5 },
  { name: 'texto sobre tarjeta', fg: brand.papel, bg: brand.noche, min: 4.5 },
  { name: 'secundario sobre fondo', fg: brand.niebla, bg: brand.tinta, min: 4.5 },
  { name: 'secundario sobre tarjeta', fg: brand.niebla, bg: brand.noche, min: 4.5 },
  { name: 'secundario sobre nav', fg: brand.niebla, bg: derived.nav, min: 4.5 },
  { name: 'terciario sobre tarjeta', fg: derived.papel2, bg: brand.noche, min: 4.5 },
  { name: 'botón primario', fg: brand.tinta, bg: brand.ambar, min: 4.5 },
  { name: 'ámbar sobre tarjeta', fg: brand.ambar, bg: brand.noche, min: 4.5 },
  { name: 'ámbar sobre fondo', fg: brand.ambar, bg: brand.tinta, min: 4.5 },
  { name: 'coral sobre alerta', fg: brand.coral, bg: derived.alertaFondo, min: 4.5 },
  { name: 'papel sobre alerta', fg: brand.papel, bg: derived.alertaFondo, min: 4.5 },
  { name: 'verde sobre confirmación', fg: brand.verde, bg: derived.okFondo, min: 4.5 },
  { name: 'verde sobre tarjeta', fg: brand.verde, bg: brand.noche, min: 4.5 },
  { name: 'coral sobre tarjeta', fg: brand.coral, bg: brand.noche, min: 4.5 },
  { name: 'píldora coral', fg: brand.tinta, bg: brand.coral, min: 4.5 },
  { name: 'píldora ámbar', fg: brand.tinta, bg: brand.ambar, min: 4.5 },
  { name: 'píldora niebla', fg: brand.tinta, bg: brand.niebla, min: 4.5 },
  { name: 'píldora verde', fg: brand.tinta, bg: brand.verde, min: 4.5 },
  { name: 'contorno de campo', fg: derived.bordeCampo, bg: brand.noche, min: 3 },
  { name: 'claro: texto', fg: light.texto, bg: light.fondo, min: 4.5 },
  { name: 'claro: secundario sobre papel', fg: light.texto2, bg: light.fondo, min: 4.5 },
  { name: 'claro: secundario sobre tarjeta', fg: light.texto2, bg: light.tarjeta, min: 4.5 },
  { name: 'claro: ámbar texto', fg: light.ambarTexto, bg: light.tarjeta, min: 4.5 },
  { name: 'claro: ámbar texto sobre papel', fg: light.ambarTexto, bg: light.fondo, min: 4.5 },
  { name: 'claro: coral texto', fg: light.coralTexto, bg: light.tarjeta, min: 4.5 },
  { name: 'claro: barra lateral', fg: brand.papel, bg: brand.tinta, min: 4.5 },
  { name: 'claro: activo barra lateral', fg: brand.ambar, bg: brand.noche, min: 4.5 },
];

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

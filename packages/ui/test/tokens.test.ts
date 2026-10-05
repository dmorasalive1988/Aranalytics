import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { brand, CONTRAST_PAIRS, contrastRatio, derived } from '../src/tokens';

describe('sistema de diseño', () => {
  it.each(CONTRAST_PAIRS)('contraste: $name', ({ fg, bg, min }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it('styles.css declara exactamente los tokens de marca', () => {
    const css = readFileSync(join(__dirname, '../src/styles.css'), 'utf8');
    const expected: Record<string, string> = {
      '--pl-tinta': brand.tinta, '--pl-noche': brand.noche, '--pl-papel': brand.papel, '--pl-ambar': brand.ambar,
      '--pl-coral': brand.coral, '--pl-verde': brand.verde, '--pl-niebla': brand.niebla, '--pl-nav': derived.nav,
      '--pl-borde': derived.borde, '--pl-borde-campo': derived.bordeCampo,
    };
    for (const [name, value] of Object.entries(expected)) expect(css).toContain(`${name}: ${value};`);
  });

  it('el tema claro usa colores accesibles para texto de estado', () => {
    expect(contrastRatio('#1F6B33', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#8A8478', '#FFFFFF')).toBeGreaterThanOrEqual(3);
  });
});

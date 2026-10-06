import { describe, expect, it } from 'vitest';
import { renderStatementPdf, type StatementView } from '../src';

const view: StatementView = {
  statementId: '0c8a3e2e-1111-4222-8333-944455556666', periodCode: '2026-Q2', payDate: '2026-08-15', publishedAt: null, locale: 'es', intlLocale: 'es-CO', currency: 'USD',
  writer: { legalName: 'Valentina Ríos Mejía', artistName: 'Vale Ríos', country: 'CO', society: 'SAYCO', ipi: '00712345678' },
  plan: { code: 'pro', commissionBps: 1500 },
  totals: { openingCents: 12345, grossCents: 50000, commissionCents: 7500, withholdingCents: 0, heldCents: 0, netCents: 42500, adjustmentsCents: -600, closingCents: 54845 },
  byWork: [{ title: 'Luna de Medellín', shareBps: 4000, grossCents: 30000, netCents: 25500, held: false }],
  byIncomeType: [{ key: 'performance', netCents: 42500 }], bySource: [{ key: 'SAYCO', netCents: 42500 }], byTerritory: [{ key: 'CO', netCents: 42500 }],
};

describe('PDF del statement', () => {
  it('se genera con la marca Pluma en los tres idiomas', async () => {
    for (const locale of ['es', 'en', 'pt-BR'] as const) {
      const pdf = await renderStatementPdf({ ...view, locale, intlLocale: locale === 'en' ? 'en-US' : locale === 'pt-BR' ? 'pt-BR' : 'es-CO' });
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.length).toBeGreaterThan(5000);
    }
  }, 30_000);
});

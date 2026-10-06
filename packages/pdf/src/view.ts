/**
 * Modelo único del statement de un autor. Lo construye @pluma/services y lo usan tanto el PDF como
 * el dashboard: por construcción, el PDF coincide con lo que ve el autor.
 */
export interface StatementView {
  statementId: string;
  periodCode: string;
  payDate: string;
  publishedAt: string | null;
  locale: 'es' | 'en' | 'pt-BR';
  intlLocale: string;
  currency: string;
  writer: { legalName: string; artistName: string | null; country: string; society: string | null; ipi: string | null };
  plan: { code: 'socio' | 'pro'; commissionBps: number };
  totals: {
    openingCents: number;
    grossCents: number;
    commissionCents: number;
    withholdingCents: number;
    heldCents: number;
    netCents: number;
    adjustmentsCents: number;
    closingCents: number;
  };
  byWork: { title: string; shareBps: number; grossCents: number; netCents: number; held: boolean }[];
  byIncomeType: { key: string; netCents: number }[];
  bySource: { key: string; netCents: number }[];
  byTerritory: { key: string; netCents: number }[];
  documentSha256?: string;
}

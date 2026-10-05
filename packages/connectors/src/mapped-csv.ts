import { isValidIswc, normalizeIsrc, normalizeIswc, normalizeIpi } from '@pluma/domain';
import { parseCsv } from './csv';
import type { IncomeType, NormalizedLine, ParseError, ParsedStatement, StatementConnector } from './types';

export interface CsvMapping {
  provider: string;
  mappingVersion: string;
  requiredHeaders: string[];
  recordType: { column: string; detail: string; trailer: string };
  columns: Record<'providerWorkCode' | 'workTitle' | 'iswc' | 'writerIpi' | 'isrc' | 'source' | 'incomeType' | 'territory' | 'exploitationStart' | 'exploitationEnd' | 'payPeriod' | 'currency' | 'gross' | 'providerFee' | 'net' | 'adjustsPeriod', string>;
  incomeTypes: Record<string, IncomeType>;
}

const AMOUNT = /^-?\d{1,12}(\.\d{1,8})?$/;
const isDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** Conector genérico guiado por un mapeo declarativo de columnas (JSON versionado). */
export class MappedCsvConnector implements StatementConnector {
  readonly provider: string;
  readonly mappingVersion: string;
  constructor(private readonly m: CsvMapping) {
    this.provider = m.provider;
    this.mappingVersion = m.mappingVersion;
  }

  detect(content: string): boolean {
    const header = parseCsv(content.split(/\r?\n/, 1)[0] ?? '')[0] ?? [];
    return this.m.requiredHeaders.every((h) => header.includes(h));
  }

  parse(content: Buffer): ParsedStatement {
    const rows = parseCsv(content.toString('utf8'));
    const header = rows[0] ?? [];
    const errors: ParseError[] = [];
    const missing = this.m.requiredHeaders.filter((h) => !header.includes(h));
    if (missing.length) return { provider: this.provider, mappingVersion: this.mappingVersion, lines: [], errors: [{ lineNo: 1, message: `Faltan columnas: ${missing.join(', ')}` }], controlTotals: {} };

    const idx = (col: string) => header.indexOf(col);
    const lines: NormalizedLine[] = [];
    const controlTotals: Record<string, string> = {};
    const C = this.m.columns;

    rows.slice(1).forEach((r, i) => {
      const lineNo = i + 2;
      const raw = Object.fromEntries(header.map((h, j) => [h, (r[j] ?? '').trim()]));
      const get = (col: string) => (idx(col) >= 0 ? (raw[col] ?? '') : '');
      const type = get(this.m.recordType.column);
      if (type === this.m.recordType.trailer) {
        const ccy = get(C.currency).toUpperCase();
        const net = get(C.net);
        if (!/^[A-Z]{3}$/.test(ccy) || !AMOUNT.test(net)) errors.push({ lineNo, message: 'Fila de totales inválida' });
        else controlTotals[ccy] = net;
        return;
      }
      if (type !== this.m.recordType.detail) {
        errors.push({ lineNo, message: `Tipo de registro desconocido: "${type}"` });
        return;
      }
      const net = get(C.net);
      const gross = get(C.gross) || net;
      const fee = get(C.providerFee) || '0';
      const ccy = get(C.currency).toUpperCase();
      const problems: string[] = [];
      if (!AMOUNT.test(net)) problems.push('NET no es un monto');
      if (!AMOUNT.test(gross)) problems.push('GROSS no es un monto');
      if (!AMOUNT.test(fee)) problems.push('FEE no es un monto');
      if (!/^[A-Z]{3}$/.test(ccy)) problems.push('moneda inválida');
      if (!get(C.workTitle) && !get(C.providerWorkCode)) problems.push('sin título ni código de obra');
      for (const d of [get(C.exploitationStart), get(C.exploitationEnd)]) if (d && !isDate(d)) problems.push(`fecha inválida: ${d}`);
      if (problems.length) {
        errors.push({ lineNo, message: problems.join('; ') });
        return;
      }
      const iswc = get(C.iswc);
      const adj = get(C.adjustsPeriod);
      lines.push({
        lineNo,
        raw,
        providerWorkCode: get(C.providerWorkCode) || null,
        workTitle: get(C.workTitle) || null,
        iswc: iswc && isValidIswc(iswc) ? normalizeIswc(iswc) : null,
        writerIpi: get(C.writerIpi) ? normalizeIpi(get(C.writerIpi)) : null,
        isrc: get(C.isrc) ? normalizeIsrc(get(C.isrc)) : null,
        source: get(C.source) || 'UNKNOWN',
        incomeType: this.m.incomeTypes[get(C.incomeType).toUpperCase()] ?? 'other',
        territory: get(C.territory).toUpperCase().slice(0, 2) || null,
        exploitationStart: get(C.exploitationStart) || null,
        exploitationEnd: get(C.exploitationEnd) || null,
        payPeriod: get(C.payPeriod),
        currency: ccy,
        gross,
        providerFee: fee,
        net,
        isAdjustment: !!adj || net.startsWith('-'),
        adjustsPeriod: adj || null,
      });
    });
    return { provider: this.provider, mappingVersion: this.mappingVersion, lines, errors, controlTotals };
  }
}

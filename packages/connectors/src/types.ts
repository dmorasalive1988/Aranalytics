export type IncomeType = 'performance' | 'mechanical' | 'youtube_ugc' | 'sync' | 'other';

/** Línea en el modelo único de Pluma, independiente del proveedor. */
export interface NormalizedLine {
  lineNo: number;
  raw: Record<string, string>;
  providerWorkCode: string | null;
  workTitle: string | null;
  iswc: string | null;
  writerIpi: string | null;
  isrc: string | null;
  source: string;
  incomeType: IncomeType;
  territory: string | null;
  exploitationStart: string | null;
  exploitationEnd: string | null;
  payPeriod: string;
  currency: string;
  gross: string;
  providerFee: string;
  net: string;
  isAdjustment: boolean;
  adjustsPeriod: string | null;
}

export interface ParseError {
  lineNo: number;
  message: string;
}

export interface ParsedStatement {
  provider: string;
  mappingVersion: string;
  lines: NormalizedLine[];
  errors: ParseError[];
  /** Total declarado por el proveedor, por moneda. */
  controlTotals: Record<string, string>;
}

/**
 * Contrato de un conector de statements. El primero es el del administrador asociado; un registro
 * directo en sociedades u otro administrador será otra implementación, sin tocar el resto del pipeline.
 */
export interface StatementConnector {
  provider: string;
  mappingVersion: string;
  /** ¿Este archivo es de este proveedor? */
  detect(content: string): boolean;
  parse(content: Buffer): ParsedStatement;
}

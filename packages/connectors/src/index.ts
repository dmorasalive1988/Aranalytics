import primaryMapping from '../mappings/primary-administrator.v1.json';
import { MappedCsvConnector, type CsvMapping } from './mapped-csv';
import type { StatementConnector } from './types';

export * from './types';
export { parseCsv } from './csv';
export { MappedCsvConnector, type CsvMapping } from './mapped-csv';

/** Conectores registrados. Agregar un proveedor = agregar su implementación aquí. */
export const CONNECTORS: StatementConnector[] = [new MappedCsvConnector(primaryMapping as CsvMapping)];

export function connectorFor(provider: string): StatementConnector {
  const c = CONNECTORS.find((x) => x.provider === provider);
  if (!c) throw new Error(`No hay conector para ${provider}`);
  return c;
}

export function detectConnector(content: string): StatementConnector | null {
  return CONNECTORS.find((c) => c.detect(content)) ?? null;
}

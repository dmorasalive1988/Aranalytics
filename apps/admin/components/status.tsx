import { WORK_STATUS_TONE, type WorkStatus } from '@pluma/domain';
import { MESSAGES } from '@pluma/i18n';
import { StatusPill } from '@pluma/ui';

export const WorkStatusPill = ({ status }: { status: WorkStatus }) => <StatusPill tone={WORK_STATUS_TONE[status]}>{MESSAGES.es.works.status[status]}</StatusPill>;

export const fmtDate = (d: string | null | undefined) => (d ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(d)) : '—');
export const fmtMoney = (cents: number, ccy = 'USD') => `${ccy} ${new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2 }).format(cents / 100)}`;
export const fmtPct = (bps: number) => `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(bps / 100)} %`;

/** Estado de una corrida de distribución. */
export const RUN_LABEL: Record<string, [string, 'verde' | 'ambar' | 'coral' | 'niebla' | 'outline']> = {
  reconciled: ['Conciliada', 'ambar'], unbalanced: ['No cuadra', 'coral'], approved: ['Aprobada', 'ambar'], scheduled: ['Programada', 'ambar'], published: ['Publicada', 'verde'], calculating: ['Calculando', 'niebla'],
};

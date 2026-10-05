'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, X } from 'lucide-react';
import { BPS_TOTAL, WRITER_ROLES, bpsToInput, formatBps, parsePercentToBps, type WriterRole } from '@pluma/domain';
import { Card, Field, Input, Select, cn } from '@pluma/ui';
import { ActionForm, type ActionState } from './action-form';

export interface EditorRow {
  key: string;
  kind: 'member' | 'external';
  userId?: string;
  isMe?: boolean;
  name: string;
  email: string;
  role: WriterRole;
  pct: string;
}

const intl = (l: string) => (l === 'pt-BR' ? 'pt-BR' : l === 'en' ? 'en-US' : 'es-CO');

/**
 * A24 · Coautores con total en vivo. El botón solo se habilita con exactamente 100 %;
 * el servidor y la base de datos lo vuelven a verificar.
 */
export function SplitEditor({ initial, action }: { initial: EditorRow[]; action: (p: ActionState, fd: FormData) => Promise<ActionState> }) {
  const t = useTranslations('splits');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [rows, setRows] = useState(initial);
  const [counter, setCounter] = useState(initial.length);

  const parsed = rows.map((r) => parsePercentToBps(r.pct));
  const total = parsed.reduce<number>((a, b) => a + (b ?? 0), 0);
  const allValid = parsed.every((b) => b !== null && b > 0) && rows.every((r) => r.kind === 'member' || (r.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r.email.trim())));
  const ready = allValid && total === BPS_TOTAL;
  const payload = useMemo(
    () => JSON.stringify(rows.map((r, i) => ({ kind: r.kind, userId: r.userId, name: r.name, email: r.email, role: r.role, bps: parsed[i] ?? 0 }))),
    [rows, parsed],
  );
  const update = (key: string, patch: Partial<EditorRow>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remaining = BPS_TOTAL - total;

  return (
    <ActionForm action={action} submitLabel={t('save')} pendingLabel={tc('sending')} submitDisabled={!ready}>
      <input type="hidden" name="rows" value={payload} />
      <ul className="flex flex-col gap-3">
        {rows.map((r, i) => {
          const invalidPct = r.pct !== '' && (parsed[i] === null || parsed[i] === 0);
          return (
            <li key={r.key}>
              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{r.isMe ? t('you') : r.name || `#${i + 1}`}</span>
                  {!r.isMe && (
                    <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={t('remove', { name: r.name || `#${i + 1}` })} className="inline-flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-bg hover:text-fg">
                      <X size={20} strokeWidth={2} aria-hidden />
                    </button>
                  )}
                </div>
                {r.kind === 'external' && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field id={`name-${r.key}`} label={t('name')}>
                      <Input id={`name-${r.key}`} value={r.name} onChange={(e) => update(r.key, { name: e.target.value })} required />
                    </Field>
                    <Field id={`email-${r.key}`} label={t('email')} hint={i === rows.findIndex((x) => x.kind === 'external') ? t('emailHint') : undefined}>
                      <Input id={`email-${r.key}`} type="email" inputMode="email" value={r.email} onChange={(e) => update(r.key, { email: e.target.value })} required />
                    </Field>
                  </div>
                )}
                <div className="grid grid-cols-[1fr_120px] gap-4">
                  <Field id={`role-${r.key}`} label={t('role')}>
                    <Select id={`role-${r.key}`} value={r.role} onChange={(e) => update(r.key, { role: e.target.value as WriterRole })}>
                      {WRITER_ROLES.map((role) => <option key={role} value={role}>{t(`roles.${role}`)}</option>)}
                    </Select>
                  </Field>
                  <Field id={`pct-${r.key}`} label={t('percent')} error={invalidPct ? t('invalidPercent') : undefined}>
                    <div className="relative">
                      <Input id={`pct-${r.key}`} inputMode="decimal" value={r.pct} onChange={(e) => update(r.key, { pct: e.target.value })} invalid={invalidPct} className="tabular pr-9 text-right" />
                      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-fg-2" aria-hidden>%</span>
                    </div>
                  </Field>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => {
          setRows((rs) => [...rs, { key: `n${counter}`, kind: 'external', name: '', email: '', role: 'composer', pct: remaining > 0 ? bpsToInput(remaining, locale) : '' }]);
          setCounter((c) => c + 1);
        }}
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl border border-stroke px-4 text-sm font-bold text-fg hover:bg-surface"
      >
        <Plus size={18} strokeWidth={2} aria-hidden />
        {t('add')}
      </button>
      <div className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3" aria-live="polite">
        <span className="text-sm text-fg-2">{t('total')}</span>
        <span className={cn('tabular text-sm font-bold', total === BPS_TOTAL ? 'text-ok-fg' : 'text-danger-fg')}>
          {formatBps(total, intl(locale))} ·{' '}
          {total === BPS_TOTAL ? t('complete') : remaining > 0 ? t('remaining', { pct: formatBps(remaining, intl(locale)) }) : t('over', { pct: formatBps(-remaining, intl(locale)) })}
        </span>
      </div>
    </ActionForm>
  );
}

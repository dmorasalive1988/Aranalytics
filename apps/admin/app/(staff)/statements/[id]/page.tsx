import Link from 'next/link';
import { notFound } from 'next/navigation';
import { statements } from '@pluma/services';
import { Card, Field, Input, Notice, StatusPill, cn } from '@pluma/ui';
import { ActionForm } from '@/components/action-form';
import { PageTitle, Table } from '@/components/table';
import { RUN_LABEL, fmtDate, fmtMoney } from '@/components/status';
import { deps, requireStaff } from '@/lib/server';
import { approveAction, calculateAction, fxAction, publishAction, testEmailAction, uploadAction } from '../actions';

const MATCH: Record<string, string> = { auto_matched: 'Match automático', manual_matched: 'Match manual', suggested: 'Con sugerencia', unmatched: 'Sin match', suspense: 'Suspenso' };

/** E3–E9 · Pipeline del período: archivos, FX, cálculo, conciliación, aprobación y publicación. */
export default async function PeriodPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff();
  const { id } = await params;
  const d = await statements.periodDetail(deps(), id);
  if (!d) notFound();
  const run = d.run ? await statements.getRun(deps(), d.run.id) : null;
  const rec = run?.reconciliation;
  const published = d.run?.status === 'published';
  const preview = d.run && ['approved', 'scheduled'].includes(d.run.status) ? await statements.publicationPreview(deps(), d.run.id) : null;
  const unresolved = d.lineStats.filter((s) => ['suggested', 'unmatched'].includes(s.match_status)).reduce((a, s) => a + s.n, 0);
  const declaredUsd = d.files.filter((f) => f.status !== 'superseded').reduce((a, f) => a + Math.round(Number((f.controlTotals as Record<string, string>).USD ?? 0) * 100), 0);

  const eq: [string, number | undefined][] = rec ? [
    ['Neto a autores', Number(rec.writersNetCents)], ['Comisión Pluma', Number(rec.commissionCents)], ['Retenciones fiscales', Number(rec.withholdingCents)],
    ['Recuperación de adelantos', Number(rec.recoupmentCents)], ['Retenido por disputas', Number(rec.heldCents)], ['Suspenso', Number(rec.suspenseCents)], ['Redondeo', Number(rec.roundingCents)],
  ] : [];

  return (
    <>
      <PageTitle title={`Período ${d.period.code}`} actions={d.run && <StatusPill tone={RUN_LABEL[d.run.status]?.[1] ?? 'outline'}>{RUN_LABEL[d.run.status]?.[0] ?? d.run.status}</StatusPill>}>
        Fecha oficial de pago: {d.period.payDate}
      </PageTitle>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">1–2 · Archivos</h2>
        {!published && (
          <Card className="max-w-2xl">
            <ActionForm action={uploadAction.bind(null, id)} submitLabel="Cargar y normalizar" pendingLabel="Procesando…">
              <Field id="file" label="Archivo del statement (CSV)" hint="Se guarda en crudo, con su huella SHA-256, y nunca se modifica.">
                <input id="file" name="file" type="file" accept=".csv,text/csv" aria-describedby="file-hint" className="block w-full rounded-xl border border-field-stroke bg-field px-4 py-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-tinta file:px-3 file:py-2 file:font-bold file:text-papel" />
              </Field>
            </ActionForm>
          </Card>
        )}
        <Table head={['Versión', 'Archivo', 'Formato', 'Líneas', 'Errores', 'Totales de control', 'SHA-256', 'Cargado']}>
          {d.files.map((f) => (
            <tr key={f.id} className={cn(f.status === 'superseded' && 'opacity-50')}>
              <td className="tabular">v{f.version}</td>
              <td>{f.originalName}</td>
              <td className="text-xs">{f.mappingVersion}</td>
              <td className="tabular">{f.lineCount}</td>
              <td>{(f.parseErrors as { lineNo: number; message: string }[]).length ? <details><summary className="cursor-pointer text-danger-fg">{(f.parseErrors as unknown[]).length}</summary><ul className="text-xs">{(f.parseErrors as { lineNo: number; message: string }[]).map((e) => <li key={e.lineNo}>Línea {e.lineNo}: {e.message}</li>)}</ul></details> : '0'}</td>
              <td className="tabular text-xs">{Object.entries(f.controlTotals as Record<string, string>).map(([k, v]) => `${k} ${v}`).join(' · ')}</td>
              <td className="tabular text-xs">{f.sha256.slice(0, 12)}…</td>
              <td className="tabular whitespace-nowrap">{fmtDate(f.uploadedAt)}</td>
            </tr>
          ))}
        </Table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">3 · Matching</h2>
        <div className="flex flex-wrap gap-2">
          {d.lineStats.map((s) => <StatusPill key={s.match_status} tone={['suggested', 'unmatched'].includes(s.match_status) ? 'coral' : s.match_status === 'suspense' ? 'niebla' : 'verde'}>{MATCH[s.match_status] ?? s.match_status}: {s.n}</StatusPill>)}
        </div>
        {unresolved > 0 && !published && <Notice tone="alert" title={`${unresolved} líneas esperan revisión. Si calculas así, van a suspenso.`}><Link href={`/matching?period=${id}`} className="font-bold">Abrir la cola de matching</Link></Notice>}
      </section>

      {d.currencies.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-extrabold">Tasas de cambio a USD</h2>
          <Table head={['Moneda', 'Tasa', 'Fuente', 'Vigente desde']}>
            {d.rates.map((r) => <tr key={r.id}><td>{r.base}</td><td className="tabular">{r.rate}</td><td>{r.source}</td><td className="tabular">{fmtDate(r.asOf)}</td></tr>)}
          </Table>
          {!published && (
            <Card className="max-w-3xl">
              <ActionForm action={fxAction.bind(null, id)} submitLabel="Registrar tasa" submitVariant="secondary" pendingLabel="Guardando…">
                <div className="grid grid-cols-4 gap-3">
                  <Field id="base" label="Moneda"><Input id="base" name="base" defaultValue={d.currencies[0]} required /></Field>
                  <Field id="rate" label="Tasa a USD"><Input id="rate" name="rate" inputMode="decimal" required /></Field>
                  <Field id="asOf" label="Fecha"><Input id="asOf" name="asOf" type="date" defaultValue={d.period.payDate} required /></Field>
                  <Field id="source" label="Fuente"><Input id="source" name="source" placeholder="Banco central…" required /></Field>
                </div>
              </ActionForm>
            </Card>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-xl font-extrabold">4–6 · Cálculo y conciliación</h2>
        {!published && d.files.length > 0 && (
          <Card className="max-w-2xl">
            <ActionForm action={calculateAction.bind(null, id)} submitLabel={d.run ? 'Recalcular' : 'Calcular'} pendingLabel="Calculando…">
              <Field id="received" label="Monto recibido en el banco (USD)" hint={`Lo que efectivamente llegó. El archivo declara USD ${(declaredUsd / 100).toFixed(2)} más otras monedas convertidas.`}>
                <Input id="received" name="received" inputMode="decimal" defaultValue={d.run?.receivedCents ? (Number(d.run.receivedCents) / 100).toFixed(2) : ''} required hasHint />
              </Field>
            </ActionForm>
          </Card>
        )}
        {rec && (
          <Card className="max-w-2xl">
            <dl className="flex flex-col">
              <div className="flex justify-between border-b border-[#E6E0D4] py-2 font-bold"><dt>Recibido</dt><dd className="tabular">{fmtMoney(Number(rec.receivedCents))}</dd></div>
              {eq.map(([k, v]) => <div key={k} className="flex justify-between border-b border-line py-2 text-sm"><dt className="text-fg-2">{k}</dt><dd className="tabular">{fmtMoney(v ?? 0)}</dd></div>)}
              <div className={cn('flex justify-between py-2 font-bold', rec.balanced ? 'text-ok-fg' : 'text-danger-fg')}><dt>Diferencia</dt><dd className="tabular">{fmtMoney(Number(rec.differenceCents))}</dd></div>
              <div className="flex justify-between py-1 text-xs text-fg-2"><dt>Total de líneas / total de control</dt><dd className="tabular">{fmtMoney(Number(rec.parsedTotalCents))} / {fmtMoney(Number(rec.controlTotalCents))}</dd></div>
            </dl>
            {rec.balanced ? <Notice tone="ok" title="Cuadra al centavo." /> : <Notice tone="alert" title="No cuadra: la publicación está bloqueada." />}
          </Card>
        )}
        {run && run.writers.length > 0 && (
          <details>
            <summary className="cursor-pointer font-bold">Detalle por autor ({run.writers.length})</summary>
            <Table head={['Autor', 'Bruto', 'Comisión', 'Retención', 'Retenido', 'Neto']}>
              {run.writers.map((w) => <tr key={w.writerUserId}><td><Link href={`/autores/${w.writerUserId}`}>{w.writerUserId.slice(0, 8)}</Link></td><td className="tabular">{fmtMoney(w.grossCents)}</td><td className="tabular">{fmtMoney(w.commissionCents)}</td><td className="tabular">{fmtMoney(w.withholdingCents)}</td><td className="tabular">{fmtMoney(w.heldCents)}</td><td className="tabular font-bold">{fmtMoney(w.netCents)}</td></tr>)}
            </Table>
          </details>
        )}
      </section>

      {d.run && rec?.balanced && (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-extrabold">7 · Aprobación y publicación</h2>
          {d.run.status === 'reconciled' && (
            <Card className="max-w-2xl">
              {d.run.calculatedBy === staff.id ? <Notice tone="info" title="Calculaste esta corrida: debe aprobarla otra persona con rol de aprobador." /> : (
                <ActionForm action={approveAction.bind(null, id, d.run.id)} submitLabel="Aprobar publicación" pendingLabel="Aprobando…" />
              )}
            </Card>
          )}
          {preview && (
            <Card className="flex max-w-2xl flex-col gap-4">
              <dl className="grid grid-cols-3 gap-3">
                <div><dt className="text-xs text-fg-2">Autores notificados</dt><dd className="tabular text-2xl font-bold">{preview.writers}</dd></div>
                <div><dt className="text-xs text-fg-2">Con saldo cero</dt><dd className="tabular text-2xl font-bold">{preview.zeroBalance}</dd></div>
                <div><dt className="text-xs text-fg-2">Neto total</dt><dd className="tabular text-2xl font-bold">{fmtMoney(preview.netTotalCents)}</dd></div>
              </dl>
              <p className="text-sm text-fg-2">Aprobó {d.run.approvedBy?.slice(0, 8)} el {fmtDate(d.run.approvedAt)}.{d.run.testSentAt && ` Envío de prueba: ${fmtDate(d.run.testSentAt)}.`}{d.run.status === 'scheduled' && ` Programada para ${fmtDate(d.run.scheduledFor)}.`}</p>
              <ActionForm action={testEmailAction.bind(null, id, d.run.id)} submitLabel="Enviarme un correo de prueba" submitVariant="secondary" pendingLabel="Enviando…" />
              <ActionForm action={publishAction.bind(null, id, d.run.id)} submitLabel="Publicar statements" pendingLabel="Publicando…">
                <Field id="when" label="Programar (opcional)" hint="Vacío = publicar ahora. Cada autor recibe un único correo en su idioma."><Input id="when" name="when" type="datetime-local" hasHint /></Field>
              </ActionForm>
            </Card>
          )}
          {published && <Notice tone="ok" title={`Publicado: ${fmtDate(d.run.publishedAt)}. Los autores ya ven su statement oficial.`} />}
        </section>
      )}
    </>
  );
}

import { statements } from '@pluma/services';
import { Notice, buttonClass } from '@pluma/ui';
import { PageTitle, Table } from '@/components/table';
import { WorkSearch } from '@/components/work-search';
import { deps, requireStaff } from '@/lib/server';
import { matchAction, searchWorksAction, suspenseAction } from '../statements/actions';

export const metadata = { title: 'Matching' };

/** E5 · Cola de líneas sin match: sugerencias por similitud, búsqueda manual o suspenso. */
export default async function Matching({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireStaff();
  const { period } = await searchParams;
  const queue = await statements.matchingQueue(deps(), period);
  return (
    <>
      <PageTitle title="Matching">Cada match manual enseña un alias: el próximo archivo casa solo.</PageTitle>
      {queue.length === 0 && <Notice tone="ok" title="No hay líneas pendientes de revisión." />}
      {queue.length > 0 && (
        <Table head={['Período', 'Línea del statement', 'Fuente', 'Monto', 'Sugerencias', 'Otra obra', '']}>
          {queue.map((l) => (
            <tr key={l.id} className="align-top">
              <td className="tabular">{l.period} · #{l.line_no}</td>
              <td><strong>{l.work_title ?? '—'}</strong><div className="text-xs text-fg-2">{[l.provider_work_code, l.writer_ipi && `IPI ${l.writer_ipi}`].filter(Boolean).join(' · ')}</div></td>
              <td className="text-xs">{l.source} · {l.income_type} · {l.territory}</td>
              <td className="tabular whitespace-nowrap">{l.currency} {l.net}</td>
              <td className="min-w-56">
                <div className="flex flex-col gap-2">
                  {l.suggestions.map((s) => (
                    <form key={s.workId} action={matchAction.bind(null, l.id, s.workId) as unknown as () => Promise<void>}>
                      <button className={buttonClass({ variant: 'outline-ambar', size: 'md', block: true })}>{s.title} · {Math.round(Number(s.score) * 100)} %</button>
                    </form>
                  ))}
                  {l.suggestions.length === 0 && <span className="text-xs text-fg-2">Sin sugerencias</span>}
                </div>
              </td>
              <td className="min-w-64"><WorkSearch lineId={l.id} search={searchWorksAction} match={matchAction} /></td>
              <td>
                <form action={suspenseAction.bind(null, l.id) as unknown as () => Promise<void>}><button className={buttonClass({ variant: 'secondary', size: 'md' })}>A suspenso</button></form>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

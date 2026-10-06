import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { WORK_STATUSES, type WorkStatus } from '@pluma/domain';
import { ScreenTitle, buttonClass, cn } from '@pluma/ui';
import { Plus, Search } from 'lucide-react';
import { listMyWorks } from '@pluma/services';
import { WorkRow } from '@/components/work-row';
import { WorksTable } from '@/components/works-table';
import { deps, requireMember } from '@/lib/server';

export async function generateMetadata() {
  return { title: (await getTranslations('works'))('title') };
}

/** A21 · Obras. Celular: lista. Escritorio: tabla con búsqueda por título y filtro por estado. */
export default async function Works({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string }> }) {
  const s = await requireMember();
  const t = await getTranslations('works');
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const estado = WORK_STATUSES.includes(sp.estado as WorkStatus) ? (sp.estado as WorkStatus) : undefined;
  const all = await listMyWorks(deps(), s.userId);
  const norm = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const works = all.filter((w) => (!estado || w.status === estado) && (!q || norm(w.title).includes(norm(q))));
  const present = WORK_STATUSES.filter((st) => all.some((w) => w.status === st));
  const href = (e?: string) => `/obras?${new URLSearchParams({ ...(q ? { q } : {}), ...(e ? { estado: e } : {}) })}`;
  const chip = (on: boolean) => cn('inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-bold no-underline', on ? 'bg-ambar text-tinta' : 'bg-surface text-fg hover:bg-surface-2');
  return (
    <div data-wide className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <ScreenTitle title={t('title')} />
        <Link href="/obras/nueva" className={buttonClass({ size: 'md' })}>
          <Plus size={18} strokeWidth={2} aria-hidden />
          {t('new')}
        </Link>
      </div>
      {all.length === 0 ? (
        <p className="text-[15px] leading-relaxed text-fg-2">{t('empty')}</p>
      ) : (
        <>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label={t('filterAll')} className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
              <Link href={href()} aria-current={!estado ? 'page' : undefined} className={chip(!estado)}>{t('filterAll')} ({all.length})</Link>
              {present.map((st) => (
                <Link key={st} href={href(st)} aria-current={estado === st ? 'page' : undefined} className={chip(estado === st)}>
                  {t(`status.${st}`)} ({all.filter((w) => w.status === st).length})
                </Link>
              ))}
            </nav>
            <form role="search" className="flex gap-2">
              {estado && <input type="hidden" name="estado" value={estado} />}
              <label className="relative flex-1 lg:w-72">
                <span className="sr-only">{t('search')}</span>
                <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-2" aria-hidden />
                <input name="q" defaultValue={q} placeholder={t('search')} className="h-11 w-full rounded-xl border border-field-stroke bg-field pr-3 pl-10 text-[15px] text-fg" />
              </label>
              <button className={buttonClass({ variant: 'secondary', size: 'md' })}>{t('apply')}</button>
            </form>
          </div>
          {works.length === 0 ? (
            <p className="text-sm text-fg-2">{t('noMatch')}</p>
          ) : (
            <>
              <ul className="lg:hidden">{works.map((w) => <WorkRow key={w.id} w={w} />)}</ul>
              <div className="hidden lg:block"><WorksTable works={works} showUpdated /></div>
            </>
          )}
        </>
      )}
    </div>
  );
}

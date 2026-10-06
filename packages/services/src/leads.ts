import { desc, eq, isDemoMode, sql, t, withSystem } from '@pluma/db';
import { DomainError } from '@pluma/domain';
import type { Deps } from './deps';
import { emit } from './events';

export type LeadKind = 'waitlist' | 'sync' | 'ar';
export interface LeadInput {
  kind: LeadKind;
  email: string;
  lang: 'es' | 'en' | 'pt';
  name?: string | null;
  company?: string | null;
  role?: string | null;
  plan?: 'socio' | 'pro' | null;
  message?: string | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (s: string | null | undefined, max: number) => {
  const v = s?.trim();
  return v ? v.slice(0, max) : null;
};

/** Correo del equipo que recibe los avisos del sitio. En el demo, un buzón ficticio (visible en /demo/correo). */
export function teamEmail() {
  return process.env.PLUMA_TEAM_EMAIL || (isDemoMode() ? 'equipo@pluma.demo' : null);
}

/**
 * Guarda un contacto del sitio público (lista de espera, compradores de sync, A&Rs) y avisa al equipo por correo.
 * Un correo repetido en la lista de espera no se duplica ni vuelve a avisar.
 */
export async function submitLead(deps: Deps, input: LeadInput) {
  const email = input.email.trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) throw new DomainError('LEAD_EMAIL_INVALID');
  if (!['waitlist', 'sync', 'ar'].includes(input.kind)) throw new DomainError('LEAD_KIND_INVALID');
  if (input.kind !== 'waitlist' && !clip(input.name, 120)) throw new DomainError('LEAD_NAME_REQUIRED');
  return withSystem(deps.db, { actorId: null, actorRole: 'system', command: `lead.${input.kind}` }, async (tx) => {
    const [row] = await tx
      .insert(t.marketingLeads)
      .values({
        kind: input.kind,
        email,
        lang: ['es', 'en', 'pt'].includes(input.lang) ? input.lang : 'es',
        name: clip(input.name, 120),
        company: clip(input.company, 160),
        role: clip(input.role, 120),
        plan: input.plan === 'socio' || input.plan === 'pro' ? input.plan : null,
        message: clip(input.message, 2000),
      })
      .onConflictDoNothing()
      .returning({ id: t.marketingLeads.id });
    if (row) await emit(tx, 'lead.created', 'marketing_lead', row.id);
    return { id: row?.id ?? null, duplicate: !row };
  });
}

/** Back-office: contactos recientes, opcionalmente por tipo. */
export async function listLeads(deps: Deps, kind?: LeadKind, limit = 200) {
  const q = deps.db.select().from(t.marketingLeads);
  return (kind ? q.where(eq(t.marketingLeads.kind, kind)) : q).orderBy(desc(t.marketingLeads.createdAt)).limit(limit);
}

export async function leadCounts(deps: Deps) {
  const rows = await deps.db.select({ kind: t.marketingLeads.kind, n: sql<number>`count(*)::int` }).from(t.marketingLeads).groupBy(t.marketingLeads.kind);
  return Object.fromEntries(rows.map((r) => [r.kind, r.n])) as Partial<Record<LeadKind, number>>;
}

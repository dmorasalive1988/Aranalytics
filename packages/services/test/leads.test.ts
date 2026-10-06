import { afterAll, describe, expect, it } from 'vitest';
import { eq, t } from '@pluma/db';
import { leads } from '../src';
import { makeHarness } from './harness';

const h = makeHarness();
const { S, deps } = h;
afterAll(() => h.close());
process.env.PLUMA_TEAM_EMAIL = 'equipo@pluma.test';

describe('contactos del sitio', () => {
  it('guarda la lista de espera una sola vez por correo y avisa al equipo una vez', async () => {
    const email = `Espera-${Date.now()}@Autor.test`;
    const a = await leads.submitLead(deps, { kind: 'waitlist', email, lang: 'es', plan: 'pro' });
    const b = await leads.submitLead(deps, { kind: 'waitlist', email: email.toLowerCase(), lang: 'es' });
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    const rows = await deps.db.select().from(t.marketingLeads).where(eq(t.marketingLeads.email, email.toLowerCase()));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.plan).toBe('pro');
    await S.dispatchPending(deps, { limit: 500 });
    const sent = h.mails().filter((m) => m.to === 'equipo@pluma.test' && m.subject.includes('lista de espera') && m.text.includes(email.toLowerCase()));
    expect(sent).toHaveLength(1);
  });

  it('formularios de sync y A&R: exigen nombre, guardan los datos y avisan', async () => {
    await expect(leads.submitLead(deps, { kind: 'ar', email: 'ar@sello.test', lang: 'en' })).rejects.toThrow('LEAD_NAME_REQUIRED');
    await expect(leads.submitLead(deps, { kind: 'sync', email: 'no-es-correo', name: 'X', lang: 'es' })).rejects.toThrow('LEAD_EMAIL_INVALID');
    const r = await leads.submitLead(deps, { kind: 'sync', email: 'super@agencia.test', name: 'Sol', company: 'Agencia', message: 'Busco cumbia para un comercial', lang: 'es' });
    await leads.submitLead(deps, { kind: 'sync', email: 'super@agencia.test', name: 'Sol', lang: 'es' });
    expect(r.duplicate).toBe(false);
    await S.dispatchPending(deps, { limit: 500 });
    expect(h.mails().filter((m) => m.to === 'equipo@pluma.test' && m.subject.includes('comprador de sync')).length).toBeGreaterThanOrEqual(2);
    const counts = await leads.leadCounts(deps);
    expect(counts.sync).toBeGreaterThanOrEqual(2);
  });
});

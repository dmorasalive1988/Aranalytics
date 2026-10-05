import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, withUser, withSystem, t, eq } from '../src';
import { TEST_URL, makeWork, makeWriter } from './helpers';

const sql = postgres(TEST_URL, { max: 2, onnotice: () => {} });
const h = createDb(TEST_URL, { max: 2 });

afterAll(async () => {
  await sql.end();
  await h.close();
});

describe('splits en base de datos (criterio 2)', () => {
  let owner: string;
  let version: string;
  beforeAll(async () => {
    owner = await makeWriter(sql, { plan: 'socio' });
    const work = await makeWork(sql, owner);
    [{ id: version }] = await sql`insert into split_versions (work_id, version, created_by) values (${work}, 1, ${owner}) returning id` as unknown as [{ id: string }];
    await sql`insert into split_shares (split_version_id, writer_user_id, role, share_bps, administered) values (${version}, ${owner}, 'composer', 2500, true)`;
    for (const [i, bps] of [[1, 2500], [2, 2500], [3, 2499]] as const) {
      await sql`insert into split_shares (split_version_id, external_name, external_email, role, share_bps, administered)
                values (${version}, ${'Coautor ' + i}, ${`c${i}@x.co`}, 'composer', ${bps}, false)`;
    }
  });

  it('4 coautores con 99,99 % no pueden pasar a firma', async () => {
    await expect(sql`update split_versions set status = 'pending_signatures' where id = ${version}`).rejects.toThrow('SPLIT_TOTAL_NOT_100');
  });

  it('con 100 % sí, y luego las participaciones quedan congeladas', async () => {
    await sql`update split_shares set share_bps = 2500 where split_version_id = ${version} and external_email = 'c3@x.co'`;
    await sql`update split_versions set status = 'pending_signatures' where id = ${version}`;
    await expect(sql`update split_shares set share_bps = 3000 where split_version_id = ${version} and external_email = 'c3@x.co'`).rejects.toThrow('SPLIT_VERSION_FROZEN');
    await expect(sql`insert into split_shares (split_version_id, external_name, external_email, role, share_bps, administered) values (${version}, 'X', 'x@x.co', 'composer', 1, false)`).rejects.toThrow('SPLIT_VERSION_FROZEN');
    // marcar como firmada sí se permite
    await sql`update split_shares set status = 'signed', signed_at = now() where split_version_id = ${version} and writer_user_id = ${owner}`;
  });
});

describe('opt-ins de catálogo (criterio 1)', () => {
  it('Socio no puede activar sync ni A&R; Pro sí', async () => {
    const socio = await makeWriter(sql, { plan: 'socio' });
    const pro = await makeWriter(sql, { plan: 'pro' });
    const ws = await makeWork(sql, socio);
    const wp = await makeWork(sql, pro);
    await expect(sql`update works set sync_opt_in = true where id = ${ws}`).rejects.toThrow('PLAN_REQUIRES_PRO');
    await expect(sql`update works set ar_opt_in = true where id = ${ws}`).rejects.toThrow('PLAN_REQUIRES_PRO');
    await sql`update works set sync_opt_in = true, ar_opt_in = true where id = ${wp}`;
  });

  it('A&R solo para obras sin grabar', async () => {
    const pro = await makeWriter(sql, { plan: 'pro' });
    const w = await makeWork(sql, pro);
    await sql`insert into recordings (work_id, isrc, title, artist) values (${w}, 'COA1B2600001', 'X', 'Y')`;
    await expect(sql`update works set ar_opt_in = true where id = ${w}`).rejects.toThrow('AR_REQUIRES_UNRECORDED');
  });
});

describe('RLS', () => {
  it('un autor solo ve sus obras y no puede escribir directo', async () => {
    const a = await makeWriter(sql, { plan: 'socio' });
    const b = await makeWriter(sql, { plan: 'socio' });
    const wa = await makeWork(sql, a, 'De A');
    await makeWork(sql, b, 'De B');
    const seenByA = await withUser(h.db, a, (tx) => tx.select({ id: t.works.id }).from(t.works));
    expect(seenByA.map((r) => r.id)).toEqual([wa]);
    const profiles = await withUser(h.db, a, (tx) => tx.select().from(t.writerProfiles));
    expect(profiles).toHaveLength(1);
    const err = await withUser(h.db, a, (tx) => tx.update(t.works).set({ title: 'hack' }).where(eq(t.works.id, wa))).catch((e) => e);
    expect(String(err?.cause?.message ?? err)).toMatch(/permission denied/);
  });

  it('un coautor socio ve la obra donde tiene participación', async () => {
    const owner = await makeWriter(sql, { plan: 'socio' });
    const co = await makeWriter(sql, { plan: 'socio' });
    const w = await makeWork(sql, owner, 'Compartida');
    const [v] = await sql<{ id: string }[]>`insert into split_versions (work_id, version, created_by) values (${w}, 1, ${owner}) returning id`;
    await sql`insert into split_shares (split_version_id, writer_user_id, role, share_bps, administered) values (${v!.id}, ${co}, 'lyricist', 5000, true)`;
    const seen = await withUser(h.db, co, (tx) => tx.select({ id: t.works.id }).from(t.works));
    expect(seen.map((r) => r.id)).toContain(w);
  });

  it('el saldo es la suma del ledger, que no admite cambios', async () => {
    const a = await makeWriter(sql);
    await sql`insert into writer_ledger_entries (writer_user_id, type, amount_cents, currency) values (${a}, 'statement_credit', 12345, 'USD'), (${a}, 'payout_debit', -2345, 'USD')`;
    const bal = await withUser(h.db, a, (tx) => tx.select().from(t.writerBalances));
    expect(Number(bal[0]?.balanceCents)).toBe(10000);
    await expect(sql`update writer_ledger_entries set amount_cents = 0 where writer_user_id = ${a}`).rejects.toThrow('WRITER_LEDGER_ENTRIES_IS_APPEND_ONLY');
  });
});

describe('auditoría inmutable (criterio 7)', () => {
  it('registra actor y comando, y la cadena detecta manipulación', async () => {
    const a = await makeWriter(sql, { plan: 'socio' });
    await withSystem(h.db, { actorId: a, actorRole: 'writer', command: 'membership.upgrade', ip: '203.0.113.7' }, async (tx) => {
      await tx.update(t.memberships).set({ planCode: 'pro' }).where(eq(t.memberships.userId, a));
    });
    const [row] = await sql`select * from audit_log where entity_id = ${a} and action = 'memberships.update' order by id desc limit 1`;
    expect(row).toMatchObject({ actor_user_id: a, command: 'membership.upgrade', ip: '203.0.113.7' });
    expect(row!.before.plan_code).toBe('socio');
    expect(row!.after.plan_code).toBe('pro');

    expect((await sql<{ broken: string | null }[]>`select audit_verify_chain() as broken`)[0]!.broken).toBeNull();
    await expect(sql`delete from audit_log`).rejects.toThrow('AUDIT_LOG_IS_APPEND_ONLY');

    // Simulación de manipulación por alguien con acceso de superusuario
    await sql.begin(async (tx) => {
      await tx`alter table audit_log disable trigger audit_log_append_only`;
      await tx`update audit_log set after = jsonb_set(after, '{plan_code}', '"socio"') where id = ${row!.id}`;
      const [res] = await tx<{ broken: string }[]>`select audit_verify_chain() as broken`;
      expect(String(res?.broken)).toBe(String(row!.id));
      throw new Error('rollback');
    }).catch((e) => { if (e.message !== 'rollback') throw e; });
  });
});

import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DevMailbox, DevPush, DevWhatsApp, DisabledTsa, FakePayments, LocalStorage, RuleQueryParser } from '@pluma/adapters';
import { createDb } from '@pluma/db';
import * as S from '../src';
import type { Deps } from '../src';

export const TEST_URL = process.env.SERVICES_TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/pluma_test_services';

export function makeHarness() {
  const handle = createDb(TEST_URL, { max: 4 });
  const mailDir = mkdtempSync(join(tmpdir(), 'pluma-mail-'));
  const pushDir = mkdtempSync(join(tmpdir(), 'pluma-push-'));
  const waDir = mkdtempSync(join(tmpdir(), 'pluma-wa-'));
  const clock = { now: new Date('2026-10-05T15:00:00Z') };
  const payments = new FakePayments('http://app.test', 'secret');
  const deps: Deps = {
    db: handle.db,
    mail: new DevMailbox(mailDir),
    push: new DevPush(pushDir, 'BTestVapidPublicKey'),
    whatsapp: new DevWhatsApp(waDir),
    payments,
    storage: new LocalStorage(mkdtempSync(join(tmpdir(), 'pluma-st-')), 'http://app.test/api/dev-storage', 'secret'),
    tsa: new DisabledTsa(),
    queryParser: new RuleQueryParser(),
    appUrl: 'http://app.test',
    signUrl: 'http://firma.test',
    signingSecret: 'test-signing-secret',
    dataKey: Buffer.alloc(32, 7),
    now: () => clock.now,
  };
  const ctx = { ip: '198.51.100.10', userAgent: 'vitest' };

  const mails = () =>
    readdirSync(mailDir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => JSON.parse(readFileSync(join(mailDir, f), 'utf8')) as { to: string; subject: string; text: string; tag: string });
  const readDir = <T>(dir: string) =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T);
  const pushes = () => readDir<{ endpoint: string; title: string; body: string; url: string; tag: string }>(pushDir);
  const whatsapps = () => readDir<{ to: string; template: string; language: string; params: string[] }>(waDir);
  const lastCodeFor = (email: string) => {
    const m = mails().filter((x) => x.to === email && /code/.test(x.tag)).pop();
    return (m?.subject.match(/\b(\d{6})\b/) ?? m?.text.match(/\b(\d{6})\b/))?.[1] ?? '';
  };

  /** Autor que completa el onboarding: perfil, sociedad, plan, contrato y pago. */
  async function onboardWriter(opts: { plan?: 'socio' | 'pro'; locale?: S.AppLocale; name?: string; birthDate?: string } = {}) {
    const id = randomUUID();
    const email = `${id.slice(0, 8)}@writer.test`;
    await S.ensureAppUser(deps, { id, email, emailVerified: true }, opts.locale ?? 'es');
    await S.saveProfile(deps, id, { legalName: opts.name ?? `Autora ${id.slice(0, 4)}`, artistName: null, country: 'CO', city: 'Bogotá', birthDate: opts.birthDate ?? '1994-03-02' }, ctx);
    await S.saveSociety(deps, id, { societyCode: 'SAYCO', societyOther: null, ipi: null }, ctx);
    await S.choosePlan(deps, id, opts.plan ?? 'socio', ctx);
    await S.signAdminAgreement(deps, id, ctx);
    const plans = await S.loadPlans(deps);
    for (const ev of payments.completeCheckout(id, opts.plan ?? 'socio', plans[opts.plan ?? 'socio'].amountCents, clock.now)) await S.applyPaymentEvent(deps, ev);
    return { id, email };
  }

  return { deps, ctx, clock, payments, mails, pushes, whatsapps, lastCodeFor, onboardWriter, close: handle.close, S };
}

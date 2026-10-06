import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, t } from '@pluma/db';
import type { EmailSender } from '@pluma/adapters';
import { makeHarness } from './harness';

const h = makeHarness();
const { S, deps, ctx } = h;
afterAll(() => h.close());

let ana = { id: '', email: '' };
let beto = { id: '', email: '' };
let ops = '';

async function newWorkWith(ownerId: string, coauthorId: string, title: string) {
  const workId = await S.createWork(deps, ownerId, { title, altTitles: [], language: 'es', genre: 'pop', lyrics: null, aiDeclaration: 'none', isrcs: [] }, ctx);
  await S.setDraftSplit(deps, ownerId, workId, [
    { kind: 'member', userId: ownerId, role: 'composer', bps: 5000 },
    { kind: 'member', userId: coauthorId, role: 'lyricist', bps: 5000 },
  ], ctx);
  await S.submitForSignatures(deps, ownerId, workId, ctx);
  await S.dispatchPending(deps, { limit: 200 });
  return workId;
}

const deliveriesOf = async (userId: string, template: string) =>
  deps.db
    .select({ channel: t.notificationDeliveries.channel, status: t.notificationDeliveries.status, providerMessageId: t.notificationDeliveries.providerMessageId, attempts: t.notificationDeliveries.attempts, notificationId: t.notifications.id })
    .from(t.notificationDeliveries)
    .innerJoin(t.notifications, eq(t.notifications.id, t.notificationDeliveries.notificationId))
    .where(and(eq(t.notifications.recipientUserId, userId), eq(t.notifications.template, template)));

beforeAll(async () => {
  await S.dispatchPending(deps, { limit: 500 });
  ana = await h.onboardWriter({ plan: 'pro', name: 'Ana Prado' });
  beto = await h.onboardWriter({ plan: 'socio', name: 'Beto Lima', locale: 'pt-BR' });
  ops = (await h.onboardWriter({ name: 'Operador' })).id;
  await deps.db.insert(t.userRoles).values({ userId: ops, role: 'operator' });
  await S.dispatchPending(deps, { limit: 500 });
});

describe('preferencias y canales', () => {
  it('el correo de dinero, splits y membresía no se puede apagar', async () => {
    await expect(S.notifications.setPreference(deps, beto.id, 'splits', 'email', false)).rejects.toThrow('EMAIL_MANDATORY');
    const prefs = await S.notifications.getPreferences(deps, beto.id);
    const splits = prefs.categories.find((c) => c.category === 'splits')!;
    expect(splits.channels.email).toEqual({ enabled: true, locked: true });
    expect(splits.channels.whatsapp.enabled).toBe(false); // apagado por defecto salvo dinero
    expect(prefs.categories.find((c) => c.category === 'works')!.channels.email.locked).toBe(false);
  });

  it('WhatsApp exige número válido y consentimiento explícito', async () => {
    await expect(S.notifications.setWhatsApp(deps, beto.id, { phone: '300 123', consent: true }, ctx)).rejects.toThrow('PHONE_INVALID');
    await expect(S.notifications.setWhatsApp(deps, beto.id, { phone: '+55 11 98765-4321', consent: false }, ctx)).rejects.toThrow('CONSENT_REQUIRED');
    await S.notifications.setWhatsApp(deps, beto.id, { phone: '+55 (11) 98765-4321', consent: true }, ctx);
    const prefs = await S.notifications.getPreferences(deps, beto.id);
    expect(prefs.whatsapp).toMatchObject({ available: true, phone: '+5511987654321', optedIn: true });
  });

  it('una invitación sale por correo, push y WhatsApp según las preferencias, en el idioma de la persona', async () => {
    await S.notifications.subscribePush(deps, beto.id, { endpoint: 'https://push.test/beto-1', keys: { p256dh: 'k', auth: 'a' } });
    await expect(S.notifications.subscribePush(deps, beto.id, { endpoint: 'http://inseguro.test/x', keys: { p256dh: 'k', auth: 'a' } })).rejects.toThrow('PUSH_INVALID');
    await S.notifications.setPreference(deps, beto.id, 'splits', 'whatsapp', true);
    await newWorkWith(ana.id, beto.id, 'Samba da Madrugada');

    const d = await deliveriesOf(beto.id, 'split_invitation');
    expect(d.map((x) => `${x.channel}:${x.status}`).sort()).toEqual(['email:sent', 'push:sent', 'whatsapp:sent']);
    const push = h.pushes().filter((p) => p.endpoint === 'https://push.test/beto-1');
    expect(push).toHaveLength(1);
    expect(push[0]!.title).toContain('Samba da Madrugada');
    expect(push[0]!.url).toMatch(/^http:\/\/app\.test\/obras\//);
    const wa = h.whatsapps().filter((w) => w.to === '+5511987654321');
    expect(wa).toHaveLength(1);
    expect(wa[0]).toMatchObject({ template: 'pluma_split_invitation', language: 'pt_BR' });
    const [n] = await deps.db.select().from(t.notifications).where(and(eq(t.notifications.recipientUserId, beto.id), eq(t.notifications.template, 'split_invitation')));
    expect(n!.category).toBe('splits');
  });

  it('las categorías opcionales respetan el correo apagado, pero siguen en el centro in-app', async () => {
    await S.notifications.setPreference(deps, ana.id, 'works', 'email', false);
    const before = h.mails().filter((m) => m.to === ana.email && m.tag === 'work_status').length;
    const workId = await newWorkWith(ana.id, beto.id, 'Bolero de Papel');
    const [share] = await deps.db.select().from(t.splitShares).innerJoin(t.splitVersions, eq(t.splitVersions.id, t.splitShares.splitVersionId)).where(and(eq(t.splitVersions.workId, workId), eq(t.splitShares.writerUserId, beto.id)));
    await S.signAsMember(deps, beto.id, share!.split_shares.id, ctx);
    await S.dispatchPending(deps, { limit: 200 });
    await S.admin.exportNewWorks(deps, ops, ctx); // → enviada al administrador (categoría obras)
    await S.dispatchPending(deps, { limit: 200 });
    expect(h.mails().filter((m) => m.to === ana.email && m.tag === 'work_status').length).toBe(before);
    const inbox = await S.notifications.inbox(deps, ana.id);
    expect(inbox.items.some((i) => i.category === 'works' && i.url.startsWith('/obras/'))).toBe(true);
  });
});

describe('centro de notificaciones', () => {
  it('lista, cuenta no leídas y marca como leídas solo las propias', async () => {
    const before = await S.notifications.unreadCount(deps, beto.id);
    expect(before).toBeGreaterThanOrEqual(1);
    const { items } = await S.notifications.inbox(deps, beto.id);
    expect(items[0]!.title).toBeTruthy();
    // Ana no puede marcar las de Beto
    await S.notifications.markRead(deps, ana.id, [items[0]!.id]);
    expect(await S.notifications.unreadCount(deps, beto.id)).toBe(before);
    await S.notifications.markRead(deps, beto.id, [items[0]!.id]);
    expect(await S.notifications.unreadCount(deps, beto.id)).toBe(before - 1);
    await S.notifications.markRead(deps, beto.id, 'all');
    expect(await S.notifications.unreadCount(deps, beto.id)).toBe(0);
  });
});

describe('entregas: dispositivos, webhooks, supresión y reintentos', () => {
  it('un dispositivo que ya no existe se borra y no cuenta como fallo', async () => {
    const carla = await h.onboardWriter({ name: 'Carla Gone' });
    await S.dispatchPending(deps, { limit: 200 });
    await S.notifications.subscribePush(deps, carla.id, { endpoint: 'https://push.test/gone-1', keys: { p256dh: 'k', auth: 'a' } });
    await newWorkWith(ana.id, carla.id, 'Canción del Adiós');
    const d = await deliveriesOf(carla.id, 'split_invitation');
    expect(d.map((x) => `${x.channel}:${x.status}`).sort()).toEqual(['email:sent', 'push:suppressed']);
    expect((await S.notifications.getPreferences(deps, carla.id)).push.devices).toHaveLength(0);
  });

  it('entregado → abierto; un rebote permanente suprime la dirección y el operador la libera', async () => {
    const [email] = (await deliveriesOf(beto.id, 'split_invitation')).filter((x) => x.channel === 'email');
    const at = new Date('2026-10-05T16:00:00Z');
    await S.notifications.applyEmailEvent(deps, { type: 'opened', messageId: email!.providerMessageId!, at });
    await S.notifications.applyEmailEvent(deps, { type: 'delivered', messageId: email!.providerMessageId!, at }); // llega tarde: no retrocede
    expect((await deliveriesOf(beto.id, 'split_invitation')).find((x) => x.channel === 'email')!.status).toBe('opened');

    await S.notifications.applyEmailEvent(deps, { type: 'bounced', messageId: email!.providerMessageId!, at, email: beto.email, permanent: true, detail: 'mailbox does not exist' });
    expect((await S.notifications.listSuppressions(deps, ops)).some((s) => s.email === beto.email)).toBe(true);
    await newWorkWith(ana.id, beto.id, 'Frevo Silencioso');
    const all = await deliveriesOf(beto.id, 'split_invitation');
    expect(all.filter((x) => x.channel === 'email' && x.status === 'suppressed')).toHaveLength(1);

    await expect(S.notifications.removeSuppression(deps, beto.id, beto.email, ctx)).rejects.toThrow('FORBIDDEN');
    await S.notifications.removeSuppression(deps, ops, beto.email, ctx);
    expect((await S.notifications.listSuppressions(deps, ops)).some((s) => s.email === beto.email)).toBe(false);
  });

  it('un envío fallido queda en el registro y el operador lo reenvía', async () => {
    const real = deps.mail;
    const broken: EmailSender = { send: async () => { throw new Error('proveedor caído'); } };
    deps.mail = broken;
    try {
      await newWorkWith(ana.id, beto.id, 'Tango Interrumpido');
    } finally {
      deps.mail = real;
    }
    const log = await S.notifications.deliveryLog(deps, ops, { status: 'failed', channel: 'email' });
    const row = log.find((r) => r.email === beto.email && r.template === 'split_invitation');
    expect(row?.error).toContain('proveedor caído');
    expect(await S.notifications.resendDelivery(deps, ops, row!.notification_id, 'email', ctx)).toBe(true);
    const after = (await deliveriesOf(beto.id, 'split_invitation')).find((x) => x.notificationId === row!.notification_id && x.channel === 'email')!;
    expect(after).toMatchObject({ status: 'sent', attempts: 2 });
    await expect(S.notifications.resendDelivery(deps, ops, row!.notification_id, 'email', ctx)).rejects.toThrow('DELIVERY_NOT_FAILED');
  });

  it('WhatsApp se da de baja', async () => {
    await S.notifications.setWhatsApp(deps, beto.id, { phone: null, consent: false }, ctx);
    expect((await S.notifications.getPreferences(deps, beto.id)).whatsapp.optedIn).toBe(false);
  });
});

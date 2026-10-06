/**
 * Worker de Pluma.
 * - Despacha el outbox de eventos (correos, sellos de tiempo) cada pocos segundos.
 * - Tareas programadas con pg-boss sobre el mismo Postgres: recordatorios y vencimientos de firmas,
 *   avisos de renovación y suspensiones de membresía, verificación de la cadena de auditoría,
 *   reintentos de correos fallidos.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PgBoss } from 'pg-boss';

const rootEnv = resolve(import.meta.dirname, '../../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const { closeRuntime, depsFromEnv, dispatchPending, network, retryFailedDeliveries, runDailyJobs, statements } = await import('@pluma/services');

const deps = depsFromEnv();
const log = (msg: string, extra?: unknown) => console.log(JSON.stringify({ at: new Date().toISOString(), msg, ...(extra ? { extra } : {}) }));

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: 'pgboss' });
boss.on('error', (e) => log('pgboss.error', String(e)));
await boss.start();

const JOBS = {
  daily: 'daily-jobs',
  retry: 'retry-deliveries',
  scheduled: 'publish-scheduled-statements',
  network: 'network-timers',
} as const;

for (const q of Object.values(JOBS)) await boss.createQueue(q);
// 06:10 en Bogotá / Ciudad de México ≈ 11:10 UTC.
await boss.schedule(JOBS.daily, process.env.PLUMA_DAILY_CRON ?? '10 11 * * *');
await boss.schedule(JOBS.retry, '7 * * * *');
await boss.schedule(JOBS.scheduled, '* * * * *');
// Red: recordatorio a las 72 h y vencimientos (cada 15 min).
await boss.schedule(JOBS.network, '*/15 * * * *');

await boss.work(JOBS.daily, async () => {
  const r = await runDailyJobs(deps);
  log('daily-jobs', r);
});
await boss.work(JOBS.retry, async () => {
  log('retry-deliveries', await retryFailedDeliveries(deps));
});

await boss.work(JOBS.network, async () => {
  const r = await network.runNetworkTimers(deps);
  if (r.reminded || r.expired || r.requestsExpired) log('network.timers', r);
});

await boss.work(JOBS.scheduled, async () => {
  const n = await statements.publishDueRuns(deps);
  if (n) log('statements.published', { runs: n });
});

// Outbox: cada 5 s (FOR UPDATE SKIP LOCKED permite varios workers en paralelo).
let busy = false;
const tick = async () => {
  if (busy) return;
  busy = true;
  try {
    const r = await dispatchPending(deps, { limit: 100 });
    if (r.events) log('outbox', r);
  } catch (e) {
    log('outbox.error', String(e));
  } finally {
    busy = false;
  }
};
const timer = setInterval(tick, Number(process.env.PLUMA_OUTBOX_INTERVAL_MS ?? 5000));
log('worker.started');

const stop = async () => {
  clearInterval(timer);
  await boss.stop({ graceful: true });
  await closeRuntime();
  log('worker.stopped');
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);

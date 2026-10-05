import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as relations from './relations';
import * as schema from './schema';

const fullSchema = { ...schema, ...relations };
export type Db = PostgresJsDatabase<typeof fullSchema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

/** `prepare: false` para funcionar detrás del pooler de Supabase en modo transacción. */
export function createDb(url: string, opts: { max?: number } = {}): DbHandle {
  const client = postgres(url, { max: opts.max ?? 10, prepare: false, onnotice: () => {} });
  return { db: drizzle(client, { schema: fullSchema }), close: () => client.end() };
}

/**
 * Lectura en nombre de un usuario: rol `authenticated` + claims, de modo que RLS filtra todo.
 * Es el único camino de lectura para pantallas del autor.
 */
export async function withUser<T>(db: Db, userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated' })}, true), set_config('role', 'authenticated', true)`);
    return fn(tx);
  });
}

export interface ActorContext {
  /** null = proceso del sistema (worker, webhook). */
  actorId: string | null;
  actorRole: 'writer' | 'guest' | 'operator' | 'approver' | 'super_admin' | 'system' | 'ar_guest' | 'sync_buyer';
  /** Comando de negocio, p. ej. 'split.sign'. Queda en cada fila de auditoría de la transacción. */
  command: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Escritura de negocio: conexión privilegiada con el contexto del actor fijado para la auditoría.
 * Las reglas de negocio se validan en los servicios antes de escribir.
 */
export async function withSystem<T>(db: Db, ctx: ActorContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select
      set_config('pluma.actor_id', ${ctx.actorId ?? ''}, true),
      set_config('pluma.actor_role', ${ctx.actorRole}, true),
      set_config('pluma.command', ${ctx.command}, true),
      set_config('pluma.ip', ${ctx.ip ?? ''}, true),
      set_config('pluma.user_agent', ${(ctx.userAgent ?? '').slice(0, 400)}, true)`);
    return fn(tx);
  });
}

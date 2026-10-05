import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq, t, withSystem } from '@pluma/db';
import type { Deps } from './deps';
import type { AppLocale } from './format';
import { sha256 } from './crypto';

const LEGAL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'legal');
export const ADMIN_AGREEMENT_VERSION = 'v0.1';

export async function readAdminAgreement(locale: AppLocale) {
  const body = await readFile(join(LEGAL_DIR, `admin-agreement.${locale}.md`), 'utf8');
  return { version: ADMIN_AGREEMENT_VERSION, body, sha256: sha256(body) };
}

/**
 * Devuelve el documento vigente registrado en `legal_documents`, registrándolo si es la primera vez.
 * El hash es el del texto exacto que ve y firma la persona.
 */
export async function currentAdminAgreement(deps: Deps, locale: AppLocale) {
  const doc = await readAdminAgreement(locale);
  const where = and(eq(t.legalDocuments.kind, 'admin_agreement'), eq(t.legalDocuments.version, doc.version), eq(t.legalDocuments.locale, locale));
  let [row] = await deps.db.select().from(t.legalDocuments).where(where);
  if (!row) {
    await withSystem(deps.db, { actorId: null, actorRole: 'system', command: 'legal.register' }, (tx) =>
      tx
        .insert(t.legalDocuments)
        .values({ kind: 'admin_agreement', version: doc.version, locale, storagePath: `repo:legal/admin-agreement.${locale}.md`, sha256: doc.sha256, effectiveFrom: '2026-10-01' })
        .onConflictDoNothing(),
    );
    [row] = await deps.db.select().from(t.legalDocuments).where(where);
  }
  if (row!.sha256 !== doc.sha256) throw new Error(`El texto del contrato ${doc.version}/${locale} cambió sin cambiar de versión`);
  return { ...row!, body: doc.body };
}

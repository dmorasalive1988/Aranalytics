import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@pluma/i18n';
import { TEMPLATE_NAMES } from '@pluma/emails';
import { ADMIN_AGREEMENT_TEXTS } from '../src/legal-texts';

/**
 * Los acuerdos de Pluma con administradores o sociedades son privados: ningún texto visible para
 * autores, coautores o el personal debe nombrar a un proveedor concreto.
 */
const FORBIDDEN = /warner|chappell/i;

describe('sin nombres de proveedores en textos visibles', () => {
  it('mensajes de la app', () => {
    for (const l of ['es', 'en', 'pt-BR'] as const) expect(JSON.stringify(MESSAGES[l])).not.toMatch(FORBIDDEN);
  });
  it('contrato de administración', () => {
    for (const text of Object.values(ADMIN_AGREEMENT_TEXTS)) expect(text).not.toMatch(FORBIDDEN);
  });
  it('plantillas de correo y back-office', () => {
    expect(TEMPLATE_NAMES.length).toBeGreaterThan(0);
    const root = join(__dirname, '../../..');
    for (const f of ['packages/emails/src/templates.ts', 'apps/admin/lib/actions.ts', 'apps/admin/app/(staff)/layout.tsx', 'apps/admin/app/(staff)/page.tsx']) {
      expect(readFileSync(join(root, f), 'utf8'), f).not.toMatch(FORBIDDEN);
    }
  });
});

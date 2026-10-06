import { describe, expect, it } from 'vitest';
import { renderEmail } from '../src';

describe('correos', () => {
  const data = { inviterName: 'Ana <script>', workTitle: 'Luna', share: '25 %', role: 'lyricist', signUrl: 'https://firma.pluma.mu/t/abc', expiresOn: '19/10/2026', isMember: false };
  it('se renderizan en los tres idiomas con texto nativo', () => {
    expect(renderEmail('split_invitation', 'es', data).subject).toContain('te invita a firmar');
    expect(renderEmail('split_invitation', 'en', data).subject).toContain('invited you to sign');
    expect(renderEmail('split_invitation', 'pt-BR', data).subject).toContain('convidou você');
    expect(renderEmail('split_invitation', 'pt-BR', data).html).toContain('letra');
  });
  it('escapa el contenido del usuario y trae versión de texto', () => {
    const r = renderEmail('split_invitation', 'es', data);
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('Ana &lt;script&gt;');
    expect(r.text).toContain('https://firma.pluma.mu/t/abc');
  });
});

import { TEMPLATE_CATEGORY, TEMPLATE_NAMES, renderPush, whatsappTemplate } from '../src';
describe('canales', () => {
  it('cada plantilla tiene categoría', () => {
    for (const n of TEMPLATE_NAMES) expect(TEMPLATE_CATEGORY[n], n).toBeTruthy();
  });
  it('push corto con enlace', () => {
    const p = renderPush('statement_published', 'en', { period: '2026-Q2', net: 'USD 1,284.50', topWork: 'Luna', highlights: '', statementUrl: 'https://app.pluma.mu/pagos/x' });
    expect(p).toEqual({ title: 'Official statement 2026-Q2', body: 'Your 2026-Q2 statement is ready: USD 1,284.50', url: 'https://app.pluma.mu/pagos/x' });
  });
  it('WhatsApp solo con plantillas aprobadas y nunca a invitados', () => {
    expect(whatsappTemplate('statement_published', 'pt-BR', { period: '2026-Q2', net: 'USD 10', topWork: '', highlights: '', statementUrl: '' })).toEqual({ template: 'pluma_statement_published', language: 'pt_BR', params: ['2026-Q2', 'USD 10'] });
    expect(whatsappTemplate('split_invitation', 'es', { inviterName: 'A', workTitle: 'B', share: '', role: '', signUrl: '', expiresOn: '', isMember: false })).toBeNull();
    expect(whatsappTemplate('work_conflict', 'es', { workTitle: 'x', workUrl: '' })).toBeNull();
  });
});

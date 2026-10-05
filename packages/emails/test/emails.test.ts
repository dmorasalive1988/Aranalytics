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

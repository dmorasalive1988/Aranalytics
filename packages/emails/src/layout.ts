export type Locale = 'es' | 'en' | 'pt-BR';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const C = { tinta: '#0E1020', noche: '#1B1E33', papel: '#F4EFE6', ambar: '#F2A541', texto2: '#55536A', borde: '#E6E0D4' };

const FOOTER: Record<Locale, string> = {
  es: 'Pluma · Donde nacen las canciones. Recibes este correo porque tienes una obra o una cuenta en Pluma.',
  en: 'Pluma · Where songs are born. You’re receiving this because you have a song or an account on Pluma.',
  'pt-BR': 'Pluma · Onde nascem as canções. Você recebe este e-mail porque tem uma obra ou uma conta na Pluma.',
};

export interface Block {
  kind: 'p' | 'big' | 'button' | 'note' | 'facts' | 'code';
  text?: string;
  href?: string;
  facts?: [string, string][];
}

/**
 * Plantilla base: banda Tinta con el wordmark, cuerpo blanco sobre Papel, botón primario Ámbar con texto Tinta.
 * Todo en estilos en línea (compatibilidad con clientes de correo).
 */
export function renderLayout(locale: Locale, title: string, blocks: Block[]): { html: string; text: string } {
  const body = blocks
    .map((b) => {
      switch (b.kind) {
        case 'p':
          return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${C.tinta}">${esc(b.text)}</p>`;
        case 'big':
          return `<p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:-0.02em;color:${C.tinta};font-variant-numeric:tabular-nums">${esc(b.text)}</p>`;
        case 'code':
          return `<p style="margin:8px 0 20px;font-size:34px;font-weight:700;letter-spacing:0.18em;color:${C.tinta};font-variant-numeric:tabular-nums">${esc(b.text)}</p>`;
        case 'note':
          return `<p style="margin:0 0 12px;font-size:13px;line-height:1.5;color:${C.texto2}">${esc(b.text)}</p>`;
        case 'button':
          return `<p style="margin:24px 0"><a href="${esc(b.href)}" style="display:inline-block;background:${C.ambar};color:${C.tinta};font-weight:700;font-size:15px;text-decoration:none;padding:16px 24px;border-radius:14px">${esc(b.text)}</a></p>`;
        case 'facts':
          return `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 20px">${(b.facts ?? [])
            .map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid ${C.borde};font-size:14px;color:${C.texto2}">${esc(k)}</td><td style="padding:10px 0;border-bottom:1px solid ${C.borde};font-size:14px;font-weight:700;text-align:right;color:${C.tinta}">${esc(v)}</td></tr>`)
            .join('')}</table>`;
      }
    })
    .join('\n');

  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:${C.papel};font-family:'DM Sans',Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" style="background:${C.papel};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;border-collapse:collapse">
<tr><td style="background:${C.tinta};border-radius:20px 20px 0 0;padding:22px 28px">
<span style="font-family:'Bricolage Grotesque',Helvetica,Arial,sans-serif;font-weight:800;font-size:26px;letter-spacing:-0.04em;color:${C.papel}">pluma</span>
</td></tr>
<tr><td style="background:#FFFFFF;border-radius:0 0 20px 20px;padding:28px">
<h1 style="margin:0 0 18px;font-family:'Bricolage Grotesque',Helvetica,Arial,sans-serif;font-size:24px;line-height:1.2;color:${C.tinta}">${esc(title)}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 8px;font-size:12px;line-height:1.5;color:${C.texto2}">${esc(FOOTER[locale])}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    title,
    '',
    ...blocks.map((b) =>
      b.kind === 'button' ? `${b.text}: ${b.href}` : b.kind === 'facts' ? (b.facts ?? []).map(([k, v]) => `${k}: ${v}`).join('\n') : (b.text ?? ''),
    ),
    '',
    FOOTER[locale],
  ].join('\n');
  return { html, text };
}

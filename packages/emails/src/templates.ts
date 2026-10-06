import { renderLayout, type Block, type Locale } from './layout';

type L<T> = Record<Locale, T>;

const ROLE: L<Record<string, string>> = {
  es: { composer: 'música', lyricist: 'letra', composer_lyricist: 'música y letra', arranger: 'arreglo', translator: 'traducción' },
  en: { composer: 'music', lyricist: 'lyrics', composer_lyricist: 'music & lyrics', arranger: 'arrangement', translator: 'translation' },
  'pt-BR': { composer: 'música', lyricist: 'letra', composer_lyricist: 'música e letra', arranger: 'arranjo', translator: 'tradução' },
};

const STATUS: L<Record<string, string>> = {
  es: { sent_to_publisher: 'Enviada a registro', registered: 'Registrada', disputed: 'En disputa' },
  en: { sent_to_publisher: 'Sent for registration', registered: 'Registered', disputed: 'In dispute' },
  'pt-BR': { sent_to_publisher: 'Enviada para registro', registered: 'Registrada', disputed: 'Em disputa' },
};

export interface TemplateData {
  split_invitation: { inviterName: string; workTitle: string; share: string; role: string; signUrl: string; expiresOn: string; isMember: boolean };
  split_reminder: { inviterName: string; workTitle: string; share: string; signUrl: string; expiresOn: string };
  split_signed: { signerName: string; workTitle: string; signed: number; total: number; workUrl: string };
  split_completed: { workTitle: string; workUrl: string };
  split_rejected: { signerName: string; workTitle: string; reason: string; workUrl: string };
  signature_code: { code: string; workTitle: string };
  guardian_code: { code: string; minorName: string };
  work_status: { workTitle: string; status: string; workUrl: string };
  work_conflict: { workTitle: string; workUrl: string };
  membership_activated: { plan: string; amount: string; commission: string; renewsOn: string; appUrl: string };
  renewal_upcoming: { plan: string; amount: string; renewsOn: string; manageUrl: string };
  payment_failed: { plan: string; graceEndsOn: string; manageUrl: string };
  membership_suspended: { manageUrl: string };
  statement_published: { period: string; net: string; topWork: string; highlights: string; statementUrl: string };
  statement_published_zero: { period: string; statementUrl: string };
  payout_sent: { amount: string; method: string; paymentsUrl: string };
}
export type TemplateName = keyof TemplateData;

type Builder<K extends TemplateName> = (d: TemplateData[K]) => { subject: string; title: string; blocks: Block[] };

const T: { [K in TemplateName]: L<Builder<K>> } = {
  split_invitation: {
    es: (d) => ({
      subject: `${d.inviterName} te invita a firmar el split de “${d.workTitle}”`,
      title: `Firma tu parte de “${d.workTitle}”`,
      blocks: [
        { kind: 'p', text: `${d.inviterName} registró “${d.workTitle}” en Pluma y te incluyó como coautor.` },
        { kind: 'facts', facts: [['Tu porcentaje', d.share], ['Tu rol', ROLE.es[d.role] ?? d.role]] },
        { kind: 'p', text: 'Revisa el reparto completo antes de firmar. Si algo no está bien, puedes reclamar: nadie cobra hasta que se resuelva.' },
        { kind: 'button', text: 'Revisar y firmar', href: d.signUrl },
        { kind: 'note', text: d.isMember ? 'Entra con tu cuenta de Pluma para firmar.' : `No necesitas una cuenta ni pagar nada para firmar. El enlace vence el ${d.expiresOn}.` },
      ],
    }),
    en: (d) => ({
      subject: `${d.inviterName} invited you to sign the split for “${d.workTitle}”`,
      title: `Sign your share of “${d.workTitle}”`,
      blocks: [
        { kind: 'p', text: `${d.inviterName} registered “${d.workTitle}” on Pluma and listed you as a co-writer.` },
        { kind: 'facts', facts: [['Your share', d.share], ['Your role', ROLE.en[d.role] ?? d.role]] },
        { kind: 'p', text: 'Check the full split before you sign. If something’s off, you can dispute it — nobody gets paid until it’s settled.' },
        { kind: 'button', text: 'Review and sign', href: d.signUrl },
        { kind: 'note', text: d.isMember ? 'Log in to your Pluma account to sign.' : `You don’t need an account or to pay anything to sign. The link expires on ${d.expiresOn}.` },
      ],
    }),
    'pt-BR': (d) => ({
      subject: `${d.inviterName} convidou você a assinar o split de “${d.workTitle}”`,
      title: `Assine a sua parte de “${d.workTitle}”`,
      blocks: [
        { kind: 'p', text: `${d.inviterName} registrou “${d.workTitle}” na Pluma e incluiu você como coautor.` },
        { kind: 'facts', facts: [['Sua porcentagem', d.share], ['Sua função', ROLE['pt-BR'][d.role] ?? d.role]] },
        { kind: 'p', text: 'Confira a divisão completa antes de assinar. Se algo estiver errado, você pode contestar: ninguém recebe até resolver.' },
        { kind: 'button', text: 'Revisar e assinar', href: d.signUrl },
        { kind: 'note', text: d.isMember ? 'Entre na sua conta da Pluma para assinar.' : `Você não precisa de conta nem pagar nada para assinar. O link vence em ${d.expiresOn}.` },
      ],
    }),
  },
  split_reminder: {
    es: (d) => ({ subject: `Falta tu firma en “${d.workTitle}”`, title: `Falta tu firma en “${d.workTitle}”`, blocks: [
      { kind: 'p', text: `${d.inviterName} sigue esperando tu firma. Tu parte: ${d.share}.` },
      { kind: 'button', text: 'Revisar y firmar', href: d.signUrl },
      { kind: 'note', text: `El enlace vence el ${d.expiresOn}. Si no firmas ni reclamas, la obra pasa a revisión.` }] }),
    en: (d) => ({ subject: `Your signature is still missing on “${d.workTitle}”`, title: `We still need your signature on “${d.workTitle}”`, blocks: [
      { kind: 'p', text: `${d.inviterName} is still waiting for your signature. Your share: ${d.share}.` },
      { kind: 'button', text: 'Review and sign', href: d.signUrl },
      { kind: 'note', text: `The link expires on ${d.expiresOn}. If you don’t sign or dispute, the song goes to review.` }] }),
    'pt-BR': (d) => ({ subject: `Falta a sua assinatura em “${d.workTitle}”`, title: `Falta a sua assinatura em “${d.workTitle}”`, blocks: [
      { kind: 'p', text: `${d.inviterName} ainda está esperando a sua assinatura. Sua parte: ${d.share}.` },
      { kind: 'button', text: 'Revisar e assinar', href: d.signUrl },
      { kind: 'note', text: `O link vence em ${d.expiresOn}. Se você não assinar nem contestar, a obra vai para revisão.` }] }),
  },
  split_signed: {
    es: (d) => ({ subject: `${d.signerName} firmó “${d.workTitle}”`, title: `${d.signerName} ya firmó`, blocks: [
      { kind: 'p', text: `Van ${d.signed} de ${d.total} firmas en “${d.workTitle}”.` }, { kind: 'button', text: 'Ver la obra', href: d.workUrl }] }),
    en: (d) => ({ subject: `${d.signerName} signed “${d.workTitle}”`, title: `${d.signerName} signed`, blocks: [
      { kind: 'p', text: `${d.signed} of ${d.total} signatures are in for “${d.workTitle}”.` }, { kind: 'button', text: 'View song', href: d.workUrl }] }),
    'pt-BR': (d) => ({ subject: `${d.signerName} assinou “${d.workTitle}”`, title: `${d.signerName} já assinou`, blocks: [
      { kind: 'p', text: `Já são ${d.signed} de ${d.total} assinaturas em “${d.workTitle}”.` }, { kind: 'button', text: 'Ver a obra', href: d.workUrl }] }),
  },
  split_completed: {
    es: (d) => ({ subject: `Splits firmados: “${d.workTitle}”`, title: 'Todos firmaron', blocks: [
      { kind: 'p', text: `El reparto de “${d.workTitle}” quedó firmado por todos. Ahora la enviamos a registro ante las sociedades de gestión.` }, { kind: 'button', text: 'Ver la obra', href: d.workUrl }] }),
    en: (d) => ({ subject: `Split signed: “${d.workTitle}”`, title: 'Everyone signed', blocks: [
      { kind: 'p', text: `Everyone has signed the split for “${d.workTitle}”. Next, we send it for registration with the collecting societies.` }, { kind: 'button', text: 'View song', href: d.workUrl }] }),
    'pt-BR': (d) => ({ subject: `Split assinado: “${d.workTitle}”`, title: 'Todos assinaram', blocks: [
      { kind: 'p', text: `A divisão de “${d.workTitle}” foi assinada por todos. Agora enviamos para registro nas associações de gestão.` }, { kind: 'button', text: 'Ver a obra', href: d.workUrl }] }),
  },
  split_rejected: {
    es: (d) => ({ subject: `Reclamo en “${d.workTitle}”`, title: `${d.signerName} no está de acuerdo con el split`, blocks: [
      { kind: 'p', text: `Motivo: ${d.reason}` }, { kind: 'p', text: 'La obra pasó a “En disputa” y sus regalías quedan retenidas hasta resolverlo. Nuestro equipo te contactará.' }, { kind: 'button', text: 'Ver la obra', href: d.workUrl }] }),
    en: (d) => ({ subject: `Dispute on “${d.workTitle}”`, title: `${d.signerName} disagrees with the split`, blocks: [
      { kind: 'p', text: `Reason: ${d.reason}` }, { kind: 'p', text: 'The song is now “In dispute” and its royalties are on hold until it’s resolved. Our team will reach out.' }, { kind: 'button', text: 'View song', href: d.workUrl }] }),
    'pt-BR': (d) => ({ subject: `Contestação em “${d.workTitle}”`, title: `${d.signerName} não concorda com o split`, blocks: [
      { kind: 'p', text: `Motivo: ${d.reason}` }, { kind: 'p', text: 'A obra passou para “Em disputa” e os royalties ficam retidos até resolver. Nossa equipe vai entrar em contato.' }, { kind: 'button', text: 'Ver a obra', href: d.workUrl }] }),
  },
  signature_code: {
    es: (d) => ({ subject: `Tu código para firmar: ${d.code}`, title: 'Tu código para firmar', blocks: [
      { kind: 'p', text: `Úsalo para firmar el split de “${d.workTitle}”.` }, { kind: 'code', text: d.code }, { kind: 'note', text: 'Vence en 15 minutos. Si no lo pediste, ignora este correo.' }] }),
    en: (d) => ({ subject: `Your signing code: ${d.code}`, title: 'Your signing code', blocks: [
      { kind: 'p', text: `Use it to sign the split for “${d.workTitle}”.` }, { kind: 'code', text: d.code }, { kind: 'note', text: 'It expires in 15 minutes. If you didn’t ask for it, ignore this email.' }] }),
    'pt-BR': (d) => ({ subject: `Seu código para assinar: ${d.code}`, title: 'Seu código para assinar', blocks: [
      { kind: 'p', text: `Use para assinar o split de “${d.workTitle}”.` }, { kind: 'code', text: d.code }, { kind: 'note', text: 'Vence em 15 minutos. Se você não pediu, ignore este e-mail.' }] }),
  },
  guardian_code: {
    es: (d) => ({ subject: `Autoriza el contrato de ${d.minorName} en Pluma`, title: 'Firma como tutor legal', blocks: [
      { kind: 'p', text: `${d.minorName} es menor de edad y te registró como su tutor legal. Para activar su cuenta, comparte este código con ${d.minorName} solo si estás de acuerdo con el contrato de administración.` },
      { kind: 'code', text: d.code }, { kind: 'note', text: 'Vence en 15 minutos. Al usarlo, firmas el contrato en nombre de quien representas.' }] }),
    en: (d) => ({ subject: `Approve ${d.minorName}’s Pluma agreement`, title: 'Sign as legal guardian', blocks: [
      { kind: 'p', text: `${d.minorName} is a minor and listed you as their legal guardian. Share this code with ${d.minorName} only if you agree to the administration agreement.` },
      { kind: 'code', text: d.code }, { kind: 'note', text: 'It expires in 15 minutes. Using it signs the agreement on behalf of the minor you represent.' }] }),
    'pt-BR': (d) => ({ subject: `Autorize o contrato de ${d.minorName} na Pluma`, title: 'Assine como responsável legal', blocks: [
      { kind: 'p', text: `${d.minorName} é menor de idade e indicou você como responsável legal. Compartilhe este código com ${d.minorName} só se você concordar com o contrato de administração.` },
      { kind: 'code', text: d.code }, { kind: 'note', text: 'Vence em 15 minutos. Ao usá-lo, você assina o contrato em nome de quem representa.' }] }),
  },
  work_status: {
    es: (d) => ({ subject: `“${d.workTitle}”: ${STATUS.es[d.status] ?? d.status}`, title: STATUS.es[d.status] ?? d.status, blocks: [
      { kind: 'p', text: `Tu obra “${d.workTitle}” cambió de estado: ${STATUS.es[d.status] ?? d.status}.` }, { kind: 'button', text: 'Ver la obra', href: d.workUrl }] }),
    en: (d) => ({ subject: `“${d.workTitle}”: ${STATUS.en[d.status] ?? d.status}`, title: STATUS.en[d.status] ?? d.status, blocks: [
      { kind: 'p', text: `Your song “${d.workTitle}” has a new status: ${STATUS.en[d.status] ?? d.status}.` }, { kind: 'button', text: 'View song', href: d.workUrl }] }),
    'pt-BR': (d) => ({ subject: `“${d.workTitle}”: ${STATUS['pt-BR'][d.status] ?? d.status}`, title: STATUS['pt-BR'][d.status] ?? d.status, blocks: [
      { kind: 'p', text: `Sua obra “${d.workTitle}” mudou de status: ${STATUS['pt-BR'][d.status] ?? d.status}.` }, { kind: 'button', text: 'Ver a obra', href: d.workUrl }] }),
  },
  work_conflict: {
    es: (d) => ({ subject: `Revisamos un posible conflicto en “${d.workTitle}”`, title: 'Posible conflicto de registro', blocks: [
      { kind: 'p', text: `Encontramos otra obra con título o grabación muy parecidos a “${d.workTitle}”. Nuestro equipo lo está revisando; no tienes que hacer nada por ahora.` }, { kind: 'button', text: 'Ver la obra', href: d.workUrl }] }),
    en: (d) => ({ subject: `We’re reviewing a possible conflict on “${d.workTitle}”`, title: 'Possible registration conflict', blocks: [
      { kind: 'p', text: `We found another song with a title or recording very close to “${d.workTitle}”. Our team is reviewing it; you don’t need to do anything yet.` }, { kind: 'button', text: 'View song', href: d.workUrl }] }),
    'pt-BR': (d) => ({ subject: `Estamos revisando um possível conflito em “${d.workTitle}”`, title: 'Possível conflito de registro', blocks: [
      { kind: 'p', text: `Encontramos outra obra com título ou gravação muito parecidos com “${d.workTitle}”. Nossa equipe está revisando; você não precisa fazer nada por enquanto.` }, { kind: 'button', text: 'Ver a obra', href: d.workUrl }] }),
  },
  membership_activated: {
    es: (d) => ({ subject: `Bienvenido a Pluma ${d.plan}`, title: `Ya eres ${d.plan}`, blocks: [
      { kind: 'facts', facts: [['Pagaste', d.amount], ['Comisión de administración', d.commission], ['Se renueva el', d.renewsOn]] },
      { kind: 'p', text: 'Tus obras siguen siendo 100 % tuyas. Te avisamos 15 días antes de renovar.' }, { kind: 'button', text: 'Registrar mi primera obra', href: d.appUrl }] }),
    en: (d) => ({ subject: `Welcome to Pluma ${d.plan}`, title: `You’re on ${d.plan}`, blocks: [
      { kind: 'facts', facts: [['You paid', d.amount], ['Administration fee', d.commission], ['Renews on', d.renewsOn]] },
      { kind: 'p', text: 'You keep 100% ownership of your songs. We’ll remind you 15 days before renewal.' }, { kind: 'button', text: 'Register my first song', href: d.appUrl }] }),
    'pt-BR': (d) => ({ subject: `Bem-vindo à Pluma ${d.plan}`, title: `Você agora é ${d.plan}`, blocks: [
      { kind: 'facts', facts: [['Você pagou', d.amount], ['Comissão de administração', d.commission], ['Renova em', d.renewsOn]] },
      { kind: 'p', text: 'Suas obras continuam 100% suas. Avisamos 15 dias antes da renovação.' }, { kind: 'button', text: 'Registrar minha primeira obra', href: d.appUrl }] }),
  },
  renewal_upcoming: {
    es: (d) => ({ subject: `Tu plan ${d.plan} se renueva el ${d.renewsOn}`, title: 'Tu membresía se renueva pronto', blocks: [
      { kind: 'facts', facts: [['Plan', d.plan], ['Monto', d.amount], ['Fecha', d.renewsOn]] }, { kind: 'button', text: 'Administrar mi plan', href: d.manageUrl }] }),
    en: (d) => ({ subject: `Your ${d.plan} plan renews on ${d.renewsOn}`, title: 'Your membership renews soon', blocks: [
      { kind: 'facts', facts: [['Plan', d.plan], ['Amount', d.amount], ['Date', d.renewsOn]] }, { kind: 'button', text: 'Manage my plan', href: d.manageUrl }] }),
    'pt-BR': (d) => ({ subject: `Seu plano ${d.plan} renova em ${d.renewsOn}`, title: 'Sua assinatura renova em breve', blocks: [
      { kind: 'facts', facts: [['Plano', d.plan], ['Valor', d.amount], ['Data', d.renewsOn]] }, { kind: 'button', text: 'Gerenciar meu plano', href: d.manageUrl }] }),
  },
  payment_failed: {
    es: (d) => ({ subject: 'No pudimos cobrar tu membresía', title: 'Tu pago no pasó', blocks: [
      { kind: 'p', text: `Actualiza tu tarjeta antes del ${d.graceEndsOn}. Tus regalías siguen llegando; si no se renueva, se pausan la Red y tus catálogos.` }, { kind: 'button', text: 'Actualizar pago', href: d.manageUrl }] }),
    en: (d) => ({ subject: 'We couldn’t charge your membership', title: 'Your payment didn’t go through', blocks: [
      { kind: 'p', text: `Update your card before ${d.graceEndsOn}. Your royalties keep coming; if it doesn’t renew, the Network and your catalogs are paused.` }, { kind: 'button', text: 'Update payment', href: d.manageUrl }] }),
    'pt-BR': (d) => ({ subject: 'Não conseguimos cobrar sua assinatura', title: 'Seu pagamento não passou', blocks: [
      { kind: 'p', text: `Atualize seu cartão antes de ${d.graceEndsOn}. Seus royalties continuam chegando; se não renovar, a Rede e seus catálogos ficam pausados.` }, { kind: 'button', text: 'Atualizar pagamento', href: d.manageUrl }] }),
  },
  membership_suspended: {
    es: (d) => ({ subject: 'Tu membresía está en pausa', title: 'Pausamos la Red y tus catálogos', blocks: [
      { kind: 'p', text: 'Seguimos administrando tus obras registradas y pagándote regalías según tu contrato. Renueva para volver a la Red y reactivar sync y A&R.' }, { kind: 'button', text: 'Renovar', href: d.manageUrl }] }),
    en: (d) => ({ subject: 'Your membership is paused', title: 'Network and catalogs paused', blocks: [
      { kind: 'p', text: 'We keep administering your registered songs and paying your royalties under your agreement. Renew to get back on the Network and turn sync and A&R back on.' }, { kind: 'button', text: 'Renew', href: d.manageUrl }] }),
    'pt-BR': (d) => ({ subject: 'Sua assinatura está pausada', title: 'Pausamos a Rede e seus catálogos', blocks: [
      { kind: 'p', text: 'Continuamos administrando suas obras registradas e pagando seus royalties conforme o contrato. Renove para voltar à Rede e reativar sync e A&R.' }, { kind: 'button', text: 'Renovar', href: d.manageUrl }] }),
  },
  statement_published: {
    es: (d) => ({ subject: `Tu statement ${d.period} ya está disponible: ${d.net}`, title: `Statement oficial ${d.period}`, blocks: [
      { kind: 'big', text: d.net },
      { kind: 'facts', facts: [['Neto del período', d.net], ['Obra con más ingresos', d.topWork]] },
      { kind: 'p', text: d.highlights },
      { kind: 'button', text: 'Ver mi statement', href: d.statementUrl },
      { kind: 'note', text: 'Es tu statement oficial: los montos ya descuentan la comisión de administración y las retenciones que apliquen.' }] }),
    en: (d) => ({ subject: `Your ${d.period} statement is ready: ${d.net}`, title: `Official statement ${d.period}`, blocks: [
      { kind: 'big', text: d.net },
      { kind: 'facts', facts: [['Net for the period', d.net], ['Top-earning song', d.topWork]] },
      { kind: 'p', text: d.highlights },
      { kind: 'button', text: 'View my statement', href: d.statementUrl },
      { kind: 'note', text: 'This is your official statement: amounts are after the administration fee and any applicable withholding.' }] }),
    'pt-BR': (d) => ({ subject: `Seu statement ${d.period} já está disponível: ${d.net}`, title: `Statement oficial ${d.period}`, blocks: [
      { kind: 'big', text: d.net },
      { kind: 'facts', facts: [['Líquido do período', d.net], ['Obra que mais rendeu', d.topWork]] },
      { kind: 'p', text: d.highlights },
      { kind: 'button', text: 'Ver meu statement', href: d.statementUrl },
      { kind: 'note', text: 'Este é seu statement oficial: os valores já descontam a comissão de administração e as retenções que se aplicam.' }] }),
  },
  statement_published_zero: {
    es: (d) => ({ subject: `Tu statement ${d.period} está listo`, title: `Statement oficial ${d.period}`, blocks: [
      { kind: 'p', text: 'Este período tus obras no registraron regalías. Es normal: las sociedades y plataformas reportan con meses de diferencia.' },
      { kind: 'p', text: 'Mientras tanto, revisa que tus obras estén completas y registradas: así no se pierde ningún pago.' },
      { kind: 'button', text: 'Ver mi statement', href: d.statementUrl }] }),
    en: (d) => ({ subject: `Your ${d.period} statement is ready`, title: `Official statement ${d.period}`, blocks: [
      { kind: 'p', text: 'Your songs didn’t report royalties this period. That’s normal: societies and platforms report months apart.' },
      { kind: 'p', text: 'In the meantime, make sure your songs are complete and registered so no payment slips through.' },
      { kind: 'button', text: 'View my statement', href: d.statementUrl }] }),
    'pt-BR': (d) => ({ subject: `Seu statement ${d.period} está pronto`, title: `Statement oficial ${d.period}`, blocks: [
      { kind: 'p', text: 'Neste período suas obras não registraram royalties. É normal: associações e plataformas reportam com meses de diferença.' },
      { kind: 'p', text: 'Enquanto isso, confira se suas obras estão completas e registradas para não perder nenhum pagamento.' },
      { kind: 'button', text: 'Ver meu statement', href: d.statementUrl }] }),
  },
  payout_sent: {
    es: (d) => ({ subject: `Enviamos tu pago de ${d.amount}`, title: 'Tu pago va en camino', blocks: [
      { kind: 'facts', facts: [['Monto', d.amount], ['Método', d.method]] }, { kind: 'p', text: 'Según tu banco, puede tardar de 1 a 3 días hábiles en reflejarse.' }, { kind: 'button', text: 'Ver mis pagos', href: d.paymentsUrl }] }),
    en: (d) => ({ subject: `We sent your ${d.amount} payment`, title: 'Your payment is on its way', blocks: [
      { kind: 'facts', facts: [['Amount', d.amount], ['Method', d.method]] }, { kind: 'p', text: 'Depending on your bank, it can take 1 to 3 business days to show up.' }, { kind: 'button', text: 'View my payments', href: d.paymentsUrl }] }),
    'pt-BR': (d) => ({ subject: `Enviamos seu pagamento de ${d.amount}`, title: 'Seu pagamento está a caminho', blocks: [
      { kind: 'facts', facts: [['Valor', d.amount], ['Método', d.method]] }, { kind: 'p', text: 'Dependendo do seu banco, pode levar de 1 a 3 dias úteis para aparecer.' }, { kind: 'button', text: 'Ver meus pagamentos', href: d.paymentsUrl }] }),
  },
};

export function renderEmail<K extends TemplateName>(name: K, locale: Locale, data: TemplateData[K]) {
  const built = (T[name][locale] ?? T[name].es)(data);
  const { html, text } = renderLayout(locale, built.title, built.blocks);
  return { subject: built.subject, html, text };
}

export const TEMPLATE_NAMES = Object.keys(T) as TemplateName[];

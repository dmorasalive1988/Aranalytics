import { expect, test, type Browser } from '@playwright/test';
import { LABELS, onboard, uniqueEmail, waitForMail } from './helpers';

/** WAV corto generado en la prueba (sin binarios en el repositorio). */
function wav() {
  const sr = 8000, n = sr;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(6000 * Math.sin((2 * Math.PI * 440 * i) / sr)), 44 + i * 2);
  return b;
}

async function writer(browser: Browser, prefix: string, plan: 'Socio' | 'Pro') {
  const ctx = await browser.newContext({ locale: 'es-CO', extraHTTPHeaders: { 'Accept-Language': 'es-CO' } });
  const page = await ctx.newPage();
  const email = uniqueEmail(prefix);
  await onboard(page, { email, plan, labels: LABELS.es });
  return { page, email, ctx };
}

/**
 * Criterio 5: una solicitud en la red recibe una postulación, se acepta y se convierte en una obra con splits firmados.
 * Los contactos no se ven antes de aceptar.
 */
test('de la solicitud a la obra con splits firmados', async ({ browser }) => {
  test.setTimeout(300_000);
  const owner = await writer(browser, 'c5-owner', 'Pro');
  const applicant = await writer(browser, 'c5-app', 'Socio');

  // Publica con demo
  await owner.page.goto('/red/nueva');
  await owner.page.getByLabel('Beat busca topliner').check();
  await owner.page.getByLabel('Título', { exact: true }).fill('Beat de dembow sin coro');
  await owner.page.getByLabel('Descripción').fill('Tengo el beat listo, busco topliner con melodía pegajosa.');
  await owner.page.getByLabel('Género').fill('Dembow');
  await owner.page.getByLabel('Split que ofreces (%)').fill('40');
  await owner.page.getByLabel('Demo (opcional)').setInputFiles({ name: 'demo.wav', mimeType: 'audio/wav', buffer: wav() });
  await owner.page.getByRole('button', { name: 'Publicar' }).click();
  await owner.page.waitForURL(/\/red\/[0-9a-f-]{36}$/);
  const requestUrl = owner.page.url();

  // Postulación: hay que aceptar el split; el cupo se muestra
  const ap = applicant.page;
  await ap.goto('/red');
  await ap.getByRole('link', { name: /Beat de dembow sin coro/ }).click();
  await ap.waitForURL(requestUrl);
  await expect(ap.getByText('Te quedan 3 de 3 postulaciones en 24 horas.')).toBeVisible();
  await expect(ap.locator('audio')).toHaveAttribute('src', /\/api\/audio\//);
  await ap.getByLabel('Tu mensaje').fill('Tengo una melodía perfecta para este beat.');
  await ap.getByRole('button', { name: 'Enviar postulación' }).click();
  await expect(ap.getByText('Para postularte, acepta el split ofrecido.')).toBeVisible();
  await ap.getByLabel(/Acepto el split ofrecido: 40\s?%/).check();
  await ap.getByRole('button', { name: 'Enviar postulación' }).click();
  await expect(ap.getByText(/Tu postulación: Pendiente/)).toBeVisible();

  // Quien publicó recibe la tarjeta (sin el correo del postulante) y acepta
  const received = await waitForMail(owner.email, 'application_received');
  expect(received.text).not.toContain(applicant.email);
  await owner.page.goto(requestUrl);
  await expect(owner.page.getByText('Tengo una melodía perfecta para este beat.')).toBeVisible();
  await expect(owner.page.getByText(applicant.email)).toHaveCount(0);
  await owner.page.getByRole('button', { name: 'Aceptar' }).click();
  await owner.page.waitForURL(/\/red\/colaboraciones\//);
  await expect(owner.page.getByText(applicant.email)).toBeVisible();
  const collabUrl = owner.page.url();

  // El postulante ve los contactos y cierra la canción
  await waitForMail(applicant.email, 'application_accepted');
  await ap.goto(collabUrl);
  await expect(ap.getByText(owner.email)).toBeVisible();
  await expect(ap.getByText(/^60\s?%$/)).toBeVisible();
  await ap.getByLabel('Título de la obra').fill('Dembow del Malecón');
  await ap.getByRole('button', { name: 'Cerrar canción' }).click();
  await ap.waitForURL(/\/obras\/[0-9a-f-]{36}$/);
  await expect(ap.getByText('Dembow del Malecón').first()).toBeVisible();

  // Quien publicó firma su parte: la obra queda con splits firmados
  await waitForMail(owner.email, 'split_invitation');
  await owner.page.goto(ap.url());
  await owner.page.getByRole('button', { name: 'Firmar mi parte' }).click();
  await expect(owner.page.getByText('Splits firmados').first()).toBeVisible();
  await owner.ctx.close();
  await applicant.ctx.close();
});

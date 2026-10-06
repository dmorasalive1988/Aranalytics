import { expect, test } from '@playwright/test';
import { LABELS, codeIn, onboard, uniqueEmail, waitForMail } from './helpers';

/**
 * Criterio 6: un comprador encuentra una obra con opt-in de sync, cotiza y envía una solicitud que llega al autor.
 */
test('el comprador encuentra, cotiza y pide una licencia que llega al autor', async ({ browser }) => {
  test.setTimeout(300_000);
  // Autora Pro con una obra firmada en el catálogo de sync
  const actx = await browser.newContext({ locale: 'es-CO', extraHTTPHeaders: { 'Accept-Language': 'es-CO' } });
  const a = await actx.newPage();
  const authorEmail = uniqueEmail('c6-autora');
  await onboard(a, { email: authorEmail, plan: 'Pro', labels: LABELS.es });
  const title = `Cumbia del Faro ${Date.now() % 10000}`;
  await a.goto('/obras/nueva');
  await a.getByLabel('Título', { exact: true }).fill(title);
  await a.getByLabel('Género').fill('Cumbia');
  await a.getByLabel('No, la escribí sin IA').check();
  await a.getByRole('button', { name: 'Guardar y seguir' }).click();
  await a.waitForURL(/archivos/);
  const workUrl = a.url().replace('/archivos', '');
  await a.getByRole('link', { name: 'Seguir con los coautores' }).click();
  await a.getByLabel('Porcentaje').first().fill('100');
  await a.getByRole('button', { name: 'Guardar y revisar' }).click();
  await a.waitForURL(/revisar/);
  await a.getByRole('button', { name: 'Firmar y enviar invitaciones' }).click();
  await a.waitForURL(/obras\/[0-9a-f-]{36}$/);
  await a.goto(workUrl);
  await a.getByRole('switch', { name: 'Catálogo de sync' }).click();
  await expect(a.getByRole('switch', { name: 'Catálogo de sync' })).toHaveAttribute('aria-checked', 'true');
  await a.reload();
  await a.getByLabel('BPM').fill('96');
  await a.getByLabel('Alegre').check();
  await a.getByLabel('Tengo versión instrumental').check();
  await a.getByLabel('Descripción para el catálogo').fill('Cumbia luminosa con acordeón para el verano.');
  await a.getByRole('button', { name: 'Guardar datos' }).click();
  await expect(a.getByText('Guardado').filter({ visible: true })).toBeVisible();

  // Comprador: alta, búsqueda en lenguaje natural, cotización y solicitud
  const bctx = await browser.newContext({ locale: 'es-MX', extraHTTPHeaders: { 'Accept-Language': 'es-MX' }, viewport: { width: 1280, height: 900 } });
  const b = await bctx.newPage();
  const buyerEmail = uniqueEmail('c6-comprador');
  await b.goto('/pluma-sync');
  await b.getByRole('link', { name: 'Crear cuenta de comprador' }).click();
  await b.waitForURL(/registro/);
  await b.getByLabel('Correo electrónico').fill(buyerEmail);
  await b.getByLabel('Contraseña').fill('clave-segura-e2e-123');
  await b.getByRole('button', { name: 'Crear cuenta' }).click();
  await b.waitForURL(/verificar/);
  await b.getByLabel('Código').fill(codeIn(await waitForMail(buyerEmail, 'auth_code')));
  await b.getByRole('button', { name: 'Verificar' }).click();
  await b.waitForURL(/pluma-sync\/alta/);
  await b.getByLabel('Empresa').fill('Agencia Faro E2E');
  await b.getByRole('button', { name: 'Entrar a Pluma Sync' }).click();
  await b.waitForURL(/pluma-sync\/buscar/);

  await b.getByRole('searchbox').or(b.locator('#q')).first().fill('cumbia alegre instrumental 90-100 bpm para un comercial de verano');
  await b.getByRole('button', { name: 'Buscar' }).click();
  await expect(b.getByText('Entendimos:')).toBeVisible();
  await b.getByRole('link', { name: title }).click();
  await b.waitForURL(/pluma-sync\/obra\//);

  await b.getByRole('button', { name: 'Cotizar' }).click();
  await expect(b.getByText('Rango referencial')).toBeVisible();
  await b.getByLabel('Describe el proyecto').fill('Spot de verano para una marca de bebidas en redes sociales de México.');
  await b.getByRole('button', { name: 'Enviar solicitud' }).click();
  await b.waitForURL(/solicitudes\?enviada=1/);
  await expect(b.getByText('Esperando a los autores').first()).toBeVisible();

  // Llega a la autora (correo y app) y la aprueba
  const mail = await waitForMail(authorEmail, 'license_requested');
  expect(mail.subject).toContain('Agencia Faro E2E');
  await a.goto('/sync/licencias');
  await expect(a.getByText(title)).toBeVisible();
  await a.getByRole('button', { name: 'Aprobar' }).click();
  await expect(a.getByText('Aprobada por los autores').first()).toBeVisible();
  await b.reload();
  await expect(b.getByText('Aprobada por los autores').first()).toBeVisible();
  await actx.close();
  await bctx.close();
});

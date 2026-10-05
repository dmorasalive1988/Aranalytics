import { expect, test } from '@playwright/test';
import { LABELS, codeIn, onboard, uniqueEmail, waitForMail } from './helpers';

/**
 * Criterio 2: una obra con 4 coautores no se puede enviar si los splits no suman 100 %, y no pasa a
 * registro hasta que todos firman. Los coautores invitados firman sin cuenta, desde su enlace.
 */
test('4 coautores: bloqueo al 99,99 % y registro solo cuando todos firman', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'es-CO', extraHTTPHeaders: { 'Accept-Language': 'es-CO' } });
  const page = await ctx.newPage();
  await onboard(page, { email: uniqueEmail('c2-owner'), plan: 'Pro', labels: LABELS.es });

  await page.goto('/obras/nueva');
  await page.getByLabel('Título', { exact: true }).fill('Cuatro Plumas');
  await page.getByLabel('Género').fill('Vallenato');
  await page.getByLabel('No, la escribí sin IA').check();
  await page.getByRole('button', { name: 'Guardar y seguir' }).click();
  await page.waitForURL(/archivos/);
  await page.getByRole('link', { name: 'Seguir con los coautores' }).click();

  const guests = [['Ana Coautora', uniqueEmail('ana')], ['Beto Coautor', uniqueEmail('beto')], ['Cami Coautora', uniqueEmail('cami')]] as const;
  await page.getByLabel('Porcentaje').first().fill('25');
  for (const [i, [name, email]] of guests.entries()) {
    await page.getByRole('button', { name: 'Agregar coautor' }).click();
    await page.getByLabel('Nombre', { exact: true }).last().fill(name);
    await page.getByLabel('Correo', { exact: true }).last().fill(email);
    await page.getByLabel('Porcentaje').last().fill(i === 2 ? '24,99' : '25');
  }
  const save = page.getByRole('button', { name: 'Guardar y revisar' });
  await expect(page.getByText(/Falta 0,01/)).toBeVisible();
  await expect(save).toBeDisabled();

  await page.getByLabel('Porcentaje').last().fill('25');
  await expect(page.getByText(/listo para enviar/)).toBeVisible();
  await save.click();
  await page.waitForURL(/revisar/);
  await page.getByRole('button', { name: 'Firmar y enviar invitaciones' }).click();
  await page.waitForURL(/obras\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Esperando firmas').first()).toBeVisible();

  // Cada coautor invitado firma desde su enlace con un código; la obra no avanza hasta la última firma.
  for (const [n, [, email]] of guests.entries()) {
    const invitation = await waitForMail(email, 'split_invitation');
    const link = invitation.text.match(/https?:\/\/\S+\/firmar\/t\/[A-Za-z0-9_-]+/)![0];
    const guest = await browser.newContext({ locale: 'es-CO' });
    const g = await guest.newPage();
    await g.goto(link);
    await expect(g.getByText('Cuatro Plumas').first()).toBeVisible();
    await g.getByRole('button', { name: 'Recibir código para firmar' }).click();
    await g.getByLabel('Código de 6 dígitos').first().fill(codeIn(await waitForMail(email, 'signature_code')));
    await g.getByRole('button', { name: 'Firmar', exact: true }).click();
    await expect(g.getByText('¡Listo, firmaste!')).toBeVisible();
    await guest.close();

    await page.reload();
    if (n < guests.length - 1) await expect(page.getByText('Esperando firmas').first()).toBeVisible();
  }
  await expect(page.getByText('Splits firmados').first()).toBeVisible();
  await ctx.close();
});

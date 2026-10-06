import { expect, test } from '@playwright/test';
import { LABELS, onboard, uniqueEmail } from './helpers';

/**
 * Fase c: el aviso de membresía queda en el centro de notificaciones (campana con contador),
 * el correo de dinero no se puede apagar, las categorías opcionales sí, y WhatsApp exige número y consentimiento.
 */
test('centro de notificaciones y preferencias por canal', async ({ browser }) => {
  const ctx = await browser.newContext({ locale: 'es-CO', extraHTTPHeaders: { 'Accept-Language': 'es-CO' } });
  const page = await ctx.newPage();
  await onboard(page, { email: uniqueEmail('fc'), plan: 'Socio', labels: LABELS.es });

  // El aviso se despacha en segundo plano tras el pago: recarga hasta que la campana lo cuente.
  const bell = page.getByRole('link', { name: /Notificaciones: \d+ sin leer/ });
  await expect(async () => {
    await page.goto('/inicio');
    await expect(bell).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
  await bell.click();
  await page.waitForURL(/\/notificaciones$/);
  await expect(page.getByRole('heading', { name: 'Notificaciones', level: 1 })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Notificaciones' }).getByRole('link').first()).toContainText('Socio');
  // Al abrir el centro, la campana se apaga sin recargar; y sigue apagada al salir y volver.
  await expect(page.getByRole('link', { name: 'Notificaciones', exact: true })).toBeVisible();
  await page.goto('/inicio');
  await expect(page.getByRole('link', { name: 'Notificaciones', exact: true })).toBeVisible();
  await page.goto('/notificaciones');

  await page.getByRole('link', { name: 'Preferencias' }).click();
  await page.waitForURL(/cuenta\/notificaciones/);
  await expect(page.locator('#money-email')).toBeDisabled();
  await expect(page.locator('#money-email')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Siempre por correo: es importante para tu dinero o tus derechos.').first()).toBeVisible();

  const works = page.locator('#works-email');
  await expect(works).toHaveAttribute('aria-checked', 'true');
  await works.click();
  await expect(works).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(page.locator('#works-email')).toHaveAttribute('aria-checked', 'false');

  await page.getByLabel('Número de WhatsApp').fill('300 12');
  await page.getByRole('button', { name: 'Activar WhatsApp' }).click();
  await expect(page.getByText(/Revisa el número/)).toBeVisible();
  await page.getByLabel('Número de WhatsApp').fill('+57 300 123 4567');
  await page.getByRole('button', { name: 'Activar WhatsApp' }).click();
  await expect(page.getByText(/Necesitamos tu autorización/)).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Activar WhatsApp' }).click();
  await expect(page.getByText('Te escribimos al +573001234567.')).toBeVisible();
  await expect(page.locator('#money-whatsapp')).toBeEnabled();
  await expect(page.locator('#money-whatsapp')).toHaveAttribute('aria-checked', 'true');
  await ctx.close();
});

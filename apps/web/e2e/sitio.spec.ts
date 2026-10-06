import { expect, test } from '@playwright/test';
import { LABELS, codeIn, uniqueEmail, waitForMail } from './helpers';

const L = LABELS.es;

test('sitio: las 13 secciones en orden y el hero con "Hazte socio" sin hacer scroll en el celular', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForURL(/\/es$/);
  await expect(page.locator('header').first()).toBeVisible();
  const headings = await page.locator('main > section').evaluateAll((els) => els.map((s) => s.querySelector('h1, h2')?.textContent?.trim() ?? ''));
  expect(headings).toEqual([
    'Donde nacen las canciones.',
    'Escribir es lo tuyo. Cobrar no debería ser un misterio.',
    'Escribe. Firma. Cobra.',
    'Encuentra con quién escribir tu próxima canción.',
    'Tu música en cine, series, publicidad y videojuegos.',
    'Cobra en todo el mundo. Mira cada centavo.',
    'Un split es la parte de la canción que te toca.',
    'Lo mejor de una editora, sin cerrarte la puerta.',
    'Dos planes. Sin letra pequeña.',
    'Lo que todo autor pregunta.',
    'Para supervisores y A&Rs',
    'Tu canción. Tu firma. Tu plata.',
  ]);
  await expect(page.locator('body > footer')).toBeVisible();

  const vh = page.viewportSize()!.height;
  for (const el of [page.getByRole('heading', { level: 1 }), page.getByText('Pluma registra tus obras, firma tus splits'), page.locator('main').getByRole('link', { name: 'Hazte socio' }).first()]) {
    const box = (await el.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(vh);
  }
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
});

test('sitio: la calculadora muestra el neto de cada plan y desde cuánto conviene Pro', async ({ page }) => {
  await page.goto('/es#precios', { waitUntil: 'networkidle' });
  await expect(page.getByText('Pro te conviene desde USD 600 al año.')).toBeVisible();
  const slider = page.getByRole('slider', { name: '¿Cuánto recaudan tus obras al año?' });
  const net = (label: string) => page.locator('dl dt', { hasText: label }).locator('xpath=following-sibling::dd');

  await slider.fill('600');
  await expect(net('Recibes con Socio')).toHaveText('USD 460');
  await expect(net('Recibes con Pro')).toHaveText('USD 460');
  await expect(page.getByText('Con este monto, los dos planes te dejan lo mismo.')).toBeVisible();

  await slider.fill('20000');
  await expect(net('Recibes con Socio')).toHaveText('USD 15.980');
  await expect(net('Recibes con Pro')).toHaveText('USD 16.950');
  await expect(page.getByText('Con este monto, Pro te deja USD 970 más al año.')).toBeVisible();

  await slider.fill('300');
  await expect(net('Recibes con Socio')).toHaveText('USD 220');
  await expect(net('Recibes con Pro')).toHaveText('USD 205');
  await expect(page.getByText('Con este monto, Socio te deja USD 15 más al año.')).toBeVisible();
});

test('sitio: "Elegir Socio" lleva al registro con el plan y el idioma preseleccionados', async ({ page, context }) => {
  await context.addCookies([{ name: 'PLUMA_LOCALE', value: 'en', url: 'http://localhost:3100' }]);
  await page.goto('/es#precios');
  await page.getByRole('link', { name: 'Elegir Socio' }).click();
  await page.waitForURL(/\/registro\?lang=es&plan=socio/);
  await expect(page.getByText('Elegiste el plan Socio.')).toBeVisible();

  const email = uniqueEmail('sitio');
  await page.getByLabel(L.email).fill(email);
  await page.getByLabel(L.password).fill('clave-segura-e2e-123');
  await page.getByRole('button', { name: L.create }).click();
  await page.waitForURL(/verificar/);
  await page.getByLabel(L.code).fill(codeIn(await waitForMail(email, 'auth_code')));
  await page.getByRole('button', { name: L.verify }).click();
  await page.waitForURL(/onboarding\/perfil/);
  await page.getByLabel(L.legalName).fill('Persona del Sitio');
  await page.getByLabel(L.birthDate).fill('1995-05-20');
  await page.getByRole('button', { name: L.continue }).click();
  await page.waitForURL(/sociedad/);
  await page.getByRole('button', { name: L.continue }).click();
  await page.waitForURL(/onboarding\/plan/);
  await expect(page.getByRole('radio', { name: /^Socio/ })).toBeChecked();
});

test('sitio: páginas legales con marcador, sin texto inventado', async ({ page }) => {
  for (const slug of ['terminos', 'privacidad', 'contrato']) {
    await page.goto(`/es/${slug}`);
    await expect(page.getByText('[texto legal a definir]')).toBeVisible();
  }
});

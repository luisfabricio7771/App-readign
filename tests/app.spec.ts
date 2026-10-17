import { expect, test, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';

async function sample(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Explorar una muestra', exact: true }).click();
  await expect(page.locator('.reader-book-title h1')).toHaveText('El atlas de los umbrales');
  await expect(page.locator('.pdf-page[data-page="1"]')).toHaveAttribute('data-ready', 'true');
}
async function goTo(page: Page, number: number) {
  const input = page.getByRole('textbox', { name: 'Número de página', exact: true });
  await input.fill(String(number)); await input.press('Enter');
  await expect(page.locator(`.pdf-page[data-page="${number}"]`)).toHaveAttribute('data-ready', 'true');
  await expect(input).toHaveValue(String(number));
  if (await page.locator('.page-turn-viewport').count()) {
    await expect(page.locator('.page-turn-viewport')).toHaveAttribute('data-visible-page', String(number));
    await expect(page.locator('.page-turn-viewport')).toHaveAttribute('data-turn-state', 'idle');
  }
}
async function showBattle(page: Page) {
  const chip = page.getByRole('button', { name: 'Desplegar combate', exact: true });
  if (await chip.isVisible()) await chip.click();
}
async function hideBattle(page: Page) {
  const close = page.getByRole('button', { name: 'Minimizar combate', exact: true });
  if (await close.isVisible()) await close.click();
}

test('library has honest empty state, working navigation and responsive layout', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByText('Hay mundos esperando por ti')).toBeVisible();
  await page.getByRole('button', { name: 'Mis hazañas', exact: true }).click();
  await expect(page.getByText('Tu leyenda está por escribirse')).toBeVisible();
  await page.getByRole('button', { name: 'Bestiario', exact: false }).click();
  await expect(page.locator('.bestiary-card')).toHaveCount(10);
  await page.locator('.bestiary-card').first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
  const mobileSettings = page.getByRole('button', { name: 'Abrir ajustes', exact: true });
  if (await mobileSettings.isVisible()) {
    await mobileSettings.click();
    await expect(page.getByRole('dialog')).toContainText('A tu manera');
    await page.getByRole('button', { name: 'Instalar Final Reader', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('Lleva la aventura contigo');
    await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('real PDF renders, text search navigates and zoom and continuous mode work', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await sample(page);
  await expect(page.locator('.pdf-page canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await expect(page.locator('.zoom-value')).toHaveText('115%');
  await expect(page.locator('.pdf-page')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Ajustar al ancho', exact: true }).click();
  await page.getByRole('button', { name: 'Buscar en el libro', exact: true }).click();
  await page.getByRole('textbox', { name: 'Texto a buscar' }).fill('relojero');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.search-summary')).toContainText('1 coincidencias en 1 páginas');
  await expect(page.getByRole('textbox', { name: 'Número de página', exact: true })).toHaveValue('7');
  await expect(page.locator('.pdf-search-mark').first()).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar búsqueda', exact: true }).click();
  await page.getByRole('button', { name: 'Lectura continua', exact: true }).click();
  await expect(page.locator('.pdf-page')).toHaveCount(24);
  await goTo(page, 12);
  await page.getByRole('button', { name: 'Página individual', exact: true }).click();
  await expect(page.locator('.pdf-page')).toHaveCount(1);
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('textbox', { name: 'Número de página', exact: true })).toHaveValue('14');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('textbox', { name: 'Número de página', exact: true })).toHaveValue('13');
  await expect(page.locator('.page-turn-viewport')).toHaveAttribute('data-visible-page', '13');
  await expect(page.locator('.page-turn-viewport')).toHaveAttribute('data-turn-state', 'idle');
  await expect(page.locator('.pdf-page')).toHaveAttribute('data-ready', 'true');
  await page.keyboard.press('l');
  await expect(page.getByRole('button', { name: 'Página completada', exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('ten distinct completions award one victory, page eleven damages next boss and progress survives reload', async ({ page }) => {
  await sample(page);
  for (let number = 1; number <= 10; number++) {
    if (number > 1) await goTo(page, number);
    await page.getByRole('button', { name: 'Página leída', exact: false }).click();
    await expect(page.getByRole('button', { name: 'Página completada', exact: true })).toBeDisabled();
  }
  await expect(page.locator('.victory-banner')).toContainText('¡VICTORIA!');
  await expect(page.locator('.victory-banner')).toContainText('+100 EXP');
  await page.getByRole('button', { name: 'Cerrar victoria', exact: true }).click();
  await goTo(page, 11);
  await page.getByRole('button', { name: 'Página leída', exact: false }).click();
  await showBattle(page);
  await expect(page.locator('.boss-identity h2')).toHaveText('Sol de Ámbar');
  await expect(page.getByRole('progressbar', { name: 'Vida del jefe' }).first()).toHaveAttribute('aria-valuenow', '90');
  await hideBattle(page);
  await goTo(page, 1);
  await expect(page.getByRole('button', { name: 'Página completada' })).toBeDisabled();
  await goTo(page, 11);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Número de página', exact: true })).toHaveValue('11');
  await expect(page.locator('.pdf-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Página completada' })).toBeDisabled();
  await page.getByRole('button', { name: 'Volver a la biblioteca' }).click();
  await expect(page.locator('.stat-value').nth(0)).toContainText('11');
  await expect(page.locator('.stat-value').nth(1)).toContainText('1');
  await expect(page.locator('.stat-value').nth(2)).toContainText('100');
  await page.getByRole('button', { name: 'Mis hazañas', exact: true }).click();
  await expect(page.locator('.victory-list>button')).toHaveCount(1);
});

test('jumping to page 50 never rewards skipped pages and importing a duplicate preserves progress', async ({ page }) => {
  const document = await PDFDocument.create();
  document.setTitle('El camino largo');
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 60; i++) document.addPage([600, 800]).drawText(`Pagina ${i}. Una historia por descubrir.`, { x: 60, y: 700, size: 18, font });
  const buffer = Buffer.from(await document.save());
  await page.goto('/');
  await page.getByLabel('Importar archivos PDF', { exact: true }).setInputFiles({ name: 'camino.pdf', mimeType: 'application/pdf', buffer });
  await expect(page.locator('.reader-book-title h1')).toHaveText('El camino largo');
  await goTo(page, 50);
  await showBattle(page);
  await expect(page.getByRole('progressbar', { name: 'Vida del jefe' }).first()).toHaveAttribute('aria-valuenow', '100');
  await hideBattle(page);
  await page.getByRole('button', { name: 'Página leída', exact: false }).click();
  await showBattle(page);
  await expect(page.getByRole('progressbar', { name: 'Vida del jefe' }).first()).toHaveAttribute('aria-valuenow', '90');
  await expect(page.locator('.book-journey')).toContainText('1 / 60 páginas');
  await hideBattle(page);
  await page.getByRole('button', { name: 'Volver a la biblioteca' }).click();
  await page.getByLabel('Importar archivos PDF', { exact: true }).setInputFiles({ name: 'copia.pdf', mimeType: 'application/pdf', buffer });
  await expect(page.getByRole('textbox', { name: 'Número de página', exact: true })).toHaveValue('50');
  await expect(page.getByRole('button', { name: 'Página completada' })).toBeDisabled();
  await page.getByRole('button', { name: 'Volver a la biblioteca' }).click();
  await expect(page.locator('.book-card')).toHaveCount(1);
});

test('custom boss name and image and reader settings persist', async ({ page }) => {
  await sample(page);
  await showBattle(page);
  await page.getByRole('button', { name: 'Personalizar jefe', exact: false }).click();
  await page.getByRole('textbox', { name: 'Nombre del jefe' }).fill('Dragón de mi biblioteca');
  await page.getByLabel('Imagen del jefe', { exact: true }).setInputFiles('public/icon-192.png');
  await page.getByRole('button', { name: 'Guardar personalización' }).click();
  await expect(page.locator('.boss-identity h2')).toHaveText('Dragón de mi biblioteca');
  await expect(page.locator('.boss-stage .boss-image')).toHaveAttribute('src', /^data:image\/webp/);
  await hideBattle(page);
  await page.getByRole('button', { name: 'Ajustes de lectura' }).click();
  await page.getByRole('button', { name: 'Clara', exact: true }).click();
  await page.getByRole('switch', { name: 'Reducir animaciones', exact: false }).check();
  await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await showBattle(page);
  await expect(page.locator('.boss-identity h2')).toHaveText('Dragón de mi biblioteca');
  await expect(page.locator('.boss-stage .boss-image')).toHaveAttribute('src', /^data:image\/webp/);
});

test('production PWA opens and reads stored PDF entirely offline without external requests', async ({ page, context }) => {
  const external: string[] = [];
  page.on('request', request => { if (!request.url().startsWith('http://127.0.0.1:4173') && !/^(blob:|data:)/.test(request.url())) external.push(request.url()); });
  await sample(page);
  await page.getByRole('button', { name: 'Página leída', exact: false }).click();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), { timeout: 30000 }).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.pdf-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Página completada' })).toBeDisabled();
  await goTo(page, 2);
  await expect(page.locator('.textLayer')).toContainText('La biblioteca');
  expect(external).toEqual([]);
});

test('invalid import is recoverable and deleting a book removes its data', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Importar archivos PDF', { exact: true }).setInputFiles({ name: 'roto.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  await expect(page.getByRole('alert')).toContainText('dañado');
  await page.getByRole('button', { name: 'Cerrar aviso' }).click();
  await sample(page);
  await page.getByRole('button', { name: 'Volver a la biblioteca' }).click();
  await page.getByRole('button', { name: 'Opciones de El atlas de los umbrales' }).click();
  await page.getByRole('button', { name: 'Eliminar libro', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar libro', exact: true }).click();
  await expect(page.locator('.book-card')).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Hay mundos esperando por ti')).toBeVisible();
});

test('optional automatic completion waits for the configured active reading time', async ({ page }) => {
  await sample(page);
  await page.bringToFront();
  await page.clock.install();
  await page.getByRole('button', { name: 'Ajustes de lectura' }).click();
  await page.getByRole('switch', { name: 'Lectura automática', exact: false }).check();
  await page.getByRole('combobox', { name: 'Tiempo por página' }).selectOption('30');
  await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
  await page.clock.runFor(29000);
  await expect(page.getByRole('button', { name: 'Página leída', exact: false })).toBeEnabled();
  await page.clock.runFor(1000);
  await expect(page.getByRole('button', { name: 'Página completada', exact: true })).toBeDisabled();
  await goTo(page, 2);
  await page.clock.runFor(10000);
  await page.getByRole('button', { name: 'Ajustes de lectura' }).click();
  await page.clock.runFor(60000);
  await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Página leída', exact: false })).toBeEnabled();
  await page.clock.runFor(19000);
  await expect(page.getByRole('button', { name: 'Página leída', exact: false })).toBeEnabled();
  await page.clock.runFor(1000);
  await expect(page.getByRole('button', { name: 'Página completada', exact: true })).toBeDisabled();
});

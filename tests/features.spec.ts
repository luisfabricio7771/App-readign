import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mockYouTube } from './youtube-fixture';

async function sample(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Explorar una muestra', exact: true }).click();
  await expect(page.locator('.pdf-page[data-page="1"]')).toHaveAttribute('data-ready', 'true');
}
async function settled(page: Page, number: number) {
  await expect(page.locator('.page-turn-viewport')).toHaveAttribute('data-visible-page', String(number));
  await expect(page.locator('.page-turn-viewport')).toHaveAttribute('data-turn-state', 'idle');
  await expect(page.locator(`.pdf-page[data-page="${number}"]`)).toHaveAttribute('data-ready', 'true');
}
async function music(page: Page) {
  await mockYouTube(page); await sample(page);
  await page.getByRole('button', { name: 'Música de YouTube', exact: true }).click();
}
async function loadTrack(page: Page, link = 'https://youtu.be/M7lc1UVf-VE') {
  await page.getByRole('textbox', { name: 'Enlace de YouTube' }).fill(link);
  await page.getByRole('button', { name: 'Cargar enlace', exact: true }).click();
  await expect(page.getByTitle('Reproductor oficial de YouTube', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reproducir', exact: true })).toBeEnabled();
}

test('paper turns keep both sheets rendered, block damage and coalesce rapid navigation in a large PDF', async ({ page, context, isMobile }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const pdf = await PDFDocument.create(); pdf.setTitle('Cien umbrales');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= 120; n++) pdf.addPage([600, 800]).drawText(`Pagina ${n}: una historia por descubrir.`, { x: 60, y: 700, size: 18, font });
  await page.goto('/');
  await page.getByLabel('Importar archivos PDF', { exact: true }).setInputFiles({ name: 'grande.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await settled(page, 1);
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click();
  await expect(page.locator('.page-turn-viewport')).toHaveClass(/turn-forward/);
  await expect(page.locator('.turn-front canvas')).toBeVisible();
  await expect(page.locator('.turn-target .pdf-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Página leída', exact: false })).toBeDisabled();
  await page.keyboard.press('l');
  await settled(page, 2);
  for (let i = 0; i < 8; i++) await page.getByRole('button', { name: 'Página siguiente', exact: true }).click();
  await settled(page, 10);
  await expect(page.locator('.pdf-page')).toHaveCount(1);
  await expect(page.locator('.textLayer')).toContainText('Pagina 10');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.page-turn-viewport')).toHaveClass(/turn-backward/);
  await settled(page, 9);
  await page.getByRole('button', { name: 'Acercar', exact: true }).click();
  await expect(page.locator('.zoom-value')).toHaveText('115%');
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); await settled(page, 10);
  await expect(page.locator('.zoom-value')).toHaveText('115%');
  if (isMobile) {
    await page.getByRole('button', { name: 'Ajustar al ancho', exact: true }).click();
    await expect(page.locator('.zoom-value')).toHaveText('100%');
    const client = await context.newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 290, y: 230 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 115, y: 230 }] });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await settled(page, 11); await client.detach();
  }
  await page.reload(); await settled(page, isMobile ? 11 : 10);
  await page.getByRole('button', { name: 'Volver a la biblioteca' }).click();
  await expect(page.locator('.stat-value').first()).toContainText('0');
  expect(errors).toEqual([]);
});

test('animation settings and system reduced motion disable paper and boss movement', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await sample(page);
  await expect.poll(() => page.locator('.boss-motion').evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); await settled(page, 2);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.getByRole('button', { name: 'Ajustes de lectura' }).click();
  await page.getByRole('switch', { name: 'Animación de hoja', exact: false }).uncheck();
  await page.getByRole('switch', { name: 'Animaciones de jefes', exact: false }).uncheck();
  await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
  await expect(page.locator('.reader')).toHaveClass(/boss-animations-off/);
  await page.reload(); await settled(page, 2);
  await page.getByRole('button', { name: 'Ajustes de lectura' }).click();
  await expect(page.getByRole('switch', { name: 'Animación de hoja', exact: false })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Animaciones de jefes', exact: false })).not.toBeChecked();
});

test('official-player contract preserves one instance across page turns and minimization, pauses on close and manages playlists', async ({ page }) => {
  await music(page); await loadTrack(page);
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(true);
  const frame = page.getByTitle('Reproductor oficial de YouTube', { exact: true });
  const identity = await frame.evaluate(node => { node.setAttribute('data-original-frame', 'yes'); return true; });
  expect(identity).toBe(true);
  await page.getByRole('button', { name: 'Minimizar reproductor musical' }).click();
  await expect(frame).toBeVisible();
  const bounds = await frame.boundingBox(); expect(bounds!.width).toBeGreaterThanOrEqual(200); expect(bounds!.height).toBeGreaterThanOrEqual(200);
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); await settled(page, 2);
  await expect(frame).toHaveAttribute('data-original-frame', 'yes');
  await expect.poll(() => page.evaluate('window.__ytTest.constructed')).toBe(1);
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(true);
  await page.getByRole('button', { name: 'Cerrar reproductor musical' }).click();
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(false);
  await page.getByRole('button', { name: 'Música de YouTube', exact: true }).click();
  await expect(frame).toHaveAttribute('data-original-frame', 'yes');
  await loadTrack(page, 'https://www.youtube.com/playlist?list=PL_test_12345');
  await page.getByRole('button', { name: 'Siguiente video de la playlist' }).click();
  await expect.poll(() => page.evaluate('window.__ytTest.calls.includes("next")')).toBe(true);
  await expect.poll(() => page.evaluate('window.__ytTest.constructed')).toBe(1);
});

test('music favorites and last link persist locally, invalid links never connect, and unavailable videos explain the error', async ({ page }) => {
  await music(page);
  await page.getByRole('textbox', { name: 'Enlace de YouTube' }).fill('https://evil.example/watch?v=M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Cargar enlace', exact: true }).click();
  await expect(page.locator('.music-message')).toContainText('enlace válido');
  expect(await page.evaluate('window.__ytTest')).toBeUndefined();
  await loadTrack(page);
  await expect(page.locator('.music-track h3')).toContainText('Música de prueba');
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(true);
  await page.getByRole('button', { name: 'Guardar enlace favorito', exact: true }).click();
  await expect(page.locator('.music-favorites li')).toHaveCount(1);
  await page.evaluate('window.__ytTest.error(150)');
  await expect(page.locator('.music-message')).toContainText('no permite insertar');
  await expect.poll(() => page.evaluate(async () => {
    const request = indexedDB.open('final-reader');
    const db = await new Promise<IDBDatabase>(resolve => request.onsuccess = () => resolve(request.result));
    return new Promise<number>(resolve => { const read = db.transaction('music').objectStore('music').get('preferences'); read.onsuccess = () => { db.close(); resolve(read.result?.favorites.length || 0); }; });
  })).toBe(1);
  await page.reload(); await settled(page, 1);
  await page.getByRole('button', { name: 'Música de YouTube', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Enlace de YouTube' })).toHaveValue('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await expect(page.locator('.music-favorites li')).toHaveCount(1);
  expect(await page.evaluate('window.__ytTest')).toBeUndefined();
});

test('YouTube connection failure leaves local PDF navigation usable', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', route => route.abort());
  await sample(page); await page.getByRole('button', { name: 'Música de YouTube', exact: true }).click();
  await page.getByRole('textbox', { name: 'Enlace de YouTube' }).fill('https://youtu.be/M7lc1UVf-VE');
  await page.getByRole('button', { name: 'Cargar enlace', exact: true }).click();
  await expect(page.locator('.music-message')).toContainText('No pudimos conectar');
  await page.getByRole('button', { name: 'Cerrar reproductor musical' }).click();
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); await settled(page, 2);
  await page.getByRole('button', { name: 'Página leída', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Página completada', exact: true })).toBeDisabled();
});

test('music respects visibility and window controls and keeps working with local reading offline', async ({ page, context, isMobile }) => {
  await music(page); await loadTrack(page);
  const volume = page.getByRole('slider', { name: 'Volumen de YouTube' });
  if (isMobile) await expect(volume).toBeDisabled();
  else {
    await volume.focus(); await volume.press('Home'); await volume.press('ArrowRight');
    await expect.poll(() => page.evaluate('window.__ytTest.volume')).toBe(1);
    await expect(page.getByRole('textbox', { name: 'Número de página', exact: true })).toHaveValue('1');
  }
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(true);
  await page.getByRole('button', { name: 'Ajustes de lectura' }).click();
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(false);
  await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(false);
  await page.evaluate(() => { Reflect.deleteProperty(document, 'visibilityState'); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByRole('button', { name: 'Reproducir', exact: true }).click();
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(true);
  await context.setOffline(true);
  await expect(page.locator('.music-message')).toContainText('Sin conexión');
  await expect.poll(() => page.evaluate('window.__ytTest.playing')).toBe(false);
  await page.getByRole('button', { name: 'Cerrar reproductor musical' }).click();
  await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); await settled(page, 2);
  await page.getByRole('button', { name: 'Página leída', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Página completada', exact: true })).toBeDisabled();
});

test('bosses float, recoil, show damage and dissolve on defeat without interrupting pages', async ({ page }) => {
  await sample(page);
  await page.getByRole('button', { name: 'Ajustes de lectura' }).click();
  await page.getByRole('switch', { name: 'Animación de hoja', exact: false }).uncheck();
  await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
  const chip = page.getByRole('button', { name: 'Desplegar combate', exact: true });
  if (await chip.isVisible()) await chip.click();
  await expect.poll(() => page.locator('.boss-motion').evaluate(node => getComputedStyle(node).animationName)).toBe('guardian-idle');
  await page.getByRole('button', { name: 'Página leída', exact: false }).click();
  await expect(page.getByText('-10% HP', { exact: true })).toBeVisible();
  await expect(page.locator('.combat-panel [role="progressbar"]')).toHaveAttribute('aria-valuenow', '90');
  for (let number = 2; number <= 10; number++) {
    await page.getByRole('button', { name: 'Página siguiente', exact: true }).click(); await settled(page, number);
    await page.getByRole('button', { name: 'Página leída', exact: false }).click();
  }
  await expect(page.getByText('BOSS DEFEATED', { exact: true })).toBeVisible();
  await expect(page.locator('.boss-stage')).toHaveClass(/defeated/);
  await expect(page.locator('.combat-panel [role="progressbar"]')).toHaveAttribute('aria-valuenow', '0');
  await expect(page.locator('.victory-banner')).toContainText('+100 EXP');
  await expect(page.locator('.boss-identity h2')).toHaveText('Sol de Ámbar');
  await expect(page.locator('.combat-panel [role="progressbar"]')).toHaveAttribute('aria-valuenow', '100');
});

test('the storage upgrade preserves old books, progress, custom boss names and victory history', async ({ page, request }) => {
  const pdf = await request.get('/sample.pdf'); const data = (await pdf.body()).toString('base64');
  await page.route('**/legacy-setup', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Preparación de datos anteriores</body></html>' }));
  await page.goto('/legacy-setup');
  await page.evaluate(async encoded => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('final-reader', 1);
      request.onupgradeneeded = () => { request.result.createObjectStore('books', { keyPath: 'id' }); request.result.createObjectStore('files'); request.result.createObjectStore('settings'); };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result; const tx = db.transaction(['books', 'files', 'settings'], 'readwrite');
        tx.objectStore('books').put({ id: 'legacy', title: 'Recuerdos', fileName: 'El atlas de los umbrales.pdf', totalPages: 24, lastPage: 2, completedPages: Array.from({ length: 10 }, (_, index) => index + 1), victories: [{ bossIndex: 0, name: 'Véspera', defeatedAt: '2026-10-17T12:00:00Z', page: 10 }], importedAt: '', lastOpened: '', readingSeconds: 120, size: 20000, skins: { vespera: { name: 'Mi guardián anterior' } } });
        tx.objectStore('files').put(new Blob([Uint8Array.from(atob(encoded), char => char.charCodeAt(0))], { type: 'application/pdf' }), 'legacy');
        tx.objectStore('settings').put({ theme: 'light', mode: 'single', autoComplete: false, autoSeconds: 60, reducedMotion: false }, 'preferences');
        tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
  }, data);
  await page.goto('/');
  await expect(page.locator('.book-card')).toHaveCount(1);
  await expect(page.locator('.stat-value').first()).toContainText('10');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Leer Recuerdos', exact: true }).click(); await settled(page, 2);
  await expect(page.getByRole('button', { name: 'Página completada', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Ajustes de lectura' }).click();
  await expect(page.getByRole('switch', { name: 'Animación de hoja', exact: false })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Animaciones de jefes', exact: false })).toBeChecked();
  await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
  await page.getByRole('button', { name: 'Volver a la biblioteca' }).click();
  await page.getByRole('button', { name: 'Mis hazañas', exact: true }).click();
  await expect(page.locator('.victory-list h3')).toHaveText('Véspera');
  await expect(page.locator('.victory-list-art img')).toHaveAttribute('src', '/bosses/vespera.png');
});

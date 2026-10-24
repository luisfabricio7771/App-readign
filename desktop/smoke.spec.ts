import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

test('the desktop app reads offline from first launch, stays sandboxed and preserves a real PDF and progress after exit', async () => {
  const profile = await mkdtemp(join(tmpdir(), 'final-reader-desktop-'));
  const launches: ElectronApplication[] = [];
  const launch = async () => {
    const packaged = process.env.FINAL_READER_TEST_EXECUTABLE;
    const testingFlags = process.env.FINAL_READER_TEST_NO_SANDBOX === '1' ? ['--no-sandbox'] : [];
    const app = await electron.launch({
      executablePath: packaged ? resolve(packaged) : undefined,
      args: [...testingFlags, ...(packaged ? [] : ['.'])],
      cwd: resolve('.'),
      env: { ...process.env, FINAL_READER_DATA_DIR: profile },
      timeout: 30000
    });
    launches.push(app); return app;
  };
  try {
    let app = await launch();
    let page = await app.firstWindow();
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await expect(page).toHaveURL('http://127.0.0.1:43763/');
    await expect(page.getByText('Hay mundos esperando por ti')).toBeVisible();
    const preferences = await app.evaluate(({ BrowserWindow }) => {
      const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return { sandbox: prefs.sandbox, nodeIntegration: prefs.nodeIntegration, contextIsolation: prefs.contextIsolation, webSecurity: prefs.webSecurity };
    });
    expect(preferences).toEqual({ sandbox: true, nodeIntegration: false, contextIsolation: true, webSecurity: true });
    expect(await page.evaluate(() => typeof (window as Window & { require?: unknown }).require)).toBe('undefined');
    expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
    await page.getByRole('button', { name: 'Aplicación de escritorio', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('No necesitas Node.js');
    await page.getByRole('button', { name: 'Cerrar ventana', exact: true }).click();
    // Block the internet while leaving the embedded loopback asset server alive.
    const remoteRequests: string[] = [];
    await page.context().route('**/*', route => {
      if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
      remoteRequests.push(route.request().url()); return route.abort('internetdisconnected');
    });
    await page.getByRole('button', { name: 'Explorar una muestra', exact: true }).click();
    await expect(page.locator('.pdf-page[data-page="1"]')).toHaveAttribute('data-ready', 'true');
    await page.getByRole('button', { name: 'Página leída', exact: false }).click();
    await expect(page.getByRole('progressbar', { name: 'Vida del jefe' }).first()).toHaveAttribute('aria-valuenow', '90');
    const input = page.getByRole('textbox', { name: 'Número de página', exact: true });
    await input.fill('7'); await input.press('Enter');
    await expect(page.locator('.page-turn-viewport')).toHaveAttribute('data-visible-page', '7');
    await expect(page.locator('.pdf-page[data-page="7"]')).toHaveAttribute('data-ready', 'true');
    expect(remoteRequests).toEqual([]); expect(errors).toEqual([]);
    // Explicitly wait for the page-location transaction before exiting the process.
    await expect.poll(() => page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('final-reader'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      return new Promise<number>((resolve, reject) => { const request = db.transaction('books').objectStore('books').getAll(); request.onsuccess = () => { db.close(); resolve(request.result[0]?.lastPage); }; request.onerror = () => reject(request.error); });
    })).toBe(7);
    await page.getByRole('button', { name: 'Editar PDF', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.edit-paper')).toHaveAttribute('data-preview-busy', 'false');
    await expect.poll(() => dialog.locator('canvas').evaluate(c => (c as HTMLCanvasElement).width)).toBeGreaterThan(300);
    await dialog.getByLabel('Texto que añadir').fill('Edición nativa sin conexión');
    await dialog.getByRole('button', { name: 'Texto', exact: true }).click();
    await dialog.locator('.edit-paper').click({ position: { x: 80, y: 100 } });
    await expect(dialog.locator('svg text').first()).toHaveText('Edición nativa sin conexión');
    await dialog.getByRole('button', { name: 'Guardar copia en biblioteca', exact: true }).click();
    await expect(page.locator('.reader-book-title h1')).toHaveText('El atlas de los umbrales — editado');
    await page.getByRole('button', { name: 'Volver a la biblioteca', exact: true }).click();
    await expect(page.locator('.book-card')).toHaveCount(2);
    await page.getByRole('button', { name: 'Leer El atlas de los umbrales', exact: true }).click();
    await expect(page.locator('.pdf-page[data-page="7"]')).toHaveAttribute('data-ready', 'true');
    await app.close();
    app = await launch(); page = await app.firstWindow();
    await page.getByRole('button', { name: 'Continuar leyendo', exact: true }).click();
    await expect(page.locator('.pdf-page[data-page="7"]')).toHaveAttribute('data-ready', 'true');
    await expect(page.getByRole('progressbar', { name: 'Vida del jefe' }).first()).toHaveAttribute('aria-valuenow', '90');
    // Programmatic page navigation cannot replace the app with a remote site.
    const localURL = page.url();
    await app.evaluate(({ BrowserWindow }) => {
      const state = globalThis as typeof globalThis & { deniedNavigation?: boolean };
      state.deniedNavigation = false;
      BrowserWindow.getAllWindows()[0].webContents.once('will-navigate', event => { state.deniedNavigation = event.defaultPrevented; });
    });
    await page.evaluate(() => { location.href = 'https://example.com/'; });
    // Electron cancels this before Chromium commits; inspect the real document
    // through webContents rather than waiting for a nonexistent CDP navigation.
    await expect.poll(() => app.evaluate(async ({ BrowserWindow }) => {
      const contents = BrowserWindow.getAllWindows()[0].webContents;
      return {
        blocked: (globalThis as typeof globalThis & { deniedNavigation?: boolean }).deniedNavigation,
        url: contents.getURL(),
        title: await contents.executeJavaScript("document.querySelector('.reader-book-title h1')?.textContent")
      };
    })).toEqual({ blocked: true, url: localURL, title: 'El atlas de los umbrales' });
    await app.close();
  } finally {
    for (const app of launches) await app.close().catch(() => {});
    await rm(profile, { recursive: true, force: true, maxRetries: 4, retryDelay: 200 });
  }
});

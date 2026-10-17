import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { PDFDocument, StandardFonts } from 'pdf-lib';

test('development imports and reads PDFs with a real worker when node_modules worker imports are unavailable', async ({ page, request }) => {
  const workers: string[] = [], errors: string[] = [], fallbackWarnings: string[] = [];
  page.on('worker', worker => workers.push(worker.url()));
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/fake worker/i.test(message.text())) fallbackWarnings.push(message.text()); });
  // Reproduce the unavailable dynamic-import path reported on Windows.
  await page.route('**/node_modules/pdfjs-dist/**/pdf.worker*', route => route.abort());
  const pkg = JSON.parse(await readFile('node_modules/pdfjs-dist/package.json', 'utf8'));
  const worker = await request.get(`/pdf/pdf.worker-${pkg.version}.min.mjs`);
  expect(worker.ok()).toBe(true);
  expect(worker.headers()['content-type']).toMatch(/javascript/);
  expect(Buffer.compare(await worker.body(), await readFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs'))).toBe(0);

  const pdf = await PDFDocument.create();
  pdf.setTitle('Importación en Windows');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([600, 800]).drawText('Un PDF real para comprobar el lector.', { x: 60, y: 700, size: 18, font });
  await page.goto('/');
  await page.getByLabel('Importar archivos PDF', { exact: true }).setInputFiles({ name: 'lectura.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
  await expect(page.locator('.reader-book-title h1')).toHaveText('Importación en Windows');
  await expect(page.locator('.pdf-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.textLayer')).toContainText('Un PDF real');
  await page.getByRole('button', { name: 'Página leída', exact: false }).click();
  await expect(page.getByRole('button', { name: 'Página completada' })).toBeDisabled();
  await page.reload();
  await expect(page.locator('.pdf-page')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByRole('button', { name: 'Página completada' })).toBeDisabled();
  expect(workers.length).toBeGreaterThanOrEqual(2);
  expect(workers.every(url => /\/pdf\/pdf\.worker-[\d.]+\.min\.mjs$/.test(url))).toBe(true);
  expect(errors).toEqual([]);
  expect(fallbackWarnings).toEqual([]);
});

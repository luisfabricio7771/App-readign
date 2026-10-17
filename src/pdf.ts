import { GlobalWorkerOptions, getDocument, version, type PDFDocumentProxy } from 'pdfjs-dist';

// Serve the matching worker as a static module. Importing it through Vite's
// node_modules URL can fail in development on Windows and trigger a fake worker.
const pdfAssets = `${import.meta.env.BASE_URL}pdf/`;
GlobalWorkerOptions.workerSrc = `${pdfAssets}pdf.worker-${version}.min.mjs`;
export type PasswordHandler = (retry: boolean) => Promise<string>;

export async function openPdf(blob: Blob, password?: PasswordHandler) {
  const task = getDocument({
    data: new Uint8Array(await blob.arrayBuffer()),
    cMapUrl: `${pdfAssets}cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${pdfAssets}standard_fonts/`, wasmUrl: `${pdfAssets}wasm/`
  });
  task.onPassword = (callback: (value: string) => void, reason: number) => {
    if (!password) { void task.destroy(); return; }
    password(reason === 2).then(callback).catch(() => { void task.destroy(); });
  };
  return task.promise;
}

export async function thumbnail(pdf: PDFDocumentProxy) {
  const page = await pdf.getPage(1);
  const original = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 360 / original.width });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  await page.render({ canvas, viewport }).promise;
  return canvas.toDataURL('image/webp', 0.8);
}

export async function prepareImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) throw new Error('Elige una imagen PNG, JPG, WebP, GIF o AVIF.');
  if (file.size > 15 * 1024 * 1024) throw new Error('La imagen debe pesar menos de 15 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/webp', 0.9);
}

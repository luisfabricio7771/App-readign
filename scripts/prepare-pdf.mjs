import { mkdir, cp, readFile, readdir, rm } from 'node:fs/promises';

// npm scripts run from the project root on Windows, macOS, and Linux.
const source = 'node_modules/pdfjs-dist';
const destination = 'public/pdf';
const { version } = JSON.parse(await readFile(`${source}/package.json`, 'utf8'));
const workerName = `pdf.worker-${version}.min.mjs`;
await mkdir(destination, { recursive: true });
for (const name of await readdir(destination)) {
  if (/^pdf\.worker-[\d.]+\.min\.mjs$/.test(name) && name !== workerName) {
    await rm(`${destination}/${name}`);
  }
}
await cp(`${source}/build/pdf.worker.min.mjs`, `${destination}/${workerName}`);
for (const name of ['cmaps', 'standard_fonts', 'wasm']) {
  await cp(`${source}/${name}`, `${destination}/${name}`, { recursive: true });
}
console.log(`PDF.js ${version}: static worker and offline resources ready.`);

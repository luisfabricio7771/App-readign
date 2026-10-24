const { createServer } = require('node:http');
const { createReadStream } = require('node:fs');
const { stat } = require('node:fs/promises');
const { resolve, extname, sep } = require('node:path');

const HOST = '127.0.0.1';
const PORT = 43763;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf',
  '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream', '.ico': 'image/x-icon'
};
const CSP = [
  "default-src 'self'", "script-src 'self' 'wasm-unsafe-eval' https://www.youtube.com",
  "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "font-src 'self' data:", "worker-src 'self' blob:",
  "frame-src 'self' blob: https://www.youtube.com https://www.youtube-nocookie.com",
  "connect-src 'self'", "object-src 'none'", "base-uri 'self'",
  "form-action 'none'", "frame-ancestors 'none'"
].join('; ');

// Only serves bundled application assets, never files from the user's library.
// A fixed loopback origin keeps IndexedDB stable across launches and updates.
async function startAssetServer(root, port = PORT) {
  root = resolve(root);
  const server = createServer(async (request, response) => {
    const origin = `http://${HOST}:${server.address().port}`;
    response.setHeader('Content-Security-Policy', CSP);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Cache-Control', 'no-store');
    const reject = (code) => { response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' }); response.end('Recurso no disponible.'); };
    if (request.headers.host !== `${HOST}:${server.address().port}`) return reject(421);
    if (request.headers.origin && request.headers.origin !== origin) return reject(403);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD'); return reject(405);
    }
    try {
      // Decode before resolving: encoded dots/slashes cannot escape the bundle.
      const pathname = decodeURIComponent(request.url.split('?')[0]);
      if (pathname.includes('\0') || pathname.includes('\\')) return reject(400);
      const file = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!file.startsWith(`${root}${sep}`)) return reject(403);
      const info = await stat(file);
      if (!info.isFile()) return reject(404);
      response.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Content-Length': info.size });
      if (request.method === 'HEAD') return response.end();
      const stream = createReadStream(file);
      stream.on('error', () => response.destroy()); stream.pipe(response);
    } catch (error) { reject(error instanceof URIError ? 400 : 404); }
  });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(port, HOST, accept); });
  return { server, origin: `http://${HOST}:${server.address().port}` };
}

function isLocalURL(value, origin) {
  try { return new URL(value).origin === origin; } catch { return false; }
}
function isYouTubeURL(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      ['www.youtube.com', 'youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname);
  } catch { return false; }
}
module.exports = { startAssetServer, PORT, isLocalURL, isYouTubeURL };

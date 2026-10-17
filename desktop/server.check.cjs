const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { request } = require('node:http');
const { startAssetServer, isLocalURL, isYouTubeURL } = require('./server.cjs');

test('bundled assets stay on loopback, use correct MIME/CSP and cannot read outside the bundle', async t => {
  const folder = await mkdtemp(join(tmpdir(), 'reader-assets-'));
  await mkdir(join(folder, 'dist'));
  await writeFile(join(folder, 'private.txt'), 'NEVER SERVE THIS');
  await writeFile(join(folder, 'dist', 'index.html'), '<h1>Final Reader</h1>');
  await writeFile(join(folder, 'dist', 'worker.mjs'), 'postMessage(1)');
  await writeFile(join(folder, 'dist', 'module.wasm'), Buffer.from([0, 97, 115, 109]));
  const { server, origin } = await startAssetServer(join(folder, 'dist'), 0);
  t.after(async () => { await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); await rm(folder, { recursive: true }); });
  assert.equal(server.address().address, '127.0.0.1');
  const home = await fetch(origin);
  assert.equal(home.status, 200); assert.match(await home.text(), /Final Reader/);
  assert.match(home.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self' 'wasm-unsafe-eval'/);
  assert.equal(home.headers.get('access-control-allow-origin'), null);
  assert.match((await fetch(`${origin}/worker.mjs`)).headers.get('content-type'), /text\/javascript/);
  assert.equal((await fetch(`${origin}/module.wasm`)).headers.get('content-type'), 'application/wasm');
  assert.equal((await fetch(`${origin}/missing.js`)).status, 404);
  assert.equal((await fetch(origin, { method: 'POST', body: 'file' })).status, 405);
  assert.equal((await fetch(origin, { headers: { Origin: 'https://example.com' } })).status, 403);
  assert.equal(await (await fetch(origin, { method: 'HEAD' })).text(), '');
  const raw = (path, headers) => new Promise((resolve, reject) => {
    const req = request(`${origin}/`, { path, headers }, response => {
      let text = ''; response.on('data', chunk => text += chunk);
      response.on('end', () => resolve({ code: response.statusCode, text }));
    }); req.on('error', reject); req.end();
  });
  assert.equal((await raw('/', { Host: 'example.com' })).code, 421);
  for (const path of ['/../private.txt', '/%2e%2e/private.txt', '/%2e%2e%2fprivate.txt', '/..%5cprivate.txt', '/%00', '/%ZZ']) {
    const result = await raw(path);
    assert.ok(result.code >= 400, path); assert.ok(!result.text.includes('NEVER SERVE THIS'));
  }
});

test('desktop navigation allows only its exact local origin and official HTTPS YouTube links', () => {
  const origin = 'http://127.0.0.1:43763';
  assert.equal(isLocalURL(`${origin}/#book=abc`, origin), true);
  for (const url of ['http://127.0.0.1:43764', 'http://127.0.0.1.evil.test:43763', 'file:///etc/passwd', 'javascript:alert(1)']) assert.equal(isLocalURL(url, origin), false);
  assert.equal(isYouTubeURL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
  assert.equal(isYouTubeURL('https://youtu.be/dQw4w9WgXcQ'), true);
  for (const url of ['http://youtube.com', 'https://youtube.com.evil.test', 'https://youtube.com@evil.test', 'https://evil@youtube.com', 'https://youtube.com:444/', 'file:///C:/a.exe', 'javascript:alert(1)']) assert.equal(isYouTubeURL(url), false);
});

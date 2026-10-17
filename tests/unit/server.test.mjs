import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createStaticServer } from '../../scripts/serve.mjs';

test('static server serves modules but never repository metadata or secrets', async (t) => {
  const server = createStaticServer(
    fileURLToPath(new URL('../../', import.meta.url)),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((done) => server.close(done)));
  const origin = `http://127.0.0.1:${server.address().port}`;

  for (const [pathname, type] of [
    ['/', 'text/html'],
    ['/src/main.js', 'text/javascript'],
    ['/src/styles.css', 'text/css'],
  ]) {
    const response = await fetch(origin + pathname);
    assert.equal(response.status, 200, pathname);
    assert.ok(response.headers.get('content-type').startsWith(type));
  }
  for (const pathname of [
    '/.git/config',
    '/.env',
    '/package.json',
    '/scripts/serve.mjs',
    '/src/%2e%2e/.git/config',
    '/vendor/../../.env',
    '/src/%ZZ',
  ]) {
    const response = await fetch(origin + pathname);
    assert.ok([400, 404].includes(response.status), pathname);
  }
  assert.equal((await fetch(origin, { method: 'POST' })).status, 405);
  const head = await fetch(origin, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

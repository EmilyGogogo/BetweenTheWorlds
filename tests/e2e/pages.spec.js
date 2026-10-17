import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';
import { createStaticServer } from '../../scripts/serve.mjs';

test('built game loads from a GitHub Pages repository subdirectory', async ({
  page,
}) => {
  const prefix = '/BetweenTheWorlds/';
  const server = createStaticServer(
    fileURLToPath(new URL('../../dist/', import.meta.url)),
  );
  // Mount the real build at a project path. Root-relative asset URLs must fail,
  // just as they would on a GitHub Pages project site.
  server.prependListener('request', (request) => {
    request.url = request.url.startsWith(prefix)
      ? request.url.slice(prefix.length - 1)
      : '/outside-project';
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const errors = [];
  const loaded = new Set();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', (response) => {
    if (!response.ok()) errors.push(`${response.status()} ${response.url()}`);
    else loaded.add(new URL(response.url()).pathname);
  });
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin || !url.pathname.startsWith(prefix)) {
      errors.push(`Resource outside project: ${url.href}`);
      return route.abort();
    }
    return route.continue();
  });

  try {
    const startTime = new Date('2026-10-17T00:00:00Z');
    await page.clock.install({ time: startTime });
    await page.clock.pauseAt(startTime);
    await page.goto(origin + prefix);
    await expect(page.locator('#loading')).toBeHidden();
    await page.getByRole('button', { name: '进入万物之间' }).click();
    // The position diagnostic updates every 30 frames. Advance actual frames,
    // matching the existing exploration test rather than skipping the clock.
    for (let remaining = 1500; remaining > 0; remaining -= 50) {
      await page.clock.fastForward(50);
    }
    await expect(page.locator('#welcome')).toBeHidden();
    await expect(page.locator('#world')).toHaveAttribute('data-position', /,/);
    for (const asset of [
      'src/styles.css',
      'src/main.js',
      'vendor/three.module.js',
    ]) {
      expect(loaded.has(prefix + asset), asset).toBe(true);
    }
    expect(errors).toEqual([]);
  } finally {
    await page.close();
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
  }
});

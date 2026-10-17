import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  summarizeFrames,
  compareSamples,
  median,
} from '../../scripts/earth-visual-qa/metrics.mjs';
import {
  createVisualQAServer,
  injectVisualCollector,
  runtimeFingerprint,
} from '../../scripts/earth-visual-qa.mjs';
import { createStaticServer } from '../../scripts/serve.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
test('real frame statistics use timestamp differences, even median and nearest-rank P95', () => {
  const intervals = [10, 20, 30, 40];
  let timestamp = 0;
  const frames = [{ timestamp, calls: 5, geometries: 3, textures: 2 }];
  for (const ms of intervals) {
    timestamp += ms;
    frames.push({ timestamp, calls: 7, geometries: 4, textures: 3 });
  }
  const stats = summarizeFrames(frames);
  assert.equal(stats.medianMs, 25);
  assert.equal(stats.p95Ms, 40);
  assert.equal(stats.durationMs, 100);
  assert.deepEqual(stats.geometries, { start: 3, peak: 4, end: 4 });
  assert.equal(stats.calls.peak, 7);
  assert.equal(median([1, 7, 2]), 2);
  assert.equal(median([]), null);
  assert.throws(() => summarizeFrames([frames[0]]));
  assert.throws(() => summarizeFrames([frames[0], frames[0]]));
  assert.throws(() =>
    summarizeFrames([frames[0], { ...frames[1], timestamp: NaN }]),
  );
});
test('performance requires all six valid matching runs and checks median and tail independently', () => {
  const sample = (medianMs, p95Ms) => ({
    valid: true,
    version: { sourceHash: 'test-fixture-hash' },
    conditions: {
      gpu: 'test fixture',
      viewport: [1280, 720],
      reportedEnvironment: {
        device: 'fixture',
        cpu: 'fixture',
        gpu: 'fixture',
        os: 'fixture',
        browserVersion: 'fixture',
        power: 'fixture',
        memoryGiB: 16,
        refreshHz: 60,
        hardwareAcceleration: true,
      },
    },
    summary: { durationMs: 60000, medianMs, p95Ms },
  });
  const baseline = [sample(16, 20), sample(18, 22), sample(17, 21)];
  const after = [sample(17, 23), sample(18, 23), sample(17, 23)];
  assert.equal(compareSamples(baseline, after).pass, true);
  assert.equal(
    compareSamples(
      baseline,
      after.map((s) => ({ ...s, summary: { ...s.summary, p95Ms: 24 } })),
    ).pass,
    false,
  );
  assert.throws(() => compareSamples(baseline.slice(1), after));
  assert.throws(() =>
    compareSamples(
      baseline,
      after.map((s) => ({
        ...s,
        conditions: {
          ...s.conditions,
          reportedEnvironment: {
            ...s.conditions.reportedEnvironment,
            hardwareAcceleration: 'unknown',
          },
        },
      })),
    ),
  );
  assert.throws(() =>
    compareSamples(baseline, [
      ...after.slice(1),
      { ...after[0], version: { sourceHash: 'different' } },
    ]),
  );
  assert.throws(() =>
    compareSamples(baseline, [
      ...after.slice(1),
      { ...after[0], valid: false },
    ]),
  );
  assert.throws(() =>
    compareSamples(
      baseline,
      after.map((s) => ({ ...s, conditions: { gpu: 'different' } })),
    ),
  );
  assert.throws(() =>
    compareSamples(
      baseline,
      after.map((s) => ({
        ...s,
        summary: { ...s.summary, durationMs: 59000 },
      })),
    ),
  );
});
test('manual collector instruments known source in memory and fails closed for an incompatible controller', async () => {
  const source = await readFile(root + 'src/main.js', 'utf8');
  const patched = injectVisualCollector(source, {
    head: 'fixture',
    sourceHash: 'fixture',
    label: 'fixture',
  });
  assert.match(patched, /function animate\(qaFrameTimestamp\)/);
  assert.match(patched, /__earthVisualQA\?\.frame\(qaFrameTimestamp\)/);
  assert.equal(
    (patched.match(/requestAnimationFrame\(animate\)/g) || []).length,
    1,
  );
  assert.doesNotMatch(patched, /dispatchEvent|KeyboardEvent|setInterval/);
  assert.equal(await readFile(root + 'src/main.js', 'utf8'), source);
  assert.throws(() => injectVisualCollector('unsupported', {}));
  assert.equal(await runtimeFingerprint(root), await runtimeFingerprint(root));
});
test('QA endpoints are development-only, correct MIME, with source assets still restricted', async (t) => {
  const servers = [
    createVisualQAServer(root, { label: 'test' }),
    createStaticServer(root),
  ];
  for (const server of servers) {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    t.after(() => new Promise((done) => server.close(done)));
  }
  const qa = `http://127.0.0.1:${servers[0].address().port}`,
    normal = `http://127.0.0.1:${servers[1].address().port}`;
  for (const name of [
    '/src/main.js',
    '/__earth_visual_qa__/collector.js',
    '/__earth_visual_qa__/metrics.js',
  ]) {
    const response = await fetch(qa + name);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /javascript/);
  }
  assert.equal(
    (await fetch(normal + '/__earth_visual_qa__/collector.js')).status,
    404,
  );
  assert.equal((await fetch(qa + '/.git/config')).status, 404);
  assert.equal((await fetch(qa + '/scripts/earth-visual-qa.mjs')).status, 404);
  assert.equal(
    (await fetch(qa + '/__earth_visual_qa__/collector.js', { method: 'POST' }))
      .status,
    405,
  );
});

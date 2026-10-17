import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareSamples, summarizeFrames } from './earth-visual-qa/metrics.mjs';
import { createStaticServer } from './serve.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
export function injectVisualCollector(source, version) {
  const signature = 'function animate() {';
  const render = 'renderer.render(w.scene, camera);';
  if (source.split(signature).length !== 2 || source.split(render).length !== 2)
    throw new Error(
      'Manual collector requires the known single-loop Earth controller',
    );
  return (
    `import { installManualVisualQA } from '/__earth_visual_qa__/collector.js';\nlet __earthVisualQA;\n` +
    source
      .replace(signature, 'function animate(qaFrameTimestamp) {')
      .replace(
        render,
        render + '\n  __earthVisualQA?.frame(qaFrameTimestamp);',
      ) +
    `\n__earthVisualQA=installManualVisualQA({renderer,version:${JSON.stringify(version)},readState:()=>({active,started,switching,help:!$('help-panel').classList.contains('hidden'),yaw,pitch,zoom,x:getWorld(active).position.x,z:getWorld(active).position.z,keys:[...keys],moon:worlds[3]?.earthState.moon.status,sun:worlds[3]?.earthState.sun.status,ring:worlds[3]?.earthState.ringedPlanet.status,audio:Boolean(audio?.enabled)})});\n`
  );
}
export async function runtimeFingerprint(root) {
  const hash = createHash('sha256');
  async function visit(directory) {
    for (const entry of (
      await readdir(resolve(root, directory), { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = `${directory}/${entry.name}`;
      if (entry.isDirectory()) await visit(name);
      else if (/\.(js|css)$/.test(name)) {
        hash.update(name);
        hash.update(await readFile(resolve(root, name)));
      }
    }
  }
  hash.update(await readFile(resolve(root, 'index.html')));
  await visit('src');
  return hash.digest('hex');
}
export function createVisualQAServer(root, version) {
  const assets = createStaticServer(root);
  return createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (!['GET', 'HEAD'].includes(request.method)) {
      assets.emit('request', request, response);
      return;
    }
    try {
      let body;
      if (pathname === '/src/main.js')
        body = injectVisualCollector(
          await readFile(resolve(root, 'src/main.js'), 'utf8'),
          version,
        );
      else if (
        [
          '/__earth_visual_qa__/collector.js',
          '/__earth_visual_qa__/metrics.js',
        ].includes(pathname)
      )
        body = await readFile(
          new URL(
            `./earth-visual-qa/${pathname.endsWith('collector.js') ? 'collector' : 'metrics'}.mjs`,
            import.meta.url,
          ),
        );
      else {
        assets.emit('request', request, response);
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      response
        .writeHead(500, { 'Content-Type': 'text/plain' })
        .end(error.message);
    }
  });
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const comparison = process.argv.indexOf('--compare');
  if (comparison !== -1) {
    const names = process.argv.slice(comparison + 1);
    if (names.length !== 6)
      throw new Error('Provide B1 B2 B3 A1 A2 A3 JSON files');
    const samples = [];
    for (const filename of names) {
      const record = JSON.parse(await readFile(filename, 'utf8'));
      const sample = record.attempts.at(-1);
      samples.push({ ...sample, summary: summarizeFrames(sample.frames) });
    }
    const result = compareSamples(samples.slice(0, 3), samples.slice(3));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.pass ? 0 : 1);
  }
  const baseline = process.argv.includes('--baseline');
  const root = baseline
    ? resolve(project, '.local/earth-visual-baseline')
    : project;
  const port = Number(
    process.argv.find((a) => a.startsWith('--port='))?.slice(7) ??
      (baseline ? 5174 : 5173),
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid port');
  const version = {
    label: baseline ? 'B-baseline' : 'A-visual',
    head: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    sourceHash: await runtimeFingerprint(root),
  };
  const server = createVisualQAServer(root, version);
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () =>
    console.log(
      `Manual visual QA ${version.label}: http://127.0.0.1:${port}\n${version.sourceHash}`,
    ),
  );
}

import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export function createStaticServer(root) {
  const absoluteRoot = resolve(root);
  return createServer(async (request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    try {
      const pathname = decodeURIComponent(
        new URL(request.url, 'http://localhost').pathname,
      );
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      // Only game assets are exposed. Repository metadata and secrets stay private.
      if (
        !/^(index\.html|(?:src|vendor)\/[\w./-]+)$/.test(relative) ||
        relative.split('/').some((part) => part.startsWith('.')) ||
        !contentTypes[extname(relative)]
      ) {
        response.writeHead(404).end();
        return;
      }
      const filename = await realpath(resolve(absoluteRoot, relative));
      if (!filename.startsWith(absoluteRoot + sep)) {
        response.writeHead(404).end();
        return;
      }
      const body = await readFile(filename);
      response.writeHead(200, {
        'Content-Type': contentTypes[extname(filename)],
        'Content-Length': body.length,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      const status =
        error instanceof URIError || error.code === 'ERR_INVALID_URL'
          ? 400
          : 404;
      response.writeHead(status).end();
    }
  });
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  const directory = args.find((arg) => !arg.startsWith('--')) ?? '.';
  if (!['.', 'dist'].includes(directory)) {
    throw new Error('Only the project root or dist can be served.');
  }
  const port = Number(
    args.find((arg) => arg.startsWith('--port='))?.split('=')[1] ?? 5173,
  );
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('Invalid port.');
  const server = createStaticServer(resolve(projectRoot, directory));
  server.on('error', (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`万物之间: http://127.0.0.1:${port} (${directory})`);
  });
}

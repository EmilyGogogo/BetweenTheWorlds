import { cp, lstat, mkdir, rm } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');

// Validate the exact target before removing an old build, including on Windows.
if (dirname(output) !== resolve(root) || basename(output) !== 'dist') {
  throw new Error('Refusing to clean a directory outside the project dist.');
}
const existing = await lstat(output).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
});
if (existing?.isSymbolicLink()) throw new Error('dist must not be a symlink.');
await rm(output, { recursive: true, force: true });
await mkdir(output);
for (const entry of ['index.html', 'src', 'vendor', 'THIRD_PARTY_NOTICES.md']) {
  await cp(resolve(root, entry), resolve(output, entry), { recursive: true });
}
console.log('Static site written to dist/. Third-party licenses included.');

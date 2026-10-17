import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, access } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));

test('original attachments and third-party files retain recorded bytes', async () => {
  const manifest = JSON.parse(
    await readFile(resolve(root, 'prototypes/manifest.json'), 'utf8'),
  );
  for (const [filename, expected] of Object.entries(manifest.sha256)) {
    const actual = createHash('sha256')
      .update(await readFile(resolve(root, filename)))
      .digest('hex');
    assert.equal(actual, expected, filename);
  }
});

async function markdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (
      [
        '.git',
        'node_modules',
        'dist',
        '.local',
        'vendor',
        'test-results',
        'playwright-report',
      ].includes(entry.name)
    )
      continue;
    const filename = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await markdownFiles(filename)));
    else if (
      entry.name.endsWith('.md') &&
      entry.name !== 'original-play-guide.md'
    )
      files.push(filename);
  }
  return files;
}

test('local documentation links point to real files', async () => {
  for (const filename of await markdownFiles(root)) {
    const markdown = await readFile(filename, 'utf8');
    for (const match of markdown.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
      const link = match[1];
      if (/^(?:https?:|mailto:|#)/.test(link)) continue;
      const target = decodeURIComponent(link.split('#')[0]);
      await assert.doesNotReject(
        access(resolve(dirname(filename), target)),
        `${filename}: ${link}`,
      );
    }
  }
});

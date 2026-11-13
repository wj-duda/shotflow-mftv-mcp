import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resourceManifests } from './resource-manifests.mjs';

test('publikuje aktywne zasoby, pomija kopie i manifesty wewnątrz assetów', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'mcp-library-'));
  try {
    const files = ['characters/diaxi/resource.json', 'notes/xiaid/resource.json',
      '_system/audit/before/characters/diaxi/resource.json',
      'characters/diaxi/images/backup/resource.json',
      'characters/_system/diaxi/resource.json', 'projects/demo/resource.json'];
    for (const file of files) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true });
      await writeFile(path.join(root, file), '{}');
    }
    assert.deepEqual((await resourceManifests(root)).map(p => path.relative(root, p)), files.slice(0, 2));
  } finally { await rm(root, { recursive: true, force: true }); }
});

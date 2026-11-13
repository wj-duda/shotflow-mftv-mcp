import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

// Only active library slots; backups may contain complete, obsolete manifests.
export async function resourceManifests(worldRoot) {
  const result = [];
  for (const category of ['characters', 'places', 'props', 'notes', 'looks']) {
    const root = path.join(worldRoot, category);
    const entries = await readdir(root, { withFileTypes: true }).catch(error => {
      if (error.code === 'ENOENT') return [];
      throw error;
    });
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name)) continue;
      const file = path.join(root, entry.name, 'resource.json');
      const info = await stat(file).catch(error => {
        if (error.code === 'ENOENT') return null;
        throw error;
      });
      if (info?.isFile()) result.push(file);
    }
  }
  return result.sort();
}

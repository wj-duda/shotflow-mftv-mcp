import { prepareSystemData } from './system-data.mjs';
import path from 'node:path';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (key === '--live-data') args.liveData = true;
  else if (['--atv-root', '--project-id', '--account'].includes(key) && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    args[key.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = process.argv[++i];
  } else throw new Error(`Nieznany argument lub brak wartości: ${key}`);
}
const data = await prepareSystemData({ repoRoot: path.resolve(import.meta.dirname, '..'), ...args });
console.log(JSON.stringify({ generatedAt: data.generatedAt, broadcasts: data.broadcasts.length,
  tracks: data.chart.tracks.length, tags: data.tags.length, refreshed: args.liveData === true }));

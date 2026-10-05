import { readFile, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

export function validateSnapshot(data) {
  if (data?.schemaVersion !== 1 || !Number.isFinite(Date.parse(data.generatedAt)) ||
      !Array.isArray(data.broadcasts) || data.broadcasts.length > 64 ||
      !Array.isArray(data.chart?.tracks) || data.chart.tracks.length > 1000 ||
      !Array.isArray(data.tags) || data.tags.length > 1000 ||
      !Array.isArray(data.shop) || data.shop.length > 2 ||
      !['submissionCostEars', 'welcomeGrantEars'].every(k => Number.isSafeInteger(data.economy?.[k]) && data.economy[k] >= 0) ||
      data.window?.timeZone !== 'Europe/Warsaw' ||
      !['previousWeekStart', 'currentWeekStart', 'endExclusive'].every(k => Number.isFinite(Date.parse(data.window[k]))) ||
      !(data.window.previousWeekStart < data.window.currentWeekStart && data.window.currentWeekStart < data.window.endExclusive) ||
      data.broadcasts.some(b => typeof b.id !== 'string' || !Array.isArray(b.tracks) || b.tracks.length > 300) ||
      data.broadcasts.reduce((sum, b) => sum + b.tracks.length, 0) > 2000) {
    throw new Error('Niepoprawna migawka systemu; zachowano poprzednie dane.');
  }
  return data;
}

export async function prepareSystemData({ repoRoot, liveData = false, atvRoot, projectId, account, collect }) {
  const destination = path.join(repoRoot, 'site/system/snapshot.json');
  if (!liveData) {
    try { return validateSnapshot(JSON.parse(await readFile(destination, 'utf8'))); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error('Brak migawki systemu. Uruchom build z --live-data --atv-root … --project-id … --account ….');
      throw error;
    }
  }
  if (!collect && (!atvRoot || !projectId || !account)) throw new Error('--live-data wymaga --atv-root, --project-id i --account.');
  const data = validateSnapshot(await (collect ? collect() : (async () => {
    const cwd = path.resolve(atvRoot, 'panel/functions');
    const { stdout } = await promisify(execFile)(process.execPath,
      [path.join(cwd, 'scripts/export-mcp-system.mjs'), `--project-id=${projectId}`, `--account=${account}`],
      { cwd, maxBuffer: 8 * 1024 * 1024, timeout: 300000 });
    return JSON.parse(stdout);
  })()));
  const json = `${JSON.stringify(data, null, 2)}\n`;
  if (Buffer.byteLength(json) > 8 * 1024 * 1024) throw new Error('Migawka przekracza 8 MiB.');
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, json, { flag: 'wx' });
    await rename(temporary, destination);
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  return data;
}

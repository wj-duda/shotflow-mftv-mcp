import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareSystemData } from './system-data.mjs';
const fixture = () => ({ schemaVersion: 1, generatedAt: '2026-10-05T12:00:00Z', broadcasts: [], chart: { tracks: [] }, tags: [], shop: [],
  economy: { submissionCostEars: 500, welcomeGrantEars: 1500 }, window: { timeZone: 'Europe/Warsaw',
    previousWeekStart: '2026-09-27T22:00:00Z', currentWeekStart: '2026-10-04T22:00:00Z', endExclusive: '2026-10-11T22:00:00Z' } });
test('bez flagi brak odczytów sieci i brak jakichkolwiek zmian migawki', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'mcp-snapshot-test-'));
  await prepareSystemData({ repoRoot, liveData: true, collect: async () => fixture() });
  const file = path.join(repoRoot, 'site/system/snapshot.json');
  const before = await readFile(file); const metadata = await stat(file);
  await prepareSystemData({ repoRoot, collect: () => { throw new Error('Nie wolno odczytywać produkcji'); } });
  assert.deepEqual(await readFile(file), before);
  assert.equal((await stat(file)).mtimeMs, metadata.mtimeMs);
});
test('brak migawki wymaga jawnego live-data', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'mcp-snapshot-test-'));
  await assert.rejects(prepareSystemData({ repoRoot }), /--live-data/);
});
test('błąd odczytu i błędna walidacja zachowują poprzednie dane', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'mcp-snapshot-test-'));
  await prepareSystemData({ repoRoot, liveData: true, collect: async () => fixture() });
  const file = path.join(repoRoot, 'site/system/snapshot.json'); const before = await readFile(file);
  for (const collect of [async () => { throw new Error('Awaria'); }, async () => ({})]) {
    await assert.rejects(prepareSystemData({ repoRoot, liveData: true, collect }));
    assert.deepEqual(await readFile(file), before);
  }
});
test('nie publikuje migawki przekraczającej budżet ukończeń', async () => {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'mcp-snapshot-test-'));
  const data = fixture(); data.broadcasts = [{ id: 'a', tracks: Array.from({ length: 301 }, () => ({})) }];
  await assert.rejects(prepareSystemData({ repoRoot, liveData: true, collect: async () => data }), /Niepoprawna migawka/);
});

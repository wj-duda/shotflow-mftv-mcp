import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const args = parseArgs(process.argv.slice(2));
const repoRoot = path.resolve(import.meta.dirname, '..');
const siteRoot = path.resolve(repoRoot, args.output ?? 'site');
const worldSource = args.world ?? process.env.SHOTFLOW_WORLD;
const brandAssetsSource = args.brandAssets ?? process.env.MFTV_BRAND_ASSETS;
if (!worldSource) throw new Error('Podaj katalog świata przez --world albo SHOTFLOW_WORLD.');
if (!brandAssetsSource) throw new Error('Podaj katalog assetów marki przez --brand-assets albo MFTV_BRAND_ASSETS.');
const worldRoot = path.resolve(worldSource);
const worldId = path.basename(worldRoot);
const baseUrl = (args.baseUrl ?? 'https://wj-duda.github.io/shotflow-mftv-mcp').replace(/\/$/, '');
const imageCachePath = path.join(repoRoot, '.cache/image-metadata.json');
const imageCache = await readOptionalJson(imageCachePath, {});
const brandAssetsRoot = path.resolve(brandAssetsSource);

assertInside(repoRoot, siteRoot, 'Katalog wyjściowy musi znajdować się wewnątrz repozytorium.');
await requireDirectory(worldRoot, `Nie znaleziono świata: ${worldRoot}`);

const generatedAt = new Date().toISOString();
const warnings = [];
const resourceCatalogs = new Map();
const searchEntries = [];
const projectCatalog = [];
const featured = [];
const brand = {
  key: 'brand:aimftv',
  kind: 'brand',
  name: 'AI Music Future TV',
  priority: 'required-for-mftv-generation',
  description: 'Główny pakiet tożsamości marki MF TV używany przy przygotowywaniu obrazów, plansz i promptów.',
  slogans: [
    {
      id: 'emocje-na-zywo',
      key: 'slogan:emocje-na-zywo',
      purpose: 'audycje',
      text: 'Emocje na Żywo',
      preserveExactText: true,
      rationale: 'Hasło podkreśla, że istotą audycji MF TV są prawdziwe reakcje widzów, głosowanie na czacie i emocje powstające podczas wspólnej transmisji, a nie samo bierne odtwarzanie muzyki.',
      whereToUse: ['plansze promujące audycje', 'miniatury i zapowiedzi transmisji', 'posty społecznościowe o głosowaniu', 'materiały zachęcające do oglądania na żywo'],
      whenToUse: 'Gdy materiał promuje konkretną audycję, transmisję na żywo, głosowanie widzów albo wspólne przeżywanie premiery.',
      howToReference: 'W promptach i danych używaj klucza slogan:emocje-na-zywo. Tekst pokazuj dokładnie jako „Emocje na Żywo” i łącz z właściwą planszą audycji lub oficjalnym logo.',
      promotionalRequirement: 'Hasło powinno pojawiać się na materiałach promocyjnych dotyczących audycji, transmisji na żywo i głosowania widzów.',
    },
    {
      id: 'nowa-era-muzyki',
      key: 'slogan:nowa-era-muzyki',
      purpose: 'platforma',
      text: 'Nowa Era muzyki — tworzona z AI, wybrana przez ludzi',
      preserveExactText: true,
      rationale: 'Hasło wyjaśnia pełną ideę platformy: AI uczestniczy w tworzeniu muzyki, ale to ludzie słuchają, reagują i wybierają utwory. Łączy technologiczną nowość z ludzkim werdyktem.',
      whereToUse: ['główne materiały promujące platformę', 'prezentacje i opisy MF TV', 'kampanie pozyskujące twórców i widzów', 'grafiki wizerunkowe i materiały partnerskie'],
      whenToUse: 'Gdy materiał przedstawia MF TV jako platformę, wyjaśnia jej misję albo zaprasza twórców i widzów do udziału.',
      howToReference: 'W promptach i danych używaj klucza slogan:nowa-era-muzyki. Zachowaj pełne brzmienie, kolejność zdań i sens rozdzielenia części o AI od części o wyborze ludzi.',
      promotionalRequirement: 'Hasło powinno pojawiać się na głównych materiałach promocyjnych i wizerunkowych platformy MF TV.',
    },
  ],
  colors: [
    { id: 'gold', name: 'Gold', hex: '#FFC400', usage: 'Wyróżnienia i najważniejsze akcenty' },
    { id: 'cyan', name: 'Cyan', hex: '#00D5FF', usage: 'Główny akcent cyfrowy i stany pozytywne' },
    { id: 'magenta', name: 'Magenta', hex: '#FF2F75', usage: 'Emocje i akcent marki' },
    { id: 'coral', name: 'Coral', hex: '#FF4324', usage: 'Ostrzeżenia i silny kontrast' },
    { id: 'cream', name: 'Cream', hex: '#F5F5F2', usage: 'Główny kolor tekstu' },
    { id: 'night', name: 'Night', hex: '#0D0F12', usage: 'Główne tło strony' },
  ],
};
let publishedImages = 0;
let convertedImages = 0;
let reusedImages = 0;

await cleanOutput();
await writeStaticFiles();
await buildResources();
await buildFeatured();
await writeBrandDocument();
await buildProjects();

const resourceTypes = [...resourceCatalogs.entries()]
  .sort(([left], [right]) => left.localeCompare(right, 'pl'))
  .map(([type, items]) => ({
    type,
    label: typeLabel(type),
    count: items.length,
    url: absoluteUrl(`data/resources/${type}/index.json`),
  }));

const index = {
  schemaVersion: 1,
  generatedAt,
  world: { id: worldId, name: worldName(worldId) },
  usage: {
    purpose: 'Publiczny katalog świata ShotFlow dla ludzi i klientów MCP.',
    mcp: [
      'Przed generacją materiału dotyczącego MF TV pobierz brand.detailUrl i zastosuj zawarte tam zasady marki.',
      'Pobierz searchUrl i wybierz tylko rekordy potrzebne do zadania.',
      'Następnie pobierz detailUrl wybranych rekordów; nie pobieraj całej biblioteki obrazów.',
      'W promptach odwołuj się do stabilnego pola key, a obraz przekazuj z imageUrl wskazanego w szczegółach.',
    ],
  },
  counts: {
    resources: [...resourceCatalogs.values()].reduce((sum, items) => sum + items.length, 0),
    projects: projectCatalog.length,
    shots: searchEntries.filter((entry) => entry.kind === 'shot').length,
    images: publishedImages,
  },
  brand,
  featured,
  catalogs: {
    resources: resourceTypes,
    projects: {
      count: projectCatalog.length,
      url: absoluteUrl('data/projects/index.json'),
    },
    brand: {
      key: brand.key,
      priority: brand.priority,
      url: brand.detailUrl,
    },
  },
  searchUrl: absoluteUrl('data/search.json'),
  timelineUrl: absoluteUrl('data/timeline.json'),
};

await writeJson(path.join(siteRoot, 'index.json'), index);
await writeJson(path.join(siteRoot, 'data/search.json'), {
  schemaVersion: 1,
  generatedAt,
  worldId,
  entries: searchEntries.sort(compareEntries),
});
await writeJson(path.join(siteRoot, 'data/projects/index.json'), {
  schemaVersion: 1,
  generatedAt,
  worldId,
  projects: projectCatalog.sort((a, b) => a.name.localeCompare(b.name, 'pl')),
});
const timeline = projectCatalog
  .filter((project) => project.createdAt && project.thumbnailUrl)
  .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
await writeJson(path.join(siteRoot, 'data/timeline.json'), {
  schemaVersion: 1,
  generatedAt,
  worldId,
  order: 'oldest-first',
  projects: timeline,
});

for (const [type, items] of resourceCatalogs) {
  await writeJson(path.join(siteRoot, `data/resources/${type}/index.json`), {
    schemaVersion: 1,
    generatedAt,
    worldId,
    type,
    label: typeLabel(type),
    items: items.sort((a, b) => a.name.localeCompare(b.name, 'pl')),
  });
}
await writeJson(imageCachePath, imageCache);

console.log(
  `Gotowe: ${index.counts.resources} zasobów, ${index.counts.projects} projektów, ` +
    `${index.counts.shots} shotów i ${index.counts.images} obrazów.`,
);
console.log(`Obrazy: ${convertedImages} przetworzonych, ${reusedImages} wykorzystanych ponownie.`);
console.log(`Wynik: ${siteRoot}`);
for (const warning of warnings) console.warn(`OSTRZEŻENIE: ${warning}`);

async function cleanOutput() {
  const generatedNames = ['data', 'app.js', 'styles.css', 'index.html'];
  if (!args.onlyNew) generatedNames.unshift('assets');
  for (const name of generatedNames) {
    await rm(path.join(siteRoot, name), { recursive: true, force: true });
  }
  await mkdir(siteRoot, { recursive: true });
  await writeFile(path.join(siteRoot, '.nojekyll'), '', 'utf8');
}

async function writeStaticFiles() {
  const templateRoot = path.join(repoRoot, 'src/site');
  const html = (await readFile(path.join(templateRoot, 'index.html'), 'utf8'))
    .replaceAll('{{WORLD_NAME}}', escapeHtml(worldName(worldId)))
    .replaceAll('{{WORLD_ID}}', escapeHtml(worldId));
  await writeFile(path.join(siteRoot, 'index.html'), html, 'utf8');
  await writeFile(path.join(siteRoot, 'app.js'), await readFile(path.join(templateRoot, 'app.js')), 'utf8');
  await writeFile(path.join(siteRoot, 'styles.css'), await readFile(path.join(templateRoot, 'styles.css')), 'utf8');
}

async function buildResources() {
  const entries = await readdir(worldRoot, { withFileTypes: true });
  for (const category of entries.filter((entry) => entry.isDirectory() && entry.name !== 'projects')) {
    const categoryRoot = path.join(worldRoot, category.name);
    for (const manifestPath of await findNamedFiles(categoryRoot, 'resource.json')) {
      const manifest = await readJson(manifestPath);
      if (!manifest?.id || !manifest?.type) continue;

      const type = normalizeType(manifest.type);
      const id = safeSegment(manifest.id);
      const key = `${singularType(type)}:${manifest.id}`;
      const images = [];

      for (const image of manifest.images ?? []) {
        if (!image?.file || !image?.id) continue;
        const source = safeSource(path.dirname(manifestPath), image.file);
        const targetBase = `assets/resources/${type}/${id}/${safeSegment(image.id)}`;
        const published = await publishOrWarn(source, targetBase, `${key} wskazuje brakujący obraz ${image.file}`);
        if (!published) continue;
        images.push({
          id: image.id,
          role: image.role ?? 'reference',
          ...published,
        });
      }

      const detailPath = `data/resources/${type}/${id}.json`;
      const detail = {
        schemaVersion: 1,
        generatedAt,
        worldId,
        kind: 'resource',
        key,
        type,
        id: manifest.id,
        name: manifest.name ?? manifest.id,
        description: manifest.description ?? '',
        images,
        updatedAt: manifest.updatedAt ?? null,
      };
      await writeJson(path.join(siteRoot, detailPath), detail);

      const summary = summarize(detail.description);
      const listing = {
        key,
        kind: 'resource',
        type,
        id: manifest.id,
        name: detail.name,
        summary,
        imageCount: images.length,
        thumbnailUrl: images[0]?.thumbnailUrl ?? null,
        detailUrl: absoluteUrl(detailPath),
      };
      if (!resourceCatalogs.has(type)) resourceCatalogs.set(type, []);
      resourceCatalogs.get(type).push(listing);
      searchEntries.push(listing);
    }
  }
}

async function buildProjects() {
  const projectsRoot = path.join(worldRoot, 'projects');
  if (!(await isDirectory(projectsRoot))) return;

  const projectDirs = (await readdir(projectsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  for (const projectDir of projectDirs) {
    const projectRoot = path.join(projectsRoot, projectDir.name);
    const workspacePath = path.join(projectRoot, 'workspace.json');
    if (!(await isFile(workspacePath))) continue;
    const workspace = await readJson(workspacePath);
    const projectId = safeSegment(workspace.id ?? projectDir.name);
    const projectName = workspace.displayName ?? workspace.id ?? projectDir.name;
    const shots = [];
    const projectDates = [];

    for (const shotPath of await findNamedFiles(path.join(projectRoot, 'shots'), 'shot.json')) {
      const shot = await readJson(shotPath);
      if (!shot?.id) continue;
      const shotId = safeSegment(shot.id);
      const images = [];
      for (const frame of shot.frames ?? []) {
        if (isUsefulDate(frame?.createdAt)) projectDates.push(new Date(frame.createdAt).toISOString());
        if (!frame?.image || !frame?.id) continue;
        const source = safeSource(path.dirname(shotPath), frame.image);
        const targetBase = `assets/projects/${projectId}/shots/${shotId}/${safeSegment(frame.id)}`;
        const published = await publishOrWarn(source, targetBase, `shot:${workspace.id}/${shot.id} wskazuje brakujący obraz ${frame.image}`);
        if (!published) continue;
        images.push({
          id: frame.id,
          revision: frame.revision ?? null,
          source: frame.source ?? null,
          referenceKeys: frame.referenceKeys ?? [],
          ...published,
        });
      }

      const key = `shot:${workspace.id ?? projectDir.name}/${shot.id}`;
      const detailPath = `data/projects/${projectId}/shots/${shotId}.json`;
      const detail = {
        schemaVersion: 1,
        generatedAt,
        worldId,
        kind: 'shot',
        key,
        id: shot.id,
        title: shot.title ?? shot.id,
        description: shot.description ?? '',
        project: { id: workspace.id ?? projectDir.name, name: projectName },
        references: shot.references ?? [],
        prompts: {
          image: shot.prompts?.image ?? '',
          endFrameDescription: shot.prompts?.endFrameDescription ?? '',
          animation: shot.prompts?.animation ?? '',
        },
        media: shot.media ?? null,
        frameStatus: shot.frameStatus ?? null,
        images,
      };
      await writeJson(path.join(siteRoot, detailPath), detail);

      const listing = {
        key,
        kind: 'shot',
        type: 'shots',
        id: shot.id,
        name: detail.title,
        projectId: workspace.id ?? projectDir.name,
        projectName,
        summary: summarize(detail.description),
        imageCount: images.length,
        imageUrl: images[0]?.imageUrl ?? null,
        thumbnailUrl: images[0]?.thumbnailUrl ?? null,
        detailUrl: absoluteUrl(detailPath),
      };
      shots.push(listing);
      searchEntries.push(listing);
    }

    const projectIndexPath = `data/projects/${projectId}/index.json`;
    const shotsWithImages = shots.filter((shot) => shot.imageUrl);
    const representative = shotsWithImages[Math.floor(shotsWithImages.length / 2)] ?? shotsWithImages.at(-1) ?? null;
    const createdAt = projectDates.sort()[0] ?? null;
    const projectKey = `project:${workspace.id ?? projectDir.name}`;
    const projectDescription = shots.length
      ? `${projectName}: ${shots.length} shotów w archiwum ShotFlow.`
      : `${projectName}: projekt bez opublikowanych shotów.`;
    await writeJson(path.join(siteRoot, projectIndexPath), {
      schemaVersion: 1,
      generatedAt,
      worldId,
      kind: 'project',
      key: projectKey,
      type: 'projects',
      id: workspace.id ?? projectDir.name,
      name: projectName,
      description: projectDescription,
      createdAt,
      images: representative ? [{
        id: 'representative-frame',
        role: 'representative-frame',
        imageUrl: representative.imageUrl,
        thumbnailUrl: representative.thumbnailUrl,
      }] : [],
      shots: shots.sort((a, b) => a.name.localeCompare(b.name, 'pl')),
    });
    const projectListing = {
      key: projectKey,
      kind: 'project',
      type: 'projects',
      id: workspace.id ?? projectDir.name,
      name: projectName,
      summary: projectDescription,
      createdAt,
      shotCount: shots.length,
      imageCount: representative ? 1 : 0,
      imageUrl: representative?.imageUrl ?? null,
      thumbnailUrl: representative?.thumbnailUrl ?? null,
      detailUrl: absoluteUrl(projectIndexPath),
      url: absoluteUrl(projectIndexPath),
    };
    projectCatalog.push(projectListing);
  }
}

async function buildFeatured() {
  const definitions = [
    {
      key: 'brand:aimftv',
      kind: 'brand',
      type: 'brand',
      id: 'aimftv',
      name: 'AI Music Future TV',
      summary: 'Oficjalne, pełnokolorowe logo MF TV.',
      description: 'Kanoniczne logo AI Music Future TV: błękitne AI, żółte MF i różowe, odręczne TV z mocnymi czarnymi obrysami.',
      source: path.join(worldRoot, 'props/logo-aimftv-kolor/images/image-001.png'),
      role: 'logo',
    },
    {
      key: 'show:lekkie-poniedzialki',
      kind: 'show', type: 'brand', id: 'lekkie-poniedzialki', name: 'Lekkie Poniedziałki',
      summary: 'Lżejszy start tygodnia z melodyjnymi, przystępnymi i radiowymi utworami AI.',
      description: 'Lekkie Poniedziałki to audycja MFTV z utworami AI o lżejszej energii: pop, soft rock, elektronika, ballady i melodyjne eksperymenty.',
      source: path.join(brandAssetsRoot, 'v2/Lekkie Poniedziałki.webp'), role: 'show-board',
    },
    {
      key: 'show:szarpane-srody',
      kind: 'show', type: 'brand', id: 'szarpane-srody', name: 'Szarpane Środy',
      summary: 'Środek tygodnia dla gitar, mocniejszych refrenów i bardziej nerwowej energii.',
      description: 'Szarpane Środy to audycja MFTV dla bardziej dynamicznych utworów AI: rocka, gitar, mocniejszych aranżacji i szybszych beatów.',
      source: path.join(brandAssetsRoot, 'v2/Szarpane Środy.webp'), role: 'show-board',
    },
    {
      key: 'show:czule-czwartki',
      kind: 'show', type: 'brand', id: 'czule-czwartki', name: 'Czułe Czwartki',
      summary: 'Czwartkowe spotkanie z balladami, melancholią, miłością i delikatniejszymi utworami AI.',
      description: 'Czułe Czwartki to audycja MFTV dla utworów ciepłych, bliskich i emocjonalnych: ballad, melancholii, miłości i tęsknoty.',
      source: path.join(brandAssetsRoot, 'v2/Czułe Czwartki.webp'), role: 'show-board',
    },
    {
      key: 'show:wolne-piatki',
      kind: 'show', type: 'brand', id: 'wolne-piatki', name: 'Wolne Piątki',
      summary: 'Piątkowa przestrzeń na wolniejsze, dziwniejsze albo bardziej nastrojowe utwory AI.',
      description: 'Wolne Piątki to audycja MFTV z większą swobodą gatunkową: utwory nastrojowe, dziwne, wolniejsze i eksperymentalne.',
      source: path.join(brandAssetsRoot, 'v2/Wolne Piątki.webp'), role: 'show-board',
    },
    {
      key: 'show:zlote-emoji',
      kind: 'show', type: 'brand', id: 'zlote-emoji', name: 'Złote Emoji',
      summary: 'Finał i wyróżnienie utworów, które zebrały najmocniejsze reakcje emoji widzów.',
      description: 'Złote Emoji to rankingowa formuła MFTV, w której utwory zbierają reakcje emoji podczas emisji.',
      source: path.join(brandAssetsRoot, 'v2/Złote Emoji.webp'), role: 'show-board',
    },
  ];

  for (const definition of definitions) {
    const targetBase = `assets/featured/${definition.kind}/${definition.id}`;
    const image = await publishOrWarn(definition.source, targetBase, `${definition.key}: nie znaleziono stałej grafiki`);
    if (!image) continue;
    const detailPath = `data/featured/${definition.kind}/${definition.id}.json`;
    const detail = {
      schemaVersion: 1,
      generatedAt,
      worldId,
      kind: definition.kind,
      key: definition.key,
      type: definition.type,
      id: definition.id,
      name: definition.name,
      description: definition.description,
      ...(definition.kind === 'brand' ? { slogans: brand.slogans, colors: brand.colors } : {}),
      images: [{ id: 'image-001', role: definition.role, ...image }],
    };
    await writeJson(path.join(siteRoot, detailPath), detail);
    const listing = {
      key: definition.key,
      kind: definition.kind,
      type: definition.type,
      id: definition.id,
      name: definition.name,
      summary: definition.summary,
      imageCount: 1,
      thumbnailUrl: image.thumbnailUrl,
      imageUrl: image.imageUrl,
      detailUrl: absoluteUrl(detailPath),
      fixed: true,
    };
    featured.push(listing);
    searchEntries.push(listing);
  }
}

async function writeBrandDocument() {
  const detailPath = 'data/brand.json';
  brand.detailUrl = absoluteUrl(detailPath);
  const logo = featured.find((entry) => entry.kind === 'brand') ?? null;
  const shows = featured.filter((entry) => entry.kind === 'show');
  const document = {
    schemaVersion: 1,
    generatedAt,
    worldId,
    ...brand,
    generationGuidance: {
      whenToUse: 'Zawsze, gdy generowany obraz, plansza, miniatura lub tekst wizualny ma reprezentować MF TV albo jedną z jego audycji.',
      requiredRules: [
        'Użyj dostarczonego obrazu oficjalnego logo jako referencji; nie przerysowuj, nie zmieniaj liter, proporcji ani kolorów znaku.',
        'Stosuj paletę strony według pól colors[].hex i colors[].usage.',
        'Jeżeli materiał zawiera hasło marki, zachowaj dokładną pisownię z slogans[].text.',
        'Planszę konkretnej audycji traktuj jako referencję jej identyfikacji, a nie jako luźną inspirację stylistyczną.',
        'Nie dodawaj nowych logotypów, sloganów ani kolorów udających element oficjalnego systemu marki.',
      ],
      promptBlock: 'Apply the official AI Music Future TV brand system from the attached references. Preserve the supplied logo exactly without redrawing, restyling, changing letters, proportions or colors. Use the documented MF TV website palette according to each color role. If brand copy is requested, reproduce the selected official slogan exactly.',
    },
    images: logo ? [{
      id: 'official-logo',
      role: 'official-logo',
      imageUrl: logo.imageUrl,
      thumbnailUrl: logo.thumbnailUrl,
    }] : [],
    primaryLogo: logo && {
      key: logo.key,
      imageUrl: logo.imageUrl,
      thumbnailUrl: logo.thumbnailUrl,
    },
    showBoards: shows.map((entry) => ({
      key: entry.key,
      name: entry.name,
      description: entry.summary,
      imageUrl: entry.imageUrl,
      thumbnailUrl: entry.thumbnailUrl,
      detailUrl: entry.detailUrl,
    })),
  };
  await writeJson(path.join(siteRoot, detailPath), document);
  for (const slogan of brand.slogans) {
    const sloganPath = `data/brand/slogans/${slogan.id}.json`;
    await writeJson(path.join(siteRoot, sloganPath), {
      schemaVersion: 1,
      generatedAt,
      worldId,
      kind: 'slogan',
      type: 'brand',
      brandKey: brand.key,
      ...slogan,
      relatedAssets: {
        officialLogo: logo?.imageUrl ?? null,
        showBoards: shows.map((entry) => ({ key: entry.key, imageUrl: entry.imageUrl })),
      },
    });
    searchEntries.push({
      key: slogan.key,
      kind: 'slogan',
      type: 'brand',
      id: slogan.id,
      name: slogan.text,
      summary: slogan.rationale,
      imageCount: 0,
      thumbnailUrl: null,
      detailUrl: absoluteUrl(sloganPath),
      fixed: true,
    });
  }
  if (logo) {
    logo.detailUrl = brand.detailUrl;
    logo.summary = brand.description;
  }
}

async function publishOrWarn(source, targetBase, warning) {
  if (!source) {
    warnings.push(warning);
    return null;
  }
  try {
    return await publishImage(source, targetBase);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    warnings.push(warning);
    return null;
  }
}

async function publishImage(source, targetBase) {
  const fullRelative = `${targetBase}.webp`;
  const thumbnailRelative = `${targetBase}-thumb.webp`;
  const fullTarget = path.join(siteRoot, fullRelative);
  const thumbnailTarget = path.join(siteRoot, thumbnailRelative);
  await mkdir(path.dirname(fullTarget), { recursive: true });
  const sourceStats = await stat(source);
  const cached = imageCache[source];
  const cacheMatches = cached?.mtimeMs === sourceStats.mtimeMs && cached?.size === sourceStats.size;
  const canReuse = args.onlyNew && (cacheMatches || await outputsAreFresh(sourceStats, [fullTarget, thumbnailTarget]));
  let metadata;
  if (canReuse) {
    metadata = cacheMatches ? cached : await sharp(fullTarget, { failOn: 'none' }).metadata();
    reusedImages += 1;
  } else {
    const image = sharp(source, { failOn: 'none' }).rotate();
    metadata = await image.metadata();
    await Promise.all([
      image.clone().resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toFile(fullTarget),
      image.clone().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).webp({ quality: 72 }).toFile(thumbnailTarget),
    ]);
    convertedImages += 1;
  }
  imageCache[source] = {
    mtimeMs: sourceStats.mtimeMs,
    size: sourceStats.size,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
  publishedImages += 1;
  return {
    imageUrl: absoluteUrl(fullRelative),
    thumbnailUrl: absoluteUrl(thumbnailRelative),
    width: metadata.width ?? null,
    height: metadata.height ?? null,
    contentType: 'image/webp',
  };
}

async function findNamedFiles(root, fileName) {
  if (!(await isDirectory(root))) return [];
  const results = [];
  const queue = [root];
  while (queue.length) {
    const current = queue.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === '_system' || entry.name === '_cache') continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(fullPath);
      else if (entry.isFile() && entry.name === fileName) results.push(fullPath);
    }
  }
  return results.sort();
}

function safeSource(root, relativeFile) {
  if (path.isAbsolute(relativeFile)) return null;
  const resolved = path.resolve(root, relativeFile);
  return resolved.startsWith(`${path.resolve(root)}${path.sep}`) ? resolved : null;
}

function absoluteUrl(relativePath) {
  return `${baseUrl}/${relativePath.split(path.sep).map(encodeURIComponent).join('/')}`;
}

function normalizeType(type) {
  return safeSegment(String(type).toLowerCase());
}

function singularType(type) {
  return ({ characters: 'character', places: 'place', props: 'prop', notes: 'note', looks: 'look' })[type] ?? type.replace(/s$/, '');
}

function typeLabel(type) {
  return ({ characters: 'Postacie', places: 'Miejsca', props: 'Rekwizyty', notes: 'Notatki', looks: 'Style' })[type] ?? type;
}

function worldName(id) {
  return id === 'aimftv' ? 'Świat MF TV' : id;
}

function summarize(value, maxLength = 280) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function safeSegment(value) {
  const result = String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  if (!result || result === '.' || result === '..') throw new Error(`Nieprawidłowy identyfikator: ${value}`);
  return result;
}

function compareEntries(a, b) {
  return a.name.localeCompare(b.name, 'pl') || a.key.localeCompare(b.key);
}

function parseArgs(values) {
  const parsed = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith('--')) throw new Error(`Nieznany argument: ${value}`);
    const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key === 'onlyNew') {
      parsed[key] = true;
      continue;
    }
    const next = values[index + 1];
    if (!next || next.startsWith('--')) throw new Error(`Brak wartości dla ${value}`);
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function isUsefulDate(value) {
  if (!value) return false;
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.getUTCFullYear() >= 2000;
}

async function outputsAreFresh(sourceStats, outputs) {
  try {
    const outputStats = await Promise.all(outputs.map((output) => stat(output)));
    return outputStats.every((output) => output.isFile() && output.size > 0 && output.mtimeMs >= sourceStats.mtimeMs);
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readOptionalJson(filePath, fallback) {
  try { return await readJson(filePath); } catch { return fallback; }
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function isFile(filePath) {
  try { return (await stat(filePath)).isFile(); } catch { return false; }
}

async function isDirectory(filePath) {
  try { return (await stat(filePath)).isDirectory(); } catch { return false; }
}

async function requireDirectory(filePath, message) {
  if (!(await isDirectory(filePath))) throw new Error(message);
}

function assertInside(parent, child, message) {
  const relative = path.relative(parent, child);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(message);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

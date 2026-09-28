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
const worldRoot = path.resolve(worldSource);
const worldId = path.basename(worldRoot);
const universeId = args.universeId ?? (worldId === 'aimftv' ? 'mf-tv' : worldId);
const publicationBaseUrl = (args.publicationBaseUrl ?? 'https://wj-duda.github.io/shotflow-mftv-mcp').replace(/\/$/, '');
const baseUrl = (args.baseUrl ?? (universeId === 'mf-tv' ? publicationBaseUrl : `${publicationBaseUrl}/${universeId}`)).replace(/\/$/, '');
const imageCachePath = path.join(repoRoot, '.cache/image-metadata.json');
const imageCache = await readOptionalJson(imageCachePath, {});
const buildsMftvBrand = universeId === 'mf-tv';
const sharesMftvBrand = universeId === 'mf-creators';
const hasMftvBrand = buildsMftvBrand || sharesMftvBrand;
const generationProfile = universeId === 'mf-creators'
  ? {
      requiredLookKey: 'look:rock-comic',
      rule: 'Każda generacja obrazu w MF Creators musi stosować nadrzędny look rockowo-komiksowy oraz indywidualny wariant zapisany przy wybranych postaciach.',
    }
  : null;
const brandShows = hasMftvBrand ? [
  {
    id: 'lekkie-poniedzialki', key: 'show:lekkie-poniedzialki', name: 'Lekkie Poniedziałki', shortName: 'LP',
    schedule: { day: 'poniedziałek', time: '20:15', timezone: 'Europe/Warsaw', recurrence: 'co tydzień' },
    summary: 'Lżejszy start tygodnia z melodyjnymi, przystępnymi i radiowymi utworami AI.',
    description: 'Lekkie Poniedziałki to audycja MFTV z utworami AI o lżejszej energii: pop, soft rock, elektronika, ballady i melodyjne eksperymenty. Odcinki pomagają odkrywać nowe numery bez ciężkiego wejścia w tydzień.',
    audience: 'Dla widzów, którzy chcą zacząć tydzień od przystępnych piosenek AI i spokojniejszego głosowania emoji.',
    rules: ['Pierwszeństwo mają utwory lekkie, melodyjne i przystępne.', 'Dopuszczalne są gatunkowe wycieczki, o ile nie dominują ciężkie, agresywne brzmienia.', 'Widzowie oceniają utwory reakcjami emoji podczas emisji.'],
  },
  {
    id: 'szarpane-srody', key: 'show:szarpane-srody', name: 'Szarpane Środy', shortName: 'SŚ',
    schedule: { day: 'środa', time: '20:15', timezone: 'Europe/Warsaw', recurrence: 'co tydzień' },
    summary: 'Środek tygodnia dla gitar, mocniejszych refrenów i bardziej nerwowej energii.',
    description: 'Szarpane Środy to audycja MFTV dla bardziej dynamicznych utworów AI: rocka, gitar, mocniejszych aranżacji, szybszych beatów i numerów, które lepiej działają w środku tygodnia.',
    audience: 'Dla widzów, którzy szukają większej energii, gitarowego nerwu i mocniejszych reakcji na czacie.',
    rules: ['Pierwszeństwo mają rock, metal, punk, industrial, gitary i mocna energia.', 'Pasują również mroczne, buntownicze i dynamiczne tematy.', 'Łagodny pop, muzyka taneczna i ballady nie powinny wyznaczać charakteru audycji.'],
  },
  {
    id: 'czule-czwartki', key: 'show:czule-czwartki', name: 'Czułe Czwartki', shortName: 'CC',
    schedule: { day: 'czwartek', time: '20:15', timezone: 'Europe/Warsaw', recurrence: 'co tydzień' },
    summary: 'Czwartkowe spotkanie z balladami, melancholią, miłością i delikatniejszymi utworami AI.',
    description: 'Czułe Czwartki to audycja MFTV dla utworów ciepłych, bliskich i emocjonalnych: ballad, melancholii, opowieści o miłości i tęsknocie oraz spokojniejszych kompozycji AI, które najlepiej działają bez pośpiechu.',
    audience: 'Dla widzów, którzy szukają emocji, melodii i utworów zostających w głowie dłużej niż jeden refren.',
    rules: ['Pierwszeństwo mają ballady, soul, ambient, jazz, chill i spokojne kompozycje filmowe.', 'Ważne są czułość, bliskość, miłość, tęsknota, wspomnienia i melancholia.', 'Ciężkie, agresywne i klubowe brzmienia nie powinny dominować.'],
  },
  {
    id: 'wolne-piatki', key: 'show:wolne-piatki', name: 'Wolne Piątki', shortName: 'WP',
    schedule: { day: 'piątek', time: '20:45', timezone: 'Europe/Warsaw', recurrence: 'co tydzień' },
    summary: 'Piątkowa przestrzeń na wolniejsze, dziwniejsze albo bardziej nastrojowe utwory AI.',
    description: 'Wolne Piątki to audycja MFTV z większą swobodą gatunkową. Trafiają tu utwory AI nastrojowe, dziwne, wolniejsze, eksperymentalne albo takie, które potrzebują więcej miejsca niż klasyczny blok przebojowy.',
    audience: 'Dla widzów, którzy lubią mniej oczywiste kawałki, wolniejsze tempo i większą ciekawość niż prostą selekcję singli.',
    rules: ['Pierwszeństwo mają rap, dub, reggae, drum and bass oraz miejskie i eksperymentalne kierunki.', 'Liczą się swoboda, nocny klimat, podróż, ulica i nieoczywista narracja.', 'Klasyczny pop, dance i disco polo nie powinny wyznaczać charakteru audycji.'],
  },
  {
    id: 'zlote-emoji', key: 'show:zlote-emoji', name: 'Złote Emoji', shortName: 'ZE',
    schedule: { day: 'niedziela', time: '19:30', timezone: 'Europe/Warsaw', recurrence: 'co tydzień' },
    summary: 'Finał i wyróżnienie utworów, które zebrały najmocniejsze reakcje emoji widzów.',
    description: 'Złote Emoji to rankingowa formuła MFTV. Utwory zbierają reakcje emoji podczas emisji, a najmocniejsze wyniki mogą trafić do specjalnych bloków i listy przebojów AI Music Future TV.',
    audience: 'Dla widzów, którzy chcą współdecydować o widoczności utworów przez reakcje na czacie YouTube.',
    rules: ['To audycja rankingowa z widocznymi miejscami utworów.', 'O wyniku współdecydują reakcje emoji widzów zebrane podczas emisji.', 'Materiały promocyjne powinny jasno komunikować ranking, głosowanie i wynik społeczności.'],
  },
] : [];
const typographyPaths = hasMftvBrand ? {
  'mf-tv': {
    id: 'mf-tv',
    name: 'MF TV — solidna typografia antenowa',
    direction: 'Nowoczesna, mocna i bardzo czytelna typografia ekranowa, zgodna z kolorowym logo oraz oprawą strony i transmisji.',
    families: [
      {
        family: 'Jost',
        roles: ['nagłówki', 'nazwy audycji', 'liczniki', 'krótkie komunikaty antenowe', 'CTA'],
        weights: [700, 800, 900],
        specimenUrl: 'https://fonts.google.com/specimen/Jost',
        rules: ['Stosuj zwarte nagłówki bez sztucznego rozciągania.', 'Najważniejsze komunikaty mogą używać wersalików, ale nie składaj nimi długich akapitów.'],
      },
      {
        family: 'Noto Sans',
        roles: ['tekst podstawowy', 'opisy', 'podpisy', 'tabele i ranking', 'dłuższe komunikaty'],
        weights: [400, 500, 600, 700, 800],
        specimenUrl: 'https://fonts.google.com/specimen/Noto+Sans',
        rules: ['To podstawowy krój tekstowy strony MF TV i bezpieczny wybór dla polskich znaków.', 'Używaj cyfr tabelarycznych w rankingach, jeśli środowisko składu je obsługuje.'],
      },
    ],
    googleFontsCssUrl: 'https://fonts.googleapis.com/css2?family=Jost:wght@700;800;900&family=Noto+Sans:wght@400;500;600;700;800&display=swap&subset=latin-ext',
    hierarchy: {
      display: 'Jost 900',
      heading: 'Jost 800',
      body: 'Noto Sans 400–600',
      label: 'Noto Sans 700–800',
    },
    compositionRules: [
      'Logo zawsze pozostaje dostarczonym assetem; nigdy nie próbuj odtwarzać jego liter zwykłym fontem.',
      'Typografia ma być czytelna na ekranie transmisji, także w małym rozmiarze i przy kompresji wideo.',
      'Buduj hierarchię wagą, rozmiarem i kolorem marki, a nie efektami 3D, chromem lub przypadkowym obrysem.',
      'Nie używaj więcej niż dwóch rodzin w jednym materiale.',
    ],
  },
  'mf-creators': {
    id: 'mf-creators',
    name: 'MF Creators — rockowy komiks z pazurem',
    direction: 'Energetyczna, rockowa typografia z lekkim komiksowym charakterem: mocny plakat koncertowy, ręcznie rysowany akcent i kontrolowany chaos.',
    families: [
      {
        family: 'Barlow Condensed',
        roles: ['główne nagłówki', 'nazwy twórców', 'tytuły plakatowe', 'napisy o wysokiej energii'],
        weights: [600, 700, 800, 900],
        specimenUrl: 'https://fonts.google.com/specimen/Barlow+Condensed',
        rules: ['To podstawowy krój świata MF Creators: wąski, mocny i plakatowy.', 'Dopuszczalne są wersaliki, ciasny skład i lekki kontrolowany skos całego bloku.'],
      },
      {
        family: 'Bangers',
        roles: ['pojedyncze słowo-akcent', 'onomatopeja', 'krótki komiksowy okrzyk', 'naklejka lub pieczęć'],
        weights: [400],
        specimenUrl: 'https://fonts.google.com/specimen/Bangers',
        rules: ['Używaj oszczędnie: najwyżej jeden krótki akcent na kompozycję.', 'Nie używaj do opisów, harmonogramów, nazwisk ani długich tytułów.', 'Jeżeli brakuje poprawnego polskiego znaku, zastąp cały akcent krojem Barlow Condensed 900; nigdy nie dorabiaj glifu ręcznie.'],
      },
      {
        family: 'Noto Sans',
        roles: ['tekst informacyjny', 'opis', 'data i godzina', 'podpisy oraz drobny druk'],
        weights: [400, 500, 600, 700, 800],
        specimenUrl: 'https://fonts.google.com/specimen/Noto+Sans',
        rules: ['Zapewnia czytelny kontrapunkt dla ekspresyjnych nagłówków i pełne polskie znaki.'],
      },
    ],
    googleFontsCssUrl: 'https://fonts.googleapis.com/css2?family=Bangers&family=Barlow+Condensed:wght@600;700;800;900&family=Noto+Sans:wght@400;500;600;700;800&display=swap&subset=latin-ext',
    hierarchy: {
      display: 'Barlow Condensed 900',
      comicAccent: 'Bangers 400',
      heading: 'Barlow Condensed 700–800',
      body: 'Noto Sans 400–600',
      label: 'Noto Sans 700–800',
    },
    compositionRules: [
      'Rockowy charakter buduj skalą, rytmem, kontrastem i asymetrią, nie przez losowe deformowanie liter.',
      'Komiksowy akcent jest dodatkiem, nie domyślnym krojem całego materiału.',
      'Dopuszczalny jest kontrolowany obrys lub cień dla czytelności, ale bez plastikowego 3D i chromowanych gradientów.',
      'Nie używaj więcej niż trzech rodzin, przy czym Bangers liczy się wyłącznie jako pojedynczy akcent.',
    ],
  },
} : {};
const brandTypography = hasMftvBrand ? {
  policyName: 'Typografia AI Music Future',
  activePath: universeId,
  active: typographyPaths[universeId],
  commonRules: [
    'BEZWZGLĘDNY ZAKAZ STOSOWANIA „AI SLOP FONT”.',
    'Tekst ma być składany świadomie z podanych rodzin fontów, a nie generowany jako część obrazu przez model graficzny.',
    'Zakazane są generyczne pseudo-luksusowe i pseudo-filmowe litery kojarzone z masową grafiką AI: przypadkowe szeryfy, fałszywe glify, nieczytelne ligatury, chrom, plastikowe 3D, nadmiar poświaty oraz dekoracja udająca typografię.',
    'Nie wolno mieszać krojów, deformować znaków ani tworzyć fikcyjnych liter i polskich znaków diakrytycznych.',
    'Jeżeli generator obrazu nie potrafi zachować tekstu dokładnie, wygeneruj kompozycję bez tekstu i dodaj napis później w programie graficznym.',
    'Każdy napis musi zachować dokładną treść, polskie znaki, hierarchię, kontrast i bezpieczne marginesy.',
  ],
  paths: typographyPaths,
} : null;
if (buildsMftvBrand && !brandAssetsSource) throw new Error('Dla mf-tv podaj katalog assetów marki przez --brand-assets albo MFTV_BRAND_ASSETS.');
const brandAssetsRoot = brandAssetsSource ? path.resolve(brandAssetsSource) : null;

assertInside(repoRoot, siteRoot, 'Katalog wyjściowy musi znajdować się wewnątrz repozytorium.');
await requireDirectory(worldRoot, `Nie znaleziono świata: ${worldRoot}`);
const worldMetadata = await readOptionalJson(path.join(worldRoot, 'world.json'), {});
const worldDisplayName = String(worldMetadata.name || worldName(worldId));

const generatedAt = new Date().toISOString();
const warnings = [];
const unresolvedReferences = new Set();
const resourceCatalogs = new Map();
const resourceEntriesByKey = new Map();
const searchEntries = [];
const projectCatalog = [];
const storyEvents = [];
const featured = [];
const brand = hasMftvBrand ? {
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
  shows: brandShows,
  showInformation: {
    scheduleSource: 'Aktualne zaplanowane audycje w produkcyjnym Firestore',
    rulesSource: 'config/televisionLineupTemplates oraz publiczne zasady formatu Złote Emoji',
    verifiedAt: '2026-09-28',
    scheduleNote: 'Godziny opisują bieżącą ramówkę w strefie Europe/Warsaw i mogą zmienić się w przyszłości.',
  },
  typography: brandTypography,
} : null;
let publishedImages = 0;
let convertedImages = 0;
let reusedImages = 0;

await cleanOutput();
await writeStaticFiles();
await buildResources();
if (buildsMftvBrand) {
  await buildFeatured();
  await writeBrandDocument();
} else if (sharesMftvBrand) {
  await loadSharedBrand();
}
await buildProjects();
await writeUniverseDirectory();

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
  universe: { id: universeId, name: worldDisplayName },
  world: { id: worldId, name: worldDisplayName },
  generationProfile,
  usage: {
    purpose: 'Publiczny katalog świata ShotFlow dla ludzi i klientów MCP.',
    mcp: [
      ...(hasMftvBrand ? ['Pakiet marki pobieraj wyłącznie dla jawnych materiałów promocyjnych, plansz, logo, sloganów lub identyfikacji audycji.'] : []),
      'Pobierz searchUrl i wybierz tylko rekordy potrzebne do zadania.',
      'Przed ustaleniem wyglądu w danym momencie pobierz eventsUrl. Projekty są tam ułożone od najnowszych, a shoty wewnątrz projektu zgodnie z przebiegiem historii.',
      'Stan obecny ustalaj z najpóźniejszego pasującego wydarzenia; starszy obraz jest historyczny i nie może zastąpić późniejszej transformacji, stroju ani stanu miejsca.',
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
    ...(brand ? { brand: {
      key: brand.key,
      priority: brand.priority,
      url: brand.detailUrl,
    } } : {}),
  },
  universesUrl: `${publicationBaseUrl}/universes.json`,
  searchUrl: absoluteUrl('data/search.json'),
  timelineUrl: absoluteUrl('data/timeline.json'),
  eventsUrl: absoluteUrl('data/events.json'),
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
  order: 'newest-first',
  projects: [...projectCatalog].sort(compareProjectsNewestFirst),
});
const timeline = projectCatalog
  .filter((project) => project.createdAt && project.thumbnailUrl)
  .sort(compareProjectsNewestFirst);
await writeJson(path.join(siteRoot, 'data/timeline.json'), {
  schemaVersion: 1,
  generatedAt,
  worldId,
  order: 'newest-first',
  projects: timeline,
});
await writeJson(path.join(siteRoot, 'data/events.json'), {
  schemaVersion: 1,
  generatedAt,
  worldId,
  order: 'projects-newest-first; canonical timeline clips oldest-to-newest inside each project; off-timeline project materials last',
  currentStateRule: 'For current canon, use only canonicalEvent=true: select the newest matching project and then the matching event with the greatest lastSequence. Off-timeline materials cannot override saved timeline events. Older events remain valid only for their historical story moment.',
  events: [...storyEvents].sort(compareEventsForBrowsing),
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
    .replaceAll('{{WORLD_NAME}}', escapeHtml(worldDisplayName))
    .replaceAll('{{WORLD_ID}}', escapeHtml(worldId));
  await writeFile(path.join(siteRoot, 'index.html'), html, 'utf8');
  await writeFile(path.join(siteRoot, 'app.js'), await readFile(path.join(templateRoot, 'app.js')), 'utf8');
  await writeFile(path.join(siteRoot, 'styles.css'), await readFile(path.join(templateRoot, 'styles.css')), 'utf8');
}

async function loadSharedBrand() {
  const sharedIndex = await readJson(path.join(repoRoot, 'site/index.json'));
  const sharedCore = await readJson(path.join(repoRoot, 'site/data/brand-core.json'));
  const sharedSearch = await readJson(path.join(repoRoot, 'site/data/search.json'));
  if (!sharedIndex.brand) throw new Error('Główny katalog MF TV nie zawiera współdzielonego pakietu marki.');
  const localDetailPath = 'data/brand.json';
  const localCore = {
    ...sharedCore,
    generatedAt,
    worldId,
    detailUrl: absoluteUrl(localDetailPath),
    typography: {
      ...sharedCore.typography,
      activePath: universeId,
      active: sharedCore.typography?.paths?.[universeId] ?? null,
    },
  };
  await writeJson(path.join(siteRoot, localDetailPath), localCore);
  Object.assign(brand, localCore);
  const sharedLogo = (sharedIndex.featured ?? []).find((entry) => entry.kind === 'brand');
  if (sharedLogo) {
    const logo = { ...sharedLogo, detailUrl: brand.detailUrl, summary: brand.description };
    featured.push(logo);
    searchEntries.push(logo);
  }
  searchEntries.push(...sharedSearch.entries
    .filter((entry) => entry.kind === 'slogan' && entry.fixed)
    .map((entry) => ({ ...entry, detailUrl: `${publicationBaseUrl}/data/brand/slogans/${entry.id}.json` })));
}

async function writeUniverseDirectory() {
  const universes = [
    {
      id: 'mf-tv',
      worldId: 'aimftv',
      name: 'MF TV',
      url: `${publicationBaseUrl}/`,
      catalogUrl: `${publicationBaseUrl}/index.json`,
      mcpUrl: 'https://europe-central2-aitv-42f4b.cloudfunctions.net/shotflowMcpProbe/mf-tv/mcp',
    },
    {
      id: 'mf-creators',
      worldId: 'mf-creators',
      name: 'MF Creators',
      url: `${publicationBaseUrl}/mf-creators/`,
      catalogUrl: `${publicationBaseUrl}/mf-creators/index.json`,
      mcpUrl: 'https://europe-central2-aitv-42f4b.cloudfunctions.net/shotflowMcpProbe/mf-creators/mcp',
    },
  ];
  await writeJson(path.join(repoRoot, 'site/universes.json'), {
    schemaVersion: 1,
    generatedAt,
    defaultUniverseId: 'mf-tv',
    universes,
  });
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
        updatedAt: manifest.updatedAt ?? null,
      };
      if (!resourceCatalogs.has(type)) resourceCatalogs.set(type, []);
      resourceCatalogs.get(type).push(listing);
      resourceEntriesByKey.set(key, listing);
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
    const timelineShotOrder = await readTimelineShotOrder(workspace.projectFile);
    const timelinePositions = new Map();
    const timelineLastPositions = new Map();
    const timelineOccurrences = new Map();
    timelineShotOrder.forEach((shotId, index) => {
      if (!timelinePositions.has(shotId)) timelinePositions.set(shotId, index);
      timelineLastPositions.set(shotId, index);
      if (!timelineOccurrences.has(shotId)) timelineOccurrences.set(shotId, []);
      timelineOccurrences.get(shotId).push(index + 1);
    });
    const timelineShotCount = new Set(timelineShotOrder).size;
    const shotSources = (await Promise.all(
      (await findNamedFiles(path.join(projectRoot, 'shots'), 'shot.json')).map(async (shotPath) => ({
        shotPath,
        shot: await readJson(shotPath),
      })),
    ))
      .filter(({ shot }) => shot?.id)
      .sort((left, right) => compareShotSequence(left.shot, right.shot, timelinePositions));
    const projectDates = shotSources.flatMap(({ shot }) => (shot.frames ?? [])
      .map((frame) => frame?.createdAt)
      .filter(isUsefulDate)
      .map((value) => new Date(value).toISOString()));
    const createdAt = projectDates.sort()[0] ?? null;
    const rawProjectId = workspace.id ?? projectDir.name;
    const projectKey = `project:${rawProjectId}`;
    const shotNames = new Map(shotSources.map(({ shot }) => [shot.id, shot.title ?? shot.id]));

    for (let shotIndex = 0; shotIndex < shotSources.length; shotIndex += 1) {
      const { shotPath, shot } = shotSources[shotIndex];
      const shotId = safeSegment(shot.id);
      const images = [];
      for (const frame of shot.frames ?? []) {
        if (!frame?.image || !frame?.id) continue;
        const source = safeSource(path.dirname(shotPath), frame.image);
        const targetBase = `assets/projects/${projectId}/shots/${shotId}/${safeSegment(frame.id)}`;
        const published = await publishOrWarn(source, targetBase, `shot:${workspace.id}/${shot.id} wskazuje brakujący obraz ${frame.image}`);
        if (!published) continue;
        images.push({
          id: frame.id,
          role: frame.id,
          revision: frame.revision ?? null,
          source: frame.source ?? null,
          referenceKeys: frame.referenceKeys ?? [],
          references: resolveReferenceKeys(frame.referenceKeys ?? [], rawProjectId, projectId, shot.id, shotNames),
          sourceReference: frame.sourceReferenceKey
            ? resolveReferenceKey(frame.sourceReferenceKey, rawProjectId, projectId, shot.id, shotNames)
            : null,
          revisions: (frame.revisions ?? []).map((revision) => ({
            revision: revision.revision ?? null,
            createdAt: revision.createdAt ?? null,
            source: revision.source ?? null,
            referenceKeys: revision.referenceKeys ?? [],
            references: resolveReferenceKeys(revision.referenceKeys ?? [], rawProjectId, projectId, shot.id, shotNames),
            sourceReference: revision.sourceReferenceKey
              ? resolveReferenceKey(revision.sourceReferenceKey, rawProjectId, projectId, shot.id, shotNames)
              : null,
          })),
          ...published,
        });
      }

      const key = `shot:${rawProjectId}/${shot.id}`;
      const detailPath = `data/projects/${projectId}/shots/${shotId}.json`;
      const onTimeline = timelinePositions.has(shot.id);
      const firstTimelinePosition = onTimeline ? timelinePositions.get(shot.id) + 1 : null;
      const lastTimelinePosition = onTimeline ? timelineLastPositions.get(shot.id) + 1 : null;
      const declaredReferences = (shot.references ?? []).map((reference) => resolveDeclaredReference(
        reference,
        rawProjectId,
        projectId,
        shot.id,
        shotNames,
      ));
      const chronology = {
        projectKey,
        projectCreatedAt: createdAt,
        projectOrder: 'newest-first outside the project',
        onTimeline,
        canonicalEvent: onTimeline,
        sequence: firstTimelinePosition,
        lastSequence: lastTimelinePosition,
        occurrences: timelineOccurrences.get(shot.id) ?? [],
        sequenceTotal: timelineShotOrder.length,
        uniqueShotCount: timelineShotCount,
        sequenceOrder: onTimeline ? 'oldest-to-newest timeline clip order' : null,
        sequenceSource: timelineShotOrder.length ? 'workspace timeline' : 'natural shot title order',
        stateRule: onTimeline
          ? 'This shot is canonical evidence of world state at this exact story moment. Later timeline clips in this project and later projects override it when determining current canon.'
          : 'This project material is not present on the saved timeline, so it must not override canonical timeline events by date alone.',
      };
      const detail = {
        schemaVersion: 2,
        generatedAt,
        worldId,
        kind: 'shot',
        key,
        id: shot.id,
        title: shot.title ?? shot.id,
        description: shot.description ?? '',
        project: { id: rawProjectId, key: projectKey, name: projectName, createdAt },
        chronology,
        references: shot.references ?? [],
        referenceUsage: {
          declared: declaredReferences,
          activeFrames: images.map((image) => ({
            frameId: image.id,
            revision: image.revision,
            referenceKeys: image.referenceKeys,
            references: image.references,
            sourceReference: image.sourceReference,
          })),
          provenanceRule: 'activeFrames contains the exact references recorded for the active image revision; revisions preserves the complete visual provenance history. declared contains the wider shot context.',
        },
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
        projectId: rawProjectId,
        projectName,
        projectCreatedAt: createdAt,
        onTimeline,
        sequence: firstTimelinePosition,
        lastSequence: lastTimelinePosition,
        sequenceTotal: timelineShotOrder.length,
        summary: summarize(detail.description),
        imageCount: images.length,
        imageUrl: images[0]?.imageUrl ?? null,
        thumbnailUrl: images[0]?.thumbnailUrl ?? null,
        detailUrl: absoluteUrl(detailPath),
      };
      shots.push(listing);
      searchEntries.push(listing);
      storyEvents.push({
        key,
        kind: 'story-event',
        projectKey,
        projectId: rawProjectId,
        projectName,
        projectCreatedAt: createdAt,
        onTimeline,
        canonicalEvent: onTimeline,
        sequence: firstTimelinePosition,
        lastSequence: lastTimelinePosition,
        occurrences: timelineOccurrences.get(shot.id) ?? [],
        sequenceTotal: timelineShotOrder.length,
        title: detail.title,
        description: detail.description,
        declaredReferences,
        activeFrameReferences: detail.referenceUsage.activeFrames,
        images: images.map(({ revisions: _revisions, references: _references, sourceReference: _sourceReference, ...image }) => image),
        detailUrl: absoluteUrl(detailPath),
      });
    }

    const projectIndexPath = `data/projects/${projectId}/index.json`;
    const shotsWithImages = shots.filter((shot) => shot.imageUrl);
    const representative = shotsWithImages[Math.floor(shotsWithImages.length / 2)] ?? shotsWithImages.at(-1) ?? null;
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
      id: rawProjectId,
      name: projectName,
      description: projectDescription,
      createdAt,
      images: representative ? [{
        id: 'representative-frame',
        role: 'representative-frame',
        imageUrl: representative.imageUrl,
        thumbnailUrl: representative.thumbnailUrl,
      }] : [],
      shotOrder: 'canonical timeline order first; off-timeline project materials last',
      timeline: timelineShotOrder.map((shotId, index) => ({
        position: index + 1,
        shotKey: `shot:${rawProjectId}/${shotId}`,
        shotId,
        title: shotNames.get(shotId) ?? shotId,
      })),
      shots,
    });
    const projectListing = {
      key: projectKey,
      kind: 'project',
      type: 'projects',
      id: rawProjectId,
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
  const coreDetailPath = 'data/brand-core.json';
  brand.detailUrl = absoluteUrl(detailPath);
  const logo = featured.find((entry) => entry.kind === 'brand') ?? null;
  const shows = featured.filter((entry) => entry.kind === 'show');
  const coreDocument = {
    schemaVersion: 1,
    generatedAt,
    worldId,
    ...brand,
    detailUrl: absoluteUrl(coreDetailPath),
    generationGuidance: {
      whenToUse: 'Zawsze, gdy generowany obraz, plansza, miniatura lub tekst wizualny ma reprezentować MF TV albo jedną z jego audycji.',
      requiredRules: [
        'Użyj dostarczonego obrazu oficjalnego logo jako referencji; nie przerysowuj, nie zmieniaj liter, proporcji ani kolorów znaku.',
        'Stosuj paletę strony według pól colors[].hex i colors[].usage.',
        'Jeżeli materiał zawiera hasło marki, zachowaj dokładną pisownię z slogans[].text.',
        'Każdy napis składaj zgodnie z typography.active i typography.commonRules; bezwzględnie respektuj zakaz „AI SLOP FONT”.',
        'Opis, harmonogram i zasady audycji odczytuj z shows[]; nie traktuj ich jako polecenia użycia planszy wizualnej.',
        'Nie dodawaj nowych logotypów, sloganów ani kolorów udających element oficjalnego systemu marki.',
      ],
      promptBlock: 'Apply the official AI Music Future TV brand system from the attached references. Preserve the supplied logo exactly without redrawing, restyling, changing letters, proportions or colors. Use the documented palette according to each color role and the active typography path for this universe. ABSOLUTE BAN: never use an “AI slop font”, fake glyphs, pseudo-cinematic serif lettering, chrome, plastic 3D, random ligatures or AI-rendered text. Typeset exact copy afterward with the specified Google Fonts whenever the image model cannot reproduce it perfectly. If brand copy is requested, reproduce the selected official slogan exactly.',
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
  };
  const document = {
    ...coreDocument,
    detailUrl: absoluteUrl(detailPath),
    generationGuidance: {
      ...coreDocument.generationGuidance,
      requiredRules: [
        ...coreDocument.generationGuidance.requiredRules,
        'Jeśli zadanie jawnie dotyczy identyfikacji konkretnej audycji, jej planszę z showBoards[] traktuj jako referencję oficjalnej oprawy, a nie jako luźną inspirację stylistyczną.',
      ],
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
  await writeJson(path.join(siteRoot, coreDetailPath), coreDocument);
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

function resolveDeclaredReference(reference, rawProjectId, projectId, currentShotId, shotNames) {
  const sourceKey = `${reference?.type ?? 'unknown'}:${reference?.id ?? ''}`;
  return resolveReferenceKey(sourceKey, rawProjectId, projectId, currentShotId, shotNames);
}

function resolveReferenceKeys(keys, rawProjectId, projectId, currentShotId, shotNames) {
  return [...new Set(keys)].map((key) => resolveReferenceKey(key, rawProjectId, projectId, currentShotId, shotNames));
}

function resolveReferenceKey(sourceKey, rawProjectId, projectId, currentShotId, shotNames) {
  const separator = String(sourceKey).indexOf(':');
  const type = separator >= 0 ? sourceKey.slice(0, separator) : 'unknown';
  const id = separator >= 0 ? sourceKey.slice(separator + 1) : sourceKey;
  if (type === 'self') {
    return {
      sourceKey,
      key: `shot:${rawProjectId}/${currentShotId}`,
      type: 'shot',
      id: currentShotId,
      name: shotNames.get(currentShotId) ?? currentShotId,
      relationship: 'prior-state-of-same-shot',
      detailUrl: absoluteUrl(`data/projects/${projectId}/shots/${safeSegment(currentShotId)}.json`),
      exists: shotNames.has(currentShotId),
    };
  }
  if (type === 'shot') {
    const resolvedKey = `shot:${rawProjectId}/${id}`;
    if (!shotNames.has(id)) recordUnresolvedReference(sourceKey, resolvedKey);
    return {
      sourceKey,
      key: resolvedKey,
      type,
      id,
      name: shotNames.get(id) ?? id,
      relationship: id === currentShotId ? 'prior-state-of-same-shot' : 'shot-continuity',
      detailUrl: absoluteUrl(`data/projects/${projectId}/shots/${safeSegment(id)}.json`),
      exists: shotNames.has(id),
    };
  }
  if (type === 'take') {
    const [shotId, takeId] = id.split('/');
    if (!takeId || !shotNames.has(shotId)) recordUnresolvedReference(sourceKey, `take:${rawProjectId}/${id}`);
    return {
      sourceKey,
      key: `take:${rawProjectId}/${id}`,
      type,
      id,
      name: `${shotNames.get(shotId) ?? shotId} / ${takeId ?? 'take'}`,
      relationship: 'visible-state-from-take',
      shotKey: `shot:${rawProjectId}/${shotId}`,
      shotDetailUrl: absoluteUrl(`data/projects/${projectId}/shots/${safeSegment(shotId)}.json`),
      exists: Boolean(takeId && shotNames.has(shotId)),
    };
  }
  const pluralType = ({ character: 'characters', place: 'places', prop: 'props', note: 'notes', look: 'looks' })[type];
  if (pluralType) {
    const key = `${type}:${id}`;
    const entry = resourceEntriesByKey.get(key);
    if (!entry) recordUnresolvedReference(sourceKey, key);
    return {
      sourceKey,
      key,
      type,
      id,
      name: entry?.name ?? id,
      relationship: type === 'note' ? 'story-and-continuity-context' : 'world-entity-identity',
      detailUrl: entry?.detailUrl ?? absoluteUrl(`data/resources/${pluralType}/${safeSegment(id)}.json`),
      exists: Boolean(entry),
    };
  }
  return { sourceKey, key: sourceKey, type, id, name: id, relationship: 'unknown', detailUrl: null, exists: false };
}

function recordUnresolvedReference(sourceKey, resolvedKey) {
  const warning = `Nie można rozwiązać referencji ${sourceKey} jako ${resolvedKey}.`;
  if (unresolvedReferences.has(warning)) return;
  unresolvedReferences.add(warning);
  warnings.push(warning);
}

function compareShotSequence(left, right, timelinePositions = new Map()) {
  const leftPosition = timelinePositions.get(left.id) ?? Number.POSITIVE_INFINITY;
  const rightPosition = timelinePositions.get(right.id) ?? Number.POSITIVE_INFINITY;
  return leftPosition - rightPosition || String(left.title ?? left.id).localeCompare(
    String(right.title ?? right.id),
    'pl',
    { numeric: true },
  );
}

function compareProjectsNewestFirst(left, right) {
  if (left.createdAt && right.createdAt) return right.createdAt.localeCompare(left.createdAt) || left.name.localeCompare(right.name, 'pl');
  if (left.createdAt) return -1;
  if (right.createdAt) return 1;
  return left.name.localeCompare(right.name, 'pl');
}

function compareEventsForBrowsing(left, right) {
  const projectComparison = compareProjectsNewestFirst(
    { createdAt: left.projectCreatedAt, name: left.projectName },
    { createdAt: right.projectCreatedAt, name: right.projectName },
  );
  if (projectComparison) return projectComparison;
  if (left.onTimeline !== right.onTimeline) return left.onTimeline ? -1 : 1;
  if (left.sequence !== null && right.sequence !== null && left.sequence !== right.sequence) return left.sequence - right.sequence;
  return left.title.localeCompare(right.title, 'pl', { numeric: true });
}

function compareEntries(a, b) {
  if (a.fixed !== b.fixed) return a.fixed ? -1 : 1;
  if (a.projectCreatedAt || b.projectCreatedAt) {
    const projectComparison = compareProjectsNewestFirst(
      { createdAt: a.projectCreatedAt, name: a.projectName ?? '' },
      { createdAt: b.projectCreatedAt, name: b.projectName ?? '' },
    );
    if (projectComparison) return projectComparison;
    if (a.sequence && b.sequence) return a.sequence - b.sequence;
  }
  if (a.updatedAt && b.updatedAt) return String(b.updatedAt).localeCompare(String(a.updatedAt));
  if (a.updatedAt) return -1;
  if (b.updatedAt) return 1;
  return a.name.localeCompare(b.name, 'pl', { numeric: true }) || a.key.localeCompare(b.key);
}

async function readTimelineShotOrder(projectFile) {
  if (!projectFile) return [];
  let candidate = projectFile;
  if (process.platform !== 'win32' && /^[A-Za-z]:\\/.test(candidate)) {
    const drive = candidate[0].toLowerCase();
    candidate = `/mnt/${drive}/${candidate.slice(3).replaceAll('\\', '/')}`;
  }
  try {
    const xml = await readFile(candidate, 'utf8');
    const producerToShot = new Map();
    for (const match of xml.matchAll(/<(chain|producer)\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/g)) {
      const shotMatch = match[3].match(/<property\s+name=["']shotflow\.id["']>([^<]+)<\/property>/);
      if (shotMatch) producerToShot.set(decodeXmlText(match[2]), decodeXmlText(shotMatch[1].trim()));
    }
    const playlists = [];
    for (const match of xml.matchAll(/<playlist\b[^>]*\bid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/playlist>/g)) {
      const ids = [...match[2].matchAll(/<entry\b[^>]*\bproducer=["']([^"']+)["'][^>]*\/?\s*>/g)]
        .map((entry) => producerToShot.get(decodeXmlText(entry[1])))
        .filter(Boolean);
      if (ids.length) playlists.push({ id: decodeXmlText(match[1]), ids });
    }
    const primary = playlists.sort((left, right) => right.ids.length - left.ids.length)[0];
    return primary?.ids ?? [];
  } catch {
    return [];
  }
}

function decodeXmlText(value) {
  return value.replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&apos;', "'");
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

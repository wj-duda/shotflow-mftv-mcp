window.worldBrowser = function worldBrowser(worldId) {
  return {
    worldId,
    loading: true,
    error: '',
    query: '',
    filter: 'all',
    limit: 60,
    entries: [],
    featured: [],
    brand: { slogans: [], colors: [] },
    timeline: [],
    selected: null,
    detail: null,
    detailLoading: false,

    async init() {
      try {
        const root = await fetchJson('index.json');
        this.featured = root.featured ?? [];
        this.brand = root.brand ?? this.brand;
        const [search, timeline] = await Promise.all([
          fetchJson(this.localUrl(root.searchUrl)),
          fetchJson(this.localUrl(root.timelineUrl)),
        ]);
        this.entries = search.entries;
        this.timeline = timeline.projects;
      } catch (error) {
        this.error = `Nie udało się wczytać katalogu: ${error.message}`;
      } finally {
        this.loading = false;
      }
    },

    get filters() {
      const counts = new Map();
      for (const entry of this.entries) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
      return [...counts.entries()]
        .map(([value, count]) => ({ value, count, label: this.typeLabel(value) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'pl'));
    },

    get logoEntry() {
      return this.featured.find((entry) => entry.kind === 'brand') ?? null;
    },

    get showEntries() {
      return this.featured.filter((entry) => entry.kind === 'show');
    },

    get filteredEntries() {
      const { projectId, terms } = parseQuery(this.query);
      return this.entries.filter((entry) => {
        if (this.filter !== 'all' && entry.type !== this.filter) return false;
        if (projectId && (entry.kind !== 'shot' || normalize(entry.projectId) !== projectId)) return false;
        if (!terms.length) return true;
        const haystack = normalize([entry.name, entry.summary, entry.projectName, entry.key].filter(Boolean).join(' '));
        return terms.every((term) => haystack.includes(term));
      });
    },

    get activeProjectId() {
      return parseQuery(this.query).projectId;
    },

    get visibleEntries() {
      return this.filteredEntries.slice(0, this.limit);
    },

    labelFor(entry) {
      return this.typeLabel(entry.type);
    },

    localUrl(url) {
      if (!url) return '';
      const parsed = new URL(url, window.location.href);
      if (['localhost', '127.0.0.1'].includes(window.location.hostname) && parsed.hostname === 'wj-duda.github.io') {
        return parsed.pathname.replace(/^\/shotflow-mftv-mcp\//, '/');
      }
      return url;
    },

    typeLabel(type) {
      return ({
        characters: 'Postać',
        places: 'Miejsce',
        props: 'Rekwizyt',
        notes: 'Notatka',
        looks: 'Styl',
        shots: 'Shot',
        brand: 'Marka',
      })[type] ?? type;
    },

    filterProject(entry) {
      this.query = `project:${entry.id}`;
      this.filter = 'shots';
      this.limit = 60;
      requestAnimationFrame(() => document.querySelector('.toolbar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    },

    formatDate(value) {
      if (!value) return '';
      return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
    },

    async open(entry) {
      this.selected = entry;
      this.detail = null;
      this.detailLoading = true;
      document.body.classList.add('modal-open');
      try {
        this.detail = await fetchJson(this.localUrl(entry.detailUrl));
      } catch (error) {
        this.detail = { description: `Nie udało się wczytać szczegółów: ${error.message}`, images: [] };
      } finally {
        this.detailLoading = false;
      }
    },

    close() {
      this.selected = null;
      this.detail = null;
      document.body.classList.remove('modal-open');
    },

    async copy(text) {
      if (text) await navigator.clipboard.writeText(text);
    },
  };
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function normalize(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function parseQuery(value) {
  let projectId = '';
  const remaining = String(value ?? '').replace(/(?:^|\s)project:("[^"]+"|\S+)/gi, (_, rawValue) => {
    projectId = normalize(rawValue.replace(/^"|"$/g, ''));
    return ' ';
  });
  return {
    projectId,
    terms: normalize(remaining).split(/\s+/).filter(Boolean),
  };
}

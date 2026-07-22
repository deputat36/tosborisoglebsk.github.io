const fs = require('fs');
const path = require('path');
const { inferContentOrigin } = require('./lib/content_origin');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const OUT = path.join(ROOT, 'data', 'page_index.json');
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'scripts', '_private', 'admin']);
const SKIP_PREFIXES = ['audit/'];

const SEARCH_GROUP_LABELS = Object.freeze({
  tos: 'Каталог ТОС',
  news: 'Новости',
  projects: 'Проекты',
  done: 'Результаты',
  needs: 'Потребности',
  materials: 'Материалы',
  documents: 'Документы',
  places: 'Территории',
  guides: 'Инструкции и сервисы',
  other: 'Другие страницы'
});

const COLLECTIONS = Object.freeze({
  news: { file: 'data/news.json', route: 'news' },
  projects: { file: 'data/projects.json', route: 'projects' },
  done: { file: 'data/done.json', route: 'done' },
  needs: { file: 'data/needs.json', route: 'needs' },
  articles: { file: 'data/articles.json', route: 'materials' }
});

function escText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function urlFor(file) {
  const r = rel(file);
  if (r === 'index.html') return `${SITE_URL}/`;
  if (r.endsWith('/index.html')) return `${SITE_URL}/${r.replace(/index\.html$/, '')}`;
  return `${SITE_URL}/${r}`;
}

function sectionFor(relative) {
  if (relative === 'index.html') return 'Главная';
  const first = relative.split('/')[0];
  const labels = {
    tos: 'Каталог ТОС', news: 'Новости', projects: 'Проекты', done: 'Сделано', needs: 'Потребности',
    materials: 'Материалы', documents: 'Документы', legal: 'Правовая основа', places: 'Территории',
    chairperson: 'Председателю', residents: 'Жителям', partners: 'Партнёрам', grants: 'Конкурсы',
    calendar: 'Календарь', contacts: 'Контакты', search: 'Поиск', sources: 'Источники данных',
    privacy: 'Публикация сведений', glossary: 'Словарь', methodology: 'О портале', workbench: 'Рабочая панель',
    'project-passport': 'Паспорт проекта ТОС',
    'verification-guide': 'Как подтвердить карточку ТОС',
    'action-routes': 'Практические маршруты', 'partner-thanks': 'Благодарности партнёрам',
    'editorial-workflow': 'Редакционный порядок', 'content-standards': 'Стандарты материалов',
    'verification-levels': 'Статусы проверки данных', 'data-dictionary': 'Справочник полей данных',
    'data-quality': 'Качество данных', 'data-update': 'Актуализация данных', 'data-requests': 'Запросы данных',
    'communication-kit': 'Коммуникационный набор', campaign: 'Кампания актуализации',
    'field-checklist': 'Чек-лист проверки', 'media-guide': 'Фото и логотипы', 'open-data': 'Открытые данные',
    roadmap: 'План развития', 'site-index': 'Индекс страниц', 'check-tos': 'Проверка ТОС',
    'submit-materials': 'Прислать материал'
  };
  return labels[first] || first;
}

function searchGroupFor(relative) {
  const first = relative === 'index.html' ? '' : relative.split('/')[0];
  if (first === 'tos') return 'tos';
  if (first === 'news') return 'news';
  if (first === 'projects') return 'projects';
  if (first === 'done') return 'done';
  if (first === 'needs') return 'needs';
  if (first === 'materials') return 'materials';
  if (first === 'documents') return 'documents';
  if (first === 'places' || first === 'map') return 'places';

  const guideRoots = new Set([
    'create-tos', 'chairperson', 'residents', 'partners', 'grants', 'calendar', 'legal', 'contacts',
    'sources', 'privacy', 'glossary', 'methodology', 'verification-guide', 'action-routes',
    'content-standards', 'verification-levels', 'data-dictionary', 'data-quality', 'data-update',
    'data-requests', 'communication-kit', 'field-checklist', 'media-guide', 'open-data',
    'check-tos', 'submit-materials', 'project-passport', 'grant-application-kit'
  ]);
  return guideRoots.has(first) ? 'guides' : 'other';
}

function getTitle(html) {
  return escText((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '');
}

function getDescription(html) {
  return escText((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || [])[1] || '');
}

function getCanonical(html, file) {
  return escText((html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1] || urlFor(file));
}

function isNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name === 'index.html') out.push(full);
  }
  return out;
}

function readJson(relativePath, fallback = []) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
  } catch {
    return fallback;
  }
}

function buildOriginIndex() {
  const index = new Map();
  Object.entries(COLLECTIONS).forEach(([collection, config]) => {
    const items = readJson(config.file).filter((item) => item && item.id && item.status !== 'draft');
    items.forEach((item) => {
      index.set(`${config.route}/${item.id}/index.html`, inferContentOrigin(item, collection));
    });
  });
  return index;
}

function main() {
  const originIndex = buildOriginIndex();
  const pages = walk(ROOT)
    .map((file) => ({ file, relative: rel(file), html: fs.readFileSync(file, 'utf8') }))
    .filter((page) => !SKIP_PREFIXES.some((prefix) => page.relative.startsWith(prefix)))
    .filter((page) => !isNoindex(page.html))
    .map((page) => ({
      path: page.relative,
      url: getCanonical(page.html, page.file),
      title: getTitle(page.html),
      description: getDescription(page.html),
      section: sectionFor(page.relative),
      search_group: searchGroupFor(page.relative),
      content_origin: originIndex.get(page.relative) || 'reference'
    }))
    .filter((page) => page.title && page.url.startsWith(SITE_URL))
    .sort((a, b) => {
      const groupA = SEARCH_GROUP_LABELS[a.search_group] || a.search_group;
      const groupB = SEARCH_GROUP_LABELS[b.search_group] || b.search_group;
      return groupA.localeCompare(groupB, 'ru')
        || a.section.localeCompare(b.section, 'ru')
        || a.title.localeCompare(b.title, 'ru');
    });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    total: pages.length,
    search_groups: SEARCH_GROUP_LABELS,
    pages
  }, null, 2)}\n`, 'utf8');
  console.log(`Generated page index: ${pages.length} pages, ${originIndex.size} materials with content origin.`);
}

main();

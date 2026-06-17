const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const OUT = path.join(ROOT, 'data', 'page_index.json');
const SKIP_DIRS = new Set(['.git', '.github', 'node_modules', 'scripts', '_private', 'admin']);
const SKIP_PREFIXES = ['audit/'];

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
    privacy: 'Публикация сведений', glossary: 'Словарь', methodology: 'О портале',
    'data-quality': 'Качество данных', 'data-update': 'Актуализация данных', 'data-requests': 'Запросы данных',
    'communication-kit': 'Коммуникационный набор', campaign: 'Кампания актуализации', 'field-checklist': 'Чек-лист проверки',
    'media-guide': 'Фото и логотипы', 'open-data': 'Открытые данные', roadmap: 'План развития', 'site-index': 'Индекс страниц',
    'check-tos': 'Проверка ТОС', 'submit-materials': 'Прислать материал'
  };
  return labels[first] || first;
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

function main() {
  const pages = walk(ROOT)
    .map((file) => ({ file, relative: rel(file), html: fs.readFileSync(file, 'utf8') }))
    .filter((page) => !SKIP_PREFIXES.some((prefix) => page.relative.startsWith(prefix)))
    .filter((page) => !isNoindex(page.html))
    .map((page) => ({
      path: page.relative,
      url: getCanonical(page.html, page.file),
      title: getTitle(page.html),
      description: getDescription(page.html),
      section: sectionFor(page.relative)
    }))
    .filter((page) => page.title && page.url.startsWith(SITE_URL))
    .sort((a, b) => a.section.localeCompare(b.section, 'ru') || a.title.localeCompare(b.title, 'ru'));

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify({ generated_at: new Date().toISOString(), total: pages.length, pages }, null, 2)}\n`, 'utf8');
  console.log(`Generated page index: ${pages.length} pages.`);
}

main();

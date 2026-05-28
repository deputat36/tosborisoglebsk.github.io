const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function readJson(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')); }
  catch { return fallback; }
}

function writeJson(file, data) {
  const target = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

const published = (item) => item && item.status !== 'draft';
const has = (value) => value !== undefined && value !== null && String(value).trim() !== '';
const goodDescription = (value) => {
  const text = String(value || '').trim();
  return text.length >= 80 && text !== 'Описание пока уточняется.';
};

function mapByTos(items) {
  const map = new Map();
  items.filter(published).forEach((item) => {
    if (!item.tos_slug) return;
    if (!map.has(item.tos_slug)) map.set(item.tos_slug, 0);
    map.set(item.tos_slug, map.get(item.tos_slug) + 1);
  });
  return map;
}

function getCount(map, slug) {
  return map.get(slug) || 0;
}

function buildAuditItem(tos, maps) {
  const linked = {
    news: getCount(maps.news, tos.slug),
    done: getCount(maps.done, tos.slug),
    needs: getCount(maps.needs, tos.slug),
    projects: getCount(maps.projects, tos.slug),
    events: getCount(maps.events, tos.slug)
  };

  const checks = [
    ['Название', has(tos.name)],
    ['Тип', has(tos.type)],
    ['Населённый пункт', has(tos.location)],
    ['Границы', has(tos.boundaries)],
    ['Председатель', has(tos.chairperson)],
    ['Телефон', (tos.phones || []).length > 0],
    ['Email', (tos.emails || []).length > 0],
    ['Соцсети', (tos.social_links || []).length > 0],
    ['Логотип', has(tos.logo)],
    ['Описание', goodDescription(tos.description)],
    ['Численность жителей', has(tos.population)],
    ['Год создания', has(tos.founded)],
    ['Новости', linked.news > 0],
    ['Истории результата', linked.done > 0],
    ['Потребности', linked.needs > 0],
    ['Проекты', linked.projects > 0]
  ];

  const passed = checks.filter(([, ok]) => ok).length;
  const missing = checks.filter(([, ok]) => !ok).map(([name]) => name);
  const score = Math.round((passed / checks.length) * 100);
  let priority = 'Низкий';
  if (score < 45 || missing.includes('Телефон') || missing.includes('Председатель')) priority = 'Высокий';
  else if (score < 70 || (linked.news === 0 && linked.done === 0)) priority = 'Средний';

  const recommendations = [];
  if (missing.includes('Телефон')) recommendations.push('уточнить телефон председателя или ответственного');
  if (missing.includes('Email')) recommendations.push('добавить email для связи');
  if (missing.includes('Соцсети')) recommendations.push('добавить группу или страницу в соцсетях');
  if (missing.includes('Логотип')) recommendations.push('подготовить логотип или временный знак ТОС');
  if (missing.includes('Описание')) recommendations.push('написать живое описание территории и активности');
  if (linked.news === 0) recommendations.push('добавить хотя бы одну новость или объявление');
  if (linked.done === 0) recommendations.push('собрать минимум одну историю результата');
  if (linked.needs === 0) recommendations.push('уточнить актуальную потребность территории');
  if (linked.projects === 0) recommendations.push('добавить проектную идею или инициативу');

  return {
    slug: tos.slug,
    name: tos.name,
    type: tos.type || '',
    location: tos.location || '',
    chairperson: tos.chairperson || '',
    updated_at: tos.updated_at || '',
    score,
    priority,
    missing,
    linked,
    recommendations: recommendations.slice(0, 6)
  };
}

function main() {
  const toses = readJson('data/toses.json').filter(published);
  const maps = {
    news: mapByTos(readJson('data/news.json')),
    done: mapByTos(readJson('data/done.json')),
    needs: mapByTos(readJson('data/needs.json')),
    projects: mapByTos(readJson('data/projects.json')),
    events: mapByTos(readJson('data/events.json'))
  };

  const rank = { 'Высокий': 0, 'Средний': 1, 'Низкий': 2 };
  const items = toses.map((tos) => buildAuditItem(tos, maps))
    .sort((a, b) => rank[a.priority] - rank[b.priority] || a.score - b.score || String(a.name).localeCompare(String(b.name), 'ru'));

  const summary = {
    generated_at: new Date().toISOString(),
    total_tos: items.length,
    high_priority: items.filter((item) => item.priority === 'Высокий').length,
    medium_priority: items.filter((item) => item.priority === 'Средний').length,
    low_priority: items.filter((item) => item.priority === 'Низкий').length,
    without_phone: items.filter((item) => item.missing.includes('Телефон')).length,
    without_social: items.filter((item) => item.missing.includes('Соцсети')).length,
    without_news: items.filter((item) => item.linked.news === 0).length,
    without_done: items.filter((item) => item.linked.done === 0).length,
    without_needs: items.filter((item) => item.linked.needs === 0).length,
    without_projects: items.filter((item) => item.linked.projects === 0).length,
    average_score: Math.round(items.reduce((sum, item) => sum + item.score, 0) / Math.max(items.length, 1))
  };

  writeJson('data/tos_content_audit.json', { summary, items });
  writeJson('data/site_audit.json', {
    generated_at: summary.generated_at,
    summary,
    next_actions: [
      'уточнить контакты ТОСов с высоким приоритетом',
      'добавить новости для ТОСов без публикаций',
      'собрать истории результата для ТОСов без раздела «Сделано»',
      'подготовить актуальные потребности для витрины помощи',
      'добавить фото и источники к опубликованным материалам'
    ]
  });

  console.log(`Content audit generated: ${items.length} TOS records.`);
}

main();

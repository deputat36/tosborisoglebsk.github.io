const fs = require('fs');
const path = require('path');
const { coverageMap, coverageFromMap } = require('./lib/content_coverage');

const ROOT = process.cwd();
const STALE_DAYS = 180;

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

function daysSince(value) {
  if (!value) return null;
  const time = new Date(`${String(value).slice(0, 10)}T00:00:00`).getTime();
  if (Number.isNaN(time)) return null;
  return Math.floor((Date.now() - time) / 86400000);
}

function verificationInfo(tos, score) {
  const allowed = new Set(['verified', 'partial', 'needs_review', 'unknown']);
  let status = allowed.has(tos.verification_status) ? tos.verification_status : '';
  const date = tos.verified_at || tos.updated_at || '';
  const ageDays = daysSince(date);
  const stale = ageDays !== null && ageDays > STALE_DAYS;

  if (!status) {
    if (!date) status = 'unknown';
    else status = score >= 80 ? 'partial' : 'needs_review';
  }
  if (stale && status !== 'unknown') status = 'stale';

  const labels = {
    verified: 'Данные проверены',
    partial: 'Проверено частично',
    needs_review: 'Требует проверки',
    unknown: 'Данные уточняются',
    stale: 'Проверка устарела'
  };

  return {
    status,
    label: labels[status] || labels.unknown,
    date,
    age_days: ageDays,
    stale,
    source: tos.verification_source || '',
    note: tos.verification_note || ''
  };
}

function registryGroup(priority, verification, missing, linked) {
  if (priority === 'Высокий' || verification.status === 'stale') return 'Срочно проверить';
  if (verification.status === 'needs_review' || verification.status === 'unknown' || missing.includes('Телефон')) return 'Запросить данные';
  if (linked.news === 0 || linked.done === 0 || linked.needs === 0 || linked.projects === 0) return 'Добавить материалы';
  if (verification.status === 'verified') return 'Проверено';
  return 'Проверить частично';
}

function collectionState(maps, key, slug) {
  return coverageFromMap(maps[key], slug);
}

function buildAuditItem(tos, maps) {
  const news = collectionState(maps, 'news', tos.slug);
  const done = collectionState(maps, 'done', tos.slug);
  const needs = collectionState(maps, 'needs', tos.slug);
  const projects = collectionState(maps, 'projects', tos.slug);
  const events = collectionState(maps, 'events', tos.slug);
  const states = { news, done, needs, projects, events };
  const linked = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value.substantive]));
  const linkedAll = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value.all]));
  const linkedRequests = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value.requests]));
  const linkedOrigins = Object.fromEntries(Object.entries(states).map(([key, value]) => [key, value.origins]));

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

  const verification = verificationInfo(tos, score);
  if (verification.status === 'stale' && priority === 'Низкий') priority = 'Средний';

  const recommendations = [];
  if (missing.includes('Телефон')) recommendations.push('уточнить телефон председателя или ответственного');
  if (missing.includes('Email')) recommendations.push('добавить email для связи');
  if (missing.includes('Соцсети')) recommendations.push('добавить группу или страницу в соцсетях');
  if (missing.includes('Логотип')) recommendations.push('подготовить логотип или временный знак ТОС');
  if (missing.includes('Описание')) recommendations.push('написать живое описание территории и активности');
  if (linked.news === 0) recommendations.push(linkedRequests.news > 0 ? 'заменить запрос материалов содержательной новостью или фотоотчётом' : 'добавить хотя бы одну содержательную новость или фотоотчёт');
  if (linked.done === 0) recommendations.push(linkedRequests.done > 0 ? 'заменить заготовку подтверждённой историей результата' : 'собрать минимум одну историю результата');
  if (linked.needs === 0) recommendations.push(linkedRequests.needs > 0 ? 'уточнить и подтвердить реальную актуальную потребность территории' : 'уточнить актуальную потребность территории');
  if (linked.projects === 0) recommendations.push(linkedRequests.projects > 0 ? 'оформить запрос как проектную идею с понятным статусом' : 'добавить проектную идею или инициативу');
  if (verification.status === 'unknown') recommendations.unshift('указать дату и источник проверки данных');
  if (verification.status === 'stale') recommendations.unshift('повторно подтвердить сведения у председателя или ответственного');

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
    linked_all: linkedAll,
    linked_requests: linkedRequests,
    linked_origins: linkedOrigins,
    verification,
    registry_group: registryGroup(priority, verification, missing, linked),
    contact_ready: (tos.phones || []).length > 0 || (tos.emails || []).length > 0 || (tos.social_links || []).length > 0,
    recommendations: recommendations.slice(0, 8)
  };
}

function requestOnly(items, key) {
  return items.filter((item) => item.linked[key] === 0 && item.linked_requests[key] > 0).length;
}

function totalRequests(items, key) {
  return items.reduce((sum, item) => sum + (item.linked_requests[key] || 0), 0);
}

function main() {
  const toses = readJson('data/toses.json').filter(published);
  const maps = {
    news: coverageMap(readJson('data/news.json'), 'news'),
    done: coverageMap(readJson('data/done.json'), 'done'),
    needs: coverageMap(readJson('data/needs.json'), 'needs'),
    projects: coverageMap(readJson('data/projects.json'), 'projects'),
    events: coverageMap(readJson('data/events.json'), 'events')
  };

  const priorityRank = { 'Высокий': 0, 'Средний': 1, 'Низкий': 2 };
  const verificationRank = { stale: 0, needs_review: 1, unknown: 2, partial: 3, verified: 4 };
  const items = toses.map((tos) => buildAuditItem(tos, maps))
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]
      || verificationRank[a.verification.status] - verificationRank[b.verification.status]
      || a.score - b.score
      || String(a.name).localeCompare(String(b.name), 'ru'));

  const summary = {
    generated_at: new Date().toISOString(),
    stale_after_days: STALE_DAYS,
    total_tos: items.length,
    high_priority: items.filter((item) => item.priority === 'Высокий').length,
    medium_priority: items.filter((item) => item.priority === 'Средний').length,
    low_priority: items.filter((item) => item.priority === 'Низкий').length,
    verified_count: items.filter((item) => item.verification.status === 'verified').length,
    partial_count: items.filter((item) => item.verification.status === 'partial').length,
    needs_review_count: items.filter((item) => item.verification.status === 'needs_review').length,
    unknown_count: items.filter((item) => item.verification.status === 'unknown').length,
    stale_count: items.filter((item) => item.verification.status === 'stale').length,
    without_phone: items.filter((item) => item.missing.includes('Телефон')).length,
    without_social: items.filter((item) => item.missing.includes('Соцсети')).length,
    without_news: items.filter((item) => item.linked.news === 0).length,
    without_done: items.filter((item) => item.linked.done === 0).length,
    without_needs: items.filter((item) => item.linked.needs === 0).length,
    without_projects: items.filter((item) => item.linked.projects === 0).length,
    request_only_news: requestOnly(items, 'news'),
    request_only_done: requestOnly(items, 'done'),
    request_only_needs: requestOnly(items, 'needs'),
    request_only_projects: requestOnly(items, 'projects'),
    editorial_requests: {
      news: totalRequests(items, 'news'),
      done: totalRequests(items, 'done'),
      needs: totalRequests(items, 'needs'),
      projects: totalRequests(items, 'projects')
    },
    average_score: Math.round(items.reduce((sum, item) => sum + item.score, 0) / Math.max(items.length, 1))
  };

  writeJson('data/tos_content_audit.json', { summary, items });
  writeJson('data/site_audit.json', {
    generated_at: summary.generated_at,
    summary,
    next_actions: [
      'повторно проверить карточки с устаревшей датой',
      'уточнить контакты ТОСов с высоким приоритетом',
      'заменить редакционные запросы содержательными новостями и фотоотчётами',
      'собрать подтверждённые истории результата',
      'подготовить актуальные потребности и проектные идеи',
      'указать источник и дату проверки сведений'
    ]
  });

  console.log(`Content audit generated: ${items.length} TOS records; request-only news ${summary.request_only_news}.`);
}

main();

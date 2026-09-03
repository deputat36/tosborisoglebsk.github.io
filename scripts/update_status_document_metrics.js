const fs = require('fs');
const path = require('path');
const { formatNumber, numberWordRu } = require('./audit_status_document');

const ROOT = path.resolve(__dirname, '..');
const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
];

function formatDateRu(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid report date: ${value}`);
  return `${date.getUTCDate()} ${MONTHS_RU[date.getUTCMonth()]} ${date.getUTCFullYear()} года`;
}

function countMatches(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  return [...text.matchAll(new RegExp(pattern.source, flags))].length;
}

function replaceExactly(text, pattern, replacement, label) {
  const count = countMatches(text, pattern);
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one matching status line, found ${count}`);
  }
  return text.replace(pattern, replacement);
}

function replaceInRange(text, startMarker, endMarker, pattern, replacement, label) {
  const start = text.indexOf(startMarker);
  if (start === -1) throw new Error(`${label}: start marker not found: ${startMarker}`);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`${label}: end marker not found: ${endMarker}`);
  const segment = text.slice(start, end);
  const updatedSegment = replaceExactly(segment, pattern, replacement, label);
  return `${text.slice(0, start)}${updatedSegment}${text.slice(end)}`;
}

function updateStatusDocument({ documentText, siteHealth, technicalReport, contentOrigin, personalData }) {
  let updated = documentText;
  const technical = technicalReport.summary;
  const totals = contentOrigin.totals;
  const coverage = contentOrigin.tos_coverage;
  const decisions = Array.isArray(personalData.decisions) ? personalData.decisions : [];
  const pending = decisions.filter((item) => item.status === 'pending').length;

  if (!coverage || typeof coverage !== 'object') {
    throw new Error('Content-origin TOS coverage is missing.');
  }

  const generatedDates = [
    siteHealth.generated_at,
    technicalReport.generated_at,
    contentOrigin.generated_at,
    personalData.updated_at
  ].filter(Boolean).map((value) => new Date(value));
  const newestDate = new Date(Math.max(...generatedDates.map((date) => date.getTime())));

  updated = replaceExactly(updated, /^Обновлено: .+\.$/m, `Обновлено: ${formatDateRu(newestDate)}.`, 'update date');

  const siteStart = 'По `data/site_health.json`:';
  const siteEnd = 'Технический accessibility/performance-аудит';
  const siteReplacements = [
    [/- управляемых HTML-страниц: \d+;/, `- управляемых HTML-страниц: ${siteHealth.pages.total};`, 'managed HTML pages'],
    [/- публичных страниц: \d+;/, `- публичных страниц: ${siteHealth.pages.public};`, 'site public pages'],
    [/- служебных страниц `noindex`: \d+;/, `- служебных страниц \`noindex\`: ${siteHealth.pages.noindex};`, 'noindex pages'],
    [/- битых внутренних ссылок и якорей: \d+;/, `- битых внутренних ссылок и якорей: ${siteHealth.pages.broken_internal_links_count};`, 'broken links'],
    [/- базовых SEO-предупреждений: \d+;/, `- базовых SEO-предупреждений: ${siteHealth.pages.seo_warnings_count};`, 'SEO warnings'],
    [/- карточек ТОС: \d+;/, `- карточек ТОС: ${siteHealth.catalog.total_tos};`, 'TOS total'],
    [/- карточек высокого приоритета: \d+;/, `- карточек высокого приоритета: ${siteHealth.catalog.high_priority};`, 'high priority TOS'],
    [/- карточек со статусом `verified`: \d+;/, `- карточек со статусом \`verified\`: ${siteHealth.catalog.verified_count};`, 'verified TOS'],
    [/- карточек со статусом `partial`: \d+;/, `- карточек со статусом \`partial\`: ${siteHealth.catalog.partial_count};`, 'partial TOS'],
    [/- карточек `needs_review`: \d+;/, `- карточек \`needs_review\`: ${siteHealth.catalog.needs_review_count};`, 'needs review TOS'],
    [/- средняя заполненность карточек: \d+%;/, `- средняя заполненность карточек: ${siteHealth.catalog.average_score}%;`, 'average TOS score'],
    [/- общая оценка `site_health`: \d+\/100\./, `- общая оценка \`site_health\`: ${siteHealth.health_score}/100.`, 'site health score']
  ];
  for (const [pattern, replacement, label] of siteReplacements) {
    updated = replaceInRange(updated, siteStart, siteEnd, pattern, replacement, label);
  }

  const technicalStart = 'Технический accessibility/performance-аудит';
  const technicalEnd = 'Разница между';
  const technicalReplacements = [
    [/проверяет \d+ HTML-файла\./, `проверяет ${technical.html_pages} HTML-файла.`, 'technical HTML scope'],
    [/- публичных страниц: \d+;/, `- публичных страниц: ${technical.public_pages};`, 'technical public pages'],
    [/- страниц с замечаниями: \d+;/, `- страниц с замечаниями: ${technical.pages_with_issues};`, 'technical findings pages'],
    [/- high \/ medium \/ low: \d+ \/ \d+ \/ \d+;/, `- high / medium / low: ${technical.issue_severity.high} / ${technical.issue_severity.medium} / ${technical.issue_severity.low};`, 'technical severities'],
    [/- публичных runtime-ресурсов: \d+;/, `- публичных runtime-ресурсов: ${technical.asset_files};`, 'runtime assets'],
    [/- ресурсов сверх бюджета: \d+;/, `- ресурсов сверх бюджета: ${technical.over_budget_assets};`, 'over-budget assets'],
    [/- общий CSS: [\d ]+ байта;/, `- общий CSS: ${formatNumber(technical.total_css_bytes)} байта;`, 'CSS bytes'],
    [/- общий JavaScript: [\d ]+ байт\./, `- общий JavaScript: ${formatNumber(technical.total_js_bytes)} байт.`, 'JavaScript bytes']
  ];
  for (const [pattern, replacement, label] of technicalReplacements) {
    updated = replaceInRange(updated, technicalStart, technicalEnd, pattern, replacement, label);
  }

  updated = replaceExactly(
    updated,
    /Разница между \d+ и \d+ страницами/,
    `Разница между ${siteHealth.pages.total} и ${technical.html_pages} страницами`,
    'scope difference'
  );

  const contentStart = 'Текущая картина `data/content_origin_report.json`:';
  const contentEnd = '### Доступность и производительность';
  const contentReplacements = [
    [/- всего материалов: \d+;/, `- всего материалов: ${totals.total};`, 'content total'],
    [/- `verified`: \d+;/, `- \`verified\`: ${totals.verified};`, 'verified content'],
    [/- `editorial`: \d+;/, `- \`editorial\`: ${totals.editorial};`, 'editorial content'],
    [/- `starter`: \d+;/, `- \`starter\`: ${totals.starter};`, 'starter content'],
    [/- `request`: \d+;/, `- \`request\`: ${totals.request};`, 'request content'],
    [/- подтверждённый контент есть у .+?;/, `- подтверждённый контент есть у ${coverage.with_verified_content} из ${coverage.total_tos} ТОСов;`, 'verified TOS coverage'],
    [/- у \d+ из \d+ ТОСов есть только стартовые идеи или запросы;/, `- у ${coverage.with_only_starter_or_request} из ${coverage.total_tos} ТОСов есть только стартовые идеи или запросы;`, 'starter/request TOS coverage'],
    [/- карточек без какого-либо контента(?:: \d+[.;]| (?:нет|[^\n.;]+)[.;])/, `- карточек без какого-либо контента: ${coverage.without_any_content}.`, 'empty TOS coverage']
  ];
  for (const [pattern, replacement, label] of contentReplacements) {
    updated = replaceInRange(updated, contentStart, contentEnd, pattern, replacement, label);
  }

  const personalStart = '## Готовность к работе с персональными данными';
  const personalEnd = '## Сохранение старых URL проектов';
  updated = replaceInRange(
    updated,
    personalStart,
    personalEnd,
    /Портал работает в режиме `[^`]+`\./,
    `Портал работает в режиме \`${personalData.portal_status}\`.`,
    'personal-data status'
  );

  if (decisions.length === 0) throw new Error('Personal-data readiness decisions are missing.');
  if (pending !== decisions.length) {
    throw new Error(`Cannot auto-update legal readiness narrative: ${pending} of ${decisions.length} decisions are pending.`);
  }
  updated = replaceInRange(
    updated,
    personalStart,
    personalEnd,
    /фиксирует (?:[а-яё]+|\d+) обязательных решений; все они остаются `pending`/,
    `фиксирует ${numberWordRu(decisions.length)} обязательных решений; все они остаются \`pending\``,
    'personal-data decision count'
  );

  return updated;
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runCli() {
  const statusPath = process.env.STATUS_DOCUMENT_PATH || path.join(ROOT, 'docs', 'STATUS.md');
  const siteHealthPath = process.env.SITE_HEALTH_PATH || path.join(ROOT, 'data', 'site_health.json');
  const technicalPath = process.env.TECHNICAL_REPORT_PATH || path.join(ROOT, 'data', 'accessibility_performance_report.json');
  const contentOriginPath = process.env.CONTENT_ORIGIN_REPORT_PATH || path.join(ROOT, 'data', 'content_origin_report.json');
  const personalDataPath = process.env.PERSONAL_DATA_READINESS_PATH || path.join(ROOT, 'data', 'personal_data_readiness.json');

  const current = fs.readFileSync(statusPath, 'utf8');
  const updated = updateStatusDocument({
    documentText: current,
    siteHealth: loadJson(siteHealthPath),
    technicalReport: loadJson(technicalPath),
    contentOrigin: loadJson(contentOriginPath),
    personalData: loadJson(personalDataPath)
  });

  if (updated === current) {
    console.log('Status document metrics are already current');
    return;
  }

  fs.writeFileSync(statusPath, updated);
  console.log('Status document metrics updated');
}

if (require.main === module) runCli();

module.exports = { countMatches, formatDateRu, replaceExactly, replaceInRange, updateStatusDocument };

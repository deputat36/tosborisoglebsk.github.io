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

function replaceExactly(text, pattern, replacement, label) {
  const matches = text.match(pattern);
  if (!matches || matches.length !== 1) {
    throw new Error(`${label}: expected exactly one matching status line, found ${matches ? matches.length : 0}`);
  }
  return text.replace(pattern, replacement);
}

function updateStatusDocument({ documentText, siteHealth, technicalReport, contentOrigin, personalData }) {
  let updated = documentText;
  const technical = technicalReport.summary;
  const totals = contentOrigin.totals;
  const decisions = Array.isArray(personalData.decisions) ? personalData.decisions : [];
  const pending = decisions.filter((item) => item.status === 'pending').length;

  const generatedDates = [
    siteHealth.generated_at,
    technicalReport.generated_at,
    contentOrigin.generated_at,
    personalData.updated_at
  ].filter(Boolean).map((value) => new Date(value));
  const newestDate = new Date(Math.max(...generatedDates.map((date) => date.getTime())));

  const replacements = [
    [/^Обновлено: .+\.$/m, `Обновлено: ${formatDateRu(newestDate)}.`, 'update date'],
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
    [/- общая оценка `site_health`: \d+\/100\./, `- общая оценка \`site_health\`: ${siteHealth.health_score}/100.`, 'site health score'],
    [/проверяет \d+ HTML-файла\./, `проверяет ${technical.html_pages} HTML-файла.`, 'technical HTML scope'],
    [/- публичных runtime-ресурсов: \d+;/, `- публичных runtime-ресурсов: ${technical.asset_files};`, 'runtime assets'],
    [/- ресурсов сверх бюджета: \d+;/, `- ресурсов сверх бюджета: ${technical.over_budget_assets};`, 'over-budget assets'],
    [/- общий CSS: [\d ]+ байта;/, `- общий CSS: ${formatNumber(technical.total_css_bytes)} байта;`, 'CSS bytes'],
    [/- общий JavaScript: [\d ]+ байт\./, `- общий JavaScript: ${formatNumber(technical.total_js_bytes)} байт.`, 'JavaScript bytes'],
    [/Разница между \d+ и \d+ страницами/, `Разница между ${siteHealth.pages.total} и ${technical.html_pages} страницами`, 'scope difference'],
    [/- всего материалов: \d+;/, `- всего материалов: ${totals.total};`, 'content total'],
    [/- `verified`: \d+;/, `- \`verified\`: ${totals.verified};`, 'verified content'],
    [/- `editorial`: \d+;/, `- \`editorial\`: ${totals.editorial};`, 'editorial content'],
    [/- `starter`: \d+;/, `- \`starter\`: ${totals.starter};`, 'starter content'],
    [/- `request`: \d+;/, `- \`request\`: ${totals.request};`, 'request content'],
    [/Портал работает в режиме `[^`]+`\./, `Портал работает в режиме \`${personalData.portal_status}\`.`, 'personal-data status']
  ];

  for (const [pattern, replacement, label] of replacements) {
    updated = replaceExactly(updated, pattern, replacement, label);
  }

  if (decisions.length === 0) throw new Error('Personal-data readiness decisions are missing.');
  if (pending !== decisions.length) {
    throw new Error(`Cannot auto-update legal readiness narrative: ${pending} of ${decisions.length} decisions are pending.`);
  }
  updated = replaceExactly(
    updated,
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

module.exports = { formatDateRu, replaceExactly, updateStatusDocument };

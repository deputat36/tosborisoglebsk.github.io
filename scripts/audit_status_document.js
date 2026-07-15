const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function sectionBetween(documentText, startHeading, endHeading) {
  const start = documentText.indexOf(startHeading);
  if (start === -1) return '';
  const end = endHeading ? documentText.indexOf(endHeading, start + startHeading.length) : -1;
  return documentText.slice(start, end === -1 ? undefined : end);
}

function numberWordRu(value) {
  const words = {
    0: 'ноль',
    1: 'одно',
    2: 'два',
    3: 'три',
    4: 'четыре',
    5: 'пять',
    6: 'шесть',
    7: 'семь',
    8: 'восемь',
    9: 'девять',
    10: 'десять',
    11: 'одиннадцать',
    12: 'двенадцать'
  };
  return words[value] || String(value);
}

function auditStatusDocument({ documentText, siteHealth, technicalReport, contentOrigin, personalData }) {
  const errors = [];
  const requireToken = (scope, token, label) => {
    if (!scope.includes(token)) errors.push(`${label}: expected token not found: ${token}`);
  };

  if (!documentText.startsWith('# Состояние проекта')) {
    errors.push('Status document must start with "# Состояние проекта".');
  }
  if (!/^Обновлено: \d{1,2} [а-яё]+ 20\d{2} года\.$/m.test(documentText)) {
    errors.push('Status document must contain a human-readable update date.');
  }

  requireToken(documentText, 'основной ветки `release-2025-12-22`', 'main branch contract');
  requireToken(documentText, 'PR #220 закрыт без слияния', 'closed PR 220 contract');

  const forbiddenClaims = [
    'Рабочий draft PR: #220',
    'сохранять PR #220 draft',
    'Перенос или удаление ждёт решения владельца проекта'
  ];
  for (const claim of forbiddenClaims) {
    if (documentText.includes(claim)) errors.push(`Stale status claim is forbidden: ${claim}`);
  }

  const metricsSection = sectionBetween(
    documentText,
    '## Актуальные метрики основной ветки',
    '## Завершённые технические циклы в основной ветке'
  );
  if (!metricsSection) errors.push('Current metrics section is missing.');

  const pageExpectations = [
    [`управляемых HTML-страниц: ${siteHealth.pages.total};`, 'managed HTML pages'],
    [`публичных страниц: ${siteHealth.pages.public};`, 'public pages'],
    [`служебных страниц \`noindex\`: ${siteHealth.pages.noindex};`, 'noindex pages'],
    [`битых внутренних ссылок и якорей: ${siteHealth.pages.broken_internal_links_count};`, 'broken links'],
    [`базовых SEO-предупреждений: ${siteHealth.pages.seo_warnings_count};`, 'SEO warnings'],
    [`карточек ТОС: ${siteHealth.catalog.total_tos};`, 'TOS total'],
    [`карточек высокого приоритета: ${siteHealth.catalog.high_priority};`, 'high-priority TOS'],
    [`карточек со статусом \`verified\`: ${siteHealth.catalog.verified_count};`, 'verified TOS'],
    [`карточек со статусом \`partial\`: ${siteHealth.catalog.partial_count};`, 'partial TOS'],
    [`карточек \`needs_review\`: ${siteHealth.catalog.needs_review_count};`, 'needs-review TOS'],
    [`средняя заполненность карточек: ${siteHealth.catalog.average_score}%;`, 'average TOS score'],
    [`общая оценка \`site_health\`: ${siteHealth.health_score}/100.`, 'health score']
  ];
  for (const [token, label] of pageExpectations) requireToken(metricsSection, token, label);

  const technical = technicalReport.summary;
  const technicalExpectations = [
    [`проверяет ${technical.html_pages} HTML-файла`, 'technical HTML scope'],
    [`публичных страниц: ${technical.public_pages};`, 'technical public pages'],
    [`страниц с замечаниями: ${technical.pages_with_issues};`, 'technical findings pages'],
    [`high / medium / low: ${technical.issue_severity.high} / ${technical.issue_severity.medium} / ${technical.issue_severity.low};`, 'technical severities'],
    [`публичных runtime-ресурсов: ${technical.asset_files};`, 'runtime assets'],
    [`ресурсов сверх бюджета: ${technical.over_budget_assets};`, 'over-budget assets'],
    [`общий CSS: ${formatNumber(technical.total_css_bytes)} байта;`, 'total CSS bytes'],
    [`общий JavaScript: ${formatNumber(technical.total_js_bytes)} байт.`, 'total JavaScript bytes'],
    [`Разница между ${siteHealth.pages.total} и ${technical.html_pages} страницами`, 'scope difference explanation']
  ];
  for (const [token, label] of technicalExpectations) requireToken(metricsSection, token, label);

  if (siteHealth.pages.public !== technical.public_pages) {
    errors.push(`Source mismatch: site_health public=${siteHealth.pages.public}, technical report public=${technical.public_pages}.`);
  }
  if (siteHealth.pages.seo_warnings_count !== 0 || siteHealth.pages.broken_internal_links_count !== 0) {
    errors.push('Status governance requires zero SEO warnings and broken internal links.');
  }
  if (technical.pages_with_issues !== 0 || technical.over_budget_assets !== 0) {
    errors.push('Status governance requires zero technical findings and over-budget assets.');
  }

  const totals = contentOrigin.totals;
  const contentExpectations = [
    [`всего материалов: ${totals.total};`, 'content total'],
    [`\`verified\`: ${totals.verified};`, 'verified content'],
    [`\`editorial\`: ${totals.editorial};`, 'editorial content'],
    [`\`starter\`: ${totals.starter};`, 'starter content'],
    [`\`request\`: ${totals.request};`, 'request content']
  ];
  for (const [token, label] of contentExpectations) requireToken(documentText, token, label);

  requireToken(documentText, `Портал работает в режиме \`${personalData.portal_status}\`.`, 'personal-data portal status');
  const decisions = Array.isArray(personalData.decisions) ? personalData.decisions : [];
  const pending = decisions.filter((item) => item.status === 'pending').length;
  if (decisions.length === 0) errors.push('Personal-data readiness decisions are missing.');
  if (pending === decisions.length && decisions.length > 0) {
    requireToken(
      documentText,
      `фиксирует ${numberWordRu(decisions.length)} обязательных решений; все они остаются \`pending\``,
      'personal-data pending decisions'
    );
  } else {
    errors.push(`Personal-data readiness changed: ${pending} of ${decisions.length} decisions are pending; STATUS.md needs an explicit contract update.`);
  }

  return errors;
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

  const errors = auditStatusDocument({
    documentText: fs.readFileSync(statusPath, 'utf8'),
    siteHealth: loadJson(siteHealthPath),
    technicalReport: loadJson(technicalPath),
    contentOrigin: loadJson(contentOriginPath),
    personalData: loadJson(personalDataPath)
  });

  if (errors.length) {
    console.error('Status document audit failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log('Status document audit OK');
}

if (require.main === module) runCli();

module.exports = {
  auditStatusDocument,
  formatNumber,
  numberWordRu,
  sectionBetween
};

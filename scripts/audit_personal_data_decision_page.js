const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'personal-data-decisions', 'index.html');
const DOC_PATH = path.join(ROOT, 'docs', 'PERSONAL-DATA-DECISION-PACKET.md');
const READINESS_DOC_PATH = path.join(ROOT, 'docs', 'PERSONAL-DATA-READINESS-2026-07-14.md');
const MANUAL_AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_manual_extensions.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'personal-data-decisions-audit.yml');

const REQUIRED_LINKS = [
  '/data/personal_data_decision_packet.csv',
  '/data/personal_data_readiness.json',
  '/docs/PERSONAL-DATA-DECISION-PACKET.md',
  '/privacy/',
  '/workbench/',
  '/contacts/'
];

const REQUIRED_FILTERS = [
  'all',
  'pending',
  'in_review',
  'blocked',
  'approved',
  'needs_owner',
  'needs_legal_reviewer',
  'ready_for_review',
  'implementation_pending',
  'invalid'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function checkContains(errors, content, label, token) {
  if (!content.includes(token)) errors.push(`${label}: missing ${token}`);
}

function localPathFor(link) {
  return link.split('?')[0].split('#')[0];
}

function main() {
  const errors = [];
  const html = read(PAGE_PATH);
  const doc = read(DOC_PATH);
  const readinessDoc = read(READINESS_DOC_PATH);
  const manualAudit = read(MANUAL_AUDIT_PATH);
  const workflow = read(WORKFLOW_PATH);

  for (const marker of [
    '<html lang="ru">',
    '<title>Решения по персональным данным — ТОС БГО</title>',
    '<meta name="robots" content="noindex,nofollow"/>',
    '<link rel="canonical" href="https://tosborisoglebsk.ru/personal-data-decisions/"/>',
    '<main id="main">',
    'id="personal-data-decision-stats"',
    'id="personal-data-decision-list"',
    'Восемь решений по персональным данным и медиа',
    'issue #205',
    'Граница доверия:',
    'все восемь решений остаются <code>pending</code>',
    'Страница не включает сбор данных, согласий или автоматическую публикацию',
    'не создаёт юридическое заключение',
    'decision:',
    'evidence:',
    'approved',
    'pre_legal_readiness'
  ]) checkContains(errors, html, 'personal-data-decisions/index.html', marker);

  REQUIRED_LINKS.forEach((link) => {
    checkContains(errors, html, 'personal-data-decisions/index.html', `href="${link}"`);
    if (!repoPathExists(localPathFor(link))) errors.push(`personal-data-decisions/index.html: linked target is missing ${link}`);
  });

  REQUIRED_FILTERS.forEach((filter) => {
    checkContains(errors, html, 'personal-data-decisions/index.html', `data-personal-data-decision-filter="${filter}"`);
  });

  const siteIndex = html.indexOf('/assets/js/site.js');
  const validationIndex = html.indexOf('/assets/js/personal-data-decision-validation.js');
  const pageIndex = html.indexOf('/assets/js/personal-data-decisions.js');
  if (!(siteIndex >= 0 && validationIndex > siteIndex && pageIndex > validationIndex)) {
    errors.push('personal data decision scripts must load in order: site, validation, page');
  }
  if (/<form\b/i.test(html)) errors.push('personal-data-decisions page must not contain an active form');

  for (const token of [
    'не является юридическим заключением',
    'Нельзя:',
    'Статусы решения',
    'Статусы реализации',
    'Назначение оператора',
    'Цели и категории данных',
    'Основания обработки и распространения',
    'Форма согласия на распространение',
    'Разрешение на фотографии, логотипы и медиа',
    'Отзыв, исправление и удаление',
    'Закрытое хранилище доказательств',
    'Хранение, доступ и инциденты',
    'Как перевести решение в `in_review`',
    'Как перевести решение в `approved`',
    'Портал остаётся в `pre_legal_readiness`',
    'Автоматический аудит подтверждает только целостность процесса'
  ]) checkContains(errors, doc, 'PERSONAL-DATA-DECISION-PACKET.md', token);

  for (const token of [
    'data/personal_data_decision_packet.csv',
    '/personal-data-decisions/',
    'Пакет не выбирает решения за оператора или юриста'
  ]) checkContains(errors, readinessDoc, 'PERSONAL-DATA-READINESS-2026-07-14.md', token);

  for (const script of [
    'scripts/test_personal_data_decision_packet.js',
    'scripts/audit_personal_data_decision_packet.js',
    'scripts/audit_personal_data_decision_page.js'
  ]) {
    if (!manualAudit.includes(script)) errors.push(`audit_manual_extensions.js must include ${script}`);
  }

  for (const token of [
    'name: Audit personal data decisions',
    'contents: read',
    'Test personal data decision packet',
    'Audit personal data decision packet',
    'Audit personal data decision page',
    'Audit canonical personal data readiness',
    'Run full project mode audits',
    'data/personal_data_decision_packet.csv',
    'personal-data-decisions/index.html'
  ]) checkContains(errors, workflow, 'personal-data-decisions-audit.yml', token);
  if (/contents:\s*write/i.test(workflow)) errors.push('personal data decisions workflow must remain read-only');

  if (errors.length) {
    throw new Error(`Personal data decision page audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log(`Personal data decision page OK: ${REQUIRED_FILTERS.length} filters, ${REQUIRED_LINKS.length} linked sources`);
}

main();

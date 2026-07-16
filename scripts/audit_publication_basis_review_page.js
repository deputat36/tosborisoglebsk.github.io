const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'publication-basis-review', 'index.html');
const MANUAL_AUDIT_PATH = path.join(ROOT, 'scripts', 'audit_manual_extensions.js');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'publication-basis-execution-audit.yml');

const REQUIRED_LINKS = [
  '/data/publication_basis_confirmation_register.csv',
  '/data/publication_basis_review_queue.csv',
  '/data/publication_basis_confirmation_templates.json',
  '/docs/PUBLICATION-BASIS-CONFIRMATION-PACKET-2026-07-14.md',
  '/workbench/'
];

const REQUIRED_FILTERS = [
  'all',
  'wave1',
  'wave2',
  'wave3',
  'draft',
  'ready',
  'waiting',
  'received',
  'needs_clarification',
  'overdue',
  'finalized',
  'invalid'
];

const REQUIRED_PHRASES = [
  'Проверка оснований публикации',
  'Обезличенный журнал 24 карточек',
  'Страница не отправляет сообщения и не создаёт юридическое согласие',
  'Граница доверия:',
  'draft',
  'publication_consent_ref',
  'partial',
  'verified',
  'Очередь исполнения',
  'Адреса получателей, телефоны, email, скриншоты и сырые ответы здесь не хранятся',
  'Подготовить канал',
  'Отправить фактически',
  'Зафиксировать ответ',
  'Разобрать безопасно',
  'keep_current',
  'remove_fields',
  'replace_with_general_channel',
  'hide_until_confirmed',
  'no_change_without_evidence',
  'Юридическая модель остаётся отдельной задачей #205'
];

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${path.relative(ROOT, filePath)}`);
  return fs.readFileSync(filePath, 'utf8');
}

function checkContains(errors, content, label, needle) {
  if (!content.includes(needle)) errors.push(`${label}: missing ${needle}`);
}

function localPathFor(link) {
  return link.split('?')[0].split('#')[0];
}

function main() {
  const errors = [];
  const html = read(PAGE_PATH);

  for (const marker of [
    '<html lang="ru">',
    '<title>Проверка оснований публикации — ТОС БГО</title>',
    '<meta name="robots" content="noindex,nofollow"/>',
    '<link rel="canonical" href="https://tosborisoglebsk.ru/publication-basis-review/"/>',
    '<meta property="og:url" content="https://tosborisoglebsk.ru/publication-basis-review/"/>',
    '<main id="main">',
    'id="publication-basis-stats"',
    'id="publication-basis-list"'
  ]) checkContains(errors, html, 'publication-basis-review/index.html', marker);

  REQUIRED_PHRASES.forEach((phrase) => checkContains(errors, html, 'publication-basis-review/index.html', phrase));

  REQUIRED_LINKS.forEach((link) => {
    checkContains(errors, html, 'publication-basis-review/index.html', `href="${link}"`);
    if (!repoPathExists(localPathFor(link))) errors.push(`publication-basis-review/index.html: linked target is missing ${link}`);
  });

  REQUIRED_FILTERS.forEach((filter) => {
    checkContains(errors, html, 'publication-basis-review/index.html', `data-publication-basis-filter="${filter}"`);
  });

  const siteIndex = html.indexOf('/assets/js/site.js');
  const validationIndex = html.indexOf('/assets/js/publication-basis-validation.js');
  const registerIndex = html.indexOf('/assets/js/publication-basis-register.js');
  if (!(siteIndex >= 0 && validationIndex > siteIndex && registerIndex > validationIndex)) {
    errors.push('publication basis scripts must load in order: site, validation, register');
  }

  for (const filePath of [
    '/assets/js/publication-basis-validation.js',
    '/assets/js/publication-basis-register.js',
    '/data/publication_basis_confirmation_register.csv'
  ]) {
    if (!repoPathExists(filePath)) errors.push(`missing publication basis execution file ${filePath}`);
  }

  const manualAudit = read(MANUAL_AUDIT_PATH);
  for (const script of [
    'scripts/test_publication_basis_execution.js',
    'scripts/audit_publication_basis_confirmation_register.js',
    'scripts/audit_publication_basis_review_page.js'
  ]) {
    if (!manualAudit.includes(script)) errors.push(`audit_manual_extensions.js must include ${script}`);
  }

  const workflow = read(WORKFLOW_PATH);
  for (const token of [
    'name: Audit publication basis execution',
    'contents: read',
    'Test publication basis execution states',
    'Audit publication basis confirmation register',
    'Audit publication basis review page',
    'Run full project mode audits',
    'data/publication_basis_confirmation_register.csv',
    'publication-basis-review/index.html'
  ]) {
    if (!workflow.includes(token)) errors.push(`publication basis execution workflow is missing ${token}`);
  }
  if (/contents:\s*write/i.test(workflow)) errors.push('publication basis execution workflow must remain read-only');

  if (errors.length) {
    throw new Error(`Publication basis review page audit failed:\n${Array.from(new Set(errors)).join('\n')}`);
  }

  console.log(`Publication basis review page OK: ${REQUIRED_FILTERS.length} filters, ${REQUIRED_LINKS.length} linked sources`);
}

main();

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const DOC_PATH = path.join(ROOT, 'docs', 'EDITORIAL-REQUEST-PAGES-2026-07-14.md');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');

const pages = [
  {
    route: '/data-requests/priority-tos/',
    file: 'data-requests/priority-tos/index.html',
    canonical: 'https://tosborisoglebsk.ru/data-requests/priority-tos/',
    required: [
      'Роль страницы:',
      'внутренний редакционный шаблон',
      'Страница не отправляет сообщения автоматически',
      'наличие текста не означает, что запрос уже отправлен',
      '/data/priority_tos_tracking_template.csv',
      '/data/priority_tos_response_review.csv',
      '/reply-review/',
      '/update-tos/?tos=ivanovka&amp;type=card#message-builder'
    ]
  },
  {
    route: '/data-requests/tos-registry-request/',
    file: 'data-requests/tos-registry-request/index.html',
    canonical: 'https://tosborisoglebsk.ru/data-requests/tos-registry-request/',
    required: [
      'Роль страницы:',
      'внутренний редакционный шаблон',
      'запрос не считается отправленным',
      'реестр — полученным или подтверждённым',
      '/registry-check/',
      '/data/tos_registry_request_template.csv',
      '/data/tos_registry_missing_candidates.csv',
      '/update-tos/?type=card#message-builder'
    ]
  }
];

function read(filePath, label, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing ${label}: ${path.relative(ROOT, filePath)}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function requireTokens(text, tokens, context, errors) {
  for (const token of tokens) {
    if (!text.includes(token)) errors.push(`${context}: missing token ${token}`);
  }
}

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function main() {
  const errors = [];
  const sitemap = read(SITEMAP_PATH, 'sitemap', errors);
  const documentation = read(DOC_PATH, 'editorial request documentation', errors);
  const packageText = read(PACKAGE_PATH, 'package.json', errors);
  const projectMode = read(PROJECT_MODE_PATH, 'project-mode audit', errors);
  const projectModeFull = read(PROJECT_MODE_FULL_PATH, 'full project-mode audit', errors);

  for (const page of pages) {
    const filePath = path.join(ROOT, page.file);
    const html = read(filePath, page.route, errors);
    if (!html) continue;

    const context = page.route;
    if (count(html, /<meta\s+name="robots"\s+content="noindex,follow"\s*\/?>/gi) !== 1) {
      errors.push(`${context}: must contain exactly one noindex,follow robots meta`);
    }
    if (html.includes('name="robots" content="index')) errors.push(`${context}: index robots directive is forbidden`);
    if (html.includes('name="robots" content="noindex,nofollow"')) errors.push(`${context}: internal navigation must remain follow`);
    if (!html.includes(`<link rel="canonical" href="${page.canonical}"/>`)) {
      errors.push(`${context}: wrong or missing canonical`);
    }
    if (!html.includes('<main id="main">')) errors.push(`${context}: main landmark is required`);
    if (!html.includes('class="skip-link"')) errors.push(`${context}: skip link is required`);
    if (/<form\b/i.test(html)) errors.push(`${context}: page must not contain an active form`);
    if (/https?:\/\/api\.|fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/i.test(html)) {
      errors.push(`${context}: automatic network submission code is forbidden`);
    }

    requireTokens(html, page.required, context, errors);

    if (sitemap.includes(`<loc>https://tosborisoglebsk.ru${page.route}</loc>`)) {
      errors.push(`${context}: noindex editorial page must not be in sitemap`);
    }
  }

  requireTokens(documentation, [
    'Две внутренние редакционные страницы',
    '`noindex,follow`',
    'не означает факт отправки',
    'не входят в sitemap',
    'не скрывает публичную форму передачи данных',
    'После слияния'
  ], 'editorial request documentation', errors);

  try {
    const packageJson = JSON.parse(packageText);
    const scripts = packageJson.scripts || {};
    if (scripts['audit:editorial-request-pages'] !== 'node scripts/audit_editorial_request_pages.js') {
      errors.push('package.json must define audit:editorial-request-pages');
    }
    if (!String(scripts['audit:all'] || '').includes('npm run audit:editorial-request-pages')) {
      errors.push('audit:all must include audit:editorial-request-pages');
    }
  } catch (error) {
    errors.push(`package.json is invalid JSON: ${error.message}`);
  }

  requireTokens(projectMode, [
    "['Editorial request pages', 'scripts/audit_editorial_request_pages.js']"
  ], 'project-mode audit', errors);
  requireTokens(projectModeFull, [
    "['Editorial request pages audit', 'scripts/audit_editorial_request_pages.js']"
  ], 'full project-mode audit', errors);

  if (errors.length) {
    throw new Error(`Editorial request pages audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Editorial request pages OK: ${pages.length} internal routes are noindex, follow and absent from sitemap`);
}

main();

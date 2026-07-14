const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const SITE_URL = 'https://tosborisoglebsk.ru';
const LLMS_PATH = path.join(ROOT, 'llms.txt');
const PATCH_PATH = path.join(ROOT, 'scripts', 'patch_llms_links.js');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const DOC_PATH = path.join(ROOT, 'docs', 'LLMS-DISCOVERY-BOUNDARIES-2026-07-14.md');
const WORKFLOW_PATH = path.join(ROOT, '.github', 'workflows', 'llms-discovery-audit.yml');
const PACKAGE_PATH = path.join(ROOT, 'package.json');
const PROJECT_MODE_PATH = path.join(ROOT, 'scripts', 'audit_project_mode.js');
const PROJECT_MODE_FULL_PATH = path.join(ROOT, 'scripts', 'audit_project_mode_full.js');

const PUBLIC_SECTIONS = ['Основные публичные разделы', 'Публичные методические разделы'];
const EDITORIAL_ROUTES = [
  '/data-requests/',
  '/data-requests/priority-tos/',
  '/data-requests/tos-registry-request/'
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sections(text) {
  const result = new Map();
  const matches = [...text.matchAll(/^##\s+(.+)$/gm)];
  matches.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    result.set(match[1].trim(), text.slice(start, end).trim());
  });
  return result;
}

function siteUrls(text) {
  return [...text.matchAll(/https:\/\/tosborisoglebsk\.ru\/[^\s)]+/g)]
    .map((match) => match[0].replace(/[.,;]+$/, ''));
}

function routeToFile(route) {
  if (route === '/') return path.join(ROOT, 'index.html');
  const clean = route.replace(/^\/+/, '').split(/[?#]/)[0];
  if (!clean || clean.includes('..')) return null;
  const direct = path.join(ROOT, clean);
  if (route.endsWith('/')) return path.join(direct, 'index.html');
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  return path.join(direct, 'index.html');
}

function isNoindex(html) {
  return /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
}

function requireTokens(text, tokens, errors, label) {
  for (const token of tokens) {
    if (!text.includes(token)) errors.push(`${label}: missing token ${token}`);
  }
}

function validatePublicSections(llmsSections, errors) {
  const seen = new Set();
  for (const sectionName of PUBLIC_SECTIONS) {
    const content = llmsSections.get(sectionName);
    if (!content) {
      errors.push(`llms.txt: missing section ${sectionName}`);
      continue;
    }

    for (const url of siteUrls(content)) {
      if (seen.has(url)) errors.push(`llms.txt: duplicate public recommendation ${url}`);
      seen.add(url);

      const route = new URL(url).pathname;
      if (EDITORIAL_ROUTES.includes(route)) {
        errors.push(`llms.txt: editorial route must not be publicly recommended ${route}`);
        continue;
      }

      const filePath = routeToFile(route);
      if (!filePath || !fs.existsSync(filePath)) {
        errors.push(`llms.txt: public recommendation target is missing ${route}`);
        continue;
      }
      if (!filePath.endsWith('.html')) continue;
      if (isNoindex(read(filePath))) {
        errors.push(`llms.txt: public recommendation points to noindex page ${route}`);
      }
    }
  }
}

function validateEditorialRoutes(llmsSections, errors) {
  const working = llmsSections.get('Рабочие страницы');
  if (!working) {
    errors.push('llms.txt: missing section Рабочие страницы');
    return;
  }

  requireTokens(working, [
    'предназначены для редактора',
    'закрыты от индексации через `noindex`',
    'не нужно считать основными публичными разделами',
    ...EDITORIAL_ROUTES.map((route) => `\`${route}\``)
  ], errors, 'llms.txt working pages');

  const sitemap = fs.existsSync(SITEMAP_PATH) ? read(SITEMAP_PATH) : '';
  for (const route of EDITORIAL_ROUTES) {
    const filePath = routeToFile(route);
    if (!filePath || !fs.existsSync(filePath)) {
      errors.push(`editorial route target is missing ${route}`);
      continue;
    }
    if (!isNoindex(read(filePath))) errors.push(`editorial route must remain noindex ${route}`);
    if (sitemap.includes(`${SITE_URL}${route}`)) errors.push(`editorial route must not be in sitemap ${route}`);
  }
}

function validateGenerator(errors) {
  if (!fs.existsSync(PATCH_PATH)) {
    errors.push('missing scripts/patch_llms_links.js');
    return;
  }
  const patch = read(PATCH_PATH);
  requireTokens(patch, [
    'const workingNotice',
    'function ensureWorkingNotice',
    'https://tosborisoglebsk.ru/data-requests/',
    'https://tosborisoglebsk.ru/data-requests/priority-tos/',
    'https://tosborisoglebsk.ru/data-requests/tos-registry-request/',
    'Patched llms.txt public and editorial boundaries.'
  ], errors, 'patch_llms_links.js');

  if (/\['Запросы на уточнение данных'\s*,\s*'https:\/\/tosborisoglebsk\.ru\/data-requests\/'\]/.test(patch)) {
    errors.push('patch_llms_links.js must not add data-requests to public methodLinks');
  }
}

function validateIntegration(errors) {
  for (const filePath of [DOC_PATH, WORKFLOW_PATH, PACKAGE_PATH, PROJECT_MODE_PATH, PROJECT_MODE_FULL_PATH]) {
    if (!fs.existsSync(filePath)) errors.push(`missing integration file ${path.relative(ROOT, filePath)}`);
  }
  if (errors.length) return;

  const doc = read(DOC_PATH);
  requireTokens(doc, ['llms.txt', 'noindex', 'sitemap', 'PR №246', 'llms-discovery-audit.yml'], errors, 'documentation');

  const workflow = read(WORKFLOW_PATH);
  requireTokens(workflow, [
    'contents: read',
    'node scripts/patch_llms_links.js',
    'node scripts/generate_sitemap.js',
    'node scripts/audit_editorial_request_pages.js',
    'node scripts/audit_llms_discovery_boundaries.js',
    'node scripts/audit_project_mode_full.js'
  ], errors, 'llms discovery workflow');
  if (/contents:\s*write/i.test(workflow)) errors.push('llms discovery workflow must remain read-only');

  const patchIndex = workflow.indexOf('node scripts/patch_llms_links.js');
  const auditIndex = workflow.indexOf('node scripts/audit_llms_discovery_boundaries.js');
  if (patchIndex < 0 || auditIndex < 0 || patchIndex > auditIndex) {
    errors.push('llms patch must run before llms discovery audit');
  }

  const packageJson = JSON.parse(read(PACKAGE_PATH));
  const scripts = packageJson.scripts || {};
  if (scripts['audit:llms-discovery'] !== 'node scripts/audit_llms_discovery_boundaries.js') {
    errors.push('package.json must define audit:llms-discovery');
  }
  if (!String(scripts['audit:all'] || '').includes('npm run audit:llms-discovery')) {
    errors.push('audit:all must include audit:llms-discovery');
  }

  for (const [label, filePath] of [['project-mode', PROJECT_MODE_PATH], ['project-mode-full', PROJECT_MODE_FULL_PATH]]) {
    if (!read(filePath).includes('scripts/audit_llms_discovery_boundaries.js')) {
      errors.push(`${label} must include llms discovery audit`);
    }
  }
}

function main() {
  const errors = [];
  if (!fs.existsSync(LLMS_PATH)) errors.push('missing llms.txt');
  if (!fs.existsSync(SITEMAP_PATH)) errors.push('missing sitemap.xml');
  if (errors.length) throw new Error(`LLMS discovery boundary audit failed:\n${errors.join('\n')}`);

  const llms = read(LLMS_PATH);
  const llmsSections = sections(llms);
  validatePublicSections(llmsSections, errors);
  validateEditorialRoutes(llmsSections, errors);
  validateGenerator(errors);
  validateIntegration(errors);

  if (errors.length) throw new Error(`LLMS discovery boundary audit failed:\n${errors.join('\n')}`);

  console.log(`LLMS discovery boundaries OK: ${PUBLIC_SECTIONS.length} public sections, ${EDITORIAL_ROUTES.length} editorial routes`);
}

main();

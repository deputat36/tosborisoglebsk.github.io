const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { repoPathExists } = require('./lib/path_checks');

const ROOT = process.cwd();
const pagePath = path.join(ROOT, 'data-quality', 'index.html');
const scriptPath = path.join(ROOT, 'assets', 'js', 'data-quality.js');
const auditDataPath = path.join(ROOT, 'data', 'tos_content_audit.json');
const auditGeneratorPath = path.join(ROOT, 'scripts', 'generate_content_audit.js');

function requireIncludes(errors, content, needle, label) {
  if (!content.includes(needle)) {
    errors.push(`missing ${label}: ${needle}`);
  }
}

function requireRoute(errors, route) {
  if (!repoPathExists(route)) {
    errors.push(`missing route ${route}`);
  }
}

function main() {
  const errors = [];

  if (!fs.existsSync(pagePath)) errors.push('missing data-quality/index.html');
  if (!fs.existsSync(scriptPath)) errors.push('missing assets/js/data-quality.js');
  if (!fs.existsSync(auditGeneratorPath)) errors.push('missing scripts/generate_content_audit.js');

  if (errors.length) {
    throw new Error(`Data quality content audit failed:\n${errors.join('\n')}`);
  }

  execFileSync(process.execPath, [auditGeneratorPath], { cwd: ROOT, stdio: 'pipe' });
  if (!fs.existsSync(auditDataPath)) errors.push('missing generated data/tos_content_audit.json');
  if (errors.length) throw new Error(`Data quality content audit failed:\n${errors.join('\n')}`);

  const html = fs.readFileSync(pagePath, 'utf8');
  const js = fs.readFileSync(scriptPath, 'utf8');
  const auditData = JSON.parse(fs.readFileSync(auditDataPath, 'utf8'));

  requireIncludes(errors, html, '<html lang="ru">', 'Russian language marker');
  requireIncludes(errors, html, '<title>Качество данных каталога ТОС БГО</title>', 'page title');
  requireIncludes(errors, html, 'href="https://tosborisoglebsk.ru/data-quality/"', 'canonical');
  requireIncludes(errors, html, 'property="og:url" content="https://tosborisoglebsk.ru/data-quality/"', 'Open Graph URL');
  requireIncludes(errors, html, '<main id="main">', 'main landmark');
  requireIncludes(errors, html, 'id="quality-summary"', 'quality summary container');
  requireIncludes(errors, html, 'id="quality-list"', 'quality list container');
  requireIncludes(errors, html, '/assets/js/site.js', 'site script');
  requireIncludes(errors, html, '/assets/js/data-quality.js', 'data quality script');
  requireIncludes(errors, html, 'Заполненность карточки не равна полной проверке', 'quality disclaimer');
  requireIncludes(errors, html, 'только те сведения, которые можно размещать открыто', 'public data limitation');
  requireIncludes(errors, html, 'не засчитывается как содержательная публикация самого ТОС', 'content maturity explanation');

  [
    '/update-tos/',
    '/verification-tasks/',
    '/chairperson/verify-card/',
    '/sources/',
    '/audit/',
    '/tos/',
    '/collection-board/'
  ].forEach((route) => requireRoute(errors, route));

  requireIncludes(errors, js, "qualityJson('/data/tos_content_audit.json')", 'audit JSON loading');
  requireIncludes(errors, js, "cache: 'no-store'", 'no-store loading');
  requireIncludes(errors, js, 'qualityEsc', 'HTML escaping helper');
  requireIncludes(errors, js, "replace(/[&<>'\"]/g", 'HTML-sensitive character replacement');
  requireIncludes(errors, js, 'verified_count', 'verified count metric');
  requireIncludes(errors, js, 'partial_count', 'partial count metric');
  requireIncludes(errors, js, 'needs_review_count', 'needs review metric');
  requireIncludes(errors, js, 'without_phone', 'without phone metric');
  requireIncludes(errors, js, 'without_social', 'without social metric');
  requireIncludes(errors, js, 'without_news', 'without substantive news metric');
  requireIncludes(errors, js, 'request_only_news', 'request-only news metric');
  requireIncludes(errors, js, 'without_done', 'without substantive done metric');
  requireIncludes(errors, js, 'request_only_done', 'request-only done metric');
  requireIncludes(errors, js, 'contentMaturityTags', 'content maturity helper');
  requireIncludes(errors, js, 'запрос вместо новости', 'request instead of news label');
  requireIncludes(errors, js, 'запрос вместо результата', 'request instead of result label');
  requireIncludes(errors, js, "priority === 'Высокий'", 'high priority filter');
  requireIncludes(errors, js, 'cardUpdateUrl', 'card update URL helper');
  requireIncludes(errors, js, '/verification-tasks/', 'verification tasks link');
  requireIncludes(errors, js, '/collection-board/', 'collection board link');

  if (!auditData || typeof auditData !== 'object' || Array.isArray(auditData)) {
    errors.push('data/tos_content_audit.json must be an object');
  } else {
    if (!auditData.summary || typeof auditData.summary !== 'object') {
      errors.push('data/tos_content_audit.json must contain summary object');
    }
    if (!Array.isArray(auditData.items)) {
      errors.push('data/tos_content_audit.json must contain items array');
    }
    if (auditData.summary && typeof auditData.summary.total_tos !== 'number') {
      errors.push('summary.total_tos must be a number');
    }
    ['request_only_news', 'request_only_done', 'request_only_needs', 'request_only_projects'].forEach((key) => {
      if (auditData.summary && typeof auditData.summary[key] !== 'number') errors.push(`summary.${key} must be a number`);
    });
    if (Array.isArray(auditData.items)) {
      auditData.items.forEach((item) => {
        if (!item.linked_requests || typeof item.linked_requests.news !== 'number') {
          errors.push(`${item.slug || 'unknown'}: linked_requests.news must be a number`);
        }
        if (!item.linked_all || typeof item.linked_all.news !== 'number') {
          errors.push(`${item.slug || 'unknown'}: linked_all.news must be a number`);
        }
        if ((item.linked?.news || 0) + (item.linked_requests?.news || 0) !== (item.linked_all?.news || 0)) {
          errors.push(`${item.slug || 'unknown'}: news substantive plus requests must equal all records`);
        }
      });
    }
  }

  try {
    execFileSync(process.execPath, ['--check', scriptPath], { cwd: ROOT, stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', auditGeneratorPath], { cwd: ROOT, stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', __filename], { cwd: ROOT, stdio: 'pipe' });
  } catch (error) {
    errors.push(`syntax failed: ${String(error.stderr || error.message).trim()}`);
  }

  if (errors.length) {
    throw new Error(`Data quality content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Data quality content OK: substantive content and editorial requests are separated');
}

main();

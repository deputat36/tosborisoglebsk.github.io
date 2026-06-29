const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const pagePath = path.join(process.cwd(), 'data-quality', 'index.html');
const scriptPath = path.join(process.cwd(), 'assets', 'js', 'data-quality.js');
const auditDataPath = path.join(process.cwd(), 'data', 'tos_content_audit.json');

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
  if (!fs.existsSync(auditDataPath)) errors.push('missing data/tos_content_audit.json');

  if (errors.length) {
    throw new Error(`Data quality content audit failed:\n${errors.join('\n')}`);
  }

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
  requireIncludes(errors, js, 'cache: \'no-store\'', 'no-store loading');
  requireIncludes(errors, js, 'qualityEsc', 'HTML escaping helper');
  requireIncludes(errors, js, 'replace(/[&<>\'\"]/g', 'HTML-sensitive character replacement');
  requireIncludes(errors, js, 'verified_count', 'verified count metric');
  requireIncludes(errors, js, 'partial_count', 'partial count metric');
  requireIncludes(errors, js, 'needs_review_count', 'needs review metric');
  requireIncludes(errors, js, 'without_phone', 'without phone metric');
  requireIncludes(errors, js, 'without_social', 'without social metric');
  requireIncludes(errors, js, 'without_news', 'without news metric');
  requireIncludes(errors, js, 'without_done', 'without done metric');
  requireIncludes(errors, js, 'verification_status !== \'verified\'', 'unverified item filter');
  requireIncludes(errors, js, 'priority === \'Высокий\'', 'high priority filter');
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
  }

  if (errors.length) {
    throw new Error(`Data quality content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Data quality content OK');
}

main();

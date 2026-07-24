const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const paths = {
  siteHealth: path.join(ROOT, 'data', 'site_health.json'),
  linkReport: path.join(ROOT, 'data', 'public_link_integrity.json'),
  pageIndex: path.join(ROOT, 'data', 'page_index.json'),
  html: path.join(ROOT, 'site-health', 'index.html'),
  browser: path.join(ROOT, 'assets', 'js', 'site-health-integrity.js'),
  enrichment: path.join(ROOT, 'scripts', 'enrich_site_health_technical_integrity.js'),
  browserTest: path.join(ROOT, 'scripts', 'test_site_health_technical_integrity.js'),
  mainWorkflow: path.join(ROOT, '.github', 'workflows', 'generate-tos-pages.yml'),
  visualWorkflow: path.join(ROOT, '.github', 'workflows', 'visual-baseline.yml'),
  linkWorkflow: path.join(ROOT, '.github', 'workflows', 'public-link-integrity.yml')
};

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label}: missing ${fragment}`);
  });
}

function number(errors, label, value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) errors.push(`${label} must be a non-negative number`);
}

function main() {
  const errors = [];
  Object.entries(paths).forEach(([label, filePath]) => {
    if (!fs.existsSync(filePath)) errors.push(`missing ${label}: ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Site health technical integrity audit failed:\n${errors.join('\n')}`);

  const siteHealth = JSON.parse(fs.readFileSync(paths.siteHealth, 'utf8'));
  const linkReport = JSON.parse(fs.readFileSync(paths.linkReport, 'utf8'));
  const pageIndex = JSON.parse(fs.readFileSync(paths.pageIndex, 'utf8'));
  const html = fs.readFileSync(paths.html, 'utf8');
  const browser = fs.readFileSync(paths.browser, 'utf8');
  const enrichment = fs.readFileSync(paths.enrichment, 'utf8');
  const browserTest = fs.readFileSync(paths.browserTest, 'utf8');
  const mainWorkflow = fs.readFileSync(paths.mainWorkflow, 'utf8');
  const visualWorkflow = fs.readFileSync(paths.visualWorkflow, 'utf8');
  const linkWorkflow = fs.readFileSync(paths.linkWorkflow, 'utf8');
  const integrity = siteHealth.technical_integrity;

  if (!isObject(integrity)) {
    errors.push('site_health.technical_integrity must be an object');
  } else {
    if (integrity.status !== 'passed') errors.push('technical_integrity.status must be passed');
    if (integrity.failed !== 0) errors.push('technical_integrity.failed must be 0');
    [
      'pages_indexed',
      'pages_checked',
      'links_discovered',
      'internal_links_checked',
      'unique_internal_targets',
      'external_links_ignored',
      'protocol_links_ignored',
      'failed'
    ].forEach((key) => number(errors, `technical_integrity.${key}`, integrity[key]));

    const exactFields = [
      'generated_at',
      'pages_indexed',
      'pages_checked',
      'links_discovered',
      'internal_links_checked',
      'unique_internal_targets',
      'external_links_ignored',
      'protocol_links_ignored',
      'failed'
    ];
    exactFields.forEach((key) => {
      if (integrity[key] !== linkReport[key]) errors.push(`technical_integrity.${key} must match public link report`);
    });

    const indexedCount = Array.isArray(pageIndex.pages) ? pageIndex.pages.length : 0;
    if (integrity.pages_indexed !== indexedCount) errors.push('technical_integrity.pages_indexed must match page_index pages');
    if (integrity.pages_checked !== integrity.pages_indexed) errors.push('all indexed pages must be checked');
    if (!integrity.report_url || integrity.report_url !== '/data/public_link_integrity.json') errors.push('technical_integrity.report_url is invalid');
    if (!Array.isArray(integrity.confirms) || integrity.confirms.length < 4) errors.push('technical_integrity.confirms must contain at least four boundaries');
    if (!Array.isArray(integrity.does_not_confirm) || integrity.does_not_confirm.length < 4) errors.push('technical_integrity.does_not_confirm must contain at least four boundaries');
    const boundaryText = (integrity.does_not_confirm || []).join(' ').toLowerCase();
    ['председател', 'границ', 'документ', 'github pages'].forEach((term) => {
      if (!boundaryText.includes(term)) errors.push(`technical_integrity factual boundary must mention ${term}`);
    });

    if (!isObject(integrity.automation)) errors.push('technical_integrity.automation must be an object');
    else {
      if (integrity.automation.http_link_workflow_enabled !== true) errors.push('HTTP link workflow must be enabled');
      if (integrity.automation.browser_suites_enabled < 6) errors.push('at least six browser suites must be enabled');
      if (!Array.isArray(integrity.automation.browser_suites) || integrity.automation.browser_suites.some((item) => !item.enabled)) {
        errors.push('all browser suites must be listed and enabled');
      }
      if (integrity.automation.visual_cases < 16) errors.push('visual matrix must include at least 16 cases');
    }
  }

  requireFragments(errors, 'site-health HTML', html, [
    'id="site-health-integrity-section"',
    'id="site-health-integrity"',
    'Целостность страниц и переходов',
    'Техническая проверка ссылок подтверждает работоспособность переходов, но не достоверность',
    '/assets/css/site-health-integrity.css',
    '/assets/js/site-health-integrity.js'
  ]);

  requireFragments(errors, 'site-health browser renderer', browser, [
    "fetch('/data/site_health.json'",
    'data-integrity-metrics',
    'Что подтверждает проверка',
    'Что она не подтверждает',
    'Открыть JSON проверки',
    '/data/public_link_integrity.json'
  ]);

  requireFragments(errors, 'integrity enrichment', enrichment, [
    "public_link_integrity.json",
    'technical_integrity',
    'pages_checked',
    'internal_links_checked',
    'unique_internal_targets',
    'does_not_confirm',
    'Settings → Pages',
    'BROWSER_SUITES'
  ]);

  requireFragments(errors, 'browser test', browserTest, [
    "require('playwright')",
    'SITE_HEALTH_INTEGRITY_REPORT',
    'site-health-integrity-section',
    'Что она не подтверждает',
    'overflowDiagnostics',
    'Site health technical integrity browser OK'
  ]);

  const mainOrder = [
    'Generate public index',
    'Start current-build HTTP audit server',
    'Generate current-build public link integrity report',
    'Stop current-build HTTP audit server',
    'Enrich site health with technical integrity',
    'Audit site health technical integrity',
    'Run full project mode audits'
  ].map((fragment) => mainWorkflow.indexOf(fragment));
  if (mainOrder.some((index) => index < 0) || mainOrder.some((index, position) => position > 0 && index <= mainOrder[position - 1])) {
    errors.push('main workflow technical integrity steps are missing or out of order');
  }
  requireFragments(errors, 'main workflow', mainWorkflow, [
    'PUBLIC_LINK_REPORT: data/public_link_integrity.json',
    'python3 -m http.server 4173 --bind 127.0.0.1',
    'node scripts/test_public_link_integrity.js',
    'node scripts/enrich_site_health_technical_integrity.js',
    'node scripts/audit_site_health_technical_integrity.js'
  ]);

  requireFragments(errors, 'visual workflow', visualWorkflow, [
    "- 'site-health/index.html'",
    "- 'assets/js/**'",
    "- 'scripts/enrich_site_health_technical_integrity.js'",
    "- 'scripts/audit_site_health_technical_integrity.js'",
    "- 'scripts/test_site_health_technical_integrity.js'",
    'Generate visual-run public link integrity report',
    'Enrich visual-run site health technical integrity',
    'Test site health technical integrity',
    'SITE_HEALTH_INTEGRITY_REPORT: .artifacts/visual-baseline/site-health-integrity.json'
  ]);

  requireFragments(errors, 'public link workflow', linkWorkflow, [
    'name: Audit public link integrity',
    'contents: read',
    'node scripts/test_public_link_integrity.js'
  ]);
  if (/contents:\s*write|pull-requests:\s*write|git\s+(commit|push)|git-auto-commit|create-pull-request/i.test(linkWorkflow)) {
    errors.push('public link workflow must remain read-only');
  }

  try {
    [paths.browser, paths.enrichment, paths.browserTest, __filename].forEach((filePath) => {
      execFileSync(process.execPath, ['--check', filePath], { cwd: ROOT, stdio: 'pipe' });
    });
  } catch (error) {
    errors.push(`technical integrity syntax failed: ${String(error.stderr || error.message).trim()}`);
  }

  if (errors.length) throw new Error(`Site health technical integrity audit failed:\n${errors.join('\n')}`);
  console.log(`Site health technical integrity OK: ${integrity.pages_checked} pages, ${integrity.internal_links_checked} internal links, ${integrity.automation.visual_cases} visual cases`);
}

main();

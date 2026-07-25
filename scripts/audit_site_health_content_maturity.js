const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.cwd();
const HEALTH_PATH = path.join(ROOT, 'data', 'site_health.json');
const AUDIT_PATH = path.join(ROOT, 'data', 'tos_content_audit.json');
const ORIGIN_PATH = path.join(ROOT, 'data', 'content_origin_report.json');
const ENRICHER_PATH = path.join(ROOT, 'scripts', 'enrich_site_health_content_maturity.js');

function main() {
  const errors = [];
  [HEALTH_PATH, AUDIT_PATH, ORIGIN_PATH, ENRICHER_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Site health content maturity audit failed:\n${errors.join('\n')}`);

  execFileSync(process.execPath, [ENRICHER_PATH], { cwd: ROOT, stdio: 'pipe' });

  const health = JSON.parse(fs.readFileSync(HEALTH_PATH, 'utf8'));
  const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
  const origin = JSON.parse(fs.readFileSync(ORIGIN_PATH, 'utf8'));
  const maturity = health.content_maturity || {};
  const coverage = origin.tos_coverage || {};
  const summary = audit.summary || {};

  if (!Array.isArray(health.audit_scope) || !health.audit_scope.some((item) => item.includes('происхождение публикаций'))) {
    errors.push('audit scope does not mention publication origins');
  }
  if (maturity.total_tos !== (coverage.total_tos || summary.total_tos || 0)) errors.push('content maturity total_tos mismatch');
  if (maturity.with_verified_content !== (coverage.with_verified_content || 0)) errors.push('verified content coverage mismatch');
  if (maturity.with_editorial_content !== (coverage.with_editorial_content || 0)) errors.push('editorial content coverage mismatch');
  if (maturity.with_only_starter_or_request !== (coverage.with_only_starter_or_request || 0)) errors.push('request/starter-only coverage mismatch');
  if (maturity.without_any_content !== (coverage.without_any_content || 0)) errors.push('empty content coverage mismatch');
  if (maturity.with_substantive_content !== (maturity.with_verified_content + maturity.with_editorial_content)) {
    errors.push('substantive coverage must equal verified plus editorial coverage');
  }

  const requestOnly = maturity.request_only_by_section || {};
  ['news', 'done', 'needs', 'projects'].forEach((key) => {
    if (requestOnly[key] !== (summary[`request_only_${key}`] || 0)) errors.push(`${key} request-only count mismatch`);
  });

  const findings = health.findings || [];
  if (!findings.some((item) => item.area === 'Зрелость контента' && item.finding.includes('Содержательные материалы есть'))) {
    errors.push('content maturity finding is missing');
  }
  if (!findings.some((item) => item.area === 'Редакционные запросы' && item.finding.includes('Запрос вместо содержательной записи'))) {
    errors.push('editorial requests finding is missing');
  }
  if (findings.some((item) => item.area === 'Контент')) errors.push('legacy generic content finding must be removed');

  const source = fs.readFileSync(ENRICHER_PATH, 'utf8');
  ['content_maturity', 'request_only_by_section', 'with_substantive_content', 'Зрелость контента', 'Редакционные запросы'].forEach((fragment) => {
    if (!source.includes(fragment)) errors.push(`enricher missing ${fragment}`);
  });
  ['sendBeacon', 'XMLHttpRequest', 'fetch('].forEach((signal) => {
    if (source.includes(signal)) errors.push(`enricher must remain local-only: ${signal}`);
  });

  try {
    execFileSync(process.execPath, ['--check', ENRICHER_PATH], { cwd: ROOT, stdio: 'pipe' });
    execFileSync(process.execPath, ['--check', __filename], { cwd: ROOT, stdio: 'pipe' });
  } catch (error) {
    errors.push(`syntax failed: ${String(error.stderr || error.message).trim()}`);
  }

  if (errors.length) throw new Error(`Site health content maturity audit failed:\n${errors.join('\n')}`);
  console.log(`Site health content maturity OK: substantive ${maturity.with_substantive_content}/${maturity.total_tos}, request/starter only ${maturity.with_only_starter_or_request}`);
}

main();

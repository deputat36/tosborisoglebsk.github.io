const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'data', 'accessibility_performance_report.json');

function main() {
  const errors = [];

  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error(`Missing file: ${REPORT_PATH}`);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const summary = report.summary || {};
  const issueCounts = summary.issue_counts || {};
  const issueSeverity = summary.issue_severity || {};

  if (!/^\d{4}-\d{2}-\d{2}T/.test(report.generated_at || '')) errors.push('generated_at must be an ISO timestamp');
  if (!Number.isInteger(summary.html_pages) || summary.html_pages < 1) errors.push('summary.html_pages must be a positive integer');
  if (!Number.isInteger(summary.public_pages) || summary.public_pages < 1) errors.push('summary.public_pages must be a positive integer');
  if (summary.public_pages > summary.html_pages) errors.push('public_pages cannot exceed html_pages');
  if (!Number.isInteger(summary.pages_with_issues) || summary.pages_with_issues < 0) errors.push('pages_with_issues must be a non-negative integer');
  if (!Array.isArray(report.page_findings)) errors.push('page_findings must be an array');
  if (!Array.isArray(report.largest_assets)) errors.push('largest_assets must be an array');
  if (!Array.isArray(report.over_budget_assets)) errors.push('over_budget_assets must be an array');
  if (!Array.isArray(report.notes) || !report.notes.length) errors.push('notes must contain audit limitations');

  if ((summary.pages_with_issues || 0) !== 0) {
    errors.push(`pages_with_issues must stay 0, got ${summary.pages_with_issues}`);
  }

  const activeIssueTypes = Object.entries(issueCounts).filter(([, count]) => Number(count) > 0);
  if (activeIssueTypes.length) {
    errors.push(`accessibility issue counts must stay 0: ${activeIssueTypes.map(([type, count]) => `${type}=${count}`).join(', ')}`);
  }

  for (const level of ['high', 'medium', 'low']) {
    if ((issueSeverity[level] || 0) !== 0) {
      errors.push(`issue_severity.${level} must stay 0, got ${issueSeverity[level]}`);
    }
  }

  if (Array.isArray(report.page_findings) && report.page_findings.length !== 0) {
    errors.push(`page_findings must stay empty, got ${report.page_findings.length} rows`);
  }

  if (Array.isArray(report.over_budget_assets) && report.over_budget_assets.length !== 0) {
    errors.push(`over_budget_assets must stay empty, got ${report.over_budget_assets.length} files`);
  }
  if ((summary.over_budget_assets || 0) !== 0) errors.push(`summary.over_budget_assets must stay 0, got ${summary.over_budget_assets}`);
  if (summary.total_css_over_budget) errors.push('total CSS exceeds configured baseline budget');
  if (summary.total_js_over_budget) errors.push('total JavaScript exceeds configured baseline budget');

  (report.largest_assets || []).forEach((asset, index) => {
    if (!asset.path || !asset.group || !Number.isInteger(asset.size_bytes)) {
      errors.push(`largest_assets row ${index + 1}: invalid asset record`);
      return;
    }
    const filePath = path.join(ROOT, asset.path);
    if (!fs.existsSync(filePath)) errors.push(`largest_assets row ${index + 1}: missing file ${asset.path}`);
    if (asset.over_budget) errors.push(`largest_assets row ${index + 1}: ${asset.path} exceeds its configured budget`);
  });

  if (errors.length) {
    throw new Error(`Accessibility/performance audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Accessibility/performance gate OK: ${summary.html_pages} pages, ${summary.asset_files || 0} assets, zero findings`);
}

main();

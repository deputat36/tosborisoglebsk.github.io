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

  if (!/^\d{4}-\d{2}-\d{2}T/.test(report.generated_at || '')) errors.push('generated_at must be an ISO timestamp');
  if (!Number.isInteger(summary.html_pages) || summary.html_pages < 1) errors.push('summary.html_pages must be a positive integer');
  if (!Number.isInteger(summary.public_pages) || summary.public_pages < 1) errors.push('summary.public_pages must be a positive integer');
  if (summary.public_pages > summary.html_pages) errors.push('public_pages cannot exceed html_pages');
  if (!Number.isInteger(summary.pages_with_issues) || summary.pages_with_issues < 0) errors.push('pages_with_issues must be a non-negative integer');
  if (!Array.isArray(report.page_findings)) errors.push('page_findings must be an array');
  if (!Array.isArray(report.largest_assets)) errors.push('largest_assets must be an array');
  if (!Array.isArray(report.over_budget_assets)) errors.push('over_budget_assets must be an array');
  if (!Array.isArray(report.notes) || !report.notes.length) errors.push('notes must contain audit limitations');

  if ((issueCounts.missing_html_lang || 0) > 0) {
    errors.push(`missing_html_lang must be 0, got ${issueCounts.missing_html_lang}`);
  }
  if ((issueCounts.external_blank_links_without_noopener || 0) > 0) {
    errors.push(`unsafe target=_blank links must be 0, got ${issueCounts.external_blank_links_without_noopener}`);
  }

  if ((summary.total_css_bytes || 0) > 2 * 1024 * 1024) errors.push('total CSS exceeds critical 2 MiB limit');
  if ((summary.total_js_bytes || 0) > 5 * 1024 * 1024) errors.push('total JavaScript exceeds critical 5 MiB limit');

  (report.largest_assets || []).forEach((asset, index) => {
    if (!asset.path || !asset.group || !Number.isInteger(asset.size_bytes)) {
      errors.push(`largest_assets row ${index + 1}: invalid asset record`);
      return;
    }
    const filePath = path.join(ROOT, asset.path);
    if (!fs.existsSync(filePath)) errors.push(`largest_assets row ${index + 1}: missing file ${asset.path}`);
  });

  if (errors.length) {
    throw new Error(`Accessibility/performance audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Accessibility/performance baseline OK: ${summary.html_pages} pages, ${summary.asset_files || 0} assets, ${summary.pages_with_issues || 0} pages with findings`);
}

main();

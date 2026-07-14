const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'data', 'site_health.json');

function main() {
  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error('Site health quality gate failed: missing data/site_health.json');
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const pages = report.pages || {};
  const seoWarnings = Array.isArray(report.seo_warnings) ? report.seo_warnings : null;
  const brokenLinks = Array.isArray(report.broken_internal_links) ? report.broken_internal_links : null;
  const errors = [];

  if (!Number.isInteger(pages.seo_warnings_count)) errors.push('pages.seo_warnings_count must be an integer');
  if (!Number.isInteger(pages.broken_internal_links_count)) errors.push('pages.broken_internal_links_count must be an integer');
  if (!seoWarnings) errors.push('seo_warnings must be an array');
  if (!brokenLinks) errors.push('broken_internal_links must be an array');

  if (seoWarnings && pages.seo_warnings_count !== seoWarnings.length) {
    errors.push('pages.seo_warnings_count must match seo_warnings length');
  }
  if (brokenLinks && pages.broken_internal_links_count !== brokenLinks.length) {
    errors.push('pages.broken_internal_links_count must match broken_internal_links length');
  }

  if (pages.seo_warnings_count !== 0) errors.push(`pages.seo_warnings_count must be zero, got ${pages.seo_warnings_count}`);
  if (pages.broken_internal_links_count !== 0) errors.push(`pages.broken_internal_links_count must be zero, got ${pages.broken_internal_links_count}`);
  if (seoWarnings && seoWarnings.length !== 0) errors.push(`seo_warnings must be empty, got ${seoWarnings.length}`);
  if (brokenLinks && brokenLinks.length !== 0) errors.push(`broken_internal_links must be empty, got ${brokenLinks.length}`);

  if (errors.length) throw new Error(`Site health quality gate failed:\n${errors.join('\n')}`);

  console.log('Site health quality gate OK: zero SEO warnings and zero broken internal links');
}

main();

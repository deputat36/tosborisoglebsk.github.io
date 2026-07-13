const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'site-health', 'index.html');
const CLIENT_PATH = path.join(ROOT, 'assets', 'js', 'site-health-priority-readiness.js');
const REPORT_PATH = path.join(ROOT, 'data', 'priority_tos_update_readiness.json');

function main() {
  const errors = [];

  [PAGE_PATH, CLIENT_PATH, REPORT_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Site health priority readiness audit failed:\n${errors.join('\n')}`);

  const pageHtml = fs.readFileSync(PAGE_PATH, 'utf8');
  const clientJs = fs.readFileSync(CLIENT_PATH, 'utf8');
  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));

  const requiredPageFragments = [
    '/assets/js/site-health-priority-readiness.js',
    '/data-requests/priority-tos/#priority-tos-readiness',
    '/data/priority_tos_update_readiness.json',
    'id="site-health-priority"'
  ];
  requiredPageFragments.forEach((fragment) => {
    if (!pageHtml.includes(fragment)) errors.push(`site-health page missing ${fragment}`);
  });

  const requiredClientFragments = [
    '/data/priority_tos_update_readiness.json',
    'site-health-priority',
    'data-readiness-enriched',
    'stage_label',
    'blockers',
    'next_action',
    '/data-requests/priority-tos/#priority-tos-readiness'
  ];
  requiredClientFragments.forEach((fragment) => {
    if (!clientJs.includes(fragment)) errors.push(`site-health readiness client missing ${fragment}`);
  });

  if (!Array.isArray(report.items) || report.items.length !== 4) {
    errors.push('readiness report must contain four items');
  }

  const reportSlugs = new Set((report.items || []).map((item) => item.slug));
  ['ivanovka', 'podstepki', 'gubari', 'tancyrey'].forEach((slug) => {
    if (!reportSlugs.has(slug)) errors.push(`readiness report missing ${slug}`);
  });

  if (/public_source_url|private_source_recorded|send_channel|response_text|message_text/.test(clientJs)) {
    errors.push('site-health readiness client must not request or render sensitive report fields');
  }

  if (errors.length) {
    throw new Error(`Site health priority readiness audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Site health priority readiness OK: ${report.items.length} cards enriched`);
}

main();

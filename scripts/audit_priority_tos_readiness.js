const fs = require('fs');
const path = require('path');
const { buildReport, STAGES } = require('./generate_priority_tos_readiness');

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'data', 'priority_tos_update_readiness.json');
const PAGE_PATH = path.join(ROOT, 'data-requests', 'priority-tos', 'index.html');
const CLIENT_PATH = path.join(ROOT, 'assets', 'js', 'priority-tos-readiness.js');
const SITE_HEALTH_PAGE_PATH = path.join(ROOT, 'site-health', 'index.html');
const SITE_HEALTH_CLIENT_PATH = path.join(ROOT, 'assets', 'js', 'site-health-priority-readiness.js');
const REQUIRED_SLUGS = ['ivanovka', 'podstepki', 'gubari', 'tancyrey'];
const FORBIDDEN_KEYS = new Set([
  'send_channel',
  'public_source_url',
  'private_source_recorded',
  'notes',
  'phones',
  'emails',
  'phone',
  'email',
  'source_ref',
  'response_text',
  'message_text'
]);

function inspectKeys(value, prefix = '', errors = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectKeys(item, `${prefix}[${index}]`, errors));
    return errors;
  }
  if (!value || typeof value !== 'object') return errors;

  Object.entries(value).forEach(([key, child]) => {
    const location = prefix ? `${prefix}.${key}` : key;
    if (FORBIDDEN_KEYS.has(key)) errors.push(`forbidden sensitive key ${location}`);
    inspectKeys(child, location, errors);
  });
  return errors;
}

function comparable(report) {
  return {
    privacy_note: report.privacy_note,
    stages: report.stages,
    summary: report.summary,
    items: report.items
  };
}

function requireFragments(errors, label, content, fragments) {
  fragments.forEach((fragment) => {
    if (!content.includes(fragment)) errors.push(`${label} missing ${fragment}`);
  });
}

function main() {
  const errors = [];

  [REPORT_PATH, PAGE_PATH, CLIENT_PATH, SITE_HEALTH_PAGE_PATH, SITE_HEALTH_CLIENT_PATH].forEach((filePath) => {
    if (!fs.existsSync(filePath)) errors.push(`missing file ${path.relative(ROOT, filePath)}`);
  });
  if (errors.length) throw new Error(`Priority TOS readiness audit failed:\n${errors.join('\n')}`);

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const pageHtml = fs.readFileSync(PAGE_PATH, 'utf8');
  const clientJs = fs.readFileSync(CLIENT_PATH, 'utf8');
  const siteHealthHtml = fs.readFileSync(SITE_HEALTH_PAGE_PATH, 'utf8');
  const siteHealthClientJs = fs.readFileSync(SITE_HEALTH_CLIENT_PATH, 'utf8');

  if (!/^\d{4}-\d{2}-\d{2}T/.test(report.generated_at || '')) errors.push('generated_at must be an ISO timestamp');
  if (!report.privacy_note) errors.push('privacy_note is required');
  if (!report.summary || report.summary.total !== 4) errors.push('summary.total must equal 4');
  if (!Array.isArray(report.items) || report.items.length !== 4) errors.push('items must contain four cards');
  if (!report.stages || Object.keys(report.stages).sort().join('|') !== Object.keys(STAGES).sort().join('|')) {
    errors.push('stage definitions do not match generator');
  }

  const seen = new Set();
  (report.items || []).forEach((item, index) => {
    const label = `item ${index + 1}`;
    if (!REQUIRED_SLUGS.includes(item.slug)) errors.push(`${label}: unexpected slug ${item.slug}`);
    if (seen.has(item.slug)) errors.push(`${label}: duplicate slug ${item.slug}`);
    seen.add(item.slug);
    if (!STAGES[item.stage]) errors.push(`${label}: unsupported stage ${item.stage}`);
    if (!item.stage_label) errors.push(`${label}: missing stage_label`);
    if (!item.card_url || item.card_url !== `/tos/${item.slug}/`) errors.push(`${label}: invalid card_url`);
    if (!Array.isArray(item.blockers)) errors.push(`${label}: blockers must be an array`);
    if (!item.next_action) errors.push(`${label}: missing next_action`);
  });

  REQUIRED_SLUGS.forEach((slug) => {
    if (!seen.has(slug)) errors.push(`missing required slug ${slug}`);
  });

  const stageTotal = Object.values(report.summary?.by_stage || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  if (stageTotal !== report.summary?.total) errors.push('summary.by_stage must sum to total');

  inspectKeys(report, '', errors);

  const expected = buildReport(report.generated_at);
  if (JSON.stringify(comparable(report)) !== JSON.stringify(comparable(expected))) {
    errors.push('report does not match current tracking and response-review data');
  }

  requireFragments(errors, 'priority TOS request page', pageHtml, [
    '/assets/js/priority-tos-readiness.js'
  ]);
  requireFragments(errors, 'priority readiness client', clientJs, [
    '/data/priority_tos_update_readiness.json',
    'priority-tos-readiness',
    'stage_label',
    'blockers',
    'next_action'
  ]);
  requireFragments(errors, 'site-health page', siteHealthHtml, [
    '/assets/js/site-health-priority-readiness.js',
    '/data-requests/priority-tos/',
    '/data/priority_tos_update_readiness.json',
    'id="site-health-priority"'
  ]);
  requireFragments(errors, 'site-health readiness client', siteHealthClientJs, [
    '/data/priority_tos_update_readiness.json',
    'site-health-priority',
    'readinessEnriched',
    'stage_label',
    'blockers',
    'next_action',
    '/data-requests/priority-tos/#priority-tos-readiness'
  ]);

  if (/public_source_url|private_source_recorded|send_channel|response_text|message_text/.test(siteHealthClientJs)) {
    errors.push('site-health readiness client must not request or render sensitive report fields');
  }

  if (errors.length) {
    throw new Error(`Priority TOS readiness audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Priority TOS readiness OK: ${report.summary.total} cards, ${report.summary.ready_for_card_update} ready for update, site-health enriched`);
}

main();

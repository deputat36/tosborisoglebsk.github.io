const fs = require('fs');
const path = require('path');
const { parseCsv } = require('./lib/csv');
const { validateHeaders } = require('./lib/csv_schema');
const { repoPathExists } = require('./lib/path_checks');

const filePath = path.join(process.cwd(), 'data', 'content_freshness_check.csv');
const expectedHeaders = [
  'area',
  'page_or_file',
  'current_state',
  'freshness_risk',
  'source_required',
  'review_frequency',
  'status',
  'next_step'
];
const risks = new Set(['high', 'medium', 'low']);
const frequencies = new Set(['еженедельно', 'ежемесячно', 'после каждого обновления', 'после получения реестра']);
const statuses = new Set(['pending', 'needs_review', 'needs_update', 'blocked', 'missing', 'ok']);

function extractTargets(value) {
  if (!value) return [];

  return value
    .split(/\s+и\s+|\s+/)
    .map((part) => part.trim().replace(/,$/, ''))
    .filter(Boolean)
    .filter((part) => part.startsWith('/') || part.startsWith('data/'));
}

function targetShouldExist(target) {
  return !target.includes('*');
}

function main() {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing file: ${filePath}`);
  }

  const rows = parseCsv(fs.readFileSync(filePath, 'utf8'));
  const [headers, ...items] = rows;
  const errors = validateHeaders(headers, expectedHeaders, 'content_freshness_check.csv');
  const seenAreas = new Set();

  items.forEach((item, index) => {
    const line = index + 2;
    const [
      area,
      pageOrFile,
      currentState,
      freshnessRisk,
      sourceRequired,
      reviewFrequency,
      status,
      nextStep
    ] = item;

    if (!area) errors.push(`line ${line}: missing area`);
    if (area && seenAreas.has(area)) errors.push(`line ${line}: duplicate area ${area}`);
    if (area) seenAreas.add(area);

    if (!pageOrFile) errors.push(`line ${line}: missing page_or_file`);
    if (!currentState || currentState.length < 15) errors.push(`line ${line}: current_state is missing or too short`);
    if (!risks.has(freshnessRisk)) errors.push(`line ${line}: unsupported freshness_risk ${freshnessRisk}`);
    if (!sourceRequired || sourceRequired.length < 15) errors.push(`line ${line}: source_required is missing or too short`);
    if (!frequencies.has(reviewFrequency)) errors.push(`line ${line}: unsupported review_frequency ${reviewFrequency}`);
    if (!statuses.has(status)) errors.push(`line ${line}: unsupported status ${status}`);
    if (!nextStep) errors.push(`line ${line}: missing next_step`);

    extractTargets(pageOrFile).forEach((target) => {
      if (targetShouldExist(target) && !repoPathExists(target)) {
        errors.push(`line ${line}: missing page_or_file target ${target}`);
      }
    });

    if (freshnessRisk === 'high' && status === 'ok') {
      errors.push(`line ${line}: high risk area cannot be ok without a current dated source`);
    }
    if ((status === 'blocked' || status === 'missing') && !nextStep.match(/получ|собир|свер|провер|не /i)) {
      errors.push(`line ${line}: status ${status} needs an actionable next_step`);
    }
  });

  if (errors.length) {
    throw new Error(`Content freshness check audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Content freshness check OK: ${items.length} rows`);
}

main();
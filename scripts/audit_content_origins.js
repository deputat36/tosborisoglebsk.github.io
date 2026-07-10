const fs = require('fs');
const path = require('path');
const { CONTENT_ORIGINS, inferContentOrigin } = require('./lib/content_origin');

const ROOT = process.cwd();
const REPORT_PATH = path.join(ROOT, 'data', 'content_origin_report.json');
const COLLECTIONS = ['news', 'projects', 'needs', 'done'];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function emptyCounts() {
  return { total: 0, verified: 0, editorial: 0, starter: 0, request: 0 };
}

function compareCounts(errors, label, actual, expected) {
  Object.keys(expected).forEach((key) => {
    if (actual?.[key] !== expected[key]) {
      errors.push(`${label}.${key}: expected ${expected[key]}, got ${actual?.[key]}`);
    }
  });
}

function main() {
  const errors = [];
  const counts = {};
  const totalCounts = emptyCounts();
  const toses = readJson(path.join(ROOT, 'data', 'toses.json')).filter((item) => item && item.slug && item.status !== 'draft');
  const coverage = new Map(toses.map((tos) => [tos.slug, new Set()]));

  COLLECTIONS.forEach((collection) => {
    const filePath = path.join(ROOT, 'data', `${collection}.json`);
    const items = readJson(filePath);
    if (!Array.isArray(items)) {
      errors.push(`${collection}: data file must contain an array`);
      return;
    }

    counts[collection] = emptyCounts();

    items.filter((item) => item && item.status !== 'draft').forEach((item, index) => {
      const label = `${collection} row ${index + 1} ${item?.id || 'unknown'}`;
      const explicit = String(item?.content_origin || '').trim().toLowerCase();
      const inferred = inferContentOrigin(item, collection, { ignoreExplicit: true });

      if (!CONTENT_ORIGINS.has(explicit)) {
        errors.push(`${label}: invalid or missing content_origin ${explicit || '(empty)'}`);
        return;
      }

      if (explicit !== inferred) {
        errors.push(`${label}: content_origin ${explicit} conflicts with deterministic classification ${inferred}`);
      }

      counts[collection].total += 1;
      counts[collection][explicit] += 1;
      totalCounts.total += 1;
      totalCounts[explicit] += 1;
      if (item.tos_slug && coverage.has(item.tos_slug)) coverage.get(item.tos_slug).add(explicit);

      if (explicit === 'verified') {
        const source = item.source || item.source_label;
        if (!source) errors.push(`${label}: verified content requires source or source_label`);
        if (!item.source_url) errors.push(`${label}: verified content requires source_url`);
      }

      if (explicit === 'request' && collection === 'done' && !item.needs_details) {
        errors.push(`${label}: result request requires needs_details`);
      }
    });
  });

  const expectedCoverage = {
    total_tos: toses.length,
    with_verified_content: 0,
    with_editorial_content: 0,
    with_only_starter_or_request: 0,
    without_any_content: 0
  };

  coverage.forEach((origins) => {
    if (origins.has('verified')) expectedCoverage.with_verified_content += 1;
    else if (origins.has('editorial')) expectedCoverage.with_editorial_content += 1;
    else if (origins.has('starter') || origins.has('request')) expectedCoverage.with_only_starter_or_request += 1;
    else expectedCoverage.without_any_content += 1;
  });

  const report = readJson(REPORT_PATH);
  COLLECTIONS.forEach((collection) => compareCounts(errors, `report.collections.${collection}`, report.collections?.[collection], counts[collection]));
  compareCounts(errors, 'report.totals', report.totals, totalCounts);
  compareCounts(errors, 'report.tos_coverage', report.tos_coverage, expectedCoverage);

  if (!report.definitions || !CONTENT_ORIGINS.size) errors.push('report.definitions must be present');
  CONTENT_ORIGINS.forEach((origin) => {
    if (!report.definitions?.[origin]) errors.push(`report.definitions.${origin} is missing`);
  });

  if (errors.length) {
    throw new Error(`Content origin audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Content origins OK: ${JSON.stringify(counts)}`);
}

main();

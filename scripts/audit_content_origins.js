const fs = require('fs');
const path = require('path');
const { CONTENT_ORIGINS, inferContentOrigin } = require('./lib/content_origin');

const ROOT = process.cwd();
const COLLECTIONS = ['news', 'projects', 'needs', 'done'];

function readJson(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function main() {
  const errors = [];
  const counts = {};

  COLLECTIONS.forEach((collection) => {
    const filePath = path.join(ROOT, 'data', `${collection}.json`);
    const items = readJson(filePath);
    if (!Array.isArray(items)) {
      errors.push(`${collection}: data file must contain an array`);
      return;
    }

    counts[collection] = { verified: 0, editorial: 0, starter: 0, request: 0 };

    items.forEach((item, index) => {
      const label = `${collection} row ${index + 1} ${item?.id || 'unknown'}`;
      const explicit = String(item?.content_origin || '').trim().toLowerCase();
      const inferred = inferContentOrigin(item, collection);

      if (!CONTENT_ORIGINS.has(explicit)) {
        errors.push(`${label}: invalid or missing content_origin ${explicit || '(empty)'}`);
        return;
      }

      if (explicit !== inferred) {
        errors.push(`${label}: content_origin ${explicit} conflicts with deterministic classification ${inferred}`);
      }

      counts[collection][explicit] += 1;

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

  if (errors.length) {
    throw new Error(`Content origin audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Content origins OK: ${JSON.stringify(counts)}`);
}

main();

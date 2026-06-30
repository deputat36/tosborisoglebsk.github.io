const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const donePath = path.join(process.cwd(), 'data', 'done.json');
const requiredIds = [
  'gubari-projects-archive',
  'severnyy-39-playground',
  'chkalovec-many-projects'
];

function main() {
  const errors = [];

  if (!fs.existsSync(donePath)) {
    throw new Error(`Missing file: ${donePath}`);
  }

  const items = JSON.parse(fs.readFileSync(donePath, 'utf8'));
  if (!Array.isArray(items)) {
    throw new Error('Done required IDs audit failed:\ndata/done.json must be an array');
  }

  const ids = new Set(items.map((item) => item && item.id).filter(Boolean));

  requiredIds.forEach((id) => {
    if (!ids.has(id)) errors.push(`missing required done id ${id}`);
    if (!repoPathExists(`/done/${id}/`)) errors.push(`missing required done page /done/${id}/`);
  });

  if (errors.length) {
    throw new Error(`Done required IDs audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Done required IDs OK: ${requiredIds.length} items`);
}

main();

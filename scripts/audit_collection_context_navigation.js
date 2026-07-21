const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');
const { auditCollectionContext } = require('./lib/collection_context_audit');

const ROOT = process.cwd();
const TOSES_PATH = path.join(ROOT, 'data', 'toses.json');
const COLLECTIONS = [
  { name: 'projects', dataPath: path.join(ROOT, 'data', 'projects.json'), directory: 'projects' },
  { name: 'needs', dataPath: path.join(ROOT, 'data', 'needs.json'), directory: 'needs' },
  { name: 'done', dataPath: path.join(ROOT, 'data', 'done.json'), directory: 'done' }
];

function readArray(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file ${filePath}`);
    return [];
  }

  let value;
  try {
    value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`invalid JSON ${filePath}: ${error.message}`);
    return [];
  }

  if (!Array.isArray(value)) {
    errors.push(`${filePath} must contain an array`);
    return [];
  }
  return value;
}

function main() {
  const errors = [];
  const toses = readArray(TOSES_PATH, errors);
  const tosBySlug = new Map(toses.filter((item) => item?.slug).map((item) => [item.slug, item]));
  let checked = 0;

  COLLECTIONS.forEach((collection) => {
    const items = readArray(collection.dataPath, errors).filter((item) => item?.id && item.status !== 'draft');

    items.forEach((item, index) => {
      const line = `${collection.name} context ${index + 1} ${item.id}`;
      const filePath = path.join(ROOT, collection.directory, item.id, 'index.html');
      if (!fs.existsSync(filePath)) {
        errors.push(`${line}: missing generated page /${collection.directory}/${item.id}/`);
        return;
      }

      const html = fs.readFileSync(filePath, 'utf8');
      const tos = item.tos_slug ? tosBySlug.get(item.tos_slug) : null;
      auditCollectionContext({
        collection: collection.name,
        item,
        tos,
        html,
        line,
        errors,
        repoPathExists
      });
      checked += 1;
    });
  });

  if (errors.length) {
    throw new Error(`Collection context navigation audit failed:\n${errors.join('\n')}`);
  }

  console.log(`Collection context navigation OK: ${checked} pages checked`);
}

main();

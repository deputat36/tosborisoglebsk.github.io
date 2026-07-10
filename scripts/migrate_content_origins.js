const fs = require('fs');
const path = require('path');
const { inferContentOrigin } = require('./lib/content_origin');

const ROOT = process.cwd();
const COLLECTIONS = ['news', 'projects', 'needs', 'done'];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return [];
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  let updated = 0;

  COLLECTIONS.forEach((collection) => {
    const filePath = path.join(ROOT, 'data', `${collection}.json`);
    const items = readJson(filePath);
    if (!Array.isArray(items)) throw new Error(`${filePath} must contain an array`);

    const nextItems = items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const origin = inferContentOrigin(item, collection, { ignoreExplicit: true });
      if (item.content_origin !== origin) updated += 1;
      return { ...item, content_origin: origin };
    });

    writeJson(filePath, nextItems);
  });

  console.log(`Content origins synchronized: ${updated} records updated`);
}

main();

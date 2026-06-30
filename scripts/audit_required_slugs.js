const fs = require('fs');
const path = require('path');
const { repoPathExists } = require('./lib/path_checks');

const filePath = path.join(process.cwd(), 'data', 'toses.json');
const required = ['ivanovka', 'podstepki', 'gubari', 'tancyrey'];

function main() {
  if (!fs.existsSync(filePath)) throw new Error('missing data file');

  const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('data file must be array');

  const slugs = new Set(rows.map((row) => row && row.slug).filter(Boolean));
  const errors = [];

  required.forEach((slug) => {
    if (!slugs.has(slug)) errors.push(`missing slug ${slug}`);
    if (!repoPathExists(`/tos/${slug}/`)) errors.push(`missing page ${slug}`);
  });

  if (errors.length) throw new Error(`Required slugs audit failed:\n${errors.join('\n')}`);
  console.log(`Required slugs OK: ${required.length}`);
}

main();

const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'verification-tasks', 'index.html');
const csvPath = path.join(process.cwd(), 'data', 'verification_tasks.csv');
const jsPath = path.join(process.cwd(), 'assets', 'js', 'verification-tasks.js');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const html = read(htmlPath);
  const csv = read(csvPath);
  read(jsPath);

  const errors = [];
  ['noindex,nofollow', '<main id="main">', '/data/verification_tasks.csv', '/assets/js/verification-tasks.js'].forEach((item) => {
    if (!html.includes(item)) errors.push(`page missing ${item}`);
  });

  ['ivanovka', 'podstepki', 'gubari', 'tancyrey'].forEach((slug) => {
    if (!csv.includes(slug)) errors.push(`csv missing ${slug}`);
  });

  ['Slug', 'Status', 'Card', 'Task'].forEach((word) => {
    if (!csv.toLowerCase().includes(word.toLowerCase())) errors.push(`csv missing marker ${word}`);
  });

  if (errors.length) {
    throw new Error(`Verification tasks basic audit failed:\n${errors.join('\n')}`);
  }

  console.log('Verification tasks basic audit OK');
}

main();

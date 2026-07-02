const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'actions-check', 'index.html');
const csvPath = path.join(process.cwd(), 'data', 'actions_diagnostics.csv');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function main() {
  const html = read(htmlPath);
  const csv = read(csvPath);
  const errors = [];

  ['noindex,follow', 'Итог проверки на 2 июля 2026 года', 'workflow_runs', 'GitHub Actions UI нужно проверить вручную', '369 HTML-страниц', '0 SEO-предупреждений', '0 битых внутренних ссылок'].forEach((item) => {
    if (!html.includes(item)) errors.push(`page missing ${item}`);
  });

  ['actions-009', 'workflow_runs', '7d9cbb7e244ff07a96d4cab98fb4416292748405', 'warning'].forEach((item) => {
    if (!csv.includes(item)) errors.push(`csv missing ${item}`);
  });

  if (html.includes('CI проверен')) {
    errors.push('page must not claim CI is checked');
  }

  if (errors.length) {
    throw new Error(`Actions check content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Actions check content OK');
}

main();

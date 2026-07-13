const fs = require('fs');
const path = require('path');

const htmlPath = path.join(process.cwd(), 'actions-check', 'index.html');
const csvPath = path.join(process.cwd(), 'data', 'actions_diagnostics.csv');

function read(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Missing file: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function stripWarningQuotes(text) {
  return String(text || '')
    .replace(/нельзя писать «CI проверен»/g, '')
    .replace(/нельзя писать "CI проверен"/g, '');
}

function main() {
  const html = read(htmlPath);
  const csv = read(csvPath);
  const errors = [];

  ['noindex,follow', 'Итог проверки на 13 июля 2026 года', 'workflow_runs', 'интерфейс GitHub', '371 HTML-страница', '315 публичных', '0 SEO-предупреждений', '0 битых внутренних ссылок'].forEach((item) => {
    if (!html.includes(item)) errors.push(`page missing ${item}`);
  });

  ['actions-011', 'actions-012', 'workflow_runs', '667a1508d7ad0f03fae1dba3afcee4aa2df47f7e', 'warning'].forEach((item) => {
    if (!csv.includes(item)) errors.push(`csv missing ${item}`);
  });

  if (stripWarningQuotes(html).includes('CI проверен')) {
    errors.push('page must not claim CI is checked');
  }

  if (errors.length) {
    throw new Error(`Actions check content audit failed:\n${errors.join('\n')}`);
  }

  console.log('Actions check content OK');
}

main();

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_PATH = path.join(ROOT, 'data', 'tos_content_audit.json');
const OUT_PATH = path.join(ROOT, 'data', 'collection_tasks.csv');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { return null; }
}

function cell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function main() {
  const audit = readJson(AUDIT_PATH);
  const items = Array.isArray(audit?.items) ? audit.items : [];
  const rows = [[
    'ТОС',
    'slug',
    'населённый пункт',
    'председатель',
    'приоритет',
    'заполненность',
    'что уточнить',
    'рекомендации',
    'карточка',
    'форма обновления'
  ]];

  items
    .filter((item) => item.priority === 'Высокий' || (item.missing || []).length)
    .sort((a, b) => {
      const ap = a.priority === 'Высокий' ? 0 : 1;
      const bp = b.priority === 'Высокий' ? 0 : 1;
      return ap - bp || (b.missing || []).length - (a.missing || []).length || String(a.name || '').localeCompare(String(b.name || ''), 'ru');
    })
    .forEach((item) => {
      rows.push([
        item.name || '',
        item.slug || '',
        item.location || '',
        item.chairperson || '',
        item.priority || '',
        item.score || '',
        (item.missing || []).join(', '),
        (item.recommendations || []).join('; '),
        `https://tosborisoglebsk.ru/tos/${item.slug}/`,
        `https://tosborisoglebsk.ru/update-tos/?tos=${encodeURIComponent(item.slug || '')}`
      ]);
    });

  fs.writeFileSync(OUT_PATH, `\ufeff${rows.map((row) => row.map(cell).join(';')).join('\n')}\n`, 'utf8');
  console.log(`Generated collection tasks CSV: ${rows.length - 1} rows.`);
}

main();

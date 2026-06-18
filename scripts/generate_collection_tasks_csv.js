const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AUDIT_PATH = path.join(ROOT, 'data', 'tos_content_audit.json');
const OUT_PATH = path.join(ROOT, 'data', 'collection_tasks.csv');
const SITE_URL = 'https://tosborisoglebsk.ru';

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { return null; }
}

function cell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function updateUrl(slug) {
  return `${SITE_URL}/update-tos/?tos=${encodeURIComponent(slug || '')}&type=card#message-builder`;
}

function shortMessage(item) {
  const missing = (item.missing || []).join(', ') || 'актуальность сведений';
  return `Здравствуйте. Для портала ТОС БГО нужно уточнить карточку ТОС «${item.name || ''}»: ${missing}. Просим прислать только сведения, которые можно публиковать открыто.`;
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
    'форма обновления',
    'короткое сообщение'
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
        `${SITE_URL}/tos/${item.slug}/`,
        updateUrl(item.slug),
        shortMessage(item)
      ]);
    });

  fs.writeFileSync(OUT_PATH, `\ufeff${rows.map((row) => row.map(cell).join(';')).join('\n')}\n`, 'utf8');
  console.log(`Generated collection tasks CSV: ${rows.length - 1} rows.`);
}

main();
